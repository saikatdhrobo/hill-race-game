import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from '../config';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { VehicleConfig } from '../vehicles';
import type { ControlState } from '../types';
import { clamp, quatToForward, quatToRight, quatToUp } from '../utils/math';

const V = GAME_CONFIG.vehicle;

/**
 * Rapier ray-cast vehicle controller wrapper.
 * Keeps all rapier-specific plumbing out of the renderer and gameplay code.
 */
export class VehiclePhysics {
  readonly body: RAPIER.RigidBody;
  private readonly controller: RAPIER.DynamicRayCastVehicleController;

  private steerAngle = 0;
  private engineOutput = 0;
  private contactCount = 0;
  private wasAirborne = false;
  private wheelRotations: number[] = [];
  private readonly forward = { x: 1, y: 0, z: 0 };

  constructor(
    physics: PhysicsWorld,
    readonly def: VehicleConfig,
    gripScale: number,
    private readonly engineScale: number,
  ) {
    const world = physics.world;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 30, 0)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setLinearDamping(0.02)
      .setAngularDamping(0.35);
    this.body = world.createRigidBody(bodyDesc);

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(def.half.x, def.half.y, def.half.z)
        .setMass(def.mass)
        .setFriction(0.45)
        .setRestitution(0.06),
      this.body,
    );

    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 0;

    const w = def.wheel;
    const positions: [number, number][] = [
      [w.frontX, w.halfTrack],
      [w.frontX, -w.halfTrack],
      [w.rearX, w.halfTrack],
      [w.rearX, -w.halfTrack],
    ];
    for (const [x, z] of positions) {
      this.controller.addWheel(
        { x, y: w.connectionY, z },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        w.restLength,
        w.radius,
      );
      const i = this.controller.numWheels() - 1;
      this.controller.setWheelSuspensionStiffness(i, w.stiffness);
      this.controller.setWheelSuspensionCompression(i, w.compression);
      this.controller.setWheelSuspensionRelaxation(i, w.relaxation);
      this.controller.setWheelMaxSuspensionTravel(i, w.travel);
      this.controller.setWheelMaxSuspensionForce(i, w.maxForce);
      this.controller.setWheelFrictionSlip(i, 2.6 * def.grip * gripScale);
      this.controller.setWheelSideFrictionStiffness(i, 0.85);
      this.controller.setWheelBrake(i, 0);
      this.controller.setWheelEngineForce(i, 0);
      this.wheelRotations.push(0);
    }
  }

  get numWheels(): number {
    return this.controller.numWheels();
  }

  get position(): { x: number; y: number; z: number } {
    return this.body.translation();
  }

  get rotation(): { x: number; y: number; z: number; w: number } {
    return this.body.rotation();
  }

  get speed(): number {
    return this.controller.currentVehicleSpeed();
  }

  get contacts(): number {
    return this.contactCount;
  }

  get airborne(): boolean {
    return this.contactCount === 0;
  }

  get engineForceRatio(): number {
    return this.engineOutput;
  }

  suspensionLength(i: number): number {
    return this.controller.wheelSuspensionLength(i) ?? this.def.wheel.restLength;
  }

  wheelRotation(i: number): number {
    return this.wheelRotations[i] ?? 0;
  }

  wheelSteer(i: number): number {
    return this.controller.wheelSteering(i) ?? 0;
  }

  wheelInContact(i: number): boolean {
    return this.controller.wheelIsInContact(i);
  }

  /** World-space unit vector pointing out of the roof. */
  upVector(): { x: number; y: number; z: number } {
    return quatToUp(this.body.rotation());
  }

  /** World-space unit vector pointing out of the nose (local +X). */
  forwardVector(): { x: number; y: number; z: number } {
    return quatToForward(this.body.rotation());
  }

  spawn(x: number, y: number, z: number, yaw = 0): void {
    const q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation(q, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steerAngle = 0;
    this.engineOutput = 0;
    this.contactCount = 4;
  }

  /** Applies engine / brake / steering and air control for one physics step. */
  update(dt: number, controls: ControlState): void {
    const def = this.def;
    const speed = this.speed;
    const absSpeed = Math.abs(speed);
    const speedRatio = clamp(absSpeed / def.maxSpeed, 0, 1);

    // ---- suspension contact bookkeeping ------------------------------
    this.contactCount = 0;
    for (let i = 0; i < this.controller.numWheels(); i++) {
      if (this.controller.wheelIsInContact(i)) this.contactCount++;
    }
    this.wasAirborne = this.contactCount === 0;

    // ---- steering ----------------------------------------------------
    const steerLimit = V.maxSteerAngle * (1 - 0.42 * speedRatio);
    const steerTarget = -controls.steer * steerLimit;
    this.steerAngle += (steerTarget - this.steerAngle) * clamp(def.steerRate * dt, 0, 1);
    this.controller.setWheelSteering(0, this.steerAngle);
    this.controller.setWheelSteering(1, this.steerAngle);

    // ---- engine / brakes ---------------------------------------------
    let force = 0;
    const throttle = clamp(controls.throttle, 0, 1);
    const brake = clamp(controls.brake, 0, 1);
    const handbrake = clamp(controls.handbrake, 0, 1);

    if (throttle > 0.01 && brake < 0.01) {
      const fade = clamp(1 - Math.pow(speedRatio, 2.4), 0, 1);
      const reverseBoost = speed < -0.5 ? 1.4 : 1;
      force = def.engineForce * this.engineScale * throttle * fade * reverseBoost;
      // Gravity handicap on steep climbs: losing momentum uphill costs power.
      if (speed < def.maxSpeed * 0.15) {
        force *= 1.0 + 0.1 * (1 - speedRatio);
      }
    } else if (brake > 0.01 && throttle < 0.01) {
      if (speed > 0.8) {
        // braking
        for (let i = 0; i < 4; i++) this.controller.setWheelBrake(i, V.brakeForce * brake);
      } else {
        // reverse, with its own soft speed cap so reversing is never a rocket
        const revFade = clamp(1 - Math.pow(Math.min(0, speed) / -V.reverseMaxSpeed, 2), 0, 1);
        force = -def.engineForce * this.engineScale * V.reverseForceFactor * brake * revFade;
      }
    }

    // Hold the car still when nobody is touching the pedals, so it can't
    // creep backwards down a slope while the player is looking around.
    const holdingStill = throttle < 0.01 && brake < 0.01 && Math.abs(speed) < 0.6;
    if (holdingStill) {
      for (let i = 0; i < 4; i++) this.controller.setWheelBrake(i, V.handbrakeForce * 0.8);
    } else if (handbrake > 0.01) {
      for (let i = 0; i < 4; i++) this.controller.setWheelBrake(i, V.handbrakeForce * handbrake);
      force *= 1 - 0.75 * handbrake;
    } else if (!(brake > 0.01 && throttle < 0.01 && speed > 0.8)) {
      for (let i = 0; i < 4; i++) this.controller.setWheelBrake(i, 0);
    }

    const frontShare = def.frontDrive;
    const rearShare = 1 - frontShare;
    this.controller.setWheelEngineForce(0, force * frontShare * 0.5);
    this.controller.setWheelEngineForce(1, force * frontShare * 0.5);
    this.controller.setWheelEngineForce(2, force * rearShare * 0.5);
    this.controller.setWheelEngineForce(3, force * rearShare * 0.5);
    this.engineOutput = force / Math.max(1, def.engineForce);

    // ---- rolling resistance when coasting ----------------------------
    if (throttle < 0.01 && brake < 0.01 && this.contactCount > 0) {
      const fwd = this.forwardVector();
      this.forward.x = fwd.x;
      this.forward.y = fwd.y;
      this.forward.z = fwd.z;
      const rolling = clamp(speed, -1, 1) * V.rollingResistance * def.mass * dt;
      this.body.applyImpulse(
        { x: -this.forward.x * rolling, y: 0, z: -this.forward.z * rolling },
        true,
      );
    }

    // ---- airborne balance control ------------------------------------
    // Ground steering keys double as air tilt (nose up / nose down).
    if (this.wasAirborne) {
      const tilt = clamp(controls.tilt, -1, 1);
      const av = this.body.angvel();
      const right = quatToRight(this.body.rotation()); // pitch axis (forward is +X)
      const currentPitch = av.x * right.x + av.y * right.y + av.z * right.z;
      const targetPitch = tilt * V.airPitchRate;
      const blend = clamp(dt * 7.5, 0, 1);
      const nextPitch = currentPitch + (targetPitch - currentPitch) * (tilt !== 0 ? blend : blend * 0.55);
      const delta = nextPitch - currentPitch;
      this.body.setAngvel(
        { x: av.x + right.x * delta, y: av.y, z: av.z + right.z * delta },
        true,
      );
      // gentle yaw damping so flips do not spiral
      this.body.setAngvel(
        { x: this.body.angvel().x, y: this.body.angvel().y * (1 - V.airYawDamp * dt * 0.25), z: this.body.angvel().z },
        true,
      );
    }

    this.controller.updateVehicle(dt);

    // ---- wheel spin used by the visual model -------------------------
    const spinSpeed = speed / Math.max(0.15, def.wheel.radius);
    for (let i = 0; i < 4; i++) {
      this.wheelRotations[i] += spinSpeed * dt * (this.wheelInContact(i) ? 1 : 0.55);
    }
  }
}
