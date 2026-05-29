import React, { useState, useEffect, useCallback } from "react";
import { WalkDemo } from "./WalkDemo";
import { type CharId, type RoleId, hasSave, readSave, startNewSave } from "./save";

type Screen = "studio" | "dedication" | "title" | "menu" | "intro" | "char_reveal" | "game";

const CHARACTERS: { id: CharId; name: string; tag: string; sprite: string; desc: string; stats: [string, string][] }[] = [
  {
    id: "kinju", name: "Kinju", tag: "Sunlit wanderer",
    sprite: "./images/kael_front_idle.png",
    desc: "Born curious. Always at the edge of the known. When the world finally called your name — there was never any doubt.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Wanderlust"], ["CALL", "Horizon"]],
  },
  {
    id: "jess", name: "Jess", tag: "Wildheart roamer",
    sprite: "./images/jess_front_idle.png",
    desc: "Born to the living world. You speak in the language of creatures, silence, and instinct — without ever saying a word.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Wildborn"], ["CALL", "The Living Land"]],
  },
  {
    id: "rowan", name: "Rowan", tag: "Seasoned traveler",
    sprite: "./images/rowan_front_idle.png",
    desc: "Born to understand. Every question leads to the next. For you, the Trial is not a beginning — it is a continuation.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Discovery"], ["CALL", "The Unknown"]],
  },
];

const CHAR_INTRO_LINES: Record<CharId, string[]> = {
  kinju: [
    "Come in, come in — I've been expecting you since dawn. There's an energy about you today — well, every day, if I'm honest. But today it feels like the world finally caught up with it. Forgive me a moment's pause; I don't open this scroll often.",
    "You know our world. Primeria — its mountains breathe with elemental force, its rivers run with memory, its wildlands sprawl past every map ever drawn. And everywhere within it live the Tayanari: creatures of pure elemental essence, born of the land itself. They cannot be owned. They cannot be commanded. They can only be bonded.",
    "Once a generation, each village is asked to put a name forward — to send one of its own to face the Trial of the Elders. It is the highest honor we have. The whole village knew today was the day. And when we gathered to choose... every hand pointed to you.",
    "I have watched you wander to the village edge since you were small — eyes always on the horizon, like something out there was calling your name. The Elders don't test strength. They test direction. And yours has never wavered.",
    "But first, you must declare your path before them — the calling you'll carry through the Trial and beyond. Take a breath. When you're ready, come to the lab. The wild has waited a generation for someone like you. It can wait a few more minutes.",
  ],
  jess: [
    "Come in, come in — I've been expecting you since first light. Even the Tayanari in the back garden have been restless all morning. They feel it too, I think. Something's shifting today, and it has your name on it.",
    "You know our world. Primeria — its mountains breathe with elemental force, its rivers run with memory, its wildlands sprawl past every map ever drawn. And everywhere within it live the Tayanari: creatures of pure elemental essence, born of the land itself. They cannot be owned. They cannot be commanded. They can only be bonded.",
    "Once a generation, each village is asked to put a name forward — to send one of its own to face the Trial of the Elders. It is the highest honor we have. The whole village knew today was the day. And when we gathered to choose... the answer came from the heart, not the head.",
    "I have never seen anyone quiet a Tayanari the way you do — not with commands, but with presence. Some Keepers spend decades learning that. You were born with it. The Elders will feel it the moment you walk in. I am certain of it.",
    "But first, you must declare your path before them — the calling you'll carry through the Trial and beyond. Take a breath. When you're ready, come to the lab. The wild has waited a long time for you. It won't mind a few more minutes.",
  ],
  rowan: [
    "Come in, come in — punctual as ever. I expected no less. I've had your selection prepared for some time; every day I waited, every day something confirmed it. Today, there is no more waiting. Forgive me — I've been rehearsing this speech for weeks.",
    "You know our world. Primeria — its mountains breathe with elemental force, its rivers run with memory, its wildlands sprawl past every map ever drawn. And everywhere within it live the Tayanari: creatures of pure elemental essence, born of the land itself. They cannot be owned. They cannot be commanded. They can only be bonded.",
    "Once a generation, each village is asked to put a name forward — to send one of its own to face the Trial of the Elders. It is the highest honor we have. The whole village knew today was the day. And when we gathered to choose... you had already been studying for it.",
    "I have watched you work through every scroll in this lab twice over. You ask the questions most Keepers never think to ask. The Elders will not test your strength — they will test your mind, your patience, your purpose. There is no one in this village more ready for that test than you.",
    "But first, you must declare your path before them — the calling you'll carry through the Trial and beyond. Take a breath. When you're ready, come to the lab. The world has more left to discover than any one person can chart. You will chart more of it than most.",
  ],
};

export default function GameLauncher() {
  const [screen, setScreen]       = useState<Screen>("studio");
  const [introPhase, setIntroPhase] = useState(1);
  const [fading, setFading]       = useState(false);
  const [savedGame, setSavedGame] = useState(() => hasSave());
  const [characterId, setCharacterId] = useState<CharId>("kinju");
  const [roleId, setRoleId] = useState<RoleId>("keeper");
  const [vw, setVw] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw <= 520;

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
    setCharacterId("kinju");
    setRoleId("keeper");
    setIntroPhase(1);
    fadeTo("char_reveal");
  };

  const handleContinue = () => {
    const save = readSave();
    setCharacterId(save?.characterId ?? "kinju");
    setRoleId(save?.roleId ?? "keeper");
    fadeTo("game");
  };

  const beginJourney = () => {
    startNewSave(characterId, roleId);
    setSavedGame(true);
    fadeTo("intro");
  };

  const advanceIntro = () => {
    const lines = CHAR_INTRO_LINES[characterId] ?? CHAR_INTRO_LINES.kinju;
    if (introPhase < lines.length) {
      setIntroPhase(p => p + 1);
    } else {
      fadeTo("game");
    }
  };

  if (screen === "game") return <WalkDemo characterId={characterId} roleId={roleId} />;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#000", overflow: "hidden",
      position: "relative",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      userSelect: "none", WebkitUserSelect: "none",
      touchAction: "none", overscrollBehavior: "none",
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
            src="./images/title-bg.png"
            alt="Primeria"
            loading="eager"
            decoding="async"
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
          <img src="./images/title-bg.png" alt="" loading="eager" decoding="async" style={{
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
            left: 0, top: 0, bottom: 0,
            width: isMobile ? "100%" : "50%",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: isMobile ? "0 36px" : "0 0 0 10%",
            alignItems: isMobile ? "stretch" : undefined,
          }}>
            <div style={{
              color: "#f0d060", fontSize: isMobile ? 28 : 26, fontWeight: 900,
              letterSpacing: isMobile ? 4 : 5, textShadow: "0 0 20px rgba(240,200,60,0.3)",
              textAlign: isMobile ? "center" : undefined,
            }}>
              PRIMERIA
            </div>
            <div style={{ color: "#6a5020", fontSize: 8, letterSpacing: 4, marginTop: 4, textAlign: isMobile ? "center" : undefined }}>
              THE KEEPER'S TALE
            </div>

            <div style={{ width: 44, height: 1, background: "rgba(240,200,60,0.18)", margin: "22px 0 30px", alignSelf: isMobile ? "center" : undefined }} />

            <MenuBtn
              label="NEW GAME"
              primary
              onClick={handleNewGame}
              style={isMobile ? { width: "100%" } : undefined}
            />
            {savedGame && (
              <MenuBtn
                label="CONTINUE"
                onClick={handleContinue}
                style={isMobile ? { width: "100%", marginTop: 10 } : { marginTop: 10 }}
              />
            )}

            <div style={{ marginTop: "auto", paddingBottom: 24, color: "#1e1810", fontSize: 8, letterSpacing: 1.5, textAlign: isMobile ? "center" : undefined }}>
              © PURESTORY GAMING STUDIOS
            </div>
          </div>

          {/* Right: hero + tayanari */}
          <div style={{
            position: "absolute", zIndex: isMobile ? 1 : 2,
            right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : "56%",
            overflow: "hidden",
            opacity: isMobile ? 0.14 : 1,
          }}>
            <img
              src="./images/hero-art.png"
              alt="Hero"
              style={{
                position: "absolute", bottom: 0, right: "0%",
                height: "min(93%, 480px)", objectFit: "contain", objectPosition: "bottom center",
                filter: "drop-shadow(-4px 0 32px rgba(240,180,40,0.12))",
              }}
            />
            <img
              src="./images/title-tayanari.png"
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
            flex: 1, display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "flex-end",
            padding: isMobile ? "8px 16px 0" : "0 18px 0 14px",
            overflow: "hidden",
          }}>
            {/* Prof art */}
            <img
              src="./images/prof-art.png"
              alt="Prof. Irwyn"
              style={{
                height: isMobile ? 130 : "66%",
                objectFit: "contain",
                objectPosition: isMobile ? "bottom center" : "bottom",
                flexShrink: 0,
                marginRight: isMobile ? 0 : 14,
                marginBottom: isMobile ? 8 : undefined,
                alignSelf: isMobile ? "center" : undefined,
                filter: "drop-shadow(0 0 18px rgba(180,140,50,0.18))",
              }}
            />

            {/* Dialog card */}
            <div style={{
              flex: 1, marginBottom: isMobile ? 8 : 36,
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
                  {introPhase} / {(CHAR_INTRO_LINES[characterId] ?? CHAR_INTRO_LINES.kinju).length}
                </div>
              </div>
              <p style={{
                color: "#ddd0b0", fontSize: 12, lineHeight: 1.78,
                margin: 0, fontWeight: 300,
              }}>
                {(CHAR_INTRO_LINES[characterId] ?? CHAR_INTRO_LINES.kinju)[introPhase - 1]}
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
              {(CHAR_INTRO_LINES[characterId] ?? CHAR_INTRO_LINES.kinju).map((_, i) => (
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
            >{introPhase < (CHAR_INTRO_LINES[characterId] ?? CHAR_INTRO_LINES.kinju).length ? "Next ▶" : "Continue →"}</button>
          </div>
        </div>
      )}

      {/* ── CHARACTER REVEAL ───────────────────────────────────────── */}
      {screen === "char_reveal" && (() => {
        const activeChar = CHARACTERS.find(c => c.id === characterId) ?? CHARACTERS[0];
        const CharPicker = () => (
          <div style={{ display: "flex", gap: isMobile ? 7 : 9, flexWrap: "nowrap" }}>
            {CHARACTERS.map(c => {
              const active = characterId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCharacterId(c.id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    flex: isMobile ? 1 : undefined,
                    width: isMobile ? undefined : 78,
                    padding: "8px 4px 7px", gap: 4, cursor: "pointer",
                    background: active ? "rgba(240,200,60,0.12)" : "rgba(255,255,255,0.02)",
                    border: active ? "1.5px solid rgba(240,200,60,0.6)" : "1px solid rgba(240,200,60,0.16)",
                    borderRadius: 10,
                    boxShadow: active ? "0 0 16px rgba(240,200,60,0.12)" : "none",
                    transition: "all 0.18s",
                  }}
                >
                  <img src={c.sprite} alt={c.name} style={{
                    height: 48, objectFit: "contain",
                    imageRendering: "pixelated",
                    filter: active ? "none" : "grayscale(0.5) opacity(0.7)",
                  }} />
                  <div style={{ color: active ? "#f0d060" : "#8a7440", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{c.name}</div>
                  <div style={{ color: "#6a5424", fontSize: 7, letterSpacing: 0.4 }}>{c.tag}</div>
                </button>
              );
            })}
          </div>
        );

        if (isMobile) {
          return (
            <div style={{
              width: "100%", height: "100%",
              background: "#050302",
              display: "flex", flexDirection: "column",
              overflowY: "auto", overflowX: "hidden",
              animation: "glFadeIn 0.8s ease forwards",
            }}>
              {/* Character art — top, fixed height */}
              <div style={{
                width: "100%", height: 260, flexShrink: 0,
                position: "relative", display: "flex",
                alignItems: "flex-end", justifyContent: "center",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse at 50% 80%,rgba(240,180,40,0.09) 0%,transparent 70%)",
                  pointerEvents: "none",
                }} />
                <img
                  src={activeChar.sprite}
                  alt={activeChar.name}
                  style={{
                    height: "92%", objectFit: "contain", objectPosition: "bottom center",
                    imageRendering: "pixelated",
                    filter: "drop-shadow(0 0 28px rgba(240,180,40,0.22))",
                  }}
                />
              </div>

              {/* Info below */}
              <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 4, marginBottom: 10 }}>YOUR CHARACTER</div>
                <div style={{
                  color: "#f0d060", fontSize: 26, fontWeight: 900, letterSpacing: 3, lineHeight: 1.05,
                  textShadow: "0 0 22px rgba(240,200,60,0.22)",
                }}>THE<br />KEEPER</div>
                <div style={{ width: 46, height: 1, background: "rgba(240,200,60,0.22)", margin: "14px 0" }} />
                <div style={{ color: "#c8bca0", fontSize: 12, lineHeight: 1.75, fontWeight: 300, marginBottom: 14 }}>
                  {activeChar.desc}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                  {activeChar.stats.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ color: "#3a2c14", fontSize: 7.5, letterSpacing: 2, width: 52 }}>{k}</div>
                      <div style={{ color: "#9a7c40", fontSize: 10, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 3, marginBottom: 9 }}>CHOOSE YOUR LOOK</div>
                <CharPicker />
                <button
                  onClick={() => { if (!fading) beginJourney(); }}
                  style={{
                    marginTop: 20, width: "100%", padding: "13px 0",
                    background: "rgba(240,200,60,0.12)",
                    border: "1.5px solid rgba(240,200,60,0.48)",
                    borderRadius: 10, color: "#f0d060",
                    fontSize: 12, fontWeight: 800, letterSpacing: 2.5,
                    textTransform: "uppercase", cursor: "pointer",
                  }}
                >ENTER PRIMERIA →</button>
              </div>
            </div>
          );
        }

        return (
          <div style={{
            width: "100%", height: "100%",
            background: "#050302",
            display: "flex", position: "relative", overflow: "hidden",
            animation: "glFadeIn 0.8s ease forwards",
          }}>
            {/* Ambient glow */}
            <div style={{
              position: "absolute", right: "10%", top: "15%",
              width: "55%", height: "80%", borderRadius: "50%",
              background: "radial-gradient(ellipse,rgba(240,180,40,0.07) 0%,transparent 68%)",
              pointerEvents: "none",
            }} />
            {/* Divider rule */}
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
              <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 4, marginBottom: 14 }}>YOUR CHARACTER</div>
              <div style={{
                color: "#f0d060", fontSize: 28, fontWeight: 900, letterSpacing: 3, lineHeight: 1.05,
                textShadow: "0 0 22px rgba(240,200,60,0.22)",
              }}>THE<br />KEEPER</div>
              <div style={{ width: 46, height: 1, background: "rgba(240,200,60,0.22)", margin: "20px 0" }} />
              <div style={{ color: "#c8bca0", fontSize: 11, lineHeight: 1.85, fontWeight: 300, maxWidth: 170 }}>
                {activeChar.desc}
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 7 }}>
                {activeChar.stats.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ color: "#3a2c14", fontSize: 7.5, letterSpacing: 2, width: 52 }}>{k}</div>
                    <div style={{ color: "#9a7c40", fontSize: 10, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22 }}>
                <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 3, marginBottom: 9 }}>CHOOSE YOUR LOOK</div>
                <CharPicker />
              </div>
              <button
                onClick={() => { if (!fading) beginJourney(); }}
                style={{
                  marginTop: 24, width: 178, padding: "11px 0",
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
              >ENTER PRIMERIA →</button>
            </div>

            {/* Right: character art */}
            <div style={{
              position: "absolute", zIndex: 2,
              right: 0, top: 0, bottom: 0, width: "58%",
              display: "flex", alignItems: "flex-end",
              justifyContent: "center", overflow: "hidden",
            }}>
              <img
                src={activeChar.sprite}
                alt="Your Keeper"
                style={{
                  height: "74%", objectFit: "contain", objectPosition: "bottom center",
                  imageRendering: "pixelated",
                  filter: "drop-shadow(-2px 0 36px rgba(240,180,40,0.18))",
                }}
              />
            </div>
          </div>
        );
      })()}

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
