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
            "severity_score": int (1 to 5),
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

    score, raw_level = tissue_severity(granulation_pct, slough_pct, necrosis_pct, epithelial_pct)
    return {
        "tissue_detected": wound_pixels > 0,
        "wound_pixels": wound_pixels,
        "wound_ratio": round(wound_ratio, 4),
        "granulation_pct": granulation_pct,
        "slough_pct": slough_pct,
        "necrosis_pct": necrosis_pct,
        "epithelial_pct": epithelial_pct,
        "raw_severity_level": raw_level,
        "severity_level": SEVERITY_LABELS[score],
        "severity_score": score,
        "recommendation": RECOMMENDATIONS[score],
    }


SEVERITY_LABELS = {1: "Minimal", 2: "Mild", 3: "Moderate", 4: "Very Severe", 5: "Critical"}

RECOMMENDATIONS = {
    1: "Favorable re-epithelialization observed. Continue protective dressing and weekly check-up.",
    2: "Healthy pink granulation tissue dominant. Clean gently with sterile 0.9% saline and apply non-adherent dressing.",
    3: "Moderate slough/exudate noted. Clean wound bed with sterile saline. Consider antimicrobial foam and re-evaluate in 48h.",
    4: "Elevated slough and periwound maceration detected. Prompt sharp debridement and pressure offloading recommended.",
    5: "Critical tissue necrosis and eschar present. Urgent surgical consult and systemic antibiotic review required.",
}

# A wound this large is at least "Moderate", however clean its bed looks.
LARGE_WOUND_CM2 = 25.0


def tissue_severity(granulation_pct, slough_pct, necrosis_pct, epithelial_pct=0.0):
    """Severity 1-5 from the tissue mix (research model thresholds + a healing class)."""
    if necrosis_pct >= 50:
        return 5, "CRITICAL"
    if necrosis_pct >= 25 or slough_pct >= 60:
        return 4, "SEVERE"
    if necrosis_pct >= 10 or slough_pct >= 30:
        return 3, "MODERATE"
    if epithelial_pct >= 60 and slough_pct < 10 and necrosis_pct < 5:
        return 1, "LOW"  # mostly new skin: closing
    if granulation_pct + epithelial_pct >= 60 and necrosis_pct < 10:
        return 2, "MILD"
    return 1, "LOW"


def apply_wound_size(sev, area_cm2):
    """
    Size-aware severity: the tissue mix alone grades a 90 cm2 clean wound the same as a
    2 cm2 one. A large wound (>= LARGE_WOUND_CM2) is raised to at least Moderate.
    Unknown size (no colour card) leaves the tissue grade unchanged.
    """
    out = dict(sev)
    out["area_cm2"] = area_cm2
    out["size_adjusted"] = False
    if area_cm2 is not None and area_cm2 >= LARGE_WOUND_CM2 and sev["severity_score"] < 3:
        out["severity_score"] = 3
        out["severity_level"] = SEVERITY_LABELS[3]
        out["size_adjusted"] = True
        out["recommendation"] = ("Large wound (%.0f cm\u00b2) with a mostly clean bed. " % area_cm2
                                 + RECOMMENDATIONS[sev["severity_score"]]
                                 + " Monitor size weekly; consider referral if it is not shrinking.")
    return out


def worst_tissue(tissue):
    """
    Worst tissue present, PUSH-style: 4 necrotic, 3 slough, 2 granulation, 1 new skin.
    A class counts once it covers a meaningful part of the wound.
    """
    if not tissue:
        return None
    if (tissue.get("necrotic") or 0) >= 5:
        return 4
    if (tissue.get("slough") or 0) >= 10:
        return 3
    if (tissue.get("granulation") or 0) >= 20:
        return 2
    return 1


def evaluate_healing_status(current_area=None, baseline_area=None, current_severity_score=3,
                            baseline_severity_score=None, is_baseline=False,
                            current_tissue=None, baseline_tissue=None):
    """
    Longitudinal healing status for one wound, relative to its Day 1 scan.

    Areas are cm2 when both scans have them (otherwise share of the photo, which is only
    comparable at the same camera distance). Tissue dicts hold granulation / slough /
    necrotic / epithelial percentages.
    - First scan of a wound                       -> "Baseline"
    - Worse tissue appears (e.g. new necrosis)    -> "Deteriorating", even if smaller
    - Area change > +5%                           -> "Deteriorating"
    - Area change < -5%                           -> "Improving"
    - Otherwise / no area: tissue got better      -> "Improving"
    - Otherwise / no area: severity change vs Day 1, else "Stable"
    """
    if is_baseline:
        return "Baseline"

    cur_t, base_t = worst_tissue(current_tissue), worst_tissue(baseline_tissue)
    if cur_t is not None and base_t is not None and cur_t > base_t:
        return "Deteriorating"

    if current_area and baseline_area and baseline_area > 0:
        area_change = (current_area - baseline_area) / baseline_area
        if area_change > 0.05:
            return "Deteriorating"
        if area_change < -0.05:
            return "Improving"

    if cur_t is not None and base_t is not None and cur_t < base_t:
        return "Improving"

    if baseline_severity_score is not None:
        if current_severity_score < baseline_severity_score:
            return "Improving"
        if current_severity_score > baseline_severity_score:
            return "Deteriorating"
    return "Stable"
