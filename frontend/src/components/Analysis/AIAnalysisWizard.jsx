import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Microscope,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  Calendar,
  MapPin,
  Plus,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  Circle,
} from "lucide-react";
import { CircularGauge } from "../Common/CircularGauge";
import { WoundCropAdjuster } from "./WoundCropAdjuster";
import { GuidedCamera } from "./GuidedCamera";
import { resolveMediaUrl } from "../../services/apiConfig";
import { api } from "../../services/api";
import { getWoundLabel } from "../../services/woundLabel";
import {
  getEffectiveDate,
  getSimulatedDateConfig,
  formatDisplayDate,
  formatDateInput,
  formatTimeInput,
} from "../../services/dateService";

const STEPS = [
  { id: 1, label: "Patient" },
  { id: 2, label: "Photo" },
  { id: 3, label: "Result" },
];

// Plain-language pipeline stages shown to clinicians while the scan runs
const ANALYSIS_STAGES = [
  "Checking the photo matches this wound",
  "Finding the wound boundary",
  "Identifying the wound type",
  "Scoring tissue and severity",
];

const getPatientId = (p) => (p ? p.id || p.custom_id : null);

const getSimilarity = (result) =>
  result?.pipelineResults?.similarityCheck || result?.similarityCheck || {};

// A baseline scan has no score (null); only a real numeric score below threshold is a mismatch
const isSimilarityMismatch = (sim) => {
  if (sim.isBaseline || sim.is_baseline) return false;
  const score = typeof sim.similarityScore === "number" ? sim.similarityScore : sim.similarity_score;
  return sim.isSameWound === false || sim.is_same_wound === false || (typeof score === "number" && score < 0.65);
};

// Colour result tiles by what they actually say, not a fixed colour per tile
const toneFor = (kind, value, score) => {
  const tones = {
    danger: { bg: "#FEF2F2", border: "#FECDD3", label: "#991B1B", text: "#7F1D1D" },
    warning: { bg: "#FFFBEB", border: "#FDE68A", label: "#92400E", text: "#78350F" },
    success: { bg: "#F0FDF4", border: "#BBF7D0", label: "#166534", text: "#14532D" },
    neutral: { bg: "#F8FAFC", border: "#E2E8F0", label: "#475569", text: "#0F172A" },
  };
  if (kind === "severity") {
    if (score == null) return tones.neutral;
    if (score >= 4) return tones.danger;
    if (score >= 3) return tones.warning;
    return tones.success;
  }
  if (kind === "healing") {
    const v = String(value || "").toLowerCase();
    if (/deteriorat|worse|declin/.test(v)) return tones.danger;
    if (/improv|heal/.test(v)) return tones.success;
    if (/stable|baseline/.test(v)) return tones.neutral;
    return tones.warning;
  }
  return tones.neutral;
};

const smallButton = {
  background: "#FFFFFF",
  border: "1px solid #CBD5E1",
  borderRadius: "8px",
  padding: "6px 10px",
  fontSize: "0.74rem",
  fontWeight: "700",
  color: "#334155",
  cursor: "pointer",
};

const sectionLabel = {
  fontSize: "0.72rem",
  fontWeight: "800",
  letterSpacing: "0.05em",
  color: "#8B1E1E",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "8px",
};

// Used when the AI finds no wound outline: the middle 70% of the photo.
const DEFAULT_CROP_BOX = [0.15, 0.15, 0.85, 0.85];

export const AIAnalysisWizard = ({
  patients = [],
  initialPatient = null,
  initialWound = null,
  onOpenNewPatient,
  onRefreshPatients,
  onSaveAndReturn,
  onDirtyChange,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(getPatientId(initialPatient) || "");
  const [selectedWoundId, setSelectedWoundId] = useState(initialWound?.id ?? null);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Inline wound creation
  const [isAddingWound, setIsAddingWound] = useState(false);
  const [newWoundLocation, setNewWoundLocation] = useState("");
  const [isSavingWound, setIsSavingWound] = useState(false);

  // Skip straight to the photo only when patient AND wound are unambiguous
  const woundIsKnown = Boolean(initialWound) || (initialPatient?.wounds?.length ?? 0) <= 1;
  const [currentStep, setCurrentStep] = useState(initialPatient && woundIsKnown ? 2 : 1);
  const [imagePreview, setImagePreview] = useState(null);
  const [cropBox, setCropBox] = useState(DEFAULT_CROP_BOX);
  const [isDetectingBox, setIsDetectingBox] = useState(false);
  const [woundBoxDetected, setWoundBoxDetected] = useState(true);
  const [cardFound, setCardFound] = useState(null); // null = not checked yet
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [woundError, setWoundError] = useState("");

  // Assessment date (defaults to now; shift shortcuts only in date-simulation/demo mode)
  const [scanDate, setScanDate] = useState(getEffectiveDate());
  const [showDateCustomizer, setShowDateCustomizer] = useState(false);
  const isSimulationMode = Boolean(getSimulatedDateConfig()?.enabled);

  const fileInputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);

  const selectedPatient =
    patients.find((p) => getPatientId(p) === selectedPatientId) ||
    (getPatientId(initialPatient) === selectedPatientId ? initialPatient : null);
  const patientWounds = selectedPatient?.wounds || [];
  const selectedWound =
    patientWounds.find((w) => w.id === selectedWoundId) || patientWounds[0] || null;

  // Keep a valid wound selected when the patient (or their wound list) changes
  useEffect(() => {
    if (patientWounds.length > 0 && !patientWounds.some((w) => w.id === selectedWoundId)) {
      setSelectedWoundId(patientWounds[0].id);
    }
  }, [selectedPatient, selectedWoundId]);

  // Tell the parent when leaving would throw away work
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(Boolean(imagePreview || analysisResult));
  }, [imagePreview, analysisResult]);

  const q = patientSearch.toLowerCase().trim();
  const filteredPatients = patients.filter(
    (p) =>
      !q ||
      (p.name || "").toLowerCase().includes(q) ||
      String(getPatientId(p) || "").toLowerCase().includes(q)
  );

  const handlePatientSelect = (patient) => {
    setSelectedPatientId(getPatientId(patient));
    setPatientSearch("");
    setShowPatientDropdown(false);
    setSelectedWoundId(patient.wounds?.[0]?.id ?? null);
    setIsAddingWound(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      detectBoxFor(reader.result);
    };
    reader.readAsDataURL(file);
    // allow re-selecting the same file after a retake
    e.target.value = "";
  };

  // Pre-fill the crop box from the AI's wound outline. Only the newest photo's
  // answer is used, so a slow reply for an earlier photo can't move the box.
  const detectRequestRef = useRef(0);
  const detectBoxFor = async (dataUrl) => {
    const requestId = ++detectRequestRef.current;
    setIsDetectingBox(true);
    let box = DEFAULT_CROP_BOX;
    let detected = false;
    let card = null;
    try {
      const res = await api.detectWoundBox(dataUrl);
      if (res?.normalized_box?.length === 4) {
        box = res.normalized_box;
        detected = Boolean(res.wound_detected);
      }
      if (res?.colour_card) card = Boolean(res.colour_card.detected);
    } catch (err) {
      console.warn("Could not auto-detect wound boundary:", err);
    }
    if (requestId !== detectRequestRef.current) return;
    setCropBox(box);
    setWoundBoxDetected(detected);
    setCardFound(card);
    setIsDetectingBox(false);
  };

  // Last photo of this wound: shown faintly in the guided camera, and its card size
  // is the target for the distance guide.
  // (older single-wound records keep their scans on the patient, not on a wound)
  const woundScans = selectedWound?.scans?.length
    ? selectedWound.scans
    : patientWounds.length <= 1
    ? selectedPatient?.scans || []
    : [];
  const previousScan = [...woundScans].sort(
    (a, b) => new Date(b.scan_date || b.scanDate || 0) - new Date(a.scan_date || a.scanDate || 0)
  )[0];
  const previousPhotoUrl = previousScan ? resolveMediaUrl(previousScan.image || previousScan.image_base64 || previousScan.imagePreview) : null;
  const previousCardRatio = previousScan?.card_block_ratio ?? null;

  const handleCaptured = (dataUrl) => {
    setShowCamera(false);
    setImagePreview(dataUrl);
    detectBoxFor(dataUrl);
  };

  const openPhoneCamera = () => {
    setShowCamera(false);
    fileInputRef.current?.click();
  };

  const handleResetAutoBox = () => {
    if (imagePreview) detectBoxFor(imagePreview);
  };

  const handleCreateWound = async () => {
    const location = newWoundLocation.trim();
    if (!location || !selectedPatient) return;
    setIsSavingWound(true);
    setWoundError("");
    try {
      const res = await api.addWoundToPatient(getPatientId(selectedPatient), {
        anatomicalLocation: location,
        woundType: "Pending AI Scan",
        label: location,
      });
      // Refresh first so the new wound exists in the list before we select it
      if (onRefreshPatients) await onRefreshPatients();
      const latestWound = res?.wounds?.[res.wounds.length - 1];
      if (latestWound) setSelectedWoundId(latestWound.id);
      setIsAddingWound(false);
      setNewWoundLocation("");
    } catch (err) {
      setWoundError(err.message || "Could not add the wound site.");
    } finally {
      setIsSavingWound(false);
    }
  };

  // Date helpers
  const shiftDate = (days) => {
    const next = new Date(scanDate);
    next.setDate(next.getDate() + days);
    setScanDate(next);
  };
  const setCustomDate = (dateStr) => {
    if (!dateStr) return;
    const [year, month, day] = dateStr.split("-").map(Number);
    const updated = new Date(scanDate);
    updated.setFullYear(year, month - 1, day);
    setScanDate(updated);
  };
  const setCustomTime = (timeStr) => {
    if (!timeStr) return;
    const [hours, minutes] = timeStr.split(":").map(Number);
    const updated = new Date(scanDate);
    updated.setHours(hours || 0, minutes || 0, 0);
    setScanDate(updated);
  };

  const handleStartAnalysis = async () => {
    if (!imagePreview || !selectedPatient) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError("");
    setSaveError("");
    setMismatchAcknowledged(false);
    setCurrentStep(3);

    // Stage list advances while the request runs; the real work happens server-side
    let cancelled = false;
    const ticker = (async () => {
      for (let i = 0; i < 3 && !cancelled; i++) {
        setStageIndex(i);
        await new Promise((r) => setTimeout(r, 900));
      }
      if (!cancelled) setStageIndex(3);
    })();
    try {
      const result = await api.analyzeWound(imagePreview, selectedPatient, selectedWound?.id ?? null, cropBox);
      cancelled = true;
      await ticker;
      setStageIndex(4);
      setAnalysisResult(result);
    } catch (err) {
      cancelled = true;
      setAnalysisError(err.message || "The analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setAnalysisResult(null);
    setAnalysisError("");
    setSaveError("");
    setImagePreview(null);
    setStageIndex(-1);
    setMismatchAcknowledged(false);
    setCurrentStep(2);
  };

  const sim = getSimilarity(analysisResult);
  const isMismatch = analysisResult ? isSimilarityMismatch(sim) : false;
  const canSave = analysisResult && (!isMismatch || mismatchAcknowledged) && !isSaving;

  const handleSave = async () => {
    if (!canSave || !onSaveAndReturn) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await onSaveAndReturn(
        getPatientId(selectedPatient),
        analysisResult,
        imagePreview,
        scanDate,
        selectedWound?.id ?? null
      );
      if (onDirtyChange) onDirtyChange(false);
    } catch (err) {
      // Keep the result on screen so nothing is lost; the user can retry
      setSaveError(err.message || "Saving failed. Please try again.");
      setIsSaving(false);
    }
  };

  const woundName = getWoundLabel(selectedWound, selectedPatient?.anatomicalLocation || "Wound Site");
  const canGoBackTo = (stepId) => stepId < currentStep && !isAnalyzing && !analysisResult;

  /* ---------------------------------------------------------------- */

  const renderStepper = () => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: "6px", margin: "2px 0 4px 0" }}>
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id || (step.id === 3 && analysisResult);
        const active = currentStep === step.id;
        const clickable = canGoBackTo(step.id);
        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => clickable && setCurrentStep(step.id)}
              disabled={!clickable}
              aria-current={active ? "step" : undefined}
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: clickable ? "pointer" : "default",
                padding: 0,
                minWidth: "56px",
              }}
            >
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: done || active ? "#8B1E1E" : "#E2E8F0",
                  color: done || active ? "#FFFFFF" : "#64748B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "800",
                  fontSize: "0.85rem",
                  boxShadow: active ? "0 0 0 4px rgba(139, 30, 30, 0.18)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {done && !active ? <CheckCircle2 size={16} /> : step.id}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: active ? "800" : "600",
                  color: active ? "#8B1E1E" : "#64748B",
                }}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div
                style={{
                  width: "40px",
                  height: "2px",
                  marginTop: "15px",
                  backgroundColor: currentStep > step.id ? "#8B1E1E" : "#CBD5E1",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Compact "who/what is being scanned" summary shown on steps 2 and 3
  const renderContextSummary = () => (
    <div
      className="app-card"
      style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <UserCheck size={18} color="#16A34A" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <strong
            style={{ fontSize: "0.86rem", color: "#0F172A", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {selectedPatient?.name} <span style={{ color: "#94A3B8", fontWeight: 600 }}>#{getPatientId(selectedPatient)}</span>
          </strong>
          <span style={{ fontSize: "0.76rem", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
            <MapPin size={12} /> {woundName}
          </span>
        </div>
      </div>
      {canGoBackTo(1) && (
        <button type="button" style={smallButton} onClick={() => setCurrentStep(1)}>
          Change
        </button>
      )}
    </div>
  );

  const renderDateRow = () => (
    <div style={{ borderTop: "1px solid #E2E8F0", marginTop: "14px", paddingTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <Calendar size={16} color="#64748B" />
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block" }}>
              Assessment date
            </span>
            <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>{formatDisplayDate(scanDate, true)}</strong>
          </div>
        </div>
        <button type="button" style={smallButton} onClick={() => setShowDateCustomizer(!showDateCustomizer)}>
          {showDateCustomizer ? "Done" : "Edit"}
        </button>
      </div>

      {showDateCustomizer && (
        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <label style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: "600" }}>
              Date
              <input
                type="date"
                value={formatDateInput(scanDate)}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{ width: "100%", padding: "7px 8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.8rem", marginTop: "2px" }}
              />
            </label>
            <label style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: "600" }}>
              Time
              <input
                type="time"
                value={formatTimeInput(scanDate)}
                onChange={(e) => setCustomTime(e.target.value)}
                style={{ width: "100%", padding: "7px 8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.8rem", marginTop: "2px" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button type="button" style={smallButton} onClick={() => setScanDate(getEffectiveDate())}>
              Use current time
            </button>
            {isSimulationMode && (
              <>
                <button type="button" style={smallButton} onClick={() => shiftDate(1)}>+1 day</button>
                <button type="button" style={smallButton} onClick={() => shiftDate(3)}>+3 days</button>
                <button type="button" style={smallButton} onClick={() => shiftDate(7)}>+1 week</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------- STEP 1: PATIENT & WOUND ---------------- */
  const renderStepPatient = () => (
    <>
      <div className="app-card" style={{ position: "relative" }}>
        <span style={sectionLabel}>Patient</span>

        {patients.length === 0 ? (
          <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "12px", border: "1px dashed #CBD5E1", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "#64748B", marginBottom: "10px" }}>
              No patients yet. Register one to link this scan.
            </p>
            {onOpenNewPatient && (
              <button type="button" onClick={onOpenNewPatient} className="btn-primary" style={{ padding: "9px 14px", fontSize: "0.82rem" }}>
                <Plus size={16} /> Register patient
              </button>
            )}
          </div>
        ) : selectedPatient && !showPatientDropdown ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "12px",
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <UserCheck size={18} color="#16A34A" />
              <strong style={{ fontSize: "0.88rem", color: "#14532D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedPatient.name} <span style={{ fontWeight: 600, color: "#4D7C0F" }}>#{getPatientId(selectedPatient)}</span>
              </strong>
            </div>
            <button type="button" style={smallButton} onClick={() => setShowPatientDropdown(true)}>
              Change
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={patientSearch}
              autoFocus={Boolean(selectedPatient)}
              onFocus={() => setShowPatientDropdown(true)}
              // delay so a tap on a result registers before the list closes
              onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
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
                role="listbox"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                  border: "1px solid #E2E8F0",
                  marginTop: "6px",
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((p) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={getPatientId(p) === selectedPatientId}
                      key={getPatientId(p)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePatientSelect(p)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: getPatientId(p) === selectedPatientId ? "#FEF2F2" : "#FFFFFF",
                        border: "none",
                        padding: "11px 14px",
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "0.88rem", color: "#1E293B" }}>{p.name}</strong>
                        <span style={{ fontSize: "0.74rem", color: "#64748B", display: "block" }}>
                          {(p.wounds?.length || 1)} wound site{(p.wounds?.length || 1) === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span style={{ fontSize: "0.76rem", color: "#94A3B8" }}>#{getPatientId(p)}</span>
                    </button>
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
      </div>

      {selectedPatient && !showPatientDropdown && (
        <div className="app-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ ...sectionLabel, marginBottom: 0 }}>Wound site</span>
            <button
              type="button"
              onClick={() => setIsAddingWound(!isAddingWound)}
              style={{ ...smallButton, display: "flex", alignItems: "center", gap: "4px", color: "#8B1E1E" }}
            >
              {isAddingWound ? "Cancel" : (<><Plus size={12} /> New site</>)}
            </button>
          </div>

          {isAddingWound && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px", marginBottom: "10px" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                Anatomical location
                <input
                  type="text"
                  placeholder="e.g. Sacrum, Right Knee, Left Heel"
                  value={newWoundLocation}
                  onChange={(e) => setNewWoundLocation(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "0.82rem", marginTop: "3px", fontWeight: 500 }}
                />
              </label>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "6px" }}>
                <span style={{ fontSize: "0.7rem", color: "#64748B" }}>Wound type is classified by the scan.</span>
                <button
                  type="button"
                  disabled={isSavingWound || !newWoundLocation.trim()}
                  onClick={handleCreateWound}
                  className="btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.76rem", borderRadius: "8px", opacity: !newWoundLocation.trim() ? 0.5 : 1 }}
                >
                  {isSavingWound ? "Saving..." : "Add site"}
                </button>
              </div>
              {woundError && (
                <p role="alert" style={{ fontSize: "0.74rem", color: "#B91C1C", marginTop: "6px", fontWeight: 600 }}>
                  {woundError}
                </p>
              )}
            </div>
          )}

          {patientWounds.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {patientWounds.map((w, idx) => {
                const checked = selectedWound?.id === w.id;
                return (
                  <label
                    key={w.id ?? idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: checked ? "1.5px solid #8B1E1E" : "1px solid #E2E8F0",
                      background: checked ? "#FEF2F2" : "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="wound-site"
                      checked={checked}
                      onChange={() => setSelectedWoundId(w.id)}
                      style={{ accentColor: "#8B1E1E" }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: "0.86rem", color: "#0F172A", display: "block" }}>
                        {getWoundLabel(w, `Wound Site #${idx + 1}`)}
                      </strong>
                      <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                        {w.wound_type && w.wound_type !== "Pending AI Scan" ? w.wound_type : "Not yet classified"}
                        {" · "}
                        {(w.scans?.length || 0)} scan{(w.scans?.length || 0) === 1 ? "" : "s"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "0.84rem", color: "#334155" }}>
              Scanning <strong>{woundName}</strong>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={!selectedPatient || showPatientDropdown}
        onClick={() => setCurrentStep(2)}
        style={{ width: "100%", padding: "14px", opacity: !selectedPatient || showPatientDropdown ? 0.5 : 1 }}
      >
        <span>Continue to photo</span>
        <ArrowRight size={18} />
      </button>
    </>
  );

  /* ---------------- STEP 2: PHOTO ---------------- */
  const renderStepPhoto = () => (
    <>
      {renderContextSummary()}

      <div className="app-card">
        <span style={sectionLabel}>Wound photo</span>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          style={{ display: "none" }}
        />

        {imagePreview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <WoundCropAdjuster
              imageSrc={imagePreview}
              cropBox={cropBox}
              onChange={setCropBox}
              isDetecting={isDetectingBox}
              woundDetected={woundBoxDetected}
              onResetAuto={handleResetAutoBox}
            />
            {!isDetectingBox && cardFound === false && (
              <p style={{ fontSize: "0.74rem", color: "#854D0E", background: "#FEF9C3", borderRadius: "8px", padding: "8px 10px", margin: 0, lineHeight: 1.4 }}>
                Colour card not found. Wound size can't be measured in cm² without it. Retake with the card flat next to the wound.
              </p>
            )}
            {!isDetectingBox && cardFound === true && (
              <p style={{ fontSize: "0.74rem", color: "#166534", margin: 0 }}>
                Colour card found: size will be measured in cm².
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "2px" }}>
              <button type="button" style={{ ...smallButton, color: "#8B1E1E" }} onClick={() => setShowCamera(true)}>
                Retake with guide
              </button>
              <button type="button" style={{ ...smallButton, color: "#475569" }} onClick={() => fileInputRef.current?.click()}>
                Choose from gallery
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            className="camera-upload-dropzone"
            onClick={() => setShowCamera(true)}
            style={{ width: "100%" }}
          >
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
            <strong style={{ fontSize: "0.95rem", color: "#1E293B" }}>Take photo with guide</strong>
            <p style={{ fontSize: "0.76rem", color: "#64748B", marginTop: "6px", lineHeight: 1.45 }}>
              {previousPhotoUrl
                ? "Lines up with the last photo of this wound"
                : "Checks light, focus and the colour card"}
              <br />
              whole wound edge in frame, card beside it
            </p>
          </button>
          <button type="button" style={{ ...smallButton, alignSelf: "center", color: "#475569" }} onClick={() => fileInputRef.current?.click()}>
            Choose from gallery instead
          </button>
          </div>
        )}

        {showCamera && (
          <GuidedCamera
            previousPhotoUrl={previousPhotoUrl}
            previousCardRatio={previousCardRatio}
            woundId={selectedWound?.id}
            onCapture={handleCaptured}
            onCancel={() => setShowCamera(false)}
            onFallback={openPhoneCamera}
          />
        )}

        {renderDateRow()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px" }}>
        <button type="button" className="btn-secondary" onClick={() => setCurrentStep(1)} aria-label="Back to patient">
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={handleStartAnalysis}
          disabled={!imagePreview || isAnalyzing || isDetectingBox}
          className="btn-primary"
          style={{ padding: "14px", opacity: !imagePreview || isDetectingBox ? 0.5 : 1 }}
        >
          <Microscope size={20} />
          <span>
            {isDetectingBox
              ? "Finding wound boundary..."
              : imagePreview
              ? "Analyze wound in box"
              : "Add a photo to analyze"}
          </span>
        </button>
      </div>
    </>
  );

  /* ---------------- STEP 3: RESULT ---------------- */
  const renderAnalyzing = () => (
    <div className="app-card" style={{ padding: "22px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <RefreshCw size={20} color="#8B1E1E" className="spin-animation" />
        <strong style={{ fontSize: "1rem", color: "#0F172A" }}>Analyzing wound…</strong>
      </div>
      <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
        {ANALYSIS_STAGES.map((label, i) => {
          const done = stageIndex > i;
          const running = stageIndex === i;
          return (
            <li key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {done ? (
                <CheckCircle2 size={18} color="#16A34A" />
              ) : running ? (
                <RefreshCw size={18} color="#8B1E1E" className="spin-animation" />
              ) : (
                <Circle size={18} color="#CBD5E1" />
              )}
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: running ? "700" : "500",
                  color: done ? "#166534" : running ? "#0F172A" : "#94A3B8",
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const renderAnalysisError = () => (
    <div className="app-card" role="alert" style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <AlertTriangle size={20} color="#DC2626" />
        <strong style={{ fontSize: "0.98rem", color: "#991B1B" }}>Analysis couldn't be completed</strong>
      </div>
      <p style={{ fontSize: "0.85rem", color: "#334155", lineHeight: 1.45 }}>{analysisError}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <button type="button" className="btn-secondary" onClick={handleRetake}>
          <Camera size={16} />
          <span>Retake photo</span>
        </button>
        <button type="button" className="btn-primary" onClick={handleStartAnalysis}>
          <RefreshCw size={16} />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );

  const renderWarnings = () => {
    const warnings = analysisResult?.warnings || [];
    if (warnings.length === 0) return null;
    return (
      <div
        style={{
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "12px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {warnings.map((w) => (
          <div key={w} style={{ display: "flex", gap: "6px", fontSize: "0.78rem", color: "#78350F", fontWeight: 600, lineHeight: 1.4 }}>
            <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{w}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderSimilarityBanner = () => {
    if (isMismatch) {
      return (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "2px solid #EF4444",
            borderRadius: "14px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={20} color="#DC2626" />
            <strong style={{ fontSize: "0.9rem", color: "#991B1B" }}>This may be a different wound</strong>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#7F1D1D", margin: 0, lineHeight: 1.45 }}>
            {sim.warning ||
              `This photo doesn't match any earlier photo of ${woundName} (best ${sim.confidence || "below 65%"}). Check you selected the right patient and wound site.`}
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.8rem", color: "#7F1D1D", fontWeight: 600, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={mismatchAcknowledged}
              onChange={(e) => setMismatchAcknowledged(e.target.checked)}
              style={{ marginTop: "2px", accentColor: "#B91C1C" }}
            />
            <span>I've checked — this is {woundName}. Save it to this timeline anyway.</span>
          </label>
        </div>
      );
    }

    const isBaseline = sim.isBaseline || sim.is_baseline;
    const tone = isBaseline
      ? { bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8", icon: "#2563EB" }
      : { bg: "#F0FDF4", border: "#BBF7D0", color: "#166534", icon: "#16A34A" };
    return (
      <div
        style={{
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          borderRadius: "12px",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: tone.color,
          fontSize: "0.8rem",
          fontWeight: "600",
        }}
      >
        <CheckCircle2 size={16} color={tone.icon} style={{ flexShrink: 0 }} />
        <span>
          {isBaseline ? (
            <>First scan of <strong>{woundName}</strong> — later scans will be compared with it.</>
          ) : sim.is_same_wound === null || sim.isSameWound === null ? (
            <>Not compared with earlier photos of this wound.</>
          ) : sim.compared_with === "earlier" ? (
            // previous photo looked different (e.g. the wound changed), but an earlier one matched
            <>
              Matches an earlier scan of {woundName}
              {sim.reference_date ? ` from ${sim.reference_date}` : ""} ({sim.confidence}).
            </>
          ) : (
            <>Matches the previous scan of {woundName}{sim.confidence ? ` (${sim.confidence})` : ""}.</>
          )}
        </span>
      </div>
    );
  };

  const renderResult = () => {
    const severityTone = toneFor("severity", null, analysisResult.severityScore);
    const healingTone = toneFor("healing", analysisResult.healingStatus);
    const typeTone = toneFor("type");
    const tiles = [
      {
        label: "Wound type",
        value: analysisResult.woundType,
        tone: typeTone,
        note: analysisResult.woundTypeLocked ? "Set at first scan" : "Kept for this wound",
      },
      {
        label: "Severity",
        value: analysisResult.severityLevel,
        tone: severityTone,
        note: analysisResult.pipelineResults?.severitySizeAdjusted ? "Raised: large wound" : null,
      },
      {
        label: "Healing",
        value: analysisResult.healingStatus,
        tone: healingTone,
        note: analysisResult.pipelineResults?.sizeBasis === "cm2" ? "Size compared in cm²" : null,
      },
    ];
    const seg = analysisResult.pipelineResults?.segmentation || {};
    const card = analysisResult.pipelineResults?.colourCard;

    return (
      <div className="app-card" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {renderWarnings()}
        {renderSimilarityBanner()}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <CircularGauge score={analysisResult.severityScore} subtitle="SEVERITY SCORE" size={130} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
          {tiles.map((t) => (
            <div
              key={t.label}
              style={{
                background: t.tone.bg,
                border: `1px solid ${t.tone.border}`,
                borderRadius: "12px",
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "0.64rem", fontWeight: "700", color: t.tone.label, textTransform: "uppercase", display: "block" }}>
                {t.label}
              </span>
              <strong style={{ fontSize: "0.82rem", color: t.tone.text, marginTop: "2px", display: "block", overflowWrap: "anywhere" }}>
                {t.value || "—"}
              </strong>
              {t.note && (
                <span style={{ fontSize: "0.6rem", color: t.tone.label, display: "block", marginTop: "2px", opacity: 0.85 }}>
                  {t.note}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "8px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "10px 14px",
          }}
        >
          <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>
            Wound size
          </span>
          <span style={{ textAlign: "right" }}>
            <strong style={{ fontSize: "0.95rem", color: "#1E293B" }}>
              {seg.wound_area_cm2 != null ? `${seg.wound_area_cm2.toFixed(1)} cm²` : "Not measured"}
            </strong>
            <span style={{ fontSize: "0.66rem", color: "#94A3B8", display: "block" }}>
              {card?.detected ? "Scaled with the colour card" : "Colour card not found in photo"}
            </span>
          </span>
        </div>

        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "12px 14px" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
            Suggested care plan
          </span>
          <p style={{ fontSize: "0.84rem", color: "#1E293B", lineHeight: 1.45, fontWeight: "500" }}>
            {analysisResult.recommendation}
          </p>
          <p style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: "8px" }}>
            AI-generated decision support. Confirm with clinical judgement.
          </p>
        </div>

        <div style={{ textAlign: "center", fontSize: "0.76rem", color: "#64748B" }}>
          Will be logged to <strong style={{ color: "#0F172A" }}>{woundName}</strong> on{" "}
          <strong style={{ color: "#0F172A" }}>{formatDisplayDate(scanDate, true)}</strong>
        </div>

        {saveError && (
          <div role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECDD3", color: "#991B1B", borderRadius: "10px", padding: "9px 12px", fontSize: "0.8rem", fontWeight: 600 }}>
            {saveError}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "10px" }}>
          <button type="button" onClick={handleRetake} className="btn-secondary" style={{ fontSize: "0.85rem", padding: "12px 8px" }}>
            <Camera size={16} />
            <span>Retake</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="btn-primary"
            style={{ fontSize: "0.88rem", padding: "12px 8px", opacity: canSave ? 1 : 0.5 }}
          >
            {isSaving ? <RefreshCw size={16} className="spin-animation" /> : <Save size={16} />}
            <span>{isSaving ? "Saving…" : "Save to timeline"}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
      {renderStepper()}
      {currentStep === 1 && renderStepPatient()}
      {currentStep === 2 && renderStepPhoto()}
      {currentStep === 3 && (
        <>
          {renderContextSummary()}
          {analysisError ? renderAnalysisError() : isAnalyzing || !analysisResult ? renderAnalyzing() : renderResult()}
        </>
      )}
    </div>
  );
};
