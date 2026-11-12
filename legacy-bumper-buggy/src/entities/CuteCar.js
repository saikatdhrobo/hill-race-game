import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Procedural "Cute Toy Beetle Monster Truck" (3D visual mesh + Cannon-es RaycastVehicle).
 * Features:
 *  - Glossy sky-blue Beetle shell, flared fenders, chrome bumpers, twin exhausts
 *  - Glossy cream-white cabin dome with tinted windows & springy roof antenna
 *  - Expressive headlight eyes with blinking, pupils, catchlights & emotive eyebrows
 *  - Oversized monster-truck tires with 3D tread blocks & live compressing coil springs
 */
export class CuteCar {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    // Gameplay state
    this.maxFuel = 100;
    this.fuel = 100;
    this.maxNitro = 100;
    this.nitro = 100;
    this.isFlippedOver = false;
    this.upsideDownTimer = 0;

    // Air & stunt tracking
    this.airTime = 0;
    this.airRotationAccum = 0;
    this.lastPitch = 0;
    this.wasAirborne = false;

    // Eye animation state
    this.blinkTimer = 2.4;
    this.blinkDuration = 0;
    this.antennaSwing = 0;
    this.antennaVel = 0;
    this.prevVelX = 0;

    this._buildMaterials();
    this._buildVisualCar();
    this._buildPhysicsVehicle();
  }

  _buildMaterials() {
    this.matBlueBody = new THREE.MeshStandardMaterial({
      color: 0x1e82ff,
      roughness: 0.24,
      metalness: 0.08,
    });
    this.matBlueAccent = new THREE.MeshStandardMaterial({
      color: 0x0f5fd6,
      roughness: 0.32,
      metalness: 0.1,
    });
    this.matWhiteRoof = new THREE.MeshStandardMaterial({
      color: 0xfffdf7,
      roughness: 0.22,
      metalness: 0.04,
    });
    this.matWindow = new THREE.MeshStandardMaterial({
      color: 0x1e3554,
      roughness: 0.12,
      metalness: 0.35,
    });
    this.matChrome = new THREE.MeshStandardMaterial({
      color: 0xe8eef5,
      roughness: 0.18,
      metalness: 0.78,
    });
    this.matTire = new THREE.MeshStandardMaterial({
      color: 0x23272e,
      roughness: 0.82,
      metalness: 0.05,
    });
    this.matTireTread = new THREE.MeshStandardMaterial({
      color: 0x181b20,
      roughness: 0.9,
      metalness: 0.02,
    });
    this.matRimWhite = new THREE.MeshStandardMaterial({
      color: 0xfafcff,
      roughness: 0.28,
      metalness: 0.1,
    });
    this.matRimYellow = new THREE.MeshStandardMaterial({
      color: 0xffcf33,
      roughness: 0.3,
      metalness: 0.12,
    });
    this.matSpring = new THREE.MeshStandardMaterial({
      color: 0xff5252,
      roughness: 0.35,
      metalness: 0.3,
    });
    this.matEyeWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.0,
    });
    this.matPupil = new THREE.MeshStandardMaterial({
      color: 0x101828,
      roughness: 0.08,
      metalness: 0.1,
    });
    this.matTailLight = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      emissive: 0xaa1111,
      emissiveIntensity: 0.5,
      roughness: 0.25,
    });
  }

  _buildVisualCar() {
    this.rootGroup = new THREE.Group();
    this.chassisVisual = new THREE.Group();
    this.rootGroup.add(this.chassisVisual);

    // Offset visual body slightly upward relative to low physics COM so suspension stance looks chunky & balanced
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 0.22;
    this.chassisVisual.add(bodyGroup);

    // 1. Lower sculpted Beetle chassis tub
    const lowerTubGeo = new THREE.BoxGeometry(2.65, 0.52, 1.54);
    const lowerTub = new THREE.Mesh(lowerTubGeo, this.matBlueBody);
    lowerTub.position.set(0, 0.14, 0);
    lowerTub.castShadow = true;
    lowerTub.receiveShadow = true;
    bodyGroup.add(lowerTub);

    // Rounded front Beetle hood (+X)
    const hoodGeo = new THREE.SphereGeometry(0.82, 20, 16);
    hoodGeo.scale(1.28, 0.62, 0.94);
    const hood = new THREE.Mesh(hoodGeo, this.matBlueBody);
    hood.position.set(0.76, 0.26, 0);
    hood.castShadow = true;
    bodyGroup.add(hood);

    // Rounded rear Beetle engine deck (-X)
    const rearDeckGeo = new THREE.SphereGeometry(0.78, 20, 16);
    rearDeckGeo.scale(1.18, 0.66, 0.94);
    const rearDeck = new THREE.Mesh(rearDeckGeo, this.matBlueBody);
    rearDeck.position.set(-0.78, 0.28, 0);
    rearDeck.castShadow = true;
    bodyGroup.add(rearDeck);

    // White side running trim strips
    [-0.8, 0.8].forEach((zSide) => {
      const stripGeo = new THREE.BoxGeometry(1.4, 0.1, 0.08);
      const strip = new THREE.Mesh(stripGeo, this.matWhiteRoof);
      strip.position.set(0, 0.02, zSide);
      bodyGroup.add(strip);
    });

    // 2. White Beetle Cabin Dome (signature white roof!)
    const cabinGroup = new THREE.Group();
    cabinGroup.position.set(-0.1, 0.56, 0);
    bodyGroup.add(cabinGroup);

    // Outer white roof shell
    const roofShellGeo = new THREE.SphereGeometry(0.86, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58);
    roofShellGeo.scale(1.22, 0.94, 0.88);
    const roofShell = new THREE.Mesh(roofShellGeo, this.matWhiteRoof);
    roofShell.position.y = -0.04;
    roofShell.castShadow = true;
    cabinGroup.add(roofShell);

    // White roof rim band
    const roofRimGeo = new THREE.CylinderGeometry(0.84, 0.9, 0.14, 22);
    roofRimGeo.scale(1.2, 1, 0.86);
    const roofRim = new THREE.Mesh(roofRimGeo, this.matWhiteRoof);
    roofRim.position.y = 0.02;
    cabinGroup.add(roofRim);

    // Glossy dark wrap-around toy windows inset slightly under white roof cap
    const glassGeo = new THREE.SphereGeometry(0.82, 22, 16, 0, Math.PI * 2, 0.12, Math.PI * 0.44);
    glassGeo.scale(1.19, 0.88, 0.86);
    const glass = new THREE.Mesh(glassGeo, this.matWindow);
    glass.position.y = -0.05;
    cabinGroup.add(glass);

    // White roof cap on top of glass so roof is unmistakably crisp white!
    const topCapGeo = new THREE.SphereGeometry(0.76, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.33);
    topCapGeo.scale(1.16, 0.82, 0.84);
    const topCap = new THREE.Mesh(topCapGeo, this.matWhiteRoof);
    topCap.position.y = 0.11;
    topCap.castShadow = true;
    cabinGroup.add(topCap);

    // White A-pillars & B-pillars for classic Beetle window framing
    const bPillarGeo = new THREE.BoxGeometry(0.14, 0.48, 1.5);
    const bPillar = new THREE.Mesh(bPillarGeo, this.matWhiteRoof);
    bPillar.position.set(-0.18, 0.24, 0);
    cabinGroup.add(bPillar);

    // Cute roof rack bars
    [-0.25, 0.22].forEach((rx) => {
      const barGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 8);
      barGeo.rotateX(Math.PI / 2);
      const bar = new THREE.Mesh(barGeo, this.matChrome);
      bar.position.set(rx, 0.75, 0);
      cabinGroup.add(bar);
    });

    // Springy toy antenna on roof
    this.antennaPivot = new THREE.Group();
    this.antennaPivot.position.set(-0.35, 0.74, 0.15);
    const antStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.028, 0.42, 8),
      this.matChrome
    );
    antStem.position.y = 0.21;
    this.antennaPivot.add(antStem);
    const antBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 12),
      this.matSpring
    );
    antBall.position.y = 0.44;
    this.antennaPivot.add(antBall);
    cabinGroup.add(this.antennaPivot);

    // 3. Flared Beetle Wheel Arches (4 fenders)
    const archPositions = [
      [1.05, 0.12, 0.74],
      [1.05, 0.12, -0.74],
      [-1.05, 0.12, 0.74],
      [-1.05, 0.12, -0.74],
    ];
    archPositions.forEach(([ax, ay, az]) => {
      const archGeo = new THREE.TorusGeometry(0.62, 0.16, 10, 18, Math.PI);
      const arch = new THREE.Mesh(archGeo, this.matBlueAccent);
      arch.position.set(ax, ay, az);
      arch.scale.set(1.05, 0.95, 1.25);
      arch.castShadow = true;
      bodyGroup.add(arch);
    });

    // 4. Expressive Headlight Eyes!
    this.eyes = [];
    [0.52, -0.52].forEach((ez, idx) => {
      const eyePod = new THREE.Group();
      // Slightly angled outward toward camera on +Z side so side-scrolling camera always sees big expressive eyes clearly
      eyePod.position.set(1.48, 0.34, ez);
      eyePod.rotation.y = idx === 0 ? 0.22 : -0.14;

      // Blue headlight bucket
      const bucketGeo = new THREE.CylinderGeometry(0.28, 0.24, 0.24, 18);
      bucketGeo.rotateZ(Math.PI / 2);
      const bucket = new THREE.Mesh(bucketGeo, this.matBlueAccent);
      bucket.position.x = -0.06;
      eyePod.add(bucket);

      // Chrome headlight bezel
      const bezelGeo = new THREE.TorusGeometry(0.27, 0.042, 10, 20);
      bezelGeo.rotateY(Math.PI / 2);
      const bezel = new THREE.Mesh(bezelGeo, this.matChrome);
      bezel.position.x = 0.06;
      eyePod.add(bezel);

      // Glossy white eyeball
      const eyeballGeo = new THREE.SphereGeometry(0.255, 18, 16);
      eyeballGeo.scale(0.65, 1, 1);
      const eyeball = new THREE.Mesh(eyeballGeo, this.matEyeWhite);
      eyeball.position.x = 0.05;
      eyePod.add(eyeball);

      // Pupil group (moves slightly to look at terrain / up when jumping)
      const pupilGroup = new THREE.Group();
      pupilGroup.position.set(0.19, 0.0, idx === 0 ? 0.04 : 0);

      const pupilGeo = new THREE.SphereGeometry(0.135, 14, 14);
      pupilGeo.scale(0.38, 1, 1);
      const pupil = new THREE.Mesh(pupilGeo, this.matPupil);
      pupilGroup.add(pupil);

      // Crisp white toy catchlight dot
      const glintGeo = new THREE.SphereGeometry(0.048, 8, 8);
      const glint = new THREE.Mesh(glintGeo, this.matEyeWhite);
      glint.position.set(0.045, 0.065, 0.055);
      pupilGroup.add(glint);

      eyePod.add(pupilGroup);

      // Expressive movable upper eyelid / eyebrow
      const browPivot = new THREE.Group();
      browPivot.position.set(0.12, 0.22, 0);
      const browGeo = new THREE.BoxGeometry(0.14, 0.085, 0.54);
      const brow = new THREE.Mesh(browGeo, this.matBlueBody);
      browPivot.add(brow);
      eyePod.add(browPivot);

      // Blinking eyelid cap
      const lidGeo = new THREE.SphereGeometry(0.268, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
      lidGeo.scale(0.68, 1, 1);
      const lid = new THREE.Mesh(lidGeo, this.matBlueBody);
      lid.position.x = 0.05;
      lid.scale.y = 0.01;
      lid.visible = false;
      eyePod.add(lid);

      bodyGroup.add(eyePod);
      this.eyes.push({ eyePod, pupilGroup, browPivot, lid, sideSign: idx === 0 ? 1 : -1 });
    });

    // Cute front smile grille & chrome bumper
    const bumperFrontGeo = new THREE.CylinderGeometry(0.065, 0.065, 1.56, 12);
    bumperFrontGeo.rotateX(Math.PI / 2);
    const bumperFront = new THREE.Mesh(bumperFrontGeo, this.matChrome);
    bumperFront.position.set(1.68, 0.02, 0);
    bodyGroup.add(bumperFront);

    // Smile curve on front apron
    const smileGeo = new THREE.TorusGeometry(0.24, 0.035, 8, 16, Math.PI);
    smileGeo.rotateY(Math.PI / 2);
    smileGeo.rotateX(Math.PI);
    const smile = new THREE.Mesh(smileGeo, this.matPupil);
    smile.position.set(1.61, 0.19, 0);
    bodyGroup.add(smile);

    // Rear bumper, taillights & twin chrome exhaust pipes
    const bumperRear = new THREE.Mesh(bumperFrontGeo, this.matChrome);
    bumperRear.position.set(-1.66, 0.04, 0);
    bodyGroup.add(bumperRear);

    [0.52, -0.52].forEach((tz) => {
      const tailGeo = new THREE.SphereGeometry(0.13, 12, 12);
      const tail = new THREE.Mesh(tailGeo, this.matTailLight);
      tail.position.set(-1.54, 0.28, tz);
      bodyGroup.add(tail);
    });

    this.exhaustWorldAnchor = new THREE.Object3D();
    this.exhaustWorldAnchor.position.set(-1.72, 0.08, 0);
    bodyGroup.add(this.exhaustWorldAnchor);

    [0.26, -0.26].forEach((ez) => {
      const pipeGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.36, 10);
      pipeGeo.rotateZ(Math.PI / 2);
      const pipe = new THREE.Mesh(pipeGeo, this.matChrome);
      pipe.position.set(-1.62, 0.06, ez);
      bodyGroup.add(pipe);
    });

    // Belly skid-plate frame (dark mechanical undercarriage)
    const skidGeo = new THREE.BoxGeometry(2.1, 0.22, 1.15);
    const skid = new THREE.Mesh(skidGeo, this.matTire);
    skid.position.set(0, -0.14, 0);
    bodyGroup.add(skid);

    // 5. Build 4 Oversized Monster-Truck Wheels + Suspension Struts
    this.wheelRadius = 0.72;
    this.wheelWidth = 0.58;
    this.wheelMeshes = [];
    this.suspensionLinks = [];

    for (let i = 0; i < 4; i++) {
      const wheelRoot = new THREE.Group();

      // Main chunky rubber tire cylinder with rounded shoulders
      const tireCoreGeo = new THREE.CylinderGeometry(
        this.wheelRadius * 0.95,
        this.wheelRadius * 0.95,
        this.wheelWidth,
        24
      );
      tireCoreGeo.rotateX(Math.PI / 2);
      const tireCore = new THREE.Mesh(tireCoreGeo, this.matTire);
      tireCore.castShadow = true;
      tireCore.receiveShadow = true;
      wheelRoot.add(tireCore);

      // Rounded tire sidewalls (torus rings on both sides for plump toy tire look)
      [-this.wheelWidth * 0.34, this.wheelWidth * 0.34].forEach((sideZ) => {
        const wallGeo = new THREE.TorusGeometry(this.wheelRadius * 0.74, 0.21, 12, 22);
        const wall = new THREE.Mesh(wallGeo, this.matTire);
        wall.position.z = sideZ;
        wheelRoot.add(wall);
      });

      // 12 chunky monster-truck 3D tread lugs around circumference!
      const lugCount = 12;
      const lugGeo = new THREE.BoxGeometry(0.17, 0.11, this.wheelWidth * 0.94);
      for (let k = 0; k < lugCount; k++) {
        const angle = (k / lugCount) * Math.PI * 2;
        const lug = new THREE.Mesh(lugGeo, this.matTireTread);
        lug.position.set(
          Math.cos(angle) * (this.wheelRadius - 0.03),
          Math.sin(angle) * (this.wheelRadius - 0.03),
          0
        );
        lug.rotation.z = angle + Math.PI / 2;
        wheelRoot.add(lug);
      }

      // Deep-dish white toy wheel rim
      const rimGeo = new THREE.CylinderGeometry(0.41, 0.41, this.wheelWidth * 0.98, 18);
      rimGeo.rotateX(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, this.matRimWhite);
      wheelRoot.add(rim);

      // Sunny yellow beadlock ring on outer face
      const isRightSide = i % 2 === 0;
      const outerZ = isRightSide ? this.wheelWidth * 0.5 : -this.wheelWidth * 0.5;
      const beadGeo = new THREE.TorusGeometry(0.36, 0.055, 8, 18);
      const bead = new THREE.Mesh(beadGeo, this.matRimYellow);
      bead.position.z = outerZ;
      wheelRoot.add(bead);

      // Star spokes on outer rim so wheel spin is super readable!
      for (let s = 0; s < 5; s++) {
        const sAngle = (s / 5) * Math.PI * 2;
        const spokeGeo = new THREE.BoxGeometry(0.34, 0.09, 0.05);
        const spoke = new THREE.Mesh(spokeGeo, this.matBlueBody);
        spoke.position.set(
          Math.cos(sAngle) * 0.17,
          Math.sin(sAngle) * 0.17,
          outerZ * 1.01
        );
        spoke.rotation.z = sAngle;
        wheelRoot.add(spoke);
      }

      // Center hubcap dome
      const capGeo = new THREE.SphereGeometry(0.14, 12, 12);
      const cap = new THREE.Mesh(capGeo, this.matRimYellow);
      cap.position.z = outerZ * 1.03;
      wheelRoot.add(cap);

      this.scene.add(wheelRoot);
      this.wheelMeshes.push(wheelRoot);

      // Visible coil spring + shock strut attached to chassis
      const strutGroup = new THREE.Group();
      const shockRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8),
        this.matChrome
      );
      shockRod.position.y = -0.5;
      strutGroup.add(shockRod);

      const springCoil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10),
        this.matSpring
      );
      springCoil.position.y = -0.42;
      strutGroup.add(springCoil);

      this.chassisVisual.add(strutGroup);
      this.suspensionLinks.push({ strutGroup, shockRod, springCoil });
    }

    this.scene.add(this.rootGroup);
  }

  _buildPhysicsVehicle() {
    // Compound chassis body with low center of mass for fun, controllable hill-climbing
    this.chassisBody = new CANNON.Body({
      mass: 185,
      material: this.physicsWorld.chassisMaterial,
      linearDamping: 0.06,
      angularDamping: 0.32,
    });

    // Main lower chassis collider — generous monster-truck belly clearance
    const mainBox = new CANNON.Box(new CANNON.Vec3(1.02, 0.26, 0.76));
    this.chassisBody.addShape(mainBox, new CANNON.Vec3(0, 0.48, 0));

    // Upper white Beetle roof dome collider (also acts as flip/roof protection)
    this.roofShape = new CANNON.Sphere(0.6);
    this.chassisBody.addShape(this.roofShape, new CANNON.Vec3(-0.08, 0.92, 0));

    // Lock motion strictly to 2.5D X-Y plane (zero Z drift, pure Z-axis pitch)
    this.chassisBody.linearFactor.set(1, 1, 0);
    this.chassisBody.angularFactor.set(0, 0, 1);

    // RaycastVehicle setup
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexForwardAxis: 0,
      indexUpAxis: 1,
      indexRightAxis: 2,
    });

    const wheelOptions = {
      radius: this.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 68,
      suspensionRestLength: 0.58,
      maxSuspensionTravel: 0.46,
      dampingRelaxation: 4.8,
      dampingCompression: 5.4,
      frictionSlip: 4.5,
      rollInfluence: 0.02,
      maxSuspensionForce: 150000,
      customSlidingRotationalSpeed: -28,
      useCustomSlidingRotationalSpeed: true,
      axleLocal: new CANNON.Vec3(0, 0, 1),
      chassisConnectionPointLocal: new CANNON.Vec3(),
    };

    // Order: 0 = Rear Right (+Z), 1 = Rear Left (-Z), 2 = Front Right (+Z), 3 = Front Left (-Z)
    this.wheelAttachPoints = [
      new CANNON.Vec3(-1.12, 0.08, 0.92),
      new CANNON.Vec3(-1.12, 0.08, -0.92),
      new CANNON.Vec3(1.12, 0.08, 0.92),
      new CANNON.Vec3(1.12, 0.08, -0.92),
    ];

    this.wheelAttachPoints.forEach((pt) => {
      wheelOptions.chassisConnectionPointLocal.copy(pt);
      this.vehicle.addWheel(wheelOptions);
    });

    this.vehicle.addToWorld(this.physicsWorld.world);
  }

  reset(startX = 0, startY = 3.5) {
    this.chassisBody.position.set(startX, startY, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(0, i);
      this.vehicle.setBrake(0, i);
      this.vehicle.wheelInfos[i].rotation = 0;
    }

    this.fuel = this.maxFuel;
    this.nitro = this.maxNitro;
    this.isFlippedOver = false;
    this.upsideDownTimer = 0;
    this.airTime = 0;
    this.airRotationAccum = 0;
    this.lastPitch = 0;
    this.wasAirborne = false;
    this.prevVelX = 0;

    this.syncVisuals(0.016, false, false);
  }

  getPitchAngle() {
    // Extract signed Z-axis rotation from quaternion
    const q = this.chassisBody.quaternion;
    return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
  }

  /**
   * Applies gas, brake, nitro, mid-air stunt rotation, fuel consumption & flip checks.
   * Returns any stunt event triggered on this frame (e.g. { type: 'BACKFLIP', bonus: 50 }).
   */
  updateControlsAndPhysics(dt, controls, getTerrainHeightAt) {
    // Enforce crisp 2.5D plane alignment
    this.chassisBody.position.z = 0;
    this.chassisBody.velocity.z = 0;
    const pitch = this.getPitchAngle();
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), pitch);
    this.chassisBody.angularVelocity.x = 0;
    this.chassisBody.angularVelocity.y = 0;

    const hasFuel = this.fuel > 0.01;
    const gas = controls.gas && hasFuel && !this.isFlippedOver;
    const brake = controls.brake && !this.isFlippedOver;
    const nitroWanted = controls.nitro && hasFuel && this.nitro > 1 && !this.isFlippedOver;

    // Drain fuel gradually while playing
    if (hasFuel && !this.isFlippedOver) {
      const idleDrain = 1.45; // % per second
      const throttleDrain = gas ? 2.15 : brake ? 0.8 : 0;
      this.fuel = Math.max(0, this.fuel - (idleDrain + throttleDrain) * dt);
    }

    // Nitro consumption & passive trickle recharge
    let nitroActive = false;
    if (nitroWanted) {
      nitroActive = true;
      this.nitro = Math.max(0, this.nitro - 28 * dt);
    } else if (!this.isFlippedOver) {
      this.nitro = Math.min(this.maxNitro, this.nitro + 3.2 * dt);
    }

    const vx = this.chassisBody.velocity.x;
    const wheelsOnGround = this.vehicle.numWheelsOnGround;

    // Engine & Brake Forces (4WD Monster Truck)
    let engineForce = 0;
    let brakeForce = 0;

    const maxForwardSpeed = nitroActive ? 32 : 22;
    const maxReverseSpeed = -10;

    if (gas) {
      if (vx < maxForwardSpeed) {
        const speedFactor = Math.max(0.2, 1 - Math.max(0, vx) / maxForwardSpeed);
        // Gentle RaycastVehicle wheel torque + main traction applied just below COM for realistic squat without wild flat-ground wheelies
        engineForce = (nitroActive ? 240 : 180) * (0.4 + 0.6 * speedFactor);

        if (wheelsOnGround >= 1) {
          const drivePush = (nitroActive ? 3100 : 2150) * (0.35 + 0.65 * speedFactor);
          const worldPoint = new CANNON.Vec3(
            this.chassisBody.position.x + Math.sin(pitch) * 0.18,
            this.chassisBody.position.y - Math.cos(pitch) * 0.18,
            0
          );
          this.chassisBody.applyForce(
            new CANNON.Vec3(Math.cos(pitch) * drivePush, Math.sin(pitch) * drivePush, 0),
            worldPoint
          );
        }
      }
    } else if (brake) {
      if (vx > 1.4) {
        brakeForce = 22;
      } else if (vx > maxReverseSpeed) {
        engineForce = -180;
        if (wheelsOnGround >= 1) {
          this.chassisBody.applyForce(
            new CANNON.Vec3(-Math.cos(pitch) * 1450, -Math.sin(pitch) * 1450, 0),
            this.chassisBody.position
          );
        }
      }
    } else {
      // Gentle rolling resistance when coasting
      brakeForce = 0.7;
    }

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(engineForce, i);
      this.vehicle.setBrake(brakeForce, i);
    }

    // Direct Nitro jet thrust along forward chassis vector
    if (nitroActive) {
      const forwardX = Math.cos(pitch);
      const forwardY = Math.sin(pitch);
      this.chassisBody.applyForce(
        new CANNON.Vec3(forwardX * 1450, forwardY * 900 + 120, 0),
        this.chassisBody.position
      );
    }

    // Mid-Air Pitch Control (classic Hill-Climb stunt control!)
    let stuntEvent = null;
    const airborne = wheelsOnGround === 0;

    if (airborne) {
      this.airTime += dt;
      // Unwrap delta angle for flip detection
      let deltaPitch = pitch - this.lastPitch;
      if (deltaPitch > Math.PI) deltaPitch -= Math.PI * 2;
      if (deltaPitch < -Math.PI) deltaPitch += Math.PI * 2;
      this.airRotationAccum += deltaPitch;

      // Only apply strong flip spin after brief liftoff grace (0.14s) so tiny meadow hops stay stable
      if (this.airTime > 0.14) {
        const maxAirSpin = 4.6;
        if (gas && this.chassisBody.angularVelocity.z < maxAirSpin) {
          // Nose up (Backflip)
          this.chassisBody.angularVelocity.z += 6.2 * dt;
        } else if (brake && this.chassisBody.angularVelocity.z > -maxAirSpin) {
          // Nose down (Frontflip / level out)
          this.chassisBody.angularVelocity.z -= 6.8 * dt;
        }
      }
      this.wasAirborne = true;
    } else {
      // Just landed! Check if player completed flips or big air!
      if (this.wasAirborne) {
        const flips = Math.floor((Math.abs(this.airRotationAccum) + 0.85) / (Math.PI * 2));
        const uprightOnLanding = Math.cos(pitch) > 0.25;
        if (flips >= 1 && uprightOnLanding) {
          const isBackflip = this.airRotationAccum > 0;
          const bonus = flips * 50;
          stuntEvent = {
            type: flips > 1 ? `${flips}x ${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}!` : `${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}!`,
            bonus,
            impact: Math.min(1, this.airTime * 0.6),
          };
          // Reward nitro for landing a flip!
          this.nitro = Math.min(this.maxNitro, this.nitro + 30 * flips);
        } else if (this.airTime >= 1.35 && uprightOnLanding) {
          const bonus = Math.round(this.airTime * 15);
          stuntEvent = {
            type: `BIG AIR! (${this.airTime.toFixed(1)}s)`,
            bonus,
            impact: Math.min(1, this.airTime * 0.5),
          };
          this.nitro = Math.min(this.maxNitro, this.nitro + 15);
        } else if (this.airTime > 0.35) {
          stuntEvent = {
            type: null,
            bonus: 0,
            impact: Math.min(1, this.airTime * 0.45),
          };
        }
      }
      this.airTime = 0;
      this.airRotationAccum = 0;
      this.wasAirborne = false;

      // Subtle anti-wheelie stabilization on moderate slopes so driving feels snappy, not overly twitchy
      if (gas && wheelsOnGround >= 1 && pitch > 0.72 && this.chassisBody.angularVelocity.z > 0.5) {
        this.chassisBody.angularVelocity.z *= 0.92;
      }
    }

    this.lastPitch = pitch;

    // Roof / Turtled Flip-Over Check
    if (getTerrainHeightAt && !this.isFlippedOver) {
      const cosPitch = Math.cos(pitch);
      const roofWorldX = this.chassisBody.position.x - Math.sin(pitch) * 0.85;
      const roofWorldY = this.chassisBody.position.y + cosPitch * 0.85;
      const groundY = getTerrainHeightAt(roofWorldX);
      const roofTouching = groundY !== null && roofWorldY <= groundY + 0.42;
      const speed = this.chassisBody.velocity.length();

      if (cosPitch < -0.45 && (roofTouching || speed < 1.6)) {
        this.upsideDownTimer += dt;
        if (this.upsideDownTimer > 0.85) {
          this.isFlippedOver = true;
        }
      } else {
        this.upsideDownTimer = Math.max(0, this.upsideDownTimer - dt * 2.5);
      }
    }

    this.syncVisuals(dt, nitroActive, airborne);
    return { stuntEvent, nitroActive, gasActive: gas, wheelsOnGround };
  }

  syncVisuals(dt, nitroActive, airborne) {
    // Sync chassis position & orientation
    this.rootGroup.position.copy(this.chassisBody.position);
    this.rootGroup.quaternion.copy(this.chassisBody.quaternion);

    // Sync wheels & live compressing coil springs!
    for (let i = 0; i < 4; i++) {
      this.vehicle.updateWheelTransform(i);
      const wt = this.vehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.copy(wt.position);
      this.wheelMeshes[i].quaternion.copy(wt.quaternion);

      // Update chassis-local suspension strut length
      const attach = this.wheelAttachPoints[i];
      const suspLen = this.vehicle.wheelInfos[i].suspensionLength || 0.52;
      const link = this.suspensionLinks[i];
      link.strutGroup.position.set(attach.x, attach.y + 0.14, attach.z * 0.76);
      link.shockRod.scale.y = Math.max(0.25, suspLen * 1.35);
      link.shockRod.position.y = -suspLen * 0.52;
      link.springCoil.scale.y = Math.max(0.25, suspLen * 1.35);
      link.springCoil.position.y = -suspLen * 0.46;
    }

    // Springy roof antenna secondary motion
    const accelX = (this.chassisBody.velocity.x - this.prevVelX) / Math.max(dt, 0.008);
    this.prevVelX = this.chassisBody.velocity.x;
    const targetSwing = THREE.MathUtils.clamp(accelX * 0.035, -0.55, 0.55);
    this.antennaVel += (targetSwing - this.antennaSwing) * 42 * dt;
    this.antennaVel *= Math.pow(0.08, dt);
    this.antennaSwing += this.antennaVel * dt;
    this.antennaPivot.rotation.z = this.antennaSwing;

    // Expressive Headlight Eyes animation!
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkDuration = 0.13;
      this.blinkTimer = 2.6 + Math.random() * 2.8;
    }
    if (this.blinkDuration > 0) {
      this.blinkDuration -= dt;
    }
    const isBlinking = this.blinkDuration > 0 && !airborne && !this.isFlippedOver;

    const vy = this.chassisBody.velocity.y;
    const lookY = THREE.MathUtils.clamp(vy * 0.008, -0.06, 0.08);

    this.eyes.forEach((eye) => {
      eye.lid.visible = isBlinking;
      eye.lid.scale.y = isBlinking ? 1 : 0.01;

      if (this.isFlippedOver) {
        // Sad/dizzy tilted brows & offset pupils
        eye.browPivot.rotation.x = -0.35 * eye.sideSign;
        eye.browPivot.position.y = 0.24;
        eye.pupilGroup.position.y = 0.05 * eye.sideSign;
        eye.pupilGroup.scale.setScalar(0.85);
      } else if (nitroActive) {
        // Determined speed brows!
        eye.browPivot.rotation.x = 0.34 * eye.sideSign;
        eye.browPivot.position.y = 0.19;
        eye.pupilGroup.position.y = lookY;
        eye.pupilGroup.scale.setScalar(1.05);
      } else if (airborne) {
        // Wide-eyed excited jump expression!
        eye.browPivot.rotation.x = 0;
        eye.browPivot.position.y = 0.27;
        eye.pupilGroup.position.y = lookY;
        eye.pupilGroup.scale.setScalar(1.18);
      } else {
        // Happy toy cruiser expression
        eye.browPivot.rotation.x = -0.08 * eye.sideSign;
        eye.browPivot.position.y = 0.23;
        eye.pupilGroup.position.y = lookY;
        eye.pupilGroup.scale.setScalar(1.0);
      }
    });
  }

  getExhaustWorldPosition(target = new THREE.Vector3()) {
    return this.exhaustWorldAnchor.getWorldPosition(target);
  }
}
