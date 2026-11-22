import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as TWEEN from "@tweenjs/tween.js";
import { initPhysics, updatePhysics, AmmoLib } from "./physics.js";
import { buildTable, POCKETS, POCKET_RADIUS } from "./table.js";
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
let cameraMode = 1; // 1: Vista Tiro, 2: Cenital 2D, 3: Libre 3D
let cenitalVertical = false; // false = horizontal, true = vertical
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

function updateCameraConstraints() {
  if (cameraMode === 1) {
    // Vista tiro: solo permite mirar un poco a izquierda/derecha (±45°) respecto al tiro
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3.2;
    controls.maxPolarAngle = Math.PI / 2.25;

    // Calculamos el ángulo azimutal actual detrás de la bola blanca
    const backAngle = Math.atan2(-Math.sin(aimAngle), -Math.cos(aimAngle));
    controls.minAzimuthAngle = backAngle - Math.PI / 4;
    controls.maxAzimuthAngle = backAngle + Math.PI / 4;
  } else if (cameraMode === 2) {
    // Vista cenital pura 2D: bloquea rotación 3D y activa desplazamiento plano (pan)
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2;
  } else {
    // Vista libre 3D total
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
  }
}

function alignShotCamera(instant = false) {
  if (!cueBall) return;
  updateCameraConstraints();

  const dist = 3.6;
  const targetPos = new THREE.Vector3(
    cueBall.position.x - Math.cos(aimAngle) * dist,
    1.85,
    cueBall.position.z - Math.sin(aimAngle) * dist
  );
  const lookAtPos = new THREE.Vector3(
    cueBall.position.x + Math.cos(aimAngle) * 1.6,
    0.1,
    cueBall.position.z + Math.sin(aimAngle) * 1.6
  );

  if (instant) {
    camera.position.lerp(targetPos, 0.2);
    controls.target.lerp(lookAtPos, 0.25);
  } else {
    new TWEEN.Tween(camera.position)
      .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 550)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    new TWEEN.Tween(controls.target)
      .to({ x: lookAtPos.x, y: lookAtPos.y, z: lookAtPos.z }, 550)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();
  }
}

function setCameraMode(mode) {
  cameraMode = mode;
  document.getElementById("btn-cam-1").classList.toggle("active", mode === 1);
  document.getElementById("btn-cam-2").classList.toggle("active", mode === 2);
  document.getElementById("btn-cam-3").classList.toggle("active", mode === 3);

  updateCameraConstraints();

  if (mode === 1) {
    alignShotCamera(false);
    return;
  }

  let targetPos, lookAtPos;
  if (mode === 2) {
    // Horizontal (eje Z ligero) o Vertical (eje X ligero)
    targetPos = cenitalVertical
      ? new THREE.Vector3(-0.15, 13.5, 0)
      : new THREE.Vector3(0, 12.2, 0.15);
    lookAtPos = new THREE.Vector3(0, 0, 0);
  } else {
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

function skipTurnWait() {
  // Detiene todas las bolas inmediatamente para pasar al siguiente turno
  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    const body = ball.userData.physicsBody;
    body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
    body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
  });
}

function setupControls() {
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;

    if (e.code === "Space" && areAllBallsStopped() && !isCharging && !isShooting) {
      e.preventDefault();
      startCharge();
    }
    if (e.code === "Escape" && isCharging) {
      cancelCharge();
    }
    if (e.code === "Enter" && !areAllBallsStopped()) {
      skipTurnWait();
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
  document.getElementById("btn-cancel-shot").addEventListener("click", () => cancelCharge());
}

function areAllBallsStopped() {
  for (const ball of balls) {
    if (ball.userData.ballInfo.pocketed) continue;
    const vel = ball.userData.physicsBody.getLinearVelocity();
    if (vel.length() > 0.04) return false;
  }
  return true;
}

function checkPockets() {
  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    for (const pocket of POCKETS) {
      const dx = ball.position.x - pocket.x;
      const dz = ball.position.z - pocket.z;
      if (Math.hypot(dx, dz) < POCKET_RADIUS) {
        ball.userData.ballInfo.pocketed = true;

        // Retiramos colisión física
        const body = ball.userData.physicsBody;
        const t = new AmmoLib.btTransform();
        t.setIdentity();
        t.setOrigin(new AmmoLib.btVector3(0, -10, 0));
        body.setWorldTransform(t);
        body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
        body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));

        // Animación visible de caída dentro de la tronera
        new TWEEN.Tween(ball.position)
          .to({ x: pocket.x, y: -0.45, z: pocket.z }, 320)
          .easing(TWEEN.Easing.Quadratic.In)
          .start();

        new TWEEN.Tween(ball.scale)
          .to({ x: 0.2, y: 0.2, z: 0.2 }, 320)
          .easing(TWEEN.Easing.Quadratic.In)
          .onComplete(() => {
            ball.visible = false;
            ball.scale.set(1, 1, 1);
          })
          .start();
      }
    }
  });
}

function respawnCueBallIfPocketed() {
  if (!cueBall || !cueBall.userData.ballInfo.pocketed) return;
  cueBall.userData.ballInfo.pocketed = false;
  cueBall.scale.set(1, 1, 1);
  cueBall.visible = true;

  const body = cueBall.userData.physicsBody;
  const t = new AmmoLib.btTransform();
  t.setIdentity();
  t.setOrigin(new AmmoLib.btVector3(-2.5, BALL_RADIUS, 0));
  body.setWorldTransform(t);
  body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
  body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
  body.activate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const stopped = areAllBallsStopped();
  if (stopped && !isShooting) {
    const turnSpeed = keysPressed["ShiftLeft"] || keysPressed["ShiftRight"] ? 2.4 : 1.1;
    let isTurning = false;

    if (keysPressed["ArrowLeft"]) {
      setAimAngle(aimAngle - turnSpeed * dt);
      isTurning = true;
    }
    if (keysPressed["ArrowRight"]) {
      setAimAngle(aimAngle + turnSpeed * dt);
      isTurning = true;
    }

    if (cameraMode === 1 && isTurning) {
      alignShotCamera(true);
    }

    if (!isCharging) {
      respawnCueBallIfPocketed();
    }
  }

  TWEEN.update();
  updatePhysics(dt);
  checkPockets();
  updateCue(dt, stopped, !!keysPressed["ArrowDown"]);

  const fill = document.getElementById("power-bar-fill");
  if (fill) fill.style.width = `${Math.round(power * 100)}%`;

  controls.update();
  renderer.render(scene, camera);
}

init();