from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet,
    WoundAssessmentScanViewSet,
    TreatmentGuidelineViewSet,
    AnalyzeWoundAPIView,
    RegisterAPIView,
    LoginAPIView,
    CurrentUserAPIView,
    LogoutAPIView,
)

router = DefaultRouter()
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'scans', WoundAssessmentScanViewSet, basename='scan')
router.register(r'guidelines', TreatmentGuidelineViewSet, basename='guideline')

urlpatterns = [
    # Authentication routes
    path('auth/register/', RegisterAPIView.as_view(), name='auth-register'),
    path('auth/login/', LoginAPIView.as_view(), name='auth-login'),
    path('auth/me/', CurrentUserAPIView.as_view(), name='auth-me'),
    path('auth/logout/', LogoutAPIView.as_view(), name='auth-logout'),

    # Clinical & AI endpoints
    path('scans/analyze/', AnalyzeWoundAPIView.as_view(), name='analyze-wound'),
    path('', include(router.urls)),
]
