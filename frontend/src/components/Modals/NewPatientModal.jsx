import React, { useState } from "react";

export const NewPatientModal = ({ isOpen, onClose, onCreatePatient }) => {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    address: "",
    phone: "",
    emergencyContact: "",
    notes: "",
    allergies: "",
    woundType: "Diabetic Wound",
    anatomicalLocation: "Lower Extremity",
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.age) newErrors.age = "Age is required";
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCreatePatient(formData);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
        {/* Top Handle */}
        <div className="sheet-handle-bar"></div>

        {/* Title */}
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#0F172A" }}>
            New Patient Profile
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#64748B", marginTop: "2px" }}>
            Enter comprehensive patient details for wound tracking
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Full Name */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
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
                borderRadius: "10px",
                border: errors.name ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
            {errors.name && <span style={{ fontSize: "0.72rem", color: "#EF4444", marginTop: "2px" }}>{errors.name}</span>}
          </div>

          {/* Age & Gender */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
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
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: errors.age ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              {errors.age && <span style={{ fontSize: "0.72rem", color: "#EF4444", marginTop: "2px" }}>{errors.age}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Gender *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: errors.gender ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                  fontSize: "0.9rem",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && <span style={{ fontSize: "0.72rem", color: "#EF4444", marginTop: "2px" }}>{errors.gender}</span>}
            </div>
          </div>

          {/* Wound Type Selection */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Initial Wound Type
              </label>
              <select
                name="woundType"
                value={formData.woundType}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value="Diabetic Wound">Diabetic Wound</option>
                <option value="Surgical Wound">Surgical Wound</option>
                <option value="Pressure Injury">Pressure Injury</option>
                <option value="Venous Ulcer">Venous Ulcer</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Anatomical Location
              </label>
              <input
                type="text"
                name="anatomicalLocation"
                placeholder="e.g. Left Foot"
                value={formData.anatomicalLocation}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
              Address *
            </label>
            <input
              type="text"
              name="address"
              placeholder="123 Main St, City, State, ZIP"
              value={formData.address}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: errors.address ? "1.5px solid #EF4444" : "1px solid #CBD5E1",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
            {errors.address && <span style={{ fontSize: "0.72rem", color: "#EF4444", marginTop: "2px" }}>{errors.address}</span>}
          </div>

          {/* Phone & Emergency Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Phone
              </label>
              <input
                type="text"
                name="phone"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                Emergency Contact
              </label>
              <input
                type="text"
                name="emergencyContact"
                placeholder="Name & phone"
                value={formData.emergencyContact}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Medical history, observations, or any relevant notes..."
              value={formData.notes}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                outline: "none",
                fontFamily: "inherit",
                resize: "none",
              }}
            />
          </div>

          {/* Allergies */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
              Allergies
            </label>
            <input
              type="text"
              name="allergies"
              placeholder="e.g. Penicillin, Latex"
              value={formData.allergies}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ width: "100%" }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ width: "100%" }}>
              Create Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
