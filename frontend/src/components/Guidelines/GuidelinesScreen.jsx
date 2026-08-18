import React, { useState } from "react";
import { ShieldCheck, ChevronRight, Activity, Scissors, Bed, Droplets, Info } from "lucide-react";
import { treatmentGuidelines } from "../../data/mockGuidelines";
import { GuidelineDetailModal } from "./GuidelineDetailModal";

export const GuidelinesScreen = () => {
  const [selectedGuideline, setSelectedGuideline] = useState(null);

  // Icon mapping
  const getIcon = (type) => {
    switch (type) {
      case "foot":
        return <Activity size={24} color="#E57373" />;
      case "scalpel":
        return <Scissors size={24} color="#7E57C2" />;
      case "bed":
        return <Bed size={24} color="#3F51B5" />;
      case "drop":
        return <Droplets size={24} color="#E91E63" />;
      default:
        return <ShieldCheck size={24} color="#8B1E1E" />;
    }
  };

  return (
    <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Guidelines Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#3B82F6",
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={24} />
        </div>

        <div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0F172A" }}>
            Treatment Guidelines
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "2px" }}>
            Evidence-based wound care protocols
          </p>
        </div>
      </div>

      {/* Guidelines Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {treatmentGuidelines.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedGuideline(item)}
            className="app-card app-card-clickable"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              padding: "16px",
              borderRadius: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
              {/* Icon */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {getIcon(item.iconType)}
              </div>

              {/* Text */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                <h4 style={{ fontSize: "0.98rem", fontWeight: "700", color: "#0F172A" }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: "0.78rem", color: "#64748B", lineHeight: "1.3" }}>
                  {item.subtitle}
                </p>
              </div>
            </div>

            <ChevronRight size={18} color="#94A3B8" />
          </div>
        ))}
      </div>

      {/* Clinical Reference Footnote */}
      <div
        style={{
          background: "#F8FAFC",
          borderRadius: "14px",
          padding: "14px",
          border: "1px solid #E2E8F0",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          marginTop: "12px",
        }}
      >
        <Info size={18} color="#64748B" style={{ flexShrink: 0, marginTop: "2px" }} />
        <p style={{ fontSize: "0.76rem", color: "#64748B", lineHeight: "1.4" }}>
          These guidelines synthesize international clinical best practices for community healthcare workers. In cases of critical infection or systemic compromise, escalate immediately to a specialized wound physician.
        </p>
      </div>

      {/* Detail Modal */}
      <GuidelineDetailModal
        guideline={selectedGuideline}
        isOpen={!!selectedGuideline}
        onClose={() => setSelectedGuideline(null)}
      />
    </div>
  );
};
