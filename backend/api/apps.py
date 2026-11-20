import os
import sys
import threading

from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        # Preload the AI models in the background when the web server starts, so the
        # first scan doesn't wait ~25s. Skipped for other manage.py commands (migrate,
        # test, ...) and for the autoreloader's parent process.
        is_runserver = len(sys.argv) > 1 and sys.argv[1] == "runserver"
        is_reloader_parent = "--noreload" not in sys.argv and os.environ.get("RUN_MAIN") != "true"
        if not is_runserver or is_reloader_parent or os.environ.get("PP_SKIP_MODEL_PRELOAD") == "1":
            return

        def warm_up():
            from ai_models.pipeline_loader import get_ai_pipeline_manager
            status = get_ai_pipeline_manager().status()
            if status["errors"]:
                print(f"[WARN] AI models with problems: {status['errors']}")
            else:
                print("[OK] AI models preloaded")

        threading.Thread(target=warm_up, name="ai-model-preload", daemon=True).start()
