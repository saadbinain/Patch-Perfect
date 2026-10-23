import random
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User

from .models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline
from .serializers import (
    PatientSerializer,
    WoundAssessmentScanSerializer,
    TreatmentGuidelineSerializer,
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
)
from .ai_pipeline import run_ai_inference_pipeline


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response(
                {
                    "token": token.key,
                    "user": UserSerializer(user).data,
                    "message": "Registration successful.",
                },
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
                {
                    "token": token.key,
                    "user": UserSerializer(user).data,
                    "message": "Login successful.",
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({"user": serializer.data}, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().prefetch_related('scans', 'wounds').order_by('-created_at')
    serializer_class = PatientSerializer
    lookup_field = 'custom_id'

    def create(self, request, *args, **kwargs):
        data = request.data
        custom_id = data.get('id') or str(random.randint(100, 999))
        
        patient = Patient.objects.create(
            custom_id=custom_id,
            name=data.get('name', 'Anonymous Patient'),
            age=int(data.get('age', 45)),
            gender=data.get('gender', 'Other'),
            address=data.get('address', ''),
            phone=data.get('phone', ''),
            emergency_contact=data.get('emergencyContact', data.get('emergency_contact', '')),
            notes=data.get('notes', ''),
            allergies=data.get('allergies', 'None'),
        )

        wound_type = data.get('woundType') or 'Pending AI Scan'
        anatomical_location = data.get('anatomicalLocation', 'Lower Extremity')
        label = data.get('label') or data.get('woundLabel') or f"{anatomical_location} {wound_type}".strip() or 'Primary Wound'

        WoundProfile.objects.create(
            patient=patient,
            label=label,
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

        serializer = self.get_serializer(patient)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='add-wound')
    def add_wound(self, request, custom_id=None):
        """Adds a new wound site to an existing patient profile."""
        patient = self.get_object()
        data = request.data
        
        anatomical_location = data.get('anatomical_location') or data.get('anatomicalLocation') or 'Lower Extremity'
        wound_type = data.get('wound_type') or data.get('woundType') or 'Pending AI Scan'
        label = data.get('label') or data.get('woundLabel') or f"{anatomical_location} Site"
        
        WoundProfile.objects.create(
            patient=patient,
            label=label,
            wound_type=wound_type,
            anatomical_location=anatomical_location,
            status='AWAITING SCAN',
            status_type='warning',
            last_updated='Just now',
            current_severity=None,
            current_severity_label='Awaiting Scan',
            healing_status='Not Assessed',
            ai_recommendation=f'New wound site registered at {anatomical_location}. Capture or upload a wound image to run AI segmentation and classification.',
        )
        
        patient.refresh_from_db()
        serializer = self.get_serializer(patient)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post', 'delete'], url_path='clear-all')
    def clear_all(self, request):
        """Clears all patient records, wound profiles, and scans from the database."""
        WoundAssessmentScan.objects.all().delete()
        WoundProfile.objects.all().delete()
        Patient.objects.all().delete()
        return Response(
            {"message": "All patient records and scans cleared successfully.", "count": 0},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='seed-demo')
    def seed_demo(self, request):
        """Seeds the manuscript demo patients and scans into the database."""
        from django.core.management import call_command
        try:
            call_command('seed_data')
        except Exception as e:
            pass
        patients = Patient.objects.all().prefetch_related('scans', 'wounds').order_by('-created_at')
        serializer = self.get_serializer(patients, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AnalyzeWoundAPIView(APIView):
    """
    POST /api/scans/analyze/
    Accepts wound photograph and runs 4-stage AI pipeline.
    """
    def post(self, request, *args, **kwargs):
        patient_id = request.data.get('patient_id') or request.data.get('patientId')
        wound_id = request.data.get('wound_id') or request.data.get('woundProfileId') or request.data.get('wound_profile_id')
        image_base64 = request.data.get('image_base64') or request.data.get('image')
        baseline_image_base64 = request.data.get('baseline_image_base64') or request.data.get('baselineImage') or request.data.get('baseline_image')
        image_file = request.FILES.get('image_file')

        patient = None
        if patient_id is not None:
            try:
                patient_str = str(patient_id).strip()
                if patient_str.isdigit():
                    patient = Patient.objects.filter(models.Q(id=int(patient_str)) | models.Q(custom_id=patient_str)).first()
                else:
                    patient = Patient.objects.filter(custom_id=patient_str).first()
            except Exception:
                patient = None

        wound_profile = None
        if patient and wound_id:
            try:
                wound_profile = patient.wounds.filter(id=wound_id).first()
            except Exception:
                wound_profile = None
        if patient and not wound_profile:
            wound_profile = patient.wounds.first()

        result = run_ai_inference_pipeline(
            image_file=image_file,
            image_base64=image_base64,
            patient=patient,
            wound_profile=wound_profile,
            baseline_image=baseline_image_base64
        )

        return Response(result, status=status.HTTP_200_OK)


class WoundAssessmentScanViewSet(viewsets.ModelViewSet):
    queryset = WoundAssessmentScan.objects.all()
    serializer_class = WoundAssessmentScanSerializer

    def create(self, request, *args, **kwargs):
        data = request.data
        patient_id = data.get('patient_id') or data.get('patientId')
        wound_id = data.get('wound_id') or data.get('woundProfileId') or data.get('wound_profile_id')
        
        patient = get_object_or_404(Patient, custom_id=patient_id)
        
        # Determine specific wound profile
        wound_profile = None
        if wound_id:
            try:
                wound_profile = patient.wounds.filter(id=wound_id).first()
            except Exception:
                wound_profile = None
        
        if not wound_profile:
            wound_profile = patient.wounds.first()

        # If patient has no wound profile yet, create one
        if not wound_profile:
            wound_type_init = data.get('wound_type', data.get('woundType', 'Diabetic Wound'))
            loc_init = data.get('anatomical_location', data.get('location', 'Lower Extremity'))
            wound_profile = WoundProfile.objects.create(
                patient=patient,
                label=f"{loc_init} Wound",
                wound_type=wound_type_init,
                anatomical_location=loc_init,
                status='AWAITING SCAN',
            )

        severity_score = int(data.get('severity_score', data.get('severityScore', 3)))
        severity_level = data.get('severity_level', data.get('severityLevel', 'Moderate'))
        healing_status = data.get('healing_status', data.get('healingStatus', 'Stable'))
        wound_type = data.get('wound_type', data.get('woundType', wound_profile.wound_type if wound_profile else 'Diabetic Ulcer'))
        location = data.get('anatomical_location', data.get('location', wound_profile.anatomical_location if wound_profile else 'Lower Extremity'))
        recommendation = data.get('recommendation', data.get('aiRecommendation', 'Daily monitoring advised.'))
        image_base64 = data.get('image_base64', data.get('image', ''))
        image_file = request.FILES.get('image_file')

        tissue_stats = data.get('tissue_stats', data.get('tissueStats', {}))
        granulation = float(tissue_stats.get('granulation', 50.0))
        slough = float(tissue_stats.get('slough', 35.0))
        necrotic = float(tissue_stats.get('necrotic', 15.0))

        scan_date_formatted = data.get('scan_date_formatted') or data.get('scanDateFormatted') or "Today"
        custom_date_str = data.get('scan_date') or data.get('scanDate')

        # Mark previous scans of this wound profile as is_latest = False
        if wound_profile:
            wound_profile.scans.update(is_latest=False)
        else:
            patient.scans.update(is_latest=False)

        # Create new scan
        scan = WoundAssessmentScan.objects.create(
            patient=patient,
            wound_profile=wound_profile,
            image=image_file,
            image_base64=image_base64,
            severity_score=severity_score,
            severity_level=severity_level,
            healing_status=healing_status,
            wound_type=wound_type,
            anatomical_location=location,
            recommendation=recommendation,
            granulation_percent=granulation,
            slough_percent=slough,
            necrotic_percent=necrotic,
            is_latest=True,
            scan_date_formatted=scan_date_formatted
        )

        if custom_date_str:
            try:
                from django.utils.dateparse import parse_datetime
                parsed_dt = parse_datetime(custom_date_str)
                if parsed_dt:
                    scan.scan_date = parsed_dt
                    scan.save(update_fields=['scan_date'])
            except Exception as e:
                pass

        # Update specific wound profile
        if wound_profile:
            wound_profile.wound_type = wound_type
            wound_profile.current_severity = severity_score
            wound_profile.current_severity_label = severity_level
            wound_profile.healing_status = healing_status
            wound_profile.ai_recommendation = recommendation
            wound_profile.last_updated = scan_date_formatted
            wound_profile.status = "ACTION NEEDED" if severity_score >= 4 else "IMPROVING" if healing_status == "Improving" else "STABLE"
            wound_profile.status_type = "danger" if severity_score >= 4 else "success"
            wound_profile.save()

        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TreatmentGuidelineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TreatmentGuideline.objects.all()
    serializer_class = TreatmentGuidelineSerializer
