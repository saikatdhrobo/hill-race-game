import * as THREE from 'three';

/**
 * Bright, cheerful 3D stylized skybox, lighting rig, drifting puffy clouds,
 * and parallax background hills matching the sunny toy-world aesthetic.
 */
export class SkyEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.parallaxHills = [];

    this._setupLights();
    this._buildSkyDome();
    this._buildClouds();
    this._buildParallaxBackdrop();
  }

  _setupLights() {
    // Soft colorful hemisphere light so shadows stay vibrant & stylized
    this.hemiLight = new THREE.HemisphereLight(0xb8ecff, 0x56b847, 1.05);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    // Warm golden-white sun directional light that tracks player X
    this.sunLight = new THREE.DirectionalLight(0xfff7e2, 1.65);
    this.sunLight.position.set(18, 32, 22);
    this.sunLight.castShadow = true;

    // Mobile-friendly crisp shadow frustum centered around the car
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 90;
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0008;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  _buildSkyDome() {
    const skyGeo = new THREE.SphereGeometry(260, 24, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1f93ff) },
        midColor: { value: new THREE.Color(0x7cd8ff) },
        bottomColor: { value: new THREE.Color(0xe9fbff) },
        sunDir: { value: new THREE.Vector3(0.45, 0.52, -0.72).normalize() },
      },
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform vec3 sunDir;
        varying vec3 vLocalPos;
        void main() {
          float h = clamp(vLocalPos.y, -0.2, 1.0);
          vec3 col = mix(bottomColor, midColor, smoothstep(-0.08, 0.28, h));
          col = mix(col, topColor, smoothstep(0.25, 0.85, h));

          // Cheerful warm sun disc & halo in background sky
          float sunAmt = max(dot(normalize(vLocalPos), sunDir), 0.0);
          col += vec3(1.0, 0.93, 0.65) * pow(sunAmt, 24.0) * 0.42;
          col += vec3(1.0, 0.98, 0.85) * smoothstep(0.994, 0.9985, sunAmt) * 0.85;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);
  }

  _buildClouds() {
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.0,
      emissive: 0xdff4ff,
      emissiveIntensity: 0.25,
    });

    const puffGeo = new THREE.SphereGeometry(1, 12, 10);

    for (let i = 0; i < 18; i++) {
      const cluster = new THREE.Group();
      const puffCount = 3 + (i % 3);
      for (let p = 0; p < puffCount; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        const r = p === 1 ? 2.4 : 1.65 + (p % 2) * 0.35;
        puff.scale.set(r * 1.25, r * 0.82, r * 0.85);
        puff.position.set((p - (puffCount - 1) * 0.5) * 2.1, p === 1 ? 0.55 : 0, (p % 2) * 0.4);
        cluster.add(puff);
      }

      const scale = 0.85 + (i % 4) * 0.32;
      cluster.scale.setScalar(scale);

      const cloudData = {
        mesh: cluster,
        offsetX: (i - 5) * 22 + (i % 3) * 5,
        baseY: 16 + (i % 5) * 4.5,
        z: -24 - (i % 4) * 11,
        driftSpeed: 0.45 + (i % 3) * 0.25,
      };
      cluster.position.set(cloudData.offsetX, cloudData.baseY, cloudData.z);
      this.cloudGroup.add(cluster);
      this.clouds.push(cloudData);
    }

    this.scene.add(this.cloudGroup);
  }

  _buildParallaxBackdrop() {
    // Distant pastel green/teal rolling mountain mounds for rich depth
    this.backdropGroup = new THREE.Group();

    const farMat = new THREE.MeshStandardMaterial({
      color: 0x7fd48b,
      roughness: 0.9,
      metalness: 0.0,
    });
    const midMat = new THREE.MeshStandardMaterial({
      color: 0x5cc465,
      roughness: 0.88,
      metalness: 0.0,
    });

    const moundGeo = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);

    for (let i = 0; i < 16; i++) {
      const isFar = i % 2 === 0;
      const mound = new THREE.Mesh(moundGeo, isFar ? farMat : midMat);
      const w = isFar ? 34 + (i % 3) * 9 : 24 + (i % 4) * 6;
      const h = isFar ? 18 + (i % 4) * 5 : 12 + (i % 3) * 4;
      mound.scale.set(w, h, 10);

      const item = {
        mesh: mound,
        localX: (i - 4) * 28,
        y: isFar ? -8 : -7,
        z: isFar ? -56 : -36,
        parallax: isFar ? 0.78 : 0.58,
      };
      mound.position.set(item.localX, item.y, item.z);
      this.backdropGroup.add(mound);
      this.parallaxHills.push(item);
    }

    this.scene.add(this.backdropGroup);
  }

  update(dt, focusX, focusY) {
    // Keep sky dome & sun shadow centered around car
    this.skyDome.position.set(focusX, focusY * 0.3, 0);
    this.sunLight.position.set(focusX + 16, focusY + 30, 22);
    this.sunLight.target.position.set(focusX + 4, focusY, 0);
    this.sunLight.target.updateMatrixWorld();

    // Wrap drifting clouds endlessly around camera focus
    const span = 198;
    for (const c of this.clouds) {
      c.offsetX -= c.driftSpeed * dt;
      let worldX = c.offsetX;
      const rel = worldX - focusX * 0.65;
      if (rel < -span) {
        c.offsetX += span * 2;
      } else if (rel > span) {
        c.offsetX -= span * 2;
      }
      c.mesh.position.x = focusX * 0.65 + ((c.offsetX - focusX * 0.65));
      c.mesh.position.y = c.baseY + focusY * 0.22;
    }

    // Wrap distant parallax mountain mounds endlessly
    const hillSpan = 224;
    for (const h of this.parallaxHills) {
      const anchor = focusX * h.parallax;
      while (anchor + h.localX < focusX - hillSpan) {
        h.localX += hillSpan * 2;
      }
      while (anchor + h.localX > focusX + hillSpan) {
        h.localX -= hillSpan * 2;
      }
      h.mesh.position.x = anchor + h.localX;
      h.mesh.position.y = h.y + focusY * 0.15;
    }
  }
}
