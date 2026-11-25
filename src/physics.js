export let physicsWorld;
export const rigidBodies = [];
const margin = 0.02;
let transformAux1;
export let AmmoLib;
const ballMeshesByNumber = new Map();
let cueBallHits = [];

export function resetCueBallContactHistory() {
  cueBallHits = [];
}

export function getCueBallContacts() {
  const contacts = cueBallHits;
  cueBallHits = [];
  return contacts;
}

function collectCueBallManifoldContacts() {
  if (!physicsWorld || !AmmoLib) return;

  const dispatcher = physicsWorld.getDispatcher();
  if (!dispatcher) return;

  for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
    const manifold = dispatcher.getManifoldByIndexInternal(i);
    const body0 = manifold.getBody0();
    const body1 = manifold.getBody1();
    const index0 = body0.getUserIndex();
    const index1 = body1.getUserIndex();
    const mesh0 = ballMeshesByNumber.get(index0 - 1);
    const mesh1 = ballMeshesByNumber.get(index1 - 1);
    if (!mesh0 || !mesh1) continue;

    let cueMesh = null;
    let otherMesh = null;
    if (mesh0.userData.ballInfo?.number === 0) {
      cueMesh = mesh0;
      otherMesh = mesh1;
    } else if (mesh1.userData.ballInfo?.number === 0) {
      cueMesh = mesh1;
      otherMesh = mesh0;
    }

    if (!cueMesh || !otherMesh || cueMesh.userData.ballInfo.pocketed) continue;
    if (otherMesh.userData.ballInfo.pocketed) continue;

    for (let c = 0; c < manifold.getNumContacts(); c++) {
      const point = manifold.getContactPoint(c);
      if (point.getDistance() <= 0.02) {
        cueBallHits.push(otherMesh.userData.ballInfo.number);
        break;
      }
    }
  }
}

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
  if (mesh.userData.ballInfo) {
    body.setUserIndex(mesh.userData.ballInfo.number + 1);
    ballMeshesByNumber.set(mesh.userData.ballInfo.number, mesh);
  }

  if (mass > 0) {
    rigidBodies.push(mesh);
    body.setActivationState(4);
  }

  physicsWorld.addRigidBody(body);
  return body;
}

export function updatePhysics(deltaTime) {
  if (!physicsWorld) return;
  const step = Math.min(deltaTime, 1 / 120);
  const subSteps = Math.max(1, Math.ceil(deltaTime / step));

  for (let i = 0; i < subSteps; i++) {
    physicsWorld.stepSimulation(step, 1, step);
    collectCueBallManifoldContacts();
  }

  for (let i = 0; i < rigidBodies.length; i++) {
    const objThree = rigidBodies[i];
    // Si la bola ya entró en una tronera, dejamos que Tween.js anime su caída
    if (objThree.userData.ballInfo && objThree.userData.ballInfo.pocketed) continue;

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

export function removeRigidBody(mesh) {
  if (!physicsWorld || !mesh.userData.physicsBody) return;
  if (mesh.userData.ballInfo) {
    ballMeshesByNumber.delete(mesh.userData.ballInfo.number);
  }
  physicsWorld.removeRigidBody(mesh.userData.physicsBody);
  AmmoLib.destroy(mesh.userData.physicsBody);
  mesh.userData.physicsBody = null;

  const idx = rigidBodies.indexOf(mesh);
  if (idx !== -1) {
    rigidBodies.splice(idx, 1);
  }
}