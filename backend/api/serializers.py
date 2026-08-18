from rest_framework import serializers
from .models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline

class WoundAssessmentScanSerializer(serializers.ModelSerializer):
    tissue_stats = serializers.SerializerMethodField()

    class Meta:
        model = WoundAssessmentScan
        fields = [
            'id', 'patient', 'wound_profile', 'image', 'image_base64',
            'severity_score', 'severity_level', 'healing_status',
            'wound_type', 'anatomical_location', 'recommendation',
            'granulation_percent', 'slough_percent', 'necrotic_percent',
            'tissue_stats', 'is_latest', 'scan_date', 'scan_date_formatted'
        ]
        read_only_fields = ['id', 'scan_date']

    def get_tissue_stats(self, obj):
        return {
            'granulation': obj.granulation_percent,
            'slough': obj.slough_percent,
            'necrotic': obj.necrotic_percent,
        }


class WoundProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WoundProfile
        fields = '__all__'


class PatientSerializer(serializers.ModelSerializer):
    wound_profile = WoundProfileSerializer(read_only=True)
    scans = WoundAssessmentScanSerializer(many=True, read_only=True)
    trend_data = serializers.SerializerMethodField()
    # Flattened convenience properties for frontend matching
    id = serializers.CharField(source='custom_id', read_only=True)
    woundType = serializers.SerializerMethodField()
    anatomicalLocation = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    statusType = serializers.SerializerMethodField()
    lastUpdated = serializers.SerializerMethodField()
    currentSeverity = serializers.SerializerMethodField()
    currentSeverityLabel = serializers.SerializerMethodField()
    healingStatus = serializers.SerializerMethodField()
    aiRecommendation = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'custom_id', 'name', 'age', 'gender', 'address', 'phone',
            'emergency_contact', 'notes', 'allergies', 'created_at', 'updated_at',
            'wound_profile', 'scans', 'trend_data',
            'woundType', 'anatomicalLocation', 'status', 'statusType',
            'lastUpdated', 'currentSeverity', 'currentSeverityLabel',
            'healingStatus', 'aiRecommendation'
        ]

    def get_woundType(self, obj):
        return obj.wound_profile.wound_type if hasattr(obj, 'wound_profile') else 'Diabetic Wound'

    def get_anatomicalLocation(self, obj):
        return obj.wound_profile.anatomical_location if hasattr(obj, 'wound_profile') else 'Lower Extremity'

    def get_status(self, obj):
        return obj.wound_profile.status if hasattr(obj, 'wound_profile') else 'ACTION NEEDED'

    def get_statusType(self, obj):
        return obj.wound_profile.status_type if hasattr(obj, 'wound_profile') else 'danger'

    def get_lastUpdated(self, obj):
        return obj.wound_profile.last_updated if hasattr(obj, 'wound_profile') else 'Today'

    def get_currentSeverity(self, obj):
        return obj.wound_profile.current_severity if hasattr(obj, 'wound_profile') else 3

    def get_currentSeverityLabel(self, obj):
        return obj.wound_profile.current_severity_label if hasattr(obj, 'wound_profile') else 'Moderate'

    def get_healingStatus(self, obj):
        return obj.wound_profile.healing_status if hasattr(obj, 'wound_profile') else 'Stable'

    def get_aiRecommendation(self, obj):
        return obj.wound_profile.ai_recommendation if hasattr(obj, 'wound_profile') else ''

    def get_trend_data(self, obj):
        scans = obj.scans.all().order_by('scan_date')
        if not scans.exists():
            return [{"week": "Week 1", "score": self.get_currentSeverity(obj)}]
        
        trend = []
        for idx, scan in enumerate(scans):
            trend.append({
                "week": f"Week {idx + 1}",
                "score": scan.severity_score,
            })
        return trend


class TreatmentGuidelineSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='guideline_id', read_only=True)
    iconType = serializers.CharField(source='icon_type', read_only=True)
    keyPrinciples = serializers.JSONField(source='key_principles', read_only=True)
    recommendedDressings = serializers.JSONField(source='recommended_dressings', read_only=True)
    redFlags = serializers.JSONField(source='red_flags', read_only=True)

    class Meta:
        model = TreatmentGuideline
        fields = [
            'id', 'guideline_id', 'title', 'subtitle', 'icon_type', 'iconType',
            'color', 'description', 'key_principles', 'keyPrinciples',
            'recommended_dressings', 'recommendedDressings',
            'red_flags', 'redFlags'
        ]
