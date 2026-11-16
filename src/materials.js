import * as THREE from 'three';
import {
  makeDrainTexture,
  makeGrateTexture,
  makePavingTexture,
  makeRadialTexture,
  makeRoadTexture,
  makeShadowTexture,
  makeWallTexture,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* Stylised environment                                                */
/* ------------------------------------------------------------------ */

function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(42, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#f7efe1') },
        horizon: { value: new THREE.Color('#d8d4de') },
        low: { value: new THREE.Color('#b4b9c4') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 low;
        void main() {
          float h = normalize(vWorld).y;
          vec3 col = mix(horizon, top, smoothstep(0.0, 0.85, h));
          col = mix(low, col, smoothstep(-0.32, 0.08, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(36, 40),
    new THREE.MeshBasicMaterial({ color: '#a79d90' }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.2;
  envScene.add(floor);

  const cards = [
    [14, 9, 19, 8, 10, '#fff2d8'],
    [-17, 7, 8, 7, 12, '#aeb7d4'],
    [1, 12, -20, 14, 6, '#efe6ff'],
  ];
  cards.forEach(([x, y, z, w, h, color]) => {
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }),
    );
    card.position.set(x, y, z);
    card.lookAt(0, 3, 0);
    envScene.add(card);
  });

  const target = pmrem.fromScene(envScene, 0.02);
  sky.geometry.dispose();
  sky.material.dispose();
  floor.geometry.dispose();
  floor.material.dispose();
  envScene.traverse((object) => {
    if (object.isMesh && object !== sky && object !== floor) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  pmrem.dispose();
  return target.texture;
}

function makeToonGradient() {
  const values = [48, 105, 172, 224, 255];
  const data = new Uint8Array(values.length * 4);
  values.forEach((value, i) => {
    data[i * 4 + 0] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  });
  const texture = new THREE.DataTexture(data, values.length, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export function createMaterials(renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const gradientMap = makeToonGradient();
  const environment = createEnvironment(renderer);

  const toon = (color, extra = {}) =>
    new THREE.MeshToonMaterial({
      color,
      gradientMap,
      ...extra,
    });

  const pavingBase = makePavingTexture(anisotropy);
  const roadBase = makeRoadTexture(anisotropy);
  const wallTexture = makeWallTexture(anisotropy);
  const grateTexture = makeGrateTexture(anisotropy);
  const drainTexture = makeDrainTexture(anisotropy);
  const radialTexture = makeRadialTexture(anisotropy);
  const shadowTexture = makeShadowTexture(anisotropy);

  const pavingMaterials = new Map();
  function pavingMaterial(width, depth) {
    const key = `${width.toFixed(1)}x${depth.toFixed(1)}`;
    if (pavingMaterials.has(key)) return pavingMaterials.get(key);
    const map = pavingBase.clone();
    map.needsUpdate = true;
    map.repeat.set(Math.max(1, width / 1.65), Math.max(1, depth / 1.65));
    const material = toon('#eeeaf2', { map });
    material.name = `paving-${key}`;
    pavingMaterials.set(key, material);
    return material;
  }

  const roadMaterials = new Map();
  function roadMaterial(width, depth) {
    const key = `${width.toFixed(1)}x${depth.toFixed(1)}`;
    if (roadMaterials.has(key)) return roadMaterials.get(key);
    const map = roadBase.clone();
    map.needsUpdate = true;
    map.repeat.set(Math.max(1, width / 3.8), Math.max(1, depth / 3.8));
    const material = new THREE.MeshStandardMaterial({
      color: '#e5e1eb',
      map,
      roughness: 0.9,
      metalness: 0.03,
      envMapIntensity: 0.18,
    });
    material.name = `road-${key}`;
    roadMaterials.set(key, material);
    return material;
  }

  const materials = {
    gradientMap,
    environment,
    pavingBase,
    roadBase,
    wallTexture,
    grateTexture,
    drainTexture,
    radialTexture,
    shadowTexture,
    pavingMaterial,
    roadMaterial,

    // Toon architecture
    wallCream: toon('#efe2ca', { map: wallTexture }),
    wallCreamUpper: toon('#f2e6d1', { map: wallTexture }),
    wallShade: toon('#d9c9b2', { map: wallTexture }),
    trim: toon('#f7f0e2'),
    trimWarm: toon('#eee1c8'),
    windowReveal: toon('#3b3540'),
    stone: toon('#c6b9a5'),
    stoneLight: toon('#ded2c0'),
    stoneDark: toon('#a99d8e'),
    plinth: toon('#bcae9b'),
    roof: toon('#a99a8b'),
    roofMetal: new THREE.MeshStandardMaterial({
      color: '#8d979e',
      roughness: 0.52,
      metalness: 0.42,
      envMapIntensity: 0.7,
    }),
    awningMetal: new THREE.MeshStandardMaterial({
      color: '#aeb4b7',
      roughness: 0.46,
      metalness: 0.55,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
    awningTrim: toon('#6c7178'),
    iron: new THREE.MeshStandardMaterial({
      color: '#292b31',
      roughness: 0.42,
      metalness: 0.72,
      envMapIntensity: 0.9,
    }),
    ironSoft: toon('#3b3c42'),
    silverMetal: new THREE.MeshStandardMaterial({
      color: '#d4d2ce',
      roughness: 0.3,
      metalness: 0.82,
      envMapIntensity: 1.2,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: '#c79d57',
      roughness: 0.3,
      metalness: 0.82,
      envMapIntensity: 1.3,
    }),
    woodPurple: toon('#71528a'),
    woodPurpleLight: toon('#8c6ba7'),
    woodDark: toon('#4d3a5d'),
    terracotta: toon('#b8775e'),
    terracottaLight: toon('#c98f73'),
    ceramicCream: toon('#e4d2b9'),
    soil: toon('#57483c'),
    branch: toon('#382823'),
    roadPaint: new THREE.MeshBasicMaterial({
      color: '#f4f1f8',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    }),
    curb: toon('#c6c3ca'),
    curbEdge: toon('#8b8795'),
    darkMetal: new THREE.MeshStandardMaterial({
      color: '#26292c',
      roughness: 0.5,
      metalness: 0.65,
    }),
    grate: new THREE.MeshStandardMaterial({
      map: grateTexture,
      transparent: true,
      alphaTest: 0.22,
      roughness: 0.64,
      metalness: 0.55,
      color: '#ffffff',
      side: THREE.DoubleSide,
      depthWrite: true,
    }),
    drain: new THREE.MeshStandardMaterial({
      map: drainTexture,
      roughness: 0.6,
      metalness: 0.55,
      color: '#ffffff',
      side: THREE.DoubleSide,
    }),
    posterFrame: toon('#4b403c'),
    paper: toon('#efe7d7'),
    roadGlow: new THREE.MeshBasicMaterial({
      map: radialTexture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      color: '#ffd48c',
    }),

    // Glass / light
    glass: new THREE.MeshPhysicalMaterial({
      color: '#758196',
      metalness: 0.12,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    }),
    windowGlow: new THREE.MeshStandardMaterial({
      color: '#4a4450',
      emissive: new THREE.Color('#ffbd6d'),
      emissiveIntensity: 0.02,
      roughness: 0.9,
      metalness: 0,
    }),
    windowGlowSoft: new THREE.MeshStandardMaterial({
      color: '#3e3a46',
      emissive: new THREE.Color('#e3a65d'),
      emissiveIntensity: 0.01,
      roughness: 0.9,
      metalness: 0,
    }),
    lampGlass: new THREE.MeshStandardMaterial({
      color: '#ffe3ad',
      emissive: new THREE.Color('#ffc46f'),
      emissiveIntensity: 0.05,
      roughness: 0.26,
      metalness: 0.05,
      transparent: true,
      opacity: 0.78,
    }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffd89a', toneMapped: false }),
    glowSprite: new THREE.SpriteMaterial({
      map: radialTexture,
      color: '#ffcb7f',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
    awningGlow: new THREE.MeshBasicMaterial({
      map: radialTexture,
      color: '#ffd18b',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    // Vertex colours are authored per foliage / blossom / petal geometry.
    leafFrond: new THREE.MeshToonMaterial({
      color: '#ffffff',
      vertexColors: true,
      gradientMap,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#2c1a56'),
      emissiveIntensity: 0.1,
    }),

    blossom: new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#6c509c'),
      emissiveIntensity: 0,
    }),
    petal: new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#6c509c'),
      emissiveIntensity: 0,
    }),
    leaflet: toon('#5b4566', { side: THREE.DoubleSide }),
  };

  materials.leaflet.side = THREE.DoubleSide;

  // Sheen and paper backings are shared so the time-of-day system can
  // adjust them without rebuilding a single object.
  materials.glowMaterials = [materials.windowGlow, materials.windowGlowSoft];
  materials.lampGlowMaterials = [materials.lampGlass];
  return materials;
}


