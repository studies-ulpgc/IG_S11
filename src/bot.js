import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
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

  if (onStartBanner) onStartBanner("Bot pensando su tiro...");

  setTimeout(() => {
    if (!isBotTurn()) {
      botThinking = false;
      return;
    }

    const shot = computeBestShot();
    saveTurnSnapshot();

    let diff = (shot.angle - aimAngle) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    const targetAngle = aimAngle + diff;

    new TWEEN.Tween({ angle: aimAngle })
      .to({ angle: targetAngle }, 650)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate((obj) => {
        if (!isBotTurn()) return;
        setAimAngle(obj.angle);
      })
      .onComplete(() => {
        if (!isBotTurn()) {
          botThinking = false;
          return;
        }
        setAimAngle(targetAngle);
        setTimeout(() => {
          releaseShot(shot.power);
          botThinking = false;
        }, 250);
      })
      .start();
  }, 700);
}

function isPathBlocked(pointA, pointB, ignoreBalls = []) {
  const seg = new THREE.Vector3().subVectors(pointB, pointA);
  seg.y = 0;
  const len = seg.length();
  if (len < 0.001) return false;
  const dir = seg.clone().divideScalar(len);
  const clearance = BALL_RADIUS * 2.05;

  for (const b of balls) {
    if (b.userData.ballInfo.pocketed || ignoreBalls.includes(b)) continue;
    const toBall = new THREE.Vector3().subVectors(b.position, pointA);
    toBall.y = 0;
    const proj = toBall.dot(dir);

    if (proj > 0.05 && proj < len - 0.05) {
      const perpSq = toBall.lengthSq() - proj * proj;
      if (perpSq < clearance * clearance) return true;
    }
  }
  return false;
}

function computeBestShot() {
  const myGroup = gameState.groups[2];
  const rem = getRemainingCount(2);

  const validTargets = balls.filter((b) => {
    const info = b.userData.ballInfo;
    if (info.pocketed || info.number === 0) return false;
    if (!myGroup) return info.number !== 8;
    if (rem === 0) return info.number === 8;
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
      const toPocket = new THREE.Vector3().subVectors(pocket, target.position);
      toPocket.y = 0;
      const distToPocket = toPocket.length();
      const dirToPocket = toPocket.clone().normalize();

      const ghostPos = target.position
        .clone()
        .sub(dirToPocket.clone().multiplyScalar(BALL_RADIUS * 1.95));

      const cueToGhost = new THREE.Vector3().subVectors(ghostPos, cueBall.position);
      cueToGhost.y = 0;
      const distCueToGhost = cueToGhost.length();
      const dirCueToGhost = cueToGhost.clone().normalize();

      const alignment = dirCueToGhost.dot(dirToPocket);
      if (alignment < 0.25) continue;

      const blockedCue = isPathBlocked(cueBall.position, ghostPos, [cueBall, target]);
      const blockedPocket = isPathBlocked(target.position, pocket, [cueBall, target]);
      const obstaclePenalty = (blockedCue ? 12 : 0) + (blockedPocket ? 10 : 0);

      const score = alignment * 10 - (distToPocket + distCueToGhost) * 0.45 - obstaclePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = Math.atan2(dirCueToGhost.z, dirCueToGhost.x);
        bestPower = THREE.MathUtils.clamp(0.32 + (distToPocket + distCueToGhost) * 0.065, 0.3, 0.92);
      }
    }
  }

  if (bestScore === -Infinity) {
    const fallback = validTargets[0];
    bestAngle = Math.atan2(
      fallback.position.z - cueBall.position.z,
      fallback.position.x - cueBall.position.x
    );
    bestPower = 0.65;
  }

  const cfg = DIFFICULTY_SETTINGS[gameState.botDifficulty] || DIFFICULTY_SETTINGS.medium;
  const errorRad = THREE.MathUtils.degToRad((Math.random() * 2 - 1) * cfg.maxErrorDeg);
  const powerError = (Math.random() * 2 - 1) * cfg.powerJitter;

  return {
    angle: bestAngle + errorRad,
    power: THREE.MathUtils.clamp(bestPower + powerError, 0.2, 0.98),
  };
}