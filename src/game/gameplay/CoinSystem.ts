import * as THREE from 'three';
import { GAME_CONFIG } from '../config';
import type { TerrainData } from '../terrain/TerrainGenerator';
import type { DifficultyConfig } from '../difficulties';
import type { EnvironmentConfig } from '../environments';
import { clamp } from '../utils/math';
import { Rng } from '../utils/rng';

interface Coin {
  x: number;
  y: number;
  z: number;
  phase: number;
  collected: boolean;
}

/**
 * Pickup coins placed along the track, rendered with a single InstancedMesh
 * so the whole field costs one draw call.
 */
export class CoinSystem {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly coins: Coin[] = [];
  private readonly geometry: THREE.TorusGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly position = new THREE.Vector3();
  private time = 0;
  private collectedCount = 0;
  private cameraX = -Infinity;

  constructor(
    terrain: TerrainData,
    diff: DifficultyConfig,
    env: EnvironmentConfig,
    seed: number,
  ) {
    const rng = new Rng(seed ^ 0x5f356495);
    const spacing = GAME_CONFIG.coins.spacing / clamp(diff.coinDensity, 0.4, 2);
    const corridor = diff.corridorWidth * 0.5;

    // straight stretches of coins
    for (let x = 44; x < terrain.finishX - 16; x += spacing) {
      const jitterZ = rng.range(-corridor * 0.42, corridor * 0.42);
      const y = terrain.sampleHeight(x, jitterZ) + 1.35;
      this.coins.push({ x, y, z: jitterZ, phase: rng.range(0, Math.PI * 2), collected: false });
    }

    // coin arcs over every launch ramp: rewards clean, committed jumps
    for (const ramp of terrain.ramps) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = ramp.x + (t - 0.35) * 13;
        const arc = Math.sin(t * Math.PI) * (2.2 + ramp.height * 0.75);
        const base = terrain.sampleHeight(x, 0);
        this.coins.push({
          x,
          y: base + 1.5 + arc,
          z: 0,
          phase: rng.range(0, Math.PI * 2),
          collected: false,
        });
      }
    }

    this.coins.sort((a, b) => a.x - b.x);

    const capacity = this.coins.length;
    this.geometry = new THREE.TorusGeometry(0.44, 0.14, 8, 18);
    this.material = new THREE.MeshStandardMaterial({
      color: env.id === 'caldera' ? '#ffb347' : '#ffcf4d',
      emissive: new THREE.Color('#ffb028'),
      emissiveIntensity: 0.55,
      metalness: 0.75,
      roughness: 0.28,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    for (let i = 0; i < capacity; i++) this.writeInstance(i, 0);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = capacity;
  }

  private writeInstance(index: number, angle: number): void {
    const coin = this.coins[index];
    const spin = angle + coin.phase;
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
    this.position.set(coin.x, coin.y + Math.sin(this.time * 2 + coin.phase) * 0.09, coin.z);
    // hide coins the player has already driven past so nothing blocks the camera
    const s = coin.collected || coin.x < this.cameraX - 7 ? 0 : 1;
    this.scale.set(s, s, s);
    this.matrix.compose(this.position, this.quat, this.scale);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  /**
   * Animates coins and returns how many the car picked up this frame.
   */
  update(dt: number, carPosition: THREE.Vector3): number {
    this.time += dt;
    this.cameraX = carPosition.x;
    const radiusSq = GAME_CONFIG.coins.pickupRadius * GAME_CONFIG.coins.pickupRadius;
    let picked = 0;

    for (let i = 0; i < this.coins.length; i++) {
      const coin = this.coins[i];
      // coins are x-sorted, skip anything far down the track
      if (coin.x > carPosition.x + 26) break;
      if (coin.collected) continue;
      if (coin.x < carPosition.x - 26) continue;

      const dx = coin.x - carPosition.x;
      const dy = coin.y - carPosition.y;
      const dz = coin.z - carPosition.z;
      if (dx * dx + dy * dy + dz * dz <= radiusSq) {
        coin.collected = true;
        picked++;
        this.collectedCount++;
        this.writeInstance(i, this.time * 3);
        continue;
      }
      if (Math.abs(dx) < 60) this.writeInstance(i, this.time * 2.6);
    }

    if (picked > 0 || true) this.mesh.instanceMatrix.needsUpdate = true;
    return picked;
  }

  /** Puts every coin back for a fresh attempt on the same terrain. */
  reset(): void {
    this.collectedCount = 0;
    this.cameraX = -Infinity;
    for (let i = 0; i < this.coins.length; i++) {
      this.coins[i].collected = false;
      this.writeInstance(i, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  get collected(): number {
    return this.collectedCount;
  }

  get total(): number {
    return this.coins.length;
  }

  /** Coins on the car's current best line, used for the finish bonus UI. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.group.clear();
  }
}
