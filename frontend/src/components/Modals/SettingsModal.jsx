import React, { useState } from "react";
import {
  X,
  Settings,
  Database,
  Trash2,
  Sparkles,
  Smartphone,
  Download,
  Share,
  MoreVertical,
  PlusSquare,
  Cpu,
  CheckCircle2,
  Server,
  Info,
} from "lucide-react";

export const SettingsModal = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallNative,
  onLoadDemoData,
  onClearAllData,
  patientCount = 0,
}) => {
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  if (!isOpen) return null;

  const handleLoadDemo = () => {
    if (onLoadDemoData) {
      onLoadDemoData();
      setFeedbackMsg("Loaded 5 manuscript sample patient profiles!");
      setTimeout(() => setFeedbackMsg(""), 3500);
    }
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear all patient profiles and return to a new-user state?")) {
      if (onClearAllData) {
        onClearAllData();
        setFeedbackMsg("All patient records cleared successfully.");
        setTimeout(() => setFeedbackMsg(""), 3500);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90%", display: "flex", flexDirection: "column" }}
      >
        <div className="sheet-handle-bar"></div>

        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "#FEE2E2",
                color: "#8B1E1E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Settings size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#0F172A" }}>
                Settings & System
              </h3>
              <p style={{ fontSize: "0.76rem", color: "#64748B" }}>
                Preferences, data management, and AI pipeline
              </p>
            </div>
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
            <X size={16} />
          </button>
        </div>

        {/* Feedback Alert if triggered */}
        {feedbackMsg && (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 14px",
              borderRadius: "10px",
              background: "#ECFDF5",
              border: "1px solid #A7F3D0",
              color: "#065F46",
              fontSize: "0.82rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} color="#059669" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Scrollable Settings Sections */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
            paddingRight: "2px",
          }}
        >
          {/* SECTION 1: DATA & STORAGE MANAGEMENT */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Database size={17} color="#8B1E1E" />
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "700",
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Clinical Data Storage
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  color: "#64748B",
                  background: "#E2E8F0",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                {patientCount} {patientCount === 1 ? "Patient" : "Patients"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Load Sample Demo Profiles */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#FFFFFF",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.86rem", color: "#1E293B", display: "block" }}>
                    Load Demo Dataset
                  </strong>
                  <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                    Populate 5 sample manuscript patients with scans
                  </span>
                </div>
                <button
                  onClick={handleLoadDemo}
                  style={{
                    background: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    color: "#0F172A",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Sparkles size={14} color="#8B1E1E" />
                  <span>Load</span>
                </button>
              </div>

              {/* Clear All Patient Data */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#FFFFFF",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.86rem", color: "#991B1B", display: "block" }}>
                    Clear All Records
                  </strong>
                  <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
                    Restore empty new-user state
                  </span>
                </div>
                <button
                  onClick={handleClearData}
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECDD3",
                    color: "#991B1B",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: DEVICE APP INSTALLATION (PWA) */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Smartphone size={17} color="#8B1E1E" />
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  color: "#0F172A",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Install App on Device
              </span>
            </div>

            {deferredPrompt && (
              <button
                onClick={onInstallNative}
                className="btn-primary"
                style={{ width: "100%", padding: "11px", fontSize: "0.88rem", marginBottom: "10px" }}
              >
                <Download size={17} />
                <span>Install Patch Perfect Now</span>
              </button>
            )}

            <button
              onClick={() => setShowInstallGuide(!showInstallGuide)}
              style={{
                width: "100%",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              {showInstallGuide ? "Hide Installation Instructions ▲" : "View Add-to-Home-Screen Instructions ▼"}
            </button>

            {showInstallGuide && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>🤖 Android (Chrome):</strong>
                  <p style={{ fontSize: "0.76rem", color: "#475569", marginTop: "2px" }}>
                    Tap top-right <strong>3 dots <MoreVertical size={13} style={{ verticalAlign: "middle" }} /></strong> &gt; Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
                  </p>
                </div>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>🍎 iPhone (Safari):</strong>
                  <p style={{ fontSize: "0.76rem", color: "#475569", marginTop: "2px" }}>
                    Tap <strong>Share <Share size={13} style={{ verticalAlign: "middle" }} /></strong> &gt; Scroll down and tap <strong>"Add to Home Screen" <PlusSquare size={13} style={{ verticalAlign: "middle" }} /></strong>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: AI PIPELINE ARCHITECTURE */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Cpu size={17} color="#8B1E1E" />
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  color: "#0F172A",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                AI Pipeline Architecture
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.78rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                <span>1. Siamese Verification</span>
                <strong style={{ color: "#166534" }}>ResNet50 ✓</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                <span>2. Boundary Segmentation</span>
                <strong style={{ color: "#166534" }}>FUSegNet ✓</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                <span>3. Ulcer Classification</span>
                <strong style={{ color: "#166534" }}>VGG16 ✓</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                <span>4. Tissue Severity Grading</span>
                <strong style={{ color: "#166534" }}>FPN + VGG16 ✓</strong>
              </div>
            </div>
          </div>

          {/* SECTION 4: ABOUT */}
          <div style={{ textAlign: "center", padding: "6px 0 2px 0" }}>
            <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
              Patch Perfect AI • Version 1.0.0 (Research Prototype)
            </span>
          </div>
        </div>

        {/* Bottom Close Button */}
        <button
          onClick={onClose}
          className="btn-secondary"
          style={{ width: "100%", marginTop: "14px", padding: "12px" }}
        >
          Close Settings
        </button>
      </div>
    </div>
  );
};
