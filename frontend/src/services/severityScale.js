/**
 * Severity is scored 1-10 (the backend's scale). Two points per grade:
 * 1-2 Minimal, 3-4 Mild, 5-6 Moderate, 7-8 Very Severe, 9-10 Critical.
 */
export const SEVERITY_MAX = 10;

/** Very Severe or Critical: shown as "Action needed". */
export const isSevere = (score) => typeof score === "number" && score >= 7;

/** Moderate or worse. */
export const isModerate = (score) => typeof score === "number" && score >= 5;

/** Mild or worse. */
export const isMild = (score) => typeof score === "number" && score >= 3;

export const SEVERITY_LABELS = ["Minimal", "Mild", "Moderate", "Very Severe", "Critical"];

export const severityLabel = (score) => SEVERITY_LABELS[Math.min(4, Math.max(0, Math.ceil(score / 2) - 1))];
