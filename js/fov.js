/** Degrees → radians */
export function deg(d) {
  return (d * Math.PI) / 180;
}

/**
 * Camera facing direction in top-down plane.
 * Walls: left (y=0) faces +y; right (y=width) faces -y;
 * front (x=0) faces +x; rear (x=length) faces -x.
 */
export function cameraFacing(cam, bus) {
  let base = 0;
  if (cam.wall === "left") base = Math.PI / 2; // +y
  else if (cam.wall === "right") base = -Math.PI / 2; // -y
  else if (cam.wall === "front") base = 0; // +x
  else if (cam.wall === "rear") base = Math.PI; // -x
  // yaw: positive rotates toward rear for side walls
  return base + deg(cam.yaw);
}

export function cameraWorldPos(cam, bus) {
  if (cam.wall === "left") return { x: cam.along, y: 0.08 };
  if (cam.wall === "right") return { x: cam.along, y: bus.width - 0.08 };
  if (cam.wall === "front") return { x: 0.08, y: cam.along };
  return { x: bus.length - 0.08, y: cam.along };
}

/** Clamp camera along its wall */
export function clampAlong(cam, bus) {
  const max =
    cam.wall === "left" || cam.wall === "right" ? bus.length : bus.width;
  return Math.max(0.5, Math.min(max - 0.5, cam.along));
}

/**
 * Point-in-FOV for top-down (horizontal): angle between facing and point ≤ hfov/2
 * and within max range (bus diagonal).
 */
export function pointInHFov(px, py, cam, bus) {
  const pos = cameraWorldPos(cam, bus);
  const facing = cameraFacing(cam, bus);
  const dx = px - pos.x;
  const dy = py - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return true;
  const ang = Math.atan2(dy, dx);
  let diff = ang - facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff) <= deg(cam.hfov) / 2;
}

/** Sample seat corners + center for HFOV coverage */
export function seatCoveredH(seat, cameras, bus) {
  const samples = [
    { x: seat.x + seat.w / 2, y: seat.y + seat.h / 2 },
    { x: seat.x + 0.15, y: seat.y + 0.15 },
    { x: seat.x + seat.w - 0.15, y: seat.y + 0.15 },
    { x: seat.x + 0.15, y: seat.y + seat.h - 0.15 },
    { x: seat.x + seat.w - 0.15, y: seat.y + seat.h - 0.15 },
  ];
  // Covered if majority of samples are in any camera
  let hits = 0;
  for (const s of samples) {
    if (cameras.some((c) => pointInHFov(s.x, s.y, c, bus))) hits++;
  }
  return hits >= 3;
}

/**
 * Side-view vertical FOV: camera at (along, height), looking with pitch down.
 * Pitch 0 = horizontal; positive = tilt down toward floor.
 * A seat is vertically covered if the band [seatZ, headZ] intersects the VFOV wedge
 * at that along-distance (simplified 2D side view along length).
 */
export function seatCoveredV(seat, cam, bus) {
  const pos = cameraWorldPos(cam, bus);
  // Distance along cabin length from camera to seat center
  const seatMidX = seat.x + seat.w / 2;
  const dx = seatMidX - pos.x;
  // Also need lateral distance for true range; approximate with 2D length distance
  const seatMidY = seat.y + seat.h / 2;
  const dy = seatMidY - pos.y;
  const range = Math.hypot(dx, dy);
  if (range < 0.2) return true;

  // Angle of seat height band from camera (0 = horizontal, positive = down)
  const angleTop = Math.atan2(cam.height - seat.headZ, range);
  const angleBot = Math.atan2(cam.height - seat.seatZ, range);

  const centerPitch = deg(cam.pitch);
  const half = deg(cam.vfov) / 2;
  const fovMin = centerPitch - half;
  const fovMax = centerPitch + half;

  // Overlap of [angleTop, angleBot] with [fovMin, fovMax]
  const lo = Math.max(angleTop, fovMin);
  const hi = Math.min(angleBot, fovMax);
  return hi > lo;
}

/** Combined coverage: needs H and V from the same camera, or any camera pair — require both from same cam */
export function seatCovered(seat, cameras, bus) {
  return cameras.some(
    (c) => seatCoveredH(seat, [c], bus) && seatCoveredV(seat, c, bus)
  );
}

export function coverageStats(seats, cameras, bus) {
  let covered = 0;
  const flags = seats.map((s) => {
    const ok = seatCovered(s, cameras, bus);
    if (ok) covered++;
    return ok;
  });
  return {
    covered,
    total: seats.length,
    pct: seats.length ? Math.round((covered / seats.length) * 100) : 0,
    flags,
  };
}
