/**
 * Headless physics harness.
 * Runs the real terrain + vehicle code (no rendering) so handling can be
 * tuned and regression-tested from the command line:
 *   npm run sim
 */
import { PhysicsWorld } from '../src/game/physics/PhysicsWorld';
import { TerrainGenerator } from '../src/game/terrain/TerrainGenerator';
import { VehiclePhysics } from '../src/game/vehicle/VehiclePhysics';
import { DIFFICULTIES } from '../src/game/difficulties';
import { ENVIRONMENTS } from '../src/game/environments';
import { VEHICLES } from '../src/game/vehicles';
import { ScenerySystem } from '../src/game/gameplay/ScenerySystem';
import type { ControlState, DifficultyId, EnvironmentId, VehicleId } from '../src/game/types';

const S = 1 / 60;

async function run(difficulty: DifficultyId, envId: EnvironmentId, vehicleId: VehicleId) {
  await PhysicsWorld.load();
  const physics = new PhysicsWorld();
  const diff = DIFFICULTIES[difficulty];
  const env = ENVIRONMENTS[envId];
  const def = VEHICLES[vehicleId];

  const terrain = new TerrainGenerator(env, diff, 12345).generate();
  physics.addTerrain(terrain.vertices, terrain.indices);

  const vehicle = new VehiclePhysics(physics, def, env.grip * diff.gripScale, diff.engineScale);
  // simple obstacle avoidance so the harness approximates a real player
  const obstacles = new ScenerySystem(terrain, diff, env, 12345).obstacles;
  vehicle.spawn(terrain.start.x, terrain.start.y, terrain.start.z);

  const controls: ControlState = { throttle: 0, brake: 0, steer: 0, tilt: 0, handbrake: 0 };
  let maxX = 0;
  let crashes = 0;
  let airTime = 0;
  let flippedTime = 0;
  let fallen = false;
  const samples: string[] = [];

  for (let step = 0; step < 60 * 110; step++) {
    const p = vehicle.position;
    const speed = vehicle.speed;
    maxX = Math.max(maxX, p.x - terrain.start.x);

    // crude autopilot: full throttle, steer back toward the corridor centre
    const fwd = vehicle.forwardVector();
    const yawError = Math.atan2(fwd.z, fwd.x);
    controls.throttle = 1;
    controls.brake = 0;
    let avoid = 0;
    for (const o of obstacles) {
      const dx = o.x - p.x;
      if (dx > 0 && dx < 14) {
        const clearance = o.radius + 2.4;
        if (Math.abs(o.z - p.z) < clearance) avoid += (o.z > p.z ? -1 : 1) * (1 - dx / 14);
      }
    }
    controls.steer = Math.max(-1, Math.min(1, -(yawError * 2.2 + p.z * 0.05 + avoid * 1.6)));


    vehicle.update(S, controls);
    physics.step(S);

    const up = vehicle.upVector();
    if (vehicle.airborne) airTime += S;
    if (up.y < -0.2) flippedTime += S; else flippedTime = Math.max(0, flippedTime - S);

    if (p.y < terrain.minHeight - 30) { fallen = true; break; }
    if (flippedTime > 1.1) { crashes++; break; }

    if (step % (60 * 10) === 0) {
      samples.push(
        `t=${(step * S).toFixed(0).padStart(2)}s x=${(p.x - terrain.start.x).toFixed(0).padStart(4)}m y=${p.y.toFixed(1).padStart(6)} speed=${speed.toFixed(1).padStart(5)}m/s wheels=${vehicle.contacts} air=${airTime.toFixed(1)}s`,
      );
    }
  }

  console.log(`\n=== ${difficulty} / ${envId} / ${vehicleId} ===`);
  samples.forEach((s) => console.log('  ' + s));
  console.log(`  RESULT distance=${maxX.toFixed(1)}m  crashes=${crashes}  fell=${fallen}  airTime=${airTime.toFixed(1)}s`);
  physics.dispose();
  return { maxX, crashes, fallen, airTime };
}

const arg = process.argv[2] ?? 'all';
const matrix: [DifficultyId, EnvironmentId, VehicleId][] = [
  ['easy', 'highlands', 'tumble'],
  ['medium', 'rockies', 'ridgeback'],
  ['hard', 'caldera', 'boulder'],
];
const runs = arg === 'all' ? matrix : [[arg as DifficultyId, 'highlands', 'tumble'] as [DifficultyId, EnvironmentId, VehicleId]];
for (const [d, e, v] of runs) await run(d, e, v);
