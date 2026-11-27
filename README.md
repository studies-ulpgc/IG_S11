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
   - [3.1. Intro, Mecánicas de Tiro y Raycasting](#31-intro-mec%C3%A1nicas-de-tiro-y-raycasting)
   - [3.2. Sistema de Audio, Cámaras y Menú de Pausa](#32-sistema-de-audio-c%C3%A1maras-y-men%C3%BA-de-pausa)
   - [3.3. Modos de Juego: Práctica, 1 vs 1 Local y Vs Bot](#33-modos-de-juego-pr%C3%A1ctica-1-vs-1-local-y-vs-bot)
   - [3.4. Reglas Oficiales de Bola 8 y Detección de Faltas](#34-reglas-oficiales-de-bola-8-y-detecci%C3%B3n-de-faltas)
   - [3.5. Finales de Partida (Victoria con Confeti y Derrota)](#35-finales-de-partida-victoria-con-confeti-y-derrota)
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
| **Interfaz y Audio** | HUD Wii Sports, Banners, Pausa y Web Audio API | Interfaz HTML/CSS superpuesta y sintetizador procedural de golpes, troneras, música de intro y aplausos. |

---

## 3. Demostraciones en Vídeo y Funcionalidades

En esta sección se presentan los vídeos demostrativos de la aplicación divididos por bloques funcionales, comenzando por una presentación general de la pantalla de inicio y las mecánicas básicas de juego, seguida de demostraciones específicas del audio, cámaras, modos de juego, reglas y desenlaces.

> **Nota sobre el audio:** Todos los vídeos incluyen sonido generado en tiempo real mediante **Web Audio API** (música de presentación, impacto del taco, choque entre bolas, caída en tronera, aplausos, lamentos y música de victoria).

---

### 3.1. Intro, Mecánicas de Tiro y Raycasting

Presentación de la pantalla inicial estilo *Wii Sports* y demostración detallada de cómo apuntar, regular la potencia, utilizar la línea predictiva y acelerar el juego en tiempo real.

> [!NOTE]
> **Vídeo con audio:** Incluye la melodía de presentación estilo *Wii Sports*, el golpe del taco y colisiones múltiples con volumen proporcional a la fuerza del impacto.

> [!IMPORTANT]
> **Velocidad 100 % en tiempo real (sin edición de vídeo):** Ninguna de las aceleraciones que se observan en este ni en el resto de vídeos ha sido aplicada con un editor externo. Todas corresponden a mecánicas nativas del juego al mantener pulsadas las teclas **`Shift`** (giro rápido de apuntado) y **`Enter`** (modo Turbo, que multiplica la velocidad de simulación física y movimiento).

https://github.com/user-attachments/assets/af7908a5-47be-48ff-ab91-fc602a98efe0

<div align="center">
  <sub><a href="./readme_media/demos/01_intro_mecanicas.mp4">Descargar vídeo MP4</a></sub>
</div>

**Funcionalidades mostradas:**
- **Pantalla de inicio estilo *Wii Sports*:** Cámara orbital continua alrededor de la mesa con fondo difuminado y guía rápida de controles (`?`).
- **Apuntado y control de potencia:** Giro fino (`←`/`→`), giro rápido (`Shift`), carga progresiva (`Espacio`), reducción de potencia (`↓`) y modo Turbo (`Enter`).
- **Línea predictiva (`THREE.Raycaster`):** Proyección en tiempo real del punto de impacto contra la primera bola o banda y dirección estimada de rebote.

---

### 3.2. Sistema de Audio, Cámaras y Menú de Pausa

Demostración del gestor de sonido en tres niveles, la transición entre las tres perspectivas de cámara y las opciones de pausa de la partida.

> [!NOTE]
> **Vídeo con audio:** Muestra en directo el cambio entre los modos *Audiencia*, *Solo Mesa* y *Silencio*.

https://github.com/user-attachments/assets/30f61603-ff22-4f2f-9895-92b2af7126b2

<div align="center">
  <sub><a href="./readme_media/demos/02_audio_camaras_menu.mp4">Descargar vídeo MP4</a></sub>
</div>

**Funcionalidades mostradas:**
- **Conmutador de audio de 3 estados:** *Audiencia* (música, público que te aplaude o lamenta dependiendo de si aciertas o fallas, y efectos de mesa), *Solo Mesa* (únicamente impactos y troneras) y *Silencio*.
- **Tres vistas de cámara:** Vista Tiro con seguimiento automático (`1`), Vista Cenital 2D con rotación Horizontal/Vertical (`2` y botón `↻ H/V`) y Vista Libre 3D orbital (`3`).
- **Menú de pausa (`Esc`):** Congelación de la simulación para reanudar la partida, reiniciar la mesa o regresar al menú principal (además del botón de rendición `🏳️`).

---

### 3.3. Modos de Juego: Práctica, 1 vs 1 Local y Vs Bot

Comparativa práctica entre las tres modalidades disponibles en el selector inicial y sus herramientas exclusivas.

> [!NOTE]
> **Vídeo con audio:** Incluye efectos de interfaz, sonidos de tiro y reacciones del público durante los turnos.

https://github.com/user-attachments/assets/7f24193f-b5c0-4e4b-a363-029f2649c858

<div align="center">
  <sub><a href="./readme_media/demos/03_modos_juego.mp4">Descargar vídeo MP4</a></sub>
</div>

**Diferencias entre los modos mostrados:**
- **Modo Práctica (Entrenamiento libre):** Sin turnos ni faltas por grupo; permite embocar todas las bolas libremente (las 16), con el marcador indicando el progreso sobre **14** (`Metidas: X / 14`), ya que si caen la **bola blanca** o la **bola 8**, ambas se regeneran automáticamente en un punto libre de la mesa para seguir entrenando. Además, incluye el botón exclusivo de **rebobinado de tiro (`⏪`)** para restaurar las posiciones y velocidades exactas de las 16 bolas antes del último golpe.
- **1 vs 1 Local (Multijugador):** Partida por turnos alternos entre Jugador 1 y Jugador 2 en el mismo equipo, aplicando el reglamento completo de Bola 8 y el desplegable de bolas embocadas.
- **Vs Bot (3 niveles de dificultad):** Enfrentamiento individual contra una inteligencia artificial (*Fácil*, *Medio* o *Difícil*) que calcula el punto de impacto (*ghost ball*), evalúa trayectorias libres de obstáculos hacia las troneras y aplica un margen de error angular según la dificultad elegida.

---

### 3.4. Reglas Oficiales de Bola 8 y Detección de Faltas

Muestra la lógica arbitral de Bola 8 (asignación de grupos, banners animados, detección del primer toque y bola en mano tras falta).

> [!NOTE]
> **Vídeo con audio:** Incluye aplausos al asignar grupo o encadenar jugadas legales y sonido de lamento (*aww*) al cometer falta.

https://github.com/user-attachments/assets/18569546-fc79-4ca6-bbca-9d9d713285f0

<div align="center">
  <sub><a href="./readme_media/demos/04_reglas_faltas.mp4">Descargar vídeo MP4</a></sub>
</div>

**Funcionalidades mostradas:**
- **Asignación de grupo y banners:** Carteles animados estilo *Wii Sports* al asignar Lisas (1–7) o Rayadas (9–15) tras abrir la mesa.
- **Detección física de faltas:** Validación mediante *manifolds* de Ammo.js y control arbitral de las distintas infracciones del reglamento (cediendo el turno con reposición automática en un punto libre de la mesa cuando corresponde):
  - **Embocar la bola blanca (*scratch*):** Caída de la bola blanca en cualquier tronera durante el tiro.
  - **Embocar una bola del rival:** Meter una bola perteneciente al grupo del oponente (incluso si también entra una propia).
  - **Primer contacto ilegal o sin impacto:** Golpear en primer lugar una bola del grupo contrario (o la Bola 8 antes de limpiar el grupo propio) o no tocar ninguna bola en todo el tiro.

---

### 3.5. Finales de Partida (Victoria con Confeti y Derrota)

Demostración de las secuencias cinemáticas de cierre de partida tanto al ganar como al perder por meter la Bola 8 antes de tiempo.

> [!NOTE]
> **Vídeo con audio:** Incluye fanfarria de victoria con aplausos y efecto de derrota.

https://github.com/user-attachments/assets/b86d597b-7891-4a0c-9c8a-7b8e68dd435e

<div align="center">
  <sub><a href="./readme_media/demos/05_finales_partida.mp4">Descargar vídeo MP4</a></sub>
</div>

**Funcionalidades mostradas:**
- **Secuencia de victoria:** Lluvia de partículas de confeti 3D, órbita automática de cámara y cartel de triunfo (tanto al meter la 8 legalmente como si el Bot la mete antes de tiempo o el rival se rinde).
- **Secuencia de derrota:** Onda expansiva roja en la tronera, sacudida de cámara y cartel de fin de partida al embocar la Bola 8 de forma prematura (o si el Bot gana la partida).

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

<pre><b>IG_S11/</b>
├── <a href="./readme_media/">readme_media/</a>                 # Recursos multimedia de la documentación
│   ├── <a href="./readme_media/assets/">assets/</a>                   # Logotipo institucional ULPGC
│   └── <a href="./readme_media/demos/">demos/</a>                    # Vídeos demostrativos en formato MP4
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

- **Integración de Ammo.js, lógica de reglas Bola 8, IA del Bot, audio procedural y pulido visual:** [Consulta sobre unos errores puntuales](https://share.gemini.google/MGVGNVuufcLv)
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
