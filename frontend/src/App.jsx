import React, { useState, useEffect } from "react";
import { TopHeader } from "./components/Navigation/TopHeader";
import { BottomNav } from "./components/Navigation/BottomNav";
import { WoundProfilesDashboard } from "./components/Dashboard/WoundProfilesDashboard";
import { NewPatientModal } from "./components/Modals/NewPatientModal";
import { PatientTrendModal } from "./components/Modals/PatientTrendModal";
import { AIAnalysisWizard } from "./components/Analysis/AIAnalysisWizard";
import { GuidelinesScreen } from "./components/Guidelines/GuidelinesScreen";
import { SettingsModal } from "./components/Modals/SettingsModal";
import { api } from "./services/api";

export function App() {
  const [activeTab, setActiveTab] = useState("wounds"); // "wounds" | "scan" | "guidelines"
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Modals & Active Selections
  const [selectedPatientForTrend, setSelectedPatientForTrend] = useState(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [scanningPatient, setScanningPatient] = useState(null);

  // Listen for native beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
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
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Handle New Patient Creation
  const handleCreatePatient = async (newPatientData) => {
    const created = await api.createPatient(newPatientData);
    await loadPatients();
    // Open the trend modal for the freshly created patient
    setSelectedPatientForTrend(created);
  };

  // Handle Scan Start from Patient Profile
  const handleStartScanForPatient = (patient) => {
    setScanningPatient(patient);
    setSelectedPatientForTrend(null);
    setActiveTab("scan");
  };

  // Handle AI Scan Save
  const handleSaveScanResult = async (patientId, scanResult, imagePreview) => {
    if (patientId) {
      await api.saveScanResult(patientId, scanResult, imagePreview);
      await loadPatients();
    }
    setScanningPatient(null);
    setActiveTab("wounds");
  };

  // Load Demo Data
  const handleLoadDemoData = () => {
    const loaded = api.loadDemoData();
    setPatients(loaded);
  };

  // Reset to Empty Data
  const handleResetData = () => {
    const resetList = api.clearAllData();
    setPatients(resetList);
    setSelectedPatientForTrend(null);
  };

  return (
    <div className="mobile-viewport-shell">
      {/* Top Header */}
      {activeTab === "scan" ? (
        <TopHeader
          title="AI Analysis"
          isSubscreen={true}
          onBack={() => {
            setScanningPatient(null);
            setActiveTab("wounds");
          }}
          onCancel={() => {
            setScanningPatient(null);
            setActiveTab("wounds");
          }}
        />
      ) : (
        <TopHeader
          title="Patch Perfect AI"
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />
      )}

      {/* Main Content Body */}
      <main className="screen-scrollable-content">
        {activeTab === "wounds" && (
          <WoundProfilesDashboard
            patients={patients}
            onSelectPatient={(patient) => setSelectedPatientForTrend(patient)}
            onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
            onLoadDemoData={handleLoadDemoData}
            onResetData={handleResetData}
          />
        )}

        {activeTab === "scan" && (
          <AIAnalysisWizard
            patients={patients}
            initialPatient={scanningPatient}
            onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
            onSaveAndReturn={handleSaveScanResult}
            onCancel={() => {
              setScanningPatient(null);
              setActiveTab("wounds");
            }}
          />
        )}

        {activeTab === "guidelines" && <GuidelinesScreen />}
      </main>

      {/* Persistent Bottom Floating Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== "scan") {
            setScanningPatient(null);
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

      {/* Patient Wound Trend & History Modal */}
      <PatientTrendModal
        patient={selectedPatientForTrend}
        isOpen={!!selectedPatientForTrend}
        onClose={() => setSelectedPatientForTrend(null)}
        onStartScanForPatient={handleStartScanForPatient}
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
      />
    </div>
  );
}

export default App;
