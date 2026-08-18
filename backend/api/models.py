from django.db import models

class Patient(models.Model):
    custom_id = models.CharField(max_length=20, unique=True, help_text="Patient identification code (e.g. 089)")
    name = models.CharField(max_length=150)
    age = models.PositiveIntegerField(default=45)
    gender = models.CharField(max_length=20, default="Other")
    address = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    emergency_contact = models.CharField(max_length=150, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    allergies = models.CharField(max_length=255, blank=True, default="None")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (#{self.custom_id})"


class WoundProfile(models.Model):
    WOUND_CHOICES = [
        ('Diabetic Wound', 'Diabetic Wound'),
        ('Surgical Wound', 'Surgical Wound'),
        ('Pressure Injury', 'Pressure Injury'),
        ('Venous Ulcer', 'Venous Ulcer'),
    ]

    STATUS_CHOICES = [
        ('ACTION NEEDED', 'ACTION NEEDED'),
        ('STABLE', 'STABLE'),
        ('IMPROVING', 'IMPROVING'),
        ('DETERIORATING', 'DETERIORATING'),
    ]

    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name='wound_profile')
    wound_type = models.CharField(max_length=50, choices=WOUND_CHOICES, default='Diabetic Wound')
    anatomical_location = models.CharField(max_length=100, default='Lower Extremity')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='ACTION NEEDED')
    status_type = models.CharField(max_length=20, default='danger') # danger | success | warning
    last_updated = models.CharField(max_length=50, default='Today')
    current_severity = models.PositiveSmallIntegerField(default=3)
    current_severity_label = models.CharField(max_length=30, default='Moderate')
    healing_status = models.CharField(max_length=30, default='Stable')
    ai_recommendation = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.patient.name} - {self.wound_type}"


class WoundAssessmentScan(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='scans')
    wound_profile = models.ForeignKey(WoundProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='scans')
    image = models.ImageField(upload_to='wound_images/', null=True, blank=True)
    image_base64 = models.TextField(blank=True, null=True, help_text="Cached base64 preview")
    severity_score = models.PositiveSmallIntegerField(default=3)
    severity_level = models.CharField(max_length=30, default='Moderate')
    healing_status = models.CharField(max_length=30, default='Stable')
    wound_type = models.CharField(max_length=50, default='Diabetic Ulcer')
    anatomical_location = models.CharField(max_length=100, default='Lower Extremity')
    recommendation = models.TextField(blank=True, default='')
    
    # DL Pipeline tissue breakdown from FPN+VGG16
    granulation_percent = models.FloatField(default=50.0)
    slough_percent = models.FloatField(default=35.0)
    necrotic_percent = models.FloatField(default=15.0)

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
