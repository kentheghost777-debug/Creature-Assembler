export function BattleScene() {
  const LoyaltyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="#f0c040" stroke="#f0c040" strokeWidth="1" />
      <circle cx="12" cy="12" r="3" fill="#fff8d0" opacity="0.7" />
    </svg>
  );

  const HpBar = ({ current, max, color }: { current: number; max: number; color: string }) => (
    <div style={{ background: "#1a1a1a", borderRadius: 4, height: 10, width: "100%", border: "1px solid #333", overflow: "hidden" }}>
      <div style={{ width: `${(current / max) * 100}%`, background: color, height: "100%", borderRadius: 3, transition: "width 0.3s" }} />
    </div>
  );

  const HudPanel = ({
    name,
    form,
    level,
    hp,
    maxHp,
    rp,
    maxRp,
    portrait,
    align,
    hpColor,
  }: {
    name: string;
    form: string;
    level: number;
    hp: number;
    maxHp: number;
    rp: number;
    maxRp: number;
    portrait: string;
    align: "left" | "right";
    hpColor: string;
  }) => (
    <div style={{
      position: "absolute",
      top: 14,
      ...(align === "left" ? { left: 14 } : { right: 14 }),
      width: 280,
      background: "linear-gradient(135deg, rgba(12,10,20,0.92) 0%, rgba(25,20,40,0.88) 100%)",
      border: "1px solid rgba(180,140,60,0.45)",
      borderRadius: 8,
      padding: "10px 14px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,220,100,0.1)",
      fontFamily: "'Cinzel', serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 6, overflow: "hidden",
          border: "2px solid rgba(180,140,60,0.6)",
          boxShadow: "0 0 8px rgba(180,140,60,0.3)",
          flexShrink: 0, background: "#111"
        }}>
          <img src={portrait} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: align === "left" ? "center top" : "center top" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <span style={{ color: "#f0e0a0", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <LoyaltyIcon />
            <span style={{ color: "#c8a840", fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{form}</span>
            <span style={{ marginLeft: "auto", color: "#888", fontSize: 10 }}>Lv. {level}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: "#60c860", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>HP</span>
          <span style={{ color: "#888", fontSize: 10 }}>{hp} / {maxHp}</span>
        </div>
        <HpBar current={hp} max={maxHp} color={hpColor} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: "#8080e0", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>RP</span>
          <span style={{ color: "#888", fontSize: 10 }}>{rp} / {maxRp}</span>
        </div>
        <HpBar current={rp} max={maxRp} color="#6060d0" />
      </div>

      <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            width: 16, height: 16,
            border: i < 3 ? "1.5px solid rgba(180,140,60,0.8)" : "1.5px solid rgba(100,100,100,0.4)",
            borderRadius: 3,
            background: i < 3 ? "rgba(180,140,60,0.15)" : "rgba(40,40,40,0.4)",
            transform: "rotate(45deg)",
          }} />
        ))}
      </div>
    </div>
  );

  const menuItems = [
    { label: "FIGHT", icon: "⚔️", active: true },
    { label: "SKILLS", icon: "✦" },
    { label: "RESONANCE", icon: "◈" },
    { label: "SHELLS", icon: "🐚" },
    { label: "RUN", icon: "↩" },
  ];

  const moves = [
    { name: "Frost Slam", cost: 6 },
    { name: "Crystal Surge", cost: 8 },
    { name: "Glacial Guard", cost: 10 },
    { name: "Blizzard Roar", cost: 12 },
  ];

  return (
    <div style={{
      width: 1280,
      height: 800,
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Cinzel', serif",
    }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&display=swap"
      />

      {/* Background */}
      <img
        src="/images/forest-arena.png"
        alt="Forest Arena"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Subtle vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)",
        pointerEvents: "none",
      }} />

      {/* ── SPRITES LAYER ── */}

      {/* Kinju — far left edge, behind bear, faces right */}
      <img
        src="/images/kinju.png"
        alt="Kinju"
        style={{
          position: "absolute",
          bottom: 148,
          left: 28,
          height: 210,
          width: "auto",
          objectFit: "contain",
          zIndex: 2,
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.8))",
        }}
      />

      {/* Frostbite (bear) — on yellow circle (left), flipped to face right */}
      <img
        src="/images/polar-bear.png"
        alt="Frostbite"
        style={{
          position: "absolute",
          bottom: 138,
          left: 155,
          height: 330,
          width: "auto",
          objectFit: "contain",
          zIndex: 3,
          transform: "scaleX(-1)",
          filter: "drop-shadow(0 8px 24px rgba(100,180,255,0.35)) drop-shadow(0 4px 12px rgba(0,0,0,0.8))",
        }}
      />

      {/* Grr-ountain (ape) — on blue circle (right), faces left (already fine) */}
      <img
        src="/images/stone-ape.png"
        alt="Grr-ountain"
        style={{
          position: "absolute",
          bottom: 138,
          right: 155,
          height: 340,
          width: "auto",
          objectFit: "contain",
          zIndex: 3,
          transform: "scaleX(1)",
          filter: "drop-shadow(0 8px 24px rgba(80,200,80,0.3)) drop-shadow(0 4px 12px rgba(0,0,0,0.8))",
        }}
      />

      {/* Prof Irwyn — far right edge, behind ape, faces left (flipped) */}
      <img
        src="/images/prof-irwyn.png"
        alt="Prof Irwyn"
        style={{
          position: "absolute",
          bottom: 148,
          right: 28,
          height: 200,
          width: "auto",
          objectFit: "contain",
          zIndex: 2,
          transform: "scaleX(-1)",
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.8))",
        }}
      />

      {/* ── HUD PANELS ── */}
      <HudPanel
        name="Frostbite"
        form="Loyalty"
        level={38}
        hp={180}
        maxHp={180}
        rp={200}
        maxRp={200}
        portrait="/images/polar-bear.png"
        align="left"
        hpColor="#40c0f0"
      />

      <HudPanel
        name="Grr-ountain"
        form="Loyalty"
        level={45}
        hp={210}
        maxHp={210}
        rp={200}
        maxRp={200}
        portrait="/images/stone-ape.png"
        align="right"
        hpColor="#70c840"
      />

      {/* ── BOTTOM UI ── */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 148,
        display: "flex",
        gap: 0,
      }}>

        {/* Action Menu */}
        <div style={{
          width: 200,
          background: "linear-gradient(135deg, rgba(8,6,16,0.96) 0%, rgba(20,16,35,0.93) 100%)",
          border: "1px solid rgba(180,140,60,0.35)",
          borderRight: "none",
          borderBottomLeftRadius: 0,
          padding: "10px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}>
          {menuItems.map((item, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 18px",
              background: item.active ? "rgba(180,140,60,0.18)" : "transparent",
              borderLeft: item.active ? "3px solid #c8a840" : "3px solid transparent",
              cursor: "pointer",
            }}>
              <span style={{ fontSize: 13, width: 18, textAlign: "center", opacity: 0.85 }}>{item.icon}</span>
              <span style={{
                color: item.active ? "#f0e0a0" : "#aaa",
                fontSize: 12,
                fontWeight: item.active ? 700 : 400,
                letterSpacing: 1.2,
                fontFamily: "'Cinzel', serif",
              }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Flavor Text */}
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, rgba(8,6,16,0.94) 0%, rgba(18,14,30,0.91) 100%)",
          border: "1px solid rgba(180,140,60,0.35)",
          borderLeft: "none",
          borderRight: "none",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <p style={{
            color: "#d4c48a",
            fontSize: 13.5,
            lineHeight: 1.65,
            fontFamily: "'Cinzel', serif",
            fontWeight: 400,
            margin: 0,
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            The ancient Grr-ountain looms from across the path.<br />
            Frostbite stands firm — crystals glowing, claws ready.<br />
            Kinju gives a quiet nod. The earth holds its breath.
          </p>
        </div>

        {/* Move List */}
        <div style={{
          width: 264,
          background: "linear-gradient(135deg, rgba(8,6,16,0.96) 0%, rgba(20,16,35,0.93) 100%)",
          border: "1px solid rgba(180,140,60,0.35)",
          borderLeft: "none",
          padding: "10px 0",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}>
          <div style={{ padding: "4px 18px 6px", borderBottom: "1px solid rgba(180,140,60,0.2)", marginBottom: 2 }}>
            <span style={{ color: "#c8a840", fontSize: 10, letterSpacing: 1.5, fontWeight: 600 }}>FROSTBITE</span>
          </div>
          {moves.map((move, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 18px",
              borderLeft: i === 0 ? "3px solid #40c0f0" : "3px solid transparent",
              background: i === 0 ? "rgba(64,192,240,0.08)" : "transparent",
            }}>
              <span style={{ color: i === 0 ? "#e0f6ff" : "#aaa", fontSize: 12, letterSpacing: 0.5 }}>{move.name}</span>
              <span style={{
                color: "#8080e0",
                fontSize: 10,
                fontWeight: 600,
                background: "rgba(80,80,180,0.2)",
                border: "1px solid rgba(80,80,180,0.35)",
                borderRadius: 4,
                padding: "2px 7px",
                letterSpacing: 0.5,
              }}>RP {move.cost}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Turn indicator */}
      <div style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(8,6,16,0.88)",
        border: "1px solid rgba(180,140,60,0.45)",
        borderRadius: 20,
        padding: "4px 18px",
        color: "#c8a840",
        fontSize: 11,
        letterSpacing: 2,
        fontWeight: 600,
        fontFamily: "'Cinzel', serif",
        boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
      }}>
        TURN 01
      </div>
    </div>
  );
}
