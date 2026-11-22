import * as THREE from "three";
import { createRigidBody, AmmoLib } from "./physics.js";

export const TABLE_WIDTH = 10;   // Eje X (largo)
export const TABLE_DEPTH = 5.4;  // Eje Z (ancho)
export const POCKET_RADIUS = 0.42;

// Coordenadas exactas de los 6 agujeros
export const POCKETS = [
  new THREE.Vector3(-TABLE_WIDTH / 2 + 0.15, 0, -TABLE_DEPTH / 2 + 0.15),
  new THREE.Vector3(0, 0, -TABLE_DEPTH / 2 - 0.05),
  new THREE.Vector3(TABLE_WIDTH / 2 - 0.15, 0, -TABLE_DEPTH / 2 + 0.15),
  new THREE.Vector3(-TABLE_WIDTH / 2 + 0.15, 0, TABLE_DEPTH / 2 - 0.15),
  new THREE.Vector3(0, 0, TABLE_DEPTH / 2 + 0.05),
  new THREE.Vector3(TABLE_WIDTH / 2 - 0.15, 0, TABLE_DEPTH / 2 - 0.15),
];

export function buildTable(scene) {
  const tableGroup = new THREE.Group();

  // 1. Tapete verde (superficie de juego en Y = 0)
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x1b6b3a, roughness: 0.8 });
  const feltGeo = new THREE.BoxGeometry(TABLE_WIDTH, 0.4, TABLE_DEPTH);
  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  feltMesh.receiveShadow = true;
  createRigidBody(
    feltMesh,
    new Ammo.btBoxShape(new Ammo.btVector3(TABLE_WIDTH / 2, 0.2, TABLE_DEPTH / 2)),
    0,
    new THREE.Vector3(0, -0.2, 0),
    null,
    { restitution: 0.2, friction: 0.3 }
  );
  tableGroup.add(feltMesh);

  // 2. Marco exterior de madera
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.5 });
  const railH = 0.35;
  const railThick = 0.45;

  // Función auxiliar para crear tramos de banda con rebote
  const addCushion = (w, d, x, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, railH, d), feltMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    createRigidBody(
      mesh,
      new Ammo.btBoxShape(new Ammo.btVector3(w / 2, railH / 2, d / 2)),
      0,
      new THREE.Vector3(x, railH / 2, z),
      null,
      { restitution: 0.88, friction: 0.1 } // Rebote vivo
    );
    tableGroup.add(mesh);
  };

  // 6 tramos de bandas dejando huecos para las 6 troneras
  const sideLen = TABLE_WIDTH / 2 - POCKET_RADIUS * 1.6;
  const endLen = TABLE_DEPTH - POCKET_RADIUS * 2.4;

  // Bandas largas (superior e inferior en Z)
  addCushion(sideLen, 0.25, -TABLE_WIDTH / 4, -TABLE_DEPTH / 2 + 0.125);
  addCushion(sideLen, 0.25, TABLE_WIDTH / 4, -TABLE_DEPTH / 2 + 0.125);
  addCushion(sideLen, 0.25, -TABLE_WIDTH / 4, TABLE_DEPTH / 2 - 0.125);
  addCushion(sideLen, 0.25, TABLE_WIDTH / 4, TABLE_DEPTH / 2 - 0.125);

  // Bandas cortas (izquierda y derecha en X)
  addCushion(0.25, endLen, -TABLE_WIDTH / 2 + 0.125, 0);
  addCushion(0.25, endLen, TABLE_WIDTH / 2 - 0.125, 0);

  // Bordes exteriores decorativos de madera
  const topBorder = new THREE.Mesh(new THREE.BoxGeometry(TABLE_WIDTH + railThick * 2, railH + 0.1, railThick), woodMat);
  topBorder.position.set(0, railH / 2, -TABLE_DEPTH / 2 - railThick / 2);
  const botBorder = topBorder.clone();
  botBorder.position.z = TABLE_DEPTH / 2 + railThick / 2;
  const leftBorder = new THREE.Mesh(new THREE.BoxGeometry(railThick, railH + 0.1, TABLE_DEPTH), woodMat);
  leftBorder.position.set(-TABLE_WIDTH / 2 - railThick / 2, railH / 2, 0);
  const rightBorder = leftBorder.clone();
  rightBorder.position.x = TABLE_WIDTH / 2 + railThick / 2;
  tableGroup.add(topBorder, botBorder, leftBorder, rightBorder);

  // 3. Discos negros visuales para las 6 troneras
  const pocketMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const pocketGeo = new THREE.CylinderGeometry(POCKET_RADIUS, POCKET_RADIUS, 0.02, 24);
  POCKETS.forEach((p) => {
    const hole = new THREE.Mesh(pocketGeo, pocketMat);
    hole.position.set(p.x, 0.01, p.z);
    tableGroup.add(hole);
  });

  // 4. Techo invisible para impedir que las bolas salten fuera
  const ceilingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_WIDTH + 2, 0.2, TABLE_DEPTH + 2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  createRigidBody(
    ceilingMesh,
    new Ammo.btBoxShape(new Ammo.btVector3((TABLE_WIDTH + 2) / 2, 0.1, (TABLE_DEPTH + 2) / 2)),
    0,
    new THREE.Vector3(0, 0.65, 0),
    null,
    { restitution: 0.3 }
  );
  tableGroup.add(ceilingMesh);

  scene.add(tableGroup);
}