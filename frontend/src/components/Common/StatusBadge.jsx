import React from "react";

export const StatusBadge = ({ label, type = "info" }) => {
  const getStyleClass = () => {
    switch (type) {
      case "danger":
        return "status-pill danger";
      case "success":
        return "status-pill success";
      case "warning":
        return "status-pill warning";
      default:
        return "status-pill info";
    }
  };

  return <span className={getStyleClass()}>{label}</span>;
};
