import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, Layers, AlertTriangle, CheckCircle2, Compass } from "lucide-react";
import { analyseFrame } from "./frameChecks";

/**
 * GuidedCamera
 *
 * In-app camera for consistent follow-up photos:
 * - the previous photo of this wound as a faint overlay, to line up angle and distance;
 * - a target frame for the wound;
 * - live colour-card check and "move closer / back" against the previous photo's card size;
 * - a level indicator from the tilt sensor (matches the tilt of the last photo of this wound);
 * - quality checks (blur, too dark, too bright, card not visible) before the shot.
 * Frames come from the live video, so they are always upright (no EXIF rotation).
 *
 * Props:
 *   previousPhotoUrl   last photo of this wound (or null)
 *   previousCardRatio  share of that photo covered by the card's reference block (or null)
 *   woundId            used to remember the tilt of the last photo of this wound
 *   onCapture(dataUrl) called with a JPEG data URL
 *   onCancel()         close without a photo
 *   onFallback()       open the phone's own camera / gallery instead
 */

const ANALYSE_WIDTH = 240; // live checks run on a small copy of the frame
const ANALYSE_EVERY_MS = 350;

const BLUR_MIN = 35; // variance of the Laplacian on the small grey frame
const DARK_MAX = 70; // mean brightness
const BRIGHT_MIN = 215;
const CLIPPED_MAX = 0.12; // share of blown-out pixels
const DISTANCE_TOLERANCE = 1.15; // card linear size within ±15% of last time
const LEVEL_TOLERANCE_DEG = 7;

const tiltKey = (woundId) => `pp-tilt-${woundId}`;

const readSavedTilt = (woundId) => {
  if (!woundId) return null;
  try {
    const raw = localStorage.getItem(tiltKey(woundId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveTilt = (woundId, tilt) => {
  if (!woundId || !tilt) return;
  try {
    localStorage.setItem(tiltKey(woundId), JSON.stringify(tilt));
  } catch {
    // storage unavailable: the level guide falls back to "flat"
  }
};

export const GuidedCamera = ({ previousPhotoUrl, previousCardRatio, woundId, onCapture, onCancel, onFallback }) => {
  const videoRef = useRef(null);
  const smallCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const tiltRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | live | error
  const [errorText, setErrorText] = useState("");
  const [checks, setChecks] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(previousPhotoUrl ? 0.35 : 0);
  const [tilt, setTilt] = useState(null);
  const [tiltNeedsPermission, setTiltNeedsPermission] = useState(false);
  const [confirmIssues, setConfirmIssues] = useState(null);
  const savedTilt = useRef(readSavedTilt(woundId)).current;
  const viewportRef = useRef(null);
  // where the video is drawn inside the viewport (letterboxed to its own shape);
  // the overlay and the target frame are placed in this same box so they line up
  const [fit, setFit] = useState(null);

  const updateFit = useCallback(() => {
    const video = videoRef.current;
    const box = viewportRef.current;
    if (!video?.videoWidth || !box) return;
    const cw = box.clientWidth;
    const ch = box.clientHeight;
    const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    setFit({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
  }, []);

  useEffect(() => {
    if (status !== "live") return undefined;
    updateFit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFit) : null;
    ro?.observe(viewportRef.current);
    window.addEventListener("resize", updateFit);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateFit);
    };
  }, [status, updateFit]);

  // --- camera
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorText(
          window.isSecureContext
            ? "This device does not support the in-app camera."
            : "The in-app camera needs a secure (https) connection."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          // 4:3 like phone photos, so the overlay and the card size line up with last time
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("live");
      } catch (err) {
        setStatus("error");
        setErrorText(
          err?.name === "NotAllowedError"
            ? "Camera access was refused. Allow camera access for this app, or use the phone camera instead."
            : "The camera could not be started. Use the phone camera instead."
        );
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // --- live checks
  useEffect(() => {
    if (status !== "live") return undefined;
    const id = setInterval(() => {
      const video = videoRef.current;
      const canvas = smallCanvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      const w = ANALYSE_WIDTH;
      const h = Math.round((video.videoHeight / video.videoWidth) * w);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      setChecks(analyseFrame(ctx.getImageData(0, 0, w, h).data, w, h));
    }, ANALYSE_EVERY_MS);
    return () => clearInterval(id);
  }, [status]);

  // --- tilt sensor
  const onOrientation = useCallback((e) => {
    if (e.beta == null || e.gamma == null) return;
    const t = { beta: e.beta, gamma: e.gamma };
    tiltRef.current = t;
    setTilt(t);
  }, []);

  useEffect(() => {
    if (typeof window.DeviceOrientationEvent === "undefined") return undefined;
    if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
      setTiltNeedsPermission(true); // iPhone: must be asked from a tap
      return undefined;
    }
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [onOrientation]);

  useEffect(() => () => window.removeEventListener("deviceorientation", onOrientation), [onOrientation]);

  const enableTilt = async () => {
    try {
      const res = await window.DeviceOrientationEvent.requestPermission();
      if (res === "granted") {
        window.addEventListener("deviceorientation", onOrientation);
        setTiltNeedsPermission(false);
      }
    } catch {
      setTiltNeedsPermission(false);
    }
  };

  // --- guidance derived from the checks
  const targetTilt = savedTilt || { beta: 0, gamma: 0 };
  const tiltOff = tilt
    ? { beta: tilt.beta - targetTilt.beta, gamma: tilt.gamma - targetTilt.gamma }
    : null;
  const levelOk = tiltOff ? Math.abs(tiltOff.beta) <= LEVEL_TOLERANCE_DEG && Math.abs(tiltOff.gamma) <= LEVEL_TOLERANCE_DEG : null;

  let distance = null; // { ok, text }
  if (checks?.cardFound && previousCardRatio) {
    const linear = Math.sqrt(checks.blockRatio / previousCardRatio);
    if (linear > DISTANCE_TOLERANCE) distance = { ok: false, text: "Move back" };
    else if (linear < 1 / DISTANCE_TOLERANCE) distance = { ok: false, text: "Move closer" };
    else distance = { ok: true, text: "Distance matches last photo" };
  }

  const issues = [];
  if (checks) {
    if (checks.brightness < DARK_MAX) issues.push("Too dark: add light");
    else if (checks.brightness > BRIGHT_MIN || checks.clippedShare > CLIPPED_MAX) issues.push("Too bright: avoid direct flash or sun");
    if (checks.sharpness < BLUR_MIN) issues.push("Blurry: hold still and tap to focus");
    if (!checks.cardFound) issues.push("Colour card not visible");
    if (distance && !distance.ok) issues.push(distance.text);
  }
  if (levelOk === false) issues.push(savedTilt ? "Tilt the phone to match the last photo" : "Hold the phone level with the wound");

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (tiltRef.current) saveTilt(woundId, tiltRef.current);
    onCapture(dataUrl);
  };

  const onShutter = () => {
    if (issues.length > 0) setConfirmIssues(issues);
    else capture();
  };

  const pill = (ok, text, key) => (
    <span
      key={key || text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 8px",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: ok ? "rgba(22,101,52,0.85)" : "rgba(133,77,14,0.9)",
        color: "#FFFFFF",
      }}
    >
      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {text}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-label="Guided wound camera"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}
    >
      <div ref={viewportRef} style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div
          style={
            fit
              ? { position: "absolute", left: fit.left, top: fit.top, width: fit.width, height: fit.height }
              : { position: "absolute", inset: 0 }
          }
        >
        <video
          ref={videoRef}
          playsInline
          muted
          onLoadedMetadata={updateFit}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
        />
        {previousPhotoUrl && overlayOpacity > 0 && status === "live" && (
          <img
            src={previousPhotoUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: overlayOpacity,
              pointerEvents: "none",
            }}
          />
        )}

        {/* target frame for the wound */}
        {status === "live" && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "15%",
              right: "15%",
              top: "18%",
              bottom: "18%",
              border: "2px dashed rgba(255,255,255,0.85)",
              borderRadius: "16px",
              boxShadow: "0 0 0 2000px rgba(0,0,0,0.12)",
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "-24px",
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#FFF",
                fontSize: "0.72rem",
                fontWeight: 700,
                textShadow: "0 1px 3px #000",
              }}
            >
              Wound here · colour card beside it
            </span>
          </div>
        )}
        </div>

        {/* level bubble */}
        {status === "live" && tiltOff && (
          <div
            aria-label={levelOk ? "Level" : "Not level"}
            style={{
              position: "absolute",
              right: "12px",
              bottom: "12px",
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: `2px solid ${levelOk ? "#4ADE80" : "#FBBF24"}`,
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: levelOk ? "#4ADE80" : "#FBBF24",
                left: `${25 + Math.max(-25, Math.min(25, tiltOff.gamma))}px`,
                top: `${25 + Math.max(-25, Math.min(25, tiltOff.beta))}px`,
              }}
            />
          </div>
        )}

        {/* status pills */}
        {status === "live" && checks && (
          <div style={{ position: "absolute", top: "10px", left: "10px", right: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {pill(checks.cardFound, checks.cardFound ? "Card found" : "Card not visible", "card")}
            {distance && pill(distance.ok, distance.text, "dist")}
            {checks.brightness < DARK_MAX && pill(false, "Too dark", "dark")}
            {(checks.brightness > BRIGHT_MIN || checks.clippedShare > CLIPPED_MAX) && pill(false, "Too bright", "bright")}
            {pill(checks.sharpness >= BLUR_MIN, checks.sharpness >= BLUR_MIN ? "Sharp" : "Blurry", "blur")}
            {levelOk != null && pill(levelOk, levelOk ? "Level" : savedTilt ? "Match last tilt" : "Not level", "level")}
          </div>
        )}

        {status === "starting" && (
          <p style={{ position: "absolute", top: "45%", width: "100%", textAlign: "center", color: "#FFF" }}>Starting camera…</p>
        )}
        {status === "error" && (
          <div style={{ position: "absolute", top: "35%", left: "24px", right: "24px", textAlign: "center", color: "#FFF" }}>
            <p style={{ marginBottom: "14px", lineHeight: 1.45 }}>{errorText}</p>
            <button type="button" className="btn-primary" onClick={onFallback} style={{ padding: "12px 16px" }}>
              <Camera size={18} /> <span>Use phone camera</span>
            </button>
          </div>
        )}

        {confirmIssues && (
          <div
            role="alertdialog"
            style={{
              position: "absolute",
              left: "16px",
              right: "16px",
              bottom: "16px",
              background: "#FFFFFF",
              borderRadius: "14px",
              padding: "14px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >
            <strong style={{ display: "block", color: "#1E293B", marginBottom: "6px" }}>This photo may not measure well</strong>
            <ul style={{ margin: "0 0 12px 18px", color: "#475569", fontSize: "0.82rem", lineHeight: 1.5 }}>
              {confirmIssues.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button type="button" className="btn-secondary" onClick={() => setConfirmIssues(null)}>
                Fix and retry
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmIssues(null);
                  capture();
                }}
              >
                Take anyway
              </button>
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div style={{ padding: "12px 16px 18px", background: "#0F172A", display: "flex", flexDirection: "column", gap: "10px" }}>
        {previousPhotoUrl && status === "live" && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#CBD5E1", fontSize: "0.74rem" }}>
            <Layers size={14} /> Last photo
            <input
              type="range"
              min="0"
              max="0.7"
              step="0.05"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              style={{ flex: 1 }}
              aria-label="Previous photo overlay strength"
            />
          </label>
        )}
        {tiltNeedsPermission && (
          <button type="button" onClick={enableTilt} style={{ color: "#CBD5E1", fontSize: "0.74rem", background: "none", border: "none", display: "flex", gap: "6px", alignItems: "center" }}>
            <Compass size={14} /> Enable level guide
          </button>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
          <button type="button" onClick={onCancel} aria-label="Close camera" style={{ justifySelf: "start", background: "none", border: "none", color: "#FFF" }}>
            <X size={26} />
          </button>
          <button
            type="button"
            onClick={onShutter}
            disabled={status !== "live"}
            aria-label="Take photo"
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "50%",
              border: `4px solid ${issues.length ? "#FBBF24" : "#4ADE80"}`,
              background: "#FFFFFF",
              opacity: status === "live" ? 1 : 0.4,
            }}
          />
          <button
            type="button"
            onClick={onFallback}
            style={{ justifySelf: "end", background: "none", border: "none", color: "#CBD5E1", fontSize: "0.72rem" }}
          >
            Phone camera / gallery
          </button>
        </div>
      </div>
      <canvas ref={smallCanvasRef} style={{ display: "none" }} />
    </div>
  );
};
