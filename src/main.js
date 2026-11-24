import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as TWEEN from "@tweenjs/tween.js";
import { initPhysics, updatePhysics, AmmoLib } from "./physics.js";
import { buildTable, POCKETS, POCKET_RADIUS, TABLE_WIDTH, TABLE_DEPTH } from "./table.js";
import { spawnBalls, balls, cueBall, BALL_RADIUS } from "./balls.js";
import {
  initCue,
  updateCue,
  aimAngle,
  setAimAngle,
  startCharge,
  releaseShot,
  cancelCharge,
  isCharging,
  isShooting,
  power,
} from "./cue.js";

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
let cameraMode = 1; // 1: Vista Tiro (detrás de la blanca), 2: Cenital 2D, 3: Libre 3D
let cenitalVertical = false;
let fastForward = false;
let wasMoving = false;
let keysPressed = {};

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141820);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(-6, 3.2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 22;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const lampLight = new THREE.DirectionalLight(0xfff5e4, 1.2);
  lampLight.position.set(0, 10, 2);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(2048, 2048);
  scene.add(lampLight);

  await initPhysics();
  buildTable(scene);
  spawnBalls(scene);
  initCue(scene);

  setupControls();
  setCameraMode(1);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

function getShotCameraCoords() {
  const dist = 3.5;
  const targetPos = new THREE.Vector3(
    cueBall.position.x - Math.cos(aimAngle) * dist,
    1.75,
    cueBall.position.z - Math.sin(aimAngle) * dist
  );
  const lookAtPos = new THREE.Vector3(
    cueBall.position.x + Math.cos(aimAngle) * 1.8,
    0.1,
    cueBall.position.z + Math.sin(aimAngle) * 1.8
  );
  return { targetPos, lookAtPos };
}

function setCameraMode(mode) {
  cameraMode = mode;
  document.getElementById("btn-cam-1").classList.toggle("active", mode === 1);
  document.getElementById("btn-cam-2").classList.toggle("active", mode === 2);
  document.getElementById("btn-cam-3").classList.toggle("active", mode === 3);

  if (mode === 1 && cueBall) {
    controls.enabled = false;
    const { targetPos, lookAtPos } = getShotCameraCoords();

    new TWEEN.Tween(camera.position)
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 500)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    new TWEEN.Tween(controls.target)
      .to({ x: lookAtPos.x, y: lookAtPos.y, z: lookAtPos.z }, 500)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate(() => camera.lookAt(controls.target))
      .start();
    return;
  }

  controls.enabled = true;
  let targetPos, lookAtPos;

  if (mode === 2) {
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    targetPos = cenitalVertical
      ? new THREE.Vector3(-0.15, 13.5, 0)
      : new THREE.Vector3(0, 12.2, 0.15);
    lookAtPos = new THREE.Vector3(0, 0, 0);
  } else {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    targetPos = new THREE.Vector3(0, 7.2, 8.8);
    lookAtPos = new THREE.Vector3(0, 0, 0);
  }

  new TWEEN.Tween(camera.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 550)
    .easing(TWEEN.Easing.Cubic.InOut)
    .start();

  new TWEEN.Tween(controls.target)
    .to({ x: lookAtPos.x, y: lookAtPos.y, z: lookAtPos.z }, 550)
    .easing(TWEEN.Easing.Cubic.InOut)
    .start();
}

function setupControls() {
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;

    if (e.code === "Space" && areAllBallsStopped() && !isCharging && !isShooting) {
      e.preventDefault();
      startCharge();
    }
    if (e.code === "ArrowDown" && isCharging) {
      cancelCharge();
    }
    if (e.code === "Enter" && !areAllBallsStopped()) {
      fastForward = true;
    }
    if (e.key === "1") setCameraMode(1);
    if (e.key === "2") setCameraMode(2);
    if (e.key === "3") setCameraMode(3);
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space" && isCharging) {
      releaseShot();
    }
  });

  document.getElementById("btn-cam-1").addEventListener("click", () => setCameraMode(1));
  document.getElementById("btn-cam-2").addEventListener("click", () => setCameraMode(2));
  document.getElementById("btn-cenital-rot").addEventListener("click", () => {
    cenitalVertical = !cenitalVertical;
    setCameraMode(2);
  });
  document.getElementById("btn-cam-3").addEventListener("click", () => setCameraMode(3));
}

function areAllBallsStopped() {
  for (const ball of balls) {
    if (ball.userData.ballInfo.pocketed) continue;
    const vel = ball.userData.physicsBody.getLinearVelocity();
    if (vel.length() > 0.04) return false;
  }
  return true;
}

function findFreeSpot(preferredX = -2.5, preferredZ = 0) {
  const minClearance = BALL_RADIUS * 2.6;
  const isSpotFree = (x, z) => {
    for (const b of balls) {
      if (b.userData.ballInfo.pocketed) continue;
      if (Math.hypot(b.position.x - x, b.position.z - z) < minClearance) {
        return false;
      }
    }
    return true;
  };

  if (isSpotFree(preferredX, preferredZ)) {
    return new THREE.Vector3(preferredX, BALL_RADIUS, preferredZ);
  }

  const candidateX = [-2.5, -2.0, -3.0, -1.5, -3.5, 0, 1.5];
  const candidateZ = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];

  for (const x of candidateX) {
    for (const z of candidateZ) {
      if (isSpotFree(x, z)) return new THREE.Vector3(x, BALL_RADIUS, z);
    }
  }
  return new THREE.Vector3(0, BALL_RADIUS, 0);
}

function checkOutOfBounds() {
  const limitX = TABLE_WIDTH / 2 + 0.35;
  const limitZ = TABLE_DEPTH / 2 + 0.35;

  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    if (
      Math.abs(ball.position.x) > limitX ||
      Math.abs(ball.position.z) > limitZ ||
      ball.position.y < -0.2
    ) {
      const safePos = findFreeSpot(ball === cueBall ? -2.5 : 0, 0);
      ball.position.copy(safePos);
      ball.visible = true;
      ball.scale.set(1, 1, 1);

      const body = ball.userData.physicsBody;
      const t = new AmmoLib.btTransform();
      t.setIdentity();
      t.setOrigin(new AmmoLib.btVector3(safePos.x, safePos.y, safePos.z));
      body.setWorldTransform(t);
      body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
      body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
      body.activate();
    }
  });
}

function checkPockets() {
  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    for (const pocket of POCKETS) {
      const dx = ball.position.x - pocket.x;
      const dz = ball.position.z - pocket.z;
      if (Math.hypot(dx, dz) < POCKET_RADIUS) {
        ball.userData.ballInfo.pocketed = true;

        const body = ball.userData.physicsBody;
        const t = new AmmoLib.btTransform();
        t.setIdentity();
        t.setOrigin(new AmmoLib.btVector3(0, -10, 0));
        body.setWorldTransform(t);
        body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
        body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));

        const posTween = new TWEEN.Tween(ball.position)
          .to({ x: pocket.x, y: -0.45, z: pocket.z }, 320)
          .easing(TWEEN.Easing.Quadratic.In)
          .start();

        const scaleTween = new TWEEN.Tween(ball.scale)
          .to({ x: 0.2, y: 0.2, z: 0.2 }, 320)
          .easing(TWEEN.Easing.Quadratic.In)
          .onComplete(() => {
            // Solo la ocultamos si sigue marcada como entronerada (evita el bug con Enter)
            if (ball.userData.ballInfo.pocketed) {
              ball.visible = false;
            }
            ball.scale.set(1, 1, 1);
          })
          .start();

        ball.userData.pocketTweens = [posTween, scaleTween];
      }
    }
  });
}

function respawnCueBallIfPocketed() {
  if (!cueBall || !cueBall.userData.ballInfo.pocketed) return;

  // Cancelamos cualquier animación de caída pendiente antes de reaparecer
  if (cueBall.userData.pocketTweens) {
    cueBall.userData.pocketTweens.forEach((tw) => tw.stop());
    cueBall.userData.pocketTweens = null;
  }

  const freePos = findFreeSpot(-2.5, 0);
  cueBall.userData.ballInfo.pocketed = false;
  cueBall.scale.set(1, 1, 1);
  cueBall.position.copy(freePos);
  cueBall.visible = true;

  const body = cueBall.userData.physicsBody;
  const t = new AmmoLib.btTransform();
  t.setIdentity();
  t.setOrigin(new AmmoLib.btVector3(freePos.x, freePos.y, freePos.z));
  body.setWorldTransform(t);
  body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
  body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
  body.activate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const stopped = areAllBallsStopped();

  // Permitimos girar con izquierda/derecha en todo momento (parado o siguiendo la bola)
  if (!isShooting) {
    const turnSpeed = keysPressed["ShiftLeft"] || keysPressed["ShiftRight"] ? 2.4 : 1.1;
    if (keysPressed["ArrowLeft"]) {
      setAimAngle(aimAngle - turnSpeed * dt);
    }
    if (keysPressed["ArrowRight"]) {
      setAimAngle(aimAngle + turnSpeed * dt);
    }
  }

  const simSteps = !stopped && fastForward ? 4 : 1;
  for (let s = 0; s < simSteps; s++) {
    updatePhysics(dt);
    checkPockets();
    checkOutOfBounds();

    // Seguimiento idéntico tanto a velocidad normal como acelerada con Enter
    if (!areAllBallsStopped() && cameraMode === 1 && cueBall && !cueBall.userData.ballInfo.pocketed) {
      const followPos = new THREE.Vector3(
        cueBall.position.x - Math.cos(aimAngle) * 4.5,
        3.4,
        cueBall.position.z - Math.sin(aimAngle) * 4.5
      );
      camera.position.lerp(followPos, 0.08);
      controls.target.lerp(cueBall.position, 0.15);
      camera.lookAt(controls.target);
    }

    if (areAllBallsStopped()) {
      fastForward = false;
      break;
    }
  }

  // Mientras las bolas ruedan en Vista Tiro (1), seguimos la bola blanca y permitimos girar alrededor
  if (!stopped && cameraMode === 1 && cueBall && !cueBall.userData.ballInfo.pocketed) {
    const followPos = new THREE.Vector3(
      cueBall.position.x - Math.cos(aimAngle) * 4.5,
      3.4,
      cueBall.position.z - Math.sin(aimAngle) * 4.5
    );
    camera.position.lerp(followPos, 0.08);
    controls.target.lerp(cueBall.position, 0.15);
    camera.lookAt(controls.target);
  }

  // Cuando acaban de detenerse todas las bolas tras un disparo (normal o con Enter)
  if (stopped && wasMoving) {
    wasMoving = false;
    respawnCueBallIfPocketed();
    if (cameraMode === 1) {
      setCameraMode(1);
    }
  } else if (!stopped) {
    wasMoving = true;
  }

  if (stopped && !isShooting) {
    if (cameraMode === 1 && cueBall) {
      const { targetPos, lookAtPos } = getShotCameraCoords();
      camera.position.lerp(targetPos, 0.22);
      controls.target.lerp(lookAtPos, 0.25);
      camera.lookAt(controls.target);
    }
  }

  TWEEN.update();
  updateCue(dt, stopped, !!keysPressed["ArrowDown"]);

  const fill = document.getElementById("power-bar-fill");
  if (fill) fill.style.width = `${Math.round(power * 100)}%`;

  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
}

init();