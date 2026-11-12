import * as CANNON from 'cannon-es';

/**
 * Wraps Cannon-es physics world with tuned materials for bouncy 2.5D hill climbing.
 */
export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18.5, 0),
    });

    // SAPBroadphase is ideal for side-scrolling worlds stretched along the X axis
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.broadphase.axisIndex = 0; // Sort along X axis
    this.world.allowSleep = false;
    this.world.solver.iterations = 12;
    this.world.solver.tolerance = 0.001;

    // Physics materials
    this.groundMaterial = new CANNON.Material('ground');
    this.chassisMaterial = new CANNON.Material('chassis');
    this.wheelMaterial = new CANNON.Material('wheel');

    const groundChassisContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.chassisMaterial,
      {
        friction: 0.35,
        restitution: 0.15,
      }
    );

    const groundWheelContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.wheelMaterial,
      {
        friction: 0.95,
        restitution: 0.05,
      }
    );

    this.world.addContactMaterial(groundChassisContact);
    this.world.addContactMaterial(groundWheelContact);
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.1;

    this.fixedTimeStep = 1 / 60;
    this.maxSubSteps = 5;
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.1);
    this.world.step(this.fixedTimeStep, clampedDt, this.maxSubSteps);
  }
}
