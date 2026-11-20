"""
MODEL 2: FUSegNet wound outline, exactly as the app finds it:
colour card removed from the outline -> wound region picked (hair / edge strips dropped)
-> gaps closed and filled (slough inside the wound counts) -> AI box.

Usage:  python test_model_2_fusegnet.py [photo.jpg]
Saves output_segmentation_overlay.png (outline green, AI box yellow, card zone blue)
and output_segmentation_mask.png next to this script.
"""

import os

import _bench

_bench.setup()
import cv2  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402
from ai_models import pipeline_loader as pl  # noqa: E402
from ai_models.colour_card import detect_colour_card  # noqa: E402


def main():
    path = _bench.arg(1, _bench.DEFAULT_IMAGE)
    _bench.header("MODEL 2: FUSegNet wound outline (app pipeline)")
    print(f"  Photo: {path}")
    m = _bench.manager()
    if m.fusegnet_model is None:
        print("  FUSegNet is not loaded.")
        return 1

    original, img = _bench.load(path)
    w, h = img.size
    card = detect_colour_card(original)
    exclude = pl._card_exclusion_mask(card, w, h)

    # raw model confidence, to show the model is actually discriminating
    x = (np.asarray(img).astype(np.float32) / 255.0 - pl.IMAGENET_MEAN) / pl.IMAGENET_STD
    with torch.no_grad():
        out = m.fusegnet_model(torch.from_numpy(x).permute(2, 0, 1).unsqueeze(0).float().to(pl.DEVICE))
        out = out[0] if isinstance(out, (list, tuple)) else out
        prob = torch.sigmoid(out[:, 0]).cpu().numpy()[0]

    raw, bbox, raw_ratio = m._segment(img, exclude=exclude)
    if raw is None:
        print(f"\n  No wound found (only {raw_ratio:.2%} of the photo above threshold).")
        return 0
    bed = pl._wound_bed(pl._select_wound_regions(raw))
    bed_ratio = float(bed.mean())

    print("\n--- Results ---")
    print(f"  Model confidence:   min {prob.min():.2f}, max {prob.max():.2f}, "
          f"{(prob > pl.SEG_THRESHOLD).mean():.1%} of photo above {pl.SEG_THRESHOLD}")
    print(f"  Colour card:        {'found' if card['detected'] else 'not found'}"
          + (", removed from outline" if exclude is not None else ""))
    print(f"  Everything flagged: {raw.mean():.1%} of photo")
    print(f"  Wound (selected):   {bed_ratio:.1%} of photo")
    if card["detected"]:
        print(f"  Wound size:         {bed_ratio * card['photo_area_cm2']:.1f} cm²")
    print(f"  AI box [x1,y1,x2,y2] on {w}x{h}: {list(bbox) if bbox else None}")

    vis = np.asarray(img).copy()
    if exclude is not None:
        vis[exclude > 0] = (0.6 * vis[exclude > 0] + 0.4 * np.array([60, 120, 255])).astype(np.uint8)
    contours, _ = cv2.findContours(bed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(vis, contours, -1, (0, 255, 0), 2)
    if bbox:
        cv2.rectangle(vis, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (255, 220, 0), 2)
    vis = Image.fromarray(vis).resize(original.size)
    overlay_path = os.path.join(_bench.BENCH_DIR, "output_segmentation_overlay.png")
    mask_path = os.path.join(_bench.BENCH_DIR, "output_segmentation_mask.png")
    vis.save(overlay_path)
    Image.fromarray(bed * 255).resize(original.size, Image.NEAREST).save(mask_path)
    print(f"  Overlay saved to:   {overlay_path}")
    print(f"  Mask saved to:      {mask_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
