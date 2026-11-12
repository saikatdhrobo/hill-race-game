import * as THREE from 'three';
import type { TerrainData } from '../terrain/TerrainGenerator';
import type { DifficultyConfig } from '../difficulties';
import type { EnvironmentConfig } from '../environments';
import { Rng } from '../utils/rng';

export interface StaticObstacle {
  x: number;
  y: number;
  z: number;
  radius: number;
}

interface Checkpoint {
  x: number;
  index: number;
  banner: THREE.MeshStandardMaterial;
  visited: boolean;
}

interface InstanceTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

function makeInstances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: InstanceTransform[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  transforms.forEach((t, i) => {
    q.setFromEuler(t.rotation);
    m.compose(t.position, q, t.scale);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = transforms.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * All decorative world dressing plus checkpoint gates:
 * trees, rocks, collidable boulders, distant mountains and drifting clouds.
 */
export class ScenerySystem {
  readonly group = new THREE.Group();
  readonly obstacles: StaticObstacle[] = [];
  private readonly checkpoints: Checkpoint[] = [];
  private readonly clouds: THREE.InstancedMesh | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  private cloudOffset = 0;
  private lastCheckpointPassed = -1;

  constructor(
    private readonly terrain: TerrainData,
    private readonly diff: DifficultyConfig,
    private readonly env: EnvironmentConfig,
    seed: number,
  ) {
    const rng = new Rng(seed ^ 0x1f83d9ab);
    this.buildValleyFloor(rng);
    this.buildVegetation(rng);
    this.buildRocks(rng);
    this.buildObstacles(rng);
    this.buildMountains(rng);
    this.clouds = this.buildClouds(rng);
    this.buildGates();
  }

  private track<T extends { dispose(): void }>(r: T): T {
    this.disposables.push(r);
    return r;
  }

  private ground(x: number, z: number): number {
    return this.terrain.sampleHeight(x, z);
  }

  /**
   * A coarse valley floor that wraps the whole ridge. Without it the track
   * reads as a floating island with open sky underneath.
   */
  private buildValleyFloor(rng: Rng): void {
    const size = 2200;
    const segments = 46;
    const geo = this.track(new THREE.PlaneGeometry(size, size, segments, segments));
    geo.rotateX(-Math.PI / 2);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(positions.count * 3);
    const baseY = this.terrain.minHeight - this.diff.cliffDrop * 0.85 - 4;
    const low = new THREE.Color(this.env.palette.surfaceLow).multiplyScalar(0.62);
    const high = new THREE.Color(this.env.palette.rock).multiplyScalar(0.7);
    const tmp = new THREE.Color();
    const phase = rng.range(0, 6.28);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const far = Math.min(1, dist / 700);
      const undulation =
        Math.sin(x * 0.0072 + phase) * 16 +
        Math.cos(z * 0.0058 - phase) * 13 +
        Math.sin((x + z) * 0.0034) * 22 +
        Math.sin(x * 0.021) * 3.5 * far;
      positions.setY(i, baseY + undulation * far + (1 - far) * 2);
      const t = 0.35 + 0.5 * Math.sin(x * 0.01 + z * 0.013 + phase);
      tmp.copy(low).lerp(high, Math.min(1, Math.max(0, t)));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = this.track(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    );
    const floor = new THREE.Mesh(geo, mat);
    floor.receiveShadow = true;
    floor.position.x = this.terrain.finishX * 0.5;
    this.group.add(floor);
  }

  private buildVegetation(rng: Rng): void {
    const style = this.env.scenery.deco;
    const corridor = this.diff.corridorWidth * 0.5;
    const outer = this.terrain.width * 0.46;

    const trunks: InstanceTransform[] = [];
    const canopies: InstanceTransform[] = [];
    const needles: InstanceTransform[] = [];
    const caps: InstanceTransform[] = [];

    const step = style === 'cactus' ? 26 : 13;
    for (let x = 24; x < this.terrain.finishX + 90; x += step * rng.range(0.7, 1.3)) {
      const perBand = Math.round(rng.range(0, 3) * this.env.scenery.treeDensity);
      for (let i = 0; i < perBand; i++) {
        const side = rng.chance(0.5) ? 1 : -1;
        const lateral = corridor * rng.range(1.02, 1.9);
        if (Math.abs(lateral) > outer) continue;
        const z = side * lateral + rng.range(-3, 3);
        const px = x + rng.range(-6, 6);
        const y = this.ground(px, z);
        const height = rng.range(0.8, 1.5);

        if (style === 'cactus') {
          const s = rng.range(0.7, 1.25) * height;
          trunks.push({
            position: new THREE.Vector3(px, y + 1.6 * s, z),
            rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
            scale: new THREE.Vector3(s, s, s),
          });
          continue;
        }

        trunks.push({
          position: new THREE.Vector3(px, y + 1.5 * height, z),
          rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
          scale: new THREE.Vector3(height, height, height),
        });

        if (style === 'broadleaf') {
          const s = height * rng.range(1.1, 1.6);
          canopies.push({
            position: new THREE.Vector3(px + rng.range(-0.4, 0.4), y + 4.1 * height, z),
            rotation: new THREE.Euler(rng.range(0, 1), rng.range(0, 6.28), 0),
            scale: new THREE.Vector3(s, s * 1.15, s),
          });
          canopies.push({
            position: new THREE.Vector3(px + rng.range(-1.4, 1.4), y + 3.4 * height, z + rng.range(-1.4, 1.4)),
            rotation: new THREE.Euler(rng.range(0, 1), rng.range(0, 6.28), 0),
            scale: new THREE.Vector3(s * 0.7, s * 0.8, s * 0.7),
          });
        } else {
          const s = height * rng.range(1.0, 1.5);
          needles.push({
            position: new THREE.Vector3(px, y + 4.4 * height, z),
            rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
            scale: new THREE.Vector3(s, s * 1.5, s),
          });
          if (style === 'pineSnow') {
            caps.push({
              position: new THREE.Vector3(px, y + 4.9 * height, z),
              rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
              scale: new THREE.Vector3(s * 0.72, s * 0.9, s * 0.72),
            });
          }
        }
      }
    }

    const trunkColor = style === 'deadtree' ? '#3b3238' : style === 'cactus' ? '#4c7a44' : '#5b4030';
    const trunkGeo = this.track(new THREE.CylinderGeometry(0.2, 0.3, 3, 6));
    const trunkMat = this.track(
      new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9, flatShading: true }),
    );
    if (trunks.length) this.group.add(makeInstances(trunkGeo, trunkMat, trunks));

    if (canopies.length) {
      const foliageColor = style === 'deadtree' ? '#5a4b46' : '#3f7d3f';
      const geo = this.track(new THREE.IcosahedronGeometry(1.7, 0));
      const mat = this.track(
        new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.85, flatShading: true }),
      );
      this.group.add(makeInstances(geo, mat, canopies));
    }

    if (needles.length) {
      const needleColor = style === 'pineSnow' ? '#2f5f4a' : style === 'deadtree' ? '#4a3c3f' : '#2f6b45';
      const geo = this.track(new THREE.ConeGeometry(1.7, 5.2, 7));
      const mat = this.track(
        new THREE.MeshStandardMaterial({ color: needleColor, roughness: 0.9, flatShading: true }),
      );
      this.group.add(makeInstances(geo, mat, needles));
    }

    if (caps.length) {
      const geo = this.track(new THREE.ConeGeometry(1.5, 3.4, 7));
      const mat = this.track(
        new THREE.MeshStandardMaterial({ color: '#f2f8ff', roughness: 0.7, flatShading: true }),
      );
      this.group.add(makeInstances(geo, mat, caps));
    }
  }

  private buildRocks(rng: Rng): void {
    const corridor = this.diff.corridorWidth * 0.5;
    const transforms: InstanceTransform[] = [];
    const count = Math.round(120 * this.env.scenery.rockDensity);
    for (let i = 0; i < count; i++) {
      const x = rng.range(10, this.terrain.finishX + 80);
      const side = rng.chance(0.5) ? 1 : -1;
      const z = side * rng.range(corridor * 0.95, this.terrain.width * 0.46);
      const y = this.ground(x, z);
      const s = rng.range(0.5, 2.4);
      transforms.push({
        position: new THREE.Vector3(x, y + s * 0.35, z),
        rotation: new THREE.Euler(rng.range(0, 1), rng.range(0, 6.28), rng.range(0, 1)),
        scale: new THREE.Vector3(s, s * rng.range(0.6, 1.1), s),
      });
    }
    const geo = this.track(new THREE.IcosahedronGeometry(1, 0));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: this.env.palette.rock,
        roughness: 0.95,
        flatShading: true,
      }),
    );
    this.group.add(makeInstances(geo, mat, transforms));
  }

  private buildObstacles(rng: Rng): void {
    const count = Math.round(this.diff.obstacleDensity * 9);
    if (count <= 0) return;
    const corridor = this.diff.corridorWidth * 0.5;
    const transforms: InstanceTransform[] = [];
    const geo = this.track(new THREE.IcosahedronGeometry(1, 0));
    const mat = this.track(
      new THREE.MeshStandardMaterial({ color: this.env.palette.rock, roughness: 1, flatShading: true }),
    );

    for (let i = 0; i < count; i++) {
      const x = 100 + ((this.terrain.finishX - 160) * (i + 0.5)) / count + rng.range(-16, 16);
      const z = rng.range(-corridor * 0.55, corridor * 0.55);
      const radius = rng.range(1.0, 2.0);
      const y = this.ground(x, z);
      transforms.push({
        position: new THREE.Vector3(x, y + radius * 0.45, z),
        rotation: new THREE.Euler(rng.range(0, 1), rng.range(0, 6.28), rng.range(0, 1)),
        scale: new THREE.Vector3(radius, radius * rng.range(0.75, 1.1), radius),
      });
      this.obstacles.push({ x, y: y + radius * 0.35, z, radius: radius * 0.85 });
    }
    this.group.add(makeInstances(geo, mat, transforms));
  }

  private buildMountains(rng: Rng): void {
    const count = this.env.scenery.mountains;
    const transforms: InstanceTransform[] = [];
    const geo = this.track(new THREE.ConeGeometry(1, 1, 7));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: this.env.palette.mountain,
        roughness: 1,
        flatShading: true,
      }),
    );
    for (let i = 0; i < count; i++) {
      const side = rng.chance(0.5) ? 1 : -1;
      const x = rng.range(-140, this.terrain.finishX + 220);
      const z = side * rng.range(150, 340);
      const height = rng.range(70, 190);
      const radius = rng.range(60, 150);
      transforms.push({
        position: new THREE.Vector3(x, -20 + height * 0.5, z),
        rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
        scale: new THREE.Vector3(radius, height, radius),
      });
    }
    const mesh = makeInstances(geo, mat, transforms);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
  }

  private buildClouds(rng: Rng): THREE.InstancedMesh {
    const count = Math.max(4, this.env.scenery.clouds);
    const transforms: InstanceTransform[] = [];
    for (let i = 0; i < count; i++) {
      const s = rng.range(9, 26);
      transforms.push({
        position: new THREE.Vector3(
          rng.range(-100, this.terrain.finishX + 200),
          rng.range(70, 130),
          rng.range(-260, 260),
        ),
        rotation: new THREE.Euler(0, rng.range(0, 6.28), 0),
        scale: new THREE.Vector3(s * rng.range(1.2, 2.2), s * 0.45, s),
      });
    }
    const geo = this.track(new THREE.IcosahedronGeometry(1, 1));
    const mat = this.track(
      new THREE.MeshStandardMaterial({
        color: this.env.palette.cloud,
        roughness: 1,
        flatShading: true,
        transparent: true,
        opacity: 0.92,
      }),
    );
    const mesh = makeInstances(geo, mat, transforms);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
    return mesh;
  }

  private buildGates(): void {
    const corridor = this.diff.corridorWidth * 0.5;

    // ---- checkpoints -------------------------------------------------
    const interval = this.diff.checkpointInterval;
    const gateSpan = Math.min(corridor * 0.72, 16);
    let index = 0;
    for (let x = interval; x < this.terrain.finishX - 60; x += interval) {
      const bannerMat = this.track(
        new THREE.MeshStandardMaterial({
          color: '#8a93a6',
          emissive: new THREE.Color('#4a5a7a'),
          emissiveIntensity: 0.15,
          roughness: 0.6,
        }),
      );
      const gate = this.makeGate(x, gateSpan, '#3b4658', '#9aa4b6', true, bannerMat);
      this.group.add(gate);
      this.checkpoints.push({ x, index, banner: bannerMat, visited: false });
      index++;
    }

    // ---- finish gate -------------------------------------------------
    const finishX = this.terrain.finishX;
    const postMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.6, metalness: 0.2 }),
    );
    const postGeo = this.track(new THREE.CylinderGeometry(0.3, 0.34, 7.5, 10));
    const gate = new THREE.Group();
    for (const z of [-gateSpan, gateSpan]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(finishX, this.ground(finishX, z) + 3.6, z);
      post.castShadow = true;
      gate.add(post);
    }
    const midY = this.ground(finishX, 0) + 7.0;
    const bannerGeo = this.track(new THREE.BoxGeometry(0.4, 1.5, gateSpan * 2));
    const lightMat = this.track(new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.7 }));
    const darkMat = this.track(new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.7 }));
    const banner = new THREE.Mesh(bannerGeo, lightMat);
    banner.position.set(finishX, midY, 0);
    gate.add(banner);
    const tile = gateSpan / 4;
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) continue;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, tile), darkMat);
      t.position.set(finishX, midY, -gateSpan + tile * (i + 0.5));
      gate.add(t);
    }
    this.group.add(gate);
  }

  private makeGate(
    x: number,
    halfWidth: number,
    postColor: string,
    bannerColor: string,
    checkpoint: boolean,
    bannerMaterial?: THREE.MeshStandardMaterial,
  ): THREE.Group {
    const gate = new THREE.Group();
    const postMat = this.track(
      new THREE.MeshStandardMaterial({ color: postColor, roughness: 0.7, metalness: 0.15 }),
    );
    const postGeo = this.track(new THREE.CylinderGeometry(checkpoint ? 0.16 : 0.24, 0.2, 4.2, 8));
    for (const z of [-halfWidth, halfWidth]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, this.ground(x, z) + 2.0, z);
      post.castShadow = true;
      gate.add(post);
    }
    const bannerGeo = new THREE.BoxGeometry(0.18, 0.7, halfWidth * 2);
    const mat =
      bannerMaterial ??
      this.track(
        new THREE.MeshStandardMaterial({
          color: bannerColor,
          emissive: new THREE.Color(bannerColor),
          emissiveIntensity: 0.2,
          roughness: 0.5,
        }),
      );
    const banner = new THREE.Mesh(bannerGeo, mat);
    banner.position.set(x, this.ground(x, 0) + 4.1, 0);
    banner.castShadow = true;
    gate.add(banner);
    return gate;
  }

  /** Returns the index of a checkpoint that the car just crossed, or -1. */
  update(dt: number, carX: number): number {
    let reached = -1;
    for (const cp of this.checkpoints) {
      if (!cp.visited && carX >= cp.x) {
        cp.visited = true;
        cp.banner.emissive.set('#54e39a');
        cp.banner.emissiveIntensity = 1.1;
        cp.banner.color.set('#54e39a');
        reached = cp.index;
        this.lastCheckpointPassed = cp.index;
      }
    }

    if (this.clouds) {
      this.cloudOffset += dt * 1.4;
      if (this.cloudOffset > 400) this.cloudOffset = -400;
      this.clouds.position.x = this.cloudOffset % 400;
    }
    return reached;
  }

  /** Clears checkpoint progress (used by restart). */
  resetCheckpoints(): void {
    for (const cp of this.checkpoints) {
      cp.visited = false;
      cp.banner.emissive.set('#4a5a7a');
      cp.banner.emissiveIntensity = 0.15;
      cp.banner.color.set('#8a93a6');
    }
    this.lastCheckpointPassed = -1;
  }

  checkpointPosition(index: number): { x: number; y: number; z: number } | null {
    const cp = this.checkpoints.find((c) => c.index === index);
    if (!cp) return null;
    return { x: cp.x + 3, y: this.ground(cp.x + 3, 0) + 2.2, z: 0 };
  }

  get checkpointCount(): number {
    return this.checkpoints.length;
  }

  get reachedCheckpoint(): number {
    return this.lastCheckpointPassed;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        if (o.geometry) o.geometry.dispose();
      }
    });
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
