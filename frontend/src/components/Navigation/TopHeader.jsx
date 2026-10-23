import React from "react";
import { Pill, ArrowLeft, Settings } from "lucide-react";

export const TopHeader = ({
  title = "Patch Perfect",
  isSubscreen = false,
  onBack,
  onCancel,
  showBrand = true,
  onOpenSettings = null,
  currentUser = null,
}) => {
  if (isSubscreen) {
    return (
      <header className="top-app-bar" style={{ display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                padding: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#FFFFFF", letterSpacing: "-0.01em", margin: 0 }}>
            {title}
          </h2>
        </div>
      </header>
    );
  }

  // Format short name and initials
  const rawName = currentUser?.full_name || currentUser?.username || "Clinician";
  
  // Extract initials (e.g. "Elena Morales" -> "EM", "Dr. Elena Morales" -> "EM")
  const cleanParts = rawName
    .replace(/^Dr\.?\s+/i, "")
    .replace(/,\s*(MD|RN|BSN|DO|PhD|MBBS).*$/i, "")
    .trim()
    .split(/\s+/);
  
  const initials =
    cleanParts.length >= 2
      ? `${cleanParts[0][0]}${cleanParts[cleanParts.length - 1][0]}`.toUpperCase()
      : rawName.slice(0, 2).toUpperCase();

  // Short display title
  const displayTitle = rawName.length > 18 ? (cleanParts.length >= 2 ? `Dr. ${cleanParts[cleanParts.length - 1]}` : rawName.slice(0, 16) + '…') : rawName;

  return (
    <header className="top-app-bar" style={{ padding: "12px 16px", minHeight: "64px" }}>
      {/* Brand Identity on Left */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            background: "rgba(255, 255, 255, 0.18)",
            backdropFilter: "blur(10px)",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
          }}
        >
          <Pill size={20} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: "1.02rem", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
            Patch Perfect
          </span>
          <span style={{ fontSize: "0.62rem", fontWeight: "600", color: "rgba(255, 255, 255, 0.75)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Clinical AI
          </span>
        </div>
      </div>

      {/* Unified Clinician Profile & Settings Button on Right */}
      {currentUser ? (
        <button
          onClick={onOpenSettings}
          title={`Signed in as ${rawName} - Click for Settings & Account`}
          style={{
            background: "rgba(255, 255, 255, 0.16)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "#FFFFFF",
            padding: "4px 8px 4px 4px",
            borderRadius: "22px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(8px)",
            transition: "all 0.15s ease",
            maxWidth: "185px",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {/* Avatar with status dot */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#FFFFFF",
                color: "#8B1E1E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
                fontWeight: "800",
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            >
              {initials}
            </div>
            <span
              style={{
                position: "absolute",
                bottom: "-1px",
                right: "-1px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10B981",
                border: "1.5px solid #8B1E1E",
              }}
            />
          </div>

          {/* Clinician Name & Settings icon */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, textAlign: "left" }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: "700",
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100px",
                lineHeight: 1.1,
              }}
            >
              {displayTitle}
            </span>
            <span style={{ fontSize: "0.6rem", color: "rgba(255, 255, 255, 0.75)", fontWeight: "500", lineHeight: 1 }}>
              {currentUser.role || "Clinician"}
            </span>
          </div>

          <div
            style={{
              padding: "3px",
              color: "rgba(255, 255, 255, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "2px",
            }}
          >
            <Settings size={14} />
          </div>
        </button>
      ) : (
        onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Open Settings"
            style={{
              background: "rgba(255, 255, 255, 0.18)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#FFFFFF",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={18} />
          </button>
        )
      )}
    </header>
  );
};
