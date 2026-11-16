import * as THREE from 'three';
import { CAMERA_DEFAULTS } from './config.js';

/**
 * Small, dependency-free orbit controller tuned for this miniature.
 * Drag = orbit, wheel/pinch = zoom, tap = scene pick.
 */
export class MiniatureOrbit {
  constructor(camera, element, options = {}) {
    this.camera = camera;
    this.element = element;
    this.target = new THREE.Vector3(...CAMERA_DEFAULTS.target);
    this.defaults = {
      target: [...CAMERA_DEFAULTS.target],
      yaw: CAMERA_DEFAULTS.yaw,
      pitch: CAMERA_DEFAULTS.pitch,
      radius: CAMERA_DEFAULTS.radius,
      fov: CAMERA_DEFAULTS.fov,
    };
    this.yaw = this.defaults.yaw;
    this.pitch = this.defaults.pitch;
    this.radius = this.defaults.radius;
    this.goalYaw = this.yaw;
    this.goalPitch = this.pitch;
    this.goalRadius = this.radius;
    this.minPitch = CAMERA_DEFAULTS.minPitch;
    this.maxPitch = CAMERA_DEFAULTS.maxPitch;
    this.minRadius = CAMERA_DEFAULTS.minRadius;
    this.maxRadius = CAMERA_DEFAULTS.maxRadius;
    this.pointers = new Map();
    this.lastGestureDistance = 0;
    this.lastCenter = null;
    this.dragDistance = 0;
    this.pointerDownAt = 0;
    this.pointerDownPosition = null;
    this.onTap = options.onTap ?? null;
    this.enabled = true;
    this.dragging = false;
    this.autoDrift = options.autoDrift ?? true;
    this.driftTime = 0;
    this.driftAmount = 0;
    this.lastInteraction = performance.now();
    this.driftYaw = 0;
    this.driftPitch = 0;
    this.driftRadius = 0;
    this._tmpVec = new THREE.Vector3();
    this._bind();

    this.applyCamera();
  }

  _bind() {
    this._onPointerDown = this._pointerDown.bind(this);
    this._onPointerMove = this._pointerMove.bind(this);
    this._onPointerUp = this._pointerUp.bind(this);
    this._onWheel = this._wheel.bind(this);
    this._onContextMenu = (event) => event.preventDefault();

    this.element.addEventListener('pointerdown', this._onPointerDown);
    this.element.addEventListener('pointermove', this._onPointerMove);
    this.element.addEventListener('pointerup', this._onPointerUp);
    this.element.addEventListener('pointercancel', this._onPointerUp);
    this.element.addEventListener('wheel', this._onWheel, { passive: false });
    this.element.addEventListener('contextmenu', this._onContextMenu);
  }

  markInteraction() {
    this.lastInteraction = performance.now();
  }

  _pointerDown(event) {
    if (!this.enabled) return;
    this.markInteraction();
    try {
      this.element.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointers and a few older touch engines do not support it.
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.pointerDownAt = performance.now();
      this.pointerDownPosition = { x: event.clientX, y: event.clientY };
      this.dragDistance = 0;
      this.dragging = true;
      this.element.classList.add('is-dragging');
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastGestureDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.lastCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }

  _pointerMove(event) {
    if (!this.enabled) return;
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    this.markInteraction();
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.pointers.size === 1) {
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      const rotateSpeed = 0.0034;
      this.goalYaw -= dx * rotateSpeed;
      this.goalPitch += dy * rotateSpeed;
      this.goalPitch = THREE.MathUtils.clamp(this.goalPitch, this.minPitch, this.maxPitch);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.lastGestureDistance > 0) {
        const scale = this.lastGestureDistance / Math.max(1, distance);
        this.goalRadius = THREE.MathUtils.clamp(
          this.goalRadius * scale,
          this.minRadius,
          this.maxRadius,
        );
      }
      if (this.lastCenter) {
        this.goalYaw -= (center.x - this.lastCenter.x) * 0.0018;
        this.goalPitch = THREE.MathUtils.clamp(
          this.goalPitch + (center.y - this.lastCenter.y) * 0.0018,
          this.minPitch,
          this.maxPitch,
        );
      }
      this.dragDistance += 10;
      this.lastGestureDistance = distance;
      this.lastCenter = center;
    }
  }

  _pointerUp(event) {
    if (!this.pointers.has(event.pointerId)) return;
    const wasSingle = this.pointers.size === 1;
    const wasTap = wasSingle
      && this.dragDistance < 7
      && performance.now() - this.pointerDownAt < 520;
    this.pointers.delete(event.pointerId);
    try {
      this.element.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore capture failures for the same reason as above.
    }
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.element.classList.remove('is-dragging');
      if (wasTap && this.onTap) {
        const rect = this.element.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.onTap(ndc, event);
      }
    } else {
      this.lastGestureDistance = 0;
      this.lastCenter = null;
    }
  }

  _wheel(event) {
    if (!this.enabled) return;
    this.markInteraction();
    event.preventDefault();
    const normalized = event.deltaMode === 1
      ? event.deltaY * 0.03
      : event.deltaY * 0.00085;
    const scale = Math.exp(normalized);
    this.goalRadius = THREE.MathUtils.clamp(
      this.goalRadius * scale,
      this.minRadius,
      this.maxRadius,
    );
  }

  reset(immediate = false) {
    if (this.defaults.target) this.target.set(...this.defaults.target);
    this.goalYaw = this.defaults.yaw;
    this.goalPitch = this.defaults.pitch;
    this.goalRadius = this.defaults.radius;
    if (immediate) {
      this.yaw = this.goalYaw;
      this.pitch = this.goalPitch;
      this.radius = this.goalRadius;
      this.applyCamera();
    }
  }

  applyCamera() {
    const yaw = this.yaw + this.driftYaw;
    const pitch = THREE.MathUtils.clamp(
      this.pitch + this.driftPitch,
      this.minPitch,
      this.maxPitch,
    );
    const radius = Math.max(1, this.radius + this.driftRadius);
    this.camera.position.set(
      this.target.x + radius * Math.cos(pitch) * Math.sin(yaw),
      this.target.y + radius * Math.sin(pitch),
      this.target.z + radius * Math.cos(pitch) * Math.cos(yaw),
    );
    this.camera.lookAt(this.target);
  }

  setAutoDrift(enabled) {
    this.autoDrift = Boolean(enabled);
    this.lastInteraction = performance.now();
  }

  toggleAutoDrift() {
    this.setAutoDrift(!this.autoDrift);
    return this.autoDrift;
  }

  update(dt) {
    const lambda = 13;
    const k = 1 - Math.exp(-lambda * Math.min(dt, 0.05));
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    this.radius += (this.goalRadius - this.radius) * k;

    // A very slow breath of camera movement gives the object the feel of a
    // film insert without competing with direct manipulation. It pauses
    // immediately on input and fades back in after a short idle period.
    const idle = performance.now() - this.lastInteraction > 2400;
    const driftTarget = this.autoDrift && idle ? 1 : 0;
    const driftK = 1 - Math.exp(-2.2 * Math.min(dt, 0.08));
    this.driftAmount += (driftTarget - this.driftAmount) * driftK;
    if (this.autoDrift) this.driftTime += dt;
    this.driftYaw = Math.sin(this.driftTime * 0.1) * 0.12 * this.driftAmount;
    this.driftPitch = Math.sin(this.driftTime * 0.075 + 0.9) * 0.022 * this.driftAmount;
    this.driftRadius = Math.sin(this.driftTime * 0.06 + 0.4) * 1.5 * this.driftAmount;
    this.applyCamera();
  }

  getState() {
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      radius: this.radius,
      target: this.target.toArray(),
      goalYaw: this.goalYaw,
      goalPitch: this.goalPitch,
      goalRadius: this.goalRadius,
      autoDrift: this.autoDrift,
      driftAmount: this.driftAmount,
    };
  }

  dispose() {
    this.element.removeEventListener('pointerdown', this._onPointerDown);
    this.element.removeEventListener('pointermove', this._onPointerMove);
    this.element.removeEventListener('pointerup', this._onPointerUp);
    this.element.removeEventListener('pointercancel', this._onPointerUp);
    this.element.removeEventListener('wheel', this._onWheel);
    this.element.removeEventListener('contextmenu', this._onContextMenu);
  }
}
