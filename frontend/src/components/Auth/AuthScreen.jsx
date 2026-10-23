import React, { useState } from "react";
import {
  Pill,
  Lock,
  User,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Stethoscope,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { authService } from "../../services/authService";

export const AuthScreen = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState("Wound Care Specialist");

  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    clearMessages();
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!loginUsername.trim() || !loginPassword) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await authService.login(loginUsername, loginPassword);
      setSuccessMessage(`Welcome back, ${user.full_name || user.username}!`);
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(user);
      }, 500);
    } catch (err) {
      setErrorMessage(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!regUsername.trim()) {
      setErrorMessage("Please enter a username.");
      return;
    }
    if (!regPassword) {
      setErrorMessage("Please enter a secure password.");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await authService.register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
        role: regRole,
      });
      setSuccessMessage("Account created successfully! Signing in...");
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(user);
      }, 600);
    } catch (err) {
      setErrorMessage(err.message || "Registration failed. Please choose another username.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setIsLoading(true);
    clearMessages();
    setTimeout(() => {
      const { user } = authService.demoLogin("Lead Clinician");
      setSuccessMessage("Signed in as Demo Clinician (Dr. Elena Morales)");
      setTimeout(() => {
        if (onAuthSuccess) onAuthSuccess(user);
      }, 400);
    }, 300);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #1E1B2E 0%, #0F172A 50%, #1A0E13 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "rgba(255, 255, 255, 0.98)",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Hero / Brand Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #8B1E1E 0%, #B91C1C 60%, #991B1B 100%)",
            padding: "28px 24px 22px 24px",
            color: "#FFFFFF",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.2)",
            }}
          >
            <Pill size={28} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: "800", letterSpacing: "-0.02em", margin: 0 }}>
            Patch Perfect AI
          </h1>
          <p style={{ fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.85)", marginTop: "4px", margin: 0 }}>
            Clinical Wound Assessment & AI Segmentation Portal
          </p>
        </div>

        {/* Tab Toggle (Sign In vs Create Account) */}
        <div style={{ padding: "16px 20px 0 20px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#F1F5F9",
              padding: "4px",
              borderRadius: "12px",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => handleModeSwitch("login")}
              style={{
                padding: "9px 14px",
                border: "none",
                borderRadius: "9px",
                fontSize: "0.86rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: mode === "login" ? "#FFFFFF" : "transparent",
                color: mode === "login" ? "#8B1E1E" : "#64748B",
                boxShadow: mode === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("register")}
              style={{
                padding: "9px 14px",
                border: "none",
                borderRadius: "9px",
                fontSize: "0.86rem",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: mode === "register" ? "#FFFFFF" : "transparent",
                color: mode === "register" ? "#8B1E1E" : "#64748B",
                boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: "20px" }}>
          {/* Status Feedback Alerts */}
          {errorMessage && (
            <div
              style={{
                marginBottom: "14px",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECDD3",
                color: "#991B1B",
                fontSize: "0.82rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom: "14px",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: "0.82rem",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Username or Email
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "11px", color: "#94A3B8" }}>
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. dr.morales"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.9rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#8B1E1E")}
                    onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "11px", color: "#94A3B8" }}>
                    <Lock size={18} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 40px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.9rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#8B1E1E")}
                    onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "9px",
                      background: "none",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: "linear-gradient(135deg, #8B1E1E 0%, #991B1B 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "12px",
                  borderRadius: "12px",
                  fontSize: "0.95rem",
                  fontWeight: "700",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "4px",
                  boxShadow: "0 4px 12px rgba(139, 30, 30, 0.35)",
                  opacity: isLoading ? 0.75 : 1,
                  transition: "transform 0.15s ease",
                }}
              >
                <span>{isLoading ? "Signing In..." : "Sign In to Dashboard"}</span>
                <ArrowRight size={18} />
              </button>

              {/* Quick Demo Login Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "8px 0 2px 0",
                  gap: "10px",
                }}
              >
                <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }}></div>
                <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase" }}>
                  Or explore instantly
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }}></div>
              </div>

              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={isLoading}
                style={{
                  background: "#F8FAFC",
                  border: "1.5px solid #CBD5E1",
                  color: "#1E293B",
                  padding: "10px",
                  borderRadius: "12px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  transition: "all 0.15s ease",
                }}
              >
                <Sparkles size={16} color="#8B1E1E" />
                <span>Quick Demo Login (Clinician Access)</span>
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                  Full Name & Title
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "10px", color: "#94A3B8" }}>
                    <Stethoscope size={17} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Sarah Jenkins, MD"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 36px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.86rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="sjenkins"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.86rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                    Clinical Role
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 8px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.84rem",
                      color: "#0F172A",
                      backgroundColor: "#FFFFFF",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Physician">Physician / Doctor</option>
                    <option value="Wound Care Specialist">Wound Care Specialist</option>
                    <option value="Registered Nurse">Registered Nurse (RN)</option>
                    <option value="Clinical Researcher">Clinical Researcher</option>
                    <option value="Resident">Resident / Intern</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                  Clinical Email (Optional)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "10px", color: "#94A3B8" }}>
                    <Mail size={17} />
                  </span>
                  <input
                    type="email"
                    placeholder="s.jenkins@hospital.org"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 36px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.86rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.86rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.76rem", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "10px",
                      border: "1.5px solid #CBD5E1",
                      fontSize: "0.86rem",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: "linear-gradient(135deg, #8B1E1E 0%, #991B1B 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "12px",
                  borderRadius: "12px",
                  fontSize: "0.95rem",
                  fontWeight: "700",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "6px",
                  boxShadow: "0 4px 12px rgba(139, 30, 30, 0.35)",
                  opacity: isLoading ? 0.75 : 1,
                }}
              >
                <span>{isLoading ? "Creating Profile..." : "Register & Enter Dashboard"}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Clinical Security Notice */}
          <div
            style={{
              marginTop: "18px",
              paddingTop: "14px",
              borderTop: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              color: "#94A3B8",
              fontSize: "0.72rem",
            }}
          >
            <ShieldCheck size={15} color="#059669" />
            <span>Encrypted Token-Based Clinical Session Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
