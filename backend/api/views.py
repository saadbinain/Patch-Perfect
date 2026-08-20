import random
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404

from .models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline
from .serializers import (
    PatientSerializer,
    WoundAssessmentScanSerializer,
    TreatmentGuidelineSerializer
)
from .ai_pipeline import run_ai_inference_pipeline


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().prefetch_related('scans').select_related('wound_profile').order_by('-created_at')
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

        wound_type = data.get('woundType', 'Diabetic Wound')
        anatomical_location = data.get('anatomicalLocation', 'Lower Extremity')

        WoundProfile.objects.create(
            patient=patient,
            wound_type=wound_type,
            anatomical_location=anatomical_location,
            status='AWAITING SCAN',
            status_type='warning',
            last_updated='Just now',
            current_severity=None,
            current_severity_label='Awaiting Scan',
            healing_status='Not Assessed',
            ai_recommendation='New patient profile registered. Capture or upload a wound image to run AI segmentation and severity scoring.',
        )

        serializer = self.get_serializer(patient)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AnalyzeWoundAPIView(APIView):
    """
    POST /api/scans/analyze/
    Accepts wound photograph and runs 4-stage AI pipeline.
    """
    def post(self, request, *args, **kwargs):
        patient_id = request.data.get('patient_id') or request.data.get('patientId')
        image_base64 = request.data.get('image_base64') or request.data.get('image')
        image_file = request.FILES.get('image_file')

        patient = None
        if patient_id:
            try:
                patient = Patient.objects.get(custom_id=patient_id)
            except Patient.DoesNotExist:
                pass

        result = run_ai_inference_pipeline(
            image_file=image_file,
            image_base64=image_base64,
            patient=patient
        )

        return Response(result, status=status.HTTP_200_OK)


class WoundAssessmentScanViewSet(viewsets.ModelViewSet):
    queryset = WoundAssessmentScan.objects.all()
    serializer_class = WoundAssessmentScanSerializer

    def create(self, request, *args, **kwargs):
        data = request.data
        patient_id = data.get('patient_id') or data.get('patientId')
        
        patient = get_object_or_404(Patient, custom_id=patient_id)
        wound_profile = getattr(patient, 'wound_profile', None)

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

        # Mark previous scans as is_latest = False
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
            scan_date_formatted="Today"
        )

        # Update patient wound profile
        if wound_profile:
            wound_profile.current_severity = severity_score
            wound_profile.current_severity_label = severity_level
            wound_profile.healing_status = healing_status
            wound_profile.ai_recommendation = recommendation
            wound_profile.last_updated = "Today"
            wound_profile.status = "ACTION NEEDED" if severity_score >= 4 else "IMPROVING" if healing_status == "Improving" else "STABLE"
            wound_profile.status_type = "danger" if severity_score >= 4 else "success"
            wound_profile.save()

        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TreatmentGuidelineViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TreatmentGuideline.objects.all()
    serializer_class = TreatmentGuidelineSerializer
