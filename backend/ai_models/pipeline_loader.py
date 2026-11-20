"""
Pipeline Loader for Patch Perfect AI

Stages:
1. ResNet-50 similarity check against the wound's Day 1 baseline
2. FUSegNet wound segmentation (EfficientNet-B7 encoder + P-scSE U-Net decoder)
3. VGG16 wound type classification (diabetic / pressure / surgical / venous)
4. Tissue breakdown & severity (HSV colour analysis inside the wound mask)

Design rules:
- Weights are loaded with strict=True. A checkpoint that does not match its
  architecture is reported as NOT loaded instead of silently running random weights.
- When a stage cannot run, the result says so (``weights_loaded: False`` plus an
  entry in ``warnings``) instead of fabricating plausible-looking numbers.
"""

import os
import threading
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models
    import cv2
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from .preprocessor import preprocess_wound_image, load_image_from_input
from .severity_analyzer import analyze_tissue_and_severity, evaluate_healing_status

AI_MODELS_DIR = Path(__file__).resolve().parent
WEIGHTS_DIR = AI_MODELS_DIR / "weights"
os.makedirs(WEIGHTS_DIR, exist_ok=True)

DEVICE = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
WOUND_CLASSES = ['diabetic', 'pressure', 'surgical', 'venous']
WOUND_CLASS_LABELS = {
    'diabetic': 'Diabetic Ulcer',
    'pressure': 'Pressure Injury',
    'surgical': 'Surgical Wound',
    'venous': 'Venous Ulcer',
}
UNCLASSIFIED = "Unclassified"

# FUSegNet was trained with ImageNet-normalised inputs (smp EfficientNet preprocessing)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
SEG_INPUT_SIZE = 512
SEG_THRESHOLD = 0.5
MIN_WOUND_AREA_RATIO = 0.001     # below this, treat as "no wound found"
LOW_CLASSIFIER_CONFIDENCE = 0.5
SIMILARITY_THRESHOLD = 0.65


def _first_existing(*globs):
    for pattern in globs:
        matches = sorted(WEIGHTS_DIR.glob(pattern))
        if matches:
            return matches[0]
    return None


def _clean_state_dict(checkpoint):
    state_dict = checkpoint
    if isinstance(checkpoint, dict):
        state_dict = checkpoint.get('model_state_dict', checkpoint.get('state_dict', checkpoint))
    return {(k[7:] if k.startswith('module.') else k): v for k, v in state_dict.items()}


def build_fusegnet():
    """FUSegNet = smp U-Net, EfficientNet-B7 encoder, P-scSE decoder attention (vendored smp)."""
    if str(AI_MODELS_DIR) not in sys.path:
        sys.path.insert(0, str(AI_MODELS_DIR))
    import segmentation_models_pytorch as smp  # vendored copy that provides 'pscse'
    return smp.Unet(
        encoder_name="efficientnet-b7",
        encoder_weights=None,
        classes=1,
        decoder_attention_type="pscse",
    )


def build_vgg_classifier():
    model = models.vgg16(weights=None)
    num_features = model.classifier[6].in_features
    model.classifier[6] = nn.Sequential(
        nn.Linear(num_features, 256),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(256, len(WOUND_CLASSES)),
    )
    return model


class AIPipelineManager:
    def __init__(self):
        self.fusegnet_model = None
        self.vgg_classifier = None
        self.wound_comparator = None
        self.load_errors = {}
        self.classifier_transform = None
        if TORCH_AVAILABLE:
            self.classifier_transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN.tolist(), std=IMAGENET_STD.tolist()),
            ])
        self.load_models()

    # ------------------------------------------------------------------ loading
    def _load_strict(self, name, builder, path):
        try:
            model = builder()
            checkpoint = torch.load(str(path), map_location=DEVICE, weights_only=False)
            model.load_state_dict(_clean_state_dict(checkpoint), strict=True)
            model.to(DEVICE).eval()
            print(f"[OK] {name} weights loaded (strict) from {path.name}")
            self.load_errors.pop(name, None)
            return model
        except Exception as e:
            self.load_errors[name] = f"{type(e).__name__}: {str(e)[:300]}"
            print(f"[ERROR] {name} weights in {path.name} could not be loaded: {self.load_errors[name]}")
            return None

    def load_models(self):
        if not TORCH_AVAILABLE:
            self.load_errors["torch"] = "PyTorch / torchvision / OpenCV are not installed"
            return

        if self.fusegnet_model is None and "FUSegNet" not in self.load_errors:
            path = _first_existing("fusegnet*", "*best_model*")
            if path:
                self.fusegnet_model = self._load_strict("FUSegNet", build_fusegnet, path)
            else:
                self.load_errors["FUSegNet"] = f"no weights file in {WEIGHTS_DIR}"

        if self.vgg_classifier is None and "VGG16" not in self.load_errors:
            path = _first_existing("*classifier_best2*", "*classifier_best*", "vgg16*", "*classifier*")
            if path:
                self.vgg_classifier = self._load_strict("VGG16", build_vgg_classifier, path)
            else:
                self.load_errors["VGG16"] = f"no weights file in {WEIGHTS_DIR}"

        if self.wound_comparator is None and "ResNet50" not in self.load_errors:
            try:
                from .similarity import WoundComparator
                self.wound_comparator = WoundComparator()
            except Exception as e:
                self.load_errors["ResNet50"] = f"{type(e).__name__}: {e}"
                print(f"[ERROR] WoundComparator unavailable: {e}")

    def status(self):
        return {
            "fusegnet_loaded": self.fusegnet_model is not None,
            "vgg16_loaded": self.vgg_classifier is not None,
            "resnet50_method": getattr(self.wound_comparator, "method", None),
            "errors": dict(self.load_errors),
        }

    # ------------------------------------------------------------------ stages
    def _segment(self, pil_image):
        """Returns (mask uint8 HxW or None, bbox, wound_area_ratio)."""
        if self.fusegnet_model is None:
            return None, None, None

        img_np = np.array(pil_image)
        h, w = img_np.shape[:2]
        resized = cv2.resize(img_np, (SEG_INPUT_SIZE, SEG_INPUT_SIZE)).astype(np.float32) / 255.0
        normalized = (resized - IMAGENET_MEAN) / IMAGENET_STD
        tensor = torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0).float().to(DEVICE)

        with torch.no_grad():
            output = self.fusegnet_model(tensor)
            if isinstance(output, (tuple, list)):
                output = output[0]
            prob = torch.sigmoid(output[:, 0:1]).cpu().numpy()[0, 0]

        mask = cv2.resize((prob > SEG_THRESHOLD).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
        area_ratio = float(mask.mean())
        if area_ratio < MIN_WOUND_AREA_RATIO:
            return None, None, area_ratio

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        x, y, bw, bh = cv2.boundingRect(max(contours, key=cv2.contourArea))
        pad_x, pad_y = int(bw * 0.1), int(bh * 0.1)
        bbox = (max(0, x - pad_x), max(0, y - pad_y), min(w, x + bw + pad_x), min(h, y + bh + pad_y))
        return mask, bbox, area_ratio

    def _classify(self, crop):
        if self.vgg_classifier is None:
            return None, None, None
        orig_w, orig_h = crop.size
        ratio = min(224 / max(orig_w, 1), 224 / max(orig_h, 1))
        new_size = (max(1, int(orig_w * ratio)), max(1, int(orig_h * ratio)))
        padded = Image.new('RGB', (224, 224), (0, 0, 0))
        padded.paste(crop.resize(new_size, Image.Resampling.LANCZOS), ((224 - new_size[0]) // 2, (224 - new_size[1]) // 2))
        tensor = self.classifier_transform(padded).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            probs = torch.softmax(self.vgg_classifier(tensor), dim=1).cpu().numpy()[0]
        idx = int(np.argmax(probs))
        return WOUND_CLASSES[idx], float(probs[idx]), probs

    def _baseline_scan(self, wound_profile):
        if wound_profile is None:
            return None
        return wound_profile.scans.order_by('scan_date', 'id').first()

    @staticmethod
    def _scan_image(scan):
        if scan is None:
            return None
        try:
            if scan.image and os.path.exists(scan.image.path):
                return Image.open(scan.image.path).convert("RGB")
        except Exception:
            pass
        if getattr(scan, 'image_base64', None):
            try:
                return load_image_from_input(scan.image_base64)
            except Exception:
                return None
        return None

    def _check_similarity(self, current_pil, wound_profile, baseline_scan, baseline_image_input, warnings):
        wound_title = (wound_profile.label or wound_profile.anatomical_location) if wound_profile else "this wound"

        # The stored Day 1 scan is authoritative; a client-supplied baseline is only
        # used when there is no server record (e.g. offline demo data).
        baseline_pil = self._scan_image(baseline_scan)
        if baseline_pil is None and baseline_scan is None and baseline_image_input:
            try:
                baseline_pil = preprocess_wound_image(baseline_image_input)["pil_image"]
            except Exception:
                baseline_pil = None

        if baseline_scan is None and baseline_pil is None:
            return {
                "model": "ResNet50",
                "is_baseline": True,
                "is_same_wound": True,
                "similarity_score": None,
                "confidence": None,
                "status": f"Day 1 baseline established for {wound_title}",
                "warning": None,
            }

        if baseline_pil is None or self.wound_comparator is None:
            warnings.append("Could not compare with the Day 1 photo, so the wound match was not checked.")
            return {"model": "ResNet50", "is_baseline": False, "is_same_wound": None,
                    "similarity_score": None, "confidence": None,
                    "status": "Baseline comparison unavailable", "warning": None}

        baseline_pil = baseline_pil.resize(current_pil.size)
        result = self.wound_comparator.compare(baseline_pil, current_pil, threshold=SIMILARITY_THRESHOLD)
        similarity = float(result['similarity'])
        is_same = bool(result['is_same_wound'])
        if getattr(self.wound_comparator, "method", "resnet50") != "resnet50":
            warnings.append("ResNet-50 weights unavailable; wound matching used a basic colour comparison.")
        return {
            "model": "ResNet50",
            "is_baseline": False,
            "is_same_wound": is_same,
            "similarity_score": round(similarity, 3),
            "confidence": f"{similarity:.1%}",
            "threshold_used": SIMILARITY_THRESHOLD,
            "status": f"Matches Day 1 baseline ({similarity:.1%})" if is_same else f"Wound mismatch ({similarity:.1%})",
            "warning": None if is_same else (
                f"Visual similarity with the Day 1 photo of {wound_title} is only {similarity:.1%} "
                f"(below the {SIMILARITY_THRESHOLD:.0%} threshold). This may be a different wound."
            ),
        }

    # ------------------------------------------------------------------ main
    def run_inference(self, image_input, patient=None, wound_profile=None, baseline_image_input=None):
        """
        Runs the pipeline. Raises ValueError when the input has no usable image or
        when no wound tissue can be found at all.
        """
        pil_input = load_image_from_input(image_input)
        if pil_input is None:
            raise ValueError("A wound photo is required.")

        self.load_models()
        preprocessed = preprocess_wound_image(pil_input)
        pil_img = preprocessed["pil_image"]
        warnings = []

        baseline_scan = self._baseline_scan(wound_profile)

        # Stage 1: similarity
        similarity_data = self._check_similarity(pil_img, wound_profile, baseline_scan, baseline_image_input, warnings)

        # Stage 2: segmentation
        mask, bbox, area_ratio = self._segment(pil_img)
        if self.fusegnet_model is None:
            warnings.append("Wound segmentation model is not loaded; tissue was analysed on the whole photo.")
        elif mask is None:
            # The segmenter ran and found nothing: scoring the whole photo would grade
            # background and skin as tissue, so ask for a better photo instead.
            raise ValueError("No wound was detected in this photo. Retake it closer to the wound, in good light, with the whole wound in frame.")

        if bbox:
            crop = pil_img.crop(bbox)
            crop_mask = mask[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        else:
            crop, crop_mask = pil_img, None

        segmentation_data = {
            "model": "FUSegNet",
            "weights_loaded": self.fusegnet_model is not None,
            "wound_detected": mask is not None,
            "wound_area_ratio": round(area_ratio, 5) if mask is not None else None,
            "bounding_box": bbox,
        }

        # Stage 3: classification
        pred_raw, clf_conf, probs = self._classify(crop)
        if pred_raw is None:
            predicted_type = UNCLASSIFIED
            warnings.append("Wound type classifier is not loaded; type was not classified.")
        else:
            predicted_type = WOUND_CLASS_LABELS[pred_raw]
            if clf_conf < LOW_CLASSIFIER_CONFIDENCE:
                warnings.append(f"Low confidence wound type ({clf_conf:.0%}); confirm the type clinically.")
        classification_data = {
            "model": "VGG16",
            "weights_loaded": self.vgg_classifier is not None,
            "predicted_type": predicted_type,
            "confidence": round(clf_conf, 3) if clf_conf is not None else None,
            "probabilities": {WOUND_CLASS_LABELS[c]: round(float(probs[i]), 3) for i, c in enumerate(WOUND_CLASSES)} if probs is not None else None,
        }

        # Stage 4: tissue & severity, restricted to wound pixels when we have a mask
        sev = analyze_tissue_and_severity(crop, region_mask=crop_mask)
        if not sev["tissue_detected"]:
            raise ValueError("No wound tissue could be identified in this photo. Retake it closer to the wound, in good light.")

        # Longitudinal healing: wound area vs the Day 1 scan of this same wound
        baseline_area = getattr(baseline_scan, 'wound_area_ratio', None) if baseline_scan else None
        healing_status = evaluate_healing_status(
            current_area=segmentation_data["wound_area_ratio"],
            baseline_area=baseline_area,
            current_severity_score=sev["severity_score"],
            baseline_severity_score=getattr(baseline_scan, 'severity_score', None) if baseline_scan else None,
            is_baseline=bool(similarity_data.get("is_baseline")),
        )

        return {
            "severity_score": sev["severity_score"],
            "severity_level": sev["severity_level"],
            "wound_type": predicted_type,
            "healing_status": healing_status,
            "recommendation": sev["recommendation"],
            "image_processed": preprocessed["base64"],
            "warnings": warnings,
            "pipeline_metrics": {
                "similarity": similarity_data,
                "segmentation": segmentation_data,
                "classification": classification_data,
                "tissue_stats": {
                    "granulation": sev["granulation_pct"],
                    "slough": sev["slough_pct"],
                    "necrotic": sev["necrosis_pct"],
                },
                "tissue_method": "HSV colour analysis" + (" within wound mask" if crop_mask is not None else " on whole photo"),
                "wound_pixels": sev["wound_pixels"],
                "raw_severity_level": sev.get("raw_severity_level"),
            },
        }


_manager = None
_manager_lock = threading.Lock()


def get_ai_pipeline_manager():
    """Lazily create the pipeline (loading ~1.3 GB of weights) on first use, not on import.
    Locked so the startup preload thread and an early request don't load the models twice."""
    global _manager
    if _manager is None:
        with _manager_lock:
            if _manager is None:
                _manager = AIPipelineManager()
    return _manager
