import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { CuteCar } from './entities/CuteCar.js';
import { SkyEnvironment } from './world/SkyEnvironment.js';
import { TerrainManager } from './world/TerrainManager.js';
import { CollectiblesManager } from './entities/Collectibles.js';
import { ParticleSystem } from './fx/ParticleSystem.js';
import { SoundManager } from './audio/SoundManager.js';

const STORAGE_BEST_KEY = 'bumper_buggy_best_distance_v1';

class BumperBuggyGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // Core Game State: 'menu' | 'playing' | 'gameover'
    this.state = 'menu';
    this.selectedMode = 'progressive';

    this.coins = 0;
    this.maxDistance = 0;
    this.bestDistance = Number(localStorage.getItem(STORAGE_BEST_KEY) || 0);
    this.coinCombo = 0;
    this.coinComboTimer = 0;
    this.outOfFuelStallTimer = 0;
    this.exhaustEmitTimer = 0;
    this.dirtEmitTimer = 0;
    this.toastTimeout = null;

    // Input states (shared seamlessly across keyboard, mouse, and touch)
    this.controls = {
      keyGas: false,
      keyBrake: false,
      keyNitro: false,
      mouseNitro: false,
      touchGas: false,
      touchBrake: false,
      touchNitro: false,
      get gas() {
        return this.keyGas || this.touchGas;
      },
      get brake() {
        return this.keyBrake || this.touchBrake;
      },
      get nitro() {
        return this.keyNitro || this.mouseNitro || this.touchNitro;
      },
    };

    this._initRendererAndCamera();
    this._initWorld();
    this._cacheDom();
    this._detectTouchDevice();
    this._bindEvents();

    // Prepare initial sunny meadow scene behind menu card
    this.terrain.reset(this.selectedMode);
    const spawnGroundY = this.terrain.getSurfaceHeightAt(0) ?? 0;
    this.car.reset(0, spawnGroundY + 2.1);

    this.camPos = new THREE.Vector3(5.5, spawnGroundY + 3.2, 10.5);
    this.camTarget = new THREE.Vector3(0.5, spawnGroundY + 1.1, 0);

    this.lastTime = performance.now();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initRendererAndCamera() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9ee4ff, 0.0042);

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.5, 420);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    // Cap pixel ratio to 2 for smooth 60 FPS on high-DPI mobile screens
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
  }

  _initWorld() {
    this.sound = new SoundManager();
    this.physics = new PhysicsWorld();
    this.sky = new SkyEnvironment(this.scene);
    this.collectibles = new CollectiblesManager(this.scene);
    this.terrain = new TerrainManager(this.scene, this.physics, this.collectibles);
    this.particles = new ParticleSystem(this.scene, 180);
    this.car = new CuteCar(this.scene, this.physics);
    this.tempVec = new THREE.Vector3();
  }

  _cacheDom() {
    this.ui = {
      hud: document.getElementById('hud'),
      coinPill: document.getElementById('coin-pill'),
      coinValue: document.getElementById('coin-value'),
      distanceValue: document.getElementById('distance-value'),
      bestDistanceValue: document.getElementById('best-distance-value'),
      zoneLabel: document.getElementById('zone-label'),
      fuelBar: document.getElementById('fuel-bar'),
      nitroBar: document.getElementById('nitro-bar'),
      lowFuelBanner: document.getElementById('low-fuel-banner'),
      stuntToast: document.getElementById('stunt-toast'),
      touchControls: document.getElementById('touch-controls'),
      startOverlay: document.getElementById('start-overlay'),
      gameoverOverlay: document.getElementById('gameover-overlay'),
      gameoverReason: document.getElementById('gameover-reason'),
      finalDistance: document.getElementById('final-distance'),
      finalCoins: document.getElementById('final-coins'),
      finalBest: document.getElementById('final-best'),
      newRecordPill: document.getElementById('new-record-pill'),
      btnStart: document.getElementById('btn-start'),
      btnRetry: document.getElementById('btn-retry'),
      btnSound: document.getElementById('btn-sound'),
      btnRestartHud: document.getElementById('btn-restart-hud'),
      btnGas: document.getElementById('btn-gas'),
      btnBrake: document.getElementById('btn-brake'),
      btnNitro: document.getElementById('btn-nitro'),
      modePills: Array.from(document.querySelectorAll('.mode-pill')),
    };

    this.ui.bestDistanceValue.textContent = Math.floor(this.bestDistance);
  }

  _detectTouchDevice() {
    const hasCoarsePointer =
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouchPoints =
      'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    if (hasCoarsePointer || hasTouchPoints) {
      document.body.classList.add('is-touch');
    }

    // Also dynamically enable touch UI if user touches screen on a hybrid laptop/tablet
    window.addEventListener(
      'touchstart',
      () => {
        document.body.classList.add('is-touch');
      },
      { passive: true, once: true }
    );
  }

  _bindEvents() {
    // Responsive resize
    window.addEventListener('resize', () => this._onResize());

    // Mode selector pills on start screen
    this.ui.modePills.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.ui.modePills.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.dataset.mode;
        this.terrain.reset(this.selectedMode);
        const y = this.terrain.getSurfaceHeightAt(0) ?? 0;
        this.car.reset(0, y + 2.1);
      });
    });

    // Start / Retry / Restart / Sound buttons
    this.ui.btnStart.addEventListener('click', () => this.startGame());
    this.ui.btnRetry.addEventListener('click', () => this.startGame());
    this.ui.btnRestartHud.addEventListener('click', () => this.startGame());

    this.ui.btnSound.addEventListener('click', () => {
      this.sound.init();
      const muted = this.sound.toggleMute();
      this.ui.btnSound.textContent = muted ? '🔇' : '🔊';
    });

    // Desktop Keyboard (Arrow keys + WASD + Space/Shift Nitro + R Restart)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;

      if (this.state !== 'playing' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        this.startGame();
        return;
      }

      if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowUp' || code === 'KeyW') {
        this.controls.keyGas = true;
      } else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowDown' || code === 'KeyS') {
        this.controls.keyBrake = true;
      } else if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        this.controls.keyNitro = true;
      } else if (code === 'KeyR' && this.state === 'playing') {
        this.startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowUp' || code === 'KeyW') {
        this.controls.keyGas = false;
      } else if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowDown' || code === 'KeyS') {
        this.controls.keyBrake = false;
      } else if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        this.controls.keyNitro = false;
      }
    });

    window.addEventListener('blur', () => this._clearInputs());

    // Desktop Mouse Click on Canvas for Nitro Boost
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0 && this.state === 'playing') {
        this.sound.init();
        this.controls.mouseNitro = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') {
        this.controls.mouseNitro = false;
      }
    });

    // Multi-touch safe On-Screen Pedals (Gas on right, Brake on left, Nitro button)
    this._bindTouchPedal(this.ui.btnGas, 'touchGas');
    this._bindTouchPedal(this.ui.btnBrake, 'touchBrake');
    this._bindTouchPedal(this.ui.btnNitro, 'touchNitro');
  }

  _bindTouchPedal(element, controlProp) {
    const activePointers = new Set();

    const updateState = () => {
      const pressed = activePointers.size > 0;
      this.controls[controlProp] = pressed;
      element.classList.toggle('pressed', pressed);
    };

    element.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.init();
      element.setPointerCapture?.(e.pointerId);
      activePointers.add(e.pointerId);
      updateState();
    });

    const release = (e) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.delete(e.pointerId);
        updateState();
      }
    };

    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  _clearInputs() {
    this.controls.keyGas = false;
    this.controls.keyBrake = false;
    this.controls.keyNitro = false;
    this.controls.mouseNitro = false;
    this.controls.touchGas = false;
    this.controls.touchBrake = false;
    this.controls.touchNitro = false;
    this.ui.btnGas.classList.remove('pressed');
    this.ui.btnBrake.classList.remove('pressed');
    this.ui.btnNitro.classList.remove('pressed');
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
  }

  startGame() {
    this.sound.init();
    this._clearInputs();

    this.state = 'playing';
    this.coins = 0;
    this.maxDistance = 0;
    this.coinCombo = 0;
    this.coinComboTimer = 0;
    this.outOfFuelStallTimer = 0;

    this.terrain.reset(this.selectedMode);
    const startY = this.terrain.getSurfaceHeightAt(0) ?? 0;
    this.car.reset(0, startY + 2.05);

    this.ui.startOverlay.classList.add('hidden');
    this.ui.gameoverOverlay.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.touchControls.classList.add('active');
    this.ui.lowFuelBanner.classList.add('hidden');

    this._updateHudDom();
  }

  triggerGameOver(reasonText) {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this._clearInputs();

    this.sound.playGameOver();
    this.sound.updateEngine(0, false, false, false);

    this.ui.touchControls.classList.remove('active');
    this.ui.lowFuelBanner.classList.add('hidden');

    const distMeters = Math.floor(this.maxDistance);
    let isNewRecord = false;
    if (distMeters > this.bestDistance && distMeters > 0) {
      this.bestDistance = distMeters;
      localStorage.setItem(STORAGE_BEST_KEY, String(this.bestDistance));
      isNewRecord = true;
    }

    this.ui.gameoverReason.textContent = reasonText;
    this.ui.finalDistance.textContent = `${distMeters}m`;
    this.ui.finalCoins.textContent = String(this.coins);
    this.ui.finalBest.textContent = `${Math.floor(this.bestDistance)}m`;
    this.ui.bestDistanceValue.textContent = String(Math.floor(this.bestDistance));
    this.ui.newRecordPill.classList.toggle('hidden', !isNewRecord);

    this.ui.gameoverOverlay.classList.remove('hidden');
  }

  showToast(text) {
    this.ui.stuntToast.textContent = text;
    this.ui.stuntToast.classList.remove('hidden');
    // Re-trigger CSS animation cleanly
    this.ui.stuntToast.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    this.ui.stuntToast.offsetHeight;
    this.ui.stuntToast.style.animation = '';

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.ui.stuntToast.classList.add('hidden');
    }, 1550);
  }

  _updateHudDom() {
    this.ui.coinValue.textContent = String(this.coins);
    this.ui.distanceValue.textContent = String(Math.floor(this.maxDistance));
    this.ui.zoneLabel.textContent = this.terrain.getDifficultyLabel(this.maxDistance);

    const fuelPct = Math.max(0, Math.min(100, (this.car.fuel / this.car.maxFuel) * 100));
    this.ui.fuelBar.style.width = `${fuelPct}%`;
    const lowFuel = fuelPct < 25;
    this.ui.fuelBar.classList.toggle('warn', lowFuel);
    this.ui.lowFuelBanner.classList.toggle('hidden', !(lowFuel && this.state === 'playing'));

    const nitroPct = Math.max(0, Math.min(100, (this.car.nitro / this.car.maxNitro) * 100));
    this.ui.nitroBar.style.width = `${nitroPct}%`;
  }

  _popCoinBadge() {
    this.ui.coinPill.classList.add('pop');
    setTimeout(() => this.ui.coinPill.classList.remove('pop'), 150);
  }

  _animate(now) {
    requestAnimationFrame(this._animate);

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === 'playing') {
      // Apply engine, brake, nitro & air-stunt forces BEFORE stepping physics
      const status = this.car.updateControlsAndPhysics(
        dt,
        this.controls,
        (x) => this.terrain.getSurfaceHeightAt(x)
      );

      this.physics.step(dt);
      this.car.syncVisuals(dt, status.nitroActive, status.wheelsOnGround === 0);

      const carPos = this.car.chassisBody.position;
      const carVel = this.car.chassisBody.velocity;

      // Update distance score
      if (carPos.x > this.maxDistance) {
        this.maxDistance = carPos.x;
      }

      // Stream procedural terrain chunks & collectibles ahead of car
      this.terrain.update(carPos.x);

      // Handle stunt landings & landing bounce SFX
      if (status.stuntEvent) {
        if (status.stuntEvent.bonus > 0) {
          this.coins += status.stuntEvent.bonus;
          this.showToast(`${status.stuntEvent.type} +${status.stuntEvent.bonus} ★`);
          this._popCoinBadge();
          this.sound.playTrick();
          this.particles.emitBurst(carPos.x, carPos.y + 1.2, 0xffcf24, 16);
        } else if (status.stuntEvent.impact > 0.28) {
          this.sound.playBounce(status.stuntEvent.impact);
        }
      }

      // Update & collect coins / fuel cans
      if (this.coinComboTimer > 0) {
        this.coinComboTimer -= dt;
        if (this.coinComboTimer <= 0) this.coinCombo = 0;
      }

      const picked = this.collectibles.update(dt, carPos);
      for (const item of picked) {
        if (item.type === 'coin') {
          this.coins += 10;
          this.car.nitro = Math.min(this.car.maxNitro, this.car.nitro + 4);
          this.sound.playCoin(this.coinCombo);
          this.coinCombo++;
          this.coinComboTimer = 1.2;
          this._popCoinBadge();
          this.particles.emitBurst(item.x, item.y, 0xffd32a, 10);
        } else if (item.type === 'fuel') {
          this.car.fuel = Math.min(this.car.maxFuel, this.car.fuel + 62);
          this.outOfFuelStallTimer = 0;
          this.sound.playFuel();
          this.showToast('⛽ FUEL TANK REFILLED!');
          this.particles.emitBurst(item.x, item.y, 0x4cd137, 16);
        }
      }

      // Exhaust & tire dirt particles
      this.exhaustEmitTimer -= dt;
      if (this.exhaustEmitTimer <= 0) {
        this.exhaustEmitTimer = status.nitroActive ? 0.025 : 0.09;
        const exPos = this.car.getExhaustWorldPosition(this.tempVec);
        this.particles.emitExhaust(exPos.x, exPos.y, this.car.getPitchAngle(), status.nitroActive);
      }

      this.dirtEmitTimer -= dt;
      if (
        this.dirtEmitTimer <= 0 &&
        status.wheelsOnGround > 0 &&
        (status.gasActive || status.nitroActive) &&
        Math.abs(carVel.x) > 2.2
      ) {
        this.dirtEmitTimer = 0.045;
        const rearWheelPos = this.car.wheelMeshes[0].position;
        this.particles.emitTireDirt(rearWheelPos.x, rearWheelPos.y - 0.58, carVel.x);
      }

      // Continuous engine audio synthesis
      this.sound.updateEngine(
        Math.abs(carVel.x) / 22,
        status.gasActive,
        status.nitroActive,
        true
      );

      // Check Game-Over conditions:
      // 1. Flipped upside down on roof
      if (this.car.isFlippedOver) {
        this.triggerGameOver('🙃 BUGGY FLIPPED OVER!');
      }

      // 2. Out of fuel and coasted to a halt
      if (this.car.fuel <= 0.01) {
        if (Math.abs(carVel.x) < 1.1 && Math.abs(carVel.y) < 1.1) {
          this.outOfFuelStallTimer += dt;
          if (this.outOfFuelStallTimer > 1.15) {
            this.triggerGameOver('⛽ OUT OF FUEL!');
          }
        } else {
          this.outOfFuelStallTimer = 0;
        }
      }

      // 3. Fell deep into a Medium/Hard canyon chasm
      const refTerrainY = this.terrain.getContinuousHeight(carPos.x);
      if (carPos.y < refTerrainY - 13.5) {
        this.triggerGameOver('🏞️ FELL INTO CANYON!');
      }

      this._updateHudDom();
    } else {
      // Idle showcase physics while on Start Menu or Game Over
      this.car.updateControlsAndPhysics(
        dt,
        { gas: false, brake: false, nitro: false },
        null
      );
      this.physics.step(dt);
      this.car.syncVisuals(dt, false, false);
      this.collectibles.update(dt, this.car.chassisBody.position);
    }

    const carPos = this.car.chassisBody.position;
    const carVel = this.car.chassisBody.velocity;

    this.particles.update(dt);
    this.sky.update(dt, carPos.x, carPos.y);
    this._updateCamera(dt, carPos, carVel);

    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera(dt, carPos, carVel) {
    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    // Pull back slightly on narrow portrait mobile screens so plenty of forward hills stay visible
    const portraitZoom = aspect < 1 ? (1 - aspect) * 9.5 : 0;

    if (this.state === 'menu') {
      // Cheerful 3/4 showcase angle showing expressive headlight eyes, blue Beetle shell & white roof
      const gentleSway = Math.sin(performance.now() * 0.0012) * 0.65;
      const desiredPos = this.tempVec.set(
        carPos.x + 5.4 + gentleSway,
        carPos.y + 2.5,
        10.2 + portraitZoom * 0.6
      );
      this.camPos.lerp(desiredPos, 1 - Math.exp(-4 * dt));
      this.camTarget.lerp(
        new THREE.Vector3(carPos.x + 0.4, carPos.y + 0.85, 0),
        1 - Math.exp(-5 * dt)
      );
    } else {
      // 2.5D side-scrolling camera with speed look-ahead & dynamic zoom-out on big jumps
      const speedX = THREE.MathUtils.clamp(carVel.x, -4, 30);
      const lookAheadX = 3.8 + speedX * 0.22;
      const speedZoom = Math.max(0, speedX) * 0.26 + Math.min(this.car.airTime * 2.2, 5.5);

      const desiredX = carPos.x + lookAheadX * 0.72;
      const desiredY = carPos.y + 3.1 + speedZoom * 0.18;
      const desiredZ = 16.5 + speedZoom + portraitZoom;

      const smooth = 1 - Math.exp(-5.5 * dt);
      this.camPos.x = THREE.MathUtils.lerp(this.camPos.x, desiredX, smooth);
      this.camPos.y = THREE.MathUtils.lerp(this.camPos.y, desiredY, smooth);
      this.camPos.z = THREE.MathUtils.lerp(this.camPos.z, desiredZ, smooth * 0.75);

      this.camTarget.x = THREE.MathUtils.lerp(this.camTarget.x, carPos.x + lookAheadX, smooth * 1.2);
      this.camTarget.y = THREE.MathUtils.lerp(this.camTarget.y, carPos.y + 0.9, smooth);
      this.camTarget.z = 0;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new BumperBuggyGame();
});
