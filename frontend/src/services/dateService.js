// Clinical Date & Time Simulation Service
const STORAGE_KEY_SIM_DATE = "patch_perfect_sim_date_v1";

export const getSimulatedDateConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIM_DATE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse simulated date config", e);
  }

  const now = new Date();
  return {
    enabled: false,
    date: formatDateInput(now),
    time: formatTimeInput(now),
  };
};

export const saveSimulatedDateConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY_SIM_DATE, JSON.stringify(config));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("patch_perfect_date_changed", { detail: config }));
    }
  } catch (e) {
    console.error("Failed to save simulated date config", e);
  }
};

export const formatDateInput = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatTimeInput = (dateObj) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/**
 * Returns the effective date object based on simulation settings or live system clock.
 */
export const getEffectiveDate = () => {
  const config = getSimulatedDateConfig();
  if (config && config.enabled && config.date) {
    const timeStr = config.time || "09:00";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const [year, month, day] = config.date.split("-").map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day, hours || 9, minutes || 0, 0);
    }
  }
  return new Date();
};

/**
 * Formats a Date object into human-readable date & time for scan logs and reports.
 * e.g. "Aug 28, 2026, 09:30 AM" or "Aug 28, 2026"
 */
export const formatDisplayDate = (dateObj = getEffectiveDate(), includeTime = true) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return "Unknown Date";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  if (!includeTime) {
    return `${monthName} ${day}, ${year}`;
  }

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = String(hours).padStart(2, "0");

  return `${monthName} ${day}, ${year}, ${formattedHours}:${minutes} ${ampm}`;
};

/**
 * Advance or shift the simulated date by a specific number of days.
 */
export const advanceSimulatedDays = (days = 1) => {
  const current = getEffectiveDate();
  current.setDate(current.getDate() + days);
  
  const newConfig = {
    enabled: true,
    date: formatDateInput(current),
    time: formatTimeInput(current),
  };
  saveSimulatedDateConfig(newConfig);
  return newConfig;
};

/**
 * Reset date simulation to live system clock.
 */
export const resetToLiveDate = () => {
  const now = new Date();
  const newConfig = {
    enabled: false,
    date: formatDateInput(now),
    time: formatTimeInput(now),
  };
  saveSimulatedDateConfig(newConfig);
  return newConfig;
};
