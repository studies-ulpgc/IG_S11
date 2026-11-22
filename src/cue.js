import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { AmmoLib } from "./physics.js";
import { BALL_RADIUS, balls, cueBall } from "./balls.js";
import { TABLE_WIDTH, TABLE_DEPTH } from "./table.js";

export let aimAngle = 0;
export let isShooting = false;
export let isCharging = false;
export let power = 0;

let cueGroup;
let cueMesh;
let aimLine;
const raycaster = new THREE.Raycaster();

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
  cueGroup.rotation.z = 0.08;

  cueGroup.add(cueMesh);
  scene.add(cueGroup);

  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.18,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.85,
  });
  aimLine = new THREE.Line(lineGeo, lineMat);
  scene.add(aimLine);
}

export function setAimAngle(angle) {
  aimAngle = angle;
}

export function adjustPower(delta) {
  if (!isCharging || isShooting) return;
  power = THREE.MathUtils.clamp(power + delta, 0, 1);
  cueMesh.position.x = -(BALL_RADIUS + 0.12 + power * 0.9);
}

export function cancelCharge() {
  isCharging = false;
  power = 0;
  if (cueMesh) {
    new TWEEN.Tween(cueMesh.position)
      .to({ x: -(BALL_RADIUS + 0.12) }, 150)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }
}

export function updateCue(dt, allBallsStopped, reducePowerPressed = false) {
  if (!cueGroup || !cueBall) return;

  const canAim = allBallsStopped && !cueBall.userData.ballInfo.pocketed;
  cueGroup.visible = canAim || isShooting;
  aimLine.visible = canAim && !isShooting;

  if (!canAim && !isShooting) return;

  if (!isShooting) {
    cueGroup.position.copy(cueBall.position);
    cueGroup.rotation.y = -aimAngle;

    // Calculamos cuánto espacio libre hay detrás de la bola blanca hasta el borde de madera
    const backDirX = -Math.cos(aimAngle);
    const backDirZ = -Math.sin(aimAngle);
    const limitX = TABLE_WIDTH / 2 + 0.15;
    const limitZ = TABLE_DEPTH / 2 + 0.15;
    let distToRail = 4.0;

    if (backDirX > 0.01) distToRail = Math.min(distToRail, (limitX - cueBall.position.x) / backDirX);
    if (backDirX < -0.01) distToRail = Math.min(distToRail, (-limitX - cueBall.position.x) / backDirX);
    if (backDirZ > 0.01) distToRail = Math.min(distToRail, (limitZ - cueBall.position.z) / backDirZ);
    if (backDirZ < -0.01) distToRail = Math.min(distToRail, (-limitZ - cueBall.position.z) / backDirZ);

    // Si el taco chocaría con el borde de madera, lo elevamos de forma realista (como en billar real)
    const minTilt = 0.08;
    const maxTilt = 0.48; // ~27 grados cuando está pegado a la banda
    const clearanceRatio = THREE.MathUtils.clamp((distToRail - 0.35) / 2.2, 0, 1);
    cueGroup.rotation.z = THREE.MathUtils.lerp(maxTilt, minTilt, clearanceRatio);
  }

  if (isCharging && !isShooting) {
    // Si pulsas Flecha Abajo mientras cargas, baja la potencia; si no, sube
    const rate = reducePowerPressed ? -0.85 : 0.85;
    power = THREE.MathUtils.clamp(power + dt * rate, 0.02, 1);
    cueMesh.position.x = -(BALL_RADIUS + 0.12 + power * 0.9);
  }

  if (aimLine.visible) {
    updateAimLine();
  }
}

function updateAimLine() {
  const dir = new THREE.Vector3(Math.cos(aimAngle), 0, Math.sin(aimAngle)).normalize();
  const origin = cueBall.position.clone();

  const targetBalls = balls.filter((b) => b !== cueBall && !b.userData.ballInfo.pocketed);

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(targetBalls, false);

  let endPoint;
  if (hits.length > 0) {
    endPoint = hits[0].point.clone().sub(dir.clone().multiplyScalar(BALL_RADIUS * 0.5));
  } else {
    const maxX = TABLE_WIDTH / 2 - 0.3;
    const maxZ = TABLE_DEPTH / 2 - 0.3;
    let tMin = 12;

    if (dir.x > 0.001) tMin = Math.min(tMin, (maxX - origin.x) / dir.x);
    if (dir.x < -0.001) tMin = Math.min(tMin, (-maxX - origin.x) / dir.x);
    if (dir.z > 0.001) tMin = Math.min(tMin, (maxZ - origin.z) / dir.z);
    if (dir.z < -0.001) tMin = Math.min(tMin, (-maxZ - origin.z) / dir.z);

    endPoint = origin.clone().add(dir.clone().multiplyScalar(Math.max(0.2, tMin)));
  }

  aimLine.geometry.setFromPoints([origin, endPoint]);
  aimLine.computeLineDistances();
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