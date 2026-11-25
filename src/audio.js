import * as THREE from "three";

import introUrl from "./sounds/intro.mp3";
import applauseUrl from "./sounds/applause.mp3";
import awwUrl from "./sounds/aww.mp3";
import winUrl from "./sounds/win.mp3";

export let soundMode = "show";

let listener = null;
let bgMusic = null;
let audioContext = null;
let audioUnlocked = false;
let introRequested = false;
let introBuffer = null;
let victorySound = null;

const soundBuffers = Object.create(null);

const SOUND_FILES = {
  intro: introUrl,
  applause: applauseUrl,
  aww: awwUrl,
  win: winUrl,
};

function unlockAudio() {
  if (!audioContext) return;

  audioUnlocked = true;

  if (audioContext.state === "suspended") {
    audioContext.resume()
      .then(() => {
        if (introRequested) playIntroIfReady();
      })
      .catch((error) => {
        console.warn("No se pudo activar el audio:", error);
      });
  } else if (introRequested) {
    playIntroIfReady();
  }
}

function playIntroIfReady() {
  if (
    !audioUnlocked ||
    soundMode !== "show" ||
    !bgMusic ||
    !introBuffer ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return;
  }

  if (!bgMusic.isPlaying) {
    bgMusic.setBuffer(introBuffer);
    bgMusic.setLoop(true);
    bgMusic.setVolume(0.35);
    bgMusic.play();
  }
}

export function initAudioSystem(camera) {
  if (listener) return;

  listener = new THREE.AudioListener();
  camera.add(listener);

  audioContext = listener.context;
  bgMusic = new THREE.Audio(listener);

  document.addEventListener("pointerdown", unlockAudio, true);
  document.addEventListener("keydown", unlockAudio, true);
  document.addEventListener("touchend", unlockAudio, true);

  const loader = new THREE.AudioLoader();

  Object.entries(SOUND_FILES).forEach(([key, url]) => {
    loader.load(
      url,
      (buffer) => {
        soundBuffers[key] = buffer;

        if (key === "intro") {
          introBuffer = buffer;
          playIntroIfReady();
        }
      },
      undefined,
      (error) => {
        console.error(
          `No se pudo cargar el sonido "${key}" (${url}).`,
          error
        );
      }
    );
  });
}

export function cycleSoundMode() {
  if (soundMode === "show") {
    soundMode = "table";
  } else if (soundMode === "table") {
    soundMode = "mute";
  } else {
    soundMode = "show";
  }

  if (soundMode !== "show") {
    stopIntroMusic(0.35);
  }

  return soundMode;
}

export function startIntroMusic() {
  introRequested = true;
  playIntroIfReady();
}

function fadeOutSound(sound, duration = 0.8) {
  if (!sound || !sound.isPlaying) return;

  const ctx = sound.context || audioContext;
  if (!ctx) {
    sound.stop();
    return;
  }

  const startVolume = typeof sound.getVolume === "function"
    ? sound.getVolume()
    : 0.35;
  const startedAt = ctx.currentTime;
  const endAt = startedAt + duration;

  if (sound.gain) {
    sound.gain.gain.cancelScheduledValues(startedAt);
    sound.gain.gain.setValueAtTime(Math.max(startVolume, 0.001), startedAt);
    sound.gain.gain.exponentialRampToValueAtTime(0.001, endAt);
  }

  window.setTimeout(() => {
    if (sound.isPlaying) sound.stop();
  }, duration * 1000 + 40);
}

export function stopIntroMusic(duration = 0.9) {
  introRequested = false;

  if (bgMusic && bgMusic.isPlaying) {
    if (duration <= 0) {
      bgMusic.stop();
    } else {
      fadeOutSound(bgMusic, duration);
    }
  }
}

function playBufferIfAvailable(key, volume = 0.7) {
  if (
    !listener ||
    !audioUnlocked ||
    !soundBuffers[key] ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return false;
  }

  const sound = new THREE.Audio(listener);
  sound.setBuffer(soundBuffers[key]);
  sound.setVolume(volume);
  sound.play();

  if (key === "win") {
    victorySound = sound;
  }

  return true;
}

function getReadyContext() {
  if (
    !audioUnlocked ||
    !audioContext ||
    audioContext.state !== "running"
  ) {
    return null;
  }

  return audioContext;
}

export function playCueHitSound(power = 0.5) {
  if (soundMode === "mute") return;

  const ctx = getReadyContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(
    160 + power * 90,
    ctx.currentTime
  );
  osc.frequency.exponentialRampToValueAtTime(
    45,
    ctx.currentTime + 0.08
  );

  gain.gain.setValueAtTime(
    Math.min(0.6, 0.15 + power * 0.45),
    ctx.currentTime
  );
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.08
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.09);
}

export function playBallCollisionSound(intensity = 0.5) {
  if (soundMode === "mute" || intensity < 0.05) return;

  const ctx = getReadyContext();
  if (!ctx) return;

  const volume = Math.min(0.7, intensity * 0.55);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(
    950 + Math.random() * 180,
    ctx.currentTime
  );
  osc.frequency.exponentialRampToValueAtTime(
    280,
    ctx.currentTime + 0.045
  );

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.045
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playPocketSound() {
  if (soundMode === "mute") return;

  const ctx = getReadyContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(140, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    52,
    ctx.currentTime + 0.22
  );

  gain.gain.setValueAtTime(0.45, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + 0.22
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.24);
}

export function playApplauseSound() {
  if (soundMode !== "show") return;

  if (playBufferIfAvailable("applause", 0.65)) {
    return;
  }

  const ctx = getReadyContext();
  if (!ctx) return;

  const duration = 1.4;
  const bufferSize = Math.floor(ctx.sampleRate * duration);

  const noiseBuffer = ctx.createBuffer(
    1,
    bufferSize,
    ctx.sampleRate
  );

  const output = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const envelope = Math.sin(
      (i / bufferSize) * Math.PI
    );

    output[i] =
      (Math.random() * 2 - 1) *
      envelope *
      (0.6 + 0.4 * Math.sin(i * 0.004));
  }

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1100;
  filter.Q.value = 0.7;

  const gain = ctx.createGain();

  gain.gain.setValueAtTime(0.28, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.01,
    ctx.currentTime + duration
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start();
}

export function playAwwSound() {
  if (soundMode !== "show") return;

  if (victorySound && victorySound.isPlaying) {
    fadeOutSound(victorySound, 0.75);
  }

  if (playBufferIfAvailable("aww", 0.6)) {
    return;
  }

  const ctx = getReadyContext();
  if (!ctx) return;

  const frequencies = [330, 277, 220];

  frequencies.forEach((frequency) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";

    osc.frequency.setValueAtTime(
      frequency,
      ctx.currentTime
    );

    osc.frequency.linearRampToValueAtTime(
      frequency * 0.74,
      ctx.currentTime + 0.75
    );

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.8
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.82);
  });
}

export function playVictoryFanfare() {
  if (soundMode !== "show") return;

  if (playBufferIfAvailable("win", 0.8)) {
    return;
  }

  const ctx = getReadyContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startTime =
      ctx.currentTime + index * 0.11;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(
      frequency,
      startTime
    );

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + 0.55
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.58);
  });
}