"""
Colour reference card detection.

The card used in clinic is a white card with a 3x3 grid of colour patches:

    blue   cyan    black
    green  yellow  dark grey
    red    magenta light grey

The 2x2 block of blue / cyan / green / yellow patches is used as the reference.
Those four colours never occur in skin or wound tissue (unlike the red and magenta
patches, which a wound can resemble), so the block can be found reliably anywhere in
the photo, at any rotation. From it we get:

- scale: the block's real size is known, so wound pixels can be converted to cm^2;
- distance: the block's share of the photo says how close the camera was;
- white balance: the white card around the block should be neutral grey/white.

Everything here runs on the FULL photo, never on the clinician's crop, because the
card is (by design) outside the crop.
"""

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - cv2 is installed with the AI stack
    cv2 = None

# Side length of ONE colour patch on the printed card, in cm. The reference block is
# 2x2 patches. Measure the card in use and set COLOUR_CARD_PATCH_CM in settings.
DEFAULT_PATCH_CM = 1.0

DETECT_MAX_SIDE = 1600  # detection resolution (long side), keeps it fast on 20 MP photos

# OpenCV hue is 0..179. Saturated, reasonably bright printed patches.
_HUE_RANGES = {
    "yellow": (20, 35),
    "green": (40, 85),
    "cyan": (86, 102),
    "blue": (103, 130),
}
_MIN_SAT = 110
_MIN_VAL = 60

# White-balance gains are clamped so a mis-detected "white" can't wreck the colours.
_MAX_GAIN = 1.35
_MIN_GAIN = 0.75


def patch_size_cm():
    try:
        from django.conf import settings
        return float(getattr(settings, "COLOUR_CARD_PATCH_CM", DEFAULT_PATCH_CM))
    except Exception:
        return DEFAULT_PATCH_CM


def _components(mask, min_area):
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    out = []
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_area:
            continue
        w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        fill = area / float(max(w * h, 1))
        # printed patches are compact blobs, not thin strands (hair, fabric folds)
        if fill < 0.35 or max(w, h) > 4 * max(min(w, h), 1):
            continue
        out.append({"label": i, "area": float(area), "centroid": centroids[i], "size": float(np.sqrt(area))})
    return labels, out


def _find_block(hsv, min_area):
    """Returns (block_mask uint8, block_area_px) for the best blue/cyan/green/yellow 2x2 block."""
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    strong = (sat >= _MIN_SAT) & (val >= _MIN_VAL)
    found = {}
    for name, (lo, hi) in _HUE_RANGES.items():
        m = (strong & (hue >= lo) & (hue <= hi)).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        found[name] = _components(m, min_area)

    best = None
    # Try every blue patch as an anchor and pick the nearest patch of each other colour.
    blue_labels, blues = found["blue"]
    for b in blues:
        chosen = {"blue": (blue_labels, b)}
        ok = True
        for name in ("cyan", "green", "yellow"):
            labels, comps = found[name]
            cands = [c for c in comps if 0.4 < c["area"] / b["area"] < 2.5]
            if not cands:
                ok = False
                break
            c = min(cands, key=lambda c: np.linalg.norm(c["centroid"] - b["centroid"]))
            # neighbouring patches: centre distance about one or sqrt(2) patch sides
            if np.linalg.norm(c["centroid"] - b["centroid"]) > 2.2 * b["size"]:
                ok = False
                break
            chosen[name] = (labels, c)
        if not ok:
            continue
        # yellow is diagonal from blue: it must be the furthest of the three
        d = {n: np.linalg.norm(chosen[n][1]["centroid"] - b["centroid"]) for n in ("cyan", "green", "yellow")}
        if d["yellow"] < max(d["cyan"], d["green"]):
            continue
        total = sum(c["area"] for _, c in chosen.values())
        if best is None or total > best[1]:
            best = (chosen, total)

    if best is None:
        return None, None
    chosen, _ = best
    union = np.zeros(hsv.shape[:2], np.uint8)
    for labels, c in chosen.values():
        union[labels == c["label"]] = 1
    # The four patches touch, so the convex hull of their union is the 2x2 block
    # (this also recovers pixels lost to blur at patch edges).
    pts = cv2.findNonZero(union)
    hull = cv2.convexHull(pts)
    block = np.zeros_like(union)
    cv2.fillConvexPoly(block, hull, 1)
    return block, float(cv2.contourArea(hull))


def _white_balance(rgb, hsv, block_mask, block_area):
    """Per-channel gains that make the white card around the block neutral, or None."""
    side = max(int(np.sqrt(block_area)), 4)
    ring = cv2.dilate(block_mask, np.ones((side, side), np.uint8)) - cv2.dilate(block_mask, np.ones((max(side // 3, 3),) * 2, np.uint8))
    sat, val = hsv[..., 1], hsv[..., 2]
    # card white: bright and nearly colourless. The black/grey patches and skin are excluded.
    white = (ring > 0) & (sat < 60) & (val > 140)
    if white.sum() < 0.05 * block_area:
        return None, None
    ref = np.median(rgb[white].astype(np.float32), axis=0)
    gains = np.clip(ref.mean() / np.maximum(ref, 1.0), _MIN_GAIN, _MAX_GAIN)
    return [round(float(g), 3) for g in gains], [round(float(v), 1) for v in ref]


def detect_colour_card(pil_image):
    """
    Finds the colour card in the FULL photo (upright, original aspect ratio).

    Returns a dict:
      detected            bool
      block_area_ratio    share of the photo covered by the 2x2 reference block
                          (bigger = camera closer); None if not detected
      pixels_per_cm       on the detection image; None if not detected
      photo_area_cm2      real area the whole photo covers; None if not detected
      white_balance_gains [r, g, b] or None
    """
    result = {"detected": False, "block_area_ratio": None, "pixels_per_cm": None,
              "photo_area_cm2": None, "white_balance_gains": None, "card_white_rgb": None}
    if cv2 is None or pil_image is None:
        return result

    img = pil_image.convert("RGB")
    scale = min(1.0, DETECT_MAX_SIDE / float(max(img.size)))
    if scale < 1.0:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))))
    rgb = np.asarray(img)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    photo_px = float(rgb.shape[0] * rgb.shape[1])

    # a patch must be at least ~0.02% of the photo (card very far away) to be measured
    block, block_area = _find_block(hsv, min_area=max(20, int(photo_px * 0.0002)))
    if block is None or block_area <= 0:
        return result

    block_cm2 = (2 * patch_size_cm()) ** 2
    px_per_cm = float(np.sqrt(block_area / block_cm2))
    gains, white_rgb = _white_balance(rgb, hsv, block, block_area)
    result.update({
        "detected": True,
        "block_area_ratio": round(block_area / photo_px, 6),
        "pixels_per_cm": round(px_per_cm, 3),
        "photo_area_cm2": round(photo_px / (px_per_cm ** 2), 2),
        "white_balance_gains": gains,
        "card_white_rgb": white_rgb,
    })
    return result


def apply_white_balance(pil_image, gains):
    """Returns a white-balanced copy of the image (or the image itself if no gains)."""
    if not gains:
        return pil_image
    from PIL import Image
    arr = np.asarray(pil_image.convert("RGB")).astype(np.float32) * np.asarray(gains, np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
