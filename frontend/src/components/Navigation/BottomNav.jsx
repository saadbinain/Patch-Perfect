import React from "react";
import { Users, Camera, BookOpen, Activity } from "lucide-react";

export const BottomNav = ({ activeTab, onTabChange, actionNeededCount = 0 }) => {
  return (
    <nav className="bottom-nav-bar">
      {/* Patients & Wounds Tab */}
      <button
        type="button"
        className={`nav-tab-item ${activeTab === "wounds" ? "active" : ""}`}
        onClick={() => onTabChange("wounds")}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Users size={21} strokeWidth={activeTab === "wounds" ? 2.5 : 2} color={activeTab === "wounds" ? "#8B1E1E" : "#64748B"} />
          {actionNeededCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-8px",
                backgroundColor: "#DC2626",
                color: "#FFFFFF",
                fontSize: "0.6rem",
                fontWeight: "800",
                borderRadius: "10px",
                minWidth: "16px",
                height: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "2px solid #FFFFFF",
              }}
            >
              {actionNeededCount}
            </span>
          )}
        </div>
        <span style={{ fontWeight: activeTab === "wounds" ? "700" : "600" }}>Registry</span>
      </button>

      {/* Center Scan Elevated Pulsing Camera Action */}
      <button
        type="button"
        className="nav-center-action-btn glow-pulse"
        onClick={() => onTabChange("scan")}
        title="Start Clinical AI Scan"
      >
        <Camera size={25} strokeWidth={2.4} color="#FFFFFF" />
        <span style={{ fontSize: "0.62rem", fontWeight: "800", marginTop: "1px", letterSpacing: "0.02em" }}>SCAN</span>
      </button>

      {/* Clinical Guidelines Tab */}
      <button
        type="button"
        className={`nav-tab-item ${activeTab === "guidelines" ? "active" : ""}`}
        onClick={() => onTabChange("guidelines")}
      >
        <BookOpen size={21} strokeWidth={activeTab === "guidelines" ? 2.5 : 2} color={activeTab === "guidelines" ? "#8B1E1E" : "#64748B"} />
        <span style={{ fontWeight: activeTab === "guidelines" ? "700" : "600" }}>Guidelines</span>
      </button>
    </nav>
  );
};
