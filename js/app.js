import { BUS_TYPES, buildSeats, defaultCameras } from "./busTypes.js";
import { coverageStats, clampAlong } from "./fov.js";
import {
  renderTopDown,
  hitCamera,
  screenToWorld,
  snapToWall,
} from "./renderTopDown.js";
import { init3DView, update3DView, resize3DView } from "./render3DView.js";

const state = {
  busType: "A",
  cameraCount: 3,
  cameras: [],
  seats: [],
  selectedId: 1,
  dragging: null,
};

const els = {
  busHint: document.getElementById("busHint"),
  cameraSelect: document.getElementById("cameraSelect"),
  hfov: document.getElementById("hfov"),
  vfov: document.getElementById("vfov"),
  mountHeight: document.getElementById("mountHeight"),
  yaw: document.getElementById("yaw"),
  pitch: document.getElementById("pitch"),
  applyToAll: document.getElementById("applyToAll"),
  hfovOut: document.getElementById("hfovOut"),
  vfovOut: document.getElementById("vfovOut"),
  heightOut: document.getElementById("heightOut"),
  yawOut: document.getElementById("yawOut"),
  pitchOut: document.getElementById("pitchOut"),
  coverageValue: document.getElementById("coverageValue"),
  topDown: document.getElementById("topDown"),
  sideView: document.getElementById("sideView"),
};

function bus() {
  return BUS_TYPES[state.busType];
}

function selectedCam() {
  return state.cameras.find((c) => c.id === state.selectedId);
}

function syncBus() {
  const b = bus();
  const radio = document.querySelector(
    `input[name="busType"][value="${state.busType}"]`
  );
  if (radio instanceof HTMLInputElement) radio.checked = true;
  state.seats = buildSeats(b);
  state.cameras = defaultCameras(b, state.cameraCount);
  state.selectedId = state.cameras[0]?.id ?? 1;
  els.busHint.textContent = b.description;
  rebuildCameraSelect();
  syncControlsFromCam();
  render();
}

function rebuildCameraSelect() {
  els.cameraSelect.innerHTML = "";
  for (const c of state.cameras) {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = `Camera ${c.id} (${c.wall} wall)`;
    if (c.id === state.selectedId) opt.selected = true;
    els.cameraSelect.appendChild(opt);
  }
}

function syncControlsFromCam() {
  const c = selectedCam();
  if (!c) return;
  els.hfov.value = c.hfov;
  els.vfov.value = c.vfov;
  els.mountHeight.value = c.height;
  els.yaw.value = c.yaw;
  els.pitch.value = c.pitch;
  els.hfovOut.textContent = `${c.hfov}°`;
  els.vfovOut.textContent = `${c.vfov}°`;
  els.heightOut.textContent = `${Number(c.height).toFixed(1)} ft`;
  els.yawOut.textContent = `${c.yaw}°`;
  els.pitchOut.textContent = `${c.pitch}°`;
  els.cameraSelect.value = String(c.id);
}

function applyControlToCam() {
  const values = {
    hfov: Number(els.hfov.value),
    vfov: Number(els.vfov.value),
    height: Number(els.mountHeight.value),
    yaw: Number(els.yaw.value),
    pitch: Number(els.pitch.value),
  };
  const targets = els.applyToAll?.checked
    ? state.cameras
    : [selectedCam()].filter(Boolean);
  if (!targets.length) return;

  for (const c of targets) {
    c.hfov = values.hfov;
    c.vfov = values.vfov;
    c.height = values.height;
    c.yaw = values.yaw;
    c.pitch = values.pitch;
  }

  els.hfovOut.textContent = `${values.hfov}°`;
  els.vfovOut.textContent = `${values.vfov}°`;
  els.heightOut.textContent = `${values.height.toFixed(1)} ft`;
  els.yawOut.textContent = `${values.yaw}°`;
  els.pitchOut.textContent = `${values.pitch}°`;
  render();
}

function render() {
  const b = bus();
  const stats = coverageStats(state.seats, state.cameras, b);
  els.coverageValue.textContent = `${stats.pct}% (${stats.covered}/${stats.total})`;
  els.coverageValue.style.color =
    stats.pct >= 95 ? "#3dba7a" : stats.pct >= 70 ? "#f0b429" : "#e85d5d";

  renderTopDown(els.topDown, {
    bus: b,
    seats: state.seats,
    cameras: state.cameras,
    selectedId: state.selectedId,
    coverageFlags: stats.flags,
  });

  update3DView({
    bus: b,
    seats: state.seats,
    cameras: state.cameras,
    selectedId: state.selectedId,
    coverageFlags: stats.flags,
  });

  // Refresh select labels (wall may change while dragging)
  const prev = els.cameraSelect.value;
  rebuildCameraSelect();
  if ([...els.cameraSelect.options].some((o) => o.value === prev)) {
    els.cameraSelect.value = prev;
  }
}

function setCameraCount(n) {
  state.cameraCount = n;
  document.querySelectorAll(".seg").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.count) === n);
  });
  const b = bus();
  // Preserve FOV settings when possible by remapping positions
  const old = state.cameras;
  state.cameras = defaultCameras(b, n).map((cam, i) => {
    const prev = old[i];
    if (!prev) return cam;
    return {
      ...cam,
      hfov: prev.hfov,
      vfov: prev.vfov,
      height: prev.height,
      yaw: prev.yaw,
      pitch: prev.pitch,
    };
  });
  if (!state.cameras.some((c) => c.id === state.selectedId)) {
    state.selectedId = state.cameras[0].id;
  }
  rebuildCameraSelect();
  syncControlsFromCam();
  render();
}

// --- Event wiring ---

function selectBusType(type) {
  if (!BUS_TYPES[type] || state.busType === type) return;
  state.busType = type;
  syncBus();
}

document.getElementById("busTypeGrid").addEventListener("change", (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "busType") return;
  selectBusType(input.value);
});

document.getElementById("busTypeGrid").addEventListener("click", (e) => {
  const label = e.target.closest("label.bus-type");
  if (!label) return;
  const input = label.querySelector('input[name="busType"]');
  if (!(input instanceof HTMLInputElement)) return;
  input.checked = true;
  selectBusType(input.value);
});

document.querySelectorAll(".seg").forEach((btn) => {
  btn.addEventListener("click", () => setCameraCount(Number(btn.dataset.count)));
});

els.cameraSelect.addEventListener("change", () => {
  state.selectedId = Number(els.cameraSelect.value);
  syncControlsFromCam();
  render();
});

for (const id of ["hfov", "vfov", "mountHeight", "yaw", "pitch"]) {
  els[id].addEventListener("input", applyControlToCam);
}

els.topDown.addEventListener("pointerdown", (e) => {
  const b = bus();
  const hit = hitCamera(els.topDown, b, state.cameras, e.clientX, e.clientY);
  if (hit) {
    state.selectedId = hit.id;
    state.dragging = hit.id;
    els.topDown.setPointerCapture(e.pointerId);
    syncControlsFromCam();
    render();
  }
});

els.topDown.addEventListener("pointermove", (e) => {
  if (state.dragging == null) return;
  const b = bus();
  const { x, y } = screenToWorld(els.topDown, b, e.clientX, e.clientY);
  const cam = state.cameras.find((c) => c.id === state.dragging);
  if (!cam) return;
  const snap = snapToWall(b, x, y);
  cam.wall = snap.wall;
  cam.along = snap.along;
  cam.along = clampAlong(cam, b);
  rebuildCameraSelect();
  render();
});

els.topDown.addEventListener("pointerup", () => {
  state.dragging = null;
});

els.topDown.addEventListener("pointercancel", () => {
  state.dragging = null;
});

function fitCanvas(canvas, baseW, baseH) {
  const parent = canvas.parentElement;
  // Prefer real layout width; fall back so first paint isn't 0×0
  const parentW = parent?.clientWidth || window.innerWidth || 800;
  const w = Math.max(640, parentW - 8);
  const scale = w / baseW;
  const nextW = Math.round(baseW * Math.min(scale, 1.4));
  const nextH = Math.round(baseH * Math.min(scale, 1.4));
  if (canvas.width === nextW && canvas.height === nextH) return false;
  canvas.width = nextW;
  canvas.height = nextH;
  return true;
}

function fitAndRender() {
  fitCanvas(els.topDown, 1100, 420);
  // 3D canvas: CSS-sized; resize via WebGL renderer (don't reset canvas attrs)
  resize3DView();
  render();
}

window.addEventListener("resize", fitAndRender);

init3DView(els.sideView);
fitCanvas(els.topDown, 1100, 420);
resize3DView();
syncBus();

// Re-fit when the workspace panel gets a real size (avoids blank first paint)
if (typeof ResizeObserver !== "undefined") {
  const ro = new ResizeObserver(() => fitAndRender());
  if (els.topDown.parentElement) ro.observe(els.topDown.parentElement);
  if (els.sideView.parentElement) ro.observe(els.sideView.parentElement);
}
