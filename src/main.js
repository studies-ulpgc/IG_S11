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
  isCharging,
  isShooting,
  power,
} from "./cue.js";

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
let cameraMode = 1; // 1: Detrás de bola, 2: Cenital, 3: Libre
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
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // Evita bajar por debajo del suelo

  // Iluminación
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

function setCameraMode(mode) {
  cameraMode = mode;
  document.querySelectorAll(".cam-controls button").forEach((btn, idx) => {
    btn.classList.toggle("active", idx + 1 === mode);
  });

  // Solo permitimos orbitar libremente en modo 3
  controls.enabled = mode === 3;

  let targetPos, lookAtPos;

  if (mode === 1 && cueBall) {
    // Detrás de la bola blanca mirando en la dirección del taco
    const dist = 3.6;
    targetPos = new THREE.Vector3(
      cueBall.position.x - Math.cos(aimAngle) * dist,
      1.9,
      cueBall.position.z - Math.sin(aimAngle) * dist
    );
    lookAtPos = new THREE.Vector3(
      cueBall.position.x + Math.cos(aimAngle) * 2,
      0.1,
      cueBall.position.z + Math.sin(aimAngle) * 2
    );
  } else if (mode === 2) {
    // Vista cenital pura
    targetPos = new THREE.Vector3(0, 11.5, 0.01);
    lookAtPos = new THREE.Vector3(0, 0, 0);
  } else {
    // Vista general libre
    targetPos = new THREE.Vector3(0, 7.5, 8.5);
    lookAtPos = new THREE.Vector3(0, 0, 0);
  }

  new TWEEN.Tween(camera.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 650)
    .easing(TWEEN.Easing.Cubic.InOut)
    .start();

  new TWEEN.Tween(controls.target)
    .to({ x: lookAtPos.x, y: lookAtPos.y, z: lookAtPos.z }, 650)
    .easing(TWEEN.Easing.Cubic.InOut)
    .start();
}

function setupControls() {
  // Apuntar moviendo el ratón (cuando no estamos en cámara libre)
  window.addEventListener("mousemove", (e) => {
    if (cameraMode === 3 || isCharging || isShooting) return;
    setAimAngle(aimAngle + e.movementX * 0.004);
  });

  // Cargar y disparar con clic izquierdo sobre el canvas
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 0 && areAllBallsStopped()) {
      startCharge();
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0 && isCharging) {
      releaseShot();
    }
  });

  // Teclado: flechas para apuntar, Espacio para cargar/tirar, 1-2-3 para cámaras
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space" && areAllBallsStopped() && !isCharging) {
      startCharge();
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

  // Botones HTML de cámara
  document.getElementById("btn-cam-1").addEventListener("click", () => setCameraMode(1));
  document.getElementById("btn-cam-2").addEventListener("click", () => setCameraMode(2));
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

function checkPockets() {
  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    for (const pocket of POCKETS) {
      const dx = ball.position.x - pocket.x;
      const dz = ball.position.z - pocket.z;
      if (Math.hypot(dx, dz) < POCKET_RADIUS) {
        ball.userData.ballInfo.pocketed = true;
        ball.visible = false;

        const body = ball.userData.physicsBody;
        const t = new AmmoLib.btTransform();
        t.setIdentity();
        t.setOrigin(new AmmoLib.btVector3(0, -10, 0));
        body.setWorldTransform(t);
        body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
        body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
      }
    }
  });
}

function respawnCueBallIfPocketed() {
  if (!cueBall || !cueBall.userData.ballInfo.pocketed) return;
  cueBall.userData.ballInfo.pocketed = false;
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

  // Apuntado fino con teclado (flechas izquierda/derecha)
  const stopped = areAllBallsStopped();
  if (stopped && !isCharging && !isShooting) {
    if (keysPressed["ArrowLeft"]) setAimAngle(aimAngle - 1.6 * dt);
    if (keysPressed["ArrowRight"]) setAimAngle(aimAngle + 1.6 * dt);

    // Si la blanca cayó en el turno anterior, la devolvemos a la mesa
    respawnCueBallIfPocketed();

    // En cámara 1, seguimos suavemente el ángulo de apuntado alrededor de la bola blanca
    if (cameraMode === 1 && cueBall) {
      const dist = 3.6;
      const desiredCam = new THREE.Vector3(
        cueBall.position.x - Math.cos(aimAngle) * dist,
        1.9,
        cueBall.position.z - Math.sin(aimAngle) * dist
      );
      camera.position.lerp(desiredCam, 0.12);
      controls.target.lerp(
        new THREE.Vector3(
          cueBall.position.x + Math.cos(aimAngle) * 1.5,
          0.1,
          cueBall.position.z + Math.sin(aimAngle) * 1.5
        ),
        0.15
      );
      camera.lookAt(controls.target);
    }
  }

  TWEEN.update();
  updatePhysics(dt);
  checkPockets();
  updateCue(dt, stopped);

  // Actualizar barra de fuerza en el HUD
  const fill = document.getElementById("power-bar-fill");
  if (fill) fill.style.width = `${Math.round(power * 100)}%`;

  if (cameraMode === 3) controls.update();
  renderer.render(scene, camera);
}

init();