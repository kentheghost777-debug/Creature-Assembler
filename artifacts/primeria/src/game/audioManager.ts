// Singleton audio manager for Primeria.
// Module-level state survives React re-renders/unmounts.

let bgAudio: HTMLAudioElement | null = null;
let bgSrc = "";
let bgTargetVol = 0.36;
let jingleAudio: HTMLAudioElement | null = null;

const FADE_STEPS = 14;
const FADE_MS    = 38;

function fadeTo(audio: HTMLAudioElement, target: number, onDone?: () => void) {
  const start = audio.volume;
  const diff  = target - start;
  let   step  = 0;
  const iv = window.setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, start + diff * (step / FADE_STEPS)));
    if (step >= FADE_STEPS) { window.clearInterval(iv); onDone?.(); }
  }, FADE_MS);
}

export const BGM_VOL    = 0.36;
export const JINGLE_VOL = 0.54;

/** Play a looping background track. No-ops if already playing the same src. */
export function playTrack(src: string, vol: number = BGM_VOL): void {
  if (bgSrc === src && bgAudio && !bgAudio.paused) return;
  bgTargetVol = vol;
  if (bgAudio) {
    const old = bgAudio;
    bgAudio = null;
    bgSrc   = "";
    fadeTo(old, 0, () => old.pause());
  }
  bgSrc = src;
  const a = new Audio(src);
  a.loop   = true;
  a.volume = 0;
  bgAudio  = a;
  a.play().catch(() => {
    // Autoplay blocked (no user gesture yet) — silently retry on next call
    bgAudio = null;
    bgSrc   = "";
  });
  fadeTo(a, vol);
}

function pauseBg(): void {
  if (bgAudio && !bgAudio.paused) {
    fadeTo(bgAudio, 0, () => bgAudio?.pause());
  }
}

function resumeBg(): void {
  if (bgAudio?.paused) {
    bgAudio.play().catch(() => {});
    fadeTo(bgAudio, bgTargetVol);
  }
}

/** Play a one-shot jingle. Fades background down while it plays, resumes after. */
export function playJingle(src: string, vol: number = JINGLE_VOL): void {
  if (jingleAudio) { jingleAudio.pause(); jingleAudio = null; }
  pauseBg();
  const j   = new Audio(src);
  j.volume  = vol;
  jingleAudio = j;
  j.play().catch(() => { jingleAudio = null; resumeBg(); });
  j.addEventListener("ended", () => { jingleAudio = null; resumeBg(); }, { once: true });
}

/** Fade out and stop everything. */
export function stopAll(): void {
  if (bgAudio) {
    const a = bgAudio; bgAudio = null; bgSrc = "";
    fadeTo(a, 0, () => a.pause());
  }
  if (jingleAudio) { jingleAudio.pause(); jingleAudio = null; }
}

// ── Web Audio SFX (synthesized — no audio files needed) ─────────────────────
let _ctx: AudioContext | null = null;
function _ac(): AudioContext | null {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

export type SfxName =
  | "btn" | "menu_open" | "door_in" | "door_out"
  | "battle_send" | "battle_swap"
  | "shell_throw" | "shell_wobble" | "shell_catch" | "shell_fail"
  | "hit" | "miss" | "faint" | "level_up" | "xp_tick";

/** Play a synthesised one-shot sound effect (Web Audio API, no files). */
export function playSfx(name: SfxName, vol = 1): void {
  const _c = _ac();
  if (!_c) return;
  const ctx: AudioContext = _c;
  const t      = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, vol)) * 0.55;
  master.connect(ctx.destination);

  /** Sine oscillator that optionally sweeps frequency. */
  function osc(f0: number, f1: number, startSec: number, dur: number, amp = 0.18) {
    const o  = ctx.createOscillator();
    const gn = ctx.createGain();
    o.connect(gn); gn.connect(master);
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t + startSec);
    if (f1 !== f0)
      o.frequency.exponentialRampToValueAtTime(Math.max(0.01, f1), t + startSec + dur);
    gn.gain.setValueAtTime(amp, t + startSec);
    gn.gain.exponentialRampToValueAtTime(0.001, t + startSec + dur);
    o.start(t + startSec);
    o.stop(t + startSec + dur + 0.02);
  }

  /** Bandpass-filtered white-noise burst. */
  function nz(startSec: number, dur: number, fq: number, q = 1.0, amp = 0.18) {
    const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = "bandpass"; flt.frequency.value = fq; flt.Q.value = q;
    const gn  = ctx.createGain();
    src.connect(flt); flt.connect(gn); gn.connect(master);
    gn.gain.setValueAtTime(amp, t + startSec);
    gn.gain.exponentialRampToValueAtTime(0.001, t + startSec + dur);
    src.start(t + startSec);
    src.stop(t + startSec + dur + 0.02);
  }

  switch (name) {
    case "btn":
      osc(1200, 1050, 0, 0.028, 0.15);
      break;
    case "menu_open":
      osc(350, 680, 0, 0.06, 0.12);
      break;
    case "door_in":
      nz(0, 0.22, 700, 0.5, 0.20);
      osc(180, 480, 0, 0.22, 0.10);
      break;
    case "door_out":
      nz(0, 0.20, 700, 0.5, 0.20);
      osc(480, 180, 0, 0.20, 0.10);
      break;
    case "battle_send":
      osc(200, 560, 0, 0.26, 0.17);
      nz(0.04, 0.18, 500, 0.8, 0.14);
      break;
    case "battle_swap":
      nz(0, 0.15, 450, 1.2, 0.19);
      osc(350, 580, 0, 0.13, 0.11);
      break;
    case "shell_throw":
      osc(640, 320, 0, 0.20, 0.16);
      nz(0.17, 0.07, 200, 1.0, 0.12);
      break;
    case "shell_wobble":
      nz(0, 0.050, 1100, 3.0, 0.24);
      break;
    case "shell_catch":
      osc(880,  880,  0.00, 0.06, 0.19);
      osc(1320, 1320, 0.03, 0.12, 0.13);
      osc(1760, 1760, 0.07, 0.11, 0.09);
      break;
    case "shell_fail":
      nz(0, 0.065, 800, 1.0, 0.26);
      osc(370, 90, 0.04, 0.20, 0.16);
      break;
    case "hit":
      nz(0, 0.042, 280, 1.5, 0.32);
      osc(90, 50, 0, 0.075, 0.22);
      break;
    case "miss":
      nz(0, 0.25, 380, 0.4, 0.11);
      break;
    case "faint":
      osc(400, 240, 0.00, 0.18, 0.16);
      osc(240, 140, 0.15, 0.22, 0.13);
      osc(140, 70,  0.32, 0.24, 0.10);
      break;
    case "level_up":
      osc(523,  523,  0.00, 0.08, 0.18); // C5
      osc(659,  659,  0.10, 0.08, 0.18); // E5
      osc(784,  784,  0.20, 0.08, 0.18); // G5
      osc(1047, 1047, 0.30, 0.15, 0.21); // C6
      break;
    case "xp_tick":
      osc(1046, 1046, 0, 0.028, 0.09);
      break;
  }
}
