import * as THREE from 'three';
import {
  AWNING,
  BALCONY,
  BUILDING as B,
  BUILDING_OFFSET,
  BUILDING_SCALE,
} from './config.js';
import {
  GeometryAccumulator,
  addContactShadow,
  arcPoints,
  canvasTexture,
  extrudePlan,
  flatPlan,
  makeSpokeRibbon,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* Footprint helpers                                                   */
/* ------------------------------------------------------------------ */

function footprintPoints({ xMin, xMax, zMin, zMax, radius, cx, cz }, segments = 18) {
  const pts = [[xMin, zMax], [cx, zMax]];
  arcPoints(cx, cz, radius, 0, Math.PI / 2, segments).forEach(([x, z]) => pts.push([x, z]));
  pts.push([xMax, zMin], [xMin, zMin]);
  return pts;
}

function localBox(acc, w, h, d, x, y, z, transform) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const local = new THREE.Matrix4().makeTranslation(x, y, z);
  acc.add(geometry, transform.clone().multiply(local));
  geometry.dispose();
}

function localPlane(acc, w, h, x, y, z, transform, rotation = null) {
  const geometry = new THREE.PlaneGeometry(w, h);
  const local = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  if (rotation) quat.setFromEuler(new THREE.Euler(...rotation));
  local.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(1, 1, 1));
  acc.add(geometry, transform.clone().multiply(local));
  geometry.dispose();
}

function transformFor(surface, u, bottom, rotationY) {
  const matrix = new THREE.Matrix4().makeRotationY(rotationY);
  matrix.setPosition(surface.x, bottom, surface.z);
  return matrix;
}

function cornerSurface(third, offset = 0) {
  const radius = third ? B.third.radius : B.radius;
  return new THREE.Vector3(
    B.cx + Math.sin(Math.PI / 4) * (radius + offset),
    0,
    B.cz + Math.cos(Math.PI / 4) * (radius + offset),
  );
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

function makeWindowSystem(group, materials, registerSill) {
  const trim = new GeometryAccumulator();
  const reveal = new GeometryAccumulator();
  const glass = new GeometryAccumulator();
  const warm = new GeometryAccumulator();
  const soft = new GeometryAccumulator();


  function addWindow({
    surface,
    rotationY = 0,
    bottom,
    width = 1.15,
    height = 1.95,
    style = 'sash',
    lit = true,
    header = false,
    third = false,
    storeSill = true,
  }) {
    const transform = transformFor(surface, 0, bottom, rotationY);
    const w = width;
    const h = height;
    const revealDepth = 0.012;

    // Recessed dark reveal.
    localPlane(reveal, w + 0.18, h + 0.18, 0, h / 2, revealDepth + 0.002, transform);

    // Interior glow card, just behind the glass.
    localPlane(lit ? warm : soft, w - 0.06, h - 0.06, 0, h / 2, revealDepth + 0.009, transform);

    // Glazing.
    localPlane(glass, w - 0.045, h - 0.045, 0, h / 2, 0.038, transform);

    // Perimeter casing. Two depths for a stepped, historical reveal.
    const frameW = third ? 0.115 : 0.09;
    const zCase = 0.055;
    localBox(trim, frameW, h + 0.22, 0.11, -(w / 2 + frameW / 2), h / 2, zCase, transform);
    localBox(trim, frameW, h + 0.22, 0.11, w / 2 + frameW / 2, h / 2, zCase, transform);
    localBox(trim, w + frameW * 2 + 0.06, frameW, 0.12, 0, h + 0.06, zCase + 0.012, transform);
    localBox(trim, w + frameW * 2 + 0.02, frameW, 0.12, 0, -0.055, zCase + 0.012, transform);

    // Inner glazing bead / muntins.
    const bar = 0.034;
    const barZ = 0.063;
    localBox(trim, bar, h - 0.07, 0.04, 0, h / 2, barZ, transform);
    const rows = style === 'tall' ? 4 : style === 'balcony-door' ? 3 : 2;
    for (let r = 1; r < rows; r += 1) {
      const y = (h * r) / rows;
      localBox(trim, w - 0.02, bar, 0.04, 0, y, barZ, transform);
    }

    if (style === 'balcony-door') {
      // Cream panelled base with two slim, recessed fields. The outline is
      // drawn with thin shadow reveals instead of a large black plate.
      localBox(trim, w - 0.12, 0.96, 0.06, 0, 0.61, 0.066, transform);
      localBox(trim, w - 0.12, 0.055, 0.07, 0, 1.07, 0.068, transform);
      localBox(trim, w - 0.12, 0.055, 0.07, 0, 0.16, 0.068, transform);
      for (const side of [-1, 1]) {
        const fieldW = w / 2 - 0.22;
        const fieldH = 0.64;
        const cx = side * (w / 4);
        const cy = 0.62;
        const line = 0.012;
        localBox(reveal, fieldW, line, 0.012, cx, cy + fieldH / 2, 0.1, transform);
        localBox(reveal, fieldW, line, 0.012, cx, cy - fieldH / 2, 0.1, transform);
        localBox(reveal, line, fieldH, 0.012, cx - fieldW / 2, cy, 0.1, transform);
        localBox(reveal, line, fieldH, 0.012, cx + fieldW / 2, cy, 0.1, transform);
      }
    }

    // Sill and optional small hood.
    localBox(trim, w + 0.34, 0.095, 0.24, 0, -0.12, 0.105, transform);
    if (third) {
      localBox(trim, w + 0.5, 0.07, 0.28, 0, -0.19, 0.115, transform);
      localBox(trim, w + 0.5, 0.075, 0.18, 0, h + 0.19, 0.08, transform);
      // Independent window surround: an extra proud frame.
      localBox(trim, 0.07, h + 0.5, 0.16, -(w / 2 + 0.19), h / 2 + 0.04, 0.075, transform);
      localBox(trim, 0.07, h + 0.5, 0.16, w / 2 + 0.19, h / 2 + 0.04, 0.075, transform);
    } else if (header) {
      localBox(trim, w + 0.44, 0.1, 0.19, 0, h + 0.19, 0.09, transform);
    }

    if (storeSill) {
      const local = new THREE.Vector3(0, -0.07, 0.105);
      local.applyMatrix4(transform);
      registerSill({
        position: local,
        width: w + 0.32,
        depth: 0.23,
        rotationY,
      });
    }
  }

  return {
    addWindow,
    finish(parent) {
      const trimGeometry = trim.build();
      const revealGeometry = reveal.build();
      const glassGeometry = glass.build();
      const warmGeometry = warm.build();
      const softGeometry = soft.build();

      const trimMesh = new THREE.Mesh(trimGeometry, materials.trim);
      trimMesh.castShadow = true;
      trimMesh.receiveShadow = true;
      trimMesh.name = 'window-trim';
      parent.add(trimMesh);

      const revealMesh = new THREE.Mesh(revealGeometry, materials.windowReveal);
      revealMesh.receiveShadow = true;
      revealMesh.name = 'window-reveal';
      parent.add(revealMesh);

      const glassMesh = new THREE.Mesh(glassGeometry, materials.glass);
      glassMesh.name = 'window-glass';
      glassMesh.renderOrder = 2;
      parent.add(glassMesh);

      const warmMesh = new THREE.Mesh(warmGeometry, materials.windowGlow);
      warmMesh.name = 'window-glow';
      parent.add(warmMesh);

      const softMesh = new THREE.Mesh(softGeometry, materials.windowGlowSoft);
      softMesh.name = 'window-glow-soft';
      parent.add(softMesh);

      return {
        trimMesh,
        revealMesh,
        glassMesh,
        warmMesh,
        softMesh,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Door                                                                */
/* ------------------------------------------------------------------ */

function addEntrance(group, materials, registerSurface) {
  const angle = Math.PI / 4;
  const radius = B.radius + 0.36;
  const position = new THREE.Vector3(
    B.cx + Math.sin(angle) * radius,
    B.baseY,
    B.cz + Math.cos(angle) * radius,
  );
  const door = new THREE.Group();
  door.position.copy(position);
  door.rotation.y = angle;
  door.name = 'corner-entrance';
  group.add(door);

  const trim = materials.trim;
  const trimWarm = materials.trimWarm;
  const stone = materials.stoneLight;
  const revealMat = materials.windowReveal;

  const addBox = (w, h, d, x, y, z, mat = trim, radiusSegments = 0) => {
    const geometry = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    door.add(mesh);
    return mesh;
  };

  // Deep portal shadow.
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 2.92), revealMat);
  portal.position.set(0, 1.47, 0.018);
  door.add(portal);

  // The door group sits slightly proud of the curved corner. These short
  // stone returns close the projecting portal back to the arc wall.
  addBox(0.2, 2.98, 0.48, -1.08, 1.49, -0.22, stone);
  addBox(0.2, 2.98, 0.48, 1.08, 1.49, -0.22, stone);
  addBox(2.36, 0.22, 0.48, 0, 2.88, -0.22, stone);

  // Classical stone surround.
  addBox(0.22, 2.95, 0.14, -1.03, 1.48, 0.07, stone);
  addBox(0.22, 2.95, 0.14, 1.03, 1.48, 0.07, stone);
  addBox(2.38, 0.2, 0.2, 0, 2.83, 0.09, trimWarm);
  addBox(2.5, 0.1, 0.28, 0, 2.96, 0.12, trim);
  addBox(2.34, 0.07, 0.22, 0, 2.72, 0.11, trim);

  // Transom.
  const transomGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.43), materials.windowGlow);
  transomGlow.position.set(0, 2.49, 0.075);
  door.add(transomGlow);
  const transomGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.43), materials.glass);
  transomGlass.position.set(0, 2.49, 0.152);
  transomGlass.renderOrder = 2;
  door.add(transomGlass);
  addBox(1.74, 0.08, 0.1, 0, 2.24, 0.17);
  addBox(1.74, 0.08, 0.1, 0, 2.71, 0.17);
  addBox(0.06, 0.5, 0.07, 0, 2.49, 0.17);
  addBox(0.06, 0.5, 0.07, -0.56, 2.49, 0.17);
  addBox(0.06, 0.5, 0.07, 0.56, 2.49, 0.17);

  // Door leaves. One pair, each with a slender glazed top and panelled base.
  const leafW = 0.72;
  const leafH = 2.2;
  for (const side of [-1, 1]) {
    const cx = side * (leafW / 2 + 0.012);
    addBox(leafW, leafH, 0.075, cx, 1.15, 0.115, trim);
    addBox(leafW - 0.14, 0.11, 0.05, cx, 0.08, 0.155, trimWarm);
    addBox(leafW - 0.12, 0.58, 0.045, cx, 0.82, 0.156, trimWarm);

    // Recessed lower panel shadow and its proud panel.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.2, 0.41), revealMat);
    shadow.position.set(cx, 0.8, 0.182);
    door.add(shadow);
    addBox(leafW - 0.28, 0.3, 0.025, cx, 0.8, 0.205, trimWarm);

    // Upper glazing in each leaf.
    const upperGlow = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.2, 0.64), materials.windowGlow);
    upperGlow.position.set(cx, 1.62, 0.16);
    door.add(upperGlow);
    const upperGlass = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.2, 0.64), materials.glass);
    upperGlass.position.set(cx, 1.62, 0.195);
    upperGlass.renderOrder = 2;
    door.add(upperGlass);
    addBox(leafW - 0.12, 0.055, 0.04, cx, 1.28, 0.19, trim);
    addBox(leafW - 0.12, 0.055, 0.04, cx, 1.96, 0.19, trim);
    addBox(0.045, 0.68, 0.04, cx, 1.62, 0.195, trim);

    // Meeting stiles and door pull.
    addBox(0.055, leafH, 0.095, cx + side * (leafW / 2 - 0.027), 1.15, 0.145, trim);
    if (side === 1) {
      const handlePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.014, 12), materials.brass);
      handlePlate.rotation.x = Math.PI / 2;
      handlePlate.position.set(cx - 0.18, 1.14, 0.235);
      handlePlate.castShadow = true;
      door.add(handlePlate);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 8), materials.brass);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(cx - 0.27, 1.14, 0.26);
      handle.castShadow = true;
      door.add(handle);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), materials.brass);
      knob.position.set(cx - 0.37, 1.14, 0.26);
      knob.castShadow = true;
      door.add(knob);
    }
  }

  // Threshold and step.
  addBox(2.18, 0.08, 0.34, 0, 0.04, 0.2, stone);
  addBox(2.38, 0.06, 0.56, 0, 0.012, 0.34, stone);
  addBox(2.48, 0.035, 0.7, 0, -0.005, 0.43, materials.stone);

  // Number plaque above the door.
  const plaqueTexture = canvasTexture(
    160,
    80,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#e8ddc4';
      ctx.beginPath();
      ctx.roundRect(2, 2, w - 4, h - 4, 12);
      ctx.fill();
      ctx.strokeStyle = '#a68b61';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#4e4338';
      ctx.font = '600 46px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('17', w / 2, h / 2 + 2);
    },
    { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping },
  );
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.21),
    new THREE.MeshBasicMaterial({ map: plaqueTexture, transparent: true, toneMapped: false }),
  );
  plaque.position.set(0.73, 2.83, 0.205);
  door.add(plaque);

  // Wall lights either side of the portal.
  const entryLightAnchors = [];
  for (const side of [-1, 1]) {
    const lantern = new THREE.Group();
    lantern.position.set(side * 1.19, 1.85, 0.14);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.06), materials.iron);
    plate.position.z = 0.01;
    plate.castShadow = true;
    lantern.add(plate);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), materials.iron);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, 0.1, 0.12);
    lantern.add(arm);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 0.28, 6), materials.lampGlass);
    cage.position.set(0, 0.02, 0.23);
    lantern.add(cage);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.13, 6), materials.iron);
    cap.position.set(0, 0.21, 0.23);
    cap.castShadow = true;
    lantern.add(cap);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.045, 6), materials.iron);
    bottom.position.set(0, -0.14, 0.23);
    lantern.add(bottom);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), materials.bulb);
    bulb.position.set(0, 0.02, 0.23);
    lantern.add(bulb);
    door.add(lantern);
    entryLightAnchors.push(new THREE.Vector3(side * 1.19, 1.85, 0.36));
  }

  // Awning pendant lights get their own small brass and glass fixtures.
  door.updateMatrixWorld(true);
  const worldEntryLights = entryLightAnchors.map((v) => {
    const p = v.clone();
    door.localToWorld(p);
    return p;
  });

  // A small brass mat just outside the door.
  addBox(1.55, 0.025, 0.72, 0, 0.055, 0.54, materials.brass);

  registerSurface({
    position: new THREE.Vector3(0, 0.31, 0.15).applyMatrix4(door.matrixWorld),
    width: 1.5,
    depth: 0.28,
    rotationY: angle,
    kind: 'threshold',
  });

  return {
    group: door,
    entryLights: worldEntryLights,
    position,
  };
}

/* ------------------------------------------------------------------ */
/* Balcony                                                             */
/* ------------------------------------------------------------------ */

function buildBalcony(group, materials, surfaces) {
  const depth = BALCONY.depth;
  const slabTop = BALCONY.topY;
  const outerFront = B.zMax + depth;
  const outerRight = B.xMax + depth;
  const outerRadius = B.radius + depth;

  const outer = [[BALCONY.startX, outerFront]];
  arcPoints(B.cx, B.cz, outerRadius, 0, Math.PI / 2, 18).forEach(([x, z]) => outer.push([x, z]));
  outer.push([outerRight, BALCONY.endZ]);

  const inner = [];
  inner.push([B.xMax, BALCONY.endZ]);
  inner.push([B.xMax, B.cz]);
  arcPoints(B.cx, B.cz, B.radius, Math.PI / 2, 0, 18).forEach(([x, z]) => inner.push([x, z]));
  inner.push([BALCONY.startX, B.zMax]);
  const slabPoints = [...outer, ...inner];
  // Thin floor only. The old 0.17-thick balcony base collided with the
  // first cornice below and produced a persistent flicker above the entrance.
  const slabGeometry = extrudePlan(slabPoints, 0.055, slabTop - 0.055, { curveSegments: 18 });
  const slabMaterial = materials.stoneLight.clone();
  slabMaterial.side = THREE.DoubleSide;
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.castShadow = true;
  slab.receiveShadow = true;
  slab.name = 'balcony-slab';
  group.add(slab);

  // ---- Railing path -------------------------------------------------
  const railOffset = 0.055;
  const railRadius = outerRadius - railOffset;
  const railZFront = outerFront - railOffset;
  const railXRight = outerRight - railOffset;
  const railStartX = BALCONY.startX + 0.03;
  const railPoints = [
    [railStartX, railZFront],
    [BALCONY.startX + (B.cx - BALCONY.startX) * 0.55, railZFront],
    ...arcPoints(B.cx, B.cz, railRadius, 0, Math.PI / 2, 20),
    [railXRight, B.cz],
    [railXRight, (B.cz + BALCONY.endZ) * 0.5],
    [railXRight, BALCONY.endZ + 0.06],
  ];

  const railCurve = new THREE.CatmullRomCurve3(
    railPoints.map(([x, z]) => new THREE.Vector3(x, slabTop, z)),
    false,
    'centripetal',
    0.2,
  );

  const iron = materials.iron;
  const handrail = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        railPoints.map(([x, z]) => new THREE.Vector3(x, BALCONY.railTopY, z)),
        false,
        'centripetal',
        0.2,
      ),
      120,
      0.042,
      6,
      false,
    ),
    iron,
  );
  handrail.castShadow = true;
  group.add(handrail);

  const lowerRail = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        railPoints.map(([x, z]) => new THREE.Vector3(x, slabTop + 0.16, z)),
        false,
        'centripetal',
        0.2,
      ),
      120,
      0.022,
      5,
      false,
    ),
    iron,
  );
  lowerRail.castShadow = true;
  group.add(lowerRail);

  // ---- Balusters ----------------------------------------------------
  const balusterGeometry = new THREE.CylinderGeometry(0.017, 0.022, 1, 6);
  const postBottom = slabTop + 0.008;
  const postTop = BALCONY.railTopY - 0.04;
  const postHeight = postTop - postBottom;
  const railingLength = railCurve.getLength();
  const postCount = Math.max(8, Math.floor(railingLength / 0.28));
  const postMatrices = [];
  for (let i = 0; i <= postCount; i += 1) {
    const t = i / postCount;
    const point = railCurve.getPointAt(t);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(point.x, (postBottom + postTop) / 2, point.z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, postHeight, 1),
    );
    postMatrices.push(matrix);
  }
  const balusters = new THREE.InstancedMesh(balusterGeometry, iron, postMatrices.length);
  postMatrices.forEach((matrix, i) => balusters.setMatrixAt(i, matrix));
  balusters.castShadow = true;
  balusters.receiveShadow = true;
  balusters.name = 'balcony-balusters';
  group.add(balusters);

  // Heavy end newels + finials.
  const newelGeometry = new THREE.CylinderGeometry(0.045, 0.055, 1, 8);
  const newelMatrices = [];
  const finialMatrices = [];
  [0, 1].forEach((t) => {
    const p = railCurve.getPointAt(t);
    newelMatrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, (postBottom + BALCONY.railTopY + 0.04) / 2, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, BALCONY.railTopY + 0.04 - postBottom, 1),
      ),
    );
    finialMatrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(p.x, BALCONY.railTopY + 0.07, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      ),
    );
  });
  const newels = new THREE.InstancedMesh(newelGeometry, iron, newelMatrices.length);
  newelMatrices.forEach((matrix, i) => newels.setMatrixAt(i, matrix));
  newels.castShadow = true;
  group.add(newels);

  const finials = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), iron, finialMatrices.length);
  finialMatrices.forEach((matrix, i) => finials.setMatrixAt(i, matrix));
  finials.castShadow = true;
  group.add(finials);

  // ---- Scrollwork ---------------------------------------------------
  const scrollCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.02, 0),
    new THREE.Vector3(-0.1, 0.15, 0),
    new THREE.Vector3(0.02, 0.22, 0),
    new THREE.Vector3(0.13, 0.16, 0),
    new THREE.Vector3(0.16, 0.04, 0),
    new THREE.Vector3(0.07, -0.035, 0),
    new THREE.Vector3(-0.03, 0.0, 0),
    new THREE.Vector3(-0.03, 0.12, 0),
    new THREE.Vector3(0.05, 0.18, 0),
    new THREE.Vector3(0.12, 0.24, 0),
  ]);
  const scrollGeometry = new THREE.TubeGeometry(scrollCurve, 34, 0.012, 4, false);
  const scrollMaterial = iron.clone();
  scrollMaterial.side = THREE.DoubleSide;
  const scrollMatrices = [];
  const scrollSpacing = 2;
  for (let i = 1; i < postMatrices.length - 1; i += scrollSpacing) {
    const t = i / postMatrices.length;
    const point = railCurve.getPointAt(t);
    const tangent = railCurve.getTangentAt(t);
    tangent.y = 0;
    tangent.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const basis = new THREE.Matrix4().makeBasis(tangent, up, normal);
    const place = new THREE.Vector3(point.x, slabTop + 0.52, point.z);
    const mirrored = basis.clone().multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    const direct = basis.clone();

    [mirrored, direct].forEach((matrix) => {
      const m = matrix.clone();
      m.setPosition(place);
      scrollMatrices.push(m);
    });
  }
  const scrollwork = new THREE.InstancedMesh(scrollGeometry, scrollMaterial, scrollMatrices.length);
  scrollMatrices.forEach((matrix, i) => scrollwork.setMatrixAt(i, matrix));
  scrollwork.castShadow = true;
  scrollwork.name = 'balcony-scrollwork';
  group.add(scrollwork);

  // Flower petals can settle on the balcony floor.
  for (let i = 0; i < 22; i += 1) {
    const t = (i + 0.5) / 22;
    const p = railCurve.getPointAt(Math.min(t, 0.985));
    const tangent = railCurve.getTangentAt(Math.min(t, 0.985));
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const off = -0.16 - (i % 4) * 0.11;
    surfaces.push({
      position: new THREE.Vector3(p.x + normal.x * off, slabTop + 0.012, p.z + normal.z * off),
      width: 0.7,
      depth: 0.5,
      rotationY: Math.atan2(normal.x, normal.z),
      kind: 'balcony',
    });
  }

  return {
    slab,
    railCurve,
    slabTop,
  };
}

/* ------------------------------------------------------------------ */
/* Corrugated awning                                                   */
/* ------------------------------------------------------------------ */

function buildAwning(group, materials, surfaces, lights) {
  const depth = AWNING.depth;
  const wallZ = B.zMax;
  const wallX = B.xMax;

  const basePath = [[AWNING.startX, wallZ], [B.cx, wallZ]];
  arcPoints(B.cx, B.cz, B.radius, 0, Math.PI / 2, 24).forEach(([x, z]) => basePath.push([x, z]));
  basePath.push([wallX, AWNING.endZ]);

  // Remove duplicate points where the arc meets the side wall.
  const path = [];
  basePath.forEach((p) => {
    const prev = path[path.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.001) path.push(p);
  });

  // Densify the contour by arc length, and derive its outward normal.
  const raw = [];
  let total = 0;
  for (let i = 0; i < path.length; i += 1) {
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    raw.push({ x: a[0], z: a[1], t: total });
    total += dist;
  }
  const samples = 150;
  const sampled = [];
  let cursor = 0;
  for (let i = 0; i <= samples; i += 1) {
    const target = (i / samples) * total;
    while (cursor < raw.length - 2 && raw[cursor + 1].t < target) cursor += 1;
    const a = raw[cursor];
    const b = raw[Math.min(cursor + 1, raw.length - 1)];
    const span = Math.max(1e-5, b.t - a.t);
    const k = THREE.MathUtils.clamp((target - a.t) / span, 0, 1);
    const x = THREE.MathUtils.lerp(a.x, b.x, k);
    const z = THREE.MathUtils.lerp(a.z, b.z, k);

    const t0 = raw[Math.max(0, cursor - 1)];
    const t1 = raw[Math.min(raw.length - 1, cursor + 2)];
    let tx = t1.x - t0.x;
    let tz = t1.z - t0.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    sampled.push({
      x,
      z,
      nx: -tz,
      nz: tx,
      s: target,
    });
  }

  const across = 5;
  const positions = [];
  const uvs = [];
  const indices = [];
  const outerEdge = [];
  const outerCurve = [];

  function awningPoint(sample, v) {
    const corrugation = Math.sin((sample.s / 0.36) * Math.PI * 2) * 0.026 * (0.25 + v * 0.75);
    return new THREE.Vector3(
      sample.x + sample.nx * depth * v,
      AWNING.wallY - (AWNING.wallY - AWNING.eaveY) * v + corrugation,
      sample.z + sample.nz * depth * v,
    );
  }

  sampled.forEach((sample, i) => {
    for (let j = 0; j < across; j += 1) {
      const v = j / (across - 1);
      const p = awningPoint(sample, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / samples, v);
      if (j === across - 1) outerEdge.push(p);
      if (i === 0) outerCurve.push(p);
    }
  });
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < across - 1; j += 1) {
      const a = i * across + j;
      const b = a + across;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const awningGeometry = new THREE.BufferGeometry();
  awningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  awningGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  awningGeometry.setIndex(indices);
  awningGeometry.computeVertexNormals();

  const awningMaterial = materials.awningMetal.clone();
  awningMaterial.side = THREE.DoubleSide;
  awningMaterial.flatShading = false;
  const awning = new THREE.Mesh(awningGeometry, awningMaterial);
  awning.castShadow = true;
  awning.receiveShadow = true;
  awning.name = 'corrugated-awning';
  group.add(awning);

  // Eave fascia ribbon.
  const fasciaPositions = [];
  const fasciaIndices = [];
  outerEdge.forEach((p) => {
    fasciaPositions.push(p.x, p.y + 0.012, p.z, p.x, p.y - 0.17, p.z);
  });
  for (let i = 0; i < outerEdge.length - 1; i += 1) {
    const a = i * 2;
    fasciaIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const fasciaGeo = new THREE.BufferGeometry();
  fasciaGeo.setAttribute('position', new THREE.Float32BufferAttribute(fasciaPositions, 3));
  fasciaGeo.setIndex(fasciaIndices);
  fasciaGeo.computeVertexNormals();
  const fascia = new THREE.Mesh(fasciaGeo, materials.awningTrim.clone());
  fascia.material.side = THREE.DoubleSide;
  fascia.castShadow = true;
  group.add(fascia);

  // Round eave trim.
  const eaveCurve = new THREE.CatmullRomCurve3(
    outerEdge.map((p) => new THREE.Vector3(p.x, p.y + 0.005, p.z)),
    false,
    'centripetal',
    0.2,
  );
  const eaveTrim = new THREE.Mesh(
    new THREE.TubeGeometry(eaveCurve, 120, 0.026, 5, false),
    materials.awningTrim,
  );
  eaveTrim.castShadow = true;
  group.add(eaveTrim);

  // Angled supports, made from slim iron rods.
  const supportAccumulator = new GeometryAccumulator();
  const supportSamples = [0.06, 0.29, 0.52, 0.75, 0.94];
  supportSamples.forEach((t) => {
    const sample = sampled[Math.round(t * (sampled.length - 1))];
    const wallPoint = awningPoint(sample, 0.03);
    wallPoint.y -= 0.9;
    const eavePoint = awningPoint(sample, 0.98);
    const mid = wallPoint.clone().lerp(eavePoint, 0.5);
    const len = wallPoint.distanceTo(eavePoint);
    const dir = new THREE.Vector3().subVectors(eavePoint, wallPoint).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    supportAccumulator.add(
      new THREE.CylinderGeometry(0.022, 0.03, len, 6),
      new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1)),
    );
    // Small wall plate.
    supportAccumulator.add(
      new THREE.BoxGeometry(0.12, 0.14, 0.05),
      new THREE.Matrix4().makeTranslation(wallPoint.x, wallPoint.y, wallPoint.z),
    );
  });
  const supports = new THREE.Mesh(supportAccumulator.build(), materials.iron);
  supports.castShadow = true;
  group.add(supports);

  // Two small hanging lamps beneath the awning.
  const pendantSamples = [0.26, 0.65, 0.88];
  const pendantLights = [];
  pendantSamples.forEach((t, index) => {
    const sample = sampled[Math.round(t * (sampled.length - 1))];
    const base = awningPoint(sample, 0.58);
    const fixture = new THREE.Group();
    fixture.position.copy(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), materials.iron);
    stem.position.y = -0.075;
    fixture.add(stem);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 8, 1, true), materials.iron);
    shade.position.y = -0.17;
    fixture.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), materials.bulb);
    bulb.position.y = -0.22;
    fixture.add(bulb);
    const glow = new THREE.Sprite(materials.glowSprite);
    glow.position.set(0, -0.21, 0);
    glow.scale.set(0.65, 0.65, 1);
    glow.material = materials.glowSprite;
    fixture.add(glow);
    group.add(fixture);
    pendantLights.push(new THREE.Vector3(base.x, base.y - 0.28, base.z));
    lights.push({ position: new THREE.Vector3(base.x, base.y - 0.24, base.z), kind: 'awning', index });
  });

  // Fallen petals on the corrugated top.
  for (let i = 0; i < 34; i += 1) {
    const s = sampled[Math.round(((i * 37) % 100) / 100 * (sampled.length - 1))];
    const v = 0.16 + (((i * 53) % 71) / 71) * 0.76;
    const p = awningPoint(s, v);
    surfaces.push({
      position: new THREE.Vector3(p.x, p.y + 0.012, p.z),
      width: 0.5,
      depth: 0.4,
      rotationY: Math.atan2(s.nx, s.nz),
      kind: 'awning',
    });
  }

  return {
    awning,
    pendantLights,
  };
}

/* ------------------------------------------------------------------ */
/* Cornices, walls, parapet                                            */
/* ------------------------------------------------------------------ */

function addWallBox(parent, geometryMaterial, w, h, d, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), geometryMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCornice(parent, materials, { y, height, protrude, footprint = B }) {
  const fp = footprint;
  const mat = materials.trimWarm;
  const w = fp.xMax - fp.xMin;
  const d = fp.zMax - fp.zMin;
  const thick = 0.16;
  const group = new THREE.Group();
  group.position.y = y;
  parent.add(group);

  // Front and back ledges.
  addWallBox(
    group,
    mat,
    (fp.cx - fp.xMin) + protrude * 2 + 0.2,
    height,
    thick + protrude * 2,
    (fp.xMin + fp.cx) / 2,
    height / 2,
    fp.zMax - thick / 2 + protrude,
  );
  addWallBox(
    group,
    mat,
    w + protrude * 2,
    height,
    thick + protrude * 2,
    (fp.xMin + fp.xMax) / 2,
    height / 2,
    fp.zMin + thick / 2 - protrude,
  );
  // Left and right ledges.
  addWallBox(
    group,
    mat,
    thick + protrude * 2,
    height,
    d + protrude * 2,
    fp.xMin + thick / 2 - protrude,
    height / 2,
    (fp.zMin + fp.zMax) / 2,
  );
  addWallBox(
    group,
    mat,
    thick + protrude * 2,
    height,
    (fp.cz - fp.zMin) + protrude * 2 + 0.2,
    fp.xMax - thick / 2 + protrude,
    height / 2,
    (fp.zMin + fp.cz) / 2,
  );

  // Curved corner band.
  const radius = fp.radius + protrude;
  const arc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 36, 1, true, 0, Math.PI / 2),
    mat,
  );
  arc.position.set(fp.cx, height / 2, fp.cz);
  arc.castShadow = true;
  arc.receiveShadow = true;
  group.add(arc);

  // A dark shadow line under the ledge.
  const shadeGroup = new THREE.Group();
  shadeGroup.position.y = -0.018;
  const shadeMat = materials.stoneDark;
  addWallBox(
    shadeGroup,
    shadeMat,
    (fp.cx - fp.xMin) + protrude * 1.5,
    0.032,
    0.045,
    (fp.xMin + fp.cx) / 2,
    0,
    fp.zMax + protrude * 0.2,
    false,
  );
  addWallBox(
    shadeGroup,
    shadeMat,
    0.045,
    0.032,
    (fp.cz - fp.zMin) + protrude * 1.5,
    fp.xMax + protrude * 0.2,
    0,
    (fp.zMin + fp.cz) / 2,
    false,
  );
  group.add(shadeGroup);
  return group;
}

function addParapet(parent, materials) {
  const t = B.third;
  const mat = materials.wallCreamUpper;
  const capMat = materials.trim;
  const h = B.parapetTop - B.thirdTop;
  const thickness = 0.16;
  const group = new THREE.Group();
  group.position.y = B.thirdTop;
  parent.add(group);

  addWallBox(group, mat, (t.cx - t.xMin) + 0.2, h, thickness, (t.xMin + t.cx) / 2, h / 2, t.zMax - thickness / 2);
  addWallBox(group, mat, (t.xMin - t.xMin) + (t.xMax - t.xMin), h, thickness, (t.xMin + t.xMax) / 2, h / 2, t.zMin + thickness / 2);
  addWallBox(group, mat, thickness, h, (t.zMax - t.zMin) + 0.2, t.xMin + thickness / 2, h / 2, (t.zMin + t.zMax) / 2);
  addWallBox(group, mat, thickness, h, (t.cz - t.zMin) + 0.2, t.xMax - thickness / 2, h / 2, (t.zMin + t.cz) / 2);

  const arc = new THREE.Mesh(
    new THREE.CylinderGeometry(t.radius, t.radius, h, 32, 1, true, 0, Math.PI / 2),
    mat,
  );
  arc.position.set(t.cx, h / 2, t.cz);
  arc.castShadow = true;
  arc.receiveShadow = true;
  group.add(arc);

  // Smooth pale capping stone.
  const capHeight = 0.075;
  addWallBox(group, capMat, (t.cx - t.xMin) + 0.24, capHeight, thickness + 0.1, (t.xMin + t.cx) / 2, h + capHeight / 2, t.zMax - thickness / 2);
  addWallBox(group, capMat, (t.xMax - t.xMin) + 0.24, capHeight, thickness + 0.1, (t.xMin + t.xMax) / 2, h + capHeight / 2, t.zMin + thickness / 2);
  addWallBox(group, capMat, thickness + 0.1, capHeight, (t.zMax - t.zMin) + 0.24, t.xMin + thickness / 2, h + capHeight / 2, (t.zMin + t.zMax) / 2);
  addWallBox(group, capMat, thickness + 0.1, capHeight, (t.cz - t.zMin) + 0.24, t.xMax - thickness / 2, h + capHeight / 2, (t.zMin + t.cz) / 2);
  const capArc = new THREE.Mesh(
    new THREE.CylinderGeometry(t.radius + 0.05, t.radius + 0.05, capHeight, 32, 1, true, 0, Math.PI / 2),
    capMat,
  );
  capArc.position.set(t.cx, h + capHeight / 2, t.cz);
  capArc.castShadow = true;
  group.add(capArc);

  return group;
}

/* ------------------------------------------------------------------ */
/* Main build                                                          */
/* ------------------------------------------------------------------ */

export function buildBuilding(scene, materials) {
  const group = new THREE.Group();
  group.name = 'historic-corner-building';
  scene.add(group);

  const sillSurfaces = [];
  const surfacePoints = [];
  const awningLights = [];
  const windowSystem = makeWindowSystem(group, materials, (sill) => sillSurfaces.push(sill));

  const wallHeight = B.thirdBase - B.baseY;
  const wallY = B.baseY + wallHeight / 2;
  const wallMat = materials.wallCream;

  // Main volume up to the second cornice.
  addWallBox(group, wallMat, B.cx - B.xMin, wallHeight, 0.34, (B.xMin + B.cx) / 2, wallY, B.zMax - 0.17);
  addWallBox(group, wallMat, 0.34, wallHeight, B.cz - B.zMin, B.xMax - 0.17, wallY, (B.zMin + B.cz) / 2);
  addWallBox(group, wallMat, B.xMax - B.xMin, wallHeight, 0.34, (B.xMin + B.xMax) / 2, wallY, B.zMin + 0.17);
  addWallBox(group, wallMat, 0.34, wallHeight, B.zMax - B.zMin, B.xMin + 0.17, wallY, (B.zMin + B.zMax) / 2);
  const mainArc = new THREE.Mesh(
    new THREE.CylinderGeometry(B.radius, B.radius, wallHeight, 36, 1, true, 0, Math.PI / 2),
    wallMat,
  );
  mainArc.position.set(B.cx, wallY, B.cz);
  mainArc.castShadow = true;
  mainArc.receiveShadow = true;
  group.add(mainArc);

  // Stone base course. Give the four flat faces the same 0.04 outward
  // relief as the curved plinth arc (radius + 0.04). Without this, the flat
  // face of each plinth box is exactly coplanar with the main wall face and
  // z-fights from low camera angles. Only the four flat plinth boxes move;
  // walls, arc, steps, ground and shadows stay untouched.
  const plinthHeight = B.plinthTop - B.baseY;
  const plinthY = B.baseY + plinthHeight / 2;
  const plinthMat = materials.plinth;
  const plinthRelief = 0.04;
  addWallBox(group, plinthMat, B.cx - B.xMin + 0.08, plinthHeight, 0.4, (B.xMin + B.cx) / 2, plinthY, B.zMax - 0.2 + plinthRelief);
  addWallBox(group, plinthMat, 0.4, plinthHeight, B.cz - B.zMin + 0.08, B.xMax - 0.2 + plinthRelief, plinthY, (B.zMin + B.cz) / 2);
  addWallBox(group, plinthMat, B.xMax - B.xMin + 0.08, plinthHeight, 0.4, (B.xMin + B.xMax) / 2, plinthY, B.zMin + 0.2 - plinthRelief);
  addWallBox(group, plinthMat, 0.4, plinthHeight, B.zMax - B.zMin + 0.08, B.xMin + 0.2 - plinthRelief, plinthY, (B.zMin + B.zMax) / 2);
  const plinthArc = new THREE.Mesh(
    new THREE.CylinderGeometry(B.radius + 0.04, B.radius + 0.04, plinthHeight, 36, 1, true, 0, Math.PI / 2),
    plinthMat,
  );
  plinthArc.position.set(B.cx, plinthY, B.cz);
  plinthArc.castShadow = true;
  plinthArc.receiveShadow = true;
  group.add(plinthArc);

  // A slim shadow reveal at the top of the plinth.
  addCornice(group, materials, { y: 0.78, height: 0.035, protrude: 0.02 });
  addCornice(group, materials, { y: B.firstCornice, height: 0.16, protrude: 0.18 });
  addCornice(group, materials, { y: B.secondCornice, height: 0.18, protrude: 0.22 });

  // Setback floor ledge above the second cornice.
  addWallBox(group, materials.roof, (B.xMax - B.xMin) - 0.02, 0.08, (B.zMax - B.zMin) - 0.02, (B.xMin + B.xMax) / 2, B.thirdBase - 0.04, (B.zMin + B.zMax) / 2);
  const ledge = new THREE.Mesh(flatPlan(footprintPoints(B), 6.31), materials.roof);
  ledge.receiveShadow = true;
  group.add(ledge);

  // Third floor, set back and slightly narrower.
  const t = B.third;
  const thirdHeight = B.thirdTop - B.thirdBase;
  const thirdY = B.thirdBase + thirdHeight / 2;
  addWallBox(group, materials.wallCreamUpper, t.cx - t.xMin, thirdHeight, 0.32, (t.xMin + t.cx) / 2, thirdY, t.zMax - 0.16);
  addWallBox(group, materials.wallCreamUpper, 0.32, thirdHeight, t.cz - t.zMin, t.xMax - 0.16, thirdY, (t.zMin + t.cz) / 2);
  addWallBox(group, materials.wallCreamUpper, t.xMax - t.xMin, thirdHeight, 0.32, (t.xMin + t.xMax) / 2, thirdY, t.zMin + 0.16);
  addWallBox(group, materials.wallCreamUpper, 0.32, thirdHeight, t.zMax - t.zMin, t.xMin + 0.16, thirdY, (t.zMin + t.zMax) / 2);
  const thirdArc = new THREE.Mesh(
    new THREE.CylinderGeometry(t.radius, t.radius, thirdHeight, 34, 1, true, 0, Math.PI / 2),
    materials.wallCreamUpper,
  );
  thirdArc.position.set(t.cx, thirdY, t.cz);
  thirdArc.castShadow = true;
  thirdArc.receiveShadow = true;
  group.add(thirdArc);

  // The third floor roofline.
  addCornice(group, materials, { y: B.thirdTop - 0.06, height: 0.14, protrude: 0.14, footprint: B.third });
  const thirdRoof = new THREE.Mesh(flatPlan(footprintPoints(t), B.thirdTop - 0.006), materials.roof);
  // Keep the roof membrane just below the coplanar third-floor wall tops and
  // parapet bottoms; otherwise WebKit/Metal z-fights along the entire roof rim.
  thirdRoof.name = 'third-floor-roof';
  thirdRoof.receiveShadow = true;
  group.add(thirdRoof);
  addParapet(group, materials);

  // Small roof hatch to give the hidden roofline a believable silhouette.
  const hatch = new THREE.Group();
  hatch.position.set(-2.2, B.thirdTop + 0.24, -2.2);
  const hatchBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.0), materials.roofMetal);
  hatchBody.castShadow = true;
  hatchBody.receiveShadow = true;
  hatch.add(hatchBody);
  const hatchRoof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.28, 4), materials.awningTrim);
  hatchRoof.rotation.y = Math.PI / 4;
  // Lift the pyramidal hatch cap clear of the hatch box top face. The two
  // surfaces were nearly coplanar and z-fought on Apple GPUs.
  hatchRoof.position.y = 0.40;
  hatchRoof.castShadow = true;
  hatch.add(hatchRoof);
  group.add(hatch);

  // ---- Doors, windows and ironwork ---------------------------------
  const entrance = addEntrance(group, materials, (surface) => surfacePoints.push(surface));

  const sideSurface = (side, coordinate) => {
    if (side === 'front') return { x: coordinate, z: B.zMax + 0.003 };
    if (side === 'right') return { x: B.xMax + 0.003, z: coordinate };
    if (side === 'back') return { x: coordinate, z: B.zMin - 0.003 };
    return { x: B.xMin - 0.003, z: coordinate };
  };
  const sideRotation = (side) => {
    if (side === 'front') return 0;
    if (side === 'right') return Math.PI / 2;
    if (side === 'back') return Math.PI;
    return -Math.PI / 2;
  };
  const thirdSurface = (side, coordinate) => {
    if (side === 'front') return { x: coordinate, z: t.zMax + 0.003 };
    if (side === 'right') return { x: t.xMax + 0.003, z: coordinate };
    if (side === 'back') return { x: coordinate, z: t.zMin - 0.003 };
    return { x: t.xMin - 0.003, z: coordinate };
  };

  const addSideWindow = (side, coordinate, bottom, width, height, options = {}) => {
    const useThird = options.third ?? false;
    const surface = useThird ? thirdSurface(side, coordinate) : sideSurface(side, coordinate);
    windowSystem.addWindow({
      surface,
      rotationY: sideRotation(side),
      bottom,
      width,
      height,
      style: options.style ?? 'sash',
      lit: options.lit ?? true,
      third: useThird,
      header: options.header ?? false,
      storeSill: true,
    });
  };

  // Ground floor: generous sash windows.
  [
    ['front', -4.18, true],
    ['front', -2.38, false],
    ['right', -3.95, false],
    ['right', -2.12, true],
    ['back', -4.08, true],
    ['back', -1.92, false],
    ['back', 0.6, true],
    ['left', -3.58, false],
    ['left', -1.4, true],
    ['left', 1.22, false],
  ].forEach(([side, coordinate, lit], index) => {
    addSideWindow(side, coordinate, 0.92, 1.18, 1.88, {
      lit,
      style: 'sash',
    });
  });

  // Second floor: windows, plus iron balcony doors at the corner.
  [
    ['front', -4.12, true],
    ['front', -2.05, false],
    ['front', 0.55, true],
    ['right', -3.92, false],
    ['right', -2.15, true],
    ['back', -4.05, false],
    ['back', -1.82, true],
    ['back', 0.8, false],
    ['left', -3.5, true],
    ['left', -1.22, false],
    ['left', 1.4, true],
  ].forEach(([side, coordinate, lit]) => {
    addSideWindow(side, coordinate, 3.62, 1.22, 2.23, {
      lit,
      style: 'sash',
      header: true,
    });
  });
  addSideWindow('right', 0.08, 3.6, 1.3, 2.28, {
    lit: true,
    style: 'balcony-door',
    header: false,
  });

  // Corner French door opens onto the wrap-around balcony.
  {
    const surface = cornerSurface(false, 0.14);
    windowSystem.addWindow({
      surface,
      rotationY: Math.PI / 4,
      bottom: 3.59,
      width: 1.25,
      height: 2.3,
      style: 'balcony-door',
      lit: true,
      third: false,
      header: false,
      storeSill: true,
    });
  }

  // Third floor: tall individual windows with their own surrounds.
  const thirdFrontPositions = [-4.28, -2.55, -0.82, 0.88];
  thirdFrontPositions.forEach((coordinate, index) => {
    addSideWindow('front', coordinate, 6.72, 0.82, 2.07, {
      lit: index !== 1,
      style: 'tall',
      third: true,
      header: false,
    });
  });
  const thirdRightPositions = [-3.95, -2.15, -0.36, 1.02];
  thirdRightPositions.forEach((coordinate, index) => {
    addSideWindow('right', coordinate, 6.72, 0.82, 2.07, {
      lit: index !== 2,
      style: 'tall',
      third: true,
      header: false,
    });
  });
  const thirdBackPositions = [-4.18, -1.8, 0.6, 2.9];
  thirdBackPositions.forEach((coordinate, index) => {
    addSideWindow('back', coordinate, 6.72, 0.78, 2.0, {
      lit: index === 1,
      style: 'tall',
      third: true,
      header: false,
    });
  });
  const thirdLeftPositions = [-3.45, -1.2, 1.05, 2.58];
  thirdLeftPositions.forEach((coordinate, index) => {
    addSideWindow('left', coordinate, 6.72, 0.78, 2.0, {
      lit: index === 0 || index === 3,
      style: 'tall',
      third: true,
      header: false,
    });
  });
  {
    const surface = cornerSurface(true, 0.07);
    windowSystem.addWindow({
      surface,
      rotationY: Math.PI / 4,
      bottom: 6.75,
      width: 0.8,
      height: 2.04,
      style: 'tall',
      lit: true,
      third: true,
      header: false,
      storeSill: true,
    });
  }

  const windowMeshes = windowSystem.finish(group);

  // ---- Balcony, awning ---------------------------------------------
  const balcony = buildBalcony(group, materials, surfacePoints);
  const awning = buildAwning(group, materials, surfacePoints, awningLights);
  entrance.group.updateMatrixWorld(true);

  // Window sills for fallen petals. Window builders already record these in
  // the building's world coordinates.
  surfacePoints.push(
    ...sillSurfaces.map((sill) => ({
      position: sill.position.clone(),
      width: sill.width,
      depth: sill.depth,
      rotationY: sill.rotationY,
      kind: 'sill',
    })),
  );

  // Soft contact shadow where the building meets the pavement.
  const shadow = addContactShadow(
    group,
    materials.shadowTexture,
    (B.xMin + B.xMax) / 2,
    (B.zMin + B.zMax) / 2,
    12.4,
    10.4,
    0.42,
    B.baseY + 0.005,
  );
  shadow.name = 'building-base-contact-shadow';
  shadow.material.polygonOffset = true;
  shadow.material.polygonOffsetFactor = -1;
  shadow.material.polygonOffsetUnits = -4;
  shadow.rotation.z = 0;

  // Window-like lanterns beside the entrance are given small point light
  // positions by the lighting module.
  const entryLightPositions = entrance.entryLights;

  // The whole building is asked to hold a smaller share of the miniature
  // than the jacarandas. Scaling the assembled group keeps every moulding,
  // mullion and rail proportional; the base and street stay full size.
  group.scale.setScalar(BUILDING_SCALE);
  group.position.set(BUILDING_OFFSET.x, BUILDING_OFFSET.y, BUILDING_OFFSET.z);
  group.updateMatrixWorld(true);
  const buildingMatrix = group.matrixWorld;
  surfacePoints.forEach((surface) => {
    surface.position.applyMatrix4(buildingMatrix);
    surface.width *= BUILDING_SCALE;
    surface.depth *= BUILDING_SCALE;
  });
  entryLightPositions.forEach((position) => position.applyMatrix4(buildingMatrix));
  awningLights.forEach((light) => light.position.applyMatrix4(buildingMatrix));

  return {
    group,
    surfacePoints,
    sillSurfaces: surfacePoints.filter((s) => s.kind === 'sill'),
    awningLights,
    entryLightPositions,
    balcony,
    awning,
    windowMeshes,
    windows: windowMeshes,
    dimensions: B,
    entrance,
  };
}
