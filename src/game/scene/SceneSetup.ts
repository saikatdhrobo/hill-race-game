import * as THREE from 'three';
import type { EnvironmentConfig } from '../environments';

/**
 * Owns the renderer, camera, sky dome and lights for a run.
 * Kept separate from GameEngine so the scene can be reused for previews.
 */
export class SceneSetup {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly hemi: THREE.HemisphereLight;

  constructor(canvas: HTMLCanvasElement, env: EnvironmentConfig, lowQuality = false) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lowQuality,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQuality ? 1.25 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = lowQuality ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.4, 1400);
    this.camera.position.set(-8, 8, 0);

    this.scene.fog = new THREE.Fog(env.palette.fog, env.fogNear, env.fogFar);
    this.scene.background = new THREE.Color(env.palette.skyBottom);

    // ---- gradient sky dome -------------------------------------------
    const skyGeo = new THREE.SphereGeometry(900, 24, 14);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(env.palette.skyTop) },
        bottomColor: { value: new THREE.Color(env.palette.skyBottom) },
        glowColor: { value: new THREE.Color(env.scenery.horizonGlow) },
        offset: { value: 40 },
        exponent: { value: 0.85 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 glowColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          vec3 col = mix(bottomColor, topColor, t);
          float band = smoothstep(0.055, 0.0, abs(h - 0.015));
          col = mix(col, glowColor, band * 0.4);
          // soft haze just above the horizon so distant land melts into the sky
          col = mix(col, bottomColor, smoothstep(0.12, -0.02, h) * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // ---- lighting ----------------------------------------------------
    this.hemi = new THREE.HemisphereLight(env.palette.ambientSky, env.palette.ambientGround, env.ambientIntensity);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(env.palette.sun, env.sunIntensity);
    this.sun.position.set(-60, 90, 45);
    this.sun.castShadow = true;
    const shadowSize = lowQuality ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -55;
    this.sun.shadow.camera.right = 55;
    this.sun.shadow.camera.top = 55;
    this.sun.shadow.camera.bottom = -55;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  /** Keeps the shadow frustum centred on the action. */
  followSun(target: THREE.Vector3): void {
    this.sun.position.set(target.x - 60, target.y + 90, target.z + 45);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
  }

  followSky(target: THREE.Vector3): void {
    this.sky.position.copy(target);
  }

  resize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(ratio);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.scene.clear();
  }
}
