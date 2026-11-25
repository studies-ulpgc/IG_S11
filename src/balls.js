import * as THREE from "three";
import { createRigidBody, AmmoLib } from "./physics.js";

export const BALL_RADIUS = 0.18;
export const balls = [];
export let cueBall = null;

const BALL_COLORS = {
  0: "#f7f5eb",
  1: "#f5b800", 
  2: "#1d4ed8", 
  3: "#dc2626", 
  4: "#581c87", 
  5: "#f97316", 
  6: "#15803d",
  7: "#7f1d1d",
  8: "#111111",
};

function createBallTexture(number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const isStriped = number > 8;
  const baseColor =
    number === 0 ? BALL_COLORS[0] : BALL_COLORS[isStriped ? number - 8 : number];

  ctx.fillStyle = isStriped ? "#f7f5eb" : baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (isStriped) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 48, canvas.width, 160);
  }

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

      if (number === 6 || number === 9) {
        ctx.fillRect(cx - 14, cy + 26, 28, 4);
      }
    };

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
  balls.length = 0;

  const geo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
  const shape = new AmmoLib.btSphereShape(BALL_RADIUS);

  const faceUpQuat = new THREE.Quaternion();

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

  cueBall = createSingleBall(0, -2.5, 0);

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