import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Microscope,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Calendar,
  FastForward,
  MapPin,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { CircularGauge } from "../Common/CircularGauge";
import { api } from "../../services/api";
import {
  getEffectiveDate,
  formatDisplayDate,
  formatDateInput,
  formatTimeInput,
} from "../../services/dateService";
import confetti from "canvas-confetti";

export const AIAnalysisWizard = ({
  patients = [],
  initialPatient = null,
  initialWound = null,
  onOpenNewPatient,
  onSaveAndReturn,
  onCancel,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatient?.id || initialPatient?.custom_id || "");
  const [selectedWoundId, setSelectedWoundId] = useState(initialWound?.id || null);
  const [patientSearch, setPatientSearch] = useState(initialPatient?.name || "");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Inline wound creation state in wizard
  const [isAddingWoundInWizard, setIsAddingWoundInWizard] = useState(false);
  const [wizardNewWound, setWizardNewWound] = useState({
    anatomicalLocation: "",
    woundType: "Pending AI Scan",
    label: "",
  });
  const [isSavingWoundInWizard, setIsSavingWoundInWizard] = useState(false);

  const [currentStep, setCurrentStep] = useState(initialPatient ? 2 : 1);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  // Scan Assessment Date State
  const [scanDate, setScanDate] = useState(getEffectiveDate());
  const [showDateCustomizer, setShowDateCustomizer] = useState(false);

  const fileInputRef = useRef(null);

  // Selected patient object
  const selectedPatient = patients.find((p) => (p.id || p.custom_id) === selectedPatientId) || initialPatient;

  // Sync selected wound if patient changes
  useEffect(() => {
    if (selectedPatient?.wounds && selectedPatient.wounds.length > 0) {
      if (!selectedWoundId || !selectedPatient.wounds.some((w) => w.id === selectedWoundId)) {
        setSelectedWoundId(selectedPatient.wounds[0].id);
      }
    }
  }, [selectedPatient, selectedWoundId]);

  // Filtered patients for dropdown
  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.id && String(p.id).toLowerCase().includes(patientSearch.toLowerCase())) ||
      (p.custom_id && String(p.custom_id).toLowerCase().includes(patientSearch.toLowerCase()))
  );

  const handlePatientSelect = (patient) => {
    const pId = patient.id || patient.custom_id;
    setSelectedPatientId(pId);
    setPatientSearch(patient.name);
    setShowPatientDropdown(false);
    if (patient.wounds && patient.wounds.length > 0) {
      setSelectedWoundId(patient.wounds[0].id);
    }
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

  // Quick Date Shift helpers for this scan
  const handleShiftDate = (days) => {
    const next = new Date(scanDate);
    next.setDate(next.getDate() + days);
    setScanDate(next);
  };

  const handleSetCustomDate = (dateStr) => {
    if (!dateStr) return;
    const [year, month, day] = dateStr.split("-").map(Number);
    const updated = new Date(scanDate);
    updated.setFullYear(year, month - 1, day);
    setScanDate(updated);
  };

  const handleSetCustomTime = (timeStr) => {
    if (!timeStr) return;
    const [hours, minutes] = timeStr.split(":").map(Number);
    const updated = new Date(scanDate);
    updated.setHours(hours || 0, minutes || 0, 0);
    setScanDate(updated);
  };

  const handleResetToCurrentDate = () => {
    setScanDate(getEffectiveDate());
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

    // Request from API with selected wound context
    const result = await api.analyzeWound(imagePreview, selectedPatient, selectedWoundId);

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
      const sim = analysisResult.pipelineResults?.similarityCheck || analysisResult.similarityCheck || {};
      const isMismatch = (sim.isSameWound === false || sim.is_same_wound === false || (sim.similarityScore !== undefined && sim.similarityScore < 0.65) || (sim.similarity_score !== undefined && sim.similarity_score < 0.65));

      if (isMismatch) {
        const confirmSave = window.confirm(
          `⚠️ WOUND MISMATCH DETECTED (${sim.confidence || '< 65%'})\n\nStage 1 (ResNet-50) detected that this photograph does NOT match the patient's baseline wound.\n\nAre you sure you want to log this scan to this specific wound history anyway?`
        );
        if (!confirmSave) return;
      }

      onSaveAndReturn(
        selectedPatient?.id || selectedPatient?.custom_id,
        analysisResult,
        imagePreview,
        scanDate,
        selectedWoundId
      );
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

      {/* ASSESSMENT DATE CUSTOMIZER CARD */}
      <div
        className="app-card"
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={16} color="#8B1E1E" />
            <div>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block" }}>
                Assessment Date
              </span>
              <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
                {formatDisplayDate(scanDate, true)}
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                fontWeight: "600",
                color: "#8B1E1E",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <FastForward size={12} />
              <span>+1d Next</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDateCustomizer(!showDateCustomizer)}
              style={{
                background: showDateCustomizer ? "#FEE2E2" : "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {showDateCustomizer ? "Close" : "Change ▾"}
            </button>
          </div>
        </div>

        {showDateCustomizer && (
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #E2E8F0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <div>
                <label style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: "600", display: "block", marginBottom: "2px" }}>
                  Date
                </label>
                <input
                  type="date"
                  value={formatDateInput(scanDate)}
                  onChange={(e) => handleSetCustomDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    background: "#FFFFFF",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: "600", display: "block", marginBottom: "2px" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={formatTimeInput(scanDate)}
                  onChange={(e) => handleSetCustomTime(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    background: "#FFFFFF",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleResetToCurrentDate}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                Reset to Current
              </button>
              <button
                type="button"
                onClick={() => handleShiftDate(3)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  color: "#0F172A",
                  cursor: "pointer",
                }}
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => handleShiftDate(7)}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.72rem",
                  color: "#0F172A",
                  cursor: "pointer",
                }}
              >
                +1 Week
              </button>
            </div>
          </div>
        )}
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

        {patients.length === 0 ? (
          <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "12px", border: "1px dashed #CBD5E1", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "8px" }}>
              No patient profiles exist yet. Create a patient first to link this scan.
            </p>
            {onOpenNewPatient && (
              <button
                type="button"
                onClick={onOpenNewPatient}
                className="btn-primary"
                style={{ padding: "8px 14px", fontSize: "0.82rem", borderRadius: "8px" }}
              >
                + Enroll Patient Now
              </button>
            )}
          </div>
        ) : (
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
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((p) => (
                    <div
                      key={p.id || p.custom_id}
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
                      <span style={{ fontSize: "0.76rem", color: "#94A3B8" }}>#{p.id || p.custom_id}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "12px", textAlign: "center", color: "#94A3B8", fontSize: "0.82rem" }}>
                    No matching patient found
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedPatient && (
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <UserCheck size={16} color="#16A34A" />
            <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: "600" }}>
              Active Patient: {selectedPatient.name} (#{selectedPatient.id || selectedPatient.custom_id})
            </span>
          </div>
        )}
      </div>

      {/* TARGET WOUND SITE SELECTOR */}
      {selectedPatient && (
        <div
          className="app-card"
          style={{
            background: "#FFFBF7",
            border: "1.5px solid #FED7AA",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={16} color="#C2410C" />
              <span style={{ fontSize: "0.74rem", fontWeight: "800", color: "#9A3412", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target Wound Site
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingWoundInWizard(!isAddingWoundInWizard)}
              style={{
                background: isAddingWoundInWizard ? "#FED7AA" : "#FFFFFF",
                border: "1px solid #FDBA74",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "0.7rem",
                fontWeight: "700",
                color: "#C2410C",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <Plus size={12} />
              <span>{isAddingWoundInWizard ? "Cancel" : "+ Add Wound Site"}</span>
            </button>
          </div>

          {/* Inline Add Wound Form */}
          {isAddingWoundInWizard && (
            <div style={{ background: "#FFFFFF", border: "1px solid #FED7AA", borderRadius: "10px", padding: "10px", marginBottom: "10px" }}>
              <div style={{ marginBottom: "8px" }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: "700", color: "#475569", marginBottom: "2px" }}>
                  Anatomical Location *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sacrum, Right Knee, Left Heel"
                  value={wizardNewWound.anatomicalLocation}
                  onChange={(e) => setWizardNewWound({ ...wizardNewWound, anatomicalLocation: e.target.value })}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.78rem" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "0.7rem", color: "#166534" }}>
                  ✨ AI will automatically classify the wound type upon scanning.
                </span>
                <button
                  type="button"
                  disabled={isSavingWoundInWizard || !wizardNewWound.anatomicalLocation.trim()}
                  onClick={async () => {
                    setIsSavingWoundInWizard(true);
                    const pId = selectedPatient.id || selectedPatient.custom_id;
                    const res = await api.addWoundToPatient(pId, {
                      ...wizardNewWound,
                      woundType: "Pending AI Scan",
                      label: wizardNewWound.label || wizardNewWound.anatomicalLocation,
                    });
                    if (res && res.wounds) {
                      const latestWound = res.wounds[res.wounds.length - 1];
                      if (latestWound) setSelectedWoundId(latestWound.id);
                    }
                    setIsSavingWoundInWizard(false);
                    setIsAddingWoundInWizard(false);
                    setWizardNewWound({ anatomicalLocation: "", woundType: "Pending AI Scan", label: "" });
                  }}
                  style={{
                    background: "#8B1E1E",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {isSavingWoundInWizard ? "Saving..." : "Create & Select Wound"}
                </button>
              </div>
            </div>
          )}

          {/* Wound Dropdown Selector */}
          {selectedPatient.wounds && selectedPatient.wounds.length > 0 ? (
            <div>
              <select
                value={selectedWoundId || (selectedPatient.wounds[0]?.id ?? "")}
                onChange={(e) => setSelectedWoundId(Number(e.target.value) || e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #FDBA74",
                  fontSize: "0.86rem",
                  fontWeight: "700",
                  color: "#7C2D12",
                  background: "#FFFFFF",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {selectedPatient.wounds.map((w, idx) => (
                  <option key={w.id || idx} value={w.id}>
                    {w.label || w.anatomical_location || `Wound Site #${idx + 1}`} ({w.wound_type})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.72rem", color: "#9A3412", display: "block", marginTop: "4px" }}>
                AI assessment metrics and tissue progress will be logged under this specific wound.
              </span>
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", color: "#7C2D12" }}>
              Scanning <strong>{selectedPatient.anatomicalLocation || "Lower Extremity"}</strong> ({selectedPatient.woundType || "Primary Wound"})
            </div>
          )}
        </div>
      )}

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
                Use device camera or upload an image from files
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

            {/* STAGE 1 RESNET-50 SIMILARITY CHECK BANNER */}
            {(() => {
              const sim = analysisResult.pipelineResults?.similarityCheck || analysisResult.similarityCheck || {};
              const isMismatch = (sim.isSameWound === false || sim.is_same_wound === false || (sim.similarityScore !== undefined && sim.similarityScore < 0.65) || (sim.similarity_score !== undefined && sim.similarity_score < 0.65));
              const isBaseline = sim.isBaseline || sim.is_baseline;

              if (isMismatch) {
                return (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "2px solid #EF4444",
                      borderRadius: "14px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertTriangle size={20} color="#DC2626" />
                      <strong style={{ fontSize: "0.88rem", color: "#991B1B" }}>
                        ⚠️ WOUND MISMATCH DETECTED (Stage 1: ResNet-50)
                      </strong>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "#7F1D1D", margin: 0, lineHeight: "1.4" }}>
                      {sim.warning || `Visual similarity with Day 1 baseline is only ${sim.confidence || "low"} (below 65% threshold). This photograph does NOT appear to be the same wound as Day 1.`}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.74rem", background: "#FFFFFF", padding: "6px 10px", borderRadius: "8px", border: "1px solid #FECDD3" }}>
                      <span style={{ color: "#991B1B", fontWeight: "700" }}>Similarity Score: {sim.confidence || "< 65%"}</span>
                      <span style={{ color: "#64748B" }}>Threshold: 65.0%</span>
                    </div>
                  </div>
                );
              }

              const targetWound = selectedPatient?.wounds?.find((w) => w.id === selectedWoundId) || (selectedPatient?.wounds?.[0]);
              const woundName = targetWound?.label || targetWound?.anatomical_location || selectedPatient?.anatomicalLocation || "Wound Site";

              if (isBaseline) {
                return (
                  <div
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#1D4ED8",
                      fontSize: "0.78rem",
                      fontWeight: "600",
                    }}
                  >
                    <CheckCircle2 size={16} color="#2563EB" />
                    <span>Stage 1 (ResNet-50): <strong>Day 1 Baseline Established for {woundName}</strong> (First scan reference for future follow-ups).</span>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#166534",
                    fontSize: "0.78rem",
                    fontWeight: "600",
                  }}
                >
                  <CheckCircle2 size={16} color="#16A34A" />
                  <span>Stage 1 (ResNet-50): <strong>Match Confirmed ({sim.confidence})</strong> with {woundName} Day 1 baseline.</span>
                </div>
              );
            })()}

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

            {/* Scan Timestamp Confirmation */}
            <div style={{ textAlign: "center", padding: "2px 0" }}>
              <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                Logging scan as: <strong style={{ color: "#0F172A" }}>{formatDisplayDate(scanDate, true)}</strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                style={{ fontSize: "0.85rem", padding: "12px 8px" }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-primary"
                style={{ fontSize: "0.85rem", padding: "12px 8px" }}
              >
                💾 Save Assessment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
