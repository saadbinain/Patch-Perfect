import { initialPatients, demoPatients } from "../data/mockPatients";
import { treatmentGuidelines } from "../data/mockGuidelines";
import { simulateAIAnalysis } from "../data/mockAI";

const getBackendBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return `http://${window.location.hostname}:8000/api`;
  }
  return "http://127.0.0.1:8000/api";
};

const BACKEND_BASE_URL = getBackendBaseUrl();
const STORAGE_KEY_PATIENTS = "patch_perfect_patients_v1";

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

export const api = {
  // Get all patient wound profiles
  getPatients: async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/patients/`, {
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
      woundType: patientData.woundType || "Diabetic Wound",
      anatomicalLocation: patientData.anatomicalLocation || "Lower Extremity",
      status: "AWAITING SCAN",
      statusType: "warning",
      lastUpdated: "Just now",
      currentSeverity: null,
      currentSeverityLabel: "Awaiting Scan",
      healingStatus: "Not Assessed",
      aiRecommendation: "New patient profile registered. Capture or upload a wound photograph to run AI segmentation and severity scoring.",
      trend_data: [],
      scans: [],
    };
    const updated = [newPatient, ...existing];
    saveStoredPatients(updated);
    return newPatient;
  },

  // Submit image for AI analysis
  analyzeWound: async (imageDataUrl, patient) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/scans/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient?.id || patient?.custom_id,
          image_base64: imageDataUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          id: `scan-${Date.now()}`,
          severityScore: data.severity_score,
          severityLevel: data.severity_level,
          woundType: data.wound_type,
          healingStatus: data.healing_status,
          recommendation: data.recommendation,
          pipelineResults: data.pipeline_metrics?.tissue_stats || {
            granulation: 50,
            slough: 35,
            necrotic: 15,
          },
        };
      }
    } catch (e) {
      console.warn("Django AI analyze endpoint offline, running browser simulation.", e);
    }
    return simulateAIAnalysis(imageDataUrl, patient);
  },

  // Save scan result to patient profile
  saveScanResult: async (patientId, scanResult, imagePreview) => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/scans/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          severity_score: scanResult.severityScore,
          severity_level: scanResult.severityLevel,
          healing_status: scanResult.healingStatus,
          wound_type: scanResult.woundType,
          location: scanResult.location || "Lower Extremity",
          recommendation: scanResult.recommendation,
          image_base64: imagePreview,
          tissue_stats: scanResult.pipelineResults || { granulation: 50, slough: 35, necrotic: 15 },
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
      date: "Just now",
      severityScore: scanResult.severityScore,
      severityLevel: scanResult.severityLevel,
      healingStatus: scanResult.healingStatus,
      woundType: scanResult.woundType,
      location: scanResult.location || patient.anatomicalLocation,
      recommendation: scanResult.recommendation,
      tissueStats: scanResult.pipelineResults || { granulation: 50, slough: 35, necrotic: 15 },
      image: imagePreview,
      isLatest: true,
    };

    patient.currentSeverity = scanResult.severityScore;
    patient.currentSeverityLabel = scanResult.severityLevel;
    patient.healingStatus = scanResult.healingStatus;
    patient.aiRecommendation = scanResult.recommendation;
    patient.lastUpdated = "Today";
    patient.status =
      scanResult.severityScore >= 4
        ? "ACTION NEEDED"
        : scanResult.healingStatus === "Improving"
        ? "IMPROVING"
        : "STABLE";
    patient.statusType = scanResult.severityScore >= 4 ? "danger" : "success";

    const updatedScans = [
      newScanEntry,
      ...(patient.scans || []).map((s) => ({ ...s, isLatest: false })),
    ];
    patient.scans = updatedScans;

    const nextWeekIdx = (patient.trend_data?.length || patient.trendData?.length || 0) + 1;
    patient.trend_data = [
      ...(patient.trend_data || patient.trendData || []),
      { week: `Week ${nextWeekIdx}`, score: scanResult.severityScore },
    ];

    patients[targetIdx] = patient;
    saveStoredPatients(patients);
    return patient;
  },

  // Get treatment guidelines
  getGuidelines: async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/guidelines/`, {
        headers: { "Content-Type": "application/json" },
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
  clearAllData: () => {
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    return [];
  },

  // Load sample demo data
  loadDemoData: () => {
    saveStoredPatients(demoPatients);
    return demoPatients;
  },

  // Reset to initial (empty)
  resetDemoData: () => {
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    return [];
  },
};
