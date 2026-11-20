from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from .models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_role(self, obj):
        # We can store role or title in last_name prefix or return clinician default
        if obj.is_superuser:
            return "Lead Administrator"
        if obj.is_staff:
            return "Lead Physician"
        return "Clinician"


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def create(self, validated_data):
        username = validated_data['username']
        email = validated_data.get('email', '')
        password = validated_data['password']
        full_name = validated_data.get('full_name', '').strip()

        first_name = full_name
        last_name = ""
        if " " in full_name:
            parts = full_name.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1]

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        username_or_email = data.get('username')
        password = data.get('password')

        user = authenticate(username=username_or_email, password=password)
        if not user:
            # Try matching by email if username doesn't directly authenticate
            try:
                user_obj = User.objects.get(email__iexact=username_or_email)
                user = authenticate(username=user_obj.username, password=password)
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                pass

        if not user:
            raise serializers.ValidationError("Invalid credentials. Please check your username/email and password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is currently disabled.")

        data['user'] = user
        return data

class WoundAssessmentScanSerializer(serializers.ModelSerializer):
    tissue_stats = serializers.SerializerMethodField()
    # Server-relative URL ("/media/wound_images/..."): works through the dev proxy and
    # is resolved against the API host by the native app. Photos are no longer inlined as base64.
    image = serializers.SerializerMethodField()

    def get_image(self, obj):
        return obj.image.url if obj.image else None

    class Meta:
        model = WoundAssessmentScan
        fields = [
            'id', 'patient', 'wound_profile', 'image', 'wound_area_ratio', 'wound_area_cm2', 'card_block_ratio',
            'severity_score', 'severity_level', 'healing_status',
            'wound_type', 'anatomical_location', 'recommendation',
            'granulation_percent', 'slough_percent', 'necrotic_percent', 'epithelial_percent',
            'tissue_stats', 'is_latest', 'scan_date', 'scan_date_formatted'
        ]
        read_only_fields = ['id', 'scan_date']

    def get_tissue_stats(self, obj):
        return {
            'granulation': obj.granulation_percent,
            'slough': obj.slough_percent,
            'necrotic': obj.necrotic_percent,
            'epithelial': obj.epithelial_percent,
        }


class WoundProfileSerializer(serializers.ModelSerializer):
    scans = WoundAssessmentScanSerializer(many=True, read_only=True)
    trend_data = serializers.SerializerMethodField()

    class Meta:
        model = WoundProfile
        fields = [
            'id', 'patient', 'label', 'wound_type', 'anatomical_location',
            'status', 'status_type', 'last_updated', 'current_severity',
            'current_severity_label', 'healing_status', 'ai_recommendation',
            'created_at', 'scans', 'trend_data'
        ]

    def get_trend_data(self, obj):
        scans = obj.scans.all().order_by('scan_date')
        if not scans.exists():
            return []
        
        trend = []
        for idx, scan in enumerate(scans):
            trend.append({
                "week": f"Scan {idx + 1}",
                "score": scan.severity_score,
            })
        return trend


class PatientSerializer(serializers.ModelSerializer):
    wounds = WoundProfileSerializer(many=True, read_only=True)
    wound_profile = serializers.SerializerMethodField()
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
            'wounds', 'wound_profile', 'scans', 'trend_data',
            'woundType', 'anatomicalLocation', 'status', 'statusType',
            'lastUpdated', 'currentSeverity', 'currentSeverityLabel',
            'healingStatus', 'aiRecommendation'
        ]

    def get_primary_wound(self, obj):
        return obj.wounds.first()

    def get_wound_profile(self, obj):
        pw = self.get_primary_wound(obj)
        if pw:
            return WoundProfileSerializer(pw, context=self.context).data
        return None

    def get_woundType(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.wound_type if pw else 'Diabetic Wound'

    def get_anatomicalLocation(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.anatomical_location if pw else 'Lower Extremity'

    def get_status(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.status if pw else 'AWAITING SCAN'

    def get_statusType(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.status_type if pw else 'warning'

    def get_lastUpdated(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.last_updated if pw else 'Just now'

    def get_currentSeverity(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.current_severity if pw else None

    def get_currentSeverityLabel(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.current_severity_label if pw else 'Awaiting Scan'

    def get_healingStatus(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.healing_status if pw else 'Not Assessed'

    def get_aiRecommendation(self, obj):
        pw = self.get_primary_wound(obj)
        return pw.ai_recommendation if pw else 'New patient profile registered. Capture or upload a wound image to run AI segmentation and severity scoring.'

    def get_trend_data(self, obj):
        scans = obj.scans.all().order_by('scan_date')
        if not scans.exists():
            return []
        
        trend = []
        for idx, scan in enumerate(scans):
            trend.append({
                "week": f"Scan {idx + 1}",
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
