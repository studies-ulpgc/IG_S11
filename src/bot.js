import * as THREE from "three";
import { balls, cueBall, BALL_RADIUS } from "./balls.js";
import { POCKETS } from "./table.js";
import { gameState, getRemainingCount, saveTurnSnapshot } from "./rules.js";
import { aimAngle, setAimAngle, releaseShot, isShooting } from "./cue.js";

const DIFFICULTY_SETTINGS = {
  easy: { maxErrorDeg: 14, powerJitter: 0.25 },
  medium: { maxErrorDeg: 5, powerJitter: 0.12 },
  hard: { maxErrorDeg: 1.1, powerJitter: 0.04 },
};

let botThinking = false;

export function isBotTurn() {
  return (
    gameState.mode === "bot" &&
    gameState.turn === 2 &&
    !gameState.gameOver &&
    !isShooting
  );
}

export function triggerBotTurn(onStartBanner) {
  if (botThinking || !isBotTurn() || !cueBall || cueBall.userData.ballInfo.pocketed) return;
  botThinking = true;

  if (onStartBanner) onStartBanner("🤖 Bot pensando su tiro...");

  setTimeout(() => {
    if (!isBotTurn()) {
      botThinking = false;
      return;
    }

    const shot = computeBestShot();
    saveTurnSnapshot();

    // Giramos suavemente el taco hacia el ángulo calculado y disparamos
    const startAngle = aimAngle;
    const targetAngle = shot.angle;
    let progress = 0;

    const animInterval = setInterval(() => {
      progress += 0.12;
      if (progress >= 1) {
        clearInterval(animInterval);
        setAimAngle(targetAngle);
        setTimeout(() => {
          releaseShot(shot.power);
          botThinking = false;
        }, 250);
      } else {
        setAimAngle(THREE.MathUtils.lerp(startAngle, targetAngle, progress));
      }
    }, 30);
  }, 750);
}

function computeBestShot() {
  const myGroup = gameState.groups[2];
  const rem = getRemainingCount(2);

  // Filtrar qué bolas puede tirar el bot legalmente
  const validTargets = balls.filter((b) => {
    const info = b.userData.ballInfo;
    if (info.pocketed || info.number === 0) return false;
    if (!myGroup) return info.number !== 8; // Mesa abierta: cualquiera menos la 8
    if (rem === 0) return info.number === 8; // Ya limpió su grupo: a por la 8
    return info.group === myGroup;
  });

  if (validTargets.length === 0) {
    return { angle: Math.random() * Math.PI * 2, power: 0.6 };
  }

  let bestScore = -Infinity;
  let bestAngle = 0;
  let bestPower = 0.65;

  for (const target of validTargets) {
    for (const pocket of POCKETS) {
      // Vector desde la bola objetivo hasta la tronera
      const toPocket = new THREE.Vector3().subVectors(pocket, target.position);
      toPocket.y = 0;
      const distToPocket = toPocket.length();
      const dirToPocket = toPocket.clone().normalize();

      // Punto fantasma donde debe impactar la blanca (detrás de la bola objetivo)
      const ghostPos = target.position
        .clone()
        .sub(dirToPocket.clone().multiplyScalar(BALL_RADIUS * 1.95));

      const cueToGhost = new THREE.Vector3().subVectors(ghostPos, cueBall.position);
      cueToGhost.y = 0;
      const distCueToGhost = cueToGhost.length();
      const dirCueToGhost = cueToGhost.clone().normalize();

      // Puntuamos qué tan recto es el corte (dot product cercano a 1 = tiro recto)
      const alignment = dirCueToGhost.dot(dirToPocket);
      if (alignment < 0.25) continue; // Ángulo demasiado cerrado

      const score = alignment * 10 - (distToPocket + distCueToGhost) * 0.45;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = Math.atan2(dirCueToGhost.z, dirCueToGhost.x);
        bestPower = THREE.MathUtils.clamp(0.32 + (distToPocket + distCueToGhost) * 0.065, 0.3, 0.92);
      }
    }
  }

  // Si ningún tiro estaba claro, apunta directo a la bola válida más cercana
  if (bestScore === -Infinity) {
    const fallback = validTargets[0];
    bestAngle = Math.atan2(
      fallback.position.z - cueBall.position.z,
      fallback.position.x - cueBall.position.x
    );
    bestPower = 0.65;
  }

  // Aplicamos el margen de error según la dificultad (Fácil / Medio / Difícil)
  const cfg = DIFFICULTY_SETTINGS[gameState.botDifficulty] || DIFFICULTY_SETTINGS.medium;
  const errorRad = THREE.MathUtils.degToRad((Math.random() * 2 - 1) * cfg.maxErrorDeg);
  const powerError = (Math.random() * 2 - 1) * cfg.powerJitter;

  return {
    angle: bestAngle + errorRad,
    power: THREE.MathUtils.clamp(bestPower + powerError, 0.2, 0.98),
  };
}