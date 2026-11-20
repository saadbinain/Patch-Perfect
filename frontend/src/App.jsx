import React, { useState, useEffect, useRef } from "react";
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
  // Where to return when a scan started from a patient/wound screen is cancelled
  const [scanReturnTarget, setScanReturnTarget] = useState(null);
  // Unsaved photo/result in the scan wizard -> confirm before navigating away
  const [scanIsDirty, setScanIsDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(null);
  const guardScanLeave = (action) => {
    if (activeTab === "scan" && scanIsDirty) {
      setPendingLeave(() => action);
    } else {
      action();
    }
  };

  // Each screen change should start at the top, not inherit the previous scroll position
  const mainScrollRef = useRef(null);
  const selectedPatientKey = selectedPatientForTrend
    ? selectedPatientForTrend.id || selectedPatientForTrend.custom_id
    : null;
  useEffect(() => {
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  }, [activeTab, selectedPatientKey, viewingWoundId]);

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
    if (activeTab === "scan") {
      // Registered from inside the scan flow: keep scanning, with this patient selected
      setScanningPatient(created);
      setScanningWound(null);
      return;
    }
    setSelectedPatientForTrend(created);
    setViewingWoundId(null);
  };

  // Handle Scan Start from Patient Profile
  const handleStartScanForPatient = (patient, wound = null) => {
    setScanReturnTarget({ patient, woundId: viewingWoundId });
    setScanningPatient(patient);
    setScanningWound(wound);
    setSelectedPatientForTrend(null);
    setViewingWoundId(null);
    setActiveTab("scan");
  };

  // Handle AI Scan Save with Custom/Simulated Date & Target Wound
  const handleSaveScanResult = async (patientId, scanResult, imagePreview, customDate, woundProfileId = null) => {
    let found = null;
    if (patientId) {
      await api.saveScanResult(patientId, scanResult, imagePreview, customDate, woundProfileId);
      const updatedList = await loadPatients();
      found = updatedList.find((p) => (p.id || p.custom_id) === patientId) || null;
    }
    setScanningPatient(null);
    setScanningWound(null);
    setScanReturnTarget(null);
    setScanIsDirty(false);
    // Land on the wound timeline that was just scanned so the new result is visible
    if (found) {
      const hasWound = woundProfileId != null && (found.wounds || []).some((w) => w.id === woundProfileId);
      setSelectedPatientForTrend(found);
      setViewingWoundId(hasWound ? woundProfileId : found.wounds?.[0]?.id ?? "primary");
    }
    setActiveTab("wounds");
  };

  const handleCancelScan = () => {
    setScanIsDirty(false);
    setScanningPatient(null);
    setScanningWound(null);
    if (scanReturnTarget?.patient) {
      setSelectedPatientForTrend(scanReturnTarget.patient);
      setViewingWoundId(scanReturnTarget.woundId ?? null);
    }
    setScanReturnTarget(null);
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
          onBack={() => guardScanLeave(handleCancelScan)}
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
      <main className="screen-scrollable-content" ref={mainScrollRef}>
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
            key={scanningPatient ? scanningPatient.id || scanningPatient.custom_id : "new-scan"}
            patients={patients}
            initialPatient={scanningPatient}
            initialWound={scanningWound}
            onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
            onRefreshPatients={loadPatients}
            onSaveAndReturn={handleSaveScanResult}
            onDirtyChange={setScanIsDirty}
          />
        )}

        {activeTab === "guidelines" && <GuidelinesScreen />}
      </main>

      {/* Persistent Bottom Floating Navigation */}
      <BottomNav
        activeTab={activeTab}
        actionNeededCount={actionNeededCount}
        onTabChange={(tab) => guardScanLeave(() => {
          if (tab === activeTab && tab === "scan") return;
          // Scanning from a patient/wound screen: carry that context into the wizard
          if (tab === "scan" && activeTab === "wounds" && selectedPatientForTrend) {
            const wound = viewingWoundId
              ? (selectedPatientForTrend.wounds || []).find((w) => w.id === viewingWoundId) || null
              : null;
            handleStartScanForPatient(selectedPatientForTrend, wound);
            return;
          }
          if (tab !== "scan") {
            setScanIsDirty(false);
            setScanningPatient(null);
            setScanningWound(null);
            setScanReturnTarget(null);
          }
          if (tab !== "wounds") {
            setSelectedPatientForTrend(null);
            setViewingWoundId(null);
          }
          setActiveTab(tab);
        })}
      />

      {/* Confirm leaving the scan flow with an unsaved photo/result */}
      {pendingLeave && (
        <div className="modal-backdrop" onClick={() => setPendingLeave(null)}>
          <div
            className="bottom-sheet-content"
            role="alertdialog"
            aria-labelledby="discard-scan-title"
            onClick={(e) => e.stopPropagation()}
            style={{ gap: "10px" }}
          >
            <div className="sheet-handle-bar" />
            <h3 id="discard-scan-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>
              Discard this scan?
            </h3>
            <p style={{ fontSize: "0.86rem", color: "#64748B", lineHeight: 1.45 }}>
              The photo and analysis haven't been saved to the patient's timeline yet.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
              <button type="button" className="btn-secondary" onClick={() => setPendingLeave(null)}>
                Keep scanning
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const action = pendingLeave;
                  setPendingLeave(null);
                  setScanIsDirty(false);
                  action();
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

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
