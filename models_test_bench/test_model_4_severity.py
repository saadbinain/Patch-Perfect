"""
MODEL 4: tissue, severity and healing trend, through the app's full analysis
(the same run_inference the "Analyze" button calls, with the AI's suggested box).

Usage:  python test_model_4_severity.py [photo.jpg] [day1_photo.jpg]
With a Day 1 photo it also prints the healing trend (Day 1 -> this photo).
Without arguments: Day 1 = scalp_visit1.jpg, this photo = scalp_visit2.jpg.
"""

import _bench

_bench.setup()
from ai_models.severity_analyzer import evaluate_healing_status  # noqa: E402


def analyse(m, path):
    with open(path, "rb") as f:
        box = m.detect_box(f)["normalized_box"]
    with open(path, "rb") as f:
        return m.run_inference(f, crop_box=box)


def report(label, path, r):
    pm = r["pipeline_metrics"]
    seg, t, card = pm["segmentation"], pm["tissue_stats"], pm["colour_card"]
    print(f"\n--- {label}: {path}")
    size = f"{seg['wound_area_cm2']:.1f} cm²" if seg["wound_area_cm2"] is not None else "not measured (no colour card)"
    print(f"  Wound size:     {size}   ({seg['wound_area_ratio']:.1%} of photo)")
    print(f"  Colour card:    {'found' if card['detected'] else 'not found'}"
          + (f", white balance {card['white_balance_gains']}" if card["white_balance_gains"] else ""))
    print(f"  Tissue:         granulation {t['granulation']}%  slough {t['slough']}%  "
          f"necrotic {t['necrotic']}%  new skin {t['epithelial']}%")
    print(f"  Severity:       {r['severity_score']}/10 {r['severity_level']}"
          + ("  (raised: large wound)" if pm["severity_size_adjusted"] else ""))
    print(f"  Recommendation: {r['recommendation']}")
    for w in r["warnings"]:
        print(f"  Warning:        {w}")


def main():
    if len(_bench.sys.argv) > 1:
        current, day1 = _bench.sys.argv[1], _bench.arg(2, None)
    else:
        current, day1 = _bench.DEFAULT_FOLLOW_UP, _bench.DEFAULT_IMAGE
    _bench.header("MODEL 4: tissue, severity & healing (app pipeline)")
    m = _bench.manager()

    base = None
    if day1:
        base = analyse(m, day1)
        report("Day 1", day1, base)
    r = analyse(m, current)
    report("This photo", current, r)

    if base:
        cur_seg, base_seg = r["pipeline_metrics"]["segmentation"], base["pipeline_metrics"]["segmentation"]
        # like the app: size counts only in cm2 (both photos with the colour card)
        use_cm2 = cur_seg["wound_area_cm2"] is not None and base_seg["wound_area_cm2"] is not None
        status = evaluate_healing_status(
            current_area=cur_seg["wound_area_cm2"] if use_cm2 else None,
            baseline_area=base_seg["wound_area_cm2"] if use_cm2 else None,
            current_severity_score=r["severity_score"], baseline_severity_score=base["severity_score"],
            current_tissue=r["pipeline_metrics"]["tissue_stats"],
            baseline_tissue=base["pipeline_metrics"]["tissue_stats"])
        if use_cm2:
            change = (cur_seg["wound_area_cm2"] - base_seg["wound_area_cm2"]) / base_seg["wound_area_cm2"]
            print(f"\n  Healing trend:  {status}  (size {change:+.0%} vs Day 1, compared in cm²)")
        else:
            print(f"\n  Healing trend:  {status}  (no colour card in both photos: size left out, tissue and severity only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
