import base64
import io
import shutil
import tempfile
import unittest
from unittest import mock

import numpy as np
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from ai_models import pipeline_loader
from ai_models.severity_analyzer import analyze_tissue_and_severity, evaluate_healing_status
from .models import Patient, WoundAssessmentScan

TEMP_MEDIA = tempfile.mkdtemp(prefix="pp-test-media-")


def image_data_url(color=(180, 40, 40), size=(64, 64)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


FAKE_RESULT = {
    "severity_score": 3,
    "severity_level": "Moderate",
    "wound_type": "Venous Ulcer",
    "healing_status": "Baseline",
    "recommendation": "Clean with saline.",
    "warnings": [],
    "pipeline_metrics": {
        "similarity": {"is_baseline": True, "is_same_wound": True},
        "segmentation": {"wound_area_ratio": 0.05},
        "classification": {"confidence": 0.9},
        "tissue_stats": {"granulation": 60.0, "slough": 30.0, "necrotic": 10.0},
    },
}


@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class ApiTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.alice = User.objects.create_user("alice", password="pw-alice-123")
        self.bob = User.objects.create_user("bob", password="pw-bob-123")
        self.client = self.client_for(self.alice)

    def client_for(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user).key}")
        return client

    def create_patient(self, client=None, **extra):
        res = (client or self.client).post("/api/patients/", {"name": "Test Patient", "age": 60, "anatomicalLocation": "Left Heel", **extra}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()


class AuthAndScopingTests(ApiTestCase):
    def test_endpoints_require_login(self):
        anon = APIClient()
        self.assertEqual(anon.get("/api/patients/").status_code, 401)
        self.assertEqual(anon.post("/api/patients/clear-all/").status_code, 401)
        self.assertEqual(anon.post("/api/scans/analyze/", {}, format="json").status_code, 401)
        self.assertEqual(anon.get("/api/health/").status_code, 200)

    def test_anonymous_cannot_delete_patient(self):
        p = self.create_patient()
        self.assertEqual(APIClient().delete(f"/api/patients/{p['custom_id']}/").status_code, 401)
        self.assertTrue(Patient.objects.filter(custom_id=p["custom_id"]).exists())

    def test_clinicians_only_see_their_own_patients(self):
        mine = self.create_patient()
        bob = self.client_for(self.bob)
        self.assertEqual(bob.get("/api/patients/").json(), [])
        self.assertEqual(bob.get(f"/api/patients/{mine['custom_id']}/").status_code, 404)
        self.assertEqual(bob.delete(f"/api/patients/{mine['custom_id']}/").status_code, 404)

    def test_clear_all_only_clears_own_patients(self):
        self.create_patient()
        self.create_patient(client=self.client_for(self.bob))
        self.client.post("/api/patients/clear-all/")
        self.assertEqual(Patient.objects.filter(owner=self.alice).count(), 0)
        self.assertEqual(Patient.objects.filter(owner=self.bob).count(), 1)


class PatientTests(ApiTestCase):
    def test_label_does_not_include_pending_type(self):
        p = self.create_patient()
        self.assertEqual(p["wounds"][0]["label"], "Left Heel")

    def test_duplicate_patient_id_is_a_clean_400(self):
        self.create_patient(id="555")
        res = self.client.post("/api/patients/", {"id": "555", "name": "Dup"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_same_id_allowed_for_different_clinicians(self):
        self.create_patient(id="555")
        self.create_patient(client=self.client_for(self.bob), id="555")

    def test_generated_ids_are_unique(self):
        ids = {self.create_patient()["custom_id"] for _ in range(40)}
        self.assertEqual(len(ids), 40)


class AnalyzeTests(ApiTestCase):
    def test_photo_is_required(self):
        res = self.client.post("/api/scans/analyze/", {"patient_id": "x"}, format="json")
        self.assertEqual(res.status_code, 400)

    @mock.patch("api.views.run_ai_inference_pipeline", return_value=FAKE_RESULT)
    def test_numeric_patient_id_resolves_patient_and_wound(self, run):
        # regression: views used models.Q without importing it, so the lookup always failed
        p = self.create_patient()
        wound_id = p["wounds"][0]["id"]
        res = self.client.post("/api/scans/analyze/", {"patient_id": p["custom_id"], "wound_id": wound_id, "image_base64": image_data_url()}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        kwargs = run.call_args.kwargs
        self.assertEqual(kwargs["patient"].custom_id, p["custom_id"])
        self.assertEqual(kwargs["wound_profile"].id, wound_id)

    def test_cannot_analyze_other_clinicians_patient(self):
        p = self.create_patient(client=self.client_for(self.bob))
        res = self.client.post("/api/scans/analyze/", {"patient_id": p["custom_id"], "image_base64": image_data_url()}, format="json")
        self.assertEqual(res.status_code, 404)

    @mock.patch("api.views.run_ai_inference_pipeline", side_effect=ValueError("No wound was detected in this photo."))
    def test_unusable_photo_returns_422_with_reason(self, _run):
        p = self.create_patient()
        res = self.client.post("/api/scans/analyze/", {"patient_id": p["custom_id"], "image_base64": image_data_url()}, format="json")
        self.assertEqual(res.status_code, 422)
        self.assertIn("No wound", res.json()["detail"])


class ScanSaveTests(ApiTestCase):
    def save_scan(self, patient, **extra):
        body = {
            "patient_id": patient["custom_id"],
            "wound_id": patient["wounds"][0]["id"],
            "severity_score": 3,
            "severity_level": "Moderate",
            "healing_status": "Baseline",
            "wound_type": "Venous Ulcer",
            "recommendation": "Clean.",
            "image_base64": image_data_url(),
            "tissue_stats": {"granulation": 70, "slough": 20, "necrotic": 10},
            "wound_area_ratio": 0.04,
            **extra,
        }
        return self.client.post("/api/scans/", body, format="json")

    def test_photo_saved_as_file_and_list_has_no_base64(self):
        p = self.create_patient()
        res = self.save_scan(p)
        self.assertEqual(res.status_code, 201, res.content)
        scan = WoundAssessmentScan.objects.get()
        self.assertTrue(scan.image.name)
        self.assertFalse(scan.image_base64)
        self.assertAlmostEqual(scan.wound_area_ratio, 0.04)
        body = self.client.get("/api/patients/").content.decode()
        self.assertNotIn("base64,", body)
        self.assertIn("/media/", body)

    def test_cannot_save_to_another_patients_wound(self):
        p1, p2 = self.create_patient(), self.create_patient()
        res = self.save_scan(p1, wound_id=p2["wounds"][0]["id"])
        self.assertEqual(res.status_code, 400)

    def test_invalid_severity_rejected(self):
        p = self.create_patient()
        self.assertEqual(self.save_scan(p, severity_score=9).status_code, 400)

    def test_wound_status_follows_scan(self):
        p = self.create_patient()
        self.save_scan(p, severity_score=4, healing_status="Stable")
        wound = self.client.get(f"/api/patients/{p['custom_id']}/").json()["wounds"][0]
        self.assertEqual(wound["status"], "ACTION NEEDED")
        self.assertEqual(wound["current_severity"], 4)


class WoundTypeLockTests(ApiTestCase):
    """The AI identifies the type on the first scan; it then stays for every later scan."""

    save_scan = ScanSaveTests.save_scan

    def test_registration_ignores_client_wound_type(self):
        p = self.create_patient(woundType="Diabetic Wound")
        self.assertEqual(p["wounds"][0]["wound_type"], "Pending AI Scan")

    def test_first_scan_sets_type_and_later_scans_keep_it(self):
        p = self.create_patient()
        self.save_scan(p, wound_type="Pressure Injury")
        res = self.save_scan(p, wound_type="Venous Ulcer")
        self.assertEqual(res.json()["wound_type"], "Pressure Injury")
        wound = self.client.get(f"/api/patients/{p['custom_id']}/").json()["wounds"][0]
        self.assertEqual(wound["wound_type"], "Pressure Injury")
        self.assertEqual({s["wound_type"] for s in wound["scans"]}, {"Pressure Injury"})

    def test_unclassified_first_scan_lets_next_scan_set_type(self):
        p = self.create_patient()
        self.save_scan(p, wound_type="Unclassified")
        self.save_scan(p, wound_type="Surgical Wound")
        wound = self.client.get(f"/api/patients/{p['custom_id']}/").json()["wounds"][0]
        self.assertEqual(wound["wound_type"], "Surgical Wound")

    @mock.patch("api.views.run_ai_inference_pipeline")
    def test_analyze_reports_the_locked_type(self, run):
        p = self.create_patient()
        self.save_scan(p, wound_type="Pressure Injury")
        run.return_value = {**FAKE_RESULT, "wound_type": "Venous Ulcer", "warnings": []}
        res = self.client.post("/api/scans/analyze/", {"patient_id": p["custom_id"], "image_base64": image_data_url()}, format="json").json()
        self.assertEqual(res["wound_type"], "Pressure Injury")
        self.assertTrue(res["wound_type_locked"])

    @mock.patch("api.views.run_ai_inference_pipeline")
    def test_first_analyze_is_not_locked(self, run):
        p = self.create_patient()
        run.return_value = {**FAKE_RESULT, "wound_type": "Venous Ulcer", "warnings": []}
        res = self.client.post("/api/scans/analyze/", {"patient_id": p["custom_id"], "image_base64": image_data_url()}, format="json").json()
        self.assertEqual(res["wound_type"], "Venous Ulcer")
        self.assertFalse(res["wound_type_locked"])


class SeverityAnalyzerTests(unittest.TestCase):
    def test_background_outside_mask_is_ignored(self):
        img = np.zeros((100, 100, 3), dtype=np.uint8)  # black = "necrotic" colour everywhere
        img[30:70, 30:70] = (200, 30, 30)              # red granulation patch
        mask = np.zeros((100, 100), dtype=np.uint8)
        mask[30:70, 30:70] = 1
        with_mask = analyze_tissue_and_severity(Image.fromarray(img), region_mask=mask)
        self.assertGreater(with_mask["granulation_pct"], 90)
        self.assertLess(with_mask["necrosis_pct"], 5)

    def test_no_tissue_is_reported_not_invented(self):
        white = Image.new("RGB", (50, 50), (255, 255, 255))
        result = analyze_tissue_and_severity(white)
        self.assertFalse(result["tissue_detected"])
        self.assertEqual(result["granulation_pct"], 0.0)

    def test_healing_status(self):
        self.assertEqual(evaluate_healing_status(is_baseline=True), "Baseline")
        self.assertEqual(evaluate_healing_status(current_area=0.08, baseline_area=0.10), "Improving")
        self.assertEqual(evaluate_healing_status(current_area=0.12, baseline_area=0.10), "Deteriorating")
        self.assertEqual(evaluate_healing_status(current_area=0.10, baseline_area=0.10, current_severity_score=3, baseline_severity_score=3), "Stable")
        self.assertEqual(evaluate_healing_status(current_severity_score=2, baseline_severity_score=4), "Improving")


class HistoryMatchTests(unittest.TestCase):
    """Wound identity: previous scan first, then all earlier scans."""

    class StubComparator:
        method = "resnet50"

        def __init__(self, scores):
            self.scores = scores

        def similarities(self, current, references):
            return self.scores[: len(references)]

    def match(self, scores, has_history=True):
        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        manager.wound_comparator = self.StubComparator(scores)
        refs = [{"date": f"2024-0{i + 1}-01", "pil": Image.new("RGB", (8, 8))} for i in range(len(scores))]
        warnings = []
        return manager.match_against_history(Image.new("RGB", (8, 8)), refs, has_history, "Scalp", warnings), warnings

    def test_first_scan_is_baseline(self):
        result, _ = self.match([], has_history=False)
        self.assertTrue(result["is_baseline"])

    def test_matches_previous_scan(self):
        result, _ = self.match([0.82, 0.40, 0.30])  # newest first
        self.assertTrue(result["is_same_wound"])
        self.assertEqual(result["compared_with"], "previous")
        self.assertEqual(result["similarity_score"], 0.82)

    def test_falls_back_to_best_earlier_scan(self):
        # previous photo looks different, but an older one matches
        result, _ = self.match([0.50, 0.71, 0.60])
        self.assertTrue(result["is_same_wound"])
        self.assertEqual(result["compared_with"], "earlier")
        self.assertEqual(result["reference_date"], "2024-02-01")
        self.assertEqual(result["previous_scan_score"], 0.5)

    def test_flags_mismatch_only_when_nothing_matches(self):
        result, _ = self.match([0.50, 0.40, 0.62])
        self.assertFalse(result["is_same_wound"])
        self.assertEqual(result["similarity_score"], 0.62)
        self.assertIn("3 earlier photos", result["warning"])

    def test_history_without_readable_photos_is_reported(self):
        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        manager.wound_comparator = self.StubComparator([])
        warnings = []
        result = manager.match_against_history(Image.new("RGB", (8, 8)), [], True, "Scalp", warnings)
        self.assertIsNone(result["is_same_wound"])
        self.assertTrue(warnings)


class PipelineLoadingTests(unittest.TestCase):
    def test_mismatched_checkpoint_is_reported_not_loaded(self):
        import torch

        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        manager.load_errors = {}
        with tempfile.TemporaryDirectory() as d:
            path = pipeline_loader.Path(d) / "bad.pth"
            torch.save({"state_dict": {"not.a.real.key": torch.zeros(1)}}, path)
            model = manager._load_strict("VGG16", pipeline_loader.build_vgg_classifier, path)
        self.assertIsNone(model)
        self.assertIn("VGG16", manager.load_errors)

    def test_missing_photo_raises(self):
        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        with self.assertRaises(ValueError):
            manager.run_inference(None)

    @unittest.skipUnless((pipeline_loader.WEIGHTS_DIR / "fusegnet_segmentation.pth").exists(), "FUSegNet weights not present")
    def test_real_fusegnet_weights_load_strictly(self):
        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        manager.load_errors = {}
        model = manager._load_strict("FUSegNet", pipeline_loader.build_fusegnet, pipeline_loader.WEIGHTS_DIR / "fusegnet_segmentation.pth")
        self.assertIsNotNone(model, manager.load_errors)
