"""
AI Inference Pipeline Bridge for Patch Perfect AI
Delegates execution to the modular AIPipelineManager in backend/ai_models/
"""

from ai_models.pipeline_loader import ai_pipeline_manager

def run_ai_inference_pipeline(image_file=None, image_base64=None, patient=None, wound_profile=None, baseline_image=None):
    """
    Executes the sequential 4-model inference pipeline (ResNet50 -> FUSegNet -> VGG16 -> FPN+VGG16).
    """
    image_input = image_file if image_file is not None else image_base64
    return ai_pipeline_manager.run_inference(
        image_input=image_input,
        patient=patient,
        wound_profile=wound_profile,
        baseline_image_input=baseline_image
    )
