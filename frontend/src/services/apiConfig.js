import { Capacitor } from "@capacitor/core";

const isNative = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

const envUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/**
 * Where the Django API lives.
 *
 * In the browser during development we always use the Vite proxy ("/api" -> Django on
 * this machine). That keeps requests same-origin, so they work over the dev HTTPS
 * server and from a phone on the LAN (an https page cannot call an http:// API).
 * Native (Capacitor) builds and production builds use VITE_API_URL.
 */
export const API_BASE = import.meta.env.DEV && !isNative ? "/api" : envUrl || "/api";

// Origin to prefix server-relative media paths (e.g. "/media/wound_images/x.jpg") with.
const MEDIA_ORIGIN = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : "";

export const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (/^(data:|blob:|https?:\/\/)/.test(path)) return path;
  return `${MEDIA_ORIGIN}${path}`;
};

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const OFFLINE_MESSAGE =
  "Can't reach the Patch Perfect server. Check that the backend is running and that this device is on the same network.";

// Turn a DRF error body into one readable sentence
export const errorMessageFrom = (data, status) => {
  // 502/503/504 come from the dev proxy or a gateway when Django itself is not running
  if (status === 502 || status === 503 || status === 504) return OFFLINE_MESSAGE;
  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }
  if (status >= 500) return "The server hit an error. Please try again.";
  return `Request failed (${status}).`;
};
