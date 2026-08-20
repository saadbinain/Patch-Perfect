import React from "react";
import { X, Calendar, AlertCircle, ArrowRight } from "lucide-react";
import { CircularGauge } from "../Common/CircularGauge";
import { SeverityTrendChart } from "../Common/SeverityTrendChart";
import { StatusBadge } from "../Common/StatusBadge";

export const PatientTrendModal = ({ patient, isOpen, onClose, onStartScanForPatient }) => {
  if (!isOpen || !patient) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "92%" }}
      >
        {/* Handle Bar */}
        <div className="sheet-handle-bar"></div>

        {/* Modal Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: "700",
                letterSpacing: "0.08em",
                color: "#94A3B8",
                textTransform: "uppercase",
              }}
            >
              WOUND PROFILE
            </span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
              {patient.name}'s Wound
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#64748B" }}>
              Wound: <strong style={{ color: "#334155" }}>{patient.woundType}</strong> ({patient.anatomicalLocation || "Lower extremity"})
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Severity Meter */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "16px 12px",
            border: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
          }}
        >
          <CircularGauge
            score={patient.currentSeverity ?? patient.current_severity ?? null}
            label={patient.currentSeverityLabel || patient.current_severity_label || (patient.currentSeverity ? null : "Awaiting Scan")}
            subtitle="SEVERITY SCORE"
            size={120}
          />
        </div>

        {/* AI Recommendation Card */}
        <div
          style={{
            background: "#FFFBF7",
            border: "1px solid #FED7AA",
            borderRadius: "14px",
            padding: "14px 16px",
            marginTop: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <AlertCircle size={15} color="#C2410C" />
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: "700",
                letterSpacing: "0.05em",
                color: "#C2410C",
                textTransform: "uppercase",
              }}
            >
              AI RECOMMENDATION
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#431407", lineHeight: "1.4", fontWeight: "500" }}>
            {patient.aiRecommendation || patient.ai_recommendation || "New patient profile registered. Capture or upload a wound image to run AI segmentation and severity scoring."}
          </p>
        </div>

        {/* Severity Trend Section */}
        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1E293B" }}>
              Severity Trend
            </h4>
            <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: "600" }}>
              Healing Trajectory
            </span>
          </div>
          <SeverityTrendChart data={patient.trendData || patient.trend_data || []} />
        </div>

        {/* Scan Timeline */}
        <div style={{ marginTop: "22px" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#1E293B", marginBottom: "12px" }}>
            Scan Timeline
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {patient.scans && patient.scans.length > 0 ? (
              patient.scans.map((scan, idx) => (
                <div
                  key={scan.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "#F8FAFC",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: scan.isLatest ? "#8B1E1E" : "#94A3B8",
                      }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1E293B" }}>
                          {scan.date}
                        </span>
                        {scan.isLatest && (
                          <span
                            style={{
                              fontSize: "0.62rem",
                              fontWeight: "700",
                              background: "#FEE2E2",
                              color: "#991B1B",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            LATEST
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.76rem", color: "#64748B" }}>
                        Severity: <strong style={{ color: "#D97706" }}>{scan.severityLevel || "Moderate"}</strong> (Score: {scan.severityScore})
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: "0.76rem", color: "#64748B", fontWeight: "500" }}>
                    {scan.healingStatus || "Stable"}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "12px", textAlign: "center", color: "#64748B", fontSize: "0.82rem" }}>
                No prior scan images recorded for this patient.
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <div style={{ marginTop: "24px" }}>
          <button
            onClick={() => {
              onClose();
              if (onStartScanForPatient) onStartScanForPatient(patient);
            }}
            className="btn-primary"
            style={{ width: "100%" }}
          >
            <span>Scan New Assessment Image</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
