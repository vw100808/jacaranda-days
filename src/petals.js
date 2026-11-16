import * as THREE from 'three';
import { BASE, BUILDING as B, STREET, TREE_DEFS } from './config.js';
import { mulberry32 } from './utils.js';

function createPetalGeometry() {
  const center = new THREE.Vector3(0, 0.08, 0.065);
  const ring = [
    new THREE.Vector3(0, -0.34, 0),
    new THREE.Vector3(-0.23, -0.11, 0.018),
    new THREE.Vector3(-0.17, 0.24, 0.045),
    new THREE.Vector3(0, 0.63, 0.018),
    new THREE.Vector3(0.17, 0.24, 0.045),
    new THREE.Vector3(0.23, -0.11, 0.018),
  ];
  const colors = [
    new THREE.Color('#b395d5'),
    new THREE.Color('#cab5e6'),
    new THREE.Color('#e1d4f2'),
    new THREE.Color('#f0e9fa'),
    new THREE.Color('#e1d4f2'),
    new THREE.Color('#cab5e6'),
  ];
  const positions = [];
  const vertexColors = [];
  const indices = [];

  ring.forEach((point) => {
    positions.push(point.x, point.y, point.z);
    vertexColors.push(0.84, 0.71, 0.93);
  });
  positions.push(center.x, center.y, center.z);
  const centerColor = new THREE.Color('#8d6fb5');
  vertexColors.push(centerColor.r, centerColor.g, centerColor.b);
  const centerIndex = ring.length;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    indices.push(centerIndex, i, j);
    const c = colors[i];
    vertexColors[i * 3 + 0] = c.r;
    vertexColors[i * 3 + 1] = c.g;
    vertexColors[i * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function surfaceHeightAt(x, z) {
  if (x < -STREET.extent || x > STREET.extent || z < -STREET.extent || z > STREET.extent) {
    return null;
  }
  const onFrontRoad = z > STREET.frontCurbZ && z < STREET.frontFarZ;
  const onRightRoad = x > STREET.rightCurbX && x < STREET.rightFarX && z < STREET.frontCurbZ;
  return onFrontRoad || onRightRoad ? STREET.roadY + 0.006 : STREET.sidewalkY + 0.006;
}

function insideBuilding(x, z, margin = 0.08) {
  return (
    x > B.xMin - margin &&
    x < B.xMax + margin &&
    z > B.zMin - margin &&
    z < B.zMax + margin
  );
}

function groundHeightForPetals(x, z) {
  if (insideBuilding(x, z, 0.05)) return B.parapetTop + 0.03;
  const sidewalk = surfaceHeightAt(x, z);
  if (sidewalk === null) return BASE.thickness + 0.1;
  // Tree grates sit just proud of the pavement.
  for (const def of TREE_DEFS) {
    if (Math.abs(x - def.pos[0]) < 0.56 && Math.abs(z - def.pos[1]) < 0.56) {
      return STREET.sidewalkY + 0.02;
    }
  }
  return sidewalk;
}

function makePetalColor(rng, fallen = false, target = new THREE.Color()) {
  const hue = 0.7 + rng() * 0.05;
  const sat = fallen ? 0.3 + rng() * 0.2 : 0.34 + rng() * 0.2;
  const light = fallen ? 0.64 + rng() * 0.2 : 0.7 + rng() * 0.18;
  return target.setHSL(hue, sat, light);
}

export function buildPetals(scene, materials, trees, treeSystem, surfaces) {
  const rng = mulberry32(91357);
  const group = new THREE.Group();
  group.name = 'jacaranda-petals';
  scene.add(group);
  const geometry = createPetalGeometry();
  const fallenGeometry = geometry;

  /* ---- Ground and architectural surfaces -------------------------- */
  const fallenMatrices = [];
  const fallenColors = [];
  const dummy = new THREE.Object3D();

  function pushFallen(x, z, y, size, tiltScale = 1) {
    const yaw = rng() * Math.PI * 2;
    const tiltX = (rng() - 0.5) * 0.5 * tiltScale;
    const tiltZ = (rng() - 0.5) * 0.4 * tiltScale;
    dummy.position.set(x, y, z);
    dummy.rotation.set(-Math.PI / 2 + tiltX, yaw, tiltZ, 'YXZ');
    const scale = size * (0.8 + rng() * 0.45);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    fallenMatrices.push(dummy.matrix.clone());
    fallenColors.push(makePetalColor(rng, true));
  }

  // Dense drifts under each tree.
  trees.forEach((tree) => {
    const [tx, tz] = tree.def.pos;
    for (let i = 0; i < 94; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = tree.def.canopy * Math.pow(rng(), 0.7) * 0.92;
      const x = tx + Math.cos(angle) * radius;
      const z = tz + Math.sin(angle) * radius;
      if (insideBuilding(x, z, 0.12)) continue;
      const y = groundHeightForPetals(x, z);
      pushFallen(x, z, y, 0.095 + rng() * 0.035);
    }
  });

  // Extra petals gathered along both kerbs and beneath the lamps.
  for (let i = 0; i < 120; i += 1) {
    const onFront = rng() > 0.38;
    if (onFront) {
      const x = -8.9 + rng() * 15.1;
      const z = STREET.frontCurbZ - 0.08 - rng() * 0.42;
      const y = groundHeightForPetals(x, z);
      pushFallen(x, z, y, 0.085 + rng() * 0.03);
    } else {
      const z = -8.9 + rng() * 13.4;
      const x = STREET.rightCurbX - 0.08 - rng() * 0.42;
      const y = groundHeightForPetals(x, z);
      pushFallen(x, z, y, 0.085 + rng() * 0.03);
    }
  }

  // Sparse petals across the remaining pavement.
  for (let i = 0; i < 150; i += 1) {
    const x = -STREET.extent + rng() * STREET.extent * 2;
    const z = -STREET.extent + rng() * STREET.extent * 2;
    if (insideBuilding(x, z, 0.3)) continue;
    const y = groundHeightForPetals(x, z);
    pushFallen(x, z, y, 0.075 + rng() * 0.035);
  }

  // Petals resting on sills, the awning and the balcony.
  surfaces.forEach((surface) => {
    const count = surface.kind === 'sill' ? 2 : surface.kind === 'awning' ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      if (rng() > 0.72) continue;
      const localX = (rng() - 0.5) * surface.width * 0.75;
      const localZ = (rng() - 0.5) * surface.depth * 0.75;
      const cos = Math.cos(surface.rotationY);
      const sin = Math.sin(surface.rotationY);
      const x = surface.position.x + localX * cos + localZ * sin;
      const z = surface.position.z - localX * sin + localZ * cos;
      pushFallen(x, z, surface.position.y + 0.008, 0.07 + rng() * 0.03, 0.4);
    }
  });

  const fallen = new THREE.InstancedMesh(
    fallenGeometry,
    materials.petal,
    fallenMatrices.length,
  );
  fallenMatrices.forEach((matrix, i) => {
    fallen.setMatrixAt(i, matrix);
    fallen.setColorAt(i, fallenColors[i]);
  });
  fallen.instanceMatrix.needsUpdate = true;
  if (fallen.instanceColor) fallen.instanceColor.needsUpdate = true;
  fallen.receiveShadow = true;
  fallen.castShadow = false;
  fallen.frustumCulled = false;
  fallen.name = 'fallen-petals';
  group.add(fallen);

  /* ---- Falling petals --------------------------------------------- */
  const fallingCount = 520;
  const falling = new THREE.InstancedMesh(
    geometry,
    materials.petal,
    fallingCount,
  );
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  falling.frustumCulled = false;
  falling.castShadow = false;
  falling.receiveShadow = false;
  falling.name = 'falling-petals';
  group.add(falling);

  const states = [];
  const anchorsByTree = trees.map((tree) => tree.anchors);
  const allAnchors = trees.flatMap((tree) => tree.anchors);

  function spawnFalling(state, treeIndex = null) {
    let tree;
    let anchor;
    if (treeIndex !== null && anchorsByTree[treeIndex]?.length) {
      tree = trees[treeIndex];
      anchor = anchorsByTree[treeIndex][Math.floor(rng() * anchorsByTree[treeIndex].length)];
    } else {
      tree = trees[Math.floor(rng() * trees.length)];
      const options = anchorsByTree[tree.index];
      anchor = options[Math.floor(rng() * options.length)] || tree.canopyCenter;
    }
    const angle = rng() * Math.PI * 2;
    const radius = 0.2 + rng() * (tree ? tree.canopyRadius * 0.85 : 1.3);
    state.position.set(
      anchor.x + Math.cos(angle) * radius,
      anchor.y + 0.2 + rng() * 1.3,
      anchor.z + Math.sin(angle) * radius,
    );
    state.velocity.set((rng() - 0.5) * 0.12, -(0.12 + rng() * 0.18), (rng() - 0.5) * 0.12);
    state.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
    state.spin.set((rng() - 0.5) * 2.4, (rng() - 0.5) * 2.2, (rng() - 0.5) * 2.4);
    state.phase = rng() * Math.PI * 2;
    state.sway = 0.18 + rng() * 0.32;
    state.size = 0.13 + rng() * 0.07;
    state.treeIndex = tree ? tree.index : 0;
    state.landed = false;
    state.color = makePetalColor(rng, false, state.color);
    state.colorDirty = true;
  }

  for (let i = 0; i < fallingCount; i += 1) {
    const state = {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      spin: new THREE.Vector3(),
      phase: 0,
      sway: 0,
      size: 0.1,
      treeIndex: 0,
      color: new THREE.Color(),
      colorDirty: true,
    };
    spawnFalling(state);
    // Scatter initial heights so the scene begins already alive.
    const g = groundHeightForPetals(state.position.x, state.position.z);
    const target = g + 0.3 + rng() * 5.8;
    if (treeSystem) {
      state.position.y = Math.max(g + 0.4, target);
    }
    states.push(state);
  }

  const matrixDummy = new THREE.Object3D();
  function writeAllColors() {
    states.forEach((state, index) => {
      falling.setColorAt(index, state.color);
      state.colorDirty = false;
    });
    if (falling.instanceColor) falling.instanceColor.needsUpdate = true;
  }
  function writeFallingMatrices() {
    states.forEach((state, index) => {
      matrixDummy.position.copy(state.position);
      matrixDummy.rotation.copy(state.rotation);
      matrixDummy.scale.setScalar(state.size);
      matrixDummy.updateMatrix();
      falling.setMatrixAt(index, matrixDummy.matrix);
    });
    falling.instanceMatrix.needsUpdate = true;
  }
  writeAllColors();
  writeFallingMatrices();

  function update(time, dt) {
    const step = Math.min(dt, 0.04);
    let colorsDirty = false;
    states.forEach((state, index) => {
      if (state.colorDirty) {
        falling.setColorAt(index, state.color);
        state.colorDirty = false;
        colorsDirty = true;
      }
      state.position.y += state.velocity.y * step;
      state.position.x += (
        state.velocity.x
        + Math.sin(time * 0.7 + state.phase) * state.sway * 0.12
      ) * step;
      state.position.z += (
        state.velocity.z
        + Math.cos(time * 0.57 + state.phase * 1.4) * state.sway * 0.1
      ) * step;
      state.rotation.x += state.spin.x * step;
      state.rotation.y += state.spin.y * step;
      state.rotation.z += state.spin.z * step;

      const ground = groundHeightForPetals(state.position.x, state.position.z);
      if (state.position.y < ground + 0.03) {
        // A few petals rest for a moment before another gust lifts them.
        if (rng() > 0.44) {
          spawnFalling(state);
        } else {
          state.position.y = ground + 0.04;
          state.velocity.set(0, -0.01, 0);
        }
      }
    });
    writeFallingMatrices();
    if (colorsDirty && falling.instanceColor) falling.instanceColor.needsUpdate = true;
  }

  function burst(treeIndex, amount = 150) {
    const tree = trees[treeIndex] || trees[Math.floor(rng() * trees.length)];
    if (!tree) return;
    const anchorList = anchorsByTree[tree.index];
    for (let i = 0; i < amount; i += 1) {
      const state = states[Math.floor(rng() * states.length)];
      const anchor = anchorList[Math.floor(rng() * anchorList.length)] || tree.canopyCenter;
      state.position.set(
        anchor.x + (rng() - 0.5) * tree.canopyRadius * 1.7,
        anchor.y + 0.3 + rng() * 1.2,
        anchor.z + (rng() - 0.5) * tree.canopyRadius * 1.7,
      );
      state.velocity.set((rng() - 0.5) * 0.2, -(0.16 + rng() * 0.24), (rng() - 0.5) * 0.2);
      state.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
      state.spin.set((rng() - 0.5) * 3, (rng() - 0.5) * 3, (rng() - 0.5) * 3);
      state.size = 0.12 + rng() * 0.08;
      state.phase = rng() * Math.PI * 2;
      state.color = makePetalColor(rng, false, state.color);
      state.colorDirty = true;
      state.treeIndex = tree.index;
    }
  }

  return {
    group,
    fallen,
    falling,
    update,
    burst,
    states,
    counts: {
      fallen: fallenMatrices.length,
      falling: fallingCount,
    },
  };
}
