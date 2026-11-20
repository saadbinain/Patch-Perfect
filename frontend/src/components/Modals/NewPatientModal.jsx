import React, { useState } from "react";
import { X, UserPlus, MapPin, HeartPulse, ShieldAlert } from "lucide-react";

export const NewPatientModal = ({ isOpen, onClose, onCreatePatient }) => {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "Female",
    address: "",
    phone: "",
    emergencyContact: "",
    notes: "",
    allergies: "None",
    woundType: "Diabetic Wound",
    anatomicalLocation: "Lower Extremity",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.age) newErrors.age = "Age is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Only close once the patient really exists; otherwise keep the form and show why
    setIsSubmitting(true);
    try {
      await onCreatePatient(formData);
      setErrors({});
      onClose();
    } catch (err) {
      setErrors({ form: err?.message || "Could not register the patient. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const commonLocations = [
    "Lower Extremity",
    "Foot / Heel",
    "Sacral / Coccyx",
    "Abdomen",
    "Upper Extremity",
  ];

  const commonWoundTypes = [
    "Diabetic Wound",
    "Pressure Injury",
    "Venous Ulcer",
    "Surgical Wound",
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "92%" }}
      >
        {/* Grabber Handle */}
        <div className="sheet-handle-bar" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                backgroundColor: "#FEE2E2",
                color: "#8B1E1E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserPlus size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0F172A", margin: 0 }}>
                Register Patient
              </h3>
              <p style={{ fontSize: "0.76rem", color: "#64748B", margin: "2px 0 0 0" }}>
                Add new patient profile to wound database
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Full Name */}
          <div>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g. Ana Reyes"
              value={formData.name}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "12px",
                border: errors.name ? "1.5px solid #EF4444" : "1.5px solid #CBD5E1",
                fontSize: "0.9rem",
                outline: "none",
                backgroundColor: "#FFFFFF",
              }}
            />
            {errors.name && <span style={{ fontSize: "0.72rem", color: "#EF4444", marginTop: "2px" }}>{errors.name}</span>}
          </div>

          {/* Age & Gender Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                Age *
              </label>
              <input
                type="number"
                name="age"
                placeholder="45"
                value={formData.age}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: errors.age ? "1.5px solid #EF4444" : "1.5px solid #CBD5E1",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              {errors.age && <span style={{ fontSize: "0.72rem", color: "#EF4444" }}>{errors.age}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                Gender
              </label>
              <div style={{ display: "flex", gap: "4px" }}>
                {["Female", "Male", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, gender: g }))}
                    style={{
                      flex: 1,
                      padding: "10px 4px",
                      borderRadius: "10px",
                      fontSize: "0.76rem",
                      fontWeight: "700",
                      border: formData.gender === g ? "1.5px solid #8B1E1E" : "1.5px solid #CBD5E1",
                      background: formData.gender === g ? "#FEF2F2" : "#FFFFFF",
                      color: formData.gender === g ? "#8B1E1E" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary Wound Type & Anatomical Location */}
          <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: "0.74rem", fontWeight: "800", color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
              <HeartPulse size={14} color="#8B1E1E" />
              <span>Primary Wound Site</span>
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                  Wound Category
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {commonWoundTypes.map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, woundType: wt }))}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "0.74rem",
                        fontWeight: "600",
                        border: formData.woundType === wt ? "1.5px solid #8B1E1E" : "1px solid #CBD5E1",
                        background: formData.woundType === wt ? "#FFFFFF" : "#F1F5F9",
                        color: formData.woundType === wt ? "#8B1E1E" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.74rem", fontWeight: "700", color: "#475569", marginBottom: "4px" }}>
                  Anatomical Site
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {commonLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, anatomicalLocation: loc }))}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "0.74rem",
                        fontWeight: "600",
                        border: formData.anatomicalLocation === loc ? "1.5px solid #8B1E1E" : "1px solid #CBD5E1",
                        background: formData.anatomicalLocation === loc ? "#FFFFFF" : "#F1F5F9",
                        color: formData.anatomicalLocation === loc ? "#8B1E1E" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Emergency (Optional) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Phone / Contact
              </label>
              <input
                type="text"
                name="phone"
                placeholder="(555) 019-2834"
                value={formData.phone}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Known Allergies
              </label>
              <input
                type="text"
                name="allergies"
                placeholder="e.g. Latex, Iodine"
                value={formData.allergies}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {errors.form && (
            <div
              role="alert"
              style={{ background: "#FEF2F2", border: "1px solid #FECDD3", color: "#991B1B", borderRadius: "10px", padding: "9px 12px", fontSize: "0.8rem", fontWeight: 600 }}
            >
              {errors.form}
            </div>
          )}

          {/* Bottom Actions */}
          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, padding: "12px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              style={{ flex: 1.5, padding: "12px", opacity: isSubmitting ? 0.6 : 1 }}
            >
              <UserPlus size={18} />
              <span>{isSubmitting ? "Saving…" : "Save & Open Profile"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
