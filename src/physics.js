export let physicsWorld;
export const rigidBodies = [];
const margin = 0.02;
let transformAux1;
export let AmmoLib;

export async function initPhysics() {
  // Inicializa la librería cargada en el <script> del HTML
  AmmoLib = await window.Ammo();

  const collisionConfiguration = new AmmoLib.btDefaultCollisionConfiguration();
  const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new AmmoLib.btDbvtBroadphase();
  const solver = new AmmoLib.btSequentialImpulseConstraintSolver();

  physicsWorld = new AmmoLib.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  physicsWorld.setGravity(new AmmoLib.btVector3(0, -9.8, 0));

  transformAux1 = new AmmoLib.btTransform();
}

export function createRigidBody(mesh, shape, mass, pos, quat, options = {}) {
  mesh.position.copy(pos);
  if (quat) mesh.quaternion.copy(quat);

  const transform = new AmmoLib.btTransform();
  transform.setIdentity();
  transform.setOrigin(new AmmoLib.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(
    new AmmoLib.btQuaternion(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)
  );

  const motionState = new AmmoLib.btDefaultMotionState(transform);
  const localInertia = new AmmoLib.btVector3(0, 0, 0);
  if (mass > 0) {
    shape.calculateLocalInertia(mass, localInertia);
  }

  shape.setMargin(margin);
  const rbInfo = new AmmoLib.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new AmmoLib.btRigidBody(rbInfo);

  body.setRestitution(options.restitution ?? 0.8);
  body.setFriction(options.friction ?? 0.2);
  body.setRollingFriction(options.rollingFriction ?? 0.05);
  if (options.damping) {
    body.setDamping(options.damping.linear, options.damping.angular);
  }

  mesh.userData.physicsBody = body;

  if (mass > 0) {
    rigidBodies.push(mesh);
    body.setActivationState(4);
  }

  physicsWorld.addRigidBody(body);
  return body;
}

export function updatePhysics(deltaTime) {
  if (!physicsWorld) return;
  physicsWorld.stepSimulation(deltaTime, 10);

  for (let i = 0; i < rigidBodies.length; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();

    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }
}