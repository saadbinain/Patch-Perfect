import React from "react";
import { X, CheckCircle, AlertTriangle, Bandage } from "lucide-react";

export const GuidelineDetailModal = ({ guideline, isOpen, onClose }) => {
  if (!isOpen || !guideline) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90%" }}
      >
        <div className="sheet-handle-bar"></div>

        {/* Header */}
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
              CLINICAL PROTOCOL
            </span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
              {guideline.title}
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#64748B" }}>
              {guideline.subtitle}
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

        {/* Description */}
        <p style={{ fontSize: "0.86rem", color: "#334155", lineHeight: "1.5", marginBottom: "16px" }}>
          {guideline.description}
        </p>

        {/* Key Principles */}
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "0.92rem", fontWeight: "700", color: "#1E293B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle size={16} color="#16A34A" /> Key Management Principles
          </h4>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {guideline.keyPrinciples.map((item, idx) => (
              <li
                key={idx}
                style={{
                  fontSize: "0.8rem",
                  color: "#475569",
                  background: "#F8FAFC",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  borderLeft: "3px solid #16A34A",
                  lineHeight: "1.4",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Dressings */}
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "0.92rem", fontWeight: "700", color: "#1E293B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Bandage size={16} color="#3B82F6" /> Recommended Dressings
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {guideline.recommendedDressings.map((d, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "0.8rem",
                  color: "#1E3A8A",
                  background: "#EFF6FF",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #DBEAFE",
                }}
              >
                • {d}
              </div>
            ))}
          </div>
        </div>

        {/* Red Flags */}
        <div>
          <h4 style={{ fontSize: "0.92rem", fontWeight: "700", color: "#991B1B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={16} color="#DC2626" /> Critical Red Flags (Urgent Escalation)
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {guideline.redFlags.map((flag, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "0.8rem",
                  color: "#991B1B",
                  background: "#FEF2F2",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #FECACA",
                }}
              >
                ⚠️ {flag}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-secondary"
          style={{ width: "100%", marginTop: "24px" }}
        >
          Close Protocol
        </button>
      </div>
    </div>
  );
};
