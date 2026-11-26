<div align="center">

<img src="readme_media/assets/ulpgc.png" alt="Escudo ULPGC" width="160" />

### UNIVERSIDAD DE LAS PALMAS DE GRAN CANARIA
**Grado en Ingeniería Informática — Asignatura: Informática Gráfica**  
*Curso Académico 2026/2027*

---

<h1 style="color: #0284c7; font-size: 2.2rem; font-weight: bold; letter-spacing: 3px; text-shadow: 0 0 12px rgba(14, 165, 233, 0.35);">
  BILLAR 3D INTERACTIVO
</h1>

<h3 style="color: #0ea5e9; font-size: 1.1rem; letter-spacing: 2px;">
  Desarrollado por: <a href="https://github.com/studies-ulpgc" style="color: #0ea5e9; text-decoration: none; font-weight: bold;">Dácil Santana Ortega</a>
</h3>

![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D-0ea5e9?style=flat-square&logo=three.js)
![Ammo.js](https://img.shields.io/badge/Ammo.js-Bullet_Physics-ef4444?style=flat-square)
![Tween.js](https://img.shields.io/badge/Tween.js-Animaciones-f59e0b?style=flat-square)
![Estado](https://img.shields.io/badge/Estado-Completado_100%25-brightgreen?style=flat-square)

</div>

---

## Índice de Contenidos

1. [Resumen del Proyecto](#1-resumen-del-proyecto)
2. [Componentes de la Escena y Motor Físico](#2-componentes-de-la-escena-y-motor-f%C3%ADsico)
3. [Demostraciones en Vídeo y Funcionalidades](#3-demostraciones-en-v%C3%ADdeo-y-funcionalidades)
   - [3.1. Demo General: Menú Wii Sports, Cámaras y Partida Completa](#31-demo-general-men%C3%BA-wii-sports-c%C3%A1maras-y-partida-completa)
   - [3.2. Mini Demo: Controles de Tiro, Potencia y Raycasting](#32-mini-demo-controles-de-tiro-potencia-y-raycasting)
   - [3.3. Mini Demo: Reglas de Bola 8, Faltas y Rebobinado](#33-mini-demo-reglas-de-bola-8-faltas-y-rebobinado)
   - [3.4. Mini Demo: Finales de Partida (Victoria con Confeti y Derrota)](#34-mini-demo-finales-de-partida-victoria-con-confeti-y-derrota)
4. [Análisis Técnico: Física Rígida, Texturas Procedurales y Audio](#4-an%C3%A1lisis-t%C3%A9cnico-f%C3%ADsica-r%C3%ADgida-texturas-procedurales-y-audio)
5. [Arquitectura del Proyecto y Comparativa Académica](#5-arquitectura-del-proyecto-y-comparativa-acad%C3%A9mica)
6. [Bibliografía, Fuentes y Colaboradores](#6-bibliograf%C3%ADa-fuentes-y-colaboradores)

---

## 1. Resumen del Proyecto

El presente proyecto consiste en el desarrollo de un **simulador tridimensional de billar americano (Bola 8)** en tiempo real con estética inspirada en *Wii Sports*, implementado en **Three.js** junto con el motor de física rígida **Ammo.js** (compilación WebAssembly/JS de *Bullet Physics*) y **Tween.js** para interpolaciones cinemáticas.

La aplicación integra simulación física de cuerpos rígidos con fricción de rodadura y restitución elástica, detección real de contactos mediante *manifolds*, texturas procedurales generadas dinámicamente en `<canvas>`, tres modos de juego (**Práctica libre con rebobinado**, **1 vs 1 Local** y **Vs Bot IA** con tres niveles de dificultad), sistema de cámaras interactivas y síntesis de audio en tiempo real mediante **Web Audio API**.

- **Entorno CodeSandbox del Proyecto:** [Probar Proyecto en Sandbox](https://codesandbox.io/p/sandbox/github/studies-ulpgc/IG_S11)

---

## 2. Componentes de la Escena y Motor Físico

En la siguiente tabla se detallan los elementos tridimensionales, físicos y de interfaz que conforman la aplicación:

| Categoría | Elementos | Detalles Técnicos y Configuración |
| :--- | :--- | :--- |
| **Mesa de Billar** | Tapete, 6 bandas, marco de madera y 6 troneras | Geometrías `BoxGeometry` con materiales `MeshStandardMaterial` y colisionadores estáticos (`mass = 0`) en **Ammo.js** con restitución `0.85`. |
| **Juego de 16 Bolas** | Blanca (0), Lisas (1–7), Negra (8) y Rayadas (9–15) | Esferas (`SphereGeometry`) con texturas procedurales `<canvas>` y cuerpos rígidos dinámicos (`mass = 0.17`, `rollingFriction = 0.03`, `damping`). |
| **Taco y Guía de Tiro** | Taco bicónico, barra 3D de potencia y línea predictiva | Geometrías jerárquicas (`THREE.Group`) vinculadas a la bola blanca con cálculo de impacto mediante `THREE.Raycaster`. |
| **Cámaras** | Vista Tiro (1), Cenital 2D H/V (2) y Libre 3D (3) | Transiciones interpoladas con **Tween.js**, seguimiento dinámico en disparo y control orbital/panorámico con `OrbitControls`. |
| **Iluminación y Sombras** | Luz ambiental y foco cenital direccional | `AmbientLight` + `DirectionalLight` con mapa de sombras (`2048×2048`) proyectadas sobre el tapete y las bandas. |
| **Interfaz y Audio** | HUD Wii Sports, Banners, Pausa y Web Audio API | Interfaz HTML/CSS superpuesta y sintetizador procedural de golpes, troneras, música de intro, aplausos y fanfarria. |

---

## 3. Demostraciones en Vídeo y Funcionalidades

En esta sección se presenta una **demostración general** del funcionamiento global de la aplicación seguida de **mini demos** centradas en mecánicas específicas.

> **Nota sobre el audio:** Todos los vídeos incluyen sonido generado en tiempo real mediante **Web Audio API** (música de presentación, impacto del taco, choque entre bolas, caída en tronera, aplausos, lamentos y fanfarria de victoria).

---

### 3.1. Demo General: Menú Wii Sports, Cámaras y Partida Completa

Recorrido general por la aplicación desde la pantalla de inicio hasta el desarrollo de una partida contra la IA, mostrando la interfaz, la pausa y las distintas vistas de cámara.

> [!NOTE]
> **Vídeo con audio:** Incluye la melodía de presentación estilo *Wii Sports*, efectos de interfaz, sonidos de mesa y ambiente de público.

<!-- PEGAR AQUÍ ENLACE DE LA DEMO GENERAL EN GITHUB -->
https://github.com/user-attachments/assets/REEMPLAZAR_DEMO_GENERAL

<div align="center">
  <sub><a href="./readme_media/demos/01_demo_general.mp4">Descargar vídeo MP4</a> · <a href="./readme_media/shorts/01_demo_general.gif">Ver versión GIF</a></sub>
</div>

**Funcionalidades mostradas:**
- **Pantalla de inicio y modos:** Cámara orbital sobre la mesa, selección entre *Práctica*, *1 vs 1 Local* y *Vs Bot* (*Fácil*, *Medio*, *Difícil*).
- **Control de audio y pausa:** Conmutador de sonido en 3 estados (*Audiencia*, *Solo Mesa*, *Silencio*) y menú de pausa (`Esc`), donde se puede reanudar, reiniciar o abandonar partida (también se puede abandonar partida mediante el botón de rendirse).
- **Tres vistas de cámara:** Vista Tiro (`1`), Cenital 2D con rotación Horizontal/Vertical (`2`) y Vista Libre 3D (`3`).

---

### 3.2. Mini Demo: Controles de Tiro, Potencia y Raycasting

Demostración detallada del sistema de apuntado, la barra de potencia y la línea predictiva calculada por proyección de rayos.

> [!NOTE]
> **Vídeo con audio:** Incluye el golpe del taco y colisiones múltiples con volumen proporcional a la fuerza del impacto.

<!-- PEGAR AQUÍ ENLACE DE MINI DEMO 1 -->
https://github.com/user-attachments/assets/REEMPLAZAR_MINI_DEMO_1

<div align="center">
  <sub><a href="./readme_media/demos/02_controles_raycast.mp4">Descargar vídeo MP4</a> · <a href="./readme_media/shorts/02_controles_raycast.gif">Ver versión GIF</a></sub>
</div>

**Funcionalidades mostradas:**
- **Apuntado y control de fuerza:** Giro preciso (`←`/`→` + `Shift`), carga progresiva (`Espacio`), reducción de potencia (`↓`) y modo Turbo (`Enter`).
- **Línea predictiva (`THREE.Raycaster`):** Cálculo en tiempo real del punto de choque con la primera bola o banda y dirección estimada de rebote.

---

### 3.3. Mini Demo: Reglas de Bola 8, Faltas y Rebobinado

Muestra la lógica arbitral de Bola 8 (asignación de grupos, detección de faltas y bola en mano) junto con la herramienta de rebobinado del modo Práctica.

> [!NOTE]
> **Vídeo con audio:** Incluye aplausos al encadenar jugadas legales y sonido de lamento (*aww*) al cometer falta.

<!-- PEGAR AQUÍ ENLACE DE MINI DEMO 2 -->
https://github.com/user-attachments/assets/REEMPLAZAR_MINI_DEMO_2

<div align="center">
  <sub><a href="./readme_media/demos/03_reglas_rebobinado.mp4">Descargar vídeo MP4</a> · <a href="./readme_media/shorts/03_reglas_rebobinado.gif">Ver versión GIF</a></sub>
</div>

**Funcionalidades mostradas:**
- **Asignación de grupo y banners:** Carteles animados estilo *Wii Sports* al asignar Lisas (1–7) o Rayadas (9–15).
- **Detección física de faltas:** Validación mediante *manifolds* de Ammo.js del primer toque de la blanca y reposición automática tras falta.
- **Rebobinado de tiro (`⏪`):** Restauración completa de posiciones y estado de las 16 bolas en el modo Práctica.

---

### 3.4. Mini Demo: Finales de Partida (Victoria con Confeti y Derrota)

Demostración de las secuencias cinemáticas de cierre de partida tanto al ganar como al perder por meter la Bola 8 antes de tiempo.

> [!NOTE]
> **Vídeo con audio:** Incluye fanfarria de victoria con aplausos y efecto de derrota.

<!-- PEGAR AQUÍ ENLACE DE MINI DEMO 3 -->
https://github.com/user-attachments/assets/REEMPLAZAR_MINI_DEMO_3

<div align="center">
  <sub><a href="./readme_media/demos/04_finales_partida.mp4">Descargar vídeo MP4</a> · <a href="./readme_media/shorts/04_finales_partida.gif">Ver versión GIF</a></sub>
</div>

**Funcionalidades mostradas:**
- **Secuencia de victoria:** Lluvia de partículas de confeti 3D, órbita automática de cámara y cartel de triunfo (tanto al meter la 8 legalmente como si el Bot la mete antes de tiempo, o si el rival se rinde).
- **Secuencia de derrota:** Onda expansiva roja en la tronera, sacudida de cámara y cartel de fin de partida al embocar la Bola 8 de forma prematura.

---

## 4. Análisis Técnico: Física Rígida, Texturas Procedurales y Audio

| Módulo Técnico | Archivo | Implementación en el Código |
| :--- | :--- | :--- |
| **Motor Físico Ammo.js y Manifolds** | [`physics.js`](./src/physics.js) | Simulación con sub-pasos (`stepSimulation`), fricción de rodadura (`setRollingFriction`) e inspección directa de `btPersistentManifold` para registrar con precisión la primera bola golpeada por la blanca. |
| **Texturas Procedurales en Canvas** | [`balls.js`](./src/balls.js) | Generación dinámica de una textura `THREE.CanvasTexture` de `512×256` por cada bola, dibujando franjas para las rayadas (9–15), círculos blancos y tipografía centrada sin archivos de imagen externos. |
| **Raycasting y Línea Predictiva** | [`cue.js`](./src/cue.js) | Proyección de un rayo (`THREE.Raycaster`) desde la bola blanca en dirección `aimAngle` para calcular la distancia exacta al primer obstáculo y dibujar la trayectoria y el rebote. |
| **Síntesis de Audio Web Audio API** | [`audio.js`](./src/audio.js) | Generación procedural de todos los efectos sonoros mediante osciladores, envolventes ADSR y ruido filtrado (choques con volumen dinámico, troneras, música de intro, aplausos y fanfarria). |

---

## 5. Arquitectura del Proyecto y Comparativa Académica

### 5.1. Estructura de Módulos y Organización de Archivos

<pre><b>IG_Semana_8/</b>
├── <a href="./readme_media/">readme_media/</a>                 # Recursos multimedia de la documentación
│   ├── <a href="./readme_media/assets/">assets/</a>                   # Logotipo institucional ULPGC
│   └── <a href="./readme_media/shorts/">shorts/</a>                   # Animaciones en formato GIF y MP4
├── <a href="./src/">src/</a>                          # Código fuente de la aplicación
│   ├── <a href="./src/audio.js">audio.js</a>                  # Sintetizador Web Audio API y gestor de 3 modos de sonido
│   ├── <a href="./src/balls.js">balls.js</a>                  # Creación de las 16 bolas, texturas procedurales y colocación en triángulo
│   ├── <a href="./src/bot.js">bot.js</a>                    # Inteligencia Artificial con 3 niveles de dificultad y detección de obstáculos
│   ├── <a href="./src/cue.js">cue.js</a>                    # Taco 3D, barra de potencia, disparo e indicador predictivo por Raycaster
│   ├── <a href="./src/main.js">main.js</a>                   # Escena Three.js, bucle principal, cámaras, HUD y efectos de victoria/derrota
│   ├── <a href="./src/physics.js">physics.js</a>                # Inicialización de Ammo.js, cuerpos rígidos y lectura de manifolds de contacto
│   ├── <a href="./src/rules.js">rules.js</a>                  # Máquina de estados, reglas oficiales de Bola 8 y sistema de snapshots
│   └── <a href="./src/table.js">table.js</a>                  # Construcción de la mesa, bandas, troneras y colisionadores estáticos
├── <a href="./index.html">index.html</a>                    # Estructura HTML de pantallas, HUD y carga de Ammo.js
├── <a href="./styles.css">styles.css</a>                    # Estilos visuales e interfaz inspirada en Wii Sports
├── <a href="./package.json">package.json</a>                  # Configuración del proyecto y dependencias (Three.js, Tween.js)
└── <a href="./README.md">README.md</a>                     # Documentación principal
</pre>

---

### 5.2. Correspondencia con los Scripts de Clase (Física y Animación)

Correspondencia técnica entre los ejemplos de clase ([`otsedom`](https://github.com/otsedom)) y su implementación en el proyecto:

| Concepto de Clase ([`otsedom`](https://github.com/otsedom)) | Descripción Base | Aplicación en el Proyecto |
| :--- | :--- | :--- |
| **Inicialización de Ammo.js** | Configuración de `btDiscreteDynamicsWorld`, gravedad y *dispatcher* de colisiones. | Implementado en [`physics.js`](./src/physics.js) (`initPhysics`) con paso de simulación estable y sub-pasos dinámicos. |
| **Cuerpos Rígidos Estáticos y Dinámicos** | Creación de `btRigidBody` con masa `0` (escenario) y masa `> 0` (objetos móviles). | Mesa y bandas estáticas en [`table.js`](./src/table.js); 16 esferas dinámicas con fricción de rodadura en [`balls.js`](./src/balls.js). |
| **Aplicación de Fuerzas e Impulsos** | Uso de `applyCentralImpulse` y lectura de transformaciones (`getMotionState`). | Disparo del taco en [`cue.js`](./src/cue.js) y sincronización física-visual en [`physics.js`](./src/physics.js). |
| **Detección de Colisiones (`Manifolds`)** | Inspección de pares de contacto en el *dispatcher* de Bullet/Ammo. | Implementado en `collectCueBallManifoldContacts()` ([`physics.js`](./src/physics.js)) para validar reglas de Bola 8. |
| **Interpolación con Tween.js** | Animaciones suaves de posición, escala y cámara sin bloquear el bucle `requestAnimationFrame`. | Caída de bolas en troneras, transiciones de cámara y banners elásticos en [`main.js`](./src/main.js). |
| **Raycasting y Cámaras Interactivas** | Proyección de rayos (`THREE.Raycaster`) y control con `OrbitControls`. | Línea predictiva de tiro en [`cue.js`](./src/cue.js) y modos de cámara en [`main.js`](./src/main.js). |

---

## 6. Bibliografía, Fuentes y Colaboradores

### 6.1. Bibliografía y Referencias Académicas

1. **Documentación Oficial de Three.js:** [https://threejs.org/docs/](https://threejs.org/docs/)
2. **Repositorio y Documentación de Ammo.js (Bullet Physics):** [https://github.com/kripken/ammo.js](https://github.com/kripken/ammo.js)
3. **Documentación de Tween.js:** [https://github.com/tweenjs/tween.js](https://github.com/tweenjs/tween.js)
4. **Repositorios del Profesor Modesto Castrillón ([`otsedom`](https://github.com/otsedom)):**
   - Perfil en GitHub: [https://github.com/otsedom](https://github.com/otsedom)

---

### 6.2. Declaración de Asistencia con Herramientas de Inteligencia Artificial

Se detallan ejemplos del uso de modelos de IA (**Google Gemini**) como asistente de soporte técnico durante el desarrollo del proyecto:

- **Integración de Ammo.js, lógica de reglas Bola 8, IA del Bot, audio procedural y pulido visual:** *(añadir aquí el enlace compartido de esta conversación de Gemini cuando lo generes)*
- **Asistencia técnica:** Depuración de *manifolds* de contacto en Ammo.js, resolución de *Z-fighting* en la geometría del taco, ajuste de cámaras con Tween.js y maquetación de la documentación.

---

### 6.3. Autora

<div align="center">

| Desarrolladora | Rol | Perfil |
| :--- | :--- | :---: |
| **Dácil Santana Ortega** | Autora Principal y Programación Three.js / Ammo.js | [![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/studies-ulpgc) |

---

*Proyecto desarrollado para la asignatura de **Informática Gráfica** — Grado en Ingeniería Informática (ULPGC).*  
*Bajo licencia [Creative Commons Reconocimiento - No Comercial 4.0 Internacional (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.es).*

</div>