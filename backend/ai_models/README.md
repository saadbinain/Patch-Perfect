# Patch Perfect AI - Model Weight Ingestion Guide

This directory is the dedicated drop-in location for the 4 Deep Learning models trained for **Patch Perfect AI** as specified in **Chapter III (Methodology)**.

---

## 1. Directory Structure

Place your exported model weights in the `weights/` subfolder:

```
backend/ai_models/
├── weights/
│   ├── resnet50_similarity.pt      (or .h5 / .onnx)
│   ├── fusegnet_segmentation.pt    (or .h5 / .onnx)
│   ├── vgg16_classifier.pt         (or .h5 / .onnx)
│   └── fpn_vgg16_severity.pt       (or .h5 / .onnx)
├── preprocessor.py                 # Handles image resizing to 512x512 & normalization
├── pipeline_loader.py              # Automatically detects & executes model weights
└── README.md
```

---

## 2. Model Specifications & Output Formats

### Model 1: ResNet50 (Wound Similarity & Patient Verification)
* **Input**: Current wound image + previous baseline wound image ($512 \times 512 \times 3$).
* **Expected Output**: Cosine similarity score / match confidence ($0.0$ to $1.0$).

### Model 2: FUSegNet (Wound Boundary Segmentation)
* **Input**: Raw wound image ($512 \times 512 \times 3$).
* **Expected Output**: Binary / probabilistic segmentation mask ($512 \times 512 \times 1$) where $1 = \text{wound bed}$, $0 = \text{healthy skin/background}$.

### Model 3: VGG16 (Wound Type Classification)
* **Input**: Cropped wound bed image ($224 \times 224$ or $512 \times 512 \times 3$).
* **Expected Output**: Probabilities across 4 classes:
  1. `Diabetic Ulcer`
  2. `Surgical Wound`
  3. `Pressure Injury`
  4. `Venous Ulcer`

### Model 4: FPN + VGG16 (Tissue Segmentation & Severity Scoring)
* **Input**: Cropped wound area ($512 \times 512 \times 3$).
* **Expected Output**:
  * Multi-class tissue map ($512 \times 512$ with classes: *Granulation*, *Slough*, *Necrotic*).
  * Predicted severity score integer ($1$ to $5$):
    * $1 = \text{Mild}$
    * $2 = \text{Mild-Moderate}$
    * $3 = \text{Moderate}$
    * $4 = \text{Very Severe}$
    * $5 = \text{Critical}$

---

## 3. Supported Frameworks
The system supports:
* **PyTorch** (`.pt` / `.pth` TorchScript or `state_dict`)
* **TensorFlow / Keras** (`.h5` or `SavedModel` directory)
* **ONNX Runtime** (`.onnx`)

When any weight file is added to `weights/`, `pipeline_loader.py` automatically picks it up on the next API call!
