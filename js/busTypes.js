/**
 * Approximate interior layouts for school bus Types A–D.
 * Units: feet. Origin: front-left of passenger cabin (looking toward rear = +x).
 * Width axis: left wall = 0, right wall = width (street side / door side).
 *
 * Lengths and row counts use the high end of each type’s typical range so FOV
 * planning covers the hardest (longest / densest) cabin cases.
 */

const FT = 1;

export const BUS_TYPES = {
  A: {
    id: "A",
    name: "Type A",
    description:
      "Cutaway / minibus on a van chassis. Compact cabin — longest Type A ~25 ft with 8 seat rows.",
    length: 25 * FT,
    width: 7.75 * FT,
    height: 6.5 * FT,
    capacity: "10–30",
    // Door on right wall near front
    door: { wall: "right", along: 2.5, width: 2.5 },
    driver: { x: 1.2, y: 1.5, w: 2.2, h: 2.0 },
    seatPlan: {
      leftCount: 2,
      rightCount: 2,
      rows: 8,
      firstRowX: 5.0,
      rowPitch: 2.35,
      seatDepth: 1.4,
      aisle: 1.2,
    },
  },
  B: {
    id: "B",
    name: "Type B",
    description:
      "Forward-engine mid-size. Door behind front wheels. Longest Type B ~30 ft with 10 seat rows.",
    length: 30 * FT,
    width: 7.75 * FT,
    height: 6.5 * FT,
    capacity: "10–36+",
    door: { wall: "right", along: 4.0, width: 2.5 },
    driver: { x: 1.5, y: 1.4, w: 2.4, h: 2.2 },
    seatPlan: {
      leftCount: 3,
      rightCount: 2,
      rows: 10,
      firstRowX: 6.0,
      rowPitch: 2.3,
      seatDepth: 1.4,
      aisle: 1.15,
    },
  },
  C: {
    id: "C",
    name: "Type C · Conventional",
    description:
      "Classic hood-forward school bus. Door behind front wheels. Longest Type C ~38 ft with 14 rows (3+3).",
    length: 38 * FT,
    width: 7.55 * FT,
    height: 6.4 * FT,
    capacity: "36–78",
    door: { wall: "right", along: 5.5, width: 2.6 },
    driver: { x: 2.0, y: 1.3, w: 2.5, h: 2.3 },
    seatPlan: {
      leftCount: 3,
      rightCount: 3,
      rows: 14,
      firstRowX: 7.0,
      rowPitch: 2.15,
      seatDepth: 1.35,
      aisle: 1.1,
    },
  },
  D: {
    id: "D",
    name: "Type D · Transit",
    description:
      "Flat-front transit style. Door ahead of front wheels. Longest Type D ~45 ft with 16 rows (3+3).",
    length: 45 * FT,
    width: 7.55 * FT,
    height: 6.4 * FT,
    capacity: "72–90",
    door: { wall: "right", along: 2.0, width: 2.6 },
    driver: { x: 1.2, y: 1.3, w: 2.5, h: 2.3 },
    seatPlan: {
      leftCount: 3,
      rightCount: 3,
      rows: 16,
      firstRowX: 5.5,
      rowPitch: 2.25,
      seatDepth: 1.3,
      aisle: 1.1,
    },
  },
};

/** Build seat rectangles for a bus type. Each seat is a student zone. */
export function buildSeats(bus) {
  const { seatPlan: sp, width } = bus;
  const seats = [];
  const seatWidthLeft = (width - sp.aisle) / 2 / sp.leftCount;
  const seatWidthRight = (width - sp.aisle) / 2 / sp.rightCount;
  const leftBlockWidth = seatWidthLeft * sp.leftCount;
  const rightStart = leftBlockWidth + sp.aisle;

  for (let row = 0; row < sp.rows; row++) {
    const x = sp.firstRowX + row * sp.rowPitch;
    if (x + sp.seatDepth > bus.length - 1.5) break;

    for (let i = 0; i < sp.leftCount; i++) {
      seats.push({
        id: `L${row}-${i}`,
        row,
        side: "left",
        x,
        y: i * seatWidthLeft,
        // Top-down: w along length (+x), h across cabin (+y)
        w: sp.seatDepth,
        h: seatWidthLeft - 0.08,
        // Side-view seat height band (cushion ~1.5 ft, head ~4.5 ft)
        floorZ: 0,
        seatZ: 1.5,
        headZ: 4.2,
      });
    }

    for (let i = 0; i < sp.rightCount; i++) {
      seats.push({
        id: `R${row}-${i}`,
        row,
        side: "right",
        x,
        y: rightStart + i * seatWidthRight,
        w: sp.seatDepth,
        h: seatWidthRight - 0.08,
        floorZ: 0,
        seatZ: 1.5,
        headZ: 4.2,
      });
    }
  }

  return seats;
}

export function defaultCameras(bus, count) {
  const positions = [];
  const walls = ["left", "right"];
  // Spread along length, alternate walls
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.35 : 0.15 + (i / (count - 1)) * 0.7;
    const wall = walls[i % 2];
    positions.push({
      id: i + 1,
      wall,
      along: bus.length * t,
      height: Math.min(7, bus.height + 0.4),
      hfov: 90,
      vfov: 60,
      yaw: 0,
      pitch: 20,
    });
  }
  return positions;
}
