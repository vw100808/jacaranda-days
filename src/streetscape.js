import * as THREE from 'three';
import { BASE, LAMP_DEFS, STREET, TREE_DEFS } from './config.js';
import {
  GeometryAccumulator,
  addContactShadow,
  roundedSquarePoints,
  extrudePlan,
  instancedFromMatrices,
  mulberry32,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* Plinth                                                              */
/* ------------------------------------------------------------------ */

function buildBase(materials) {
  const group = new THREE.Group();
  group.name = 'display-plinth';

  const points = roundedSquarePoints(BASE.size, BASE.edgeRadius, 7);
  const bodyGeometry = extrudePlan(points, BASE.thickness, -BASE.thickness, { bevel: 0.025 });
  bodyGeometry.computeBoundingBox();
  bodyGeometry.translate(0, -bodyGeometry.boundingBox.max.y, 0);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#1d202b',
    roughness: 0.34,
    metalness: 0.3,
    envMapIntensity: 0.9,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.receiveShadow = true;
  body.castShadow = true;
  group.add(body);

  // A narrow dark foot gives the object the weight of a museum model.
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(BASE.size + 0.12, 0.07, BASE.size + 0.12),
    new THREE.MeshToonMaterial({ color: '#0d1017', gradientMap: materials.gradientMap }),
  );
  foot.position.y = -BASE.thickness - 0.02;
  foot.receiveShadow = true;
  foot.castShadow = true;
  group.add(foot);

  // A warm inset line at the base's top edge.
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(BASE.size + 0.015, 0.018, BASE.size + 0.015),
    new THREE.MeshToonMaterial({ color: '#34313e', gradientMap: materials.gradientMap }),
  );
  rim.position.y = -0.009;
  rim.receiveShadow = true;
  group.add(rim);

  return group;
}

/* ------------------------------------------------------------------ */
/* Sidewalks, roads, curbs                                             */
/* ------------------------------------------------------------------ */

function buildPavement(scene, materials) {
  const group = new THREE.Group();
  group.name = 'pavement';
  scene.add(group);
  const sidewalkH = STREET.sidewalkY;
  const roadH = STREET.roadY;
  const e = STREET.extent;
  const roadTop = 0.055;

  const sideMat = materials.stoneDark;
  const roadSideMat = new THREE.MeshToonMaterial({
    color: '#252733',
    gradientMap: materials.gradientMap,
  });

  function sidewalkBox(x0, x1, z0, z1) {
    const w = x1 - x0;
    const d = z1 - z0;
    const top = materials.pavingMaterial(w, d);
    const geo = new THREE.BoxGeometry(w, sidewalkH, d);
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
    mesh.position.set((x0 + x1) / 2, sidewalkH / 2, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    return mesh;
  }

  function roadBox(x0, x1, z0, z1) {
    const w = x1 - x0;
    const d = z1 - z0;
    const top = materials.roadMaterial(w, d);
    const geo = new THREE.BoxGeometry(w, 0.055, d);
    const mesh = new THREE.Mesh(geo, [roadSideMat, roadSideMat, top, roadSideMat, roadSideMat, roadSideMat]);
    mesh.position.set((x0 + x1) / 2, 0.055 / 2, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // The near sidewalk wraps the building; the two narrow streets are cut in.
  sidewalkBox(-e, STREET.rightCurbX, -e, STREET.frontCurbZ);
  sidewalkBox(-e, e, STREET.frontFarZ, e);
  sidewalkBox(STREET.rightFarX, e, -e, STREET.frontCurbZ);

  // Front and right streets, plus their small T-junction.
  roadBox(-e, e, STREET.frontCurbZ, STREET.frontFarZ);
  roadBox(STREET.rightCurbX, STREET.rightFarX, -e, STREET.frontCurbZ);

  // Dark gutter strips soften the road-to-kerb transition.
  const gutterMat = new THREE.MeshBasicMaterial({
    color: '#1d202b',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });
  const gutterFront = new THREE.Mesh(
    new THREE.PlaneGeometry(STREET.rightCurbX - -e - 0.05, 0.14),
    gutterMat,
  );
  gutterFront.rotation.x = -Math.PI / 2;
  gutterFront.position.set((-e + STREET.rightCurbX) / 2, roadTop + 0.003, STREET.frontCurbZ + 0.08);
  group.add(gutterFront);

  const gutterRight = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, STREET.frontCurbZ - -e - 0.05),
    gutterMat,
  );
  gutterRight.rotation.x = -Math.PI / 2;
  gutterRight.position.set(STREET.rightCurbX + 0.08, roadTop + 0.003, (-e + STREET.frontCurbZ) / 2);
  group.add(gutterRight);


  // Subtle road hardware and worn edge paint add a little street realism.
  const manholeMat = new THREE.MeshStandardMaterial({
    color: '#4e5059',
    roughness: 0.62,
    metalness: 0.42,
  });
  const manholeRingMat = new THREE.MeshBasicMaterial({ color: '#22242b' });
  [[-1.15, 5.72], [7.35, -2.05]].forEach(([x, z]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.33, 20), manholeRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, roadTop + 0.004, z);
    group.add(ring);
    const cover = new THREE.Mesh(new THREE.CircleGeometry(0.255, 20), manholeMat);
    cover.rotation.x = -Math.PI / 2;
    cover.position.set(x, roadTop + 0.005, z);
    group.add(cover);
    const slotMat = new THREE.MeshBasicMaterial({ color: '#2c2e35' });
    for (let k = -2; k <= 2; k += 1) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.34), slotMat);
      slot.rotation.x = -Math.PI / 2;
      slot.position.set(x + k * 0.075, roadTop + 0.006, z);
      group.add(slot);
    }
  });
  const edgeWearMat = new THREE.MeshBasicMaterial({
    color: '#c7c4d0',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false,
  });
  const edgeWear = new THREE.Mesh(new THREE.PlaneGeometry(0.075, STREET.frontFarZ - STREET.frontCurbZ - 0.4), edgeWearMat);
  edgeWear.rotation.x = -Math.PI / 2;
  edgeWear.position.set(STREET.rightCurbX - 0.27, roadTop + 0.004, (STREET.frontCurbZ + STREET.frontFarZ) / 2);
  group.add(edgeWear);


  // Small repaired asphalt patches and a few worn paint marks.
  const patchMat = new THREE.MeshStandardMaterial({
    color: '#4b4b53',
    roughness: 0.94,
    metalness: 0.02,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  [[-2.9, 6.3, 2.0, 0.8, 0.12], [7.25, 1.3, 0.9, 1.7, -0.08]].forEach(([x, z, w, d, rot]) => {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = rot;
    patch.position.set(x, roadTop + 0.0045, z);
    group.add(patch);
  });
  const markMat = new THREE.MeshBasicMaterial({
    color: '#d9d4dc',
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    toneMapped: false,
  });
  for (const [x, z, rot] of [[-4.8, 6.32, 0], [1.8, 6.32, 0], [7.35, -4.2, Math.PI / 2]]) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.8), markMat);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = rot;
    mark.position.set(x, roadTop + 0.004, z);
    group.add(mark);
  }

  // ---- Kerbs --------------------------------------------------------
  const curbRuns = [
    { axis: 'x', from: -e + 0.18, to: STREET.rightCurbX, fixed: STREET.frontCurbZ - 0.11, near: true },
    { axis: 'x', from: -e + 0.18, to: e - 0.18, fixed: STREET.frontFarZ + 0.11, near: false },
    { axis: 'z', from: -e + 0.18, to: STREET.frontCurbZ, fixed: STREET.rightCurbX - 0.11, near: true },
    { axis: 'z', from: -e + 0.18, to: STREET.frontCurbZ, fixed: STREET.rightFarX + 0.11, near: false },
  ];
  const curbGeom = new THREE.BoxGeometry(0.56, STREET.curbTop, 0.2);
  const curbMat = materials.curb;
  const transforms = [];
  const colors = [];
  const random = mulberry32(470);
  curbRuns.forEach((run) => {
    const span = run.to - run.from;
    const count = Math.max(2, Math.floor(span / 0.63));
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const along = run.from + span * t;
      const quat = new THREE.Quaternion();
      if (run.axis === 'z') quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      const position = run.axis === 'x'
        ? new THREE.Vector3(along, STREET.curbTop / 2, run.fixed)
        : new THREE.Vector3(run.fixed, STREET.curbTop / 2, along);
      transforms.push(new THREE.Matrix4().compose(position, quat, new THREE.Vector3(1, 1, 1)));
      const c = 0.8 + random() * 0.12;
      colors.push(new THREE.Color(c, c * 0.985, c * 1.02));
    }
  });
  const curbs = instancedFromMatrices(curbGeom, curbMat, transforms, {
    colors,
    receiveShadow: true,
    castShadow: true,
  });
  curbs.name = 'kerb-stones';
  group.add(curbs);

  // ---- Drains -------------------------------------------------------
  const drainGeometry = new THREE.PlaneGeometry(0.58, 0.3);
  const drains = [
    [-2.6, STREET.frontCurbZ + 0.2, 0],
    [3.9, STREET.frontCurbZ + 0.2, 0],
    [STREET.rightCurbX + 0.19, -3.6, Math.PI / 2],
  ];
  drains.forEach(([x, z, rot]) => {
    const mesh = new THREE.Mesh(drainGeometry, materials.drain);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(x, roadTop + 0.003, z);
    group.add(mesh);
  });

  // ---- Road markings ------------------------------------------------
  const paintGeom = new THREE.PlaneGeometry(0.9, 0.1);
  const paintMat = materials.roadPaint;
  const dashTransforms = [];
  for (let x = -8.6; x < 8.5; x += 1.55) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, roadTop + 0.003, (STREET.frontCurbZ + STREET.frontFarZ) / 2),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    dashTransforms.push(matrix);
  }
  for (let z = -8.4; z < 4.4; z += 1.55) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3((STREET.rightCurbX + STREET.rightFarX) / 2, roadTop + 0.003, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)),
      new THREE.Vector3(1, 1, 1),
    );
    dashTransforms.push(matrix);
  }
  const dashes = instancedFromMatrices(paintGeom, paintMat, dashTransforms, {
    receiveShadow: false,
    castShadow: false,
  });
  group.add(dashes);

  // Stop line where the side street meets the junction.
  const stop = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.16), paintMat);
  stop.rotation.x = -Math.PI / 2;
  stop.position.set((STREET.rightCurbX + STREET.rightFarX) / 2, roadTop + 0.003, 4.56);
  group.add(stop);

  // A quiet crossing near the building entrance, kept to four slim bars.
  const barMat = new THREE.MeshBasicMaterial({
    color: '#efedf5',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 4; i += 1) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.1), barMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(0.4 + i * 0.92, roadTop + 0.003, STREET.frontCurbZ + 0.75);
    group.add(bar);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* Tree pits                                                           */
/* ------------------------------------------------------------------ */

function buildTreePits(scene, materials) {
  const group = new THREE.Group();
  group.name = 'tree-pits';
  scene.add(group);

  const grateMat = materials.grate;
  const frameMat = materials.stoneDark;
  const soilMat = materials.soil;

  TREE_DEFS.forEach((tree) => {
    const [x, z] = tree.pos;
    const y = STREET.sidewalkY;

    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.5, 22), soilMat);
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(x, y + 0.002, z);
    soil.receiveShadow = true;
    group.add(soil);

    const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.24), grateMat);
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(x, y + 0.012, z);
    grate.receiveShadow = true;
    group.add(grate);

    // Raised stone edging around the pit.
    const edge = 0.1;
    const size = 1.38;
    const h = 0.05;
    const parts = [
      [size, h, edge, 0, (size - edge) / 2],
      [size, h, edge, 0, -(size - edge) / 2],
      [edge, h, size - edge * 2, -(size - edge) / 2, 0],
      [edge, h, size - edge * 2, (size - edge) / 2, 0],
    ];
    parts.forEach(([w, hh, d, ox, oz]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), frameMat);
      mesh.position.set(x + ox, y + hh / 2, z + oz);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      group.add(mesh);
    });

    addContactShadow(group, materials.shadowTexture, x, z, 2.3, 2.3, 0.32, y + 0.006);
  });

  return group;
}

/* ------------------------------------------------------------------ */
/* Street lamps                                                        */
/* ------------------------------------------------------------------ */

function makeLampTemplate(materials) {
  const metal = new GeometryAccumulator();
  const glass = new GeometryAccumulator();

  function cylinder(acc, rTop, rBottom, height, y, segments = 10, x = 0, z = 0) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    acc.add(geo, new THREE.Matrix4().makeTranslation(x, y, z));
    geo.dispose();
  }

  function ring(acc, radius, tube, y, segments = 12) {
    const geo = new THREE.TorusGeometry(radius, tube, 4, segments);
    geo.rotateX(Math.PI / 2);
    acc.add(geo, new THREE.Matrix4().makeTranslation(0, y, 0));
    geo.dispose();
  }

  // Base and pole.
  cylinder(metal, 0.24, 0.29, 0.14, 0.07, 10);
  cylinder(metal, 0.18, 0.21, 0.08, 0.18, 10);
  cylinder(metal, 0.085, 0.12, 0.34, 0.38, 10);
  cylinder(metal, 0.052, 0.075, 2.55, 1.83, 8);
  ring(metal, 0.085, 0.018, 1.16, 12);
  ring(metal, 0.075, 0.014, 2.9, 12);
  cylinder(metal, 0.075, 0.075, 0.1, 3.1, 8);

  // Lantern cage.
  cylinder(metal, 0.09, 0.17, 0.12, 3.23, 6);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const bar = new THREE.BoxGeometry(0.018, 0.39, 0.018);
    metal.add(
      bar,
      new THREE.Matrix4().compose(
        new THREE.Vector3(Math.sin(angle) * 0.145, 3.46, Math.cos(angle) * 0.145),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    bar.dispose();
  }
  cylinder(metal, 0.24, 0.26, 0.05, 3.68, 6);
  cylinder(metal, 0.34, 0.28, 0.09, 3.72, 6);
  const cap = new THREE.ConeGeometry(0.23, 0.21, 6);
  metal.add(cap, new THREE.Matrix4().makeTranslation(0, 3.86, 0));
  cap.dispose();
  const finial = new THREE.SphereGeometry(0.055, 8, 6);
  metal.add(finial, new THREE.Matrix4().makeTranslation(0, 4.02, 0));
  finial.dispose();

  // Glowing lantern glass.
  cylinder(glass, 0.13, 0.17, 0.37, 3.47, 6);

  // A small direction arm and finial echo the Victorian street furniture.
  const arm = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 5);
  arm.rotateZ(Math.PI / 2);
  metal.add(arm, new THREE.Matrix4().makeTranslation(0.25, 3.12, 0));
  arm.dispose();

  return {
    metal: metal.build(),
    glass: glass.build(),
  };
}

function buildLamps(scene, materials) {
  const group = new THREE.Group();
  group.name = 'street-lamps';
  scene.add(group);
  const template = makeLampTemplate(materials);
  const lamps = [];

  LAMP_DEFS.forEach((def) => {
    const lamp = new THREE.Group();
    lamp.position.set(def.pos[0], STREET.sidewalkY, def.pos[1]);
    lamp.rotation.y = def.rotation;
    lamp.name = def.id;

    const metalMesh = new THREE.Mesh(template.metal, materials.iron);
    metalMesh.castShadow = true;
    metalMesh.receiveShadow = true;
    lamp.add(metalMesh);

    const glassMesh = new THREE.Mesh(template.glass, materials.lampGlass);
    glassMesh.castShadow = false;
    lamp.add(glassMesh);

    const glow = new THREE.Sprite(materials.glowSprite);
    glow.position.set(0, 3.48, 0);
    glow.scale.set(1.05, 1.05, 1);
    lamp.add(glow);

    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      materials.roadGlow,
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(def.pos[0], STREET.sidewalkY + 0.008, def.pos[1]);
    group.add(halo);

    addContactShadow(group, materials.shadowTexture, def.pos[0], def.pos[1], 1.2, 1.2, 0.45, STREET.sidewalkY + 0.005);
    group.add(lamp);

    lamps.push({
      id: def.id,
      group: lamp,
      position: new THREE.Vector3(def.pos[0], STREET.sidewalkY + 3.48, def.pos[1]),
      base: new THREE.Vector3(def.pos[0], STREET.sidewalkY, def.pos[1]),
      glow,
      halo,
      key: def.key,
    });
  });

  return { group, lamps, template };
}

/* ------------------------------------------------------------------ */
/* Public build                                                        */
/* ------------------------------------------------------------------ */

export function buildStreetscape(scene, materials) {
  const base = buildBase(materials);
  scene.add(base);
  const pavement = buildPavement(scene, materials);
  const pits = buildTreePits(scene, materials);
  const lamps = buildLamps(scene, materials);

  // A tiny brass title plate on the front face of the plinth.
  const titleTexture = document.createElement('canvas');
  titleTexture.width = 512;
  titleTexture.height = 128;
  const ctx = titleTexture.getContext('2d');
  ctx.fillStyle = '#c9ae7a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#7f6947';
  ctx.lineWidth = 4;
  ctx.strokeRect(7, 7, 498, 114);
  ctx.fillStyle = '#3e3427';
  ctx.font = 'italic 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Jacaranda Corner', 256, 61);
  ctx.font = '500 17px "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('SYDNEY · MINIATURE STUDY', 256, 96);
  const texture = new THREE.CanvasTexture(titleTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 0.62),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.55,
      envMapIntensity: 0.8,
    }),
  );
  plaque.rotation.z = 0;
  plaque.position.set(1.0, -BASE.thickness / 2 - 0.06, BASE.size / 2 + 0.006);
  scene.add(plaque);

  return {
    base,
    pavement,
    treePits: pits,
    lamps: lamps.lamps,
    lampTemplate: lamps.template,
  };
}
