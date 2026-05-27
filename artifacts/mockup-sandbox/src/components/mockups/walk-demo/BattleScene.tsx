import { useEffect, useRef, useState } from "react";

export type MonRarity = "common" | "uncommon" | "rare" | "ultra" | "apex";

export type MonSpec = {
  id: string;
  name: string;
  type: string;
  rarity: MonRarity;
  wildImg: string;
  playerImg: string;
  wildFaces: "left" | "right";
  playerFaces: "left" | "right";
  maxHp: number;
  baseDmg: [number, number];
};

export type StarterSpec = {
  id: string;
  name: string;
  type: string;
  color: string;
  img: string;
  maxHp?: number;
};

export const RARITY_COLOR: Record<MonRarity, string> = {
  common:   "#e8e8e8",
  uncommon: "#5ad06a",
  rare:     "#4a90ff",
  ultra:    "#b070ff",
  apex:     "#ffc830",
};

const RARITY_LABEL: Record<MonRarity, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", ultra: "Ultra", apex: "Apex",
};

type Outcome = "trap" | "curious" | "critical" | "perfect";
const SHELL_OUTCOMES: { kind: Outcome; weight: number; pct: number; flavor: string }[] = [
  { kind: "trap",     weight: 55, pct: 0.87, flavor: "You set it down — the shell sits open like a trap." },
  { kind: "curious",  weight: 30, pct: 0.92, flavor: "You toss the shell near it. Curiosity gets the better of it…" },
  { kind: "critical", weight: 12, pct: 0.97, flavor: "Critical! The shell lands right beside it." },
  { kind: "perfect",  weight:  3, pct: 1.00, flavor: "Perfect! The shell lands at its feet." },
];

function rollOutcome(hpFrac: number): typeof SHELL_OUTCOMES[number] {
  // HP-band boosts critical/perfect odds the lower the mon is
  let bias = 0;
  if (hpFrac < 0.30) bias = 18;
  else if (hpFrac < 0.60) bias = 10;
  else if (hpFrac < 0.90) bias = 4;
  const weights = SHELL_OUTCOMES.map((o, i) =>
    i >= 2 ? o.weight + bias : Math.max(o.weight - bias / 2, 1)
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SHELL_OUTCOMES.length; i++) {
    r -= weights[i];
    if (r <= 0) return SHELL_OUTCOMES[i];
  }
  return SHELL_OUTCOMES[0];
}

export type BattleResult =
  | { kind: "caught"; mon: MonSpec }
  | { kind: "fled" }
  | { kind: "fainted" }
  | { kind: "ko"; mon: MonSpec };

type Props = {
  wild: MonSpec;
  starter: StarterSpec;
  hasResonanceStone: boolean;
  healingRuneEquipped: boolean;
  shellsCount: number;
  onConsumeShell: () => void;
  onConsumeRune: () => void;
  onEnd: (r: BattleResult) => void;
};

type Menu = "root" | "shellConfirm" | "ended";

const BTN_BG    = "linear-gradient(180deg, rgba(60,40,20,0.92), rgba(36,22,10,0.92))";
const BTN_BG_HI = "linear-gradient(180deg, rgba(90,62,30,0.96), rgba(56,36,16,0.96))";

export function BattleScene({
  wild, starter, hasResonanceStone, healingRuneEquipped,
  shellsCount, onConsumeShell, onConsumeRune, onEnd,
}: Props) {
  const playerMaxHp = starter.maxHp ?? 40;
  const [playerHp, setPlayerHp]   = useState(playerMaxHp);
  const [wildHp,   setWildHp]     = useState(wild.maxHp);
  const [log,      setLog]        = useState<string>(`A wild ${wild.name} appears!`);
  const [busy,     setBusy]       = useState(true);
  const [menu,     setMenu]       = useState<Menu>("root");
  const [healCd,   setHealCd]     = useState(0);              // turns remaining
  const [runeUses, setRuneUses]   = useState(healingRuneEquipped ? 3 : 0);
  const [resBar,   setResBar]     = useState(0);              // 0..15
  const [intro,    setIntro]      = useState(true);
  const [shake,    setShake]      = useState<"player" | "wild" | null>(null);
  const tRef = useRef<number[]>([]);

  useEffect(() => {
    const t1 = window.setTimeout(() => { setIntro(false); setBusy(false); }, 1100);
    tRef.current.push(t1);
    return () => { tRef.current.forEach(clearTimeout); };
  }, []);

  function later(fn: () => void, ms: number) {
    const t = window.setTimeout(fn, ms);
    tRef.current.push(t);
    return t;
  }

  function dmgRange(base: [number, number], starterBonus = 0): number {
    const [lo, hi] = base;
    return Math.max(1, Math.floor(lo + Math.random() * (hi - lo + 1)) + starterBonus);
  }

  function wildTurn(afterCb?: () => void) {
    later(() => {
      const dmg = dmgRange(wild.baseDmg);
      setShake("player");
      later(() => setShake(null), 220);
      setPlayerHp(hp => {
        const next = Math.max(0, hp - dmg);
        setLog(`${wild.name} hits for ${dmg}!`);
        setResBar(b => Math.min(15, b + 5));
        if (next === 0) {
          later(() => {
            setLog(`${starter.name} fainted…`);
            if (healingRuneEquipped) {
              // Passive 50% post-battle revive
              later(() => onEnd({ kind: "fainted" }), 900);
            } else {
              later(() => onEnd({ kind: "fainted" }), 900);
            }
          }, 700);
        } else {
          later(() => {
            if (healCd > 0) setHealCd(c => c - 1);
            setBusy(false);
            afterCb?.();
          }, 520);
        }
        return next;
      });
    }, 560);
  }

  function playerHit(dmg: number, msg: string, afterCb?: () => void) {
    setBusy(true);
    setShake("wild");
    later(() => setShake(null), 220);
    setLog(msg);
    setWildHp(hp => {
      const next = Math.max(0, hp - dmg);
      setResBar(b => Math.min(15, b + 5));
      if (next === 0) {
        later(() => {
          setLog(`${wild.name} fainted! Your ${starter.name} gains full XP.`);
          setMenu("ended");
          later(() => onEnd({ kind: "ko", mon: wild }), 1100);
        }, 650);
      } else {
        wildTurn(afterCb);
      }
      return next;
    });
  }

  function onFight() {
    if (busy) return;
    // Starter +3-5 damage bonus
    const dmg = dmgRange([4, 9], 3 + Math.floor(Math.random() * 3));
    playerHit(dmg, `${starter.name} attacks for ${dmg}!`);
  }

  function onHeal() {
    if (busy || healCd > 0) return;
    setBusy(true);
    const before = playerHp;
    const heal   = Math.floor(playerMaxHp * 0.5);
    const next   = Math.min(playerMaxHp, before + heal);
    setPlayerHp(next);
    setLog(`${starter.name} recovers ${next - before} HP!`);
    setHealCd(2);
    later(() => wildTurn(), 700);
  }

  function onRune() {
    if (busy) return;
    if (!healingRuneEquipped) { setLog("No rune equipped."); return; }
    if (runeUses <= 0)        { setLog("Rune is spent for this battle."); return; }
    setBusy(true);
    const heal = Math.floor(playerMaxHp * 0.25);
    const next = Math.min(playerMaxHp, playerHp + heal);
    setPlayerHp(next);
    setRuneUses(u => u - 1);
    setLog(`Healing Rune pulses — ${next - playerHp} HP restored.`);
    later(() => wildTurn(), 700);
  }

  function onResonate() {
    if (busy) return;
    if (!hasResonanceStone) { setLog("You have no Resonance Stone equipped."); return; }
    if (resBar < 15)        { setLog(`Resonance not ready (${resBar}/15).`); return; }
    setResBar(0);
    if (starter.type === "Spirit") {
      // Fae-like: revival/cleanse — heals fully
      setBusy(true);
      setPlayerHp(playerMaxHp);
      setLog(`Spirit Resonance — ${starter.name} is fully restored!`);
      later(() => wildTurn(), 800);
      return;
    }
    const dmg = 5 + Math.floor(Math.random() * 11); // 5-15
    playerHit(dmg, `${starter.type} Resonance bursts! ${dmg} damage!`);
  }

  function onFlee() {
    if (busy) return;
    setBusy(true);
    if (Math.random() < 0.70) {
      setLog("You slip away…");
      setMenu("ended");
      later(() => onEnd({ kind: "fled" }), 800);
    } else {
      setLog("Couldn't escape!");
      wildTurn();
    }
  }

  function onShell() {
    if (busy) return;
    if (shellsCount <= 0) { setLog("No Worn Realm Shells left."); return; }
    setMenu("shellConfirm");
  }

  function doShellThrow() {
    setMenu("root");
    setBusy(true);
    onConsumeShell();
    const hpFrac = wildHp / wild.maxHp;
    const outcome = rollOutcome(hpFrac);
    setLog(outcome.flavor);
    later(() => {
      const caught = Math.random() < outcome.pct;
      if (caught) {
        setLog(`Bond formed! ${wild.name} joins you — fully healed.`);
        setMenu("ended");
        // Worn shells: +10% XP, instant full heal on capture (handled at parent)
        later(() => onEnd({ kind: "caught", mon: wild }), 1200);
      } else {
        setLog(`${wild.name} broke free!`);
        wildTurn();
      }
    }, 1100);
  }

  // ── render
  const wildScaleX   = wild.wildFaces === "left"   ? 1 : -1; // we want wild facing left toward player
  const playerScaleX = wild.playerFaces === "right" ? 1 : -1; // we want player-side facing right toward wild
  // (Hatchick uses wild.png as "wild facing" — already correct in our naming convention.)
  // Actually wildImg/playerImg are pre-assigned; we just trust the data here.
  const wildShake   = shake === "wild"   ? "shakeFx 0.22s" : "none";
  const playerShake = shake === "player" ? "shakeFx 0.22s" : "none";

  return (
    <div style={{
      position:"absolute", inset:0,
      background:"#000",
      display:"flex", flexDirection:"column",
      overflow:"hidden",
    }}>
      {/* Battle stage */}
      <div style={{
        position:"relative", flex:1, minHeight:0,
        backgroundImage:"url(/__mockup/images/forest-arena.png)",
        backgroundSize:"cover", backgroundPosition:"center",
        backgroundColor:"#142010",
        overflow:"hidden",
      }}>
        {/* Wild HP plate (top-left) */}
        <div style={hpPlateStyle("left")}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>{wild.name}</span>
            <span style={{
              color: RARITY_COLOR[wild.rarity], fontSize:9, fontWeight:700,
              padding:"1px 6px", borderRadius:8,
              border:`1px solid ${RARITY_COLOR[wild.rarity]}`,
              background:"rgba(0,0,0,0.4)",
              textTransform:"uppercase", letterSpacing:1,
            }}>{RARITY_LABEL[wild.rarity]}</span>
          </div>
          <HpBar hp={wildHp} max={wild.maxHp} />
          <div style={{ color:"#a8c0d0", fontSize:9, marginTop:2 }}>{wild.type}</div>
        </div>

        {/* Player HP plate (bottom-right) */}
        <div style={hpPlateStyle("right")}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>{starter.name}</span>
            <span style={{ color:"#aaa", fontSize:9 }}>Lv.5</span>
          </div>
          <HpBar hp={playerHp} max={playerMaxHp} />
          <div style={{ color: starter.color, fontSize:9, marginTop:2 }}>{starter.type}</div>
        </div>

        {/* Wild sprite — top-right */}
        <div style={{
          position:"absolute", right:"6%", top:"12%",
          width:"42%", maxWidth:200, aspectRatio:"1",
          animation: intro ? "introFloat 1.1s ease-out" : (wildShake || "none"),
          opacity: wildHp === 0 ? 0.25 : 1,
          transition:"opacity 0.6s",
        }}>
          <img src={wild.wildImg} alt={wild.name} style={{
            width:"100%", height:"100%", objectFit:"contain",
            transform: wild.wildFaces === "left" ? "none" : "scaleX(-1)",
            filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
          }}/>
        </div>

        {/* Player sprite — bottom-left */}
        <div style={{
          position:"absolute", left:"4%", bottom:"22%",
          width:"46%", maxWidth:220, aspectRatio:"1",
          animation: intro ? "introSlide 1.1s ease-out" : (playerShake || "none"),
        }}>
          <img src={starter.img} alt={starter.name} style={{
            width:"100%", height:"100%", objectFit:"contain",
            transform: "scaleX(-1)",
            filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
          }}/>
        </div>

        {/* Resonance bar (mini, above HP plates) */}
        {hasResonanceStone && (
          <div style={{
            position:"absolute", right:8, bottom:6,
            width:120, padding:"3px 6px",
            background:"rgba(0,0,0,0.55)",
            borderRadius:8,
            border:"1px solid rgba(120,160,240,0.4)",
          }}>
            <div style={{ color:"#a8c0ff", fontSize:8, fontWeight:700, letterSpacing:1 }}>
              RESONANCE {resBar}/15
            </div>
            <div style={{
              height:5, background:"rgba(0,0,0,0.5)", borderRadius:3, marginTop:2,
              overflow:"hidden",
            }}>
              <div style={{
                height:"100%",
                width:`${(resBar / 15) * 100}%`,
                background: resBar >= 15
                  ? "linear-gradient(90deg, #80b0ff, #c0e0ff)"
                  : "linear-gradient(90deg, #406090, #6080c0)",
                transition:"width 0.4s",
              }}/>
            </div>
          </div>
        )}
      </div>

      {/* Log + menu */}
      <div style={{
        flexShrink:0,
        background:"linear-gradient(180deg, rgba(20,12,6,0.96), rgba(8,4,2,0.98))",
        borderTop:"2px solid rgba(180,130,60,0.5)",
        padding:"8px 10px 10px",
      }}>
        <div style={{
          color:"#f0d890", fontSize:12, lineHeight:1.4, minHeight:32,
          padding:"6px 8px",
          background:"rgba(0,0,0,0.35)",
          borderRadius:6,
          border:"1px solid rgba(120,80,30,0.35)",
        }}>{log}</div>

        {menu === "shellConfirm" ? (
          <div style={{ display:"flex", gap:6, marginTop:8 }}>
            <button onClick={doShellThrow} style={confirmBtn("#4a8a4a")}>
              Throw Shell ({shellsCount})
            </button>
            <button onClick={() => setMenu("root")} style={confirmBtn("#7a3a3a")}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(4, 1fr)",
            gap:5, marginTop:8,
          }}>
            <BattleBtn label="Fight"    sub="atk"           disabled={busy} onClick={onFight}/>
            <BattleBtn label="Resonate" sub={hasResonanceStone ? `${resBar}/15` : "locked"} disabled={busy || !hasResonanceStone || resBar < 15} onClick={onResonate}/>
            <BattleBtn label="Shell"    sub={`×${shellsCount}`} disabled={busy || shellsCount <= 0} onClick={onShell}/>
            <BattleBtn label="Heal"     sub={healCd > 0 ? `CD ${healCd}` : "50%"} disabled={busy || healCd > 0} onClick={onHeal}/>
            <BattleBtn label="Rune"     sub={healingRuneEquipped ? `×${runeUses}` : "—"} disabled={busy || !healingRuneEquipped || runeUses <= 0} onClick={onRune}/>
            <BattleBtn label="Flee"     sub="70%"           disabled={busy} onClick={onFlee}/>
            <BattleBtn label="Bag"      sub="soon"          disabled placeholder onClick={() => {}}/>
            <BattleBtn label="—"        sub=""              disabled placeholder onClick={() => {}}/>
          </div>
        )}
      </div>

      <style>{`
        @keyframes introSlide { 0%{transform:translateX(-200px);opacity:0} 100%{transform:translateX(0);opacity:1} }
        @keyframes introFloat { 0%{transform:translateY(-30px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes shakeFx    { 0%{transform:translate(0,0)} 25%{transform:translate(-4px,2px)} 50%{transform:translate(4px,-2px)} 75%{transform:translate(-3px,1px)} 100%{transform:translate(0,0)} }
      `}</style>
    </div>
  );

  function hpPlateStyle(side: "left" | "right"): React.CSSProperties {
    return {
      position:"absolute",
      top: side === "left" ? 10 : "auto",
      bottom: side === "right" ? "26%" : "auto",
      left: side === "left"  ? 8 : "auto",
      right: side === "right" ? 8 : "auto",
      padding:"6px 10px",
      background:"linear-gradient(180deg, rgba(28,20,10,0.94), rgba(14,8,4,0.94))",
      border:"1.5px solid rgba(180,130,60,0.5)",
      borderRadius:8,
      minWidth:140,
      boxShadow:"0 2px 8px rgba(0,0,0,0.5)",
    };
  }
}

function HpBar({ hp, max }: { hp: number; max: number }) {
  const frac = hp / max;
  const color = frac > 0.5 ? "#5acc5a" : frac > 0.25 ? "#e8c040" : "#e85a4a";
  return (
    <div>
      <div style={{
        height:7, borderRadius:4,
        background:"rgba(0,0,0,0.5)",
        border:"1px solid rgba(120,80,30,0.5)",
        overflow:"hidden",
      }}>
        <div style={{
          height:"100%", width:`${Math.max(0, frac) * 100}%`,
          background: color,
          transition:"width 0.4s, background 0.4s",
        }}/>
      </div>
      <div style={{ color:"#d0c090", fontSize:9, marginTop:2, fontWeight:700 }}>
        {hp}/{max}
      </div>
    </div>
  );
}

function BattleBtn({
  label, sub, disabled, placeholder, onClick,
}: { label: string; sub: string; disabled?: boolean; placeholder?: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:"7px 4px",
        background: placeholder ? "rgba(20,12,6,0.6)" : (disabled ? BTN_BG : BTN_BG_HI),
        border:`1.5px solid ${placeholder ? "rgba(80,60,30,0.3)" : "rgba(180,130,60,0.55)"}`,
        borderRadius:7,
        color: placeholder ? "rgba(160,130,80,0.35)" : (disabled ? "#7a6438" : "#f0d890"),
        fontSize:11, fontWeight:800,
        cursor: disabled ? "default" : "pointer",
        display:"flex", flexDirection:"column", alignItems:"center", gap:1,
        opacity: disabled && !placeholder ? 0.55 : 1,
        minHeight:42,
      }}
    >
      <span>{label}</span>
      {sub && <span style={{ fontSize:9, fontWeight:600, opacity:0.75 }}>{sub}</span>}
    </button>
  );
}

function confirmBtn(color: string): React.CSSProperties {
  return {
    flex:1, padding:"10px",
    background:`linear-gradient(180deg, ${color}, ${color}aa)`,
    border:"1.5px solid rgba(240,216,144,0.5)",
    borderRadius:8,
    color:"#fff", fontSize:13, fontWeight:800,
    cursor:"pointer",
  };
}
