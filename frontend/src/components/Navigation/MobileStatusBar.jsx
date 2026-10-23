import React, { useState, useEffect } from "react";
import { Wifi, BatteryMedium, Signal } from "lucide-react";
import { getEffectiveDate } from "../../services/dateService";

export const MobileStatusBar = () => {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = getEffectiveDate();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const isAmPm = true;
      let ampm = "";
      if (isAmPm) {
        ampm = hours >= 12 ? "" : "";
        hours = hours % 12 || 12;
      }
      setTimeStr(`${hours}:${minutes}${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    window.addEventListener("patch_perfect_date_changed", updateTime);
    return () => {
      clearInterval(interval);
      window.removeEventListener("patch_perfect_date_changed", updateTime);
    };
  }, []);

  return (
    <div className="mobile-status-bar">
      <span>{timeStr || "9:41"}</span>
      <div className="status-bar-icons">
        <Signal size={12} strokeWidth={2.5} />
        <Wifi size={13} strokeWidth={2.5} />
        <BatteryMedium size={14} strokeWidth={2.5} />
      </div>
    </div>
  );
};
