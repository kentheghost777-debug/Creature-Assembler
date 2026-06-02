// ── Battle move FX ──────────────────────────────────────────────────────────
// 3 tiers (sm/md/lg) by move power, element FX images for every move type.
// Utility moves (shield/buff/heal) show element-specific clay FX at caster.
// Damage moves scale image size, particles, glow, rings by tier.

import { type MoveAnim, type MoveCategory } from "./moves";

const PLAYER_X = 26;
const WILD_X   = 70;
const Y        = 52;

type Shape = "dot" | "shard" | "square" | "leaf" | "ring";
type Tier  = "sm" | "md" | "lg";

function getTier(power?: number): Tier {
  if (!power || power <= 45) return "sm";
  if (power <= 80) return "md";
  return "lg";
}

const TIER_IMG:     Record<Tier, number> = { sm: 115, md: 190, lg: 275 };
const TIER_BLOOM:   Record<Tier, number> = { sm: 130, md: 205, lg: 300 };
const TIER_ALPHA:   Record<Tier, string> = { sm: "33", md: "55", lg: "88" };
const TIER_DELAY:   Record<Tier, number> = { sm: 0.32, md: 0.28, lg: 0.22 };
const TIER_PTCL:    Record<Tier, number> = { sm: 6, md: 9, lg: 14 };
const TIER_PROJ_W:  Record<Tier, number> = { sm: 22, md: 30, lg: 44 };
const TIER_PROJ_H:  Record<Tier, number> = { sm: 9,  md: 12, lg: 20 };
const TIER_IMPACT:  Record<Tier, number> = { sm: 60, md: 78, lg: 115 };
const TIER_RING:    Record<Tier, number> = { sm: 44, md: 60, lg: 92  };

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
  mend:    { shape: "dot",    rise: true,  spin: false },
  sharpen: { shape: "shard",  rise: true,  spin: false },
  bulwark: { shape: "ring",   rise: false, spin: false },
};

function shapeStyle(shape: Shape, size: number, color: string): React.CSSProperties {
  const glow = `0 0 9px ${color}, 0 0 3px #fff`;
  switch (shape) {
    case "shard":  return { width: size * 0.5, height: size * 1.5, borderRadius: 2, background: color, boxShadow: glow };
    case "square": return { width: size, height: size, borderRadius: 2, background: color, boxShadow: glow };
    case "leaf":   return { width: size * 0.7, height: size * 1.3, borderRadius: "50% 0 50% 0", background: color, boxShadow: glow };
    case "ring":   return { width: size, height: size, borderRadius: "50%", border: `2px solid ${color}`, boxShadow: glow };
    default:       return { width: size, height: size, borderRadius: "50%", background: color, boxShadow: glow };
  }
}

function glowFilter(color: string, tier: Tier): string {
  if (tier === "sm") return `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 3px #fff8)`;
  if (tier === "md") return `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 6px #fff8)`;
  return `drop-shadow(0 0 22px ${color}) drop-shadow(0 0 12px ${color}) drop-shadow(0 0 6px #fff)`;
}

const EL_FX: Record<string, string> = {
  Volcanic: "fx_volcanic", Frostformed: "fx_frostformed", Oceanic: "fx_oceanic",
  Stormproven: "fx_stormproven", Nature: "fx_nature", Earthbound: "fx_earthbound",
  Mind: "fx_mind", Spirit: "fx_spirit", Chaos: "fx_chaos",
};
const EL_SHIELD: Record<string, string> = {
  Volcanic: "fx_shield_volcanic", Frostformed: "fx_shield_frostformed", Oceanic: "fx_shield_oceanic",
  Stormproven: "fx_shield_stormproven", Nature: "fx_shield_nature", Earthbound: "fx_shield_earthbound",
  Mind: "fx_shield_mind", Spirit: "fx_shield_spirit", Chaos: "fx_shield_chaos",
};
const EL_BUFF: Record<string, string> = {
  Volcanic: "fx_buff_volcanic", Frostformed: "fx_buff_frostformed", Oceanic: "fx_buff_oceanic",
  Stormproven: "fx_buff_stormproven", Nature: "fx_buff_nature", Earthbound: "fx_buff_earthbound",
  Mind: "fx_buff_mind", Spirit: "fx_buff_spirit", Chaos: "fx_buff_chaos",
};

function UtilFxImg({ imgKey, color, imgBase }: { imgKey: string; color: string; imgBase: string }) {
  return (
    <>
      <div style={{
        position: "absolute", left: 0, top: 0,
        width: 165, height: 165, borderRadius: "50%",
        background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
        transform: "translate(-50%,-50%)",
        animation: "mvFxUtil 0.9s ease-out 0.05s forwards",
        mixBlendMode: "screen",
      }}/>
      <img
        src={`${imgBase}/${imgKey}.png`}
        alt=""
        style={{
          position: "absolute", left: 0, top: 0,
          width: 160, height: 160,
          objectFit: "contain",
          transform: "translate(-50%,-50%)",
          animation: "mvFxUtil 0.9s ease-out 0.05s forwards",
          pointerEvents: "none",
          filter: `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 5px #fff9)`,
        }}
      />
    </>
  );
}

export function MoveFx({
  anim, color, from, category, element, power, imgBase = "/__mockup/images",
}: {
  anim: MoveAnim; color: string; from: "player" | "wild";
  category: MoveCategory; element?: string; power?: number; imgBase?: string;
}) {
  const tier = getTier(power);

  // ── Utility moves: aura centered on the caster ──
  if (category !== "damage") {
    const x = from === "player" ? PLAYER_X : WILD_X;
    const isShield = anim === "bulwark" || category === "shield";
    const isBuff   = anim === "sharpen" || category === "buff";
    const utilKey  = element
      ? isShield ? EL_SHIELD[element]
        : isBuff ? EL_BUFF[element]
        : null
      : null;

    return (
      <div style={{ position: "absolute", left: `${x}%`, top: `${Y}%`, width: 0, height: 0, pointerEvents: "none", zIndex: 6 }}>
        {/* CSS ring / mote layer */}
        {anim === "bulwark" ? (
          [0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute", left: 0, top: 0,
              width: 86 + i * 22, height: 86 + i * 22, borderRadius: "50%",
              border: `${3 - i}px solid ${color}`,
              boxShadow: `0 0 16px ${color}, inset 0 0 18px ${color}`,
              transform: "translate(-50%,-50%) scale(0.2)",
              animation: `mvShield 0.9s ease-out ${i * 0.14}s forwards`,
              mixBlendMode: "screen",
            }}/>
          ))
        ) : (
          Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${(i - 4) * 12}px`, top: 28,
              ...shapeStyle(anim === "sharpen" ? "shard" : "dot", 9, color),
              animation: `mvRise 0.95s ease-out ${i * 0.05}s both`,
            }}/>
          ))
        )}
        {/* Clay FX image for shield / buff / mend */}
        {utilKey && <UtilFxImg imgKey={utilKey} color={color} imgBase={imgBase} />}
        {/* Heal uses the element's attack FX (smaller, healing feel) */}
        {category === "heal" && element && EL_FX[element] && (
          <UtilFxImg imgKey={EL_FX[element]} color={color} imgBase={imgBase} />
        )}
      </div>
    );
  }

  // ── Damage moves: projectile travel + impact ──
  const srcX = from === "player" ? PLAYER_X : WILD_X;
  const tgtX = from === "player" ? WILD_X : PLAYER_X;
  const dx   = `${tgtX - srcX}vw`;
  const m    = MOTIF[anim] ?? MOTIF.ember;

  const imgSize  = TIER_IMG[tier];
  const bloom    = TIER_BLOOM[tier];
  const alpha    = TIER_ALPHA[tier];
  const delay    = TIER_DELAY[tier];
  const nP       = TIER_PTCL[tier];
  const pW       = TIER_PROJ_W[tier];
  const pH       = TIER_PROJ_H[tier];
  const impact   = TIER_IMPACT[tier];
  const ring     = TIER_RING[tier];
  const glow     = glowFilter(color, tier);
  const travelT  = tier === "lg" ? "0.35" : "0.4";
  const scatterT = tier === "lg" ? "0.75" : "0.6";
  const fxAnim   = tier === "lg" ? "mvFxBig" : "mvFxImg";
  const riseN    = m.rise ? (tier === "lg" ? 7 : 5) : 0;
  const ptclSize = tier === "lg" ? 10 : 8;
  const ptclR    = tier === "lg" ? 18 : 12;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
      {/* Traveling projectile */}
      <div style={{
        position: "absolute", left: `${srcX}%`, top: `${Y}%`,
        ["--dx" as string]: dx,
        transform: "translate(-50%,-50%)",
        animation: `mvTravel ${travelT}s cubic-bezier(.4,.1,.7,1) forwards`,
      }}>
        <div style={{
          width: pW, height: pH, borderRadius: 8,
          background: `linear-gradient(90deg, transparent, ${color}, #fff)`,
          boxShadow: tier === "lg"
            ? `0 0 24px ${color}, 0 0 10px #fff, 0 0 4px ${color}`
            : `0 0 16px ${color}, 0 0 6px #fff`,
          transform: from === "player" ? "none" : "scaleX(-1)",
          filter: "drop-shadow(0 0 4px #fff)",
        }}/>
        {tier === "lg" && [0, 1].map(i => (
          <div key={i} style={{
            position: "absolute",
            left: from === "player" ? `${-8 - i * 12}px` : `${8 + i * 12}px`,
            top: `${(i % 2 === 0 ? -1 : 1) * 4}px`,
            width: 9, height: 9, borderRadius: "50%",
            background: color, opacity: 0.7 - i * 0.25,
            boxShadow: `0 0 6px ${color}`,
          }}/>
        ))}
      </div>

      {/* Impact zone at the target */}
      <div style={{ position: "absolute", left: `${tgtX}%`, top: `${Y}%`, width: 0, height: 0 }}>
        {/* Core flash */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: impact, height: impact, borderRadius: "50%",
          background: `radial-gradient(circle, #fff 0%, ${color} 34%, transparent 72%)`,
          transform: "translate(-50%,-50%) scale(0)",
          animation: "mvImpact 0.55s ease-out 0.34s forwards",
          mixBlendMode: "screen",
        }}/>
        {/* Primary shock ring */}
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: ring, height: ring, borderRadius: "50%",
          border: `3px solid ${color}`,
          boxShadow: `0 0 14px ${color}`,
          transform: "translate(-50%,-50%) scale(0)",
          animation: "mvRing 0.6s ease-out 0.34s forwards",
          mixBlendMode: "screen",
        }}/>
        {/* Second ring for large moves */}
        {tier === "lg" && (
          <div style={{
            position: "absolute", left: 0, top: 0,
            width: ring * 1.7, height: ring * 1.7, borderRadius: "50%",
            border: `2px solid ${color}77`,
            transform: "translate(-50%,-50%) scale(0)",
            animation: "mvRing 0.85s ease-out 0.38s forwards",
            mixBlendMode: "screen",
          }}/>
        )}
        {/* Scattered motif particles */}
        {Array.from({ length: nP }).map((_, i) => {
          const ang = (i / nP) * 360;
          return (
            <div key={i} style={{
              position: "absolute", left: 0, top: 0,
              ...shapeStyle(m.shape, ptclSize, color),
              ["--a" as string]: `${ang}deg`,
              ["--r" as string]: `${30 + (i % 3) * ptclR}px`,
              transform: `translate(-50%,-50%) rotate(${ang}deg)`,
              animation: `${m.spin ? "mvScatterSpin" : "mvScatter"} ${scatterT}s ease-out 0.36s forwards`,
              mixBlendMode: "screen",
            }}/>
          );
        })}
        {/* Rising motes */}
        {Array.from({ length: riseN }).map((_, i) => (
          <div key={`r${i}`} style={{
            position: "absolute", left: `${(i - Math.floor(riseN / 2)) * 10}px`, top: 8,
            ...shapeStyle(m.shape === "leaf" ? "leaf" : "dot", 7, color),
            animation: `mvRise 0.7s ease-out ${0.38 + i * 0.05}s forwards`,
            mixBlendMode: "screen",
          }}/>
        ))}

        {/* ── Element FX image ── */}
        {element && EL_FX[element] && (
          <>
            <div style={{
              position: "absolute", left: 0, top: 0,
              width: bloom, height: bloom, borderRadius: "50%",
              background: `radial-gradient(circle, ${color}${alpha} 0%, transparent 70%)`,
              transform: "translate(-50%,-50%)",
              animation: `${fxAnim} 0.8s ease-out ${delay}s forwards`,
              mixBlendMode: "screen",
            }}/>
            <img
              src={`${imgBase}/${EL_FX[element]}.png`}
              alt=""
              style={{
                position: "absolute", left: 0, top: 0,
                width: imgSize, height: imgSize,
                objectFit: "contain",
                transform: "translate(-50%,-50%)",
                animation: `${fxAnim} 0.8s ease-out ${delay}s forwards`,
                pointerEvents: "none",
                filter: glow,
              }}
            />
            {tier === "lg" && (
              <div style={{
                position: "absolute", left: 0, top: 0,
                width: 330, height: 330, borderRadius: "50%",
                background: `radial-gradient(circle, ${color}20 0%, ${color}08 40%, transparent 70%)`,
                transform: "translate(-50%,-50%) scale(0)",
                animation: "mvBigBurst 0.9s ease-out 0.22s forwards",
                mixBlendMode: "screen",
              }}/>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ResonanceFx({
  element, color, imgBase = "/__mockup/images",
}: {
  element: string; color: string; imgBase?: string;
}) {
  const fxKey = EL_FX[element];
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
      <div style={{
        position:"absolute", inset:0, background:"#000",
        animation:"resDark 1.4s ease-out forwards", zIndex:0,
      }}/>
      <div style={{
        position:"absolute", left:"26%", top:"52%", zIndex:1,
        width:340, height:340, borderRadius:"50%",
        background:`radial-gradient(circle, ${color}66 0%, ${color}22 45%, transparent 72%)`,
        transform:"translate(-50%,-50%)",
        animation:"resBloom 1.2s ease-out 0.04s forwards",
        mixBlendMode:"screen",
      }}/>
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:"absolute", left:"26%", top:"52%", zIndex:1,
          width:70, height:70, borderRadius:"50%",
          border:`${3 - i * 0.6}px solid ${color}`,
          boxShadow:`0 0 22px ${color}, inset 0 0 10px ${color}88`,
          transform:"translate(-50%,-50%)",
          animation:`resRing 1.05s ease-out ${i * 0.19}s forwards`,
          mixBlendMode:"screen",
        }}/>
      ))}
      {fxKey && (
        <>
          <div style={{
            position:"absolute", left:"26%", top:"52%", zIndex:2,
            width:370, height:370, borderRadius:"50%",
            background:`radial-gradient(circle, ${color}88 0%, ${color}33 50%, transparent 75%)`,
            transform:"translate(-50%,-50%)",
            animation:"resBurst 1.2s ease-out 0.07s forwards",
            mixBlendMode:"screen",
          }}/>
          <img src={`${imgBase}/${fxKey}.png`} alt="" style={{
            position:"absolute", left:"26%", top:"52%", zIndex:2,
            width:370, height:370, objectFit:"contain",
            transform:"translate(-50%,-50%)",
            animation:"resBurst 1.2s ease-out 0.07s forwards",
            filter:`drop-shadow(0 0 32px ${color}) drop-shadow(0 0 16px ${color}) drop-shadow(0 0 8px #fff)`,
            pointerEvents:"none",
          }}/>
        </>
      )}
      {Array.from({length:8}).map((_,i) => {
        const a = (i / 8) * Math.PI * 2;
        const tx = Math.cos(a) * 90;
        const ty = Math.sin(a) * 90;
        return (
          <div key={i} style={{
            position:"absolute", left:"26%", top:"52%", zIndex:3,
            ["--tx" as string]:`${tx}px`,
            ["--ty" as string]:`${ty}px`,
            width: i % 3 === 0 ? 10 : 7, height: i % 3 === 0 ? 10 : 7, borderRadius:"50%",
            background: i % 2 === 0 ? color : "#fff",
            boxShadow:`0 0 12px ${color}, 0 0 5px #fff`,
            transform:"translate(-50%,-50%)",
            animation:`resScatter 0.95s ease-out ${i * 0.055}s forwards`,
            mixBlendMode:"screen",
          }}/>
        );
      })}
    </div>
  );
}

export const RESONANCE_FX_KEYFRAMES = `
  @keyframes resDark    { 0%{opacity:0} 12%{opacity:0.56} 75%{opacity:0.48} 100%{opacity:0} }
  @keyframes resBurst   { 0%{transform:translate(-50%,-50%) scale(0.08) rotate(-18deg);opacity:0} 18%{opacity:1} 58%{transform:translate(-50%,-50%) scale(1.24) rotate(5deg);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.6) rotate(9deg);opacity:0} }
  @keyframes resRing    { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 100%{transform:translate(-50%,-50%) scale(6.5);opacity:0} }
  @keyframes resScatter { 0%{transform:translate(-50%,-50%);opacity:0} 18%{opacity:1} 100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty)));opacity:0} }
  @keyframes resBloom   { 0%{transform:translate(-50%,-50%) scale(0);opacity:0.9} 100%{transform:translate(-50%,-50%) scale(3.4);opacity:0} }
`;

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
    0%   { transform: translate(-50%,-50%) rotate(var(--a)) translateX(0)        scale(1)   rotate(0deg);   opacity: 0; }
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
  @keyframes mvFxImg {
    0%   { transform: translate(-50%,-50%) scale(0.25) rotate(-8deg); opacity: 0; }
    28%  { opacity: 0.95; }
    65%  { transform: translate(-50%,-50%) scale(1.08) rotate(2deg);  opacity: 0.92; }
    100% { transform: translate(-50%,-50%) scale(0.85) rotate(0deg);  opacity: 0; }
  }
  @keyframes mvFxBig {
    0%   { transform: translate(-50%,-50%) scale(0.18) rotate(-14deg); opacity: 0; }
    18%  { opacity: 1; }
    55%  { transform: translate(-50%,-50%) scale(1.14) rotate(3deg);   opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(0.88) rotate(0deg);   opacity: 0; }
  }
  @keyframes mvFxUtil {
    0%   { transform: translate(-50%,-50%) scale(0.12) rotate(12deg);  opacity: 0; }
    22%  { opacity: 0.92; }
    60%  { transform: translate(-50%,-50%) scale(1.06) rotate(-4deg);  opacity: 0.9; }
    100% { transform: translate(-50%,-50%) scale(1.22) rotate(0deg);   opacity: 0; }
  }
  @keyframes mvBigBurst {
    0%   { transform: translate(-50%,-50%) scale(0); opacity: 0.85; }
    100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
  }
`;
