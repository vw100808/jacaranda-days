// Shared dimensions for the miniature. One unit is roughly one metre.
export const BASE = {
  size: 18.6,
  thickness: 0.44,
  edgeRadius: 0.32,
};

export const STREET = {
  extent: 9.3,
  sidewalkY: 0.12,
  roadY: 0.048,
  curbTop: 0.175,
  frontCurbZ: 4.9,
  rightCurbX: 6.3,
  frontFarZ: 7.7,
  rightFarX: 8.4,
};

export const BUILDING = {
  xMin: -5.5,
  xMax: 4.5,
  zMin: -4.8,
  zMax: 3.2,
  radius: 1.8,
  inset: 0.34,
  baseY: STREET.sidewalkY,
  // Horizontal datums
  plinthTop: 0.62,
  firstCornice: 3.12,
  secondBase: 3.28,
  secondCornice: 6.12,
  thirdBase: 6.3,
  thirdTop: 9.16,
  parapetTop: 9.72,
  // Corner arc centre (front-right)
  get cx() {
    return this.xMax - this.radius;
  },
  get cz() {
    return this.zMax - this.radius;
  },
  // Inset third floor footprint
  get third() {
    const i = this.inset;
    return {
      xMin: this.xMin + i,
      xMax: this.xMax - i,
      zMin: this.zMin + i,
      zMax: this.zMax - i,
      radius: this.radius - i,
      cx: this.cx,
      cz: this.cz,
    };
  },
};

// The building is deliberately kept a little more modest than the trees.
// Its geometry is authored in the original coordinates and scaled once, as a
// group, when it is assembled.
export const BUILDING_SCALE = 0.9;
export const BUILDING_OFFSET = {
  x: (BUILDING.xMin + BUILDING.xMax) / 2 * (1 - BUILDING_SCALE),
  y: STREET.sidewalkY * (1 - BUILDING_SCALE),
  z: (BUILDING.zMin + BUILDING.zMax) / 2 * (1 - BUILDING_SCALE),
};

export const BALCONY = {
  depth: 0.72,
  startX: 1.8,
  endZ: -1.1,
  topY: 3.38,
  railTopY: 4.43,
};

export const AWNING = {
  depth: 0.98,
  startX: 1.55,
  endZ: -1.58,
  wallY: 6.18,
  eaveY: 5.72,
};

export const TREE_DEFS = [
  {
    id: 'front-court',
    pos: [-1.05, 4.15],
    height: 6.25,
    canopy: 3.05,
    radius: 0.2,
    lean: [-0.12, 0.05],
    seed: 11,
    note: 'front / low — beside the bench',
  },
  {
    id: 'front-left',
    pos: [-5.3, 4.15],
    height: 6.0,
    canopy: 2.9,
    radius: 0.2,
    lean: [-0.2, 0.08],
    seed: 23,
    note: 'front-left / low',
  },
  {
    id: 'left-side',
    pos: [-7.55, 0.18],
    height: 9.4,
    canopy: 3.65,
    radius: 0.24,
    lean: [-0.24, -0.04],
    seed: 37,
    note: 'left / mid',
  },
  {
    id: 'right-side',
    pos: [5.45, -2.8],
    height: 9.2,
    canopy: 3.5,
    radius: 0.22,
    lean: [0.28, -0.02],
    seed: 47,
    note: 'right / mid',
  },
  {
    id: 'back-left',
    pos: [-6.95, -7.48],
    height: 16.6,
    canopy: 4.45,
    radius: 0.28,
    lean: [-0.22, -0.18],
    seed: 59,
    note: 'rear-left / tall',
  },
  {
    id: 'back-centre',
    pos: [-0.42, -8.10],
    height: 17.6,
    canopy: 4.7,
    radius: 0.3,
    lean: [-0.05, -0.24],
    seed: 71,
    note: 'rear / tall',
  },
  {
    id: 'back-right',
    pos: [4.25, -7.02],
    height: 16.2,
    canopy: 4.3,
    radius: 0.27,
    lean: [0.2, -0.22],
    seed: 83,
    note: 'rear-right / tall',
  },
];

export const LAMP_DEFS = [
  {
    id: 'lamp-front',
    pos: [-2.82, 4.63],
    rotation: 0.08,
    key: true,
  },
  {
    id: 'lamp-right',
    pos: [5.95, -1.0],
    rotation: -0.12,
    key: false,
  },
  {
    id: 'lamp-rear',
    pos: [-3.95, -7.72],
    rotation: 0.2,
    key: false,
  },
];

export const BENCH = {
  position: [0.445, STREET.sidewalkY, 3.178],
  rotation: 0,
  length: 1.92,
};

export const PROP_POSITIONS = {
  planterLeft: [-2.615, STREET.sidewalkY, 3.115],
  planterDoor: [4.234, STREET.sidewalkY, 1.468],
  magazine: [1.86, STREET.sidewalkY, 3.09],
  bicycle: [4.3, STREET.sidewalkY, -0.575],
};

export const CAMERA_DEFAULTS = {
  target: [-0.4, 3.55, 1.0],
  yaw: 0.34,
  pitch: 0.16,
  radius: 32.2,
  fov: 33.5,
  minRadius: 12,
  maxRadius: 70,
  minPitch: 0.1,
  maxPitch: 1.1,
};

export const TIMES = ['day', 'dusk', 'night'];
export const INITIAL_TIME = 'dusk';
