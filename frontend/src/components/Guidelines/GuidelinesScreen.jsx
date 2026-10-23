import React, { useState } from "react";
import { ShieldCheck, ChevronRight, Activity, Scissors, Bed, Droplets, Info, Search, X, BookOpen } from "lucide-react";
import { treatmentGuidelines } from "../../data/mockGuidelines";
import { GuidelineDetailModal } from "./GuidelineDetailModal";

export const GuidelinesScreen = () => {
  const [selectedGuideline, setSelectedGuideline] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getIcon = (type) => {
    switch (type) {
      case "foot":
        return <Activity size={22} color="#DC2626" />;
      case "scalpel":
        return <Scissors size={22} color="#7C3AED" />;
      case "bed":
        return <Bed size={22} color="#2563EB" />;
      case "drop":
        return <Droplets size={22} color="#DB2777" />;
      default:
        return <ShieldCheck size={22} color="#8B1E1E" />;
    }
  };

  const filteredGuidelines = treatmentGuidelines.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.subtitle.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: "16px 14px 24px 14px", display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Search Input */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "14px", top: "11px", color: "#94A3B8" }}>
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search wound treatment guidelines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 38px 10px 40px",
            borderRadius: "14px",
            border: "1.5px solid #CBD5E1",
            fontSize: "0.88rem",
            color: "#0F172A",
            backgroundColor: "#FFFFFF",
            outline: "none",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute",
              right: "12px",
              top: "10px",
              background: "#E2E8F0",
              border: "none",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Guidelines Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredGuidelines.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedGuideline(item)}
            className="app-card app-card-clickable"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
              {/* Icon Container */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                {getIcon(item.iconType)}
              </div>

              {/* Text */}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                <h4
                  style={{
                    fontSize: "0.94rem",
                    fontWeight: "700",
                    color: "#0F172A",
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </h4>
                <p style={{ fontSize: "0.76rem", color: "#64748B", margin: 0, lineHeight: 1.3 }}>
                  {item.subtitle}
                </p>
              </div>
            </div>

            <ChevronRight size={18} color="#CBD5E1" style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Clinical Reference Footnote */}
      <div
        style={{
          background: "#F8FAFC",
          borderRadius: "14px",
          padding: "12px 14px",
          border: "1px solid #E2E8F0",
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
          marginTop: "4px",
        }}
      >
        <Info size={16} color="#64748B" style={{ flexShrink: 0, marginTop: "2px" }} />
        <p style={{ fontSize: "0.74rem", color: "#64748B", lineHeight: "1.4", margin: 0 }}>
          Evidence-based clinical guidelines synthesize international best practices. If severe infection or necrosis is detected, escalate to specialized surgical wound consultation immediately.
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
