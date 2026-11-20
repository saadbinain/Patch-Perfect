from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from api.models import Patient, WoundProfile, WoundAssessmentScan, TreatmentGuideline

class Command(BaseCommand):
    help = 'Seeds initial manuscript patient profiles and treatment guidelines into the database'

    def add_arguments(self, parser):
        parser.add_argument('--owner', help='Username whose registry receives the demo patients (required for patients).')

    def handle(self, *args, **kwargs):
        owner = None
        if kwargs.get('owner'):
            try:
                owner = get_user_model().objects.get(username=kwargs['owner'])
            except get_user_model().DoesNotExist:
                raise CommandError(f"No user named {kwargs['owner']}")
        self.stdout.write("Seeding Treatment Guidelines...")
        guidelines_data = [
            {
                "guideline_id": "diabetic-wound",
                "title": "Diabetic Wound",
                "subtitle": "Offloading, debridement, and infection control",
                "icon_type": "foot",
                "color": "#E57373",
                "description": "Comprehensive management protocol for diabetic foot ulcers (DFUs) focused on neuropathic and vascular considerations.",
                "key_principles": [
                    "Pressure Offloading: Utilize total contact casts, removable cast walkers, or customized therapeutic footwear.",
                    "Sharp Debridement: Remove non-viable hyperkeratotic tissue and slough weekly to promote healthy wound margins.",
                    "Moisture Balance: Apply hydrocolloids or alginates based on exudate level to prevent periwound maceration.",
                    "Infection Surveillance: Monitor for warmth, erythema, purulence, and deep probe-to-bone signs.",
                    "Glycemic Optimization: Target HbA1c < 7.0% in coordination with primary care physician.",
                ],
                "recommended_dressings": [
                    "Hydrogel for dry necrotic eschar",
                    "Calcium Alginate / Hydrofiber for moderate to heavy drainage",
                    "Silver-impregnated barrier for critically colonized wounds",
                ],
                "red_flags": [
                    "Exposed bone or tendon (Risk of osteomyelitis)",
                    "Rapidly expanding erythema (>2cm margin)",
                    "Systemic fever, chills, or sudden hyperglycemia",
                ],
            },
            {
                "guideline_id": "surgical-wound",
                "title": "Surgical Wound",
                "subtitle": "Clean technique, drainage, and suture care",
                "icon_type": "scalpel",
                "color": "#7E57C2",
                "description": "Post-operative acute wound protocol to ensure primary intention closure and prevent surgical site infections (SSI).",
                "key_principles": [
                    "Aseptic Cleansing: Irrigate gently with sterile 0.9% normal saline. Avoid cytotoxic solutions like undiluted povidone-iodine.",
                    "Tension-Free Dressing: Protect incision line with non-adherent sterile gauze or vapor-permeable film.",
                    "Drain Management: Record 24-hour drain volume and color; strip tubing as ordered to prevent clotting.",
                    "Incision Line Assessment: Inspect for dehiscence, hematoma formation, or seroma collection.",
                    "Suture / Staple Removal: Typically between postoperative days 7-14 based on anatomical site tension.",
                ],
                "recommended_dressings": [
                    "Non-adherent contact layer (e.g., petrolatum-impregnated gauze)",
                    "Sterile border foam dressing",
                    "Skin closure strips (Steri-Strips) post suture removal",
                ],
                "red_flags": [
                    "Wound edges separation (Dehiscence)",
                    "Copious purulent discharge or foul odor",
                    "Disproportionate incision pain",
                ],
            },
            {
                "guideline_id": "pressure-injury",
                "title": "Pressure Injury",
                "subtitle": "Repositioning, support surfaces, and nutrition",
                "icon_type": "bed",
                "color": "#3F51B5",
                "description": "Standardized pressure injury staging (Stage 1-4, Unstageable, DTI) and rehabilitation regimen.",
                "key_principles": [
                    "Frequent Repositioning: Turn bedbound individuals every 2 hours; chair-bound patients every 15-30 minutes.",
                    "Support Surfaces: Use dynamic alternating air mattresses or high-density foam overlays.",
                    "Shear & Friction Reduction: Use transfer sheets and maintain head-of-bed elevation ≤30 degrees.",
                    "Periwound Moisture Barrier: Protect sacral and gluteal skin with zinc oxide or dimethicone barrier creams.",
                    "Nutritional Support: High protein intake (1.25–1.5 g/kg/day) and vitamin C/Zinc supplementation.",
                ],
                "recommended_dressings": [
                    "Transparent film for Stage 1 non-blanchable erythema",
                    "Hydrocolloid or thin foam for Stage 2 shallow ulcers",
                    "Negative Pressure Wound Therapy (NPWT) for deep Stage 3/4 cavity wounds",
                ],
                "red_flags": [
                    "Foul odor or dark discoloration suggestive of wet gangrene",
                    "Undermining or tunneling exceeding 2 cm",
                    "Fluctuant subcutaneous mass over bony prominence",
                ],
            },
            {
                "guideline_id": "venous-ulcer",
                "title": "Venous Ulcer",
                "subtitle": "Compression therapy, elevation, and wound dressings",
                "icon_type": "drop",
                "color": "#E91E63",
                "description": "Lower extremity venous stasis ulcer guidelines designed to overcome venous hypertension and chronic exudate.",
                "key_principles": [
                    "Therapeutic Compression: Apply multi-layer elastic compression bandage or Unna's boot (ensure ABPI > 0.8 before high compression).",
                    "Limb Elevation: Elevate lower limbs above heart level for 30 minutes 3-4 times daily and during sleep.",
                    "Periwound Protection: Apply barrier ointment to combat heavy exudate and prevent venous eczema/maceration.",
                    "Exudate Management: Utilize highly absorbent foams or superabsorbent polymer dressings.",
                    "Calf Muscle Exercise: Encourage ankle pumps and progressive walking to activate the calf muscle pump.",
                ],
                "recommended_dressings": [
                    "Polyurethane foam dressing for moderate exudate",
                    "Zinc oxide paste bandage (Unna boot)",
                    "Cadexomer iodine paste for sloughy exudative beds",
                ],
                "red_flags": [
                    "Severe rest pain exacerbated by leg elevation (Possible arterial component)",
                    "Sudden calf swelling or asymmetrical tenderness (Deep Vein Thrombosis)",
                    "Cellulitis spreading rapidly across lower leg",
                ],
            },
        ]

        for g in guidelines_data:
            TreatmentGuideline.objects.update_or_create(
                guideline_id=g["guideline_id"],
                defaults=g
            )

        self.stdout.write("Seeding Patients & Scans...")
        patients_data = [
            {
                "custom_id": "089",
                "name": "Alken Valledor",
                "age": 58,
                "gender": "Male",
                "address": "Brgy. San Jose, Zamboanga City",
                "phone": "(062) 991-2345",
                "emergency_contact": "Rose Valledor - (0917) 555-0192",
                "allergies": "Penicillin, Latex",
                "notes": "Patient has Type 2 Diabetes with neuropathy. Peripheral pulse is palpable.",
                "wound_type": "Diabetic Wound",
                "anatomical_location": "Left Foot (Plantar)",
                "status": "ACTION NEEDED",
                "status_type": "danger",
                "last_updated": "Today",
                "current_severity": 4,
                "current_severity_label": "Very Severe",
                "healing_status": "Deteriorating",
                "ai_recommendation": "Urgent offloading required. Assess for deep tissue involvement and schedule debridement within 24 hours.",
                "scans": [
                    {
                        "severity_score": 3,
                        "severity_level": "Moderate",
                        "healing_status": "Improving",
                        "wound_type": "Diabetic Ulcer",
                        "location": "Left Foot",
                        "recommendation": "Adequate granulation tissue observed. Continue gentle cleansing.",
                        "granulation": 60, "slough": 30, "necrotic": 10,
                        "date_formatted": "April 26, 2026",
                        "is_latest": False,
                    },
                    {
                        "severity_score": 3,
                        "severity_level": "Moderate",
                        "healing_status": "Stable",
                        "wound_type": "Diabetic Ulcer",
                        "location": "Left Foot",
                        "recommendation": "Maintain hydrogel dressing. Schedule weekly blood glucose review.",
                        "granulation": 45, "slough": 40, "necrotic": 15,
                        "date_formatted": "May 10, 2026",
                        "is_latest": False,
                    },
                    {
                        "severity_score": 4,
                        "severity_level": "Very Severe",
                        "healing_status": "Deteriorating",
                        "wound_type": "Diabetic Ulcer",
                        "location": "Left Foot",
                        "recommendation": "Immediate pressure offloading advised. Clean wound periphery with sterile saline. Review antibiotic therapy.",
                        "granulation": 25, "slough": 55, "necrotic": 20,
                        "date_formatted": "Today, 09:30 AM",
                        "is_latest": True,
                    },
                ]
            },
            {
                "custom_id": "112",
                "name": "Maria Santos",
                "age": 64,
                "gender": "Female",
                "address": "Brgy. Santa Maria, Zamboanga City",
                "phone": "(062) 992-8871",
                "emergency_contact": "Pedro Santos - (0918) 555-0811",
                "allergies": "None known",
                "notes": "Post-laparotomy midline incision wound. Sutures removed 5 days ago.",
                "wound_type": "Surgical Wound",
                "anatomical_location": "Abdominal Midline",
                "status": "STABLE",
                "status_type": "success",
                "last_updated": "3 Days Ago",
                "current_severity": 2,
                "current_severity_label": "Mild",
                "healing_status": "Stable",
                "ai_recommendation": "Incision edges well-approximated. Continue non-adherent sterile dressing changes every 48 hours.",
                "scans": [
                    {
                        "severity_score": 4,
                        "severity_level": "Severe",
                        "healing_status": "Improving",
                        "wound_type": "Surgical Wound",
                        "location": "Abdominal Midline",
                        "recommendation": "Post-op site monitoring for erythema or discharge.",
                        "granulation": 50, "slough": 40, "necrotic": 10,
                        "date_formatted": "May 02, 2026",
                        "is_latest": False,
                    },
                    {
                        "severity_score": 2,
                        "severity_level": "Mild",
                        "healing_status": "Stable",
                        "wound_type": "Surgical Wound",
                        "location": "Abdominal Midline",
                        "recommendation": "Minimal serous exudate. Maintain dry clean dressing.",
                        "granulation": 85, "slough": 15, "necrotic": 0,
                        "date_formatted": "3 Days Ago",
                        "is_latest": True,
                    },
                ]
            },
            {
                "custom_id": "054",
                "name": "Juan Dela Cruz",
                "age": 72,
                "gender": "Male",
                "address": "Brgy. Tetuan, Zamboanga City",
                "phone": "(062) 993-4412",
                "emergency_contact": "Clara Dela Cruz - (0920) 555-9921",
                "allergies": "Sulfa drugs",
                "notes": "Bedbound patient due to cerebrovascular accident. High risk for pressure ulcers.",
                "wound_type": "Pressure Injury",
                "anatomical_location": "Sacrum / Coccyx",
                "status": "IMPROVING",
                "status_type": "success",
                "last_updated": "1 Week Ago",
                "current_severity": 2,
                "current_severity_label": "Moderate",
                "healing_status": "Improving",
                "ai_recommendation": "Reposition every 2 hours. Use alternating pressure mattress. Apply barrier cream around wound margins.",
                "scans": [
                    {
                        "severity_score": 3,
                        "severity_level": "Moderate",
                        "healing_status": "Improving",
                        "wound_type": "Pressure Ulcer",
                        "location": "Sacrum",
                        "recommendation": "Continue foam dressing changes and high protein diet.",
                        "granulation": 55, "slough": 40, "necrotic": 5,
                        "date_formatted": "May 04, 2026",
                        "is_latest": False,
                    },
                    {
                        "severity_score": 2,
                        "severity_level": "Moderate",
                        "healing_status": "Improving",
                        "wound_type": "Pressure Ulcer",
                        "location": "Sacrum",
                        "recommendation": "Wound depth decreasing. Healthy granulation tissue advancing from edges.",
                        "granulation": 75, "slough": 25, "necrotic": 0,
                        "date_formatted": "1 Week Ago",
                        "is_latest": True,
                    },
                ]
            },
            {
                "custom_id": "022",
                "name": "Elena Ramos",
                "age": 61,
                "gender": "Female",
                "address": "Brgy. Tumaga, Zamboanga City",
                "phone": "(062) 991-7788",
                "emergency_contact": "Mark Ramos - (0919) 555-4321",
                "allergies": "Adhesive tape",
                "notes": "Chronic venous insufficiency with bilateral leg edema.",
                "wound_type": "Venous Ulcer",
                "anatomical_location": "Medial Malleolus (Right Ankle)",
                "status": "STABLE",
                "status_type": "success",
                "last_updated": "2 Days Ago",
                "current_severity": 3,
                "current_severity_label": "Moderate",
                "healing_status": "Stable",
                "ai_recommendation": "Elevate lower extremities when seated. Compression therapy compliant. Apply moisture retentive dressing.",
                "scans": [
                    {
                        "severity_score": 4,
                        "severity_level": "Moderate",
                        "healing_status": "Improving",
                        "wound_type": "Venous Ulcer",
                        "location": "Right Ankle",
                        "recommendation": "Significant exudate noted. Use high absorbency foam dressing.",
                        "granulation": 40, "slough": 60, "necrotic": 0,
                        "date_formatted": "May 10, 2026",
                        "is_latest": False,
                    },
                    {
                        "severity_score": 3,
                        "severity_level": "Moderate",
                        "healing_status": "Stable",
                        "wound_type": "Venous Ulcer",
                        "location": "Right Ankle",
                        "recommendation": "Exudate volume controlled. Continue multi-layer compression bandage.",
                        "granulation": 65, "slough": 35, "necrotic": 0,
                        "date_formatted": "2 Days Ago",
                        "is_latest": True,
                    },
                ]
            },
        ]

        for p_data in patients_data:
            scans_data = p_data.pop("scans")
            wound_type = p_data.pop("wound_type")
            anatomical_location = p_data.pop("anatomical_location")
            status_val = p_data.pop("status")
            status_type = p_data.pop("status_type")
            last_updated = p_data.pop("last_updated")
            current_severity = p_data.pop("current_severity")
            current_severity_label = p_data.pop("current_severity_label")
            healing_status = p_data.pop("healing_status")
            ai_recommendation = p_data.pop("ai_recommendation")

            if owner is None:
                self.stdout.write(self.style.WARNING("Skipping demo patients: pass --owner <username> to seed them."))
                break

            patient, _ = Patient.objects.update_or_create(
                owner=owner,
                custom_id=p_data["custom_id"],
                defaults=p_data
            )

            # Clear old wounds and scans
            patient.wounds.all().delete()
            patient.scans.all().delete()

            wp = WoundProfile.objects.create(
                patient=patient,
                label=anatomical_location,
                wound_type=wound_type,
                anatomical_location=anatomical_location,
                status=status_val,
                status_type=status_type,
                last_updated=last_updated,
                current_severity=current_severity,
                current_severity_label=current_severity_label,
                healing_status=healing_status,
                ai_recommendation=ai_recommendation,
            )

            for s in scans_data:
                WoundAssessmentScan.objects.create(
                    patient=patient,
                    wound_profile=wp,
                    severity_score=s["severity_score"],
                    severity_level=s["severity_level"],
                    healing_status=s["healing_status"],
                    wound_type=s["wound_type"],
                    anatomical_location=s["location"],
                    recommendation=s["recommendation"],
                    granulation_percent=s["granulation"],
                    slough_percent=s["slough"],
                    necrotic_percent=s["necrotic"],
                    scan_date_formatted=s["date_formatted"],
                    is_latest=s["is_latest"],
                )

            # Add a secondary wound site for Alken Valledor (#089) for demonstration
            if patient.custom_id == "089":
                wp2 = WoundProfile.objects.create(
                    patient=patient,
                    label="Right Lateral Malleolus (Pressure)",
                    wound_type="Pressure Injury",
                    anatomical_location="Right Ankle",
                    status="STABLE",
                    status_type="success",
                    last_updated="Yesterday",
                    current_severity=2,
                    current_severity_label="Mild",
                    healing_status="Improving",
                    ai_recommendation="Epithelialization advancing from margins. Maintain silicone foam dressing.",
                )
                WoundAssessmentScan.objects.create(
                    patient=patient,
                    wound_profile=wp2,
                    severity_score=2,
                    severity_level="Mild",
                    healing_status="Improving",
                    wound_type="Pressure Injury",
                    anatomical_location="Right Ankle",
                    recommendation="Healthy granulation bed with reduction in periwound erythema.",
                    granulation_percent=75,
                    slough_percent=20,
                    necrotic_percent=5,
                    scan_date_formatted="Yesterday, 02:15 PM",
                    is_latest=True,
                )

        self.stdout.write(self.style.SUCCESS("Successfully seeded Patch Perfect database with multi-wound profiles!"))
