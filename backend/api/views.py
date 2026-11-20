import base64
import binascii
import random
import uuid

from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline
from .serializers import (
    PatientSerializer,
    WoundAssessmentScanSerializer,
    TreatmentGuidelineSerializer,
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
)
from .ai_pipeline import run_ai_inference_pipeline, detect_wound_box, pipeline_status

PENDING_TYPE = "Pending AI Scan"
# A wound's type is identified by the AI on its first scan and then kept for every
# later scan. Until then it holds one of these placeholders.
UNSET_TYPES = {"", PENDING_TYPE, "Unclassified"}


def wound_type_is_set(wound_profile):
    return bool(wound_profile) and (wound_profile.wound_type or "") not in UNSET_TYPES


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _decode_image(value):
    """data-URL / raw base64 -> (bytes, ext); raises ValidationError on garbage."""
    if not value:
        return None, None
    header, _, payload = value.partition(",") if value.startswith("data:") else ("", "", value)
    ext = "png" if "png" in header else "webp" if "webp" in header else "jpg"
    try:
        return base64.b64decode(payload, validate=False), ext
    except (binascii.Error, ValueError):
        raise ValidationError({"image_base64": "Image data is not valid base64."})


def _generate_patient_id(owner):
    """Random 3-digit IDs first (familiar format); widen if this clinician's space fills up."""
    taken = set(Patient.objects.filter(owner=owner).values_list("custom_id", flat=True))
    for digits in (3, 4, 6):
        low, high = 10 ** (digits - 1), 10 ** digits - 1
        for _ in range(50):
            candidate = str(random.randint(low, high))
            if candidate not in taken:
                return candidate
    return uuid.uuid4().hex[:8]


def _wound_status(severity_score, healing_status):
    if severity_score >= 4:
        return "ACTION NEEDED", "danger"
    if healing_status == "Deteriorating":
        return "DETERIORATING", "warning"
    if healing_status == "Improving":
        return "IMPROVING", "success"
    return "STABLE", "info"


def _owned_patient(request, patient_id):
    if patient_id in (None, ""):
        raise ValidationError({"patient_id": "patient_id is required."})
    return get_object_or_404(Patient, owner=request.user, custom_id=str(patient_id).strip())


def _patient_wound(patient, wound_id):
    """The requested wound must belong to this patient; default to the first wound."""
    if wound_id not in (None, "", "primary"):
        wound = patient.wounds.filter(id=wound_id).first() if str(wound_id).isdigit() else None
        if wound is None:
            raise ValidationError({"wound_id": "This wound does not belong to the patient."})
        return wound
    return patient.wounds.first()


# ---------------------------------------------------------------------------
# auth
# ---------------------------------------------------------------------------
class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response(
                {"token": token.key, "user": UserSerializer(user).data, "message": "Registration successful."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            token, _ = Token.objects.get_or_create(user=user)
            return Response(
                {"token": token.key, "user": UserSerializer(user).data, "message": "Login successful."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserSerializer(request.user).data}, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)


class HealthAPIView(APIView):
    """GET /api/health/ - lets the app (and you) check the server and which AI models are loaded."""
    permission_classes = [AllowAny]

    def get(self, request):
        data = {"status": "ok"}
        if request.query_params.get("models") == "1":
            data["models"] = pipeline_status()
        return Response(data)


# ---------------------------------------------------------------------------
# patients
# ---------------------------------------------------------------------------
class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    lookup_field = 'custom_id'
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Patient.objects.filter(owner=self.request.user)
            .prefetch_related('scans', 'wounds', 'wounds__scans')
            .order_by('-created_at')
        )

    def create(self, request, *args, **kwargs):
        data = request.data
        requested_id = str(data.get('id') or "").strip()
        if requested_id and Patient.objects.filter(owner=request.user, custom_id=requested_id).exists():
            return Response({"id": [f"Patient ID {requested_id} is already in use."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            age = int(data.get('age', 45))
        except (TypeError, ValueError):
            return Response({"age": ["Age must be a number."]}, status=status.HTTP_400_BAD_REQUEST)

        anatomical_location = data.get('anatomicalLocation') or 'Lower Extremity'
        wound_type = PENDING_TYPE  # identified by the AI on the first scan, not chosen at registration
        try:
            with transaction.atomic():
                patient = Patient.objects.create(
                    owner=request.user,
                    custom_id=requested_id or _generate_patient_id(request.user),
                    name=data.get('name') or 'Anonymous Patient',
                    age=age,
                    gender=data.get('gender', 'Other'),
                    address=data.get('address', ''),
                    phone=data.get('phone', ''),
                    emergency_contact=data.get('emergencyContact', data.get('emergency_contact', '')),
                    notes=data.get('notes', ''),
                    allergies=data.get('allergies', 'None'),
                )
                WoundProfile.objects.create(
                    patient=patient,
                    # label by site only; the type is set by the first scan
                    label=data.get('label') or data.get('woundLabel') or anatomical_location,
                    wound_type=wound_type,
                    anatomical_location=anatomical_location,
                    status='AWAITING SCAN',
                    status_type='warning',
                    last_updated='Just now',
                    current_severity=None,
                    current_severity_label='Awaiting Scan',
                    healing_status='Not Assessed',
                    ai_recommendation='New patient profile registered. Capture or upload a wound image to run AI segmentation and classification.',
                )
        except IntegrityError:
            return Response({"id": ["That patient ID was just taken. Please try again."]}, status=status.HTTP_409_CONFLICT)

        return Response(self.get_serializer(patient).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-wound')
    def add_wound(self, request, custom_id=None):
        """Adds a new wound site to an existing patient profile."""
        patient = self.get_object()
        data = request.data
        anatomical_location = data.get('anatomical_location') or data.get('anatomicalLocation') or 'Lower Extremity'
        WoundProfile.objects.create(
            patient=patient,
            label=data.get('label') or data.get('woundLabel') or anatomical_location,
            wound_type=PENDING_TYPE,
            anatomical_location=anatomical_location,
            status='AWAITING SCAN',
            status_type='warning',
            last_updated='Just now',
            current_severity=None,
            current_severity_label='Awaiting Scan',
            healing_status='Not Assessed',
            ai_recommendation=f'New wound site registered at {anatomical_location}. Capture or upload a wound image to run AI segmentation and classification.',
        )
        patient = self.get_queryset().get(pk=patient.pk)
        return Response(self.get_serializer(patient).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post', 'delete'], url_path='clear-all')
    def clear_all(self, request):
        """Deletes this clinician's own patients (and their wounds and scans) only."""
        count, _ = Patient.objects.filter(owner=request.user).delete()
        return Response({"message": "Your patient records were cleared.", "count": count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='seed-demo')
    def seed_demo(self, request):
        """Seeds the demo patients into this clinician's own registry."""
        from django.core.management import call_command
        call_command('seed_data', owner=request.user.username)
        return Response(self.get_serializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# AI analysis
# ---------------------------------------------------------------------------
class DetectWoundBoxAPIView(APIView):
    """
    POST /api/scans/detect-box/
    Runs quick Stage 2 boundary detection to return the initial AI bounding box.
    The clinician can adjust or accept this box prior to full analysis.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        data = request.data
        image_file = request.FILES.get('image_file')
        image_base64 = data.get('image_base64') or data.get('image')
        if image_file is None and not image_base64:
            return Response({"detail": "A wound photo is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = detect_wound_box(image_file=image_file, image_base64=image_base64)
            return Response(res, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AnalyzeWoundAPIView(APIView):
    """
    POST /api/scans/analyze/
    Runs the AI pipeline on a wound photo. Nothing is saved; the client saves the
    accepted result through POST /api/scans/.
    Supports an optional crop_box (user-confirmed / adjusted boundary).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        data = request.data
        image_file = request.FILES.get('image_file')
        image_base64 = data.get('image_base64') or data.get('image')
        crop_box = data.get('crop_box') or data.get('cropBox')
        if image_file is None and not image_base64:
            return Response({"detail": "A wound photo is required."}, status=status.HTTP_400_BAD_REQUEST)

        patient_id = data.get('patient_id') or data.get('patientId')
        patient = wound_profile = None
        if patient_id not in (None, ""):
            patient = _owned_patient(request, patient_id)
            wound_profile = _patient_wound(
                patient, data.get('wound_id') or data.get('woundProfileId') or data.get('wound_profile_id')
            )

        try:
            result = run_ai_inference_pipeline(
                image_file=image_file,
                image_base64=image_base64,
                patient=patient,
                wound_profile=wound_profile,
                baseline_image=data.get('baseline_image_base64') or data.get('baselineImage') or data.get('baseline_image'),
                crop_box=crop_box,
            )
        except ValueError as e:
            # unusable photo (no wound found, unreadable image): tell the user, don't guess
            return Response({"detail": str(e)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # The type set by this wound's first scan stays; the per-photo prediction is
        # kept in pipeline_metrics.classification for reference only.
        if wound_type_is_set(wound_profile):
            result["wound_type"] = wound_profile.wound_type
            result["wound_type_locked"] = True
            result["warnings"] = [w for w in result.get("warnings", []) if not w.startswith("Low confidence wound type")]
        else:
            result["wound_type_locked"] = False
        return Response(result, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# scans
# ---------------------------------------------------------------------------
class WoundAssessmentScanViewSet(viewsets.ModelViewSet):
    serializer_class = WoundAssessmentScanSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        return WoundAssessmentScan.objects.filter(patient__owner=self.request.user)

    def create(self, request, *args, **kwargs):
        data = request.data
        patient = _owned_patient(request, data.get('patient_id') or data.get('patientId'))
        wound_profile = _patient_wound(patient, data.get('wound_id') or data.get('woundProfileId') or data.get('wound_profile_id'))
        if wound_profile is None:
            loc = data.get('anatomical_location', data.get('location', 'Lower Extremity'))
            wound_profile = WoundProfile.objects.create(patient=patient, label=loc, anatomical_location=loc, wound_type=PENDING_TYPE)

        try:
            severity_score = int(data.get('severity_score', data.get('severityScore')))
        except (TypeError, ValueError):
            return Response({"severity_score": ["A severity score from 1 to 5 is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= severity_score <= 5:
            return Response({"severity_score": ["Severity must be between 1 and 5."]}, status=status.HTTP_400_BAD_REQUEST)

        severity_level = data.get('severity_level', data.get('severityLevel', 'Moderate'))
        healing_status = data.get('healing_status', data.get('healingStatus', 'Stable'))
        if wound_type_is_set(wound_profile):
            wound_type = wound_profile.wound_type  # set by the first scan; never changes afterwards
        else:
            wound_type = data.get('wound_type', data.get('woundType')) or PENDING_TYPE
        location = data.get('anatomical_location', data.get('location')) or wound_profile.anatomical_location
        recommendation = data.get('recommendation', data.get('aiRecommendation', ''))
        tissue_stats = data.get('tissue_stats', data.get('tissueStats')) or {}
        if not isinstance(tissue_stats, dict):
            tissue_stats = {}

        def pct(key, default):
            try:
                return float(tissue_stats.get(key, default))
            except (TypeError, ValueError):
                return default

        def optional_float(key):
            value = data.get(key)
            try:
                return float(value) if value not in (None, "") else None
            except (TypeError, ValueError):
                return None

        area = optional_float('wound_area_ratio')
        area_cm2 = optional_float('wound_area_cm2')
        card_block_ratio = optional_float('card_block_ratio')

        image_bytes, ext = _decode_image(data.get('image_base64', data.get('image', '')))
        scan_date_formatted = data.get('scan_date_formatted') or data.get('scanDateFormatted') or "Today"
        parsed_date = parse_datetime(data.get('scan_date') or data.get('scanDate') or "") if (data.get('scan_date') or data.get('scanDate')) else None

        with transaction.atomic():
            wound_profile.scans.update(is_latest=False)
            scan = WoundAssessmentScan(
                patient=patient,
                wound_profile=wound_profile,
                severity_score=severity_score,
                severity_level=severity_level,
                healing_status=healing_status,
                wound_type=wound_type,
                anatomical_location=location,
                recommendation=recommendation,
                granulation_percent=pct('granulation', 0.0),
                slough_percent=pct('slough', 0.0),
                necrotic_percent=pct('necrotic', 0.0),
                wound_area_ratio=area,
                wound_area_cm2=area_cm2,
                card_block_ratio=card_block_ratio,
                is_latest=True,
                scan_date_formatted=scan_date_formatted,
            )
            if request.FILES.get('image_file'):
                scan.image = request.FILES['image_file']
            elif image_bytes:
                scan.image.save(f"scan_{uuid.uuid4().hex}.{ext}", ContentFile(image_bytes), save=False)
            scan.save()
            if parsed_date:
                WoundAssessmentScan.objects.filter(pk=scan.pk).update(scan_date=parsed_date)
                scan.refresh_from_db()

            wound_profile.wound_type = wound_type
            wound_profile.current_severity = severity_score
            wound_profile.current_severity_label = severity_level
            wound_profile.healing_status = healing_status
            wound_profile.ai_recommendation = recommendation
            wound_profile.last_updated = scan_date_formatted
            wound_profile.status, wound_profile.status_type = _wound_status(severity_score, healing_status)
            wound_profile.save()

        return Response(self.get_serializer(scan).data, status=status.HTTP_201_CREATED)


class TreatmentGuidelineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TreatmentGuideline.objects.all()
    serializer_class = TreatmentGuidelineSerializer
    permission_classes = [IsAuthenticated]
