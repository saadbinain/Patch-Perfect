// Older records baked the placeholder wound type into the label
// (e.g. "Lower Extremity Pending AI Scan"). Strip it for display.
const PLACEHOLDER = /\s*\(?\s*Pending AI Scan\s*\)?\s*$/i;

export const getWoundLabel = (wound, fallback = "Wound Site") => {
  if (!wound) return fallback;
  const raw = wound.label || wound.anatomical_location || wound.anatomicalLocation || "";
  const cleaned = raw.replace(PLACEHOLDER, "").trim();
  return cleaned || wound.anatomical_location || fallback;
};
