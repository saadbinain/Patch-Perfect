"""
Runs the four model checks, each through the app's own pipeline code.

Usage:
  python run_all_tests.py                 built-in examples (scalp wound, two visits)
  python run_all_tests.py photo.jpg       one photo through models 2-4 (model 1 uses the examples)
"""

import os
import subprocess
import sys

BENCH_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = [
    ("1. ResNet-50 similarity", "test_model_1_similarity.py", False),
    ("2. FUSegNet wound outline", "test_model_2_fusegnet.py", True),
    ("3. VGG16 wound type", "test_model_3_vgg16.py", True),
    ("4. Tissue, severity & healing", "test_model_4_severity.py", True),
]


def main():
    photo = sys.argv[1] if len(sys.argv) > 1 else None
    print("\n" + "#" * 64)
    print("   PATCH PERFECT AI - MODEL TEST BENCH (app pipeline)")
    print("#" * 64, flush=True)
    if photo:
        print(f"Photo: {photo}")

    failed = []
    for name, script, takes_photo in SCRIPTS:
        print(f"\n[{name}]", flush=True)
        cmd = [sys.executable, os.path.join(BENCH_DIR, script)]
        if photo and takes_photo:
            cmd.append(photo)
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        if subprocess.run(cmd, cwd=BENCH_DIR, env=env).returncode != 0:
            failed.append(name)

    print("\n" + "#" * 64)
    print("   " + ("ALL CHECKS RAN" if not failed else "PROBLEMS IN: " + ", ".join(failed)))
    print("#" * 64 + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
