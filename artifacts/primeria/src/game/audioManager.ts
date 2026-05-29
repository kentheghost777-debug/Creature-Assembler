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
