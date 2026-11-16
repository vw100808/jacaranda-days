import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ranged(random, min, max) {
  return min + (max - min) * random();
}

export function pick(random, array) {
  return array[Math.floor(random() * array.length) % array.length];
}

export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/* Plan-space shapes (x, z -> extruded up the Y axis)                  */
/* ------------------------------------------------------------------ */

export function planShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    const y = -z;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

/**
 * Extrude a list of [x, z] points upward into the scene.
 * The local +Y of the resulting geometry is up.
 */
export function extrudePlan(points, height, yBase = 0, options = {}) {
  const shape = planShape(points);
  const { bevel = 0, bevelSegments = 2, curveSegments = 18 } = options;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, yBase, 0);
  geometry.computeVertexNormals();
  return geometry;
}

export function flatPlan(points, y = 0) {
  const shape = planShape(points);
  const geometry = new THREE.ShapeGeometry(shape, 18);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/**
 * Vertical ribbon following a 2D contour.
 */
export function makeSpokeRibbon(points, height, yBottom = 0) {
  const positions = [];
  const indices = [];
  points.forEach(([x, z]) => {
    positions.push(x, yBottom + height, z, x, yBottom, z);
  });
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function roundedSquarePoints(size, radius, segments = 7) {
  const h = size / 2;
  const r = radius;
  const pts = [];
  const corners = [
    [h - r, h - r, 0],
    [-h + r, h - r, Math.PI / 2],
    [-h + r, -h + r, Math.PI],
    [h - r, -h + r, (Math.PI * 3) / 2],
  ];
  corners.forEach(([cx, cz, a0]) => {
    for (let i = 0; i <= segments; i += 1) {
      const a = a0 + (i / segments) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  });
  return pts;
}

export function arcPoints(cx, cz, radius, start, end, segments = 16) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = start + ((end - start) * i) / segments;
    pts.push([cx + Math.sin(a) * radius, cz + Math.cos(a) * radius]);
  }
  return pts;
}

/**
 * The public corner trace: front edge -> rounded corner -> right edge.
 * Angles follow CylinderGeometry convention: x = cx + r sin(a),
 * z = cz + r cos(a).
 */
export function cornerTrace(radius = 1, segments = 16) {
  return arcPoints(0, 0, radius, 0, Math.PI / 2, segments);
}

/* ------------------------------------------------------------------ */
/* Canvas textures                                                     */
/* ------------------------------------------------------------------ */

export function canvasTexture(width, height, paint, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.RepeatWrapping;
  texture.wrapT = options.wrapT ?? THREE.RepeatWrapping;
  texture.anisotropy = options.anisotropy ?? 4;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

export function makePavingTexture(anisotropy = 4) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#d3ced6';
      ctx.fillRect(0, 0, w, h);
      const random = mulberry32(875);

      // Subtle stone-clouding rather than photographic noise.
      for (let i = 0; i < 180; i += 1) {
        const x = random() * w;
        const y = random() * h;
        const r = 8 + random() * 58;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        const light = random() > 0.5;
        grad.addColorStop(0, light ? 'rgba(255,253,251,0.10)' : 'rgba(60,54,74,0.055)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      ctx.strokeStyle = 'rgba(82, 77, 94, 0.22)';
      ctx.lineWidth = 2;
      const step = 128;
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let row = 0; row < h / step; row += 1) {
        const offset = (row % 2) * step * 0.5;
        for (let x = offset; x <= w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, row * step);
          ctx.lineTo(x, (row + 1) * step);
          ctx.stroke();
        }
      }
      // Hairline wear along joints.
      ctx.strokeStyle = 'rgba(255, 253, 255, 0.30)';
      ctx.lineWidth = 1;
      for (let y = 1; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 1.5);
        ctx.lineTo(w, y + 1.5);
        ctx.stroke();
      }
    },
    { anisotropy, repeat: [1, 1] },
  );
}

export function makeWallTexture(anisotropy = 4) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#fbf7ef';
      ctx.fillRect(0, 0, w, h);
      const random = mulberry32(6131);

      // Low-contrast stucco clouding; intentionally understated so the
      // toon bands remain the main source of shape.
      for (let i = 0; i < 110; i += 1) {
        const x = random() * w;
        const y = random() * h;
        const rx = 5 + random() * 32;
        const ry = 4 + random() * 24;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        const darker = random() > 0.52;
        grad.addColorStop(0, darker ? 'rgba(123, 105, 88, 0.035)' : 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      }

      // A few faint vertical weather streaks.
      for (let i = 0; i < 18; i += 1) {
        const x = random() * w;
        const y0 = random() * h;
        const length = 18 + random() * 80;
        const grad = ctx.createLinearGradient(0, y0, 0, y0 + length);
        grad.addColorStop(0, 'rgba(102, 86, 70, 0)');
        grad.addColorStop(0.5, 'rgba(102, 86, 70, 0.03)');
        grad.addColorStop(1, 'rgba(102, 86, 70, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + length);
        ctx.stroke();
      }
    },
    { repeat: [2.2, 2.2], anisotropy },
  );
}

export function makeRoadTexture(anisotropy = 4) {
  return canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      // Fine, slightly warm asphalt aggregate instead of a flat dark panel.
      ctx.fillStyle = '#4a4d58';
      ctx.fillRect(0, 0, w, h);
      const random = mulberry32(408);
      for (let i = 0; i < 26000; i += 1) {
        const x = random() * w;
        const y = random() * h;
        const r = 0.35 + random() * 1.7;
        ctx.fillStyle = random() > 0.58
          ? `rgba(218, 219, 229, ${0.035 + random() * 0.11})`
          : `rgba(9, 11, 17, ${0.045 + random() * 0.18})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Larger aggregate islands and a few repaired patches.
      for (let i = 0; i < 80; i += 1) {
        const x = random() * w;
        const y = random() * h;
        const r = 2 + random() * 7;
        ctx.fillStyle = `rgba(160, 158, 170, ${0.025 + random() * 0.055})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 3; i += 1) {
        const x = random() * w;
        const y = random() * h;
        ctx.fillStyle = i % 2 ? 'rgba(20,21,28,0.18)' : 'rgba(116,113,124,0.08)';
        ctx.beginPath();
        ctx.ellipse(x, y, 45 + random() * 70, 18 + random() * 30, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // Quiet tar seams and hairline cracks.
      ctx.strokeStyle = 'rgba(9, 11, 17, 0.36)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        const y0 = h * (0.15 + i * 0.31);
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(w * 0.28, y0 - 18, w * 0.62, y0 + 24, w, y0 - 5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(12, 14, 21, 0.34)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i += 1) {
        const x = random() * w;
        const y = random() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18 + random() * 46, y + 12 + random() * 30);
        ctx.lineTo(x + 34 + random() * 60, y + 5 + random() * 28);
        ctx.stroke();
      }
      // Worn wheel tracks, very low contrast.
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(10,11,16,0)');
      grad.addColorStop(0.28, 'rgba(10,11,16,0.08)');
      grad.addColorStop(0.5, 'rgba(10,11,16,0)');
      grad.addColorStop(0.72, 'rgba(10,11,16,0.08)');
      grad.addColorStop(1, 'rgba(10,11,16,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    { anisotropy, repeat: [1, 1] },
  );
}

export function makeGrateTexture(anisotropy = 8) {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const c = w / 2;
      ctx.translate(c, c);
      ctx.strokeStyle = '#3a4140';
      ctx.fillStyle = '#3a4140';
      ctx.lineCap = 'round';

      // Outer frame.
      ctx.lineWidth = 24;
      ctx.strokeRect(-232, -232, 464, 464);
      ctx.lineWidth = 10;
      ctx.strokeRect(-196, -196, 392, 392);

      // Concentric square rings, interrupted at the trunk.
      const rings = [-158, -112, -64];
      rings.forEach((r, index) => {
        ctx.lineWidth = index === 0 ? 11 : 8;
        ctx.beginPath();
        ctx.rect(r, r, -r * 2, -r * 2);
        ctx.stroke();
      });

      // Radial slots.
      for (let i = 0; i < 18; i += 1) {
        const angle = (i / 18) * Math.PI * 2 + Math.PI / 36;
        ctx.save();
        ctx.rotate(angle);
        ctx.lineWidth = i % 3 === 0 ? 11 : 7;
        ctx.beginPath();
        ctx.moveTo(-188, 0);
        ctx.lineTo(-78, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 72, 0, Math.PI * 2);
      ctx.fillStyle = '#252a29';
      ctx.fill();
    },
    { anisotropy, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping },
  );
}

export function makeDrainTexture(anisotropy = 8) {
  return canvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#3c4140';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1f2525';
      ctx.lineWidth = 5;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      for (let x = 22; x < w - 16; x += 18) {
        const gradient = ctx.createLinearGradient(x, 0, x + 8, 0);
        gradient.addColorStop(0, '#202525');
        gradient.addColorStop(0.6, '#5c6260');
        gradient.addColorStop(1, '#202525');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 18, 9, h - 36);
      }
    },
    { anisotropy, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping },
  );
}

export function makeRadialTexture(anisotropy = 4) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.28, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    {
      anisotropy,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.NoColorSpace,
    },
  );
}

export function makeShadowTexture(anisotropy = 4) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(42, 31, 50, 0.5)');
      g.addColorStop(0.42, 'rgba(42, 31, 50, 0.24)');
      g.addColorStop(0.78, 'rgba(42, 31, 50, 0.055)');
      g.addColorStop(1, 'rgba(42, 31, 50, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    {
      anisotropy,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.NoColorSpace,
    },
  );
}

export function makePosterTexture({ title, kicker, dates, accent = '#7762a4' }, anisotropy = 8) {
  return canvasTexture(
    512,
    720,
    (ctx, w, h) => {
      ctx.fillStyle = '#f3eee1';
      ctx.fillRect(0, 0, w, h);
      const random = mulberry32(title.length * 977 + 31);

      // Loose botanical illustration, hand-painted flat shapes.
      ctx.save();
      ctx.translate(w * 0.68, h * 0.58);
      for (let b = 0; b < 3; b += 1) {
        ctx.save();
        ctx.rotate(-0.55 + b * 0.5 + random() * 0.2);
        ctx.strokeStyle = 'rgba(76, 62, 48, 0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 80);
        ctx.bezierCurveTo(-10, 20, 18, -50, 30, -132);
        ctx.stroke();
        for (let i = 0; i < 7; i += 1) {
          const t = i / 6;
          const x = 8 + 24 * t;
          const y = 50 - 170 * t;
          ctx.fillStyle = i % 2 === 0 ? '#9276bf' : '#b29cda';
          ctx.beginPath();
          ctx.ellipse(x + 22, y - 12, 28, 17, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#6b548f';
          ctx.beginPath();
          ctx.ellipse(x + 8, y - 4, 9, 6, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();

      ctx.fillStyle = '#2e2a2c';
      ctx.font = '600 25px "Helvetica Neue", Arial, sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText(kicker.toUpperCase(), 48, 74);
      ctx.fillStyle = accent;
      ctx.fillRect(48, 100, 68, 8);

      ctx.fillStyle = '#2e2a2c';
      ctx.font = 'italic 84px Georgia, serif';
      ctx.fillText(title, 44, 220);
      ctx.font = 'italic 52px Georgia, serif';
      ctx.fillText('in bloom', 46, 278);

      ctx.fillStyle = '#514b4d';
      ctx.font = '500 22px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(dates.toUpperCase(), 48, h - 98);
      ctx.fillText('WALSH BAY · SYDNEY', 48, h - 62);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(w - 66, h - 68, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f3eee1';
      ctx.beginPath();
      ctx.arc(w - 66, h - 68, 9, 0, Math.PI * 2);
      ctx.fill();
    },
    {
      anisotropy,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    },
  );
}

/* ------------------------------------------------------------------ */
/* Geometry accumulation                                               */
/* ------------------------------------------------------------------ */

export class GeometryAccumulator {
  constructor() {
    this.parts = [];
  }

  add(geometry, matrix = null) {
    let part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) part.applyMatrix4(matrix);
    this.parts.push(part);
    return this;
  }

  addTransformed(geometry, position, rotation = null, scale = null) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    if (rotation) {
      if (rotation.isQuaternion) quaternion.copy(rotation);
      else quaternion.setFromEuler(new THREE.Euler(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0));
    }
    matrix.compose(
      new THREE.Vector3(...position),
      quaternion,
      scale ? new THREE.Vector3(...scale) : new THREE.Vector3(1, 1, 1),
    );
    return this.add(geometry, matrix);
  }

  build() {
    if (!this.parts.length) return null;
    const attributes = ['position', 'normal', 'uv'];
    const sources = [];
    const totals = Object.fromEntries(attributes.map((name) => [name, 0]));

    this.parts.forEach((part) => {
      attributes.forEach((name) => {
        if (part.getAttribute(name)) {
          sources.push({ part, name });
          totals[name] += part.getAttribute(name).count;
        }
      });
    });

    const merged = new THREE.BufferGeometry();
    attributes.forEach((name) => {
      const total = totals[name];
      if (!total) return;
      const itemSize = this.parts.find((part) => part.getAttribute(name))?.getAttribute(name).itemSize || 1;
      const array = new Float32Array(total * itemSize);
      let offset = 0;
      this.parts.forEach((part) => {
        const attribute = part.getAttribute(name);
        if (!attribute) {
          offset += part.getAttribute('position').count * itemSize;
          return;
        }
        array.set(attribute.array, offset);
        offset += attribute.array.length;
      });
      merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
    });

    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    this.parts.forEach((part) => part.dispose());
    this.parts.length = 0;
    return merged;
  }
}

/* ------------------------------------------------------------------ */
/* Small scene helpers                                                 */
/* ------------------------------------------------------------------ */

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function setShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = cast;
    child.receiveShadow = receive;
  });
  return object;
}

export function addContactShadow(parent, texture, x, z, sx, sz, opacity = 0.55, y = 0.006) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

export function instancedFromMatrices(geometry, material, matrices, options = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  for (let i = 0; i < matrices.length; i += 1) {
    mesh.setMatrixAt(i, matrices[i]);
    if (options.colors && options.colors[i]) mesh.setColorAt(i, options.colors[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  mesh.frustumCulled = options.frustumCulled ?? true;
  return mesh;
}

export function matrixBetween(a, b, radius, taper = 1) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  const matrix = new THREE.Matrix4().compose(
    center,
    quat,
    new THREE.Vector3(radius, length, radius * taper),
  );
  return matrix;
}

export function makePlaceholderMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xff00ff });
}

/**
 * Batch static meshes by material, shadow flags and render order. This is the
 * main draw-call lever for the finished miniature: once the world is built,
 * every static surface can share one buffer per material state while the
 * instanced canopies and animated petals remain independent.
 */
export function batchStaticMeshes(scene, options = {}) {
  const {
    exclude = [],
    excludePrefixes = [],
    excludeSuffixes = ['-canopy'],
  } = options;

  scene.updateMatrixWorld(true);
  const excluded = new Set(exclude);
  const groups = new Map();
  const meshes = [];

  scene.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSprite) return;
    if (!object.geometry || !object.material) return;
    if (Array.isArray(object.material)) return;

    let node = object;
    while (node && node !== scene) {
      if (excluded.has(node.name)) return;
      if (excludePrefixes.some((prefix) => node.name.startsWith(prefix))) return;
      if (excludeSuffixes.some((suffix) => node.name.endsWith(suffix))) return;
      node = node.parent;
    }

    const material = object.material;
    const key = [
      material.uuid,
      object.castShadow ? 1 : 0,
      object.receiveShadow ? 1 : 0,
      object.renderOrder,
      object.visible ? 1 : 0,
      object.layers.mask,
    ].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        material,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        renderOrder: object.renderOrder,
        meshes: [],
      });
    }
    groups.get(key).meshes.push(object);
    meshes.push(object);
  });

  const mergedMeshes = [];
  const removedGeometries = new Set();
  groups.forEach((group) => {
    if (group.meshes.length < 2) return;

    const attributeNames = new Set();
    group.meshes.forEach((mesh) => {
      Object.keys(mesh.geometry.attributes).forEach((name) => attributeNames.add(name));
    });

    const prepared = [];
    let vertexCount = 0;
    group.meshes.forEach((mesh) => {
      const source = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      source.applyMatrix4(mesh.matrixWorld);
      prepared.push(source);
      vertexCount += source.getAttribute('position').count;
    });

    const geometry = new THREE.BufferGeometry();
    attributeNames.forEach((name) => {
      let itemSize = 1;
      let normalized = false;
      for (const part of prepared) {
        const attr = part.getAttribute(name);
        if (attr) {
          itemSize = attr.itemSize;
          normalized = attr.normalized;
          break;
        }
      }
      const array = new Float32Array(vertexCount * itemSize);
      let writeOffset = 0;
      prepared.forEach((part) => {
        const count = part.getAttribute('position').count;
        const attr = part.getAttribute(name);
        if (attr && attr.itemSize === itemSize) {
          array.set(attr.array, writeOffset);
        }
        writeOffset += count * itemSize;
      });
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(array, itemSize, normalized),
      );
    });

    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    const merged = new THREE.Mesh(geometry, group.material);
    merged.castShadow = group.castShadow;
    merged.receiveShadow = group.receiveShadow;
    merged.renderOrder = group.renderOrder;
    merged.name = `batch-${group.material.name || group.material.type}`;
    merged.frustumCulled = true;
    scene.add(merged);
    mergedMeshes.push(merged);

    group.meshes.forEach((mesh) => {
      removedGeometries.add(mesh.geometry);
      mesh.parent?.remove(mesh);
    });
    prepared.forEach((part) => part.dispose());
  });

  // The merged meshes own fresh buffers now. Release the now-unreferenced
  // source geometries, but only if no remaining object still uses the same
  // geometry (some props share geometry between copies).
  const liveGeometries = new Set();
  scene.traverse((object) => {
    if (object.isMesh && object.geometry) liveGeometries.add(object.geometry);
  });
  removedGeometries.forEach((geometry) => {
    if (!liveGeometries.has(geometry)) geometry.dispose();
  });

  return {
    batchCount: mergedMeshes.length,
    mergedObjectCount: meshes.filter((mesh) => !mesh.parent).length,
    meshes: mergedMeshes,
  };
}
