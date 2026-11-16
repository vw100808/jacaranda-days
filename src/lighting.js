import * as THREE from 'three';

const COLOR_KEYS = [
  'sun', 'sky', 'ground', 'fill', 'glass', 'interior', 'softInterior',
  'interiorEmissive', 'softEmissive', 'lamp',
];

const PRESETS = {
  day: {
    sun: '#fff4df',
    sky: '#d5d8ed',
    ground: '#665f70',
    fill: '#aebbd8',
    glass: '#93a6ba',
    interior: '#887a79',
    softInterior: '#6b666f',
    interiorEmissive: '#ffd2a0',
    softEmissive: '#d8aa7d',
    lamp: '#ffe1b3',
    sunIntensity: 2.16,
    hemiIntensity: 0.644,
    fillIntensity: 0.239,
    ambientIntensity: 0.11,
    shadowIntensity: 0.78,
    foliageEmissive: 0.06,
    envIntensity: 0.78,
    glassOpacity: 0.6,
    glassRoughness: 0.055,
    glassEnv: 1.8,
    interiorIntensity: 0.62,
    softInteriorIntensity: 0.38,
    lampGlassEmissive: 0.02,
    lampGlassOpacity: 0.55,
    lampIntensity: 0,
    sconceIntensity: 0,
    awningIntensity: 0,
    glowOpacity: 0,
    haloOpacity: 0,
    petalEmissive: 0,
    exposure: 0.84,
  },
  dusk: {
    sun: '#ffd0a4',
    sky: '#9b91d0',
    ground: '#3f3c56',
    fill: '#8b92cc',
    glass: '#7f7a92',
    interior: '#5f4b52',
    softInterior: '#4f424d',
    interiorEmissive: '#ffb877',
    softEmissive: '#dc9663',
    lamp: '#ffc17d',
    sunIntensity: 1.05,
    hemiIntensity: 0.42,
    fillIntensity: 0.2,
    ambientIntensity: 0.08,
    shadowIntensity: 0.82,
    foliageEmissive: 0.125,
    envIntensity: 0.5,
    glassOpacity: 0.42,
    glassRoughness: 0.08,
    glassEnv: 1.2,
    interiorIntensity: 1.7,
    softInteriorIntensity: 0.7,
    lampGlassEmissive: 1.35,
    lampGlassOpacity: 0.85,
    lampIntensity: 6.2,
    sconceIntensity: 2.8,
    awningIntensity: 3.2,
    glowOpacity: 0.3,
    haloOpacity: 0.13,
    petalEmissive: 0.02,
    exposure: 1,
  },
  night: {
    sun: '#91a1e2',
    sky: '#5e63ad',
    ground: '#101322',
    fill: '#7379bd',
    glass: '#313a5e',
    interior: '#4c393e',
    softInterior: '#3b3038',
    interiorEmissive: '#ffbd73',
    softEmissive: '#e7a75b',
    lamp: '#ffc77e',
    sunIntensity: 0.44,
    hemiIntensity: 0.4,
    fillIntensity: 0.2,
    ambientIntensity: 0.06,
    shadowIntensity: 0.62,
    foliageEmissive: 0.16,
    envIntensity: 0.28,
    glassOpacity: 0.24,
    glassRoughness: 0.08,
    glassEnv: 0.9,
    interiorIntensity: 2.7,
    softInteriorIntensity: 0.9,
    lampGlassEmissive: 2.6,
    lampGlassOpacity: 0.95,
    lampIntensity: 14.5,
    sconceIntensity: 5.3,
    awningIntensity: 4.3,
    glowOpacity: 0.64,
    haloOpacity: 0.36,
    petalEmissive: 0.05,
    exposure: 1,
  },
};

export class SceneLighting {
  constructor(scene, materials, lamps, building, renderer) {
    this.scene = scene;
    this.materials = materials;
    this.lamps = lamps;
    this.building = building;
    this.renderer = renderer;
    this.mode = 'day';
    this.target = PRESETS.day;
    this.current = this.clonePreset(PRESETS.day);
    this.pointLights = [];
    this.sconceLights = [];
    this.awningLights = [];
    this.transitioning = false;
    this.transitionStart = 0;
    this.numericKeys = Object.keys(this.current).filter(
      (key) => typeof this.current[key] === 'number',
    );
    this._targetColors = {};
    COLOR_KEYS.forEach((key) => {
      this._targetColors[key] = new THREE.Color(this.target[key]);
    });
    this._setupLights();
    this.apply();
    scene.environment = materials.environment;
    this.scene.environmentIntensity = PRESETS.day.envIntensity;
  }

  clonePreset(preset) {
    const clone = { ...preset };
    COLOR_KEYS.forEach((key) => {
      clone[key] = new THREE.Color(preset[key]);
    });
    return clone;
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xfff0dd, 0xa89a88, 1.2);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
    sun.position.set(-7.5, 17.5, 13.5);
    sun.target.position.set(0, 2.5, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3.2;
    sun.shadow.blurSamples = 8;
    sun.shadow.camera.left = -12.5;
    sun.shadow.camera.right = 12.5;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -12.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 42;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.045;
    sun.shadow.intensity = 0.68;
    this.scene.add(sun.target);
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0xdfe7f0, 0.28);
    fill.position.set(-9, 7, -12);
    this.scene.add(fill);
    this.fill = fill;

    // Street lamp pools. Three compact point lights, all always in the shader
    // to avoid a shader recompile whenever the time of day changes.
    this.lamps.forEach((lamp) => {
      const light = new THREE.PointLight(0xffd1a1, 0, 8.5, 2);
      light.position.copy(lamp.position);
      light.position.y -= 0.1;
      this.scene.add(light);
      this.pointLights.push(light);
      lamp.pointLight = light;
    });

    // One warm entrance light shared by both sconces.
    const entry = this.building.entryLightPositions?.[0];
    if (entry) {
      const light = new THREE.PointLight(0xffd0a0, 0, 4.5, 2);
      light.position.copy(entry);
      light.position.y += 0.05;
      light.position.z += 0.1;
      this.scene.add(light);
      this.sconceLights.push(light);
    }

    // One soft under-awning source; the remaining pendants keep their
    // emissive bulbs and glow sprites for the look without a shader cost.
    const awningSources = this.building.awningLights || [];
    const awningSource = awningSources[Math.floor(awningSources.length / 2)];
    if (awningSource) {
      const light = new THREE.PointLight(0xffd9b0, 0, 5.2, 2);
      light.position.copy(awningSource.position);
      this.scene.add(light);
      this.awningLights.push(light);
    }
  }

  setMode(mode, instant = false) {
    if (!PRESETS[mode]) return;
    this.mode = mode;
    this.target = PRESETS[mode];
    COLOR_KEYS.forEach((key) => this._targetColors[key].set(this.target[key]));
    document.body.dataset.time = mode;
    const buttons = document.querySelectorAll('.time-switch [data-time]');
    buttons.forEach((button) => {
      const selected = button.dataset.time === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    });
    if (instant) {
      this.current = this.clonePreset(this.target);
      this.transitioning = false;
      this.transitionStart = 0;
      this.apply();
    } else {
      this.transitioning = true;
      this.transitionStart = performance.now();
    }
  }

  update(dt) {
    // Once a lighting transition has settled there is nothing to interpolate.
    // This keeps the idle frame path free of colour allocations and material
    // writes.
    if (!this.transitioning) return;
    const k = 1 - Math.exp(-2.35 * Math.min(dt, 0.08));
    // The exponential approach is visually settled well before it is exactly
    // zero. Snap on wall time after 2.6 seconds so idle frames stop touching
    // materials even when the transition runs at a lower frame rate.
    const forceSettle = (performance.now() - this.transitionStart) > 2600;
    let settled = true;

    this.numericKeys.forEach((key) => {
      this.current[key] = THREE.MathUtils.lerp(this.current[key], this.target[key], k);
      if (Math.abs(this.current[key] - this.target[key]) > 0.001) settled = false;
    });
    COLOR_KEYS.forEach((key) => {
      const target = this._targetColors[key];
      const current = this.current[key];
      current.lerp(target, k);
      const dr = current.r - target.r;
      const dg = current.g - target.g;
      const db = current.b - target.b;
      if (dr * dr + dg * dg + db * db > 0.000001) settled = false;
    });

    if (forceSettle || settled) {
      this.numericKeys.forEach((key) => {
        this.current[key] = this.target[key];
      });
      COLOR_KEYS.forEach((key) => {
        this.current[key].copy(this._targetColors[key]);
      });
      this.transitioning = false;
    }
    this.apply();
  }

  apply() {
    const c = this.current;
    if (this.renderer) this.renderer.toneMappingExposure = c.exposure;
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunIntensity;
    this.sun.shadow.intensity = c.shadowIntensity;
    this.hemi.color.copy(c.sky);
    this.hemi.groundColor.copy(c.ground);
    // Fold the old ambient fill into the hemisphere light.
    this.hemi.intensity = c.hemiIntensity + c.ambientIntensity * 0.8;
    this.fill.color.copy(c.fill);
    this.fill.intensity = c.fillIntensity;
    this.scene.environmentIntensity = c.envIntensity;

    const g = this.materials.glass;
    g.color.copy(c.glass);
    g.opacity = c.glassOpacity;
    g.roughness = c.glassRoughness;
    g.envMapIntensity = c.glassEnv;

    const warm = this.materials.windowGlow;
    warm.color.copy(c.interior);
    warm.emissive.copy(c.interiorEmissive);
    warm.emissiveIntensity = c.interiorIntensity;

    const soft = this.materials.windowGlowSoft;
    soft.color.copy(c.softInterior);
    soft.emissive.copy(c.softEmissive);
    soft.emissiveIntensity = c.softInteriorIntensity;

    const lamp = this.materials.lampGlass;
    lamp.color.copy(c.lamp);
    lamp.emissive.set('#ffc16d');
    lamp.emissiveIntensity = c.lampGlassEmissive;
    lamp.opacity = c.lampGlassOpacity;
    this.materials.bulb.color.set(c.lamp);

    this.materials.glowSprite.opacity = c.glowOpacity;
    this.materials.roadGlow.opacity = c.haloOpacity;
    this.materials.blossom.emissiveIntensity = c.petalEmissive;
    this.materials.petal.emissiveIntensity = c.petalEmissive;
    this.materials.leafFrond.emissiveIntensity = c.foliageEmissive;

    // Light visibility never changes: only intensity is animated. This keeps
    // one compiled shader program for every material across all three modes.
    this.pointLights.forEach((light) => {
      light.color.set('#ffd1a1');
      light.intensity = c.lampIntensity;
    });
    this.sconceLights.forEach((light) => {
      light.intensity = c.sconceIntensity;
    });
    this.awningLights.forEach((light) => {
      light.intensity = c.awningIntensity;
    });
  }
}
