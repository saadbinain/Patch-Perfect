from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PatientViewSet, WoundAssessmentScanViewSet, TreatmentGuidelineViewSet, AnalyzeWoundAPIView

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'scans', WoundAssessmentScanViewSet, basename='scan')
router.register(r'guidelines', TreatmentGuidelineViewSet, basename='guideline')

urlpatterns = [
    path('scans/analyze/', AnalyzeWoundAPIView.as_view(), name='analyze-wound'),
    path('', include(router.urls)),
]
