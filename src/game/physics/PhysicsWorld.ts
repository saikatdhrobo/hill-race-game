import RAPIER from '@dimforge/rapier3d-compat';
import { GAME_CONFIG } from '../config';

export type Rapier = typeof RAPIER;

/**
 * Thin wrapper around the Rapier world.
 * Only responsible for creating static geometry, the chassis body and stepping.
 */
export class PhysicsWorld {
  private static loadPromise: Promise<void> | null = null;
  readonly world: RAPIER.World;

  static load(): Promise<void> {
    if (!PhysicsWorld.loadPromise) PhysicsWorld.loadPromise = RAPIER.init();
    return PhysicsWorld.loadPromise;
  }

  static get api(): Rapier {
    return RAPIER;
  }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: GAME_CONFIG.gravity, z: 0 });
    this.world.timestep = GAME_CONFIG.fixedTimestep;
    // A slightly larger solver iteration count keeps stacked wheels stable
    // without a measurable cost on our small physics island.
    this.world.numSolverIterations = 6;
  }

  addTerrain(vertices: Float32Array, indices: Uint32Array): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(0.9).setRestitution(0.02);
    this.world.createCollider(desc, body);
  }

  addStaticBall(x: number, y: number, z: number, radius: number, friction = 0.8): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setFriction(friction).setRestitution(0.25),
      body,
    );
  }

  addStaticBox(
    x: number,
    y: number,
    z: number,
    half: { x: number; y: number; z: number },
    rotationY = 0,
  ): void {
    const q = new RAPIER.Quaternion(0, Math.sin(rotationY / 2), 0, Math.cos(rotationY / 2));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setFriction(0.85),
      body,
    );
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
