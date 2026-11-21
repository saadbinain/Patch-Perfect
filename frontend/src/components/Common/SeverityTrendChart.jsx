import React from "react";
import { TrendingUp, Activity } from "lucide-react";
import { SEVERITY_MAX } from "../../services/severityScale";

export const SeverityTrendChart = ({ data = [], height = 140 }) => {
  // If no trend data exists yet
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          background: "#F8FAFC",
          borderRadius: "14px",
          padding: "24px 16px",
          border: "1px dashed #CBD5E1",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "#F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94A3B8",
          }}
        >
          <Activity size={20} />
        </div>
        <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569" }}>
          No Scan History Yet
        </p>
        <p style={{ fontSize: "0.75rem", color: "#94A3B8", maxWidth: "260px", lineHeight: "1.4" }}>
          Healing trajectory and severity changes will graph here once you save wound scans.
        </p>
      </div>
    );
  }

  const points = data;
  const maxVal = SEVERITY_MAX; // Severity scale 1 to 10
  const paddingLeft = 32;
  const paddingRight = 24;
  const paddingTop = 15;
  const paddingBottom = 28;
  const width = 360;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate coordinates
  const coords = points.map((p, idx) => {
    const x = points.length === 1 
      ? paddingLeft + chartWidth / 2 
      : paddingLeft + (idx / Math.max(1, points.length - 1)) * chartWidth;
    const scoreVal = Number(p.score) || 0;
    const y = paddingTop + chartHeight - (scoreVal / maxVal) * chartHeight;
    return { ...p, x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Create SVG path area under curve
  const areaPath = points.length > 1 ? `
    M ${coords[0].x},${coords[0].y}
    ${coords.map((c) => `L ${c.x},${c.y}`).join(" ")}
    L ${coords[coords.length - 1].x},${paddingTop + chartHeight}
    L ${coords[0].x},${paddingTop + chartHeight}
    Z
  ` : "";

  return (
    <div style={{ width: "100%", background: "#F8FAFC", borderRadius: "12px", padding: "12px 8px 8px 8px", border: "1px solid #E2E8F0" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B1E1E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8B1E1E" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines (0 to 10) */}
        {[0, 2, 4, 6, 8, 10].map((val) => {
          const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray={val === 0 ? "none" : "3,3"}
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                fill="#94A3B8"
                fontSize="9"
                fontWeight="600"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Filled Area */}
        {areaPath && <path d={areaPath} fill="url(#trendGradient)" />}

        {/* Trend Line */}
        {points.length > 1 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#8B1E1E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Circles */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="5" fill="#8B1E1E" stroke="#FFFFFF" strokeWidth="2" />
            <text
              x={c.x}
              y={height - 6}
              fill="#64748B"
              fontSize="9"
              fontWeight="600"
              textAnchor="middle"
            >
              {c.week}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
