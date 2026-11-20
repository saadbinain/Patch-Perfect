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

    def test_card_measurements_are_saved(self):
        p = self.create_patient()
        res = self.save_scan(p, wound_area_cm2=12.5, card_block_ratio=0.0066)
        self.assertEqual(res.status_code, 201, res.content)
        scan = WoundAssessmentScan.objects.get()
        self.assertEqual(scan.wound_area_cm2, 12.5)
        self.assertEqual(scan.card_block_ratio, 0.0066)

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


class CropStepTests(ApiTestCase):
    @mock.patch("api.views.detect_wound_box")
    def test_detect_box_endpoint(self, detect_mock):
        detect_mock.return_value = {
            "bounding_box": [10, 20, 100, 200],
            "normalized_box": [0.1, 0.2, 0.5, 0.8],
            "wound_detected": True,
            "image_width": 200,
            "image_height": 250,
            "wound_area_ratio": 0.05,
        }
        res = self.client.post("/api/scans/detect-box/", {"image_base64": image_data_url()}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["wound_detected"])
        self.assertEqual(res.json()["bounding_box"], [10, 20, 100, 200])

    @mock.patch("api.views.run_ai_inference_pipeline")
    def test_analyze_passes_crop_box(self, run_mock):
        p = self.create_patient()
        run_mock.return_value = {**FAKE_RESULT, "wound_type": "Diabetic Ulcer", "warnings": []}
        crop = [15, 25, 120, 180]
        res = self.client.post("/api/scans/analyze/", {
            "patient_id": p["custom_id"],
            "image_base64": image_data_url(),
            "crop_box": crop,
        }, format="json")
        self.assertEqual(res.status_code, 200)
        run_mock.assert_called_once()
        self.assertEqual(run_mock.call_args.kwargs.get("crop_box"), crop)

    def test_parse_crop_box_formats(self):
        from ai_models.pipeline_loader import _parse_crop_box
        # normalized [0..1]
        self.assertEqual(_parse_crop_box([0.1, 0.2, 0.6, 0.8], 1000, 500), (100, 100, 600, 400))
        # pixel coords
        self.assertEqual(_parse_crop_box([50, 60, 200, 300], 1000, 500), (50, 60, 200, 300))
        # dictionary
        self.assertEqual(_parse_crop_box({"x1": 10, "y1": 20, "x2": 150, "y2": 250}, 1000, 500), (10, 20, 150, 250))
        # reversed coordinates sorted properly
        self.assertEqual(_parse_crop_box([200, 300, 50, 60], 1000, 500), (50, 60, 200, 300))
        # None / invalid
        self.assertIsNone(_parse_crop_box(None, 1000, 500))
        self.assertIsNone(_parse_crop_box("invalid", 1000, 500))


class CropPipelineTests(unittest.TestCase):
    """Runs the real run_inference with the models stubbed, so the crop logic itself is tested."""

    def manager_with_mask(self, mask):
        manager = pipeline_loader.AIPipelineManager.__new__(pipeline_loader.AIPipelineManager)
        manager.fusegnet_model = object()  # "loaded"
        manager.vgg_classifier = None
        manager.load_errors = {}
        manager.load_models = lambda: None
        manager._check_similarity = lambda *a, **k: {"is_baseline": True}
        bbox = None
        if mask is not None and mask.any():
            ys, xs = np.nonzero(mask)
            bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        def segment(img, exclude=None):
            m = None if mask is None else mask.copy()
            if m is not None and exclude is not None:
                m[exclude > 0] = 0
            return m, bbox, float(m.mean()) if m is not None else None
        manager._segment = segment
        return manager

    @staticmethod
    def wound_photo():
        # 512x512 skin-coloured photo with a red 64x64 wound in the middle
        img = Image.new("RGB", (512, 512), (225, 190, 170))
        img.paste((190, 30, 40), (224, 224, 288, 288))
        return img

    @staticmethod
    def wound_mask():
        mask = np.zeros((512, 512), dtype=np.uint8)
        mask[224:288, 224:288] = 1
        return mask

    def area(self, crop_box):
        result = self.manager_with_mask(self.wound_mask()).run_inference(self.wound_photo(), crop_box=crop_box)
        return result["pipeline_metrics"]["segmentation"]["wound_area_ratio"]

    def test_tight_and_loose_crops_give_the_same_area(self):
        # A tighter box must not make the wound look bigger (false "Deteriorating").
        expected = round(64 * 64 / (512 * 512), 5)
        self.assertEqual(self.area(None), expected)
        self.assertEqual(self.area([0.1, 0.1, 0.9, 0.9]), expected)
        self.assertEqual(self.area([0.42, 0.42, 0.58, 0.58]), expected)

    def test_false_detections_outside_the_box_are_excluded(self):
        mask = self.wound_mask()
        mask[0:40, 0:200] = 1  # e.g. hair / forehead wrongly segmented
        manager = self.manager_with_mask(mask)
        result = manager.run_inference(self.wound_photo(), crop_box=[0.4, 0.4, 0.6, 0.6])
        seg = result["pipeline_metrics"]["segmentation"]
        self.assertTrue(seg["crop_box_applied"])
        self.assertEqual(seg["wound_area_ratio"], round(64 * 64 / (512 * 512), 5))

    def test_slough_hole_inside_the_wound_counts_toward_size(self):
        mask = self.wound_mask()
        mask[240:272, 240:272] = 0  # segmenter left the yellow slough centre out
        result = self.manager_with_mask(mask).run_inference(self.wound_photo(), crop_box=[0.3, 0.3, 0.7, 0.7])
        self.assertEqual(result["pipeline_metrics"]["segmentation"]["wound_area_ratio"], round(64 * 64 / (512 * 512), 5))

    def test_box_that_misses_the_wound_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "box does not contain the wound"):
            self.manager_with_mask(self.wound_mask()).run_inference(self.wound_photo(), crop_box=[0.0, 0.0, 0.2, 0.2])

    def test_no_wound_found_still_rejected_with_a_box(self):
        # A box must not bypass the "no wound found" check and grade skin as tissue.
        with self.assertRaisesRegex(ValueError, "No wound was detected"):
            self.manager_with_mask(None).run_inference(self.wound_photo(), crop_box=[0.1, 0.1, 0.9, 0.9])

    def test_exif_rotation_is_applied(self):
        from ai_models.preprocessor import load_image_from_input
        img = Image.new("RGB", (40, 20), (200, 0, 0))
        exif = img.getexif()
        exif[274] = 6  # rotate 90 degrees on display
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif)
        data_url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        self.assertEqual(load_image_from_input(data_url).size, (20, 40))


def card_scene(px_per_cm, size=(900, 700)):
    """Skin-coloured photo with the colour card and a 4x3 cm red wound, drawn at a given scale.
    The card's patches are 1 cm (the default COLOUR_CARD_PATCH_CM)."""
    from PIL import ImageDraw
    img = Image.new("RGB", size, (225, 190, 170))
    d = ImageDraw.Draw(img)
    u = px_per_cm
    x0, y0 = 40, 40
    d.rectangle([x0, y0, x0 + 5 * u, y0 + 5 * u], fill=(245, 245, 245))  # white card
    grid = [[(20, 60, 200), (0, 170, 210), (30, 30, 30)],
            [(30, 170, 60), (240, 225, 20), (110, 110, 110)],
            [(210, 30, 30), (230, 40, 130), (190, 190, 190)]]
    for r, row in enumerate(grid):
        for c, colour in enumerate(row):
            px, py = x0 + u + c * u, y0 + u + r * u
            d.rectangle([px, py, px + u - 1, py + u - 1], fill=colour)
    wx, wy = size[0] // 2, size[1] // 2
    d.rectangle([wx, wy, wx + 4 * u - 1, wy + 3 * u - 1], fill=(190, 30, 40))
    return img, (wx, wy, wx + int(4 * u), wy + int(3 * u))


class ColourCardTests(unittest.TestCase):
    def test_finds_card_and_scale(self):
        from ai_models.colour_card import detect_colour_card
        img, _ = card_scene(60)
        card = detect_colour_card(img)
        self.assertTrue(card["detected"])
        self.assertAlmostEqual(card["pixels_per_cm"], 60, delta=3)
        self.assertEqual(card["white_balance_gains"], [1.0, 1.0, 1.0])

    def test_rotated_card_is_found(self):
        from ai_models.colour_card import detect_colour_card
        img, _ = card_scene(60)
        card = detect_colour_card(img.rotate(30, expand=True, fillcolor=(225, 190, 170)))
        self.assertTrue(card["detected"])
        self.assertAlmostEqual(card["pixels_per_cm"], 60, delta=4)

    def test_no_card_in_plain_wound_photo(self):
        from ai_models.colour_card import detect_colour_card
        self.assertFalse(detect_colour_card(CropPipelineTests.wound_photo())["detected"])

    def test_white_balance_corrects_a_colour_cast(self):
        from ai_models.colour_card import detect_colour_card, apply_white_balance
        img, _ = card_scene(60)
        cast = Image.fromarray(np.clip(np.asarray(img).astype(np.float32) * [1.15, 1.0, 0.85], 0, 255).astype(np.uint8))
        card = detect_colour_card(cast)
        fixed = np.asarray(apply_white_balance(cast, card["white_balance_gains"]))
        white = fixed[45, 45].astype(int)  # a point on the white card
        self.assertLess(white.max() - white.min(), 8)

    def run_scene(self, px_per_cm, previous=None):
        img, wound = card_scene(px_per_cm)
        mask = np.zeros((512, 512), np.uint8)
        sx, sy = 512 / img.width, 512 / img.height
        mask[int(wound[1] * sy):int(wound[3] * sy), int(wound[0] * sx):int(wound[2] * sx)] = 1
        manager = CropPipelineTests().manager_with_mask(mask)
        profile = None
        if previous is not None:
            profile = mock.Mock()
            profile.scans.order_by.return_value.first.return_value = previous
            manager._baseline_scan = lambda wp: previous
            manager._check_similarity = lambda *a, **k: {"is_baseline": False}
        return manager.run_inference(img, wound_profile=profile, crop_box=[0.3, 0.3, 0.95, 0.95])

    def test_size_in_cm2_does_not_depend_on_camera_distance(self):
        far = self.run_scene(40)["pipeline_metrics"]["segmentation"]["wound_area_cm2"]
        close = self.run_scene(70)["pipeline_metrics"]["segmentation"]["wound_area_cm2"]
        self.assertAlmostEqual(far, 12.0, delta=1.0)
        self.assertAlmostEqual(close, 12.0, delta=1.0)

    def test_close_up_is_not_deteriorating_when_compared_in_cm2(self):
        baseline = mock.Mock(wound_area_cm2=12.0, wound_area_ratio=0.02, severity_score=None, epithelial_percent=None,
                             card_block_ratio=(2 * 40) ** 2 / (900 * 700))
        result = self.run_scene(70, previous=baseline)
        self.assertEqual(result["pipeline_metrics"]["size_basis"], "cm2")
        self.assertEqual(result["healing_status"], "Stable")
        self.assertTrue(any("closer than the last one" in w for w in result["warnings"]))

    def test_missing_card_is_reported(self):
        manager = CropPipelineTests().manager_with_mask(CropPipelineTests.wound_mask())
        result = manager.run_inference(CropPipelineTests.wound_photo())
        self.assertIsNone(result["pipeline_metrics"]["segmentation"]["wound_area_cm2"])
        self.assertTrue(any("Colour card not found" in w for w in result["warnings"]))


class WoundRegionSelectionTests(unittest.TestCase):
    @staticmethod
    def blob(mask, cx, cy, r):
        import cv2
        cv2.circle(mask, (cx, cy), r, 1, -1)
        return mask

    def test_ragged_edge_band_is_dropped_and_wound_kept(self):
        mask = self.blob(np.zeros((512, 512), np.uint8), 256, 230, 70)
        # hair band: a ragged strip along the bottom edge, bigger than the wound
        for x in range(0, 512, 24):
            mask[440 + (x % 48) // 3:512, x:x + 16] = 1
        mask[470:512, :] = 1
        selected = pipeline_loader._select_wound_regions(mask)
        self.assertTrue(selected[230, 256])
        self.assertFalse(selected[500, 100])

    def test_accepting_the_ai_box_gives_the_ai_result(self):
        mask = self.blob(np.zeros((512, 512), np.uint8), 256, 300, 80)
        mask[440:512, 0:512] = 1      # hair band along the bottom edge...
        mask[400:440, 180:200] = 1    # ...with a strand reaching up towards the wound
        manager = CropPipelineTests().manager_with_mask(mask)
        auto = manager.run_inference(CropPipelineTests.wound_photo())["pipeline_metrics"]["segmentation"]
        x1, y1, x2, y2 = auto["bounding_box"]
        boxed = manager.run_inference(CropPipelineTests.wound_photo(), crop_box=[x1 / 512, y1 / 512, x2 / 512, y2 / 512])
        self.assertEqual(boxed["pipeline_metrics"]["segmentation"]["wound_area_ratio"], auto["wound_area_ratio"])

    def test_nearby_fragments_of_a_patchy_wound_are_kept(self):
        mask = self.blob(np.zeros((512, 512), np.uint8), 256, 256, 50)
        self.blob(mask, 330, 270, 18)  # second patch of the same wound
        self.blob(mask, 60, 60, 20)    # unrelated blob far away
        selected = pipeline_loader._select_wound_regions(mask)
        self.assertTrue(selected[270, 330])
        self.assertFalse(selected[60, 60])

    def test_ai_box_ignores_colour_card(self):
        img, wound = card_scene(40)
        mask = np.zeros((512, 512), np.uint8)
        sx, sy = 512 / img.width, 512 / img.height
        mask[int(wound[1] * sy):int(wound[3] * sy), int(wound[0] * sx):int(wound[2] * sx)] = 1
        # segmenter also fires on the card's red and magenta patches
        mask[int(40 * sy):int(200 * sy), int(40 * sx):int(200 * sx)] = 1
        result = CropPipelineTests().manager_with_mask(mask).run_inference(img)
        x1, y1, _, _ = result["pipeline_metrics"]["segmentation"]["bounding_box"]
        self.assertGreater(x1, 200 * sx)
        self.assertGreater(y1, 200 * sy)
        self.assertAlmostEqual(result["pipeline_metrics"]["segmentation"]["wound_area_cm2"], 12.0, delta=1.0)


class TissueRulesTests(unittest.TestCase):
    """Step 4: colour rules measured on clinic photos, new skin class, size-aware severity."""

    @staticmethod
    def patches(*colours):
        # one 40x40 patch per (r, g, b) colour, side by side
        img = Image.new("RGB", (40 * len(colours), 40))
        for i, c in enumerate(colours):
            img.paste(c, (40 * i, 0, 40 * (i + 1), 40))
        return img

    def test_cream_slough_is_counted(self):
        # measured slough on the Day 1 scalp photo: hue ~15 (OpenCV), sat ~100, value ~207
        sev = analyze_tissue_and_severity(self.patches((207, 166, 126), (191, 30, 20)))
        self.assertAlmostEqual(sev["slough_pct"], 50, delta=3)
        self.assertAlmostEqual(sev["granulation_pct"], 50, delta=3)

    def test_pale_pink_new_skin_is_its_own_class(self):
        sev = analyze_tissue_and_severity(self.patches((215, 170, 165)))
        self.assertEqual(sev["epithelial_pct"], 100.0)
        self.assertEqual(sev["granulation_pct"], 0.0)
        self.assertEqual(sev["severity_level"], "Minimal")

    def test_dark_red_periwound_is_not_necrotic(self):
        sev = analyze_tissue_and_severity(self.patches((85, 20, 15)))  # value ~85
        self.assertEqual(sev["necrosis_pct"], 0.0)

    def test_black_eschar_is_necrotic(self):
        sev = analyze_tissue_and_severity(self.patches((25, 20, 18)))
        self.assertEqual(sev["necrosis_pct"], 100.0)
        self.assertEqual(sev["severity_score"], 5)

    def test_large_clean_wound_is_at_least_moderate(self):
        from ai_models.severity_analyzer import apply_wound_size
        sev = analyze_tissue_and_severity(self.patches((191, 30, 20)))
        self.assertEqual(sev["severity_level"], "Mild")
        self.assertEqual(apply_wound_size(sev, 90.0)["severity_level"], "Moderate")
        self.assertTrue(apply_wound_size(sev, 90.0)["size_adjusted"])
        self.assertEqual(apply_wound_size(sev, 4.0)["severity_level"], "Mild")
        self.assertEqual(apply_wound_size(sev, None)["severity_level"], "Mild")

    def test_new_necrosis_is_deteriorating_even_if_smaller(self):
        status = evaluate_healing_status(
            current_area=8.0, baseline_area=12.0, current_severity_score=4, baseline_severity_score=2,
            current_tissue={"granulation": 70, "slough": 5, "necrotic": 25, "epithelial": 0},
            baseline_tissue={"granulation": 95, "slough": 0, "necrotic": 0, "epithelial": 5})
        self.assertEqual(status, "Deteriorating")

    def test_slough_clearing_at_same_size_is_improving(self):
        status = evaluate_healing_status(
            current_area=12.0, baseline_area=12.2, current_severity_score=2, baseline_severity_score=3,
            current_tissue={"granulation": 95, "slough": 2, "necrotic": 0, "epithelial": 3},
            baseline_tissue={"granulation": 50, "slough": 31, "necrotic": 0, "epithelial": 19})
        self.assertEqual(status, "Improving")

    def test_wound_bed_closes_an_outline_open_to_one_side(self):
        # ring of granulation with the slough centre left out and open at the bottom
        mask = np.zeros((200, 200), np.uint8)
        import cv2
        cv2.circle(mask, (100, 100), 60, 1, -1)
        cv2.circle(mask, (100, 100), 35, 0, -1)
        mask[100:200, 94:106] = 0  # 12 px bay out to the edge of the outline
        bed = pipeline_loader._wound_bed(mask)
        self.assertTrue(bed[100, 100])
        self.assertGreater(bed.sum(), 0.95 * np.pi * 60 ** 2)

    def test_old_baseline_without_new_skin_value_is_not_tissue_compared(self):
        mask = CropPipelineTests.wound_mask()
        manager = CropPipelineTests().manager_with_mask(mask)
        old = mock.Mock(wound_area_cm2=None, wound_area_ratio=64 * 64 / (512 * 512), severity_score=2,
                        granulation_percent=100.0, slough_percent=0.0, necrotic_percent=0.0, epithelial_percent=None,
                        card_block_ratio=None)
        manager._baseline_scan = lambda wp: old
        manager._check_similarity = lambda *a, **k: {"is_baseline": False}
        profile = mock.Mock()
        profile.scans.order_by.return_value.first.return_value = old
        img = CropPipelineTests.wound_photo()
        img.paste((207, 166, 126), (240, 240, 272, 272))  # slough appears in the centre
        result = manager.run_inference(img, wound_profile=profile)
        self.assertGreater(result["pipeline_metrics"]["tissue_stats"]["slough"], 10)
        self.assertNotEqual(result["healing_status"], "Deteriorating")
