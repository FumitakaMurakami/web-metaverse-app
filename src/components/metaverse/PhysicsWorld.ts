import type * as CANNONType from "cannon-es";

const SIZE_MAP = {
  small:  { box: { w: 0.3, h: 0.3, d: 0.3 }, sphere: { r: 0.15 }, cylinder: { r: 0.15, h: 0.3 } },
  medium: { box: { w: 0.7, h: 0.7, d: 0.7 }, sphere: { r: 0.35 }, cylinder: { r: 0.25, h: 0.7 } },
  large:  { box: { w: 1.2, h: 1.2, d: 1.2 }, sphere: { r: 0.6  }, cylinder: { r: 0.4,  h: 1.2 } },
};

const MASS_MAP = { small: 1, medium: 5, large: 15 };

export class PhysicsWorld {
  private CANNON: typeof CANNONType;
  private world: CANNONType.World;
  private bodies: Map<string, CANNONType.Body> = new Map();

  constructor(CANNON: typeof CANNONType) {
    this.CANNON = CANNON;
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNONType.GSSolver).iterations = 10;
    this.world.allowSleep = true;
  }

  createGround(): void {
    const { CANNON } = this;
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
  }

  addBody(
    id: string,
    opts: {
      type: "dynamic" | "static";
      shape: "box" | "sphere" | "cylinder";
      size: "small" | "medium" | "large";
      position: { x: number; y: number; z: number };
    }
  ): void {
    const { CANNON } = this;
    const sizeData = SIZE_MAP[opts.size];

    let cannonShape: CANNONType.Shape;
    switch (opts.shape) {
      case "box": {
        const s = sizeData.box;
        cannonShape = new CANNON.Box(new CANNON.Vec3(s.w / 2, s.h / 2, s.d / 2));
        break;
      }
      case "sphere":
        cannonShape = new CANNON.Sphere(sizeData.sphere.r);
        break;
      case "cylinder":
        cannonShape = new CANNON.Cylinder(
          sizeData.cylinder.r, sizeData.cylinder.r, sizeData.cylinder.h, 16
        );
        break;
    }

    const mass = opts.type === "dynamic" ? MASS_MAP[opts.size] : 0;
    const body = new CANNON.Body({
      mass,
      shape: cannonShape,
      position: new CANNON.Vec3(opts.position.x, opts.position.y, opts.position.z),
    });

    if (opts.type === "dynamic") {
      body.linearDamping = 0.3;
      body.angularDamping = 0.3;
    }

    this.world.addBody(body);
    this.bodies.set(id, body);
  }

  applyImpulse(id: string, impulse: { x: number; y: number; z: number }): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.wakeUp();
    body.applyImpulse(new this.CANNON.Vec3(impulse.x, impulse.y, impulse.z));
  }

  /** Make a body kinematic (mass=0, controlled by code) for grab */
  setKinematic(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.type = this.CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.setZero();
    body.angularVelocity.setZero();
  }

  /** Restore a body to dynamic after release */
  setDynamic(id: string, mass?: number): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.type = this.CANNON.Body.DYNAMIC;
    body.mass = mass ?? 5;
    body.updateMassProperties();
    body.wakeUp();
  }

  /** Directly set body position (for kinematic grab) */
  setBodyPosition(id: string, pos: { x: number; y: number; z: number }): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.position.set(pos.x, pos.y, pos.z);
    body.velocity.setZero();
    body.angularVelocity.setZero();
  }

  step(dt: number): void {
    this.world.step(1 / 60, dt, 3);
  }

  getBodyState(id: string): { position: CANNONType.Vec3; quaternion: CANNONType.Quaternion } | null {
    const body = this.bodies.get(id);
    if (!body) return null;
    return { position: body.position, quaternion: body.quaternion };
  }

  removeBody(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    this.world.removeBody(body);
    this.bodies.delete(id);
  }

  destroy(): void {
    for (const [id] of this.bodies) {
      this.removeBody(id);
    }
    this.bodies.clear();
  }
}
