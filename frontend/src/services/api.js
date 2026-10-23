import { initialPatients, demoPatients } from "../data/mockPatients";
import { treatmentGuidelines } from "../data/mockGuidelines";
import { simulateAIAnalysis } from "../data/mockAI";
import { authService } from "./authService";

const BACKEND_BASE_URL = "/api";
const STORAGE_KEY_PATIENTS = "patch_perfect_patients_v1";

const getAuthHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  const token = authService.getToken();
  if (token && !token.startsWith("local-token-") && !token.startsWith("demo-session-")) {
    headers["Authorization"] = `Token ${token}`;
  }
  return headers;
};

// Helpers for localStorage fallback persistence
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

import { formatDisplayDate, getEffectiveDate } from "./dateService";

export const api = {
  // Get all patient wound profiles
  getPatients: async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/patients/`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          saveStoredPatients(data);
          return data;
        }
      }
    } catch (e) {
      console.warn("Django backend unreachable, using local database cache.", e);
    }
    return getStoredPatients();
  },

  // Add a new patient profile
  createPatient: async (patientData) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/patients/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(patientData),
      });
      if (res.ok) {
        const created = await res.json();
        return created;
      }
    } catch (e) {
      console.warn("Failed to create patient on Django backend, saving locally.", e);
    }

    // Local fallback
    const existing = getStoredPatients();
    const newId = String(Math.floor(100 + Math.random() * 900));
    const effectiveDate = getEffectiveDate();
    const anatomicalLocation = patientData.anatomicalLocation || "Lower Extremity";
    const woundType = patientData.woundType || "Pending AI Scan";
    const initialWound = {
      id: Date.now(),
      label: patientData.label || patientData.woundLabel || `${anatomicalLocation} ${woundType}`.trim(),
      wound_type: woundType,
      anatomical_location: anatomicalLocation,
      status: "AWAITING SCAN",
      status_type: "warning",
      last_updated: formatDisplayDate(effectiveDate, false),
      current_severity: null,
      current_severity_label: "Awaiting Scan",
      healing_status: "Not Assessed",
      ai_recommendation: "New patient profile registered. Capture or upload a wound photograph to run AI segmentation and severity scoring.",
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
      woundType: woundType,
      anatomicalLocation: anatomicalLocation,
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
    const updated = [newPatient, ...existing];
    saveStoredPatients(updated);
    return newPatient;
  },

  // Add a new wound site to an existing patient
  addWoundToPatient: async (patientId, woundData) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/patients/${patientId}/add-wound/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(woundData),
      });
      if (res.ok) {
        const updatedPatient = await res.json();
        return updatedPatient;
      }
    } catch (e) {
      console.warn("Failed to add wound on Django backend, updating local state.", e);
    }

    // Local fallback
    const patients = getStoredPatients();
    const targetIdx = patients.findIndex((p) => (p.id || p.custom_id) === patientId);
    if (targetIdx === -1) return null;

    const patient = { ...patients[targetIdx] };
    const effectiveDate = getEffectiveDate();
    const anatomicalLocation = woundData.anatomicalLocation || woundData.anatomical_location || "Lower Extremity";
    const woundType = woundData.woundType || woundData.wound_type || "Pending AI Scan";
    const newWound = {
      id: Date.now(),
      label: woundData.label || woundData.woundLabel || `${anatomicalLocation} Site`,
      wound_type: woundType,
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

  // Submit image for AI analysis
  analyzeWound: async (imageDataUrl, patient, woundProfileId = null) => {
    try {
      const targetWound = patient?.wounds?.find((w) => w.id === woundProfileId);
      const priorScans = targetWound?.scans?.length > 0 ? targetWound.scans : (patient?.scans || []);
      const baselineImage = priorScans.length > 0 ? (priorScans[0].image || priorScans[0].image_base64 || null) : null;

      const res = await fetch(`${BACKEND_BASE_URL}/scans/analyze/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patient_id: patient?.id || patient?.custom_id,
          wound_id: woundProfileId,
          image_base64: imageDataUrl,
          baseline_image_base64: baselineImage,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const metrics = data.pipeline_metrics || {};
        const tissueStats = metrics.tissue_stats || {
          granulation: 50,
          slough: 35,
          necrotic: 15,
        };
        const similarityData = metrics.similarity || {
          is_same_wound: true,
          similarity_score: 1.0,
          confidence: "100%",
        };

        return {
          id: `scan-${Date.now()}`,
          severityScore: data.severity_score,
          severityLevel: data.severity_level,
          woundType: data.wound_type,
          healingStatus: data.healing_status,
          recommendation: data.recommendation,
          similarityCheck: similarityData,
          pipelineResults: {
            ...tissueStats,
            similarityCheck: similarityData,
            segmentation: metrics.segmentation,
            classification: metrics.classification,
          },
        };
      }
    } catch (e) {
      console.warn("Django AI analyze endpoint offline, running browser simulation.", e);
    }
    return simulateAIAnalysis(imageDataUrl, patient, woundProfileId);
  },

  // Save scan result to patient profile (and specific wound)
  saveScanResult: async (patientId, scanResult, imagePreview, customDate = null, woundProfileId = null) => {
    const scanDateObj = customDate ? (customDate instanceof Date ? customDate : new Date(customDate)) : getEffectiveDate();
    const formattedDate = formatDisplayDate(scanDateObj, true);
    const shortFormattedDate = formatDisplayDate(scanDateObj, false);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/scans/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patient_id: patientId,
          wound_id: woundProfileId,
          severity_score: scanResult.severityScore,
          severity_level: scanResult.severityLevel,
          healing_status: scanResult.healingStatus,
          wound_type: scanResult.woundType,
          location: scanResult.location || "Lower Extremity",
          recommendation: scanResult.recommendation,
          image_base64: imagePreview,
          tissue_stats: scanResult.pipelineResults || { granulation: 50, slough: 35, necrotic: 15 },
          scan_date: scanDateObj.toISOString(),
          scan_date_formatted: formattedDate,
        }),
      });
      if (res.ok) {
        const savedScan = await res.json();
        return savedScan;
      }
    } catch (e) {
      console.warn("Failed to persist scan on Django backend, caching locally.", e);
    }

    // Local fallback
    const patients = getStoredPatients();
    const targetIdx = patients.findIndex((p) => (p.id || p.custom_id) === patientId);
    if (targetIdx === -1) return null;

    const patient = { ...patients[targetIdx] };
    const newScanEntry = {
      id: scanResult.id,
      date: formattedDate,
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
      tissueStats: scanResult.pipelineResults || { granulation: 50, slough: 35, necrotic: 15 },
      granulation_percent: scanResult.pipelineResults?.granulation ?? 50,
      slough_percent: scanResult.pipelineResults?.slough ?? 35,
      necrotic_percent: scanResult.pipelineResults?.necrotic ?? 15,
      image: imagePreview,
      image_base64: imagePreview,
      isLatest: true,
      is_latest: true,
    };

    // Update the matching wound in patient.wounds if found
    if (patient.wounds && patient.wounds.length > 0) {
      const woundIdx = woundProfileId ? patient.wounds.findIndex((w) => w.id === woundProfileId) : 0;
      const targetWoundIdx = woundIdx >= 0 ? woundIdx : 0;
      const targetWound = { ...patient.wounds[targetWoundIdx] };

      targetWound.current_severity = scanResult.severityScore;
      targetWound.current_severity_label = scanResult.severityLevel;
      targetWound.healing_status = scanResult.healingStatus;
      targetWound.ai_recommendation = scanResult.recommendation;
      targetWound.last_updated = shortFormattedDate;
      targetWound.status =
        scanResult.severityScore >= 4
          ? "ACTION NEEDED"
          : scanResult.healingStatus === "Improving"
          ? "IMPROVING"
          : "STABLE";
      targetWound.status_type = scanResult.severityScore >= 4 ? "danger" : "success";

      const updatedWoundScans = [
        newScanEntry,
        ...(targetWound.scans || []).map((s) => ({ ...s, is_latest: false, isLatest: false })),
      ];
      targetWound.scans = updatedWoundScans;

      const nextScanNum = (targetWound.trend_data?.length || 0) + 1;
      targetWound.trend_data = [
        ...(targetWound.trend_data || []),
        { week: shortFormattedDate || `Scan ${nextScanNum}`, score: scanResult.severityScore },
      ];

      patient.wounds[targetWoundIdx] = targetWound;
    }

    patient.currentSeverity = scanResult.severityScore;
    patient.currentSeverityLabel = scanResult.severityLevel;
    patient.healingStatus = scanResult.healingStatus;
    patient.aiRecommendation = scanResult.recommendation;
    patient.lastUpdated = shortFormattedDate;
    patient.status =
      scanResult.severityScore >= 4
        ? "ACTION NEEDED"
        : scanResult.healingStatus === "Improving"
        ? "IMPROVING"
        : "STABLE";
    patient.statusType = scanResult.severityScore >= 4 ? "danger" : "success";

    const updatedScans = [
      newScanEntry,
      ...(patient.scans || []).map((s) => ({ ...s, isLatest: false, is_latest: false })),
    ];
    patient.scans = updatedScans;

    const nextWeekIdx = (patient.trend_data?.length || patient.trendData?.length || 0) + 1;
    patient.trend_data = [
      ...(patient.trend_data || patient.trendData || []),
      { week: shortFormattedDate || `Scan ${nextWeekIdx}`, score: scanResult.severityScore },
    ];

    patients[targetIdx] = patient;
    saveStoredPatients(patients);
    return patient;
  },

  // Get treatment guidelines
  getGuidelines: async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/guidelines/`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn("Django guidelines endpoint offline, returning local guidelines.", e);
    }
    return treatmentGuidelines;
  },

  // Clear all data (new user state)
  clearAllData: async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/patients/clear-all/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (e) {
      console.warn("Django clear-all endpoint unreachable, clearing local storage cache only.", e);
    }
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    return [];
  },

  // Load sample demo data
  loadDemoData: async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/patients/seed-demo/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const seeded = await res.json();
        if (Array.isArray(seeded)) {
          saveStoredPatients(seeded);
          return seeded;
        }
      }
    } catch (e) {
      console.warn("Django seed-demo endpoint unreachable, falling back to mock dataset.", e);
    }
    saveStoredPatients(demoPatients);
    return demoPatients;
  },

  // Reset to initial (empty)
  resetDemoData: async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/patients/clear-all/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.warn("Django clear-all endpoint unreachable.", e);
    }
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    return [];
  },
};
