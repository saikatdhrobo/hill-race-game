import * as THREE from 'three';
import type { VehicleConfig } from '../vehicles';

interface WheelView {
  pivot: THREE.Group;
  spinner: THREE.Group;
  localX: number;
  localZ: number;
  connectionY: number;
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function slantedBox(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  taperTop: number,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * taperTop);
      pos.setZ(i, pos.getZ(i) * taperTop);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Cylinder oriented between two local points — used for cages, rails and struts. */
function bar(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds an original low-poly vehicle model from primitives.
 * Each garage entry has its own silhouette, wheels and detailing.
 */
export class VehicleView {
  readonly group = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly wheels: WheelView[] = [];
  private readonly brakeLights: THREE.MeshStandardMaterial;
  private readonly headlights: THREE.MeshStandardMaterial;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private readonly def: VehicleConfig) {
    const c = def.colors;
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.42, metalness: 0.28, flatShading: true }),
    );
    const accentMat = this.track(
      new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.35, metalness: 0.45, flatShading: true }),
    );
    const trimMat = this.track(
      new THREE.MeshStandardMaterial({ color: c.trim, roughness: 0.75, metalness: 0.15, flatShading: true }),
    );
    const glassMat = this.track(
      new THREE.MeshStandardMaterial({
        color: c.glass,
        roughness: 0.08,
        metalness: 0.6,
        transparent: true,
        opacity: 0.72,
      }),
    );
    const rimMat = this.track(
      new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.3, metalness: 0.8, flatShading: true }),
    );
    const tyreMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#181a1f', roughness: 0.95, metalness: 0.05 }),
    );
    this.headlights = this.track(
      new THREE.MeshStandardMaterial({
        color: '#fff7d6',
        emissive: new THREE.Color('#ffe9a8'),
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );
    this.brakeLights = this.track(
      new THREE.MeshStandardMaterial({
        color: '#5a1414',
        emissive: new THREE.Color('#ff2d2d'),
        emissiveIntensity: 0.6,
        roughness: 0.4,
      }),
    );

    this.buildBody(bodyMat, accentMat, trimMat, glassMat);
    this.buildWheels(tyreMat, rimMat, accentMat);
    this.group.add(this.bodyGroup);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  private track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  private buildBody(
    bodyMat: THREE.Material,
    accentMat: THREE.Material,
    trimMat: THREE.Material,
    glassMat: THREE.Material,
  ): void {
    const d = this.def;
    const { x: hx, y: hy, z: hz } = d.half;
    const b = this.bodyGroup;

    switch (d.style) {
      case 'buggy': {
        b.add(box(hx * 1.75, hy * 1.25, hz * 1.85, bodyMat, 0, -0.04, 0));
        b.add(slantedBox(hx * 1.0, hy * 1.5, hz * 1.7, bodyMat, 0.72, hx * 0.42, hy * 0.55, 0)); // nose
        b.add(box(hx * 0.55, hy * 0.9, hz * 1.5, trimMat, -hx * 0.18, hy * 0.72, 0)); // seat back
        // tube-frame cage
        const cage = new THREE.Group();
        const top = hy + 0.52;
        for (const z of [-hz * 0.82, hz * 0.82]) {
          cage.add(bar(new THREE.Vector3(-hx * 0.75, hy * 0.9, z), new THREE.Vector3(-hx * 0.62, top, z * 0.78), 0.045, accentMat));
          cage.add(bar(new THREE.Vector3(-hx * 0.62, top, z * 0.78), new THREE.Vector3(hx * 0.42, top, z * 0.72), 0.045, accentMat));
          cage.add(bar(new THREE.Vector3(hx * 0.42, top, z * 0.72), new THREE.Vector3(hx * 0.55, hy * 0.75, z), 0.045, accentMat));
        }
        cage.add(bar(new THREE.Vector3(-hx * 0.62, top, -hz * 0.78), new THREE.Vector3(-hx * 0.62, top, hz * 0.78), 0.045, accentMat));
        cage.add(bar(new THREE.Vector3(hx * 0.42, top, -hz * 0.72), new THREE.Vector3(hx * 0.42, top, hz * 0.72), 0.045, accentMat));
        b.add(cage);
        b.add(box(0.1, 0.34, 0.62, glassMat, hx * 0.3, hy * 0.95, 0)); // windscreen
        b.add(box(hx * 1.1, 0.06, hz * 2.1, accentMat, -hx * 0.95, hy * 0.72, 0)); // rear wing
        b.add(box(0.08, 0.3, 0.08, trimMat, -hx * 0.95, hy * 0.42, hz * 0.55));
        b.add(box(0.08, 0.3, 0.08, trimMat, -hx * 0.95, hy * 0.42, -hz * 0.55));
        b.add(box(0.16, 0.18, 0.34, trimMat, -hx * 0.95, -hy * 0.35, 0)); // exhaust
        break;
      }
      case 'monster': {
        b.add(box(hx * 1.9, hy * 1.35, hz * 1.9, bodyMat, 0, hy * 0.2, 0));
        b.add(slantedBox(hx * 1.1, hy * 1.5, hz * 1.7, bodyMat, 0.78, hx * 0.35, hy * 0.85, 0));
        b.add(box(hx * 0.85, hy * 1.15, hz * 1.55, glassMat, hx * 0.12, hy * 1.35, 0));
        b.add(box(hx * 0.9, hy * 1.2, hz * 1.66, bodyMat, -hx * 0.72, hy * 0.9, 0));
        // fender flares
        for (const z of [-hz, hz]) {
          for (const x of [d.wheel.frontX, d.wheel.rearX]) {
            b.add(box(0.62, 0.12, 0.2, trimMat, x, -hy * 0.2, z * 1.02));
          }
        }
        // roof light bar
        b.add(box(0.12, 0.1, hz * 1.2, trimMat, hx * 0.62, hy * 2.05, 0));
        for (let i = 0; i < 4; i++) {
          b.add(box(0.1, 0.1, 0.11, this.headlights, hx * 0.66, hy * 2.05, -hz * 0.75 + (i * hz * 1.5) / 3));
        }
        b.add(box(0.12, 0.4, 0.12, trimMat, -hx * 0.6, hy * 1.6, 0)); // exhaust stack
        break;
      }
      case 'rally': {
        b.add(slantedBox(hx * 1.95, hy * 1.1, hz * 1.9, bodyMat, 0.9, 0, 0, 0));
        b.add(slantedBox(hx * 0.95, hy * 1.25, hz * 1.7, glassMat, 0.86, -hx * 0.05, hy * 0.95, 0));
        b.add(box(hx * 1.95, 0.06, hz * 0.35, accentMat, 0, hy * 0.5, 0)); // racing stripe
        b.add(box(0.42, 0.05, hz * 1.95, accentMat, hx * 0.98, -hy * 0.42, 0)); // splitter
        b.add(box(hx * 0.8, 0.05, hz * 1.9, accentMat, -hx * 1.02, hy * 0.95, 0)); // wing
        b.add(box(0.07, 0.34, 0.07, trimMat, -hx * 1.0, hy * 0.62, hz * 0.7));
        b.add(box(0.07, 0.34, 0.07, trimMat, -hx * 1.0, hy * 0.62, -hz * 0.7));
        b.add(box(0.55, 0.1, 0.28, trimMat, -hx * 1.02, -hy * 0.5, 0.28)); // diffuser
        b.add(box(0.2, 0.22, hz * 1.85, trimMat, hx * 0.98, -hy * 0.35, 0)); // bumper
        break;
      }
      case 'pickup': {
        b.add(box(hx * 1.95, hy * 1.2, hz * 1.9, bodyMat, 0, hy * 0.05, 0));
        b.add(slantedBox(hx * 0.95, hy * 1.7, hz * 1.75, bodyMat, 0.82, hx * 0.42, hy * 1.1, 0)); // cab
        b.add(box(hx * 0.8, hy * 0.85, hz * 1.62, glassMat, hx * 0.42, hy * 1.35, 0));
        // bed
        b.add(box(hx * 0.85, hy * 0.5, 0.07, bodyMat, -hx * 0.68, hy * 0.95, hz * 0.9));
        b.add(box(hx * 0.85, hy * 0.5, 0.07, bodyMat, -hx * 0.68, hy * 0.95, -hz * 0.9));
        b.add(box(0.07, hy * 0.5, hz * 1.8, bodyMat, -hx * 1.4, hy * 0.95, 0));
        b.add(box(0.1, 0.1, hz * 1.9, trimMat, hx * 1.0, -hy * 0.2, 0)); // bull bar
        b.add(box(0.16, 0.34, 0.5, trimMat, -hx * 1.45, -hy * 0.3, 0.5)); // exhaust
        b.add(box(hx * 0.7, 0.12, 0.12, accentMat, -hx * 0.5, hy * 1.5, hz * 0.6)); // bed rail
        break;
      }
      case 'suv':
      default: {
        b.add(box(hx * 1.95, hy * 1.2, hz * 1.9, bodyMat, 0, hy * 0.05, 0));
        b.add(slantedBox(hx * 1.5, hy * 1.6, hz * 1.82, bodyMat, 0.9, -hx * 0.1, hy * 1.15, 0));
        b.add(box(hx * 1.45, hy * 0.95, hz * 1.66, glassMat, -hx * 0.1, hy * 1.3, 0));
        // roof rack
        b.add(box(hx * 1.2, 0.06, hz * 0.12, trimMat, -hx * 0.15, hy * 2.0, hz * 0.6));
        b.add(box(hx * 1.2, 0.06, hz * 0.12, trimMat, -hx * 0.15, hy * 2.0, -hz * 0.6));
        b.add(box(0.06, 0.7, 0.06, trimMat, hx * 1.0, hy * 0.4, hz * 0.8)); // snorkel
        b.add(box(0.2, 0.24, hz * 1.85, trimMat, hx * 1.0, -hy * 0.25, 0)); // front bar
        b.add(box(0.16, hy * 0.9, hz * 1.5, accentMat, -hx * 1.0, hy * 0.2, 0)); // rear carrier
        break;
      }
    }

    // driver silhouette — reads as a person from the chase camera
    const helmetMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#f7f9fc', roughness: 0.35, metalness: 0.2, flatShading: true }),
    );
    const driverMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#2b3340', roughness: 0.8, flatShading: true }),
    );
    const seatY = d.style === 'monster' ? hy * 1.55 : hy * 0.98;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), helmetMat);
    helmet.position.set(d.style === 'rally' ? hx * 0.02 : -hx * 0.12, seatY + 0.42, d.style === 'rally' ? 0 : 0);
    helmet.castShadow = true;
    b.add(helmet);
    b.add(box(0.34, 0.42, 0.4, driverMat, helmet.position.x - 0.04, seatY + 0.16, helmet.position.z));

    // shared details: headlights + tail lights
    const lightY = d.style === 'rally' ? hy * 0.15 : hy * 0.3;
    for (const z of [-hz * 0.62, hz * 0.62]) {
      b.add(box(0.1, 0.16, 0.34, this.headlights, hx * 0.97, lightY, z));
      b.add(box(0.08, 0.14, 0.3, this.brakeLights, -hx * 0.97, hy * 0.35, z));
    }

    // livery: twin side stripes + a rear number plate give every rig an identity
    for (const z of [-hz * 0.96, hz * 0.96]) {
      b.add(box(hx * 1.3, 0.055, 0.02, accentMat, 0, hy * 0.36, z));
      b.add(box(hx * 0.5, 0.05, 0.02, accentMat, -hx * 0.2, -hy * 0.1, z));
    }
    b.add(box(0.05, 0.22, 0.44, glassMat, -hx * 1.0, hy * 0.05, 0));
    b.add(box(0.06, 0.3, 0.3, accentMat, -hx * 1.0, -hy * 0.2, 0));
    // mud flaps
    for (const x of [d.wheel.frontX, d.wheel.rearX]) {
      for (const z of [-d.wheel.halfTrack, d.wheel.halfTrack]) {
        b.add(box(0.06, 0.2, d.wheel.width * 0.9, trimMat, x - 0.3, -d.wheel.restLength * 0.6, z));
      }
    }
  }

  private buildWheels(tyreMat: THREE.Material, rimMat: THREE.Material, accentMat: THREE.Material): void {
    const w = this.def.wheel;
    const positions: [number, number][] = [
      [w.frontX, w.halfTrack],
      [w.frontX, -w.halfTrack],
      [w.rearX, w.halfTrack],
      [w.rearX, -w.halfTrack],
    ];

    const tyreGeo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 14);
    tyreGeo.rotateX(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(w.radius * 0.55, w.radius * 0.55, w.width * 1.02, 10);
    rimGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(w.radius * 0.16, w.radius * 0.16, w.width * 1.1, 6);
    hubGeo.rotateX(Math.PI / 2);
    // chunky tread blocks so the wheel reads as off-road at a distance
    const treadGeo = new THREE.BoxGeometry(w.radius * 0.34, w.radius * 0.18, w.width * 1.06);
    this.disposables.push(tyreGeo, rimGeo, hubGeo, treadGeo);

    for (const [x, z] of positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, w.connectionY - w.restLength, z);
      const spinner = new THREE.Group();

      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.castShadow = true;
      spinner.add(tyre);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      spinner.add(rim);

      const hub = new THREE.Mesh(hubGeo, accentMat);
      spinner.add(hub);

      for (let i = 0; i < 5; i++) {
        const tread = new THREE.Mesh(treadGeo, tyreMat);
        const a = (i / 5) * Math.PI * 2;
        tread.position.set(Math.cos(a) * w.radius * 0.92, Math.sin(a) * w.radius * 0.92, 0);
        tread.rotation.z = a;
        spinner.add(tread);
      }

      pivot.add(spinner);
      this.group.add(pivot);
      this.wheels.push({ pivot, spinner, localX: x, localZ: z, connectionY: w.connectionY });
    }
  }

  updateWheels(suspensionLengths: number[], rotations: number[], steerAngles: number[]): void {
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const susp = suspensionLengths[i];
      w.pivot.position.y = w.connectionY - Math.max(0, susp);
      w.spinner.rotation.z = -rotations[i];
      w.pivot.rotation.y = i < 2 ? steerAngles[i] : 0;
    }
  }

  setBraking(braking: boolean): void {
    this.brakeLights.emissiveIntensity = braking ? 2.2 : 0.6;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.group.clear();
  }
}
