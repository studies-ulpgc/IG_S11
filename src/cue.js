import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { AmmoLib } from "./physics.js";
import { BALL_RADIUS, balls, cueBall } from "./balls.js";
import { TABLE_WIDTH, TABLE_DEPTH } from "./table.js";
import { playCueHitSound } from "./audio.js";

export let aimAngle = 0;
export let isShooting = false;
export let isCharging = false;
export let power = 0;

let cueGroup;
let cueMesh;
let aimGroup;
let dashMeshes = [];
let dashMat;
const MAX_DASHES = 28;

const raycaster = new THREE.Raycaster();
const colorWhite = new THREE.Color(0xffffff);
const colorGreen = new THREE.Color(0x22c55e);
const colorYellow = new THREE.Color(0xeab308);
const colorRed = new THREE.Color(0xef4444);

export function initCue(scene) {
  cueGroup = new THREE.Group();

  const cueLength = 2.8;
  const shaftGeo = new THREE.CylinderGeometry(0.02, 0.042, cueLength, 16);
  shaftGeo.rotateZ(Math.PI / 2);
  shaftGeo.translate(-cueLength / 2, 0, 0);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.35 });
  cueMesh = new THREE.Mesh(shaftGeo, woodMat);
  cueMesh.castShadow = true;

  // Punta azul
  const tipGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 16);
  tipGeo.rotateZ(Math.PI / 2);
  const tipMesh = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0x2563eb }));
  tipMesh.position.x = -0.02;
  cueMesh.add(tipMesh);

  // Culata negra
  const buttGeo = new THREE.CylinderGeometry(0.034, 0.043, 0.85, 16);
  buttGeo.rotateZ(Math.PI / 2);
  const buttMesh = new THREE.Mesh(buttGeo, new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.2 }));
  buttMesh.position.x = -cueLength + 0.425;
  cueMesh.add(buttMesh);

  cueMesh.position.x = -(BALL_RADIUS + 0.12);
  cueGroup.rotation.z = -0.14;

  cueGroup.add(cueMesh);
  scene.add(cueGroup);

  // Línea de apuntado hecha con segmentos 3D reales (grosor, largo y color dinámicos)
  aimGroup = new THREE.Group();
  dashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
  });
  const dashGeo = new THREE.BoxGeometry(1, 1, 1);

  for (let i = 0; i < MAX_DASHES; i++) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.visible = false;
    aimGroup.add(dash);
    dashMeshes.push(dash);
  }
  scene.add(aimGroup);
}

export function setAimAngle(angle) {
  aimAngle = angle;
}

export function cancelCharge() {
  isCharging = false;
  power = 0;
  resetAimLineStyle();
  if (cueMesh) {
    new TWEEN.Tween(cueMesh.position)
      .to({ x: -(BALL_RADIUS + 0.12) }, 150)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }
}

function resetAimLineStyle() {
  if (!dashMat) return;
  dashMat.color.copy(colorWhite);
}

export function updateCue(dt, allBallsStopped, isBraking = false) {
  if (!cueGroup || !cueBall) return;

  const canAim = allBallsStopped && !cueBall.userData.ballInfo.pocketed;
  cueGroup.visible = canAim || isShooting;
  aimGroup.visible = canAim && !isShooting;

  if (!canAim && !isShooting) return;

  if (!isShooting) {
    cueGroup.position.copy(cueBall.position);
    cueGroup.rotation.y = -aimAngle;

    const backDirX = -Math.cos(aimAngle);
    const backDirZ = -Math.sin(aimAngle);
    const limitX = TABLE_WIDTH / 2 + 0.15;
    const limitZ = TABLE_DEPTH / 2 + 0.15;
    let distToRail = 4.0;

    if (backDirX > 0.01) distToRail = Math.min(distToRail, (limitX - cueBall.position.x) / backDirX);
    if (backDirX < -0.01) distToRail = Math.min(distToRail, (-limitX - cueBall.position.x) / backDirX);
    if (backDirZ > 0.01) distToRail = Math.min(distToRail, (limitZ - cueBall.position.z) / backDirZ);
    if (backDirZ < -0.01) distToRail = Math.min(distToRail, (-limitZ - cueBall.position.z) / backDirZ);

    const minTilt = -0.14;
    const maxTilt = -0.52;
    const clearanceRatio = THREE.MathUtils.clamp((distToRail - 0.35) / 2.2, 0, 1);
    cueGroup.rotation.z = THREE.MathUtils.lerp(maxTilt, minTilt, clearanceRatio);
  }

  if (isCharging && !isShooting) {
    const rate = isBraking ? -0.95 : 0.85;
    power = THREE.MathUtils.clamp(power + dt * rate, 0.02, 1);
    cueMesh.position.x = -(BALL_RADIUS + 0.12 + power * 0.9);

    if (power < 0.5) {
      dashMat.color.lerpColors(colorGreen, colorYellow, power * 2);
    } else {
      dashMat.color.lerpColors(colorYellow, colorRed, (power - 0.5) * 2);
    }
  } else if (!isCharging) {
    resetAimLineStyle();
  }

  if (aimGroup.visible) {
    updateAimLine();
  }
}

function updateAimLine() {
  const dir = new THREE.Vector3(Math.cos(aimAngle), 0, Math.sin(aimAngle)).normalize();
  const origin = cueBall.position.clone();

  const targetBalls = balls.filter((b) => b !== cueBall && !b.userData.ballInfo.pocketed);

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(targetBalls, false);

  let totalDist;
  if (hits.length > 0) {
    totalDist = Math.max(0.25, hits[0].distance - BALL_RADIUS * 0.4);
  } else {
    const maxX = TABLE_WIDTH / 2 - 0.25;
    const maxZ = TABLE_DEPTH / 2 - 0.25;
    let tMin = 12;

    if (dir.x > 0.001) tMin = Math.min(tMin, (maxX - origin.x) / dir.x);
    if (dir.x < -0.001) tMin = Math.min(tMin, (-maxX - origin.x) / dir.x);
    if (dir.z > 0.001) tMin = Math.min(tMin, (maxZ - origin.z) / dir.z);
    if (dir.z < -0.001) tMin = Math.min(tMin, (-maxZ - origin.z) / dir.z);

    totalDist = Math.max(0.25, tMin);
  }

  const currentPower = isCharging ? power : 0;
  const dashLength = 0.16 + currentPower * 0.22;
  const gapLength = 0.12;
  const thickness = 0.026 + currentPower * 0.042;
  const step = dashLength + gapLength;

  const startOffset = BALL_RADIUS + 0.08;
  let dist = startOffset;
  let idx = 0;

  while (dist < totalDist && idx < MAX_DASHES) {
    const segLen = Math.min(dashLength, totalDist - dist);
    if (segLen < 0.03) break;

    const midDist = dist + segLen / 2;
    const dash = dashMeshes[idx];
    dash.visible = true;
    dash.position.set(
      origin.x + dir.x * midDist,
      BALL_RADIUS * 0.65,
      origin.z + dir.z * midDist
    );
    dash.rotation.y = -aimAngle;
    dash.scale.set(segLen, thickness * 0.6, thickness);

    dist += step;
    idx++;
  }

  for (let i = idx; i < MAX_DASHES; i++) {
    dashMeshes[i].visible = false;
  }
}

export function startCharge() {
  if (isShooting) return;
  isCharging = true;
}

export function releaseShot(customPower = null) {
  if (!isCharging && customPower === null) return;
  const finalPower = customPower !== null ? customPower : Math.max(power, 0.08);

  isCharging = false;
  isShooting = true;
  power = 0;
  resetAimLineStyle();

  cueGroup.position.copy(cueBall.position);
  cueGroup.rotation.y = -aimAngle;

  const startX = cueMesh.position.x;
  const impactX = -(BALL_RADIUS + 0.02);

  new TWEEN.Tween({ x: startX })
    .to({ x: impactX }, 100)
    .easing(TWEEN.Easing.Exponential.In)
    .onUpdate((obj) => {
      cueMesh.position.x = obj.x;
    })
    .onComplete(() => {
      const body = cueBall.userData.physicsBody;
      body.activate();
      const impulseStrength = 0.55 + finalPower * 4.3;
      const vx = Math.cos(aimAngle) * impulseStrength;
      const vz = Math.sin(aimAngle) * impulseStrength;
      body.applyCentralImpulse(new AmmoLib.btVector3(vx, 0, vz));
      playCueHitSound(finalPower);

      new TWEEN.Tween({ x: impactX })
        .to({ x: -(BALL_RADIUS + 0.3) }, 220)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate((obj) => {
          cueMesh.position.x = obj.x;
        })
        .onComplete(() => {
          isShooting = false;
        })
        .start();
    })
    .start();
}