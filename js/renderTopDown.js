import { cameraFacing, cameraWorldPos, deg } from "./fov.js";
import { cameraFovStyles } from "./cameraColors.js";

const COLORS = {
  busFill: "#1a222c",
  busStroke: "#c9a227",
  aisle: "#141a22",
  seat: "#3a4656",
  covered: "#3dba7a",
  uncovered: "#e85d5d",
  door: "#5b9fd4",
  driver: "#2a3340",
  grid: "rgba(255,255,255,0.04)",
  label: "#8b9aab",
};

function layout(canvas, bus) {
  const pad = { l: 56, r: 28, t: 36, b: 40 };
  const availW = canvas.width - pad.l - pad.r;
  const availH = canvas.height - pad.t - pad.b;
  const scale = Math.min(availW / bus.length, availH / bus.width);
  const drawW = bus.length * scale;
  const drawH = bus.width * scale;
  const ox = pad.l + (availW - drawW) / 2;
  const oy = pad.t + (availH - drawH) / 2;
  return { pad, scale, ox, oy, drawW, drawH };
}

function toScreen(layout, x, y) {
  return {
    sx: layout.ox + x * layout.scale,
    sy: layout.oy + y * layout.scale,
  };
}

export function screenToWorld(canvas, bus, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (clientX - rect.left) * scaleX;
  const cy = (clientY - rect.top) * scaleY;
  const L = layout(canvas, bus);
  return {
    x: (cx - L.ox) / L.scale,
    y: (cy - L.oy) / L.scale,
    layout: L,
  };
}

function drawFovCone(ctx, cam, bus, L, selected) {
  const pos = cameraWorldPos(cam, bus);
  const { sx, sy } = toScreen(L, pos.x, pos.y);
  const facing = cameraFacing(cam, bus);
  const half = deg(cam.hfov) / 2;
  // Range: far enough to cover cabin
  const range = Math.hypot(bus.length, bus.width) * L.scale * 1.05;
  const style = cameraFovStyles(cam.id, selected);

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.arc(sx, sy, range, facing - half, facing + half);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = selected ? 2.5 : 1;
  ctx.stroke();
}

export function renderTopDown(canvas, { bus, seats, cameras, selectedId, coverageFlags }) {
  const ctx = canvas.getContext("2d");
  const L = layout(canvas, bus);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Title labels
  ctx.fillStyle = COLORS.label;
  ctx.font = "12px 'IBM Plex Mono', monospace";
  ctx.fillText("FRONT", L.ox, L.oy - 12);
  ctx.fillText("REAR", L.ox + L.drawW - 36, L.oy - 12);
  ctx.save();
  ctx.translate(L.ox - 18, L.oy + L.drawH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("LEFT WALL", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(L.ox + L.drawW + 18, L.oy + L.drawH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("RIGHT WALL", 0, 0);
  ctx.restore();

  // Bus body
  ctx.fillStyle = COLORS.busFill;
  ctx.strokeStyle = COLORS.busStroke;
  ctx.lineWidth = 2.5;
  roundRect(ctx, L.ox, L.oy, L.drawW, L.drawH, 8);
  ctx.fill();
  ctx.stroke();

  // Aisle
  const aisleY = bus.seatPlan
    ? ((bus.width - bus.seatPlan.aisle) / 2) * L.scale
    : L.drawH / 2;
  const aisleH = (bus.seatPlan?.aisle ?? 1.1) * L.scale;
  ctx.fillStyle = COLORS.aisle;
  ctx.fillRect(L.ox + 4, L.oy + aisleY, L.drawW - 8, aisleH);

  // Driver area
  if (bus.driver) {
    const d = bus.driver;
    const p = toScreen(L, d.x, d.y);
    ctx.fillStyle = COLORS.driver;
    ctx.fillRect(p.sx, p.sy, d.w * L.scale, d.h * L.scale);
    ctx.fillStyle = COLORS.label;
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillText("Driver", p.sx + 4, p.sy + 14);
  }

  // Door
  if (bus.door) {
    const door = bus.door;
    ctx.fillStyle = COLORS.door;
    if (door.wall === "right") {
      const p = toScreen(L, door.along - door.width / 2, bus.width);
      ctx.fillRect(p.sx, p.sy - 6, door.width * L.scale, 12);
    } else {
      const p = toScreen(L, door.along - door.width / 2, 0);
      ctx.fillRect(p.sx, p.sy - 6, door.width * L.scale, 12);
    }
    ctx.fillStyle = COLORS.door;
    ctx.font = "10px 'DM Sans', sans-serif";
    const label = toScreen(L, door.along, bus.width);
    ctx.fillText("DOOR", label.sx - 14, label.sy + 22);
  }

  // Seats
  seats.forEach((seat, i) => {
    const p = toScreen(L, seat.x, seat.y);
    const covered = coverageFlags?.[i];
    ctx.fillStyle = covered ? COLORS.covered : COLORS.uncovered;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, p.sx, p.sy, seat.w * L.scale, seat.h * L.scale, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    // tiny head marker
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(
      p.sx + (seat.w * L.scale) / 2,
      p.sy + (seat.h * L.scale) / 2,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  // FOV cones (selected last / on top)
  const ordered = [...cameras].sort((a, b) =>
    a.id === selectedId ? 1 : b.id === selectedId ? -1 : 0
  );
  for (const cam of ordered) {
    drawFovCone(ctx, cam, bus, L, cam.id === selectedId);
  }

  // Cameras (markers match cone color)
  for (const cam of cameras) {
    const pos = cameraWorldPos(cam, bus);
    const { sx, sy } = toScreen(L, pos.x, pos.y);
    const sel = cam.id === selectedId;
    const style = cameraFovStyles(cam.id, sel);
    ctx.beginPath();
    ctx.arc(sx, sy, sel ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = style.marker;
    ctx.fill();
    ctx.strokeStyle = sel ? "#ffffff" : "#0f1419";
    ctx.lineWidth = sel ? 2.5 : 2;
    ctx.stroke();
    ctx.fillStyle = "#0f1419";
    ctx.font = "bold 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(cam.id), sx, sy);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  // Scale bar
  const barFt = 5;
  const barPx = barFt * L.scale;
  const bx = L.ox;
  const by = L.oy + L.drawH + 22;
  ctx.strokeStyle = COLORS.label;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + barPx, by);
  ctx.moveTo(bx, by - 4);
  ctx.lineTo(bx, by + 4);
  ctx.moveTo(bx + barPx, by - 4);
  ctx.lineTo(bx + barPx, by + 4);
  ctx.stroke();
  ctx.fillStyle = COLORS.label;
  ctx.font = "11px 'IBM Plex Mono', monospace";
  ctx.fillText(`${barFt} ft`, bx + barPx + 8, by + 4);

  ctx.fillText(
    `${bus.name} · ${bus.length} ft × ${bus.width} ft interior`,
    bx + 80,
    by + 4
  );

  return L;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Hit-test camera under pointer */
export function hitCamera(canvas, bus, cameras, clientX, clientY) {
  const { x, y, layout: L } = screenToWorld(canvas, bus, clientX, clientY);
  const threshold = 12 / L.scale;
  let best = null;
  let bestD = threshold;
  for (const cam of cameras) {
    const pos = cameraWorldPos(cam, bus);
    const d = Math.hypot(pos.x - x, pos.y - y);
    if (d < bestD) {
      bestD = d;
      best = cam;
    }
  }
  return best;
}

/** Snap world point to nearest wall and return { wall, along } */
export function snapToWall(bus, x, y) {
  const distLeft = Math.abs(y - 0);
  const distRight = Math.abs(y - bus.width);
  const distFront = Math.abs(x - 0);
  const distRear = Math.abs(x - bus.length);
  const min = Math.min(distLeft, distRight, distFront, distRear);
  if (min === distLeft) return { wall: "left", along: clamp(x, 0.5, bus.length - 0.5) };
  if (min === distRight)
    return { wall: "right", along: clamp(x, 0.5, bus.length - 0.5) };
  if (min === distFront)
    return { wall: "front", along: clamp(y, 0.5, bus.width - 0.5) };
  return { wall: "rear", along: clamp(y, 0.5, bus.width - 0.5) };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
