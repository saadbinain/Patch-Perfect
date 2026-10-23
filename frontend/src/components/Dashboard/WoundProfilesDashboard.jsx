import React, { useState } from "react";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  X,
  Users,
} from "lucide-react";
import { PatientCard } from "./PatientCard";

export const WoundProfilesDashboard = ({
  patients = [],
  onSelectPatient,
  onOpenNewPatient,
  onLoadDemoData,
  onResetData,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'danger' | 'improving' | 'stable' | 'awaiting'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calculate KPI metrics
  const actionNeededCount = patients.filter(
    (p) =>
      p.status === "ACTION NEEDED" ||
      p.statusType === "danger" ||
      (p.currentSeverity && p.currentSeverity >= 4)
  ).length;

  const improvingCount = patients.filter(
    (p) =>
      p.status === "IMPROVING" ||
      p.healingStatus === "Improving" ||
      p.statusType === "success"
  ).length;

  const stableCount = patients.filter(
    (p) => p.status === "STABLE" || p.healingStatus === "Stable"
  ).length;

  const awaitingCount = patients.filter(
    (p) => p.status === "AWAITING SCAN" || p.currentSeverity === null
  ).length;

  // Filter patients by query and status pill
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && String(p.id).toLowerCase().includes(q)) ||
      (p.custom_id && String(p.custom_id).toLowerCase().includes(q)) ||
      (p.woundType && p.woundType.toLowerCase().includes(q)) ||
      (p.anatomicalLocation && p.anatomicalLocation.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeFilter === "danger") {
      return (
        p.status === "ACTION NEEDED" ||
        p.statusType === "danger" ||
        (p.currentSeverity && p.currentSeverity >= 4)
      );
    }
    if (activeFilter === "improving") {
      return (
        p.status === "IMPROVING" ||
        p.healingStatus === "Improving" ||
        p.statusType === "success"
      );
    }
    if (activeFilter === "stable") {
      return p.status === "STABLE" || p.healingStatus === "Stable";
    }
    if (activeFilter === "awaiting") {
      return p.status === "AWAITING SCAN" || p.currentSeverity === null;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  // If no patients exist in the whole database (New User empty state)
  if (patients.length === 0) {
    return (
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Header Banner */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: "800",
                letterSpacing: "0.08em",
                color: "#8B1E1E",
                textTransform: "uppercase",
              }}
            >
              Clinical Registry
            </span>
            <h2 style={{ fontSize: "1.45rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
              Patient Profiles
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "2px" }}>
              Wound healing trajectory monitoring & assessment
            </p>
          </div>

          <div
            style={{
              background: "#F1F5F9",
              color: "#64748B",
              border: "1px solid #E2E8F0",
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "0.72rem",
              fontWeight: "700",
            }}
          >
            0 PATIENTS
          </div>
        </div>

        {/* Empty State Welcome Card */}
        <div
          className="app-card"
          style={{
            padding: "36px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            background: "#FFFFFF",
            borderRadius: "24px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
            border: "1px solid #E2E8F0",
          }}
        >
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #FEE2E2 0%, #FECDD3 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8B1E1E",
            }}
          >
            <UserPlus size={32} />
          </div>

          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#0F172A", margin: 0 }}>
              No Patients Registered Yet
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#64748B", marginTop: "6px", maxWidth: "280px" }}>
              Register your first patient profile to begin AI wound segmentation and healing evaluation.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "280px", marginTop: "6px" }}>
            <button
              onClick={onOpenNewPatient}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}
            >
              <Plus size={18} />
              <span>Register New Patient</span>
            </button>

            {onLoadDemoData && (
              <button
                onClick={onLoadDemoData}
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  color: "#334155",
                  padding: "10px",
                  borderRadius: "14px",
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Sparkles size={15} color="#8B1E1E" />
                <span>Load 5 Demo Sample Profiles</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 14px 24px 14px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* KPI METRICS HORIZONTAL CAROUSEL */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          paddingBottom: "4px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* Total Patients Card */}
        <div
          onClick={() => setActiveFilter("all")}
          style={{
            flex: "0 0 110px",
            background: activeFilter === "all" ? "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)" : "#FFFFFF",
            color: activeFilter === "all" ? "#FFFFFF" : "#0F172A",
            border: activeFilter === "all" ? "1.5px solid #334155" : "1px solid #E2E8F0",
            borderRadius: "18px",
            padding: "12px 14px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", opacity: 0.8, textTransform: "uppercase" }}>Total</span>
            <Users size={14} color={activeFilter === "all" ? "#94A3B8" : "#64748B"} />
          </div>
          <strong style={{ fontSize: "1.45rem", fontWeight: "800", lineHeight: 1.1 }}>{patients.length}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.75 }}>Registered</span>
        </div>

        {/* Action Needed Card */}
        <div
          onClick={() => setActiveFilter("danger")}
          style={{
            flex: "0 0 120px",
            background: activeFilter === "danger" ? "linear-gradient(135deg, #991B1B 0%, #7F1D1D 100%)" : "#FEF2F2",
            color: activeFilter === "danger" ? "#FFFFFF" : "#991B1B",
            border: activeFilter === "danger" ? "1.5px solid #B91C1C" : "1px solid #FECDD3",
            borderRadius: "18px",
            padding: "12px 14px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(185, 28, 28, 0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>Action</span>
            <AlertTriangle size={14} color={activeFilter === "danger" ? "#FECDD3" : "#DC2626"} />
          </div>
          <strong style={{ fontSize: "1.45rem", fontWeight: "800", lineHeight: 1.1 }}>{actionNeededCount}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.85 }}>Severe / Needed</span>
        </div>

        {/* Improving Card */}
        <div
          onClick={() => setActiveFilter("improving")}
          style={{
            flex: "0 0 115px",
            background: activeFilter === "improving" ? "linear-gradient(135deg, #065F46 0%, #047857 100%)" : "#ECFDF5",
            color: activeFilter === "improving" ? "#FFFFFF" : "#065F46",
            border: activeFilter === "improving" ? "1.5px solid #059669" : "1px solid #A7F3D0",
            borderRadius: "18px",
            padding: "12px 14px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(5, 150, 105, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>Healing</span>
            <TrendingUp size={14} color={activeFilter === "improving" ? "#A7F3D0" : "#059669"} />
          </div>
          <strong style={{ fontSize: "1.45rem", fontWeight: "800", lineHeight: 1.1 }}>{improvingCount}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.85 }}>Improving</span>
        </div>

        {/* Stable Card */}
        <div
          onClick={() => setActiveFilter("stable")}
          style={{
            flex: "0 0 110px",
            background: activeFilter === "stable" ? "linear-gradient(135deg, #0F766E 0%, #115E59 100%)" : "#F0FDFA",
            color: activeFilter === "stable" ? "#FFFFFF" : "#0F766E",
            border: activeFilter === "stable" ? "1.5px solid #0D9488" : "1px solid #99F6E4",
            borderRadius: "18px",
            padding: "12px 14px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(13, 148, 136, 0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", opacity: 0.9, textTransform: "uppercase" }}>Stable</span>
            <ShieldCheck size={14} color={activeFilter === "stable" ? "#99F6E4" : "#0D9488"} />
          </div>
          <strong style={{ fontSize: "1.45rem", fontWeight: "800", lineHeight: 1.1 }}>{stableCount}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.85 }}>Monitoring</span>
        </div>
      </div>

      {/* SEARCH INPUT */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: "14px", top: "11px", color: "#94A3B8" }}>
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search by patient name, ID, or site..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            width: "100%",
            padding: "10px 38px 10px 40px",
            borderRadius: "14px",
            border: "1.5px solid #CBD5E1",
            fontSize: "0.88rem",
            color: "#0F172A",
            backgroundColor: "#FFFFFF",
            outline: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute",
              right: "12px",
              top: "10px",
              background: "#E2E8F0",
              border: "none",
              borderRadius: "50%",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* FILTER PILLS */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "2px",
          scrollbarWidth: "none",
        }}
      >
        <button
          className={`filter-chip ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("all");
            setCurrentPage(1);
          }}
        >
          <span>All</span>
          <span style={{ opacity: 0.75 }}>({patients.length})</span>
        </button>

        <button
          className={`filter-chip ${activeFilter === "danger" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("danger");
            setCurrentPage(1);
          }}
        >
          <span>🚨 Action Needed</span>
          {actionNeededCount > 0 && <span>({actionNeededCount})</span>}
        </button>

        <button
          className={`filter-chip ${activeFilter === "improving" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("improving");
            setCurrentPage(1);
          }}
        >
          <span>🌱 Improving</span>
          {improvingCount > 0 && <span>({improvingCount})</span>}
        </button>

        <button
          className={`filter-chip ${activeFilter === "stable" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("stable");
            setCurrentPage(1);
          }}
        >
          <span>✓ Stable</span>
          {stableCount > 0 && <span>({stableCount})</span>}
        </button>

        <button
          className={`filter-chip ${activeFilter === "awaiting" ? "active" : ""}`}
          onClick={() => {
            setActiveFilter("awaiting");
            setCurrentPage(1);
          }}
        >
          <span>⏳ Awaiting Scan</span>
          {awaitingCount > 0 && <span>({awaitingCount})</span>}
        </button>
      </div>

      {/* PATIENT LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {currentPatients.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: "18px",
              border: "1px dashed #CBD5E1",
              color: "#64748B",
            }}
          >
            <p style={{ fontSize: "0.9rem", fontWeight: "600", margin: 0 }}>No matching patient profiles found</p>
            <p style={{ fontSize: "0.78rem", color: "#94A3B8", marginTop: "4px" }}>
              Try searching a different name or resetting your filter.
            </p>
          </div>
        ) : (
          currentPatients.map((patient) => (
            <PatientCard
              key={patient.id || patient.custom_id}
              patient={patient}
              onClick={() => onSelectPatient(patient)}
            />
          ))
        )}
      </div>

      {/* PAGINATION (MOBILE CLEAN CONTROLS) */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
          }}
        >
          <span style={{ fontSize: "0.76rem", color: "#64748B", fontWeight: "600" }}>
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredPatients.length)} of {filteredPatients.length}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "5px 8px",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                opacity: currentPage === 1 ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={16} color="#334155" />
            </button>
            <span style={{ fontSize: "0.76rem", fontWeight: "700", color: "#0F172A", padding: "0 4px" }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "5px 8px",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                opacity: currentPage === totalPages ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={16} color="#334155" />
            </button>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON (FAB) FOR FAST ADD PATIENT */}
      <button
        onClick={onOpenNewPatient}
        className="mobile-fab"
        title="Register New Patient Profile"
      >
        <Plus size={18} strokeWidth={2.6} />
        <span>New Patient</span>
      </button>
    </div>
  );
};
