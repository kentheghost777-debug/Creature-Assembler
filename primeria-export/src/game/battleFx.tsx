// ── Battle move FX ──────────────────────────────────────────────────────────
// Reusable, GPU-light animation layer for combat moves. Every effect is built
// from transform/opacity animations only (no layout thrash, no heavy blur
// stacks, capped particle counts) so it stays smooth on mobile and never
// re-triggers the lazy-asset memory pressure we fixed earlier.
//
// Damage moves: a motif-shaped projectile travels attacker → target, then a
// tinted impact bloom + element-specific particles. Utility moves: an aura on
// the caster (mend = green lift, sharpen = red surge, bulwark = blue shield).

import { type MoveAnim, type MoveCategory } from "./moves";

// Sprite anchor X positions (% of arena width) — match POS in BattleScene.
const PLAYER_X = 26;
const WILD_X   = 70;
const Y        = 52;

type Shape = "dot" | "shard" | "square" | "leaf" | "ring";

const MOTIF: Record<MoveAnim, { shape: Shape; rise: boolean; spin: boolean }> = {
  leaf:    { shape: "leaf",   rise: true,  spin: true  },
  ember:   { shape: "dot",    rise: true,  spin: false },
  splash:  { shape: "dot",    rise: false, spin: false },
  shard:   { shape: "shard",  rise: false, spin: false },
  bolt:    { shape: "shard",  rise: false, spin: false },
  rock:    { shape: "square", rise: false, spin: true  },
  gust:    { shape: "ring",   rise: false, spin: false },
  wisp:    { shape: "dot",    rise: true,  spin: false },
  glyph:   { shape: "ring",   rise: false, spin: true  },
  bubble:  { shape: "ring",   rise: true,  spin: false },
  void:    { shape: "dot",    rise: false, spin: false },
  plate:   { shape: "shard",  rise: false, spin: true  },
  glitch:  { shape: "square", rise: false, spin: false },
  // utility motifs handled separately
  mend:    { shape: "dot",    rise: true,  spin: false },
  sharpen: { shape: "shard",  rise: true,  spin: false },
  bulwark: { shape: "ring",   rise: false, spin: false },
};

function shapeStyle(shape: Shape, size: number, color: string): React.CSSProperties {
  const glow = `0 0 9px ${color}, 0 0 3px #fff`;
  switch (shape) {
    case "shard":
      return { width: size * 0.5, height: size * 1.5, borderRadius: 2, background: color, boxShadow: glow };
    case "square":
      return { width: size, height: size, borderRadius: 2, background: color, boxShadow: glow };
    case "leaf":
      return { width: size * 0.7, height: size * 1.3, borderRadius: "50% 0 50% 0", background: color, boxShadow: glow };
    case "ring":
      return { width: size, height: size, borderRadius: "50%", border: `2px solid ${color}`, boxShadow: glow };
    case "dot":
    default:
      return { width: size, height: size, borderRadius: "50%", background: color, boxShadow: glow };
  }
}

export function MoveFx({
  anim, color, from, category,
}: { anim: MoveAnim; color: string; from: "player" | "wild"; category: MoveCategory }) {
  // ── Utility moves: aura centered on the caster ──
  if (category !== "damage") {
    const x = from === "player" ? PLAYER_X : WILD_X;
    return (
      <div style={{ position: "absolute", left: `${x}%`, top: `${Y}%`, width: 0, height: 0, pointerEvents: "none", zIndex: 6 }}>
        {anim === "bulwark" ? (
          <>
            {[0, 1].map(i => (
              <div key={i} style={{
                position: "absolute", left: 0, top: 0,
                width: 86, height: 86, borderRadius: "50%",
                border: `3px solid ${color}`,
                boxShadow: `0 0 16px ${color}, inset 0 0 18px ${color}`,
                transform: "translate(-50%,-50%) scale(0.2)",
                animation: `mvShield 0.9s ease-out ${i * 0.12}s forwards`,
                mixBlendMode: "screen",
              }}/>
            ))}
          </>
        ) : (
          // mend (green-ish) / sharpen (red-ish surge) — rising motes
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${(i - 4) * 12}px`, top: 28,
              ...shapeStyle(anim === "sharpen" ? "shard" : "dot", 9, color),
              animation: `mvRise 0.95s ease-out ${i * 0.05}s both`,
            }}/>
          ))
        )}
      </div>
    );
  }

  // ── Damage moves: projectile travel + impact ──
  const srcX = from === "player" ? PLAYER_X : WILD_X;
  const tgtX = from === "player" ? WILD_X : PLAYER_X;
  const dx = `${tgtX - srcX}vw`;
  const m = MOTIF[anim] ?? MOTIF.ember;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
      {/* Traveling projectile (motif-tinted orb with a comet trail) */}
      <div style={{
        position: "absolute", left: `${srcX}%`, top: `${Y}%`,
        ["--dx" as string]: dx,
        transform: "translate(-50%,-50%)",
        animation: "mvTravel 0.4s cubic-bezier(.4,.1,.7,1) forwards",
      }}>
        <div style={{
          width: 30, height: 12, borderRadius: 8,
          background: `linear-gradient(90deg, transparent, ${color}, #fff)`,
          boxShadow: `0 0 16px ${color}, 0 0 6px #fff`,
          transform: from === "player" ? "none" : "scaleX(-1)",
          filter: "drop-shadow(0 0 4px #fff)",
        }}/>
      </div>

      {/* Impact bloom + scattered element particles at the target */}
      <div style={{ position: "absolute", left: `${tgtX}%`, top: `${Y}%`, width: 0, height: 0 }}>
        {/* Core flash */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: 78, height: 78, borderRadius: "50%",
          background: `radial-gradient(circle, #fff 0%, ${color} 34%, transparent 72%)`,
          transform: "translate(-50%,-50%) scale(0)",
          animation: "mvImpact 0.55s ease-out 0.34s forwards",
          mixBlendMode: "screen",
        }}/>
        {/* Expanding shock ring */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: 60, height: 60, borderRadius: "50%",
          border: `3px solid ${color}`,
          boxShadow: `0 0 14px ${color}`,
          transform: "translate(-50%,-50%) scale(0)",
          animation: "mvRing 0.6s ease-out 0.34s forwards",
          mixBlendMode: "screen",
        }}/>
        {/* Scattered motif particles */}
        {Array.from({ length: 9 }).map((_, i) => {
          const ang = i * 40;
          return (
            <div key={i} style={{
              position: "absolute", left: 0, top: 0,
              ...shapeStyle(m.shape, 8, color),
              ["--a" as string]: `${ang}deg`,
              ["--r" as string]: `${30 + (i % 3) * 12}px`,
              transform: `translate(-50%,-50%) rotate(${ang}deg)`,
              animation: `${m.spin ? "mvScatterSpin" : "mvScatter"} 0.6s ease-out 0.36s forwards`,
              mixBlendMode: "screen",
            }}/>
          );
        })}
        {/* Optional rising motes (fire/spirit/leaf/bubble feel) */}
        {m.rise && Array.from({ length: 5 }).map((_, i) => (
          <div key={`r${i}`} style={{
            position: "absolute", left: `${(i - 2) * 10}px`, top: 8,
            ...shapeStyle(m.shape === "leaf" ? "leaf" : "dot", 7, color),
            animation: `mvRise 0.7s ease-out ${0.38 + i * 0.05}s forwards`,
            mixBlendMode: "screen",
          }}/>
        ))}
      </div>
    </div>
  );
}

// Keyframes appended to BattleScene's <style> block (single injection site).
export const MOVE_FX_KEYFRAMES = `
  @keyframes mvTravel {
    0%   { transform: translate(-50%,-50%) translate(0,0) scale(0.5); opacity: 0; }
    18%  { opacity: 1; }
    100% { transform: translate(-50%,-50%) translate(var(--dx),0) scale(1.05); opacity: 1; }
  }
  @keyframes mvImpact {
    0%   { transform: translate(-50%,-50%) scale(0);   opacity: 0; }
    30%  { opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(2.3); opacity: 0; }
  }
  @keyframes mvRing {
    0%   { transform: translate(-50%,-50%) scale(0);   opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(3);   opacity: 0; }
  }
  @keyframes mvScatter {
    0%   { transform: translate(-50%,-50%) rotate(var(--a)) translateX(0)        scale(1);   opacity: 0; }
    20%  { opacity: 1; }
    100% { transform: translate(-50%,-50%) rotate(var(--a)) translateX(var(--r)) scale(0.2); opacity: 0; }
  }
  @keyframes mvScatterSpin {
    0%   { transform: translate(-50%,-50%) rotate(var(--a)) translateX(0)        scale(1) rotate(0deg);   opacity: 0; }
    20%  { opacity: 1; }
    100% { transform: translate(-50%,-50%) rotate(var(--a)) translateX(var(--r)) scale(0.2) rotate(300deg); opacity: 0; }
  }
  @keyframes mvRise {
    0%   { transform: translateY(0)     scale(0.5); opacity: 0; }
    25%  { opacity: 1; }
    100% { transform: translateY(-58px) scale(1);   opacity: 0; }
  }
  @keyframes mvShield {
    0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
    35%  { opacity: 0.95; }
    100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
  }
`;
