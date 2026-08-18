import React from "react";
import { ClipboardList, Camera, ShieldAlert } from "lucide-react";

export const BottomNav = ({ activeTab, onTabChange }) => {
  return (
    <nav className="bottom-nav-bar">
      {/* Wounds Tab */}
      <button
        className={`nav-tab-item ${activeTab === "wounds" ? "active" : ""}`}
        onClick={() => onTabChange("wounds")}
      >
        <ClipboardList size={22} color={activeTab === "wounds" ? "#8B1E1E" : "#94A3B8"} />
        <span>Wounds</span>
      </button>

      {/* Center Scan Floating Button */}
      <button
        className="nav-center-action-btn"
        onClick={() => onTabChange("scan")}
        title="Start AI Scan"
      >
        <Camera size={24} color="#FFFFFF" />
        <span style={{ fontSize: "0.62rem", fontWeight: "700", marginTop: "1px" }}>Scan</span>
      </button>

      {/* Guidelines Tab */}
      <button
        className={`nav-tab-item ${activeTab === "guidelines" ? "active" : ""}`}
        onClick={() => onTabChange("guidelines")}
      >
        <ShieldAlert size={22} color={activeTab === "guidelines" ? "#8B1E1E" : "#94A3B8"} />
        <span>Guidelines</span>
      </button>
    </nav>
  );
};
