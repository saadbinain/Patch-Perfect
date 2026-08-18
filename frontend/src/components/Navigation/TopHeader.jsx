import React from "react";
import { Pill, ArrowLeft, X } from "lucide-react";

export const TopHeader = ({ title = "Patch Perfect AI", isSubscreen = false, onBack, onCancel, showBrand = true }) => {
  if (isSubscreen) {
    return (
      <header className="top-app-bar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                padding: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#FFFFFF", letterSpacing: "-0.01em" }}>
            {title}
          </h2>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </header>
    );
  }

  return (
    <header className="top-app-bar">
      <div className="brand-header">
        <div className="brand-icon-wrap">
          <Pill size={20} />
        </div>
        <h1 className="brand-title">{title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "0.68rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Clinic Mobile
        </span>
      </div>
    </header>
  );
};
