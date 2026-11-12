import * as THREE from 'three';
import type { DifficultyConfig } from '../difficulties';
import type { EnvironmentConfig } from '../environments';
import { Rng } from '../utils/rng';
import { clamp, lerp, smoothstep } from '../utils/math';

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  indices: Uint32Array;
  length: number;
  width: number;
  minHeight: number;
  maxHeight: number;
  /** interpolated ground height at any world x/z */
  sampleHeight: (x: number, z: number) => number;
  /** rough surface normal, used for scenery and camera clamping */
  sampleNormal: (x: number, z: number, out: THREE.Vector3) => THREE.Vector3;
  start: { x: number; y: number; z: number };
  finishX: number;
  ramps: { x: number; height: number }[];
}

interface RampDef {
  x: number;
  amp: number;
  width: number;
  dip: number;
}

/**
 * Builds the procedural hill track: a heightfield sampled on a regular grid,
 * rolled into a Three.js mesh with slope-based vertex colours, plus an
 * analytic sampler used by gameplay systems (coins, scenery, camera).
 */
export class TerrainGenerator {
  private readonly rng: Rng;
  private ramps: RampDef[] = [];
  private originX = 0;
  private originZ = 0;
  private stepX = 2.6;
  private stepZ = 3.1;
  private nx = 0;
  private nz = 0;
  private heights: Float32Array = new Float32Array(0);
  private phases: number[] = [];
  private length: number;
  private width: number;

  constructor(
    private readonly env: EnvironmentConfig,
    private readonly diff: DifficultyConfig,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.length = diff.trackLength;
    this.width = Math.max(96, diff.corridorWidth * 2.1);
  }

  generate(): TerrainData {
    // ---- random wave phases so each seed gives a different hillside ----
    this.phases = [this.rng.range(0, 6.283), this.rng.range(0, 6.283), this.rng.range(0, 6.283), this.rng.range(0, 6.283)];
    const lateralPhase = this.rng.range(0, 6.283);

    // ---- launch ramps -------------------------------------------------
    this.ramps = [];
    const span = this.length - 120;
    for (let i = 0; i < this.diff.rampCount; i++) {
      const x = 90 + (i / Math.max(1, this.diff.rampCount)) * span + this.rng.range(-14, 14);
      const amp = this.diff.rampHeight * this.rng.range(0.7, 1.25);
      this.ramps.push({
        x,
        amp,
        // wider ramp for taller crest so the approach angle stays climbable
        width: clamp(5.2 + amp * 2.0, 5.2, 15),
        dip: this.rng.range(1.5, 4.5),
      });
    }
    this.ramps.sort((a, b) => a.x - b.x);

    const startPad = 20;
    const extraRun = 130;
    const totalLength = this.length + extraRun + startPad;
    this.originX = -startPad;
    this.stepX = clamp(totalLength / 520, 2.2, 3.2);
    this.stepZ = this.env.id === 'frostpeak' ? 3.0 : 3.1;
    this.nx = Math.ceil(totalLength / this.stepX);
    this.nz = Math.max(24, Math.ceil(this.width / this.stepZ));
    this.stepX = totalLength / this.nx;
    this.stepZ = this.width / this.nz;
    this.originZ = -(this.width / 2);

    const cols = this.nx + 1;
    const rows = this.nz + 1;
    this.heights = new Float32Array(cols * rows);

    let minHeight = Infinity;
    let maxHeight = -Infinity;
    for (let ix = 0; ix < cols; ix++) {
      const x = this.originX + ix * this.stepX;
      const ridge = this.ridgeHeight(x);
      for (let iz = 0; iz < rows; iz++) {
        const z = this.originZ + iz * this.stepZ;
        const h = this.heightAt(x, z, ridge, lateralPhase);
        this.heights[ix * rows + iz] = h;
        if (h < minHeight) minHeight = h;
        if (h > maxHeight) maxHeight = h;
      }
    }

    // ---- soften crests --------------------------------------------------
    // Sharp lips let the chassis high-centre on a ridge with no way to drive
    // off. Two smoothing passes round the crests without flattening the hills.
    this.smoothHeights(cols, rows, 2);

    // ---- slope limiter -------------------------------------------------
    // Real hill-climb tracks never contain a vertical wall: if a crest is
    // steeper than the rig can physically climb the level becomes unbeatable.
    // A few sweeps of a local gradient clamp keep the silhouette intact while
    // guaranteeing every drive-line crest stays within `maxGradient`.
    this.limitGradients(cols, rows, this.diff.maxGradient);

    minHeight = Infinity;
    maxHeight = -Infinity;
    for (let i = 0; i < this.heights.length; i++) {
      const h = this.heights[i];
      if (h < minHeight) minHeight = h;
      if (h > maxHeight) maxHeight = h;
    }

    const { geometry, vertices, indices } = this.buildGeometry(cols, rows, minHeight, maxHeight);

    const sampleHeight = (x: number, z: number): number => {
      const fx = (x - this.originX) / this.stepX;
      const fz = (z - this.originZ) / this.stepZ;
      const ix = clamp(Math.floor(fx), 0, cols - 2);
      const iz = clamp(Math.floor(fz), 0, rows - 2);
      const tx = clamp(fx - ix, 0, 1);
      const tz = clamp(fz - iz, 0, 1);
      const h00 = this.heights[ix * rows + iz];
      const h10 = this.heights[(ix + 1) * rows + iz];
      const h01 = this.heights[ix * rows + iz + 1];
      const h11 = this.heights[(ix + 1) * rows + iz + 1];
      return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
    };

    const sampleNormal = (x: number, z: number, out: THREE.Vector3): THREE.Vector3 => {
      const d = 1.6;
      const hL = sampleHeight(x - d, z);
      const hR = sampleHeight(x + d, z);
      const hD = sampleHeight(x, z - d);
      const hU = sampleHeight(x, z + d);
      return out.set(hL - hR, 2 * d, hD - hU).normalize();
    };

    const startHeight = sampleHeight(0, 0);
    return {
      geometry,
      vertices,
      indices,
      length: this.length,
      width: this.width,
      minHeight,
      maxHeight,
      sampleHeight,
      sampleNormal,
      start: { x: 0, y: startHeight + 2.2, z: 0 },
      finishX: this.length,
      ramps: this.ramps.map((r) => ({ x: r.x, height: r.amp })),
    };
  }

  private smoothHeights(cols: number, rows: number, passes: number): void {
    const scratch = new Float32Array(this.heights.length);
    for (let pass = 0; pass < passes; pass++) {
      scratch.set(this.heights);
      for (let ix = 1; ix < cols - 1; ix++) {
        for (let iz = 1; iz < rows - 1; iz++) {
          const i = ix * rows + iz;
          const centre = scratch[i];
          const l = scratch[i - rows];
          const r = scratch[i + rows];
          const d = scratch[i - 1];
          const u = scratch[i + 1];
          this.heights[i] = centre * 0.4 + (l + r + d + u) * 0.15;
        }
      }
    }
  }

  private limitGradients(cols: number, rows: number, maxGradient: number): void {
    const maxRise = maxGradient * this.stepX;
    for (let pass = 0; pass < 3; pass++) {
      // forward sweep
      for (let ix = 1; ix < cols; ix++) {
        for (let iz = 0; iz < rows; iz++) {
          const prev = this.heights[(ix - 1) * rows + iz];
          const i = ix * rows + iz;
          const h = this.heights[i];
          if (h > prev + maxRise) this.heights[i] = prev + maxRise;
          else if (h < prev - maxRise) this.heights[i] = prev - maxRise;
        }
      }
      // backward sweep
      for (let ix = cols - 2; ix >= 0; ix--) {
        for (let iz = 0; iz < rows; iz++) {
          const next = this.heights[(ix + 1) * rows + iz];
          const i = ix * rows + iz;
          const h = this.heights[i];
          if (h > next + maxRise) this.heights[i] = next + maxRise;
          else if (h < next - maxRise) this.heights[i] = next - maxRise;
        }
      }
    }
  }

  /** Long-wavelength ridges that form the backbone of the track. */
  private ridgeHeight(x: number): number {
    const d = this.diff;
    const p = this.phases;
    let h = d.amplitude * Math.sin(x * d.frequency + p[0]);
    h += d.amplitude * 0.62 * Math.sin(x * d.frequency * 2.17 + p[1]);
    h += d.amplitude * 0.34 * Math.sin(x * d.frequency * 4.31 + p[2]);
    h += d.roughness * 0.9 * Math.sin(x * d.frequency * 9.7 + p[3]);
    h += d.roughness * 0.45 * Math.sin(x * d.frequency * 17.3 + p[1] * 2.1);

    for (const ramp of this.ramps) {
      const dx = x - ramp.x;
      // the window must extend well past the landing dip or the gaussian gets
      // clipped mid-curve and produces an unclimbable wall
      if (dx > -ramp.width * 6 && dx < ramp.width * 6) {
        // asymmetric crest: gentle approach, sharp lip, then a landing dip
        const climb = Math.exp(-Math.pow(dx / ramp.width, 2));
        const land = -ramp.dip * Math.exp(-Math.pow((dx - ramp.width * 2.4) / (ramp.width * 1.6), 2));
        h += ramp.amp * climb + land;
      }
    }
    return h;
  }

  private heightAt(x: number, z: number, ridge: number, lateralPhase: number): number {
    const d = this.diff;
    const halfCorridor = d.corridorWidth * 0.5;
    const halfWidth = this.width * 0.5;
    const az = Math.abs(z);

    // gentle lateral roll so the track is genuinely 3D
    const lateralRoll = Math.sin(z * 0.055 + x * 0.018 + lateralPhase) * 0.9;
    let h = ridge + lateralRoll;

    // cliffs / falloff outside the drivable corridor
    if (az > halfCorridor) {
      const t = smoothstep(halfCorridor, halfCorridor + (halfWidth - halfCorridor) * 0.75, az);
      h -= d.cliffDrop * t * t;
      h += Math.sin(z * 0.4 + x * 0.1) * 0.8 * t;
    }

    // Flatten the first ~30 m into a gentle launch strip and blend back into
    // the real ridgeline by 70 m, so every difficulty starts drivable.
    const launchBlend = smoothstep(26, 74, x);
    const launchHeight = this.ridgeHeight(-6) * 0.12 + Math.max(0, x) * 0.035;
    h = lerp(launchHeight, h, launchBlend);

    // keep the finish area from being a wall
    if (x > this.length + 10) {
      h = lerp(h, this.ridgeHeight(this.length + 10), smoothstep(this.length + 10, this.length + 60, x));
    }
    return h;
  }

  private buildGeometry(cols: number, rows: number, minHeight: number, maxHeight: number) {
    const vertexCount = cols * rows;
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(this.nx * this.nz * 6);

    for (let ix = 0; ix < cols; ix++) {
      const x = this.originX + ix * this.stepX;
      for (let iz = 0; iz < rows; iz++) {
        const z = this.originZ + iz * this.stepZ;
        const i = (ix * rows + iz) * 3;
        vertices[i] = x;
        vertices[i + 1] = this.heights[ix * rows + iz];
        vertices[i + 2] = z;
      }
    }

    let ptr = 0;
    for (let ix = 0; ix < this.nx; ix++) {
      for (let iz = 0; iz < this.nz; iz++) {
        const a = ix * rows + iz;
        const b = (ix + 1) * rows + iz;
        const c = (ix + 1) * rows + iz + 1;
        const d = ix * rows + iz + 1;
        // wound counter-clockwise when viewed from above (upward normals)
        indices[ptr++] = a;
        indices[ptr++] = d;
        indices[ptr++] = b;
        indices[ptr++] = b;
        indices[ptr++] = d;
        indices[ptr++] = c;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // ---- slope + height based vertex colours --------------------------
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const cLow = new THREE.Color(this.env.palette.surfaceLow);
    const cHigh = new THREE.Color(this.env.palette.surfaceHigh);
    const cRock = new THREE.Color(this.env.palette.rock);
    const cCap = new THREE.Color('#ffffff');
    const tmp = new THREE.Color();
    const heightSpan = Math.max(6, maxHeight - minHeight);
    const noiseSeed = this.phases[0];

    for (let v = 0; v < vertexCount; v++) {
      const ny = normals.getY(v);
      const x = vertices[v * 3];
      const y = vertices[v * 3 + 1];
      const z = vertices[v * 3 + 2];

      const heightT = clamp((y - minHeight) / heightSpan, 0, 1);
      const patch =
        Math.sin(x * 0.09 + z * 0.11 + noiseSeed) * 0.5 + Math.sin(x * 0.31 - z * 0.23) * 0.5;
      tmp.copy(cLow).lerp(cHigh, clamp(heightT * 0.85 + patch * 0.16 + 0.1, 0, 1));

      const rockMix = smoothstep(0.86, 0.55, ny);
      tmp.lerp(cRock, rockMix * 0.92);

      if (this.env.capAmount > 0) {
        const cap = smoothstep(0.72, 0.95, ny) * smoothstep(0.45, 0.8, heightT) * this.env.capAmount;
        tmp.lerp(cCap, cap);
      }

      const shade = 0.94 + Math.sin(x * 1.7 + z * 2.3) * 0.03 + Math.sin(y * 0.9) * 0.03;
      colors[v * 3] = clamp(tmp.r * shade, 0, 1);
      colors[v * 3 + 1] = clamp(tmp.g * shade, 0, 1);
      colors[v * 3 + 2] = clamp(tmp.b * shade, 0, 1);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    return { geometry, vertices, indices };
  }
}
