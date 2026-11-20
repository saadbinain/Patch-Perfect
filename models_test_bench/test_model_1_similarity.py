"""
MODEL 1: ResNet-50 wound similarity (is this the same wound as last time?).

Usage:  python test_model_1_similarity.py [baseline.jpg] [follow_up.jpg]
Without arguments it runs two checks: the same wound a week apart (should match)
and two different wounds (should not match).
"""

import _bench

_bench.setup()
from ai_models.pipeline_loader import SIMILARITY_THRESHOLD  # noqa: E402


def compare(m, path_a, path_b, expected=None):
    _, a = _bench.load(path_a)
    _, b = _bench.load(path_b)
    score = m.wound_comparator.similarities(b, [a])[0]
    same = score >= SIMILARITY_THRESHOLD
    print(f"  Baseline:   {path_a}")
    print(f"  Follow-up:  {path_b}")
    print(f"  Similarity: {score:.3f}  (match at >= {SIMILARITY_THRESHOLD:.2f})")
    verdict = "SAME WOUND" if same else "DIFFERENT WOUND"
    if expected is not None:
        verdict += "  [as expected]" if same == expected else "  [UNEXPECTED]"
    print(f"  Decision:   {verdict}\n")
    return same == expected if expected is not None else True


def main():
    _bench.header("MODEL 1: ResNet-50 wound similarity (app pipeline)")
    m = _bench.manager()
    if m.wound_comparator is None:
        print("  ResNet-50 comparator is not loaded.")
        return 1
    if len(_bench.sys.argv) > 2:
        compare(m, _bench.sys.argv[1], _bench.sys.argv[2])
        return 0
    ok = compare(m, _bench.DEFAULT_IMAGE, _bench.DEFAULT_FOLLOW_UP, expected=True)
    ok &= compare(m, _bench.DEFAULT_IMAGE, _bench.DEFAULT_OTHER_WOUND, expected=False)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
