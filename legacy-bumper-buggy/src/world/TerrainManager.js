import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Procedural 2.5D Stylized Hill Terrain & Prop Generator.
 *
 * Difficulty tiers:
 *  - EASY: Smooth rolling green hills & gentle valleys
 *  - MEDIUM: Punchy camelback jumps, wooden launch ramps & canyon gaps
 *  - HARD: Steep alpine cliffs, big chasm jumps & rollercoaster whalebacks
 *  - PROGRESSIVE: Seamlessly evolves Easy (0-220m) -> Medium (220-560m) -> Hard (560m+)
 */
export class TerrainManager {
  constructor(scene, physicsWorld, collectiblesManager) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.collectibles = collectiblesManager;

    this.mode = 'progressive'; // 'progressive' | 'easy' | 'medium' | 'hard'
    this.seed = 1337;

    this.chunkLength = 36; // meters per chunk
    this.stepSize = 1.2;   // meters per sample vertex (30 segments per chunk)
    this.chunks = new Map();

    // Gap intervals [{ startX, endX, launchY }] for chasm jumps
    this.gaps = [];
    this.nextGapAllowedX = 165;
    this.nextFuelX = 88;
    this.nextMilestoneX = 100;

    this._initSharedAssets();
  }

  _initSharedAssets() {
    this.matGrassTop = new THREE.MeshStandardMaterial({
      color: 0x4cd137,
      roughness: 0.76,
      metalness: 0.0,
    });
    this.matRoadStrip = new THREE.MeshStandardMaterial({
      color: 0xe6c27a,
      roughness: 0.88,
      metalness: 0.0,
    });
    this.matGrassLip = new THREE.MeshStandardMaterial({
      color: 0x3bb528,
      roughness: 0.78,
      metalness: 0.0,
    });
    this.matSoilWall = new THREE.MeshStandardMaterial({
      color: 0xb56738,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.matSoilDark = new THREE.MeshStandardMaterial({
      color: 0x8c4a23,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.matBackHill = new THREE.MeshStandardMaterial({
      color: 0x3fc347,
      roughness: 0.85,
      metalness: 0.0,
    });
    this.matWood = new THREE.MeshStandardMaterial({
      color: 0xc27d38,
      roughness: 0.8,
      metalness: 0.05,
    });
    this.matWoodDark = new THREE.MeshStandardMaterial({
      color: 0x87511e,
      roughness: 0.86,
      metalness: 0.05,
    });
    this.matBoosterStripe = new THREE.MeshStandardMaterial({
      color: 0xffd32a,
      emissive: 0xd99b00,
      emissiveIntensity: 0.28,
      roughness: 0.4,
    });
    this.matTrunk = new THREE.MeshStandardMaterial({
      color: 0x8a542e,
      roughness: 0.88,
    });
    this.matLeafBright = new THREE.MeshStandardMaterial({
      color: 0x44bd32,
      roughness: 0.72,
    });
    this.matLeafLush = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      roughness: 0.74,
    });
    this.matPine = new THREE.MeshStandardMaterial({
      color: 0x218c53,
      roughness: 0.78,
    });
    this.matRock = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.85,
    });
    this.matFlowerPink = new THREE.MeshStandardMaterial({
      color: 0xff6b9d,
      roughness: 0.5,
    });
    this.matFlowerYellow = new THREE.MeshStandardMaterial({
      color: 0xffeaa7,
      roughness: 0.5,
    });

    // Shared low-poly prop geometries for optimal mobile draw performance
    this.geoTrunk = new THREE.CylinderGeometry(0.18, 0.3, 1.8, 7);
    this.geoOakFoliage = new THREE.DodecahedronGeometry(1.15, 1);
    this.geoPineCone = new THREE.ConeGeometry(1.25, 2.2, 7);
    this.geoRock = new THREE.DodecahedronGeometry(0.45, 0);
    this.geoFlower = new THREE.SphereGeometry(0.16, 6, 6);
    this.geoPost = new THREE.CylinderGeometry(0.08, 0.09, 0.85, 6);
  }

  _hash(n) {
    const s = Math.sin(n * 127.1 + this.seed * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  _valueNoise1D(x, scale) {
    const p = x * scale;
    const i = Math.floor(p);
    const f = p - i;
    const u = f * f * (3 - 2 * f);
    const a = this._hash(i) * 2 - 1;
    const b = this._hash(i + 1) * 2 - 1;
    return a + (b - a) * u;
  }

  /**
   * Returns numeric difficulty scalar in [0, 1] at world X:
   *  0.0 - 0.33 = Easy
   *  0.34 - 0.72 = Medium
   *  0.73 - 1.00 = Hard
   */
  getDifficultyAt(x) {
    if (x < 22) return 0; // Always flat/gentle launch runway around spawn!
    if (this.mode === 'easy') return 0.22;
    if (this.mode === 'medium') return 0.56;
    if (this.mode === 'hard') return 0.92;

    // Progressive curve across distance
    return THREE.MathUtils.clamp((x - 25) / 680, 0.08, 1.0);
  }

  getDifficultyLabel(x) {
    const d = this.getDifficultyAt(Math.max(x, 30));
    if (d < 0.36) return 'EASY · SUNNY MEADOWS';
    if (d < 0.74) return 'MEDIUM · CANYON JUMPS';
    return 'HARD · ALPINE CLIFFS';
  }

  /**
   * Continuous analytical height profile before chasm cutouts.
   */
  getContinuousHeight(x) {
    if (x <= 12) {
      // Smooth flat starter pad with gentle backstop slope behind x = -8
      if (x < -8) {
        const back = -8 - x;
        return Math.min(14, back * back * 0.14);
      }
      return 0;
    }

    const blendIn = THREE.MathUtils.smoothstep(x, 10, 52);
    const diff = this.getDifficultyAt(x);

    // Layer 1: Broad rolling meadow swells (Easy signature — smooth & flowing)
    const easyHills =
      Math.sin(x * 0.036) * 2.2 +
      Math.sin(x * 0.018 + 1.1) * 2.8 +
      this._valueNoise1D(x, 0.024) * 1.9;

    // Layer 2: Rhythmic camelback rollers & punchy kickers (Medium signature)
    const medHills =
      Math.sin(x * 0.068) * 3.2 +
      Math.cos(x * 0.033 - 0.6) * 4.6 +
      this._valueNoise1D(x + 400, 0.045) * 3.6;

    // Layer 3: Dramatic steep cliffs, deep valleys & tall whaleback launches (Hard signature)
    const ridgeWave = Math.sin(x * 0.055);
    const sharpened = Math.sign(ridgeWave) * Math.pow(Math.abs(ridgeWave), 0.78);
    const hardCliffs =
      sharpened * 6.8 +
      Math.sin(x * 0.105 + 0.4) * 3.1 +
      this._valueNoise1D(x + 950, 0.058) * 5.2 +
      x * 0.01; // Subtle overall alpine ascent!

    let h = 0;
    if (diff < 0.5) {
      const t = diff / 0.5;
      h = THREE.MathUtils.lerp(easyHills, medHills, t);
    } else {
      const t = (diff - 0.5) / 0.5;
      h = THREE.MathUtils.lerp(medHills, hardCliffs, t);
    }

    return h * blendIn;
  }

  isInsideGap(x) {
    for (let i = 0; i < this.gaps.length; i++) {
      const g = this.gaps[i];
      if (x > g.startX && x < g.endX) {
        return g;
      }
    }
    return null;
  }

  /**
   * Returns surface height at x, or null if over a chasm gap.
   */
  getSurfaceHeightAt(x) {
    const gap = this.isInsideGap(x);
    if (gap) return null;

    // Check if on wooden launch ramp just before a gap
    for (let i = 0; i < this.gaps.length; i++) {
      const g = this.gaps[i];
      if (x >= g.rampStartX && x <= g.startX) {
        const t = (x - g.rampStartX) / (g.startX - g.rampStartX);
        const baseH = this.getContinuousHeight(x);
        return baseH + t * t * g.rampLift;
      }
      // Forgiving landing slope just after gap
      if (x >= g.endX && x <= g.endX + 4.8) {
        const t = (x - g.endX) / 4.8;
        const baseH = this.getContinuousHeight(x);
        return THREE.MathUtils.lerp(g.landingY, baseH, t * t * (3 - 2 * t));
      }
    }

    return this.getContinuousHeight(x);
  }

  reset(mode = 'progressive') {
    this.mode = mode;
    this.seed = Math.floor(1000 + Math.random() * 8999);

    // Clear all active chunks
    for (const key of this.chunks.keys()) {
      this._disposeChunk(key);
    }
    this.chunks.clear();
    this.gaps = [];

    this.nextGapAllowedX = mode === 'medium' || mode === 'hard' ? 78 : 240;
    this.nextFuelX = 82;
    this.nextMilestoneX = 100;
    this.collectibles.reset();

    // Pre-build initial chunks around start
    this.update(0);
  }

  _planChunkFeatures(chunkIndex) {
    const startX = chunkIndex * this.chunkLength;
    const endX = startX + this.chunkLength;
    if (startX < 40) return;

    const midX = startX + this.chunkLength * 0.5;
    const diff = this.getDifficultyAt(midX);

    // Plan chasm jump + wooden booster ramp in Medium & Hard tiers!
    if (diff >= 0.38 && midX >= this.nextGapAllowedX) {
      const roll = this._hash(chunkIndex * 19.3 + 7);
      const chance = diff > 0.72 ? 0.62 : 0.44;
      if (roll < chance) {
        const gapWidth = diff > 0.72 ? 5.8 + this._hash(chunkIndex * 3.1) * 1.8 : 4.4 + this._hash(chunkIndex * 3.1) * 1.2;
        const gapStart = startX + 13.2;
        const gapEnd = gapStart + gapWidth;
        const rampStartX = gapStart - 8.4;
        const rampLift = diff > 0.72 ? 2.6 : 2.1;
        const launchTopY = this.getContinuousHeight(gapStart) + rampLift;
        const landingY = Math.min(this.getContinuousHeight(gapEnd) - 0.8, launchTopY - 2.8);

        this.gaps.push({
          rampStartX,
          startX: gapStart,
          endX: gapEnd,
          rampLift,
          launchTopY,
          landingY,
        });

        this.nextGapAllowedX = gapEnd + (diff > 0.72 ? 68 : 92);
      }
    }
  }

  update(carX) {
    const currentChunk = Math.floor(carX / this.chunkLength);
    const minChunk = currentChunk - 2;
    const maxChunk = currentChunk + 4;

    // First plan features ahead so height queries across chunk seams stay consistent
    for (let c = minChunk; c <= maxChunk + 1; c++) {
      if (!this.chunks.has(c)) {
        this._planChunkFeatures(c);
      }
    }

    for (let c = minChunk; c <= maxChunk; c++) {
      if (!this.chunks.has(c)) {
        this._createChunk(c);
      }
    }

    // Recycle chunks far behind the player
    for (const [cIndex] of this.chunks) {
      if (cIndex < minChunk - 1) {
        this._disposeChunk(cIndex);
      }
    }

    // Prune very old gap metadata
    this.gaps = this.gaps.filter((g) => g.endX > carX - 120);
  }

  _createChunk(chunkIndex) {
    const startX = chunkIndex * this.chunkLength;
    const steps = Math.round(this.chunkLength / this.stepSize);
    const group = new THREE.Group();
    const bodies = [];
    const geometriesToDispose = [];

    // Collect contiguous solid spans (splitting if there is a chasm gap!)
    const spans = [];
    let currentSpan = [];

    for (let i = 0; i <= steps; i++) {
      const x = startX + i * this.stepSize;
      const y = this.getSurfaceHeightAt(x);

      if (y === null) {
        if (currentSpan.length >= 2) {
          spans.push(currentSpan);
        }
        currentSpan = [];
      } else {
        currentSpan.push({ x, y });
      }
    }
    if (currentSpan.length >= 2) {
      spans.push(currentSpan);
    }

    // Build 3D visual ribbon + soil cross-section + Cannon-es physics slabs for each solid span
    for (const pts of spans) {
      this._buildSpanMeshesAndPhysics(pts, group, bodies, geometriesToDispose);
    }

    // Build wooden launch ramps & canyon bridge posts around any gap inside this chunk
    for (const g of this.gaps) {
      if (g.startX >= startX && g.startX < startX + this.chunkLength) {
        this._buildJumpRampDecor(g, group, geometriesToDispose);
      }
    }

    // Add background rolling hill strip & stylized trees/flowers/rocks
    this._buildBackgroundAndProps(chunkIndex, startX, group, geometriesToDispose);

    // Spawn coins & fuel canisters on forward chunks
    if (startX >= 14) {
      this._spawnChunkCollectibles(chunkIndex, startX);
    }

    // Add an invisible safety backstop wall behind spawn at chunk -1
    if (chunkIndex === -1) {
      const wallBody = new CANNON.Body({
        mass: 0,
        material: this.physicsWorld.groundMaterial,
      });
      wallBody.addShape(new CANNON.Box(new CANNON.Vec3(1, 20, 5)));
      wallBody.position.set(-16, 8, 0);
      this.physicsWorld.world.addBody(wallBody);
      bodies.push(wallBody);
    }

    this.scene.add(group);
    this.chunks.set(chunkIndex, { group, bodies, geometriesToDispose });
  }

  _buildSpanMeshesAndPhysics(pts, group, bodies, geometriesToDispose) {
    const halfWidthZ = 3.2;
    const roadHalfZ = 1.3;
    const bottomDepth = 26;

    // 1. Top grass ribbon + sandy road strip + front grass overhang lip + front soil cliff wall
    const topPositions = [];
    const topNormals = [];
    const topIndices = [];

    const roadPositions = [];
    const roadIndices = [];

    const lipPositions = [];
    const lipIndices = [];

    const wallPositions = [];
    const wallIndices = [];

    for (let i = 0; i < pts.length; i++) {
      const { x, y } = pts[i];

      // Top grass vertices: back (-Z) and front (+Z)
      topPositions.push(x, y, -halfWidthZ);
      topPositions.push(x, y, halfWidthZ);
      topNormals.push(0, 1, 0, 0, 1, 0);

      // Center sandy track slightly raised (+0.025m) to avoid Z-fighting
      roadPositions.push(x, y + 0.028, -roadHalfZ);
      roadPositions.push(x, y + 0.028, roadHalfZ);

      // Lush rounded front turf lip at +Z facing the camera
      lipPositions.push(x, y + 0.02, halfWidthZ + 0.08);
      lipPositions.push(x, y - 0.48, halfWidthZ + 0.08);

      // Rich terracotta dirt cross-section wall extending deep below screen bottom
      wallPositions.push(x, y - 0.42, halfWidthZ - 0.05);
      wallPositions.push(x, y - bottomDepth, halfWidthZ - 0.05);

      if (i < pts.length - 1) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;

        topIndices.push(a, b, c, b, d, c);
        roadIndices.push(a, b, c, b, d, c);
        lipIndices.push(a, b, c, b, d, c);
        wallIndices.push(a, b, c, b, d, c);
      }
    }

    const makeRibbon = (positions, indices, material, receiveShadow = false) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geometriesToDispose.push(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
      return mesh;
    };

    makeRibbon(topPositions, topIndices, this.matGrassTop, true);
    makeRibbon(roadPositions, roadIndices, this.matRoadStrip, true);
    makeRibbon(lipPositions, lipIndices, this.matGrassLip, false);
    makeRibbon(wallPositions, wallIndices, this.matSoilWall, false);

    // Side end-caps ONLY when a span starts or ends adjacent to an actual chasm gap!
    [pts[0], pts[pts.length - 1]].forEach((endPt, idx) => {
      const isLeftFace = idx === 0;
      const probeX = isLeftFace ? endPt.x - this.stepSize * 0.6 : endPt.x + this.stepSize * 0.6;
      if (!this.isInsideGap(probeX)) return;

      const cliffBoxGeo = new THREE.BoxGeometry(0.45, bottomDepth, halfWidthZ * 1.96);
      geometriesToDispose.push(cliffBoxGeo);
      const cliffCap = new THREE.Mesh(cliffBoxGeo, this.matSoilDark);
      cliffCap.position.set(endPt.x + (isLeftFace ? 0.2 : -0.2), endPt.y - bottomDepth * 0.5 - 0.1, 0);
      group.add(cliffCap);
    });

    // 2. Compound Cannon-es static body with thick angled box slabs per segment (zero edge-snagging!)
    const chunkBody = new CANNON.Body({
      mass: 0,
      material: this.physicsWorld.groundMaterial,
    });

    const slabThickness = 1.4;
    const addSegmentSlab = (p0, p1) => {
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const segLen = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;

      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);

      const shape = new CANNON.Box(
        new CANNON.Vec3(segLen * 0.5 + 0.03, slabThickness * 0.5, halfWidthZ)
      );
      const offset = new CANNON.Vec3(
        midX - normalX * (slabThickness * 0.5),
        midY - normalY * (slabThickness * 0.5),
        0
      );
      const quat = new CANNON.Quaternion();
      quat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);

      chunkBody.addShape(shape, offset, quat);
    };

    // Forgiving 45-deg catch-lip when landing from a chasm jump so grazing tires roll cleanly up!
    if (this.isInsideGap(pts[0].x - this.stepSize * 0.6)) {
      addSegmentSlab({ x: pts[0].x - 0.9, y: pts[0].y - 1.0 }, pts[0]);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      addSegmentSlab(pts[i], pts[i + 1]);
    }

    this.physicsWorld.world.addBody(chunkBody);
    bodies.push(chunkBody);
  }

  _buildJumpRampDecor(gap, group, geometriesToDispose) {
    // Wooden trestle struts & yellow chevron launch deck on jump ramps!
    const rampLen = gap.startX - gap.rampStartX;
    const y0 = this.getSurfaceHeightAt(gap.rampStartX) ?? this.getContinuousHeight(gap.rampStartX);
    const y1 = gap.launchTopY;
    const angle = Math.atan2(y1 - y0, rampLen);
    const deckLen = Math.hypot(rampLen, y1 - y0);

    const deckGeo = new THREE.BoxGeometry(deckLen, 0.24, 3.1);
    geometriesToDispose.push(deckGeo);
    const deck = new THREE.Mesh(deckGeo, this.matWood);
    deck.position.set((gap.rampStartX + gap.startX) * 0.5, (y0 + y1) * 0.5 - 0.02, 0);
    deck.rotation.z = angle;
    deck.receiveShadow = true;
    group.add(deck);

    // Bright yellow booster stripe on ramp top
    const stripeGeo = new THREE.BoxGeometry(deckLen * 0.85, 0.06, 0.9);
    geometriesToDispose.push(stripeGeo);
    const stripe = new THREE.Mesh(stripeGeo, this.matBoosterStripe);
    stripe.position.set((gap.rampStartX + gap.startX) * 0.5, (y0 + y1) * 0.5 + 0.11, 0);
    stripe.rotation.z = angle;
    group.add(stripe);

    // Support wooden pillars under lip
    [-1.2, 1.2].forEach((pz) => {
      const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 4.5, 7);
      geometriesToDispose.push(postGeo);
      const post = new THREE.Mesh(postGeo, this.matWoodDark);
      post.position.set(gap.startX - 0.45, y1 - 2.3, pz);
      group.add(post);
    });
  }

  _buildBackgroundAndProps(chunkIndex, startX, group, geometriesToDispose) {
    // Secondary rolling lush green hill behind the road (z = -7.5)
    const steps = 12;
    const stepW = this.chunkLength / steps;
    const bgPos = [];
    const bgIdx = [];

    for (let i = 0; i <= steps; i++) {
      const x = startX + i * stepW;
      const baseH = this.getContinuousHeight(x);
      const bgH = baseH + 2.4 + Math.sin(x * 0.075 + 1.9) * 2.2 + Math.cos(x * 0.032) * 1.8;
      bgPos.push(x, bgH, -8.5);
      bgPos.push(x, bgH - 28, -5.2);
      if (i < steps) {
        const a = i * 2;
        bgIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgPos, 3));
    bgGeo.setIndex(bgIdx);
    bgGeo.computeVertexNormals();
    geometriesToDispose.push(bgGeo);
    const bgMesh = new THREE.Mesh(bgGeo, this.matBackHill);
    group.add(bgMesh);

    // Scatter stylized 3D trees along the rear edge of the track & background ridge
    const treeSlots = 6;
    for (let t = 0; t < treeSlots; t++) {
      const r = this._hash(chunkIndex * 37 + t * 13);
      if (r < 0.25) continue;

      const tx = startX + (t + 0.25 + r * 0.5) * (this.chunkLength / treeSlots);
      const onRoadBg = t % 2 === 0;
      const surfY = this.getSurfaceHeightAt(tx);
      if (onRoadBg && surfY === null) continue;

      const tz = onRoadBg ? -2.45 - (r * 0.9) : -7.6 - (r * 1.6);
      const ty = onRoadBg
        ? surfY
        : this.getContinuousHeight(tx) + 1.9 + Math.sin(tx * 0.075 + 1.9) * 2.2 + Math.cos(tx * 0.032) * 1.8;

      const scale = (onRoadBg ? 0.85 : 1.15) * (0.8 + this._hash(tx) * 0.55);
      const isPine = this._hash(tx * 2.3) > 0.52;

      const tree = isPine ? this._createPineTree(scale) : this._createOakTree(scale);
      tree.position.set(tx, ty - 0.15, tz);
      tree.rotation.y = r * Math.PI * 2;
      group.add(tree);
    }

    // Cute wildflowers, roadside fence posts & soil pebbles
    for (let f = 0; f < 8; f++) {
      const fx = startX + (f + 0.4) * (this.chunkLength / 8);
      const fy = this.getSurfaceHeightAt(fx);
      if (fy === null) continue;

      const seedVal = this._hash(fx * 5.7);
      if (seedVal > 0.45) {
        const flower = new THREE.Mesh(
          this.geoFlower,
          seedVal > 0.72 ? this.matFlowerPink : this.matFlowerYellow
        );
        flower.position.set(fx, fy + 0.12, seedVal > 0.6 ? 2.45 : -2.1);
        group.add(flower);
      }

      // Embedded pebble in the front dirt cross-section wall
      if (seedVal < 0.55) {
        const rock = new THREE.Mesh(this.geoRock, this.matRock);
        rock.scale.set(0.9, 0.65, 0.45);
        rock.position.set(fx, fy - 1.6 - seedVal * 5.5, 3.16);
        rock.rotation.z = seedVal * 3;
        group.add(rock);
      }
    }

    // Distance Milestone Signposts every 100m!
    while (this.nextMilestoneX >= startX && this.nextMilestoneX < startX + this.chunkLength) {
      const mx = this.nextMilestoneX;
      const my = this.getSurfaceHeightAt(mx);
      if (my !== null) {
        const sign = this._createMilestoneSign(mx);
        sign.position.set(mx, my, -2.15);
        group.add(sign);
      }
      this.nextMilestoneX += 100;
    }
  }

  _createOakTree(scale) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(this.geoTrunk, this.matTrunk);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    g.add(trunk);

    const crownMain = new THREE.Mesh(this.geoOakFoliage, this.matLeafBright);
    crownMain.position.set(0, 2.25, 0);
    crownMain.castShadow = true;
    g.add(crownMain);

    const crownLeft = new THREE.Mesh(this.geoOakFoliage, this.matLeafLush);
    crownLeft.scale.setScalar(0.72);
    crownLeft.position.set(-0.65, 1.9, 0.2);
    g.add(crownLeft);

    const crownRight = new THREE.Mesh(this.geoOakFoliage, this.matLeafLush);
    crownRight.scale.setScalar(0.68);
    crownRight.position.set(0.68, 1.95, -0.15);
    g.add(crownRight);

    g.scale.setScalar(scale);
    return g;
  }

  _createPineTree(scale) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(this.geoTrunk, this.matTrunk);
    trunk.position.y = 0.8;
    g.add(trunk);

    for (let tier = 0; tier < 3; tier++) {
      const cone = new THREE.Mesh(this.geoPineCone, tier % 2 === 0 ? this.matPine : this.matLeafBright);
      const s = 1 - tier * 0.22;
      cone.scale.set(s, s, s);
      cone.position.y = 1.75 + tier * 0.95;
      cone.castShadow = true;
      g.add(cone);
    }

    g.scale.setScalar(scale);
    return g;
  }

  _createMilestoneSign(meters) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(this.geoPost, this.matWoodDark);
    post.position.y = 0.42;
    g.add(post);

    // Canvas texture for crisp milestone distance number (e.g. "100m")
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 56, 12);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#c27d38';
    ctx.stroke();
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${meters}m`, 64, 34);

    const tex = new THREE.CanvasTexture(canvas);
    const boardMat = new THREE.MeshBasicMaterial({ map: tex });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.58, 0.1), [
      this.matWood,
      this.matWood,
      this.matWood,
      this.matWood,
      boardMat,
      this.matWood,
    ]);
    board.position.y = 0.98;
    g.add(board);
    return g;
  }

  _spawnChunkCollectibles(chunkIndex, startX) {
    // 1. Spawn a curving arc of 5 gold coins per chunk!
    const arcStart = startX + 7 + this._hash(chunkIndex * 11) * 10;
    for (let c = 0; c < 5; c++) {
      const cx = arcStart + c * 2.35;
      const gap = this.isInsideGap(cx);
      let cy;
      if (gap) {
        // High trajectory arc guiding player across chasm jump!
        const t = (cx - gap.startX) / (gap.endX - gap.startX);
        cy = gap.launchTopY + Math.sin(t * Math.PI) * 2.8 + 1.2;
      } else {
        const surf = this.getSurfaceHeightAt(cx) ?? this.getContinuousHeight(cx);
        cy = surf + 1.35 + Math.sin((c / 4) * Math.PI) * 0.75;
      }
      this.collectibles.spawnCoin(cx, cy);
    }

    // 2. Spawn reliable Fuel Canister every ~88-105m on solid ground!
    if (startX + this.chunkLength >= this.nextFuelX) {
      let fx = Math.max(startX + 4, this.nextFuelX);
      // Shift slightly if fx happened to fall inside a chasm gap
      let fy = this.getSurfaceHeightAt(fx);
      let tries = 0;
      while (fy === null && tries < 10) {
        fx += 3.0;
        fy = this.getSurfaceHeightAt(fx);
        tries++;
      }
      if (fy !== null) {
        this.collectibles.spawnFuel(fx, fy + 1.25);
        this.nextFuelX = fx + 92 + this._hash(chunkIndex * 7.7) * 18;
      }
    }
  }

  _disposeChunk(chunkIndex) {
    const chunk = this.chunks.get(chunkIndex);
    if (!chunk) return;

    this.scene.remove(chunk.group);
    for (const geo of chunk.geometriesToDispose) {
      geo.dispose();
    }
    for (const body of chunk.bodies) {
      this.physicsWorld.world.removeBody(body);
    }
    this.chunks.delete(chunkIndex);
  }
}
