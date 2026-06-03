import React, { useEffect, useRef, useState } from "react";
import { sheetBgStyle, type StarterSpec } from "./BattleScene";

// ── Phase timeline ──────────────────────────────────────────────────────────
// rise     0 – 700ms    overlay in, beam + particles ignite
// flash  700 – 3200ms   pre-evo mon cycles black → gold → white silhouettes
// whitein 3200 – 3900ms blinding white fills screen
// sil    3900 – 4900ms  post-evo appears as pure gold silhouette
// reveal 4900 – 5900ms  post-evo bursts into color, gold aura blooms
// plate  5900 – 7700ms  nameplate ascends; mon floats
// done   7700ms+         onComplete fires
type Phase = "rise" | "flash" | "whitein" | "sil" | "reveal" | "plate" | "done";

type Props = {
  preEvoSpec:  StarterSpec;
  postEvoSpec: StarterSpec;
  /** Optional custom background image (falls back to deep violet gradient). */
  evoBg?: string;
  onComplete: (evolved: StarterSpec) => void;
};

// CSS filter values — injected into keyframe template strings
const GOLD  = "brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(-12deg)";
const WHITE = "brightness(0) invert(1)";
const BLACK = "brightness(0)";

// ── Sizing — CSS min() responsive, max() negation for valid centering margins ──
// Mon  : min(240px, 52vw)   → margin = max(-120px, -26vw)
// RingI: min(284px, 61vw)   → margin = max(-142px, -30.5vw)
// RingO: min(326px, 70vw)   → margin = max(-163px, -35vw)
// Aura : min(460px, 94vw)   → margin = max(-230px, -47vw)
const SZ_MON   = "min(240px, 52vw)";
const MG_MON   = "max(-120px, -26vw)";   // negative of half-mon-size
const SZ_RNGI  = "min(284px, 61vw)";
const MG_RNGI  = "max(-142px, -30.5vw)";
const SZ_RNGO  = "min(326px, 70vw)";
const MG_RNGO  = "max(-163px, -35vw)";
const SZ_AURA  = "min(460px, 94vw)";
const MG_AURA  = "max(-230px, -47vw)";

// 16 orbiting gold particles — orbit radius just outside the inner ring (~152px)
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle:  (i / 16) * 360,
  delay:  +(i * 0.055).toFixed(3),
  size:   3 + (i % 4),
  distPx: 150 + (i % 3) * 9,
  speed:  +(1.3 + (i % 3) * 0.28).toFixed(2),
}));

export function EvoScene({ preEvoSpec, postEvoSpec, evoBg, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("rise");
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => { ids.push(window.setTimeout(fn, ms)); };
    at(700,  () => setPhase("flash"));
    at(3200, () => setPhase("whitein"));
    at(3900, () => setPhase("sil"));
    at(4900, () => setPhase("reveal"));
    at(5900, () => setPhase("plate"));
    at(7700, () => { doneRef.current = true; onComplete(postEvoSpec); });
    return () => ids.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const preVisible  = phase === "rise" || phase === "flash" || phase === "whitein";
  const postVisible = phase === "sil"  || phase === "reveal" || phase === "plate";
  const beamOn      = phase === "rise" || phase === "flash";
  const particlesOn = phase === "rise" || phase === "flash";
  const auraOn      = phase === "reveal" || phase === "plate";

  // White flash overlay — CSS transition driven (no animation restart jank)
  const whiteOpacity = phase === "whitein" ? 1 : 0;
  const whiteTrans   = phase === "whitein" ? "opacity 0.7s ease-in" : "opacity 0.7s ease-out";

  // Inner ring styling by phase
  const ringFilter = phase === "sil" ? GOLD : "none";
  const ringGlow =
    phase === "flash"
      ? "0 0 34px #ffe060, 0 0 90px rgba(255,180,30,0.55), inset 0 0 24px rgba(255,210,60,0.12)"
      : (phase === "reveal" || phase === "plate")
        ? "0 0 26px #ffc030, 0 0 70px rgba(255,155,0,0.45), inset 0 0 18px rgba(255,200,60,0.07)"
        : "0 0 16px rgba(255,190,40,0.65), 0 0 42px rgba(255,130,0,0.25)";
  const ringAnim = phase === "flash"
    ? "evoRingFlash 1.05s ease-in-out infinite"
    : "evoRingBreath 3s ease-in-out infinite";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, overflow: "hidden",
      background: evoBg
        ? `url(${evoBg}) center/cover no-repeat`
        : "radial-gradient(ellipse at 50% 60%, #130920 0%, #04020c 100%)",
      animation: "evoFadeIn 0.5s ease-out",
    }}>

      {/* ── Energy beam ——————————————————————————————————————————————————
           Full-height, horizontally centered behind everything.
           Background was removed → golden beam on transparent.          */}
      <img
        src="/__mockup/images/evo-beam.png"
        alt=""
        style={{
          position: "absolute",
          left: "50%", top: 0,
          height: "100%", width: "auto",
          transform: "translateX(-50%)",
          opacity: beamOn ? 0.68 : 0,
          transition: `opacity ${beamOn ? "0.5s" : "1.4s"} ease`,
          pointerEvents: "none", zIndex: 1,
          animation: beamOn ? "evoBeamPulse 1.6s ease-in-out infinite" : "none",
        }}
      />

      {/* ── Center anchor (50 %, 42 %) ——————————————————————————————————
           All mon/ring/particle elements live inside this zero-size div.
           Each child self-centers using margin: max(-halfSize, -halfVw). */}
      <div style={{ position: "absolute", left: "50%", top: "42%", width: 0, height: 0 }}>

        {/* Outer slow-rotating ring */}
        <div style={{
          position: "absolute",
          width: SZ_RNGO, height: SZ_RNGO,
          marginLeft: MG_RNGO, marginTop: MG_RNGO,
          borderRadius: "50%",
          border: `1px solid rgba(255,200,60,${
            phase === "flash" ? 0.5 : phase === "reveal" || phase === "plate" ? 0.36 : 0.22
          })`,
          filter: ringFilter,
          animation: "evoRingRotate 10s linear infinite",
          transition: "border-color 0.6s",
          pointerEvents: "none",
        }} />

        {/* Inner glow ring — primary golden circle framing the mon */}
        <div style={{
          position: "absolute",
          width: SZ_RNGI, height: SZ_RNGI,
          marginLeft: MG_RNGI, marginTop: MG_RNGI,
          borderRadius: "50%",
          border: `2px solid rgba(255,200,60,${phase === "sil" ? 0.95 : phase === "rise" ? 0.7 : 0.88})`,
          boxShadow: ringGlow,
          filter: ringFilter,
          transition: "box-shadow 0.4s, border-color 0.4s, filter 0.3s",
          animation: ringAnim,
          pointerEvents: "none",
        }} />

        {/* ── Pre-evo mon —————————————————————————————————————————————— */}
        {preVisible && (preEvoSpec.sheet ? (
          <div
            key={`pre-${preEvoSpec.id}`}
            style={{
              position: "absolute",
              width: SZ_MON, height: SZ_MON,
              marginLeft: MG_MON, marginTop: MG_MON,
              display: "flex", justifyContent: "center", alignItems: "center",
              zIndex: 3, pointerEvents: "none",
              animation:
                phase === "rise"    ? "evoMonIn 0.65s ease-out forwards" :
                phase === "flash"   ? "evoFlash 2.5s linear forwards" :
                                      "evoPreFade 0.6s ease-in forwards",
            }}
          >
            <div style={{
              height: "100%",
              aspectRatio: `${preEvoSpec.sheet.w} / ${preEvoSpec.sheet.h}`,
              ...sheetBgStyle(preEvoSpec.sheet),
            }}/>
          </div>
        ) : (
          <img
            key={`pre-${preEvoSpec.id}`}
            src={preEvoSpec.img}
            alt={preEvoSpec.name}
            style={{
              position: "absolute",
              width: SZ_MON, height: SZ_MON,
              marginLeft: MG_MON, marginTop: MG_MON,
              objectFit: "contain", imageRendering: "auto",
              zIndex: 3, pointerEvents: "none",
              animation:
                phase === "rise"    ? "evoMonIn 0.65s ease-out forwards" :
                phase === "flash"   ? "evoFlash 2.5s linear forwards" :
                                      "evoPreFade 0.6s ease-in forwards",
            }}
          />
        ))}

        {/* ── Post-evo mon ————————————————————————————————————————————— */}
        {postVisible && (
          <img
            key={`post-${postEvoSpec.id}`}
            src={postEvoSpec.img}
            alt={postEvoSpec.name}
            style={{
              position: "absolute",
              width: SZ_MON, height: SZ_MON,
              marginLeft: MG_MON, marginTop: MG_MON,
              objectFit: "contain", imageRendering: "auto",
              zIndex: 3, pointerEvents: "none",
              filter:
                phase === "sil"    ? GOLD :
                phase === "reveal" ? "drop-shadow(0 0 22px #ffd060) drop-shadow(0 0 55px #ff9010)" :
                                     "drop-shadow(0 0 14px #ffc030)",
              animation:
                phase === "sil"    ? "evoMonIn 0.85s ease-out forwards" :
                phase === "reveal" ? "evoReveal 1s ease-out forwards" :
                                     "evoFloat 3.5s ease-in-out infinite",
            }}
          />
        )}

        {/* ── Orbiting gold particles ——————————————————————————————————
             Each has an outer rotate-wrapper (zero-size), particle sits
             at top: -distPx from the anchor = correct orbit radius.     */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 0, height: 0,
              transform: `rotate(${p.angle}deg)`,
              pointerEvents: "none",
            }}
          >
            <div style={{
              position: "absolute",
              left: -(p.size / 2),
              top:  -p.distPx,
              width: p.size, height: p.size,
              borderRadius: "50%",
              background: "radial-gradient(circle, #fff8c0 0%, #ffc030 55%, transparent 100%)",
              boxShadow: `0 0 ${p.size * 3}px #ffb030, 0 0 ${p.size}px #fffde0`,
              opacity: particlesOn ? 0.9 : 0,
              transition: `opacity ${particlesOn ? "0.3s" : "1.1s"}`,
              animation: particlesOn
                ? `evoParticle ${p.speed}s ${p.delay}s ease-in-out infinite`
                : "none",
            }} />
          </div>
        ))}
      </div>{/* end center anchor */}

      {/* ── Gold aura bloom (reveal + plate phases) ——————————————————— */}
      {auraOn && (
        <div style={{
          position: "absolute",
          left: "50%", top: "42%",
          width: SZ_AURA, height: SZ_AURA,
          marginLeft: MG_AURA, marginTop: MG_AURA,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,210,60,0.22) 0%, rgba(255,140,20,0.07) 46%, transparent 70%)",
          pointerEvents: "none", zIndex: 2,
          animation: "evoAura 1.2s ease-out",
        }} />
      )}

      {/* ── White flash overlay ——————————————————————————————————————— */}
      <div style={{
        position: "absolute", inset: 0,
        background: "#fff",
        opacity: whiteOpacity,
        transition: whiteTrans,
        pointerEvents: "none", zIndex: 10,
      }} />

      {/* ── Nameplate ————————————————————————————————————————————————— */}
      {phase === "plate" && (
        <div style={{
          position: "absolute", bottom: "9%", left: 0, right: 0,
          textAlign: "center",
          animation: "evoNameplate 0.65s cubic-bezier(.3,.7,.4,1)",
          zIndex: 20, padding: "0 24px",
        }}>
          <div style={{
            fontSize: 9, letterSpacing: 3.8, color: "#9a7850",
            fontWeight: 900, textTransform: "uppercase", marginBottom: 10,
            textShadow: "0 0 12px rgba(200,160,40,0.5)",
          }}>✦  BOND AWAKENING  ✦</div>

          <div style={{
            fontSize: 13, color: "#a09080", fontWeight: 700, marginBottom: 2,
          }}>{preEvoSpec.name}</div>

          <div style={{
            fontSize: 16, color: "#ffd060",
            fontWeight: 900, letterSpacing: 1.5,
            textShadow: "0 0 16px #ffb030, 0 0 44px #ff7000",
            margin: "4px 0 6px",
          }}>evolved into</div>

          <div style={{
            fontSize: 30, color: "#fff",
            fontWeight: 900, letterSpacing: 0.5, lineHeight: 1.1,
            textShadow: "0 0 22px #ffd060, 0 0 70px #ffb030, 0 2px 0 rgba(0,0,0,0.5)",
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

      {/* ── Keyframes ————————————————————————————————————————————————— */}
      {/*   No CSS min() inside keyframes — all centering is done via     */}
      {/*   margins on the elements; animations only add visual effects.  */}
      <style>{`
        @keyframes evoFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Mon enters from slightly below, overshoots, settles */
        @keyframes evoMonIn {
          0%   { transform: scale(0.42) translateY(44px); opacity: 0; }
          62%  { transform: scale(1.08) translateY(-6px);  opacity: 1; }
          100% { transform: scale(1)    translateY(0);     opacity: 1; }
        }

        /* Silhouette flash: normal → rapid black / gold / white strobe → dissolves white */
        @keyframes evoFlash {
          0%   { filter: none;    opacity: 1; }
          7%   { filter: ${BLACK}; }
          13%  { filter: none; }
          19%  { filter: ${GOLD}; }
          25%  { filter: ${WHITE}; }
          31%  { filter: ${BLACK}; }
          37%  { filter: ${GOLD}; }
          43%  { filter: ${WHITE}; }
          49%  { filter: ${BLACK}; }
          55%  { filter: ${GOLD}; }
          61%  { filter: ${WHITE}; }
          67%  { filter: ${BLACK}; }
          73%  { filter: ${GOLD}; }
          79%  { filter: ${WHITE}; }
          85%  { filter: ${BLACK}; }
          91%  { filter: ${GOLD}; }
          97%  { filter: ${WHITE}; }
          100% { filter: ${WHITE}; opacity: 0.45; }
        }

        /* Pre-evo fades out as the white-flash overlay takes over */
        @keyframes evoPreFade {
          from { filter: ${WHITE}; opacity: 0.45; }
          to   { filter: ${WHITE}; opacity: 0; }
        }

        /* Post-evo transitions from gold silhouette → full color */
        @keyframes evoReveal {
          0%   { filter: ${GOLD}; transform: scale(1.14); }
          100% { filter: drop-shadow(0 0 22px #ffd060) drop-shadow(0 0 55px #ff9010);
                 transform: scale(1); }
        }

        /* Gentle float on the nameplate phase */
        @keyframes evoFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-9px); }
        }

        /* Outer ring slow clockwise rotation */
        @keyframes evoRingRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Inner ring calm breathe */
        @keyframes evoRingBreath {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }

        /* Inner ring rapid pulse in sync with the flash phase */
        @keyframes evoRingFlash {
          0%, 100% { opacity: 1;    transform: scale(1); }
          50%      { opacity: 0.62; transform: scale(1.045); }
        }

        /* Energy beam breathe */
        @keyframes evoBeamPulse {
          0%, 100% { opacity: 0.62; transform: translateX(-50%) scaleX(1); }
          50%      { opacity: 0.82; transform: translateX(-50%) scaleX(1.08); }
        }

        /* Gold aura expands from nothing */
        @keyframes evoAura {
          0%   { transform: scale(0.18); opacity: 0; }
          55%  { opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }

        /* Nameplate slides up */
        @keyframes evoNameplate {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        /* Each particle drifts outward and fades */
        @keyframes evoParticle {
          0%, 100% { transform: translateY(0)    scale(1);    opacity: 0.9; }
          50%      { transform: translateY(-22px) scale(0.35); opacity: 0.18; }
        }
      `}</style>
    </div>
  );
}
