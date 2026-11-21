import React from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { SEVERITY_MAX, isSevere, isModerate } from "../../services/severityScale";

export const PatientCard = ({ patient, isSelected = false, onClick }) => {
  const getInitials = (name) => {
    if (!name) return "PT";
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const formatName = (name) => {
    if (!name) return "Patient";
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const primaryWound = patient.wounds?.[0] || patient.wound_profile || {};
  const severityScore = primaryWound.current_severity ?? patient.currentSeverity ?? null;
  const anatomicalLocation = primaryWound.anatomical_location || patient.anatomicalLocation || "Lower Extremity";
  const woundType = primaryWound.wound_type || patient.woundType || "Diabetic Wound";
  const status = (patient.status || "AWAITING SCAN").toUpperCase();
  const statusType = patient.statusType || (isSevere(severityScore) ? "danger" : "info");

  // Determine status color scheme & icon
  const getStatusConfig = () => {
    if (statusType === "danger" || status === "ACTION NEEDED" || isSevere(severityScore)) {
      return {
        bg: "#FEF2F2",
        border: "#FECDD3",
        text: "#991B1B",
        dot: "#DC2626",
        label: "Action Needed",
      };
    }
    if (statusType === "success" || status === "IMPROVING" || patient.healingStatus === "Improving") {
      return {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        text: "#065F46",
        dot: "#10B981",
        label: "Improving",
      };
    }
    if (status === "STABLE" || patient.healingStatus === "Stable") {
      return {
        bg: "#F0FDFA",
        border: "#99F6E4",
        text: "#0F766E",
        dot: "#0D9488",
        label: "Stable",
      };
    }
    return {
      bg: "#FFFBEB",
      border: "#FDE68A",
      text: "#92400E",
      dot: "#F59E0B",
      label: "Awaiting Scan",
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={`app-card app-card-clickable ${isSelected ? "selected-card" : ""}`}
      onClick={onClick}
      style={{
        padding: "13px 15px",
        borderRadius: "18px",
        backgroundColor: "#FFFFFF",
        border: isSelected ? "2px solid #8B1E1E" : "1px solid #E2E8F0",
        boxShadow: isSelected ? "0 6px 18px rgba(139, 30, 30, 0.12)" : "0 2px 6px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: "9px",
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Top Row: Avatar + Name/ID + Status Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "11px", minWidth: 0 }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #8B1E1E 0%, #641212 100%)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "0.86rem",
              letterSpacing: "0.02em",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(139, 30, 30, 0.2)",
            }}
          >
            {getInitials(patient.name)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h4
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "800",
                  color: "#0F172A",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {formatName(patient.name)}
              </h4>
              <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: "700" }}>
                #{patient.id || patient.custom_id}
              </span>
            </div>
            <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: "500", marginTop: "1px" }}>
              {woundType}
            </span>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div
          style={{
            background: statusConfig.bg,
            border: `1px solid ${statusConfig.border}`,
            color: statusConfig.text,
            padding: "3px 9px",
            borderRadius: "20px",
            fontSize: "0.7rem",
            fontWeight: "800",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: statusConfig.dot,
            }}
          />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#F1F5F9", width: "100%" }} />

      {/* Bottom Meta Row: Location Chip + Severity Grade + Timestamp + Arrow */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "nowrap", overflow: "hidden", minWidth: 0 }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: "600",
              color: "#475569",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              padding: "2px 7px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              whiteSpace: "nowrap",
            }}
          >
            <MapPin size={10} color="#64748B" />
            <span>{anatomicalLocation}</span>
          </span>

          {severityScore !== null ? (
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: "800",
                color: isSevere(severityScore) ? "#991B1B" : isModerate(severityScore) ? "#92400E" : "#065F46",
                background: isSevere(severityScore) ? "#FEF2F2" : isModerate(severityScore) ? "#FFFBEB" : "#ECFDF5",
                border: `1px solid ${isSevere(severityScore) ? "#FECDD3" : isModerate(severityScore) ? "#FDE68A" : "#A7F3D0"}`,
                padding: "2px 7px",
                borderRadius: "6px",
                whiteSpace: "nowrap",
              }}
            >
              Grade {severityScore}/{SEVERITY_MAX}
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: "600",
                color: "#94A3B8",
                background: "#F8FAFC",
                padding: "2px 6px",
                borderRadius: "6px",
                whiteSpace: "nowrap",
              }}
            >
              Unscored
            </span>
          )}

          {patient.wounds && patient.wounds.length > 1 && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: "700",
                color: "#8B1E1E",
                background: "#FFF1F2",
                border: "1px solid #FECDD3",
                padding: "2px 6px",
                borderRadius: "6px",
                whiteSpace: "nowrap",
              }}
            >
              {patient.wounds.length} sites
            </span>
          )}
        </div>

        {/* Timestamp and disclosure chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <span style={{ fontSize: "0.7rem", color: "#94A3B8", fontWeight: "600", whiteSpace: "nowrap" }}>
            {patient.lastUpdated}
          </span>
          <ChevronRight size={15} color="#CBD5E1" />
        </div>
      </div>
    </div>
  );
};
