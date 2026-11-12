import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import { damp, dampFactor, clamp } from '../utils/math';

const C = GAME_CONFIG.camera;

/**
 * Chase camera that follows the car's heading (not its pitch, so flips never
 * whip the view around) with speed-based pull-back, terrain clamping and
 * impact shake.
 */
export class CameraController {
  private readonly lookTarget = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly smoothedLook = new THREE.Vector3();
  private yaw = 0;
  private shake = 0;
  private shakeTime = 0;
  private initialised = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  reset(position: THREE.Vector3, yaw = 0): void {
    this.yaw = yaw;
    this.shake = 0;
    this.initialised = false;
    this.placeImmediate(position);
  }

  private placeImmediate(position: THREE.Vector3): void {
    const dir = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    this.camera.position.copy(position).addScaledVector(dir, -C.distance).add(new THREE.Vector3(0, C.height, 0));
    this.smoothedLook.copy(position).addScaledVector(dir, C.lookAhead).add(new THREE.Vector3(0, C.lookHeight, 0));
    this.camera.lookAt(this.smoothedLook);
    this.initialised = true;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, this.shake + amount);
    this.shakeTime = 0;
  }

  update(
    dt: number,
    carPosition: THREE.Vector3,
    forward: THREE.Vector3,
    speed: number,
    groundHeight: number,
  ): void {
    const targetYaw = Math.atan2(forward.z, forward.x);
    // shortest-arc yaw interpolation
    let delta = targetYaw - this.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.yaw += delta * dampFactor(C.yawLerp, dt);

    const speedRatio = clamp(Math.abs(speed) / 30, 0, 1);
    const dist = C.distance + speedRatio * C.speedPullback * 12;
    const height = C.height + speedRatio * 0.9;

    this.desired.set(
      carPosition.x - Math.cos(this.yaw) * dist,
      carPosition.y + height,
      carPosition.z - Math.sin(this.yaw) * dist,
    );

    // never let the camera dip under the hillside
    const minY = groundHeight + 1.8;
    if (this.desired.y < minY) this.desired.y = minY;

    if (!this.initialised) {
      this.camera.position.copy(this.desired);
      this.initialised = true;
    } else {
      const t = dampFactor(C.positionLerp, dt);
      this.camera.position.lerp(this.desired, t);
    }

    this.lookTarget.set(
      carPosition.x + Math.cos(this.yaw) * C.lookAhead,
      carPosition.y + C.lookHeight,
      carPosition.z + Math.sin(this.yaw) * C.lookAhead,
    );
    const lookT = dampFactor(C.positionLerp * 1.5, dt);
    this.smoothedLook.lerp(this.lookTarget, lookT);
    this.camera.lookAt(this.smoothedLook);

    // ---- impact shake ------------------------------------------------
    if (this.shake > 0.001) {
      this.shakeTime += dt;
      this.shake = Math.max(0, this.shake - this.shake * C.shakeDecay * dt - 0.05 * dt);
      const amp = this.shake * 0.28;
      this.camera.position.x += Math.sin(this.shakeTime * 61) * amp;
      this.camera.position.y += Math.sin(this.shakeTime * 47 + 1.7) * amp;
      this.camera.position.z += Math.cos(this.shakeTime * 53 + 0.4) * amp;
      this.camera.rotateZ(Math.sin(this.shakeTime * 37) * this.shake * 0.012);
    }
  }

  /** Slight FOV kick with speed for a sense of urgency. */
  updateFov(dt: number, speed: number): void {
    const target = 62 + clamp(Math.abs(speed) / 30, 0, 1) * 7;
    this.camera.fov = damp(this.camera.fov, target, 2.5, dt);
    this.camera.updateProjectionMatrix();
  }
}
