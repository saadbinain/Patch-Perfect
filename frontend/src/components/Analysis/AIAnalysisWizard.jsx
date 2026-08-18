import React, { useState, useRef } from "react";
import { Camera, Microscope, CheckCircle2, RefreshCw, ArrowLeft, Save, Sparkles, Upload, UserCheck } from "lucide-react";
import { CircularGauge } from "../Common/CircularGauge";
import { api } from "../../services/api";
import confetti from "canvas-confetti";

export const AIAnalysisWizard = ({
  patients = [],
  initialPatient = null,
  onSaveAndReturn,
  onCancel,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || initialPatient?.custom_id || "");
  const [patientSearch, setPatientSearch] = useState(initialPatient?.name || "");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [currentStep, setCurrentStep] = useState(initialPatient ? 2 : 1);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  const fileInputRef = useRef(null);

  // Selected patient object
  const selectedPatient = patients.find((p) => (p.id || p.custom_id) === selectedPatientId) || initialPatient;

  // Filtered patients for dropdown
  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.id && p.id.toLowerCase().includes(patientSearch.toLowerCase())) ||
      (p.custom_id && p.custom_id.toLowerCase().includes(patientSearch.toLowerCase()))
  );

  const handlePatientSelect = (patient) => {
    const pId = patient.id || patient.custom_id;
    setSelectedPatientId(pId);
    setPatientSearch(patient.name);
    setShowPatientDropdown(false);
    setCurrentStep(2);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI Analysis Pipeline
  const handleStartAnalysis = async () => {
    if (!imagePreview && !selectedPatient) {
      alert("Please upload or capture a wound photograph first.");
      return;
    }

    setIsAnalyzing(true);
    setCurrentStep(3);

    // Step 1: ResNet50 similarity check
    setAnalysisStage("Stage 1/4: ResNet50 Patient & Similarity Verification...");
    await new Promise((r) => setTimeout(r, 450));

    // Step 2: FUSegNet boundary segmentation
    setAnalysisStage("Stage 2/4: FUSegNet Wound Boundary Localization & Cropping...");
    await new Promise((r) => setTimeout(r, 550));

    // Step 3: VGG16 classification
    setAnalysisStage("Stage 3/4: VGG16 Ulcer Type Classification...");
    await new Promise((r) => setTimeout(r, 450));

    // Step 4: FPN + VGG16 severity assessment
    setAnalysisStage("Stage 4/4: FPN+VGG16 Tissue Breakdown & Severity Scoring...");

    // Request from API
    const result = await api.analyzeWound(imagePreview, selectedPatient);

    setAnalysisResult(result);
    setIsAnalyzing(false);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#8B1E1E", "#10B981", "#F59E0B"],
      });
    } catch (e) {}
  };

  const handleSave = () => {
    if (onSaveAndReturn && analysisResult) {
      onSaveAndReturn(selectedPatient?.id, analysisResult, imagePreview);
    }
  };

  return (
    <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 3-Step Progress Indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", margin: "4px 0 10px 0" }}>
        {/* Step 1 */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: currentStep >= 1 ? "#8B1E1E" : "#E2E8F0",
            color: currentStep >= 1 ? "#FFFFFF" : "#64748B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "0.9rem",
            boxShadow: currentStep === 1 ? "0 0 0 4px rgba(139, 30, 30, 0.2)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          1
        </div>
        <div style={{ width: "36px", height: "2px", backgroundColor: currentStep >= 2 ? "#8B1E1E" : "#CBD5E1" }} />

        {/* Step 2 */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: currentStep >= 2 ? "#8B1E1E" : "#E2E8F0",
            color: currentStep >= 2 ? "#FFFFFF" : "#64748B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "0.9rem",
            boxShadow: currentStep === 2 ? "0 0 0 4px rgba(139, 30, 30, 0.2)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          2
        </div>
        <div style={{ width: "36px", height: "2px", backgroundColor: currentStep >= 3 ? "#8B1E1E" : "#CBD5E1" }} />

        {/* Step 3 */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: currentStep >= 3 ? "#8B1E1E" : "#E2E8F0",
            color: currentStep >= 3 ? "#FFFFFF" : "#64748B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "0.9rem",
            boxShadow: currentStep === 3 ? "0 0 0 4px rgba(139, 30, 30, 0.2)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          3
        </div>
      </div>

      {/* STEP 1: SELECT PATIENT */}
      <div className="app-card" style={{ position: "relative" }}>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: "700",
            letterSpacing: "0.05em",
            color: "#8B1E1E",
            textTransform: "uppercase",
            display: "block",
            marginBottom: "8px",
          }}
        >
          STEP 1: SELECT PATIENT
        </span>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={patientSearch}
            onFocus={() => setShowPatientDropdown(true)}
            onChange={(e) => {
              setPatientSearch(e.target.value);
              setShowPatientDropdown(true);
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />

          {showPatientDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#FFFFFF",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                border: "1px solid #E2E8F0",
                zIndex: 60,
                marginTop: "4px",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {filteredPatients.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handlePatientSelect(p)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #F1F5F9",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.88rem", color: "#1E293B" }}>{p.name}</strong>
                    <span style={{ fontSize: "0.76rem", color: "#64748B", marginLeft: "6px" }}>
                      ({p.woundType})
                    </span>
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#94A3B8" }}>#{p.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedPatient && (
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <UserCheck size={16} color="#16A34A" />
            <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: "600" }}>
              Active Patient: {selectedPatient.name} (#{selectedPatient.id})
            </span>
          </div>
        )}
      </div>

      {/* STEP 2: UPLOAD PICTURE */}
      <div className="app-card">
        <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#0F172A", marginBottom: "12px" }}>
          Upload Picture
        </h3>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleImageChange}
          style={{ display: "none" }}
        />

        <div
          className={`camera-upload-dropzone ${imagePreview ? "has-file" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <img
                src={imagePreview}
                alt="Wound Capture"
                style={{
                  maxHeight: "180px",
                  borderRadius: "12px",
                  objectFit: "cover",
                  border: "2px solid #8B1E1E",
                }}
              />
              <span style={{ fontSize: "0.78rem", color: "#166534", fontWeight: "600", marginTop: "8px" }}>
                ✓ Image Selected (Tap to retake)
              </span>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  backgroundColor: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8B1E1E",
                  marginBottom: "12px",
                }}
              >
                <Camera size={28} />
              </div>
              <strong style={{ fontSize: "0.95rem", color: "#1E293B" }}>
                Tap to take a photo or choose file
              </strong>
              <p style={{ fontSize: "0.78rem", color: "#64748B", marginTop: "4px" }}>
                Use your device camera for best results
              </p>
            </>
          )}
        </div>

        <button
          onClick={handleStartAnalysis}
          disabled={isAnalyzing}
          className="btn-primary"
          style={{ width: "100%", marginTop: "16px", padding: "14px" }}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw size={20} className="spin-animation" />
              <span>Analyzing Wound Pipeline...</span>
            </>
          ) : (
            <>
              <Microscope size={20} />
              <span>Start AI Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* STEP 3: ANALYSIS RESULT */}
      <div className="app-card" style={{ padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#0F172A" }}>
            Analysis Result
          </h3>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: "700",
              letterSpacing: "0.04em",
              padding: "4px 10px",
              borderRadius: "999px",
              backgroundColor: analysisResult ? "#DCFCE7" : "#FEF3C7",
              color: analysisResult ? "#166534" : "#92400E",
              border: analysisResult ? "1px solid #BBF7D0" : "1px solid #FDE68A",
            }}
          >
            {analysisResult ? "COMPLETE" : isAnalyzing ? "PROCESSING" : "WAITING"}
          </span>
        </div>

        {isAnalyzing && (
          <div style={{ padding: "28px 12px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "4px solid #FEE2E2",
                borderTopColor: "#8B1E1E",
                margin: "0 auto 16px auto",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ fontSize: "0.88rem", fontWeight: "700", color: "#8B1E1E" }}>
              {analysisStage}
            </p>
            <p style={{ fontSize: "0.76rem", color: "#64748B", marginTop: "4px" }}>
              Running sequential inference: ResNet50 → FUSegNet → VGG16 → FPN
            </p>
          </div>
        )}

        {!isAnalyzing && !analysisResult && (
          <div style={{ padding: "32px 12px", textAlign: "center", color: "#94A3B8" }}>
            <Microscope size={44} color="#CBD5E1" style={{ margin: "0 auto 10px auto" }} />
            <p style={{ fontSize: "0.95rem", fontWeight: "600", color: "#64748B" }}>
              Awaiting input
            </p>
            <p style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: "2px" }}>
              Upload a photograph and tap "Start AI Analysis"
            </p>
          </div>
        )}

        {!isAnalyzing && analysisResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Severity Gauge */}
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              <CircularGauge
                score={analysisResult.severityScore}
                subtitle="SEVERITY SCORE"
                size={130}
              />
            </div>

            {/* 3 Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {/* Wound Type */}
              <div
                style={{
                  background: "#FFF1F2",
                  border: "1px solid #FECDD3",
                  borderRadius: "12px",
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "0.64rem", fontWeight: "700", color: "#9F1239", textTransform: "uppercase", display: "block" }}>
                  Wound Type
                </span>
                <strong style={{ fontSize: "0.82rem", color: "#881337", marginTop: "2px", display: "block" }}>
                  {analysisResult.woundType}
                </strong>
              </div>

              {/* Severity Level */}
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "12px",
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "0.64rem", fontWeight: "700", color: "#92400E", textTransform: "uppercase", display: "block" }}>
                  Severity Level
                </span>
                <strong style={{ fontSize: "0.82rem", color: "#78350F", marginTop: "2px", display: "block" }}>
                  {analysisResult.severityLevel}
                </strong>
              </div>

              {/* Healing Status */}
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "12px",
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: "0.64rem", fontWeight: "700", color: "#166534", textTransform: "uppercase", display: "block" }}>
                  Healing Status
                </span>
                <strong style={{ fontSize: "0.82rem", color: "#14532D", marginTop: "2px", display: "block" }}>
                  {analysisResult.healingStatus}
                </strong>
              </div>
            </div>

            {/* AI Recommendation */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "12px 14px",
              }}
            >
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                AI RECOMMENDATION
              </span>
              <p style={{ fontSize: "0.82rem", color: "#1E293B", lineHeight: "1.4", fontWeight: "500" }}>
                {analysisResult.recommendation}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                style={{ fontSize: "0.85rem", padding: "12px 8px" }}
              >
                ← Back to Dashboard
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-primary"
                style={{ fontSize: "0.85rem", padding: "12px 8px" }}
              >
                💾 Save & Return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
