import * as THREE from 'three';
import { LAMP_DEFS, STREET } from './config.js';

// A narrow local vertical lift around each lamp. Only instances whose centres
// are close to a lantern are moved; the rest of each tree keeps its original
// crown. Branches, twigs, leaves and flowers all receive the same field.
const RADIUS = 2.25;
const LIFT = 1.75;
const Y_MIN = STREET.sidewalkY + 0.45;
const Y_MAX = STREET.sidewalkY + 6.05;

function liftAt(point) {
  if (point.y < Y_MIN || point.y > Y_MAX) return 0;
  let amount = 0;
  for (const lamp of LAMP_DEFS) {
    const d = Math.hypot(point.x - lamp.pos[0], point.z - lamp.pos[1]);
    if (d >= RADIUS) continue;
    const radial = 1 - d / RADIUS;
    const vertical = Math.min(1, (Y_MAX - point.y) / 1.5);
    amount = Math.max(amount, LIFT * radial * vertical);
  }
  return amount;
}

function isTrunkInstance(point, trees) {
  return trees.some((tree) => Math.hypot(point.x - tree.root.x, point.z - tree.root.z) < 0.34);
}

function liftMesh(mesh, matrixGetter, matrixSetter, worldMatrix, trees, skipTrunks) {
  const m = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const p = new THREE.Vector3();
  let moved = 0;
  for (let i = 0; i < mesh.count; i += 1) {
    matrixGetter(mesh, i, m);
    world.copy(worldMatrix).multiply(m);
    p.setFromMatrixPosition(world);
    if (skipTrunks && isTrunkInstance(p, trees)) continue;
    const amount = liftAt(p);
    if (amount < 0.006) continue;
    m.elements[13] += amount;
    matrixSetter(mesh, i, m);
    moved += 1;
  }
  if (moved) {
    mesh.instanceMatrix.needsUpdate = true;
  }
  return moved;
}

export function liftLampGeometry(treeSystem, scene) {
  scene.updateMatrixWorld(true);
  const trees = treeSystem.trees;
  const stats = { main: 0, joints: 0, twigs: 0, leaves: 0, flowers: 0, shadows: 0 };
  const world = new THREE.Matrix4();

  stats.main = liftMesh(
    treeSystem.mainMesh,
    (mesh, i, out) => mesh.getMatrixAt(i, out),
    (mesh, i, m) => mesh.setMatrixAt(i, m),
    new THREE.Matrix4(),
    trees,
    true,
  );
  stats.joints = liftMesh(
    treeSystem.jointMesh,
    (mesh, i, out) => mesh.getMatrixAt(i, out),
    (mesh, i, m) => mesh.setMatrixAt(i, m),
    new THREE.Matrix4(),
    trees,
    true,
  );
  stats.shadows = liftMesh(
    treeSystem.shadowProxy,
    (mesh, i, out) => mesh.getMatrixAt(i, out),
    (mesh, i, m) => mesh.setMatrixAt(i, m),
    new THREE.Matrix4(),
    trees,
    false,
  );

  for (const tree of trees) {
    world.copy(tree.pivot.matrixWorld);
    stats.twigs += liftMesh(
      tree.twigMesh,
      (mesh, i, out) => mesh.getMatrixAt(i, out),
      (mesh, i, m) => mesh.setMatrixAt(i, m),
      world,
      trees,
      false,
    );
    stats.leaves += liftMesh(
      tree.leafMesh,
      (mesh, i, out) => mesh.getMatrixAt(i, out),
      (mesh, i, m) => mesh.setMatrixAt(i, m),
      world,
      trees,
      false,
    );
    stats.flowers += liftMesh(
      tree.flowerMesh,
      (mesh, i, out) => mesh.getMatrixAt(i, out),
      (mesh, i, m) => mesh.setMatrixAt(i, m),
      world,
      trees,
      false,
    );
  }
  return stats;
}
