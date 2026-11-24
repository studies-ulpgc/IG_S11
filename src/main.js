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
  isCharging,
  isShooting,
} from "./cue.js";
import {
  gameState,
  resetGameState,
  saveTurnSnapshot,
  rewindLastShot,
  registerBallPocketed,
  evaluateTurnEnd,
  getRemainingCount,
  surrenderGame,
} from "./rules.js";

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
let cameraMode = 1;
let cenitalVertical = false;
let wasMoving = false;
let keysPressed = {};
let confettiParticles = [];
let victoryOrbitAngle = 0;

const BALL_HEX = {
  1: "#f5b800", 2: "#1d4ed8", 3: "#dc2626", 4: "#581c87",
  5: "#f97316", 6: "#15803d", 7: "#7f1d1d", 8: "#111111",
};

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
  resetGameState("pvp");
  saveTurnSnapshot();
  updateHUD("Turno: Jugador 1 (Mesa abierta)");
  setCameraMode(1);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

function restartMatch(newMode = gameState.mode) {
  // Limpiar confeti y bolas antiguas
  confettiParticles.forEach((p) => scene.remove(p.mesh));
  confettiParticles = [];
  balls.forEach((b) => scene.remove(b));

  resetGameState(newMode);
  spawnBalls(scene);
  saveTurnSnapshot();
  setAimAngle(0);

  document.getElementById("gameover-modal").classList.add("hidden");
  updateHUD(
    newMode === "practice"
      ? "Modo Práctica libre"
      : "Turno: Jugador 1 (Mesa abierta)"
  );
  setCameraMode(1);
}

function updateHUD(customBanner = null) {
  const isPractice = gameState.mode === "practice";

  document.getElementById("card-p2").classList.toggle("hidden", isPractice);
  document.getElementById("btn-rewind").classList.toggle("hidden", !isPractice);
  document.getElementById("btn-surrender").classList.toggle("hidden", isPractice);

  const p1Card = document.getElementById("card-p1");
  const p2Card = document.getElementById("card-p2");
  p1Card.classList.toggle("active", isPractice || gameState.turn === 1);
  p2Card.classList.toggle("active", !isPractice && gameState.turn === 2);

  document.getElementById("name-p1").textContent = isPractice ? "Práctica" : "Jugador 1";

  const updatePlayerBadge = (player) => {
    const badge = document.getElementById(`badge-p${player}`);
    const sub = document.getElementById(`sub-p${player}`);
    const grp = gameState.groups[player];
    const rem = getRemainingCount(player);

    badge.className = "group-badge";
    if (isPractice) {
      badge.classList.add("open");
      badge.textContent = "🎱";
      sub.textContent = `Metidas: ${gameState.allPocketed.length} / 15`;
      return;
    }

    if (!grp) {
      badge.classList.add("open");
      badge.textContent = "?";
      sub.textContent = "Mesa abierta";
    } else if (rem === 0) {
      badge.classList.add("eight");
      badge.textContent = "8";
      sub.textContent = "¡A por la Bola 8!";
    } else if (grp === "solid") {
      badge.classList.add("solid");
      badge.textContent = "";
      sub.textContent = `Lisas · ${rem} rest.`;
    } else {
      badge.classList.add("stripe");
      badge.textContent = "";
      sub.textContent = `Rayadas · ${rem} rest.`;
    }
  };

  updatePlayerBadge(1);
  if (!isPractice) updatePlayerBadge(2);

  if (customBanner) {
    document.getElementById("turn-banner").textContent = customBanner;
  }

  // Actualizar desplegable de bolas metidas
  document.getElementById("pocketed-count").textContent = gameState.allPocketed.length;
  const listEl = document.getElementById("pocketed-list");
  if (gameState.allPocketed.length === 0) {
    listEl.innerHTML = `<span class="empty-msg">Aún no ha caído ninguna bola</span>`;
  } else {
    listEl.innerHTML = gameState.allPocketed
      .map((num) => {
        const isStripe = num > 8;
        const baseColor = BALL_HEX[isStripe ? num - 8 : num] || "#111";
        const bg = isStripe
          ? `linear-gradient(180deg, #f8fafc 22%, ${baseColor} 23%, ${baseColor} 77%, #f8fafc 78%)`
          : baseColor;
        return `<div class="mini-ball" style="background:${bg}"><span>${num}</span></div>`;
      })
      .join("");
  }
}

// --- ANIMACIÓN DE DERROTA POR BOLA 8 PREMATURA ---
function playEarlyEightAnimation(pocketPos, result) {
  controls.enabled = false;

  // Onda expansiva roja en la tronera
  const ringGeo = new THREE.RingGeometry(0.15, 0.28, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(pocketPos.x, 0.04, pocketPos.z);
  scene.add(ring);

  new TWEEN.Tween(ring.scale)
    .to({ x: 6, y: 6, z: 6 }, 700)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();
  new TWEEN.Tween(ringMat)
    .to({ opacity: 0 }, 700)
    .onComplete(() => scene.remove(ring))
    .start();

  // Zoom rápido y sacudida dramática hacia la tronera
  const camTarget = new THREE.Vector3(pocketPos.x * 0.6, 3.2, pocketPos.z * 0.6 + 2.6);
  new TWEEN.Tween(camera.position)
    .to({ x: camTarget.x, y: camTarget.y, z: camTarget.z }, 500)
    .easing(TWEEN.Easing.Cubic.Out)
    .onUpdate(() => {
      camera.position.x += (Math.random() - 0.5) * 0.14;
      camera.position.y += (Math.random() - 0.5) * 0.14;
      camera.lookAt(pocketPos);
    })
    .onComplete(() => showGameOverModal(result, "💥"))
    .start();
}

// --- ANIMACIÓN DE VICTORIA (CONFETI 3D Y ÓRBITA) ---
function playVictoryAnimation(result) {
  const colors = result.winner === 1 ? [0x3b82f6, 0x60a5fa, 0xfacc15] : [0xef4444, 0xf87171, 0xfacc15];
  const geo = new THREE.BoxGeometry(0.12, 0.02, 0.08);

  for (let i = 0; i < 90; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * TABLE_WIDTH,
      2.5 + Math.random() * 4,
      (Math.random() - 0.5) * TABLE_DEPTH
    );
    scene.add(mesh);
    confettiParticles.push({
      mesh,
      vy: -(0.8 + Math.random() * 1.4),
      rotSpeed: (Math.random() - 0.5) * 6,
    });
  }

  showGameOverModal(result, "🏆");
}

function showGameOverModal(result, icon) {
  document.getElementById("gameover-icon").textContent = icon;
  const titleEl = document.getElementById("gameover-title");
  titleEl.textContent = `¡Gana Jugador ${result.winner}!`;
  titleEl.style.color = result.winner === 1 ? "#60a5fa" : "#f87171";
  document.getElementById("gameover-reason").textContent = result.reason;
  document.getElementById("gameover-modal").classList.remove("hidden");
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

    if (e.code === "Space" && areAllBallsStopped() && !isCharging && !isShooting && !gameState.gameOver) {
      e.preventDefault();
      saveTurnSnapshot();
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

  document.getElementById("btn-cam-1").addEventListener("click", () => setCameraMode(1));
  document.getElementById("btn-cam-2").addEventListener("click", () => setCameraMode(2));
  document.getElementById("btn-cenital-rot").addEventListener("click", () => {
    cenitalVertical = !cenitalVertical;
    setCameraMode(2);
  });
  document.getElementById("btn-cam-3").addEventListener("click", () => setCameraMode(3));

  // Desplegable de bolas metidas
  document.getElementById("btn-pocketed-toggle").addEventListener("click", () => {
    document.getElementById("pocketed-panel").classList.toggle("hidden");
  });

  // Pop-up de Ayuda (?)
  document.getElementById("btn-help").addEventListener("click", () => {
    document.getElementById("help-modal").classList.remove("hidden");
  });
  document.getElementById("btn-close-help").addEventListener("click", () => {
    document.getElementById("help-modal").classList.add("hidden");
  });

  // Rebobinar en práctica, Reiniciar y Rendirse
  document.getElementById("btn-rewind").addEventListener("click", () => {
    if (areAllBallsStopped() && rewindLastShot()) {
      updateHUD("Tiro rebobinado ⏪");
    }
  });
  document.getElementById("btn-reset-table").addEventListener("click", () => restartMatch(gameState.mode));
  document.getElementById("btn-surrender").addEventListener("click", () => {
    const res = surrenderGame();
    if (res) {
      updateHUD(res.reason);
      playVictoryAnimation(res);
    }
  });

  // Botones del modal de fin de partida
  document.getElementById("btn-play-again").addEventListener("click", () => restartMatch("pvp"));
  document.getElementById("btn-toggle-practice").addEventListener("click", () => restartMatch("practice"));
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
      if (Math.hypot(b.position.x - x, b.position.z - z) < minClearance) return false;
    }
    return true;
  };

  if (isSpotFree(preferredX, preferredZ)) return new THREE.Vector3(preferredX, BALL_RADIUS, preferredZ);

  const candidateX = [-2.5, -2.0, -3.0, -1.5, -3.5, 0, 1.5, 2.5];
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

let lastPocketPos = new THREE.Vector3();

function checkPockets() {
  balls.forEach((ball) => {
    if (ball.userData.ballInfo.pocketed) return;
    for (const pocket of POCKETS) {
      const dx = ball.position.x - pocket.x;
      const dz = ball.position.z - pocket.z;
      if (Math.hypot(dx, dz) < POCKET_RADIUS) {
        ball.userData.ballInfo.pocketed = true;
        lastPocketPos.copy(pocket);
        registerBallPocketed(ball);

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
            if (ball.userData.ballInfo.pocketed) ball.visible = false;
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
  const rawDt = Math.min(clock.getDelta(), 0.05);

  // Enter acelera TODO en cualquier momento (giro, carga de potencia y física)
  const isTurbo = !!keysPressed["Enter"];
  const dt = isTurbo ? rawDt * 2.5 : rawDt;

  const stopped = areAllBallsStopped();

  // Giro de apuntado (funciona tanto parado como siguiendo la bola)
  if (!isShooting && !gameState.gameOver) {
    const turnSpeed = keysPressed["ShiftLeft"] || keysPressed["ShiftRight"] ? 2.4 : 1.1;
    if (keysPressed["ArrowLeft"]) setAimAngle(aimAngle - turnSpeed * dt);
    if (keysPressed["ArrowRight"]) setAimAngle(aimAngle + turnSpeed * dt);
  }

  // Simulación física (4 pasos si mantienes Enter mientras ruedan)
  const simSteps = !stopped && isTurbo ? 4 : 1;
  for (let s = 0; s < simSteps; s++) {
    updatePhysics(rawDt);
    checkPockets();
    checkOutOfBounds();

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

    if (areAllBallsStopped()) break;
  }

  // Fin del turno cuando acaban de detenerse las bolas
  if (stopped && wasMoving) {
    wasMoving = false;
    respawnCueBallIfPocketed();

    const result = evaluateTurnEnd(findFreeSpot);
    if (result) {
      updateHUD(result.message || result.reason);
      if (result.event === "early_eight_loss") {
        playEarlyEightAnimation(lastPocketPos, result);
      } else if (result.event === "win") {
        playVictoryAnimation(result);
      }
    }

    if (cameraMode === 1 && !gameState.gameOver) {
      setCameraMode(1);
    }
  } else if (!stopped) {
    wasMoving = true;
  }

  if (stopped && !isShooting && !gameState.gameOver) {
    if (cameraMode === 1 && cueBall) {
      const { targetPos, lookAtPos } = getShotCameraCoords();
      camera.position.lerp(targetPos, 0.22);
      controls.target.lerp(lookAtPos, 0.25);
      camera.lookAt(controls.target);
    }
  }

  // Animación de confeti y órbita en victoria
  if (gameState.gameOver && gameState.winner && confettiParticles.length > 0) {
    victoryOrbitAngle += rawDt * 0.4;
    camera.position.set(Math.cos(victoryOrbitAngle) * 9, 6.5, Math.sin(victoryOrbitAngle) * 9);
    camera.lookAt(0, 0, 0);

    confettiParticles.forEach((p) => {
      p.mesh.position.y += p.vy * rawDt;
      p.mesh.rotation.x += p.rotSpeed * rawDt;
      p.mesh.rotation.y += p.rotSpeed * rawDt;
      if (p.mesh.position.y < 0.05) p.mesh.position.y = 5.5;
    });
  }

  TWEEN.update();
  updateCue(dt, stopped && !gameState.gameOver, !!keysPressed["ArrowDown"]);

  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
}

init();