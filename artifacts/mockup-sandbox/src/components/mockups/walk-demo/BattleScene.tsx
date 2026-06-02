import { useEffect, useRef, useState } from "react";
import { ELEMENT_COLOR } from "./progression";
import {
  type Move, getMove, asElement, computeDamage, effectiveness, effLabel,
  defaultActiveMoves, wildCombatStats, wildLevelFor,
} from "./moves";
import { MoveFx, MOVE_FX_KEYFRAMES, ResonanceFx, RESONANCE_FX_KEYFRAMES } from "./battleFx";

// Last-resort move when every active move is out of PP.
const STRUGGLE: Move = {
  id: "struggle", name: "Struggle", category: "damage", power: 5,
  accuracy: 100, pp: 99, anim: "glitch", desc: "A desperate flail.",
};

// Maps a mon's type string (which may or may not be a catalogued Element)
// to a usable accent color. Falls back to warm gold for unknown types.
function typeColor(type: string): string {
  return (ELEMENT_COLOR as Record<string, string>)[type] ?? "#ffe080";
}

export type MonRarity = "common" | "uncommon" | "rare" | "ultra" | "apex";

/** One frame clipped from a sprite sheet. */
export type SpriteSheet = {
  url: string;     // full sheet image URL
  x: number;      // px offset of frame top-left
  y: number;
  w: number;      // frame width
  h: number;      // frame height
  sheetW: number; // total sheet width
  sheetH: number; // total sheet height
};

/**
 * CSS background properties that show exactly one frame of a sprite sheet,
 * scaled to fill any container size (works at any CSS width/height).
 */
export function sheetBgStyle(s: SpriteSheet): React.CSSProperties {
  const bsX = (s.sheetW / s.w) * 100;
  const bsY = (s.sheetH / s.h) * 100;
  const bpX = s.sheetW > s.w ? (s.x / (s.sheetW - s.w)) * 100 : 0;
  const bpY = s.sheetH > s.h ? (s.y / (s.sheetH - s.h)) * 100 : 0;
  return {
    backgroundImage:    `url(${s.url})`,
    backgroundRepeat:   "no-repeat",
    backgroundSize:     `${bsX}% ${bsY}%`,
    backgroundPosition: `${bpX}% ${bpY}%`,
  };
}

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
  /** Sprite-sheet frame for the wild (enemy) battle display. Takes priority over wildImg. */
  wildSheet?: SpriteSheet;
  /** Sprite-sheet frame for the player's party display. Takes priority over playerImg. */
  playerSheet?: SpriteSheet;
};

export type StarterSpec = {
  id: string;
  name: string;
  type: string;
  color: string;
  img: string;
  maxHp?: number;
  /** Native art direction of the starter's battle sprite (defaults "right"). */
  faces?: "left" | "right";
};

/** A player combatant in battle. The lead is built from the starter props; the
 *  rest of the party (caught companions) are passed via `bench`. Any non-fainted
 *  mon can be made active by switching. */
export type BattleMon = {
  id: string;
  name: string;
  type: string;
  color: string;
  level: number;
  stats: StarterStats;
  moves: string[];
  img?: string;
  sheet?: SpriteSheet;
  faces: "left" | "right";
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
// Tayanari are never thrown at — per the Elders' lore they "can only be bonded".
// A Realm Shell is SET open before the wild; bonding succeeds if it steps in.
const SHELL_OUTCOMES: { kind: Outcome; weight: number; pct: number; flavor: string }[] = [
  { kind: "trap",     weight: 55, pct: 0.74, flavor: "You set the shell open before it, like a waiting hollow." },
  { kind: "curious",  weight: 30, pct: 0.82, flavor: "You set the shell near it. Curiosity gets the better of it…" },
  { kind: "critical", weight: 12, pct: 0.91, flavor: "Critical placement! The shell settles right beside it." },
  { kind: "perfect",  weight:  3, pct: 1.00, flavor: "Perfect! The shell settles open at its feet." },
];

function rollOutcome(hpFrac: number): typeof SHELL_OUTCOMES[number] {
  // HP-band boosts critical/perfect odds the lower the mon is
  let bias = 0;
  if (hpFrac < 0.30) bias = 12;
  else if (hpFrac < 0.60) bias = 7;
  else if (hpFrac < 0.90) bias = 3;
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
  | { kind: "caught";     mon: MonSpec; shellsSet: number; xpGained: number; participants?: number[] }
  | { kind: "fled";       shellsSet: number }
  | { kind: "fainted";    shellsSet: number }
  | { kind: "ko";         mon: MonSpec; shellsSet: number; xpGained: number; participants?: number[] }
  | { kind: "trainerWin"; shellsSet: number; xpGained: number; participants?: number[] };

export type StarterStats = { hp: number; atk: number; def: number; spd: number };

type Props = {
  wild: MonSpec;
  starter: StarterSpec;
  starterLevel: number;
  starterStats: StarterStats;
  /** Active move loadout (≤4 move ids) the player brought into battle. */
  starterMoves: string[];
  hasResonanceStone: boolean;
  healingRuneEquipped: boolean;
  /** Role boon: capture odds multiplier (Hopeful path raises it). Defaults to 1. */
  catchMult?: number;
  shellsCount: number;
  /** IDs of mon species the player has already bonded (party + storage). Used
   *  to show a "bonded" indicator on the wild HP plate. */
  caughtIds?: string[];
  /** Opponent kind. A "keeper" (trainer) battle pits you against another Keeper's
   *  already-bonded Tayanari — it CANNOT be bonded (no shell), and you cannot flee. */
  opponentKind?: "wild" | "keeper";
  /** Display name for a Keeper opponent (e.g. "Keeper Rowan"). */
  keeperName?: string;
  /** Sprite for the opposing Keeper (faces west). Defaults to Rowan's side art. */
  keeperImg?: string;
  /** Player's own hero sprite (faces east). Defaults to the generic walker. */
  heroImg?: string;
  /** Full team for a trainer battle (wild = team[0]). When set, defeated mons
   *  cycle through the roster and the battle ends with `trainerWin`. */
  keeperTeam?: MonSpec[];
  /** Fixed level per trainer mon (parallel array with keeperTeam). */
  keeperMonLevels?: number[];
  /** Caught companions (party slots 2…N) as battle-ready mons. The lead is
   *  built from the starter props; these fill out the switchable team. */
  bench?: BattleMon[];
  onConsumeShell: () => void;
  onEnd: (r: BattleResult) => void;
  /** Hollis field-berries available in battle */
  berries?: { dusk: number; thorn: number; calm: number; bright: number };
  onUseBerry?: (type: "dusk" | "thorn" | "calm" | "bright") => void;
};

// XP rewards: half the wild's maxHp on KO, ×1.10 on capture.
function xpFor(wild: MonSpec, caught: boolean): number {
  const base = Math.max(4, Math.round(wild.maxHp / 2));
  return caught ? Math.round(base * 1.10) : base;
}

type Menu = "root" | "moves" | "shellConfirm" | "ended" | "switch" | "switchForced" | "bag";

const BTN_BG    = "linear-gradient(180deg, rgba(60,40,20,0.92), rgba(36,22,10,0.92))";
const BTN_BG_HI = "linear-gradient(180deg, rgba(90,62,30,0.96), rgba(56,36,16,0.96))";

export function BattleScene({
  wild, starter, starterLevel, starterStats, starterMoves, hasResonanceStone, healingRuneEquipped,
  catchMult = 1, shellsCount, caughtIds = [] as string[],
  opponentKind = "wild", keeperName = "Keeper", keeperImg = "/__mockup/images/rowan_side_1.png",
  heroImg = "/__mockup/images/walk_side_1.png",
  keeperTeam, keeperMonLevels, bench,
  onConsumeShell, onEnd,
  berries, onUseBerry,
}: Props) {
  const isKeeper = opponentKind === "keeper";

  // ── Trainer team cycling ─────────────────────────────────────────────────
  const [trainerMonIdx, setTrainerMonIdx] = useState(0);
  const trainerXpRef = useRef(0); // accumulated XP across all trainer mons

  // Effective opponent for this turn; may advance mid-battle in trainer fights.
  const currentOpponent: MonSpec = (isKeeper && keeperTeam?.length)
    ? (keeperTeam[trainerMonIdx] ?? wild)
    : wild;
  const currentOpponentLevel: number = (isKeeper && keeperMonLevels?.length)
    ? (keeperMonLevels[trainerMonIdx] ?? Math.max(5, starterLevel))
    : (isKeeper ? Math.max(5, starterLevel) : wildLevelFor(wild.rarity));

  // ── Player team (lead + bench) ──────────────────────────────────────────
  // The lead is built from the starter props; caught companions ride `bench`.
  // Any non-fainted mon can be made active by switching (no turn is spent).
  const lead: BattleMon = {
    id: starter.id, name: starter.name, type: starter.type,
    color: starter.color, level: starterLevel, stats: starterStats,
    moves: starterMoves, img: starter.img, faces: starter.faces ?? "right",
  };
  const team: BattleMon[] = [lead, ...(bench ?? [])];
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  const active = team[activeIdx] ?? team[0];
  // Mons sent out at any point earn XP at battle end. The lead always counts.
  const participatedRef = useRef<Set<number>>(new Set([0]));

  // Per-mon current HP (persists across switches within a battle; full each battle).
  const [teamHp, setTeamHp] = useState<number[]>(() => team.map(m => m.stats.hp));
  const teamHpRef = useRef<number[]>(team.map(m => m.stats.hp));

  const playerMaxHp = active.stats.hp;
  const playerHp    = teamHp[activeIdx] ?? 0;
  // Compatibility shim — updates the ACTIVE mon's HP slot (clamped ≥ 0).
  function setPlayerHp(v: number | ((hp: number) => number)) {
    const idx = activeIdxRef.current;
    setTeamHp(prev => {
      const cur = prev[idx] ?? 0;
      const nextV = typeof v === "function" ? (v as (h: number) => number)(cur) : v;
      const arr = [...prev];
      arr[idx] = Math.max(0, nextV);
      teamHpRef.current = arr;
      return arr;
    });
  }
  const [wildHp,   setWildHp]     = useState(wild.maxHp);
  const [log,      setLog]        = useState<string>(
    isKeeper ? `${keeperName} sends out ${wild.name}!` : `A wild ${wild.name} appears!`,
  );
  const [busy,     setBusy]       = useState(true);
  const [menu,     setMenu]       = useState<Menu>("root");
  const [healCd,   setHealCd]     = useState(0);              // turns remaining
  const [runeUses, setRuneUses]   = useState(healingRuneEquipped ? 3 : 0);
  const [berryCount, setBerryCount] = useState(() => berries ?? { dusk:0, thorn:0, calm:0, bright:0 });
  const [resBar,   setResBar]     = useState(0);              // 0..15
  const [intro,    setIntro]      = useState(true);
  const [shake,    setShake]      = useState<"player" | "wild" | null>(null);
  const [shellsSet, setShellsSet] = useState(0);
  const shellsSetRef = useRef(0);
  const tRef = useRef<number[]>([]);

  // ── FX layer state ────────────────────────────────────────────────────
  type AttackFx = { from: "player" | "wild"; color: string; id: number };
  type DmgFx    = { at: "player" | "wild"; value: number; crit?: boolean; id: number };
  type ShellFx  = { phase: "set" | "wobble" | "caught" | "break"; id: number };
  type AuxFx    = { kind: "heal" | "rune" | "resonate" | "feint";
                    color?: string; at?: "player" | "wild"; id: number };
  const [attackFx,    setAttackFx]    = useState<AttackFx | null>(null);
  const [dmgFx,       setDmgFx]       = useState<DmgFx    | null>(null);
  const [shellFx,     setShellFx]     = useState<ShellFx  | null>(null);
  const [auxFx,       setAuxFx]       = useState<AuxFx    | null>(null);
  const [screenFlash, setScreenFlash] = useState<"player" | "wild" | null>(null);
  // Summon bloom at battle start (plays once during the intro window).
  const [summon,   setSummon]   = useState(true);
  // Quick dodge state for the wild when it feints a strike.
  const [feinting, setFeinting] = useState(false);
  const fxIdRef = useRef(1);
  const nextFxId = () => ++fxIdRef.current;

  // ── Move system: derived combatants ──────────────────────────────────────
  // Resolve a battle mon's active loadout (≤4), falling back to its element
  // defaults, then Struggle. Shared by the active mon and per-mon PP pools.
  function resolveMoves(m: BattleMon): Move[] {
    const resolved = m.moves.map(getMove).filter((x): x is Move => !!x);
    if (resolved.length) return resolved.slice(0, 4);
    const el = asElement(m.type);
    if (el) {
      const def = defaultActiveMoves(el, m.level).map(getMove).filter((x): x is Move => !!x);
      if (def.length) return def;
    }
    return [STRUGGLE];
  }
  const playerEl  = asElement(active.type);
  const wildEl    = asElement(currentOpponent.type);
  const wildStats = wildCombatStats(currentOpponent.baseDmg, currentOpponent.rarity);
  const wildLevel = currentOpponentLevel;

  // Active mon's loadout.
  const playerMoves: Move[] = resolveMoves(active);
  // Wild's loadout derived from its element + notional level.
  const wildMoves: Move[] = (() => {
    if (wildEl) {
      const ids = defaultActiveMoves(wildEl, wildLevel);
      const ms = ids.map(getMove).filter((m): m is Move => !!m);
      if (ms.length) return ms;
    }
    // Unknown element: a single neutral strike scaled off baseDmg.
    return [{
      id: "wild_strike", name: `${currentOpponent.type} Strike`, category: "damage",
      power: Math.round((currentOpponent.baseDmg[0] + currentOpponent.baseDmg[1]) / 2) + 4,
      accuracy: 100, pp: 99, anim: "glitch", desc: "A wild strike.",
    }];
  })();

  // PP pools. Player PP is per-mon (drives the move menu); wild PP rides a ref.
  const [teamPp, setTeamPp] = useState<Record<string, number>[]>(() =>
    team.map(m => {
      const o: Record<string, number> = {};
      for (const mv of resolveMoves(m)) o[mv.id] = mv.pp;
      return o;
    }),
  );
  const playerPp = teamPp[activeIdx] ?? {};
  function setPlayerPp(updater: (p: Record<string, number>) => Record<string, number>) {
    const idx = activeIdxRef.current;
    setTeamPp(prev => { const a = [...prev]; a[idx] = updater(prev[idx] ?? {}); return a; });
  }
  const wildPpRef    = useRef<Record<string, number>>({});
  const wildPpKeyRef = useRef(-1); // tracks which trainerMonIdx PP was last populated for
  if (wildPpKeyRef.current !== trainerMonIdx) {
    wildPpKeyRef.current = trainerMonIdx;
    wildPpRef.current = {};
    for (const m of wildMoves) wildPpRef.current[m.id] = m.pp;
  }

  // Battle-long stat buffs (Sharpen / Bulwark). Refs mirror state so delayed
  // turn callbacks always read the latest values.
  type Buffs = { pAtk: number; pDef: number; wAtk: number; wDef: number };
  const [buffs, setBuffs] = useState<Buffs>({ pAtk: 0, pDef: 0, wAtk: 0, wDef: 0 });
  const buffsRef = useRef(buffs);
  useEffect(() => { buffsRef.current = buffs; }, [buffs]);

  // HP refs (latest values for delayed AI/KO logic).
  const wildHpRef   = useRef(wild.maxHp);

  // Move animation overlay.
  type MoveFxState = { anim: Move["anim"]; color: string; from: "player" | "wild"; category: Move["category"]; id: number; element?: string; power?: number };
  const [moveFx, setMoveFx] = useState<MoveFxState | null>(null);
  const [resonanceFx, setResonanceFx] = useState<{ element: string; color: string; id: number } | null>(null);

  useEffect(() => {
    const t1 = window.setTimeout(() => { setIntro(false); setBusy(false); }, 1100);
    // Summon bloom lingers a touch past the intro float, then clears.
    const t2 = window.setTimeout(() => setSummon(false), 1300);
    tRef.current.push(t1, t2);
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
  function showDmg(at: "player" | "wild", value: number, crit = false) {
    const id = nextFxId();
    setDmgFx({ at, value, crit, id });
    later(() => setDmgFx(curr => (curr?.id === id ? null : curr)), 950);
  }
  function triggerAux(
    kind: AuxFx["kind"], color?: string, at?: "player" | "wild", ms = 900,
  ) {
    const id = nextFxId();
    setAuxFx({ kind, color, at, id });
    later(() => setAuxFx(curr => (curr?.id === id ? null : curr)), ms);
  }
  function triggerMove(
    anim: Move["anim"], color: string, from: "player" | "wild", category: Move["category"], element?: string, power?: number,
  ) {
    const id = nextFxId();
    setMoveFx({ anim, color, from, category, id, element, power });
    later(() => setMoveFx(curr => (curr?.id === id ? null : curr)), 1100);
  }

  // Effective stats after battle-long buffs.
  function pAtk() { return active.stats.atk + buffsRef.current.pAtk; }
  function pDef() { return active.stats.def + buffsRef.current.pDef; }
  function wAtk() { return wildStats.atk + buffsRef.current.wAtk; }
  function wDef() { return wildStats.def + buffsRef.current.wDef; }

  // ── Wild AI: choose a move ──────────────────────────────────────────────
  function pickWildMove(): Move {
    const usable = wildMoves.filter(m => (wildPpRef.current[m.id] ?? 0) > 0);
    if (usable.length === 0) return STRUGGLE;
    const lowHp = wildHpRef.current < currentOpponent.maxHp * 0.4;
    const heals = usable.filter(m => m.category === "heal");
    if (lowHp && heals.length && Math.random() < 0.5) return heals[0];
    const support = usable.filter(m => m.category === "buff" || m.category === "shield");
    const dmg = usable.filter(m => m.category === "damage");
    if (dmg.length === 0) return support[0] ?? usable[0];
    if (support.length && buffsRef.current.wAtk < 6 && Math.random() < 0.18) {
      return support[Math.floor(Math.random() * support.length)];
    }
    // Prefer the strongest / most effective damage move (with a little noise).
    let best = dmg[0], bestScore = -Infinity;
    for (const m of dmg) {
      const eff = m.element && playerEl ? effectiveness(m.element, playerEl) : 1;
      const score = m.power * eff + Math.random() * 3;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  // ── Wild's turn ─────────────────────────────────────────────────────────
  function wildTurn(afterCb?: () => void) {
    later(() => {
      const move = pickWildMove();
      if (move.id !== STRUGGLE.id) {
        wildPpRef.current[move.id] = Math.max(0, (wildPpRef.current[move.id] ?? 0) - 1);
      }
      const color = wildEl ? typeColor(currentOpponent.type) : "#ffe080";

      // Utility moves — wild heals or buffs itself, no damage to player.
      if (move.category !== "damage") {
        triggerMove(move.anim, color, "wild", move.category, move.element, move.power);
        if (move.category === "heal" && move.heal) {
          const heal = Math.floor(currentOpponent.maxHp * move.heal);
          setWildHp(hp => { const n = Math.min(currentOpponent.maxHp, hp + heal); wildHpRef.current = n; return n; });
          setLog(`${currentOpponent.name} uses ${move.name} — recovers ${heal} HP!`);
        } else if (move.category === "buff" && move.atkBuff) {
          setBuffs(b => ({ ...b, wAtk: b.wAtk + move.atkBuff! }));
          setLog(`${currentOpponent.name} uses ${move.name} — its attack rises!`);
        } else if (move.category === "shield" && move.defBuff) {
          setBuffs(b => ({ ...b, wDef: b.wDef + move.defBuff! }));
          setLog(`${currentOpponent.name} uses ${move.name} — its defense rises!`);
        }
        later(() => { setHealCd(c => Math.max(0, c - 1)); setBusy(false); afterCb?.(); }, 760);
        return;
      }

      // Accuracy check.
      if (Math.random() * 100 > move.accuracy) {
        setLog(`${currentOpponent.name} uses ${move.name} — but it missed!`);
        later(() => { setHealCd(c => Math.max(0, c - 1)); setBusy(false); afterCb?.(); }, 700);
        return;
      }

      const stab = !!move.element && move.element === wildEl;
      const eff  = move.element && playerEl ? effectiveness(move.element, playerEl) : 1;
      const { dmg, crit } = computeDamage({
        power: move.power, attackerAtk: wAtk(), defenderDef: pDef(), stab, effectiveness: eff,
      });
      triggerMove(move.anim, color, "wild", "damage", move.element, move.power);

      later(() => {
        setShake("player");
        setScreenFlash("player"); later(() => setScreenFlash(null), 190);
        showDmg("player", dmg, crit);
        const tag = effLabel(eff);
        setLog(`${currentOpponent.name} uses ${move.name}!${crit ? " A critical hit!" : ""}${tag ? " " + tag : ""}`);
        setResBar(b => Math.min(15, b + 5));
      }, 380);
      later(() => setShake(null), 600);
      later(() => {
        setTeamHp(prev => {
          const idx = activeIdxRef.current;
          const next = Math.max(0, (prev[idx] ?? 0) - dmg);
          const arr = [...prev];
          arr[idx] = next;
          teamHpRef.current = arr;
          if (next === 0) {
            const faintedName = team[idx]?.name ?? "Your Tayanari";
            const anyAlive = arr.some((h, i) => i !== idx && h > 0);
            later(() => {
              setLog(`${faintedName} fainted…`);
              if (anyAlive) {
                // Mandatory send-out — the player picks the next mon. No turn is
                // spent: once chosen, the player's turn resumes.
                later(() => { setMenu("switchForced"); setBusy(true); }, 700);
              } else {
                later(() => onEnd({ kind: "fainted", shellsSet: shellsSetRef.current }), 900);
              }
            }, 700);
          } else {
            later(() => {
              setHealCd(c => Math.max(0, c - 1));
              setBusy(false);
              afterCb?.();
            }, 520);
          }
          return arr;
        });
      }, 380);
    }, 560);
  }

  function playerHit(dmg: number, msg: string, crit = false, eff = 1, afterCb?: () => void, noWildTurn = false) {
    setBusy(true);
    later(() => setShake(null), 600);
    later(() => {
      setShake("wild");
      setScreenFlash("wild"); later(() => setScreenFlash(null), 190);
      showDmg("wild", dmg, crit);
      const tag = effLabel(eff);
      setLog(`${msg}${crit ? " A critical hit!" : ""}${tag ? " " + tag : ""}`);
      setWildHp(hp => {
        const next = Math.max(0, hp - dmg);
        wildHpRef.current = next;
        setResBar(b => Math.min(15, b + 5));
        if (next === 0) {
          const monXp = xpFor(currentOpponent, false);
          if (isKeeper && keeperTeam && trainerMonIdx < keeperTeam.length - 1) {
            // More trainer mons — accumulate XP and switch to next
            trainerXpRef.current += monXp;
            const nextIdx = trainerMonIdx + 1;
            const nextMon = keeperTeam[nextIdx];
            later(() => {
              setLog(`${currentOpponent.name} is down! (+${monXp} XP) — ${keeperName} sends out ${nextMon.name}!`);
              setWildHp(nextMon.maxHp);
              wildHpRef.current = nextMon.maxHp;
              setBuffs(b => ({ ...b, wAtk: 0, wDef: 0 }));
              setTrainerMonIdx(nextIdx);
              setMenu("root");
              setBusy(false);
            }, 1400);
          } else {
            // Last mon — resolve battle
            const totalXp = trainerXpRef.current + monXp;
            trainerXpRef.current = 0;
            const participants = [...participatedRef.current];
            later(() => {
              setLog(isKeeper && keeperTeam
                ? `${currentOpponent.name} is down! You bested ${keeperName}! (+${totalXp} XP total)`
                : `${currentOpponent.name} fainted! ${active.name} gains ${monXp} XP.`);
              setMenu("ended");
              later(() => onEnd(
                isKeeper && keeperTeam
                  ? { kind: "trainerWin", shellsSet: shellsSetRef.current, xpGained: totalXp, participants }
                  : { kind: "ko", mon: currentOpponent, shellsSet: shellsSetRef.current, xpGained: monXp, participants }
              ), 1100);
            }, 650);
          }
        } else {
          if (noWildTurn) setBusy(false); else wildTurn(afterCb);
        }
        return next;
      });
    }, 380);
  }

  // ── Player picks a move ─────────────────────────────────────────────────
  function onMove(move: Move) {
    if (busy) return;
    setMenu("root");
    setBusy(true);
    const color = move.element ? typeColor(move.element) : typeColor(active.type);
    if (move.id !== STRUGGLE.id) {
      setPlayerPp(p => ({ ...p, [move.id]: Math.max(0, (p[move.id] ?? 0) - 1) }));
    }

    // Utility — heal / buff / shield the player, then the wild acts.
    if (move.category !== "damage") {
      triggerMove(move.anim, color, "player", move.category, move.element, move.power);
      if (move.category === "heal" && move.heal) {
        const heal = Math.floor(playerMaxHp * move.heal);
        setPlayerHp(hp => Math.min(playerMaxHp, hp + heal));
        setLog(`${active.name} uses ${move.name} — recovers ${heal} HP!`);
      } else if (move.category === "buff" && move.atkBuff) {
        setBuffs(b => ({ ...b, pAtk: b.pAtk + move.atkBuff! }));
        setLog(`${active.name} uses ${move.name} — Attack rose!`);
      } else if (move.category === "shield" && move.defBuff) {
        setBuffs(b => ({ ...b, pDef: b.pDef + move.defBuff! }));
        setLog(`${active.name} uses ${move.name} — Defense rose!`);
      }
      later(() => wildTurn(), 760);
      return;
    }

    // Damage — accuracy check (a miss reads as the wild feinting away).
    triggerMove(move.anim, color, "player", "damage", move.element, move.power);
    if (Math.random() * 100 > move.accuracy) {
      later(() => {
        triggerAux("feint", undefined, "wild", 750);
        setFeinting(true);
        later(() => setFeinting(false), 600);
        setLog(`${active.name} uses ${move.name} — ${wild.name} feinted away!`);
        later(() => wildTurn(), 650);
      }, 360);
      return;
    }

    const stab = !!move.element && move.element === playerEl;
    const eff  = move.element && wildEl ? effectiveness(move.element, wildEl) : 1;
    const { dmg, crit } = computeDamage({
      power: move.power, attackerAtk: pAtk(), defenderDef: wDef(), stab, effectiveness: eff,
    });
    later(() => playerHit(dmg, `${active.name} uses ${move.name}!`, crit, eff), 140);
  }

  function onHeal() {
    if (busy || healCd > 0) return;
    setBusy(true);
    const before = playerHp;
    const heal   = Math.floor(playerMaxHp * 0.5);
    const next   = Math.min(playerMaxHp, before + heal);
    setPlayerHp(next);
    setLog(`${active.name} recovers ${next - before} HP!`);
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
    // Rune is a Keeper action (not the mon's turn) — player keeps the initiative.
    later(() => setBusy(false), 700);
  }

  function onResonate() {
    if (busy) return;
    if (!hasResonanceStone) { setLog("You have no Resonance Stone equipped."); return; }
    if (resBar < 15)        { setLog(`Resonance not ready (${resBar}/15).`); return; }
    setBusy(true);  // lock input immediately — FX delays would otherwise leak a turn
    setResBar(0);
    const resColor = typeColor(active.type);
    triggerAux("resonate", resColor, undefined, 900);
    const rxId = nextFxId();
    setResonanceFx({ element: active.type, color: resColor, id: rxId });
    later(() => setResonanceFx(curr => curr?.id === rxId ? null : curr), 1400);
    if (active.type === "Spirit") {
      // Fae-like: revival/cleanse — heals fully. Resonance = Keeper action; player retains turn.
      setBusy(true);
      setPlayerHp(playerMaxHp);
      setLog(`Spirit Resonance — ${active.name} is fully restored!`);
      later(() => setBusy(false), 850);
      return;
    }
    const dmg = Math.round(6 + starterLevel * 0.6 + Math.random() * (starterLevel * 0.5 + 4));
    // Resonance = Keeper action; pass noWildTurn so player keeps their turn after the burst.
    later(() => playerHit(dmg, `${active.type} Resonance bursts! ${dmg} damage!`, false, 1, undefined, true), 350);
  }

  // ── Berry bag handlers (Hollis field-berries) ────────────────────────────
  function onUseDusk() {
    if (busy || berryCount.dusk <= 0) return;
    setBusy(true);
    const before = playerHp;
    const heal   = Math.floor(playerMaxHp * 0.30);
    const next   = Math.min(playerMaxHp, before + heal);
    setPlayerHp(next);
    setBerryCount(b => ({ ...b, dusk: b.dusk - 1 }));
    onUseBerry?.("dusk");
    setLog(`Duskberry — ${next - before} HP restored!`);
    triggerAux("heal", "#9860d0", "player", 900);
    later(() => { setMenu("root"); wildTurn(); }, 800);
  }
  function onUseThorn() {
    if (busy || berryCount.thorn <= 0) return;
    setBusy(true);
    setBuffs(b => ({ ...b, pAtk: b.pAtk + 8 }));
    setBerryCount(b => ({ ...b, thorn: b.thorn - 1 }));
    onUseBerry?.("thorn");
    setLog(`Thornberry — ${active.name}'s attack sharpened!`);
    triggerAux("rune", "#e03030", "player", 850);
    later(() => { setMenu("root"); wildTurn(); }, 800);
  }
  function onUseCalm() {
    if (busy || berryCount.calm <= 0) return;
    setBusy(true);
    setBuffs(b => ({ ...b, pDef: b.pDef + 8 }));
    setBerryCount(b => ({ ...b, calm: b.calm - 1 }));
    onUseBerry?.("calm");
    setLog(`Calmberry — ${active.name}'s guard steadied!`);
    triggerAux("rune", "#30b870", "player", 850);
    later(() => { setMenu("root"); wildTurn(); }, 800);
  }
  function onUseBright() {
    if (busy || berryCount.bright <= 0) return;
    setBusy(true);
    setHealCd(0);
    const lowestMove = playerMoves.reduce((a, b) =>
      (playerPp[a.id] ?? 0) < (playerPp[b.id] ?? 0) ? a : b
    );
    setPlayerPp(p => ({ ...p, [lowestMove.id]: lowestMove.pp }));
    setBerryCount(b => ({ ...b, bright: b.bright - 1 }));
    onUseBerry?.("bright");
    setLog(`Brightberry — Cooldowns cleared, ${lowestMove.name} PP restored!`);
    triggerAux("heal", "#e0c020", "player", 900);
    later(() => { setMenu("root"); wildTurn(); }, 800);
  }

  function onFlee() {
    if (busy) return;
    // A Keeper's challenge cannot be fled — see it through.
    if (isKeeper) { setLog(`There's no fleeing ${keeperName}'s challenge!`); return; }
    setBusy(true);
    if (Math.random() < 0.70) {
      setLog("You slip away…");
      setMenu("ended");
      later(() => onEnd({ kind: "fled", shellsSet: shellsSetRef.current }), 800);
    } else {
      setLog("Couldn't escape!");
      wildTurn();
    }
  }

  function onShell() {
    if (busy) return;
    // Keeper battles: the opposing Tayanari is already bonded to its Keeper and
    // can never be bonded to you. Setting a shell is impossible here.
    if (isKeeper) {
      setLog(`${wild.name} is already bonded to ${keeperName} — you can't set a shell on it.`);
      return;
    }
    if (shellsCount <= 0) { setLog("No Worn Realm Shells left."); return; }
    setMenu("shellConfirm");
  }

  function doShellSet() {
    if (isKeeper) return; // safety: keeper mons are never bondable
    setMenu("root");
    setBusy(true);
    onConsumeShell();
    shellsSetRef.current += 1;
    setShellsSet(shellsSetRef.current);
    const hpFrac = wildHp / wild.maxHp;
    const outcome = rollOutcome(hpFrac);
    setLog(outcome.flavor);

    // Capture animation timeline:
    //  0ms        shell is SET open before the wild + blooms   (set, 600ms)
    //  600ms      wild drawn into the shell, wobble begins      (wobble, 1500ms)
    //  2100ms     resolve — bond formed (gold burst) / broke    (700ms)
    const seqId = nextFxId();
    setShellFx({ phase: "set", id: seqId });
    later(() => setShellFx({ phase: "wobble", id: seqId }), 600);

    later(() => {
      // Hopeful's boon: capture odds scaled by catchMult, clamped to a sure thing.
      const catchPct = Math.min(1, outcome.pct * catchMult);
      const caught = Math.random() < catchPct;
      if (caught) {
        setShellFx({ phase: "caught", id: seqId });
        const xp = xpFor(wild, true);
        later(() => {
          setLog(`Bond formed! ${wild.name} joins you — fully healed. (+${xp} XP)`);
          setMenu("ended");
          setShellFx(null);
          later(() => onEnd({
            kind: "caught", mon: wild,
            shellsSet: shellsSetRef.current, xpGained: xp,
            participants: [...participatedRef.current],
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

  // Switch the active mon (voluntary from the menu, or forced after a faint).
  // No turn is spent: in both cases the player's turn resumes after sending out.
  function doSwitch(idx: number) {
    if (idx === activeIdxRef.current) return;
    if ((teamHpRef.current[idx] ?? 0) <= 0) return;
    participatedRef.current.add(idx);
    setActiveIdx(idx);
    activeIdxRef.current = idx;
    setBuffs(b => ({ ...b, pAtk: 0, pDef: 0 })); // attack/defense buffs don't carry over
    setLog(`Go, ${team[idx].name}!`);
    setMenu("root");
    setBusy(false);
  }
  const hasReserve = team.some((_, i) => i !== activeIdx && (teamHp[i] ?? 0) > 0);

  // ── render
  // wildFaces / playerFaces describe each sprite's NATIVE art orientation (same
  // file orientation is reused for both sides). Wild stands on the RIGHT and must
  // face LEFT (toward player); player mon stands on the LEFT and must face RIGHT.
  const wildScaleX   = currentOpponent.wildFaces === "left"   ? 1 : -1; // flip when native faces right
  const playerScaleX = active.faces === "right" ? 1 : -1; // flip when active mon's native art faces left
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

  // Ritual-circle anchor points, measured as % of the arena image (1536×1024).
  // green = hero (Keeper), red = player Tayanari, yellow = wild, purple = opponent
  // Keeper (only present in keeper battles — empty in wild zones like Route 1).
  const POS = {
    hero:   { x: 10,   y: 76 },
    mon:    { x: 25.5, y: 60.5 },
    wild:   { x: 70,   y: 61 },
    keeper: { x: 87.5, y: 76 },
  };
  // Stand a sprite (sized as % of arena width) with its feet on a circle centre.
  const standOn = (
    p: { x: number; y: number }, widthPct: number, z: number, anchor = 85,
  ): React.CSSProperties => ({
    position: "absolute",
    left: `${p.x}%`, top: `${p.y}%`,
    width: `${widthPct}%`, aspectRatio: "1",
    transform: `translate(-50%, -${anchor}%)`,
    zIndex: z,
  });

  return (
    <div style={{
      position:"absolute", inset:0,
      background:"#000",
      display:"flex", flexDirection:"column",
      overflow:"hidden",
    }}>
      {/* Battle stage — letterbox container with a blurred atmospheric backdrop */}
      <div style={{
        position:"relative", flex:1, minHeight:0,
        backgroundColor:"#0c1408",
        overflow:"hidden",
      }}>
        {/* Blurred backdrop fills the letterbox bands above/below the arena */}
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:"url(/__mockup/images/forest-arena.png)",
          backgroundSize:"cover", backgroundPosition:"center",
          filter:"blur(14px) brightness(0.45)",
          transform:"scale(1.12)",
        }}/>
        {/* Arena — exact image aspect so the four ritual circles map 1:1 (no crop) */}
        <div style={{
          position:"absolute", left:0, right:0, top:"50%",
          transform:"translateY(-50%)",
          width:"100%", aspectRatio:"1536 / 1024",
          backgroundImage:"url(/__mockup/images/forest-arena.png)",
          backgroundSize:"cover", backgroundPosition:"center",
        }}>
        {/* Wild HP plate (top-right) */}
        <div style={hpPlateStyle("enemy")}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>
              {currentOpponent.name}
              {currentOpponent.nameIcon && (
                <span style={{
                  marginLeft:4,
                  color:"#ffe080",
                  textShadow:"0 0 4px #ffb030, 0 0 10px #ffa020, 0 0 2px #fff",
                  filter:"drop-shadow(0 0 3px rgba(255,200,80,0.9))",
                  fontWeight:900,
                }}>{currentOpponent.nameIcon}</span>
              )}
            </span>
            <span style={{
              color: RARITY_COLOR[currentOpponent.rarity], fontSize:9, fontWeight:700,
              padding:"1px 6px", borderRadius:8,
              border:`1px solid ${RARITY_COLOR[currentOpponent.rarity]}`,
              background:"rgba(0,0,0,0.4)",
              textTransform:"uppercase", letterSpacing:1,
            }}>{RARITY_LABEL[currentOpponent.rarity]}</span>
          </div>
          {!isKeeper && caughtIds.includes(currentOpponent.id) && (
            <div style={{
              display:"inline-flex", alignItems:"center", gap:3, marginBottom:3,
              background:"rgba(80,210,110,0.12)", borderRadius:5,
              padding:"1px 7px", border:"1px solid rgba(80,210,110,0.28)",
            }}>
              <span style={{ color:"#70e888", fontSize:8, fontWeight:800, letterSpacing:1, textTransform:"uppercase" }}>✦ bonded</span>
            </div>
          )}
          <HpBar hp={wildHp} max={currentOpponent.maxHp} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <span style={{ color:"#a8c0d0", fontSize:9 }}>{currentOpponent.type}</span>
            <span style={{ color:"#c8c8c8", fontSize:9, fontWeight:700 }}>{wildHp}/{currentOpponent.maxHp}</span>
          </div>
        </div>

        {/* Player HP plate (top-left) */}
        <div style={hpPlateStyle("player")}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
            <span style={{ color:"#fff", fontSize:13, fontWeight:800 }}>{active.name}</span>
            <span style={{ color:"#aaa", fontSize:9 }}>Lv.{active.level}</span>
          </div>
          <HpBar hp={playerHp} max={playerMaxHp} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <span style={{ color: active.color, fontSize:9 }}>{active.type}</span>
            <span style={{ color:"#c8c8c8", fontSize:9, fontWeight:700 }}>{playerHp}/{playerMaxHp}</span>
          </div>
        </div>

        {/* Wild sprite — top-right */}
        <div style={standOn(POS.wild, 26, 3, 80)}>
          <div style={{
            width:"100%", height:"100%",
            animation: intro
              ? "introFloat 1.1s ease-out"
              : feinting ? "feintDodge 0.6s ease-out"
              : (wildShake || "none"),
            opacity: wildAbsorbed ? 0 : (wildHp === 0 ? 0.3 : 1),
            transition:"opacity 0.45s",
          }}>
            {/* Feint afterimage — a translucent ghost that lingers where it stood */}
            {feinting && (currentOpponent.wildSheet ? (
              <div aria-hidden style={{
                position:"absolute", inset:0,
                ...sheetBgStyle(currentOpponent.wildSheet),
                transform: (wildFlip + wildExtra).trim() || "none",
                transformOrigin:"center center",
                filter:`drop-shadow(0 0 10px ${typeColor(currentOpponent.type)})`,
                animation:"feintGhost 0.6s ease-out forwards",
                pointerEvents:"none",
              }}/>
            ) : (
              <img src={currentOpponent.wildImg} alt="" aria-hidden style={{
                position:"absolute", inset:0,
                width:"100%", height:"100%", objectFit:"contain",
                transform: (wildFlip + wildExtra).trim() || "none",
                transformOrigin:"center center",
                filter:`drop-shadow(0 0 10px ${typeColor(currentOpponent.type)})`,
                animation:"feintGhost 0.6s ease-out forwards",
                pointerEvents:"none",
              }}/>
            ))}
            {currentOpponent.wildSheet ? (
              <div role="img" aria-label={currentOpponent.name} style={{
                position:"absolute", inset:0,
                ...sheetBgStyle(currentOpponent.wildSheet),
                transform: (wildFlip + wildExtra).trim() || "none",
                transformOrigin:"center center",
                transition:"transform 0.45s ease-in",
                filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
              }}/>
            ) : (
              <img src={currentOpponent.wildImg} alt={currentOpponent.name} style={{
                width:"100%", height:"100%", objectFit:"contain",
                transform: (wildFlip + wildExtra).trim() || "none",
                transformOrigin:"center center",
                transition:"transform 0.45s ease-in, opacity 0.45s",
                filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
              }}/>
            )}
          </div>
        </div>

        {/* Side-view stage: Keeper (green) + Tayanari (red) face EAST; wild (yellow) faces WEST */}
        {/* Hero / Keeper — green ritual circle, facing east */}
        <div style={standOn(POS.hero, 40, 4, 84)}>
          <div style={{
            width:"100%", height:"100%",
            animation: intro ? "introSlide 1.1s ease-out" : "none",
          }}>
            <img src={heroImg} alt="Keeper" style={{
              width:"100%", height:"100%", objectFit:"contain",
              filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
              imageRendering:"auto",
            }}/>
          </div>
        </div>

        {/* Opposing Keeper — purple ritual circle, facing west (keeper battles only) */}
        {isKeeper && (
          <div style={standOn(POS.keeper, 26, 4, 84)}>
            <div style={{
              width:"100%", height:"100%",
              animation: intro ? "introFloatR 1.1s ease-out" : "none",
            }}>
              <img src={keeperImg} alt={keeperName} style={{
                width:"100%", height:"100%", objectFit:"contain",
                transform:"scaleX(-1)",
                filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
                imageRendering:"auto",
              }}/>
            </div>
          </div>
        )}

        {/* Player Tayanari — red ritual circle, facing east toward the wild */}
        <div style={standOn(POS.mon, 24, 3, 80)}>
          <div style={{
            width:"100%", height:"100%",
            animation: intro ? "introSlide 1.1s ease-out" : (playerShake || "none"),
            animationDelay: intro ? "0.15s" : undefined,
          }}>
            {active.sheet ? (
              <div role="img" aria-label={active.name} style={{
                position:"absolute", inset:0,
                ...sheetBgStyle(active.sheet),
                transform: (playerFlip + playerExtra).trim() || "none",
                transformOrigin:"center center",
                transition:"transform 0.45s ease-in",
                filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
              }}/>
            ) : (
              <img src={active.img} alt={active.name} style={{
                width:"100%", height:"100%", objectFit:"contain",
                // Keeper-side mon faces EAST (right). Native right-facing sprite => no flip; native left => scaleX(-1).
                transform: (playerFlip + playerExtra).trim() || "none",
                transformOrigin:"center center",
                transition:"transform 0.45s ease-in, opacity 0.45s",
                filter:"drop-shadow(0 6px 8px rgba(0,0,0,0.5))",
              }}/>
            )}
          </div>
        </div>

        {/* ── FX OVERLAY ──────────────────────────────────────────────── */}
        {/* Summon bloom — element-tinted glimmer as each mon materializes */}
        {summon && (
          <div key="summon" style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:6 }}>
            {/* Player Tayanari glimmer (left circle, starter element color) */}
            <SummonBurst x={POS.mon.x} y={POS.mon.y - 8} color={typeColor(active.type)} delay={0.15}/>
            {/* Opponent glimmer (right circle, wild element color) */}
            <SummonBurst x={POS.wild.x} y={POS.wild.y - 8} color={typeColor(currentOpponent.type)} delay={0}/>
          </div>
        )}
        {/* Move animation (elemental projectile / utility aura) */}
        {moveFx && (
          <div key={`mv-${moveFx.id}`} style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:6 }}>
            <MoveFx anim={moveFx.anim} color={moveFx.color} from={moveFx.from} category={moveFx.category} element={moveFx.element} power={moveFx.power} />
          </div>
        )}
        {/* Screen flash on hit */}
        {screenFlash && (
          <div key={`sf-${screenFlash}`} style={{
            position:"absolute", inset:0, pointerEvents:"none", zIndex:8,
            background: screenFlash === "player" ? "#ff333318" : "#ffffff18",
            animation: "screenFlashFade 0.19s ease-out forwards",
          }}/>
        )}
        {/* Resonance burst FX — element-specific cinematic overlay */}
        {resonanceFx && (
          <div key={`res-${resonanceFx.id}`} style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:9 }}>
            <ResonanceFx element={resonanceFx.element} color={resonanceFx.color} />
          </div>
        )}
        {/* Attack streak + impact burst */}
        {attackFx && (
          <div key={`atk-${attackFx.id}`} style={{
            position:"absolute", inset:0, pointerEvents:"none", zIndex:5,
          }}>
            <div style={{
              position:"absolute",
              ...(attackFx.from === "player"
                ? { left:"24%", top:"54%" }
                : { right:"29%", top:"54%" }),
              width:80, height:6, borderRadius:3,
              background:`linear-gradient(90deg, transparent, ${attackFx.color}, #ffffff, ${attackFx.color}, transparent)`,
              filter:`drop-shadow(0 0 10px ${attackFx.color})`,
              transformOrigin: attackFx.from === "player" ? "left center" : "right center",
              animation: `${attackFx.from === "player" ? "slashRight" : "slashLeft"} 0.45s ease-out forwards`,
            }}/>
            <div style={{
              position:"absolute",
              ...(attackFx.from === "player"
                ? { right:"29%", top:"54%" }
                : { left:"22%", top:"56%" }),
              width:70, height:70,
              borderRadius:"50%",
              background:`radial-gradient(circle, #ffffff 0%, ${attackFx.color} 30%, transparent 72%)`,
              transform:"translate(-50%,-50%) scale(0)",
              animation:"burstFx 0.55s ease-out 0.32s forwards",
              mixBlendMode:"screen",
            }}/>
            {/* Element shards flung from the impact point */}
            <div style={{
              position:"absolute",
              ...(attackFx.from === "player"
                ? { right:"29%", top:"54%" }
                : { left:"22%", top:"56%" }),
              width:0, height:0,
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  position:"absolute", left:0, top:0,
                  width:7, height:7, borderRadius:"50%",
                  background:attackFx.color,
                  boxShadow:`0 0 8px ${attackFx.color}, 0 0 3px #fff`,
                  ["--ang" as string]: `${i * 45}deg`,
                  transform:"rotate(var(--ang)) translateX(0)",
                  animation:`shard 0.5s ease-out 0.32s forwards`,
                  mixBlendMode:"screen",
                }}/>
              ))}
            </div>
          </div>
        )}

        {/* Floating damage number */}
        {dmgFx && (
          <div key={`dmg-${dmgFx.id}`} style={{
            position:"absolute",
            ...(dmgFx.at === "wild"
              ? { right:"29%", top:"50%" }
              : { left:"22%", top:"50%" }),
            color: dmgFx.crit ? "#ffd040" : "#ff5040",
            fontSize: dmgFx.crit ? 38 : 30, fontWeight:900,
            textShadow: dmgFx.crit
              ? "0 0 6px #000, 2px 2px 0 #804000, 0 0 16px #ffb020"
              : "0 0 6px #000, 2px 2px 0 #500, 0 0 14px #ff2020",
            pointerEvents:"none", zIndex:6,
            animation:"dmgFloat 0.9s ease-out forwards",
            letterSpacing:1,
          }}>−{dmgFx.value}</div>
        )}

        {/* Heal motes */}
        {auxFx?.kind === "heal" && (
          <div key={`aux-${auxFx.id}`} style={{
            position:"absolute", left:"15%", top:"46%",
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
            position:"absolute", left:"23.5%", top:"54%",
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
            position:"absolute", right:"24%", top:"46%",
            color:"#a8d8ff", fontSize:15, fontWeight:900,
            textShadow:"0 0 8px #000, 0 0 12px #4080ff",
            letterSpacing:2,
            pointerEvents:"none", zIndex:6,
            animation:"feintLbl 0.75s ease-out forwards",
          }}>FEINT!</div>
        )}

        {/* Shell capture sequence — shell sprite rides absolute positioning */}
        {shellFx && (
          <>
            {/* Bonding bloom — element light pulses from the set shell as it opens */}
            {(shellFx.phase === "set" || shellFx.phase === "wobble") && (
              <div key={`bloom-${shellFx.id}`} style={{
                position:"absolute", right:"27%", top:"50%",
                width:120, height:120, borderRadius:"50%",
                transform:"translate(50%,-50%) scale(0)",
                background:`radial-gradient(circle, ${typeColor(wild.type)}cc 0%, ${typeColor(wild.type)}33 45%, transparent 72%)`,
                pointerEvents:"none", zIndex:6,
                animation:"shellBloom 1.4s ease-out 0.4s forwards",
                mixBlendMode:"screen",
              }}/>
            )}
            <div key={`shell-${shellFx.id}-${shellFx.phase}`} style={{
              position:"absolute",
              // Set down at the wild's centroid for set/wobble/resolve
              right:"27%", top:"50%",
              width:46, height:46,
              pointerEvents:"none", zIndex:7,
              animation:
                shellFx.phase === "set"    ? "shellSet 0.6s cubic-bezier(.3,.7,.4,1) forwards" :
                shellFx.phase === "wobble" ? "shellWobble 1.5s ease-in-out" :
                shellFx.phase === "caught" ? "shellCaught 0.75s ease-out forwards" :
                                              "shellBreak 0.7s ease-out forwards",
            }}>
              <img src="/__mockup/images/weathered-shell.png" alt="" style={{
                width:"100%", height:"100%", objectFit:"contain",
                filter:"drop-shadow(0 0 12px rgba(200,160,90,0.85))",
              }}/>
            </div>
            {/* Bond-formed sparkles rise on a successful catch */}
            {shellFx.phase === "caught" && (
              <div key={`spark-${shellFx.id}`} style={{
                position:"absolute", right:"27%", top:"50%",
                width:0, height:0, pointerEvents:"none", zIndex:8,
              }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{
                    position:"absolute", left:0, top:0,
                    width:6, height:6, borderRadius:"50%",
                    background:"#ffe9a0",
                    boxShadow:"0 0 8px #ffd060, 0 0 3px #fff",
                    ["--sx" as string]: `${(i - 5) * 9}px`,
                    animation:`bondSpark 0.75s ease-out ${i * 0.03}s forwards`,
                  }}/>
                ))}
              </div>
            )}
            {/* ── Capture burst FX — flash + type radial + BONDED! label ── */}
            {shellFx.phase === "caught" && (
              <>
                {/* Brief white flash */}
                <div key={`cflash-${shellFx.id}`} style={{
                  position:"absolute", inset:0,
                  background:"#fff", pointerEvents:"none", zIndex:12,
                  animation:"bondFlash 0.5s ease-out forwards",
                  mixBlendMode:"screen",
                }}/>
                {/* Type-colored radial burst from wild's position */}
                <div key={`cburst-${shellFx.id}`} style={{
                  position:"absolute", left:"70%", top:"61%",
                  width:220, height:220, borderRadius:"50%",
                  background:`radial-gradient(circle, ${typeColor(currentOpponent.type)}ee 0%, ${typeColor(currentOpponent.type)}77 35%, transparent 70%)`,
                  transform:"translate(-50%,-50%) scale(0)",
                  pointerEvents:"none", zIndex:9,
                  animation:"bondBurst 0.9s ease-out 0.05s forwards",
                  mixBlendMode:"screen",
                }}/>
                {/* "BONDED!" rising label */}
                <div key={`clbl-${shellFx.id}`} style={{
                  position:"absolute", left:"70%", top:"50%",
                  color:"#ffe080", fontSize:20, fontWeight:900,
                  letterSpacing:3, whiteSpace:"nowrap",
                  textShadow:"0 0 14px #ffc040, 0 0 28px #ff8020, 0 0 4px #fff",
                  pointerEvents:"none", zIndex:13,
                  transform:"translate(-50%,-50%) scale(0.5) translateY(20px)",
                  animation:"bondLabel 1.3s ease-out 0.1s forwards",
                }}>BONDED!</div>
              </>
            )}
          </>
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
        </div>{/* arena */}
      </div>{/* stage */}

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

        {(menu === "switch" || menu === "switchForced") ? (
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:8 }}>
            <div style={{ color:"#f0d890", fontSize:11, fontWeight:800, textAlign:"center", marginBottom:2 }}>
              {menu === "switchForced" ? "Choose your next Tayanari" : "Switch to…"}
            </div>
            {team.map((m, i) => {
              const hp = teamHp[i] ?? 0;
              const ko = hp <= 0;
              const isActive = i === activeIdx;
              return (
                <button
                  key={m.id + ":" + i}
                  disabled={ko || isActive}
                  onClick={() => doSwitch(i)}
                  style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"8px 10px", borderRadius:7,
                    background: isActive ? BTN_BG_HI : BTN_BG,
                    border:"1.5px solid rgba(180,130,60,0.45)",
                    color: ko ? "#8a6a5a" : "#f0d890",
                    fontSize:11, fontWeight:800,
                    cursor: (ko || isActive) ? "default" : "pointer",
                    opacity: ko ? 0.5 : 1,
                  }}
                >
                  <span>{m.name} <span style={{ color:"#aaa", fontWeight:600 }}>Lv.{m.level}</span></span>
                  <span style={{ color: ko ? "#8a6a5a" : "#c8c8c8", fontWeight:700 }}>
                    {ko ? "Fainted" : `${hp}/${m.stats.hp}`}{isActive ? " • active" : ""}
                  </span>
                </button>
              );
            })}
            {menu === "switch" && (
              <button onClick={() => setMenu("root")} style={{
                padding:"8px", background:BTN_BG, border:"1.5px solid rgba(180,130,60,0.45)",
                borderRadius:7, color:"#f0d890", fontSize:11, fontWeight:800, cursor:"pointer",
              }}>← Back</button>
            )}
          </div>
        ) : menu === "shellConfirm" ? (
          <div style={{ display:"flex", gap:6, marginTop:8 }}>
            <button onClick={doShellSet} style={confirmBtn("#4a8a4a")}>
              Set Shell ({shellsCount})
            </button>
            <button onClick={() => setMenu("root")} style={confirmBtn("#7a3a3a")}>
              Cancel
            </button>
          </div>
        ) : menu === "moves" ? (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(2, 1fr)",
            gap:5, marginTop:8,
          }}>
            {playerMoves.map(m => {
              const pp = playerPp[m.id] ?? 0;
              const out = pp <= 0;
              return (
                <MoveBtn
                  key={m.id}
                  move={m}
                  pp={pp}
                  eff={m.category === "damage" && m.element && wildEl ? effectiveness(m.element, wildEl) : 1}
                  disabled={busy || out}
                  onClick={() => onMove(out ? STRUGGLE : m)}
                />
              );
            })}
            {playerMoves.every(m => (playerPp[m.id] ?? 0) <= 0) && (
              <MoveBtn move={STRUGGLE} pp={99} eff={1} disabled={busy} onClick={() => onMove(STRUGGLE)} />
            )}
            <button onClick={() => setMenu("root")} style={{
              gridColumn:"1 / -1", padding:"8px",
              background:BTN_BG, border:"1.5px solid rgba(180,130,60,0.45)",
              borderRadius:7, color:"#f0d890", fontSize:11, fontWeight:800, cursor:"pointer",
            }}>← Back</button>
          </div>
        ) : menu === "bag" ? (
          <div style={{ marginTop:8 }}>
            <div style={{ color:"#c8a44a", fontSize:10, fontWeight:900, letterSpacing:1.5, marginBottom:6, textTransform:"uppercase" }}>Field Berries</div>
            {[
              { key:"dusk"  as const, label:"Duskberry",   sub:"HP +30%",  count:berryCount.dusk,   img:"/__mockup/images/duskberry.png",   color:"#9860d0", onClick:onUseDusk   },
              { key:"thorn" as const, label:"Thornberry",  sub:"ATK +8",   count:berryCount.thorn,  img:"/__mockup/images/thornberry.png",  color:"#e03030", onClick:onUseThorn  },
              { key:"calm"  as const, label:"Calmberry",   sub:"DEF +8",   count:berryCount.calm,   img:"/__mockup/images/calmberry.png",   color:"#30b870", onClick:onUseCalm   },
              { key:"bright"as const, label:"Brightberry", sub:"PP+CD fix",count:berryCount.bright,img:"/__mockup/images/brightberry.png", color:"#e0c020", onClick:onUseBright },
            ].map(b => (
              <button key={b.key} disabled={busy || b.count <= 0} onClick={b.onClick} style={{
                display:"flex", alignItems:"center", gap:10, width:"100%",
                background: b.count > 0 ? BTN_BG : "rgba(30,20,10,0.6)",
                border:`1.5px solid ${b.count > 0 ? "rgba(180,130,60,0.45)" : "rgba(100,70,30,0.2)"}`,
                borderRadius:8, padding:"7px 10px", marginBottom:5,
                cursor: b.count > 0 ? "pointer" : "default", opacity: b.count > 0 ? 1 : 0.45,
              }}>
                <img src={b.img} alt={b.label} style={{ width:32, height:32, objectFit:"contain", flexShrink:0 }}/>
                <div style={{ flex:1, textAlign:"left" }}>
                  <div style={{ color:"#f0d890", fontSize:12, fontWeight:800 }}>{b.label}</div>
                  <div style={{ color:"#a08050", fontSize:10 }}>{b.sub}</div>
                </div>
                <div style={{ color: b.count > 0 ? b.color : "#604020", fontSize:13, fontWeight:900 }}>×{b.count}</div>
              </button>
            ))}
            <button onClick={() => setMenu("root")} style={{
              width:"100%", padding:"8px",
              background:BTN_BG, border:"1.5px solid rgba(180,130,60,0.45)",
              borderRadius:7, color:"#f0d890", fontSize:11, fontWeight:800, cursor:"pointer", marginTop:2,
            }}>← Back</button>
          </div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(3, 1fr)",
            gap:5, marginTop:8,
          }}>
            <BattleBtn label="Moves"    sub="select"         disabled={busy} onClick={() => setMenu("moves")}/>
            <BattleBtn label="Resonate" sub={hasResonanceStone ? `${resBar}/15` : "locked"} disabled={busy || !hasResonanceStone || resBar < 15} onClick={onResonate}/>
            <BattleBtn label="Set Shell" sub={isKeeper ? "bonded" : `×${shellsCount}`} disabled={busy || isKeeper || shellsCount <= 0} onClick={onShell}/>
            <BattleBtn label="Heal"     sub={healCd > 0 ? `CD ${healCd}` : "50%"} disabled={busy || healCd > 0} onClick={onHeal}/>
            <BattleBtn label="Rune"     sub={healingRuneEquipped ? `×${runeUses}` : "—"} disabled={busy || !healingRuneEquipped || runeUses <= 0} onClick={onRune}/>
            <BattleBtn label="Switch"   sub={hasReserve ? "party" : "none"} disabled={busy || !hasReserve} onClick={() => setMenu("switch")}/>
            <BattleBtn label="Flee"     sub={isKeeper ? "locked" : "70%"} disabled={busy || isKeeper} onClick={onFlee}/>
            <BattleBtn label="Bag"      sub={`×${berryCount.dusk+berryCount.thorn+berryCount.calm+berryCount.bright}`} disabled={busy} onClick={() => setMenu("bag")}/>
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

        @keyframes screenFlashFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Mon entry (right side) + summon glimmer */
        @keyframes introFloatR { 0%{transform:translateX(60px) translateY(-20px);opacity:0} 100%{transform:translate(0,0);opacity:1} }
        @keyframes summonRing {
          0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
        @keyframes summonCore {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 0; }
          30%  { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
        }
        @keyframes summonSpark {
          0%   { transform: rotate(var(--ang)) translateY(0) scale(1); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: rotate(var(--ang)) translateY(-44px) scale(0.2); opacity: 0; }
        }

        /* Element impact shards */
        @keyframes shard {
          0%   { transform: rotate(var(--ang)) translateX(0)    scale(1);   opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: rotate(var(--ang)) translateX(48px) scale(0.2); opacity: 0; }
        }

        /* Feint dodge + lingering afterimage */
        @keyframes feintDodge {
          0%   { transform: translateX(0); }
          35%  { transform: translateX(26px) translateY(-4px); }
          70%  { transform: translateX(26px) translateY(-4px); }
          100% { transform: translateX(0); }
        }
        @keyframes feintGhost {
          0%   { opacity: 0.55; transform: translateX(0); }
          100% { opacity: 0;    transform: translateX(-14px); }
        }

        /* Capture timeline — the shell is SET down (descends + places), not thrown */
        @keyframes shellSet {
          0%   { transform: translateY(-120px) scale(0.7); opacity: 0; }
          25%  { opacity: 1; }
          70%  { transform: translateY(6px)   scale(1.06); }
          100% { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes shellBloom {
          0%   { transform: translate(50%,-50%) scale(0);   opacity: 0; }
          30%  { transform: translate(50%,-50%) scale(1);   opacity: 0.95; }
          100% { transform: translate(50%,-50%) scale(1.8); opacity: 0; }
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
          40%  { transform: scale(1.4);              filter: drop-shadow(0 0 40px #ffd060) brightness(2); }
          100% { transform: scale(0.5) translateY(20px); opacity: 0; filter: drop-shadow(0 0 8px #ffd060); }
        }
        @keyframes bondSpark {
          0%   { transform: translate(-50%,-50%) translate(var(--sx),0) scale(1); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) translate(var(--sx),-52px) scale(0.2); opacity: 0; }
        }
        @keyframes shellBreak {
          0%   { transform: scale(1) rotate(0deg); }
          30%  { transform: scale(1.25) rotate(180deg); filter: drop-shadow(0 0 18px #ff6040) brightness(1.5); }
          100% { transform: scale(0) rotate(540deg);    opacity: 0; }
        }
        @keyframes bondBurst {
          0%   { transform: translate(-50%,-50%) scale(0);   opacity: 0.9; }
          55%  { transform: translate(-50%,-50%) scale(0.9); opacity: 0.75; }
          100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
        @keyframes bondFlash {
          0%   { opacity: 0.65; }
          100% { opacity: 0; }
        }
        @keyframes bondLabel {
          0%   { transform: translate(-50%,-50%) translateY(18px) scale(0.5);  opacity: 0; }
          18%  { transform: translate(-50%,-50%) translateY(0)    scale(1.12); opacity: 1; }
          68%  { transform: translate(-50%,-50%) translateY(0)    scale(1);    opacity: 1; }
          100% { transform: translate(-50%,-50%) translateY(-18px) scale(0.88); opacity: 0; }
        }
        ${RESONANCE_FX_KEYFRAMES}
        ${MOVE_FX_KEYFRAMES}
      `}</style>
    </div>
  );

  function hpPlateStyle(who: "enemy" | "player"): React.CSSProperties {
    // Both plates pinned to the top: the player's Tayanari on the left,
    // the enemy on the right.
    return {
      position:"absolute",
      top:    10,
      left:   who === "player" ? 8 : "auto",
      right:  who === "enemy"  ? 8 : "auto",
      padding:"6px 10px",
      background:"linear-gradient(180deg, rgba(28,20,10,0.94), rgba(14,8,4,0.94))",
      border:"1.5px solid rgba(180,130,60,0.5)",
      borderRadius:8,
      minWidth:"min(140px, 42vw)",
      boxShadow:"0 2px 8px rgba(0,0,0,0.5)",
    };
  }
}

// Element-tinted glimmer that blooms where a mon materializes at battle start.
function SummonBurst({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  return (
    <div style={{ position:"absolute", left:`${x}%`, top:`${y}%`, width:0, height:0 }}>
      {/* Expanding ring */}
      <div style={{
        position:"absolute", left:0, top:0,
        width:90, height:90, borderRadius:"50%",
        border:`3px solid ${color}`,
        boxShadow:`0 0 16px ${color}`,
        transform:"translate(-50%,-50%) scale(0.1)",
        animation:`summonRing 0.9s ease-out ${delay}s forwards`,
        mixBlendMode:"screen",
      }}/>
      {/* Soft core flash */}
      <div style={{
        position:"absolute", left:0, top:0,
        width:70, height:70, borderRadius:"50%",
        background:`radial-gradient(circle, #ffffff 0%, ${color} 40%, transparent 72%)`,
        transform:"translate(-50%,-50%) scale(0)",
        animation:`summonCore 0.9s ease-out ${delay}s forwards`,
        mixBlendMode:"screen",
      }}/>
      {/* Rising sparkles */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:0, top:0,
          width:6, height:6, borderRadius:"50%",
          background:color,
          boxShadow:`0 0 8px ${color}, 0 0 3px #fff`,
          ["--ang" as string]: `${(i - 3) * 18}deg`,
          transform:"rotate(var(--ang)) translateY(0)",
          animation:`summonSpark 0.95s ease-out ${delay + i * 0.04}s forwards`,
          mixBlendMode:"screen",
        }}/>
      ))}
    </div>
  );
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

// In-battle move button — shows name, element/category tag, PP, and an
// effectiveness hint vs. the current opponent.
function MoveBtn({
  move, pp, eff, disabled, onClick,
}: { move: Move; pp: number; eff: number; disabled?: boolean; onClick: () => void }) {
  const accent =
    move.category === "damage"
      ? (move.element ? typeColor(move.element) : "#ffe080")
      : move.category === "heal" ? "#80ff90"
      : move.category === "buff" ? "#ff9060"
      : "#80b8ff";
  const tag =
    move.category === "damage" ? (move.element ?? "Neutral")
    : move.category === "heal" ? "Heal"
    : move.category === "buff" ? "Attack ↑" : "Defense ↑";
  const effHint = move.category === "damage" && eff !== 1
    ? (eff >= 2 ? "▲ strong" : "▼ weak") : "";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:"7px 9px", textAlign:"left",
        background: disabled ? BTN_BG : BTN_BG_HI,
        border:`1.5px solid ${accent}88`,
        borderLeft:`4px solid ${accent}`,
        borderRadius:7,
        color: disabled ? "#9a8458" : "#f4dca0",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display:"flex", flexDirection:"column", gap:2, minHeight:46,
      }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:6 }}>
        <span style={{ fontSize:12, fontWeight:800 }}>{move.name}</span>
        <span style={{ fontSize:9, fontWeight:700, opacity:0.7 }}>PP {pp >= 99 ? "∞" : pp}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:6 }}>
        <span style={{ fontSize:9, fontWeight:700, color: accent }}>{tag}</span>
        {effHint && (
          <span style={{ fontSize:9, fontWeight:800, color: eff >= 2 ? "#7dff8a" : "#ff8a7a" }}>
            {effHint}
          </span>
        )}
      </div>
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
