"""
MODEL 3: VGG16 wound type, run on the wound area the app crops (not the whole photo).

Usage:  python test_model_3_vgg16.py [photo.jpg]
"""

import _bench

_bench.setup()
from ai_models import pipeline_loader as pl  # noqa: E402
from ai_models.colour_card import detect_colour_card  # noqa: E402


def main():
    path = _bench.arg(1, _bench.DEFAULT_IMAGE)
    _bench.header("MODEL 3: VGG16 wound type (app pipeline)")
    print(f"  Photo: {path}")
    m = _bench.manager()
    if m.vgg_classifier is None:
        print("  VGG16 classifier is not loaded.")
        return 1

    original, img = _bench.load(path)
    exclude = pl._card_exclusion_mask(detect_colour_card(original), *img.size)
    _, bbox, _ = m._segment(img, exclude=exclude)
    crop = img.crop(bbox) if bbox else img
    pred, conf, probs = m._classify(crop)

    print(f"\n  Classified on:   {'the AI wound box ' + str(list(bbox)) if bbox else 'the whole photo (no wound outline found)'}")
    print(f"  Predicted type:  {pl.WOUND_CLASS_LABELS[pred]}")
    print(f"  Confidence:      {conf:.1%}"
          + ("   (LOW: the app asks the clinician to confirm)" if conf < pl.LOW_CLASSIFIER_CONFIDENCE else ""))
    print("  All classes:")
    for i, c in enumerate(pl.WOUND_CLASSES):
        bar = "#" * int(round(float(probs[i]) * 30))
        print(f"    {pl.WOUND_CLASS_LABELS[c]:<16} {float(probs[i]):6.1%}  {bar}")
    print("\n  Note: in the app the type is set by a wound's FIRST scan and then kept.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
