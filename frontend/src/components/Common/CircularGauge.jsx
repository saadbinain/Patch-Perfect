import React from "react";
import { SEVERITY_MAX, isSevere, isModerate, isMild } from "../../services/severityScale";

export const CircularGauge = ({
  score = null,
  maxScore = SEVERITY_MAX,
  subtitle = "SEVERITY SCORE",
  size = 130,
  strokeWidth = 12,
  label = null,
}) => {
  const isAwaiting = score === null || score === undefined;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const numericScore = isAwaiting ? 0 : Number(score);
  const percentage = isAwaiting ? 0 : Math.min(1, Math.max(0, numericScore / maxScore));
  const strokeDashoffset = circumference - percentage * circumference;

  // Severity color grading
  const getColor = (val) => {
    if (isAwaiting) return "#94A3B8";
    if (isSevere(val)) return "#DC2626"; // Crimson Red: Very Severe / Critical
    if (isModerate(val)) return "#D97706"; // Amber / Orange: Moderate
    if (isMild(val)) return "#CA8A04"; // Yellow: Mild
    return "#16A34A"; // Green
  };

  const currentColor = getColor(numericScore);

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
            padding: "4px",
          }}
        >
          <span
            style={{
              fontSize: isAwaiting ? "1.6rem" : "2rem",
              fontWeight: "800",
              color: isAwaiting ? "#64748B" : "#1E293B",
              lineHeight: 1,
            }}
          >
            {isAwaiting ? "—" : score}
          </span>
          <span
            style={{
              fontSize: "0.62rem",
              fontWeight: "700",
              color: currentColor,
              textTransform: "uppercase",
              marginTop: "3px",
              letterSpacing: "0.02em",
            }}
          >
            {label || (isAwaiting ? "Awaiting Scan" : "")}
          </span>
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
