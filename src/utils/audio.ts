// Synthetic sound effects using Web Audio API for high-fidelity offline system notifications

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a pleasant, rising chime sound representing a connection / join action.
 */
export function playJoinSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Create nodes
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc1.type = "sine";
  osc2.type = "triangle";

  // Setup gain envelope to prevent clicking
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
  gainNode.gain.setValueAtTime(0.12, now + 0.22);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  // Frequencies corresponding to C5 -> E5 -> G5
  osc1.frequency.setValueAtTime(523.25, now); // C5
  osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
  osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5

  // Slightly offset second oscillator for warmth
  osc2.frequency.setValueAtTime(525.25, now);
  osc2.frequency.setValueAtTime(661.25, now + 0.08);
  osc2.frequency.setValueAtTime(785.99, now + 0.16);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);

  osc1.stop(now + 0.5);
  osc2.stop(now + 0.5);
}

/**
 * Plays a descending chime sound representing a disconnection / leave action.
 */
export function playLeaveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Create nodes
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = "sine";

  // Setup gain envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.15, now + 0.03);
  gainNode.gain.setValueAtTime(0.15, now + 0.18);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  // G5 -> E5 -> C5
  osc.frequency.setValueAtTime(783.99, now); // G5
  osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
  osc.frequency.setValueAtTime(523.25, now + 0.12); // C5

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.4);
}
