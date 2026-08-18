import React from "react";

export const SeverityTrendChart = ({ data = [], height = 140 }) => {
  // Fallback points if empty
  const points = data.length > 0 ? data : [
    { week: "Week 1", score: 4 },
    { week: "Week 2", score: 3.5 },
    { week: "Week 3", score: 2.8 },
    { week: "Week 4", score: 2 },
  ];

  const maxVal = 10;
  const paddingLeft = 32;
  const paddingRight = 24;
  const paddingTop = 15;
  const paddingBottom = 28;
  const width = 360;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate coordinates
  const coords = points.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, points.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (p.score / maxVal) * chartHeight;
    return { ...p, x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Create SVG path area under curve
  const areaPath = `
    M ${coords[0].x},${coords[0].y}
    ${coords.map((c) => `L ${c.x},${c.y}`).join(" ")}
    L ${coords[coords.length - 1].x},${paddingTop + chartHeight}
    L ${coords[0].x},${paddingTop + chartHeight}
    Z
  `;

  return (
    <div style={{ width: "100%", background: "#F8FAFC", borderRadius: "12px", padding: "12px 8px 8px 8px", border: "1px solid #E2E8F0" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B1E1E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8B1E1E" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
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
        <path d={areaPath} fill="url(#trendGradient)" />

        {/* Trend Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#8B1E1E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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
