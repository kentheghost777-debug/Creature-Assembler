import React, { useState, useEffect, useCallback } from "react";
import { WalkDemo } from "./WalkDemo";
import { type CharId, type RoleId, hasSave, readSave, startNewSave } from "./save";
import { playTrack, stopAll } from "./audioManager";

const TITLE_TRACK = "/__mockup/audio/primeria_title.mp3";

type Screen = "studio" | "dedication" | "title" | "menu" | "intro" | "char_reveal" | "game";

const CHARACTERS: { id: CharId; name: string; tag: string; sprite: string; hdImg: string; desc: string; stats: [string, string][] }[] = [
  {
    id: "kinju", name: "Kinju", tag: "Sunlit wanderer",
    sprite: "/__mockup/images/kinju_front_idle.png",
    hdImg:  "/__mockup/images/kinju_hero.png",
    desc: "Born curious. Always at the edge of the known. When the world finally called your name — there was never any doubt.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Wanderlust"], ["CALL", "Horizon"]],
  },
  {
    id: "jess", name: "Jess", tag: "Wildheart roamer",
    sprite: "/__mockup/images/jess_front_idle.png",
    hdImg:  "/__mockup/images/jess_hero.png",
    desc: "Born to the living world. You speak in the language of creatures, silence, and instinct — without ever saying a word.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Wildborn"], ["CALL", "The Living Land"]],
  },
  {
    id: "rowan", name: "Rowan", tag: "Seasoned traveler",
    sprite: "/__mockup/images/rowan_front_idle.png",
    hdImg:  "/__mockup/images/rowan_hero.png",
    desc: "Born to understand. Every question leads to the next. For you, the Trial is not a beginning — it is a continuation.",
    stats: [["ORIGIN", "Primeria Village"], ["HEART", "Discovery"], ["CALL", "The Unknown"]],
  },
];

const CHAR_INTRO_LINES: Record<CharId, string[]> = {
  kinju: [
    "Come in. I've been watching the light change since first bell — and here you are, right at the moment it turned gold. I've had this scroll ready for three weeks. Every time I considered passing it to someone else, something stopped me. Today nothing stopped me.",
    "Primeria looks peaceful from the village square. It isn't. Its mountains store elemental force the way stone holds heat — pressure building for centuries. Its rivers carry resonance memory from thousands of years of creature-life. The Tayanari that live in it? They are that world given shape and will. They don't obey. They choose.",
    "The Trial of the Elders has been called. Once a generation, each village sends one of its own — not the strongest, not the most decorated. The one the land seems to recognize. Someone who will walk toward the unknown and keep walking when the map runs out. The village chose you. I was not surprised.",
    "I have watched you stand at the north fence since you were small — eyes on the ridge, already calculating the route. Some people hold the horizon as an escape. You hold it as a direction. That is a different thing entirely, and the Tayanari out there will feel the difference the moment they meet you.",
    "But first: your path. You'll declare it in the lab, and it will shape everything that comes after. Take a breath. When you're ready, come find me. The wildlands have been waiting a long time for someone who already knows which way they're facing. They can wait five more minutes.",
  ],
  jess: [
    "Come in — I knew it was you before you knocked. The Tayanari in the back garden went still all at once, like they were listening for something. They read what I hadn't said yet: today the Trial calls someone from Primeria, and it's been pointing at you for longer than either of us realized.",
    "Primeria isn't just one place — it's a living system. Mountains that breathe elemental energy, rivers that remember every creature that's ever crossed them, wildlands that stretch so far past the last map that whole new forms of life are still being found out there. The Tayanari exist inside all of it: born from it, shaped by it, and able to bond with exactly the right person if that person knows how to be still enough to listen.",
    "The Trial asks one thing of each generation: send someone the world seems to recognize. Not the most powerful. The one who moves through living things — creatures, people — as if they already have permission to be there. We chose you in under a minute. No one argued. The room just knew.",
    "I have seen you calm Tayanari three times your size without raising your voice. I have seen wild ones near the eastern fence stop and watch you cross the yard. That is not luck. That is a language the Tayanari speak fluently, and you are already answering them without knowing it.",
    "One more thing before you go — your path. You declare it at the lab today, and it follows you through everything that comes next. Trust what you feel when you're standing there. Then go. The wildlands are waiting for exactly what you carry. Don't keep them long.",
  ],
  rowan: [
    "Come in, right on time — I've had everything prepared since Tuesday. I kept revisiting the selection, running the compatibility index one more time. Same result every time. Some problems resolve cleanly when you give them enough data. You were that kind of problem. Sit down.",
    "Primeria runs on something most people never stop to examine: elemental resonance. The mountains don't just stand there — they generate force that accumulates over centuries. The water doesn't just flow — it carries frequency. The Tayanari aren't unusual animals. They are living concentrations of that energy, evolved across millennia to work with it in ways our field journals are still only beginning to describe.",
    "The Trial of the Elders has been called. One person per generation, per village — chosen not for strength alone, but for a specific quality of mind. Someone who will actually learn from what they encounter rather than simply survive it. The village deliberated. In the end: you. I ran the prediction three times. It resolved the same way each time.",
    "You have read every field journal in this lab. You have found indexing errors I missed. You ask questions that take me two days to answer properly, and you remember the answers. The Trial will put you in front of situations where no field guide exists yet. That is precisely where someone with your patience belongs — at the edge of what's known, building the next record.",
    "Before everything else: your path. You declare it at the lab. I expect you've been considering the options for some time. Take as long as you need — though I'd be surprised if you need long. The undiscovered country has been sitting there waiting for someone methodical enough to actually map it. Go map it.",
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
      if (e.key === "Enter" || e.key === " ") { playTrack(TITLE_TRACK); fadeTo("menu"); }
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
      width: "100vw", height: "100dvh",
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
            color: "#a8956a", fontSize: 8, fontWeight: 400,
            letterSpacing: 5, marginTop: 5, textTransform: "uppercase",
          }}>GAMING STUDIOS</div>
          <div style={{
            width: 44, height: 1,
            background: "rgba(240,208,80,0.25)", marginTop: 26,
          }} />
          <div style={{
            color: "#8a7a58", fontSize: 9,
            letterSpacing: 4, marginTop: 14,
          }}>PRESENTS</div>
        </div>
      )}

      {/* ── DEDICATION ─────────────────────────────────────────────── */}
      {screen === "dedication" && (
        <div
          onClick={() => { if (!fading) { playTrack(TITLE_TRACK); fadeTo("title"); } }}
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
            color: "#a89060", fontSize: 10, letterSpacing: 2.5,
            animation: "glPulse 2.8s ease-in-out infinite",
          }}>TAP TO CONTINUE</div>
        </div>
      )}

      {/* ── TITLE SCREEN ───────────────────────────────────────────── */}
      {screen === "title" && (
        <div
          onClick={() => { if (!fading) { playTrack(TITLE_TRACK); fadeTo("menu"); } }}
          style={{
            width: "100%", height: "100%",
            position: "relative", overflow: "hidden", cursor: "pointer",
            animation: "glFadeIn 2.2s ease forwards",
          }}
        >
          <img
            src="/__mockup/images/title-bg.png"
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
              color: "#c8a84a",
              fontSize: "clamp(11px,2.4vw,14px)",
              letterSpacing: "clamp(4px,1.5vw,7px)",
              marginTop: 9,
              textShadow: "0 2px 12px rgba(0,0,0,0.98)",
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
            color: "#6a5c38", fontSize: 8, letterSpacing: 2,
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
          <img src="/__mockup/images/title-bg.png" alt="" loading="eager" decoding="async" style={{
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
              src="/__mockup/images/hero-art.png"
              alt="Hero"
              style={{
                position: "absolute", bottom: 0, right: "4%",
                height: "min(93%, 480px)", objectFit: "contain", objectPosition: "bottom center",
                filter: "drop-shadow(-4px 0 32px rgba(240,180,40,0.12))",
              }}
            />
            <img
              src="/__mockup/images/title-tayanari.png"
              alt="Tayanari"
              style={{
                position: "absolute", bottom: 0, right: "34%",
                width: "26%", objectFit: "contain", objectPosition: "bottom",
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
              src="/__mockup/images/prof-art.png"
              alt="Prof. Irwyn"
              style={{
                height: isMobile ? 130 : "min(66%, 440px)",
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
            padding: "10px 20px",
            paddingBottom: "max(26px, env(safe-area-inset-bottom, 26px))",
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
          <div style={{ display: "flex", gap: isMobile ? 8 : 10, flexWrap: "nowrap" }}>
            {CHARACTERS.map(c => {
              const active = characterId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCharacterId(c.id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    flex: 1,
                    padding: "8px 6px 10px", gap: 6, cursor: "pointer",
                    background: active ? "rgba(240,200,60,0.12)" : "rgba(255,255,255,0.02)",
                    border: active ? "1.5px solid rgba(240,200,60,0.6)" : "1px solid rgba(240,200,60,0.16)",
                    borderRadius: 10,
                    boxShadow: active ? "0 0 18px rgba(240,200,60,0.14)" : "none",
                    transition: "all 0.18s",
                  }}
                >
                  <div style={{
                    width: "100%", aspectRatio: "3/4",
                    overflow: "hidden", borderRadius: 6, flexShrink: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "flex-end", justifyContent: "center",
                  }}>
                    <img src={c.hdImg} alt={c.name} style={{
                      width: "100%", height: "100%",
                      objectFit: "contain", objectPosition: "top center",
                      filter: active ? "none" : "grayscale(0.55) opacity(0.55)",
                      transition: "filter 0.18s",
                    }} />
                  </div>
                  <div style={{ color: active ? "#f0d060" : "#8a7440", fontSize: isMobile ? 11 : 12, fontWeight: 800, letterSpacing: 1 }}>{c.name}</div>
                  <div style={{ color: "#6a5424", fontSize: isMobile ? 8 : 8.5, letterSpacing: 0.4 }}>{c.tag}</div>
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
              {/* Character art — responsive height so full portrait always shows */}
              <div style={{
                width: "100%",
                height: "clamp(300px, 90vw, 420px)",
                flexShrink: 0,
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse at 50% 85%,rgba(240,180,40,0.09) 0%,transparent 70%)",
                  pointerEvents: "none",
                }} />
                <img
                  key={activeChar.id}
                  src={activeChar.hdImg}
                  alt={activeChar.name}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "contain",
                    objectPosition: "bottom center",
                    filter: "drop-shadow(0 0 28px rgba(240,180,40,0.22))",
                  }}
                />
              </div>

              {/* Info below */}
              <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ color: "#4a3818", fontSize: 10, letterSpacing: 4, marginBottom: 10 }}>YOUR CHARACTER</div>
                <div style={{
                  color: "#f0d060", fontSize: 30, fontWeight: 900, letterSpacing: 3, lineHeight: 1.05,
                  textShadow: "0 0 22px rgba(240,200,60,0.22)",
                }}>THE<br />KEEPER</div>
                <div style={{ width: 46, height: 1, background: "rgba(240,200,60,0.22)", margin: "14px 0" }} />
                <div style={{ color: "#c8bca0", fontSize: 14, lineHeight: 1.7, fontWeight: 300, marginBottom: 14 }}>
                  {activeChar.desc}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                  {activeChar.stats.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ color: "#3a2c14", fontSize: 9, letterSpacing: 2, width: 58 }}>{k}</div>
                      <div style={{ color: "#9a7c40", fontSize: 12, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: "#4a3818", fontSize: 10, letterSpacing: 3, marginBottom: 9 }}>CHOOSE YOUR LOOK</div>
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
              position: "absolute", left: "50%", top: "12%", bottom: "12%",
              width: 1, background: "linear-gradient(to bottom,transparent,rgba(240,200,60,0.15),transparent)",
              pointerEvents: "none",
            }} />

            {/* Left info panel */}
            <div style={{
              position: "relative", zIndex: 2,
              width: "50%", display: "flex", flexDirection: "column",
              justifyContent: "center", padding: "0 4% 0 7%",
            }}>
              <div style={{ color: "#4a3818", fontSize: 8, letterSpacing: 4, marginBottom: 14 }}>YOUR CHARACTER</div>
              <div style={{
                color: "#f0d060", fontSize: 28, fontWeight: 900, letterSpacing: 3, lineHeight: 1.05,
                textShadow: "0 0 22px rgba(240,200,60,0.22)",
              }}>THE<br />KEEPER</div>
              <div style={{ width: 46, height: 1, background: "rgba(240,200,60,0.22)", margin: "20px 0" }} />
              <div style={{ color: "#c8bca0", fontSize: 11, lineHeight: 1.85, fontWeight: 300, maxWidth: 320 }}>
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
                  marginTop: 24, width: "100%", maxWidth: 260, padding: "11px 0",
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
              right: 0, top: 0, bottom: 0, width: "54%",
              display: "flex", alignItems: "flex-end",
              justifyContent: "center", overflow: "hidden",
            }}>
              <img
                key={activeChar.id}
                src={activeChar.hdImg}
                alt="Your Keeper"
                style={{ height: "min(88%, 520px)", objectFit: "contain", objectPosition: "bottom center", filter: "drop-shadow(-2px 0 36px rgba(240,180,40,0.18))" }}
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
