let audioCtx = null;
export let isMuted = false;

function ensureContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

export function toggleMute() {
  isMuted = !isMuted;
  return isMuted;
}

// Golpe del taco sobre la blanca
export function playCueHitSound(power = 0.5) {
  if (isMuted) return;
  ensureContext();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(160 + power * 90, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.08);

  gain.gain.setValueAtTime(Math.min(0.6, 0.15 + power * 0.45), audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.09);
}

// Choque entre bolas (volumen según velocidad relativa)
export function playBallCollisionSound(intensity = 0.5) {
  if (isMuted || intensity < 0.05) return;
  ensureContext();

  const vol = Math.min(0.7, intensity * 0.55);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(950 + Math.random() * 180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(280, audioCtx.currentTime + 0.045);

  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.045);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

// Caída en tronera
export function playPocketSound() {
  if (isMuted) return;
  ensureContext();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(52, audioCtx.currentTime + 0.22);

  gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.24);
}