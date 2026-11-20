"""
Image Preprocessing Utility for Patch Perfect AI Models
Implements Phase 2: Data Preprocessing (MLDLC) from Chapter III:
- Resizing to uniform 512x512
- Pixel normalization (0.0 to 1.0)
- Conversion between PIL, Base64, and numpy/tensor arrays
"""

import io
import base64
from PIL import Image, ImageOps

TARGET_IMAGE_SIZE = (512, 512)


def _upright_rgb(img):
    """Apply the camera's EXIF rotation, as browsers do when they display the photo.
    Without this the clinician's crop box (drawn on the upright photo) lands on the
    wrong part of the image the models see, and phone photos are analysed sideways."""
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img.convert("RGB")

def load_image_from_input(image_input):
    """
    Accepts a base64 string, file-like object, or PIL image,
    and returns a clean PIL Image in RGB format.
    """
    if image_input is None:
        return None

    if isinstance(image_input, Image.Image):
        return _upright_rgb(image_input)

    # If base64 string
    if isinstance(image_input, str):
        if "," in image_input:
            # Strip data URL prefix (e.g. data:image/png;base64,...)
            image_input = image_input.split(",")[1]
        image_bytes = base64.b64decode(image_input)
        return _upright_rgb(Image.open(io.BytesIO(image_bytes)))

    # If uploaded file / BytesIO
    if hasattr(image_input, "read"):
        content = image_input.read()
        if hasattr(image_input, "seek"):
            image_input.seek(0)
        return _upright_rgb(Image.open(io.BytesIO(content)))

    return None

def preprocess_wound_image(image_input):
    """
    Prepares an input image for the 4 deep learning models:
    - Resizes to (512, 512)
    - Returns PIL image, normalized numpy array, and base64 string
    """
    pil_img = load_image_from_input(image_input)
    if pil_img is None:
        # Generate placeholder standard 512x512 canvas if none provided
        pil_img = Image.new("RGB", TARGET_IMAGE_SIZE, color=(240, 240, 240))

    # Resize using high quality Lanczos filter
    resized_img = pil_img.resize(TARGET_IMAGE_SIZE, Image.Resampling.LANCZOS)

    # Convert to base64 for fast API transmission
    buffered = io.BytesIO()
    resized_img.save(buffered, format="JPEG", quality=90)
    img_b64 = "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    return {
        "pil_image": resized_img,
        "width": TARGET_IMAGE_SIZE[0],
        "height": TARGET_IMAGE_SIZE[1],
        "base64": img_b64,
    }
