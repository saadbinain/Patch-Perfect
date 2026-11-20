"""
ResNet-50 and Deep Feature Wound Comparator
Provides visual similarity comparison for wound tracking across clinical assessments.
"""

import os
import io
import math
import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn as nn
    import torchvision.transforms as transforms
    import torchvision.models as models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class WoundComparator:
    """
    Computes visual similarity between baseline (Day 1) and follow-up scans of a specific wound.
    Uses deep feature embeddings and spatial color-texture histograms.
    """
    def __init__(self):
        self.model = None
        self.transform = None
        self.method = "colour-histogram"
        self._init_feature_extractor()

    def _init_feature_extractor(self):
        if not TORCH_AVAILABLE:
            return

        try:
            # Check if ResNet50 weights are available
            weights = models.ResNet50_Weights.DEFAULT if hasattr(models, 'ResNet50_Weights') else None
            if weights:
                base_model = models.resnet50(weights=weights)
            else:
                base_model = models.resnet50(pretrained=True)

            # Remove classification head to output feature vector (2048-dim)
            self.model = nn.Sequential(*list(base_model.children())[:-1])
            self.model.eval()

            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            self.method = "resnet50"
            print("[OK] ResNet-50 deep feature extractor initialized successfully.")
        except Exception as e:
            print(f"[INFO] ResNet weights download skipped, using spatial color-texture embeddings: {e}")
            self.model = None

    def _get_embedding(self, pil_image):
        """Extracts normalized feature vector from a PIL image."""
        if self.model is not None and self.transform is not None:
            try:
                img_t = self.transform(pil_image).unsqueeze(0)
                with torch.no_grad():
                    features = self.model(img_t).flatten().numpy()
                norm = np.linalg.norm(features)
                if norm > 0:
                    return features / norm
            except Exception as e:
                print(f"[WARN] ResNet inference failed, falling back: {e}")

        # Spatial color & texture histogram embedding
        img = pil_image.resize((128, 128)).convert("RGB")
        arr = np.array(img, dtype=np.float32)

        # 3-channel histograms with 16 bins each (48 dims)
        h_r, _ = np.histogram(arr[:, :, 0], bins=16, range=(0, 256), density=True)
        h_g, _ = np.histogram(arr[:, :, 1], bins=16, range=(0, 256), density=True)
        h_b, _ = np.histogram(arr[:, :, 2], bins=16, range=(0, 256), density=True)

        # Grayscale gradients / texture
        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        gy, gx = np.gradient(gray)
        mag = np.sqrt(gx**2 + gy**2)
        h_tex, _ = np.histogram(mag, bins=16, range=(0, 100), density=True)

        vec = np.concatenate([h_r, h_g, h_b, h_tex])
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def similarities(self, current, references):
        """
        Cosine similarity (0..1) of one photo against several earlier photos, in the same
        order. The current photo's embedding is computed once and reused.
        """
        if not references:
            return []
        current = current.convert("RGB")
        emb_current = self._get_embedding(current)
        scores = []
        for ref in references:
            ref = ref.convert("RGB").resize(current.size)
            scores.append(max(0.0, min(1.0, float(np.dot(emb_current, self._get_embedding(ref))))))
        return scores

    def compare(self, img1, img2, threshold=0.65):
        """
        Compares two PIL images and returns similarity score and match decision.
        """
        if img1 is None or img2 is None:
            return {"similarity": 1.0, "is_same_wound": True, "threshold_used": threshold}

        try:
            # Check for identical images
            if img1.size == img2.size and list(img1.getdata()) == list(img2.getdata()):
                return {"similarity": 1.0, "is_same_wound": True, "threshold_used": threshold}
        except Exception:
            pass

        emb1 = self._get_embedding(img1)
        emb2 = self._get_embedding(img2)

        cosine_sim = float(np.dot(emb1, emb2))
        cosine_sim = max(0.0, min(1.0, cosine_sim))

        return {
            "similarity": cosine_sim,
            "is_same_wound": bool(cosine_sim >= threshold),
            "threshold_used": float(threshold)
        }
