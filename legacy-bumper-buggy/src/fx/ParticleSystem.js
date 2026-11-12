import * as THREE from 'three';

/**
 * Lightweight pooled 3D toy particle system using InstancedMesh (single draw call!).
 * Handles tire dirt kickup, exhaust puffs, nitro boost flames, and coin/fuel sparkles.
 */
export class ParticleSystem {
  constructor(scene, maxParticles = 180) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.cursor = 0;

    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.particles = [];
    this.dummy = new THREE.Object3D();
    this.tempColor = new THREE.Color();

    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 0,
        life: 0,
        maxLife: 1,
        size: 0.2,
      });
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.setScalar(0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tempColor.setHex(0xffffff));
    }

    this.scene.add(this.mesh);
  }

  spawn({ x, y, z = 0, vx = 0, vy = 0, vz = 0, size = 0.18, life = 0.45, color = 0xffffff, gravity = -9 }) {
    const p = this.particles[this.cursor];
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;

    this.mesh.setColorAt(this.cursor, this.tempColor.setHex(color));
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    this.cursor = (this.cursor + 1) % this.maxParticles;
  }

  emitBurst(x, y, colorHex, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.4 + Math.random() * 4.2;
      this.spawn({
        x,
        y,
        z: (Math.random() - 0.5) * 1.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 1.8,
        vz: (Math.random() - 0.5) * 2.5,
        size: 0.16 + Math.random() * 0.12,
        life: 0.42 + Math.random() * 0.22,
        color: colorHex,
        gravity: -12,
      });
    }
  }

  emitTireDirt(x, y, vxCar) {
    const colors = [0x8c4a23, 0xb56738, 0x4cd137];
    const col = colors[Math.floor(Math.random() * colors.length)];
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.3,
      y: y + 0.1,
      z: (Math.random() > 0.5 ? 0.85 : -0.85) + (Math.random() - 0.5) * 0.25,
      vx: -Math.abs(vxCar) * 0.35 - 1.5 - Math.random() * 2.2,
      vy: 1.8 + Math.random() * 2.6,
      vz: (Math.random() - 0.5) * 1.2,
      size: 0.12 + Math.random() * 0.09,
      life: 0.36 + Math.random() * 0.18,
      color: col,
      gravity: -15,
    });
  }

  emitExhaust(x, y, pitch, nitroActive) {
    const backX = -Math.cos(pitch);
    const backY = -Math.sin(pitch);

    if (nitroActive) {
      const nitroColors = [0x00e5ff, 0xff9f1a, 0xfff200];
      for (let i = 0; i < 2; i++) {
        this.spawn({
          x: x + (Math.random() - 0.5) * 0.15,
          y: y + (Math.random() - 0.5) * 0.15,
          z: i === 0 ? 0.26 : -0.26,
          vx: backX * (8 + Math.random() * 4),
          vy: backY * (8 + Math.random() * 4) + (Math.random() - 0.5) * 1.5,
          vz: (Math.random() - 0.5) * 0.6,
          size: 0.19 + Math.random() * 0.1,
          life: 0.22 + Math.random() * 0.1,
          color: nitroColors[Math.floor(Math.random() * nitroColors.length)],
          gravity: 1.5,
        });
      }
    } else {
      this.spawn({
        x,
        y,
        z: Math.random() > 0.5 ? 0.26 : -0.26,
        vx: backX * 2.4 + (Math.random() - 0.5) * 0.6,
        vy: backY * 2.4 + 1.1 + Math.random() * 0.6,
        vz: (Math.random() - 0.5) * 0.4,
        size: 0.13 + Math.random() * 0.07,
        life: 0.38,
        color: 0xf1f6fb,
        gravity: 2.2,
      });
    }
  }

  update(dt) {
    let anyUpdated = false;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      anyUpdated = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = p.life / p.maxLife;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(t * 3, t * 2, 0);
      this.dummy.scale.setScalar(Math.max(0.01, p.size * t));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
