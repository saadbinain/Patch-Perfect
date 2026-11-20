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
from .severity_analyzer import analyze_tissue_and_severity, evaluate_healing_status, apply_wound_size
from .colour_card import detect_colour_card, apply_white_balance

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
MAX_REFERENCE_SCANS = 30         # earlier photos of a wound checked for the identity match


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


def _parse_crop_box(crop_box, img_w, img_h):
    """
    Parses a user-confirmed crop box in either pixel coords or normalized [0..1] coords.
    Returns (xmin, ymin, xmax, ymax) in integer pixel coordinates clamped to image bounds.
    """
    if not crop_box:
        return None
    try:
        if isinstance(crop_box, dict):
            x1 = crop_box.get('x1', crop_box.get('x', 0))
            y1 = crop_box.get('y1', crop_box.get('y', 0))
            x2 = crop_box.get('x2', x1 + crop_box.get('width', img_w))
            y2 = crop_box.get('y2', y1 + crop_box.get('height', img_h))
        elif isinstance(crop_box, (list, tuple)) and len(crop_box) == 4:
            x1, y1, x2, y2 = crop_box
        else:
            return None

        vals = [float(x1), float(y1), float(x2), float(y2)]
        if all(-0.5 <= v <= 1.5 for v in vals):
            # normalised 0..1 (what the app sends); slight overshoot from dragging is clamped
            vals = [min(1.0, max(0.0, v)) for v in vals]
            px1 = int(round(vals[0] * img_w))
            py1 = int(round(vals[1] * img_h))
            px2 = int(round(vals[2] * img_w))
            py2 = int(round(vals[3] * img_h))
        else:
            px1 = int(round(vals[0]))
            py1 = int(round(vals[1]))
            px2 = int(round(vals[2]))
            py2 = int(round(vals[3]))

        xmin, xmax = sorted([px1, px2])
        ymin, ymax = sorted([py1, py2])
        xmin = max(0, min(img_w - 2, xmin))
        ymin = max(0, min(img_h - 2, ymin))
        xmax = max(xmin + 1, min(img_w, xmax))
        ymax = max(ymin + 1, min(img_h, ymax))
        return (xmin, ymin, xmax, ymax)
    except Exception:
        return None


# Warn when the card looks this much bigger/smaller (linear size) than on the last scan.
DISTANCE_CHANGE_WARN = 1.25


# Gaps in the outline up to this share of the wound's size are closed (see _wound_bed).
WOUND_BED_CLOSE = 0.2


def _wound_bed(mask):
    """
    The whole wound bed: the segmenter tends to leave slough and dead tissue out,
    as holes or as a bay that opens to the edge of the outline. Small gaps in the
    outline are closed (scaled to the wound's size) and the result is filled, so that
    tissue is measured and its colour analysed.
    """
    if mask is None or not mask.any():
        return mask
    mask = mask.astype(np.uint8)
    k = max(5, int(np.sqrt(mask.sum()) * WOUND_BED_CLOSE)) | 1
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    bed = np.zeros_like(mask)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(bed, contours, -1, 1, thickness=cv2.FILLED)
    return bed | mask


# Peeling a dark red rim off the outline (see _wound_outline): only when the outline
# splits clearly into a bright part and a darker part that lies on its outside.
RIM_MIN_BRIGHTNESS_GAP = 35   # mean value (0-255), bright part minus dark part
RIM_MIN_SHARE = 0.15          # the dark part is at least this share of the outline
RIM_MAX_DEPTH_RATIO = 0.75    # dark pixels sit at most this deep (vs bright ones) from the edge
RIM_MIN_KEPT = 0.3            # never peel away more than 70% of the outline
# Inflamed skin around wounds measured 106-127; a darker part of the wound bed itself
# (e.g. the purplish side of an ulcer) measured ~149, so only a genuinely dark rim is peeled.
RIM_MAX_DARK_MEAN = 135


def _brightness(pil_image):
    return cv2.cvtColor(np.asarray(pil_image.convert("RGB")), cv2.COLOR_RGB2HSV)[..., 2]


def _wound_outline(selected, brightness):
    """
    The final wound outline from the selected regions.

    The segmenter often takes in the red, inflamed skin around a wound together with
    the wound itself (measured: periwound brightness ~105 vs wound bed ~155). When the
    outline splits clearly into a bright core and a darker ring on its OUTSIDE, the ring
    is peeled off and the core is closed and filled again, so dark tissue inside the
    wound (eschar, dusky granulation) is kept. Otherwise the outline is just filled.
    """
    if selected is None or not selected.any():
        return selected
    bed = _wound_bed(selected)
    inside = selected > 0
    values = brightness[inside].astype(np.uint8).reshape(-1, 1)
    threshold, _ = cv2.threshold(values, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Otsu: values above the threshold are the bright class
    dark = inside & (brightness <= threshold)
    bright = inside & (brightness > threshold)
    if not dark.any() or not bright.any():
        return bed
    depth = cv2.distanceTransform(selected.astype(np.uint8), cv2.DIST_L2, 5)
    gap = float(brightness[bright].mean() - brightness[dark].mean())
    share = float(dark.sum()) / float(inside.sum())
    depth_ratio = float(np.median(depth[dark])) / max(float(np.median(depth[bright])), 1e-3)
    dark_mean = float(brightness[dark].mean())
    if (gap < RIM_MIN_BRIGHTNESS_GAP or share < RIM_MIN_SHARE or depth_ratio > RIM_MAX_DEPTH_RATIO
            or dark_mean > RIM_MAX_DARK_MEAN):
        return bed
    core = cv2.morphologyEx(bright.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    peeled = _wound_bed(_select_wound_regions(core)) & bed
    if peeled is None or peeled.sum() < RIM_MIN_KEPT * inside.sum():
        return bed
    return peeled


def _filled_area_ratio(mask):
    """Wound size as a share of the photo, measured on the whole wound bed."""
    if mask is None or not mask.any():
        return None
    return float(_wound_bed(mask).sum()) / float(mask.size)


# The whole printed card lies within this many block-widths of the block's centre
# (block = 2 patches; grid edge ~1 block-width away, white margin ~0.75 more).
CARD_EXCLUSION_SCALE = 4.0


def _card_exclusion_mask(card, w, h):
    """uint8 HxW mask of the colour card (its patches can look like wound tissue), or None."""
    poly = card.get("block_polygon") if card else None
    if not poly:
        return None
    pts = np.array([[x * w, y * h] for x, y in poly], dtype=np.float32)
    centre = pts.mean(axis=0)
    zone = (centre + (pts - centre) * CARD_EXCLUSION_SCALE).round().astype(np.int32)
    mask = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(mask, zone, 1)
    return mask


# Region picking (see _select_wound_regions)
REGION_MIN_SHARE = 0.0015        # normal regions: at least this share of the photo
SMALL_REGION_MIN_SHARE = 0.0004  # small, sharply outlined sores (e.g. 0.2 cm2 on a nose)
CONTRAST_SCALE = 40.0            # saturation units per "1x" of contrast vs the photo's skin
VERY_DARK = 50                   # brightness below this: shadow, nostril, hair


def _region_candidates(mask):
    """Candidate regions at two scales: a strong clean-up, which separates the wound
    from hair bands joined to it by thin strands, and a light one, which keeps
    small sores that the strong clean-up would erase."""
    h, w = mask.shape
    out = []
    for kernel, min_share in ((7, REGION_MIN_SHARE), (3, SMALL_REGION_MIN_SHARE)):
        opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel)))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
        for i in range(1, n):
            x, y, bw, bh, area = stats[i]
            if area >= max(20, int(min_share * h * w)):
                out.append(((labels == i), (x, y, x + bw, y + bh), int(area)))
    return out


def _select_wound_regions(mask, image=None):
    """
    Keeps the wound and drops look-alikes the segmenter also fires on (hair bands,
    moustache, nostrils, red skin at the photo edge, background).

    Each candidate region is scored by size x solidity^2 (a filled blob, not a ragged
    strip), down-weighted if it runs off the photo edge. With the photo (`image`, PIL),
    it is also scored by colour: how much more saturated it is than the photo's typical
    skin (a sore stands out; moustache and normal skin do not), and down-weighted when
    it is mostly very dark (shadow, nostril, hair) or not red (logos, text, objects).
    Nearby fragments of the chosen wound
    are kept too, since wounds can be patchy.
    Returns the selected mask, or the input mask if no region qualifies.
    """
    if mask is None or not mask.any():
        return mask
    mask = mask.astype(np.uint8)
    h, w = mask.shape
    sat = val = None
    if image is not None:
        hsv = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2HSV)
        sat, val = hsv[..., 1].astype(np.float32), hsv[..., 2]
        red_hue = (hsv[..., 0] <= 10) | (hsv[..., 0] >= 165)
        photo_sat = float(np.median(sat))

    regions = []
    for region, (x1, y1, x2, y2), area in _region_candidates(mask):
        contours, _ = cv2.findContours(region.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hull_area = cv2.contourArea(cv2.convexHull(max(contours, key=cv2.contourArea)))
        solidity = min(1.0, area / max(hull_area, 1.0))
        touches_edge = x1 <= 1 or y1 <= 1 or x2 >= w - 1 or y2 >= h - 1
        score = area * solidity ** 2 * (0.25 if touches_edge else 1.0)
        if sat is not None:
            contrast = float(np.clip((sat[region].mean() - photo_sat) / CONTRAST_SCALE, 0.3, 4.0))
            # dark regions (hair, shadow, nostril) fade out smoothly: mean brightness
            # 50 -> 0.15x, 130+ -> 1x (a pale healing wound measured ~189, hair ~67)
            brightness = float(np.clip((float(val[region].mean()) - VERY_DARK) / 80.0, 0.15, 1.0))
            # wounds are mostly red; text, logos and objects usually are not (yellow slough
            # still scores 0.25x, so a sloughy wound is down-weighted, not ruled out)
            redness = 0.25 + 0.75 * float(red_hue[region].mean())
            score *= contrast ** 2 * redness * brightness
        regions.append({"mask": region, "box": (x1, y1, x2, y2), "area": area, "edge": touches_edge, "score": score})
    if not regions:
        return mask

    main = max(regions, key=lambda r: r["score"])
    x1, y1, x2, y2 = main["box"]
    mx, my = 0.3 * (x2 - x1), 0.3 * (y2 - y1)
    near = (x1 - mx, y1 - my, x2 + mx, y2 + my)
    keep = main["mask"].copy()
    for r in regions:
        if r is main or (r["mask"] & main["mask"]).any():
            continue  # the main region itself, or the same region at the other scale
        bx1, by1, bx2, by2 = r["box"]
        overlaps = bx1 < near[2] and bx2 > near[0] and by1 < near[3] and by2 > near[1]
        # pieces of a patchy wound are smaller than its main part
        if overlaps and not r["edge"] and 0.05 * main["area"] <= r["area"] <= main["area"]:
            keep |= r["mask"]
    # give back the edge detail the clean-up shaved off, without re-attaching distant strands
    return mask & cv2.dilate(keep.astype(np.uint8), np.ones((9, 9), np.uint8))


def _bbox_of(mask, pad=0.1):
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        return None
    h, w = mask.shape
    x1, y1, x2, y2 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    px, py = int((x2 - x1) * pad), int((y2 - y1) * pad)
    return (max(0, x1 - px), max(0, y1 - py), min(w, x2 + px), min(h, y2 + py))


def _card_summary(card):
    """The part of the colour-card result that is returned to the app."""
    return {
        "detected": card["detected"],
        "block_area_ratio": card["block_area_ratio"],
        "pixels_per_cm": card["pixels_per_cm"],
        "white_balance_gains": card["white_balance_gains"],
    }


def _distance_note(card, previous_scan):
    """Compares the card's apparent size with the previous scan of this wound."""
    prev = getattr(previous_scan, "card_block_ratio", None) if previous_scan else None
    cur = card.get("block_area_ratio")
    if not prev or not cur:
        return None, None
    linear = float(np.sqrt(cur / prev))  # >1: camera closer than last time
    if linear >= DISTANCE_CHANGE_WARN:
        return round(linear, 2), (f"This photo was taken closer than the last one (card looks {linear:.1f}x bigger). "
                                  "Size is still measured in cm², but matching the distance gives more reliable results.")
    if linear <= 1 / DISTANCE_CHANGE_WARN:
        return round(linear, 2), (f"This photo was taken further away than the last one (card looks {1 / linear:.1f}x smaller). "
                                  "Size is still measured in cm², but matching the distance gives more reliable results.")
    return round(linear, 2), None


# Below this, a photo has too few pixels for the outline or the colours to mean anything.
MIN_PHOTO_SIDE = 128
# A photo whose average saturation is this low is black and white (or nearly):
# grey pixels would be graded as black eschar ("Critical").
MIN_PHOTO_SATURATION = 12
# The clinician's box must cover at least this share of the photo's width and height.
MIN_BOX_SIDE = 0.03


def _check_photo(pil_input):
    w, h = pil_input.size
    if min(w, h) < MIN_PHOTO_SIDE:
        raise ValueError(f"This photo is too small ({w}x{h} pixels). Use the camera's full-size photo.")
    small = pil_input.copy()
    small.thumbnail((256, 256))
    saturation = float(np.asarray(small.convert("HSV"))[..., 1].mean())
    if saturation < MIN_PHOTO_SATURATION:
        raise ValueError("This photo has no colour (black and white?). Tissue can only be graded on a colour photo.")


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
    def _segment(self, pil_image, exclude=None):
        """
        Returns (mask uint8 HxW or None, bbox, wound_area_ratio).
        mask is everything the segmenter found (minus `exclude`, e.g. the colour card);
        bbox is around the selected wound regions only (see _select_wound_regions).
        """
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
        if exclude is not None:
            mask[exclude > 0] = 0
        area_ratio = float(mask.mean())
        if area_ratio < MIN_WOUND_AREA_RATIO:
            return None, None, area_ratio

        return mask, _bbox_of(_wound_outline(_select_wound_regions(mask, pil_image), _brightness(pil_image))), area_ratio

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

    def _history_references(self, wound_profile, baseline_image_input):
        """
        Earlier photos of this wound, newest first: [{"date", "pil"}], plus whether the
        wound has any earlier scans at all. A client-supplied baseline is only used when
        the server has no record of the wound (e.g. offline demo data).
        """
        refs, has_history = [], False
        if wound_profile is not None:
            scans = list(wound_profile.scans.order_by('-scan_date', '-id')[:MAX_REFERENCE_SCANS])
            has_history = bool(scans)
            for scan in scans:
                pil = self._scan_image(scan)
                if pil is not None:
                    refs.append({"date": scan.scan_date.date().isoformat() if scan.scan_date else None, "pil": pil})
        if not has_history and baseline_image_input:
            try:
                refs.append({"date": None, "pil": preprocess_wound_image(baseline_image_input)["pil_image"]})
                has_history = True
            except Exception:
                pass
        return refs, has_history

    def match_against_history(self, current_pil, references, has_history, wound_title, warnings):
        """
        Wound identity check (Stage 1).

        1. Compare with the PREVIOUS scan: consecutive visits look most alike.
        2. If that fails (e.g. the wound has healed and changed a lot), compare with
           EVERY earlier scan of this wound and accept the best match.
        Only when no earlier photo matches is the scan flagged as a possible different wound.
        """
        base = {"model": "ResNet50", "threshold_used": SIMILARITY_THRESHOLD, "scans_compared": 0,
                "compared_with": None, "reference_date": None}

        if not has_history:
            return {**base, "is_baseline": True, "is_same_wound": True, "similarity_score": None,
                    "confidence": None, "status": f"Day 1 baseline established for {wound_title}", "warning": None}

        if not references or self.wound_comparator is None:
            warnings.append("Could not compare with earlier photos of this wound, so the wound match was not checked.")
            return {**base, "is_baseline": False, "is_same_wound": None, "similarity_score": None,
                    "confidence": None, "status": "Comparison with earlier photos unavailable", "warning": None}

        if getattr(self.wound_comparator, "method", "resnet50") != "resnet50":
            warnings.append("ResNet-50 weights unavailable; wound matching used a basic colour comparison.")

        scores = self.wound_comparator.similarities(current_pil, [r["pil"] for r in references])
        previous_score = scores[0]
        if previous_score >= SIMILARITY_THRESHOLD:
            idx, compared_with = 0, "previous"
        else:
            idx = int(np.argmax(scores))
            compared_with = "earlier" if scores[idx] >= SIMILARITY_THRESHOLD else None

        best = scores[idx]
        result = {
            **base,
            "is_baseline": False,
            "scans_compared": len(scores),
            "previous_scan_score": round(previous_score, 3),
            "similarity_score": round(best, 3),
            "confidence": f"{best:.1%}",
            "compared_with": compared_with,
            "reference_date": references[idx]["date"],
        }
        if compared_with == "previous":
            return {**result, "is_same_wound": True, "warning": None,
                    "status": f"Matches the previous scan ({best:.1%})"}
        if compared_with == "earlier":
            when = f" from {references[idx]['date']}" if references[idx]["date"] else ""
            return {**result, "is_same_wound": True, "warning": None,
                    "status": f"Matches an earlier scan{when} ({best:.1%}); previous scan {previous_score:.1%}"}
        return {
            **result,
            "is_same_wound": False,
            "status": f"Wound mismatch (best {best:.1%})",
            "warning": (
                f"This photo doesn't match the previous photo of {wound_title} or any of its "
                f"{len(scores)} earlier photo{'s' if len(scores) != 1 else ''} (best match {best:.1%}, "
                f"threshold {SIMILARITY_THRESHOLD:.0%}). This may be a different wound."
            ),
        }

    def _check_similarity(self, current_pil, wound_profile, baseline_image_input, warnings):
        wound_title = (wound_profile.label or wound_profile.anatomical_location) if wound_profile else "this wound"
        references, has_history = self._history_references(wound_profile, baseline_image_input)
        return self.match_against_history(current_pil, references, has_history, wound_title, warnings)

    def detect_box(self, image_input):
        """
        Stage 2 preview: runs FUSegNet segmentation on the full image to return the
        auto-detected wound bounding box and normalized box for interactive clinician cropping.
        """
        pil_input = load_image_from_input(image_input)
        if pil_input is None:
            raise ValueError("A wound photo is required.")
        _check_photo(pil_input)

        self.load_models()
        preprocessed = preprocess_wound_image(pil_input)
        pil_img = preprocessed["pil_image"]
        img_w, img_h = pil_img.size

        card = detect_colour_card(pil_input)
        mask, bbox, area_ratio = self._segment(pil_img, exclude=_card_exclusion_mask(card, img_w, img_h))
        if bbox is None:
            # Default to centered 70% frame if no wound outline was detected
            pad_w = int(img_w * 0.15)
            pad_h = int(img_h * 0.15)
            bbox = (pad_w, pad_h, img_w - pad_w, img_h - pad_h)
            detected = False
        else:
            detected = True

        norm_box = [
            round(bbox[0] / max(img_w, 1), 4),
            round(bbox[1] / max(img_h, 1), 4),
            round(bbox[2] / max(img_w, 1), 4),
            round(bbox[3] / max(img_h, 1), 4),
        ]
        return {
            "bounding_box": list(bbox),
            "normalized_box": norm_box,
            "wound_detected": detected,
            "image_width": img_w,
            "image_height": img_h,
            "wound_area_ratio": round(area_ratio, 5) if area_ratio is not None else None,
            "colour_card": _card_summary(card),
        }

    # ------------------------------------------------------------------ main
    def run_inference(self, image_input, patient=None, wound_profile=None, baseline_image_input=None, crop_box=None):
        """
        Runs the pipeline. Raises ValueError when the input has no usable image or
        when no wound tissue can be found at all.
        Supports an optional crop_box (user-confirmed / adjusted bounding box).
        """
        pil_input = load_image_from_input(image_input)
        if pil_input is None:
            raise ValueError("A wound photo is required.")
        _check_photo(pil_input)

        self.load_models()
        preprocessed = preprocess_wound_image(pil_input)
        pil_img = preprocessed["pil_image"]
        img_w, img_h = pil_img.size
        warnings = []
        user_crop = _parse_crop_box(crop_box, img_w, img_h)
        if user_crop and ((user_crop[2] - user_crop[0]) < MIN_BOX_SIDE * img_w
                          or (user_crop[3] - user_crop[1]) < MIN_BOX_SIDE * img_h):
            raise ValueError("The box is too small. Drag its corners so the whole wound is inside it.")

        baseline_scan = self._baseline_scan(wound_profile)
        previous_scan = wound_profile.scans.order_by('-scan_date', '-id').first() if wound_profile is not None else None

        # Colour card, found on the FULL photo (it is outside the clinician's crop)
        card = detect_colour_card(pil_input)
        if not card["detected"]:
            warnings.append("Colour card not found in the photo, so the wound size could not be measured in cm². "
                            "Place the card next to the wound, flat and fully in frame.")
        distance_change, distance_warning = _distance_note(card, previous_scan)
        if distance_warning:
            warnings.append(distance_warning)

        # Stage 1: similarity
        similarity_data = self._check_similarity(pil_img, wound_profile, baseline_image_input, warnings)

        # Stage 2: segmentation
        mask, auto_bbox, raw_area_ratio = self._segment(pil_img, exclude=_card_exclusion_mask(card, img_w, img_h))
        if self.fusegnet_model is None:
            warnings.append("Wound segmentation model is not loaded; tissue was analysed on the whole photo.")
        elif mask is None:
            # The segmenter ran and found nothing: scoring the whole photo (or the whole
            # box) would grade background and skin as tissue, so ask for a better photo.
            raise ValueError("No wound was detected in this photo. Retake it closer to the wound, in good light, with the whole wound in frame.")

        # Clinician-confirmed crop box: only wound pixels inside it count, so hair,
        # background, clothing and the colour card outside the box are excluded.
        if user_crop:
            cx1, cy1, cx2, cy2 = user_crop
            active_bbox = user_crop
            if mask is not None:
                filtered_mask = np.zeros_like(mask)
                filtered_mask[cy1:cy2, cx1:cx2] = mask[cy1:cy2, cx1:cx2]
                if not filtered_mask.any():
                    raise ValueError("The box does not contain the wound. Widen the box so the whole wound edge is inside it.")
                # The wound the AI picks on the whole photo, if it lies (mostly) in the box: accepting
                # the AI's suggested box then gives exactly the AI's own result. Only when
                # the clinician boxed something else (e.g. a second wound) is the wound
                # picked again inside the box.
                selected = _select_wound_regions(mask, pil_img)
                inside_share = float(selected[cy1:cy2, cx1:cx2].sum()) / max(float(selected.sum()), 1.0)
                if inside_share >= 0.6:
                    bed = _wound_outline(selected, _brightness(pil_img))
                else:
                    bed = _wound_outline(_select_wound_regions(filtered_mask, pil_img), _brightness(pil_img))
                mask = np.zeros_like(bed)
                mask[cy1:cy2, cx1:cx2] = bed[cy1:cy2, cx1:cx2]
                # Size stays a share of the FULL photo, never of the crop: a tighter box
                # must not make the wound look bigger (false "Deteriorating").
                area_ratio = float(mask.sum()) / float(mask.size)
            else:
                area_ratio = None
        else:
            active_bbox = auto_bbox
            if mask is not None:
                mask = _wound_outline(_select_wound_regions(mask, pil_img), _brightness(pil_img))
                active_bbox = _bbox_of(mask) or auto_bbox
            area_ratio = float(mask.sum()) / float(mask.size) if mask is not None else raw_area_ratio

        if active_bbox:
            crop = pil_img.crop(active_bbox)
            crop_mask = mask[active_bbox[1]:active_bbox[3], active_bbox[0]:active_bbox[2]] if mask is not None else None
        else:
            crop, crop_mask = pil_img, None

        segmentation_data = {
            "model": "FUSegNet",
            "weights_loaded": self.fusegnet_model is not None,
            "wound_detected": mask is not None,
            "wound_area_ratio": round(area_ratio, 5) if area_ratio is not None else None,
            "bounding_box": list(active_bbox) if active_bbox else None,
            "auto_bounding_box": list(auto_bbox) if auto_bbox else None,
            "crop_box_applied": user_crop is not None,
        }
        # Real size: the wound's share of the photo times the area the photo covers,
        # which the card tells us. Independent of crop and of camera distance.
        area_cm2 = None
        if card["detected"] and area_ratio is not None:
            area_cm2 = round(area_ratio * card["photo_area_cm2"], 2)
        segmentation_data["wound_area_cm2"] = area_cm2

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
        # Colours are corrected with the card's white first, so lighting doesn't shift tissue classes.
        sev = analyze_tissue_and_severity(apply_white_balance(crop, card["white_balance_gains"]), region_mask=crop_mask)
        if not sev["tissue_detected"]:
            raise ValueError("No wound tissue could be identified in this photo. Retake it closer to the wound, in good light.")
        # Size-aware severity: a large wound is at least Moderate, however clean it looks.
        sev = apply_wound_size(sev, area_cm2)

        # Longitudinal healing: wound area vs the Day 1 scan of this same wound
        # Compare in cm2 when both scans have it; otherwise fall back to share of the
        # photo, which is only fair when both photos were taken at the same distance.
        baseline_cm2 = getattr(baseline_scan, 'wound_area_cm2', None) if baseline_scan else None
        if area_cm2 is not None and baseline_cm2:
            current_area, baseline_area, size_basis = area_cm2, baseline_cm2, "cm2"
        else:
            current_area = segmentation_data["wound_area_ratio"]
            baseline_area = getattr(baseline_scan, 'wound_area_ratio', None) if baseline_scan else None
            size_basis = "photo share"
            if baseline_scan is not None and not similarity_data.get("is_baseline") and current_area and baseline_area:
                warnings.append("Healing trend uses the wound's share of the photo because the Day 1 scan has no cm² measurement; "
                                "it is only reliable if both photos were taken from the same distance.")
        tissue_stats = {
            "granulation": sev["granulation_pct"],
            "slough": sev["slough_pct"],
            "necrotic": sev["necrosis_pct"],
            "epithelial": sev["epithelial_pct"],
        }
        # Tissue is only compared with a Day 1 scan graded by the same colour rules
        # (older scans have no new-skin value and under-counted slough).
        baseline_tissue = None
        if baseline_scan is not None and getattr(baseline_scan, 'epithelial_percent', None) is not None:
            baseline_tissue = {
                "granulation": baseline_scan.granulation_percent,
                "slough": baseline_scan.slough_percent,
                "necrotic": baseline_scan.necrotic_percent,
                "epithelial": baseline_scan.epithelial_percent,
            }
        healing_status = evaluate_healing_status(
            current_area=current_area,
            baseline_area=baseline_area,
            current_severity_score=sev["severity_score"],
            baseline_severity_score=getattr(baseline_scan, 'severity_score', None) if baseline_scan else None,
            is_baseline=bool(similarity_data.get("is_baseline")),
            current_tissue=tissue_stats,
            baseline_tissue=baseline_tissue,
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
                "tissue_stats": tissue_stats,
                "severity_size_adjusted": sev["size_adjusted"],
                "tissue_method": "HSV colour analysis" + (" within wound mask" if crop_mask is not None else " on whole photo")
                                 + (", colour-corrected with the card" if card["white_balance_gains"] else ""),
                "colour_card": {**_card_summary(card), "distance_vs_previous": distance_change},
                "size_basis": size_basis,
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
