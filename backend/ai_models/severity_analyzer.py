"""
Severity and Healing Status Analysis Module
Extracted and adapted from research model: 'AI for Severity & Healing Status'

Uses HSV color space thresholding and morphological processing to compute:
- Tissue breakdown percentages (Granulation / Slough / Necrosis)
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

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # Red masks (Granulation tissue)
    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([160, 50, 50])
    upper_red2 = np.array([180, 255, 255])

    # Yellow mask (Slough / fibrin tissue)
    lower_yellow = np.array([20, 50, 50])
    upper_yellow = np.array([40, 255, 255])

    # Black mask (Necrotic / eschar tissue)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 80])

    mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    mask_black = cv2.inRange(hsv, lower_black, upper_black)

    combined_mask = mask_red | mask_yellow | mask_black
    if region_mask is not None:
        region = (np.asarray(region_mask) > 0).astype(np.uint8) * 255
        if region.shape[:2] != combined_mask.shape[:2]:
            region = cv2.resize(region, (combined_mask.shape[1], combined_mask.shape[0]), interpolation=cv2.INTER_NEAREST)
        combined_mask = cv2.bitwise_and(combined_mask, region)

    # Morphological noise removal
    kernel = np.ones((5, 5), np.uint8)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)

    mask_red = cv2.bitwise_and(mask_red, combined_mask)
    mask_yellow = cv2.bitwise_and(mask_yellow, combined_mask)
    mask_black = cv2.bitwise_and(mask_black, combined_mask)

    wound_pixels = int(np.count_nonzero(combined_mask))
    total_pixels = img_bgr.shape[0] * img_bgr.shape[1]
    wound_ratio = float(wound_pixels / total_pixels) if total_pixels > 0 else 0.0

    red_pixels = int(np.count_nonzero(mask_red))
    yellow_pixels = int(np.count_nonzero(mask_yellow))
    black_pixels = int(np.count_nonzero(mask_black))

    if wound_pixels > 0:
        granulation_pct = round(float((red_pixels / wound_pixels) * 100), 1)
        slough_pct = round(float((yellow_pixels / wound_pixels) * 100), 1)
        necrosis_pct = round(float((black_pixels / wound_pixels) * 100), 1)
        # Ensure percentages sum to 100 or remain balanced
        total_p = granulation_pct + slough_pct + necrosis_pct
        if total_p > 0 and abs(total_p - 100.0) > 1.0:
            scale = 100.0 / total_p
            granulation_pct = round(granulation_pct * scale, 1)
            slough_pct = round(slough_pct * scale, 1)
            necrosis_pct = round(100.0 - granulation_pct - slough_pct, 1)
    else:
        # Nothing tissue-coloured was found: report that instead of inventing a breakdown
        granulation_pct = slough_pct = necrosis_pct = 0.0

    # Severity level logic from the research model
    # CRITICAL: necrosis >= 50
    # SEVERE: necrosis >= 25 or slough >= 60
    # MODERATE: necrosis >= 10 or slough >= 30
    # MILD: granulation >= 60 and necrosis < 10
    # LOW / MINIMAL: otherwise
    if necrosis_pct >= 50:
        raw_level = "CRITICAL"
        score = 5
        label = "Critical"
    elif necrosis_pct >= 25 or slough_pct >= 60:
        raw_level = "SEVERE"
        score = 4
        label = "Very Severe"
    elif necrosis_pct >= 10 or slough_pct >= 30:
        raw_level = "MODERATE"
        score = 3
        label = "Moderate"
    elif granulation_pct >= 60 and necrosis_pct < 10:
        raw_level = "MILD"
        score = 2
        label = "Mild"
    else:
        raw_level = "LOW"
        score = 1
        label = "Minimal"

    recommendations = {
        1: "Favorable re-epithelialization observed. Continue protective dressing and weekly check-up.",
        2: "Healthy pink granulation tissue dominant. Clean gently with sterile 0.9% saline and apply non-adherent dressing.",
        3: "Moderate slough/exudate noted. Clean wound bed with sterile saline. Consider antimicrobial foam and re-evaluate in 48h.",
        4: "Elevated slough and periwound maceration detected. Prompt sharp debridement and pressure offloading recommended.",
        5: "Critical tissue necrosis and eschar present. Urgent surgical consult and systemic antibiotic review required.",
    }

    return {
        "tissue_detected": wound_pixels > 0,
        "wound_pixels": wound_pixels,
        "wound_ratio": round(wound_ratio, 4),
        "granulation_pct": granulation_pct,
        "slough_pct": slough_pct,
        "necrosis_pct": necrosis_pct,
        "raw_severity_level": raw_level,
        "severity_level": label,
        "severity_score": score,
        "recommendation": recommendations.get(score, recommendations[3]),
    }


def evaluate_healing_status(current_area=None, baseline_area=None, current_severity_score=3,
                            baseline_severity_score=None, is_baseline=False):
    """
    Longitudinal healing status for one wound, relative to its Day 1 scan.

    Areas are wound-area ratios (fraction of the photo covered by the wound mask),
    so they are comparable between photos taken at a similar distance.
    - First scan of a wound            -> "Baseline"
    - Area change < -5%                -> "Improving"
    - Area change > +5%                -> "Deteriorating"
    - Otherwise / no area available    -> decided by severity change vs Day 1
    """
    if is_baseline:
        return "Baseline"

    if current_area and baseline_area and baseline_area > 0:
        area_change = (current_area - baseline_area) / baseline_area
        if area_change < -0.05:
            return "Improving"
        if area_change > 0.05:
            return "Deteriorating"

    if baseline_severity_score is not None:
        if current_severity_score < baseline_severity_score:
            return "Improving"
        if current_severity_score > baseline_severity_score:
            return "Deteriorating"
    return "Stable"
