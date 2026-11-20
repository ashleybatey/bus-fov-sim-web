/** Distinct per-camera hues that read well on the dark cabin background. */
export const CAMERA_PALETTE = [
  "#f0b429", // amber — Cam 1
  "#3ecfcf", // cyan — Cam 2
  "#c084fc", // violet — Cam 3
  "#fb7185", // coral — Cam 4
];

export function cameraColor(id) {
  const i = Math.max(0, (Number(id) || 1) - 1);
  return CAMERA_PALETTE[i % CAMERA_PALETTE.length];
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Lighten a hex color toward white (for selected markers). */
export function lighten(hex, amount = 0.45) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * FOV + marker styles for a camera.
 * Selected cones keep the same hue but use stronger fill/stroke.
 */
export function cameraFovStyles(id, selected = false) {
  const base = cameraColor(id);
  return {
    base,
    fill: rgba(base, selected ? 0.32 : 0.18),
    stroke: rgba(base, selected ? 0.9 : 0.55),
    fillFaint: rgba(base, 0.12),
    strokeFaint: rgba(base, 0.35),
    marker: selected ? lighten(base, 0.4) : base,
  };
}
