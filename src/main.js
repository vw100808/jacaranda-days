import * as THREE from 'three';
import { CAMERA_DEFAULTS, INITIAL_TIME, TIMES } from './config.js';
import { createMaterials } from './materials.js';
import { buildStreetscape } from './streetscape.js';
import { buildBuilding } from './architecture.js';
import { buildProps } from './props.js';
import { buildTrees, updateTrees } from './trees.js';
import { buildPetals } from './petals.js';
import { SceneLighting } from './lighting.js';
import { MiniatureOrbit } from './controls.js';
import { batchStaticMeshes } from './utils.js';
import { liftLampGeometry } from './lamp-local-lift.js';

// Composition: keep the horizontal offset that places the miniature right of
// centre, and frame the vertical centre on the band between the first and
// second floors. The fractional building scale is 0.9, so that band is around
// world Y 2.9. Moving the look target keeps lights, shadows and interactions
// in place without translating geometry.
const COMPOSITION_SHIFT_X = -1.86;
const FRAME_CENTER_Y = 2.44;

const canvas = document.querySelector('#scene-canvas');
const loader = document.querySelector('.loader');
const toast = document.querySelector('.tap-toast');
const resetButton = document.querySelector('#reset-view');
const driftButton = document.querySelector('#toggle-drift');
const timeButtons = [...document.querySelectorAll('.time-switch [data-time]')];
const storyLinks = [...document.querySelectorAll('[data-story]')];
const storyOverlay = document.querySelector('#story-overlay');
const storyPages = [...document.querySelectorAll('[data-story-page]')];
const storyCloseButtons = [...document.querySelectorAll('[data-close-story]')];
const soundButton = document.querySelector('#toggle-sound');
const gustButton = document.querySelector('#petal-gust');
const storyShortcut = document.querySelector('#story-shortcut');
const harbourArts = [...document.querySelectorAll('[data-harbour-light]')];
const storyLightButtons = [...document.querySelectorAll('[data-story-light]')];

function showError(error) {
  console.error(error);
  const panel = document.querySelector('.fallback');
  if (panel) {
    panel.hidden = false;
    const copy = panel.querySelector('.fallback-copy');
    if (copy) copy.textContent = 'This scene needs WebGL. Please try the latest version of your browser.';
  }
  document.body.classList.add('has-error');
}

function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
  // Cap the physical buffer below the full Retina ratio. The scene is a
  // miniature and visually holds at 1.3x; this is the single largest fill-rate
  // saving on integrated GPUs. It is lowered further if frames stay slow.
  const maxDpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.15 : 1.35);
  renderer.setPixelRatio(maxDpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.__maxDpr = maxDpr;
  renderer.info.autoReset = false;
  return renderer;
}

function createApp() {
  const renderer = makeRenderer();
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAMERA_DEFAULTS.fov,
    window.innerWidth / window.innerHeight,
    // The closest permitted orbit radius is 12 units. A 0.1 near plane wasted
    // depth-buffer precision at the miniature's scale; 0.5 keeps the same
    // framing while removing the z-fighting margin at the ground line.
    0.5,
    120,
  );

  const materials = createMaterials(renderer);
  const streetscape = buildStreetscape(scene, materials);
  const building = buildBuilding(scene, materials);
  const props = buildProps(scene, materials);
  const treeSystem = buildTrees(scene, materials);
  scene.updateMatrixWorld(true);
  const pickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false,
  });
  const pickTargets = [];
  function addPickBox(box, kind) {
    const size = box.getSize(new THREE.Vector3()).addScalar(0.12);
    const center = box.getCenter(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), pickMaterial);
    hit.position.copy(center);
    hit.visible = false;
    hit.userData.pick = kind;
    hit.name = `pick-${kind}`;
    scene.add(hit);
    pickTargets.push(hit);
  }
  const magazinePickBox = new THREE.Box3().setFromObject(props.magazine);
  addPickBox(magazinePickBox, 'magazine');
  if (building.entrance?.group) {
    const doorPickBox = new THREE.Box3().setFromObject(building.entrance.group);
    addPickBox(doorPickBox, 'door');
  }
  const petals = buildPetals(scene, materials, treeSystem.trees, treeSystem, building.surfacePoints);
  const lampLift = liftLampGeometry(treeSystem, scene);
  const batchInfo = batchStaticMeshes(scene, {
    excludePrefixes: ['jacaranda-', 'pick-'],
    excludeSuffixes: ['-canopy'],
  });
  const lighting = new SceneLighting(scene, materials, streetscape.lamps, building, renderer);

  if (coarsePointer) {
    // Branch, twig and architecture shadows are enough on handheld screens;
    // drop the sun shadow resolution while keeping the same shadow silhouette.
    lighting.sun.shadow.mapSize.set(768, 768);
  }

  const controls = new MiniatureOrbit(camera, canvas, {
    onTap: (ndc) => handleTap(ndc, camera, treeSystem, petals),
  });

  let viewportTier = null;
  function tierFor(aspect) {
    if (aspect < 0.82) return 'portrait';
    if (aspect < 1.18) return 'square';
    if (aspect < 1.45) return 'compact';
    return 'wide';
  }

  function fitViewport(reset = false) {
    const aspect = window.innerWidth / window.innerHeight;
    const tier = tierFor(aspect);
    let fov = CAMERA_DEFAULTS.fov;
    let radius = CAMERA_DEFAULTS.radius;
    let targetX = -0.4;
    if (tier === 'portrait') {
      fov = 39.5;
      radius = 50.5;
      targetX = 1.15;
    } else if (tier === 'square') {
      fov = 35;
      radius = 38.5;
      targetX = 1.0;
    } else if (tier === 'compact') {
      fov = 34;
      radius = 33.9;
      targetX = 0.2;
    }
    camera.fov = fov;
    camera.updateProjectionMatrix();
    controls.defaults.fov = fov;
    controls.defaults.radius = radius;
    const framedX = targetX + COMPOSITION_SHIFT_X;
    const framedY = FRAME_CENTER_Y;
    controls.defaults.target = [framedX, framedY, 1.0];
    controls.target.set(framedX, framedY, 1.0);
    viewportTier = tier;
    if (reset) controls.reset(true);
  }
  fitViewport(true);

  const raycaster = new THREE.Raycaster();
  function handleTap(ndc, cam, treesParam, petalsParam) {
    raycaster.setFromCamera(ndc, cam);
    const proxies = treesParam.trees.map((tree) => tree.proxy);
    const hits = raycaster.intersectObjects([...pickTargets, ...proxies], false);
    if (!hits.length) return;
    const picked = hits[0].object;
    if (picked.userData.pick === 'magazine') {
      openStory('water');
      return;
    }
    if (picked.userData.pick === 'door') {
      openStory('studio');
      return;
    }
    const treeIndex = picked.userData.treeIndex;
    petalsParam.burst(treeIndex, 180);
    showToast();
    // Add a very light forward push to make the burst feel connected to the tap.
    const tree = treesParam.trees[treeIndex];
    if (tree) {
      tree.burstTime = performance.now();
    }
  }

  let toastTimer = 0;
  function showToast() {
    if (!toast) return;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1600);
  }

  function syncDriftButton() {
    if (!driftButton) return;
    const on = controls.autoDrift;
    driftButton.setAttribute('aria-pressed', String(on));
    driftButton.setAttribute('aria-label', on ? 'Pause auto tour' : 'Start auto tour');
    const state = driftButton.querySelector('.tool-state');
    if (state) state.textContent = on ? 'On' : 'Off';
  }

  function setTime(mode) {
    if (!TIMES.includes(mode)) return;
    controls.markInteraction();
    lighting.setMode(mode);
  }

  timeButtons.forEach((button) => {
    button.addEventListener('click', () => setTime(button.dataset.time));
  });
  driftButton?.addEventListener('click', () => {
    controls.markInteraction();
    controls.toggleAutoDrift();
    syncDriftButton();
  });
  resetButton?.addEventListener('click', () => {
    controls.markInteraction();
    controls.reset();
    resetButton.classList.remove('is-pressed');
    void resetButton.offsetWidth;
    resetButton.classList.add('is-pressed');
    window.setTimeout(() => resetButton.classList.remove('is-pressed'), 500);
  });
  syncDriftButton();

  // Keyboard shortcuts for desktop; controls stay primary.
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLButtonElement) return;
    if (event.key.toLowerCase() === 'r') controls.reset();
    if (event.key === '1') setTime('day');
    if (event.key === '2') setTime('dusk');
    if (event.key === '3') setTime('night');
  });


  /* ---- Story overlays ------------------------------------------------- */
  let storyOpen = false;
  let storyWasDrifting = false;
  let storyFocus = null;

  function setHarbourLight(kind = 'dusk') {
    harbourArts.forEach((art) => {
      art.hidden = art.dataset.harbourLight !== kind;
    });
    storyLightButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.storyLight === kind));
    });
  }

  function showStoryPage(kind) {
    if (!storyOverlay) return;
    storyPages.forEach((page) => {
      const active = page.dataset.storyPage === kind;
      page.hidden = !active;
      if (active) {
        // Restart the small entrance transition when switching chapters.
        page.style.animation = 'none';
        void page.offsetWidth;
        page.style.animation = '';
      }
    });
    storyOverlay.dataset.story = kind;
    if (kind === 'water') setHarbourLight(document.body.dataset.time === 'day' ? 'day' : 'dusk');
  }

  function openStory(kind = 'water') {
    if (!storyOverlay || storyOpen) return;
    storyOpen = true;
    storyFocus = document.activeElement;
    storyWasDrifting = controls.autoDrift;
    if (controls.autoDrift) {
      controls.toggleAutoDrift();
      syncDriftButton();
    }
    controls.markInteraction();
    showStoryPage(kind);
    storyOverlay.hidden = false;
    document.body.classList.add('has-story');
    window.setTimeout(() => storyOverlay.querySelector('.story-close')?.focus(), 20);
  }

  function closeStory() {
    if (!storyOverlay || !storyOpen) return;
    storyOpen = false;
    storyOverlay.hidden = true;
    document.body.classList.remove('has-story');
    if (storyWasDrifting) {
      controls.toggleAutoDrift();
      syncDriftButton();
    }
    storyWasDrifting = false;
    if (storyFocus instanceof HTMLElement) storyFocus.focus();
    storyFocus = null;
  }

  storyLinks.forEach((link) => {
    link.addEventListener('click', () => openStory(link.dataset.story));
  });
  storyCloseButtons.forEach((button) => {
    button.addEventListener('click', closeStory);
  });
  storyLightButtons.forEach((button) => {
    button.addEventListener('click', () => setHarbourLight(button.dataset.storyLight));
  });
  storyOverlay?.addEventListener('click', (event) => {
    const next = event.target.closest('[data-story-next]');
    if (next) { showStoryPage('studio'); return; }
    const back = event.target.closest('[data-story-next-back]');
    if (back) { showStoryPage('water'); return; }
  });

  /* ---- Ambient sound -------------------------------------------------- */
  let audioContext = null;
  let audioMaster = null;
  let audioChimeTimer = 0;
  let audioOn = false;

  function buildAudioGraph() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    const context = new AudioCtx();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    // Soft filtered street air, generated locally (no external asset).
    const length = context.sampleRate * 4;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.06;
      channel[i] = last;
    }
    const air = context.createBufferSource();
    air.buffer = buffer;
    air.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;
    lowpass.Q.value = 0.4;
    const airGain = context.createGain();
    airGain.gain.value = 0.12;
    air.connect(lowpass).connect(airGain).connect(master);
    air.start();

    function chime() {
      if (!audioOn) return;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660 + Math.random() * 220;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + 2.5);
    }

    audioContext = context;
    audioMaster = master;
    audioChimeTimer = window.setInterval(chime, 7800);
    window.setTimeout(chime, 900);
    return true;
  }

  function setSound(on) {
    if (on) {
      if (!audioContext && !buildAudioGraph()) return;
      audioOn = true;
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      audioMaster.gain.cancelScheduledValues(now);
      audioMaster.gain.setValueAtTime(audioMaster.gain.value, now);
      audioMaster.gain.linearRampToValueAtTime(0.55, now + 0.9);
    } else {
      audioOn = false;
      if (audioContext && audioMaster) {
        const now = audioContext.currentTime;
        audioMaster.gain.cancelScheduledValues(now);
        audioMaster.gain.setValueAtTime(audioMaster.gain.value, now);
        audioMaster.gain.linearRampToValueAtTime(0, now + 0.5);
      }
      if (audioChimeTimer) {
        window.clearInterval(audioChimeTimer);
        audioChimeTimer = 0;
      }
    }
    if (soundButton) {
      soundButton.setAttribute('aria-pressed', String(on));
      soundButton.setAttribute('aria-label', on ? 'Turn ambient sound off' : 'Turn ambient sound on');
    }
  }

  soundButton?.addEventListener('click', () => setSound(!audioOn));
  storyShortcut?.addEventListener('click', () => openStory('water'));

  /* ---- Breeze / petal gust ------------------------------------------ */
  gustButton?.addEventListener('click', () => {
    treeSystem.trees.forEach((tree, index) => {
      petals.burst(index, 65);
      tree.burstTime = performance.now();
    });
    showToast();
  });

  /* Keyboard: Escape closes an open story. */
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && storyOpen) closeStory();
  });

  // Expose the story commands for lightweight manual/debug checks.
  window.__JACARANDA_STORY__ = { open: openStory, close: closeStory };

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    const nextTier = tierFor(camera.aspect);
    const tierChanged = nextTier !== viewportTier;
    fitViewport(false);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (tierChanged) controls.reset();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => window.setTimeout(onResize, 80));

  const clock = new THREE.Clock();
  let frame = 0;
  let elapsed = 0;
  let firstRendered = false;
  const quality = { frames: 0, time: 0 };

  // The only shadow casters that move are the twigs, whose sway is a small
  // fraction of a degree. The sun position is static, so the complete shadow
  // map is generated once and then cached for the life of the scene. This
  // removes an entire depth pass from every interactive frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  function adaptQuality(dt) {
    // Sample ~1.5 s of frames, then drop the physical buffer stepwise if the
    // device is consistently below 40 fps. Never scale back up in-session: that
    // avoids visible resolution pumping while orbiting.
    quality.frames += 1;
    quality.time += dt;
    if (quality.frames < 90) return;
    const average = quality.time / quality.frames;
    quality.frames = 0;
    quality.time = 0;
    const current = renderer.getPixelRatio();
    if (average > 0.025 && current > 1.0) {
      renderer.setPixelRatio(Math.max(1.0, Math.round((current - 0.15) * 100) / 100));
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    adaptQuality(dt);
    controls.update(dt);
    updateTrees(treeSystem, elapsed);
    petals.update(elapsed, dt);
    lighting.update(dt);
    renderer.info.reset();
    renderer.render(scene, camera);

    if (!firstRendered) {
      firstRendered = true;
      window.setTimeout(() => {
        document.body.classList.add('is-ready');
        loader?.classList.add('is-hidden');
      }, 120);
    }
    frame += 1;
  }

  lighting.setMode(INITIAL_TIME, true);
  controls.reset(true);
  renderer.compile(scene, camera);
  animate();

  const debug = {
    scene,
    camera,
    renderer,
    controls,
    lighting,
    materials,
    streetscape,
    building,
    props,
    trees: treeSystem.trees,
    treeSystem,
    batchInfo,
    petals,
    setTime,
    resetCamera: () => controls.reset(),
    toggleDrift: () => {
      controls.toggleAutoDrift();
      syncDriftButton();
      return controls.autoDrift;
    },
    setCamera: ({ yaw, pitch, radius } = {}) => {
      if (Number.isFinite(yaw)) controls.goalYaw = yaw;
      if (Number.isFinite(pitch)) {
        controls.goalPitch = THREE.MathUtils.clamp(
          pitch,
          controls.minPitch,
          controls.maxPitch,
        );
      }
      if (Number.isFinite(radius)) {
        controls.goalRadius = THREE.MathUtils.clamp(
          radius,
          controls.minRadius,
          controls.maxRadius,
        );
      }
    },
    burst: (treeIndex = 0) => petals.burst(treeIndex, 180),
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      frames: frame,
      elapsed,
      fallenPetals: petals.counts.fallen,
      fallingPetals: petals.counts.falling,
      leaves: treeSystem.trees.reduce((sum, tree) => sum + tree.leafCount, 0),
      trees: treeSystem.trees.length,
      batches: batchInfo.batchCount,
      mode: lighting.mode,
      camera: controls.getState(),
    }),
  };

  window.__JACARANDA__ = debug;
  window.__JACARANDA_READY__ = true;
  return debug;
}

try {
  createApp();
} catch (error) {
  showError(error);
}
