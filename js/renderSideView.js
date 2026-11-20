import { cameraWorldPos, seatCoveredV, seatCoveredH } from "./fov.js";
import { cameraFovStyles } from "./cameraColors.js";

const COLORS = {
  busFill: "#141b24",
  wall: "#1c2633",
  wallEdge: "#c9a227",
  floor: "#243040",
  ceiling: "#1a222c",
  aisle: "#121820",
  covered: "#3dba7a",
  uncovered: "#e85d5d",
  label: "#8b9aab",
  head: "#d4dde8",
  vpGuide: "rgba(255,255,255,0.04)",
};

/**
 * 1-point perspective: eye at the front of the bus looking toward the rear.
 * World: x front→rear, y left→right, z floor→ceiling.
 */
function makeProjector(canvas, bus) {
  const pad = { l: 48, r: 28, t: 32, b: 44 };
  const availW = canvas.width - pad.l - pad.r;
  const availH = canvas.height - pad.t - pad.b;
  const cx = pad.l + availW / 2;
  // Bias slightly downward so ceiling / wall cameras stay in frame
  const cy = pad.t + availH * 0.58;
  // Stand well forward of the cabin so left/right wall cameras fit in frame
  const eye = {
    x: -22,
    y: bus.width / 2,
    z: bus.height * 0.4,
  };

  // Fit front opening (width × height) with generous margin
  const frontX = 0.4;
  const nearDepth = frontX - eye.x;
  const margin = 0.55; // lower = more zoomed out
  const focalW = ((availW * margin) / 2) * nearDepth / (bus.width / 2);
  const focalH = ((availH * margin) / 2) * nearDepth / (bus.height / 2);
  const focal = Math.min(focalW, focalH);

  function project(x, y, z) {
    const depth = Math.max(0.6, x - eye.x);
    const u = (y - eye.y) / depth;
    const v = (z - eye.z) / depth;
    return {
      sx: cx + u * focal,
      sy: cy - v * focal,
      depth,
      pxPerFt: focal / depth,
    };
  }

  return { pad, cx, cy, eye, focal, project, availW, availH };
}

function quad(ctx, pts, fill, stroke, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function renderSideView(canvas, { bus, seats, cameras, selectedId }) {
  const ctx = canvas.getContext("2d");
  const P = makeProjector(canvas, bus);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.label;
  ctx.font = "12px 'IBM Plex Mono', monospace";
  ctx.fillText("LOOKING AFT  ·  FRONT → REAR", P.pad.l, 18);
  ctx.fillText("LEFT", P.pad.l, canvas.height - 14);
  ctx.textAlign = "right";
  ctx.fillText("RIGHT", canvas.width - P.pad.r, canvas.height - 14);
  ctx.textAlign = "start";

  // Cabin shell: floor, ceiling, side walls (far → near edges)
  const rear = bus.length;
  const front = 0.3;
  const W = bus.width;
  const H = bus.height;

  const corners = {
    fl0: P.project(front, 0, 0),
    fr0: P.project(front, W, 0),
    flH: P.project(front, 0, H),
    frH: P.project(front, W, H),
    rl0: P.project(rear, 0, 0),
    rr0: P.project(rear, W, 0),
    rlH: P.project(rear, 0, H),
    rrH: P.project(rear, W, H),
  };

  // Ceiling
  quad(ctx, [corners.flH, corners.frH, corners.rrH, corners.rlH], COLORS.ceiling, null);
  // Floor
  quad(ctx, [corners.fl0, corners.fr0, corners.rr0, corners.rl0], COLORS.floor, null);
  // Left wall
  quad(ctx, [corners.fl0, corners.flH, corners.rlH, corners.rl0], COLORS.wall, null);
  // Right wall
  quad(ctx, [corners.fr0, corners.frH, corners.rrH, corners.rr0], COLORS.wall, null);
  // Rear wall
  quad(ctx, [corners.rl0, corners.rr0, corners.rrH, corners.rlH], "#10161e", COLORS.wallEdge, 1.5);

  // Cabin outer frame (front opening)
  quad(
    ctx,
    [corners.fl0, corners.fr0, corners.frH, corners.flH],
    null,
    COLORS.wallEdge,
    2
  );

  // Aisle strip on floor
  const aisleLeft = (W - (bus.seatPlan?.aisle ?? 1.1)) / 2;
  const aisleRight = aisleLeft + (bus.seatPlan?.aisle ?? 1.1);
  quad(
    ctx,
    [
      P.project(front, aisleLeft, 0.02),
      P.project(front, aisleRight, 0.02),
      P.project(rear, aisleRight, 0.02),
      P.project(rear, aisleLeft, 0.02),
    ],
    COLORS.aisle,
    null
  );

  // Depth guides
  ctx.strokeStyle = COLORS.vpGuide;
  ctx.lineWidth = 1;
  for (let x = 5; x < rear; x += 5) {
    const a = P.project(x, 0, 0);
    const b = P.project(x, W, 0);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  // Seats: draw far → near so nearer rows sit on top
  const sortedSeats = [...seats].sort((a, b) => b.x - a.x);
  for (const seat of sortedSeats) {
    const covered = cameras.some(
      (c) => seatCoveredH(seat, [c], bus) && seatCoveredV(seat, c, bus)
    );
    const y0 = seat.y;
    const y1 = seat.y + seat.h;
    const x0 = seat.x;
    const x1 = seat.x + seat.w;
    const zSeat = seat.seatZ;
    const zHead = seat.headZ;

    // Seat back (facing camera / toward front)
    const back = [
      P.project(x0, y0, zSeat),
      P.project(x0, y1, zSeat),
      P.project(x0, y1, zHead),
      P.project(x0, y0, zHead),
    ];
    ctx.globalAlpha = 0.88;
    quad(ctx, back, covered ? COLORS.covered : COLORS.uncovered, "rgba(0,0,0,0.35)", 1);
    ctx.globalAlpha = 1;

    // Cushion top hint
    const cushion = [
      P.project(x0, y0, zSeat),
      P.project(x0, y1, zSeat),
      P.project(x1, y1, zSeat),
      P.project(x1, y0, zSeat),
    ];
    ctx.globalAlpha = 0.35;
    quad(ctx, cushion, covered ? COLORS.covered : COLORS.uncovered, null);
    ctx.globalAlpha = 1;

    // Head marker
    const head = P.project(x0 + 0.15, (y0 + y1) / 2, zHead - 0.25);
    const r = Math.max(2, head.pxPerFt * 0.18);
    ctx.fillStyle = COLORS.head;
    ctx.beginPath();
    ctx.arc(head.sx, head.sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cameras + FOV: draw all markers; only the selected camera gets a full
  // FOV volume so left/right rows stay readable. Others get a faint hint.
  const sortedCams = [...cameras].sort((a, b) => {
    const ax = cameraWorldPos(a, bus).x;
    const bx = cameraWorldPos(b, bus).x;
    return bx - ax;
  });

  for (const cam of sortedCams) {
    const selected = cam.id === selectedId;
    const style = cameraFovStyles(cam.id, selected);
    drawCamFovWedge(ctx, P, bus, cam, style, selected);
  }

  // Markers on top of cones
  for (const cam of sortedCams) {
    const selected = cam.id === selectedId;
    const style = cameraFovStyles(cam.id, selected);
    const pos = cameraWorldPos(cam, bus);
    const camPt = P.project(pos.x, pos.y, cam.height);
    const r = selected ? 9 : 7;
    ctx.beginPath();
    ctx.arc(camPt.sx, camPt.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.marker;
    ctx.fill();
    ctx.strokeStyle = selected ? "#ffffff" : "#0f1419";
    ctx.lineWidth = selected ? 2.5 : 2;
    ctx.stroke();
    ctx.fillStyle = "#0f1419";
    ctx.font = "bold 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(cam.id), camPt.sx, camPt.sy);
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  const sel = cameras.find((c) => c.id === selectedId) ?? cameras[0];
  if (sel) {
    ctx.fillStyle = COLORS.label;
    ctx.font = "11px 'DM Sans', sans-serif";
    ctx.fillText(
      `Cam ${sel.id} · ${sel.wall} wall · H ${sel.height.toFixed(1)} ft · pitch ${sel.pitch}° · VFOV ${sel.vfov}° · HFOV ${sel.hfov}°`,
      P.pad.l,
      canvas.height - 14
    );
  }
}

/**
 * Draw a translucent FOV volume from a wall camera into the cabin,
 * using HFOV (horizontal) + pitch/VFOV (vertical) sampled in world space.
 */
function drawCamFovWedge(ctx, P, bus, cam, style, selected) {
  const pos = cameraWorldPos(cam, bus);
  const halfH = ((cam.hfov / 2) * Math.PI) / 180;
  const halfV = ((cam.vfov / 2) * Math.PI) / 180;
  const pitch = (cam.pitch * Math.PI) / 180;

  // Facing: left wall → +y, right wall → -y, with yaw about vertical
  let baseYaw = cam.wall === "left" ? Math.PI / 2 : cam.wall === "right" ? -Math.PI / 2 : 0;
  if (cam.wall === "front") baseYaw = 0;
  if (cam.wall === "rear") baseYaw = Math.PI;
  const yaw = baseYaw + (cam.yaw * Math.PI) / 180;

  // Keep wedge short so it doesn't explode past the cabin and eat the frame
  const range = Math.min(bus.length * 0.55, Math.hypot(bus.length, bus.width) * 0.45);
  const farPts = [];
  for (const hSign of [-1, 1]) {
    for (const vSign of [-1, 1]) {
      const hAng = yaw + hSign * halfH;
      const vAng = pitch + vSign * halfV;
      const wx = Math.max(0.2, Math.min(bus.length - 0.2, pos.x + Math.cos(hAng) * Math.cos(vAng) * range));
      const wy = Math.max(0.05, Math.min(bus.width - 0.05, pos.y + Math.sin(hAng) * Math.cos(vAng) * range));
      const wz = Math.max(0.1, Math.min(bus.height - 0.1, cam.height - Math.sin(vAng) * range));
      farPts.push(P.project(wx, wy, wz));
    }
  }

  const origin = P.project(pos.x, pos.y, cam.height);

  // Draw as two triangles (origin → pairs of far corners) for a readable wedge
  // Order farPts: (-h,-v), (-h,+v), (+h,-v), (+h,+v)
  const faces = [
    [farPts[0], farPts[1]],
    [farPts[1], farPts[3]],
    [farPts[3], farPts[2]],
    [farPts[2], farPts[0]],
  ];

  // Selected: readable volume. Others: outline-only hint so both sides stay clear.
  const alpha = selected ? 0.55 : 0.18;
  ctx.globalAlpha = alpha;
  for (const [a, b] of faces) {
    ctx.beginPath();
    ctx.moveTo(origin.sx, origin.sy);
    ctx.lineTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.closePath();
    if (selected) {
      ctx.fillStyle = style.fill;
      ctx.fill();
    }
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
