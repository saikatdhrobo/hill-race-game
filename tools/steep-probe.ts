import { PhysicsWorld } from '../src/game/physics/PhysicsWorld';
import { TerrainGenerator } from '../src/game/terrain/TerrainGenerator';
import { VehiclePhysics } from '../src/game/vehicle/VehiclePhysics';
import { DIFFICULTIES } from '../src/game/difficulties';
import { ENVIRONMENTS } from '../src/game/environments';
import { VEHICLES } from '../src/game/vehicles';
import type { ControlState } from '../src/game/types';
const S = 1/60;
await PhysicsWorld.load();
const t = new TerrainGenerator(ENVIRONMENTS.caldera, DIFFICULTIES.hard, 12345).generate();
console.log('profile 40..90:', Array.from({length: 11}, (_, i) => `${40 + i*5}:${t.sampleHeight(40+i*5, 0).toFixed(1)}`).join(' '));
const physics = new PhysicsWorld();
physics.addTerrain(t.vertices, t.indices);
const v = new VehiclePhysics(physics, VEHICLES.boulder, 0.94*0.94, 0.94);
v.spawn(t.start.x, t.start.y, t.start.z);
const c: ControlState = { throttle: 1, brake: 0, steer: 0, tilt: 0, handbrake: 0 };
for (let i = 0; i <= 60*12; i++) {
  v.update(S, c); physics.step(S);
  if (i % 30 === 0) {
    const p = v.position; const up = v.upVector();
    const ahead = t.sampleHeight(p.x + 1.5, p.z) - t.sampleHeight(p.x, p.z);
    console.log(`t=${(i*S).toFixed(1)} x=${p.x.toFixed(1)} y=${p.y.toFixed(2)} g=${t.sampleHeight(p.x,p.z).toFixed(2)} kmh=${(v.speed*3.6).toFixed(0)} wheels=${v.contacts} up=${up.y.toFixed(2)} slopeAhead=${(Math.atan2(ahead,1.5)*57.3).toFixed(0)}°`);
  }
}
