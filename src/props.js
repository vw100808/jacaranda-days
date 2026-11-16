import * as THREE from 'three';
import {
  BENCH,
  BUILDING as B,
  BUILDING_OFFSET,
  BUILDING_SCALE,
  PROP_POSITIONS,
  STREET,
} from './config.js';
import {
  GeometryAccumulator,
  addContactShadow,
  canvasTexture,
  makePosterTexture,
  mulberry32,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* Bench                                                               */
/* ------------------------------------------------------------------ */

function buildBench(materials) {
  const group = new THREE.Group();
  group.name = 'purple-slat-bench';
  group.position.set(...BENCH.position);
  group.rotation.y = BENCH.rotation;

  const wood = materials.woodPurple;
  const woodLight = materials.woodPurpleLight;
  const metal = materials.silverMetal;
  const length = BENCH.length;

  // Seat slats, with visible gaps.
  for (let i = 0; i < 5; i += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(length, 0.042, 0.064), i % 2 ? wood : woodLight);
    slat.position.set(0, 0.46, -0.18 + i * 0.085);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
  }

  // Back slats, leaning a few degrees.
  const backTilt = -0.12;
  for (let i = 0; i < 4; i += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(length, 0.075, 0.035), i % 2 ? wood : woodLight);
    slat.position.set(0, 0.67 + i * 0.115, -0.3 - i * 0.014);
    slat.rotation.x = backTilt;
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
  }

  // Silver-white frame: two U-shaped supports, arm rests, and back rails.
  const frames = new GeometryAccumulator();
  function tube(a, b, radius) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const lengthT = direction.length();
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    frames.add(
      new THREE.CylinderGeometry(radius, radius, lengthT, 9),
      new THREE.Matrix4().compose(center, quat, new THREE.Vector3(1, 1, 1)),
    );
  }

  for (const side of [-1, 1]) {
    const x = side * (length / 2 - 0.18);
    const frontZ = 0.27;
    const backZ = -0.3;
    tube(
      new THREE.Vector3(x, 0.03, frontZ),
      new THREE.Vector3(x, 0.43, frontZ),
      0.025,
    );
    tube(
      new THREE.Vector3(x, 0.03, backZ),
      new THREE.Vector3(x, 0.43, backZ),
      0.025,
    );
    tube(
      new THREE.Vector3(x - side * 0.14, 0.035, frontZ + 0.02),
      new THREE.Vector3(x, 0.42, frontZ),
      0.026,
    );
    tube(
      new THREE.Vector3(x - side * 0.14, 0.035, backZ - 0.02),
      new THREE.Vector3(x, 0.42, backZ),
      0.026,
    );
    tube(
      new THREE.Vector3(x, 0.43, frontZ),
      new THREE.Vector3(x, 0.43, backZ),
      0.022,
    );
    tube(
      new THREE.Vector3(x, 0.47, backZ),
      new THREE.Vector3(x, 0.77, -0.35),
      0.022,
    );
    tube(
      new THREE.Vector3(x, 0.64, 0.23),
      new THREE.Vector3(x, 0.64, -0.34),
      0.022,
    );
    tube(
      new THREE.Vector3(x, 0.64, 0.23),
      new THREE.Vector3(x, 0.47, 0.27),
      0.021,
    );
  }
  // Cross braces.
  tube(
    new THREE.Vector3(-length / 2 + 0.18, 0.22, 0.05),
    new THREE.Vector3(length / 2 - 0.18, 0.22, 0.05),
    0.018,
  );
  tube(
    new THREE.Vector3(-length / 2 + 0.18, 0.18, -0.3),
    new THREE.Vector3(length / 2 - 0.18, 0.18, -0.3),
    0.018,
  );
  const frameMesh = new THREE.Mesh(frames.build(), metal);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  // Feet pads.
  for (const side of [-1, 1]) {
    for (const z of [-0.3, 0.27]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 10), materials.ironSoft);
      pad.position.set(side * (length / 2 - 0.18), 0.012, z);
      pad.castShadow = true;
      group.add(pad);
    }
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* Planters                                                            */
/* ------------------------------------------------------------------ */

function makeLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.33);
  shape.bezierCurveTo(0.16, -0.18, 0.2, 0.11, 0, 0.42);
  shape.bezierCurveTo(-0.2, 0.11, -0.16, -0.18, 0, -0.33);
  const geometry = new THREE.ShapeGeometry(shape, 5);
  geometry.computeVertexNormals();
  return geometry;
}

function buildPlanters(scene, materials) {
  const group = new THREE.Group();
  group.name = 'planters';
  scene.add(group);

  const positions = [PROP_POSITIONS.planterLeft, PROP_POSITIONS.planterDoor];
  const geometry = makeLeafGeometry();
  const leafMatrices = [];
  const leafColors = [];
  const dummy = new THREE.Object3D();
  const rng = mulberry32(3021);

  positions.forEach(([x, y, z], planterIndex) => {
    const pot = new THREE.Group();
    pot.position.set(x, y, z);
    group.add(pot);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.17, 0.36, 14, 1, false),
      planterIndex === 0 ? materials.terracotta : materials.ceramicCream,
    );
    body.position.y = 0.18;
    body.castShadow = true;
    body.receiveShadow = true;
    pot.add(body);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.028, 5, 18),
      planterIndex === 0 ? materials.terracottaLight : materials.terracotta,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.36;
    rim.castShadow = true;
    pot.add(rim);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.215, 16), materials.soil);
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.355;
    pot.add(soil);

    for (let i = 0; i < 18; i += 1) {
      const angle = rng() * Math.PI * 2;
      const tilt = 0.35 + rng() * 0.7;
      const height = 0.18 + rng() * 0.36;
      dummy.position.set(
        x + Math.cos(angle) * (0.06 + rng() * 0.11),
        y + 0.37 + height * 0.2,
        z + Math.sin(angle) * (0.06 + rng() * 0.11),
      );
      dummy.rotation.set(
        -Math.PI / 2 + tilt * Math.cos(angle),
        angle,
        tilt * Math.sin(angle),
        'YXZ',
      );
      dummy.scale.setScalar(0.65 + rng() * 0.65);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
      leafColors.push(
        new THREE.Color().setHSL(
          0.77 + rng() * 0.06,
          0.24 + rng() * 0.14,
          0.28 + rng() * 0.13,
        ),
      );
    }

    addContactShadow(
      group,
      materials.shadowTexture,
      x,
      z,
      0.95,
      0.95,
      0.5,
      y + 0.005,
    );
  });

  const leaves = new THREE.InstancedMesh(geometry, materials.leaflet, leafMatrices.length);
  leafMatrices.forEach((matrix, i) => {
    leaves.setMatrixAt(i, matrix);
    leaves.setColorAt(i, leafColors[i]);
  });
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.name = 'planter-leaves';
  group.add(leaves);

  return group;
}

/* ------------------------------------------------------------------ */
/* Magazine stand                                                      */
/* ------------------------------------------------------------------ */

function buildMagazineStand(materials) {
  const group = new THREE.Group();
  group.name = 'magazine-stand';
  group.position.set(...PROP_POSITIONS.magazine);
  group.rotation.y = 0.03;

  const iron = materials.ironSoft;
  const frame = new GeometryAccumulator();

  // Slim side rails, feet and two display lips.
  const railGeometry = new THREE.BoxGeometry(0.035, 0.98, 0.035);
  for (const x of [-0.32, 0.32]) {
    for (const z of [-0.2, 0.2]) {
      frame.add(railGeometry, new THREE.Matrix4().makeTranslation(x, 0.49, z));
    }
  }
  railGeometry.dispose();

  const footGeometry = new THREE.BoxGeometry(0.78, 0.035, 0.055);
  for (const z of [-0.22, 0.22]) {
    frame.add(footGeometry, new THREE.Matrix4().makeTranslation(0, 0.02, z));
  }
  footGeometry.dispose();

  const lipGeometry = new THREE.BoxGeometry(0.68, 0.03, 0.07);
  [0.3, 0.58, 0.86].forEach((y) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, y, 0.075),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    frame.add(lipGeometry.clone(), matrix);
  });
  lipGeometry.dispose();

  const backBoard = new THREE.BoxGeometry(0.7, 0.74, 0.025);
  frame.add(
    backBoard,
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.6, -0.08),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  backBoard.dispose();

  const frameMesh = new THREE.Mesh(frame.build(), iron);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  const coverData = [
    { color: '#c4b0e3', accent: '#6e589d', x: -0.17, y: 0.83 },
    { color: '#e5ddca', accent: '#53505c', x: 0.16, y: 0.82 },
    { color: '#a4b6c9', accent: '#46586a', x: -0.17, y: 0.54 },
    { color: '#d8c6cc', accent: '#8a5e6e', x: 0.16, y: 0.53 },
  ];

  coverData.forEach((cover) => {
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, 0.3, 0.026),
      new THREE.MeshToonMaterial({ color: cover.color, gradientMap: materials.gradientMap }),
    );
    page.position.set(cover.x, cover.y, 0.025);
    page.rotation.x = -0.14;
    page.castShadow = true;
    group.add(page);

    const masthead = new THREE.Mesh(
      new THREE.PlaneGeometry(0.155, 0.035),
      new THREE.MeshBasicMaterial({ color: cover.accent }),
    );
    masthead.position.set(cover.x, cover.y + 0.1, 0.041);
    masthead.rotation.x = -0.14;
    group.add(masthead);

    const illustration = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 12),
      new THREE.MeshBasicMaterial({ color: cover.accent }),
    );
    illustration.position.set(cover.x, cover.y - 0.01, 0.041);
    illustration.rotation.x = -0.14;
    group.add(illustration);
  });

  // Small sign that identifies the rack as a paper stall.
  const signTexture = canvasTexture(
    384,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = '#f0eadc';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8e7a5e';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#4f4640';
      ctx.font = 'italic 33px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Papers · Postcards', w / 2, h / 2 + 1);
    },
    { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping },
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.145),
    new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }),
  );
  sign.position.set(0, 1.02, 0.045);
  sign.rotation.x = -0.08;
  group.add(sign);
  const signFrame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.19, 0.035), iron);
  signFrame.position.set(0, 1.02, 0.02);
  signFrame.rotation.x = -0.08;
  signFrame.castShadow = true;
  group.add(signFrame);
  sign.position.z = 0.045;

  return group;
}

/* ------------------------------------------------------------------ */
/* Posters                                                            */
/* ------------------------------------------------------------------ */

function buildPosters(scene, materials) {
  const group = new THREE.Group();
  group.name = 'wall-posters';
  scene.add(group);

  const wallY = (nominalY) => B.baseY + (nominalY - B.baseY) * BUILDING_SCALE;
  const frontWallZ = B.zMax * BUILDING_SCALE + BUILDING_OFFSET.z;
  const rightWallX = B.xMax * BUILDING_SCALE + BUILDING_OFFSET.x;
  const posters = [
    {
      texture: makePosterTexture({
        title: 'Jacaranda',
        kicker: 'Festival',
        dates: '8 — 24 November',
        accent: '#715c9f',
      }),
      position: [
        0.7 * BUILDING_SCALE + BUILDING_OFFSET.x,
        wallY(1.82),
        frontWallZ + 0.032,
      ],
      rotationY: 0,
      size: [0.74 * BUILDING_SCALE, 1.04 * BUILDING_SCALE],
    },
    {
      texture: makePosterTexture({
        title: 'Open',
        kicker: 'Garden',
        dates: 'Walsh Bay',
        accent: '#9378bd',
      }),
      position: [
        rightWallX + 0.032,
        wallY(1.96),
        1.18 * BUILDING_SCALE + BUILDING_OFFSET.z,
      ],
      rotationY: Math.PI / 2,
      size: [0.62 * BUILDING_SCALE, 0.9 * BUILDING_SCALE],
    },
  ];

  posters.forEach((poster) => {
    const [w, h] = poster.size;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.045),
      materials.posterFrame,
    );
    frame.position.set(...poster.position);
    frame.rotation.y = poster.rotationY;
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: poster.texture, toneMapped: false }),
    );
    paper.position.copy(frame.position);
    if (poster.rotationY === 0) {
      paper.position.z += 0.028;
      paper.position.y += 0.015;
    } else {
      paper.rotation.y = poster.rotationY;
      paper.position.x += 0.028;
      paper.position.y += 0.015;
    }
    group.add(paper);

    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.08, h + 0.08),
      new THREE.MeshBasicMaterial({ color: '#f5ecdb', toneMapped: false }),
    );
    mat.position.copy(frame.position);
    if (poster.rotationY === 0) {
      mat.position.z += 0.024;
    } else {
      mat.rotation.y = poster.rotationY;
      mat.position.x += 0.024;
    }
    group.add(mat);
  });

  return group;
}

/* ------------------------------------------------------------------ */
/* Bicycle                                                             */
/* ------------------------------------------------------------------ */

function buildBicycle(materials) {
  const group = new THREE.Group();
  group.name = 'leaning-bicycle';
  group.position.set(...PROP_POSITIONS.bicycle);
  // The tyre outer radius sits just inside the group origin; nudge the bike
  // down so both wheels make contact with the pavement.
  group.position.y -= 0.018;
  group.rotation.z = 0.1;
  group.rotation.y = 0.02;

  const frameAccumulator = new GeometryAccumulator();
  function tube(a, b, radius) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    frameAccumulator.add(
      new THREE.CylinderGeometry(radius, radius, len, 6),
      new THREE.Matrix4().compose(center, quat, new THREE.Vector3(1, 1, 1)),
    );
  }

  const wheelRadius = 0.34;
  const wheelMaterial = materials.darkMetal;
  const wheelGeometry = new THREE.TorusGeometry(wheelRadius, 0.018, 6, 22);

  // Local bicycle plane is YZ; wheels roll along Z.
  for (const z of [-0.47, 0.47]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, wheelRadius + 0.035, z);
    wheel.castShadow = true;
    group.add(wheel);

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const inner = new THREE.Vector3(
        0.01,
        wheelRadius + 0.035 + Math.sin(angle) * 0.05,
        z + Math.cos(angle) * 0.05,
      );
      const outer = new THREE.Vector3(
        0,
        wheelRadius + 0.035 + Math.sin(angle) * (wheelRadius - 0.025),
        z + Math.cos(angle) * (wheelRadius - 0.025),
      );
      tube(inner, outer, 0.0045);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), materials.silverMetal);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, wheelRadius + 0.035, z);
    group.add(hub);
  }

  const rear = new THREE.Vector3(0, wheelRadius + 0.035, -0.47);
  const front = new THREE.Vector3(0, wheelRadius + 0.035, 0.47);
  const crank = new THREE.Vector3(0, 0.3, -0.04);
  const seatTop = new THREE.Vector3(0, 0.89, -0.2);
  const headTop = new THREE.Vector3(0, 0.88, 0.3);
  const headBottom = new THREE.Vector3(0, 0.53, 0.34);

  tube(rear, seatTop, 0.018);
  tube(seatTop, crank, 0.019);
  tube(crank, rear, 0.018);
  tube(crank, headBottom, 0.019);
  tube(headBottom, headTop, 0.02);
  tube(headTop, seatTop, 0.019);
  tube(headBottom, front, 0.017);
  tube(headTop, new THREE.Vector3(0, 0.98, 0.33), 0.016);

  // Handlebar.
  tube(
    new THREE.Vector3(-0.18, 0.99, 0.33),
    new THREE.Vector3(0.18, 0.99, 0.33),
    0.014,
  );
  tube(
    new THREE.Vector3(-0.18, 0.99, 0.33),
    new THREE.Vector3(-0.18, 0.99, 0.5),
    0.013,
  );
  tube(
    new THREE.Vector3(0.18, 0.99, 0.33),
    new THREE.Vector3(0.18, 0.99, 0.5),
    0.013,
  );

  const frame = new THREE.Mesh(frameAccumulator.build(), materials.silverMetal);
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.26), materials.woodDark);
  saddle.position.set(0, 0.94, -0.2);
  saddle.rotation.z = 0.05;
  saddle.castShadow = true;
  group.add(saddle);

  const crankArm = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 5, 14), materials.darkMetal);
  crankArm.rotation.y = Math.PI / 2;
  crankArm.position.set(0, 0.29, -0.04);
  group.add(crankArm);

  // Handlebar grips.
  for (const x of [-0.18, 0.18]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.11, 8), materials.woodDark);
    grip.rotation.x = Math.PI / 2;
    grip.position.set(x, 0.99, 0.47);
    grip.castShadow = true;
    group.add(grip);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* Build all props                                                     */
/* ------------------------------------------------------------------ */

export function buildProps(scene, materials) {
  const group = new THREE.Group();
  group.name = 'street-props';
  scene.add(group);

  const bench = buildBench(materials);
  group.add(bench);
  addContactShadow(
    group,
    materials.shadowTexture,
    BENCH.position[0],
    BENCH.position[2],
    2.6,
    1.3,
    0.58,
    STREET.sidewalkY + 0.008,
  );

  const planters = buildPlanters(scene, materials);

  const magazine = buildMagazineStand(materials);
  group.add(magazine);
  addContactShadow(
    group,
    materials.shadowTexture,
    PROP_POSITIONS.magazine[0],
    PROP_POSITIONS.magazine[2],
    1.05,
    0.8,
    0.45,
    STREET.sidewalkY + 0.006,
  );

  buildPosters(scene, materials);

  const bicycle = buildBicycle(materials);
  group.add(bicycle);
  addContactShadow(
    group,
    materials.shadowTexture,
    PROP_POSITIONS.bicycle[0],
    PROP_POSITIONS.bicycle[2],
    1.55,
    1.25,
    0.5,
    STREET.sidewalkY + 0.007,
  );

  return {
    group,
    bench,
    planters,
    magazine,
    bicycle,
  };
}
