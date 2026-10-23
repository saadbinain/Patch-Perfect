import React, { useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  CheckCircle2,
  ArrowLeftRight,
  Camera,
  Plus,
  FilePlus2,
  MapPin,
  Phone,
  AlertTriangle,
  FileText,
  Activity,
  Layers,
  Calendar,
} from "lucide-react";
import { CircularGauge } from "../Common/CircularGauge";
import { SeverityTrendChart } from "../Common/SeverityTrendChart";
import { api } from "../../services/api";

export const PatientDetailScreen = ({
  patient,
  viewingWoundId,
  setViewingWoundId,
  onBack,
  onStartScanForPatient,
  onPatientUpdated,
}) => {
  const [selectedScanIdx, setSelectedScanIdx] = useState(0);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isAddingWound, setIsAddingWound] = useState(false);
  const [isSavingWound, setIsSavingWound] = useState(false);
  const [newWoundForm, setNewWoundForm] = useState({
    anatomicalLocation: "",
    woundType: "Pending AI Scan",
    label: "",
  });

  if (!patient) return null;

  // Standardize wounds list for this patient
  const wounds =
    patient.wounds && patient.wounds.length > 0
      ? patient.wounds
      : [
          {
            id: "primary",
            label: patient.anatomicalLocation
              ? `${patient.anatomicalLocation} (${patient.woundType || "Primary"})`
              : patient.woundType || "Primary Wound",
            wound_type: patient.woundType || "Diabetic Wound",
            anatomical_location: patient.anatomicalLocation || "Lower Extremity",
            status: patient.status || "AWAITING SCAN",
            status_type: patient.statusType || "warning",
            current_severity: patient.currentSeverity,
            current_severity_label: patient.currentSeverityLabel || "Awaiting Scan",
            healing_status: patient.healingStatus || "Not Assessed",
            ai_recommendation: patient.aiRecommendation,
            scans: patient.scans || [],
            trend_data: patient.trend_data || patient.trendData || [],
          },
        ];

  // Active wound object when viewing specific wound details
  const activeWoundIndex = wounds.findIndex((w) => (w.id || "primary") === viewingWoundId);
  const activeWound = activeWoundIndex >= 0 ? wounds[activeWoundIndex] : wounds[0];

  // Scans for the active wound, sorted chronologically: oldest (Day 1) first, newest last
  const rawScans =
    activeWound?.scans && activeWound.scans.length > 0
      ? activeWound.scans
      : wounds.length === 1
      ? patient.scans || []
      : [];

  const chronologicalScans = [...rawScans].sort((a, b) => {
    const timeA = a.scan_date ? new Date(a.scan_date).getTime() : 0;
    const timeB = b.scan_date ? new Date(b.scan_date).getTime() : 0;
    return timeA - timeB;
  });

  const totalScans = chronologicalScans.length;
  // Active selected scan (bounds checked)
  const safeIdx = Math.max(0, Math.min(selectedScanIdx, Math.max(0, totalScans - 1)));
  const activeScan = chronologicalScans[safeIdx] || null;

  const day1Scan = totalScans > 0 ? chronologicalScans[0] : null;
  const latestScan = totalScans > 0 ? chronologicalScans[totalScans - 1] : null;

  // Helper for tissue stats
  const getTissueStats = (scan) => {
    if (!scan) return { granulation: 50, slough: 35, necrotic: 15 };
    if (scan.tissueStats) return scan.tissueStats;
    if (scan.tissue_stats) return scan.tissue_stats;
    return {
      granulation: scan.granulation_percent ?? 50,
      slough: scan.slough_percent ?? 35,
      necrotic: scan.necrotic_percent ?? 15,
    };
  };

  const activeTissue = getTissueStats(activeScan);
  const day1Tissue = getTissueStats(day1Scan);
  const latestTissue = getTissueStats(latestScan);

  const getScanTitle = (idx) => {
    return `Day ${idx + 1}`;
  };

  const handleSaveNewWound = async (e) => {
    e.preventDefault();
    if (!newWoundForm.anatomicalLocation.trim()) return;

    setIsSavingWound(true);
    const pId = patient.id || patient.custom_id;
    const loc = newWoundForm.anatomicalLocation.trim();
    const finalLabel = newWoundForm.label.trim() || loc;

    await api.addWoundToPatient(pId, {
      anatomicalLocation: loc,
      woundType: "Pending AI Scan",
      label: finalLabel,
    });

    setIsSavingWound(false);
    setIsAddingWound(false);
    setNewWoundForm({
      anatomicalLocation: "",
      woundType: "Pending AI Scan",
      label: "",
    });

    if (onPatientUpdated) {
      await onPatientUpdated();
    }
  };

  const formattedPatientName = patient.name
    ? patient.name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "Patient";

  return (
    <div
      className="patient-detail-screen"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "14px 14px 48px 14px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {!viewingWoundId ? (
        /* ========================================================
           VIEW 1: PATIENT PROFILE & LIST OF WOUNDS (FULL PAGE)
           ======================================================== */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Professional EHR Patient Header Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #8B1E1E 0%, #641212 100%)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "800",
                    fontSize: "1.2rem",
                    flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(139, 30, 30, 0.28)",
                  }}
                >
                  {patient.name?.charAt(0).toUpperCase() || "P"}
                </div>

                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "800",
                        color: "#0F172A",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {formattedPatientName}
                    </h2>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: "800",
                        color: "#8B1E1E",
                        background: "#FEF2F2",
                        border: "1px solid #FECDD3",
                        padding: "2px 7px",
                        borderRadius: "6px",
                      }}
                    >
                      #{patient.id || patient.custom_id}
                    </span>
                  </div>

                  <span style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: "600", marginTop: "3px" }}>
                    {patient.age} yrs • {patient.gender || "Patient"} • Clinical Record
                  </span>
                </div>
              </div>
            </div>

            {/* Demographics Details Grid */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "14px",
                padding: "12px 14px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span
                  style={{
                    color: "#94A3B8",
                    fontSize: "0.68rem",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "3px",
                  }}
                >
                  <Phone size={12} /> Contact
                </span>
                <strong style={{ color: "#1E293B", fontSize: "0.82rem" }}>
                  {patient.phone || "Not on file"}
                </strong>
              </div>

              <div>
                <span
                  style={{
                    color: "#94A3B8",
                    fontSize: "0.68rem",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "3px",
                  }}
                >
                  <AlertTriangle size={12} /> Allergies
                </span>
                {patient.allergies && patient.allergies.toLowerCase() !== "none" && patient.allergies.trim() !== "" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#FEF2F2",
                      border: "1px solid #FECDD3",
                      color: "#991B1B",
                      padding: "1px 7px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: "700",
                    }}
                  >
                    <span>⚠️</span>
                    <span>{patient.allergies}</span>
                  </span>
                ) : (
                  <span style={{ color: "#059669", fontSize: "0.8rem", fontWeight: "700" }}>
                    ✓ None Reported
                  </span>
                )}
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <span
                  style={{
                    color: "#94A3B8",
                    fontSize: "0.68rem",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "3px",
                  }}
                >
                  <MapPin size={12} /> Care Facility / Address
                </span>
                <strong style={{ color: "#334155", fontSize: "0.82rem" }}>
                  {patient.address || "Medical Plaza Care Facility"}
                </strong>
              </div>

              {patient.notes && (
                <div style={{ gridColumn: "span 2", paddingTop: "8px", borderTop: "1px dashed #E2E8F0" }}>
                  <span
                    style={{
                      color: "#94A3B8",
                      fontSize: "0.68rem",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "3px",
                    }}
                  >
                    <FileText size={12} /> Physician & Clinical Notes
                  </span>
                  <p style={{ color: "#334155", margin: 0, fontSize: "0.78rem", lineHeight: "1.4" }}>
                    {patient.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Wounds Section Header & Add Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "800", color: "#0F172A", margin: 0 }}>
                Wound Profiles ({wounds.length})
              </h3>
              <p style={{ fontSize: "0.74rem", color: "#64748B", margin: "2px 0 0 0" }}>
                Select a wound site below to open its assessment timeline
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingWound(!isAddingWound)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: isAddingWound ? "#F1F5F9" : "linear-gradient(135deg, #B91C1C 0%, #8B1E1E 100%)",
                border: isAddingWound ? "1px solid #CBD5E1" : "none",
                color: isAddingWound ? "#475569" : "#FFFFFF",
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "0.78rem",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: isAddingWound ? "none" : "0 3px 10px rgba(139,30,30,0.25)",
                whiteSpace: "nowrap",
              }}
            >
              {isAddingWound ? (
                <span>Cancel</span>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Add Site</span>
                </>
              )}
            </button>
          </div>

          {/* INLINE FORM: ADD NEW WOUND SITE */}
          {isAddingWound && (
            <div
              style={{
                background: "#FFF8F8",
                border: "1.5px solid #FECDD3",
                borderRadius: "18px",
                padding: "16px",
                boxShadow: "0 4px 12px rgba(139,30,30,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <FilePlus2 size={18} color="#8B1E1E" />
                <h4 style={{ fontSize: "0.92rem", fontWeight: "800", color: "#8B1E1E", margin: 0 }}>
                  Register New Wound Site
                </h4>
              </div>

              <form onSubmit={handleSaveNewWound} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                    Anatomical Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sacrum, Right Knee, Left Heel, Medial Malleolus"
                    value={newWoundForm.anatomicalLocation}
                    onChange={(e) => setNewWoundForm({ ...newWoundForm, anatomicalLocation: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.85rem",
                      outline: "none",
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                    Custom Label / Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sacral Decubitus Stage 2"
                    value={newWoundForm.label}
                    onChange={(e) => setNewWoundForm({ ...newWoundForm, label: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.85rem",
                      outline: "none",
                      backgroundColor: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.74rem",
                    color: "#065F46",
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    padding: "8px 12px",
                    borderRadius: "10px",
                  }}
                >
                  <span>✨</span>
                  <span>Wound type (Diabetic, Pressure, Venous) is automatically classified by AI upon image scan.</span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setIsAddingWound(false)}
                    className="btn-secondary"
                    style={{ padding: "8px 16px", fontSize: "0.8rem" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingWound || !newWoundForm.anatomicalLocation.trim()}
                    className="btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.8rem" }}
                  >
                    {isSavingWound ? "Saving..." : "Save Wound Site"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Wounds Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {wounds.map((w, index) => {
              const woundSite = w.anatomical_location || w.anatomicalLocation || "Wound Site";
              const woundKind = w.wound_type || w.woundType || "Diabetic Wound";
              const scanList =
                w.scans && w.scans.length > 0
                  ? w.scans
                  : wounds.length === 1
                  ? patient.scans || []
                  : [];
              const currentSev = w.current_severity ?? w.currentSeverity ?? null;
              const statusType = w.status_type || w.statusType || (currentSev >= 4 ? "danger" : "info");
              const statusLabel = w.status || (currentSev >= 4 ? "ACTION NEEDED" : "STABLE");

              return (
                <div
                  key={w.id || index}
                  onClick={() => {
                    setViewingWoundId(w.id || "primary");
                    setSelectedScanIdx(0);
                    setIsCompareMode(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "18px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "all 0.15s ease",
                  }}
                  className="app-card-clickable"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                    {/* Number Badge */}
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #8B1E1E 0%, #641212 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        fontSize: "1rem",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(139,30,30,0.22)",
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Wound Details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <h4
                          style={{
                            fontSize: "0.98rem",
                            fontWeight: "800",
                            color: "#0F172A",
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {woundSite}
                        </h4>
                        <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: "500" }}>
                          • {woundKind}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                        {/* Status pill */}
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: "800",
                            padding: "2px 8px",
                            borderRadius: "20px",
                            background: statusType === "danger" ? "#FEF2F2" : "#ECFDF5",
                            border: `1px solid ${statusType === "danger" ? "#FECDD3" : "#A7F3D0"}`,
                            color: statusType === "danger" ? "#991B1B" : "#065F46",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              backgroundColor: statusType === "danger" ? "#DC2626" : "#10B981",
                            }}
                          />
                          <span>{statusLabel}</span>
                        </span>

                        {currentSev !== null ? (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: "800",
                              color: currentSev >= 4 ? "#991B1B" : currentSev >= 3 ? "#92400E" : "#065F46",
                              background: currentSev >= 4 ? "#FEF2F2" : currentSev >= 3 ? "#FFFBEB" : "#ECFDF5",
                              border: `1px solid ${currentSev >= 4 ? "#FECDD3" : currentSev >= 3 ? "#FDE68A" : "#A7F3D0"}`,
                              padding: "2px 6px",
                              borderRadius: "6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Grade {currentSev}/5
                          </span>
                        ) : null}

                        <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: "600", whiteSpace: "nowrap" }}>
                          • {scanList.length} {scanList.length === 1 ? "scan logged" : "scans logged"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8B1E1E", fontWeight: "800", fontSize: "0.82rem", flexShrink: 0 }}>
                    <span>Timeline</span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================
           VIEW 2: SPECIFIC WOUND DETAILS & TIMELINE (FULL PAGE)
           ======================================================== */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Wound Header Title Card */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "18px",
              padding: "16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: "800",
                  letterSpacing: "0.08em",
                  color: "#8B1E1E",
                  textTransform: "uppercase",
                }}
              >
                WOUND #{activeWoundIndex + 1} ASSESSMENT TIMELINE
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: "700",
                  background: "#F1F5F9",
                  color: "#64748B",
                  padding: "2px 7px",
                  borderRadius: "6px",
                }}
              >
                {totalScans} {totalScans === 1 ? "Scan Logged" : "Scans Logged"}
              </span>
            </div>

            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: "800",
                color: "#0F172A",
                margin: "4px 0 0 0",
              }}
            >
              {activeWound.anatomical_location || activeWound.label || "Wound Site"}
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
              <span style={{ fontSize: "0.82rem", color: "#64748B", fontWeight: "600" }}>
                Type: <strong style={{ color: "#334155" }}>{activeWound.wound_type || "Diabetic Wound"}</strong>
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: "800",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: (activeWound.status_type || activeWound.statusType) === "danger" ? "#FEE2E2" : "#DCFCE7",
                  color: (activeWound.status_type || activeWound.statusType) === "danger" ? "#991B1B" : "#166534",
                }}
              >
                {activeWound.status || "AWAITING SCAN"}
              </span>
            </div>
          </div>

          {/* BACKTRACKING & TIME-TRAVEL CONTROLS CARD */}
          {totalScans > 0 ? (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "18px",
                padding: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Backtrack Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <History size={18} color="#8B1E1E" />
                  <span style={{ fontSize: "0.86rem", fontWeight: "800", color: "#0F172A", textTransform: "uppercase" }}>
                    Scan Backtracking & Inspector
                  </span>
                </div>

                {totalScans > 1 && (
                  <button
                    onClick={() => setIsCompareMode(!isCompareMode)}
                    style={{
                      background: isCompareMode ? "#8B1E1E" : "#FFFFFF",
                      color: isCompareMode ? "#FFFFFF" : "#8B1E1E",
                      border: "1.5px solid #8B1E1E",
                      borderRadius: "8px",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                      fontWeight: "800",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <ArrowLeftRight size={13} />
                    <span>{isCompareMode ? "Exit Compare" : "Compare Day 1 vs Latest"}</span>
                  </button>
                )}
              </div>

              {/* Step Through Scans Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC",
                  padding: "10px 14px",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <button
                  disabled={safeIdx === 0}
                  onClick={() => setSelectedScanIdx((prev) => Math.max(0, prev - 1))}
                  style={{
                    background: safeIdx === 0 ? "#F1F5F9" : "#FEE2E2",
                    color: safeIdx === 0 ? "#94A3B8" : "#8B1E1E",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.76rem",
                    fontWeight: "700",
                    cursor: safeIdx === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Earlier</span>
                </button>

                <div style={{ textAlign: "center" }}>
                  <strong style={{ fontSize: "0.92rem", color: "#0F172A", display: "block" }}>
                    {getScanTitle(safeIdx)}
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "#64748B", display: "flex", alignItems: "center", gap: "3px", justifyContent: "center" }}>
                    <Calendar size={11} />
                    {activeScan?.date || activeScan?.scan_date_formatted || "Assessment Date"}
                  </span>
                </div>

                <button
                  disabled={safeIdx === totalScans - 1}
                  onClick={() => setSelectedScanIdx((prev) => Math.min(totalScans - 1, prev + 1))}
                  style={{
                    background: safeIdx === totalScans - 1 ? "#F1F5F9" : "#FEE2E2",
                    color: safeIdx === totalScans - 1 ? "#94A3B8" : "#8B1E1E",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.76rem",
                    fontWeight: "700",
                    cursor: safeIdx === totalScans - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>Later</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Quick Jump Pills for All Historical Scans */}
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
                {chronologicalScans.map((s, idx) => (
                  <button
                    key={s.id || idx}
                    onClick={() => {
                      setSelectedScanIdx(idx);
                      setIsCompareMode(false);
                    }}
                    style={{
                      background: safeIdx === idx && !isCompareMode ? "#8B1E1E" : "#F8FAFC",
                      color: safeIdx === idx && !isCompareMode ? "#FFFFFF" : "#334155",
                      border: safeIdx === idx && !isCompareMode ? "1.5px solid #8B1E1E" : "1px solid #CBD5E1",
                      borderRadius: "10px",
                      padding: "6px 12px",
                      fontSize: "0.75rem",
                      fontWeight: "800",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {`Day ${idx + 1}`}
                  </button>
                ))}
              </div>

              {/* SIDE-BY-SIDE COMPARISON VIEW (DAY 1 VS LATEST) */}
              {isCompareMode && day1Scan && latestScan && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {/* Day 1 Card */}
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "2px solid #3B82F6",
                        borderRadius: "14px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "#1D4ED8", textTransform: "uppercase" }}>
                        Day 1 (Baseline)
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                        {day1Scan.date || day1Scan.scan_date_formatted}
                      </span>

                      {/* Image Thumbnail */}
                      <div
                        style={{
                          width: "100%",
                          height: "120px",
                          borderRadius: "10px",
                          backgroundColor: "#E2E8F0",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #CBD5E1",
                        }}
                      >
                        {day1Scan.image || day1Scan.image_base64 ? (
                          <img
                            src={day1Scan.image || day1Scan.image_base64}
                            alt="Day 1 Scan"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Day 1 Photo</span>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: "0.76rem", color: "#334155", display: "block" }}>
                          Severity: <strong style={{ color: "#D97706" }}>Score {day1Scan.severity_score || day1Scan.severityScore}</strong>
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#166534", display: "block" }}>
                          Granulation: <strong>{day1Tissue.granulation}%</strong>
                        </span>
                      </div>
                    </div>

                    {/* Latest Scan Card */}
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "2px solid #10B981",
                        borderRadius: "14px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "#047857", textTransform: "uppercase" }}>
                        Latest Follow-Up
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                        {latestScan.date || latestScan.scan_date_formatted}
                      </span>

                      {/* Image Thumbnail */}
                      <div
                        style={{
                          width: "100%",
                          height: "120px",
                          borderRadius: "10px",
                          backgroundColor: "#E2E8F0",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #CBD5E1",
                        }}
                      >
                        {latestScan.image || latestScan.image_base64 ? (
                          <img
                            src={latestScan.image || latestScan.image_base64}
                            alt="Latest Scan"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Latest Photo</span>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: "0.76rem", color: "#334155", display: "block" }}>
                          Severity: <strong style={{ color: "#D97706" }}>Score {latestScan.severity_score || latestScan.severityScore}</strong>
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#166534", display: "block" }}>
                          Granulation: <strong>{latestTissue.granulation}%</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Healing Trajectory Summary Delta */}
                  <div
                    style={{
                      background: "#ECFDF5",
                      border: "1px solid #A7F3D0",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      color: "#065F46",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckCircle2 size={18} color="#059669" flexShrink={0} />
                    <span>
                      Progress: Severity changed from Score {day1Scan.severity_score || day1Scan.severityScore} to {latestScan.severity_score || latestScan.severityScore} with {latestTissue.granulation}% granulation tissue.
                    </span>
                  </div>
                </div>
              )}

              {/* SINGLE HISTORICAL SCAN DETAIL INSPECTOR */}
              {!isCompareMode && activeScan && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "16px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* Photo & Core Diagnostics */}
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div
                      style={{
                        width: "96px",
                        height: "96px",
                        borderRadius: "12px",
                        backgroundColor: "#E2E8F0",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "2px solid #8B1E1E",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      {activeScan.image || activeScan.image_base64 ? (
                        <img
                          src={activeScan.image || activeScan.image_base64}
                          alt="Historical Wound Scan"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ textAlign: "center", padding: "6px", color: "#94A3B8" }}>
                          <Camera size={22} style={{ margin: "0 auto 2px auto" }} />
                          <span style={{ fontSize: "0.68rem", display: "block" }}>Scan Photo</span>
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.92rem", fontWeight: "800", color: "#0F172A" }}>
                          {activeScan.wound_type || activeScan.woundType || patient.woundType}
                        </span>
                        {safeIdx === totalScans - 1 && (
                          <span style={{ fontSize: "0.62rem", fontWeight: "800", background: "#FEE2E2", color: "#991B1B", padding: "1px 6px", borderRadius: "4px" }}>
                            LATEST
                          </span>
                        )}
                        {safeIdx === 0 && (
                          <span style={{ fontSize: "0.62rem", fontWeight: "800", background: "#DBEAFE", color: "#1D4ED8", padding: "1px 6px", borderRadius: "4px" }}>
                            DAY 1
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: "0.78rem", color: "#64748B", display: "block", marginTop: "3px" }}>
                        Severity: <strong style={{ color: "#D97706" }}>{activeScan.severity_level || activeScan.severityLevel || "Moderate"}</strong> (Score: {activeScan.severity_score || activeScan.severityScore})
                      </span>

                      <span style={{ fontSize: "0.76rem", color: "#166534", fontWeight: "700", display: "block", marginTop: "3px" }}>
                        Healing Status: {activeScan.healing_status || activeScan.healingStatus || "Stable"}
                      </span>
                    </div>
                  </div>

                  {/* Tissue Breakdown Bars for this Historical Scan */}
                  <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                      Tissue Segmentation (FPN+VGG16)
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "0.74rem", textAlign: "center" }}>
                      <div style={{ background: "#F0FDF4", padding: "6px", borderRadius: "8px", border: "1px solid #BBF7D0", color: "#166534" }}>
                        Pink Granulation: <strong style={{ display: "block", fontSize: "0.84rem" }}>{activeTissue.granulation}%</strong>
                      </div>
                      <div style={{ background: "#FFFBEB", padding: "6px", borderRadius: "8px", border: "1px solid #FDE68A", color: "#92400E" }}>
                        Slough Exudate: <strong style={{ display: "block", fontSize: "0.84rem" }}>{activeTissue.slough}%</strong>
                      </div>
                      <div style={{ background: "#FEF2F2", padding: "6px", borderRadius: "8px", border: "1px solid #FECDD3", color: "#991B1B" }}>
                        Necrotic Eschar: <strong style={{ display: "block", fontSize: "0.84rem" }}>{activeTissue.necrotic}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendation on that specific scan day */}
                  {(activeScan.recommendation || activeScan.ai_recommendation) && (
                    <div style={{ background: "#FFFBF7", border: "1px solid #FED7AA", borderRadius: "12px", padding: "10px 12px" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#C2410C", textTransform: "uppercase", display: "block", marginBottom: "3px" }}>
                        Clinical Plan for {activeScan.date || activeScan.scan_date_formatted}:
                      </span>
                      <p style={{ fontSize: "0.8rem", color: "#431407", margin: 0, lineHeight: "1.4" }}>
                        {activeScan.recommendation || activeScan.ai_recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "20px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "18px", textAlign: "center", color: "#64748B", fontSize: "0.84rem" }}>
              No scan history recorded yet for this wound site. Scan a photo below to start the timeline.
            </div>
          )}

          {/* Current Severity Meter Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "18px 14px",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <CircularGauge
              score={activeWound.current_severity ?? activeWound.currentSeverity ?? patient.currentSeverity ?? null}
              label={activeWound.current_severity_label || activeWound.currentSeverityLabel || patient.currentSeverityLabel || "Awaiting Scan"}
              subtitle={`SEVERITY: ${activeWound.label || activeWound.anatomical_location || "WOUND"}`}
              size={130}
            />
          </div>

          {/* Longitudinal Trend Chart Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "16px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Activity size={18} color="#8B1E1E" />
                <h4 style={{ fontSize: "0.98rem", fontWeight: "800", color: "#1E293B", margin: 0 }}>
                  Severity Healing Trajectory
                </h4>
              </div>
              <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: "600" }}>
                {activeWound.label || "Selected Wound Site"}
              </span>
            </div>
            <SeverityTrendChart data={activeWound.trend_data || activeWound.trendData || (wounds.length === 1 ? (patient.trendData || patient.trend_data || []) : [])} />
          </div>

          {/* Full Chronological Scan Archive List */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "16px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
              <Layers size={18} color="#8B1E1E" />
              <h4 style={{ fontSize: "0.98rem", fontWeight: "800", color: "#1E293B", margin: 0 }}>
                {activeWound.label || "Wound"} Scan Archive ({totalScans})
              </h4>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {chronologicalScans.map((scan, idx) => (
                <div
                  key={scan.id || idx}
                  onClick={() => {
                    setSelectedScanIdx(idx);
                    setIsCompareMode(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: safeIdx === idx && !isCompareMode ? "#FFF1F2" : "#F8FAFC",
                    borderRadius: "14px",
                    border: safeIdx === idx && !isCompareMode ? "1.5px solid #8B1E1E" : "1px solid #E2E8F0",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: idx === 0 ? "#3B82F6" : idx === totalScans - 1 ? "#8B1E1E" : "#94A3B8",
                      }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1E293B" }}>
                          Day {idx + 1}
                        </span>
                        {(scan.date || scan.scan_date_formatted) && (
                          <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                            • {scan.date || scan.scan_date_formatted}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.76rem", color: "#64748B" }}>
                        Severity: <strong style={{ color: "#D97706" }}>{scan.severity_level || scan.severityLevel || "Moderate"}</strong> (Score: {scan.severity_score || scan.severityScore})
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: "700" }}>
                    {scan.healing_status || scan.healingStatus || "Stable"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Launch AI Scan Button */}
          <div style={{ marginTop: "4px" }}>
            <button
              onClick={() => {
                if (onStartScanForPatient) onStartScanForPatient(patient, activeWound);
              }}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: "16px",
                fontSize: "0.92rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: "0 6px 20px rgba(139,30,30,0.35)",
              }}
            >
              <Camera size={20} />
              <span>Scan Image for {activeWound.label || activeWound.anatomical_location || "Wound"}</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
