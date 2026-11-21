"""
Severity and Healing Status Analysis Module
Extracted and adapted from research model: 'AI for Severity & Healing Status'

Uses HSV color space thresholding and morphological processing to compute:
- Tissue breakdown percentages (Granulation / Slough / Necrosis / New skin)
- Severity Level (CRITICAL, SEVERE, MODERATE, MILD, LOW)
- Severity Score (1 - 5 numeric)
- Longitudinal Healing Status (HEALING, NOT HEALING, STALLED / Improving, Deteriorating, Stable)
"""

import cv2
import numpy as np
from PIL import Image


def analyze_tissue_and_severity(image_input, region_mask=None):
    """
    Analyzes a wound image (PIL Image, OpenCV numpy array BGR, or file path/buffer)
    using HSV color thresholding to segment granulation, slough, and necrotic tissues.
    
    region_mask: optional uint8 array (same HxW as the image, non-zero = wound).
    When given, only pixels inside the wound are classified, so background,
    shadows and surrounding skin are not counted as tissue.

    Returns:
        dict: {
            "tissue_detected": bool (False if no tissue-coloured pixels were found),
            "wound_pixels": int,
            "wound_ratio": float,
            "granulation_pct": float,
            "slough_pct": float,
            "necrosis_pct": float,
            "severity_level": str ("Critical", "Severe", "Moderate", "Mild", "Minimal"),
            "severity_score": int (1 to 10),
            "recommendation": str
        }
    """
    if isinstance(image_input, str):
        img_bgr = cv2.imread(image_input)
        if img_bgr is None:
            raise ValueError(f"Could not load image from path: {image_input}")
    elif isinstance(image_input, Image.Image):
        # Convert PIL (RGB) to OpenCV (BGR)
        img_rgb = np.array(image_input)
        if len(img_rgb.shape) == 2:
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_GRAY2BGR)
        elif img_rgb.shape[2] == 4:
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGBA2BGR)
        else:
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, np.ndarray):
        img_bgr = image_input
    else:
        raise ValueError(f"Unsupported image format: {type(image_input)}")

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.int32)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    # Tissue colour rules (OpenCV hue 0..179), measured on white-balanced clinic photos:
    #   granulation  saturated red             hue 0-9 / 165+, sat >= 120  (beds: hue 1-3, sat 145-200),
    #                or dusky red in shade     sat 50-119 with value < 150 (dull venous ulcer beds)
    #   new skin     pale pink, low saturation hue 0-10 / 160+, sat 20-119, bright
    #   slough       cream / yellow fibrin     hue 10-35, sat >= 45, bright (measured: hue 12-17, sat 85-115)
    #   necrotic     black / very dark eschar  value <= 60 (dark red periwound sits ~85, kept out)
    # Each pixel gets exactly one class, in this order.
    red_hue = (hue <= 9) | (hue >= 165)
    necrotic = val <= 60
    # bright saturated red, or duller / dusky red in shade (poorly perfused granulation)
    granulation = ~necrotic & red_hue & ((sat >= 120) | ((sat >= 50) & (val < 150)))
    epithelial = ~necrotic & ~granulation & ((hue <= 10) | (hue >= 160)) & (sat >= 20) & (sat < 120) & (val >= 150)
    slough = ~necrotic & ~granulation & ~epithelial & (hue >= 10) & (hue <= 35) & (sat >= 45) & (val >= 120)

    region = np.ones(hue.shape, bool)
    if region_mask is not None:
        region = np.asarray(region_mask) > 0
        if region.shape[:2] != hue.shape[:2]:
            region = cv2.resize(region.astype(np.uint8), (hue.shape[1], hue.shape[0]), interpolation=cv2.INTER_NEAREST) > 0

    combined = ((granulation | slough | necrotic | epithelial) & region).astype(np.uint8)
    # Morphological noise removal (single stray pixels, specular highlights)
    kernel = np.ones((5, 5), np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel) & region.astype(np.uint8)
    keep = combined > 0

    counts = {
        "granulation": int(np.count_nonzero(granulation & keep)),
        "slough": int(np.count_nonzero(slough & keep)),
        "necrotic": int(np.count_nonzero(necrotic & keep)),
        "epithelial": int(np.count_nonzero(epithelial & keep)),
    }
    wound_pixels = sum(counts.values())
    total_pixels = img_bgr.shape[0] * img_bgr.shape[1]
    wound_ratio = float(wound_pixels / total_pixels) if total_pixels > 0 else 0.0

    if wound_pixels > 0:
        pcts = {k: round(100.0 * v / wound_pixels, 1) for k, v in counts.items()}
    else:
        # Nothing tissue-coloured was found: report that instead of inventing a breakdown
        pcts = {k: 0.0 for k in counts}
    granulation_pct, slough_pct = pcts["granulation"], pcts["slough"]
    necrosis_pct, epithelial_pct = pcts["necrotic"], pcts["epithelial"]

    score, raw_level, exact = tissue_severity(granulation_pct, slough_pct, necrosis_pct, epithelial_pct)
    return {
        "tissue_detected": wound_pixels > 0,
        "wound_pixels": wound_pixels,
        "wound_ratio": round(wound_ratio, 4),
        "granulation_pct": granulation_pct,
        "slough_pct": slough_pct,
        "necrosis_pct": necrosis_pct,
        "epithelial_pct": epithelial_pct,
        "raw_severity_level": raw_level,
        "severity_level": severity_label(score),
        "severity_score": score,
        "severity_exact": exact,
        "recommendation": RECOMMENDATIONS[severity_grade(score)],
    }


# Severity is scored 1-10. The labels keep the meaning of the former 1-5 grades,
# two points per grade: 1-2 Minimal, 3-4 Mild, 5-6 Moderate, 7-8 Very Severe, 9-10 Critical.
SEVERITY_MAX = 10
SEVERITY_LABELS = {1: "Minimal", 2: "Mild", 3: "Moderate", 4: "Very Severe", 5: "Critical"}   # by grade
RAW_LEVELS = {1: "LOW", 2: "MILD", 3: "MODERATE", 4: "SEVERE", 5: "CRITICAL"}

RECOMMENDATIONS = {   # by grade
    1: "Favorable re-epithelialization observed. Continue protective dressing and weekly check-up.",
    2: "Healthy pink granulation tissue dominant. Clean gently with sterile 0.9% saline and apply non-adherent dressing.",
    3: "Moderate slough/exudate noted. Clean wound bed with sterile saline. Consider antimicrobial foam and re-evaluate in 48h.",
    4: "Elevated slough and periwound maceration detected. Prompt sharp debridement and pressure offloading recommended.",
    5: "Critical tissue necrosis and eschar present. Urgent surgical consult and systemic antibiotic review required.",
}

# Each driver maps to a 1-10 score along these points (in between: straight line), so the
# score keeps moving as the wound changes instead of jumping between five steps. The
# anchor points reproduce the former grade thresholds (e.g. necrosis 10% -> Moderate,
# 25% -> Very Severe, 50% -> Critical; slough 30% -> Moderate, 60% -> Very Severe).
NECROSIS_CURVE = ([0, 5, 10, 25, 50, 75], [1, 3, 5, 7, 9, 10])        # % of wound
SLOUGH_CURVE = ([0, 10, 30, 60, 90], [1, 3, 5, 7, 8])                  # % of wound
OPEN_CURVE = ([0, 40, 60, 100], [1, 2, 3, 4])                          # % not covered by new skin
SIZE_CURVE = ([0, 2, 10, 25, 100], [1, 2, 3, 5, 6])                     # cm2 (colour card needed)

# A wound this large is at least "Moderate" (5), however clean its bed looks.
LARGE_WOUND_CM2 = 25.0


def _curve(value, curve):
    return float(np.interp(float(value or 0.0), curve[0], curve[1]))


def _whole(score):
    """Exact score -> displayed whole number 1-10 (halves round up)."""
    return int(min(SEVERITY_MAX, max(1, np.floor(score + 0.5))))


def severity_grade(score):
    """1-10 score -> grade 1-5 (Minimal .. Critical)."""
    return (int(score) + 1) // 2


def severity_label(score):
    return SEVERITY_LABELS[severity_grade(score)]


def tissue_severity(granulation_pct, slough_pct, necrosis_pct, epithelial_pct=0.0):
    """
    Severity from the tissue mix: (score 1-10, raw level, exact score).
    The worst driver decides: necrosis, slough, or simply how much of the wound is
    still open (not yet covered by new skin).
    """
    open_pct = max(0.0, 100.0 - float(epithelial_pct or 0.0))
    exact = max(_curve(necrosis_pct, NECROSIS_CURVE), _curve(slough_pct, SLOUGH_CURVE), _curve(open_pct, OPEN_CURVE))
    score = _whole(exact)
    return score, RAW_LEVELS[severity_grade(score)], round(exact, 2)


def apply_wound_size(sev, area_cm2):
    """
    Size-aware severity: the tissue mix alone grades a 90 cm2 clean wound the same as a
    2 cm2 one, so the size (cm2, from the colour card) is a driver too: 25 cm2 is at
    least Moderate. Unknown size (no colour card) leaves the tissue score unchanged.
    """
    out = dict(sev)
    out["area_cm2"] = area_cm2
    out["size_adjusted"] = False
    if area_cm2 is None:
        return out
    size_exact = _curve(area_cm2, SIZE_CURVE)
    if size_exact > out.get("severity_exact", out["severity_score"]):
        score = _whole(size_exact)
        out["severity_exact"] = round(size_exact, 2)
        if score > sev["severity_score"]:
            out["severity_score"] = score
            out["severity_level"] = severity_label(score)
            out["raw_severity_level"] = RAW_LEVELS[severity_grade(score)]
            out["size_adjusted"] = True
            if area_cm2 >= LARGE_WOUND_CM2:
                out["recommendation"] = ("Large wound with a mostly clean bed. "
                                         + RECOMMENDATIONS[severity_grade(sev["severity_score"])]
                                         + " Monitor size weekly; consider referral if it is not shrinking.")
            else:
                out["recommendation"] = RECOMMENDATIONS[severity_grade(score)]
    return out


# A tissue change counts only when it is clear, so readings that hover around a
# threshold between visits do not flip the trend.
NECROSIS_STEP = 5.0     # percentage points
SLOUGH_STEP = 15.0      # percentage points, and slough must reach SLOUGH_MIN
SLOUGH_MIN = 20.0
SHRINK_OUTWEIGHS_SLOUGH = -0.20   # a wound that shrank this much is improving despite more slough
SEVERITY_STEP = 2                 # points on the 1-10 scale (one grade); smaller changes are noise


def tissue_change(current, reference):
    """(necrosis_worse, slough_worse, tissue_better) between two tissue mixes."""
    if not current or not reference:
        return False, False, False
    dn = (current.get("necrotic") or 0) - (reference.get("necrotic") or 0)
    ds = (current.get("slough") or 0) - (reference.get("slough") or 0)
    necrosis_worse = dn >= NECROSIS_STEP and (current.get("necrotic") or 0) >= NECROSIS_STEP
    slough_worse = ds >= SLOUGH_STEP and (current.get("slough") or 0) >= SLOUGH_MIN
    better = (dn <= -NECROSIS_STEP) or (ds <= -SLOUGH_STEP and (reference.get("slough") or 0) >= SLOUGH_MIN)
    return necrosis_worse, slough_worse, better and not (necrosis_worse or slough_worse)


def evaluate_healing_status(current_area=None, baseline_area=None, current_severity_score=3,
                            baseline_severity_score=None, is_baseline=False,
                            current_tissue=None, baseline_tissue=None):
    """
    Healing status of a wound compared with an earlier scan of it (the app passes the
    previous scan; "baseline_*" are that scan's values).

    Areas are cm2 when both scans have them (otherwise share of the photo, which is only
    comparable at the same camera distance). Tissue dicts hold granulation / slough /
    necrotic / epithelial percentages.
    - First scan of a wound                          -> "Baseline"
    - Necrosis appeared / grew (+5 points)           -> "Deteriorating", even if smaller
    - Severity score went up 2+ points (1-10 scale)  -> "Deteriorating"
    - Slough grew (+15 points, to 20%+) unless the wound shrank 20%+  -> "Deteriorating"
    - Area change > +5%                              -> "Deteriorating"
    - Area change < -5%                              -> "Improving"
    - Otherwise: tissue or severity got better       -> "Improving", else "Stable"
    """
    if is_baseline:
        return "Baseline"

    area_change = None
    if current_area and baseline_area and baseline_area > 0:
        area_change = (current_area - baseline_area) / baseline_area

    necrosis_worse, slough_worse, tissue_better = tissue_change(current_tissue, baseline_tissue)
    if necrosis_worse:
        return "Deteriorating"
    if baseline_severity_score is not None and current_severity_score - baseline_severity_score >= SEVERITY_STEP:
        return "Deteriorating"
    if slough_worse and (area_change is None or area_change > SHRINK_OUTWEIGHS_SLOUGH):
        return "Deteriorating"

    if area_change is not None:
        if area_change > 0.05:
            return "Deteriorating"
        if area_change < -0.05:
            return "Improving"

    if tissue_better:
        return "Improving"
    if baseline_severity_score is not None and baseline_severity_score - current_severity_score >= SEVERITY_STEP:
        return "Improving"
    return "Stable"
