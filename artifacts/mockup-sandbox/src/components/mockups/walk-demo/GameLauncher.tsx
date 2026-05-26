import React, { useState, useEffect, useCallback } from "react";
import { WalkDemo } from "./WalkDemo";

const SAVE_KEY = "primeria_v2";
const checkSave = () => !!localStorage.getItem(SAVE_KEY);
const createSave = () => localStorage.setItem(SAVE_KEY, JSON.stringify({ ts: Date.now() }));

type Screen = "studio" | "dedication" | "title" | "menu" | "intro" | "char_reveal" | "game";

const INTRO_LINES = [
  "The world of Primeria is ancient. Its mountains breathe with elemental force, its rivers run with memory, and its wildlands stretch far beyond any map ever drawn. Scattered across every corner of this world... are Tayanari.",
  "Tayanari are creatures of pure elemental essence — born from the land, shaped by its storms, its fires, its deep and quiet places. They cannot be owned. They cannot be commanded. They can only be... bonded.",
  "Those who earn that bond are called Keepers. Not soldiers. Not tamers. Keepers. They walk alongside their Tayanari as equals — and together, they become something neither could ever be alone.",
  "You were born here. Raised in Primeria Village, at the edge of a world that has been waiting for you. Today is that day. Head to the lab when you're ready. The wild won't wait forever.",
];

export default function GameLauncher() {
  const [screen, setScreen]       = useState<Screen>("studio");
  const [introPhase, setIntroPhase] = useState(1);
  const [fading, setFading]       = useState(false);
  const [savedGame, setSavedGame] = useState(() => checkSave());

  const fadeTo = useCallback((next: Screen, ms = 380) => {
    setFading(true);
    setTimeout(() => {
      setScreen(next);
      setTimeout(() => setFading(false), 80);
    }, ms);
  }, []);

  useEffect(() => {
    if (screen !== "studio") return;
    const t = setTimeout(() => fadeTo("dedication"), 3200);
    return () => clearTimeout(t);
  }, [screen, fadeTo]);

  useEffect(() => {
    if (screen !== "dedication") return;
    const t = setTimeout(() => fadeTo("title"), 7500);
    return () => clearTimeout(t);
  }, [screen, fadeTo]);

  useEffect(() => {
    if (screen !== "title") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") fadeTo("menu");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, fadeTo]);

  const handleNewGame = () => {
    createSave();
    setSavedGame(true);
    setIntroPhase(1);
    fadeTo("intro");
  };

  const handleContinue = () => fadeTo("game");

  const advanceIntro = () => {
    if (introPhase < INTRO_LINES.length) {
      setIntroPhase(p => p + 1);
    } else {
      fadeTo("char_reveal");
    }
  };

  if (screen === "game") return <WalkDemo />;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#000", overflow: "hidden",
      position: "relative",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── STUDIO SPLASH ──────────────────────────────────────────── */}
      {screen === "studio" && (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#000",
          animation: "glFadeIn 1.4s ease forwards",
        }}>
          <div style={{
            color: "rgba(240,208,80,0.65)", fontSize: 32,
            fontWeight: 100, letterSpacing: 4, marginBottom: 18,
            textShadow: "0 0 24px rgba(240,200,60,0.28)",
          }}>◈</div>
          <div style={{
            color: "#ddd8cc", fontSize: 12, fontWeight: 300,
            letterSpacing: 8, textTransform: "uppercase",
          }}>PURESTORY</div>
          <div style={{
            color: "#6a5c40", fontSize: 8, fontWeight: 400,
            letterSpacing: 5, marginTop: 5, textTransform: "uppercase",
          }}>GAMING STUDIOS</div>
          <div style={{
            width: 44, height: 1,
            background: "rgba(240,208,80,0.2)", marginTop: 26,
          }} />
          <div style={{
            color: "#302818", fontSize: 8,
            letterSpacing: 3, marginTop: 14,
          }}>PRESENTS</div>
        </div>
      )}

      {/* ── DEDICATION ─────────────────────────────────────────────── */}
      {screen === "dedication" && (
        <div
          onClick={() => { if (!fading) fadeTo("title"); }}
          style={{
            width: "100%", height: "100%",
            background: "#040303",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "0 40px", boxSizing: "border-box",
            cursor: "pointer", position: "relative",
            animation: "glFadeIn 2s ease forwards",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            marginBottom: 34, width: "100%", maxWidth: 320,
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(240,200,80,0.14)" }} />
            <div style={{ color: "rgba(240,200,80,0.3)", fontSize: 9 }}>◈</div>
            <div style={{ flex: 1, height: 1, background: "rgba(240,200,80,0.14)" }} />
          </div>

          <p style={{
            color: "#c0b07e", fontSize: 14, textAlign: "center",
            lineHeight: 2.0, margin: "0 0 22px",
            fontStyle: "italic", fontWeight: 300,
            letterSpacing: 0.2, maxWidth: 300,
          }}>
            To all my family, my friends,<br />
            and to every struggle that pushed me forward.<br />
            You built me more than you know.
          </p>

          <div style={{ width: 30, height: 1, background: "rgba(240,200,80,0.18)", margin: "2px 0 22px" }} />

          <p style={{
            color: "#7a6a3e", fontSize: 12, textAlign: "center",
            lineHeight: 1.9, margin: 0, fontWeight: 300, maxWidth: 280,
          }}>
            Every closed door led here.<br />
            Every hard chapter was the one before the turn.
          </p>

          <p style={{
            color: "#c8a030", fontSize: 12, textAlign: "center",
            marginTop: 28, fontStyle: "italic", letterSpacing: 1.2,
          }}>
            The adventure starts now.
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            marginTop: 42, width: "100%", maxWidth: 320,
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(240,200,80,0.14)" }} />
            <div style={{ color: "rgba(240,200,80,0.3)", fontSize: 9 }}>◈</div>
            <div style={{ flex: 1, height: 1, background: "rgba(240,200,80,0.14)" }} />
          </div>

          <div style={{
            position: "absolute", bottom: 30,
            color: "#302618", fontSize: 9, letterSpacing: 2.5,
            animation: "glPulse 2.8s ease-in-out infinite",
          }}>TAP TO CONTINUE</div>
        </div>
      )}

      {/* ── TITLE SCREEN ───────────────────────────────────────────── */}
      {screen === "title" && (
        <div
          onClick={() => { if (!fading) fadeTo("menu"); }}
          style={{
            width: "100%", height: "100%",
            position: "relative", overflow: "hidden", cursor: "pointer",
            animation: "glFadeIn 2.2s ease forwards",
          }}
        >
          <img
            src="/__mockup/images/title-bg.png"
            alt="Primeria"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 28%",
            }}
          />
          {/* Top vignette */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "42%",
            background: "linear-gradient(to bottom,rgba(0,0,0,0.75) 0%,transparent 100%)",
            pointerEvents: "none",
          }} />
          {/* Bottom vignette */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "52%",
            background: "linear-gradient(to top,rgba(0,0,0,0.90) 0%,transparent 100%)",
            pointerEvents: "none",
          }} />

          {/* Title */}
          <div style={{
            position: "absolute", top: "13%", left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{
              color: "#f0d060",
              fontSize: "clamp(40px,11vw,68px)",
              fontWeight: 900,
              letterSpacing: "clamp(8px,2.5vw,18px)",
              textAlign: "center",
              textShadow: "0 0 50px rgba(240,200,60,0.5), 0 4px 28px rgba(0,0,0,0.95), 0 0 100px rgba(240,180,40,0.2)",
            }}>PRIMERIA</div>
            <div style={{
              color: "#b89040",
              fontSize: "clamp(8px,1.8vw,11px)",
              letterSpacing: "clamp(4px,1.5vw,7px)",
              marginTop: 9,
              textShadow: "0 2px 10px rgba(0,0,0,0.95)",
              textTransform: "uppercase",
            }}>The Keeper's Tale</div>
          </div>

          {/* Tap to play */}
          <div style={{
            position: "absolute", bottom: "11%",
            left: 0, right: 0, textAlign: "center",
          }}>
            <div style={{
              color: "#d4c46a", fontSize: 10, letterSpacing: 3.5,
              textShadow: "0 2px 10px rgba(0,0,0,0.95)",
              animation: "glPulse 2.4s ease-in-out infinite",
            }}>TAP TO PLAY  ·  PRESS ENTER</div>
          </div>

          <div style={{
            position: "absolute", bottom: "4%",
            left: 0, right: 0, textAlign: "center",
            color: "#2e2412", fontSize: 8, letterSpacing: 2,
          }}>PURESTORY GAMING STUDIOS</div>
        </div>
      )}

      {/* ── MAIN MENU ──────────────────────────────────────────────── */}
      {screen === "menu" && (
        <div style={{
          width: "100%", height: "100%",
          position: "relative", overflow: "hidden",
          background: "#060402",
          animation: "glFadeIn 0.6s ease forwards",
        }}>
          {/* Dim bg */}
          <img src="/__mockup/images/title-bg.png" alt="" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 28%",
            opacity: 0.09, pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(125deg,rgba(4,3,2,0.97) 0%,rgba(10,7,3,0.82) 100%)",
            pointerEvents: "none",
          }} />
          {/* Left edge line accent */}
          <div style={{
            position: "absolute", left: 0, top: "15%", bottom: "15%",
            width: 2,
            background: "linear-gradient(to bottom,transparent,rgba(240,200,60,0.25),transparent)",
            pointerEvents: "none",
          }} />

          {/* Left: options */}
          <div style={{
            position: "absolute", zIndex: 2,
            left: 0, top: 0, bottom: 0, width: "50%",
            display: "flex", flexDirection: "column",
            justifyContent: "center", padding: "0 0 0 10%",
          }}>
            <div style={{ color: "#f0d060", fontSize: 26, fontWeight: 900, letterSpacing: 5, textShadow: "0 0 20px rgba(240,200,60,0.3)" }}>
              PRIMERIA
            </div>
            <div style={{ color: "#6a5020", fontSize: 8, letterSpacing: 4, marginTop: 4 }}>
              THE KEEPER'S TALE
            </div>

            <div style={{ width: 44, height: 1, background: "rgba(240,200,60,0.18)", margin: "22px 0 30px" }} />

            <MenuBtn
              label="NEW GAME"
              primary
              onClick={handleNewGame}
            />
            {savedGame && (
              <MenuBtn
                label="CONTINUE"
                onClick={handleContinue}
                style={{ marginTop: 10 }}
              />
            )}

            <div style={{ marginTop: "auto", paddingBottom: 24, color: "#1e1810", fontSize: 8, letterSpacing: 1.5 }}>
              © PURESTORY GAMING STUDIOS
            </div>
          </div>

          {/* Right: hero + tayanari */}
          <div style={{
            position: "absolute", zIndex: 2,
            right: 0, top: 0, bottom: 0, width: "56%",
            overflow: "hidden",
          }}>
            <img
              src="/__mockup/images/hero-art.png"
              alt="Hero"
              style={{
                position: "absolute", bottom: 0, right: "0%",
                height: "93%", objectFit: "contain", objectPosition: "bottom center",
                filter: "drop-shadow(-4px 0 32px rgba(240,180,40,0.12))",
              }}
            />
            <img
              src="/__mockup/images/title-tayanari.png"
              alt="Tayanari"
              style={{
                position: "absolute", bottom: 0, left: "4%",
                width: "30%", objectFit: "contain", objectPosition: "bottom",
                filter: "drop-shadow(0 0 14px rgba(40,220,80,0.35))",
              }}
            />
            {/* Ground fade */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 50,
              background: "linear-gradient(to top,rgba(4,3,2,0.7),transparent)",
              pointerEvents: "none",
            }} />
          </div>
        </div>
      )}

      {/* ── PROF INTRO ─────────────────────────────────────────────── */}
      {screen === "intro" && (
        <div style={{
          width: "100%", height: "100%",
          background: "linear-gradient(160deg,#0c0704 0%,#050302 100%)",
          display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
          animation: "glFadeIn 0.55s ease forwards",
        }}>
          {/* Ambient glow */}
          <div style={{
            position: "absolute", left: "5%", top: "10%",
            width: 280, height: 500, borderRadius: "50%",
            background: "radial-gradient(ellipse,rgba(180,120,40,0.06) 0%,transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Chapter label */}
          <div style={{
            padding: "20px 22px 0",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{ width: 14, height: 1, background: "rgba(240,200,80,0.25)" }} />
            <div style={{ color: "#4a3418", fontSize: 8, letterSpacing: 3 }}>
              CHAPTER I  ·  THE KEEPER'S PATH
            </div>
          </div>

          {/* Main */}
          <div style={{
            flex: 1, display: "flex", alignItems: "flex-end",
            padding: "0 18px 0 14px", overflow: "hidden",
          }}>
            {/* Prof art */}
            <img
              src="/__mockup/images/prof-art.png"
              alt="Prof. Irwyn"
              style={{
                height: "66%", objectFit: "contain", objectPosition: "bottom",
                flexShrink: 0, marginRight: 14,
                filter: "drop-shadow(0 0 18px rgba(180,140,50,0.18))",
              }}
            />

            {/* Dialog card */}
            <div style={{
              flex: 1, marginBottom: 36,
              background: "rgba(6,4,2,0.90)",
              border: "1px solid rgba(240,200,80,0.18)",
              borderRadius: 14,
              padding: "14px 16px",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(240,200,80,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(240,200,80,0.55)" }} />
                <div style={{ color: "#c8a060", fontSize: 8, letterSpacing: 2.5, fontWeight: 700 }}>
                  PROF. IRWYN
                </div>
                <div style={{ marginLeft: "auto", color: "#2e2010", fontSize: 8 }}>
                  {introPhase} / {INTRO_LINES.length}
                </div>
              </div>
              <p style={{
                color: "#ddd0b0", fontSize: 12, lineHeight: 1.78,
                margin: 0, fontWeight: 300,
              }}>
                {INTRO_LINES[introPhase - 1]}
              </p>
            </div>
          </div>

          {/* Bottom */}
          <div style={{
            padding: "10px 20px 26px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {INTRO_LINES.map((_, i) => (
                <div key={i} style={{
                  width: i + 1 === introPhase ? 18 : 6,
                  height: 6, borderRadius: 3,
                  background: i + 1 <= introPhase
                    ? "rgba(240,200,80,0.65)"
                    : "rgba(240,200,80,0.12)",
                  transition: "width 0.3s ease, background 0.3s ease",
                }} />
              ))}
            </div>
            <button
              onClick={advanceIntro}
              style={{
                background: "rgba(240,200,60,0.10)",
                border: "1px solid rgba(240,200,60,0.38)",
                color: "#f0d060", padding: "8px 22px",
                borderRadius: 8, fontSize: 11, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer",
              }}
            >{introPhase < INTRO_LINES.length ? "Next ▶" : "Continue →"}</button>
          </div>
        </div>
      )}

      {/* ── CHARACTER REVEAL ───────────────────────────────────────── */}
      {screen === "char_reveal" && (
        <div style={{
          width: "100%", height: "100%",
          background: "#050302",
          display: "flex", position: "relative", overflow: "hidden",
          animation: "glFadeIn 0.8s ease forwards",
        }}>
          {/* Ambient glow behind hero */}
          <div style={{
            position: "absolute", right: "10%", top: "15%",
            width: "55%", height: "80%", borderRadius: "50%",
            background: "radial-gradient(ellipse,rgba(240,180,40,0.07) 0%,transparent 68%)",
            pointerEvents: "none",
          }} />
          {/* Left vertical rule */}
          <div style={{
            position: "absolute", left: "46%", top: "12%", bottom: "12%",
            width: 1, background: "linear-gradient(to bottom,transparent,rgba(240,200,60,0.15),transparent)",
            pointerEvents: "none",
          }} />

          {/* Left info panel */}
          <div style={{
            position: "relative", zIndex: 2,
            width: "46%", display: "flex", flexDirection: "column",
            justifyContent: "center", padding: "0 0 0 9%",
          }}>
            <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 4, marginBottom: 14 }}>
              YOUR CHARACTER
            </div>

            <div style={{
              color: "#f0d060", fontSize: 28, fontWeight: 900,
              letterSpacing: 3, lineHeight: 1.05,
              textShadow: "0 0 22px rgba(240,200,60,0.22)",
            }}>THE<br />KEEPER</div>

            <div style={{ width: 46, height: 1, background: "rgba(240,200,60,0.22)", margin: "20px 0" }} />

            <div style={{
              color: "#c8bca0", fontSize: 11, lineHeight: 1.85,
              fontWeight: 300, maxWidth: 170,
            }}>
              Born in Primeria.<br />
              Raised by the land.<br />
              Called by something greater.
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                ["ORIGIN", "Primeria Village"],
                ["CLASS",  "Keeper"],
                ["REALM",  "Unbound"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "#3a2c14", fontSize: 7.5, letterSpacing: 2, width: 52 }}>{k}</div>
                  <div style={{ color: "#9a7c40", fontSize: 10, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => fadeTo("game")}
              style={{
                marginTop: 30, width: 158, padding: "11px 0",
                background: "rgba(240,200,60,0.12)",
                border: "1.5px solid rgba(240,200,60,0.48)",
                borderRadius: 10, color: "#f0d060",
                fontSize: 11, fontWeight: 800, letterSpacing: 2.5,
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 0 20px rgba(240,200,60,0.07)",
                transition: "background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,200,60,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(240,200,60,0.12)"; }}
            >BEGIN JOURNEY</button>
          </div>

          {/* Right: hero art */}
          <div style={{
            position: "absolute", zIndex: 2,
            right: 0, top: 0, bottom: 0, width: "58%",
            display: "flex", alignItems: "flex-end",
            justifyContent: "center", overflow: "hidden",
          }}>
            <img
              src="/__mockup/images/hero-art.png"
              alt="Your Keeper"
              style={{
                height: "96%", objectFit: "contain", objectPosition: "bottom center",
                filter: "drop-shadow(-2px 0 36px rgba(240,180,40,0.16))",
              }}
            />
          </div>
        </div>
      )}

      {/* ── GLOBAL FADE OVERLAY ────────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, background: "#000",
        opacity: fading ? 1 : 0,
        transition: "opacity 0.38s ease",
        pointerEvents: fading ? "all" : "none",
        zIndex: 100,
      }} />

      <style>{`
        @keyframes glFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes glPulse  { 0%,100%{opacity:.25} 50%{opacity:0.9} }
      `}</style>
    </div>
  );
}

function MenuBtn({
  label, primary, onClick, style,
}: {
  label: string;
  primary?: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 162, padding: "11px 0",
        background: primary
          ? (hover ? "rgba(240,208,60,0.24)" : "rgba(240,208,60,0.13)")
          : (hover ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)"),
        border: primary
          ? `1.5px solid ${hover ? "rgba(240,208,60,0.65)" : "rgba(240,208,60,0.42)"}`
          : `1.5px solid ${hover ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)"}`,
        borderRadius: 8,
        color: primary ? "#f0d060" : "#b8a878",
        fontSize: 11, fontWeight: 800, letterSpacing: 2.5,
        textTransform: "uppercase", cursor: "pointer",
        textAlign: "center",
        transition: "background 0.18s, border-color 0.18s, color 0.18s",
        ...style,
      }}
    >{label}</button>
  );
}
