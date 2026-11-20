"""
AI Inference Pipeline Bridge for Patch Perfect AI
Delegates execution to the AIPipelineManager in backend/ai_models/
"""

from ai_models.pipeline_loader import get_ai_pipeline_manager


def run_ai_inference_pipeline(image_file=None, image_base64=None, patient=None, wound_profile=None, baseline_image=None, crop_box=None):
    """
    Runs the 4-stage pipeline (ResNet50 similarity -> FUSegNet -> VGG16 -> tissue/severity).
    Raises ValueError for unusable input (no photo / no wound found).
    """
    image_input = image_file if image_file is not None else image_base64
    return get_ai_pipeline_manager().run_inference(
        image_input=image_input,
        patient=patient,
        wound_profile=wound_profile,
        baseline_image_input=baseline_image,
        crop_box=crop_box,
    )


def detect_wound_box(image_file=None, image_base64=None):
    """
    Runs quick Stage 2 boundary detection to return the initial AI bounding box.
    """
    image_input = image_file if image_file is not None else image_base64
    return get_ai_pipeline_manager().detect_box(image_input)


def pipeline_status():
    return get_ai_pipeline_manager().status()
