import * as THREE from "three";
import { AmmoLib } from "./physics.js";
import { balls, cueBall, BALL_RADIUS } from "./balls.js";

export const gameState = {
  mode: "pvp", // "practice" | "pvp" | "bot"
  botDifficulty: "medium", // "easy" | "medium" | "hard"
  turn: 1, // 1 = Azul, 2 = Rojo (o Bot)
  groups: { 1: null, 2: null }, // null | "solid" | "stripe"
  pocketedThisTurn: [],
  allPocketed: [], // Historial ordenado de bolas metidas
  cueBallPocketedThisTurn: false,
  gameOver: false,
  winner: null,
  winReason: "",
  snapshot: null, // Para rebobinar en modo práctica
};

export function resetGameState(mode = gameState.mode, difficulty = gameState.botDifficulty) {
  gameState.mode = mode;
  gameState.botDifficulty = difficulty;
  gameState.turn = 1;
  gameState.groups = { 1: null, 2: null };
  gameState.pocketedThisTurn = [];
  gameState.allPocketed = [];
  gameState.cueBallPocketedThisTurn = false;
  gameState.gameOver = false;
  gameState.winner = null;
  gameState.winReason = "";
  gameState.snapshot = null;
}

// Guarda la posición exacta de todas las bolas antes de golpear (para Rebobinar en práctica)
export function saveTurnSnapshot() {
  gameState.pocketedThisTurn = [];
  gameState.cueBallPocketedThisTurn = false;

  gameState.snapshot = balls.map((b) => ({
    ball: b,
    pos: b.position.clone(),
    quat: b.quaternion.clone(),
    pocketed: b.userData.ballInfo.pocketed,
    visible: b.visible,
  }));
}

export function rewindLastShot() {
  if (!gameState.snapshot || gameState.mode !== "practice") return false;

  gameState.snapshot.forEach((item) => {
    const b = item.ball;
    b.userData.ballInfo.pocketed = item.pocketed;
    b.position.copy(item.pos);
    b.quaternion.copy(item.quat);
    b.scale.set(1, 1, 1);
    b.visible = item.visible;

    const body = b.userData.physicsBody;
    const t = new AmmoLib.btTransform();
    t.setIdentity();
    if (item.pocketed) {
      t.setOrigin(new AmmoLib.btVector3(0, -10, 0));
    } else {
      t.setOrigin(new AmmoLib.btVector3(item.pos.x, item.pos.y, item.pos.z));
      t.setRotation(new AmmoLib.btQuaternion(item.quat.x, item.quat.y, item.quat.z, item.quat.w));
    }
    body.setWorldTransform(t);
    body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
    body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
    body.activate();
  });

  // Limpiamos del historial las bolas que cayeron en ese último tiro
  const activeNums = new Set(
    balls.filter((b) => b.userData.ballInfo.pocketed).map((b) => b.userData.ballInfo.number)
  );
  gameState.allPocketed = gameState.allPocketed.filter((num) => activeNums.has(num));
  return true;
}

export function registerBallPocketed(ball) {
  const num = ball.userData.ballInfo.number;
  if (num === 0) {
    gameState.cueBallPocketedThisTurn = true;
    return;
  }

  gameState.pocketedThisTurn.push(num);
  if (!gameState.allPocketed.includes(num)) {
    gameState.allPocketed.push(num);
  }
}

export function getRemainingCount(player) {
  const group = gameState.groups[player];
  if (!group) return 7;
  return balls.filter(
    (b) => b.userData.ballInfo.group === group && !b.userData.ballInfo.pocketed
  ).length;
}

export function evaluateTurnEnd(findFreeSpotFn) {
  if (gameState.gameOver) return null;

  // En modo práctica no se pierde ni se cambia de turno; si cae la 8, reaparece en un sitio libre
  if (gameState.mode === "practice") {
    const eightBall = balls.find((b) => b.userData.ballInfo.number === 8);
    if (eightBall && eightBall.userData.ballInfo.pocketed) {
      const freePos = findFreeSpotFn(2.0, 0);
      eightBall.userData.ballInfo.pocketed = false;
      eightBall.position.copy(freePos);
      eightBall.scale.set(1, 1, 1);
      eightBall.visible = true;

      const body = eightBall.userData.physicsBody;
      const t = new AmmoLib.btTransform();
      t.setIdentity();
      t.setOrigin(new AmmoLib.btVector3(freePos.x, freePos.y, freePos.z));
      body.setWorldTransform(t);
      body.setLinearVelocity(new AmmoLib.btVector3(0, 0, 0));
      body.setAngularVelocity(new AmmoLib.btVector3(0, 0, 0));
      body.activate();

      gameState.allPocketed = gameState.allPocketed.filter((n) => n !== 8);
      return { event: "practice_8_respawn", message: "Bola 8 recolocada en la mesa" };
    }
    return { event: "continue", message: "Modo Práctica" };
  }

  // --- MODO COMPETITIVO (1 vs 1 / BOT) ---
  const p = gameState.turn;
  const opp = p === 1 ? 2 : 1;
  const pocketed = gameState.pocketedThisTurn;
  const eightPocketed = pocketed.includes(8);
  const scratch = gameState.cueBallPocketedThisTurn;

  // 1. Comprobar si cayó la Bola 8
  if (eightPocketed) {
    const myGroup = gameState.groups[p];
    const remainingBeforeShot = myGroup ? getRemainingCount(p) : 7;
    gameState.gameOver = true;

    if (myGroup && remainingBeforeShot === 0 && !scratch) {
      gameState.winner = p;
      gameState.winReason = `¡Jugador ${p} mete la Bola 8 y gana la partida!`;
      return { event: "win", winner: p, reason: gameState.winReason };
    } else {
      gameState.winner = opp;
      gameState.winReason = scratch
        ? `¡Falta con la blanca al meter la 8! Gana Jugador ${opp}`
        : `¡Bola 8 metida antes de tiempo! Gana Jugador ${opp}`;
      return { event: "early_eight_loss", winner: opp, reason: gameState.winReason };
    }
  }

  // 2. Asignar Lisas o Rayadas si la mesa estaba abierta
  const coloredPocketed = pocketed.filter((n) => n !== 8);
  let assignedNow = false;

  if (!gameState.groups[1] && coloredPocketed.length > 0 && !scratch) {
    const firstBall = coloredPocketed[0];
    const chosenGroup = firstBall < 8 ? "solid" : "stripe";
    gameState.groups[p] = chosenGroup;
    gameState.groups[opp] = chosenGroup === "solid" ? "stripe" : "solid";
    assignedNow = true;
  }

  // 3. Decidir si conserva turno o pasa al rival
  const myGroup = gameState.groups[p];
  const scoredOwnBall =
    myGroup &&
    coloredPocketed.some((n) => (myGroup === "solid" ? n < 8 : n > 8));

  if (!scratch && (assignedNow || scoredOwnBall)) {
    return {
      event: "keep_turn",
      message: assignedNow
        ? `Jugador ${p} juega con ${myGroup === "solid" ? "Lisas (1-7)" : "Rayadas (9-15)"}`
        : `¡Buena bola! Repite tiro Jugador ${p}`,
    };
  } else {
    gameState.turn = opp;
    return {
      event: "switch_turn",
      message: scratch ? `Falta (blanca). Turno de Jugador ${opp}` : `Turno de Jugador ${opp}`,
    };
  }
}

export function surrenderGame() {
  if (gameState.gameOver || gameState.mode === "practice") return null;
  const opp = gameState.turn === 1 ? 2 : 1;
  gameState.gameOver = true;
  gameState.winner = opp;
  gameState.winReason = `Jugador ${gameState.turn} se ha rendido. ¡Victoria para Jugador ${opp}!`;
  return { event: "win", winner: opp, reason: gameState.winReason };
}