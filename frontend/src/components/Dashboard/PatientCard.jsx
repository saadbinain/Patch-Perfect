import React from "react";
import { StatusBadge } from "../Common/StatusBadge";

export const PatientCard = ({ patient, isSelected = false, onClick }) => {
  // Get initials for avatar (e.g., Alken Valledor -> AV)
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={`app-card app-card-clickable ${isSelected ? "selected-card" : ""}`}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "16px",
        borderRadius: "16px",
        backgroundColor: "#FFFFFF",
        border: isSelected ? "2px solid #8B1E1E" : "1px solid #E2E8F0",
        boxShadow: isSelected ? "0 4px 14px rgba(139, 30, 30, 0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
        {/* Avatar Circle */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "#8B1E1E",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "1.05rem",
            letterSpacing: "0.02em",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(139, 30, 30, 0.2)",
          }}
        >
          {getInitials(patient.name)}
        </div>

        {/* Info Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4
              style={{
                fontSize: "0.98rem",
                fontWeight: "700",
                color: "#0F172A",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {patient.name}
            </h4>
            <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: "600" }}>
              #{patient.id}
            </span>
          </div>

          <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
            {patient.woundType}
          </span>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
            <StatusBadge label={patient.status} type={patient.statusType} />
            <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: "500" }}>
              {patient.lastUpdated}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
