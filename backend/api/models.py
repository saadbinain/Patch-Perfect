from django.conf import settings
from django.db import models

class Patient(models.Model):
    # Each patient belongs to the clinician who registered it; every API query is scoped by owner.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patients', null=True, blank=True
    )
    custom_id = models.CharField(max_length=20, help_text="Patient identification code (e.g. 089), unique per clinician")
    name = models.CharField(max_length=150)
    age = models.PositiveIntegerField(default=45)
    gender = models.CharField(max_length=20, default="Other")
    address = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    emergency_contact = models.CharField(max_length=150, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    # Empty = not asked / not recorded; a clinician types "None known" to record no allergies
    allergies = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['owner', 'custom_id'], name='unique_patient_id_per_owner'),
        ]

    def __str__(self):
        return f"{self.name} (#{self.custom_id})"

    @property
    def primary_wound(self):
        return self.wounds.first()


class WoundProfile(models.Model):
    # Values the classifier and the app actually produce
    WOUND_CHOICES = [
        ('Pending AI Scan', 'Pending AI Scan'),
        ('Diabetic Ulcer', 'Diabetic Ulcer'),
        ('Diabetic Wound', 'Diabetic Wound'),
        ('Surgical Wound', 'Surgical Wound'),
        ('Pressure Injury', 'Pressure Injury'),
        ('Venous Ulcer', 'Venous Ulcer'),
        ('Unclassified', 'Unclassified'),
    ]

    STATUS_CHOICES = [
        ('AWAITING SCAN', 'AWAITING SCAN'),
        ('ACTION NEEDED', 'ACTION NEEDED'),
        ('STABLE', 'STABLE'),
        ('IMPROVING', 'IMPROVING'),
        ('DETERIORATING', 'DETERIORATING'),
        ('BASELINE', 'BASELINE'),
        ('NOT COMPARED', 'NOT COMPARED'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='wounds')
    label = models.CharField(max_length=150, default='Primary Wound', help_text="Wound site label or custom name")
    wound_type = models.CharField(max_length=50, choices=WOUND_CHOICES, default='Diabetic Wound')
    anatomical_location = models.CharField(max_length=100, default='Lower Extremity')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='AWAITING SCAN')
    status_type = models.CharField(max_length=20, default='warning') # danger | success | warning | info
    last_updated = models.CharField(max_length=50, default='Just now')
    current_severity = models.PositiveSmallIntegerField(null=True, blank=True, default=None)
    current_severity_label = models.CharField(max_length=30, default='Awaiting Scan')
    healing_status = models.CharField(max_length=30, default='Not Assessed')
    ai_recommendation = models.TextField(blank=True, default='New patient profile registered. Capture or upload a wound image to run AI segmentation and severity scoring.')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"{self.patient.name} - {self.label} ({self.wound_type})"


class WoundAssessmentScan(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='scans')
    wound_profile = models.ForeignKey(WoundProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='scans')
    image = models.ImageField(upload_to='wound_images/', null=True, blank=True)
    image_base64 = models.TextField(blank=True, null=True, help_text="Cached base64 preview")
    severity_score = models.PositiveSmallIntegerField(default=5)  # 1-10
    severity_level = models.CharField(max_length=30, default='Moderate')
    healing_status = models.CharField(max_length=30, default='Stable')
    wound_type = models.CharField(max_length=50, default='Diabetic Ulcer')
    anatomical_location = models.CharField(max_length=100, default='Lower Extremity')
    recommendation = models.TextField(blank=True, default='')
    
    # DL Pipeline tissue breakdown from FPN+VGG16
    granulation_percent = models.FloatField(default=50.0)
    slough_percent = models.FloatField(default=35.0)
    necrotic_percent = models.FloatField(default=15.0)
    # New skin / scar (pale pink). Null on scans graded before this class existed.
    epithelial_percent = models.FloatField(null=True, blank=True)
    # Fraction of the photo covered by the FUSegNet wound mask; used for healing trend vs Day 1
    wound_area_ratio = models.FloatField(null=True, blank=True)
    # Real wound size, scaled with the colour card; used for the healing trend when available
    wound_area_cm2 = models.FloatField(null=True, blank=True)
    # Share of the photo covered by the card's reference block (how close the camera was)
    card_block_ratio = models.FloatField(null=True, blank=True)

    is_latest = models.BooleanField(default=True)
    scan_date = models.DateTimeField(auto_now_add=True)
    scan_date_formatted = models.CharField(max_length=50, default='Today')

    class Meta:
        ordering = ['-scan_date']

    def __str__(self):
        return f"Scan {self.id} for {self.patient.name} ({self.scan_date_formatted})"


class TreatmentGuideline(models.Model):
    guideline_id = models.CharField(max_length=50, unique=True, primary_key=True)
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=200)
    icon_type = models.CharField(max_length=30, default='foot')
    color = models.CharField(max_length=20, default='#8B1E1E')
    description = models.TextField()
    key_principles = models.JSONField(default=list)
    recommended_dressings = models.JSONField(default=list)
    red_flags = models.JSONField(default=list)

    def __str__(self):
        return self.title
