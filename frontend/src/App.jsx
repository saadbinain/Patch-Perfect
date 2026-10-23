import React, { useState, useEffect } from "react";
import { TopHeader } from "./components/Navigation/TopHeader";
import { BottomNav } from "./components/Navigation/BottomNav";
import { WoundProfilesDashboard } from "./components/Dashboard/WoundProfilesDashboard";
import { NewPatientModal } from "./components/Modals/NewPatientModal";
import { PatientDetailScreen } from "./components/PatientDetail/PatientDetailScreen";
import { AIAnalysisWizard } from "./components/Analysis/AIAnalysisWizard";
import { GuidelinesScreen } from "./components/Guidelines/GuidelinesScreen";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { api } from "./services/api";
import { authService } from "./services/authService";
import {
  getSimulatedDateConfig,
  getEffectiveDate,
  formatDisplayDate,
  resetToLiveDate,
} from "./services/dateService";

export function App() {
  const [currentUser, setCurrentUser] = useState(authService.getUser());
  const [activeTab, setActiveTab] = useState("wounds"); // "wounds" | "scan" | "guidelines"
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Simulation State
  const [simConfig, setSimConfig] = useState(getSimulatedDateConfig());

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Full Screen & Active Selections
  const [selectedPatientForTrend, setSelectedPatientForTrend] = useState(null);
  const [viewingWoundId, setViewingWoundId] = useState(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [scanningPatient, setScanningPatient] = useState(null);
  const [scanningWound, setScanningWound] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthChange = () => {
      const user = authService.getUser();
      setCurrentUser(user);
    };
    window.addEventListener("patch_perfect_auth_changed", handleAuthChange);
    return () => window.removeEventListener("patch_perfect_auth_changed", handleAuthChange);
  }, []);

  // Background token verification on startup
  useEffect(() => {
    if (currentUser) {
      authService.getCurrentUser().then((user) => {
        if (!user && !authService.getToken()?.startsWith("local-token-") && !authService.getToken()?.startsWith("demo-session-")) {
          setCurrentUser(null);
        }
      });
    }
  }, []);

  // Listen for native beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  // Listen for simulated date changes across the app
  useEffect(() => {
    const handleDateChange = () => {
      setSimConfig(getSimulatedDateConfig());
    };
    window.addEventListener("patch_perfect_date_changed", handleDateChange);
    return () => window.removeEventListener("patch_perfect_date_changed", handleDateChange);
  }, []);

  const handleInstallNative = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsSettingsModalOpen(false);
      }
    }
  };

  // Load patients from API / local storage
  const loadPatients = async () => {
    setIsLoading(true);
    const data = await api.getPatients();
    setPatients(data);
    setIsLoading(false);
    return data;
  };

  useEffect(() => {
    if (currentUser) {
      loadPatients();
    }
  }, [currentUser]);

  // Handle Logout
  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setSelectedPatientForTrend(null);
    setViewingWoundId(null);
  };

  // Handle New Patient Creation
  const handleCreatePatient = async (newPatientData) => {
    const created = await api.createPatient(newPatientData);
    await loadPatients();
    setSelectedPatientForTrend(created);
    setViewingWoundId(null);
  };

  // Handle Scan Start from Patient Profile
  const handleStartScanForPatient = (patient, wound = null) => {
    setScanningPatient(patient);
    setScanningWound(wound);
    setSelectedPatientForTrend(null);
    setViewingWoundId(null);
    setActiveTab("scan");
  };

  // Handle AI Scan Save with Custom/Simulated Date & Target Wound
  const handleSaveScanResult = async (patientId, scanResult, imagePreview, customDate, woundProfileId = null) => {
    if (patientId) {
      await api.saveScanResult(patientId, scanResult, imagePreview, customDate, woundProfileId);
      const updatedList = await loadPatients();
      if (selectedPatientForTrend) {
        const found = updatedList.find((p) => (p.id || p.custom_id) === patientId);
        if (found) setSelectedPatientForTrend(found);
      }
    }
    setScanningPatient(null);
    setScanningWound(null);
    setActiveTab("wounds");
  };

  // Load Demo Data
  const handleLoadDemoData = async () => {
    setIsLoading(true);
    const loaded = await api.loadDemoData();
    setPatients(loaded);
    setIsLoading(false);
  };

  // Reset to Empty Data (Clear all records)
  const handleResetData = async () => {
    setIsLoading(true);
    const resetList = await api.clearAllData();
    setPatients(resetList);
    setSelectedPatientForTrend(null);
    setViewingWoundId(null);
    setIsLoading(false);
  };

  // If not authenticated, show modern medical Auth Gate (Sign In / Register)
  if (!currentUser) {
    return (
      <AuthScreen
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          loadPatients();
        }}
      />
    );
  }

  const actionNeededCount = patients.filter(
    (p) =>
      p.status === "ACTION NEEDED" ||
      p.statusType === "danger" ||
      (p.currentSeverity && p.currentSeverity >= 4)
  ).length;

  // Active wound title calculation for header
  let activeWoundHeaderTitle = null;
  if (selectedPatientForTrend && viewingWoundId) {
    const woundsList =
      selectedPatientForTrend.wounds && selectedPatientForTrend.wounds.length > 0
        ? selectedPatientForTrend.wounds
        : [
            {
              id: "primary",
              anatomical_location: selectedPatientForTrend.anatomicalLocation || "Lower Extremity",
              label: selectedPatientForTrend.anatomicalLocation || "Primary Wound",
            },
          ];
    const foundWound = woundsList.find((w) => (w.id || "primary") === viewingWoundId);
    activeWoundHeaderTitle = foundWound
      ? foundWound.anatomical_location || foundWound.label || "Wound Timeline"
      : "Wound Assessment";
  }

  return (
    <div className="mobile-viewport-shell">
      {/* Dynamic Top Header */}
      {activeTab === "scan" ? (
        <TopHeader
          title="AI Analysis"
          isSubscreen={true}
          currentUser={currentUser}
          onBack={() => {
            setScanningPatient(null);
            setScanningWound(null);
            setActiveTab("wounds");
          }}
        />
      ) : activeTab === "guidelines" ? (
        <TopHeader
          title="Clinical Guidelines"
          currentUser={currentUser}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
      ) : selectedPatientForTrend ? (
        <TopHeader
          title={
            viewingWoundId
              ? activeWoundHeaderTitle
              : selectedPatientForTrend.name
              ? selectedPatientForTrend.name
                  .split(" ")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                  .join(" ")
              : "Patient Details"
          }
          isSubscreen={true}
          currentUser={currentUser}
          onBack={() => {
            if (viewingWoundId) {
              setViewingWoundId(null);
            } else {
              setSelectedPatientForTrend(null);
            }
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
      ) : (
        <TopHeader
          title="Patch Perfect"
          currentUser={currentUser}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
      )}

      {/* Simulated Date Notification Banner */}
      {simConfig && simConfig.enabled && (
        <div
          style={{
            background: "linear-gradient(90deg, #7F1D1D 0%, #991B1B 100%)",
            color: "#FFFFFF",
            padding: "7px 14px",
            fontSize: "0.76rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <span>📅</span>
            <span style={{ opacity: 0.9 }}>Simulated Date:</span>
            <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {formatDisplayDate(getEffectiveDate(), true)}
            </strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              style={{
                background: "rgba(255,255,255,0.22)",
                border: "none",
                color: "#FFFFFF",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "0.7rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Adjust
            </button>
            <button
              onClick={() => {
                resetToLiveDate();
                setSimConfig(getSimulatedDateConfig());
              }}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "none",
                color: "#FECDD3",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "0.7rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="screen-scrollable-content">
        {activeTab === "wounds" && (
          selectedPatientForTrend ? (
            <PatientDetailScreen
              patient={selectedPatientForTrend}
              viewingWoundId={viewingWoundId}
              setViewingWoundId={setViewingWoundId}
              onBack={() => {
                setSelectedPatientForTrend(null);
                setViewingWoundId(null);
              }}
              onStartScanForPatient={handleStartScanForPatient}
              onPatientUpdated={async () => {
                const updated = await loadPatients();
                if (selectedPatientForTrend) {
                  const found = updated.find(
                    (p) => (p.id || p.custom_id) === (selectedPatientForTrend.id || selectedPatientForTrend.custom_id)
                  );
                  if (found) setSelectedPatientForTrend(found);
                }
              }}
            />
          ) : (
            <WoundProfilesDashboard
              patients={patients}
              onSelectPatient={(patient) => {
                setSelectedPatientForTrend(patient);
                setViewingWoundId(null);
              }}
              onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
              onLoadDemoData={handleLoadDemoData}
              onResetData={handleResetData}
            />
          )
        )}

        {activeTab === "scan" && (
          <AIAnalysisWizard
            patients={patients}
            initialPatient={scanningPatient}
            initialWound={scanningWound}
            onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
            onSaveAndReturn={handleSaveScanResult}
            onCancel={() => {
              setScanningPatient(null);
              setScanningWound(null);
              setActiveTab("wounds");
            }}
          />
        )}

        {activeTab === "guidelines" && <GuidelinesScreen />}
      </main>

      {/* Persistent Bottom Floating Navigation */}
      <BottomNav
        activeTab={activeTab}
        actionNeededCount={actionNeededCount}
        onTabChange={(tab) => {
          if (tab !== "scan") {
            setScanningPatient(null);
            setScanningWound(null);
          }
          if (tab !== "wounds") {
            setSelectedPatientForTrend(null);
            setViewingWoundId(null);
          }
          setActiveTab(tab);
        }}
      />

      {/* New Patient Modal Bottom Sheet */}
      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onCreatePatient={handleCreatePatient}
      />

      {/* Settings & Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallNative={handleInstallNative}
        onLoadDemoData={handleLoadDemoData}
        onClearAllData={handleResetData}
        patientCount={patients.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
