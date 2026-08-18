import React from "react";

export const CircularGauge = ({
  score = 3,
  maxScore = 5,
  subtitle = "SEVERITY SCORE",
  size = 130,
  strokeWidth = 12,
  label = null,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(1, Math.max(0, score / maxScore));
  const strokeDashoffset = circumference - percentage * circumference;

  // Severity color grading
  const getColor = (val) => {
    if (val >= 4) return "#DC2626"; // Crimson Red
    if (val >= 3) return "#D97706"; // Amber / Orange
    if (val >= 2) return "#CA8A04"; // Yellow
    return "#16A34A"; // Green
  };

  const currentColor = getColor(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active progress arc */}
          <circle
            className="gauge-ring-circle"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={currentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Inner Content */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "2rem", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>
            {score}
          </span>
          {label && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: "700",
                color: currentColor,
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              {label}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <span
          style={{
            marginTop: "10px",
            fontSize: "0.75rem",
            fontWeight: "700",
            letterSpacing: "0.08em",
            color: "#64748B",
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
};
