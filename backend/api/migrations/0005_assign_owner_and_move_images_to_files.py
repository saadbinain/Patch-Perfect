import base64
import binascii
import uuid

from django.core.files.base import ContentFile
from django.db import migrations


def _decode_data_url(value):
    if not value:
        return None, None
    header, _, payload = value.partition(",") if value.startswith("data:") else ("", "", value)
    ext = "png" if "png" in header else "webp" if "webp" in header else "jpg"
    try:
        return base64.b64decode(payload), ext
    except (binascii.Error, ValueError):
        return None, None


def forwards(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Patient = apps.get_model("api", "Patient")
    Scan = apps.get_model("api", "WoundAssessmentScan")

    # Records created before per-clinician ownership go to the earliest account
    first_user = User.objects.order_by("date_joined", "id").first()
    if first_user:
        Patient.objects.filter(owner__isnull=True).update(owner=first_user)

    # Store photos as files (served from /media/) instead of base64 inside every API response
    for scan in Scan.objects.exclude(image_base64__isnull=True).exclude(image_base64=""):
        if scan.image:
            scan.image_base64 = ""
            scan.save(update_fields=["image_base64"])
            continue
        data, ext = _decode_data_url(scan.image_base64)
        if data:
            scan.image.save(f"scan_{scan.id}_{uuid.uuid4().hex[:8]}.{ext}", ContentFile(data), save=False)
            scan.image_base64 = ""
            scan.save(update_fields=["image", "image_base64"])


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0004_patient_owner_and_wound_area"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
