import React, { useState } from "react";
import { Search, Plus, ChevronLeft, ChevronRight, UserPlus, Database, Sparkles } from "lucide-react";
import { PatientCard } from "./PatientCard";

export const WoundProfilesDashboard = ({
  patients = [],
  onSelectPatient,
  onOpenNewPatient,
  onLoadDemoData,
  onResetData,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Filter patients by name, ID or wound type
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.id && String(p.id).toLowerCase().includes(q)) ||
      (p.custom_id && String(p.custom_id).toLowerCase().includes(q)) ||
      (p.woundType && p.woundType.toLowerCase().includes(q)) ||
      (p.anatomicalLocation && p.anatomicalLocation.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPatients = filteredPatients.slice(startIndex, startIndex + itemsPerPage);

  const startDisplay = filteredPatients.length === 0 ? 0 : startIndex + 1;
  const endDisplay = Math.min(startIndex + itemsPerPage, filteredPatients.length);

  // If no patients exist in the whole database (New User state)
  if (patients.length === 0) {
    return (
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Header Banner */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: "700",
                letterSpacing: "0.08em",
                color: "#94A3B8",
                textTransform: "uppercase",
              }}
            >
              STEP 1
            </span>
            <h2 style={{ fontSize: "1.45rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
              Wound Profiles
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "2px" }}>
              Patient registry and healing trajectory monitoring
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
              letterSpacing: "0.04em",
            }}
          >
            TOTAL: 0
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
            borderRadius: "20px",
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
              boxShadow: "0 8px 16px rgba(139, 30, 30, 0.12)",
            }}
          >
            <UserPlus size={32} />
          </div>

          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0F172A" }}>
              No Patients Enrolled Yet
            </h3>
            <p style={{ fontSize: "0.86rem", color: "#64748B", marginTop: "6px", lineHeight: "1.5", maxWidth: "320px" }}>
              Welcome to <strong>Patch Perfect AI</strong>! Start by adding your first patient profile to begin wound assessment, photo capture, and AI healing progression tracking.
            </p>
          </div>

          <button
            onClick={onOpenNewPatient}
            className="btn-primary"
            style={{
              padding: "13px 24px",
              borderRadius: "14px",
              fontSize: "0.92rem",
              fontWeight: "700",
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 8px 20px rgba(139, 30, 30, 0.25)",
            }}
          >
            <Plus size={19} />
            <span>Enroll First Patient</span>
          </button>

          {onLoadDemoData && (
            <div style={{ marginTop: "12px", paddingTop: "14px", borderTop: "1px dashed #E2E8F0", width: "100%" }}>
              <button
                type="button"
                onClick={onLoadDemoData}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748B",
                  fontSize: "0.78rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                }}
              >
                <Sparkles size={14} color="#8B1E1E" />
                <span>Load manuscript sample demo profiles</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: "700",
              letterSpacing: "0.08em",
              color: "#94A3B8",
              textTransform: "uppercase",
            }}
          >
            STEP 1
          </span>
          <h2 style={{ fontSize: "1.45rem", fontWeight: "800", color: "#0F172A", marginTop: "2px" }}>
            Wound Profiles
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "2px" }}>
            Select a wound to view full profile & trends
          </p>
        </div>

        <div
          style={{
            background: "#DBEAFE",
            color: "#1E40AF",
            border: "1px solid #BFDBFE",
            borderRadius: "20px",
            padding: "4px 12px",
            fontSize: "0.72rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
          }}
        >
          TOTAL: {patients.length}
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            background: "#F1F5F9",
            borderRadius: "12px",
            padding: "0 12px",
            border: "1px solid #E2E8F0",
          }}
        >
          <Search size={18} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search by patient or ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              padding: "10px 8px",
              fontSize: "0.88rem",
              color: "#1E293B",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={onOpenNewPatient}
          className="btn-primary"
          style={{ padding: "10px 16px", borderRadius: "12px", fontSize: "0.88rem" }}
        >
          <Plus size={18} />
          <span>New</span>
        </button>
      </div>

      {/* Patients List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "260px" }}>
        {currentPatients.length > 0 ? (
          currentPatients.map((patient) => (
            <PatientCard
              key={patient.id || patient.custom_id}
              patient={patient}
              onClick={() => onSelectPatient(patient)}
            />
          ))
        ) : (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "36px 16px",
              textAlign: "center",
              border: "1px dashed #CBD5E1",
              color: "#64748B",
            }}
          >
            <p style={{ fontSize: "0.95rem", fontWeight: "600" }}>No patient profiles found</p>
            <p style={{ fontSize: "0.8rem", color: "#94A3B8", marginTop: "4px" }}>
              Try searching with another query or add a new patient.
            </p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {filteredPatients.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "6px",
            borderTop: "1px solid #E2E8F0",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#64748B", fontWeight: "500" }}>
            Showing {startDisplay} to {endDisplay} of {filteredPatients.length}
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: "600",
                color: currentPage <= 1 ? "#94A3B8" : "#334155",
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: "600",
                color: currentPage >= totalPages ? "#94A3B8" : "#334155",
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
