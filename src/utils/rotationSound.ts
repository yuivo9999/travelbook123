// Mechanical rotation sound synthesizer using Web Audio API
// Produces a realistic, tactile mechanical ratchet / dial click sound

let audioCtx: AudioContext | null = null;
let lastTickTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a crisp, tactile mechanical ratchet tick sound.
 * @param volume 0 - 200 (100 is standard 100% gain, 200 is 2x gain)
 * @param enabled whether sound is turned on
 */
export function playMechanicalTick(volume = 100, enabled = true): void {
  if (!enabled || volume <= 0) return;

  const now = performance.now();
  // Minimum 25ms interval between clicks to prevent sound clipping on super-fast spins
  if (now - lastTickTime < 25) return;
  lastTickTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const gainFactor = Math.min(2.0, Math.max(0, volume / 100)) * 0.35;

    // Master gain for this tick
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(gainFactor, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    masterGain.connect(ctx.destination);

    // Subtle pitch jitter (+/- 4%) so every gear tooth sounds slightly unique
    const jitter = 0.96 + Math.random() * 0.08;

    // 1. High-frequency metallic snap (camera dial / ratchet tooth collision)
    const oscHigh = ctx.createOscillator();
    const highGain = ctx.createGain();
    const filterHigh = ctx.createBiquadFilter();

    oscHigh.type = 'triangle';
    oscHigh.frequency.setValueAtTime(2400 * jitter, t);
    oscHigh.frequency.exponentialRampToValueAtTime(800 * jitter, t + 0.018);

    filterHigh.type = 'bandpass';
    filterHigh.frequency.setValueAtTime(3200 * jitter, t);
    filterHigh.Q.setValueAtTime(4.0, t);

    highGain.gain.setValueAtTime(0.8, t);
    highGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

    oscHigh.connect(filterHigh);
    filterHigh.connect(highGain);
    highGain.connect(masterGain);

    oscHigh.start(t);
    oscHigh.stop(t + 0.02);

    // 2. Low-frequency mechanical body resonance / tactile "thump"
    const oscLow = ctx.createOscillator();
    const lowGain = ctx.createGain();

    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(320 * jitter, t);
    oscLow.frequency.exponentialRampToValueAtTime(70 * jitter, t + 0.028);

    lowGain.gain.setValueAtTime(0.6, t);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

    oscLow.connect(lowGain);
    lowGain.connect(masterGain);

    oscLow.start(t);
    oscLow.stop(t + 0.03);
  } catch (err) {
    // AudioContext failure should fail silently
    console.debug('Failed to play mechanical tick sound', err);
  }
}
