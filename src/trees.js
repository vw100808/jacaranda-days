import * as THREE from 'three';
import { AWNING, BALCONY, BUILDING as B, LAMP_DEFS, STREET, TREE_DEFS } from './config.js';

// Trees adjacent to the three street lamps are lifted and thinned slightly.
// This keeps the crowns natural while letting the lamp heads sit clearly below
// the main foliage mass; it replaces the old hard radial clearance.
const LAMP_TREE_TUNING = {
  // Asymmetric planting massing around the house. The taller rear-centre tree
  // is the anchor behind the roof; the rear-left and rear-right crowns sit at
  // different heights and depths so the backdrop does not read as one flat row.
  'front-court': { heightScale: 1.213, density: 0.86, spread: 1.00, lampLift: true },
  'front-left': { heightScale: 1.208, density: 0.92, spread: 1.04, lampLift: true },
  'left-side': { heightScale: 1.298, density: 1.00, spread: 0.94, lampLift: true },
  'right-side': { heightScale: 1.363, density: 0.78, spread: 0.96, lampLift: true },
  'back-left': { heightScale: 0.910, density: 1.14, spread: 1.12, lampLift: true, limbs: 5 },
  'back-centre': { heightScale: 0.859, density: 1.04, spread: 1.04, lampLift: true, limbs: 6 },
  'back-right': { heightScale: 0.966, density: 1.02, spread: 0.90, lampLift: true, limbs: 5 },
};

// Keep the lower canopy around a lamp sparse and lifted. Branches remain, but
// most blossom/frond clusters below the lantern are skipped; the main crown
// starts above the lamp head. This is a local clearance, not a radial hole.
const LAMP_LOWER_RADIUS = 2.15;
const LAMP_LOWER_Y = STREET.sidewalkY + 6.0;
const LAMP_HEAD_RADIUS = 1.25;
const LAMP_HEAD_BAND = [STREET.sidewalkY + 3.30, STREET.sidewalkY + 4.95];
function isLowNearLamp(point, tuning) {
  if (!tuning?.lampLift || point.y > LAMP_LOWER_Y) return false;
  return LAMP_DEFS.some((lamp) => Math.hypot(point.x - lamp.pos[0], point.z - lamp.pos[1]) < LAMP_LOWER_RADIUS);
}

function hash01(point) {
  const s = Math.sin(point.x * 12.9898 + point.y * 78.233 + point.z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// Keep 30% of low clusters; the higher overall crown and the remaining gap
// keep the lantern readable without emptying the branch tips completely.
function cullLowNearLamp(point, tuning) {
  if (!isLowNearLamp(point, tuning)) return false;
  // Thin the crown broadly, and thin the actual head band more strongly while
  // keeping ~20% of instances so the cluster does not become a clean hole.
  if (point.y >= LAMP_HEAD_BAND[0] && point.y <= LAMP_HEAD_BAND[1]
    && LAMP_DEFS.some((lamp) => Math.hypot(point.x - lamp.pos[0], point.z - lamp.pos[1]) < LAMP_HEAD_RADIUS)) {
    return hash01(point) < 0.80;
  }
  return hash01(point) < 0.70;
}
import { mulberry32, ranged } from './utils.js';

/* ------------------------------------------------------------------ */
/* Shared geometry                                                     */
/* ------------------------------------------------------------------ */

function createBlossomGeometry() {
  const positions = [];
  const colors = [];
  const petals = 5;
  const cBase = new THREE.Color('#674996');
  const cMid = new THREE.Color('#9172c4');
  const cLight = new THREE.Color('#cbb9ea');
  const cTip = new THREE.Color('#f0e8fb');
  const cDeep = new THREE.Color('#4f3578');
  const cBack = new THREE.Color('#33204f');

  function pushTri(a, b, c, ca, cb, cc) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  const polar = (angle, radius, z) =>
    new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);

  // Five broad lobes, two triangles each. At canopy scale this keeps the
  // five-lobed lip but cuts the blossom triangle count roughly in half.
  for (let i = 0; i < petals; i += 1) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const base = polar(a, 0.11, 0.02);
    const outerL = polar(a - 0.2, 0.57, 0.105);
    const tip = polar(a, 0.64, 0.125);
    const outerR = polar(a + 0.2, 0.57, 0.105);

    pushTri(base, outerL, tip, cBase, cLight, cTip);
    pushTri(base, tip, outerR, cBase, cTip, cLight);
  }

  // One flared throat ring, then a dark centre.
  const sides = 5;
  const rim = [];
  const back = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2;
    rim.push(polar(angle, 0.17, 0.06));
    back.push(polar(angle, 0.055, -0.23));
  }
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    pushTri(rim[i], rim[j], back[j], cMid, cMid, cDeep);
    pushTri(rim[i], back[j], back[i], cMid, cDeep, cBack);
  }
  const center = polar(0, 0, -0.228);
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    pushTri(center, back[j], back[i], cBack, cDeep, cDeep);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createFrondGeometry() {
  const positions = [];
  const colors = [];
  const stemDark = new THREE.Color('#18142c');
  const leafDark = new THREE.Color('#271e4a');
  const leafMid = new THREE.Color('#43306f');
  const leafLight = new THREE.Color('#6d52a3');

  function tri(a, b, c, ca, cb, cc) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  const stemLeft0 = new THREE.Vector3(-0.014, 0, 0);
  const stemRight0 = new THREE.Vector3(0.014, 0, 0);
  const stemLeft1 = new THREE.Vector3(-0.012, 1, 0.015);
  const stemRight1 = new THREE.Vector3(0.012, 1, 0.015);
  tri(stemLeft0, stemRight0, stemRight1, stemDark, stemDark, stemDark);
  tri(stemLeft0, stemRight1, stemLeft1, stemDark, stemDark, stemDark);

  for (let i = 0; i < 4; i += 1) {
    const y = 0.15 + i * 0.22;
    const length = 0.43 * (1 - i * 0.065);
    for (const side of [-1, 1]) {
      const root = new THREE.Vector3(0, y, 0.006);
      const outer = new THREE.Vector3(side * length * 0.58, y + length * 0.34, 0.02);
      const tip = new THREE.Vector3(side * length, y + length * 0.82, 0.002);
      const inner = new THREE.Vector3(side * length * 0.22, y + length * 0.2, 0.002);
      tri(root, inner, outer, stemDark, leafDark, leafMid);
      tri(inner, tip, outer, leafDark, leafLight, leafMid);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createTwigGeometry() {
  return new THREE.CylinderGeometry(0.55, 1, 1, 4, 1);
}

function createMainBranchGeometry() {
  return new THREE.CylinderGeometry(0.68, 1, 1, 5, 1);
}

/* ------------------------------------------------------------------ */
/* Obstacle avoidance                                                  */
/* ------------------------------------------------------------------ */

const BUILDING_MARGIN = 0.42;

function avoidObstacles(point, treeHeight) {
  const p = point.clone();

  if (p.y > B.parapetTop + 0.32) return p;

  // Main volume.
  const xMin = B.xMin - BUILDING_MARGIN;
  const xMax = B.xMax + BUILDING_MARGIN;
  const zMin = B.zMin - BUILDING_MARGIN;
  const zMax = B.zMax + BUILDING_MARGIN;
  if (p.x > xMin && p.x < xMax && p.z > zMin && p.z < zMax) {
    const dLeft = p.x - xMin;
    const dRight = xMax - p.x;
    const dBack = p.z - zMin;
    const dFront = zMax - p.z;
    const m = Math.min(dLeft, dRight, dBack, dFront);
    if (m === dLeft) p.x = xMin;
    else if (m === dRight) p.x = xMax;
    else if (m === dBack) p.z = zMin;
    else p.z = zMax;
  }

  // The projecting balcony and awning need a little extra clearance on the
  // two street facades.
  const awnFront = B.zMax + AWNING.depth + 0.24;
  const awnRight = B.xMax + AWNING.depth + 0.24;
  if (
    p.y > B.firstCornice - 0.4 &&
    p.y < B.thirdBase + 0.4 &&
    p.x > BALCONY.startX - 0.4 &&
    p.x < awnRight &&
    p.z > B.zMax - 0.9 &&
    p.z < awnFront
  ) {
    if (p.z - (B.zMax - 0.9) < awnFront - p.z) p.z = B.zMax - 0.9;
    else p.z = awnFront;
  }
  if (
    p.y > B.secondBase - 0.2 &&
    p.y < B.thirdBase + 0.4 &&
    p.z > BALCONY.endZ - 0.7 &&
    p.z < B.zMax - 0.1 &&
    p.x > B.xMax - 0.2 &&
    p.x < awnRight
  ) {
    p.x = awnRight;
  }

  return p;
}

/* ------------------------------------------------------------------ */
/* Tree generation                                                     */
/* ------------------------------------------------------------------ */

function buildTree(def, index, shared, scene) {
  const rng = mulberry32(def.seed * 7919 + 13);
  const root = new THREE.Vector3(def.pos[0], STREET.sidewalkY, def.pos[1]);
  const tune = LAMP_TREE_TUNING[def.id] || {};
  const height = def.height * (tune.heightScale ?? 1);
  const density = tune.density ?? 1;
  const spread = tune.spread ?? 1;
  const baseRadius = def.radius;
  const centerX = (B.xMin + B.xMax) / 2;
  const centerZ = (B.zMin + B.zMax) / 2;
  const outward = new THREE.Vector3(root.x - centerX, 0, root.z - centerZ).normalize();
  const mainSegments = [];
  const joints = [];
  const twigSegments = [];
  const blossoms = [];
  const blossomColors = [];
  const fronds = [];
  const frondColors = [];
  const anchors = [];
  const branchColor = new THREE.Color();

  function addSegment(a, b, r0, target) {
    const length = a.distanceTo(b);
    if (length < 0.012) return;
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const matrix = new THREE.Matrix4().compose(
      mid,
      quat,
      new THREE.Vector3(r0, length * 1.02, r0),
    );
    target.push({ matrix, a: a.clone(), b: b.clone(), radius: r0 });
  }

  function addJoint(p, radius) {
    const matrix = new THREE.Matrix4().compose(
      p,
      new THREE.Quaternion(),
      new THREE.Vector3(radius * 1.08, radius * 1.08, radius * 1.08),
    );
    joints.push(matrix);
  }

  // ---- Trunk --------------------------------------------------------
  const trunkSegments = 9;
  const trunkBreak = height * 0.55;
  let p = root.clone();
  p.y += 0.01;
  addJoint(p, baseRadius * 1.3);
  const trunkPoints = [p.clone()];
  let dir = new THREE.Vector3(def.lean[0] * 0.2, 1, def.lean[1] * 0.2).normalize();

  for (let i = 0; i < trunkSegments; i += 1) {
    const t = i / trunkSegments;
    dir.x += (rng() - 0.5) * 0.075 + def.lean[0] * 0.018;
    dir.z += (rng() - 0.5) * 0.075 + def.lean[1] * 0.018;
    dir.y += 0.17;
    dir.normalize();
    const segLen = (trunkBreak / trunkSegments) * (0.88 + rng() * 0.24);
    let q = p.clone().addScaledVector(dir, segLen);
    q = avoidObstacles(q, height);
    const radius = baseRadius * (1 - 0.62 * t);
    addSegment(p, q, radius, mainSegments);
    addJoint(q, radius * 0.74);
    trunkPoints.push(q.clone());
    p = q;
  }

  // Root flare on the grate.
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + rng() * 0.55;
    const start = root.clone();
    start.y += 0.04;
    const end = root.clone();
    end.x += Math.cos(angle) * (0.34 + rng() * 0.22);
    end.z += Math.sin(angle) * (0.34 + rng() * 0.22);
    end.y += 0.012;
    const r = baseRadius * 0.35;
    addSegment(start, end, r, mainSegments);
    addJoint(end, r * 0.65);
  }

  // ---- Primary limbs ------------------------------------------------
  // Mature jacarandas in the reference photographs have a short bole that
  // breaks into a handful of heavy, irregular scaffold limbs low in the crown,
  // not a conifer-like stack of whorls. Keep the fork in one compact zone.
  const trunkTopRadius = baseRadius * (1 - 0.62 * 0.96);
  const limbCount = tune.limbs ?? 5;
  const limbAnchors = limbCount === 6 ? [5, 6, 6, 7, 7, 8] : [5, 6, 6, 7, 7];
  const outwardAngle = Math.atan2(outward.z, outward.x);
  const primaryBranches = [];

  for (let i = 0; i < limbCount; i += 1) {
    const anchorIndex = limbAnchors[i];
    const start = trunkPoints[anchorIndex].clone();
    const t = anchorIndex / trunkSegments;
    const baseR = baseRadius * (1 - 0.62 * t) * 0.61;
    let az = outwardAngle + (i / limbCount) * Math.PI * 2 + (rng() - 0.5) * 0.7;
    const radial = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    radial.addScaledVector(outward, 0.38).normalize();
    const elevation = 0.30 + rng() * 0.36;
    let limbDir = new THREE.Vector3(radial.x, elevation, radial.z).normalize();
    const totalLength = height * (0.30 + rng() * 0.11) * spread;
    const segmentCount = 4;
    const nodes = [start.clone()];
    let current = start.clone();
    let currentR = baseR;

    for (let s = 0; s < segmentCount; s += 1) {
      limbDir.x += (rng() - 0.5) * 0.25;
      limbDir.z += (rng() - 0.5) * 0.25;
      limbDir.y += (rng() - 0.5) * 0.10;
      limbDir.y = Math.max(0.18, limbDir.y);
      limbDir.normalize();
      let next = current.clone().addScaledVector(
        limbDir,
        (totalLength / segmentCount) * (0.8 + rng() * 0.4),
      );
      next = avoidObstacles(next, height);
      const nextR = currentR * (0.7 + rng() * 0.08);
      addSegment(current, next, currentR, mainSegments);
      addJoint(next, nextR * 0.85);
      nodes.push(next.clone());
      current = next;
      currentR = nextR;
    }
    primaryBranches.push({ nodes, radius: currentR / 0.72, start, dir: limbDir.clone() });
  }

  // ---- Secondary branches and terminal twigs ------------------------
  const secondaryBranches = [];
  primaryBranches.forEach((primary, primaryIndex) => {
    const spawnNodes = [1, 2, 3, 3];
    spawnNodes.forEach((nodeIndex, spawnIndex) => {
      const base = primary.nodes[nodeIndex].clone();
      const parentDir = new THREE.Vector3()
        .subVectors(primary.nodes[nodeIndex], primary.nodes[nodeIndex - 1])
        .normalize();
      const side = spawnIndex === 0 ? 1 : -1;
      const rotation = side * (0.62 + rng() * 0.55) + (rng() - 0.5) * 0.25;
      parentDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
      parentDir.y += 0.14 + rng() * 0.24;
      parentDir.normalize();

      const totalLength = height * (0.12 + rng() * 0.055) * spread;
      const segmentCount = 3;
      const nodes = [base.clone()];
      let current = base.clone();
      let currentR = Math.max(0.015, primary.radius * (0.53 - nodeIndex * 0.07));
      let segDir = parentDir.clone();

      for (let s = 0; s < segmentCount; s += 1) {
        segDir.x += (rng() - 0.5) * 0.32;
        segDir.z += (rng() - 0.5) * 0.32;
        segDir.y += (rng() - 0.15) * 0.17;
        segDir.y = Math.max(-0.03, segDir.y);
        segDir.normalize();
        let next = current.clone().addScaledVector(
          segDir,
          (totalLength / segmentCount) * (0.8 + rng() * 0.4),
        );
        next = avoidObstacles(next, height);
        currentR *= 0.68;
        addSegment(current, next, currentR * 1.3, mainSegments);
        addJoint(next, currentR * 0.85);
        nodes.push(next.clone());
        current = next;
      }
      secondaryBranches.push({ nodes, radius: currentR, parentIndex: primaryIndex });
    });
  });

  // Twigs carry the blossom clusters. They are local to the sway pivot.
  const rootY = root.y;
  const toLocal = (v) => new THREE.Vector3(v.x - root.x, v.y - rootY, v.z - root.z);

  // Every primary limb ends in a small spray so no thick branch is left with
  // a cut-off tip in mid air.
  primaryBranches.forEach((primary) => {
    const base = primary.nodes[primary.nodes.length - 1].clone();
    const before = primary.nodes[primary.nodes.length - 2];
    const tangent = new THREE.Vector3().subVectors(base, before).normalize();
    const radius = Math.max(0.007, primary.radius * 0.18);
    for (let k = 0; k < 3; k += 1) {
      const dir = tangent.clone();
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (k - 1) * 0.9);
      dir.y += 0.12;
      dir.normalize();
      let current = base.clone();
      let r = radius;
      for (let seg = 0; seg < 2; seg += 1) {
        dir.x += (rng() - 0.5) * 0.35;
        dir.z += (rng() - 0.5) * 0.35;
        dir.y += (rng() - 0.15) * 0.14;
        dir.normalize();
        let next = current.clone().addScaledVector(
          dir,
          (height * 0.034) * (0.8 + rng() * 0.5),
        );
        next = avoidObstacles(next, height);
        addSegment(toLocal(current), toLocal(next), r, twigSegments);
        current = next;
        r *= 0.6;
      }
      addBlossomCluster(
        current.clone().add(new THREE.Vector3(
          (rng() - 0.5) * 0.34,
          (rng() - 0.3) * 0.28,
          (rng() - 0.5) * 0.34,
        )),
        8 + Math.floor(rng() * 5),
      );
    }
  });

  secondaryBranches.forEach((secondary) => {
    const originIndexes = [1, 2, 3];
    originIndexes.forEach((originIndex) => {
      const base = secondary.nodes[originIndex].clone();
      const parentDir = new THREE.Vector3()
        .subVectors(secondary.nodes[originIndex], secondary.nodes[Math.max(0, originIndex - 1)])
        .normalize();
      const spin = (rng() - 0.5) * 1.7;
      parentDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spin);
      parentDir.y += 0.12 + rng() * 0.22;
      parentDir.normalize();

      const length = height * (0.045 + rng() * 0.02);
      const twigNodes = [base.clone()];
      let current = base.clone();
      let currentR = Math.max(0.007, secondary.radius * 0.52);
      let segDir = parentDir.clone();
      for (let s = 0; s < 2; s += 1) {
        segDir.x += (rng() - 0.5) * 0.38;
        segDir.z += (rng() - 0.5) * 0.38;
        segDir.y += (rng() - 0.2) * 0.2;
        segDir.y = Math.max(-0.02, segDir.y);
        segDir.normalize();
        let next = current.clone().addScaledVector(
          segDir,
          (length / 2) * (0.8 + rng() * 0.45),
        );
        next = avoidObstacles(next, height);
        addSegment(
          toLocal(current),
          toLocal(next),
          currentR,
          twigSegments,
        );
        currentR *= 0.62;
        current = next;
        twigNodes.push(next.clone());
      }

      const tip = twigNodes[twigNodes.length - 1];
      const clusterCount = rng() > 0.35 ? 4 : 3;
      for (let c = 0; c < clusterCount; c += 1) {
        const center = tip.clone().add(new THREE.Vector3(
          (rng() - 0.5) * 0.42,
          (rng() - 0.4) * 0.34,
          (rng() - 0.5) * 0.42,
        ));
        addBlossomCluster(center, 12 + Math.floor(rng() * 6));
      }
    });

    // One extra cluster at the end of some secondary branches, filling gaps.
    if (true) {
      const end = secondary.nodes[secondary.nodes.length - 1];
      addBlossomCluster(
        end.clone().add(new THREE.Vector3((rng() - 0.5) * 0.34, (rng() - 0.4) * 0.24, (rng() - 0.5) * 0.34)),
        12 + Math.floor(rng() * 4),
      );
    }
  });

  function addBlossomCluster(centerWorld, count) {
    const safeCenter = avoidObstacles(centerWorld, height);
    if (cullLowNearLamp(safeCenter, tune)) return;
    count = Math.max(1, Math.round(count * density));
    anchors.push(safeCenter.clone());
    const clusterSpread = 0.3 + (height / 9.75) * 0.18;

    for (let i = 0; i < count; i += 1) {
      const theta = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng()) * clusterSpread;
      const vertical = (rng() - 0.5) * clusterSpread * 1.25;
      const local = new THREE.Vector3(
        Math.cos(theta) * radius,
        vertical,
        Math.sin(theta) * radius,
      );
      let pos = safeCenter.clone().add(local);
      pos = avoidObstacles(pos, height);

      let normal;
      const roll = rng();
      if (roll < 0.34) {
        // Hanging blooms; these face slightly down and outward.
        normal = new THREE.Vector3(
          local.x * 1.4 + (rng() - 0.5) * 0.28,
          -0.48 - rng() * 0.36,
          local.z * 1.4 + (rng() - 0.5) * 0.28,
        ).normalize();
      } else {
        normal = new THREE.Vector3(
          local.x + (rng() - 0.5) * 0.4,
          local.y * 0.6 + 0.12 + rng() * 0.3,
          local.z + (rng() - 0.5) * 0.4,
        ).normalize();
      }

      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal,
      );
      const spin = new THREE.Quaternion().setFromAxisAngle(normal, rng() * Math.PI * 2);
      quat.premultiply(spin);

      const scale = (0.24 + rng() * 0.14) * (0.82 + (height / 9.75) * 0.3);
      const matrix = new THREE.Matrix4().compose(
        toLocal(pos),
        quat,
        new THREE.Vector3(scale, scale, scale),
      );
      blossoms.push(matrix);

      const tint = new THREE.Color().setHSL(
        0.705 + rng() * 0.04,
        0.42 + rng() * 0.16,
        0.74 + rng() * 0.14,
      );
      blossomColors.push(tint);
    }
  }

  function addFrond(centerWorld) {
    const safeCenter = avoidObstacles(centerWorld, height);
    if (cullLowNearLamp(safeCenter, tune)) return;
    const theta = rng() * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const direction = radial
      .clone()
      .multiplyScalar(0.72)
      .add(new THREE.Vector3((rng() - 0.5) * 0.4, -0.35 - rng() * 0.62, (rng() - 0.5) * 0.4))
      .normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    );
    const roll = new THREE.Quaternion().setFromAxisAngle(
      direction,
      rng() * Math.PI * 2,
    );
    quat.premultiply(roll);
    const scale = (0.56 + rng() * 0.34) * (0.84 + (height / 9.75) * 0.34);
    fronds.push(
      new THREE.Matrix4().compose(
        toLocal(safeCenter),
        quat,
        new THREE.Vector3(scale, scale, scale),
      ),
    );
    frondColors.push(
      new THREE.Color().setHSL(
        0.705 + rng() * 0.045,
        0.44 + rng() * 0.17,
        0.54 + rng() * 0.14,
      ),
    );
  }

  // A dense violet foliage layer wrapped around every blossom cluster, plus
  // extra fronds along the secondary branches so the crown reads as a full
  // mass rather than isolated flower puffs.
  anchors.forEach((anchor) => {
    const count = Math.max(1, Math.round((5 + Math.floor(rng() * 2)) * density));
    for (let i = 0; i < count; i += 1) {
      const offset = new THREE.Vector3(
        (rng() - 0.5) * 0.78,
        (rng() - 0.5) * 0.62,
        (rng() - 0.5) * 0.78,
      );
      addFrond(anchor.clone().add(offset));
    }
  });
  secondaryBranches.forEach((secondary) => {
    for (let n = 0; n < secondary.nodes.length - 1; n += 1) {
      for (let k = 0; k < 2; k += 1) {
        const point = secondary.nodes[n].clone().lerp(
          secondary.nodes[n + 1],
          0.22 + rng() * 0.56,
        );
        point.x += (rng() - 0.5) * 0.5;
        point.y += (rng() - 0.5) * 0.35;
        point.z += (rng() - 0.5) * 0.5;
        if (k === 0 || rng() < density) addFrond(point);
      }
    }
  });

  // ---- Instance meshes ---------------------------------------------
  // Main branch segments are shared across every tree.
  mainSegments.forEach((segment) => {
    shared.mainMatrices.push(segment.matrix);
    branchColor.setHSL(0.055 + rng() * 0.02, 0.2 + rng() * 0.12, 0.83 + rng() * 0.12);
    shared.mainColors.push(branchColor.clone());
    shared.jointMatrices.push(
      new THREE.Matrix4().compose(
        segment.a,
        new THREE.Quaternion(),
        new THREE.Vector3(segment.radius * 1.02, segment.radius * 1.02, segment.radius * 1.02),
      ),
    );
    shared.jointColors.push(branchColor.clone());
  });
  joints.forEach((matrix) => {
    shared.jointMatrices.push(matrix);
    branchColor.setHSL(0.055 + rng() * 0.02, 0.2 + rng() * 0.12, 0.84 + rng() * 0.12);
    shared.jointColors.push(branchColor.clone());
  });

  const twigMatrices = twigSegments.map((s) => s.matrix);
  const twigMesh = new THREE.InstancedMesh(
    shared.twigGeometry,
    shared.twigMaterial,
    Math.max(1, twigMatrices.length),
  );
  twigMatrices.forEach((matrix, i) => twigMesh.setMatrixAt(i, matrix));
  twigMesh.count = twigMatrices.length;
  twigMesh.castShadow = true;
  twigMesh.receiveShadow = true;
  twigMesh.instanceMatrix.needsUpdate = true;
  twigMesh.name = `${def.id}-twigs`;

  const flowerMesh = new THREE.InstancedMesh(
    shared.blossomGeometry,
    shared.blossomMaterial,
    Math.max(1, blossoms.length),
  );
  blossoms.forEach((matrix, i) => {
    flowerMesh.setMatrixAt(i, matrix);
    flowerMesh.setColorAt(i, blossomColors[i]);
  });
  flowerMesh.count = blossoms.length;
  flowerMesh.castShadow = false;
  flowerMesh.receiveShadow = true;
  flowerMesh.instanceMatrix.needsUpdate = true;
  if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
  flowerMesh.name = `${def.id}-blossoms`;

  const leafMesh = new THREE.InstancedMesh(
    shared.frondGeometry,
    shared.foliageMaterial,
    Math.max(1, fronds.length),
  );
  fronds.forEach((matrix, i) => {
    leafMesh.setMatrixAt(i, matrix);
    leafMesh.setColorAt(i, frondColors[i]);
  });
  leafMesh.count = fronds.length;
  leafMesh.castShadow = false;
  leafMesh.receiveShadow = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  leafMesh.name = `${def.id}-foliage`;

  const pivot = new THREE.Group();
  pivot.position.set(root.x, root.y, root.z);
  pivot.name = `${def.id}-canopy`;
  pivot.add(twigMesh);
  pivot.add(leafMesh);
  pivot.add(flowerMesh);

  // Invisible click volume around the crown.
  const bounds = new THREE.Box3();
  if (anchors.length) bounds.setFromPoints(anchors);
  else bounds.setFromCenterAndSize(new THREE.Vector3(root.x, root.y + height * 0.6, root.z), new THREE.Vector3(2, 2, 2));
  const canopyCenterWorld = bounds.getCenter(new THREE.Vector3());
  canopyCenterWorld.y = Math.max(canopyCenterWorld.y, root.y + height * 0.45);
  const canopySize = bounds.getSize(new THREE.Vector3());
  const canopyRadius = Math.max(1.35, Math.max(canopySize.x, canopySize.z, canopySize.y) * 0.55);

  const proxyMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), proxyMaterial);
  proxy.position.copy(canopyCenterWorld).sub(root);
  proxy.scale.setScalar(canopyRadius);
  proxy.userData.treeIndex = index;
  proxy.name = `${def.id}-pick-volume`;
  pivot.add(proxy);

  scene.add(pivot);

  return {
    index,
    def,
    root,
    height,
    pivot,
    twigMesh,
    leafMesh,
    flowerMesh,
    leafCount: fronds.length,
    proxy,
    anchors,
    canopyCenter: canopyCenterWorld,
    canopyRadius,
    phase: rng() * Math.PI * 2,
  };
}

/* ------------------------------------------------------------------ */
/* Public build                                                        */
/* ------------------------------------------------------------------ */

export function buildTrees(scene, materials) {
  const shared = {
    mainMatrices: [],
    mainColors: [],
    jointMatrices: [],
    jointColors: [],
    twigGeometry: createTwigGeometry(),
    blossomGeometry: createBlossomGeometry(),
    frondGeometry: createFrondGeometry(),
    twigMaterial: materials.branch,
    blossomMaterial: materials.blossom,
    foliageMaterial: materials.leafFrond,
  };

  const trees = TREE_DEFS.map((def, index) => buildTree(def, index, shared, scene));

  const mainMesh = new THREE.InstancedMesh(
    createMainBranchGeometry(),
    materials.branch,
    Math.max(1, shared.mainMatrices.length),
  );
  shared.mainMatrices.forEach((matrix, i) => {
    mainMesh.setMatrixAt(i, matrix);
    mainMesh.setColorAt(i, shared.mainColors[i]);
  });
  mainMesh.count = shared.mainMatrices.length;
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  mainMesh.instanceMatrix.needsUpdate = true;
  if (mainMesh.instanceColor) mainMesh.instanceColor.needsUpdate = true;
  mainMesh.name = 'jacaranda-main-branches';
  mainMesh.frustumCulled = false;
  scene.add(mainMesh);

  // Cheap canopy shadow proxy. It is invisible in the colour pass, but gives
  // the same large soft canopy occlusion as thousands of blossom shadows at a
  // fraction of the shadow-map cost.
  const proxyMatrices = [];
  const proxyRandom = mulberry32(4127);
  const proxyCenter = new THREE.Vector3();
  const proxySize = new THREE.Vector3();
  const proxyQuat = new THREE.Quaternion();
  trees.forEach((tree) => {
    if (tree.anchors.length < 3) return;
    const bounds = new THREE.Box3().setFromPoints(tree.anchors);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const base = Math.max(0.7, Math.max(size.x, size.z) * 0.28);
    for (let i = 0; i < 6; i += 1) {
      const rx = (proxyRandom() - 0.5) * size.x * 0.55;
      const ry = (proxyRandom() - 0.5) * size.y * 0.4;
      const rz = (proxyRandom() - 0.5) * size.z * 0.55;
      proxyCenter.set(center.x + rx, center.y + ry, center.z + rz);
      proxyQuat.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        proxyRandom() * Math.PI,
      );
      const sx = base * (0.55 + proxyRandom() * 0.55);
      const sy = base * (0.4 + proxyRandom() * 0.35);
      const sz = base * (0.55 + proxyRandom() * 0.55);
      proxyMatrices.push(
        new THREE.Matrix4().compose(
          proxyCenter,
          proxyQuat,
          new THREE.Vector3(sx, sy, sz),
        ),
      );
    }
  });
  const shadowProxyMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: false,
  });
  const shadowProxy = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 4, 3),
    shadowProxyMaterial,
    Math.max(1, proxyMatrices.length),
  );
  proxyMatrices.forEach((matrix, i) => shadowProxy.setMatrixAt(i, matrix));
  shadowProxy.count = proxyMatrices.length;
  shadowProxy.castShadow = true;
  shadowProxy.receiveShadow = false;
  shadowProxy.frustumCulled = false;
  shadowProxy.name = 'canopy-shadow-proxy';
  scene.add(shadowProxy);

  const jointMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 4, 3),
    materials.branch,
    Math.max(1, shared.jointMatrices.length),
  );
  shared.jointMatrices.forEach((matrix, i) => {
    jointMesh.setMatrixAt(i, matrix);
    jointMesh.setColorAt(i, shared.jointColors[i]);
  });
  jointMesh.count = shared.jointMatrices.length;
  jointMesh.castShadow = true;
  jointMesh.receiveShadow = true;
  jointMesh.instanceMatrix.needsUpdate = true;
  if (jointMesh.instanceColor) jointMesh.instanceColor.needsUpdate = true;
  jointMesh.name = 'jacaranda-branch-joints';
  jointMesh.frustumCulled = false;
  scene.add(jointMesh);

  return {
    trees,
    mainMesh,
    jointMesh,
    shadowProxy,
    bounds: new THREE.Box3(),
  };
}

export function updateTrees(treeSystem, time) {
  treeSystem.trees.forEach((tree) => {
    const sway = Math.sin(time * 0.65 + tree.phase) * 0.0033
      + Math.sin(time * 1.47 + tree.phase * 1.9) * 0.0011;
    const lean = Math.cos(time * 0.51 + tree.phase * 0.8) * 0.0024
      + Math.sin(time * 1.12 + tree.phase) * 0.0008;
    if (tree.pivot) {
      tree.pivot.rotation.z = sway;
      tree.pivot.rotation.x = lean;
    }
  });
}
