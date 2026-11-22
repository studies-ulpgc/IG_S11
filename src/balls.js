import * as THREE from "three";
import { createRigidBody, AmmoLib } from "./physics.js";

export const BALL_RADIUS = 0.18;
export const balls = [];
export let cueBall = null;

const BALL_COLORS = {
  0: "#f7f5eb", // Blanca marfil
  1: "#f5b800", // Amarilla
  2: "#1d4ed8", // Azul
  3: "#dc2626", // Roja
  4: "#581c87", // Morada oscura
  5: "#f97316", // Naranja
  6: "#15803d", // Verde
  7: "#7f1d1d", // Granate
  8: "#111111", // Negra
};

function createBallTexture(number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const isStriped = number > 8;
  const baseColor =
    number === 0 ? BALL_COLORS[0] : BALL_COLORS[isStriped ? number - 8 : number];

  // Fondo marfil o color liso
  ctx.fillStyle = isStriped ? "#f7f5eb" : baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Franja central ancha estilo foto para las rayadas (9 a 15)
  if (isStriped) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 48, canvas.width, 160);
  }

  // Círculo blanco y número en ambos lados de la franja
  if (number > 0) {
    const drawNumberBadge = (cx, cy) => {
      ctx.fillStyle = "#f7f5eb";
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111111";
      ctx.font = "900 60px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(number.toString(), cx, cy + 2);

      // Rayita inferior para el 6 y el 9 igual que en las bolas reales
      if (number === 6 || number === 9) {
        ctx.fillRect(cx - 14, cy + 26, 28, 4);
      }
    };

    // Dibujamos el número en el frente (u=0.5) y en el lado opuesto (u=0)
    drawNumberBadge(256, 128);
    drawNumberBadge(0, 128);
    drawNumberBadge(512, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function spawnBalls(scene) {
  // Limpiamos array si se reinicia
  balls.length = 0;

  const geo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
  const shape = new AmmoLib.btSphereShape(BALL_RADIUS);

  // Rotación inicial para que el número (situado en +X de la UV) mire hacia arriba (+Y)
  const faceUpQuat = new THREE.Quaternion();

  // Orientamos el eje de la textura hacia arriba
  faceUpQuat.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0)
  );

  const createSingleBall = (number, x, z) => {
    const mat = new THREE.MeshStandardMaterial({
      map: createBallTexture(number),
      roughness: 0.12, // Brillo pulido como en la foto
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const group =
      number === 0 ? "cue" : number === 8 ? "eight" : number < 8 ? "solid" : "stripe";
    mesh.userData.ballInfo = { number, group, pocketed: false };

    createRigidBody(
      mesh,
      shape,
      0.17,
      new THREE.Vector3(x, BALL_RADIUS, z),
      faceUpQuat,
      {
        restitution: 0.92,
        friction: 0.15,
        rollingFriction: 0.04,
        damping: { linear: 0.25, angular: 0.25 },
      }
    );

    scene.add(mesh);
    balls.push(mesh);
    return mesh;
  };

  // Bola blanca en el punto de salida izquierdo
  cueBall = createSingleBall(0, -2.5, 0);

  // Triángulo en orden correlativo del 1 al 15
  const rackOrder = [
    [1],
    [2, 3],
    [4, 5, 6],
    [7, 8, 9, 10],
    [11, 12, 13, 14, 15],
  ];

  const startX = 2.0;
  const spacing = BALL_RADIUS * 2.03;

  rackOrder.forEach((row, colIdx) => {
    const x = startX + colIdx * (spacing * 0.866);
    const zOffset = -((row.length - 1) * spacing) / 2;
    row.forEach((num, rowIdx) => {
      createSingleBall(num, x, zOffset + rowIdx * spacing);
    });
  });
}