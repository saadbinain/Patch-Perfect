import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Database,
  Trash2,
  Calendar,
  Clock,
  RotateCcw,
  FastForward,
  CalendarDays,
  CheckCircle2,
  Info,
  LogOut,
  UserCheck,
  Shield,
} from "lucide-react";
import {
  getSimulatedDateConfig,
  saveSimulatedDateConfig,
  formatDisplayDate,
  getEffectiveDate,
  formatDateInput,
  formatTimeInput,
  advanceSimulatedDays,
  resetToLiveDate,
} from "../../services/dateService";

export const SettingsModal = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallNative,
  onLoadDemoData,
  onClearAllData,
  patientCount = 0,
  currentUser = null,
  onLogout = null,
}) => {
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Date Simulation State
  const [simConfig, setSimConfig] = useState(getSimulatedDateConfig());

  useEffect(() => {
    if (isOpen) {
      setSimConfig(getSimulatedDateConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSimulation = (enabled) => {
    const updated = {
      ...simConfig,
      enabled,
      date: simConfig.date || formatDateInput(new Date()),
      time: simConfig.time || formatTimeInput(new Date()),
    };
    setSimConfig(updated);
    saveSimulatedDateConfig(updated);
    setFeedbackMsg(
      enabled
        ? `Simulated date active: ${formatDisplayDate(getEffectiveDate(), true)}`
        : "Reverted to live system clock."
    );
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleDateChange = (newDate) => {
    const updated = {
      ...simConfig,
      enabled: true,
      date: newDate,
    };
    setSimConfig(updated);
    saveSimulatedDateConfig(updated);
    setFeedbackMsg(`Date set to: ${formatDisplayDate(getEffectiveDate(), true)}`);
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleTimeChange = (newTime) => {
    const updated = {
      ...simConfig,
      enabled: true,
      time: newTime,
    };
    setSimConfig(updated);
    saveSimulatedDateConfig(updated);
    setFeedbackMsg(`Time set to: ${formatDisplayDate(getEffectiveDate(), true)}`);
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleAdvanceDays = (days) => {
    const updated = advanceSimulatedDays(days);
    setSimConfig(updated);
    setFeedbackMsg(`Advanced date by ${days} day(s): ${formatDisplayDate(getEffectiveDate(), true)}`);
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleResetDate = () => {
    const updated = resetToLiveDate();
    setSimConfig(updated);
    setFeedbackMsg("Reset to live system clock.");
    setTimeout(() => setFeedbackMsg(""), 3500);
  };

  const handleLoadDemo = async () => {
    if (onLoadDemoData) {
      setFeedbackMsg("Loading sample patient profiles...");
      await onLoadDemoData();
      setFeedbackMsg("Loaded 5 manuscript sample patient profiles!");
      setTimeout(() => setFeedbackMsg(""), 3500);
    }
  };

  const handleClearData = async () => {
    if (window.confirm("Are you sure you want to clear all patient profiles and return to an empty state?")) {
      if (onClearAllData) {
        setFeedbackMsg("Clearing records...");
        await onClearAllData();
        setFeedbackMsg("All patient records cleared successfully.");
        setTimeout(() => setFeedbackMsg(""), 3500);
      }
    }
  };

  const effectiveDate = getEffectiveDate();

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
                Simulation, preferences, and data management
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
          {/* SECTION 1: CLINICAL DATE & TIME SIMULATION */}
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
                marginBottom: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CalendarDays size={17} color="#8B1E1E" />
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "700",
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Clinical Date Simulation
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  color: simConfig.enabled ? "#991B1B" : "#166534",
                  background: simConfig.enabled ? "#FEE2E2" : "#DCFCE7",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                {simConfig.enabled ? "SIMULATION ON" : "LIVE CLOCK"}
              </span>
            </div>

            <p style={{ fontSize: "0.76rem", color: "#64748B", marginBottom: "12px", lineHeight: "1.4" }}>
              Alters the assessment date so you can test wound healing trajectories, scan next-day follow-ups, or backfill past evaluations.
            </p>

            {/* Current Active Date Badge */}
            <div
              style={{
                background: simConfig.enabled ? "#FFF1F2" : "#FFFFFF",
                border: simConfig.enabled ? "1px solid #FECDD3" : "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block", textTransform: "uppercase", fontWeight: "600" }}>
                  Active Assessment Date
                </span>
                <strong style={{ fontSize: "0.92rem", color: simConfig.enabled ? "#991B1B" : "#0F172A" }}>
                  {formatDisplayDate(effectiveDate, true)}
                </strong>
              </div>

              {simConfig.enabled ? (
                <button
                  onClick={handleResetDate}
                  title="Reset to live clock"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #FECDD3",
                    color: "#991B1B",
                    padding: "5px 10px",
                    borderRadius: "6px",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              ) : null}
            </div>

            {/* Date and Time Pickers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                  📅 Select Date
                </label>
                <input
                  type="date"
                  value={simConfig.date || formatDateInput(new Date())}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    color: "#0F172A",
                    backgroundColor: "#FFFFFF",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>
                  🕒 Select Time
                </label>
                <input
                  type="time"
                  value={simConfig.time || formatTimeInput(new Date())}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    color: "#0F172A",
                    backgroundColor: "#FFFFFF",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Quick Shift Presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: "600" }}>
                Quick Presets:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button
                  onClick={() => handleAdvanceDays(1)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#0F172A",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FastForward size={13} color="#8B1E1E" />
                  <span>+1 Day (Next Day)</span>
                </button>

                <button
                  onClick={() => handleAdvanceDays(3)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#0F172A",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  +3 Days
                </button>

                <button
                  onClick={() => handleAdvanceDays(7)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#0F172A",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  +1 Week (7 Days)
                </button>

                <button
                  onClick={() => handleAdvanceDays(-1)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    color: "#64748B",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    fontSize: "0.74rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  -1 Day (Yesterday)
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: DATA & STORAGE MANAGEMENT */}
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

              {/* Clear All Patient Data */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#FFFFFF",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.88rem", color: "#991B1B", display: "block" }}>
                    Clear All Records
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Reset database and restore empty state
                  </span>
                </div>
                <button
                  onClick={handleClearData}
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECDD3",
                    color: "#991B1B",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: "700",
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

          {/* SECTION 3: CLINICIAN ACCOUNT & SESSION */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserCheck size={17} color="#8B1E1E" />
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "700",
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Clinician Account
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  color: "#059669",
                  background: "#ECFDF5",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Shield size={11} />
                <span>Active Session</span>
              </span>
            </div>

            {currentUser ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.88rem", color: "#0F172A", display: "block" }}>
                      {currentUser.full_name || currentUser.username}
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      @{currentUser.username} • {currentUser.role || "Clinician"}
                    </span>
                  </div>

                  <button
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to sign out of Patch Perfect?")) {
                        onClose();
                        if (onLogout) await onLogout();
                      }
                    }}
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECDD3",
                      color: "#991B1B",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "0.78rem", color: "#64748B", margin: 0 }}>
                Running in guest session mode.
              </p>
            )}
          </div>

          {/* SECTION 6: ABOUT */}
          <div style={{ textAlign: "center", padding: "6px 0 2px 0" }}>
            <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
              Patch Perfect AI • Version 1.0.0 (Clinical Research)
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
