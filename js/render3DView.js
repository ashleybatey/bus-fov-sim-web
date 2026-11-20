import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { cameraWorldPos, cameraFacing, deg } from "./fov.js";
import { cameraColor } from "./cameraColors.js";

/** Bus (x,y,z) → Three.js (X right-along-length, Y up, Z across-width) */
function to3(x, y, z) {
  return new THREE.Vector3(x, z, y);
}

let renderer;
let scene;
let camera;
let controls;
let contentRoot;
let canvasEl;
let animating = false;
let lastMeta = "";
let lastBusId = null;

export function init3DView(canvas) {
  canvasEl = canvas;
  const w = canvas.clientWidth || canvas.width || 800;
  const h = canvas.clientHeight || canvas.height || 360;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x0d1218, 1);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
  camera.position.set(-18, 10, 14);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(12, 3, 4);
  controls.minDistance = 8;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.update();

  scene.add(new THREE.AmbientLight(0xb8c4d4, 0.7));
  const key = new THREE.DirectionalLight(0xfff2d6, 0.85);
  key.position.set(-10, 20, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aacc, 0.35);
  fill.position.set(20, 8, -10);
  scene.add(fill);

  contentRoot = new THREE.Group();
  scene.add(contentRoot);

  if (!animating) {
    animating = true;
    tick();
  }
}

function tick() {
  requestAnimationFrame(tick);
  if (!renderer || !scene || !camera) return;
  controls?.update();
  renderer.render(scene, camera);
}

export function resize3DView() {
  if (!renderer || !camera || !canvasEl) return;
  const w = canvasEl.clientWidth || canvasEl.width;
  const h = canvasEl.clientHeight || canvasEl.height;
  if (w < 2 || h < 2) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

export function update3DView({ bus, seats, cameras, selectedId, coverageFlags }) {
  if (!contentRoot) return;

  const meta = JSON.stringify({
    bus: bus.id,
    seats: seats.length,
    cams: cameras.map((c) => [
      c.id,
      c.wall,
      c.along,
      c.height,
      c.hfov,
      c.vfov,
      c.yaw,
      c.pitch,
    ]),
    selectedId,
    flags: coverageFlags,
  });
  if (meta === lastMeta) return;
  lastMeta = meta;

  while (contentRoot.children.length) {
    const obj = contentRoot.children.pop();
    disposeObject(obj);
  }

  buildCabin(contentRoot, bus);
  buildSeats(contentRoot, seats, coverageFlags);
  buildCameras(contentRoot, bus, cameras, selectedId);

  const cx = bus.length / 2;
  const cy = bus.height * 0.4;
  const cz = bus.width / 2;
  controls.target.set(cx, cy, cz);

  if (lastBusId !== bus.id) {
    lastBusId = bus.id;
    camera.position.set(-bus.length * 0.25, bus.height * 1.8, bus.width * 2.4);
    controls.update();
  }
}

function disposeObject(obj) {
  obj.traverse?.((n) => {
    n.geometry?.dispose?.();
    if (n.material) {
      if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
      else n.material.dispose();
    }
  });
}

function buildCabin(root, bus) {
  const L = bus.length;
  const W = bus.width;
  const H = bus.height;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(L, W),
    new THREE.MeshStandardMaterial({
      color: 0x243040,
      roughness: 0.9,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(L / 2, 0, W / 2);
  root.add(floor);

  // Ceiling (thin)
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(L, W),
    new THREE.MeshStandardMaterial({
      color: 0x1a222c,
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(L / 2, H, W / 2);
  root.add(ceil);

  // Walls as edges / translucent panels
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1c2633,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xc9a227 });

  // Left wall (z=0)
  const left = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
  left.position.set(L / 2, H / 2, 0);
  root.add(left);
  // Right wall (z=W)
  const right = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat.clone());
  right.position.set(L / 2, H / 2, W);
  root.add(right);
  // Rear wall
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat.clone());
  rear.rotation.y = Math.PI / 2;
  rear.position.set(L, H / 2, W / 2);
  root.add(rear);

  // Wireframe box outline
  const box = new THREE.BoxGeometry(L, H, W);
  const edges = new THREE.EdgesGeometry(box);
  const line = new THREE.LineSegments(edges, edgeMat);
  line.position.set(L / 2, H / 2, W / 2);
  root.add(line);

  // Aisle stripe
  const aisleW = bus.seatPlan?.aisle ?? 1.1;
  const aisle = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 2, aisleW),
    new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.95 })
  );
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(L / 2, 0.01, W / 2);
  root.add(aisle);

}

function buildSeats(root, seats, coverageFlags) {
  seats.forEach((seat, i) => {
    const covered = coverageFlags?.[i];
    const color = covered ? 0x3dba7a : 0xe85d5d;
    const depth = seat.w;
    const width = seat.h;
    const backH = seat.headZ - seat.seatZ;

    // Cushion
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(depth * 0.9, 0.25, width * 0.9),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        transparent: true,
        opacity: 0.85,
      })
    );
    cushion.position.set(
      seat.x + depth / 2,
      seat.seatZ,
      seat.y + width / 2
    );
    root.add(cushion);

    // Seat back
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, backH, width * 0.9),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
      })
    );
    back.position.set(seat.x + 0.12, seat.seatZ + backH / 2, seat.y + width / 2);
    root.add(back);

    // Head marker
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd4dde8 })
    );
    head.position.set(seat.x + 0.35, seat.headZ - 0.25, seat.y + width / 2);
    root.add(head);
  });
}

function buildCameras(root, bus, cameras, selectedId) {
  for (const cam of cameras) {
    const selected = cam.id === selectedId;
    const hex = cameraColor(cam.id);
    const color = new THREE.Color(hex);
    const pos = cameraWorldPos(cam, bus);
    const origin = to3(pos.x, pos.y, cam.height);

    // Camera body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(selected ? 0.35 : 0.28, 16, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: selected ? 0.45 : 0.2,
        roughness: 0.4,
      })
    );
    body.position.copy(origin);
    root.add(body);

    // Number sprite-like disc
    const label = makeLabelSprite(String(cam.id), hex, selected);
    label.position.copy(origin).add(new THREE.Vector3(0, 0.55, 0));
    root.add(label);

    // FOV frustum
    const frustum = makeFovFrustum(cam, bus, hex, selected);
    root.add(frustum);
  }
}

function makeLabelSprite(text, hex, selected) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = hex;
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.fillStyle = "#0f1419";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(selected ? 1.1 : 0.9, selected ? 1.1 : 0.9, 1);
  return sprite;
}

/**
 * Rectangular pyramid frustum from camera with HFOV × VFOV, yaw + pitch.
 */
function makeFovFrustum(cam, bus, hex, selected) {
  const group = new THREE.Group();
  const pos = cameraWorldPos(cam, bus);
  const origin = to3(pos.x, pos.y, cam.height);
  const facing = cameraFacing(cam, bus); // atan2(dy,dx) in bus XY plane
  const halfH = deg(cam.hfov) / 2;
  const halfV = deg(cam.vfov) / 2;
  const pitch = deg(cam.pitch);
  const range = Math.min(bus.length * 0.75, Math.hypot(bus.length, bus.width) * 0.7);

  // Camera local axes in Three.js space:
  // Forward in bus plane from facing angle (x,y) → Three (x, 0, y), then pitch down
  const forwardFlat = new THREE.Vector3(Math.cos(facing), 0, Math.sin(facing)).normalize();
  const right = new THREE.Vector3().crossVectors(forwardFlat, new THREE.Vector3(0, 1, 0)).normalize();
  // Pitch: rotate forward around `right`
  const forward = forwardFlat.clone().applyAxisAngle(right, -pitch).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const farPts = [];
  for (const hSign of [-1, 1]) {
    for (const vSign of [-1, 1]) {
      const dir = forward
        .clone()
        .addScaledVector(right, Math.tan(hSign * halfH))
        .addScaledVector(up, Math.tan(vSign * halfV))
        .normalize();
      farPts.push(origin.clone().addScaledVector(dir, range));
    }
  }
  // Order: (-h,-v), (-h,+v), (+h,-v), (+h,+v) → rearrange to proper quad
  // indices: 0=(-h,-v) 1=(-h,+v) 2=(+h,-v) 3=(+h,+v)
  const corners = [farPts[0], farPts[1], farPts[3], farPts[2]];

  const positions = [];
  // 4 side triangles apex → edge
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    positions.push(origin.x, origin.y, origin.z);
    positions.push(a.x, a.y, a.z);
    positions.push(b.x, b.y, b.z);
  }
  // Far face
  positions.push(
    corners[0].x, corners[0].y, corners[0].z,
    corners[1].x, corners[1].y, corners[1].z,
    corners[2].x, corners[2].y, corners[2].z
  );
  positions.push(
    corners[0].x, corners[0].y, corners[0].z,
    corners[2].x, corners[2].y, corners[2].z,
    corners[3].x, corners[3].y, corners[3].z
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: selected ? 0.22 : 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.6,
    })
  );
  group.add(fill);

  // Wire edges
  const edgePos = [];
  for (const c of corners) {
    edgePos.push(origin.x, origin.y, origin.z, c.x, c.y, c.z);
  }
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    edgePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: selected ? 0.95 : 0.45,
    })
  );
  group.add(edges);

  return group;
}
