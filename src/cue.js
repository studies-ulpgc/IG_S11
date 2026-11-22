import * as THREE from "three";
import * as TWEEN from "@tweenjs/tween.js";
import { AmmoLib } from "./physics.js";
import { BALL_RADIUS, balls, cueBall } from "./balls.js";
import { TABLE_WIDTH, TABLE_DEPTH } from "./table.js";

export let aimAngle = 0; // 0 radianes = apunta hacia +X (hacia el triángulo)
export let isShooting = false;
export let isCharging = false;
export let power = 0; // 0 a 1

let cueGroup;
let cueMesh;
let aimLine;
const raycaster = new THREE.Raycaster();

export function initCue(scene) {
  cueGroup = new THREE.Group();

  // Construimos un taco cónico realista a lo largo del eje -X (detrás de la bola)
  const cueLength = 3.2;
  const shaftGeo = new THREE.CylinderGeometry(0.022, 0.045, cueLength, 16);
  // Rotamos para que quede horizontal a lo largo de X
  shaftGeo.rotateZ(Math.PI / 2);
  // Desplazamos para que la punta esté en X = 0
  shaftGeo.translate(-cueLength / 2, 0, 0);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.35 });
  cueMesh = new THREE.Mesh(shaftGeo, woodMat);
  cueMesh.castShadow = true;

  // Punta azul (tiza)
  const tipGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 16);
  tipGeo.rotateZ(Math.PI / 2);
  const tipMesh = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0x2563eb }));
  tipMesh.position.x = -0.02;
  cueMesh.add(tipMesh);

  // Culata negra trasera
  const buttGeo = new THREE.CylinderGeometry(0.036, 0.046, 0.9, 16);
  buttGeo.rotateZ(Math.PI / 2);
  const buttMesh = new THREE.Mesh(buttGeo, new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.2 }));
  buttMesh.position.x = -cueLength + 0.45;
  cueMesh.add(buttMesh);

  // Separación inicial respecto a la bola blanca
  cueMesh.position.x = -(BALL_RADIUS + 0.12);
  // Ligera inclinación realista hacia arriba (5 grados)
  cueGroup.rotation.z = 0.08;

  cueGroup.add(cueMesh);
  scene.add(cueGroup);

  // Línea discontinua de apuntado
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
  ]);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.18,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.75,
  });
  aimLine = new THREE.Line(lineGeo, lineMat);
  scene.add(aimLine);
}

export function setAimAngle(angle) {
  aimAngle = angle;
}

export function updateCue(dt, allBallsStopped) {
  if (!cueGroup || !cueBall) return;

  // Ocultar taco y línea mientras las bolas se mueven o se está ejecutando el golpe
  const canAim = allBallsStopped && !cueBall.userData.ballInfo.pocketed;
  cueGroup.visible = canAim || isShooting;
  aimLine.visible = canAim && !isShooting;

  if (!canAim && !isShooting) return;

  // Posicionar el pivote del taco en el centro de la bola blanca
  cueGroup.position.copy(cueBall.position);
  cueGroup.rotation.y = -aimAngle;

  // Si estamos cargando potencia, incrementamos fuerza y echamos el taco hacia atrás
  if (isCharging && !isShooting) {
    power = Math.min(power + dt * 1.1, 1);
    cueMesh.position.x = -(BALL_RADIUS + 0.12 + power * 0.9);
  }

  // Actualizar línea discontinua con Raycaster
  if (aimLine.visible) {
    updateAimLine();
  }
}

function updateAimLine() {
  const dir = new THREE.Vector3(Math.cos(aimAngle), 0, Math.sin(aimAngle)).normalize();
  const origin = cueBall.position.clone();

  // Filtramos las bolas activas (excepto la blanca) para detectar impacto
  const targetBalls = balls.filter((b) => b !== cueBall && !b.userData.ballInfo.pocketed);

  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(targetBalls, false);

  let endPoint;
  if (hits.length > 0) {
    // Cortamos la línea justo antes de tocar la bola objetivo
    endPoint = hits[0].point.clone().sub(dir.clone().multiplyScalar(BALL_RADIUS * 0.5));
  } else {
    // Si no choca con ninguna bola, calculamos intersección con los bordes de la mesa
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
  aimLine.computeLineDistances(); // Imprescindible para que se vean los guiones
}

export function startCharge() {
  if (isShooting) return;
  isCharging = true;
}

export function releaseShot(customPower = null) {
  if (!isCharging && customPower === null) return;
  const finalPower = customPower !== null ? customPower : Math.max(power, 0.12);

  isCharging = false;
  isShooting = true;
  power = 0;

  const startX = cueMesh.position.x;
  const impactX = -(BALL_RADIUS + 0.02);

  // Animación con Tween.js: el taco golpea rápido hacia delante y luego vuelve
  const strikeTween = new TWEEN.Tween({ x: startX })
    .to({ x: impactX }, 110)
    .easing(TWEEN.Easing.Exponential.In)
    .onUpdate((obj) => {
      cueMesh.position.x = obj.x;
    })
    .onComplete(() => {
      // Aplicamos impulso físico real en Ammo.js en el instante del impacto
      const body = cueBall.userData.physicsBody;
      body.activate();
      const impulseStrength = 0.6 + finalPower * 4.2;
      const vx = Math.cos(aimAngle) * impulseStrength;
      const vz = Math.sin(aimAngle) * impulseStrength;
      body.applyCentralImpulse(new AmmoLib.btVector3(vx, 0, vz));

      // Retroceso suave del taco tras el golpe
      new TWEEN.Tween({ x: impactX })
        .to({ x: -(BALL_RADIUS + 0.25) }, 250)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate((obj) => {
          cueMesh.position.x = obj.x;
        })
        .onComplete(() => {
          isShooting = false;
        })
        .start();
    });

  strikeTween.start();
}