import { demoPatients } from "../data/mockPatients";
import { treatmentGuidelines } from "../data/mockGuidelines";
import { simulateAIAnalysis } from "../data/mockAI";
import { authService } from "./authService";
import { API_BASE, ApiError, OFFLINE_MESSAGE, errorMessageFrom } from "./apiConfig";
import { formatDisplayDate, getEffectiveDate } from "./dateService";

export { ApiError };

// Demo sessions keep their (sample) data in this browser only.
const STORAGE_KEY_PATIENTS = "patch_perfect_patients_v1";

const isDemo = () => authService.isDemoSession();

/**
 * Real (signed-in) sessions talk to the server only. Failures throw ApiError with a
 * readable message instead of silently switching to local or simulated data.
 */
const request = async (path, { method = "GET", body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  const token = authService.getToken();
  if (token) headers.Authorization = `Token ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401) {
    authService.clearAuthSession();
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (!res.ok) throw new ApiError(errorMessageFrom(data, res.status), res.status);
  return data;
};

// ---------------------------------------------------------------------------
// localStorage persistence (demo sessions only)
// ---------------------------------------------------------------------------
const getStoredPatients = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (data !== null) return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load patients from local storage", e);
  }
  return [];
};

const saveStoredPatients = (patients) => {
  try {
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
  } catch (e) {
    console.error("Failed to save patients to local storage", e);
  }
};

export const clearLocalPatientCache = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
  } catch {
    /* ignore */
  }
};

// Normalise tissue percentages from any result shape (backend metrics, mock pipeline, legacy)
export const extractTissueStats = (scanResult) => {
  const pr = scanResult?.pipelineResults || {};
  const ta = pr.tissueAnalysis || {};
  const src = scanResult?.tissueStats || scanResult?.tissue_stats || {};
  // older local records stored the whole pipeline object as tissue stats
  const legacy = src.tissueAnalysis || {};
  const pick = (...vals) => vals.find((v) => typeof v === "number");
  return {
    granulation: pick(src.granulation, legacy.granulationPercent, ta.granulationPercent, pr.granulation) ?? 0,
    slough: pick(src.slough, legacy.sloughPercent, ta.sloughPercent, pr.slough) ?? 0,
    necrotic: pick(src.necrotic, legacy.necroticPercent, ta.necroticPercent, pr.necrotic) ?? 0,
  };
};

// A wound's type is set by its first scan and then kept
const UNSET_TYPES = new Set(["", "Pending AI Scan", "Unclassified"]);
export const woundTypeIsSet = (wound) => Boolean(wound) && !UNSET_TYPES.has(wound.wound_type || "");

const statusFor = (severityScore, healingStatus) => {
  if (severityScore >= 4) return { status: "ACTION NEEDED", statusType: "danger" };
  if (healingStatus === "Deteriorating") return { status: "DETERIORATING", statusType: "warning" };
  if (healingStatus === "Improving") return { status: "IMPROVING", statusType: "success" };
  return { status: "STABLE", statusType: "info" };
};

// ---------------------------------------------------------------------------
// demo-only local implementations
// ---------------------------------------------------------------------------
const local = {
  createPatient: (patientData) => {
    const existing = getStoredPatients();
    const taken = new Set(existing.map((p) => String(p.id || p.custom_id)));
    let newId;
    do {
      newId = String(Math.floor(100 + Math.random() * 900));
    } while (taken.has(newId) && taken.size < 900);
    const effectiveDate = getEffectiveDate();
    const anatomicalLocation = patientData.anatomicalLocation || "Lower Extremity";
    const woundType = patientData.woundType || "Pending AI Scan";
    const initialWound = {
      id: Date.now(),
      label: patientData.label || patientData.woundLabel || anatomicalLocation,
      wound_type: woundType,
      anatomical_location: anatomicalLocation,
      status: "AWAITING SCAN",
      status_type: "warning",
      last_updated: formatDisplayDate(effectiveDate, false),
      current_severity: null,
      current_severity_label: "Awaiting Scan",
      healing_status: "Not Assessed",
      ai_recommendation:
        "New patient profile registered. Capture or upload a wound photograph to run AI segmentation and severity scoring.",
      scans: [],
      trend_data: [],
    };

    const newPatient = {
      id: newId,
      custom_id: newId,
      name: patientData.name,
      age: Number(patientData.age) || 45,
      gender: patientData.gender || "Other",
      address: patientData.address || "Local Clinic",
      phone: patientData.phone || "N/A",
      emergency_contact: patientData.emergencyContact || "N/A",
      allergies: patientData.allergies || "None",
      notes: patientData.notes || "",
      woundType,
      anatomicalLocation,
      status: "AWAITING SCAN",
      statusType: "warning",
      lastUpdated: formatDisplayDate(effectiveDate, false),
      currentSeverity: null,
      currentSeverityLabel: "Awaiting Scan",
      healingStatus: "Not Assessed",
      aiRecommendation: initialWound.ai_recommendation,
      wounds: [initialWound],
      wound_profile: initialWound,
      trend_data: [],
      scans: [],
    };
    saveStoredPatients([newPatient, ...existing]);
    return newPatient;
  },

  addWoundToPatient: (patientId, woundData) => {
    const patients = getStoredPatients();
    const targetIdx = patients.findIndex((p) => (p.id || p.custom_id) === patientId);
    if (targetIdx === -1) throw new ApiError("Patient not found.", 404);

    const patient = { ...patients[targetIdx] };
    const effectiveDate = getEffectiveDate();
    const anatomicalLocation = woundData.anatomicalLocation || woundData.anatomical_location || "Lower Extremity";
    const newWound = {
      id: Date.now(),
      label: woundData.label || woundData.woundLabel || anatomicalLocation,
      wound_type: woundData.woundType || woundData.wound_type || "Pending AI Scan",
      anatomical_location: anatomicalLocation,
      status: "AWAITING SCAN",
      status_type: "warning",
      last_updated: formatDisplayDate(effectiveDate, false),
      current_severity: null,
      current_severity_label: "Awaiting Scan",
      healing_status: "Not Assessed",
      ai_recommendation: `New wound site registered at ${anatomicalLocation}. Capture or upload a wound image to run AI segmentation.`,
      scans: [],
      trend_data: [],
    };
    patient.wounds = [...(patient.wounds || []), newWound];
    patients[targetIdx] = patient;
    saveStoredPatients(patients);
    return patient;
  },

  saveScanResult: (patientId, scanResult, imagePreview, scanDateObj, woundProfileId) => {
    const formattedDate = formatDisplayDate(scanDateObj, true);
    const shortFormattedDate = formatDisplayDate(scanDateObj, false);
    const patients = getStoredPatients();
    const targetIdx = patients.findIndex((p) => (p.id || p.custom_id) === patientId);
    if (targetIdx === -1) throw new ApiError("Patient not found.", 404);

    const tissue = extractTissueStats(scanResult);
    const { status, statusType } = statusFor(scanResult.severityScore, scanResult.healingStatus);
    const patient = { ...patients[targetIdx] };
    const newScanEntry = {
      id: scanResult.id,
      date: formattedDate,
      // ISO timestamp so timelines can sort scans chronologically
      scan_date: scanDateObj.toISOString(),
      scan_date_formatted: formattedDate,
      severityScore: scanResult.severityScore,
      severity_score: scanResult.severityScore,
      severityLevel: scanResult.severityLevel,
      severity_level: scanResult.severityLevel,
      healingStatus: scanResult.healingStatus,
      healing_status: scanResult.healingStatus,
      woundType: scanResult.woundType,
      wound_type: scanResult.woundType,
      location: scanResult.location || patient.anatomicalLocation,
      anatomical_location: scanResult.location || patient.anatomicalLocation,
      recommendation: scanResult.recommendation,
      tissueStats: tissue,
      granulation_percent: tissue.granulation,
      slough_percent: tissue.slough,
      necrotic_percent: tissue.necrotic,
      image: imagePreview,
      image_base64: imagePreview,
      isLatest: true,
      is_latest: true,
    };

    if (patient.wounds && patient.wounds.length > 0) {
      const woundIdx = woundProfileId ? patient.wounds.findIndex((w) => w.id === woundProfileId) : 0;
      const targetWoundIdx = woundIdx >= 0 ? woundIdx : 0;
      const targetWound = { ...patient.wounds[targetWoundIdx] };
      if (!woundTypeIsSet(targetWound)) targetWound.wound_type = scanResult.woundType || targetWound.wound_type;
      newScanEntry.woundType = newScanEntry.wound_type = targetWound.wound_type;
      targetWound.current_severity = scanResult.severityScore;
      targetWound.current_severity_label = scanResult.severityLevel;
      targetWound.healing_status = scanResult.healingStatus;
      targetWound.ai_recommendation = scanResult.recommendation;
      targetWound.last_updated = shortFormattedDate;
      targetWound.status = status;
      targetWound.status_type = statusType;
      targetWound.scans = [
        newScanEntry,
        ...(targetWound.scans || []).map((s) => ({ ...s, is_latest: false, isLatest: false })),
      ];
      targetWound.trend_data = [
        ...(targetWound.trend_data || []),
        { week: shortFormattedDate, score: scanResult.severityScore },
      ];
      patient.wounds = patient.wounds.map((w, i) => (i === targetWoundIdx ? targetWound : w));
    }

    patient.currentSeverity = scanResult.severityScore;
    patient.currentSeverityLabel = scanResult.severityLevel;
    patient.healingStatus = scanResult.healingStatus;
    patient.aiRecommendation = scanResult.recommendation;
    patient.lastUpdated = shortFormattedDate;
    patient.status = status;
    patient.statusType = statusType;
    patient.scans = [newScanEntry, ...(patient.scans || []).map((s) => ({ ...s, isLatest: false, is_latest: false }))];
    patient.trend_data = [
      ...(patient.trend_data || patient.trendData || []),
      { week: shortFormattedDate, score: scanResult.severityScore },
    ];

    patients[targetIdx] = patient;
    saveStoredPatients(patients);
    return patient;
  },
};

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------
export const api = {
  getPatients: async () => {
    if (isDemo()) return getStoredPatients();
    const data = await request("/patients/");
    return Array.isArray(data) ? data : [];
  },

  createPatient: async (patientData) => {
    if (isDemo()) return local.createPatient(patientData);
    return request("/patients/", { method: "POST", body: patientData });
  },

  addWoundToPatient: async (patientId, woundData) => {
    if (isDemo()) return local.addWoundToPatient(patientId, woundData);
    return request(`/patients/${encodeURIComponent(patientId)}/add-wound/`, { method: "POST", body: woundData });
  },

  // Run quick Stage 2 boundary detection to return the initial AI bounding box
  detectWoundBox: async (imageDataUrl) => {
    if (isDemo()) {
      return { bounding_box: null, normalized_box: [0.15, 0.15, 0.85, 0.85], wound_detected: true, colour_card: null };
    }
    return request("/scans/detect-box/", {
      method: "POST",
      body: { image_base64: imageDataUrl },
    });
  },

  // Run the AI pipeline on a photo. Demo sessions get clearly flagged simulated results.
  // Supports an optional user-confirmed cropBox [x1, y1, x2, y2]
  analyzeWound: async (imageDataUrl, patient, woundProfileId = null, cropBox = null) => {
    if (isDemo()) {
      const simulated = await simulateAIAnalysis(imageDataUrl, patient, woundProfileId);
      const wound = patient?.wounds?.find((w) => w.id === woundProfileId) || patient?.wounds?.[0];
      const locked = woundTypeIsSet(wound);
      return {
        ...simulated,
        woundType: locked ? wound.wound_type : simulated.woundType,
        woundTypeLocked: locked,
        simulated: true,
        warnings: ["Demo mode: these results are simulated, not real AI analysis."],
      };
    }

    // The server compares against the wound's stored Day 1 scan itself.
    const data = await request("/scans/analyze/", {
      method: "POST",
      body: {
        patient_id: patient?.custom_id || patient?.id,
        wound_id: woundProfileId,
        image_base64: imageDataUrl,
        crop_box: cropBox,
      },
    });
    const metrics = data.pipeline_metrics || {};
    const similarityData = metrics.similarity || {};
    return {
      id: `scan-${Date.now()}`,
      severityScore: data.severity_score,
      severityLevel: data.severity_level,
      woundType: data.wound_type,
      woundTypeLocked: Boolean(data.wound_type_locked),
      healingStatus: data.healing_status,
      recommendation: data.recommendation,
      warnings: data.warnings || [],
      tissueStats: metrics.tissue_stats,
      similarityCheck: similarityData,
      pipelineResults: {
        ...(metrics.tissue_stats || {}),
        similarityCheck: similarityData,
        segmentation: metrics.segmentation,
        classification: metrics.classification,
        tissueMethod: metrics.tissue_method,
        colourCard: metrics.colour_card,
        sizeBasis: metrics.size_basis,
      },
    };
  },

  saveScanResult: async (patientId, scanResult, imagePreview, customDate = null, woundProfileId = null) => {
    const scanDateObj = customDate ? (customDate instanceof Date ? customDate : new Date(customDate)) : getEffectiveDate();
    if (isDemo()) return local.saveScanResult(patientId, scanResult, imagePreview, scanDateObj, woundProfileId);

    return request("/scans/", {
      method: "POST",
      body: {
        patient_id: patientId,
        wound_id: woundProfileId,
        severity_score: scanResult.severityScore,
        severity_level: scanResult.severityLevel,
        healing_status: scanResult.healingStatus,
        wound_type: scanResult.woundType,
        location: scanResult.location,
        recommendation: scanResult.recommendation,
        image_base64: imagePreview,
        tissue_stats: extractTissueStats(scanResult),
        wound_area_ratio: scanResult.pipelineResults?.segmentation?.wound_area_ratio ?? null,
        wound_area_cm2: scanResult.pipelineResults?.segmentation?.wound_area_cm2 ?? null,
        card_block_ratio: scanResult.pipelineResults?.colourCard?.block_area_ratio ?? null,
        scan_date: scanDateObj.toISOString(),
        scan_date_formatted: formatDisplayDate(scanDateObj, true),
      },
    });
  },

  getGuidelines: async () => {
    if (isDemo()) return treatmentGuidelines;
    const data = await request("/guidelines/");
    return Array.isArray(data) && data.length > 0 ? data : treatmentGuidelines;
  },

  // Delete this clinician's patients (server) or the demo data (local)
  clearAllData: async () => {
    if (!isDemo()) await request("/patients/clear-all/", { method: "POST" });
    clearLocalPatientCache();
    return [];
  },

  // Load sample patients (into this clinician's own registry on the server)
  loadDemoData: async () => {
    if (!isDemo()) {
      const seeded = await request("/patients/seed-demo/", { method: "POST" });
      return Array.isArray(seeded) ? seeded : [];
    }
    saveStoredPatients(demoPatients);
    return demoPatients;
  },
};
