from django.db import migrations

PENDING = "Pending AI Scan"
UNSET = {"", PENDING, "Unclassified", None}


def forwards(apps, schema_editor):
    """
    A wound's type is now identified by the AI on its first scan and then kept.
    Fix existing records to follow that rule:
    - wounds with scans: type of the earliest classified scan, applied to all its scans
    - wounds never scanned: back to "Pending AI Scan" (the type was picked by hand at registration)
    """
    WoundProfile = apps.get_model("api", "WoundProfile")
    Scan = apps.get_model("api", "WoundAssessmentScan")

    for wound in WoundProfile.objects.all():
        scans = Scan.objects.filter(wound_profile=wound).order_by("scan_date", "id")
        first_type = next((s.wound_type for s in scans if s.wound_type not in UNSET), None)
        if first_type:
            scans.exclude(wound_type=first_type).update(wound_type=first_type)
            if wound.wound_type != first_type:
                wound.wound_type = first_type
                wound.save(update_fields=["wound_type"])
        elif not scans.exists() and wound.wound_type != PENDING:
            wound.wound_type = PENDING
            wound.save(update_fields=["wound_type"])


class Migration(migrations.Migration):
    dependencies = [("api", "0005_assign_owner_and_move_images_to_files")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
