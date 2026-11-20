/**
 * Live photo checks for the guided camera, run on a small RGBA copy of each video frame:
 * brightness, sharpness (variance of the Laplacian) and the colour card's reference block
 * (same patch colours and limits as the backend detector in ai_models/colour_card.py).
 */

// Same patch colours as the backend detector (OpenCV-style hue 0..179, sat/val 0..255)
export const PATCHES = [
  ["yellow", 20, 35],
  ["green", 40, 85],
  ["cyan", 86, 102],
  ["blue", 103, 130],
];
const PATCH_MIN_SAT = 110;
const PATCH_MIN_VAL = 60;

/** Live checks on one small RGBA frame. */
export const analyseFrame = (data, width, height) => {
  const n = width * height;
  const grey = new Float32Array(n);
  let sum = 0;
  let clipped = 0; // blown-out highlights (glare, flash)
  const counts = { yellow: 0, green: 0, cyan: 0, blue: 0 };
  const cx = { yellow: 0, green: 0, cyan: 0, blue: 0 };
  const cy = { yellow: 0, green: 0, cyan: 0, blue: 0 };

  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    grey[i] = y;
    sum += y;
    if (y >= 245) clipped += 1;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max === 0 ? 0 : ((max - min) / max) * 255;
    if (max < PATCH_MIN_VAL || s < PATCH_MIN_SAT) continue;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 30 + 180) % 180; // OpenCV scale
    for (const [name, lo, hi] of PATCHES) {
      if (h >= lo && h <= hi) {
        counts[name] += 1;
        cx[name] += i % width;
        cy[name] += Math.floor(i / width);
        break;
      }
    }
  }

  // Laplacian variance as a sharpness measure
  let lapSum = 0;
  let lapSq = 0;
  let m = 0;
  for (let yy = 1; yy < height - 1; yy++) {
    for (let xx = 1; xx < width - 1; xx++) {
      const i = yy * width + xx;
      const lap = grey[i - width] + grey[i + width] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      lapSum += lap;
      lapSq += lap * lap;
      m += 1;
    }
  }
  const lapMean = lapSum / Math.max(m, 1);
  const sharpness = lapSq / Math.max(m, 1) - lapMean * lapMean;

  // Card: all four reference patches present, of similar size, and next to each other
  const minPatch = Math.max(4, n * 0.0002);
  const present = PATCHES.every(([name]) => counts[name] >= minPatch);
  let cardFound = false;
  let blockRatio = null;
  if (present) {
    const sizes = PATCHES.map(([name]) => counts[name]);
    const biggest = Math.max(...sizes);
    const smallest = Math.min(...sizes);
    const side = Math.sqrt(counts.blue);
    const centre = (name) => [cx[name] / counts[name], cy[name] / counts[name]];
    const [bx, by] = centre("blue");
    const close = PATCHES.every(([name]) => {
      const [x, y] = centre(name);
      return Math.hypot(x - bx, y - by) <= 2.5 * side;
    });
    if (close && biggest / smallest < 3) {
      cardFound = true;
      blockRatio = sizes.reduce((a, b) => a + b, 0) / n;
    }
  }

  return { brightness: sum / n, clippedShare: clipped / n, sharpness, cardFound, blockRatio };
};
