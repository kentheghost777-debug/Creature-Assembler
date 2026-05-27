import { useEffect, useRef, useState } from "react";
import { ELEMENT_COLOR } from "./progression";

// Maps a mon's type string (which may or may not be a catalogued Element)
// to a usable accent color. Falls back to warm gold for unknown types.
function typeColor(type: string): string {
  return (ELEMENT_COLOR as Record<string, string>)[type] ?? "#ffe080";
}

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
  /** Optional glyph rendered after the name (e.g. "☯" for Wyvrunt) with
   *  a golden glow halo to mark a unique/loyal-only mon. */
  nameIcon?: string;
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
  | { kind: "caught";  mon: MonSpec; shellsThrown: number; xpGained: number }
  | { kind: "fled";    shellsThrown: number }
  | { kind: "fainted"; shellsThrown: number }
  | { kind: "ko";      mon: MonSpec; shellsThrown: number; xpGained: number };

export type StarterStats = { hp: number; atk: number; def: number; spd: number };

type Props = {
  wild: MonSpec;
  starter: StarterSpec;
  starterLevel: number;
  starterStats: StarterStats;
  hasResonanceStone: boolean;
  healingRuneEquipped: boolean;
  shellsCount: number;
  onConsumeShell: () => void;
  onConsumeRune: () => void;
  onEnd: (r: BattleResult) => void;
};

// XP rewards: half the wild's maxHp on KO, ×1.10 on capture.
function xpFor(wild: MonSpec, caught: boolean): number {
  const base = Math.max(4, Math.round(wild.maxHp / 2));
  return caught ? Math.round(base * 1.10) : base;
}

type Menu = "root" | "shellConfirm" | "ended";

const BTN_BG    = "linear-gradient(180deg, rgba(60,40,20,0.92), rgba(36,22,10,0.92))";
const BTN_BG_HI = "linear-gradient(180deg, rgba(90,62,30,0.96), rgba(56,36,16,0.96))";

export function BattleScene({
  wild, starter, starterLevel, starterStats, hasResonanceStone, healingRuneEquipped,
  shellsCount, onConsumeShell, onConsumeRune, onEnd,
}: Props) {
  const playerMaxHp = starterStats.hp;
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
  const [shellsThrown, setShellsThrown] = useState(0);
  const shellsThrownRef = useRef(0);
  const tRef = useRef<number[]>([]);

  // ── FX layer state ────────────────────────────────────────────────────
  type AttackFx = { from: "player" | "wild"; color: string; id: number };
  type DmgFx    = { at: "player" | "wild"; value: number; crit?: boolean; id: number };
  type ShellFx  = { phase: "throw" | "wobble" | "caught" | "break"; id: number };
  type AuxFx    = { kind: "heal" | "rune" | "resonate" | "feint";
                    color?: string; at?: "player" | "wild"; id: number };
  const [attackFx, setAttackFx] = useState<AttackFx | null>(null);
  const [dmgFx,    setDmgFx]    = useState<DmgFx    | null>(null);
  const [shellFx,  setShellFx]  = useState<ShellFx  | null>(null);
  const [auxFx,    setAuxFx]    = useState<AuxFx    | null>(null);
  const fxIdRef = useRef(1);
  const nextFxId = () => ++fxIdRef.current;

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

  // ── FX triggers ───────────────────────────────────────────────────────
  // Each trigger sets a keyed fx record so CSS animations replay even when
  // the same effect fires back-to-back. The fx auto-clears after its
  // animation window (no React-state churn during the animation itself).
  function triggerAttack(from: "player" | "wild", color: string) {
    const id = nextFxId();
    setAttackFx({ from, color, id });
    later(() => setAttackFx(curr => (curr?.id === id ? null : curr)), 750);
  }
  function showDmg(at: "player" | "wild", value: number) {
    const id = nextFxId();
    setDmgFx({ at, value, id });
    later(() => setDmgFx(curr => (curr?.id === id ? null : curr)), 950);
  }
  function triggerAux(
    kind: AuxFx["kind"], color?: string, at?: "player" | "wild", ms = 900,
  ) {
    const id = nextFxId();
    setAuxFx({ kind, color, at, id });
    later(() => setAuxFx(curr => (curr?.id === id ? null : curr)), ms);
  }

  function dmgRange(base: [number, number], starterBonus = 0): number {
    const [lo, hi] = base;
    return Math.max(1, Math.floor(lo + Math.random() * (hi - lo + 1)) + starterBonus);
  }

  function wildTurn(afterCb?: () => void) {
    later(() => {
      // Defense soaks 1 dmg per 2 def points, min 1 dmg
      const raw = dmgRange(wild.baseDmg);
      const dmg = Math.max(1, raw - Math.floor(starterStats.def / 2));
      triggerAttack("wild", typeColor(wild.type));
      // Apply HP/log/shake/dmg-number all at the impact moment so the bar
      // tick, log line, and visuals land on the same frame.
      later(() => {
        setShake("player");
        showDmg("player", dmg);
        setLog(`${wild.name} hits for ${dmg}!`);
        setResBar(b => Math.min(15, b + 5));
      }, 300);
      later(() => setShake(null), 520);
      later(() => {
        setPlayerHp(hp => {
          const next = Math.max(0, hp - dmg);
          if (next === 0) {
            later(() => {
              setLog(`${starter.name} fainted…`);
              later(() => onEnd({ kind: "fainted", shellsThrown: shellsThrownRef.current }), 900);
            }, 700);
          } else {
            later(() => {
              setHealCd(c => Math.max(0, c - 1));
              setBusy(false);
              afterCb?.();
            }, 520);
          }
          return next;
        });
      }, 300);
    }, 560);
  }

  function playerHit(dmg: number, msg: string, afterCb?: () => void) {
    setBusy(true);
    // Sync HP / log / shake / damage number to the impact frame (~300ms in)
    later(() => setShake(null), 520);
    later(() => {
      setShake("wild");
      showDmg("wild", dmg);
      setLog(msg);
      setWildHp(hp => {
        const next = Math.max(0, hp - dmg);
        setResBar(b => Math.min(15, b + 5));
        if (next === 0) {
          const xp = xpFor(wild, false);
          later(() => {
            setLog(`${wild.name} fainted! ${starter.name} gains ${xp} XP.`);
            setMenu("ended");
            later(() => onEnd({ kind: "ko", mon: wild, shellsThrown: shellsThrownRef.current, xpGained: xp }), 1100);
          }, 650);
        } else {
          wildTurn(afterCb);
        }
        return next;
      });
    }, 300);
  }

  function onFight() {
    if (busy) return;
    setBusy(true);
    triggerAttack("player", typeColor(starter.type));
    // 10% chance the wild slips the strike entirely
    if (Math.random() < 0.10) {
      later(() => {
        triggerAux("feint", undefined, "wild", 750);
        setLog(`${wild.name} feinted away — the strike missed!`);
        later(() => wildTurn(), 650);
      }, 320);
      return;
    }
    // Damage scales off atk: roll [atk, atk+5] with a small variance bonus
    const dmg = dmgRange([starterStats.atk, starterStats.atk + 5], Math.floor(Math.random() * 2));
    later(() => playerHit(dmg, `${starter.name} attacks for ${dmg}!`), 280);
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
    triggerAux("heal", "#80ff80", "player", 1000);
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
    triggerAux("rune", "#80ffc0", "player", 950);
    later(() => wildTurn(), 700);
  }

  function onResonate() {
    if (busy) return;
    if (!hasResonanceStone) { setLog("You have no Resonance Stone equipped."); return; }
    if (resBar < 15)        { setLog(`Resonance not ready (${resBar}/15).`); return; }
    setBusy(true);  // lock input immediately — FX delays would otherwise leak a turn
    setResBar(0);
    const resColor = typeColor(starter.type);
    triggerAux("resonate", resColor, undefined, 900);
    if (starter.type === "Spirit") {
      // Fae-like: revival/cleanse — heals fully
      setBusy(true);
      setPlayerHp(playerMaxHp);
      setLog(`Spirit Resonance — ${starter.name} is fully restored!`);
      later(() => wildTurn(), 850);
      return;
    }
    const dmg = 5 + Math.floor(Math.random() * 11); // 5-15
    later(() => playerHit(dmg, `${starter.type} Resonance bursts! ${dmg} damage!`), 350);
  }

  function onFlee() {
    if (busy) return;
    setBusy(true);
    if (Math.random() < 0.70) {
      setLog("You slip away…");
      setMenu("ended");
      later(() => onEnd({ kind: "fled", shellsThrown: shellsThrownRef.current }), 800);
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
    shellsThrownRef.current += 1;
    setShellsThrown(shellsThrownRef.current);
    const hpFrac = wildHp / wild.maxHp;
    const outcome = rollOutcome(hpFrac);
    setLog(outcome.flavor);

    // Capture animation timeline:
    //  0ms        shell arcs from keeper toward wild        (throw, 600ms)
    //  600ms      wild absorbed into shell, wobble begins   (wobble, 1500ms)
    //  2100ms     resolve — caught (green burst) / broke    (700ms)
    const seqId = nextFxId();
    setShellFx({ phase: "throw", id: seqId });
    later(() => setShellFx({ phase: "wobble", id: seqId }), 600);

    later(() => {
      const caught = Math.random() < outcome.pct;
      if (caught) {
        setShellFx({ phase: "caught", id: seqId });
        const xp = xpFor(wild, true);
        later(() => {
          setLog(`Bond formed! ${wild.name} joins you — fully healed. (+${xp} XP)`);
          setMenu("ended");
          setShellFx(null);
          later(() => onEnd({
            kind: "caught", mon: wild,
            shellsThrown: shellsThrownRef.current, xpGained: xp,
          }), 900);
        }, 750);
      } else {
        setShellFx({ phase: "break", id: seqId });
        later(() => {
          setShellFx(null);
          setLog(`${wild.name} broke free! (Shell empty — recoverable after battle)`);
          wildTurn();
        }, 700);
      }
    }, 2100);
  }

  // ── render
  const wildScaleX   = wild.wildFaces === "left"   ? 1 : -1; // we want wild facing left toward player
  const playerScaleX = wild.playerFaces === "right" ? 1 : -1; // we want player-side facing right toward wild
  // (Hatchick uses wild.png as "wild facing" — already correct in our naming convention.)
  // Actually wildImg/playerImg are pre-assigned; we just trust the data here.
  const wildShake   = shake === "wild"   ? "shakeFx 0.22s" : "none";
  const playerShake = shake === "player" ? "shakeFx 0.22s" : "none";

  // Derived sprite states for the capture sequence and KO
  const wildAbsorbed = shellFx?.phase === "wobble" || shellFx?.phase === "caught";
  const wildKo       = wildHp === 0;
  const playerKo     = playerHp === 0;
  const wildFlip     = wildScaleX === 1 ? "" : "scaleX(-1)";
  const playerFlip   = playerScaleX === 1 ? "" : "scaleX(-1)";
  const wildExtra =
    wildAbsorbed ? " scale(0.05)" :
    wildKo       ? " translateY(28px) rotate(82deg) scale(0.85)" : "";
  const playerExtra =
    playerKo ? " translateY(20px) rotate(-12deg)" : "";

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
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>
              {wild.name}
              {wild.nameIcon && (
                <span style={{
                  marginLeft:4,
                  color:"#ffe080",
                  textShadow:"0 0 4px #ffb030, 0 0 10px #ffa020, 0 0 2px #fff",
                  filter:"drop-shadow(0 0 3px rgba(255,200,80,0.9))",
                  fontWeight:900,
                }}>{wild.nameIcon}</span>
              )}
            </span>
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
            <span style={{ color:"#aaa", fontSize:9 }}>Lv.{starterLevel}</span>
          </div>
          <HpBar hp={playerHp} max={playerMaxHp} />
          <div style={{ color: starter.color, fontSize:9, marginTop:2 }}>{starter.type}</div>
        </div>

        {/* Wild sprite — top-right */}
        <div style={{
          position:"absolute", right:"6%", top:"12%",
          width:"42%", maxWidth:200, aspectRatio:"1",
          animation: intro ? "introFloat 1.1s ease-out" : (wildShake || "none"),
          opacity: wildAbsorbed ? 0 : (wildHp === 0 ? 0.3 : 1),
          transition:"opacity 0.45s",
        }}>
          <img src={wild.wildImg} alt={wild.name} style={{
            width:"100%", height:"100%", objectFit:"contain",
            // Wild faces WEST (left). Native left-facing => no flip; native right => scaleX(-1).
            transform: (wildFlip + wildExtra).trim() || "none",
            transformOrigin:"center center",
            transition:"transform 0.45s ease-in, opacity 0.45s",
            filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
          }}/>
        </div>

        {/* Side-view stage: Keeper + Tayanari on LEFT facing RIGHT, wild on RIGHT facing LEFT */}
        {/* Keeper — side-facing, left edge of stage */}
        <div style={{
          position:"absolute", left:"3%", bottom:"18%",
          width:"24%", maxWidth:110, aspectRatio:"1",
          animation: intro ? "introSlide 1.1s ease-out" : "none",
          zIndex:2,
        }}>
          <img src="/__mockup/images/walk_side_1.png" alt="Keeper" style={{
            width:"100%", height:"100%", objectFit:"contain",
            filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
            imageRendering:"auto",
          }}/>
        </div>

        {/* Player Tayanari — to the right of Keeper, same ground line, facing right */}
        <div style={{
          position:"absolute", left:"22%", bottom:"16%",
          width:"38%", maxWidth:190, aspectRatio:"1",
          animation: intro ? "introSlide 1.1s ease-out" : (playerShake || "none"),
          animationDelay: intro ? "0.15s" : undefined,
          zIndex:3,
        }}>
          <img src={starter.img} alt={starter.name} style={{
            width:"100%", height:"100%", objectFit:"contain",
            // Keeper-side mon faces EAST (right). Native right-facing sprite => no flip; native left => scaleX(-1).
            transform: (playerFlip + playerExtra).trim() || "none",
            transformOrigin:"center center",
            transition:"transform 0.45s ease-in, opacity 0.45s",
            filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
          }}/>
        </div>

        {/* ── FX OVERLAY ──────────────────────────────────────────────── */}
        {/* Attack streak + impact burst */}
        {attackFx && (
          <div key={`atk-${attackFx.id}`} style={{
            position:"absolute", inset:0, pointerEvents:"none", zIndex:5,
          }}>
            <div style={{
              position:"absolute",
              ...(attackFx.from === "player"
                ? { left:"32%", top:"42%" }
                : { right:"24%", top:"32%" }),
              width:80, height:6, borderRadius:3,
              background:`linear-gradient(90deg, transparent, ${attackFx.color}, #ffffff, ${attackFx.color}, transparent)`,
              filter:`drop-shadow(0 0 10px ${attackFx.color})`,
              transformOrigin: attackFx.from === "player" ? "left center" : "right center",
              animation: `${attackFx.from === "player" ? "slashRight" : "slashLeft"} 0.45s ease-out forwards`,
            }}/>
            <div style={{
              position:"absolute",
              ...(attackFx.from === "player"
                ? { right:"18%", top:"22%" }
                : { left:"30%", bottom:"32%" }),
              width:70, height:70,
              borderRadius:"50%",
              background:`radial-gradient(circle, #ffffff 0%, ${attackFx.color} 30%, transparent 72%)`,
              transform:"translate(-50%,-50%) scale(0)",
              animation:"burstFx 0.55s ease-out 0.32s forwards",
              mixBlendMode:"screen",
            }}/>
          </div>
        )}

        {/* Floating damage number */}
        {dmgFx && (
          <div key={`dmg-${dmgFx.id}`} style={{
            position:"absolute",
            ...(dmgFx.at === "wild"
              ? { right:"22%", top:"18%" }
              : { left:"34%", bottom:"36%" }),
            color:"#ff5040", fontSize:30, fontWeight:900,
            textShadow:"0 0 6px #000, 2px 2px 0 #500, 0 0 14px #ff2020",
            pointerEvents:"none", zIndex:6,
            animation:"dmgFloat 0.9s ease-out forwards",
            letterSpacing:1,
          }}>−{dmgFx.value}</div>
        )}

        {/* Heal motes */}
        {auxFx?.kind === "heal" && (
          <div key={`aux-${auxFx.id}`} style={{
            position:"absolute", left:"22%", bottom:"14%",
            width:160, height:140, pointerEvents:"none", zIndex:5,
          }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                position:"absolute",
                left:`${8 + i * 11}%`, bottom:0,
                width:9, height:9, borderRadius:"50%",
                background:"#a0ffa0",
                boxShadow:"0 0 10px #40ff60, 0 0 4px #fff",
                animation:`healLift 0.95s ease-out ${i * 0.05}s both`,
              }}/>
            ))}
          </div>
        )}

        {/* Rune pulse ring */}
        {auxFx?.kind === "rune" && (
          <div key={`aux-${auxFx.id}`} style={{
            position:"absolute", left:"42%", bottom:"22%",
            width:90, height:90, borderRadius:"50%",
            border:`3px solid ${auxFx.color || "#80ffc0"}`,
            boxShadow:`0 0 14px ${auxFx.color || "#80ffc0"}`,
            transform:"translate(-50%, 50%) scale(0)",
            pointerEvents:"none", zIndex:5,
            animation:"runeRing 0.9s ease-out forwards",
          }}/>
        )}

        {/* Resonate — full-stage burst tinted to starter's type */}
        {auxFx?.kind === "resonate" && (
          <div key={`aux-${auxFx.id}`} style={{
            position:"absolute", inset:0,
            background:`radial-gradient(circle at 60% 40%, ${auxFx.color || "#fff"}aa 0%, ${auxFx.color || "#fff"}33 35%, transparent 70%)`,
            pointerEvents:"none", zIndex:5,
            animation:"resBurst 0.85s ease-out forwards",
            mixBlendMode:"screen",
          }}/>
        )}

        {/* Feint label */}
        {auxFx?.kind === "feint" && (
          <div key={`aux-${auxFx.id}`} style={{
            position:"absolute", right:"14%", top:"18%",
            color:"#a8d8ff", fontSize:15, fontWeight:900,
            textShadow:"0 0 8px #000, 0 0 12px #4080ff",
            letterSpacing:2,
            pointerEvents:"none", zIndex:6,
            animation:"feintLbl 0.75s ease-out forwards",
          }}>FEINT!</div>
        )}

        {/* Shell capture sequence — shell sprite rides absolute positioning */}
        {shellFx && (
          <div key={`shell-${shellFx.id}-${shellFx.phase}`} style={{
            position:"absolute",
            // Lands at wild's centroid for wobble/resolve
            right:"22%", top:"30%",
            width:46, height:46,
            pointerEvents:"none", zIndex:7,
            animation:
              shellFx.phase === "throw"  ? "shellArc 0.6s cubic-bezier(.4,.1,.7,1) forwards" :
              shellFx.phase === "wobble" ? "shellWobble 1.5s ease-in-out" :
              shellFx.phase === "caught" ? "shellCaught 0.75s ease-out forwards" :
                                            "shellBreak 0.7s ease-out forwards",
          }}>
            <img src="/__mockup/images/weathered-shell.png" alt="" style={{
              width:"100%", height:"100%", objectFit:"contain",
              filter:"drop-shadow(0 0 12px rgba(200,160,90,0.85))",
            }}/>
          </div>
        )}

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

        /* Attack streaks — origin set inline */
        @keyframes slashRight {
          0%   { transform: scaleX(0); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: scaleX(3.2) translateX(60px); opacity: 0; }
        }
        @keyframes slashLeft {
          0%   { transform: scaleX(0); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: scaleX(3.2) translateX(-60px); opacity: 0; }
        }
        @keyframes burstFx {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
        @keyframes dmgFloat {
          0%   { transform: translateY(0)   scale(0.7); opacity: 0; }
          18%  { transform: translateY(-8px) scale(1.2); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translateY(-46px) scale(1);  opacity: 0; }
        }
        @keyframes healLift {
          0%   { transform: translateY(0)    scale(0.4); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateY(-110px) scale(1); opacity: 0; }
        }
        @keyframes runeRing {
          0%   { transform: translate(-50%,50%) scale(0);   opacity: 1; }
          100% { transform: translate(-50%,50%) scale(3.2); opacity: 0; }
        }
        @keyframes resBurst {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes feintLbl {
          0%   { transform: translateY(0)    scale(0.6); opacity: 0; }
          30%  { transform: translateY(-12px) scale(1.25); opacity: 1; }
          100% { transform: translateY(-28px) scale(1);    opacity: 0; }
        }

        /* Capture timeline */
        @keyframes shellArc {
          0%   { transform: translate(-260px, 80px) scale(0.6) rotate(-360deg); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translate(0, 0) scale(1) rotate(0deg);              opacity: 1; }
        }
        @keyframes shellWobble {
          0%, 100% { transform: rotate(0deg)   translateY(0); }
          15%      { transform: rotate(-18deg) translateY(-2px); }
          35%      { transform: rotate(14deg)  translateY(0); }
          55%      { transform: rotate(-12deg) translateY(-1px); }
          75%      { transform: rotate(10deg)  translateY(0); }
        }
        @keyframes shellCaught {
          0%   { transform: scale(1);                filter: drop-shadow(0 0 8px #fff); }
          40%  { transform: scale(1.4);              filter: drop-shadow(0 0 36px #80ff80) brightness(2); }
          100% { transform: scale(0.5) translateY(20px); opacity: 0; filter: drop-shadow(0 0 8px #80ff80); }
        }
        @keyframes shellBreak {
          0%   { transform: scale(1) rotate(0deg); }
          30%  { transform: scale(1.25) rotate(180deg); filter: drop-shadow(0 0 18px #ff6040) brightness(1.5); }
          100% { transform: scale(0) rotate(540deg);    opacity: 0; }
        }
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
