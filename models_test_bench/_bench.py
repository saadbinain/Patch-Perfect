"""
Shared setup for the model test bench.

Every script here calls the app's OWN pipeline code (backend/ai_models), with the
same preprocessing, weights loading and thresholds the app uses, so what the bench
prints is what the app would do with that photo. Nothing is saved to the database.
"""

import os
import sys

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.normpath(os.path.join(BENCH_DIR, "..", "backend"))

DEFAULT_IMAGE = os.path.join(BENCH_DIR, "scalp_visit1.jpg")          # has the colour card
DEFAULT_FOLLOW_UP = os.path.join(BENCH_DIR, "scalp_visit2.jpg")      # same wound, a week later
DEFAULT_OTHER_WOUND = os.path.join(BENCH_DIR, "sample_wound.jpg")    # a different wound (leg)


def setup():
    """Makes the backend importable and loads its Django settings (e.g. COLOUR_CARD_PATCH_CM)."""
    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "patch_perfect.settings")
    try:
        import django
        django.setup()
    except Exception as e:  # the models still run; only settings-based values fall back
        print(f"[bench] Django settings not loaded ({e}); using defaults.")
    # Windows consoles: allow cm² and other symbols
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def manager():
    """The app's pipeline manager, with all four models loaded the way the app loads them."""
    from ai_models.pipeline_loader import get_ai_pipeline_manager
    m = get_ai_pipeline_manager()
    m.load_models()
    if m.load_errors:
        for name, err in m.load_errors.items():
            print(f"[bench] {name} not loaded: {err}")
    return m


def load(path):
    """Photo as the app sees it: EXIF rotation applied, then resized to the model size."""
    from ai_models.preprocessor import load_image_from_input, preprocess_wound_image
    with open(path, "rb") as f:
        original = load_image_from_input(f)
    return original, preprocess_wound_image(original)["pil_image"]


def arg(index, default):
    return sys.argv[index] if len(sys.argv) > index and sys.argv[index] else default


def header(title):
    print("=" * 64)
    print(f" {title}")
    print("=" * 64)
