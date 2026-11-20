import React, { useState, useRef, useEffect, useCallback } from "react";
import { Crop, RefreshCw, Sparkles, AlertCircle } from "lucide-react";

/**
 * WoundCropAdjuster
 *
 * Interactive, touch-friendly bounding box editor for wound photos.
 * Pre-filled from FUSegNet segmentation, allowing clinicians to drag corners
 * or edges to exclude hair, background, clothing, and colour cards.
 *
 * Coordinates are normalized [x1, y1, x2, y2] in 0.0 .. 1.0 range.
 */
export const WoundCropAdjuster = ({
  imageSrc,
  cropBox,
  onChange,
  isDetecting = false,
  woundDetected = true,
  onResetAuto,
}) => {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLayout, setImgLayout] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const [activeDrag, setActiveDrag] = useState(null); // { type: 'tl'|'tr'|'bl'|'br'|'t'|'b'|'l'|'r'|'move', startBox, startX, startY }

  // Safe fallback box: [0.15, 0.15, 0.85, 0.85]
  const box = cropBox && cropBox.length === 4 ? cropBox : [0.15, 0.15, 0.85, 0.85];
  const [x1, y1, x2, y2] = box;

  // Measure rendered image within the container
  const updateLayout = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;
    const imgRect = imgRef.current.getBoundingClientRect();
    const contRect = containerRef.current.getBoundingClientRect();
    if (imgRect.width > 0 && imgRect.height > 0) {
      setImgLayout({
        left: imgRect.left - contRect.left,
        top: imgRect.top - contRect.top,
        width: imgRect.width,
        height: imgRect.height,
        ready: true,
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [updateLayout]);

  const handlePointerDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture is optional
    }
    setActiveDrag({
      type,
      startBox: [...box],
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const handlePointerMove = (e) => {
    if (!activeDrag || !imgLayout.ready || imgLayout.width <= 0 || imgLayout.height <= 0) return;
    const dx = (e.clientX - activeDrag.startX) / imgLayout.width;
    const dy = (e.clientY - activeDrag.startY) / imgLayout.height;
    const [origX1, origY1, origX2, origY2] = activeDrag.startBox;

    let nx1 = origX1;
    let ny1 = origY1;
    let nx2 = origX2;
    let ny2 = origY2;
    const minSize = 0.05;

    if (activeDrag.type === "move") {
      const w = origX2 - origX1;
      const h = origY2 - origY1;
      nx1 = Math.max(0, Math.min(1 - w, origX1 + dx));
      ny1 = Math.max(0, Math.min(1 - h, origY1 + dy));
      nx2 = nx1 + w;
      ny2 = ny1 + h;
    } else {
      if (activeDrag.type.includes("l")) {
        nx1 = Math.max(0, Math.min(origX2 - minSize, origX1 + dx));
      }
      if (activeDrag.type.includes("r")) {
        nx2 = Math.min(1, Math.max(origX1 + minSize, origX2 + dx));
      }
      if (activeDrag.type.includes("t")) {
        ny1 = Math.max(0, Math.min(origY2 - minSize, origY1 + dy));
      }
      if (activeDrag.type.includes("b")) {
        ny2 = Math.min(1, Math.max(origY1 + minSize, origY2 + dy));
      }
    }

    onChange([
      Math.round(nx1 * 1000) / 1000,
      Math.round(ny1 * 1000) / 1000,
      Math.round(nx2 * 1000) / 1000,
      Math.round(ny2 * 1000) / 1000,
    ]);
  };

  const handlePointerUp = (e) => {
    if (activeDrag) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
      // pointer capture is optional
    }
      setActiveDrag(null);
    }
  };

  // Convert normalized box to pixel coordinates relative to the layout
  const boxLeft = imgLayout.left + x1 * imgLayout.width;
  const boxTop = imgLayout.top + y1 * imgLayout.height;
  const boxWidth = Math.max(20, (x2 - x1) * imgLayout.width);
  const boxHeight = Math.max(20, (y2 - y1) * imgLayout.height);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Informative Header / Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Crop size={15} color="#8B1E1E" />
          <span style={{ fontSize: "0.76rem", fontWeight: "800", color: "#1E293B", textTransform: "uppercase" }}>
            Crop to wound
          </span>
          {isDetecting ? (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#8B1E1E",
                background: "#FEE2E2",
                padding: "2px 7px",
                borderRadius: "6px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <RefreshCw size={10} className="spinning" /> AI finding outline...
            </span>
          ) : woundDetected ? (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#166534",
                background: "#DCFCE7",
                padding: "2px 7px",
                borderRadius: "6px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={11} /> AI Box Suggested
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#854D0E",
                background: "#FEF9C3",
                padding: "2px 7px",
                borderRadius: "6px",
                fontWeight: "600",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <AlertCircle size={11} /> Manual Box
            </span>
          )}
        </div>

        {onResetAuto && (
          <button
            type="button"
            onClick={onResetAuto}
            disabled={isDetecting}
            style={{
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "0.7rem",
              fontWeight: "600",
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={11} /> Reset Box
          </button>
        )}
      </div>

      <p style={{ fontSize: "0.72rem", color: "#64748B", margin: 0, lineHeight: 1.4 }}>
        Drag the corners to frame the wound. Everything outside this box (hair, forehead, blanket, colour card) will be excluded from analysis.
      </p>

      {/* Interactive Crop Frame */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "340px",
          background: "#0F172A",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          userSelect: "none",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Wound for cropping"
          onLoad={updateLayout}
          style={{
            maxWidth: "100%",
            maxHeight: "340px",
            objectFit: "contain",
            display: "block",
            pointerEvents: "none",
          }}
        />

        {imgLayout.ready && (
          <>
            {/* Dark Shroud (Outside Box) */}
            <div
              style={{
                position: "absolute",
                left: imgLayout.left,
                top: imgLayout.top,
                width: imgLayout.width,
                height: y1 * imgLayout.height,
                background: "rgba(0, 0, 0, 0.55)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: imgLayout.left,
                top: imgLayout.top + y2 * imgLayout.height,
                width: imgLayout.width,
                height: (1 - y2) * imgLayout.height,
                background: "rgba(0, 0, 0, 0.55)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: imgLayout.left,
                top: imgLayout.top + y1 * imgLayout.height,
                width: x1 * imgLayout.width,
                height: (y2 - y1) * imgLayout.height,
                background: "rgba(0, 0, 0, 0.55)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: imgLayout.left + x2 * imgLayout.width,
                top: imgLayout.top + y1 * imgLayout.height,
                width: (1 - x2) * imgLayout.width,
                height: (y2 - y1) * imgLayout.height,
                background: "rgba(0, 0, 0, 0.55)",
                pointerEvents: "none",
              }}
            />

            {/* Bounding Box Border */}
            <div
              onPointerDown={(e) => handlePointerDown(e, "move")}
              style={{
                position: "absolute",
                left: `${boxLeft}px`,
                top: `${boxTop}px`,
                width: `${boxWidth}px`,
                height: `${boxHeight}px`,
                border: "2px solid #8B1E1E",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.7), inset 0 0 0 1px rgba(255,255,255,0.4)",
                cursor: "move",
                boxSizing: "border-box",
              }}
            >
              {/* Center Crosshair / Label */}
              <div
                style={{
                  position: "absolute",
                  top: "4px",
                  left: "6px",
                  background: "rgba(139, 30, 30, 0.85)",
                  color: "#FFFFFF",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  fontSize: "0.64rem",
                  fontWeight: "700",
                  pointerEvents: "none",
                  letterSpacing: "0.02em",
                }}
              >
                Wound Area
              </div>

              {/* 4 Corner Handles with generous touch pads */}
              {[
                { type: "tl", top: "-12px", left: "-12px", cursor: "nwse-resize" },
                { type: "tr", top: "-12px", right: "-12px", cursor: "nesw-resize" },
                { type: "bl", bottom: "-12px", left: "-12px", cursor: "nesw-resize" },
                { type: "br", bottom: "-12px", right: "-12px", cursor: "nwse-resize" },
              ].map((h) => (
                <div
                  key={h.type}
                  onPointerDown={(e) => handlePointerDown(e, h.type)}
                  style={{
                    position: "absolute",
                    top: h.top,
                    bottom: h.bottom,
                    left: h.left,
                    right: h.right,
                    width: "28px",
                    height: "28px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: h.cursor,
                    touchAction: "none",
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      backgroundColor: "#FFFFFF",
                      border: "3px solid #8B1E1E",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
              ))}

              {/* Edge Handles */}
              {[
                { type: "t", top: "-8px", left: "50%", transform: "translateX(-50%)", width: "24px", height: "16px", cursor: "ns-resize" },
                { type: "b", bottom: "-8px", left: "50%", transform: "translateX(-50%)", width: "24px", height: "16px", cursor: "ns-resize" },
                { type: "l", left: "-8px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "24px", cursor: "ew-resize" },
                { type: "r", right: "-8px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "24px", cursor: "ew-resize" },
              ].map((edge) => (
                <div
                  key={edge.type}
                  onPointerDown={(e) => handlePointerDown(e, edge.type)}
                  style={{
                    position: "absolute",
                    top: edge.top,
                    bottom: edge.bottom,
                    left: edge.left,
                    right: edge.right,
                    transform: edge.transform,
                    width: edge.width,
                    height: edge.height,
                    cursor: edge.cursor,
                    touchAction: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9,
                  }}
                >
                  <div
                    style={{
                      width: edge.type === "t" || edge.type === "b" ? "14px" : "4px",
                      height: edge.type === "l" || edge.type === "r" ? "14px" : "4px",
                      backgroundColor: "#8B1E1E",
                      borderRadius: "2px",
                      border: "1px solid #FFFFFF",
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
