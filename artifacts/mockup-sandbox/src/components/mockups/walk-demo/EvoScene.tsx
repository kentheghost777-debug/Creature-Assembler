import React, { useEffect, useRef, useState } from "react";
import type { StarterSpec } from "./BattleScene";

// ── Phase timeline ──────────────────────────────────────────────────────────
// rise       0 – 700ms   overlay fades in, gold particles ignite
// flash    700 – 3500ms  pre-evo mon flashes black → white → gold silhouettes
// whitein 3500 – 4200ms  blinding white light floods the screen
// sil     4200 – 5200ms  post-evo appears as a pure gold silhouette
// reveal  5200 – 6200ms  post-evo bursts into full color with gold aura
// plate   6200 – 7900ms  nameplate ascends
// done    7900ms+         onComplete fires
type EvoPhase = "rise" | "flash" | "whitein" | "sil" | "reveal" | "plate" | "done";

type Props = {
  preEvoSpec:  StarterSpec;
  postEvoSpec: StarterSpec;
  /** Optional custom background image. Falls back to a deep violet gradient. */
  evoBg?: string;
  onComplete: (evolved: StarterSpec) => void;
};

// CSS filter values used both inline and in the keyframe template string.
const GOLD = "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(-12deg)";
const WHITE = "brightness(0) invert(1)";

// 14 orbiting gold particles — outer div rotates, inner div animates up/down.
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (i / 14) * 360,
  delay: +(i * 0.065).toFixed(2),
  size:  3 + (i % 4),
  dist:  58 + (i % 5) * 16,
  speed: +(1.35 + (i % 3) * 0.28).toFixed(2),
}));

export function EvoScene({ preEvoSpec, postEvoSpec, evoBg, onComplete }: Props) {
  const [phase, setPhase] = useState<EvoPhase>("rise");
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => { ids.push(window.setTimeout(fn, ms)); };
    at(700,  () => setPhase("flash"));
    at(3500, () => setPhase("whitein"));
    at(4200, () => setPhase("sil"));
    at(5200, () => setPhase("reveal"));
    at(6200, () => setPhase("plate"));
    at(7900, () => { doneRef.current = true; onComplete(postEvoSpec); });
    return () => ids.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const preVisible   = phase === "rise" || phase === "flash" || phase === "whitein";
  const postVisible  = phase === "sil"  || phase === "reveal" || phase === "plate";
  const particlesOn  = phase === "rise" || phase === "flash";
  const auraOn       = phase === "reveal" || phase === "plate";

  // White flash overlay: transitions to 1 during whitein, back to 0 during sil.
  const whiteOpacity = phase === "whitein" ? 1 : 0;
  const whiteTrans   = phase === "whitein" ? "opacity 0.65s ease-in" : "opacity 0.75s ease-out";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      background: evoBg
        ? `url(${evoBg}) center/cover no-repeat`
        : "radial-gradient(ellipse at 50% 58%, #130920 0%, #04020c 100%)",
      animation: "evoSceneRise 0.55s ease-out",
    }}>

      {/* ── Orbiting gold particles ───────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: "50%", top: "44%",
        width: 0, height: 0, pointerEvents: "none",
      }}>
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position: "absolute", width: 0, height: 0,
            transform: `rotate(${p.angle}deg)`,
          }}>
            <div style={{
              position: "absolute",
              left: -p.size / 2,
              top: -(p.dist + p.size / 2),
              width: p.size, height: p.size,
              borderRadius: "50%",
              background: "radial-gradient(circle, #fff8c0 0%, #ffc030 55%, transparent 100%)",
              boxShadow: `0 0 ${p.size * 3}px #ffb030, 0 0 ${p.size}px #fffde0`,
              opacity: particlesOn ? 0.92 : 0,
              transition: `opacity ${particlesOn ? "0.3s" : "0.9s"}`,
              animation: particlesOn
                ? `evoParticle ${p.speed}s ${p.delay}s ease-in-out infinite`
                : "none",
            }}/>
          </div>
        ))}
      </div>

      {/* ── Pre-evo image ─────────────────────────────────────────────────── */}
      {preVisible && (
        <img
          key={`pre-${preEvoSpec.id}`}
          src={preEvoSpec.img}
          alt={preEvoSpec.name}
          style={{
            width: "min(58vw, 268px)",
            height: "min(58vw, 268px)",
            objectFit: "contain",
            imageRendering: "auto",
            position: "relative", zIndex: 3,
            animation:
              phase === "rise"    ? "evoMonIn 0.65s ease-out" :
              phase === "flash"   ? `evoFlash 2.8s ease-in-out forwards` :
              /* whitein */         `evoPreFade 0.65s ease-in forwards`,
          }}
        />
      )}

      {/* ── Post-evo image ────────────────────────────────────────────────── */}
      {postVisible && (
        <img
          key={`post-${postEvoSpec.id}`}
          src={postEvoSpec.img}
          alt={postEvoSpec.name}
          style={{
            width: "min(58vw, 268px)",
            height: "min(58vw, 268px)",
            objectFit: "contain",
            imageRendering: "auto",
            position: "relative", zIndex: 3,
            filter:
              phase === "sil"    ? GOLD :
              phase === "reveal" ? `drop-shadow(0 0 24px #ffd060) drop-shadow(0 0 56px #ff9010)` :
              `drop-shadow(0 0 14px #ffc030)`,
            animation:
              phase === "sil"    ? "evoMonIn 0.82s ease-out" :
              phase === "reveal" ? "evoReveal 1s ease-out forwards" :
              /* plate */          "evoFloat 3.5s ease-in-out infinite",
          }}
        />
      )}

      {/* ── Gold aura bloom behind post-evo ──────────────────────────────── */}
      {auraOn && (
        <div style={{
          position: "absolute",
          width: "min(82vw, 400px)", height: "min(82vw, 400px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,210,60,0.28) 0%, rgba(255,140,20,0.09) 48%, transparent 72%)",
          pointerEvents: "none", zIndex: 2,
          animation: "evoAura 1.2s ease-out",
        }}/>
      )}

      {/* ── White flash overlay (transition-driven, no animation jank) ────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "#ffffff",
        pointerEvents: "none", zIndex: 10,
        opacity: whiteOpacity,
        transition: whiteTrans,
      }}/>

      {/* ── Nameplate ────────────────────────────────────────────────────── */}
      {phase === "plate" && (
        <div style={{
          position: "absolute", bottom: "13%",
          textAlign: "center",
          animation: "evoNameplate 0.65s cubic-bezier(.3,.7,.4,1)",
          zIndex: 20, padding: "0 22px",
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 3.8, color: "#9a7850",
            fontWeight: 900, textTransform: "uppercase", marginBottom: 10,
            textShadow: "0 0 12px rgba(200,160,40,0.5)",
          }}>✦  BOND AWAKENING  ✦</div>

          <div style={{
            fontSize: 13, color: "#a09080", fontWeight: 700, marginBottom: 3,
          }}>{preEvoSpec.name}</div>

          <div style={{
            fontSize: 17, color: "#ffd060",
            fontWeight: 900, letterSpacing: 1.5,
            textShadow: "0 0 16px #ffb030, 0 0 44px #ff7000",
            margin: "4px 0 6px",
          }}>evolved into</div>

          <div style={{
            fontSize: 32, color: "#ffffff",
            fontWeight: 900, letterSpacing: 0.5, lineHeight: 1.1,
            textShadow: "0 0 24px #ffd060, 0 0 72px #ffb030, 0 2px 0 rgba(0,0,0,0.55)",
          }}>{postEvoSpec.name}</div>

          <div style={{
            marginTop: 12,
            display: "inline-block",
            padding: "4px 20px",
            background: `linear-gradient(90deg, transparent, ${postEvoSpec.color}55, transparent)`,
            border: `1px solid ${postEvoSpec.color}99`,
            borderRadius: 26,
            fontSize: 10, color: postEvoSpec.color,
            fontWeight: 900, letterSpacing: 2.8, textTransform: "uppercase",
            textShadow: `0 0 10px ${postEvoSpec.color}`,
          }}>{postEvoSpec.type}</div>
        </div>
      )}

      {/* ── Keyframes ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes evoSceneRise {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes evoMonIn {
          0%   { transform: scale(0.42) translateY(44px); opacity: 0; }
          62%  { transform: scale(1.08) translateY(-6px);  opacity: 1; }
          100% { transform: scale(1)    translateY(0);     opacity: 1; }
        }
        @keyframes evoFlash {
          0%   { filter: none; }
          6%   { filter: ${WHITE}; }
          12%  { filter: none; }
          17%  { filter: brightness(0); }
          23%  { filter: ${GOLD}; }
          29%  { filter: ${WHITE}; }
          35%  { filter: brightness(0); }
          41%  { filter: ${GOLD}; }
          47%  { filter: ${WHITE}; }
          53%  { filter: brightness(0); }
          59%  { filter: ${GOLD}; }
          65%  { filter: ${WHITE}; }
          71%  { filter: brightness(0); }
          77%  { filter: ${GOLD}; }
          84%  { filter: ${WHITE}; }
          90%  { filter: brightness(0); }
          96%  { filter: ${GOLD}; }
          100% { filter: ${WHITE}; opacity: 0.55; }
        }
        @keyframes evoPreFade {
          0%   { filter: ${WHITE}; opacity: 0.55; }
          100% { filter: ${WHITE}; opacity: 0; }
        }
        @keyframes evoReveal {
          0%   { filter: ${GOLD}; transform: scale(1.13); }
          100% { filter: drop-shadow(0 0 24px #ffd060) drop-shadow(0 0 56px #ff9010); transform: scale(1); }
        }
        @keyframes evoAura {
          0%   { transform: scale(0.15); opacity: 0; }
          55%  { opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes evoFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-9px); }
        }
        @keyframes evoNameplate {
          0%   { transform: translateY(28px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes evoParticle {
          0%, 100% { transform: translateY(0) scale(1);   opacity: 0.92; }
          50%      { transform: translateY(-20px) scale(0.35); opacity: 0.22; }
        }
      `}</style>
    </div>
  );
}
