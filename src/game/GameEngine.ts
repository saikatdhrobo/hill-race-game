import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { DIFFICULTIES, type DifficultyConfig } from './difficulties';
import { ENVIRONMENTS, type EnvironmentConfig } from './environments';
import { VEHICLES, type VehicleConfig } from './vehicles';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { TerrainGenerator, type TerrainData } from './terrain/TerrainGenerator';
import { VehiclePhysics } from './vehicle/VehiclePhysics';
import { VehicleView } from './vehicle/VehicleView';
import { CameraController } from './camera/CameraController';
import { SceneSetup } from './scene/SceneSetup';
import { InputManager } from './input/InputManager';
import { CoinSystem } from './gameplay/CoinSystem';
import { ScenerySystem } from './gameplay/ScenerySystem';
import { ScoreSystem } from './gameplay/ScoreSystem';
import type { AudioManager } from './audio/AudioManager';
import type { SaveManager } from './save/SaveManager';
import type {
  CrashReason,
  DifficultyId,
  EngineCallbacks,
  EnvironmentId,
  GamePhase,
  HudSnapshot,
  RunResult,
  VehicleId,
} from './types';
import { hashString } from './utils/rng';
import { clamp } from './utils/math';

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  vehicleId: VehicleId;
  environmentId: EnvironmentId;
  difficulty: DifficultyId;
  save: SaveManager;
  audio: AudioManager;
  callbacks: EngineCallbacks;
  lowQuality?: boolean;
  seed?: number;
}

const FIXED_DT = GAME_CONFIG.fixedTimestep;

/**
 * Cheap procedural surface detail so the terrain does not read as flat colour.
 * A single 128px noise texture tiled across the heightfield costs nothing.
 */
function buildDetailTexture(env: EnvironmentConfig): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();
  const img = ctx.createImageData(size, size);
  const speckle = env.id === 'dunes' ? 0.1 : env.id === 'frostpeak' ? 0.07 : 0.16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n =
        Math.sin(x * 0.7) * 0.25 +
        Math.sin(y * 0.55 + x * 0.12) * 0.25 +
        Math.sin((x + y) * 0.19) * 0.3 +
        (Math.random() - 0.5) * 0.55;
      const v = Math.max(0, Math.min(1, 0.76 + n * speckle * 2.1));
      const c = Math.round(v * 255);
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The game engine: owns the loop, the scene, the physics world and every
 * gameplay system for a single run. React only talks to this class through
 * start/pause/resume/restart and the callback surface.
 */
export class GameEngine {
  phase: GamePhase = 'ready';

  private readonly diff: DifficultyConfig;
  private readonly env: EnvironmentConfig;
  private readonly vehicleDef: VehicleConfig;
  private readonly scene: SceneSetup;
  private readonly camera: CameraController;
  readonly input = new InputManager();

  private physics: PhysicsWorld | null = null;
  private terrain: TerrainData | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private vehiclePhysics: VehiclePhysics | null = null;
  private vehicleView: VehicleView | null = null;
  private coins: CoinSystem | null = null;
  private scenery: ScenerySystem | null = null;
  private score: ScoreSystem | null = null;

  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private hudTimer = 0;
  private elapsed = 0;

  private fpsSamples: number[] = [];
  private qualityCooldown = 0;
  private currentPixelRatio = 1;

  private flipTimer = 0;
  private stuckTimer = 0;
  /** seconds spent on the ground with throttle applied but no movement */
  private beachedTimer = 0;
  private prevAirborne = false;
  private prevVerticalSpeed = 0;
  private prevSpeed = 0;
  private wasOnGround = true;

  private lastCheckpoint = -1;
  private respawnsLeft = 0;
  private banked = false;
  private disposed = false;
  private autoPaused = false;

  private readonly carPosition = new THREE.Vector3();
  private readonly carForward = new THREE.Vector3(1, 0, 0);

  constructor(private readonly opts: GameEngineOptions) {
    this.diff = DIFFICULTIES[opts.difficulty];
    this.env = ENVIRONMENTS[opts.environmentId];
    this.vehicleDef = VEHICLES[opts.vehicleId];
    this.scene = new SceneSetup(opts.canvas, this.env, opts.lowQuality ?? false);
    this.camera = new CameraController(this.scene.camera);
    this.currentPixelRatio = this.scene.renderer.getPixelRatio();
    this.respawnsLeft = this.diff.checkpointRespawns;

    this.input.attach();
    this.input.onPause = () => {
      if (this.phase === 'running') this.pause();
      else if (this.phase === 'paused') this.resume();
    };
    this.input.onRestart = () => this.restart();
  }

  // ---------------------------------------------------------------- setup
  async init(): Promise<void> {
    await PhysicsWorld.load();
    if (this.disposed) return;

    const seed = this.opts.seed ?? hashString(`${this.opts.environmentId}:${this.opts.difficulty}:${this.opts.vehicleId}`);
    this.physics = new PhysicsWorld();

    // ---- terrain -----------------------------------------------------
    const generator = new TerrainGenerator(this.env, this.diff, seed);
    this.terrain = generator.generate();
    this.physics.addTerrain(this.terrain.vertices, this.terrain.indices);

    const detail = buildDetailTexture(this.env);
    detail.repeat.set(this.terrain.width / 14, this.terrain.width / 14);
    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: this.env.roughness,
      metalness: 0.02,
      map: detail,
    });
    this.terrainMesh = new THREE.Mesh(this.terrain.geometry, terrainMaterial);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = false;
    this.scene.scene.add(this.terrainMesh);

    // ---- scenery + coins --------------------------------------------
    this.scenery = new ScenerySystem(this.terrain, this.diff, this.env, seed);
    this.scene.scene.add(this.scenery.group);
    for (const obstacle of this.scenery.obstacles) {
      this.physics.addStaticBall(obstacle.x, obstacle.y, obstacle.z, obstacle.radius);
    }

    this.coins = new CoinSystem(this.terrain, this.diff, this.env, seed);
    this.scene.scene.add(this.coins.group);

    // ---- vehicle -----------------------------------------------------
    const grip = this.env.grip * this.diff.gripScale;
    this.vehiclePhysics = new VehiclePhysics(this.physics, this.vehicleDef, grip, this.diff.engineScale);
    this.vehicleView = new VehicleView(this.vehicleDef);
    this.scene.scene.add(this.vehicleView.group);

    this.score = new ScoreSystem(this.diff, this.terrain.start.x, this.opts.save.bestFor(this.opts.environmentId));
    this.resetVehicleToStart();
    this.phase = 'running';
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
    this.emitHud();
  }

  /** Read-only debug view of the live run (used by dev tooling). */
  debugState(): Record<string, unknown> {
    const veh = this.vehiclePhysics;
    return {
      phase: this.phase,
      pos: veh ? veh.position : null,
      speed: veh ? veh.speed : 0,
      contacts: veh ? veh.contacts : 0,
      engine: veh ? veh.engineForceRatio : 0,
      terrain: this.terrain
        ? {
            start: this.terrain.start,
            h0: this.terrain.sampleHeight(0, 0),
            h5: this.terrain.sampleHeight(5, 0),
            h10: this.terrain.sampleHeight(10, 0),
            h20: this.terrain.sampleHeight(20, 0),
            h30: this.terrain.sampleHeight(30, 0),
            h45: this.terrain.sampleHeight(45, 0),
            h60: this.terrain.sampleHeight(60, 0),
          }
        : null,
      score: this.score ? { distance: this.score.distance, coins: this.score.coins } : null,
    };
  }

  private resetVehicleToStart(): void {
    if (!this.terrain) return;
    this.vehiclePhysics?.spawn(this.terrain.start.x, this.terrain.start.y, this.terrain.start.z, 0);
    this.carPosition.set(this.terrain.start.x, this.terrain.start.y, this.terrain.start.z);
    this.carForward.set(1, 0, 0);
    this.camera.reset(this.carPosition, 0);
    this.flipTimer = 0;
    this.stuckTimer = 0;
    this.beachedTimer = 0;
    this.accumulator = 0;
    this.prevVerticalSpeed = 0;
  }

  // ------------------------------------------------------------- controls
  pause(): void {
    if (this.phase !== 'running') return;
    this.phase = 'paused';
    this.input.enabled = false;
    this.opts.audio.updateEngine(0, 0, false);
    this.opts.callbacks.onPauseChange?.(true);
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'running';
    this.input.enabled = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.opts.callbacks.onPauseChange?.(false);
  }

  restart(): void {
    if (!this.score || !this.coins || !this.scenery) return;
    this.finishRun(0, false);
    this.score = new ScoreSystem(this.diff, this.terrain!.start.x, this.opts.save.bestFor(this.opts.environmentId));
    this.coins.reset();
    this.scenery.resetCheckpoints();
    this.lastCheckpoint = -1;
    this.respawnsLeft = this.diff.checkpointRespawns;
    this.banked = false;
    this.elapsed = 0;
    this.resetVehicleToStart();
    this.phase = 'running';
    this.input.enabled = true;
    this.opts.callbacks.onPauseChange?.(false);
    this.emitHud();
  }

  /** Continue from the last checkpoint after a crash (costs a respawn). */
  continueFromCheckpoint(): boolean {
    if (!this.scenery || !this.vehiclePhysics || this.respawnsLeft <= 0) return false;
    const cp = this.scenery.checkpointPosition(this.lastCheckpoint);
    if (!cp) return false;
    this.respawnsLeft--;
    this.vehiclePhysics.spawn(cp.x, cp.y, cp.z, 0);
    this.carPosition.set(cp.x, cp.y, cp.z);
    this.carForward.set(1, 0, 0);
    this.camera.reset(this.carPosition, 0);
    this.flipTimer = 0;
    this.stuckTimer = 0;
    this.beachedTimer = 0;
    this.banked = false;
    this.phase = 'running';
    this.input.enabled = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.opts.callbacks.onPauseChange?.(false);
    this.emitHud();
    return true;
  }

  get respawnsAvailable(): number {
    return this.respawnsLeft;
  }

  /** Index of the last checkpoint reached in this run (-1 when none). */
  get lastCheckpointIndex(): number {
    return this.lastCheckpoint;
  }

  /** Banks the current run (if it hasn't been banked) before leaving to the menu. */
  abandonRun(): void {
    if (this.banked || !this.score) return;
    this.finishRun(0, false);
    this.banked = true;
  }

  // ----------------------------------------------------------- main loop
  private readonly tick = (now: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.tick);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // allow slower devices to keep real-time pacing without spiralling
    const dt = Math.min(0.1, Math.max(0, rawDt));

    if (this.phase === 'running') {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < GAME_CONFIG.maxSubSteps) {
        this.stepPhysics(FIXED_DT);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (this.accumulator > FIXED_DT * GAME_CONFIG.maxSubSteps) this.accumulator = 0;
      this.updateVisuals(dt);
      this.updateAudio(dt);
      this.updateHud(dt);
      this.monitorPerformance(dt);
    } else {
      // paused / crashed / complete: keep rendering the last frame cheaply
      this.scene.render();
    }
  };

  private stepPhysics(dt: number): void {
    const veh = this.vehiclePhysics;
    const physics = this.physics;
    if (!veh || !physics || !this.score) return;

    const controls = this.input.sample(dt);
    veh.update(dt, controls);
    physics.step(dt);

    const pos = veh.position;
    this.score.update(pos.x);

    // ---- coin pickups -----------------------------------------------
    if (this.coins) {
      const picked = this.coins.update(dt, this.carPosition);
      if (picked > 0) {
        this.score.addCoins(picked);
        this.opts.audio.playCoin();
      }
    }

    // ---- checkpoints --------------------------------------------------
    if (this.scenery) {
      const reached = this.scenery.update(dt, pos.x);
      if (reached >= 0) {
        this.lastCheckpoint = reached;
        this.score.addCheckpoint();
        this.opts.audio.playCheckpoint();
        this.opts.callbacks.onCheckpoint(reached, this.respawnsLeft);
        this.camera.addShake(0.12);
      }
    }

    // ---- impact detection --------------------------------------------
    const verticalSpeed = veh.body.linvel().y;
    const airborne = veh.airborne;
    if (!airborne && this.prevAirborne && this.prevVerticalSpeed < -4) {
      const impact = clamp(-this.prevVerticalSpeed / 18, 0.1, 1);
      this.opts.audio.playLanding(impact);
      this.camera.addShake(impact * 0.55);
    }
    if (!this.wasOnGround && airborne) this.opts.audio.playJump();
    this.wasOnGround = !airborne;
    this.prevAirborne = airborne;
    this.prevVerticalSpeed = verticalSpeed;

    this.checkCrash(dt, veh);
    this.checkFinish(veh);
    this.elapsed += dt;
  }

  private checkCrash(dt: number, veh: VehiclePhysics): void {
    const up = veh.upVector();
    const speed = Math.abs(veh.speed);

    if (up.y < -0.15) this.flipTimer += dt;
    else this.flipTimer = Math.max(0, this.flipTimer - dt * 2);

    if (up.y < GAME_CONFIG.vehicle.stuckUpDot && speed < GAME_CONFIG.vehicle.stuckSpeed) this.stuckTimer += dt;
    else this.stuckTimer = 0;

    if (this.flipTimer > GAME_CONFIG.vehicle.flipCrashTime) {
      this.crash('flip');
      return;
    }
    if (this.stuckTimer > GAME_CONFIG.vehicle.stuckCrashTime) {
      this.crash('stuck');
      return;
    }

    // High-centred on a crest with the throttle buried: give the player an out
    // instead of leaving them in an unwinnable position.
    const controls = this.input.sample(dt);
    const trying = controls.throttle > 0.3 || controls.brake > 0.3;
    if (trying && speed < 0.7 && veh.contacts > 0) this.beachedTimer += dt;
    else this.beachedTimer = Math.max(0, this.beachedTimer - dt * 3);
    if (this.beachedTimer > GAME_CONFIG.vehicle.beachedTime) {
      this.crash('stuck');
    }
    if (this.terrain && veh.position.y < this.terrain.minHeight - GAME_CONFIG.vehicle.fallCrashDepth) {
      this.crash('fall');
    }
  }

  private checkFinish(_veh: VehiclePhysics): void {
    if (!this.terrain || !this.score || this.phase !== 'running') return;
    if (this.score.distance < this.terrain.finishX) return;

    this.phase = 'complete';
    this.input.enabled = false;
    this.opts.audio.playFinish();
    this.camera.addShake(0.1);
    const result = this.finishRun(this.diff.finishBonus, true);
    this.opts.callbacks.onComplete(result);
  }

  /** Banks the run into save data once, then reports the result. */
  private finishRun(bonusCoins: number, completed: boolean): RunResult {
    const score = this.score!;
    const distance = Math.round(score.maxDistance);
    const runCoins = score.coins + bonusCoins;
    let result: RunResult = {
      distance,
      coins: runCoins,
      score: score.score + bonusCoins * GAME_CONFIG.coins.scoreValue,
      best: this.opts.save.bestFor(this.opts.environmentId),
      isNewBest: false,
      difficulty: this.opts.difficulty,
      environment: this.opts.environmentId,
      vehicle: this.opts.vehicleId,
      completed,
      bonusCoins,
      totalCoins: this.opts.save.coins,
    };
    if (!this.banked) {
      this.banked = true;
      const rec = this.opts.save.recordRun(this.opts.environmentId, distance, runCoins);
      result = { ...result, best: rec.best, isNewBest: rec.isNewBest, totalCoins: this.opts.save.coins };
    }
    return result;
  }

  private crash(reason: CrashReason): void {
    if (this.phase !== 'running') return;
    this.phase = 'crashed';
    this.input.enabled = false;
    this.camera.addShake(Math.min(1, Math.abs(this.prevSpeed) / 12 + 0.35));
    this.opts.audio.playCrash();
    const result = this.finishRun(0, false);
    this.opts.callbacks.onCrash(result, reason);
  }

  private updateVisuals(dt: number): void {
    const veh = this.vehiclePhysics;
    const view = this.vehicleView;
    if (!veh || !view) return;

    const p = veh.position;
    const r = veh.rotation;
    this.carPosition.set(p.x, p.y, p.z);
    view.group.position.copy(this.carPosition);
    view.group.quaternion.set(r.x, r.y, r.z, r.w);

    const suspensions: number[] = [];
    const rotations: number[] = [];
    const steers: number[] = [];
    for (let i = 0; i < veh.numWheels; i++) {
      suspensions.push(veh.suspensionLength(i));
      rotations.push(veh.wheelRotation(i));
      steers.push(veh.wheelSteer(i));
    }
    view.updateWheels(suspensions, rotations, steers);

    const fwd = veh.forwardVector();
    this.carForward.set(fwd.x, 0, fwd.z);
    if (this.carForward.lengthSq() < 0.001) this.carForward.set(1, 0, 0);
    this.carForward.normalize();

    const ground = this.terrain ? this.terrain.sampleHeight(p.x, p.z) : 0;
    this.camera.update(dt, this.carPosition, this.carForward, veh.speed, ground);
    this.camera.updateFov(dt, veh.speed);

    this.scene.followSun(this.carPosition);
    this.scene.followSky(this.carPosition);
    view.setBraking(this.input.sample(0).brake > 0.2 || veh.speed < -0.6);
    this.prevSpeed = veh.speed;
    this.scene.render();
  }

  private updateAudio(dt: number): void {
    const veh = this.vehiclePhysics;
    if (!veh) return;
    const controls = this.input.sample(dt);
    const ratio = clamp(Math.abs(veh.speed) / this.vehicleDef.maxSpeed, 0, 1);
    this.opts.audio.updateEngine(ratio, controls.throttle, this.phase === 'running');
  }

  private updateHud(dt: number): void {
    this.hudTimer += dt;
    if (this.hudTimer < 0.1) return;
    this.hudTimer = 0;
    this.emitHud();
  }

  emitHud(): void {
    if (!this.score || !this.vehiclePhysics || !this.terrain) return;
    const snapshot: HudSnapshot = {
      distance: Math.round(this.score.maxDistance),
      progress: this.score.progress(this.terrain.finishX),
      score: this.score.score,
      coins: this.score.coins,
      speedKmh: Math.round(Math.abs(this.vehiclePhysics.speed) * 3.6),
      airborne: this.vehiclePhysics.airborne,
      gear: this.vehiclePhysics.speed < -0.6 ? 'R' : this.vehiclePhysics.airborne ? 'AIR' : 'D',
      checkpoints: this.lastCheckpoint + 1,
      best: this.opts.save.bestFor(this.opts.environmentId),
    };
    this.opts.callbacks.onHud(snapshot);
  }

  private monitorPerformance(dt: number): void {
    if (this.opts.lowQuality) return;
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    this.qualityCooldown += dt;
    if (this.fpsSamples.length < 90 || this.qualityCooldown < 3) return;

    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    const fps = 1 / Math.max(0.001, avg);
    if (fps < 45 && this.currentPixelRatio > 0.85) {
      this.currentPixelRatio = Math.max(0.8, this.currentPixelRatio - 0.25);
      this.scene.setPixelRatio(this.currentPixelRatio);
      this.qualityCooldown = 0;
      this.fpsSamples = [];
    } else if (fps > 58 && this.currentPixelRatio < Math.min(window.devicePixelRatio || 1, 2)) {
      const ceiling = Math.min(window.devicePixelRatio || 1, 2);
      this.currentPixelRatio = Math.min(ceiling, this.currentPixelRatio + 0.25);
      this.scene.setPixelRatio(this.currentPixelRatio);
      this.qualityCooldown = 0;
      this.fpsSamples = [];
    }
  }

  // ------------------------------------------------------------- window
  resize(width: number, height: number): void {
    this.scene.resize(width, height);
  }

  /** Called when the tab is hidden — freezes simulation and audio. */
  handleVisibility(hidden: boolean): void {
    if (hidden && this.phase === 'running') {
      this.autoPaused = true;
      this.pause();
    } else if (!hidden && this.autoPaused) {
      this.autoPaused = false;
      this.resume();
    }
  }

  get currentSpeedKmh(): number {
    return Math.round(Math.abs(this.vehiclePhysics?.speed ?? 0) * 3.6);
  }

  get runCoins(): number {
    return this.score?.coins ?? 0;
  }

  // ------------------------------------------------------------- teardown
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.opts.audio.updateEngine(0, 0, false);

    if (this.vehicleView) {
      this.scene.scene.remove(this.vehicleView.group);
      this.vehicleView.dispose();
    }
    if (this.coins) {
      this.scene.scene.remove(this.coins.group);
      this.coins.dispose();
    }
    if (this.scenery) {
      this.scene.scene.remove(this.scenery.group);
      this.scenery.dispose();
    }
    if (this.terrainMesh) {
      this.scene.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    this.physics?.dispose();
    this.scene.dispose();
    this.physics = null;
    this.terrain = null;
  }
}
