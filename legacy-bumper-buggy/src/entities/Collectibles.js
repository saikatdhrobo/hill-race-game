import * as THREE from 'three';

/**
 * Manages spinning gold coins and glowing red fuel canisters along the 2.5D track.
 * Uses shared geometries & materials for ultra-low draw overhead on mobile devices.
 */
export class CollectiblesManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.time = 0;

    this._initSharedAssets();
  }

  _initSharedAssets() {
    this.matGold = new THREE.MeshStandardMaterial({
      color: 0xffcf24,
      emissive: 0xd98a00,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.55,
    });
    this.matGoldInner = new THREE.MeshStandardMaterial({
      color: 0xffe875,
      roughness: 0.18,
      metalness: 0.65,
    });
    this.matFuelRed = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      emissive: 0x991111,
      emissiveIntensity: 0.25,
      roughness: 0.28,
      metalness: 0.12,
    });
    this.matFuelCap = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      roughness: 0.25,
    });
    this.matFuelGlow = new THREE.MeshBasicMaterial({
      color: 0xffdf5d,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    // Coin geometries
    this.geoCoinBody = new THREE.CylinderGeometry(0.46, 0.46, 0.14, 18);
    this.geoCoinBody.rotateX(Math.PI / 2);
    this.geoCoinStar = new THREE.OctahedronGeometry(0.24, 0);

    // Fuel canister geometries
    this.geoCanBody = new THREE.BoxGeometry(0.68, 0.82, 0.42);
    this.geoCanHandle = new THREE.BoxGeometry(0.36, 0.12, 0.14);
    this.geoCanSpout = new THREE.CylinderGeometry(0.07, 0.09, 0.24, 8);
    this.geoHalo = new THREE.RingGeometry(0.58, 0.72, 20);
  }

  spawnCoin(x, y) {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(this.geoCoinBody, this.matGold);
    group.add(disc);

    const star = new THREE.Mesh(this.geoCoinStar, this.matGoldInner);
    star.scale.set(1, 1, 0.72);
    group.add(star);

    group.position.set(x, y, 0);
    this.scene.add(group);

    this.items.push({
      type: 'coin',
      mesh: group,
      x,
      baseY: y,
      phase: x * 0.45,
      collected: false,
    });
  }

  spawnFuel(x, y) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(this.geoCanBody, this.matFuelRed);
    body.castShadow = true;
    group.add(body);

    const handle = new THREE.Mesh(this.geoCanHandle, this.matFuelRed);
    handle.position.set(-0.06, 0.48, 0);
    group.add(handle);

    const spout = new THREE.Mesh(this.geoCanSpout, this.matFuelCap);
    spout.position.set(0.22, 0.48, 0);
    spout.rotation.z = -0.35;
    group.add(spout);

    // Yellow badge stripe on both sides
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.45),
      this.matFuelCap
    );
    group.add(badge);

    const halo = new THREE.Mesh(this.geoHalo, this.matFuelGlow);
    group.add(halo);

    group.position.set(x, y, 0);
    this.scene.add(group);

    this.items.push({
      type: 'fuel',
      mesh: group,
      halo,
      x,
      baseY: y,
      phase: x * 0.3,
      collected: false,
    });
  }

  /**
   * Animates collectibles, checks pickup radius against car center, and prunes passed items.
   */
  update(dt, carPos) {
    this.time += dt;
    const picked = [];

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Remove items far behind the car
      if (item.x < carPos.x - 55) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
        continue;
      }

      // Spin & gentle float
      item.mesh.rotation.y = this.time * 2.8 + item.phase;
      item.mesh.position.y = item.baseY + Math.sin(this.time * 3.4 + item.phase) * 0.16;

      if (item.halo) {
        item.halo.lookAt(carPos.x, item.mesh.position.y, 14);
        const pulse = 1 + Math.sin(this.time * 5.5) * 0.14;
        item.halo.scale.setScalar(pulse);
      }

      // Generous toy-friendly pickup radius covering chassis & oversized wheels
      const dx = item.x - carPos.x;
      const dy = item.mesh.position.y - (carPos.y + 0.25);
      if (dx * dx + dy * dy < 2.25 * 2.25) {
        picked.push({
          type: item.type,
          x: item.x,
          y: item.mesh.position.y,
        });
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }

    return picked;
  }

  reset() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
    }
    this.items.length = 0;
  }
}
