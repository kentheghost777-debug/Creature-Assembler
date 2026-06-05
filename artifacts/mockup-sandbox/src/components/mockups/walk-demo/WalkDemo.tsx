import { useEffect, useRef, useState, useCallback, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from "react";
import { BattleScene, RARITY_COLOR, sheetBgStyle, type SpriteSheet, type MonSpec, type MonRarity, type BattleResult, type StarterStats, type StarterSpec, type BattleMon } from "./BattleScene";
import { EvoScene } from "./EvoScene";
import { SHELLS, ELEMENT_COLOR, BATTLE_SHELLS, BATTLE_RUNES, BATTLE_SHELLS_BY_ID, BATTLE_RUNES_BY_ID } from "./progression";
import {
  getMove, moveName, asElement,
  learnedMoveIds, movesLearnedAt, defaultActiveMoves, sanitizeActiveMoves,
  partyBattleStats, wildLevelFor,
  type Move,
} from "./moves";
import { type CharId, type RoleId, type PartySave, type PartyMon, type WorldSave, ROLES, readSave, updateParty, updateWorld, updateRole, roleDef } from "./save";
import { playTrack, playJingle, stopAll, playSfx } from "./audioManager";

/** Hydrate caught/box entries on load. Older saves stored bare MonSpec (no
 *  progression); those default to the level the mon was caught at. */
function hydrateParty(arr: PartyMon[]): PartyMon[] {
  return arr.map(m => ({
    ...m,
    level: typeof m.level === "number" ? m.level : (wildLevelFor(m.rarity) || 5),
    xp:    typeof m.xp === "number" ? m.xp : 0,
  }));
}

// ── Audio track paths ─────────────────────────────────────────────────────
const TOWN_TRACK   = "/__mockup/audio/primeria_town.mp3";
const BATTLE_TRACK = "/__mockup/audio/primeria_battle.mp3";
const ROUTE_TRACK  = "/__mockup/audio/primeria_route.mp3";
const WIN_JINGLE   = "/__mockup/audio/primeria_victory.mp3";
const CATCH_JINGLE = "/__mockup/audio/primeria_catch.mp3";

// ── Level-up reward generation ────────────────────────────────────────────
const STAT_KEYS = ["hp", "atk", "def", "spd"] as const;
type StatKey = typeof STAT_KEYS[number];
const STAT_LABEL: Record<StatKey, string> = { hp: "HP", atk: "ATK", def: "DEF", spd: "SPD" };

function rollLevelUpGains(): Partial<Record<StatKey, number>> {
  // 2 or 3 unique stats, each +1..+5. HP gains are scaled ×3 so HP feels meaningful.
  const count = Math.random() < 0.5 ? 2 : 3;
  const pool = [...STAT_KEYS];
  const gains: Partial<Record<StatKey, number>> = {};
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const stat = pool.splice(idx, 1)[0];
    const amt  = 1 + Math.floor(Math.random() * 5); // 1..5
    gains[stat] = stat === "hp" ? amt * 3 : amt;
  }
  return gains;
}

// ── Out-of-battle move manager ────────────────────────────────────────────
// Lets the player choose which (up to 4) of their learned moves are active in
// battle. Rendered inside the party tab of the journal. Pure UI — parent owns
// the active-move id list and persists it.
function MoveManager({
  element, level, active, onChange,
}: { element: string; level: number; active: string[]; onChange: (next: string[]) => void }) {
  const el = asElement(element);
  if (!el) return null;
  const learned = learnedMoveIds(el, level);
  const activeValid = active.filter(id => learned.includes(id));

  const toggle = (id: string) => {
    if (activeValid.includes(id)) {
      if (activeValid.length <= 1) return;            // always keep ≥1 active
      onChange(activeValid.filter(x => x !== id));
    } else {
      if (activeValid.length >= 4) return;            // 4 active slots max
      onChange([...activeValid, id]);
    }
  };

  const tagFor = (m: Move) =>
    m.category === "damage" ? (m.element ?? "Neutral")
    : m.category === "heal" ? "Heal"
    : m.category === "buff" ? "Attack ↑" : "Defense ↑";
  const accentFor = (m: Move) =>
    m.category === "damage"
      ? (m.element ? ELEMENT_COLOR[m.element] : "#caa050")
      : m.category === "heal" ? "#4aa860"
      : m.category === "buff" ? "#c06030" : "#3a78c0";

  return (
    <div style={{ padding:"4px 2px 12px", borderBottom:"1px dashed rgba(100,64,20,0.28)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
        <span style={{ fontSize:10, fontWeight:900, letterSpacing:1.6, color:"#8a5c22" }}>MOVES</span>
        <span style={{ fontSize:9.5, fontWeight:700, color:"#a07848" }}>
          {activeValid.length}/4 active · tap to {activeValid.length >= 4 ? "swap" : "equip"}
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {learned.map(id => {
          const m = getMove(id);
          if (!m) return null;
          const on = activeValid.includes(id);
          const accent = accentFor(m);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              style={{
                display:"flex", alignItems:"center", gap:9, width:"100%",
                padding:"7px 9px", textAlign:"left", cursor:"pointer",
                borderRadius:8,
                background: on ? `${accent}1c` : "rgba(100,64,20,0.04)",
                border: on ? `1.5px solid ${accent}` : "1px solid rgba(100,64,20,0.18)",
                borderLeft: `4px solid ${on ? accent : "rgba(100,64,20,0.18)"}`,
              }}
            >
              <span style={{
                width:16, height:16, borderRadius:5, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:900,
                background: on ? accent : "transparent",
                border: on ? "none" : "1.5px solid rgba(100,64,20,0.3)",
                color:"#fff",
              }}>{on ? "✓" : ""}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:"#2a1206", fontWeight:800, fontSize:12.5 }}>{m.name}</div>
                <div style={{ color:"#8a6a40", fontSize:9, marginTop:1 }}>{m.desc}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2, flexShrink:0 }}>
                <span style={{ fontSize:9, fontWeight:800, color: accent }}>{tagFor(m)}</span>
                <span style={{ fontSize:8.5, fontWeight:700, color:"#a07848" }}>
                  {m.category === "damage" ? `PWR ${m.power}` : `PP ${m.pp}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── World sizes (pixels) ────────────────────────────────────────────────────
const OW = { w: 1124, h: 900 }; // overworld — matches full 1402×1122 map image at 900px height
const LB = { w: 700, h: 700 }; // lab
const R1 = { w: 1024, h: 723 }; // Whisperroot Trail (Area 1) — dims match bg art aspect
const SPEED     = 3.5;
const ZOOM      = 0.82; // zoom-out factor — values <1 show more of the world

// ── DEV door editor: localStorage overrides for door rects + per-door glow ──
const DEV_DOOR_KEY = "primeria_dev_doors";
const DEV_GLOW_KEY = "primeria_dev_glows";
function _loadDevMap(k: string): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; }
}
const _devDoors = _loadDevMap(DEV_DOOR_KEY);
const _devGlows = _loadDevMap(DEV_GLOW_KEY);
function ld(key: string, def: Rect): Rect {
  const v = _devDoors[key];
  return (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number"))
    ? [v[0], v[1], v[2], v[3]] as Rect : def;
}
function ldGlow(key: string, def: boolean): boolean {
  const v = _devGlows[key];
  return typeof v === "boolean" ? v : def;
}
// DEV wall editor persistence: per-scene collider rects + the global walls on/off flag.
const DEV_WALL_KEY = "primeria_dev_walls";
const DEV_WALLSON_KEY = "primeria_dev_walls_on";
const _devWalls = _loadDevMap(DEV_WALL_KEY);
function ldWalls(key: string, def: Rect[]): Rect[] {
  const v = _devWalls[key];
  if (Array.isArray(v) && v.every((r) => Array.isArray(r) && r.length === 4 && r.every((n: unknown) => typeof n === "number"))) {
    return (v as number[][]).map((r) => [r[0], r[1], r[2], r[3]] as Rect);
  }
  return def;
}
const SPRITE_PX = 96;   // bigger on mobile
const ANCHOR    = 0.75; // fraction of sprite above anchor point

// ── Tayanari starter data ───────────────────────────────────────────────────
const STARTERS = [
  { id: "burg",       name: "Burg",       type: "Frostformed",  color: "#7ddeff", img: "/__mockup/images/frostbite-baby.png" },
  { id: "pebble",     name: "Pebble",     type: "Earthbound",   color: "#c8a020", img: "/__mockup/images/grrountain-baby.png", faces: "left" as const },
  { id: "peachi",     name: "Pea-chi",    type: "Nature",       color: "#50c040", img: "/__mockup/images/leafkit.png" },
  { id: "cerepup",    name: "Cerepup",    type: "Volcanic",     color: "#ff6020", img: "/__mockup/images/emberfox.png" },
  { id: "cunbubble",  name: "Cun-bubble", type: "Oceanic",      color: "#3080ff", img: "/__mockup/images/phantorch.png" },
  { id: "shockit",    name: "Shockit",    type: "Stormproven",  color: "#ffd000", img: "/__mockup/images/voltfang.png" },
  { id: "mentyke",    name: "Mentyke",    type: "Mind",         color: "#c080ff", img: "/__mockup/images/lumacorn.png" },
  { id: "foxin",      name: "Foxin",      type: "Spirit",       color: "#60a070", img: "/__mockup/images/vixgrim.png" },
] as const;
type StarterId = typeof STARTERS[number]["id"];

// ── Evolution ────────────────────────────────────────────────────────────────
// TODO: Replace placeholder names + imgs with final evolved-form assets once provided.
//       Drop each evo sprite at /__mockup/images/<name>.png and run background-removal.
// TODO: Set EVO_BG_IMG to "/__mockup/images/evo-bg.png" once the evo background is ready.
const EVO_BG_IMG: string | undefined = "/__mockup/images/evo-bg.png";

const EVO_TABLE: Array<{ from: string; atLevel: number; to: StarterSpec }> = [
  { from:"burg",        atLevel:18, to:{ id:"burg_2",       name:"Burg·II",        type:"Frostformed",  color:"#7ddeff", img:"/__mockup/images/burg.png"  } },
  { from:"burg_2",      atLevel:30, to:{ id:"burg_3",       name:"Burg·III",       type:"Frostformed",  color:"#7ddeff", img:"/__mockup/images/burg_3.png"  } },
  { from:"pebble",      atLevel:18, to:{ id:"pebble_2",     name:"Pebble·II",      type:"Earthbound",   color:"#c8a020", img:"/__mockup/images/pebble.png" } },
  { from:"pebble_2",    atLevel:30, to:{ id:"pebble_3",     name:"Pebble·III",     type:"Earthbound",   color:"#c8a020", img:"/__mockup/images/pebble_3.png" } },
  { from:"peachi",      atLevel:18, to:{ id:"peachi_2",     name:"Pea-chi·II",     type:"Nature",       color:"#50c040", img:"/__mockup/images/peachi.png"          } },
  { from:"peachi_2",    atLevel:30, to:{ id:"peachi_3",     name:"Pea-chi·III",    type:"Nature",       color:"#50c040", img:"/__mockup/images/peachi_3.png"          } },
  { from:"cerepup",     atLevel:18, to:{ id:"cerepup_2",    name:"Caragnar",       type:"Volcanic",     color:"#ff5010", img:"/__mockup/images/cerepup_evo1.png" } },
  { from:"cerepup_2",   atLevel:30, to:{ id:"cerepup_3",    name:"Bifernon",       type:"Volcanic",     color:"#ff3000", img:"/__mockup/images/cerepup_evo2.png" } },
  { from:"cunbubble",   atLevel:18, to:{ id:"cunbubble_2",  name:"Cun-bubble·II",  type:"Oceanic",      color:"#3080ff", img:"/__mockup/images/phantorch.png"        } },
  { from:"cunbubble_2", atLevel:30, to:{ id:"cunbubble_3",  name:"Cun-bubble·III", type:"Oceanic",      color:"#3080ff", img:"/__mockup/images/phantorch.png"        } },
  { from:"shockit",     atLevel:18, to:{ id:"shockit_2",    name:"Shockit·II",     type:"Stormproven",  color:"#ffd000", img:"/__mockup/images/shockit_2.png"        } },
  { from:"shockit_2",   atLevel:30, to:{ id:"shockit_3",    name:"Shockit·III",    type:"Stormproven",  color:"#ffd000", img:"/__mockup/images/shockit_3.png"        } },
  { from:"mentyke",     atLevel:18, to:{ id:"mentyke_2",    name:"Sanctyke",       type:"Mind",         color:"#90c0ff", img:"/__mockup/images/mentyke_evo1.png" } },
  { from:"mentyke_2",   atLevel:30, to:{ id:"mentyke_3",    name:"Lumayke",        type:"Mind",         color:"#d0b0ff", img:"/__mockup/images/mentyke_evo2.png" } },
  { from:"foxin",       atLevel:18, to:{ id:"foxin_2",      name:"Foxin·II",       type:"Spirit",       color:"#60a070", img:"/__mockup/images/vixgrim.png"          } },
  { from:"foxin_2",     atLevel:30, to:{ id:"foxin_3",      name:"Foxin·III",      type:"Spirit",       color:"#60a070", img:"/__mockup/images/vixgrim.png"          } },
  // ── Wild evo lines (4 Area 3 chains) ────────────────────────────────────────
  { from:"sprigget",    atLevel:18, to:{ id:"sprigget_2",   name:"Verdusk",        type:"Nature",       color:"#3a9828", img:"" } },
  { from:"sprigget_2",  atLevel:30, to:{ id:"sprigget_3",   name:"Grovekai",       type:"Nature",       color:"#2a7818", img:"" } },
  { from:"ashcrawl",    atLevel:18, to:{ id:"ashcrawl_2",   name:"Embrak",         type:"Volcanic",     color:"#ff4000", img:"" } },
  { from:"ashcrawl_2",  atLevel:30, to:{ id:"ashcrawl_3",   name:"Magnarok",       type:"Volcanic",     color:"#cc2000", img:"" } },
  { from:"finwing",     atLevel:18, to:{ id:"finwing_2",    name:"Coralfin",       type:"Oceanic",      color:"#2090e0", img:"" } },
  { from:"finwing_2",   atLevel:30, to:{ id:"finwing_3",    name:"Tidalvast",      type:"Oceanic",      color:"#10a0c0", img:"" } },
  { from:"driftpaw_f",  atLevel:18, to:{ id:"driftpaw_2",   name:"Gustfang",       type:"Skyborne",     color:"#60a8ff", img:"" } },
  { from:"driftpaw_m",  atLevel:18, to:{ id:"driftpaw_2",   name:"Gustfang",       type:"Skyborne",     color:"#60a8ff", img:"" } },
  { from:"driftpaw_2",  atLevel:30, to:{ id:"driftpaw_3",   name:"Stormayne",      type:"Skyborne",     color:"#4080ff", img:"" } },
  // ── Secret evo lines (one per area — hidden from player until it happens) ───
  { from:"pebkin",      atLevel:18, to:{ id:"stonebrute",   name:"Stonebrute",     type:"Earthbound",   color:"#8b7355", img:"/__mockup/images/stonebrute-wild.png" } },
  { from:"mudtot",      atLevel:18, to:{ id:"mireking",     name:"Mireking",       type:"Oceanic",      color:"#2d7a4a", img:"/__mockup/images/mireking-wild.png"   } },
  { from:"thornwraith", atLevel:18, to:{ id:"voidwraith",   name:"Voidwraith",     type:"Abyss",        color:"#3d1a5c", img:"/__mockup/images/voidwraith-wild.png" } },
  // ── Route 1 commons evo lines ─────────────────────────────────────────────
  { from:"hatchick",   atLevel:18, to:{ id:"fledgral",   name:"Fledgral",   type:"Skyborne",    color:"#60a8ff", img:"/__mockup/images/fledgral-wild.png"   } },
  { from:"fledgral",   atLevel:30, to:{ id:"skyvast",    name:"Skyvast",    type:"Skyborne",    color:"#3090ff", img:"/__mockup/images/skyvast-wild.png"    } },
  { from:"loth",       atLevel:18, to:{ id:"blomath",    name:"Blomath",    type:"Nature",      color:"#50c040", img:"/__mockup/images/blomath-wild.png"    } },
  { from:"blomath",    atLevel:30, to:{ id:"fernloth",   name:"Fernloth",   type:"Nature",      color:"#2a8820", img:"/__mockup/images/fernloth-wild.png"   } },
  { from:"voltowl",    atLevel:18, to:{ id:"strikorn",   name:"Strikorn",   type:"Stormproven", color:"#ffd000", img:"/__mockup/images/strikorn-wild.png"   } },
  { from:"strikorn",   atLevel:30, to:{ id:"thunderowl", name:"Thunderowl", type:"Stormproven", color:"#e8a000", img:"/__mockup/images/thunderowl-wild.png" } },
  { from:"fluttril",   atLevel:18, to:{ id:"windriel",   name:"Windriel",   type:"Nature",      color:"#40b040", img:"/__mockup/images/windriel-wild.png"   } },
  { from:"windriel",   atLevel:30, to:{ id:"zephyriel",  name:"Zephyriel",  type:"Nature",      color:"#30a030", img:"/__mockup/images/zephyriel-wild.png"  } },
  // ── Route 1 uncommons evo lines ───────────────────────────────────────────
  { from:"stonub",     atLevel:18, to:{ id:"ignaub",     name:"Ignaub",     type:"Volcanic",    color:"#ff5010", img:"/__mockup/images/ignaub-wild.png"     } },
  { from:"ignaub",     atLevel:30, to:{ id:"infernub",   name:"Infernub",   type:"Volcanic",    color:"#ff3000", img:"/__mockup/images/infernub-wild.png"   } },
  { from:"potent",     atLevel:18, to:{ id:"brewant",    name:"Brewant",    type:"Alchemy",     color:"#9040c0", img:"/__mockup/images/brewant-wild.png"    } },
  { from:"brewant",    atLevel:30, to:{ id:"alchemor",   name:"Alchemor",   type:"Alchemy",     color:"#6020a0", img:"/__mockup/images/alchemor-wild.png"   } },
  { from:"scavencrow", atLevel:18, to:{ id:"havencrow",  name:"Havencrow",  type:"Abyss",       color:"#5020a0", img:"/__mockup/images/havencrow-wild.png"  } },
  { from:"havencrow",  atLevel:30, to:{ id:"dreadcrow",  name:"Dreadcrow",  type:"Abyss",       color:"#3d1a5c", img:"/__mockup/images/dreadcrow-wild.png"  } },
  { from:"cindersnap", atLevel:18, to:{ id:"emberclaw",  name:"Emberclaw",  type:"Volcanic",    color:"#ff4000", img:"/__mockup/images/emberclaw-wild.png"  } },
  { from:"emberclaw",  atLevel:30, to:{ id:"moltensnap", name:"Moltensnap", type:"Volcanic",    color:"#cc2000", img:"/__mockup/images/moltensnap-wild.png" } },
  { from:"shimroot",   atLevel:18, to:{ id:"glowroot",   name:"Glowroot",   type:"Nature",      color:"#30c090", img:"/__mockup/images/glowroot-wild.png"   } },
  { from:"glowroot",   atLevel:30, to:{ id:"lumivine",   name:"Lumivine",   type:"Nature",      color:"#40a870", img:"/__mockup/images/lumivine-wild.png"   } },
  // ── Route 1 rares evo lines ───────────────────────────────────────────────
  { from:"ghosti",     atLevel:22, to:{ id:"spectrael",  name:"Spectrael",  type:"Spirit",      color:"#c070ff", img:"/__mockup/images/spectrael-wild.png"  } },
  { from:"scalel",     atLevel:22, to:{ id:"scalvorn",   name:"Scalvorn",   type:"Armored",     color:"#7a8a9a", img:"/__mockup/images/scalvorn-wild.png"   } },
  // ── Route 2 commons evo lines ─────────────────────────────────────────────
  { from:"mossback",   atLevel:18, to:{ id:"fernback",   name:"Fernback",   type:"Nature",      color:"#50c040", img:"/__mockup/images/fernback-wild.png"   } },
  { from:"fernback",   atLevel:30, to:{ id:"groveback",  name:"Groveback",  type:"Nature",      color:"#2a8820", img:"/__mockup/images/groveback-wild.png"  } },
  { from:"sparwing",   atLevel:18, to:{ id:"swiftwing",  name:"Swiftwing",  type:"Skyborne",    color:"#60a8ff", img:"/__mockup/images/swiftwing-wild.png"  } },
  { from:"swiftwing",  atLevel:30, to:{ id:"galewing",   name:"Galewing",   type:"Skyborne",    color:"#3090ff", img:"/__mockup/images/galewing-wild.png"   } },
  { from:"thornpup",   atLevel:18, to:{ id:"thornhound", name:"Thornhound", type:"Earthbound",  color:"#c8a020", img:"/__mockup/images/thornhound-wild.png" } },
  { from:"thornhound", atLevel:30, to:{ id:"bramblerex", name:"Bramblerex", type:"Earthbound",  color:"#a07010", img:"/__mockup/images/bramblerex-wild.png" } },
  { from:"frostpup",   atLevel:18, to:{ id:"frosthound", name:"Frosthound", type:"Frostformed", color:"#7ddeff", img:"/__mockup/images/frosthound-wild.png" } },
  { from:"frosthound", atLevel:30, to:{ id:"glaciend",   name:"Glaciend",   type:"Frostformed", color:"#50c0ff", img:"/__mockup/images/glaciend-wild.png"   } },
  // ── Route 2 uncommons evo lines ───────────────────────────────────────────
  { from:"frogling",   atLevel:18, to:{ id:"frogmar",    name:"Frogmar",    type:"Frostformed", color:"#7ddeff", img:"/__mockup/images/frogmar-wild.png"    } },
  { from:"frogmar",    atLevel:30, to:{ id:"glacitoad",  name:"Glacitoad",  type:"Frostformed", color:"#50c0ff", img:"/__mockup/images/glacitoad-wild.png"  } },
  { from:"duskrat",    atLevel:18, to:{ id:"duskfang",   name:"Duskfang",   type:"Abyss",       color:"#5020a0", img:"/__mockup/images/duskfang-wild.png"   } },
  { from:"duskfang",   atLevel:30, to:{ id:"voidrat",    name:"Voidrat",    type:"Abyss",       color:"#3d1a5c", img:"/__mockup/images/voidrat-wild.png"    } },
  { from:"marshclaw",  atLevel:18, to:{ id:"tidalclaw",  name:"Tidalclaw",  type:"Oceanic",     color:"#3080ff", img:"/__mockup/images/tidalclaw-wild.png"  } },
  { from:"tidalclaw",  atLevel:30, to:{ id:"torrential", name:"Torrential", type:"Oceanic",     color:"#2060d0", img:"/__mockup/images/torrential-wild.png" } },
  { from:"cragnite",   atLevel:18, to:{ id:"cragmite",   name:"Cragmite",   type:"Armored",     color:"#7a8a9a", img:"/__mockup/images/cragmite-wild.png"   } },
  { from:"cragmite",   atLevel:30, to:{ id:"cragvast",   name:"Cragvast",   type:"Armored",     color:"#5a6a7a", img:"/__mockup/images/cragvast-wild.png"   } },
  { from:"bleater",    atLevel:18, to:{ id:"rammid",     name:"Rammid",     type:"Nature",      color:"#50c040", img:"/__mockup/images/rammid-wild.png"     } },
  { from:"rammid",     atLevel:30, to:{ id:"verdhorn",   name:"Verdhorn",   type:"Nature",      color:"#3a9828", img:"/__mockup/images/verdhorn-wild.png"   } },
  // ── Route 2 rares evo lines ───────────────────────────────────────────────
  { from:"emberwyvlet",atLevel:22, to:{ id:"wyrmblaze",  name:"Wyrmblaze",  type:"Chaos",       color:"#cc44cc", img:"/__mockup/images/wyrmblaze-wild.png"  } },
  { from:"crysthorn",  atLevel:22, to:{ id:"glacihorn",  name:"Glacihorn",  type:"Frostformed", color:"#50c0ff", img:"/__mockup/images/glacihorn-wild.png"  } },
  { from:"thornalisk", atLevel:22, to:{ id:"ramorisk",   name:"Ramorisk",   type:"Earthbound",  color:"#a07010", img:"/__mockup/images/ramorisk-wild.png"   } },
  { from:"lumifang",   atLevel:22, to:{ id:"lumivast",   name:"Lumivast",   type:"Stormproven", color:"#e8a000", img:"/__mockup/images/lumivast-wild.png"   } },
  // ── Shore evo lines ──────────────────────────────────────────────────────────
  // Oceanic dragon line:  Tidescale → Coralcoil → Tidedrake
  { from:"tidescale",  atLevel:18, to:{ id:"coralcoil",   name:"Coralcoil",   type:"Oceanic",     color:"#3080ff", img:"/__mockup/images/torrential-wild.png"  } },
  { from:"coralcoil",  atLevel:30, to:{ id:"tidedrake",   name:"Tidedrake",   type:"Oceanic",     color:"#1050d0", img:"/__mockup/images/thalassyn-wild.png"   } },
  // Radiant unicorn line: Lumecolt → Solhoof → Auremane
  { from:"lumecolt",   atLevel:18, to:{ id:"solhoof",     name:"Solhoof",     type:"Radiant",     color:"#f5d860", img:"/__mockup/images/solarhowl-wild.png"   } },
  { from:"solhoof",    atLevel:30, to:{ id:"auremane",    name:"Auremane",    type:"Radiant",     color:"#fff176", img:"/__mockup/images/sylphara-wild.png"    } },
  // Nature griffon line: Gryfling → Gryphex → Celestgriff
  { from:"gryfling",   atLevel:18, to:{ id:"gryphex",     name:"Gryphex",     type:"Nature",      color:"#4ab840", img:"/__mockup/images/windriel-wild.png"    } },
  { from:"gryphex",    atLevel:30, to:{ id:"celestgriff", name:"Celestgriff", type:"Nature",      color:"#309020", img:"/__mockup/images/verdanox-player.png" } },
  // Volcanic drake line: Cindrakin → Pyrion → Magnadrake
  { from:"cindrakin",  atLevel:18, to:{ id:"pyrion",      name:"Pyrion",      type:"Volcanic",    color:"#ff5000", img:"/__mockup/images/emberclaw-wild.png"   } },
  { from:"pyrion",     atLevel:30, to:{ id:"magnadrake",  name:"Magnadrake",  type:"Volcanic",    color:"#cc2000", img:"/__mockup/images/wyrmblaze-wild.png"   } },
  // Abyss raven line:    Shaderow → Voidrook → Nightveil
  { from:"shaderow",   atLevel:18, to:{ id:"voidrook",    name:"Voidrook",    type:"Abyss",       color:"#5020a0", img:"/__mockup/images/duskfang-wild.png"    } },
  { from:"voidrook",   atLevel:30, to:{ id:"nightveil",   name:"Nightveil",   type:"Abyss",       color:"#3d1a5c", img:"/__mockup/images/voidwraith-wild.png"  } },
  // Armored crab line:   Shellcrag → Shellvast → Fortishelm
  { from:"shellcrag",  atLevel:18, to:{ id:"shellvast",   name:"Shellvast",   type:"Armored",     color:"#7a8a9a", img:"/__mockup/images/cragmite-wild.png"    } },
  { from:"shellvast",  atLevel:30, to:{ id:"fortishelm",  name:"Fortishelm",  type:"Armored",     color:"#5a6a7a", img:"/__mockup/images/cragvast-wild.png"    } },
  // Chaos dragon (2-stage):   Chaoryn → Drakoval
  { from:"chaoryn",    atLevel:22, to:{ id:"drakoval",    name:"Drakoval",    type:"Chaos",       color:"#cc44cc", img:"/__mockup/images/wyrmblaze-wild.png"   } },
  // Storm eagle (2-stage):    Galefledge → Galecrest
  { from:"galefledge", atLevel:22, to:{ id:"galecrest",   name:"Galecrest",   type:"Stormproven", color:"#e8b000", img:"/__mockup/images/thunderax-wild.png"   } },
  // Frost unicorn (2-stage):  Misthorn → Glacimane
  { from:"misthorn",   atLevel:22, to:{ id:"glacimane",   name:"Glacimane",   type:"Frostformed", color:"#50d0ff", img:"/__mockup/images/crysthorn-wild.png"   } },
];

/** Returns the StarterSpec the starter evolves into when it reaches exactly `atLevel`. */
function evoAt(currentId: string, atLevel: number): StarterSpec | null {
  return EVO_TABLE.find(e => e.from === currentId && e.atLevel === atLevel)?.to ?? null;
}

// ── Dialog phases ───────────────────────────────────────────────────────────
type Phase = "walk" | "d1" | "d2" | "pick" | "d3" | "role_pick" | "d4" | "d5"
           | "maya_d1" | "maya_d2" | "maya_d3" | "maya_d4"
           | "maya_post1" | "maya_post2" | "maya_post3"
           | "jay_d1"  | "jay_d2"  | "jay_d3"  | "jay_d4"  | "jay_d5"  | "jay_done"
           | "jess_d1" | "jess_d2" | "jess_d3"
           | "ellio_d1" | "ellio_d2" | "ellio_d3" | "ellio_done"
           | "lia_d1"  | "lia_d2"  | "lia_d3"  | "lia_d4"  | "lia_d5"  | "lia_done"
           | "jess_path_d1" | "jess_path_d2"
           | "prof2_d1" | "prof2_d2" | "prof2_d3" | "prof2_d4"
           | "farm_d1" | "farm_d2" | "farm_d3" | "farm_d4" | "farm_idle"
           | "scripted_t1" | "scripted_t2" | "scripted_set" | "scripted_caught"
           // Ambient "always talkable" idle chats (set no flags, never gate quests)
           | "prof_idle" | "jay_idle" | "maya_idle" | "maya_wait"
           | "ellio_idle" | "lia_idle" | "jess_idle"
           // Prof Irwyn Realm Shell resupply (repeatable, after Route 2 / Wyvrunt quest)
           | "prof_shells" | "prof_shells_got"
           // Rowan — the professor's disciple who dreams of the Professor's seat
           | "rowan_d1" | "rowan_d2" | "rowan_d3"
           // Area 3 — Jay trainer battle (4-tier progressive, repeatable)
           | "jay_a3_d1" | "jay_a3_d2" | "jay_a3_d3" | "jay_a3_battle"
           | "jay_a3_win" | "jay_a3_lose" | "jay_a3_idle"
           // Area 3 — Lia trainer battle (4-tier progressive, repeatable)
           | "lia_a3_d1" | "lia_a3_d2" | "lia_a3_d3" | "lia_a3_battle"
           | "lia_a3_win" | "lia_a3_lose" | "lia_a3_idle"
           // Cleminus "Jerbs" — the demo-ending mystery NPC in Area 3 far west
           | "jerbs_appear" | "jerbs_d1" | "jerbs_d2" | "jerbs_d3"
           | "jerbs_cards" | "jerbs_d4" | "jerbs_remind"
           | "jerbs_return_d1" | "jerbs_return_d2" | "jerbs_a3_idle"
           | "jerbs_battle_intro"
          | "jerbs_crystal_d1" | "jerbs_crystal_d2" | "jerbs_crystal_d3"
          | "jerbs_stone_pick" | "jerbs_crystal_evo" | "jerbs_gift"
          | "demo_end"
          // Primeria Farm NPCs
          | "shella_d1" | "shella_d2" | "shella_d3" | "shella_done" | "shella_idle"
          | "runrik_d1" | "runrik_d2" | "runrik_d3" | "runrik_d4" | "runrik_done" | "runrik_idle"
          | "maren_d1" | "maren_d2" | "maren_done" | "maren_idle"
          // Tidemark Shore — Prof. Irwyn challenger battle
          | "prof_shore_d1" | "prof_shore_d2" | "prof_shore_battle"
          | "prof_shore_win" | "prof_shore_lose" | "prof_shore_idle" | "prof_shore_done"
          // Overworld ambient townspeople (lore flavor, set no quest flags)
          | "tova_d1" | "tova_d2" | "tova_idle"
          | "senna_d1" | "senna_d2" | "senna_idle"
          | "corvin_d1" | "corvin_d2" | "corvin_idle";
type Scene = "overworld" | "lab" | "maya" | "jay" | "home" | "ellio" | "lia" | "route1" | "route2" | "area3" | "battle" | "farm" | "shore" | "town" | "town_left" | "town_right";
type Rect  = [number, number, number, number]; // x1 y1 x2 y2 world-px

// ── Bestiary (Route 1 encounter pool) ───────────────────────────────────────
const BESTIARY: MonSpec[] = [
  // Commons (≈18% each within trail = 55% pool / 3)
  { id:"hatchick",  name:"Hatchick",  type:"Skyborne",     rarity:"common",
    wildImg:"/__mockup/images/hatchick-wild.png",  playerImg:"/__mockup/images/hatchick-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:24, baseDmg:[3,6] },
  { id:"loth",      name:"Loth",      type:"Nature",       rarity:"common",
    wildImg:"/__mockup/images/loth-wild.png",      playerImg:"/__mockup/images/loth-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:28, baseDmg:[3,7] },
  { id:"voltowl",   name:"Voltowl",   type:"Stormproven",  rarity:"common",
    wildImg:"/__mockup/images/voltowl-wild.png",   playerImg:"/__mockup/images/voltowl-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:26, baseDmg:[3,7] },
  // Uncommons
  { id:"stonub",    name:"Stonub",    type:"Volcanic",     rarity:"uncommon",
    wildImg:"/__mockup/images/stonub-wild.png",    playerImg:"/__mockup/images/stonub-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:34, baseDmg:[4,8] },
  { id:"potent",    name:"Potent",    type:"Alchemy",      rarity:"uncommon",
    wildImg:"/__mockup/images/potent-wild.png",    playerImg:"/__mockup/images/potent-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:30, baseDmg:[4,8] },
  { id:"scavencrow",name:"Scavencrow",type:"Abyss",        rarity:"uncommon",
    wildImg:"/__mockup/images/scavencrow-wild.png",playerImg:"/__mockup/images/scavencrow-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:32, baseDmg:[4,9] },
  // Rares
  { id:"ghosti",    name:"Ghosti",    type:"Spirit",       rarity:"rare",
    wildImg:"/__mockup/images/ghosti-wild.png",    playerImg:"/__mockup/images/ghosti-player.png",
    wildFaces:"right", playerFaces:"right", maxHp:42, baseDmg:[5,10] },
  { id:"scalel",    name:"Scalel",    type:"Armored",      rarity:"rare",
    wildImg:"/__mockup/images/scalel-wild.png",    playerImg:"/__mockup/images/scalel-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:48, baseDmg:[5,10] },
  // Ultra
  { id:"mentyke_w", name:"Mentyke",   type:"Mind",         rarity:"ultra",
    wildImg:"/__mockup/images/mentyke-wild-a.png", playerImg:"/__mockup/images/mentyke-wild-b.png",
    wildFaces:"left", playerFaces:"left", maxHp:58, baseDmg:[6,12] },
  // Apex
  { id:"peachi_w",  name:"Pea-chi",   type:"Nature",       rarity:"apex",
    wildImg:"/__mockup/images/leafkit.png",  playerImg:"/__mockup/images/leafkit.png",
    wildFaces:"left", playerFaces:"left", maxHp:80, baseDmg:[8,14] },
  // Starter half — Route 1 (Volcanic/Storm — forest trail feel)
  { id:"cerepup_w", name:"Cerepup",   type:"Volcanic",    rarity:"apex",
    wildImg:"/__mockup/images/emberfox.png",        playerImg:"/__mockup/images/emberfox.png",
    wildFaces:"left", playerFaces:"left", maxHp:82, baseDmg:[10,18] },
  { id:"shockit_wa",name:"Shockit",   type:"Stormproven", rarity:"ultra",
    wildImg:"/__mockup/images/voltfang.png",        playerImg:"/__mockup/images/voltfang.png",
    wildFaces:"left", playerFaces:"left", maxHp:72, baseDmg:[9,16] },
  // ── Route 1 new additions ──────────────────────────────────────────────────
  { id:"fluttril",   name:"Fluttril",   type:"Nature",      rarity:"common",
    wildImg:"/__mockup/images/fluttril-wild.png",    playerImg:"/__mockup/images/fluttril-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:22, baseDmg:[3,6] },
  { id:"pebkin",     name:"Pebkin",     type:"Earthbound",  rarity:"common",
    wildImg:"/__mockup/images/pebkin-wild.png",      playerImg:"/__mockup/images/pebkin-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:25, baseDmg:[3,6] },
  { id:"cindersnap", name:"Cindersnap", type:"Volcanic",    rarity:"uncommon",
    wildImg:"/__mockup/images/cindersnap-wild.png",  playerImg:"/__mockup/images/cindersnap-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:32, baseDmg:[4,8] },
  { id:"shimroot",   name:"Shimroot",   type:"Nature",      rarity:"uncommon",
    wildImg:"/__mockup/images/shimroot-wild.png",    playerImg:"/__mockup/images/shimroot-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:30, baseDmg:[3,7] },
  { id:"galerix",    name:"Galerix",    type:"Stormproven", rarity:"rare",
    wildImg:"/__mockup/images/galerix-wild.png",     playerImg:"/__mockup/images/galerix-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:44, baseDmg:[5,10] },
  { id:"duskpetal",  name:"Duskpetal",  type:"Abyss",       rarity:"rare",
    wildImg:"/__mockup/images/duskpetal-wild.png",   playerImg:"/__mockup/images/duskpetal-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:40, baseDmg:[5,9] },
  { id:"stonebrute", name:"Stonebrute", type:"Earthbound",  rarity:"ultra",
    wildImg:"/__mockup/images/stonebrute-wild.png",  playerImg:"/__mockup/images/stonebrute-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:58, baseDmg:[7,12] },
  { id:"emberveil",  name:"Emberveil",  type:"Volcanic",    rarity:"ultra",
    wildImg:"/__mockup/images/emberveil-wild.png",   playerImg:"/__mockup/images/emberveil-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:62, baseDmg:[7,13] },
  { id:"solarhowl",  name:"Solarhowl",  type:"Stormproven", rarity:"apex",
    wildImg:"/__mockup/images/solarhowl-wild.png",   playerImg:"/__mockup/images/solarhowl-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:80, baseDmg:[9,15] },
  { id:"nightbloom", name:"Nightbloom", type:"Spirit",      rarity:"apex",
    wildImg:"/__mockup/images/nightbloom-wild.png",  playerImg:"/__mockup/images/nightbloom-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:78, baseDmg:[8,14] },
  // ── Route 1 expansion — 2 per rarity ─────────────────────────────────────
  // Commons: Thistlekit (spiky hedgehog plant × axolotl) + Muddling (mudskipper toad)
  { id:"thistlekit",  name:"Thistlekit",  type:"Nature",      rarity:"common",
    wildImg:"/__mockup/images/blomath-wild.png",     playerImg:"/__mockup/images/blomath-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:22, baseDmg:[3,6] as [number,number] },
  { id:"muddling",    name:"Muddling",    type:"Oceanic",     rarity:"common",
    wildImg:"/__mockup/images/driftpaw-wild.png",    playerImg:"/__mockup/images/driftpaw-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:25, baseDmg:[3,6] as [number,number] },
  // Uncommons: Sparksnip (electric pincer beetle) + Mirewarden (swamp armored turtle)
  { id:"sparksnip",   name:"Sparksnip",   type:"Stormproven", rarity:"uncommon",
    wildImg:"/__mockup/images/strikorn-wild.png",    playerImg:"/__mockup/images/strikorn-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:32, baseDmg:[4,8] as [number,number] },
  { id:"mirewarden",  name:"Mirewarden",  type:"Armored",     rarity:"uncommon",
    wildImg:"/__mockup/images/cragmite-wild.png",    playerImg:"/__mockup/images/cragmite-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:36, baseDmg:[4,8] as [number,number] },
  // Rares: Ashpyre (lava-lizard, Gila monster × salamander) + Icevein (frost crystal serpent)
  { id:"ashpyre",     name:"Ashpyre",     type:"Volcanic",    rarity:"rare",
    wildImg:"/__mockup/images/emberclaw-wild.png",   playerImg:"/__mockup/images/emberclaw-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:44, baseDmg:[5,10] as [number,number] },
  { id:"icevein",     name:"Icevein",     type:"Frostformed", rarity:"rare",
    wildImg:"/__mockup/images/crysthorn-wild.png",   playerImg:"/__mockup/images/crysthorn-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:42, baseDmg:[5,10] as [number,number] },
  // Ultra: Galeking (storm hawk overlord) + Mindwraith (drifting psychic phantom)
  { id:"galeking",    name:"Galeking",    type:"Skyborne",    rarity:"ultra",
    wildImg:"/__mockup/images/skyvast-wild.png",     playerImg:"/__mockup/images/skyvast-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:60, baseDmg:[7,13] as [number,number] },
  { id:"mindwraith",  name:"Mindwraith",  type:"Mind",        rarity:"ultra",
    wildImg:"/__mockup/images/spectrael-wild.png",   playerImg:"/__mockup/images/spectrael-wild.png",
    wildFaces:"right", playerFaces:"right", maxHp:58, baseDmg:[7,13] as [number,number] },
  // Apex: Verdking (ancient leafed nature titan) + Thunderdread (legendary storm owl-wyvern)
  { id:"verdking",    name:"Verdking",    type:"Nature",      rarity:"apex",
    wildImg:"/__mockup/images/zephyriel-wild.png",   playerImg:"/__mockup/images/zephyriel-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:82, baseDmg:[9,16] as [number,number] },
  { id:"thunderdread",name:"Thunderdread",type:"Stormproven", rarity:"apex",
    wildImg:"/__mockup/images/thunderowl-wild.png",  playerImg:"/__mockup/images/thunderowl-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:80, baseDmg:[9,16] as [number,number] },
];

// ── Wyvrunt — unique scripted-encounter mon (Chaos type, loyal-only) ────────
// Not in BESTIARY (never a random encounter). Triggered solely from the
// Route 2 Prof Irwyn scene. The golden yin-yang glyph marks loyalty + chaos.
// Stats: +5 baseDmg ceiling over apex starters, hp tuned for the scripted
// 3-turn guaranteed-catch fight (player can't lose if they don't try to lose).
const WYVRUNT_SPEC: MonSpec = {
  id: "wyvrunt",
  name: "Wyvrunt",
  nameIcon: "☯",
  type: "Chaos",
  rarity: "apex",
  wildImg:   "/__mockup/images/wyvrunt.png",
  playerImg: "/__mockup/images/wyvrunt.png",
  wildFaces: "left", playerFaces: "left",
  maxHp: 60,
  baseDmg: [9, 15], // +5 over other starter-tier ceilings; scripted fight ignores it anyway
};

// ── Wyvrunt evolution chain forms (loyalty + level gated) ───────────────────
// Forms 0-2 cap at lv30 (when wyvruntCaught). Form 3 (Aureyvant) has no cap.
const WYRNAK_SPEC:    MonSpec = { ...WYVRUNT_SPEC, id:"wyrnak",    name:"Wyburn",      nameIcon:"☯", wildImg:"/__mockup/images/wyrnak.png",    playerImg:"/__mockup/images/wyrnak.png",    maxHp:80,  baseDmg:[11,18] };
const WYRVAST_SPEC:   MonSpec = { ...WYVRUNT_SPEC, id:"wyrvast",   name:"Wyvlord",     nameIcon:"☯", wildImg:"/__mockup/images/wyrvast.png",   playerImg:"/__mockup/images/wyrvast.png",   maxHp:100, baseDmg:[13,22] };
const AUREYVANT_SPEC: MonSpec = { ...WYVRUNT_SPEC, id:"aureyvant", name:"DiviniDrake", nameIcon:"✦", wildImg:"/__mockup/images/aureyvant.png", playerImg:"/__mockup/images/aureyvant.png", maxHp:120, baseDmg:[16,26] };
const WYV_FORMS: MonSpec[] = [WYVRUNT_SPEC, WYRNAK_SPEC, WYRVAST_SPEC, AUREYVANT_SPEC];

// ── Area 3 trainer battle MonSpecs ───────────────────────────────────────────
// Jay's team — Spirit anchor + escalating support; evo forms unlock at tier 2+
const TR_FOXIN:      MonSpec = { id:"tr_foxin",     name:"Foxin",     type:"Spirit",     rarity:"uncommon", wildImg:"/__mockup/images/vixgrim.png",           playerImg:"/__mockup/images/vixgrim.png",           wildFaces:"left", playerFaces:"left", maxHp:58,  baseDmg:[6,12] };
const TR_FOXIN_EVO:  MonSpec = { id:"tr_foxin_evo", name:"Vixgrim",   type:"Spirit",     rarity:"rare",     wildImg:"/__mockup/images/vixgrim.png",           playerImg:"/__mockup/images/vixgrim.png",           wildFaces:"left", playerFaces:"left", maxHp:76,  baseDmg:[9,16] };
const TR_STONUB:     MonSpec = { id:"tr_stonub",    name:"Stonub",    type:"Volcanic",   rarity:"uncommon", wildImg:"/__mockup/images/stonub-wild.png",        playerImg:"/__mockup/images/stonub-player.png",     wildFaces:"left", playerFaces:"left", maxHp:66,  baseDmg:[7,13] };
const TR_STONUB_EVO: MonSpec = { id:"tr_stonub_evo",name:"Stonbrute", type:"Earthbound", rarity:"rare",     wildImg:"/__mockup/images/stonebrute-wild.png",   playerImg:"/__mockup/images/stonebrute-wild.png",   wildFaces:"left", playerFaces:"left", maxHp:86,  baseDmg:[8,14] };
const TR_SAVEN:      MonSpec = { id:"tr_saven",     name:"Scavencrow",type:"Abyss",      rarity:"uncommon", wildImg:"/__mockup/images/scavencrow-wild.png",   playerImg:"/__mockup/images/scavencrow-player.png", wildFaces:"left", playerFaces:"left", maxHp:62,  baseDmg:[7,14] };
const TR_MENTY:      MonSpec = { id:"tr_menty",     name:"Mentyke",   type:"Mind",       rarity:"ultra",    wildImg:"/__mockup/images/mentyke-wild-a.png",    playerImg:"/__mockup/images/mentyke-wild-b.png",    wildFaces:"left", playerFaces:"left", maxHp:80,  baseDmg:[8,16] };
// Lia's team — Oceanic anchor + escalating support; evo forms unlock at tier 2+
const TR_CUNB:       MonSpec = { id:"tr_cunb",      name:"Cub-bubble", type:"Oceanic",    rarity:"uncommon", wildImg:"/__mockup/images/phantorch.png",          playerImg:"/__mockup/images/phantorch.png",         wildFaces:"left", playerFaces:"left", maxHp:58,  baseDmg:[6,12] };
const TR_DRIFT:      MonSpec = { id:"tr_drift",     name:"Driftpaw",  type:"Skyborne",   rarity:"uncommon", wildImg:"/__mockup/images/driftpaw-wild.png",      playerImg:"/__mockup/images/driftpaw-player.png",   wildFaces:"left", playerFaces:"left", maxHp:56,  baseDmg:[6,11] };
const TR_DRIFT_EVO:  MonSpec = { id:"tr_drift_evo", name:"Galerix",   type:"Skyborne",   rarity:"ultra",    wildImg:"/__mockup/images/galerix-wild.png",      playerImg:"/__mockup/images/galerix-wild.png",      wildFaces:"left", playerFaces:"left", maxHp:80,  baseDmg:[9,15] };
const TR_SPRIG:      MonSpec = { id:"tr_sprig",     name:"Sprigget",  type:"Nature",     rarity:"common",   wildImg:"", playerImg:"", wildSheet:{ url:"/__mockup/images/a3-wild-sheet.png", x:0, y:0, w:512, h:384, sheetW:1024, sheetH:1536 }, playerSheet:{ url:"/__mockup/images/a3-wild-sheet.png", x:0, y:0, w:512, h:384, sheetW:1024, sheetH:1536 }, wildFaces:"left", playerFaces:"left", maxHp:52, baseDmg:[5,10] };
const TR_EMBVEIL:    MonSpec = { id:"tr_embveil",   name:"Emberveil", type:"Volcanic",   rarity:"ultra",    wildImg:"/__mockup/images/emberveil-wild.png",    playerImg:"/__mockup/images/emberveil-wild.png",    wildFaces:"left", playerFaces:"left", maxHp:84,  baseDmg:[9,16] };
const TR_MURK:       MonSpec = { id:"tr_murk",      name:"Murkspine", type:"Abyss",      rarity:"rare",     wildImg:"", playerImg:"", wildSheet:{ url:"/__mockup/images/a3-new-sheet.png", x:512, y:0, w:512, h:512, sheetW:1536, sheetH:1024 }, playerSheet:{ url:"/__mockup/images/a3-new-sheet.png", x:512, y:0, w:512, h:512, sheetW:1536, sheetH:1024 }, wildFaces:"left", playerFaces:"left", maxHp:78, baseDmg:[8,15] };
// Shared ace
const TR_CINDRAX:    MonSpec = { id:"tr_cindrax",   name:"Cindrax",   type:"Chaos",      rarity:"apex",     wildImg:"/__mockup/images/cindrax.png",            playerImg:"/__mockup/images/cindrax.png",           wildFaces:"left", playerFaces:"left", maxHp:92,  baseDmg:[12,19] };

// crystalfang.png — 1536×1024 sprite sheet, 2 cols × 1 row, each frame 768×1024
const _CRYF = "/__mockup/images/crystalfang.png";
const cryF  = (c:number): SpriteSheet =>
  ({ url:_CRYF, x:c*768, y:0, w:768, h:1024, sheetW:1536, sheetH:1024 });
const TR_CRYSTALFANG: MonSpec = { id:"tr_crystalfang", name:"Crystalfang", type:"Frostformed", rarity:"apex", wildImg:"/__mockup/images/crystalfang.png", playerImg:"/__mockup/images/crystalfang.png", wildSheet:cryF(0), playerSheet:cryF(0), wildFaces:"right", playerFaces:"right", maxHp:78, baseDmg:[9,16] };
const CRYSTALFANG_STARTER: StarterSpec = { id:"crystalfang", name:"Crystalfang", type:"Frostformed", color:"#7de8ff", img:"/__mockup/images/crystalfang.png", sheet:cryF(0) };
const GLACIA_SPEC:  StarterSpec = { id:"glacia",  name:"Glacia",  type:"Frostformed", color:"#7de8ff", img:"/__mockup/images/glacia.png" };
const VOLCIA_SPEC:  StarterSpec = { id:"volcia",  name:"Volcia",  type:"Volcanic",    color:"#ff5520", img:"/__mockup/images/volcia.png" };
const FAELIA_SPEC:  StarterSpec = { id:"faelia",  name:"Faelia",  type:"Spirit",      color:"#c070ff", img:"/__mockup/images/faelia.png" };
const GLACIA_MON_SPEC: MonSpec = { id:"glacia", name:"Glacia", type:"Frostformed", rarity:"apex", wildImg:"/__mockup/images/glacia.png",  playerImg:"/__mockup/images/glacia.png",  wildFaces:"right", playerFaces:"right", maxHp:95, baseDmg:[12,20] };
const VOLCIA_MON_SPEC: MonSpec = { id:"volcia", name:"Volcia", type:"Volcanic",    rarity:"apex", wildImg:"/__mockup/images/volcia.png",  playerImg:"/__mockup/images/volcia.png",  wildFaces:"right", playerFaces:"right", maxHp:90, baseDmg:[14,22] };
const FAELIA_MON_SPEC: MonSpec = { id:"faelia", name:"Faelia", type:"Spirit",      rarity:"apex", wildImg:"/__mockup/images/faelia.png",  playerImg:"/__mockup/images/faelia.png",  wildFaces:"right", playerFaces:"right", maxHp:88, baseDmg:[11,21] };

// Team builder: enemy levels track player level so battles always feel relevant
type TrainerTier = { team: MonSpec[]; levels: number[] };
function jayA3Team(wins: number, playerLevel: number): TrainerTier {
  const lv = (off: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, playerLevel + off));
  if (wins === 0) return { team:[TR_FOXIN],                                               levels:[lv(2,8,17)] };
  if (wins === 1) return { team:[TR_FOXIN, TR_STONUB],                                    levels:[lv(3,12,20), lv(3,12,21)] };
  if (wins === 2) return { team:[TR_FOXIN_EVO, TR_STONUB, TR_SAVEN],                      levels:[lv(4,16,23), lv(3,15,22), lv(3,15,22)] };
  return             { team:[TR_FOXIN_EVO, TR_STONUB_EVO, TR_SAVEN, TR_PROF_SANCTYKE],   levels:[lv(5,20,25), lv(4,19,25), lv(4,18,24), lv(6,22,27)] };
}
function liaA3Team(wins: number, playerLevel: number): TrainerTier {
  const lv = (off: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, playerLevel + off));
  if (wins === 0) return { team:[TR_CUNB],                                                 levels:[lv(2,9,18)] };
  if (wins === 1) return { team:[TR_CUNB, TR_DRIFT],                                       levels:[lv(3,13,21), lv(3,12,20)] };
  if (wins === 2) return { team:[TR_CUNB, TR_DRIFT_EVO, TR_SPRIG],                         levels:[lv(4,17,23), lv(4,18,24), lv(3,15,22)] };
  return             { team:[TR_CUNB, TR_DRIFT_EVO, TR_EMBVEIL, TR_CINDRAX],               levels:[lv(4,20,25), lv(5,21,25), lv(4,19,25), lv(7,25,28)] };
}

// ── Prof. Irwyn — shore challenger (scales with wins + player level) ──────────
// wins 0–1 → mid-evo team;  wins 2+ → final-evo team (hardest in the game)
const TR_PROF_WYRNAK:   MonSpec = { id:"tr_wyrnak",   name:"Wyrnak",   type:"Spirit"     as const, rarity:"rare"  as const, wildImg:"/__mockup/images/wyrnak.png",        playerImg:"/__mockup/images/wyrnak.png",        wildFaces:"right" as const, playerFaces:"right" as const, maxHp:68, baseDmg:[8,12]  as [number,number] };
const TR_PROF_CARAGNAR: MonSpec = { id:"tr_caragnar", name:"Caragnar", type:"Volcanic"   as const, rarity:"rare"  as const, wildImg:"/__mockup/images/cerepup_evo1.png",  playerImg:"/__mockup/images/cerepup_evo1.png",  wildFaces:"left"  as const, playerFaces:"left"  as const, maxHp:72, baseDmg:[7,11]  as [number,number] };
const TR_PROF_SANCTYKE: MonSpec = { id:"tr_sanctyke", name:"Sanctyke", type:"Mind"       as const, rarity:"rare"  as const, wildImg:"/__mockup/images/mentyke_evo1.png",  playerImg:"/__mockup/images/mentyke_evo1.png",  wildFaces:"left"  as const, playerFaces:"left"  as const, maxHp:65, baseDmg:[8,13]  as [number,number] };
const TR_PROF_GRAVLOCK: MonSpec = { id:"tr_gravlock", name:"Gravlock", type:"Earthbound" as const, rarity:"ultra" as const, wildImg:"/__mockup/images/stonebrute-wild.png",playerImg:"/__mockup/images/stonebrute-wild.png",wildFaces:"left" as const, playerFaces:"left"  as const, maxHp:84, baseDmg:[6,10]  as [number,number] };
const TR_PROF_WYRVAST:  MonSpec = { id:"tr_wyrvast",  name:"Wyvlord",  type:"Chaos"      as const, rarity:"ultra" as const, wildImg:"/__mockup/images/wyrvast.png",        playerImg:"/__mockup/images/wyrvast.png",        wildFaces:"right" as const, playerFaces:"right" as const, maxHp:95, baseDmg:[13,20] as [number,number] };
const TR_PROF_BIFERNON: MonSpec = { id:"tr_bifernon", name:"Bifernon", type:"Volcanic"   as const, rarity:"ultra" as const, wildImg:"/__mockup/images/cerepup_evo2.png",  playerImg:"/__mockup/images/cerepup_evo2.png",  wildFaces:"left"  as const, playerFaces:"left"  as const, maxHp:98, baseDmg:[12,19] as [number,number] };
const TR_PROF_LUMAYKE:  MonSpec = { id:"tr_lumayke",  name:"Lumayke",  type:"Mind"       as const, rarity:"ultra" as const, wildImg:"/__mockup/images/mentyke_evo2.png",  playerImg:"/__mockup/images/mentyke_evo2.png",  wildFaces:"left"  as const, playerFaces:"left"  as const, maxHp:88, baseDmg:[12,18] as [number,number] };
function profShoreTeam(wins: number, playerLevel: number): TrainerTier {
  const lv = (off: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, playerLevel + off));
  if (wins <= 1) return {
    team:   [TR_PROF_WYRNAK, TR_PROF_CARAGNAR, TR_PROF_SANCTYKE, TR_PROF_GRAVLOCK],
    levels: [lv(5,22,27), lv(5,22,27), lv(5,22,27), lv(6,23,28)],
  };
  return {
    team:   [TR_PROF_WYRVAST, TR_PROF_BIFERNON, TR_PROF_LUMAYKE, TR_PROF_GRAVLOCK],
    levels: [lv(7,26,30), lv(7,26,30), lv(6,25,30), lv(8,27,30)],
  };
}

// NPC positions inside Area 3 (world-px coordinates)
const JAY_A3_POS = { x: 332, y: 498 };
const LIA_A3_POS = { x: 652, y: 480 };

// ── Area 3 sprite-sheet frame helpers ────────────────────────────────────────
// Sheets (all background-removed PNGs in /images/):
//  a3-wild-sheet.png  — 1024×1536  4 rows × 2 cols  frame 512×384
//  a3-new-sheet.png   — 1536×1024  2 rows × 3 cols  frame 512×512
//  a3-mid-sheet-m.png — 1122×1402  4 rows × 1 col   frame 1122×350
//  a3-apex-sheet.png  — 1536×1024  2 rows × 2 cols  frame 768×512
const _A3W = "/__mockup/images/a3-wild-sheet.png";
const _A3N = "/__mockup/images/a3-new-sheet.png";
const _A3M = "/__mockup/images/a3-mid-sheet-m.png";
const _A3A = "/__mockup/images/a3-apex-sheet.png";
const wldF = (c:number,r:number): SpriteSheet =>
  ({ url:_A3W, x:c*512, y:r*384, w:512,  h:384, sheetW:1024, sheetH:1536 });
const nwF  = (c:number,r:number): SpriteSheet =>
  ({ url:_A3N, x:c*512, y:r*512, w:512,  h:512, sheetW:1536, sheetH:1024 });
const mmF  = (r:number): SpriteSheet =>
  ({ url:_A3M, x:0,     y:r*350, w:1122, h:350, sheetW:1122, sheetH:1402 });
const apF  = (c:number,r:number): SpriteSheet =>
  ({ url:_A3A, x:c*768, y:r*512, w:768,  h:512, sheetW:1536, sheetH:1024 });
// Tight-crop helpers — pass absolute sheet pixel coordinates measured to the
// actual content bounding box, not the full grid cell. Eliminates empty headroom
// that caused the arena background to bleed above/below sprites.
const A3WS = (x:number,y:number,w:number,h:number): SpriteSheet =>
  ({ url:_A3W, x, y, w, h, sheetW:1024, sheetH:1536 });
const A3NS = (x:number,y:number,w:number,h:number): SpriteSheet =>
  ({ url:_A3N, x, y, w, h, sheetW:1536, sheetH:1024 });
const A3MS = (x:number,y:number,w:number,h:number): SpriteSheet =>
  ({ url:_A3M, x, y, w, h, sheetW:1122, sheetH:1402 });
const A3AS = (x:number,y:number,w:number,h:number): SpriteSheet =>
  ({ url:_A3A, x, y, w, h, sheetW:1536, sheetH:1024 });

// ── Bestiary — Area 3 (Westwood Reaches) ─────────────────────────────────────
const BESTIARY_A3: MonSpec[] = [
  // ── COMMON ─────────────────────────────────────────────────────────────────
  { id:"sprigget",    name:"Sprigget",   type:"Nature",     rarity:"common",
    wildImg:"", playerImg:"", wildSheet:A3WS(0,172,512,200), playerSheet:A3WS(0,172,512,200),
    wildFaces:"left", playerFaces:"left", maxHp:32, baseDmg:[4,8] },
  { id:"ashcrawl",    name:"Ashcrawl",   type:"Volcanic",   rarity:"common",
    wildImg:"", playerImg:"", wildSheet:A3WS(512,164,512,208), playerSheet:A3WS(512,164,512,208),
    wildFaces:"left", playerFaces:"left", maxHp:35, baseDmg:[5,9] },
  { id:"finwing",     name:"Finwing",    type:"Oceanic",    rarity:"common",
    wildImg:"/__mockup/images/finwing-wild.png", playerImg:"/__mockup/images/finwing-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:30, baseDmg:[4,8] },
  { id:"stoneback",   name:"Stoneback",  type:"Earthbound", rarity:"common",
    wildImg:"", playerImg:"", wildSheet:A3WS(512,612,512,143), playerSheet:A3WS(512,612,512,143),
    wildFaces:"left", playerFaces:"left", maxHp:40, baseDmg:[4,7] },
  // ── UNCOMMON ───────────────────────────────────────────────────────────────
  { id:"driftpaw_f",  name:"Driftpaw",   type:"Skyborne",   rarity:"uncommon",
    wildImg:"/__mockup/images/driftpaw-wild.png", playerImg:"/__mockup/images/driftpaw-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:38, baseDmg:[5,10] },
  { id:"driftpaw_m",  name:"Driftpaw",   type:"Skyborne",   rarity:"uncommon",
    wildImg:"/__mockup/images/driftpaw-wild.png", playerImg:"/__mockup/images/driftpaw-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:38, baseDmg:[5,10] },
  { id:"stoneback_m", name:"Stoneback",  type:"Earthbound", rarity:"uncommon",
    wildImg:"", playerImg:"", wildSheet:A3WS(512,612,512,143), playerSheet:A3WS(512,612,512,143),
    wildFaces:"left", playerFaces:"left", maxHp:44, baseDmg:[4,8] },
  { id:"gloomcap",    name:"Gloomcap",   type:"Abyss",      rarity:"uncommon",
    wildImg:"/__mockup/images/gloomcap-wild.png", playerImg:"/__mockup/images/gloomcap-player.png",
    wildFaces:"left", playerFaces:"left", maxHp:36, baseDmg:[5,11] },
  // ── RARE (A3-exclusive deep-wood spirits) ───────────────────────────────────
  { id:"silkfae_m",   name:"Silkfae",    type:"Spirit",     rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(0,141,512,355), playerSheet:A3NS(0,141,512,355),
    wildFaces:"left", playerFaces:"left", maxHp:50, baseDmg:[6,12] },
  { id:"silkfae_f",   name:"Silkfae",    type:"Spirit",     rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(0,652,512,357), playerSheet:A3NS(0,652,512,357),
    wildFaces:"left", playerFaces:"left", maxHp:50, baseDmg:[6,12] },
  { id:"murkspine_m", name:"Murkspine",  type:"Abyss",      rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(512,160,512,337), playerSheet:A3NS(512,160,512,337),
    wildFaces:"left", playerFaces:"left", maxHp:54, baseDmg:[7,13] },
  { id:"murkspine_f", name:"Murkspine",  type:"Abyss",      rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(512,684,512,325), playerSheet:A3NS(512,684,512,325),
    wildFaces:"left", playerFaces:"left", maxHp:54, baseDmg:[7,13] },
  { id:"fernclaw_m",  name:"Fernclaw",   type:"Earthbound", rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(1024,169,512,328), playerSheet:A3NS(1024,169,512,328),
    wildFaces:"left", playerFaces:"left", maxHp:58, baseDmg:[7,14] },
  { id:"fernclaw_f",  name:"Fernclaw",   type:"Earthbound", rarity:"rare",
    wildImg:"", playerImg:"", wildSheet:A3NS(1024,689,512,320), playerSheet:A3NS(1024,689,512,320),
    wildFaces:"left", playerFaces:"left", maxHp:58, baseDmg:[7,14] },
  // ── ULTRA (mid-evolved forms) ───────────────────────────────────────────────
  { id:"verdwulf",    name:"Verdwulf",   type:"Nature",     rarity:"ultra",
    wildImg:"", playerImg:"", wildSheet:A3MS(0,46,1122,294), playerSheet:A3MS(0,46,1122,294),
    wildFaces:"left", playerFaces:"left", maxHp:70, baseDmg:[9,15] },
  { id:"scorchrex",   name:"Scorchrex",  type:"Volcanic",   rarity:"ultra",
    wildImg:"", playerImg:"", wildSheet:mmF(1), playerSheet:mmF(1),
    wildFaces:"left", playerFaces:"left", maxHp:75, baseDmg:[10,17] },
  { id:"tidalfang",   name:"Tidalfang",  type:"Oceanic",    rarity:"ultra",
    wildImg:"", playerImg:"", wildSheet:mmF(2), playerSheet:mmF(2),
    wildFaces:"left", playerFaces:"left", maxHp:68, baseDmg:[9,15] },
  { id:"aetherwing",  name:"Aetherwing", type:"Skyborne",   rarity:"ultra",
    wildImg:"", playerImg:"", wildSheet:A3MS(0,1114,1122,276), playerSheet:A3MS(0,1114,1122,276),
    wildFaces:"left", playerFaces:"left", maxHp:65, baseDmg:[9,14] },
  // ── APEX (unique A3 + starter second-half split) ────────────────────────────
  { id:"verdanthos",  name:"Verdanthos", type:"Nature",     rarity:"apex",
    wildImg:"", playerImg:"", wildSheet:apF(0,0), playerSheet:apF(0,0),
    wildFaces:"left", playerFaces:"left", maxHp:100, baseDmg:[12,20] },
  { id:"voidtide",    name:"Voidtide",   type:"Abyss",      rarity:"apex",
    wildImg:"", playerImg:"", wildSheet:A3AS(768,140,768,357), playerSheet:A3AS(768,140,768,357),
    wildFaces:"right", playerFaces:"right", maxHp:95, baseDmg:[11,19] },
  // ── Area 3 new additions ──────────────────────────────────────────────────
  { id:"puffwing",    name:"Puffwing",    type:"Skyborne",   rarity:"common",
    wildImg:"/__mockup/images/puffwing-wild.png",    playerImg:"/__mockup/images/puffwing-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:28, baseDmg:[3,7] },
  { id:"embergnat",   name:"Embergnat",   type:"Volcanic",   rarity:"common",
    wildImg:"/__mockup/images/embergnat-wild.png",   playerImg:"/__mockup/images/embergnat-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:30, baseDmg:[3,8] },
  { id:"thornwraith", name:"Thornwraith", type:"Abyss",      rarity:"uncommon",
    wildImg:"/__mockup/images/thornwraith-wild.png", playerImg:"/__mockup/images/thornwraith-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:36, baseDmg:[4,9] },
  { id:"starspore",   name:"Starspore",   type:"Spirit",     rarity:"uncommon",
    wildImg:"/__mockup/images/starspore-wild.png",   playerImg:"/__mockup/images/starspore-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:34, baseDmg:[4,8] },
  { id:"crystalback", name:"Crystalback", type:"Armored",    rarity:"rare",
    wildImg:"/__mockup/images/crystalback-wild.png", playerImg:"/__mockup/images/crystalback-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:52, baseDmg:[6,11] },
  { id:"nebulite",    name:"Nebulite",    type:"Spirit",     rarity:"rare",
    wildImg:"/__mockup/images/nebulite-wild.png",    playerImg:"/__mockup/images/nebulite-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:48, baseDmg:[6,12] },
  { id:"voidwraith",  name:"Voidwraith",  type:"Abyss",      rarity:"ultra",
    wildImg:"/__mockup/images/voidwraith-wild.png",  playerImg:"/__mockup/images/voidwraith-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:68, baseDmg:[8,14] },
  { id:"ashflare",    name:"Ashflare",    type:"Volcanic",   rarity:"ultra",
    wildImg:"/__mockup/images/ashflare-wild.png",    playerImg:"/__mockup/images/ashflare-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:66, baseDmg:[8,14] },
  { id:"abyssmonk",   name:"Abyssmonk",   type:"Abyss",      rarity:"apex",
    wildImg:"/__mockup/images/abyssmonk-wild.png",   playerImg:"/__mockup/images/abyssmonk-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:96, baseDmg:[11,18] },
  { id:"celestine",   name:"Celestine",   type:"Spirit",     rarity:"apex",
    wildImg:"/__mockup/images/celestine-wild.png",   playerImg:"/__mockup/images/celestine-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:92, baseDmg:[10,17] },
  // Starter half — Area 3 (Oceanic/Earthbound/Frostformed/Spirit — ruins vibes)
  { id:"cunbubble_wa",name:"Cun-bubble", type:"Oceanic",    rarity:"apex",
    wildImg:"/__mockup/images/phantorch.png",       playerImg:"/__mockup/images/phantorch.png",
    wildFaces:"left", playerFaces:"left", maxHp:88, baseDmg:[10,18] },
  { id:"pebble_wa",   name:"Pebble",     type:"Earthbound", rarity:"apex",
    wildImg:"/__mockup/images/grrountain-baby.png", playerImg:"/__mockup/images/grrountain-baby.png",
    wildFaces:"left", playerFaces:"left", maxHp:92, baseDmg:[10,16] },
  { id:"burg_wa",     name:"Burg",       type:"Frostformed",rarity:"ultra",
    wildImg:"/__mockup/images/frostbite-baby.png",  playerImg:"/__mockup/images/frostbite-baby.png",
    wildFaces:"left", playerFaces:"left", maxHp:78, baseDmg:[9,17] },
  { id:"foxin_wa",    name:"Foxin",      type:"Spirit",     rarity:"apex",
    wildImg:"/__mockup/images/vixgrim.png",         playerImg:"/__mockup/images/vixgrim.png",
    wildFaces:"left", playerFaces:"left", maxHp:88, baseDmg:[10,18] },
  // ── Area 3 expansion — 2 per rarity ───────────────────────────────────────
  // Commons: Glimwing (shimmering sky-ray, manta × glowworm) + Emberpup (lava pup, fire salamander)
  { id:"glimwing",    name:"Glimwing",    type:"Skyborne",    rarity:"common",
    wildImg:"/__mockup/images/swiftwing-wild.png",   playerImg:"/__mockup/images/swiftwing-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:22, baseDmg:[3,6] as [number,number] },
  { id:"emberpup",    name:"Emberpup",    type:"Volcanic",    rarity:"common",
    wildImg:"/__mockup/images/emberveil-wild.png",   playerImg:"/__mockup/images/emberveil-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:26, baseDmg:[3,7] as [number,number] },
  // Uncommons: Stormhound (electric wolf, Tasmanian wolf × storm petrel) + Stonewatch (boulder guardian, rhino beetle × tortoise)
  { id:"stormhound",  name:"Stormhound",  type:"Stormproven", rarity:"uncommon",
    wildImg:"/__mockup/images/thunderax-wild.png",   playerImg:"/__mockup/images/thunderax-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:36, baseDmg:[4,9] as [number,number] },
  { id:"stonewatch",  name:"Stonewatch",  type:"Earthbound",  rarity:"uncommon",
    wildImg:"/__mockup/images/stonebrute-wild.png",  playerImg:"/__mockup/images/stonebrute-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:40, baseDmg:[4,8] as [number,number] },
  // Rares: Acidmoth (alchemical moth, luna moth × poison dart frog) + Skybane (sky predator, harpy eagle × barracuda)
  { id:"acidmoth",    name:"Acidmoth",    type:"Alchemy",     rarity:"rare",
    wildImg:"/__mockup/images/alchemor-wild.png",    playerImg:"/__mockup/images/alchemor-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:46, baseDmg:[5,10] as [number,number] },
  { id:"skybane",     name:"Skybane",     type:"Skyborne",    rarity:"rare",
    wildImg:"/__mockup/images/skyvast-wild.png",     playerImg:"/__mockup/images/skyvast-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:48, baseDmg:[5,11] as [number,number] },
  // Ultra: Verdthorn (thorn titan, ancient oak × stegosaurus) + Crystalvast (crystal armored giant, horseshoe crab × pangolin)
  { id:"verdthorn",   name:"Verdthorn",   type:"Nature",      rarity:"ultra",
    wildImg:"/__mockup/images/thornlord-wild.png",   playerImg:"/__mockup/images/thornlord-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:65, baseDmg:[7,13] as [number,number] },
  { id:"crystalvast", name:"Crystalvast", type:"Armored",     rarity:"ultra",
    wildImg:"/__mockup/images/cragvast-wild.png",    playerImg:"/__mockup/images/cragvast-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:68, baseDmg:[7,12] as [number,number] },
  // Apex: Sunvast (radiant sky titan, sun deity × leviathan) + Tidegiant (oceanic colossus)
  { id:"sunvast",     name:"Sunvast",     type:"Radiant",     rarity:"apex",
    wildImg:"/__mockup/images/sylphara-wild.png",    playerImg:"/__mockup/images/sylphara-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:94, baseDmg:[10,18] as [number,number] },
  { id:"tidegiant",   name:"Tidegiant",   type:"Oceanic",     rarity:"apex",
    wildImg:"/__mockup/images/thalassyn-player.png", playerImg:"/__mockup/images/thalassyn-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:98, baseDmg:[11,19] as [number,number] },
];

// ── Route 2 Bestiary (Farmland Fields + Northern Wilderness) ─────────────────
// Unlocked after catching the Wyvrunt (wyvruntCaught flag). Higher base stats
// than Route 1. Apex tier = near-legendary mons: electric, dragon, fae, nature, oceanic.
const BESTIARY_R2: MonSpec[] = [
  // Commons
  { id:"mossback",    name:"Mossback",    type:"Nature",      rarity:"common",
    wildImg:"/__mockup/images/mossback-wild.png",    playerImg:"/__mockup/images/mossback-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:26, baseDmg:[3,7] },
  { id:"sparwing",    name:"Sparwing",    type:"Skyborne",    rarity:"common",
    wildImg:"/__mockup/images/sparwing-wild.png",    playerImg:"/__mockup/images/sparwing-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:24, baseDmg:[3,6] },
  { id:"thornpup",    name:"Thornpup",    type:"Earthbound",  rarity:"common",
    wildImg:"/__mockup/images/thornpup-wild.png",    playerImg:"/__mockup/images/thornpup-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:28, baseDmg:[3,7] },
  // Uncommons
  { id:"frogling",    name:"Frogling",    type:"Frostformed", rarity:"uncommon",
    wildImg:"/__mockup/images/frogling-wild.png",    playerImg:"/__mockup/images/frogling-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:34, baseDmg:[4,8] },
  { id:"duskrat",     name:"Duskrat",     type:"Abyss",       rarity:"uncommon",
    wildImg:"/__mockup/images/duskrat-wild.png",     playerImg:"/__mockup/images/duskrat-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:32, baseDmg:[4,9] },
  { id:"marshclaw",   name:"Marshclaw",   type:"Oceanic",     rarity:"uncommon",
    wildImg:"/__mockup/images/marshclaw-wild.png",   playerImg:"/__mockup/images/marshclaw-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:36, baseDmg:[4,9] },
  // Rares
  { id:"emberwyvlet", name:"Emberwyvlet", type:"Chaos",       rarity:"rare",
    wildImg:"/__mockup/images/emberwyvlet-wild.png", playerImg:"/__mockup/images/emberwyvlet-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:48, baseDmg:[5,11] },
  { id:"crysthorn",   name:"Crysthorn",   type:"Frostformed", rarity:"rare",
    wildImg:"/__mockup/images/crysthorn-wild.png",   playerImg:"/__mockup/images/crysthorn-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:44, baseDmg:[5,10] },
  // Ultra
  { id:"galvern",     name:"Galvern",     type:"Stormproven", rarity:"ultra",
    wildImg:"/__mockup/images/galvern-wild.png",     playerImg:"/__mockup/images/galvern-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:62, baseDmg:[7,13] },
  // Apex / Near-Legendary (electric, dragon, fae, nature, oceanic)
  { id:"thunderax",   name:"Thunderax",   type:"Stormproven", rarity:"apex",
    wildImg:"/__mockup/images/thunderax-wild.png",   playerImg:"/__mockup/images/thunderax-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:80, baseDmg:[9,15] },
  { id:"dracoveil",   name:"Dracoveil",   type:"Chaos",       rarity:"apex",
    wildImg:"/__mockup/images/dracoveil-wild.png",   playerImg:"/__mockup/images/dracoveil-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:85, baseDmg:[10,16] },
  { id:"sylphara",    name:"Sylphara",    type:"Spirit",      rarity:"apex",
    wildImg:"/__mockup/images/sylphara-wild.png",    playerImg:"/__mockup/images/sylphara-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:75, baseDmg:[8,14] },
  { id:"verdanox",    name:"Verdanox",    type:"Nature",       rarity:"apex",
    wildImg:"/__mockup/images/verdanox-wild.png",    playerImg:"/__mockup/images/verdanox-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:88, baseDmg:[9,15] },
  { id:"thalassyn",   name:"Thalassyn",   type:"Oceanic",     rarity:"apex",
    wildImg:"/__mockup/images/thalassyn-wild.png",   playerImg:"/__mockup/images/thalassyn-player.png",
    wildFaces:"left", playerFaces:"right", maxHp:82, baseDmg:[9,16] },
  // ── Route 2 new additions ──────────────────────────────────────────────────
  { id:"frostpup",   name:"Frostpup",   type:"Frostformed", rarity:"common",
    wildImg:"/__mockup/images/frostpup-wild.png",    playerImg:"/__mockup/images/frostpup-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:23, baseDmg:[3,6] },
  { id:"mudtot",     name:"Mudtot",     type:"Oceanic",     rarity:"common",
    wildImg:"/__mockup/images/mudtot-wild.png",      playerImg:"/__mockup/images/mudtot-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:26, baseDmg:[3,7] },
  { id:"cragnite",   name:"Cragnite",   type:"Armored",     rarity:"uncommon",
    wildImg:"/__mockup/images/cragnite-wild.png",    playerImg:"/__mockup/images/cragnite-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:34, baseDmg:[4,8] },
  { id:"bleater",    name:"Bleater",    type:"Nature",       rarity:"uncommon",
    wildImg:"/__mockup/images/bleater-wild.png",     playerImg:"/__mockup/images/bleater-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:30, baseDmg:[3,7] },
  { id:"thornalisk", name:"Thornalisk", type:"Earthbound",  rarity:"rare",
    wildImg:"/__mockup/images/thornalisk-wild.png",  playerImg:"/__mockup/images/thornalisk-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:46, baseDmg:[5,10] },
  { id:"lumifang",   name:"Lumifang",   type:"Stormproven", rarity:"rare",
    wildImg:"/__mockup/images/lumifang-wild.png",    playerImg:"/__mockup/images/lumifang-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:44, baseDmg:[5,11] },
  { id:"mireking",   name:"Mireking",   type:"Oceanic",     rarity:"ultra",
    wildImg:"/__mockup/images/mireking-wild.png",    playerImg:"/__mockup/images/mireking-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:60, baseDmg:[7,13] },
  { id:"blizzfang",  name:"Blizzfang",  type:"Frostformed", rarity:"ultra",
    wildImg:"/__mockup/images/blizzfang-wild.png",   playerImg:"/__mockup/images/blizzfang-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:64, baseDmg:[7,14] },
  { id:"galestrike", name:"Galestrike", type:"Stormproven", rarity:"apex",
    wildImg:"/__mockup/images/galestrike-wild.png",  playerImg:"/__mockup/images/galestrike-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:82, baseDmg:[10,16] },
  { id:"thornlord",  name:"Thornlord",  type:"Earthbound",  rarity:"apex",
    wildImg:"/__mockup/images/thornlord-wild.png",   playerImg:"/__mockup/images/thornlord-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:85, baseDmg:[10,16] },
  // ── Route 2 expansion — 2 per rarity ─────────────────────────────────────
  // Commons: Leafscale (leaf-gecko, green iguana × leaf-tailed gecko) + Icewren (frost sparrow, snowy owl chick × kingfisher)
  { id:"leafscale",   name:"Leafscale",   type:"Nature",      rarity:"common",
    wildImg:"/__mockup/images/fernback-wild.png",    playerImg:"/__mockup/images/fernback-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:26, baseDmg:[3,6] as [number,number] },
  { id:"icewren",     name:"Icewren",     type:"Frostformed", rarity:"common",
    wildImg:"/__mockup/images/frosthound-wild.png",  playerImg:"/__mockup/images/frosthound-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:24, baseDmg:[3,6] as [number,number] },
  // Uncommons: Abysskit (shadow ferret, black marten × civet) + Tideswimmer (coastal river swimmer, eel × mudpuppy)
  { id:"abysskit",    name:"Abysskit",    type:"Abyss",       rarity:"uncommon",
    wildImg:"/__mockup/images/duskfang-wild.png",    playerImg:"/__mockup/images/duskfang-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:33, baseDmg:[4,8] as [number,number] },
  { id:"tideswimmer", name:"Tideswimmer", type:"Oceanic",     rarity:"uncommon",
    wildImg:"/__mockup/images/tidalclaw-wild.png",   playerImg:"/__mockup/images/tidalclaw-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:35, baseDmg:[4,9] as [number,number] },
  // Rares: Chaosspark (chaotic young wyrm, chameleon × sea serpent) + Stonemace (spike-tail earth lizard, ankylosaur × armadillo)
  { id:"chaosspark",  name:"Chaosspark",  type:"Chaos",       rarity:"rare",
    wildImg:"/__mockup/images/wyrmblaze-wild.png",   playerImg:"/__mockup/images/wyrmblaze-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:47, baseDmg:[5,11] as [number,number] },
  { id:"stonemace",   name:"Stonemace",   type:"Earthbound",  rarity:"rare",
    wildImg:"/__mockup/images/thornhound-wild.png",  playerImg:"/__mockup/images/thornhound-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:44, baseDmg:[5,10] as [number,number] },
  // Ultra: Voidcrest (void apex beast, deep-sea anglerfish × wraith) + Icewall (glacial fortress, polar bear × tortoise)
  { id:"voidcrest",   name:"Voidcrest",   type:"Abyss",       rarity:"ultra",
    wildImg:"/__mockup/images/voidrat-wild.png",     playerImg:"/__mockup/images/voidrat-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:62, baseDmg:[7,13] as [number,number] },
  { id:"icewall",     name:"Icewall",     type:"Frostformed", rarity:"ultra",
    wildImg:"/__mockup/images/glaciend-wild.png",    playerImg:"/__mockup/images/glaciend-wild.png",
    wildFaces:"left", playerFaces:"left", maxHp:65, baseDmg:[7,12] as [number,number] },
  // Apex: Glacia (frost celestial, born of the deep glacier) + Volcia (volcanic titan, born of the caldera)
  { id:"glacia_w",    name:"Glacia",      type:"Frostformed", rarity:"apex",
    wildImg:"/__mockup/images/glacia.png",           playerImg:"/__mockup/images/glacia.png",
    wildFaces:"right", playerFaces:"right", maxHp:92, baseDmg:[10,18] as [number,number] },
  { id:"volcia_w",    name:"Volcia",      type:"Volcanic",    rarity:"apex",
    wildImg:"/__mockup/images/volcia.png",           playerImg:"/__mockup/images/volcia.png",
    wildFaces:"right", playerFaces:"right", maxHp:90, baseDmg:[11,19] as [number,number] },
];

// ── Bestiary — Tidemark Shore (coastal cliff wild pool) ──────────────────────
const BESTIARY_SHORE: MonSpec[] = [
  // ── COMMON — three mystical hatchlings of the clifftop shore ────────────────
  // Tidescale — iridescent sea-snake hatchling (moray eel × sea dragon); Oceanic
  { id:"tidescale",   name:"Tidescale",   type:"Oceanic",     rarity:"common",
    wildImg:"/__mockup/images/tidalclaw-wild.png",    playerImg:"/__mockup/images/tidalclaw-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:28, baseDmg:[3,6] as [number,number] },
  // Lumecolt — glowing foal with a nub light-horn; holy newborn of coastal mist; Radiant
  { id:"lumecolt",    name:"Lumecolt",    type:"Radiant",     rarity:"common",
    wildImg:"/__mockup/images/spectrael-wild.png",    playerImg:"/__mockup/images/spectrael-wild.png",
    wildFaces:"right", playerFaces:"right", maxHp:26, baseDmg:[3,7] as [number,number] },
  // Gryfling — fluffy baby griffon (eagle beak + lion cub body); Nature
  { id:"gryfling",    name:"Gryfling",    type:"Nature",      rarity:"common",
    wildImg:"/__mockup/images/verdanox-wild.png",     playerImg:"/__mockup/images/verdanox-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:30, baseDmg:[3,6] as [number,number] },
  // ── UNCOMMON — juvenile brutes and shadow creatures ──────────────────────────
  // Cindrakin — juvenile coastal lava-drake (Komodo dragon × molten ridge lizard); Volcanic
  { id:"cindrakin",   name:"Cindrakin",   type:"Volcanic",    rarity:"uncommon",
    wildImg:"/__mockup/images/emberwyvlet-wild.png",  playerImg:"/__mockup/images/emberwyvlet-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:36, baseDmg:[4,9] as [number,number] },
  // Shaderow — shadow raven cloaked in void-mist (raven × wraith); Abyss
  { id:"shaderow",    name:"Shaderow",    type:"Abyss",       rarity:"uncommon",
    wildImg:"/__mockup/images/dreadcrow-wild.png",    playerImg:"/__mockup/images/dreadcrow-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:34, baseDmg:[4,9] as [number,number] },
  // Shellcrag — armored hermit-crab with crystalline shell (crab × boulder turtle); Armored
  { id:"shellcrag",   name:"Shellcrag",   type:"Armored",     rarity:"uncommon",
    wildImg:"/__mockup/images/crystalback-wild.png",  playerImg:"/__mockup/images/crystalback-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:40, baseDmg:[4,8] as [number,number] },
  // ── RARE — great shapes glimpsed at dusk on the clifftop ────────────────────
  // Chaoryn — young chaos dragon; iridescent shifting scales (peacock × sea dragon); Chaos
  { id:"chaoryn",     name:"Chaoryn",     type:"Chaos",       rarity:"rare",
    wildImg:"/__mockup/images/dracoveil-wild.png",    playerImg:"/__mockup/images/dracoveil-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:50, baseDmg:[5,11] as [number,number] },
  // Galefledge — storm eagle fledgling; crackling wing-feathers (thunderbird myth); Stormproven
  { id:"galefledge",  name:"Galefledge",  type:"Stormproven", rarity:"rare",
    wildImg:"/__mockup/images/strikorn-wild.png",     playerImg:"/__mockup/images/strikorn-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:46, baseDmg:[5,10] as [number,number] },
  // Misthorn — misty unicorn-deer with icy crystalline horn; coastal fog spirit; Frostformed
  { id:"misthorn",    name:"Misthorn",    type:"Frostformed", rarity:"rare",
    wildImg:"/__mockup/images/crysthorn-wild.png",    playerImg:"/__mockup/images/crysthorn-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:48, baseDmg:[5,10] as [number,number] },
  // ── ULTRA — mid-evolved legends seen at the cliff edge ──────────────────────
  // Coralcoil — mid-form sea serpent; vast iridescent coils; reef guardian; Oceanic
  { id:"coralcoil",   name:"Coralcoil",   type:"Oceanic",     rarity:"ultra",
    wildImg:"/__mockup/images/torrential-wild.png",   playerImg:"/__mockup/images/torrential-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:68, baseDmg:[8,14] as [number,number] },
  // Solhoof — mid-form radiant unicorn; golden mane streaming with holy light; Radiant
  { id:"solhoof",     name:"Solhoof",     type:"Radiant",     rarity:"ultra",
    wildImg:"/__mockup/images/solarhowl-wild.png",    playerImg:"/__mockup/images/solarhowl-wild.png",
    wildFaces:"left", playerFaces:"left",  maxHp:65, baseDmg:[8,14] as [number,number] },
  // ── APEX — the ancients that rule Tidemark Shore ─────────────────────────────
  // Auremane — Celestial Unicorn-Dragon; holy light made flesh; balanced across all forces; Radiant
  { id:"auremane",    name:"Auremane",    type:"Radiant",     rarity:"apex",
    wildImg:"/__mockup/images/sylphara-wild.png",     playerImg:"/__mockup/images/sylphara-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:100, baseDmg:[11,18] as [number,number] },
  // Celestgriff — legendary Griffon King; eldest of the coastal cliffs; Nature
  { id:"celestgriff", name:"Celestgriff", type:"Nature",      rarity:"apex",
    wildImg:"/__mockup/images/verdanox-player.png",   playerImg:"/__mockup/images/verdanox-player.png",
    wildFaces:"left", playerFaces:"left",  maxHp:96, baseDmg:[10,17] as [number,number] },
];

// ── Route 2 (east of Maya's home) ───────────────────────────────────────────
// route2-map.png native 1024w × 1536h — vertical scrolling route, enter west.
const R2 = { w: 1024, h: 1536 };
const R2_SPAWN     = { x: 290, y: 1180 };   // red cross — west-side path entry
const PROF_R2_POS  = { x: 470, y: 1040 };   // yellow X — prof at signpost
const WYV_R2_POS   = { x: 620, y: 780 };    // wyvrunt appears north of prof
// Old Hollis — farmer painted into route2-map.png; tends the farm up north,
// watches the Tayanari play, and first found the rare Wyvrunt. Made interactive.
const FARMER_R2_POS = { x: 665, y: 740 };
const FARMER_R2_BOX: Rect = [651, 689, 680, 752]; // solid collider (user-tapped corners)
const FARMER_SOLIDS: Rect[] = [FARMER_R2_BOX];

// ── Primeria Farm (north of Route 2) ─────────────────────────────────────────
const FARM = { w: 1376, h: 768 };                    // matches farm-bg.png native aspect (no crop)
const FARM_SPAWN    = { x: 679, y: 713 };           // entering from Route 2 (south)
const R2_FARM_EXIT: Rect  = [520, 0, 780, 40];       // Route 2 north cliff stairs → farm
const FARM_RETURN_R2: Rect = [933, 664, 993, 694];   // south-east farm path → Route 2 (player pos 963,679)
const FARM_TOWN_EXIT: Rect   = [540,  0, 836, 30];  // farm north road → Town Hub

// ── Town Hub & Wings ─────────────────────────────────────────────────────────
const TOWN   = { w: 1536, h: 864 };
const TOWN_L = { w: 1536, h: 864 };
const TOWN_R = { w: 1536, h: 864 };
const TOWN_FARM_SPAWN  = { x: 768, y: 810 };   // enter town from farm (south path)
const TOWN_FROM_LEFT   = { x: 80,  y: 432 };   // enter town center from left wing
const TOWN_FROM_RIGHT  = { x: 1456, y: 432 };  // enter town center from right wing
const TOWN_SOUTH_EXIT: Rect = [640, 840, 896, 864];  // town center south → farm
const TOWN_WEST_EXIT: Rect  = [0,   280, 30,  580];  // town center west  → left wing
const TOWN_EAST_EXIT: Rect  = [1506, 280, 1536, 580]; // town center east → right wing
const TL_EAST_EXIT: Rect    = [1506, 280, 1536, 580]; // left wing east  → town center
const TL_SPAWN = { x: 1456, y: 432 };   // spawn in left wing (arriving from east)
const TR_WEST_EXIT: Rect    = [0,   280, 30,  580];  // right wing west → town center
const TR_SPAWN = { x: 80, y: 432 };     // spawn in right wing (arriving from west)
const FARM_FROM_TOWN_SPAWN = { x: 679, y: 50 };  // spawn near top of farm from town
// NPC world positions (farm scene)
const SHELLA_POS = { x: 536, y: 487 };   // shell vendor — left side near house
const RUNRIK_POS = { x: 761, y: 420 };   // rune vendor — centre-right
const MAREN_POS  = { x: 889, y: 525 };   // berry elder — right side
// Farm animal decorations (src, world x/y, display size)
const FARM_ANIMALS: { src: string; x: number; y: number; w: number; h: number }[] = [
  { src: "/__mockup/images/chicken1.png", x: 435, y: 608, w: 50, h: 50 },
  { src: "/__mockup/images/chicken2.png", x: 540, y: 630, w: 50, h: 50 },
  { src: "/__mockup/images/chicken3.png", x: 454, y: 570, w: 50, h: 50 },
  { src: "/__mockup/images/goat1.png",    x: 851, y: 593, w: 68, h: 68 },
  { src: "/__mockup/images/goat2.png",    x: 949, y: 578, w: 68, h: 68 },
];
// Townspeople pre-cropped sprites (cut from farm-townspeople.png 1264×843 4×2 grid, 316×421 cells, bg removed)
const SHELLA_IMG = "/__mockup/images/shella-npc.png";
const RUNRIK_IMG = "/__mockup/images/runrik-npc.png";
const MAREN_IMG  = "/__mockup/images/maren-npc.png";
const NO_SOLIDS: Rect[] = [];

// ── Tidemark Shore (south of Route 2 — cliff-edge ocean) ─────────────────────
const SHORE = { w: 1024, h: 717 };
const SHORE_SPAWN        = { x: 513, y: 75 };    // entering from Route 2 — spawns near north entry
let   SHORE_NORTH_EXIT: Rect = [315, 0, 688, 19]; // north edge → back to Route 2
const PROF_SHORE_POS     = { x: 511, y: 289 };   // professor on the clifftop
const SHORE_COIN_GIFT    = 500;                    // PrimeriaCoin per payment
const SHORE_HOTSPOTS: Hotspot[] = [
  { x: 184, y: 149, r: 51, kind: "rock" }, { x: 389, y: 187, r: 51, kind: "bush" },
  { x: 632, y: 168, r: 51, kind: "rock" }, { x: 819, y: 233, r: 51, kind: "bush" },
  { x: 147, y: 364, r: 51, kind: "rock" }, { x: 688, y: 392, r: 51, kind: "bush" },
];

// Return-to-overworld trigger (west edge — aligned with the carved gap in the left forest mass)
let R2_RETURN_OW: Rect    = ld("r2_return", [79, 1028, 169, 1148]); // TEMP door back to town (user-tapped 80,1121) — re-place after map swap
// Locked future-content beats — show a "blocked"/"locked" toast
// R2_NORTH_BLOCKED removed — area converted to farm entrance (R2_FARM_EXIT)
let R2_SOUTH_BLOCKED: Rect = [100, 1490, 924, 1510]; // south → Tidemark Shore entrance
let R2_LOCKED_DOOR: Rect   = ld("r2_locked", [820, 760, 900, 830]); // locked house door
let R2_BLOCKED: Rect[] = [
  // outer borders
  [0,    0, 1024,  60],
  [0, 1500, 1024,1536],
  [0,    0,   30, 1100],
  [0, 1300,   30,1536],
  [990,  0, 1024,1536],
  // forest / rock / cliff masses (estimated from route2-map.png)
  [0,    60,  220, 600],
  [220,  60,  520, 300],
  [520,  60,  860, 360],
  [860, 220,  990, 700],
  [0,   800,  200,1120],  // left forest — upper
  [0,  1240,  200,1500],  // left forest — lower (gap y=1120–1240 is the west return path to overworld)
  [600, 900,  990,1500],
  // locked house body
  [780, 720,  920, 860],
];

// East overworld exit → Route 2 (opens only after wife intercept)
let OW_EAST_EXIT: Rect = ld("ow_east", [1092, 433, 1136, 523]); // moved to user-tapped spot (1091,482); player x clamps to 1094 so the east edge always lands inside the trigger
// Wife intercepts on the open central plaza (reachable open ground, not inside any building body)
const JESS_PATH_POS = { x: 430, y: 500 };

const RARITY_BASE: Record<MonRarity, number> = {
  common: 53, uncommon: 30, rare: 11, ultra: 5, apex: 1,
};

// Wild encounter levels by zone — deeper areas spawn stronger mons
const SCENE_WILD_LEVELS: Partial<Record<string, Record<MonRarity, number>>> = {
  route1: { common:4,  uncommon:6,  rare:9,  ultra:12, apex:15 },
  route2: { common:8,  uncommon:10, rare:13, ultra:16, apex:19 },
  area3:  { common:13, uncommon:16, rare:19, ultra:22, apex:25 },
  shore:  { common:18, uncommon:20, rare:22, ultra:25, apex:28 },
};
function wildLevelForScene(rarity: MonRarity, sc: string): number {
  return SCENE_WILD_LEVELS[sc]?.[rarity] ?? wildLevelFor(rarity);
}

function rollRarity(checksStreak: number): MonRarity {
  // Streak A: +2% Rare/Ultra per 5 checks since last UR/Apex, cap +20
  const streakBonus = Math.min(20, Math.floor(checksStreak / 5) * 2);
  const weights: Record<MonRarity, number> = {
    common:   RARITY_BASE.common   - streakBonus,
    uncommon: RARITY_BASE.uncommon,
    rare:     RARITY_BASE.rare     + streakBonus * 0.5,
    ultra:    RARITY_BASE.ultra    + streakBonus * 0.4,
    apex:     RARITY_BASE.apex     + streakBonus * 0.1,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const k of Object.keys(weights) as MonRarity[]) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return "common";
}

function pickMonForScene(rarity: MonRarity, sc: string): MonSpec {
  const list = sc === "area3" ? BESTIARY_A3 : sc === "route2" ? BESTIARY_R2 : sc === "shore" ? BESTIARY_SHORE : BESTIARY;
  const pool = list.filter(m => m.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)] ?? list[0];
}

// ── Route 1 disturbance hotspots (clickable bushes/rocks/trees in world-space)
type Hotspot = { x: number; y: number; r: number; kind: "bush" | "rock" | "tree" };
// Visual scale for encounter circles (does not affect any gameplay logic — r is render-only).
const HOTSPOT_VIS = 0.6;
const R1_HOTSPOTS: Hotspot[] = [
  { x: 204, y: 575, r: 35, kind: "bush" },
  { x: 334, y: 482, r: 33, kind: "rock" },
  { x: 501, y: 427, r: 39, kind: "tree" },
  { x: 668, y: 501, r: 35, kind: "bush" },
  { x: 798, y: 594, r: 35, kind: "rock" },
  { x: 260, y: 352, r: 35, kind: "tree" },
  { x: 575, y: 260, r: 37, kind: "bush" },
  { x: 742, y: 352, r: 35, kind: "bush" },
];

// ── Area 3 disturbance hotspots (ancient ruin courtyard + forest clearing) ───
const A3_HOTSPOTS: Hotspot[] = [
  { x: 501, y: 329, r: 36, kind: "rock" },   // center courtyard — rune stone
  { x: 395, y: 373, r: 32, kind: "rock" },   // left courtyard near arch
  { x: 608, y: 311, r: 32, kind: "rock" },   // right courtyard
  { x: 439, y: 267, r: 32, kind: "bush" },   // near north arch entrance
  { x: 306, y: 489, r: 34, kind: "bush" },   // lower-left clearing
  { x: 546, y: 511, r: 36, kind: "bush" },   // lower center clearing
  { x: 697, y: 484, r: 34, kind: "bush" },   // lower-right clearing
  { x: 368, y: 413, r: 32, kind: "rock" },   // left ruin wall base
];

// ── Route 2 encounter hotspots (farm fields + trail edges, vertical map) ─────
const R2_HOTSPOTS: Hotspot[] = [
  { x: 340, y: 400, r: 38, kind: "bush" },   // northern trail edge
  { x: 510, y: 475, r: 36, kind: "rock" },   // upper central area
  { x: 370, y: 590, r: 40, kind: "tree" },   // mid-trail tree line
  { x: 545, y: 680, r: 38, kind: "bush" },   // farmland south edge
  { x: 420, y: 880, r: 36, kind: "bush" },   // south farm field
  { x: 295, y: 1055, r: 38, kind: "rock" },  // south forest edge
  { x: 445, y: 1195, r: 38, kind: "bush" },  // trail near return exit
];

const FLAVOR_TRACKS = [
  "Soft prints curl into the leaves — Tayanari passed here, but not now.",
  "A scuffed patch of moss. Something small was sleeping under it.",
  "The branches still tremble. Whatever it was, it's long gone.",
  "You catch the scent of feathers and damp soil. Empty for now.",
  "Pawprints disappear into the brush. The trail goes cold.",
];

// ── Collision zones ─────────────────────────────────────────────────────────
let OW_BLOCKED: Rect[] = [
  // ── OUTER BORDERS ──────────────────────────────────────────────────────────
  [0,    0,   155,  430],  // left forest — north  (gap y=430-475 → Area 3 corridor at Jay's SW corner)
  [0,  475,   155,  900],  // left forest — south
  [155,  0,   214,   85],  // NW top strip (left of Route-1)
  [327,  0,  1124,   85],  // top border (right of Route-1 gap)
  [978,  85, 1124,  600],  // right forest — upper
  [978, 690, 1124,  900],  // right forest — lower (gap y=600–690 is the east path to Route 2)
  [0,   865, 1124,  900],  // southern boundary

  // ── NORTH ZONE FILLS (close corridors between top border and buildings) ─────
  [155,  85,  160,  225],  // sliver: left forest → Jay west fence
  // [335,  85,  367,  312]  REMOVED — opens north corridor to Route-1 between Jay east and Lab west
  [732,  85,  775,  312],  // gap between Lab east wall and Maya west fence
  [775,  85,  978,  225],  // strip: Maya east fence → right forest

  // ── PROFESSOR LAB compound (south gate x 498–580) ──────────────────────────
  [367,  85,  732,  310],  // building body
  // west compound wall [335, 85, 367, 390] removed — Route 1 corridor passes here
  [732,  85,  755,  390],  // east compound wall
  [367, 310,  498,  390],  // south fence — left of gate (was x=335; trimmed to 367)
  [580, 310,  755,  390],  // south fence — right of gate

  // ── JAY'S HOME — fence perimeter + body (south gate x 240–308) ─────────────
  [214, 225,  327,  400],  // building body
  [160, 225,  214,  430],  // west fence — solid north-to-building-bottom (gap y=430-470 → Area 3 corridor)
  [327, 225,  335,  482],  // east fence (shrunk x=327–335 — opens Route-1 corridor east of Jay)
  [160, 470,  240,  482],  // south fence — left of gate
  [308, 470,  335,  482],  // south fence — right of gate (shrunk to match east fence)

  // ── MAYA'S HOME — fence perimeter + body (south gate x 845–912) ────────────
  [807, 225,  928,  383],  // building body
  [775, 225,  807,  452],  // west fence
  [965, 225,  970,  452],  // east fence — shrunk (visible door extends east; was [928,225,970,452])
  [775, 440,  895,  452],  // south fence — left of gate (gate widened east to align with visible door)
  [960, 440,  970,  452],  // south fence — right of gate (gate widened east)

  // ── PLAYER HOME — fence perimeter + body (north gate x 532–602) ────────────
  [367, 590,  757,  820],  // building body — pushed south to leave a real yard
  [359, 537,  532,  547],  // north fence — left of gate  (was x1=340; trimmed for PH↔Elio south corridor)
  [602, 537,  750,  547],  // north fence — right of gate (x2 trimmed from 765→750 to widen PH↔Lia gap to 50px)
  // PH west fence REMOVED — Elio↔PH corridor now spans body-to-body (x=327–367, ~40 wide)
  // PH east fence REMOVED — PH↔Lia corridor now spans body-to-body (x=757–807, ~50 wide)

  // ── ELLIO'S HOME — fence perimeter + body (north gate x 238–308) ───────────
  [214, 565,  327,  700],  // building body — shrunk south to visible house bottom (front yard now walkable)
  [188, 537,  238,  547],  // north fence — left of gate  (was x1=155; trimmed for west-side corridor x=155–188)
  [308, 537,  335,  547],  // north fence — right of gate (was x2=365; trimmed for Elio↔PH south corridor)
  [188, 537,  214,  790],  // west fence (narrowed for west-side corridor x=155–188)
  // Elio east fence REMOVED — Elio↔PH corridor widened to body-to-body

  // ── LIA'S HOME — fence perimeter + body (north gate x 846–910) ─────────────
  [807, 565,  942,  780],  // building body
  [800, 537,  846,  547],  // north fence — left of gate  (x1 pushed from 789→800 to widen PH↔Lia gap to 50px)
  [910, 537,  950,  547],  // north fence — right of gate (was x2=978; trimmed for east-side corridor x=950–978)
  // Lia west fence REMOVED — PH↔Lia corridor widened to body-to-body
  [942, 537,  950,  790],  // east fence (narrowed for east-side corridor x=950–978)
];

// ── Lia's Home ─────────────────────────────────────────────────────────────
const LH = { w: 800, h: 800 };
const LIA_POS = { x: 385, y: 355 }; // Lia near the center rug
let OW_LIA_DOOR: Rect  = ld("ow_lia", [919, 714, 979, 744]); // moved to user-tapped spot (945,738)
let LIA_HOME_EXIT: Rect = ld("lia_exit", [310, 722, 490, 790]); // bottom-center door
let LH_BLOCKED: Rect[] = [
  // ── WALLS ──────────────────────────────────────────────────────────────────
  [0,    0,   800,  80],  // top wall
  [0,    0,    65, 800],  // left wall
  [735,  0,   800, 800],  // right wall
  [0,   715,  310, 800],  // bottom-left (door gap 310–490)
  [490, 715,  800, 800],  // bottom-right
  // ── FURNITURE — top-left (fireplace + kitchen shelves + pots) ────────────
  [65,   80,  310, 315],  // fireplace surround + wall shelves + hanging pans
  // ── FURNITURE — top-center (window alcove + back-door frame) ─────────────
  [305,  80,  480, 180],  // window recess + curtains + back-door surround
  // ── FURNITURE — top-right (bed + nightstand + foot chest) ────────────────
  [480,  80,  735, 315],  // bed + nightstand + foot chest + wall décor
  // ── FURNITURE — mid-left (bookshelf unit + barrels + jars) ──────────────
  [65,  310,  245, 515],  // bookshelf stack + barrels + books
  // ── FURNITURE — mid-right (potion station + hanging herbs) ───────────────
  [530, 310,  735, 575],  // potion shelves + hanging herbs + lantern
  // ── FURNITURE — bottom-left (study desk + blue crystal lamp) ─────────────
  [65,  510,  270, 690],  // study desk + open book + blue crystal + lanterns
  // ── FURNITURE — bottom-right (corner storage + pots) ─────────────────────
  [590, 570,  735, 715],  // corner storage + pots + maps
  [65,  685,  200, 715],  // bottom-left floor plants + items
];

// Route-1 exit trigger aligned with the top-left gap
let OW_ROUTE1_EXIT: Rect = ld("ow_route1", [247, 10, 362, 25]);
let OW_PROF_DOOR: Rect = ld("ow_lab", [585, 289, 667, 346]); // nudged 8 west of the lab door art

// ── Whisperroot Trail (Route 1 / Area 1) ─────────────────────────────────────
// South gate (blue) connects back to town; north continues deeper (future)
let R1_SOUTH_GATE: Rect = ld("r1_south", [412, 683, 564, 722]); // bottom-center exit → overworld (y1 within reachable band; movement clamps y to h-30=693)
let R1_BLOCKED: Rect[] = [
  // ── OUTER FOREST BORDER ──────────────────────────────────────────────────
  [0,    0,  1024,   50],  // top forest strip
  [0,    0,    52,  780],  // left forest strip
  [972,  0,  1024,  780],  // right forest strip
  [0,   750,  418,  780],  // bottom — left of south gate
  [582, 750,  1024, 780],  // bottom — right of south gate
  // ── POND / STREAM (bridge at x≈140–200 is walkable) ─────────────────────
  [52,  330,  140,  580],  // pond water body
  // ── TOP STONE FENCE / WALL LINE ──────────────────────────────────────────
  [52,   50,  285,  108],  // top-left stone fence
  [285,  50,  362,  118],  // top-center LEFT of stone steps (fills gap to steps)
  [618,  50,  680,  118],  // top-center RIGHT of stone steps (fills gap to right wall)
  [680,  50,  972,  145],  // top-right rock wall + obelisk base
  // ── RIGHT OBELISK PILLARS ─────────────────────────────────────────────────
  [900,  145,  972,  320],  // tall right obelisk (existing)
  [822,  262,  892,  378],  // center-right shorter obelisk (clearly visible in image)
  [888,  430,  972,  530],  // lower-right rock cluster
  // ── CENTRAL STANDING STONE (the prominent rune monument in map center) ────
  [468,  325,  558,  442],  // central monolith + circular stone plinth
];

let LAB_BLOCKED: Rect[] = [
  [0,   0,   700, 22 ],  // top
  [0,   0,   22,  700],  // left wall
  [678, 0,   700, 700],  // right wall
  [0,   638, 262, 700],  // bottom-left
  [438, 638, 700, 700],  // bottom-right
  [0,   0,   700, 240],  // desk / board top area
  [0,   0,   142, 700],  // left cylinders
  [558, 0,   700, 700],  // right cylinders
];
let LAB_EXIT: Rect = ld("lab_exit", [262, 645, 438, 692]); // exit lab

// ── Maya's Home ───────────────────────────────────────────────────────────────
const MY = { w: 800, h: 800 };
const MAYA_POS  = { x: 870, y: 427 }; // Maya standing at her doorstep
const TOVA_POS   = { x: 600, y: 560 }; // ambient townsfolk — center of Primeria village square
const SENNA_POS  = { x: 300, y: 200 }; // ambient townsfolk — near Route 1 north gate
const CORVIN_POS = { x: 790, y: 310 }; // traveling naturalist — northeast near east road
const TOVA_IMG   = "/__mockup/images/tova-npc.png";
const SENNA_IMG  = "/__mockup/images/senna-npc.png";
const CORVIN_IMG = "/__mockup/images/corvin-npc.png";
let OW_MAYA_DOOR: Rect  = ld("ow_maya", [938, 278, 1003, 340]); // nudged +6 east of user-tapped 965,335
let MAYA_HOME_EXIT: Rect = ld("maya_exit", [310, 722, 490, 790]); // exit trigger at interior door
const MAYA_SHELL: Rect     = [385, 400, 455, 460]; // pickup zone — center of the living-room rug
let MAYA_BLOCKED: Rect[] = [
  // ── WALLS ──────────────────────────────────────────────────────────────────
  [0,    0,   800,  90],  // top wall
  [0,    0,    75, 800],  // left wall
  [725,  0,   800, 800],  // right wall
  [0,   715,  310, 800],  // bottom-left (door gap x=310–490)
  [490, 715,  800, 800],  // bottom-right
  // ── FURNITURE — top-left (herb shelves + fireplace) ───────────────────────
  [75,   90,  185, 375],  // herb shelf stack + jars (left column)
  [180,  90,  360, 285],  // stone fireplace + hanging decor above it
  // ── FURNITURE — top-center/right ──────────────────────────────────────────
  [340,  90,  475, 270],  // window dresser + potted plant below sill
  [465,  90,  605, 260],  // bookshelf cluster (top-right of center)
  [595,  90,  725, 390],  // bed + nightstand + foot chest
  // ── FURNITURE — mid-right ─────────────────────────────────────────────────
  [670, 375,  725, 465],  // right-wall lantern side-table + plant
  // ── FURNITURE — bottom-left (craft desk) ──────────────────────────────────
  [75,  460,  265, 610],  // writing desk + stool + books + plants around it
  [75,  600,  190, 715],  // bottom-left corner plants
  // ── FURNITURE — bottom-right (alcove bench) ───────────────────────────────
  [450, 560,  710, 650],  // hanging-rack alcove + bench shelf
  [685, 455,  725, 715],  // right-wall potted plants (mid to bottom)
];

// ── Jay's Home ────────────────────────────────────────────────────────────────
const JY = { w: 800, h: 800 };
const JAY_POS = { x: 370, y: 310 }; // Jay standing in the center of his room
let OW_JAY_DOOR: Rect  = ld("ow_jay", [165, 297, 233, 345]); // user-tapped spot (195,349)
let JAY_HOME_EXIT: Rect = ld("jay_exit", [310, 725, 490, 790]); // interior door at bottom
let JAY_BLOCKED: Rect[] = [
  // ── WALLS ──────────────────────────────────────────────────────────────────
  [0,    0,   800,  80],  // top wall
  [0,    0,    65, 800],  // left wall
  [735,  0,   800, 800],  // right wall
  [0,   715,  310, 800],  // bottom-left (door gap x=310–490)
  [490, 715,  800, 800],  // bottom-right
  // ── FURNITURE — top-left (bookshelf + cabinet) ─────────────────────────────
  [65,   80,  220, 255],  // bookshelf + cabinet cluster
  [65,  255,  120, 325],  // left-wall plant
  [65,  325,  140, 395],  // left-wall lantern table
  // ── FURNITURE — top-center (reading desk + stool) ──────────────────────────
  [225,  80,  405, 240],  // reading desk + lantern + books
  [265, 240,  370, 340],  // stool below desk
  // ── FURNITURE — top-right (bed + rug + chest) ──────────────────────────────
  [455,  80,  735, 390],  // bed + nightstand + foot chest + red rug
  // ── FURNITURE — bottom-left (sofa area) ────────────────────────────────────
  [65,  415,  205, 525],  // sofa
  [110, 480,  245, 580],  // coffee table
  [65,  610,  210, 715],  // bottom-left plants + corner items
  // ── FURNITURE — bottom-right (training / storage) ──────────────────────────
  [455, 390,  735, 715],  // hanging gear + clothing rack + shelves + baskets
];

// ── Area 3 — Westwood Reaches (west of Jay's compound, through the forest) ───
// Enter from the overworld by walking west through the Jay fence + forest gap.
// 1024×768 landscape map, east entry/exit at x≈960.
const A3 = { w: 1024, h: 683 };
const A3_SPAWN      = { x: 875, y: 338 };        // spawn near east entry
let OW_AREA3_EXIT: Rect = ld("ow_area3", [44, 459, 66, 508]); // moved to user-tapped spot (~55,483 center)
let A3_RETURN_OW: Rect = ld("a3_return", [910, 329, 967, 427]); // east-edge door back to town; starts west of the x=994 walk-clamp so it's actually reachable (player tapped ~1001,424)
// Cleminus "Jerbs" — west closed-door, opposite the east town exit.
// Player walks west to the x<215 trigger; Jerbs lands here via portal, west of the barrier.
const JERBS_POS = { x: 190, y: 338 };
// Jerbeen sprite sheet: 1024×1536, 5 cols × 3 rows, each frame ~205×512
const JERBS_SW = 1024; const JERBS_SH = 1536;
const JERBS_FW = Math.floor(JERBS_SW / 5); const JERBS_FH = Math.floor(JERBS_SH / 3);
// Portal sprite sheet: 1536×1024, 5 cols × 2 rows, each frame ~307×512
const PORTAL_SW = 1536; const PORTAL_SH = 1024;
const PORTAL_FW = Math.floor(PORTAL_SW / 5); const PORTAL_FH = Math.floor(PORTAL_SH / 2);
let A3_BLOCKED: Rect[] = [
  // ── OUTER BORDER STRIPS ───────────────────────────────────────────────────
  [0,    0,  1024,   55],  // top tree strip
  [0,    0,    55,  768],  // left edge
  [0,  660,  1024,  768],  // bottom edge
  [960,  0,  1024,  322],  // right — north of east exit gap (y=322-440 open)
  [960, 440,  1024,  768], // right — south of east exit gap

  // ── LEFT TREE MASS (dense ancient forest) ────────────────────────────────
  [55,   55,  195,  768],  // left forest column — full height

  // ── UPPER CANOPY (trees above the ruin walls) ─────────────────────────────
  [195,  55,  830,  175],  // canopy strip between tree masses

  // ── NE / SE TREE CLUSTERS (right side outside exit corridor) ─────────────
  [830,  55,  960,  322],  // NE tree cluster (upper right — matches right wall north block)
  [830, 490,  960,  660],  // SE tree cluster (lower right)

  // ── RUIN WALLS — LEFT SECTION ─────────────────────────────────────────────
  // Wall x=195-345, y=175-510; doorway opening carved at y=340-430
  [195, 175,  345,  340],  // left wall — upper
  [195, 430,  345,  510],  // left wall — lower

  // ── RUIN WALLS — TOP CONNECTING WALL ──────────────────────────────────────
  // Central arch is decorative (trees block passage above); wall is solid.
  [345, 175,  655,  280],  // top connecting wall

  // ── RUIN WALLS — RIGHT SECTION ────────────────────────────────────────────
  // Wall x=655-815, y=175-490; doorway opening carved at y=322-415
  [655, 175,  815,  322],  // right wall — upper
  [655, 415,  815,  490],  // right wall — lower
  // gap y=322-415 is the right doorway (player passes through here from east entry)
];

// ── Area 4 — placeholder (connects south of Westwood Reaches / Area 3) ───────
// ── Ellio's Home ─────────────────────────────────────────────────────────────
const EH = { w: 800, h: 800 };
const ELLIO_POS = { x: 400, y: 350 };
let OW_ELLIO_DOOR: Rect  = ld("ow_ellio", [177, 680, 237, 740]); // moved to the spot the user tapped in the door tool (204,739); requires "up" key (anti walk-by)
let ELLIO_HOME_EXIT: Rect = ld("ellio_exit", [305, 725, 505, 790]);
let EH_BLOCKED: Rect[] = [
  [0, 0, 800, 60], [0, 0, 60, 800], [740, 0, 800, 800],
  [0, 735, 305, 800], [505, 735, 800, 800],
  [0, 0, 800, 185],
  [60, 185, 210, 370], [60, 185, 800, 255],
  [490, 185, 800, 700],
  [60, 415, 205, 525], [110, 480, 245, 580],
  [60, 610, 210, 715],
];

// ── Player's Home ────────────────────────────────────────────────────────────
const PH = { w: 800, h: 800 };
const JESS_POS = { x: 395, y: 370 }; // Jess standing in the open center of the home
let OW_PLAYER_HOME_DOOR: Rect = ld("ow_home", [520, 718, 580, 748]); // nudged +6 east; also requires "up" key to enter (anti walk-by)
let PLAYER_HOME_EXIT: Rect = ld("home_exit", [305, 725, 505, 790]); // bottom-center door

// ── DEV door editor: registry (key → name / scene / live rect get+set) ──────
type DoorEntry = { key: string; name: string; scene: Scene; glowDef: boolean; get: () => Rect; set: (r: Rect) => void };
const DOOR_LIST: DoorEntry[] = [
  { key: "ow_lab",     name: "Lab",        scene: "overworld", glowDef: true,  get: () => OW_PROF_DOOR,        set: (r) => { OW_PROF_DOOR = r; } },
  { key: "ow_home",    name: "Home",       scene: "overworld", glowDef: true,  get: () => OW_PLAYER_HOME_DOOR, set: (r) => { OW_PLAYER_HOME_DOOR = r; } },
  { key: "ow_ellio",   name: "Ellio",      scene: "overworld", glowDef: true,  get: () => OW_ELLIO_DOOR,       set: (r) => { OW_ELLIO_DOOR = r; } },
  { key: "ow_lia",     name: "Lia",        scene: "overworld", glowDef: true,  get: () => OW_LIA_DOOR,         set: (r) => { OW_LIA_DOOR = r; } },
  { key: "ow_jay",     name: "Jay",        scene: "overworld", glowDef: true,  get: () => OW_JAY_DOOR,         set: (r) => { OW_JAY_DOOR = r; } },
  { key: "ow_maya",    name: "Maya",       scene: "overworld", glowDef: true,  get: () => OW_MAYA_DOOR,        set: (r) => { OW_MAYA_DOOR = r; } },
  { key: "ow_route1",  name: "Route1 N",   scene: "overworld", glowDef: true,  get: () => OW_ROUTE1_EXIT,      set: (r) => { OW_ROUTE1_EXIT = r; } },
  { key: "ow_east",    name: "Route2 E",   scene: "overworld", glowDef: true,  get: () => OW_EAST_EXIT,        set: (r) => { OW_EAST_EXIT = r; } },
  { key: "ow_area3",   name: "Area3 W",    scene: "overworld", glowDef: true,  get: () => OW_AREA3_EXIT,       set: (r) => { OW_AREA3_EXIT = r; } },
  { key: "r1_south",   name: "R1 South",   scene: "route1",    glowDef: true,  get: () => R1_SOUTH_GATE,       set: (r) => { R1_SOUTH_GATE = r; } },
  { key: "r2_return",  name: "R2 Return",  scene: "route2",    glowDef: true,  get: () => R2_RETURN_OW,        set: (r) => { R2_RETURN_OW = r; } },
  { key: "r2_shore",   name: "R2→Shore",   scene: "route2",    glowDef: true,  get: () => R2_SOUTH_BLOCKED,    set: (r) => { R2_SOUTH_BLOCKED = r; } },
  { key: "r2_locked",  name: "R2 Locked",  scene: "route2",    glowDef: true,  get: () => R2_LOCKED_DOOR,      set: (r) => { R2_LOCKED_DOOR = r; } },
  { key: "a3_return",  name: "A3 Return",  scene: "area3",     glowDef: true,  get: () => A3_RETURN_OW,        set: (r) => { A3_RETURN_OW = r; } },
  { key: "home_exit",  name: "Home Exit",  scene: "home",      glowDef: true,  get: () => PLAYER_HOME_EXIT,    set: (r) => { PLAYER_HOME_EXIT = r; } },
  { key: "lia_exit",   name: "Lia Exit",   scene: "lia",       glowDef: true,  get: () => LIA_HOME_EXIT,       set: (r) => { LIA_HOME_EXIT = r; } },
  { key: "maya_exit",  name: "Maya Exit",  scene: "maya",      glowDef: true,  get: () => MAYA_HOME_EXIT,      set: (r) => { MAYA_HOME_EXIT = r; } },
  { key: "jay_exit",   name: "Jay Exit",   scene: "jay",       glowDef: true,  get: () => JAY_HOME_EXIT,       set: (r) => { JAY_HOME_EXIT = r; } },
  { key: "ellio_exit", name: "Ellio Exit", scene: "ellio",     glowDef: true,  get: () => ELLIO_HOME_EXIT,     set: (r) => { ELLIO_HOME_EXIT = r; } },
  { key: "lab_exit",   name: "Lab Exit",   scene: "lab",       glowDef: true,  get: () => LAB_EXIT,            set: (r) => { LAB_EXIT = r; } },
];
const doorGlowOn: Record<string, boolean> = {};
DOOR_LIST.forEach((d) => { doorGlowOn[d.key] = ldGlow(d.key, d.glowDef); });
function saveDevDoors() {
  const m: Record<string, Rect> = {};
  DOOR_LIST.forEach((d) => { m[d.key] = d.get(); });
  try { localStorage.setItem(DEV_DOOR_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
function saveDevGlows() {
  try { localStorage.setItem(DEV_GLOW_KEY, JSON.stringify(doorGlowOn)); } catch { /* ignore */ }
}
type GlowBox = { left: number; top: number; w: number; h: number; color: string };
// Per-door glow shapes (anchored to the live rect so they track dragging) — preserve the original hand-tuned look.
const GLOW_SHAPE: Record<string, (r: Rect) => GlowBox> = {
  ow_lab:    (r) => ({ left: r[0] - 9,  top: r[1] + 23, w: 44, h: 10, color: "rgba(255,210,60,0.6)" }),
  r1_south:  (r) => ({ left: r[0] + 42, top: r[1] - 8,  w: 80, h: 14, color: "rgba(100,220,120,0.6)" }),
  r2_locked: (r) => ({ left: (r[0] + r[2]) / 2 - 22, top: r[3] - 8, w: 44, h: 14, color: "rgba(200,150,120,0.45)" }),
  a3_return: (r) => ({ left: r[0] + 2,  top: r[1] + 28, w: 40, h: 64, color: "rgba(255,210,90,0.78)" }),
};
function fallbackCopy(txt: string, done: () => void) {
  try {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) done();
  } catch { /* ignore */ }
}
let PH_BLOCKED: Rect[] = [
  // ── WALLS ──────────────────────────────────────────────────────────────────
  [0,    0,   800,  80],  // top wall
  [0,    0,    75, 800],  // left wall
  [725,  0,   800, 800],  // right wall
  [0,   715,  305, 800],  // bottom-left (door gap 305–505)
  [505, 715,  800, 800],  // bottom-right
  // ── FURNITURE — top-left (kitchen + hearth) ────────────────────────────────
  [75,   80,  340, 200],  // kitchen counter + wall shelves + pots
  [75,  195,  220, 285],  // stone fireplace/hearth base
  // ── FURNITURE — top-center (wardrobe + window) ─────────────────────────────
  [330,  80,  475, 220],  // wardrobe/cabinet + window curtains
  [455, 210,  490, 255],  // bucket near wardrobe
  // ── FURNITURE — top-right (bed area) ───────────────────────────────────────
  [490,  80,  725, 295],  // bed + nightstand + wall hooks
  [490, 290,  665, 390],  // foot chest + green rug below bed
  // ── FURNITURE — center-left (dining table) ─────────────────────────────────
  [85,  255,  335, 425],  // dining table + four chairs + green rug
  // ── FURNITURE — bottom-left (shelf divider + sofa) ─────────────────────────
  [90,  450,  320, 518],  // shelf/bench room divider
  [75,  513,  210, 605],  // sofa
  [80,  605,  190, 715],  // bottom-left plants + corner items
  // ── FURNITURE — bottom-right (workshop) ────────────────────────────────────
  [490, 415,  630, 555],  // workshop wall shelves + potions rack
  [525, 550,  700, 638],  // workshop desk + open book + lantern
  [650, 548,  725, 715],  // barrel + chest + corner plants
];

// ── DEV wall editor: registry (scene → live blocked-array get+set) ──────────
const WALL_SCENES: { scene: Scene; key: string; arr: string; get: () => Rect[]; set: (r: Rect[]) => void }[] = [
  { scene: "overworld", key: "overworld", arr: "OW_BLOCKED",   get: () => OW_BLOCKED,   set: (r) => { OW_BLOCKED = r; } },
  { scene: "route1",    key: "route1",    arr: "R1_BLOCKED",   get: () => R1_BLOCKED,   set: (r) => { R1_BLOCKED = r; } },
  { scene: "route2",    key: "route2",    arr: "R2_BLOCKED",   get: () => R2_BLOCKED,   set: (r) => { R2_BLOCKED = r; } },
  { scene: "area3",     key: "area3",     arr: "A3_BLOCKED",   get: () => A3_BLOCKED,   set: (r) => { A3_BLOCKED = r; } },
  { scene: "lab",       key: "lab",       arr: "LAB_BLOCKED",  get: () => LAB_BLOCKED,  set: (r) => { LAB_BLOCKED = r; } },
  { scene: "jay",       key: "jay",       arr: "JAY_BLOCKED",  get: () => JAY_BLOCKED,  set: (r) => { JAY_BLOCKED = r; } },
  { scene: "maya",      key: "maya",      arr: "MAYA_BLOCKED", get: () => MAYA_BLOCKED, set: (r) => { MAYA_BLOCKED = r; } },
  { scene: "lia",       key: "lia",       arr: "LH_BLOCKED",   get: () => LH_BLOCKED,   set: (r) => { LH_BLOCKED = r; } },
  { scene: "ellio",     key: "ellio",     arr: "EH_BLOCKED",   get: () => EH_BLOCKED,   set: (r) => { EH_BLOCKED = r; } },
  { scene: "home",      key: "home",      arr: "PH_BLOCKED",   get: () => PH_BLOCKED,   set: (r) => { PH_BLOCKED = r; } },
];
// Overlay any DEV wall-editor edits saved in localStorage on top of the baked defaults.
WALL_SCENES.forEach((w) => { w.set(ldWalls(w.key, w.get())); });
function saveDevWalls() {
  const m: Record<string, Rect[]> = {};
  WALL_SCENES.forEach((w) => { m[w.key] = w.get(); });
  try { localStorage.setItem(DEV_WALL_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

// ── Sprite / image utilities ─────────────────────────────────────────────────
const imgCache: Record<string, HTMLImageElement> = {};
function loadImg(src: string) {
  if (!imgCache[src]) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    imgCache[src] = img;
  }
  return imgCache[src];
}

// Build a full 4-direction frame set for a character. Side frames face RIGHT
// natively; the walk loop mirrors them (flipX) when moving left. Each direction
// has a neutral idle plus a 6-frame walk cycle, all sliced from the character's
// sprite sheet and normalised to a shared bottom-anchored canvas.
function dirFrames(c: string, sideN = 6): Record<string, string[]> {
  const p = (n: string) => `/__mockup/images/${c}_${n}.png`;
  const cycle = (dir: string, n = 6) => Array.from({ length: n }, (_, i) => p(`${dir}_${i + 1}`));
  return {
    idle:       [p("front_idle")], // shown at game start, facing forward
    idle_up:    [p("back_idle")],  // stopped, facing away
    idle_side:  [p("side_idle")],  // stopped, facing side (right; mirrored for left)
    idle_down:  [p("front_idle")], // stopped, facing forward
    walk_side:  cycle("side", sideN),
    walk_up:    cycle("back"),
    walk_down:  cycle("front"),
  };
}

const CHAR_FRAMES: Record<CharId, Record<string, string[]>> = {
  kinju: dirFrames("kinju"),
  rowan: dirFrames("rowan"),
  jess:  dirFrames("jess", 5),
};
// Maps CharId → actual image filename prefix (kinju reuses "kinju" assets until new sprites ship).
const CHAR_IMG_KEY: Record<CharId, string> = { kinju: "kinju", rowan: "rowan", jess: "jess" };

// Wyvrunt follower frame set (Pokémon-Yellow style trailing companion).
const WYV_FRAMES = dirFrames("wyvrunt");

// Sprites have transparent backgrounds. Normalise to displayW so all frames
// maintain their natural aspect ratio rather than being squashed into a square.
function drawSprite(
  canvas: HTMLCanvasElement, src: string, flipX: boolean, displayW = SPRITE_PX
): boolean {
  // Load on demand (cheap no-op if already cached). This makes every sprite
  // self-loading so we don't have to eagerly preload the whole asset set —
  // critical on mobile Safari, which blanks images past a decoded-memory ceiling.
  const img = loadImg(src);
  if (!img?.complete || !img.naturalWidth) return false;
  const W = displayW;
  const H = Math.round(W * img.naturalHeight / img.naturalWidth);
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, W, H);
  if (flipX) ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}

function inRect(x: number, y: number, [x1,y1,x2,y2]: Rect) {
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}
// Walls are temporarily OFF while we rebuild them with the visual editor.
// Door triggers are independent of this (they call inRect directly), so every
// door keeps working — the player can just now reach all of them freely.
let WALLS_ON = (() => { try { return localStorage.getItem(DEV_WALLSON_KEY) === "1"; } catch { return false; } })();
function blocked(x: number, y: number, zones: Rect[]) {
  if (!WALLS_ON) return false;
  return zones.some(r => inRect(x, y, r));
}
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

// ── Prof Irwyn NPC world position in lab ────────────────────────────────────
const PROF = { x: 350, y: 268 }; // feet position in lab world

// Party holds the starter (slot 1) plus up to PARTY_CAP-1 caught companions.
const PARTY_CAP = 8;
// Storage Box at the lab holds up to this many extra Tayanari.
const STORAGE_CAP = 100;

// ── Main component ──────────────────────────────────────────────────────────
export function WalkDemo({ characterId = "kinju", roleId: roleIdProp = "keeper" }: { characterId?: CharId; roleId?: RoleId } = {}) {
  // The declared path is now chosen in the lab when you receive your starter, so
  // roleId is live state (the prop is only the initial/resumed value).
  const [roleId, setRoleId] = useState<RoleId>(roleIdProp);
  const role = roleDef(roleId);
  // Hydrate persisted party + world once on mount (Continue resumes; New Game cleared both).
  const savedSnap  = useRef(readSave()).current;
  const savedParty = savedSnap?.party ?? null;
  const savedWorld = savedSnap?.world ?? null;
  // Sanitized resume target. We never resume *into* a battle (battle runtime
  // isn't persisted), so a legacy save left mid-battle falls back to home.
  // Saves live in localStorage and could be malformed/tampered, so we validate
  // the scene against the known walkable set and require finite coordinates;
  // anything off falls back to the safe home spawn.
  const WALKABLE_SCENES: Scene[] = ["overworld","lab","maya","jay","home","ellio","lia","route1","route2","area3","farm","shore","town","town_left","town_right"];
  const resume = (() => {
    if (!savedWorld) return null;
    const HOME = { scene: "home" as Scene, x: 400, y: 670 };
    if (!WALKABLE_SCENES.includes(savedWorld.scene as Scene)) return HOME; // covers "battle" + junk
    if (!Number.isFinite(savedWorld.posX) || !Number.isFinite(savedWorld.posY)) return HOME;
    return { scene: savedWorld.scene as Scene, x: savedWorld.posX, y: savedWorld.posY };
  })();

  // Active character's animation frame set (stable for the session).
  const charFrames = CHAR_FRAMES[characterId] ?? CHAR_FRAMES.kinju;
  // Character-specific side sprite for the battle arena (each character has a full sprite set).
  const heroSideImg = `/__mockup/images/${CHAR_IMG_KEY[characterId]}_side_idle.png`;

  // ── Role / spawn swap ──────────────────────────────────────────────────────
  // The spouse waiting at home is whichever of Kinju/Jess you are NOT playing
  // (playing Rowan keeps Jess as spouse). Rowan, when not the player, becomes
  // the professor's disciple in the lab. When you play Rowan, Kinju also waits
  // at home alongside Jess.
  const partnerId: CharId = characterId === "jess" ? "kinju" : "jess";
  const partnerName  = partnerId === "kinju" ? "Kinju" : "Jess";
  const partnerSprite = `/__mockup/images/${CHAR_IMG_KEY[partnerId]}_front_idle.png`;
  const rowanInLab    = characterId !== "rowan";   // Rowan is the lab disciple
  const kinjuAtHome    = characterId === "rowan";    // extra figure at home

  // Per-character starting positions for NEW games (no resume data).
  // Kinju starts in their home; Jess in the overworld (roamer); Rowan in the lab.
  const CHAR_SPAWN: Record<CharId, { scene: Scene; x: number; y: number }> = {
    kinju: { scene: "home",      x: 400, y: 670 },
    jess:  { scene: "overworld", x: 600, y: 830 },
    rowan: { scene: "lab",       x: 480, y: 274 },
  };
  const defaultSpawn = CHAR_SPAWN[characterId] ?? CHAR_SPAWN.kinju;

  const [scene,       setScene]       = useState<Scene>(() => resume?.scene ?? defaultSpawn.scene);
  const [phase,       setPhase]       = useState<Phase>("walk");
  const [fading,      setFading]      = useState(false);
  const [held,        setHeld]        = useState<string | null>(null);

  const [isTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches
    );
  });
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const onChange = () => setIsLandscape(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [nearProf,         setNearProf]         = useState(false);
  const [nearRowan,        setNearRowan]        = useState(false);
  const [rowanInteractPos, setRowanInteractPos] = useState({ sx: 0, sy: 0 });
  const [nearMaya,         setNearMaya]         = useState(false);
  const [nearJay,          setNearJay]          = useState(false);
  const [nearShell,        setNearShell]        = useState(false);
  const [shellsCollected,  setShellsCollected]  = useState(() => savedWorld?.shellsCollected ?? false);
  const [pickupNotif,      setPickupNotif]      = useState(false);
  const [selected,         setSelected]         = useState<StarterId | null>(null);
  const [roleSel,          setRoleSel]          = useState<RoleId | null>(null);
  const [starter,          setStarter]          = useState<StarterSpec | null>(() => {
    const base = STARTERS.find(s => s.id === savedParty?.starterId) ?? null;
    if (!base) return null;
    // Restore evolved form: base gives type/color, override patches name + sprite.
    const ov = savedParty?.starterFormOverride;
    if (ov) return { ...base, id: ov.id, name: ov.name, img: ov.img };
    return base;
  });
  const [showJournal,      setShowJournal]      = useState(false);
  const [journalTab,       setJournalTab]       = useState<"party"|"storage"|"shells"|"bag"|"equipment"|"guide">("party");
  const [interactPos,      setInteractPos]      = useState({ sx: 0, sy: 0 });
  const [mayaInteractPos,  setMayaInteractPos]  = useState({ sx: 0, sy: 0 });
  const [jayInteractPos,   setJayInteractPos]   = useState({ sx: 0, sy: 0 });
  const [shellInteractPos, setShellInteractPos] = useState({ sx: 0, sy: 0 });
  const [nearJess,               setNearJess]               = useState(false);
  const [jessInteractPos,        setJessInteractPos]        = useState({ sx: 0, sy: 0 });
  const [hasHealingRune,         setHasHealingRune]         = useState(() => savedWorld?.hasHealingRune ?? false);
  const [healingRuneEquipped,    setHealingRuneEquipped]    = useState(() => savedWorld?.healingRuneEquipped ?? false);
  const [runeNotif,              setRuneNotif]              = useState(false);
  const [nearEllio,              setNearEllio]              = useState(false);
  const [ellioInteractPos,       setEllioInteractPos]       = useState({ sx: 0, sy: 0 });
  const [hasResonanceStone,      setHasResonanceStone]      = useState(() => savedWorld?.hasResonanceStone ?? false);
  const [resonanceStoneEquipped, setResonanceStoneEquipped] = useState(() => savedWorld?.resonanceStoneEquipped ?? false);
  const [resonanceNotif,         setResonanceNotif]         = useState(false);
  // ── Quest-done guards — hide ! bubble once each NPC arc is finished ─────────
  const [jessDone,       setJessDone]       = useState(() => savedWorld?.jessDone ?? false);
  const [jayDone,        setJayDone]        = useState(() => savedWorld?.jayDone ?? false);
  const [mayaInitDone,   setMayaInitDone]   = useState(() => savedWorld?.mayaInitDone ?? false); // after first convo (d4)
  const [mayaDone,       setMayaDone]       = useState(() => savedWorld?.mayaDone ?? false); // after post-shell convo (post3)
  const [ellioDone,      setEllioDone]      = useState(() => savedWorld?.ellioDone ?? false);
  const [nearLia,          setNearLia]          = useState(false);
  const [liaInteractPos,   setLiaInteractPos]   = useState({ sx: 0, sy: 0 });
  const [liaDone,          setLiaDone]          = useState(() => savedWorld?.liaDone ?? false);
  const [hasHearthberries, setHasHearthberries] = useState(() => savedWorld?.hasHearthberries ?? false);
  const [hasSatchel,       setHasSatchel]       = useState(() => savedWorld?.hasSatchel ?? false);
  const [liaItemsNotif,    setLiaItemsNotif]    = useState(false);
  // ── Route 2 / Wyvrunt arc ────────────────────────────────────────────────
  const [route1Visited,        setRoute1Visited]        = useState(() => savedWorld?.route1Visited ?? false);
  const [wifeOnPath,           setWifeOnPath]           = useState(() => savedWorld?.wifeOnPath ?? false);
  const [wifeIntercepted,      setWifeIntercepted]      = useState(() => savedWorld?.wifeIntercepted ?? false);
  const [route2Greeted,        setRoute2Greeted]        = useState(() => savedWorld?.route2Greeted ?? false);
  const [profRoute2Done,       setProfRoute2Done]       = useState(() => savedWorld?.profRoute2Done ?? false);
  const [nearProfR2,           setNearProfR2]           = useState(false);
  const [profR2InteractPos,    setProfR2InteractPos]    = useState({ sx: 0, sy: 0 });
  const [nearFarmerR2,         setNearFarmerR2]         = useState(false);
  const [farmerR2InteractPos,  setFarmerR2InteractPos]  = useState({ sx: 0, sy: 0 });
  const [hasObsidianRealmShell, setHasObsidianRealmShell] = useState(() => savedWorld?.hasObsidianRealmShell ?? false);
  const [wyvruntCaught,        setWyvruntCaught]        = useState(() => savedWorld?.wyvruntCaught ?? false);
  const [wyvruntForm,          setWyvruntForm]          = useState(() => savedWorld?.wyvruntForm ?? 0);
  const [wyrLoyalty,           setWyrLoyalty]           = useState(() => savedWorld?.wyrLoyalty ?? 0);
  const [jayA3Wins,            setJayA3Wins]            = useState(() => savedWorld?.jayA3Wins ?? 0);
  const [liaA3Wins,            setLiaA3Wins]            = useState(() => savedWorld?.liaA3Wins ?? 0);
  const [trainerEncounter,     setTrainerEncounter]     = useState<{ trainer:"jay"|"lia"|"jerbs"|"prof"; name:string; team:MonSpec[]; levels:number[] } | null>(null);
  const [nearJayA3,            setNearJayA3]            = useState(false);
  const [jayA3InteractPos,     setJayA3InteractPos]     = useState({ sx: 0, sy: 0 });
  const [nearLiaA3,            setNearLiaA3]            = useState(false);
  const [liaA3InteractPos,     setLiaA3InteractPos]     = useState({ sx: 0, sy: 0 });
  const [cleminusMet,          setCleminusMet]          = useState(() => savedWorld?.cleminusMet ?? false);
  const [demoComplete,         setDemoComplete]         = useState(() => savedWorld?.demoComplete ?? false);
  const [jerbsBattleDone,      setJerbsBattleDone]      = useState(() => savedWorld?.jerbsBattleDone ?? false);
  const [hasCrystalFang,       setHasCrystalFang]       = useState(() => savedWorld?.hasCrystalFang ?? false);
  const [crystalFangEvo,       setCrystalFangEvo]       = useState<"glacia"|"volcia"|"faelia"|null>(() => savedWorld?.crystalFangEvo ?? null);
  const [catalystStones,       setCatalystStones]       = useState<("glacia"|"volcia"|"faelia")[]>(() => savedWorld?.catalystStones ?? []);
  const [hollisGifted,         setHollisGifted]         = useState(() => savedWorld?.hollisGifted ?? false);
  const [duskberries,          setDuskberries]          = useState(() => savedWorld?.duskberries ?? 0);
  const [thornberries,         setThornberries]         = useState(() => savedWorld?.thornberries ?? 0);
  const [calmberries,          setCalmberries]          = useState(() => savedWorld?.calmberries ?? 0);
  const [brightberries,        setBrightberries]        = useState(() => savedWorld?.brightberries ?? 0);
  // Primeria Farm state
  const [farmVisited,          setFarmVisited]          = useState(() => savedWorld?.farmVisited ?? false);
  const [farmShellsGiven,      setFarmShellsGiven]      = useState(() => savedWorld?.farmShellsGiven ?? false);
  const [farmRunesGiven,       setFarmRunesGiven]       = useState(() => savedWorld?.farmRunesGiven ?? false);
  const [marenGifted,          setMarenGifted]          = useState(() => savedWorld?.marenGifted ?? false);
  const [ownedBattleShellIds,  setOwnedBattleShellIds]  = useState<string[]>(() => savedWorld?.ownedBattleShellIds ?? []);
  const [equippedBattleShellId,setEquippedBattleShellId]= useState<string|null>(() => savedWorld?.equippedBattleShellId ?? null);
  const [ownedBattleRuneIds,   setOwnedBattleRuneIds]   = useState<string[]>(() => savedWorld?.ownedBattleRuneIds ?? []);
  const [slottedBattleRuneId,  setSlottedBattleRuneId]  = useState<string|null>(() => savedWorld?.slottedBattleRuneId ?? null);
  const [hasCrucibyx,          setHasCrucibyx]          = useState(() => savedWorld?.hasCrucibyx ?? false);
  const [showShellPicker,      setShowShellPicker]      = useState(false);
  const [showRunePicker,       setShowRunePicker]       = useState(false);
  const [primeriaCoin,         setPrimeriaCoin]         = useState(() => savedWorld?.primeriaCoin ?? 0);
  const [profShoreWins,        setProfShoreWins]        = useState(() => savedWorld?.profShoreWins ?? 0);
  const [profShorePaid,        setProfShorePaid]        = useState(() => savedWorld?.profShorePaid ?? 0);
  const [firstHomeGreeting,    setFirstHomeGreeting]    = useState(() => savedWorld?.firstHomeGreeting ?? false);
  // Overworld ambient NPC proximity
  const [nearTova,  setNearTova]  = useState(false);
  const [tovaInteractPos,  setTovaInteractPos]  = useState({ sx: 0, sy: 0 });
  const [nearSenna, setNearSenna] = useState(false);
  const [sennaInteractPos, setSennaInteractPos] = useState({ sx: 0, sy: 0 });
  const [nearCorvin, setNearCorvin] = useState(false);
  const [corvinInteractPos, setCorvinInteractPos] = useState({ sx: 0, sy: 0 });
  const [corvinMet, setCorvinMet] = useState(() => savedWorld?.corvinMet ?? false);
  // NPC entry bounce animations (one-shot per room entry, no cycle needed)
  const [jayBounce,  setJayBounce]  = useState(false);
  const [ellioBounce, setEllioBounce] = useState(false);
  const [liaBounce,  setLiaBounce]  = useState(false);
  const [mayaBounce, setMayaBounce] = useState(false);
  const [nearProfShore,        setNearProfShore]        = useState(false);
  const [profShoreInteractPos, setProfShoreInteractPos] = useState({ sx: 0, sy: 0 });
  const profShoreCanvasRef   = useRef<HTMLCanvasElement>(null);
  const profShorePortraitRef = useRef<HTMLCanvasElement>(null);
  const [nearShella,           setNearShella]           = useState(false);
  const [shellaInteractPos,    setShellaInteractPos]    = useState({ sx: 0, sy: 0 });
  const [nearRunrik,           setNearRunrik]           = useState(false);
  const [runrikInteractPos,    setRunrikInteractPos]    = useState({ sx: 0, sy: 0 });
  const [nearMaren,            setNearMaren]            = useState(false);
  const [marenInteractPos,     setMarenInteractPos]     = useState({ sx: 0, sy: 0 });
  const [nearJerbs,            setNearJerbs]            = useState(false);
  const [jerbsInteractPos,     setJerbsInteractPos]     = useState({ sx: 0, sy: 0 });
  const [portalFrame,          setPortalFrame]          = useState(0);
  const [portalOpen,           setPortalOpen]           = useState(false);
  // Jerbs has landed via portal but the player hasn't spoken to him yet.
  const [jerbsAppeared,        setJerbsAppeared]        = useState(false);
  const [jerbsFacing,          setJerbsFacing]          = useState<"back"|"front">(() => savedWorld?.cleminusMet ? "front" : "back");
  const [showCardIndex,        setShowCardIndex]        = useState(0); // 0=keeper, 1=elder
  // Role is declared in the lab at starter time. Older saves (pre-change) that
  // already hold a starter are treated as having declared, so their badge shows.
  const [roleChosen,           setRoleChosen]           = useState(() => savedWorld?.roleChosen ?? (savedParty?.starterId != null));
  const [nearWyvrunt,          setNearWyvrunt]          = useState(false);
  const [eastGateNotif,        setEastGateNotif]        = useState(false);
  const [lockedDoorNotif,      setLockedDoorNotif]      = useState<string | null>(null);

  // ── Encounter / battle state ────────────────────────────────────────────
  const [shellCount,    setShellCount]    = useState(() => savedParty?.shells ?? 0);
  const [wildEncounter, setWildEncounter] = useState<MonSpec | null>(null);
  const wildEncounterLevelRef = useRef(5);
  const [caughtParty,   setCaughtParty]   = useState<PartyMon[]>(() => hydrateParty(savedParty?.caught ?? []));
  const [storageBox,    setStorageBox]    = useState<PartyMon[]>(() => hydrateParty(savedParty?.box ?? []));
  const [activeDisturbances, setActiveDisturbances] = useState<Record<number, { mon: MonSpec; expiresAt: number }>>({});
  const [hotspotCd,     setHotspotCd]     = useState<Record<number, number>>({});
  const [encounterFlash, setEncounterFlash] = useState<{ color: string; key: number } | null>(null);
  // ── Dev: visual debug overlay — doors, collisions, tap-to-probe coords ────
  const [devMode, setDevMode] = useState(false);
  const [devCollapsed, setDevCollapsed] = useState(false);
  const [devProbe, setDevProbe] = useState<{ x: number; y: number } | null>(null);
  // ── DEV door editor: drag-to-move + glow toggle + COPY export ──────────────
  const [, setDoorEditTick] = useState(0);
  const [doorCopied, setDoorCopied] = useState(false);
  const doorDragRef = useRef<{ sx: number; sy: number; orig: Rect } | null>(null);
  const onDoorDown = (_key: string, get: () => Rect) => (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    doorDragRef.current = { sx: e.clientX, sy: e.clientY, orig: [...get()] as Rect };
  };
  const onDoorMove = (set: (r: Rect) => void) => (e: RPointerEvent<HTMLDivElement>) => {
    const d = doorDragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dx = Math.round((e.clientX - d.sx) / ZOOM);
    const dy = Math.round((e.clientY - d.sy) / ZOOM);
    set([d.orig[0] + dx, d.orig[1] + dy, d.orig[2] + dx, d.orig[3] + dy] as Rect);
    setDoorEditTick((t) => t + 1);
  };
  const onDoorUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!doorDragRef.current) return;
    e.stopPropagation();
    doorDragRef.current = null;
    saveDevDoors();
  };
  const toggleDoorGlow = (key: string) => (e: RMouseEvent) => {
    e.stopPropagation();
    doorGlowOn[key] = !doorGlowOn[key];
    saveDevGlows();
    setDoorEditTick((t) => t + 1);
  };
  const copyDoorLayout = () => {
    const order: Scene[] = ["overworld", "route1", "route2", "area3", "home", "lia", "maya", "jay", "ellio", "lab"];
    const out: string[] = ["PRIMERIA DOOR LAYOUT — paste this back to the assistant"];
    order.forEach((sc) => {
      const inScene = DOOR_LIST.filter((d) => d.scene === sc);
      if (!inScene.length) return;
      out.push("", "[" + sc + "]");
      inScene.forEach((d) => {
        const [a, b, c, e2] = d.get();
        out.push("  " + d.name.padEnd(12) + " " + d.key.padEnd(11) + " [" + a + "," + b + "," + c + "," + e2 + "]  glow:" + (doorGlowOn[d.key] ? "ON" : "OFF"));
      });
    });
    const txt = out.join("\n");
    const done = () => { setDoorCopied(true); window.setTimeout(() => setDoorCopied(false), 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
    } else {
      fallbackCopy(txt, done);
    }
  };
  // ── DEV wall editor: draw (2-tap) + drag-move + double-tap delete + COPY ────
  const [, setWallEditTick] = useState(0);
  const [wallEditMode, setWallEditMode] = useState(false);
  const [wallPendA, setWallPendA] = useState<{ x: number; y: number } | null>(null);
  const [wallsCopied, setWallsCopied] = useState(false);
  const [, setWallsOnTick] = useState(0);
  const wallDragRef = useRef<{ sx: number; sy: number; idx: number; orig: Rect } | null>(null);
  const wallMovedRef = useRef(false);
  const wallTapRef = useRef<{ idx: number; t: number } | null>(null);
  const curWallEntry = () => WALL_SCENES.find((w) => w.scene === scene);
  const addWall = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const w = curWallEntry(); if (!w) return;
    const rect: Rect = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
    if (rect[2] - rect[0] < 4 || rect[3] - rect[1] < 4) return; // ignore tiny accidental boxes
    w.set([...w.get(), rect]);
    saveDevWalls();
    setWallEditTick((t) => t + 1);
  };
  const deleteWall = (idx: number) => {
    const w = curWallEntry(); if (!w) return;
    w.set(w.get().filter((_, i) => i !== idx));
    saveDevWalls();
    setWallEditTick((t) => t + 1);
  };
  const onWallDown = (idx: number) => (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = curWallEntry(); if (!w) return;
    const cur = w.get()[idx]; if (!cur) return;
    wallMovedRef.current = false;
    wallDragRef.current = { sx: e.clientX, sy: e.clientY, idx, orig: [...cur] as Rect };
  };
  const onWallMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = wallDragRef.current; if (!d) return;
    e.stopPropagation();
    const dx = Math.round((e.clientX - d.sx) / ZOOM);
    const dy = Math.round((e.clientY - d.sy) / ZOOM);
    if (dx !== 0 || dy !== 0) wallMovedRef.current = true;
    const w = curWallEntry(); if (!w) return;
    const next = w.get().slice();
    next[d.idx] = [d.orig[0] + dx, d.orig[1] + dy, d.orig[2] + dx, d.orig[3] + dy] as Rect;
    w.set(next);
    setWallEditTick((t) => t + 1);
  };
  const onWallUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!wallDragRef.current) return;
    e.stopPropagation();
    wallDragRef.current = null;
    saveDevWalls();
  };
  const onWallTap = (idx: number) => {
    if (wallMovedRef.current) { wallMovedRef.current = false; return; } // a drag, not a tap
    const now = Date.now();
    const last = wallTapRef.current;
    if (last && last.idx === idx && now - last.t < 450) {
      wallTapRef.current = null;
      deleteWall(idx);
    } else {
      wallTapRef.current = { idx, t: now };
    }
  };
  const toggleWalls = () => {
    WALLS_ON = !WALLS_ON;
    try { localStorage.setItem(DEV_WALLSON_KEY, WALLS_ON ? "1" : "0"); } catch { /* ignore */ }
    setWallsOnTick((t) => t + 1);
  };
  const copyWallLayout = () => {
    const out: string[] = ["PRIMERIA WALL LAYOUT — paste this back to the assistant"];
    WALL_SCENES.forEach((w) => {
      out.push("", "[" + w.scene + "]  (" + w.arr + ")");
      const rects = w.get();
      if (!rects.length) { out.push("  (none)"); return; }
      rects.forEach(([a, b, c, d2]) => out.push("  [" + a + ", " + b + ", " + c + ", " + d2 + "],"));
    });
    const txt = out.join("\n");
    const done = () => { setWallsCopied(true); window.setTimeout(() => setWallsCopied(false), 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
    } else {
      fallbackCopy(txt, done);
    }
  };
  const [devPlayerPos, setDevPlayerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const DEV_COLLISIONS = devMode;
  const [checksStreak,  setChecksStreak]  = useState(() => savedWorld?.checksStreak ?? 0);
  const [floatMsg,      setFloatMsg]      = useState<{ x: number; y: number; text: string; key: number } | null>(null);
  const [showStarterGate, setShowStarterGate] = useState(false);
  const [battleNotif,   setBattleNotif]   = useState<{ title: string; sub: string } | null>(null);
  const [justSaved,     setJustSaved]     = useState(false);
  const [showDpadHint,  setShowDpadHint]  = useState(() => {
    try { return !localStorage.getItem("primeria_dpad_hint_seen"); } catch { return true; }
  });
  // isMobile: computed once — the game runs fullscreen and doesn't layout-shift on resize
  const isMobile = window.innerWidth <= 520;
  // ── Starter progression ───────────────────────────────────────────────────
  const [starterLevel, setStarterLevel] = useState(() => savedParty?.level ?? 5);
  const [starterXp,    setStarterXp]    = useState(() => savedParty?.xp ?? 0);
  const [starterStats, setStarterStats] = useState<StarterStats>(() => savedParty?.stats ?? { hp: 40, atk: 6, def: 4, spd: 5 });
  const [starterMoves, setStarterMoves] = useState<string[]>(() => savedParty?.moves ?? []);

  // Persist party progress whenever it changes (resumed via Continue).
  useEffect(() => {
    // Evolved starters: save the STARTERS base-id for type/color restore, plus an
    // override for the evolved name + sprite. Walk EVO_TABLE backwards to find the root.
    const isBase = !starter || STARTERS.some(s => s.id === starter.id);
    const baseId: string | null = isBase
      ? (starter?.id ?? null)
      : (() => {
          let id = starter!.id;
          for (let i = 0; i < 4; i++) {
            const e = EVO_TABLE.find(en => en.to.id === id);
            if (!e) return id;
            if (STARTERS.some(s => s.id === e.from)) return e.from;
            id = e.from;
          }
          return id;
        })();
    updateParty({
      starterId: baseId,
      starterFormOverride: !isBase && starter
        ? { id: starter.id, name: starter.name, img: starter.img }
        : null,
      level: starterLevel,
      xp: starterXp,
      stats: starterStats,
      moves: starterMoves,
      caught: caughtParty,
      box: storageBox,
      shells: shellCount,
    });
  }, [starter, starterLevel, starterXp, starterStats, starterMoves, caughtParty, storageBox, shellCount]);

  // One-time migration: older saves stored cosmetic move name-strings. Once the
  // starter (and thus its element) is known, normalise the active list to valid
  // learnset move ids, filling from the default loadout when none survive.
  const movesMigrated = useRef(false);
  useEffect(() => {
    if (movesMigrated.current || !starter) return;
    const el = asElement(starter.type);
    if (!el) return;
    movesMigrated.current = true;
    setStarterMoves(cur => sanitizeActiveMoves(el, starterLevel, cur));
  }, [starter, starterLevel]);

  // ── World persistence (resume exactly where you left off) ──────────────────
  // We keep a live snapshot of every quest flag + the current scene, then write
  // it to the save together with the player's world position. The effect below
  // refreshes the snapshot (and saves) whenever any flag/scene changes; the game
  // loop additionally throttles position saves while walking.
  // Latest *walkable* location (never "battle") — this is what we resume into.
  // It's kept current by the game loop + transitionTo, so a save taken during a
  // battle still restores the player to the spot they triggered it from.
  const lastSafeRef = useRef<{ scene: Scene; x: number; y: number }>({
    scene: resume?.scene ?? defaultSpawn.scene,
    x: resume?.x ?? defaultSpawn.x,
    y: resume?.y ?? defaultSpawn.y,
  });
  // Live snapshot of the quest flags (scene + position come from lastSafeRef).
  const worldSnapRef = useRef<Omit<WorldSave, "scene" | "posX" | "posY">>({
    shellsCollected, hasHealingRune, healingRuneEquipped,
    hasResonanceStone, resonanceStoneEquipped, hasHearthberries, hasSatchel,
    firstHomeGreeting, jessDone, jayDone, mayaInitDone, mayaDone, ellioDone, liaDone,
    route1Visited, wifeOnPath, wifeIntercepted, route2Greeted, profRoute2Done,
    hasObsidianRealmShell, wyvruntCaught, wyvruntForm, wyrLoyalty,
    jayA3Wins, liaA3Wins, roleChosen, checksStreak,
    cleminusMet, demoComplete,
    jerbsBattleDone, hasCrystalFang, crystalFangEvo, catalystStones,
    hollisGifted, duskberries, thornberries, calmberries, brightberries,
    farmVisited, farmShellsGiven, farmRunesGiven, marenGifted,
    ownedBattleShellIds, equippedBattleShellId, ownedBattleRuneIds, slottedBattleRuneId, hasCrucibyx,
    primeriaCoin, profShoreWins, profShorePaid,
    corvinMet,
  });
  const persistWorld = useCallback(() => {
    const safe = lastSafeRef.current;
    updateWorld({
      ...worldSnapRef.current,
      scene: safe.scene,
      posX: Math.round(safe.x),
      posY: Math.round(safe.y),
    });
  }, []);
  const persistWorldRef = useRef(persistWorld);
  useEffect(() => { persistWorldRef.current = persistWorld; }, [persistWorld]);
  useEffect(() => {
    worldSnapRef.current = {
      shellsCollected, hasHealingRune, healingRuneEquipped,
      hasResonanceStone, resonanceStoneEquipped, hasHearthberries, hasSatchel,
      firstHomeGreeting, jessDone, jayDone, mayaInitDone, mayaDone, ellioDone, liaDone,
      route1Visited, wifeOnPath, wifeIntercepted, route2Greeted, profRoute2Done,
      hasObsidianRealmShell, wyvruntCaught, wyvruntForm, wyrLoyalty,
      jayA3Wins, liaA3Wins, roleChosen, checksStreak,
      cleminusMet, demoComplete,
      jerbsBattleDone, hasCrystalFang, crystalFangEvo, catalystStones,
      hollisGifted, duskberries, thornberries, calmberries, brightberries,
      farmVisited, farmShellsGiven, farmRunesGiven, marenGifted,
      ownedBattleShellIds, equippedBattleShellId, ownedBattleRuneIds, slottedBattleRuneId, hasCrucibyx,
      primeriaCoin, profShoreWins, profShorePaid,
      corvinMet,
    };
    persistWorld();
  }, [
    scene, shellsCollected, hasHealingRune, healingRuneEquipped,
    hasResonanceStone, resonanceStoneEquipped, hasHearthberries, hasSatchel,
    firstHomeGreeting, jessDone, jayDone, mayaInitDone, mayaDone, ellioDone, liaDone,
    route1Visited, wifeOnPath, wifeIntercepted, route2Greeted, profRoute2Done,
    hasObsidianRealmShell, wyvruntCaught, wyvruntForm, wyrLoyalty,
    jayA3Wins, liaA3Wins, roleChosen, checksStreak,
    cleminusMet, demoComplete,
    jerbsBattleDone, hasCrystalFang, crystalFangEvo, catalystStones,
    hollisGifted, duskberries, thornberries, calmberries, brightberries,
    farmVisited, farmShellsGiven, farmRunesGiven, marenGifted,
    ownedBattleShellIds, equippedBattleShellId, ownedBattleRuneIds, slottedBattleRuneId, hasCrucibyx,
    primeriaCoin, profShoreWins, profShorePaid,
    corvinMet,
    persistWorld,
  ]);
  // On resume with Wyvrunt already caught, seed the follower beside the player
  // so it doesn't visibly fly in from the map origin on the first frame.
  useEffect(() => {
    if (savedWorld?.wyvruntCaught) {
      followPosRef.current  = { x: worldPos.current.x, y: worldPos.current.y + 24 };
      followAnimRef.current = "idle_down";
    }
  }, [savedWorld]);

  // Resume-safe role guard: if a save already holds a starter but the path was
  // never declared (e.g. reloaded mid-lab, between picking the starter and
  // confirming the role), force the role picker so declaration stays reachable.
  useEffect(() => {
    if (savedParty?.starterId != null && !roleChosen) setPhase("role_pick");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Final flush when leaving the page so the last few steps are never lost.
  useEffect(() => {
    const flush = () => persistWorldRef.current();
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // Fresh snapshot of in-party caught mons for the catch handler closure.
  const caughtPartyRef = useRef<PartyMon[]>(caughtParty);
  useEffect(() => { caughtPartyRef.current = caughtParty; }, [caughtParty]);
  const storageBoxRef = useRef<PartyMon[]>(storageBox);
  useEffect(() => { storageBoxRef.current = storageBox; }, [storageBox]);

  // Single source of truth for adding a captured mon: respects the party cap,
  // overflowing into the storage box (which itself caps at STORAGE_CAP).
  // Returns where the mon ended up: "party", "box", or "full" (nowhere — both full).
  // A freshly caught mon starts at the level it was fighting at, XP reset.
  const addCaughtMon = useCallback((mon: MonSpec, force = false, startLevel?: number): "party" | "box" | "full" => {
    const lvl = startLevel ?? wildLevelFor(mon.rarity) ?? 5;
    const el = asElement(mon.type);
    const pm: PartyMon = { ...mon, level: lvl, xp: 0, moves: el ? defaultActiveMoves(el, lvl) : [] };
    if (caughtPartyRef.current.length >= PARTY_CAP - 1) {
      if (storageBoxRef.current.length >= STORAGE_CAP && !force) return "full";
      setStorageBox(b => [...b, pm]);
      return "box";
    }
    setCaughtParty(p => [...p, pm]);
    return "party";
  }, []);

  // Apply battle XP to a caught companion (cap 30, no evolution for wild-caught).
  function levelUpCaughtMon(m: PartyMon, award: number): PartyMon {
    if (award <= 0) return m;
    let lvl = m.level, xp = m.xp + award;
    let thr = lvl * 10 + 10;
    while (xp >= thr && lvl < 30) { xp -= thr; lvl += 1; thr = lvl * 10 + 10; }
    const el = asElement(m.type);
    const moves = el && lvl !== m.level
      ? sanitizeActiveMoves(el, lvl, m.moves ?? defaultActiveMoves(el, m.level))
      : (m.moves ?? (el ? defaultActiveMoves(el, m.level) : []));
    return { ...m, level: lvl, xp, moves };
  }

  // Swap any caught companion into the No. 1 lead slot.
  // Computes equivalent base values so partyBattleStats gives ~the same HP/ATK
  // as the starter's accumulated stats, keeping the bench mon balanced.
  function promoteToLead(i: number) {
    if (!starter) return;
    const mon = caughtParty[i];
    const el  = asElement(mon.type);

    // New starter derived from the chosen companion
    const newStarter: StarterSpec = {
      id: mon.id, name: mon.name, type: mon.type,
      color: ELEMENT_COLOR[mon.type as keyof typeof ELEMENT_COLOR] ?? "#888888",
      img: mon.playerImg,
      faces: mon.playerFaces ?? "right",
    };
    const mbs = partyBattleStats(mon.maxHp, mon.baseDmg, mon.rarity, mon.level);
    const newStarterStats: StarterStats = { hp: mbs.hp, atk: mbs.atk, def: mbs.def, spd: mbs.spd };

    // Old starter → bench PartyMon; back-compute base values that reproduce current stats
    const baseHp  = Math.max(20, Math.round(starterStats.hp / Math.max(0.001, 1 + starterLevel * 0.04)));
    const atkBase = Math.max(1,  starterStats.atk - Math.floor(starterLevel * 0.6));
    const oldStarterAsMon: PartyMon = {
      id: starter.id, name: starter.name, type: starter.type,
      rarity: "rare" as MonRarity,
      wildImg: starter.img, playerImg: starter.img,
      wildFaces: starter.faces ?? "right",
      playerFaces: starter.faces ?? "right",
      maxHp: baseHp,
      baseDmg: [atkBase, atkBase + 4] as [number, number],
      level: starterLevel, xp: starterXp, moves: starterMoves,
    };

    setStarter(newStarter);
    setStarterLevel(mon.level);
    setStarterXp(mon.xp);
    setStarterMoves(mon.moves ?? (el ? defaultActiveMoves(el, mon.level) : []));
    setStarterStats(newStarterStats);
    setCaughtParty(prev => prev.map((m, j) => j === i ? oldStarterAsMon : m));
  }

  // Post-battle report modal (shell recovery + xp + level up)
  const [battleReport, setBattleReport] = useState<{
    outcome: string;
    xpGained: number;
    recovered: number;
    lostToBond: number;
    levelUps: number;
    newLevel: number;
    statGains: Partial<Record<StatKey, number>>;
    newMoves: string[];
    companionCount?: number;
  } | null>(null);
  const [pendingEvo,   setPendingEvo]   = useState<StarterSpec | null>(null);
  const pendingEvoDataRef = useRef<{
    outcome: string; xpGained: number; recovered: number; lostToBond: number;
    levelUps: number; newLevel: number;
    statGains: Partial<Record<StatKey, number>>; newMoves: string[];
    companionCount?: number;
  } | null>(null);

  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const profCanvasRef      = useRef<HTMLCanvasElement>(null);
  const portraitCanvasRef  = useRef<HTMLCanvasElement>(null);
  const mayaCanvasRef      = useRef<HTMLCanvasElement>(null);
  const mayaPortraitRef    = useRef<HTMLCanvasElement>(null);
  const jayCanvasRef       = useRef<HTMLCanvasElement>(null);
  const jayPortraitRef     = useRef<HTMLCanvasElement>(null);
  const jessCanvasRef      = useRef<HTMLCanvasElement>(null);
  const jessPortraitRef    = useRef<HTMLCanvasElement>(null);
  const rowanLabCanvasRef  = useRef<HTMLCanvasElement>(null);
  const kinjuHomeCanvasRef  = useRef<HTMLCanvasElement>(null);

  // ── Wyvrunt follower state ─────────────────────────────────────────────────
  const wyvFollowRef    = useRef<HTMLCanvasElement>(null);
  const breadcrumbsRef  = useRef<{ x: number; y: number }[]>([]);
  const followPosRef    = useRef({ x: 0, y: 0 });
  const followAnimRef   = useRef("idle_down");
  const followFrameRef  = useRef(0);
  const followFlipRef   = useRef(false);
  const followLastDirRef= useRef("idle_down");
  const followLastSrc   = useRef("");
  const followLastFlip  = useRef(false);
  const ellioCanvasRef     = useRef<HTMLCanvasElement>(null);
  const ellioPortraitRef   = useRef<HTMLCanvasElement>(null);
  const liaCanvasRef       = useRef<HTMLCanvasElement>(null);
  const liaPortraitRef     = useRef<HTMLCanvasElement>(null);
  const profR2CanvasRef    = useRef<HTMLCanvasElement>(null);
  const profR2PortraitRef  = useRef<HTMLCanvasElement>(null);
  const jessPathCanvasRef  = useRef<HTMLCanvasElement>(null);
  const jessPathPortraitRef= useRef<HTMLCanvasElement>(null);
  const jayA3CanvasRef     = useRef<HTMLCanvasElement>(null);
  const liaA3CanvasRef     = useRef<HTMLCanvasElement>(null);
  // Farm NPC canvas refs
  // Refs synced from arc state so the game-loop closure stays fresh
  const wifeOnPathRef       = useRef(false);
  const wifeInterceptedRef  = useRef(false);
  const route2GreetedRef    = useRef(false);
  const profRoute2DoneRef   = useRef(false);
  const wyvruntCaughtRef    = useRef(false);
  const route1VisitedRef    = useRef(false);
  const starterRefArc       = useRef(false);
  const allTownItemsRef     = useRef(false);
  const shadowRef  = useRef<HTMLDivElement>(null);
  const worldRef   = useRef<HTMLDivElement>(null);
  const vpRef      = useRef<HTMLDivElement>(null);

  const sceneRef   = useRef<Scene>(resume?.scene ?? "home");
  const phaseRef   = useRef<Phase>("walk");
  const fadingRef  = useRef(false);
  const heldRef    = useRef<string | null>(null);
  const animRef    = useRef("idle");
  const lastDirRef = useRef("idle_down"); // remembers facing direction when stopped
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  const lastSrc    = useRef("");
  const lastFlip   = useRef(false);
  const worldPos   = useRef(
    resume ? { x: resume.x, y: resume.y } : { x: 400, y: 670 }
  ); // resume exact spot, else start inside Player Home (matches OW→home enter spawn)
  const cam        = useRef({ x: 0, y: 0 });

  // Dev overlay: poll live player coords while debug mode is on
  useEffect(() => {
    if (!devMode) return;
    const id = setInterval(() => {
      setDevPlayerPos({ x: Math.round(worldPos.current.x), y: Math.round(worldPos.current.y) });
    }, 150);
    return () => clearInterval(id);
  }, [devMode]);

  // Preload only the small, continuously-needed sprite frames: the playing
  // character's own walk/idle frames plus the Wyvrunt follower frames. Everything
  // else loads on demand — scene maps via their per-scene <img> tags (which the
  // browser frees when you leave the scene), NPC sprites via drawSprite's lazy
  // loadImg, and battle/dialog art via plain <img> tags. This keeps only a small
  // set of images decoded at any moment, which is what mobile Safari needs: it
  // blanks images (black map, no sprite) once total decoded memory is exceeded,
  // and eagerly preloading the full ~135MB asset set blew straight past that.
  useEffect(() => {
    [
      ...Object.values(CHAR_FRAMES[characterId] ?? {}).flat(),
      ...Object.values(WYV_FRAMES).flat(), // follower frames
    ].forEach(loadImg);
  }, [characterId]);

  // Preload NPC sprites for the current scene on entry to prevent pop-in
  useEffect(() => {
    const sceneNPCs: Partial<Record<Scene, string[]>> = {
      lab:       ["/__mockup/images/prof-irwyn-sprite.png", "/__mockup/images/rowan_front_idle.png"],
      overworld: ["/__mockup/images/maya-sprite.png", "/__mockup/images/tova-npc.png", "/__mockup/images/senna-npc.png", "/__mockup/images/corvin-npc.png"],
      jay:       ["/__mockup/images/jay-sprite.png"],
      ellio:     ["/__mockup/images/ellio-sprite.png"],
      home:      ["/__mockup/images/jess_front_idle.png", "/__mockup/images/kinju_front_idle.png"],
      lia:       ["/__mockup/images/lia.png", "/__mockup/images/cindrax.png"],
      area3:     ["/__mockup/images/jay-sprite.png", "/__mockup/images/lia.png",
                  "/__mockup/images/jerbs_sprite.png", "/__mockup/images/jerbs_portal.png",
                  "/__mockup/images/crystalfang.png", "/__mockup/images/glacia.png",
                  "/__mockup/images/volcia.png", "/__mockup/images/faelia.png",
                  "/__mockup/images/glacial-stone.png", "/__mockup/images/earthfire-stone.png", "/__mockup/images/faestone.png"],
    };
    (sceneNPCs[scene] ?? []).forEach(loadImg);
  }, [scene]);

  useEffect(() => { heldRef.current = held; },      [held]);
  useEffect(() => { wifeOnPathRef.current      = wifeOnPath; },      [wifeOnPath]);
  useEffect(() => { wifeInterceptedRef.current = wifeIntercepted; }, [wifeIntercepted]);
  useEffect(() => { route2GreetedRef.current   = route2Greeted; },   [route2Greeted]);
  useEffect(() => { profRoute2DoneRef.current  = profRoute2Done; },  [profRoute2Done]);
  useEffect(() => { wyvruntCaughtRef.current   = wyvruntCaught; },   [wyvruntCaught]);
  useEffect(() => { route1VisitedRef.current   = route1Visited; },   [route1Visited]);
  useEffect(() => { starterRefArc.current      = !!starter; },       [starter]);
  const cleminusMetRef = useRef(cleminusMet);
  useEffect(() => { cleminusMetRef.current = cleminusMet; }, [cleminusMet]);
  const jerbsAppearedRef = useRef(jerbsAppeared);
  useEffect(() => { jerbsAppearedRef.current = jerbsAppeared; }, [jerbsAppeared]);
  useEffect(() => {
    if (!jerbsAppeared) return;
    const t = window.setTimeout(() => setJerbsFacing("front"), 800);
    return () => clearTimeout(t);
  }, [jerbsAppeared]);
  useEffect(() => {
    allTownItemsRef.current = shellsCollected && hasHealingRune && hasResonanceStone && hasHearthberries && hasSatchel;
  }, [shellsCollected, hasHealingRune, hasResonanceStone, hasHearthberries, hasSatchel]);
  useEffect(() => { phaseRef.current = phase; },    [phase]);
  useEffect(() => { sceneRef.current = scene; },    [scene]);

  // ── Background music — changes with scene ─────────────────────────────
  useEffect(() => {
    if (scene === "battle") {
      playTrack(BATTLE_TRACK);
    } else if (scene === "route1" || scene === "route2" || scene === "area3" || scene === "shore") {
      playTrack(ROUTE_TRACK);
    } else {
      playTrack(TOWN_TRACK);
    }
  }, [scene]);

  // Stop all audio on unmount
  useEffect(() => { return () => { stopAll(); }; }, []);

  // Draw Prof Irwyn world sprite via canvas (proper transparency, no blend-mode)
  useEffect(() => {
    if (scene !== "lab") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Maya world sprite
  useEffect(() => {
    if (scene !== "overworld") return;
    const src = "/__mockup/images/maya-sprite.png";
    const tryDraw = () => {
      const c = mayaCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Jay world sprite (inside jay scene)
  useEffect(() => {
    if (scene !== "jay") return;
    const src = "/__mockup/images/jay-sprite.png";
    const tryDraw = () => {
      const c = jayCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 64)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Prof portrait in dialog box
  useEffect(() => {
    if (phase === "walk" || phase === "pick") return;
    if (phase.startsWith("maya_")) return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = portraitCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Maya portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("maya_")) return;
    const src = "/__mockup/images/maya-sprite.png";
    const tryDraw = () => {
      const c = mayaPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Jay portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("jay_")) return;
    const src = "/__mockup/images/jay-sprite.png";
    const tryDraw = () => {
      const c = jayPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Ellio world sprite inside Ellio's home
  useEffect(() => {
    if (scene !== "ellio") return;
    const src = "/__mockup/images/ellio-sprite.png";
    const tryDraw = () => {
      const c = ellioCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Ellio portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("ellio_")) return;
    const src = "/__mockup/images/ellio-sprite.png";
    const tryDraw = () => {
      const c = ellioPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Jess world sprite inside player home
  useEffect(() => {
    if (scene !== "home") return;
    const src = partnerSprite;
    const tryDraw = () => {
      const c = jessCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Jess portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("jess_")) return;
    const src = partnerSprite;
    const tryDraw = () => {
      const c = jessPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Rowan as the professor's disciple in the lab (unless you ARE Rowan)
  useEffect(() => {
    if (scene !== "lab" || !rowanInLab) return;
    const tryDraw = () => {
      const c = rowanLabCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, "/__mockup/images/rowan_front_idle.png", false, 96))
        setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, rowanInLab]);

  // Draw Kinju also waiting at home when you are playing Rowan
  useEffect(() => {
    if (scene !== "home" || !kinjuAtHome) return;
    const tryDraw = () => {
      const c = kinjuHomeCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, "/__mockup/images/kinju_front_idle.png", false, 96))
        setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, kinjuAtHome]);

  // Auto-fire partner greeting on very first home entry (no "!" required)
  useEffect(() => {
    if (scene !== "home" || firstHomeGreeting || phase !== "walk") return;
    const t = setTimeout(() => {
      setPhase("jess_d1");
      setFirstHomeGreeting(true);
    }, 900);
    return () => clearTimeout(t);
  }, [scene, firstHomeGreeting, phase]);

  // NPC entry bounce — short one-shot animation when entering a room with an NPC
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    if (scene === "jay")   { setJayBounce(true);   timers.push(setTimeout(() => setJayBounce(false),   520)); }
    if (scene === "ellio") { setEllioBounce(true);  timers.push(setTimeout(() => setEllioBounce(false), 520)); }
    if (scene === "lia")   { setLiaBounce(true);    timers.push(setTimeout(() => setLiaBounce(false),   520)); }
    if (scene === "overworld") { setMayaBounce(true); timers.push(setTimeout(() => setMayaBounce(false), 520)); }
    return () => timers.forEach(clearTimeout);
  }, [scene]);

  // D-pad control hint — shown once on very first overworld entry, auto-dismisses after 5s
  useEffect(() => {
    if (scene !== "overworld" || !showDpadHint) return;
    const t = setTimeout(() => {
      setShowDpadHint(false);
      try { localStorage.setItem("primeria_dpad_hint_seen", "1"); } catch {}
    }, 5000);
    return () => clearTimeout(t);
  }, [scene, showDpadHint]);

  // Draw Lia world sprite inside Lia's home
  useEffect(() => {
    if (scene !== "lia") return;
    const src = "/__mockup/images/lia.png";
    const tryDraw = () => {
      const c = liaCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 64)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Lia portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("lia_")) return;
    const src = "/__mockup/images/lia.png";
    const tryDraw = () => {
      const c = liaPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Prof Irwyn world sprite on Route 2
  useEffect(() => {
    if (scene !== "route2") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profR2CanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Prof Irwyn portrait for Route 2 dialogue + scripted catch phases
  useEffect(() => {
    if (!phase.startsWith("prof2_") && !phase.startsWith("scripted_")) return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profR2PortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw Prof Irwyn world sprite on Tidemark Shore
  useEffect(() => {
    if (scene !== "shore") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profShoreCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Prof Irwyn portrait for shore dialogue
  useEffect(() => {
    if (!phase.startsWith("prof_shore_")) return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profShorePortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Draw wife on the town path (overworld) only while intercepting
  useEffect(() => {
    if (scene !== "overworld" || !wifeOnPath) return;
    const src = partnerSprite;
    const tryDraw = () => {
      const c = jessPathCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 96)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, wifeOnPath]);

  // Draw Jay in Area 3
  useEffect(() => {
    if (scene !== "area3") return;
    const tryDraw = () => {
      const c = jayA3CanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, "/__mockup/images/jay-sprite.png", false, 64)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Lia in Area 3
  useEffect(() => {
    if (scene !== "area3") return;
    const tryDraw = () => {
      const c = liaA3CanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, "/__mockup/images/lia.png", false, 64)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Portal frame animation — plays opening sequence (0→5) once, then holds
  useEffect(() => {
    if (!portalOpen) { setPortalFrame(0); return; }
    const iv = window.setInterval(() => {
      setPortalFrame(f => (f < 5 ? f + 1 : 5));
    }, 120);
    return () => clearInterval(iv);
  }, [portalOpen]);


  // Draw wife portrait for jess_path_ dialogue phases
  useEffect(() => {
    if (!phase.startsWith("jess_path_")) return;
    const src = partnerSprite;
    const tryDraw = () => {
      const c = jessPathPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Redraw player canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = charFrames[animRef.current] || charFrames.idle;
    const src    = frames[frameRef.current] || frames[0];
    if (src === lastSrc.current && flipRef.current === lastFlip.current) return;
    // stand_front_3d is a portrait 3D render — shrink it; all other frames use normal size
    const displayW = src.includes("stand_front_3d") ? 60 : SPRITE_PX;
    const ok = drawSprite(canvas, src, flipRef.current, displayW);
    if (ok) { lastSrc.current = src; lastFlip.current = flipRef.current; }
  }, [charFrames]);

  // Wyvrunt follower sprite redraw (own animation state, independent of player)
  const followRedraw = useCallback(() => {
    const canvas = wyvFollowRef.current;
    if (!canvas) return;
    const frames = WYV_FRAMES[followAnimRef.current] || WYV_FRAMES.idle_down;
    const src    = frames[followFrameRef.current] || frames[0];
    if (src === followLastSrc.current && followFlipRef.current === followLastFlip.current) return;
    const ok = drawSprite(canvas, src, followFlipRef.current, 78);
    if (ok) { followLastSrc.current = src; followLastFlip.current = followFlipRef.current; }
  }, []);

  // Frame ticker (player + follower share the cadence)
  useEffect(() => {
    const id = setInterval(() => {
      const frames = charFrames[animRef.current] || charFrames.idle;
      frameRef.current = (frameRef.current + 1) % frames.length;
      redraw();
      const fframes = WYV_FRAMES[followAnimRef.current] || WYV_FRAMES.idle_down;
      followFrameRef.current = (followFrameRef.current + 1) % fframes.length;
      followRedraw();
    }, 145);
    return () => clearInterval(id);
  }, [redraw, followRedraw]);

  // Scene transition
  const transitionTo = useCallback((next: Scene, sx: number, sy: number) => {
    if (fadingRef.current) return;
    fadingRef.current = true; setFading(true);
    const INTERIOR: Scene[] = ["home", "lab", "maya", "jay", "ellio", "lia", "farm"];
    if (INTERIOR.includes(next)) playSfx("door_in");
    else if (next !== "battle") playSfx("door_out");
    setTimeout(() => {
      worldPos.current = { x: sx, y: sy };
      if (next !== "battle") lastSafeRef.current = { scene: next, x: sx, y: sy };
      cam.current      = { x: 0, y: 0 };
      animRef.current  = "idle";
      frameRef.current = 0;
      lastSrc.current  = "";
      // Reset the follower so Wyvrunt re-spawns beside the player in the new scene
      breadcrumbsRef.current = [];
      followPosRef.current   = { x: sx, y: sy + 24 };
      followAnimRef.current  = "idle_down";
      followLastDirRef.current = "idle_down";
      followLastSrc.current  = "";
      sceneRef.current = next;
      setScene(next);
      setTimeout(() => { fadingRef.current = false; setFading(false); }, 350);
    }, 350);
  }, []);

  // Main game loop
  useEffect(() => {
    let raf: number;
    let saveTick = 0; // throttles position writes while walking
    const loop = () => {
      if (!fadingRef.current && phaseRef.current === "walk" && sceneRef.current !== "battle") {
        const h       = heldRef.current;
        const sc      = sceneRef.current;
        const zoom    = sc === "farm" ? 0.62 : ZOOM;
        const world   = sc === "overworld" ? OW : sc === "lab" ? LB : sc === "route1" ? R1 : sc === "route2" ? R2 : sc === "area3" ? A3 : sc === "farm" ? FARM : sc === "shore" ? SHORE : sc === "town" ? TOWN : sc === "town_left" ? TOWN_L : sc === "town_right" ? TOWN_R : sc === "maya" ? MY : sc === "jay" ? JY : sc === "ellio" ? EH : sc === "lia" ? LH : PH;
        const zones   = sc === "overworld" ? OW_BLOCKED : sc === "lab" ? LAB_BLOCKED : sc === "route1" ? R1_BLOCKED : sc === "route2" ? R2_BLOCKED : sc === "area3" ? A3_BLOCKED : sc === "farm" ? NO_SOLIDS : sc === "shore" ? NO_SOLIDS : sc === "town" ? NO_SOLIDS : sc === "town_left" ? NO_SOLIDS : sc === "town_right" ? NO_SOLIDS : sc === "maya" ? MAYA_BLOCKED : sc === "jay" ? JAY_BLOCKED : sc === "ellio" ? EH_BLOCKED : sc === "lia" ? LH_BLOCKED : PH_BLOCKED;

        let newAnim = lastDirRef.current; // stay in last-faced direction when idle
        let newFlip = flipRef.current;
        let dx = 0, dy = 0;
        if (h === "right") { dx =  SPEED; newAnim = "walk_side"; newFlip = false; lastDirRef.current = "idle_side"; }
        if (h === "left")  { dx = -SPEED; newAnim = "walk_side"; newFlip = true;  lastDirRef.current = "idle_side"; }
        if (h === "up")    { dy = -SPEED; newAnim = "walk_up";   newFlip = false; lastDirRef.current = "idle_up";   }
        if (h === "down")  { dy =  SPEED; newAnim = "walk_down"; newFlip = false; lastDirRef.current = "idle_down"; }

        const { x, y } = worldPos.current;
        const nx = Math.max(30, Math.min(x + dx, world.w - 30));
        // Allow y=0 so the northern path exit is reachable
        const ny = Math.max(0,  Math.min(y + dy, world.h - 30));
        // Always-solid boxes (e.g. NPCs painted on the map) block even while WALLS_ON is off.
        const solids = sc === "route2" ? FARMER_SOLIDS : NO_SOLIDS;
        if (!blocked(nx, y,  zones) && !solids.some(r => inRect(nx, y,  r))) worldPos.current.x = nx;
        if (!blocked(x,  ny, zones) && !solids.some(r => inRect(x,  ny, r))) worldPos.current.y = ny;

        // Door triggers
        if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_ROUTE1_EXIT)) {
          if (!starterRefArc.current || !allTownItemsRef.current) {
            // Route 1 gate — need a starter AND all town errands done
            worldPos.current.y = OW_ROUTE1_EXIT[3] + 20;
            setShowStarterGate(true);
          } else {
            transitionTo("route1", 501, 666);     // enter Whisperroot Trail from south gate
            setRoute1Visited(true);
          }
        } else if (sc === "route1" && inRect(worldPos.current.x, worldPos.current.y, R1_SOUTH_GATE)) {
          transitionTo("overworld", 270, 30);   // exit back to overworld, south of Route-1 trigger
          // Wife intercept — once gating met & not yet done, spawn her on the south path
          if (!wifeInterceptedRef.current && !wifeOnPathRef.current
              && starterRefArc.current && allTownItemsRef.current && route1VisitedRef.current) {
            setWifeOnPath(true);
          }
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_EAST_EXIT)) {
          if (wifeInterceptedRef.current) {
            transitionTo("route2", R2_SPAWN.x, R2_SPAWN.y);
          } else {
            worldPos.current.x = OW_EAST_EXIT[0] - 20;
            setEastGateNotif(true);
            window.setTimeout(() => setEastGateNotif(false), 1800);
          }
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_RETURN_OW)) {
          transitionTo("overworld", 1050, 645);   // west of OW_EAST_EXIT so we don't instantly bounce back
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_SOUTH_BLOCKED)) {
          transitionTo("shore", SHORE_SPAWN.x, SHORE_SPAWN.y);
        } else if (sc === "shore" && inRect(worldPos.current.x, worldPos.current.y, SHORE_NORTH_EXIT)) {
          transitionTo("route2", 480, R2_SOUTH_BLOCKED[1] - 60);
          window.setTimeout(() => setLockedDoorNotif(null), 1600);
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_LOCKED_DOOR)) {
          worldPos.current.y = R2_LOCKED_DOOR[3] + 20;
          setLockedDoorNotif("It's locked.");
          window.setTimeout(() => setLockedDoorNotif(null), 1600);
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_PROF_DOOR as Rect)) {
          if (!starterRefArc.current && !allTownItemsRef.current) {
            worldPos.current.y = (OW_PROF_DOOR as Rect)[3] + 20;
            setLockedDoorNotif("Prof. Irwyn says: Say your goodbyes first — visit everyone in town before you take this step.");
            window.setTimeout(() => setLockedDoorNotif(null), 2800);
          } else {
            transitionTo("lab", 350, 590);
          }
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_MAYA_DOOR)) {
          transitionTo("maya", 400, 660);
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_JAY_DOOR)) {
          transitionTo("jay", 400, 660);
        } else if (sc === "lab" && inRect(worldPos.current.x, worldPos.current.y, LAB_EXIT)) {
          transitionTo("overworld", 538, 408);  // south of lab fence (y=390)
        } else if (sc === "maya" && inRect(worldPos.current.x, worldPos.current.y, MAYA_HOME_EXIT)) {
          transitionTo("overworld", 878, 468);  // south of Maya fence (y=452)
        } else if (sc === "jay" && inRect(worldPos.current.x, worldPos.current.y, JAY_HOME_EXIT)) {
          transitionTo("overworld", 272, 468);  // south of Jay fence (y=452)
        } else if (sc === "overworld" && h === "up" && inRect(worldPos.current.x, worldPos.current.y, OW_PLAYER_HOME_DOOR)) {
          transitionTo("home", 400, 670);       // enter Player Home — trigger sits ON visible front door (south face); require UP key so east-west walk-by on the south road doesn't enter
        } else if (sc === "home" && inRect(worldPos.current.x, worldPos.current.y, PLAYER_HOME_EXIT)) {
          transitionTo("overworld", 575, 858);  // exit onto south road, S of door (door y=820–850); avoid landing inside trigger
        } else if (sc === "overworld" && h === "up" && inRect(worldPos.current.x, worldPos.current.y, OW_ELLIO_DOOR)) {
          transitionTo("ellio", 400, 670);      // enter Ellio's Home — require "up" key (anti walk-by)
        } else if (sc === "ellio" && inRect(worldPos.current.x, worldPos.current.y, ELLIO_HOME_EXIT)) {
          transitionTo("overworld", 204, 790);  // exit onto front frontage, just S of the door
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_LIA_DOOR)) {
          transitionTo("lia", 400, 670);        // enter Lia's Home — trigger on visible front door
        } else if (sc === "lia" && inRect(worldPos.current.x, worldPos.current.y, LIA_HOME_EXIT)) {
          transitionTo("overworld", 875, 830);  // exit onto south road, S of door
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_AREA3_EXIT)) {
          if (!starterRefArc.current) {
            worldPos.current.x = OW_AREA3_EXIT[2] + 30;
            setLockedDoorNotif("Westwood Reaches is active wild territory. Bond with a Tayanari first — you'll need a partner out there.");
            window.setTimeout(() => setLockedDoorNotif(null), 2800);
          } else if (!route1VisitedRef.current) {
            worldPos.current.x = OW_AREA3_EXIT[2] + 30;
            setLockedDoorNotif("Walk Whisperroot Trail first. The ruins will make more sense once you've earned your footing.");
            window.setTimeout(() => setLockedDoorNotif(null), 2800);
          } else if (!route2GreetedRef.current) {
            worldPos.current.x = OW_AREA3_EXIT[2] + 30;
            setLockedDoorNotif("Something east of town is waiting for you. Find it before heading into the ruins.");
            window.setTimeout(() => setLockedDoorNotif(null), 2400);
          } else {
            transitionTo("area3", A3_SPAWN.x, A3_SPAWN.y);
          }
        } else if (sc === "area3" && inRect(worldPos.current.x, worldPos.current.y, A3_RETURN_OW)) {
          transitionTo("overworld", 170, 453);  // Jay's SW courtyard — walk east back into town
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_FARM_EXIT)) {
          transitionTo("farm", FARM_SPAWN.x, FARM_SPAWN.y);
          if (!farmVisited) setFarmVisited(true);
        } else if (sc === "farm" && inRect(worldPos.current.x, worldPos.current.y, FARM_RETURN_R2)) {
          transitionTo("route2", 165, 45);
        } else if (sc === "farm" && inRect(worldPos.current.x, worldPos.current.y, FARM_TOWN_EXIT)) {
          transitionTo("town", TOWN_FARM_SPAWN.x, TOWN_FARM_SPAWN.y);
        } else if (sc === "town" && inRect(worldPos.current.x, worldPos.current.y, TOWN_SOUTH_EXIT)) {
          transitionTo("farm", FARM_FROM_TOWN_SPAWN.x, FARM_FROM_TOWN_SPAWN.y);
        } else if (sc === "town" && inRect(worldPos.current.x, worldPos.current.y, TOWN_WEST_EXIT)) {
          transitionTo("town_left", TL_SPAWN.x, TL_SPAWN.y);
        } else if (sc === "town_left" && inRect(worldPos.current.x, worldPos.current.y, TL_EAST_EXIT)) {
          transitionTo("town", TOWN_FROM_LEFT.x, TOWN_FROM_LEFT.y);
        } else if (sc === "town" && inRect(worldPos.current.x, worldPos.current.y, TOWN_EAST_EXIT)) {
          transitionTo("town_right", TR_SPAWN.x, TR_SPAWN.y);
        } else if (sc === "town_right" && inRect(worldPos.current.x, worldPos.current.y, TR_WEST_EXIT)) {
          transitionTo("town", TOWN_FROM_RIGHT.x, TOWN_FROM_RIGHT.y);
        } else if (sc === "area3" && worldPos.current.x < 248 && phaseRef.current === "walk") {
          // Far-west closed door — Jerbs lands here from his portal the first time.
          // The portal plays out (no dialogue yet); the player then walks up to
          // Jerbs and taps to start the conversation.
          worldPos.current.x = 248;
          if (!cleminusMetRef.current && !jerbsAppearedRef.current) {
            jerbsAppearedRef.current = true;
            setJerbsAppeared(true);
            setPortalOpen(true);
            window.setTimeout(() => setPortalOpen(false), 1700);
          }
        }

        // Keep the resume point current, and throttle position saves while walking.
        // Skip if a door trigger just started a fade, so we never capture a spot
        // sitting on a transition trigger (which would re-fire on resume).
        if (!fadingRef.current) {
          lastSafeRef.current = { scene: sc, x: worldPos.current.x, y: worldPos.current.y };
          if (h) {
            saveTick++;
            if (saveTick % 30 === 0) persistWorldRef.current();
          }
        }

        // Flip / anim change
        if (newFlip !== flipRef.current) { flipRef.current = newFlip; lastSrc.current = ""; redraw(); }
        if (newAnim !== animRef.current) {
          animRef.current = newAnim; frameRef.current = 0; lastSrc.current = ""; redraw();
        }

        // Camera — world-space viewport accounts for zoom so more world is visible
        const vp   = vpRef.current;
        const vpW  = vp?.clientWidth  ?? 390;
        const vpH  = vp?.clientHeight ?? 520;
        const wvpW = vpW  / zoom; // world units visible horizontally
        const wvpH = vpH  / zoom; // world units visible vertically
        const px   = worldPos.current.x;
        const py   = worldPos.current.y;
        cam.current.x = Math.max(0, Math.min(px - wvpW / 2, world.w - wvpW));
        cam.current.y = Math.max(0, Math.min(py - wvpH / 2, world.h - wvpH));

        // Update DOM
        const wd     = worldRef.current;
        const canvas = canvasRef.current;
        const shadow = shadowRef.current;
        const spriteH = (canvas?.height && canvas.height > 0) ? canvas.height : SPRITE_PX;
        const spriteW = (canvas?.width  && canvas.width  > 0) ? canvas.width  : SPRITE_PX;
        const topOff = Math.round(spriteH * ANCHOR);
        if (wd)     wd.style.transform = `scale(${zoom}) translate(${-cam.current.x}px,${-cam.current.y}px)`;
        if (canvas) { canvas.style.left = `${px - spriteW/2}px`; canvas.style.top = `${py - topOff}px`; }
        if (shadow) { shadow.style.left = `${px - 18}px`;          shadow.style.top  = `${py + 2}px`; }

        // ── Wyvrunt follower (Pokémon-Yellow style trailing companion) ────────
        const followOn = wyvruntCaughtRef.current
          && (sc === "overworld" || sc === "route1" || sc === "route2" || sc === "area3");
        const fcv = wyvFollowRef.current;
        if (followOn && fcv) {
          const STEP = 26; // world-px spacing between breadcrumb trail points
          const bc   = breadcrumbsRef.current;
          const head = bc[0];
          if (!head || dist(head.x, head.y, px, py) >= STEP) {
            bc.unshift({ x: px, y: py });
            if (bc.length > 10) bc.pop();
          }
          const fp     = followPosRef.current;
          const target = bc[1] ?? { x: px, y: py };
          const fdx = target.x - fp.x, fdy = target.y - fp.y;
          const fd  = Math.hypot(fdx, fdy);
          if (fd > 1.2) {
            const step = Math.min(SPEED, fd);
            fp.x += (fdx / fd) * step;
            fp.y += (fdy / fd) * step;
            if (Math.abs(fdx) > Math.abs(fdy)) {
              followAnimRef.current = "walk_side";
              followFlipRef.current = fdx < 0;
              followLastDirRef.current = "idle_side";
            } else {
              followAnimRef.current = fdy < 0 ? "walk_up" : "walk_down";
              followFlipRef.current = false;
              followLastDirRef.current = fdy < 0 ? "idle_up" : "idle_down";
            }
          } else {
            followAnimRef.current = followLastDirRef.current;
          }
          const fh = (fcv.height && fcv.height > 0) ? fcv.height : SPRITE_PX;
          const fw = (fcv.width  && fcv.width  > 0) ? fcv.width  : SPRITE_PX;
          fcv.style.display = "block";
          fcv.style.left = `${fp.x - fw / 2}px`;
          fcv.style.top  = `${fp.y - Math.round(fh * ANCHOR)}px`;
        } else if (fcv) {
          fcv.style.display = "none";
        }

        // Near-prof check (lab only)
        if (sc === "lab") {
          const d = dist(px, py, PROF.x, PROF.y);
          const near = d < 120;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearProf(near);
          if (near) setInteractPos({ sx: screenX, sy: screenY });
          // Near-Rowan check (lab disciple; only when you aren't playing Rowan)
          if (rowanInLab) {
            const dr = dist(px, py, PROF.x + 130, PROF.y + 6);
            const nearR = dr < 110;
            setNearRowan(nearR);
            if (nearR) setRowanInteractPos({
              sx: (px - cam.current.x) * ZOOM,
              sy: (py - cam.current.y - topOff - 28) * ZOOM,
            });
          }
        }
        // Near-Maya + ambient NPC check (overworld only)
        if (sc === "overworld") {
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          const d = dist(px, py, MAYA_POS.x, MAYA_POS.y);
          setNearMaya(d < 90);
          if (d < 90) setMayaInteractPos({ sx: screenX, sy: screenY });
          const dtova = dist(px, py, TOVA_POS.x, TOVA_POS.y);
          setNearTova(dtova < 90);
          if (dtova < 90) setTovaInteractPos({ sx: screenX, sy: screenY });
          const dsenna = dist(px, py, SENNA_POS.x, SENNA_POS.y);
          setNearSenna(dsenna < 90);
          if (dsenna < 90) setSennaInteractPos({ sx: screenX, sy: screenY });
          const dcorvin = dist(px, py, CORVIN_POS.x, CORVIN_POS.y);
          setNearCorvin(dcorvin < 90);
          if (dcorvin < 90) setCorvinInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-Jay check (jay scene)
        if (sc === "jay") {
          const d = dist(px, py, JAY_POS.x, JAY_POS.y);
          const near = d < 120;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearJay(near);
          if (near) setJayInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-Ellio check (Ellio's home)
        if (sc === "ellio") {
          const d = dist(px, py, ELLIO_POS.x, ELLIO_POS.y);
          const near = d < 120;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearEllio(near);
          if (near) setEllioInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-Jess check (player home)
        if (sc === "home") {
          const d = dist(px, py, JESS_POS.x, JESS_POS.y);
          const near = d < 120;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearJess(near);
          if (near) setJessInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-shell check (maya home)
        if (sc === "maya") {
          const shellCx = (MAYA_SHELL[0] + MAYA_SHELL[2]) / 2;
          const shellCy = (MAYA_SHELL[1] + MAYA_SHELL[3]) / 2;
          const d = dist(px, py, shellCx, shellCy);
          const near = d < 80;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearShell(near);
          if (near) setShellInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-Lia check (Lia's home)
        if (sc === "lia") {
          const d = dist(px, py, LIA_POS.x, LIA_POS.y);
          const near = d < 120;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearLia(near);
          if (near) setLiaInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-Jay/Lia/Jerbs check (Area 3 — trainer battles + demo NPC)
        if (sc === "area3") {
          const djay  = dist(px, py, JAY_A3_POS.x, JAY_A3_POS.y);
          const dlia  = dist(px, py, LIA_A3_POS.x, LIA_A3_POS.y);
          const djerbs = dist(px, py, JERBS_POS.x, JERBS_POS.y);
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearJayA3(djay < 120);
          if (djay < 120) setJayA3InteractPos({ sx: screenX, sy: screenY });
          setNearLiaA3(dlia < 120);
          if (dlia < 120) setLiaA3InteractPos({ sx: screenX, sy: screenY });
          // Jerbs is approachable once he has landed (jerbsAppeared) or after meeting.
          const jerbs_near = (cleminusMetRef.current || jerbsAppearedRef.current) && djerbs < 110;
          setNearJerbs(jerbs_near);
          if (jerbs_near) setJerbsInteractPos({ sx: screenX, sy: screenY });
        }
        // Near-wife on south town path (overworld, while she's there)
        if (sc === "overworld" && wifeOnPathRef.current) {
          const d = dist(px, py, JESS_PATH_POS.x, JESS_PATH_POS.y);
          if (d < 70 && phaseRef.current === "walk" && !wifeInterceptedRef.current) {
            setPhase("jess_path_d1");
          }
        }
        // Route 2 — prof greeting on arrival + wyvrunt proximity
        if (sc === "route2") {
          const dp = dist(px, py, PROF_R2_POS.x, PROF_R2_POS.y);
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearProfR2(dp < 110);
          if (dp < 110) setProfR2InteractPos({ sx: screenX, sy: screenY });
          const dfarm = dist(px, py, FARMER_R2_POS.x, FARMER_R2_POS.y);
          setNearFarmerR2(dfarm < 95);
          if (dfarm < 95) setFarmerR2InteractPos({ sx: screenX, sy: screenY });
          // Auto-greet on first arrival
          if (!route2GreetedRef.current && phaseRef.current === "walk") {
            setRoute2Greeted(true);
            setPhase("prof2_d1");
          }
          if (profRoute2DoneRef.current && !wyvruntCaughtRef.current) {
            const dw = dist(px, py, WYV_R2_POS.x, WYV_R2_POS.y);
            setNearWyvrunt(dw < 90);
            if (dw < 55 && phaseRef.current === "walk") {
              setPhase("scripted_t1");
            }
          }
        }
        // Shore — Prof. Irwyn proximity
        if (sc === "shore") {
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          const dp = dist(px, py, PROF_SHORE_POS.x, PROF_SHORE_POS.y);
          const nearP = dp < 100;
          if (nearP !== nearProfShore) setNearProfShore(nearP);
          if (nearP) setProfShoreInteractPos({ sx: screenX, sy: screenY });
        }
        // Farm NPC proximity
        if (sc === "farm") {
          const screenX = (px - cam.current.x) * zoom;
          const screenY = (py - cam.current.y - topOff - 28) * zoom;
          const ds = dist(px, py, SHELLA_POS.x, SHELLA_POS.y);
          setNearShella(ds < 90);
          if (ds < 90) setShellaInteractPos({ sx: screenX, sy: screenY });
          const dr = dist(px, py, RUNRIK_POS.x, RUNRIK_POS.y);
          setNearRunrik(dr < 90);
          if (dr < 90) setRunrikInteractPos({ sx: screenX, sy: screenY });
          const dm = dist(px, py, MAREN_POS.x, MAREN_POS.y);
          setNearMaren(dm < 90);
          if (dm < 90) setMarenInteractPos({ sx: screenX, sy: screenY });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [redraw, transitionTo]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const advanceDialog = useCallback((from: Phase) => {
    const map: Partial<Record<Phase, Phase>> = {
      d1: "d2", d2: "pick", d3: "d4", d4: "d5", d5: "walk",
      maya_d1: "maya_d2", maya_d2: "maya_d3", maya_d3: "maya_d4", maya_d4: "walk",
      maya_post1: "maya_post2", maya_post2: "maya_post3", maya_post3: "walk",
      jay_d1: "jay_d2", jay_d2: "jay_d3", jay_d3: "jay_d4", jay_d4: "jay_d5", jay_d5: "walk",
      jay_done: "walk",
      jess_d1: "jess_d2", jess_d2: "jess_d3", jess_d3: "walk",
      ellio_d1: "ellio_d2", ellio_d2: "ellio_d3", ellio_d3: "walk",
      ellio_done: "walk",
      lia_d1: "lia_d2", lia_d2: "lia_d3", lia_d3: "lia_d4", lia_d4: "lia_d5", lia_d5: "walk",
      lia_done: "walk",
      jess_path_d1: "jess_path_d2", jess_path_d2: "walk",
      prof2_d1: "prof2_d2", prof2_d2: "prof2_d3", prof2_d3: "prof2_d4", prof2_d4: "walk",
      farm_d1: "farm_d2", farm_d2: "farm_d3", farm_d3: "farm_d4", farm_d4: "walk",
      farm_idle: "walk",
      // Primeria Farm NPCs
      shella_d1: "shella_d2", shella_d2: "shella_d3",
      shella_done: "walk", shella_idle: "walk",
      runrik_d1: "runrik_d2", runrik_d2: "runrik_d3", runrik_d3: "runrik_d4", runrik_d4: "walk",
      runrik_done: "walk", runrik_idle: "walk",
      maren_d1: "maren_d2", maren_d2: "walk",
      maren_done: "walk", maren_idle: "walk",
      // Tidemark Shore — Prof. Irwyn challenger battle
      prof_shore_d1: "prof_shore_d2", prof_shore_d2: "prof_shore_battle",
      prof_shore_win: "walk", prof_shore_lose: "walk",
      prof_shore_idle: "walk", prof_shore_done: "walk",
      scripted_t1: "scripted_t2", scripted_t2: "scripted_set",
      scripted_set: "scripted_caught", scripted_caught: "walk",
      // Ambient idle chats just close (no flags touched).
      prof_idle: "walk", jay_idle: "walk", maya_idle: "walk", maya_wait: "walk",
      ellio_idle: "walk", lia_idle: "walk", jess_idle: "walk",
      tova_d1: "tova_d2", tova_d2: "walk", tova_idle: "walk",
      senna_d1: "senna_d2", senna_d2: "walk", senna_idle: "walk",
      corvin_d1: "corvin_d2", corvin_d2: "walk", corvin_idle: "walk",
      // Rowan's three-line dream-of-becoming-professor chat.
      rowan_d1: "rowan_d2", rowan_d2: "rowan_d3", rowan_d3: "walk",
      // Area 3 Jay/Lia trainer battles.
      jay_a3_d1: "jay_a3_d2", jay_a3_d2: "jay_a3_d3", jay_a3_d3: "jay_a3_battle",
      jay_a3_win: "walk", jay_a3_lose: "walk", jay_a3_idle: "walk",
      lia_a3_d1: "lia_a3_d2", lia_a3_d2: "lia_a3_d3", lia_a3_d3: "lia_a3_battle",
      lia_a3_win: "walk", lia_a3_lose: "walk", lia_a3_idle: "walk",
      // Cleminus "Jerbs"
      jerbs_appear: "jerbs_d1",
      jerbs_d1: "jerbs_d2", jerbs_d2: "jerbs_d3",
      jerbs_d3: "jerbs_remind",    // default — JSX overrides to jerbs_cards when beatBoth
      jerbs_cards: "jerbs_d4",
      jerbs_d4: "jerbs_battle_intro",
      jerbs_battle_intro: "jerbs_battle_intro",
      jerbs_crystal_d1: "jerbs_crystal_d2",
      jerbs_crystal_d2: "jerbs_crystal_d3",
      jerbs_crystal_d3: "jerbs_gift",
      jerbs_stone_pick: "jerbs_stone_pick",
      jerbs_crystal_evo: "demo_end",
      jerbs_remind: "walk",
      jerbs_return_d1: "jerbs_return_d2",
      jerbs_return_d2: "jerbs_cards",
      jerbs_a3_idle: "walk",
      demo_end: "walk",
    };
    if (from === "shella_d3") { setShowShellPicker(true); return; }
    if (from === "runrik_d3") { setShowRunePicker(true); return; }
    if (from === "corvin_d2" && !corvinMet) { setCorvinMet(true); setPrimeriaCoin(c => c + 75); }
    const next = map[from];
    if (next) { playSfx("btn"); setPhase(next); }
  }, []);

  const pickStarter = useCallback(() => {
    if (!selected) return;
    const s = STARTERS.find(t => t.id === selected)!;
    setStarter(s);
    // Reset progression for the newly chosen starter
    setStarterLevel(5);
    setStarterXp(0);
    setStarterStats({ hp: 40, atk: 6, def: 4, spd: 5 });
    const el = asElement(s.type);
    setStarterMoves(el ? defaultActiveMoves(el, 5) : []); // L5 starter loadout from learnset
    setPhase("d3");
    setSelected(null);
  }, [selected]);

  // ── D-pad button ──────────────────────────────────────────────────────────
  const Btn = ({ d, label, small }: { d: string; label: string; small?: boolean }) => (
    <button
      onPointerDown={e => { e.preventDefault(); setHeld(d); }}
      onPointerUp={e   => { e.preventDefault(); setHeld(null); }}
      onPointerLeave={e => { e.preventDefault(); setHeld(null); }}
      style={{
        width: small ? 52 : 64, height: small ? 52 : 64,
        background: held === d ? "rgba(200,168,50,0.45)" : "rgba(10,10,10,0.7)",
        border: `2px solid ${held === d ? "#c8a840" : "rgba(255,255,255,0.18)"}`,
        borderRadius: 12,
        color: held === d ? "#f5d050" : "#bbb",
        fontSize: small ? 14 : 26,
        fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
        backdropFilter: "blur(8px)", cursor: "pointer",
        letterSpacing: small ? 0 : undefined,
      }}
    >{label}</button>
  );

  const { x: px, y: py } = worldPos.current;
  const topOff = Math.round(SPRITE_PX * ANCHOR);

  // ── Dialog lines (d3 is dynamic) ─────────────────────────────────────────
  const LINES: Record<Phase, string> = {
    walk: "",
    d1: characterId === "kinju"
      ? "Right on time — I had a feeling about today. Your resonance match finished two weeks ago; I've just been waiting for you to walk through that door. No ceremony needed. The horizon doesn't wait. Choose your first Tayanari."
      : characterId === "jess"
      ? "There you are. Something shifted the moment you walked in — every specimen in the room turned toward you. Your selection is ready. Let what you feel right now guide you; it's already talking to them. Choose your first Tayanari."
      : "Precisely on schedule. I've run the compatibility index twice. All three are strong options — the data takes you this far, and judgment takes you the rest. I trust yours. Choose your first Tayanari.",
    d2: characterId === "kinju"
      ? "A bond isn't instant. It grows through every shared mile, every fight, every moment where the only option was to trust each other. There is no wrong choice here — only the one that fits the direction you're already moving. Who is it going to be?"
      : characterId === "jess"
      ? "The bond you form today isn't decided — it's grown. Through presence, through time, through every moment you show up for each other. The Tayanari already feel what you carry. Trust that, and trust them. Who is it going to be?"
      : "Bonding operates on resonance convergence — your elemental signature meeting theirs. What the data consistently shows is that compatibility built through shared adversity outlasts any initial match score. The right long-term partner matters more than the right first impression. Who is it going to be?",
    pick: "",
    d3: starter ? `${starter.name}. Interesting — it moved toward you before I called it. That does not happen often. The bond has already begun. Treat them well.` : "",
    d4: "Route 1 — Whisperroot Trail — is through the north gate. That's where new Keepers go to form their first wild bonds. The Tayanari there are territorial but not hostile unless provoked; they respond to experienced handling, which means they will teach you how to handle them. That's the point of going. Head north when you're ready.",
    d5: "One thing before you go: the Tayanari on Whisperroot Trail are not the ones in picture books. They have their own hierarchies, moods, reasons. Your partner is new and still learning who you are. Don't push either of you past what the bond can hold yet. I'll meet you further along the route. Safe roads, Keeper.",
    maya_d1: "There you are — I was hoping you'd stop by before you left. I've had something set aside for a while now. My father's collection. I think today is finally the day I hand it over. ...I almost went myself, you know. Put my name in three times. He talked me out of every one. I thought I resented him for it. I don't, anymore.",
    maya_d2: "My father was a legendary Keeper. He spent his whole life out there, bonding with Tayanari no one else could reach. He'd come home with field notes so full he had to tape extra pages in. Last creature he ever bonded was on the high cliffs north of the ruins — he said it looked at him like it already knew his name. He passed last winter. I miss him every single day.",
    maya_d3: "Before he left us, he pressed his Weathered Realm Shells into my hands. Old things — you can feel the weight of every journey in them. He said: 'Give these to someone worthy, Maya. You'll know them when you see them.' I've been watching people leave for their Trials for months. I knew when I saw you.",
    maya_d4: "Please — go inside and take them. Realm Shells are how you bond wild Tayanari. Set one near a creature that interests you; if the bond is right, they'll enter on their own terms. My father's have been sitting long enough. Put them to use. And when you're out past the ruins — look up at the high cliffs for me. He used to say the view from the top changed everything.",
    jay_d1: "Finally — today's the day. You're walking into that lab and picking your first Tayanari. I've thought about this moment for months. I know exactly who I'm going for when it's my turn. You ready? Actually — doesn't matter. You're doing it either way.",
    jay_d2: "I've been training harder than you know. Every morning before you were awake. I'm not going out there to finish second. But if I'm honest — it's not really about that. I need to know what I'm actually made of out there, when everything is on the line and there's no safety net. I think you understand exactly what I mean.",
    jay_d3: "I'm glad it's you out there with me. Nobody else I'd want watching my back. And if we end up on opposite sides of a battle someday — and we will — know that I'll give you everything I've got. That's the only honest thing I can do. Stay sharp.",
    jay_d4: "I don't go into anything blind. While everyone else was sparring I was reading — Realm theory, bonding mechanics, rune taxonomy. Here's something they don't teach early enough: Runes are battle items. You carry them, and at the right moment you activate one mid-fight. A Healing Rune restores your partner's strength. An Obsidian variant hits harder and lasts longer. Most Keepers find their first one by accident. You won't have to.",
    jay_d5: "This is yours. An Obsidian Healing Rune — activates in the Items menu during battle. Your partner takes a hit that would finish things, you use this instead. One use, so time it right. I found two; I kept the other. Consider it an investment. I expect you to be harder to beat the next time we fight.",
    jess_d1: characterId === "jess"
      ? "Hey — you're already up. Good. I was about to come drag you out of bed. Irwyn's waiting, but go do the rounds first. Maya's been watching the gate since before dawn. Jay too, though he'd never admit it."
      : "Professor Irwyn sent word — he's ready for you whenever you are. But before you head to the lab, please stop and say a proper goodbye to everyone. Maya has been up since dawn. Jay has something for you — he'll act like it's nothing. And Lia and Ellio, when you're ready. They've all been thinking about today. Don't sneak past them.",
    jess_d2: characterId === "jess"
      ? "I know you've been turning this over for weeks. Stop. Your first Tayanari is going to be whoever it is, and you're going to make it work — because that's what you do. Go say hi to everyone. I'll catch up."
      : "This whole village watched you grow up. They love you. Half of them were probably at their windows last night just knowing today was the day. I was one of them. Couldn't sleep. Kept thinking — this is what we were all building toward without knowing it. Every person out there has something they want you to carry with you. Let them give it.",
    jess_d3: characterId === "jess"
      ? "And hey — I left something in your side pocket. Don't make a thing out of it. Just go. Come back with something worth telling."
      : "I packed your favorite bread in the outer pocket — you'll find it when you need it most. I love you. Now go. Come home with stories worth telling. And if a Tayanari ever looks at you the way Draco looks at Lia... let them in. That's what the Trial is really for. Just come home.",
    maya_post1: "You found them! Those Weathered Realm Shells have been sitting long enough. Here's what my father taught me — a Realm Shell is how a wild bond begins. Set one near a Tayanari you want to reach. If the resonance is right, they'll enter it on their own. The shell becomes their home — if they choose to accept.",
    maya_post2: "It's never guaranteed. A calm Tayanari might wander in out of pure curiosity. A hostile one might blunder in mid-charge and still bond. What matters is the shell being there — open, patient, ready. That's the Keeper's job: make the offer. The Tayanari decides.",
    maya_post3: "My father used to say: 'A shell is just a home, but a rune makes it a welcome.' Different shells carry different elemental energies, and you can socket a rune inside one to strengthen the draw. You've already been given one. Between the shells and the rune — you're better prepared than most first-timers ever are.",
    jay_done: "You're set. Now go find some wild ones — I'll be right behind you.",
    ellio_d1: "Glad you stopped by — I was hoping to catch you before you left. I'm Ellio. My path is the Merchants Collective — trade routes, supply margins, market gaps from here to the eastern coast. But every caravan I've worked, the thing people want most is creature-related: shells, runes, bonding aids. The whole world runs on Tayanari whether the merchants admit it or not. Which brings me to something I've been holding onto.",
    ellio_d2: "A Resonance Stone. I picked it up on a caravan last season — the merchants hauling it kept it wrapped in three layers of cloth and wouldn't explain why. I held it once, just to see. Something responded — like a sound just below the range of hearing, resonating specifically with whoever holds it. I'm not a Keeper. It wasn't calibrated for me. But I know what it means when something is looking for the right person.",
    ellio_d3: "What it does: in battle, you can use it from the Items menu on yourself — not on your Tayanari. When you do, it channels your bond's elemental energy and strikes the opponent directly. It reads your active partner's type and fires an attack tuned to that element. One use per fight. It's not subtle, but it doesn't need to be. Take it — it was never going to sit in a crate. It was looking for a Keeper.",
    ellio_done: "Safe roads. Come find me when you've got stories — I want to hear what the ruins look like from the inside.",
    lia_d1: "Oh, look — you finally made it to my door. Took long enough. Come in. Draco won't bite... probably. He always knows when someone worth meeting is at the threshold. I stopped questioning it years ago.",
    lia_d2: "That's Draco. Stone-Flame type. Stubborn, fierce, runs entirely on attitude and spite. I found him on my first Trial — threw a shell and he crushed it. Didn't bond, just destroyed it and left. He came back three days later and sat outside my tent. We've been together ever since. We understand each other completely.",
    lia_d3: "Strength alone isn't enough out there. My second year in the field I lost three bonding attempts in a row — went in too hard every time. I was treating it like a fight instead of an offer. An old Keeper named Serah on the eastern road told me about Hearthberries. Eat one before you try to bond a wild Tayanari — it reads as calm intent. Their guard drops. Not guaranteed, but it changes the odds significantly.",
    lia_d4: "Here. Ten of them. And this satchel — field-grade leather, enough compartments to actually carry your kit properly. A Keeper who can't access their items in the middle of a fight is just someone standing in a field with a creature that's angrier than they expected.",
    lia_d5: "Now get out. And don't lose to anything on Whisperroot Trail, alright? I will hear about it, and I will absolutely not let it go. Go do something worth reporting back.",
    lia_done: "Still here? Go. You know where I live if you need more berries.",
    jess_path_d1: "There you are! Professor Irwyn was looking for you — he said to meet him on Route 2, past Maya's, east of town. Wouldn't tell me why. Oh — and Old Hollis mentioned something this morning. Said he spotted a Wyvrunt near his north fence, half-frozen. Never seen one that far into town territory. Something's drawing them in closer. Just... be aware.",
    jess_path_d2: "Go on. I'll head home. ...Just be careful out there, alright? And if that Wyvrunt's still around — trust your instincts.",
    prof2_d1: "There you are. I felt you on the wind — or perhaps I simply heard your boots on the path. Either way: come closer. There is something I have been tracking for three weeks that I need you to see.",
    prof2_d2: "Chaos-aligned Tayanari don't follow the same behavioral patterns as the rest. Their elemental signature comes in wrong — the colors shift, the resonance frequency is unstable. Most researchers write them off as anomalies. Lia bonded with one years ago; Draco is the most remarkable creature I have ever documented, and she still won't let me run a full scan. This one is rarer still.",
    prof2_d3: "It descended from the high cliffs four nights ago and stopped exactly here. Has not moved. Has not hunted. Has not fled. I believe it has been waiting — specifically for you. A Tayanari that selects its Keeper before the bond attempt is rarer than anything in my journals. Here — take this. An Obsidianeye Realm Shell. I had it made for exactly this kind of moment.",
    prof2_d4: "Walk toward it slowly. I will watch from here. If I am right about what it is, it will not fight you — it will test you. The test is different from a fight. Stay calm. Trust what happens.",
    farm_d1: "Oh — hello there, Keeper. Don't mind me, I'm just sittin' out here watching the Tayanari play. Best show in the whole valley, and it don't cost a copper.",
    farm_d2: "I keep the farm up north, past the rise where the grass goes gold. Hard work, sure, but come dusk the little ones wander down into my fields. Good company, the lot of 'em.",
    farm_d3: "Funny thing, that Wyvrunt everyone's whispering about... I'm the one who first found it. Half-frozen by my north fence one winter, it was. Fed it scraps till it could fly again. Rare creature — glad it found its way to good hands.",
    farm_d4: "Say — you look like a Keeper who earns their keep. I've got more field berries than I can use before the season turns. Take some. Duskberry for healing, Thornberry for a sharp edge, Calmberry for a steady guard, Brightberry when your moves run dry. They'll serve you well out there.",
    farm_idle: "Fine day out here, ain't it? Whole town's been buzzing since Irwyn announced the Trial selection — haven't seen Primeria this alive in a long time. Good thing too. Come back anytime — the valley's always got something worth watching.",
    shella_d1: "Goodness — a visitor! Most folks pass right through the north gate without stopping. Come closer, I won't bite. Name's Shella. I run the shell workshop — forge Realm Shells out of crystalite shards and valley ore.",
    shella_d2: "My brother-in-law thinks it's too niche. 'Shella,' he says, 'nobody needs custom shells.' But then every Keeper who's bonded a rare Tayanari comes straight to me. Funny how that works.",
    shella_d3: "Actually — you look like a serious Keeper. I've got some premium-grade shells in stock right now. Battle Shells — reinforced for combat use. Give your lead Tayanari a real edge. Want to take a look?",
    shella_done: "Come back anytime — I've always got something new in the kiln.",
    shella_idle: "Busy season, but I always have time for a Keeper with a good eye.",
    runrik_d1: "Oi! You there — you're a Keeper, yeah? Good. Been hoping one of you would wander through. Name's Runrik. I work the rune forge over that hill — soul-script, bonding glyphs, the whole craft.",
    runrik_d2: "Now, I'm going to be honest with you — I've been sitting on some Battle Runes for weeks. Forged them fresh, carved the script myself. But Keepers around here don't take rune-work seriously. Think it's superstition.",
    runrik_d3: "It isn't. I'll prove it. Here — your first Battle Rune is on the house. Pick your effect, slot it before your next fight. You'll feel the difference. Go on.",
    runrik_d4: "There. Now you know. Come back when you want more — I don't give free samples to just anyone, mind you. You've got good energy. I can always tell.",
    runrik_done: "Back for more rune-work? Wise. The good ones always come back.",
    runrik_idle: "Carving's going well today. Clear sky always helps the script set right.",
    maren_d1: "Oh — hello! Are you looking for the Crucibyx? That's what everyone comes to the farm to see lately. Little Cruci's been here since hatching — found the egg in a runoff pool after a heavy rain. Alchemy type — only one I've ever seen up close.",
    maren_d2: "We've gotten attached, honestly. But a creature like that belongs with a Keeper. Go on — introduce yourself. I have a feeling it'll take to you just fine.",
    maren_done: "Take good care of little Cruci. Visit anytime — the farm's always open.",
    maren_idle: "Cruci's been in a good mood all morning. Whatever you did, keep doing it.",
    // ── Overworld ambient townspeople ─────────────────────────────────────────
    tova_d1: "You must be the one who received the Trial selection. I heard the lab bell before sunrise — couldn't sleep after that. This village hasn't felt this alive in years. Even the Tayanari near the market have been gathering closer to the walls lately. Something's shifting.",
    tova_d2: "Irwyn hasn't said why, but some of us have noticed — he's been out on the eastern path before dawn these past few mornings. That's not like him. He usually talks through everything he finds. Whatever he's watching out there... he's not ready to say. Just keep your eyes open.",
    tova_idle: "Safe travels, Keeper. Come back with stories — and come back whole.",
    senna_d1: "First time heading out through Route 1? I've been running goods through that gate for years. The Tayanari out there haven't been acting the same lately — more curious, less wary. Old Mena on the ridge says they're responding to something deep in the ruins. I don't know about all that. I just know the trail's busier than it's been in a long time.",
    senna_d2: "Watch the western edge of the trail — the ones that come from that direction move different. Not aggressive. Just... deliberate. Like they've already decided something about you. Anyway. You'll see. Good luck out there, Keeper.",
    senna_idle: "Still heading out there? Good sign. Means you're not running back in a hurry.",
    corvin_d1: "Ah! Perfect timing — a Keeper, and a fresh one at that. Name's Corvin. Traveling naturalist, Tayanari researcher, and occasional purveyor of useful things. I've just come back from the eastern ridge. The species patterns out there are extraordinary — totally different layering than the north routes. I documented twelve new behavior markers this season alone.",
    corvin_d2: "Here — take this. Field courtesy. Every naturalist I've met who shared their notes early ended up documenting something worth sharing. I figure the same principle applies to Keepers. Consider it a head start. Come find me if you catalogue something unusual out in the reaches. I'll be around.",
    corvin_idle: "The ruins east of here have the most consistent Tayanari congregation patterns I've ever recorded. Something in the geology, maybe. Or something older.",
    scripted_t1: "The Wyvrunt is completely still. Its tail-flame ripples in slow arcs but it doesn't move. The yin-yang sigils on its scales pulse — reading you. PROF: \"Don't move yet. Let it finish its read.\"",
    scripted_t2: "Something in its posture shifts — the tension releasing by degrees, curiosity replacing caution. The sigils brighten. It has made a decision. PROF: \"Now. The shell. Set it down. It's ready.\"",
    scripted_set: "You place the Obsidianeye Realm Shell open on the ground before it. The Wyvrunt tilts its head — considers — and doesn't move away.",
    scripted_caught: "The shell hums. A slow, deep resonance that you feel more than hear. It drinks the light around it, and seals. Wyvrunt ☯ chose you. PROF: \"...Remarkable. First attempt. I have never seen that before.\"",
    // The lab role-pick uses a custom modal, not this dialog strip.
    role_pick: "",
    // ── Ambient idle chats (always available; set no flags) ──────────────────
    prof_idle: "Sit a moment if you have one. I've been reviewing bonding resonance data from last season and something doesn't add up. Tayanari adapting faster than any model predicts — not just behaviorally, but in elemental expression. Something in the world is accelerating. Mind your partner out there, and come tell me what you observe. Every bond that forms out there teaches me something my instruments can't.",
    prof_shells: "Back already? Good — the lab keeps a steady store of Realm Shells for exactly this. Bonding takes patience, and patience takes preparation. Take what you need, and come back whenever you run low.",
    prof_shells_got: "There — ten fresh Realm Shells. Set them when the moment is right; the wilds are patient, and a Keeper should be too. Off you go.",
    jay_idle: "Don't get comfortable. I'm already plotting my route and I am NOT losing to you. ...Actually — Lia's the one who first told me about rune slots. She'd never admit she taught me anything, but she did. Watch your back out there. Can't beat you if something else gets to you first.",
    maya_wait: "Did you find them yet? My father's Weathered Realm Shells — they're on the rug, just inside. I meant to hand them to you at the door, but I set them down when I came in and didn't want to pick them back up. Go on in and grab them off the rug. He'd want them in real hands.",
    maya_idle: "Out chasing bonds already? I've started my own field notes, actually — just small things from the fence line. A Tayanari came close enough to touch last week. I stood still for twenty minutes and it didn't leave. I think I'm beginning to understand what he saw out there. Go make him proud.",
    ellio_idle: "Back already? I've been mapping my first solo route — north past the ruins, east along the ridge, waystation at the Collective's outpost. Old Hollis trades with half our suppliers up here — salt, grain, creature feed from across the valley. Man knows every Keeper who's ever passed through. Good person to know. Come find me when you've got stories — I want to know what the ruins look like from the inside.",
    lia_idle: "You again. Draco hasn't tried to singe you yet — consider that high praise. Berries are in the basket. ...I'll tell you something: Irwyn's been out on the eastern path before sunrise three mornings running. I asked him about it twice. Both times he changed the subject. That's when I started paying attention. Keep your eyes open out there. Now stop loitering. Go be impressive.",
    jess_idle: "There you are. Don't mind me — I just like seeing your face. One of the wild Tayanari from the east meadow has been coming to the garden. Small thing, storm-type. Keeps stealing hearthberries. I haven't shooed it off yet. I think it's lonely. ...Come home soon, alright?",
    // ── Rowan — the professor's disciple, dreaming of the Professor's seat ────
    rowan_d1: "Oh — hey. You're the one starting the Trial today, right? I'm Rowan — Professor Irwyn's disciple. I log the specimens, cross-reference field reports, sweep the floors when the specimens make a mess. I've read every journal in this lab at least twice. Last week I found a notation from thirty years ago that doesn't match anything in current taxonomy. I've been losing sleep over it.",
    rowan_d2: "Everyone coming through here wants to be a Keeper. Not me. I want this — the lab, the field notes, the whole maddening question of how and why Tayanari bond the way they do. I have seventeen competing theories and they all break down at the same point. That's the part I can't let go of.",
    rowan_d3: "Do me a favor out there: if you run into a Tayanari that doesn't match the type chart, or bonds in a way that the numbers shouldn't allow — remember it. Note the conditions. Anything that breaks the model. One day I'll be the one handing a new Keeper their first partner, and I want to have actually earned that seat. Come back and tell me what you find.",
    // ── Area 3 — Jay trainer battle (4-tier, repeatable) ──────────────────
    jay_a3_d1: "You made it. Good. I've been out here every day since we left Primeria — first hour in these ruins I had two encounters I barely walked out of. The Tayanari here aren't like the ones on Route 1. They've been at it longer. They don't probe, they commit. I needed that, and I can see from your team that you've been getting it too.",
    jay_a3_d2: "I've been waiting for someone who can actually read a battle — not just react to it. Here's the rule: no holding back. Not out of courtesy, not out of strategy. Everything. If you're not ready to give that, say so now. But I don't think that's the case. I think we've both been ready for a while.",
    jay_a3_d3: "Then let's go. Show me what these ruins have made of you.",
    jay_a3_battle: "",
    jay_a3_win: "You beat me. I felt the moment it turned — I made the wrong read and you punished it exactly right. I'm not going to pretend that didn't sting. But that's precisely why I came out here: you can't find what you're made of without someone testing it properly. I'll be harder the next time. Come find me.",
    jay_a3_lose: "Not there yet. And that's fine — means there's still distance to cover, and distance is what this is for. The fact that you made it out here and took the fight at all means something. Come back when you've pushed your team further. I'll be right here, and I'll be ready.",
    jay_a3_idle: "I've been cataloging the Tayanari in these ruins — type distributions, territorial overlap, behavioral patterns that don't match anything in the field guides. Someone needs to write the new chapter on this place. Might as well start now. How's your team holding up in here?",
    // ── Area 3 — Lia trainer battle (4-tier, repeatable) ──────────────────
    lia_a3_d1: "Here already? I'll be honest — I didn't expect you this soon. Draco's been restless since we arrived. The Tayanari in these ruins are a different quality from Route 1 — older, sharper, like they've been in more fights than anything out there. Draco's been picking battles he doesn't finish. That means he's building toward something. So am I.",
    lia_a3_d2: "This place used to be something significant — you can feel it in the stone. Old battles, old bonds, whatever force these ruins still carry. Draco's been quiet since we got here. The quiet version of him is the version that worries me. It means he's completely focused. It means he's been ready since we arrived.",
    lia_a3_d3: "Enough. Draco's been patient long enough, and so have I. Can you handle what we've become out here?",
    lia_a3_battle: "",
    lia_a3_win: "That was a real fight. Draco doesn't give that look to just anyone — the one that says he's already looking forward to next time. I haven't felt that in a long while. You pushed us somewhere we needed to go. Come back when you're ready for more. We're not going anywhere.",
    lia_a3_lose: "That's the gap — not in heart, in the read. You're making the right moves at the wrong moments. Come back when you've worked out the timing. Draco and I have no intention of going soft while you do.",
    lia_a3_idle: "Draco started sleeping outside — won't come in even when it rains. I've stopped asking him to. He's telling me something about this place that I don't have words for yet. Something in the stone here is still active. How's your team reading it?",
    // ── Cleminus "Jerbs" — clandestine jerbeen, far-west ruin corridor ─────
    jerbs_appear: "W H O A. That was — that was SOMETHING. The third corridor is always the strangest. Note to self: do not take the third corridor. ...Oh. OH. There's someone here.",
    jerbs_d1: "A Keeper. An ACTUAL Keeper — I can feel the resonance from here. It's like a bell someone rang right in the middle of my chest. Come here — come HERE — don't just stand there at the edge looking alarmed!",
    jerbs_d2: "Cleminus. Jerbeen. Traveler, by habit. Elder, by — well. We'll get there. Most call me Jerbs. I have crossed fourteen realms, two collapsed timelines, and a mountain range that does not appear on any map I have ever read. I followed a resonance trail here — a very specific one. I do not normally arrive directly in front of strangers. I usually land somewhere quieter.",
    jerbs_d3: "I have been looking for you. Specifically you — the trail led to these ruins and the trail does not lie. But I'm reading the local resonance right now, and there are two Keepers nearby whose battles haven't resolved yet. Jay and Lia. The resonance around them is still open. Have you faced them both?",
    jerbs_cards: "",
    jerbs_d4: "Good. Then it is time. These are your credentials — official documents, properly signed. The Keeper Trial Card marks you as a licensed Keeper in the Trial system. The Elder Trial Card is different; you are not ready to understand what it means yet. But you will be, and soon. More is coming, Keeper. So. Much. More.",
    jerbs_remind: "Then go find them. Both of them — Jay is west of the main corridor, Lia further east into the ruins. Battle them properly; they deserve your full attention, and so does the fight. When you have, come back to this exact spot. I will be right here. I am very, very good at waiting. I have been alive for... quite a long while.",
    jerbs_return_d1: "There you are — I told you I'd wait. I spent the time cataloging the ruin acoustics, which I recommend: this stone hums at two distinct frequencies simultaneously, which should not be physically possible and yet here we are. But more importantly — you found Jay and Lia. I felt the moment those battles resolved. The resonance settled, like a chord that had been unfinished finally closing. Are you ready?",
    jerbs_return_d2: "Good. Then it is time. Here — your Keeper Trial Card and your Elder Trial Card. The second one opens doors that don't exist yet. Keep it somewhere safe. More is coming, Keeper — more than you can currently picture. Keep walking.",
    jerbs_a3_idle: "The ruins talk, if you sit with them long enough. I've been sitting with them for a very long time. Some days I think they're almost ready to say something new. Today feels like one of those days.",
    jerbs_battle_intro: "Before you go, Keeper — one more thing. I need to see this resonance in action. One match. Fair. My partner is very small, very new, and absolutely not afraid of anything. Shall we?",
    jerbs_crystal_d1: "...Hm. Even better than I expected. That's good. Alright — I owe you a story. That small one — I call her Crystalfang. Found her three months ago inside a collapsed glacier rift between two realms, curled around a sealed stone, completely unfazed by the cold. I thought she was a ruin artifact. Then she bit me.",
    jerbs_crystal_d2: "Inside the rift were three stones — ancient catalysts. They shape what a Tayanari grows into, based on elemental affinity. I carried all three. I've been waiting to give them to the right Keeper. Someone the resonance would trust. That's you. Crystalfang is yours now.",
    jerbs_crystal_d3: "The Glacial Stone calls forward Glacia — Frostformed, precise and proud. The Earthfire Stone calls Volcia — Volcanic, raw and rooted. The Faestone calls Faelia — Spirit-touched, strange and bright. All three are yours. When you're ready, open your bag and use one on Crystalfang. She'll wait. There will be more of her kind. The world gets bigger.",
    jerbs_gift: "",
    jerbs_stone_pick: "",
    jerbs_crystal_evo: "",
    demo_end: "",
    prof_shore_d1: "Ah — a Keeper who made it to Tidemark Shore. The waves here test the spirit. I've been waiting for someone worth challenging.",
    prof_shore_d2: `Before we begin, take ${SHORE_COIN_GIFT} PrimeriaCoin. Win or lose — it's yours. Consider it funding for your journey. Now, shall we?`,
    prof_shore_battle: "",
    prof_shore_win: "Well done. Very well done. Your Tayanari fight with real conviction.",
    prof_shore_lose: "A fine battle. The shore will humble you — that's its gift. Come back whenever you're ready to try again.",
    prof_shore_idle: "The tide turns on its own schedule. Challenge me whenever the moment feels right.",
    prof_shore_done: "You've proven yourself here. The sea beyond these cliffs holds deeper mysteries still — keep exploring.",
  };

  // ── Encounter handlers & disturbance tick ──────────────────────────────────
  const hotspotCdRef     = useRef<Record<number, number>>({});
  const activeDistRef    = useRef<Record<number, { mon: MonSpec; expiresAt: number }>>({});
  const checksStreakRef  = useRef(0);
  useEffect(() => { hotspotCdRef.current   = hotspotCd; },          [hotspotCd]);
  useEffect(() => { activeDistRef.current  = activeDisturbances; }, [activeDisturbances]);
  useEffect(() => { checksStreakRef.current = checksStreak; },      [checksStreak]);

  useEffect(() => {
    const isR2Active = scene === "route2" && wyvruntCaughtRef.current;
    if (scene !== "route1" && scene !== "area3" && !isR2Active) return;
    setActiveDisturbances({});
    const hotspots = scene === "area3" ? A3_HOTSPOTS : scene === "route2" ? R2_HOTSPOTS : R1_HOTSPOTS;
    const id = window.setInterval(() => {
      const now = Date.now();
      const cur = activeDistRef.current;
      const cd  = hotspotCdRef.current;
      const nextActive: typeof cur = {};
      const newCds: Record<number, number> = {};
      for (const [k, d] of Object.entries(cur)) {
        if (d.expiresAt > now) nextActive[Number(k)] = d;
        else newCds[Number(k)] = now + 12000;
      }
      const free = hotspots.map((_, i) => i)
        .filter(i => !(i in nextActive) && (!cd[i] || cd[i] <= now) && !(i in newCds));
      if (Object.keys(nextActive).length < 4 && free.length > 0 && Math.random() < 0.75) {
        const idx = free[Math.floor(Math.random() * free.length)];
        const rarity = rollRarity(checksStreakRef.current);
        nextActive[idx] = { mon: pickMonForScene(rarity, scene), expiresAt: now + 30000 };
      }
      setActiveDisturbances(nextActive);
      setHotspotCd(prev => {
        const out: typeof prev = { ...newCds };
        for (const [k, t] of Object.entries(prev)) {
          if (t > now && !(Number(k) in out)) out[Number(k)] = t;
        }
        return out;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [scene, wyvruntCaught]);

  const handleHotspotClick = useCallback((idx: number, h: Hotspot) => {
    if (phase !== "walk") return;
    const now = Date.now();
    // Enforce cooldown — visual fade already shows it but block the click too
    if ((hotspotCdRef.current[idx] ?? 0) > now) return;
    const dist = activeDistRef.current[idx];
    // Reject expired disturbances (could linger briefly between ticks or after returning from battle)
    if (dist && dist.expiresAt <= now) {
      setHotspotCd(prev => ({ ...prev, [idx]: now + 4000 }));
      return;
    }
    if (dist) {
      setActiveDisturbances(prev => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      setHotspotCd(prev => ({ ...prev, [idx]: Date.now() + 12000 }));
      setWildEncounter(dist.mon);
      wildEncounterLevelRef.current = wildLevelForScene(dist.mon.rarity, scene);
      if (dist.mon.rarity === "ultra" || dist.mon.rarity === "apex") setChecksStreak(0);
      // Encounter flourish — element-tinted radial burst before the fade-to-battle
      const distEl = asElement(dist.mon.type);
      const flashCol = distEl ? ELEMENT_COLOR[distEl] : RARITY_COLOR[dist.mon.rarity];
      setEncounterFlash({ color: flashCol, key: Date.now() });
      window.setTimeout(() => setEncounterFlash(null), 650);
      setBattleNotif({ title: `Wild ${dist.mon.name} appears!`, sub: dist.mon.rarity.toUpperCase() });
      window.setTimeout(() => setBattleNotif(null), 1600);
      // Preserve current world position so we return to where we triggered
      const savedX = worldPos.current.x;
      const savedY = worldPos.current.y;
      transitionTo("battle", savedX, savedY);
    } else {
      const flavor = FLAVOR_TRACKS[Math.floor(Math.random() * FLAVOR_TRACKS.length)];
      const screenX = (h.x - cam.current.x) * ZOOM;
      const screenY = (h.y - cam.current.y) * ZOOM;
      setFloatMsg({ x: screenX, y: screenY, text: flavor, key: Date.now() });
      setHotspotCd(prev => ({ ...prev, [idx]: Date.now() + 4000 }));
      setChecksStreak(s => s + 1);
      window.setTimeout(() => setFloatMsg(null), 2500);
    }
  }, [phase, transitionTo]);

  // ── Shared XP / level-up helper used by both wild and trainer battle ends ──
  function calcBattleXp(rawXp: number, xpMult: number, baseLevel: number, baseXp: number, baseMoves: string[]) {
    const xpGained = rawXp > 0 ? Math.round(rawXp * xpMult) : 0;
    let newLevel  = baseLevel;
    let newXp     = baseXp + xpGained;
    let levelUps  = 0;
    let threshold = newLevel * 10 + 10;
    const isAureyvantNow = wyvruntCaught && wyvruntForm >= 3;
    const maxLevel = isAureyvantNow ? Infinity : (wyvruntCaught && wyvruntForm < 3) ? 30 : 25;
    const totalGains: Partial<Record<StatKey, number>> = {};
    const newMoves: string[] = [];
    let workingMoves = [...baseMoves];
    while (newXp >= threshold && newLevel < maxLevel) {
      newXp    -= threshold;
      newLevel += 1;
      levelUps += 1;
      const g = rollLevelUpGains();
      for (const k of Object.keys(g) as StatKey[]) totalGains[k] = (totalGains[k] ?? 0) + (g[k] ?? 0);
      const lvEl = asElement(starter?.type ?? "");
      if (lvEl) {
        for (const id of movesLearnedAt(lvEl, newLevel)) {
          newMoves.push(moveName(id));
          if (workingMoves.length < 4 && !workingMoves.includes(id)) workingMoves.push(id);
        }
      }
      threshold = newLevel * 10 + 10;
    }
    return { xpGained, newLevel, newXp, levelUps, totalGains, newMoves, workingMoves };
  }

  // ── Apply level-up state (shared by both handlers) ──────────────────────
  function applyLevelUp(r: ReturnType<typeof calcBattleXp>) {
    if (r.xpGained > 0) {
      setStarterXp(r.newXp);
      if (r.levelUps > 0) {
        playSfx("level_up");
        setStarterLevel(r.newLevel);
        setStarterStats(s => ({
          hp:  s.hp  + (r.totalGains.hp  ?? 0),
          atk: s.atk + (r.totalGains.atk ?? 0),
          def: s.def + (r.totalGains.def ?? 0),
          spd: s.spd + (r.totalGains.spd ?? 0),
        }));
        if (r.newMoves.length > 0) setStarterMoves(r.workingMoves);
      }
    }
  }

  // ── Wyvrunt form check (shared) ──────────────────────────────────────────
  function checkWyvForms(newLevel: number, loyaltyAfter: number) {
    if (!wyvruntCaught) return;
    let newForm = wyvruntForm;
    if (newForm === 0 && newLevel >= 18) newForm = 1;
    if (newForm === 1 && newLevel >= 30) newForm = 2;
    if (newForm === 2 && loyaltyAfter >= 80) newForm = 3;
    if (newForm !== wyvruntForm) {
      setWyvruntForm(newForm);
      setCaughtParty(prev => prev.map(m =>
        (["wyvrunt","wyrnak","wyrvast","aureyvant"] as string[]).includes(m.id)
          ? { ...WYV_FORMS[newForm]!, level: m.level, xp: m.xp }
          : m
      ));
    }
  }

  // The Wyvrunt evolves on ITS OWN (post-battle) level, not the starter's.
  // Mirrors the XP award above: if it joined the fight, apply the same XP.
  function wyvLevelAfter(parts: number[], xpGained: number): number {
    const cur = caughtPartyRef.current;
    const i = cur.findIndex(m => (["wyvrunt","wyrnak","wyrvast","aureyvant"] as string[]).includes(m.id));
    if (i < 0) return 0;
    return (xpGained > 0 && parts.includes(i + 1)) ? levelUpCaughtMon(cur[i], xpGained).level : cur[i].level;
  }

  // ── Caught-mon evo (cerepup, sprigget, ashcrawl, finwing, driftpaw; mentyke is starter-only) ────
  function checkCaughtMonEvos(parts: number[], xpGained: number) {
    if (xpGained <= 0) return;
    const cur = caughtPartyRef.current;
    const CAUGHT_EVO_IDS = [
      "cerepup",    "cerepup_2",
      "sprigget",   "sprigget_2",
      "ashcrawl",   "ashcrawl_2",
      "finwing",    "finwing_2",
      "driftpaw_f", "driftpaw_m", "driftpaw_2",
      "pebkin", "mudtot", "thornwraith",
      // Route 1 commons
      "hatchick", "fledgral",
      "loth",     "blomath",
      "voltowl",  "strikorn",
      "fluttril", "windriel",
      // Route 1 uncommons
      "stonub",     "ignaub",
      "potent",     "brewant",
      "scavencrow", "havencrow",
      "cindersnap", "emberclaw",
      "shimroot",   "glowroot",
      // Route 1 rares
      "ghosti", "scalel",
      // Route 2 commons
      "mossback",  "fernback",
      "sparwing",  "swiftwing",
      "thornpup",  "thornhound",
      "frostpup",  "frosthound",
      // Route 2 uncommons
      "frogling",  "frogmar",
      "duskrat",   "duskfang",
      "marshclaw", "tidalclaw",
      "cragnite",  "cragmite",
      "bleater",   "rammid",
      // Route 2 rares
      "emberwyvlet", "crysthorn", "thornalisk", "lumifang",
      // Shore evo lines
      "tidescale", "coralcoil",
      "lumecolt",  "solhoof",
      "gryfling",  "gryphex",
      "cindrakin", "pyrion",
      "shaderow",  "voidrook",
      "shellcrag", "shellvast",
      "chaoryn", "galefledge", "misthorn",
    ];
    const evoMap = new Map<number, StarterSpec>();
    cur.forEach((m, i) => {
      if (!parts.includes(i + 1)) return;
      if (!CAUGHT_EVO_IDS.includes(m.id)) return;
      const leveled = levelUpCaughtMon(m, xpGained);
      const entry = EVO_TABLE.find(e => e.from === m.id && leveled.level >= e.atLevel && m.level < e.atLevel);
      if (entry) evoMap.set(i, entry.to);
    });
    if (evoMap.size === 0) return;
    setCaughtParty(prev => prev.map((m, i) => {
      const evo = evoMap.get(i);
      return evo ? { ...m, id: evo.id, name: evo.name, type: evo.type, color: evo.color, img: evo.img, wildImg: evo.img, playerImg: evo.img } : m;
    }));
    const names = [...evoMap.values()].map(e => e.name).join(" & ");
    window.setTimeout(() => setBattleNotif({ title: `✦ ${names}!`, sub: "Your Tayanari evolved!" }), 1600);
  }

  // ── Starter evo check ────────────────────────────────────────────────────
  function checkStarterEvo(newLevel: number): StarterSpec | null {
    if (!starter) return null;
    for (const evolvesAt of [18, 30]) {
      if (evolvesAt > starterLevel && evolvesAt <= newLevel) {
        const found = evoAt(starter.id, evolvesAt);
        if (found) return found;
      }
    }
    return null;
  }

  const handleBattleEnd = useCallback((result: BattleResult) => {
    const returnX = worldPos.current.x;
    const returnY = worldPos.current.y;
    const returnScene = lastSafeRef.current.scene;

    // Shell recovery
    const thrown    = result.shellsSet;
    const lostBond  = result.kind === "caught" ? Math.min(1, thrown) : 0;
    const recovered = Math.max(0, thrown - lostBond);
    if (recovered > 0) setShellCount(c => c + recovered);

    const rawXp = (result.kind === "caught" || result.kind === "ko") ? result.xpGained : 0;
    const runeXpMult = slottedBattleRuneId === "xp_boost" ? 1.5 : 1;
    const r = calcBattleXp(rawXp, role.xpMult * runeXpMult, starterLevel, starterXp, starterMoves);
    applyLevelUp(r);

    // Award the same XP to every caught companion that joined the fight.
    // participant 0 is the starter (handled above); idx>0 → caughtParty[idx-1].
    // EXP Share — every caught companion earns the same XP as the lead
    const allIdxs = [0, ...caughtPartyRef.current.map((_, idx) => idx + 1)];
    if (r.xpGained > 0 && caughtPartyRef.current.length > 0) {
      setCaughtParty(prev => prev.map(m => levelUpCaughtMon(m, r.xpGained)));
      checkCaughtMonEvos(allIdxs, r.xpGained);
    }

    // Loyalty gains (+3 win, +2 catch) — still tracks actual participants
    const parts = ("participants" in result && result.participants) ? result.participants : [0];
    const loyaltyDelta = result.kind === "ko" ? 3 : result.kind === "caught" ? 2 : 0;
    if (loyaltyDelta > 0) setWyrLoyalty(l => Math.min(100, l + loyaltyDelta));
    const loyaltyAfter = Math.min(100, wyrLoyalty + loyaltyDelta);
    checkWyvForms(wyvLevelAfter(allIdxs, r.xpGained), loyaltyAfter);
    void parts;
    if (loyaltyDelta > 0 && wyvruntCaught) {
      const isAwakening = wyrLoyalty < 80 && loyaltyAfter >= 80;
      const loyaltyMsg = isAwakening
        ? { title: "☯ Bond Awakened", sub: "Your Wyvrunt's true form stirs…" }
        : loyaltyAfter >= 60
          ? { title: "☯ Bond deepens", sub: `${loyaltyAfter}/100 — the resonance grows stronger` }
          : { title: "☯ Bond grows", sub: `${loyaltyAfter}/100 — your Wyvrunt feels it` };
      window.setTimeout(() => { setBattleNotif(loyaltyMsg); window.setTimeout(() => setBattleNotif(null), 2600); }, 3100);
    }

    const evoTarget = checkStarterEvo(r.newLevel);

    // Jingles
    if (result.kind === "caught") playJingle(CATCH_JINGLE);
    else if (result.kind === "ko") playJingle(WIN_JINGLE);

    let outcome: string;
    if (result.kind === "caught") {
      const dest = addCaughtMon(result.mon, false, wildEncounterLevelRef.current);
      if (dest === "full") {
        setBattleNotif({ title: `${result.mon.name} couldn't be stored!`, sub: `Party & Storage Box both full (${STORAGE_CAP})` });
        outcome = `${result.mon.name} bonded with you, but your party and Storage Box are both full — it returned to the wild.`;
      } else if (dest === "box") {
        setBattleNotif({ title: `Bond formed — ${result.mon.name}!`, sub: "Party full · sent to Storage Box" });
        outcome = `${result.mon.name} bonded with you, but your party was full — it was sent to the Storage Box.`;
      } else {
        setBattleNotif({ title: `Bond formed — ${result.mon.name}!`, sub: "Joined your party · full heal" });
        outcome = `${result.mon.name} bonded with you and joined the party!`;
      }
      setChecksStreak(0);
    } else if (result.kind === "ko") {
      setBattleNotif({ title: `${result.mon.name} fainted!`, sub: `+${r.xpGained} XP` });
      outcome = `${result.mon.name} fainted in the clash.`;
    } else if (result.kind === "fled") {
      setBattleNotif({ title: "Got away safely.", sub: "" });
      outcome = "You slipped back into the trail brush.";
    } else {
      setBattleNotif({ title: `Your ${starter?.name ?? "Tayanari"} fainted!`, sub: healingRuneEquipped ? "Rune revived (50%) — back to trail" : "Limp back to the trail…" });
      setChecksStreak(0);
      outcome = `${starter?.name ?? "Your Tayanari"} fell. You retreat to recover.`;
    }
    setWildEncounter(null);
    window.setTimeout(() => setBattleNotif(null), 2800);
    transitionTo(returnScene, returnX, returnY);

    const reportData = {
      outcome, xpGained: r.xpGained, recovered, lostToBond: lostBond,
      levelUps: r.levelUps, newLevel: r.newLevel, statGains: r.totalGains, newMoves: r.newMoves,
      companionCount: r.xpGained > 0 ? caughtPartyRef.current.length : 0,
    };
    const evo = evoTarget;
    if (evo && (thrown > 0 || r.xpGained > 0)) {
      pendingEvoDataRef.current = reportData;
      window.setTimeout(() => setPendingEvo(evo), 1000);
    } else if (thrown > 0 || r.xpGained > 0) {
      window.setTimeout(() => setBattleReport(reportData), 1200);
    }
  }, [transitionTo, starter, healingRuneEquipped, starterLevel, starterXp, starterMoves, addCaughtMon, role, wyvruntCaught, wyvruntForm, wyrLoyalty]);

  const handleTrainerEnd = useCallback((result: BattleResult) => {
    const returnX = worldPos.current.x;
    const returnY = worldPos.current.y;
    const enc = trainerEncounter;
    if (!enc) return;

    const thrown    = result.shellsSet;
    if (thrown > 0) setShellCount(c => c + thrown); // shells can't bond trainer mons, all recover

    const rawXp = result.kind === "trainerWin" ? result.xpGained : 0;
    const r = calcBattleXp(rawXp, role.xpMult, starterLevel, starterXp, starterMoves);
    applyLevelUp(r);

    // EXP Share — every caught companion earns the same XP as the lead
    const allIdxs = [0, ...caughtPartyRef.current.map((_, idx) => idx + 1)];
    if (r.xpGained > 0 && caughtPartyRef.current.length > 0) {
      setCaughtParty(prev => prev.map(m => levelUpCaughtMon(m, r.xpGained)));
      checkCaughtMonEvos(allIdxs, r.xpGained);
    }

    // Loyalty +3 trainer win
    const loyaltyDelta = result.kind === "trainerWin" ? 3 : 0;
    if (loyaltyDelta > 0) setWyrLoyalty(l => Math.min(100, l + loyaltyDelta));
    const loyaltyAfter = Math.min(100, wyrLoyalty + loyaltyDelta);
    checkWyvForms(wyvLevelAfter(allIdxs, r.xpGained), loyaltyAfter);
    if (loyaltyDelta > 0 && wyvruntCaught) {
      const isAwakening = wyrLoyalty < 80 && loyaltyAfter >= 80;
      const loyaltyMsg = isAwakening
        ? { title: "☯ Bond Awakened", sub: "Your Wyvrunt's true form stirs…" }
        : loyaltyAfter >= 60
          ? { title: "☯ Bond deepens", sub: `${loyaltyAfter}/100 — the resonance grows stronger` }
          : { title: "☯ Bond grows", sub: `${loyaltyAfter}/100 — your Wyvrunt feels it` };
      window.setTimeout(() => { setBattleNotif(loyaltyMsg); window.setTimeout(() => setBattleNotif(null), 2600); }, 3100);
    }

    const evoTarget = checkStarterEvo(r.newLevel);

    if (result.kind === "trainerWin") playJingle(WIN_JINGLE);

    if (result.kind === "trainerWin") {
      if (enc.trainer === "jay") setJayA3Wins(w => Math.min(3, w + 1));
      else if (enc.trainer === "lia") setLiaA3Wins(w => Math.min(3, w + 1));
      else if (enc.trainer === "jerbs") setJerbsBattleDone(true);
      else if (enc.trainer === "prof") {
        setProfShoreWins(w => w + 1);
        // Gift: resonance_fill rune on first shore win
        setOwnedBattleRuneIds(ids => ids.includes("resonance_fill") ? ids : [...ids, "resonance_fill"]);
      }
      setBattleNotif({ title: `You beat ${enc.name}!`, sub: `+${r.xpGained} XP` });
      setPhase(enc.trainer === "jay" ? "jay_a3_win" : enc.trainer === "lia" ? "lia_a3_win" : enc.trainer === "prof" ? "prof_shore_win" : "jerbs_crystal_d1");
    } else {
      setBattleNotif({ title: `${enc.name} won this round.`, sub: "Come back stronger!" });
      setPhase(enc.trainer === "jay" ? "jay_a3_lose" : enc.trainer === "lia" ? "lia_a3_lose" : enc.trainer === "prof" ? "prof_shore_lose" : "jerbs_battle_intro");
    }
    setTrainerEncounter(null);
    window.setTimeout(() => setBattleNotif(null), 2800);
    if (enc.trainer === "prof") {
      transitionTo("shore", SHORE_SPAWN.x, SHORE_SPAWN.y - 80);
    } else {
      transitionTo("area3", returnX, returnY);
    }

    const outcome = result.kind === "trainerWin"
      ? `You defeated ${enc.name}'s team!`
      : `${enc.name}'s team defeated you.`;
    const reportData = {
      outcome, xpGained: r.xpGained, recovered: thrown, lostToBond: 0,
      levelUps: r.levelUps, newLevel: r.newLevel, statGains: r.totalGains, newMoves: r.newMoves,
      companionCount: r.xpGained > 0 ? caughtPartyRef.current.length : 0,
    };
    const evo = evoTarget;
    if (evo && r.xpGained > 0) {
      pendingEvoDataRef.current = reportData;
      window.setTimeout(() => setPendingEvo(evo), 1000);
    } else if (r.xpGained > 0) {
      window.setTimeout(() => setBattleReport(reportData), 1200);
    }
  }, [transitionTo, trainerEncounter, starter, starterLevel, starterXp, starterMoves, role, wyvruntCaught, wyvruntForm, wyrLoyalty]);

  // Caught companions become the battle bench (party slots 2..N). Each fights at
  // its own level: stats from partyBattleStats, moves from its level-based pool.
  const battleBench: BattleMon[] = caughtParty.map(m => {
    const el = asElement(m.type);
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      color: ELEMENT_COLOR[m.type as keyof typeof ELEMENT_COLOR] ?? "#cccccc",
      level: m.level,
      stats: partyBattleStats(m.maxHp, m.baseDmg, m.rarity, m.level),
      moves: m.moves ?? (el ? defaultActiveMoves(el, m.level) : []),
      img: m.playerImg,
      sheet: m.playerSheet,
      faces: m.playerFaces,
    };
  });

  // ── Trainer battle — full takeover when scene === "battle" + trainerEncounter ─
  if (scene === "battle" && trainerEncounter && starter) {
    return (
      <div style={{ width:"100vw", height:"100dvh", background:"#000", position:"relative", overflow:"hidden" }}>
        <BattleScene
          wild={trainerEncounter.team[0]}
          starter={starter}
          starterLevel={starterLevel}
          starterStats={starterStats}
          starterMoves={starterMoves}
          hasResonanceStone={resonanceStoneEquipped}
          healingRuneEquipped={healingRuneEquipped}
          slottedRuneId={slottedBattleRuneId}
          catchMult={0}
          shellsCount={shellCount}
          heroImg={heroSideImg}
          opponentKind="keeper"
          keeperImg={trainerEncounter.trainer === "jay" ? "/__mockup/images/jay_side_idle.png" : trainerEncounter.trainer === "lia" ? "/__mockup/images/lia_side_idle.png" : trainerEncounter.trainer === "prof" ? "/__mockup/images/prof_side_idle.png" : "/__mockup/images/jerbs_sprite.png"}
          keeperSheet={trainerEncounter.trainer === "jerbs" ? { url:"/__mockup/images/jerbs_sprite.png", x:410, y:512, w:205, h:512, sheetW:1024, sheetH:1536 } : undefined}
          keeperName={trainerEncounter.name}
          keeperTeam={trainerEncounter.team}
          keeperMonLevels={trainerEncounter.levels}
          bench={battleBench}
          onConsumeShell={() => setShellCount(c => Math.max(0, c - 1))}
          onEnd={handleTrainerEnd}
          berries={{ dusk:duskberries, thorn:thornberries, calm:calmberries, bright:brightberries }}
          onUseBerry={type => {
            if (type === "dusk")   setDuskberries(n => Math.max(0, n - 1));
            if (type === "thorn")  setThornberries(n => Math.max(0, n - 1));
            if (type === "calm")   setCalmberries(n => Math.max(0, n - 1));
            if (type === "bright") setBrightberries(n => Math.max(0, n - 1));
          }}
        />
        {battleNotif && (
          <div style={{
            position:"absolute", top:"30%", left:"50%",
            transform:"translate(-50%,-50%)",
            background:"rgba(8,4,2,0.94)",
            border:"1.5px solid rgba(240,200,80,0.6)",
            borderRadius:14, padding:"14px 22px",
            zIndex:80, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(240,200,80,0.3)",
            textAlign:"center",
          }}>
            <div style={{ color:"#f0d890", fontSize:14, fontWeight:900 }}>{battleNotif.title}</div>
            {battleNotif.sub && <div style={{ color:"#a89070", fontSize:10, marginTop:3, letterSpacing:1 }}>{battleNotif.sub}</div>}
          </div>
        )}
      </div>
    );
  }

  // ── Wild battle — full takeover when scene === "battle" ───────────────────
  if (scene === "battle" && wildEncounter && starter) {
    return (
      <div style={{ width:"100vw", height:"100dvh", background:"#000", position:"relative", overflow:"hidden" }}>
        <BattleScene
          wild={wildEncounter}
          wildLevel={wildEncounterLevelRef.current}
          starter={starter}
          starterLevel={starterLevel}
          starterStats={starterStats}
          starterMoves={starterMoves}
          hasResonanceStone={resonanceStoneEquipped}
          healingRuneEquipped={healingRuneEquipped}
          slottedRuneId={slottedBattleRuneId}
          catchMult={role.catchMult}
          shellsCount={shellCount}
          caughtIds={[...caughtParty.map(m => m.id), ...storageBox.map(m => m.id)]}
          heroImg={heroSideImg}
          bench={battleBench}
          onConsumeShell={() => setShellCount(c => Math.max(0, c - 1))}
          onEnd={handleBattleEnd}
          berries={{ dusk:duskberries, thorn:thornberries, calm:calmberries, bright:brightberries }}
          onUseBerry={type => {
            if (type === "dusk")   setDuskberries(n => Math.max(0, n - 1));
            if (type === "thorn")  setThornberries(n => Math.max(0, n - 1));
            if (type === "calm")   setCalmberries(n => Math.max(0, n - 1));
            if (type === "bright") setBrightberries(n => Math.max(0, n - 1));
          }}
        />
        {battleNotif && (
          <div style={{
            position:"absolute", top:"30%", left:"50%",
            transform:"translate(-50%,-50%)",
            background:"rgba(8,4,2,0.94)",
            border:"1.5px solid rgba(240,200,80,0.6)",
            borderRadius:14, padding:"14px 22px",
            zIndex:80, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(240,200,80,0.3)",
            textAlign:"center",
          }}>
            <div style={{ color:"#f0d890", fontSize:14, fontWeight:900 }}>{battleNotif.title}</div>
            {battleNotif.sub && <div style={{ color:"#a89070", fontSize:10, marginTop:3, letterSpacing:1 }}>{battleNotif.sub}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width:"100vw", height:"100dvh", background:"#060606", display:"flex", flexDirection:"column", overflow:"hidden", userSelect:"none", WebkitUserSelect:"none", touchAction:"none", overscrollBehavior:"none" }}>

      {/* ── MAP VIEWPORT ─────────────────────────────────────────────────── */}
      <div ref={vpRef} style={{ flex:1, position:"relative", overflow:"hidden" }}
        onClick={(e) => {
          if (!devMode) return;
          const vp = vpRef.current; if (!vp) return;
          const r = vp.getBoundingClientRect();
          const wx = Math.round(cam.current.x + (e.clientX - r.left) / ZOOM);
          const wy = Math.round(cam.current.y + (e.clientY - r.top) / ZOOM);
          if (wallEditMode) {
            if (!wallPendA) { setWallPendA({ x: wx, y: wy }); }
            else { addWall(wallPendA, { x: wx, y: wy }); setWallPendA(null); }
          } else {
            setDevProbe({ x: wx, y: wy });
          }
        }}>

        {/* World container — camera-scrolled + zoomed */}
        <div ref={worldRef} style={{
          position: "absolute",
          width:  scene === "overworld" ? OW.w : scene === "lab" ? LB.w : scene === "route1" ? R1.w : scene === "route2" ? R2.w : scene === "area3" ? A3.w : scene === "farm" ? FARM.w : scene === "shore" ? SHORE.w : scene === "town" ? TOWN.w : scene === "town_left" ? TOWN_L.w : scene === "town_right" ? TOWN_R.w : scene === "maya" ? MY.w : scene === "jay" ? JY.w : scene === "ellio" ? EH.w : scene === "lia" ? LH.w : PH.w,
          height: scene === "overworld" ? OW.h : scene === "lab" ? LB.h : scene === "route1" ? R1.h : scene === "route2" ? R2.h : scene === "area3" ? A3.h : scene === "farm" ? FARM.h : scene === "shore" ? SHORE.h : scene === "town" ? TOWN.h : scene === "town_left" ? TOWN_L.h : scene === "town_right" ? TOWN_R.h : scene === "maya" ? MY.h : scene === "jay" ? JY.h : scene === "ellio" ? EH.h : scene === "lia" ? LH.h : PH.h,
          willChange: "transform",
          transformOrigin: "0 0",
          transform: `scale(${ZOOM}) translate(${-cam.current.x}px,${-cam.current.y}px)`,
        }}>
          {/* Map background */}
          <img
            key={scene}
            src={scene === "ellio" ? "/__mockup/images/ellio-home-interior.png"
              : scene === "lia"    ? "/__mockup/images/lia-home.png"
              : scene === "area3"  ? "/__mockup/images/area3-bg.png"
              : scene === "farm"       ? "/__mockup/images/farm-bg.png"
              : scene === "shore"      ? "/__mockup/images/shore-bg.png"
              : scene === "town"       ? "/__mockup/images/town-hub.png"
              : scene === "town_left"  ? "/__mockup/images/town-left.png"
              : scene === "town_right" ? "/__mockup/images/town-right.png"
              : scene === "route1" ? "/__mockup/images/route1-bg.png"
              : scene === "route2" ? "/__mockup/images/route2-map.png"
              : scene === "overworld"
              ? "/__mockup/images/overworld-map.png"
              : scene === "lab"
              ? "/__mockup/images/prof-lab-interior.png"
              : scene === "maya"
              ? "/__mockup/images/maya-home-interior.png"
              : scene === "jay"
              ? "/__mockup/images/jay-home-interior.png"
              : "/__mockup/images/player-home-interior.png"}
            alt="map"
            loading="eager"
            decoding="async"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit: scene === "overworld" ? "fill" : "cover" }}
          />

          {/* ── Ambient scene particles ─────────────────────────────────── */}
          {(() => {
            type MoteConf = { left:string; top:string; delay:string; dur:string; size:number; color:string };
            const ovMotes: MoteConf[] = [
              { left:"8%",  top:"30%", delay:"0s",   dur:"4.5s", size:2, color:"rgba(120,200,80,0.55)"  },
              { left:"22%", top:"55%", delay:"1.3s", dur:"5.2s", size:2, color:"rgba(140,220,90,0.45)"  },
              { left:"45%", top:"20%", delay:"2.8s", dur:"4.0s", size:3, color:"rgba(100,180,60,0.50)"  },
              { left:"68%", top:"45%", delay:"0.7s", dur:"6.1s", size:2, color:"rgba(160,230,100,0.42)" },
              { left:"82%", top:"70%", delay:"3.5s", dur:"4.8s", size:2, color:"rgba(110,190,70,0.55)"  },
              { left:"15%", top:"80%", delay:"1.9s", dur:"5.5s", size:3, color:"rgba(130,210,85,0.38)"  },
              { left:"55%", top:"65%", delay:"4.2s", dur:"4.3s", size:2, color:"rgba(90,170,55,0.50)"   },
              { left:"75%", top:"15%", delay:"0.4s", dur:"5.8s", size:2, color:"rgba(150,220,95,0.42)"  },
            ];
            const rtMotes: MoteConf[] = [
              { left:"12%", top:"25%", delay:"0s",   dur:"5.5s", size:2, color:"rgba(200,180,120,0.50)" },
              { left:"30%", top:"60%", delay:"1.8s", dur:"4.2s", size:3, color:"rgba(180,155,100,0.42)" },
              { left:"52%", top:"40%", delay:"0.9s", dur:"6.0s", size:2, color:"rgba(210,185,130,0.48)" },
              { left:"70%", top:"70%", delay:"2.5s", dur:"4.8s", size:2, color:"rgba(175,155,110,0.42)" },
              { left:"88%", top:"20%", delay:"3.8s", dur:"5.2s", size:2, color:"rgba(195,175,120,0.50)" },
              { left:"5%",  top:"55%", delay:"1.2s", dur:"4.5s", size:3, color:"rgba(185,160,105,0.42)" },
            ];
            const a3Motes: MoteConf[] = [
              { left:"10%", top:"35%", delay:"0s",   dur:"5.0s", size:2, color:"rgba(130,100,200,0.55)" },
              { left:"28%", top:"60%", delay:"1.5s", dur:"4.5s", size:2, color:"rgba(150,120,220,0.45)" },
              { left:"50%", top:"25%", delay:"2.2s", dur:"5.8s", size:3, color:"rgba(100,80,180,0.55)"  },
              { left:"72%", top:"50%", delay:"0.6s", dur:"4.2s", size:2, color:"rgba(160,130,230,0.48)" },
              { left:"85%", top:"75%", delay:"3.2s", dur:"5.5s", size:2, color:"rgba(120,90,210,0.45)"  },
              { left:"18%", top:"80%", delay:"1.0s", dur:"6.0s", size:3, color:"rgba(140,110,220,0.42)" },
              { left:"60%", top:"15%", delay:"4.0s", dur:"4.8s", size:2, color:"rgba(110,85,195,0.55)"  },
            ];
            const motes: MoteConf[] =
              scene === "route1" || scene === "route2" ? rtMotes :
              scene === "area3"  ? a3Motes :
              scene === "overworld" || scene === "home" || scene === "lab" ? ovMotes : [];
            return motes.map((p, i) => (
              <div key={`mote-${i}`} style={{
                position:"absolute", left:p.left, top:p.top,
                width:p.size, height:p.size, borderRadius:"50%",
                background:p.color, pointerEvents:"none",
                animation:`moteFloat ${p.dur} ${p.delay} infinite ease-in-out`, zIndex:1,
              }}/>
            ));
          })()}

          {/* ── D-pad control hint (first overworld visit) ──────────────── */}
          {showDpadHint && scene === "overworld" && phase === "walk" && (
            <div style={{
              position:"absolute", bottom:"22%", left:"50%", transform:"translateX(-50%)",
              background:"rgba(4,8,16,0.88)", border:"1px solid rgba(255,255,200,0.22)",
              borderRadius:8, padding:"6px 16px", zIndex:60, pointerEvents:"none",
              animation:"dialogIn 0.4s ease-out", whiteSpace:"nowrap",
            }}>
              <div style={{ color:"#d4c884", fontSize:10, letterSpacing:1.2, fontWeight:700 }}>
                D-pad to move  ·  ↑ to enter doors
              </div>
            </div>
          )}

          {/* ── Shore — Prof. Irwyn NPC ──────────────────────────────────── */}
          {scene === "shore" && (
            <>
              <canvas ref={profShoreCanvasRef} style={{ position:"absolute", imageRendering:"auto", pointerEvents:"none", zIndex:5, left: PROF_SHORE_POS.x - 48, top: PROF_SHORE_POS.y - 72 }}/>
              <div style={{ position:"absolute", zIndex:6, left: PROF_SHORE_POS.x - 28, top: PROF_SHORE_POS.y - 92, color:"#e8d060", fontSize:8, fontWeight:800, letterSpacing:1, pointerEvents:"none", textShadow:"0 0 4px #000,0 0 8px #000" }}>PROF. IRWYN</div>
            </>
          )}

          {/* Dev: collision zone visualiser (hidden while walls are off) */}
          {DEV_COLLISIONS && WALLS_ON && !wallEditMode && (
            (scene === "overworld" ? OW_BLOCKED :
             scene === "route1"   ? R1_BLOCKED :
             scene === "route2"   ? R2_BLOCKED :
             scene === "area3"    ? A3_BLOCKED :
             scene === "lab"      ? LAB_BLOCKED :
             scene === "jay"      ? JAY_BLOCKED :
             scene === "maya"     ? MAYA_BLOCKED :
             scene === "lia"      ? LH_BLOCKED :
             scene === "ellio"    ? EH_BLOCKED :
             PH_BLOCKED
            ).map(([x1,y1,x2,y2],i) => (
              <div key={`dbg-${i}`} style={{
                position:"absolute", left:x1, top:y1,
                width:x2-x1, height:y2-y1,
                background:"rgba(255,0,0,0.22)",
                border:"1.5px solid rgba(255,60,60,0.85)",
                pointerEvents:"none", zIndex:22,
              }}/>
            ))
          )}

          {/* Door glows — always on; per-door shape preserved, toggled in DEV */}
          {DOOR_LIST.filter((d) => d.scene === scene && doorGlowOn[d.key]).map((d) => {
            const r = d.get();
            const shape = GLOW_SHAPE[d.key];
            const dw = Math.min(r[2] - r[0], 64);
            const g: GlowBox = shape ? shape(r) : { left:(r[0] + r[2]) / 2 - dw / 2, top:(r[1] + r[3]) / 2 - 8, w:dw, h:16, color:"rgba(255,210,90,0.7)" };
            return (
              <div key={`glow-${d.key}`} style={{
                position:"absolute", left:g.left, top:g.top, width:g.w, height:g.h, borderRadius:"50%",
                background:`radial-gradient(ellipse,${g.color}0%,transparent 80%)`,
                animation:"pulse 1.5s ease-in-out infinite", pointerEvents:"none", zIndex:4,
              }}/>
            );
          })}

          {/* Dev: draggable door editor (current scene) + tap-probe crosshair */}
          {devMode && !wallEditMode && DOOR_LIST.filter((d) => d.scene === scene).map((d) => {
            const [x1, y1, x2, y2] = d.get();
            const gOn = doorGlowOn[d.key];
            return (
              <div key={`door-${d.key}`}
                onPointerDown={onDoorDown(d.key, d.get)}
                onPointerMove={onDoorMove(d.set)}
                onPointerUp={onDoorUp}
                onPointerCancel={onDoorUp}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position:"absolute", left:x1, top:y1,
                  width:Math.max(10, x2 - x1), height:Math.max(10, y2 - y1),
                  background:"rgba(40,120,255,0.28)", border:"2px solid #2a78ff",
                  zIndex:30, cursor:"move", touchAction:"none",
                }}>
                <span style={{ position:"absolute", top:0, left:0, transform:"translateY(-100%)", fontSize:11, fontWeight:800, color:"#fff", background:"#2a78ff", padding:"1px 4px", borderRadius:3, whiteSpace:"nowrap" }}>{d.name} {x1},{y1}</span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={toggleDoorGlow(d.key)}
                  style={{
                    position:"absolute", right:-9, bottom:-9, width:20, height:20, borderRadius:"50%",
                    border:"1px solid #fff", background: gOn ? "#ffcf3a" : "rgba(15,15,20,0.9)",
                    color: gOn ? "#3a2a00" : "#9aa", fontSize:11, lineHeight:1, padding:0, cursor:"pointer", zIndex:32,
                  }}>✦</button>
              </div>
            );
          })}
          {devMode && !wallEditMode && devProbe && (
            <div style={{ position:"absolute", left:devProbe.x-12, top:devProbe.y-12, width:24, height:24, zIndex:31, pointerEvents:"none" }}>
              <div style={{ position:"absolute", left:11, top:0, width:2, height:24, background:"#ffd400" }}/>
              <div style={{ position:"absolute", left:0, top:11, width:24, height:2, background:"#ffd400" }}/>
              <div style={{ position:"absolute", left:5, top:5, width:14, height:14, borderRadius:"50%", border:"2px solid #ffd400" }}/>
            </div>
          )}

          {/* Dev: wall/collider editor — draggable boxes for the current scene */}
          {devMode && wallEditMode && (WALL_SCENES.find((w) => w.scene === scene)?.get() ?? []).map((rect, i) => {
            const [x1, y1, x2, y2] = rect;
            return (
              <div key={`wall-${i}`}
                onPointerDown={onWallDown(i)}
                onPointerMove={onWallMove}
                onPointerUp={onWallUp}
                onPointerCancel={onWallUp}
                onClick={(e) => { e.stopPropagation(); onWallTap(i); }}
                style={{
                  position:"absolute", left:x1, top:y1,
                  width:Math.max(8, x2 - x1), height:Math.max(8, y2 - y1),
                  background:"rgba(255,70,70,0.30)", border:"2px solid #ff5a3c",
                  zIndex:29, cursor:"move", touchAction:"none",
                }}>
                <span style={{ position:"absolute", top:0, left:0, transform:"translateY(-100%)", fontSize:10, fontWeight:800, color:"#fff", background:"#ff5a3c", padding:"0 3px", borderRadius:3, whiteSpace:"nowrap" }}>#{i}</span>
              </div>
            );
          })}
          {devMode && wallEditMode && wallPendA && (
            <div style={{ position:"absolute", left:wallPendA.x-10, top:wallPendA.y-10, width:20, height:20, zIndex:31, pointerEvents:"none" }}>
              <div style={{ position:"absolute", left:9, top:0, width:2, height:20, background:"#39ff88" }}/>
              <div style={{ position:"absolute", left:0, top:9, width:20, height:2, background:"#39ff88" }}/>
              <div style={{ position:"absolute", left:4, top:4, width:12, height:12, borderRadius:"50%", border:"2px solid #39ff88" }}/>
            </div>
          )}

          {/* Prof Irwyn */}
          {scene === "lab" && (
            <canvas
              ref={profCanvasRef}
              style={{
                position: "absolute",
                imageRendering: "auto",
                pointerEvents: "none",
                left: PROF.x - 48,
                top:  PROF.y - 72,
              }}
            />
          )}

          {/* Rowan — professor's disciple (only when you are not playing Rowan) */}
          {scene === "lab" && rowanInLab && (
            <>
              <canvas
                ref={rowanLabCanvasRef}
                style={{
                  position: "absolute",
                  imageRendering: "auto",
                  pointerEvents: "none",
                  left: PROF.x + 130 - 48,
                  top:  PROF.y + 6 - 72,
                }}
              />
              <div style={{
                position:"absolute",
                left: PROF.x + 130 - 14, top: PROF.y + 6 - 98,
                color:"#cdbce8", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>ROWAN</div>
            </>
          )}


          {/* Jay NPC sprite inside his home — no fixed CSS w/h; canvas pixel dims set by drawSprite */}
          {scene === "jay" && (
            <canvas ref={jayCanvasRef} style={{
              position:"absolute",
              imageRendering:"auto", pointerEvents:"none",
              left: JAY_POS.x - 48,
              top:  JAY_POS.y - 72,
              animation: jayBounce ? "npcReact 0.5s ease-out" : "none",
            }}/>
          )}

          {/* Maya NPC sprite outside her home */}
          {scene === "overworld" && (
            <>
              {/* no fixed CSS w/h — canvas pixel dims set by drawSprite to 68×(aspect-height) */}
              <canvas ref={mayaCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: MAYA_POS.x - 48,
                top:  MAYA_POS.y - 72,
                animation: mayaBounce ? "npcReact 0.5s ease-out" : "none",
              }}/>
              <div style={{
                position:"absolute",
                left: MAYA_POS.x - 20, top: MAYA_POS.y - 100,
                color:"#d4f0c0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>MAYA</div>
              {/* Tova — ambient townsfolk, village square */}
              <img src={TOVA_IMG} alt="Tova" style={{
                position:"absolute",
                left: TOVA_POS.x - 32, top: TOVA_POS.y - 64,
                width:64, height:64, objectFit:"contain",
                pointerEvents:"none", imageRendering:"auto",
              }} />
              <div style={{
                position:"absolute",
                left: TOVA_POS.x - 20, top: TOVA_POS.y - 72,
                color:"#e8c878", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>TOVA</div>
              {/* Senna — ambient townsfolk, near Route 1 gate */}
              <img src={SENNA_IMG} alt="Senna" style={{
                position:"absolute",
                left: SENNA_POS.x - 32, top: SENNA_POS.y - 64,
                width:64, height:64, objectFit:"contain",
                pointerEvents:"none", imageRendering:"auto",
              }} />
              <div style={{
                position:"absolute",
                left: SENNA_POS.x - 24, top: SENNA_POS.y - 72,
                color:"#88d8b0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>SENNA</div>
              {/* Corvin — traveling naturalist, northeast near east road */}
              <img src={CORVIN_IMG} alt="Corvin" style={{
                position:"absolute",
                left: CORVIN_POS.x - 32, top: CORVIN_POS.y - 64,
                width:64, height:64, objectFit:"contain",
                pointerEvents:"none", imageRendering:"auto",
              }} />
              <div style={{
                position:"absolute",
                left: CORVIN_POS.x - 24, top: CORVIN_POS.y - 72,
                color:"#c8a8f8", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>CORVIN</div>
            </>
          )}

          {/* Jess NPC sprite inside player home */}
          {scene === "ellio" && (
            <>
              <canvas ref={ellioCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: ELLIO_POS.x - 48,
                top:  ELLIO_POS.y - 72,
                animation: ellioBounce ? "npcReact 0.5s ease-out" : "none",
              }}/>
              <div style={{
                position:"absolute",
                left: ELLIO_POS.x - 18, top: ELLIO_POS.y - 100,
                color:"#a8d898", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>ELLIO</div>
            </>
          )}

          {scene === "home" && (
            <>
              <canvas ref={jessCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: JESS_POS.x - 48,
                top:  JESS_POS.y - 72,
              }}/>
              <div style={{
                position:"absolute",
                left: JESS_POS.x - 16, top: JESS_POS.y - 100,
                color:"#f8d8b0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>{partnerName.toUpperCase()}</div>
              {kinjuAtHome && (
                <>
                  <canvas ref={kinjuHomeCanvasRef} style={{
                    position:"absolute",
                    imageRendering:"auto", pointerEvents:"none",
                    left: JESS_POS.x + 70 - 48,
                    top:  JESS_POS.y + 4 - 72,
                  }}/>
                  <div style={{
                    position:"absolute",
                    left: JESS_POS.x + 70 - 16, top: JESS_POS.y + 4 - 100,
                    color:"#f8d8b0", fontSize:8, fontWeight:800,
                    letterSpacing:1, pointerEvents:"none",
                    textShadow:"0 0 4px #000,0 0 8px #000",
                  }}>KINJU</div>
                </>
              )}
            </>
          )}

          {/* Lia NPC + Draco (her nicknamed Wyvburn) inside Lia's home */}
          {scene === "lia" && (
            <>
              <canvas ref={liaCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: LIA_POS.x - 48,
                top:  LIA_POS.y - 72,
                animation: liaBounce ? "npcReact 0.5s ease-out" : "none",
              }}/>
              <div style={{
                position:"absolute",
                left: LIA_POS.x - 12, top: LIA_POS.y - 100,
                color:"#ffaa70", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>LIA</div>
              {/* Draco — Lia's nicknamed Wyvburn, resting beside her */}
              <img
                src="/__mockup/images/cindrax.png"
                alt="Draco"
                style={{
                  position:"absolute",
                  left: LIA_POS.x + 55,
                  top:  LIA_POS.y - 44,
                  width:72, height:72,
                  objectFit:"contain",
                  imageRendering:"auto",
                  pointerEvents:"none",
                  filter:"drop-shadow(0 0 6px rgba(255,100,40,0.5))",
                }}
              />
              <div style={{
                position:"absolute",
                left: LIA_POS.x + 60, top: LIA_POS.y - 52,
                color:"#ff8855", fontSize:7, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>DRACO</div>
            </>
          )}

          {/* Prof Irwyn + Wyvrunt on Route 2 — hidden once Wyvrunt is bonded */}
          {scene === "route2" && !wyvruntCaught && (
            <>
              <canvas ref={profR2CanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: PROF_R2_POS.x - 48,
                top:  PROF_R2_POS.y - 72,
              }}/>
              <div style={{
                position:"absolute",
                left: PROF_R2_POS.x - 30, top: PROF_R2_POS.y - 100,
                color:"#ffe0a0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>PROF. IRWYN</div>

              {/* Wyvrunt overworld sprite — appears only after prof's talk, until caught */}
              {profRoute2Done && !wyvruntCaught && (
                <>
                  <img
                    src="/__mockup/images/wyvrunt_front_idle.png"
                    alt="Wyvrunt"
                    style={{
                      position:"absolute",
                      left: WYV_R2_POS.x - 38, top: WYV_R2_POS.y - 52,
                      width:76, height:76, objectFit:"contain",
                      pointerEvents:"none",
                      filter:"drop-shadow(0 0 12px rgba(255,200,80,0.7)) drop-shadow(0 0 4px rgba(255,255,255,0.6))",
                      animation:"pulse 1.8s ease-in-out infinite",
                    }}
                  />
                  <div style={{
                    position:"absolute",
                    left: WYV_R2_POS.x - 32, top: WYV_R2_POS.y - 80,
                    color:"#ffd060", fontSize:9, fontWeight:900,
                    letterSpacing:1, pointerEvents:"none",
                    textShadow:"0 0 6px #ffa030,0 0 12px #ff8020,0 0 3px #000",
                  }}>WYVRUNT <span style={{ color:"#ffe080" }}>☯</span></div>
                </>
              )}

              {/* Old Hollis — painted-in farmer nametag */}
              <div style={{
                position:"absolute",
                left: FARMER_R2_POS.x - 28, top: FARMER_R2_POS.y - 92,
                color:"#bfe080", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>OLD HOLLIS</div>
            </>
          )}

          {/* Wife on the south town path (overworld) — during intercept only */}
          {scene === "overworld" && wifeOnPath && (
            <>
              <canvas ref={jessPathCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: JESS_PATH_POS.x - 48,
                top:  JESS_PATH_POS.y - 72,
              }}/>
              <div style={{
                position:"absolute",
                left: JESS_PATH_POS.x - 16, top: JESS_PATH_POS.y - 100,
                color:"#f8d8b0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>{partnerName.toUpperCase()}</div>
            </>
          )}

          {/* Area 3 — Jay & Lia trainer NPCs */}
          {scene === "area3" && (
            <>
              <canvas ref={jayA3CanvasRef} style={{
                position:"absolute", imageRendering:"auto", pointerEvents:"none",
                left: JAY_A3_POS.x - 32, top: JAY_A3_POS.y - 50,
              }}/>
              <div style={{
                position:"absolute",
                left: JAY_A3_POS.x - 10, top: JAY_A3_POS.y - 68,
                color:"#8ab0f0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>JAY</div>
              <canvas ref={liaA3CanvasRef} style={{
                position:"absolute", imageRendering:"auto", pointerEvents:"none",
                left: LIA_A3_POS.x - 32, top: LIA_A3_POS.y - 50,
              }}/>
              <div style={{
                position:"absolute",
                left: LIA_A3_POS.x - 10, top: LIA_A3_POS.y - 68,
                color:"#ff9060", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>LIA</div>
              {/* Jerbs — portal animation + jerbeen sprite */}
              {portalOpen && (
                <div style={{
                  position:"absolute", pointerEvents:"none", zIndex:4,
                  left: JERBS_POS.x - 72, top: JERBS_POS.y - 200,
                  width:140, height:230,
                  backgroundImage:"url(/__mockup/images/jerbs_portal.png)",
                  backgroundSize:"700px 460px",
                  backgroundPosition:`${-(portalFrame % 5) * 140}px ${-Math.floor(portalFrame / 5) * 230}px`,
                  backgroundRepeat:"no-repeat",
                }}/>
              )}
              {(cleminusMet || portalOpen || jerbsAppeared) && (
                <div style={{
                  position:"absolute", pointerEvents:"none", zIndex:5,
                  left: JERBS_POS.x - 22, top: JERBS_POS.y - 112,
                  width: 45, height: 112,
                  backgroundImage: "url(/__mockup/images/jerbs_sprite.png)",
                  backgroundSize: "224px 336px",
                  backgroundPosition: jerbsFacing === "front" ? "-90px -112px" : "0px 0px",
                  backgroundRepeat: "no-repeat",
                  imageRendering: "auto",
                  transition: "background-position 0.25s steps(1)",
                }}/>
              )}
              {cleminusMet && (
                <div style={{
                  position:"absolute", zIndex:6,
                  left: JERBS_POS.x - 14, top: JERBS_POS.y - 130,
                  color:"#e8b840", fontSize:8, fontWeight:800,
                  letterSpacing:1, pointerEvents:"none",
                  textShadow:"0 0 4px #000,0 0 8px #000",
                }}>JERBS</div>
              )}
            </>
          )}

          {/* ── Farm NPCs + animals ─────────────────────────────────────── */}
          {scene === "farm" && (
            <>
              <img src={SHELLA_IMG} alt="Shella" style={{ position:"absolute", imageRendering:"auto", pointerEvents:"none", zIndex:5, left: SHELLA_POS.x - 36, top: SHELLA_POS.y - 72, width:72, height:72, objectFit:"contain" }}/>
              <div style={{ position:"absolute", zIndex:6, left: SHELLA_POS.x - 22, top: SHELLA_POS.y - 90, color:"#f5c842", fontSize:8, fontWeight:800, letterSpacing:1, pointerEvents:"none", textShadow:"0 0 4px #000,0 0 8px #000" }}>SHELLA</div>
              <img src={RUNRIK_IMG} alt="Runrik" style={{ position:"absolute", imageRendering:"auto", pointerEvents:"none", zIndex:5, left: RUNRIK_POS.x - 36, top: RUNRIK_POS.y - 72, width:72, height:72, objectFit:"contain" }}/>
              <div style={{ position:"absolute", zIndex:6, left: RUNRIK_POS.x - 22, top: RUNRIK_POS.y - 90, color:"#8090f0", fontSize:8, fontWeight:800, letterSpacing:1, pointerEvents:"none", textShadow:"0 0 4px #000,0 0 8px #000" }}>RUNRIK</div>
              <img src={MAREN_IMG} alt="Maren" style={{ position:"absolute", imageRendering:"auto", pointerEvents:"none", zIndex:5, left: MAREN_POS.x - 36, top: MAREN_POS.y - 72, width:72, height:72, objectFit:"contain" }}/>
              <div style={{ position:"absolute", zIndex:6, left: MAREN_POS.x - 22, top: MAREN_POS.y - 90, color:"#90c060", fontSize:8, fontWeight:800, letterSpacing:1, pointerEvents:"none", textShadow:"0 0 4px #000,0 0 8px #000" }}>MAREN</div>
              {FARM_ANIMALS.map((a, i) => (
                <img key={i} src={a.src} alt=""
                  style={{ position:"absolute", left: a.x - 30, top: a.y - 30, width:60, height:60, objectFit:"contain", imageRendering:"auto", pointerEvents:"none", zIndex:4 }}
                />
              ))}
            </>
          )}

          {/* Shell item inside Maya's home */}
          {scene === "maya" && !shellsCollected && (
            <>
              <div style={{
                position:"absolute",
                left: (MAYA_SHELL[0]+MAYA_SHELL[2])/2 - 26,
                top:  (MAYA_SHELL[1]+MAYA_SHELL[3])/2 - 26,
                width:52, height:52, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(80,220,180,0.4)0%,transparent 75%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              <img src="/__mockup/images/weathered-shell.png" alt="Shell" style={{
                position:"absolute",
                left: (MAYA_SHELL[0]+MAYA_SHELL[2])/2 - 22,
                top:  (MAYA_SHELL[1]+MAYA_SHELL[3])/2 - 22,
                width:44, height:44, objectFit:"contain",
                pointerEvents:"none",
                filter:"drop-shadow(0 0 8px rgba(80,220,180,0.8))",
              }}/>
            </>
          )}


          {/* Encounter zone hotspots — rendered in route1, area3, and route2 (after wyvrunt) */}
          {(scene === "route1" || scene === "area3" || scene === "shore" || (scene === "route2" && wyvruntCaught)) && (() => {
            const hs = scene === "area3" ? A3_HOTSPOTS : scene === "route2" ? R2_HOTSPOTS : scene === "shore" ? SHORE_HOTSPOTS : R1_HOTSPOTS;
            return (
              <>
                {/* Disturbance hotspots — 5-tier rarity-animated encounter circles */}
                {hs.map((h, i) => {
                  const dist = activeDisturbances[i];
                  const onCd = !!hotspotCd[i];
                  const rarity = dist?.mon.rarity;
                  const rc = rarity ? RARITY_COLOR[rarity] : "transparent";
                  const distEl = dist ? asElement(dist.mon.type) : null;
                  const ec = distEl ? ELEMENT_COLOR[distEl] : rc;
                  const r = h.r * HOTSPOT_VIS;
                  const cx = h.r; const cy = h.r;
                  const hsAnim = rarity === "apex" ? "hsApex" : rarity === "ultra" ? "hsUltra" : rarity === "rare" ? "hsRare" : rarity === "uncommon" ? "hsUncommon" : "hsCommon";
                  const hsDur  = rarity === "apex" ? 0.9 : rarity === "ultra" ? 1.1 : rarity === "rare" ? 1.4 : rarity === "uncommon" ? 1.65 : 2.2;
                  const glowPx = rarity === "apex" ? 44 : rarity === "ultra" ? 30 : rarity === "rare" ? 22 : rarity === "uncommon" ? 15 : 10;
                  const symbol = rarity === "apex" ? "✦" : rarity === "ultra" ? "◆" : rarity === "rare" ? "▲" : null;
                  const rings  = rarity === "apex" ? 3 : rarity === "ultra" ? 2 : rarity === "rare" ? 2 : rarity === "uncommon" ? 1 : 0;
                  const spkN   = rarity === "apex" ? 6 : rarity === "ultra" ? 4 : rarity === "rare" ? 3 : 0;
                  return (
                    <button key={i} onClick={() => handleHotspotClick(i, h)} style={{
                      position:"absolute", left: h.x - h.r, top: h.y - h.r,
                      width: h.r * 2, height: h.r * 2, background:"transparent",
                      border:"none", cursor:"pointer", padding:0,
                      opacity: onCd ? 0.18 : 1, zIndex: 4, transition:"opacity 0.45s",
                    }} aria-label={dist ? `disturbance-${rarity}` : `inspect-${h.kind}`}>
                      {!dist && (
                        <div style={{
                          position:"absolute", left:cx, top:cy,
                          width: r * 2, height: r * 2, borderRadius:"50%",
                          border:"1.5px dashed rgba(180,160,80,0.15)",
                          transform:"translate(-50%,-50%)", pointerEvents:"none",
                        }}/>
                      )}
                      {dist && (
                        <div style={{
                          position:"absolute", left:cx, top:cy,
                          width: r * 2, height: r * 2, borderRadius:"50%",
                          background:`radial-gradient(circle, ${ec}aa 0%, ${ec}55 38%, ${rc}25 65%, transparent 82%)`,
                          border:`${rarity === "apex" || rarity === "ultra" ? 2.5 : 1.8}px solid ${rc}dd`,
                          boxShadow:`0 0 ${glowPx}px ${rc}cc, 0 0 ${glowPx * 0.5}px ${ec}88, inset 0 0 ${glowPx * 0.55}px ${ec}44`,
                          transform:"translate(-50%,-50%)",
                          animation:`${hsAnim} ${hsDur}s ease-in-out infinite`,
                          pointerEvents:"none",
                        }}>
                          {symbol && (
                            <div style={{
                              position:"absolute", left:"50%", top:"50%",
                              transform:"translate(-50%,-50%)",
                              fontSize: rarity === "apex" ? 13 : 10,
                              color: rc, opacity:0.95,
                              textShadow:`0 0 10px ${rc}, 0 0 5px #fff`,
                              fontWeight:900, animation:`pulse ${hsDur * 0.8}s ease-in-out infinite`,
                              pointerEvents:"none",
                            }}>{symbol}</div>
                          )}
                        </div>
                      )}
                      {dist && Array.from({length:rings}).map((_,ri) => (
                        <div key={ri} style={{
                          position:"absolute", left:cx, top:cy,
                          width: r * 2, height: r * 2, borderRadius:"50%",
                          border:`${ri === 0 ? 1.8 : 1.2}px solid ${ri % 2 === 0 ? rc : ec}`,
                          transform:"translate(-50%,-50%)",
                          animation:`hsOuterRing ${hsDur * (1 + ri * 0.35)}s ease-out ${hsDur * ri * 0.28}s infinite`,
                          pointerEvents:"none",
                        }}/>
                      ))}
                      {dist && Array.from({length:spkN}).map((_,si) => {
                        const a = (si / spkN) * Math.PI * 2;
                        const sx = cx + Math.cos(a) * r * 0.85;
                        const sy = cy + Math.sin(a) * r * 0.85;
                        const spkDur = rarity === "apex" ? 0.75 : rarity === "ultra" ? 0.9 : 1.1;
                        return (
                          <div key={si} style={{
                            position:"absolute", left:sx, top:sy,
                            width: rarity === "apex" ? 6 : 5, height: rarity === "apex" ? 6 : 5, borderRadius:"50%",
                            background: si % 2 === 0 ? rc : ec,
                            boxShadow:`0 0 8px ${rc}, 0 0 4px #fff`,
                            transform:"translate(-50%,-50%)",
                            animation:`hsSparkle ${spkDur}s ease-in-out ${si * (spkDur / spkN)}s infinite`,
                            pointerEvents:"none",
                          }}/>
                        );
                      })}
                    </button>
                  );
                })}

                {/* Orbiting element motes (one rotating wrapper per active disturbance, skipped for commons) */}
                {Object.entries(activeDisturbances).map(([k, d]) => {
                  if (d.mon.rarity === "common") return null;
                  const h = hs[Number(k)];
                  if (!h) return null;
                  const el = asElement(d.mon.type);
                  const c  = el ? ELEMENT_COLOR[el] : RARITY_COLOR[d.mon.rarity];
                  const rc = RARITY_COLOR[d.mon.rarity];
                  const motes    = d.mon.rarity === "apex" ? 5 : d.mon.rarity === "ultra" ? 4 : 3;
                  const moteSize = d.mon.rarity === "apex" ? 7 : d.mon.rarity === "ultra" ? 6 : 5;
                  const ringR    = h.r * HOTSPOT_VIS + 9;
                  const spin     = d.mon.rarity === "apex" ? "2.2s" : d.mon.rarity === "ultra" ? "3.0s" : d.mon.rarity === "rare" ? "4.0s" : "5.5s";
                  return (
                    <div key={`motes-${k}`} style={{
                      position:"absolute",
                      left: h.x - ringR, top: h.y - ringR,
                      width: ringR * 2, height: ringR * 2,
                      pointerEvents:"none", zIndex: 5,
                      animation:`runeSpin ${spin} linear infinite`,
                    }}>
                      {Array.from({ length: motes }).map((_, m) => {
                        const ang  = (m / motes) * Math.PI * 2;
                        const dx   = ringR + Math.cos(ang) * ringR - moteSize * 0.5;
                        const dy   = ringR + Math.sin(ang) * ringR - moteSize * 0.5;
                        const col  = m % 2 === 0 ? c : rc;
                        return (
                          <div key={m} style={{
                            position:"absolute", left: dx, top: dy,
                            width: moteSize, height: moteSize, borderRadius:"50%",
                            background: col,
                            boxShadow:`0 0 ${moteSize + 3}px ${col}, 0 0 ${moteSize * 2}px ${col}88, 0 0 3px #fff8`,
                          }}/>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Apex/ultra pillar fx */}
                {Object.entries(activeDisturbances).map(([k, d]) => {
                  if (d.mon.rarity !== "apex" && d.mon.rarity !== "ultra") return null;
                  const h = hs[Number(k)];
                  if (!h) return null;
                  const color = RARITY_COLOR[d.mon.rarity];
                  return (
                    <div key={`pillar-${k}`} style={{
                      position:"absolute",
                      left: h.x - 18, top: h.y - 140,
                      width: 36, height: 140,
                      background: `linear-gradient(180deg, transparent 0%, ${color}88 60%, ${color}cc 100%)`,
                      borderRadius:"40% 40% 50% 50% / 90% 90% 50% 50%",
                      filter:"blur(4px)",
                      pointerEvents:"none",
                      animation: "pillarPulse 1.4s ease-in-out infinite",
                      zIndex: 3,
                    }}/>
                  );
                })}
              </>
            );
          })()}

          {/* Ground shadow */}
          <div ref={shadowRef} style={{
            position:"absolute",
            width:36, height:12, borderRadius:"50%",
            background:"radial-gradient(ellipse,rgba(0,0,0,0.6)0%,transparent 75%)",
            pointerEvents:"none",
            left: px - 18, top: py + 2,
          }}/>

          {/* Wyvrunt follower — trails the player once bonded (Pokémon-Yellow style) */}
          <canvas ref={wyvFollowRef} style={{
            position:"absolute",
            imageRendering:"auto", pointerEvents:"none",
            display:"none",
            left: px - SPRITE_PX/2, top: py - topOff,
          }}/>

          {/* Player sprite — no CSS height; canvas buffer height controls display so portrait sprites aren't squashed */}
          <canvas ref={canvasRef} style={{
            position:"absolute",
            width:SPRITE_PX,
            imageRendering:"auto", pointerEvents:"none",
            left: px - SPRITE_PX/2, top: py - topOff,
          }}/>
        </div>

        {/* ── INTERACT BUTTON — Prof ────────────────────────────────────── */}
        {scene === "lab" && nearProf && phase === "walk" && (
          <button
            onClick={() => setPhase(
              !starter ? "d1"
              : !roleChosen ? "role_pick"
              : wyvruntCaught ? "prof_shells"
              : "prof_idle"
            )}
            style={{
              position:"absolute",
              left: interactPos.sx - 14,
              top:  interactPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#f0d050", border:"2px solid #fff",
              color:"#1a1200", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{(!starter || !roleChosen) ? "!" : "…"}</button>
        )}

        {/* ── INTERACT BUTTON — Rowan (lab disciple; always a chat) ──────── */}
        {scene === "lab" && rowanInLab && nearRowan && phase === "walk" && (
          <button
            onClick={() => setPhase("rowan_d1")}
            style={{
              position:"absolute",
              left: rowanInteractPos.sx - 14,
              top:  rowanInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#b8a0e0", border:"2px solid #fff",
              color:"#1a1030", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >…</button>
        )}

        {/* ── INTERACT BUTTON — Jay ─────────────────────────────────────── */}
        {scene === "jay" && nearJay && phase === "walk" && (
          <button
            onClick={() => setPhase(jayDone ? "jay_idle" : (hasHealingRune ? "jay_done" : "jay_d1"))}
            style={{
              position:"absolute",
              left: jayInteractPos.sx - 14,
              top:  jayInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#6090e0", border:"2px solid #fff",
              color:"#0a1030", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{jayDone ? "…" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Maya ────────────────────────────────────── */}
        {/* Green = first quest; amber = ready to hand over (shells collected);
            grey "…" = waiting for you to fetch shells, or post-quest idle chat. */}
        {scene === "overworld" && nearMaya && phase === "walk" && (() => {
          const active = !mayaDone && (shellsCollected || !mayaInitDone);
          const target = mayaDone
            ? "maya_idle"
            : active
              ? (shellsCollected ? "maya_post1" : "maya_d1")
              : "maya_wait"; // mayaInitDone but shells not yet collected
          return (
            <button
              onClick={() => setPhase(target)}
              style={{
                position:"absolute",
                left: mayaInteractPos.sx - 14,
                top:  mayaInteractPos.sy - 10,
                width:28, height:28, borderRadius:"50%",
                background: active ? (shellsCollected ? "#f0c060" : "#80d0a0") : "#b8b0a0",
                border:"2px solid #fff",
                color: active ? (shellsCollected ? "#3a2000" : "#0a2018") : "#201a10",
                fontSize:16, fontWeight:900,
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
                zIndex:10,
              }}
            >{active ? "!" : "…"}</button>
          );
        })()}

        {/* ── INTERACT BUTTON — Tova (overworld ambient) ───────────────── */}
        {scene === "overworld" && nearTova && phase === "walk" && (
          <button
            onClick={() => setPhase(phase === "walk" ? "tova_d1" : "tova_idle")}
            style={{
              position:"absolute",
              left: tovaInteractPos.sx - 14,
              top:  tovaInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#c4a060", border:"2px solid #fff",
              color:"#2a1800", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}>!</button>
        )}

        {/* ── INTERACT BUTTON — Senna (overworld ambient) ──────────────── */}
        {scene === "overworld" && nearSenna && phase === "walk" && (
          <button
            onClick={() => setPhase(phase === "walk" ? "senna_d1" : "senna_idle")}
            style={{
              position:"absolute",
              left: sennaInteractPos.sx - 14,
              top:  sennaInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#60a888", border:"2px solid #fff",
              color:"#001a0e", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}>!</button>
        )}

        {/* ── INTERACT BUTTON — Corvin (overworld traveling naturalist) ─── */}
        {scene === "overworld" && nearCorvin && phase === "walk" && (
          <button
            onClick={() => setPhase(corvinMet ? "corvin_idle" : "corvin_d1")}
            style={{
              position:"absolute",
              left: corvinInteractPos.sx - 14,
              top:  corvinInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#7a60c8", border:"2px solid #fff",
              color:"#f0e8ff", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}>{corvinMet ? "…" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Ellio ───────────────────────────────────── */}
        {scene === "ellio" && nearEllio && phase === "walk" && (
          <button
            onClick={() => setPhase(ellioDone ? "ellio_idle" : (hasResonanceStone ? "ellio_done" : "ellio_d1"))}
            style={{
              position:"absolute",
              left: ellioInteractPos.sx - 14,
              top:  ellioInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#a8e878", border:"2px solid #fff",
              color:"#1a2a08", fontSize:16, fontWeight:900,
              cursor:"pointer", zIndex:10,
              display:"flex", alignItems:"center", justifyContent:"center",
              animation:"bounce 0.7s ease-in-out infinite",
            }}>{ellioDone ? "…" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Lia ─────────────────────────────────────── */}
        {scene === "lia" && nearLia && phase === "walk" && (
          <button
            onClick={() => setPhase(liaDone ? "lia_idle" : (hasHearthberries ? "lia_done" : "lia_d1"))}
            style={{
              position:"absolute",
              left: liaInteractPos.sx - 14,
              top:  liaInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#ff7a44", border:"2px solid #fff",
              color:"#2a0800", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}>{liaDone ? "…" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Jay (Area 3 trainer) ────────────────────── */}
        {scene === "area3" && nearJayA3 && phase === "walk" && (
          <button
            onClick={() => setPhase(jayA3Wins > 0 ? "jay_a3_d3" : "jay_a3_d1")}
            style={{
              position:"absolute",
              left: jayA3InteractPos.sx - 14,
              top:  jayA3InteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#6090e0", border:"2px solid #fff",
              color:"#0a1030", fontSize:14, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{jayA3Wins > 0 ? "↺" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Lia (Area 3 trainer) ─────────────────────── */}
        {scene === "area3" && nearLiaA3 && phase === "walk" && (
          <button
            onClick={() => setPhase(liaA3Wins > 0 ? "lia_a3_d3" : "lia_a3_d1")}
            style={{
              position:"absolute",
              left: liaA3InteractPos.sx - 14,
              top:  liaA3InteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#ff7a44", border:"2px solid #fff",
              color:"#2a0800", fontSize:14, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{liaA3Wins > 0 ? "↺" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Jerbs (Area 3 demo NPC) ───────────────── */}
        {scene === "area3" && nearJerbs && phase === "walk" && (
          <button
            onClick={() => {
              if (!cleminusMet) { setPhase("jerbs_appear"); return; }
              const beatBoth = jayA3Wins > 0 && liaA3Wins > 0;
              if (demoComplete) setPhase("jerbs_a3_idle");
              else if (beatBoth) setPhase("jerbs_return_d1");
              else setPhase("jerbs_remind");
            }}
            style={{
              position:"absolute",
              left: jerbsInteractPos.sx - 14, top: jerbsInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#c8a030", border:"2px solid #fff",
              color:"#1a0c00", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{!cleminusMet ? "!" : demoComplete ? "…" : (jayA3Wins > 0 && liaA3Wins > 0) ? "!" : "?"}</button>
        )}

        {/* ── INTERACT BUTTON — Old Hollis (Eastern Path farmer) ────────── */}
        {scene === "route2" && nearFarmerR2 && phase === "walk" && (
          <button
            onClick={() => setPhase(hollisGifted ? "farm_idle" : "farm_d1")}
            style={{
              position:"absolute",
              left: farmerR2InteractPos.sx - 14, top: farmerR2InteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#8ec850", border:"2px solid #fff",
              color:"#13200a", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── INTERACT BUTTONS — Farm NPCs (Shella / Runrik / Maren) ──── */}
        {scene === "farm" && nearShella && phase === "walk" && (
          <button onClick={() => setPhase(farmShellsGiven ? "shella_idle" : "shella_d1")}
            style={{ position:"absolute", left: shellaInteractPos.sx - 14, top: shellaInteractPos.sy - 10, width:28, height:28, borderRadius:"50%", background:"#f5c842", border:"2px solid #fff", color:"#13200a", fontSize:16, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite", zIndex:10 }}
          >!</button>
        )}
        {scene === "farm" && nearRunrik && phase === "walk" && (
          <button onClick={() => setPhase(farmRunesGiven ? "runrik_idle" : "runrik_d1")}
            style={{ position:"absolute", left: runrikInteractPos.sx - 14, top: runrikInteractPos.sy - 10, width:28, height:28, borderRadius:"50%", background:"#8090f0", border:"2px solid #fff", color:"#fff", fontSize:16, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite", zIndex:10 }}
          >!</button>
        )}
        {scene === "farm" && nearMaren && phase === "walk" && (
          <button onClick={() => setPhase(marenGifted ? "maren_idle" : "maren_d1")}
            style={{ position:"absolute", left: marenInteractPos.sx - 14, top: marenInteractPos.sy - 10, width:28, height:28, borderRadius:"50%", background:"#90c060", border:"2px solid #fff", color:"#fff", fontSize:16, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite", zIndex:10 }}
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Prof. Irwyn (Tidemark Shore) ──────────── */}
        {scene === "shore" && nearProfShore && phase === "walk" && (
          <button
            onClick={() => {
              if (profShoreWins === 0) {
                setPhase("prof_shore_d1");
              } else if (profShoreWins > 0) {
                setPhase("prof_shore_idle");
              } else {
                setPhase("prof_shore_done");
              }
            }}
            style={{
              position:"absolute",
              left: profShoreInteractPos.sx - 14, top: profShoreInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#4080e0", border:"2px solid #fff",
              color:"#fff", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite", zIndex:10,
            }}
          >{profShoreWins === 0 ? "!" : "↺"}</button>
        )}

        {/* ── INTERACT BUTTON — Jess ────────────────────────────────────── */}
        {scene === "home" && nearJess && phase === "walk" && (
          <button
            onClick={() => setPhase(jessDone ? "jess_idle" : "jess_d1")}
            style={{
              position:"absolute",
              left: jessInteractPos.sx - 14,
              top:  jessInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#f0a050", border:"2px solid #fff",
              color:"#3a1200", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >{jessDone ? "…" : "!"}</button>
        )}

        {/* ── INTERACT BUTTON — Shell pickup ────────────────────────────── */}
        {scene === "maya" && nearShell && !shellsCollected && phase === "walk" && (
          <button
            onClick={() => {
              setShellsCollected(true);
              setShellCount(c => c + 24);
              setPickupNotif(true);
              setTimeout(() => setPickupNotif(false), 2800);
            }}
            style={{
              position:"absolute",
              left: shellInteractPos.sx - 14,
              top:  shellInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background:"#50dcc0", border:"2px solid #fff",
              color:"#0a2018", fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── RUNE PICKUP NOTIFICATION ─────────────────────────────────── */}
        {runeNotif && (
          <div style={{
            position:"absolute", top:"38%", left:"50%",
            background:"rgba(4,12,4,0.96)",
            border:"1.5px solid rgba(80,200,80,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,200,80,0.25)",
            animation:"notifPop 0.4s ease-out forwards",
          }}>
            <img src="/__mockup/images/obsidian-healing-rune.png" alt="Obsidian Healing Rune"
              style={{ width:42, height:42, borderRadius:8, flexShrink:0, objectFit:"contain",
                filter:"drop-shadow(0 0 8px rgba(120,80,220,0.65))" }}
            />
            <div>
              <div style={{ color:"#80d080", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>
                Item Received!
              </div>
              <div style={{ color:"#e8dcc8", fontSize:12, marginTop:3, fontWeight:600 }}>
                Obsidian Healing Rune ×1
              </div>
            </div>
          </div>
        )}

        {/* ── RESONANCE STONE NOTIFICATION ─────────────────────────────── */}
        {resonanceNotif && (
          <div style={{
            position:"absolute", top:"38%", left:"50%",
            background:"rgba(4,14,4,0.97)",
            border:"1.5px solid rgba(80,180,240,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,160,240,0.25)",
            animation:"notifPop 0.4s ease-out forwards",
          }}>
            <img src="/__mockup/images/resonance-stone.png" alt="Resonance Stone" style={{
              width:42, height:42, objectFit:"contain", flexShrink:0,
              filter:"drop-shadow(0 0 8px rgba(80,160,240,0.7))",
            }}/>
            <div>
              <div style={{ color:"#80c0f8", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>
                Item Received!
              </div>
              <div style={{ color:"#e8dcc8", fontSize:12, marginTop:3, fontWeight:600 }}>
                Resonance Stone ×1
              </div>
            </div>
          </div>
        )}

        {/* ── LIA ITEMS NOTIFICATION ───────────────────────────────────── */}
        {liaItemsNotif && (
          <div style={{
            position:"absolute", top:"38%", left:"50%",
            background:"rgba(18,6,2,0.97)",
            border:"1.5px solid rgba(255,120,60,0.65)",
            borderRadius:14, padding:"14px 18px",
            display:"flex", flexDirection:"column", gap:10,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(255,100,40,0.25)",
            minWidth:210,
            animation:"notifPop 0.4s ease-out forwards",
          }}>
            <div style={{ color:"#ff8855", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>
              Items Received!
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <img src="/__mockup/images/hearthberry.png" alt="Hearthberry"
                style={{ width:34, height:34, objectFit:"contain", flexShrink:0 }}/>
              <div style={{ color:"#e8dcc8", fontSize:12, fontWeight:600 }}>
                Hearthberry ×10
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <img src="/__mockup/images/keepers-satchel.png" alt="Keeper's Satchel"
                style={{ width:34, height:34, objectFit:"contain", flexShrink:0 }}/>
              <div style={{ color:"#e8dcc8", fontSize:12, fontWeight:600 }}>
                Keeper's Satchel ×1
              </div>
            </div>
          </div>
        )}

        {/* ── ITEM PICKUP NOTIFICATION ─────────────────────────────────── */}
        {pickupNotif && (
          <div style={{
            position:"absolute", top:"38%", left:"50%",
            background:"rgba(6,18,12,0.96)",
            border:"1.5px solid rgba(80,220,180,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,220,180,0.25)",
            animation:"notifPop 0.4s ease-out forwards",
          }}>
            <img src="/__mockup/images/weathered-shell.png" alt=""
              style={{ width:42, height:42, objectFit:"contain" }}/>
            <div>
              <div style={{ color:"#50dcc0", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>
                Item Received!
              </div>
              <div style={{ color:"#e8dcc8", fontSize:12, marginTop:3, fontWeight:600 }}>
                Weathered Realm Shell ×24
              </div>
            </div>
          </div>
        )}

        {/* ── DIALOG BOX (viewport-relative bottom strip) ──────────────── */}
        {(phase === "d1" || phase === "d2" || phase === "d3" || phase === "d4" || phase === "d5") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(8,5,2,0.97),rgba(12,8,3,0.93))",
            borderTop:"2px solid rgba(240,208,80,0.5)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            {/* Prof portrait + name */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas
                ref={portraitCanvasRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#100a02", border:"1px solid rgba(240,208,80,0.4)" }}
              />
              <span style={{ color:"#f0d060", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                PROF. IRWYN
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  // After "wonderful choice", the Professor asks you to declare
                  // your path — open the role picker instead of going to d4.
                  if (phase === "d3") setPhase("role_pick");
                  else advanceDialog(phase);
                }}
                style={{
                  background:"rgba(240,208,50,0.15)",
                  border:"1px solid rgba(240,208,50,0.5)",
                  color:"#f0d060", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "d5" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── JAY DIALOG BOX ───────────────────────────────────────────── */}
        {(phase === "jay_d1" || phase === "jay_d2" || phase === "jay_d3" || phase === "jay_d4" || phase === "jay_d5" || phase === "jay_done") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(4,8,18,0.97),rgba(6,10,24,0.93))",
            borderTop:"2px solid rgba(80,130,220,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={jayPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#060810", border:"1px solid rgba(80,130,220,0.4)" }}
              />
              <span style={{ color:"#8ab0f0", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                JAY
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "jay_d5") {
                    setPhase("walk");
                    setHasHealingRune(true);
                    setRuneNotif(true);
                    setTimeout(() => setRuneNotif(false), 3200);
                  } else if (phase === "jay_done") {
                    setPhase("walk");
                    setJayDone(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(80,130,220,0.15)",
                  border:"1px solid rgba(80,130,220,0.5)",
                  color:"#8ab0f0", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{(phase === "jay_d5" || phase === "jay_done") ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── MAYA DIALOG BOX ──────────────────────────────────────────── */}
        {(phase === "maya_d1" || phase === "maya_d2" || phase === "maya_d3" || phase === "maya_d4" || phase === "maya_post1" || phase === "maya_post2" || phase === "maya_post3") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(4,12,8,0.97),rgba(6,16,10,0.93))",
            borderTop:"2px solid rgba(80,180,120,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={mayaPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#060e08", border:"1px solid rgba(80,180,120,0.4)" }}
              />
              <span style={{ color:"#80d0a0", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                MAYA
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "maya_d4") {
                    advanceDialog(phase); // → "walk"
                    setMayaInitDone(true);
                  } else if (phase === "maya_post3") {
                    setPhase("walk");
                    setMayaDone(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(80,180,120,0.15)",
                  border:"1px solid rgba(80,180,120,0.5)",
                  color:"#80d0a0", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{(phase === "maya_d4" || phase === "maya_post3") ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── JESS DIALOG BOX ──────────────────────────────────────────── */}
        {(phase === "jess_d1" || phase === "jess_d2" || phase === "jess_d3") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(18,8,3,0.97),rgba(24,10,4,0.93))",
            borderTop:"2px solid rgba(240,160,80,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={jessPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#120602", border:"1px solid rgba(240,160,80,0.4)" }}
              />
              <span style={{ color:"#f0b070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                {partnerName.toUpperCase()}
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "jess_d3") {
                    setPhase("walk");
                    setJessDone(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(240,160,80,0.15)",
                  border:"1px solid rgba(240,160,80,0.5)",
                  color:"#f0b070", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "jess_d3" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── JESS PATH DIALOG (town intercept) ────────────────────────── */}
        {(phase === "jess_path_d1" || phase === "jess_path_d2") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(18,8,3,0.97),rgba(24,10,4,0.93))",
            borderTop:"2px solid rgba(240,160,80,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={jessPathPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#120602", border:"1px solid rgba(240,160,80,0.4)" }}
              />
              <span style={{ color:"#f0b070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                {partnerName.toUpperCase()}
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "jess_path_d2") {
                    // Fade out, wife heads home, east path unlocks
                    fadingRef.current = true; setFading(true);
                    window.setTimeout(() => {
                      setWifeOnPath(false);
                      setWifeIntercepted(true);
                      setPhase("walk");
                      window.setTimeout(() => { fadingRef.current = false; setFading(false); }, 450);
                    }, 450);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(240,160,80,0.15)",
                  border:"1px solid rgba(240,160,80,0.5)",
                  color:"#f0b070", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "jess_path_d2" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── PROF IRWYN — ROUTE 2 DIALOG ──────────────────────────────── */}
        {(phase === "prof2_d1" || phase === "prof2_d2" || phase === "prof2_d3" || phase === "prof2_d4") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(20,12,2,0.97),rgba(26,16,4,0.93))",
            borderTop:"2px solid rgba(240,200,90,0.6)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={profR2PortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#140c02", border:"1px solid rgba(240,200,90,0.4)" }}
              />
              <span style={{ color:"#f0d070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                PROF. IRWYN
              </span>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "prof2_d3") {
                    setHasObsidianRealmShell(true);
                    advanceDialog(phase);
                  } else if (phase === "prof2_d4") {
                    setPhase("walk");
                    setProfRoute2Done(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(240,200,90,0.15)",
                  border:"1px solid rgba(240,200,90,0.5)",
                  color:"#f0d070", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "prof2_d3" ? "Take the Shell ☯" : phase === "prof2_d4" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── OLD HOLLIS — Eastern Path farmer (flavor + berry gift dialogue) ── */}
        {(phase === "farm_d1" || phase === "farm_d2" || phase === "farm_d3" || phase === "farm_d4" || phase === "farm_idle") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(12,20,6,0.97),rgba(16,26,8,0.93))",
            borderTop:"2px solid rgba(150,200,90,0.6)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ marginBottom:8 }}>
              <span style={{ color:"#bfe080", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                OLD HOLLIS
              </span>
            </div>
            <p style={{ color:"#e6ecd8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "farm_d4") {
                    setHollisGifted(true);
                    setDuskberries(n => n + 3);
                    setThornberries(n => n + 3);
                    setCalmberries(n => n + 3);
                    setBrightberries(n => n + 3);
                    setPhase("walk");
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(150,200,90,0.15)",
                  border:"1px solid rgba(150,200,90,0.5)",
                  color:"#bfe080", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "farm_d4" ? "Take Berries ✦" : phase === "farm_idle" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── SHELLA — shell vendor dialogue ─────────────────────────────── */}
        {(phase === "shella_d1" || phase === "shella_d2" || phase === "shella_d3" || phase === "shella_done" || phase === "shella_idle") && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top,rgba(14,10,2,0.97),rgba(20,14,4,0.93))", borderTop:"2px solid rgba(245,200,66,0.6)", padding:"10px 14px 14px", zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <img src={SHELLA_IMG} alt="Shella" style={{ width:44, height:44, borderRadius:8, objectFit:"contain", border:"1px solid rgba(245,200,66,0.4)" }}/>
              <span style={{ color:"#f5c842", fontWeight:700, fontSize:13, letterSpacing:1 }}>SHELLA</span>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>{LINES[phase]}</p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => advanceDialog(phase)} style={{ background:"rgba(245,200,66,0.15)", border:"1px solid rgba(245,200,66,0.5)", color:"#f5c842", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {phase === "shella_d3" ? "See Shells ▶" : phase === "shella_done" || phase === "shella_idle" ? "OK" : "Next ▶"}
              </button>
            </div>
          </div>
        )}

        {/* ── RUNRIK — rune forger dialogue ───────────────────────────────── */}
        {(phase === "runrik_d1" || phase === "runrik_d2" || phase === "runrik_d3" || phase === "runrik_d4" || phase === "runrik_done" || phase === "runrik_idle") && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top,rgba(8,8,20,0.97),rgba(12,12,26,0.93))", borderTop:"2px solid rgba(128,144,240,0.6)", padding:"10px 14px 14px", zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <img src={RUNRIK_IMG} alt="Runrik" style={{ width:44, height:44, borderRadius:8, objectFit:"contain", border:"1px solid rgba(128,144,240,0.4)" }}/>
              <span style={{ color:"#8090f0", fontWeight:700, fontSize:13, letterSpacing:1 }}>RUNRIK</span>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>{LINES[phase]}</p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => {
                if (phase === "runrik_d4") {
                  setFarmRunesGiven(true);
                  advanceDialog(phase);
                } else {
                  advanceDialog(phase);
                }
              }} style={{ background:"rgba(128,144,240,0.15)", border:"1px solid rgba(128,144,240,0.5)", color:"#8090f0", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {phase === "runrik_d3" ? "Pick a Rune ▶" : phase === "runrik_d4" ? "Thanks!" : phase === "runrik_done" || phase === "runrik_idle" ? "OK" : "Next ▶"}
              </button>
            </div>
          </div>
        )}

        {/* ── MAREN — creature keeper dialogue ────────────────────────────── */}
        {(phase === "maren_d1" || phase === "maren_d2" || phase === "maren_done" || phase === "maren_idle") && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top,rgba(4,12,4,0.97),rgba(6,16,6,0.93))", borderTop:"2px solid rgba(144,192,96,0.6)", padding:"10px 14px 14px", zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <img src={MAREN_IMG} alt="Maren" style={{ width:44, height:44, borderRadius:8, objectFit:"contain", border:"1px solid rgba(144,192,96,0.4)" }}/>
              <span style={{ color:"#90c060", fontWeight:700, fontSize:13, letterSpacing:1 }}>MAREN</span>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>{LINES[phase]}</p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => {
                if (phase === "maren_d2" && !marenGifted) {
                  setMarenGifted(true);
                  setHasCrucibyx(true);
                  const cruciSpec = { id:"crucibyx", name:"Crucibyx", type:"alchemy" as const, color:"#90c060", rarity:"rare" as const, img:"/__mockup/images/crucibyx.png", wildImg:"/__mockup/images/crucibyx.png", playerImg:"/__mockup/images/crucibyx.png", wildFaces:"right" as const, playerFaces:"right" as const, maxHp:40, baseDmg:[8,12] as [number,number] };
                  setCaughtParty(p => [...p, { ...cruciSpec, level:5, xp:0 }]);
                }
                advanceDialog(phase);
              }} style={{ background:"rgba(144,192,96,0.15)", border:"1px solid rgba(144,192,96,0.5)", color:"#90c060", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {phase === "maren_d2" && !marenGifted ? "Meet Cruci! ✦" : phase === "maren_done" || phase === "maren_idle" ? "OK" : "Next ▶"}
              </button>
            </div>
          </div>
        )}

        {/* ── PROF IRWYN — Tidemark Shore challenger dialogue ─────────────── */}
        {(phase === "prof_shore_d1" || phase === "prof_shore_d2" || phase === "prof_shore_win" || phase === "prof_shore_lose" || phase === "prof_shore_idle" || phase === "prof_shore_done") && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top,rgba(10,16,30,0.97),rgba(14,20,38,0.93))", borderTop:"2px solid rgba(64,128,224,0.7)", padding:"10px 14px 14px", zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={profShorePortraitRef} width={44} height={44} style={{ width:44, height:44, borderRadius:8, background:"#08101e", border:"1px solid rgba(64,128,224,0.4)" }}/>
              <div>
                <span style={{ color:"#78aae8", fontWeight:700, fontSize:13, letterSpacing:1 }}>PROF. IRWYN</span>
                {primeriaCoin > 0 && <span style={{ marginLeft:10, color:"#f0c830", fontSize:11, fontWeight:700 }}>₡{primeriaCoin}</span>}
              </div>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {phase === "prof_shore_d1" && "Ah — a Keeper who made it to Tidemark Shore. The waves here test the spirit. I've been waiting for someone worth challenging."}
              {phase === "prof_shore_d2" && `Before we begin, take ${SHORE_COIN_GIFT} PrimeriaCoin. Win or lose — it's yours. Consider it funding for your journey. Now, shall we?`}
              {phase === "prof_shore_win" && (profShoreWins >= 1 ? "Exceptional. You've bested my team. Take the Resonance Rune — you've more than earned it." : "Well done. Very well done. Your Tayanari fight with real conviction.")}
              {phase === "prof_shore_lose" && "A fine battle. The shore will humble you — that's its gift. Come back whenever you're ready to try again."}
              {phase === "prof_shore_idle" && "The tide turns on its own schedule. Challenge me whenever the moment feels right."}
              {phase === "prof_shore_done" && "You've proven yourself here. The sea beyond these cliffs holds deeper mysteries still — keep exploring."}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              {phase === "prof_shore_d2" ? (
                <button onClick={() => {
                  if (profShorePaid < 2) {
                    setPrimeriaCoin(c => c + SHORE_COIN_GIFT);
                    setProfShorePaid(p => p + 1);
                  }
                  const tier = profShoreTeam(profShoreWins, starterLevel);
                  setTrainerEncounter({ trainer: "prof", name: "Prof. Irwyn", team: tier.team, levels: tier.levels });
                  transitionTo("battle", worldPos.current.x, worldPos.current.y);
                }} style={{ background:"rgba(220,80,40,0.18)", border:"1px solid rgba(220,80,40,0.55)", color:"#e87050", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  ⚔ Battle!
                </button>
              ) : (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(64,128,224,0.15)", border:"1px solid rgba(64,128,224,0.5)", color:"#78aae8", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {phase === "prof_shore_win" || phase === "prof_shore_lose" || phase === "prof_shore_idle" || phase === "prof_shore_done" ? "OK" : "Next ▶"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PROF IRWYN — Realm Shell resupply (repeatable, post-Route 2) ─── */}
        {(phase === "prof_shells" || phase === "prof_shells_got") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(20,12,2,0.97),rgba(26,16,4,0.93))",
            borderTop:"2px solid rgba(240,200,90,0.6)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ marginBottom:8 }}>
              <span style={{ color:"#f0d070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                PROF. IRWYN
              </span>
            </div>
            <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              {phase === "prof_shells" && (
                <button
                  onClick={() => setPhase("prof_idle")}
                  style={{
                    background:"transparent",
                    border:"1px solid rgba(240,200,90,0.3)",
                    color:"#c8b888", padding:"6px 16px",
                    borderRadius:8, fontSize:13, fontWeight:600,
                    cursor:"pointer",
                  }}
                >Just talk</button>
              )}
              <button
                onClick={() => {
                  if (phase === "prof_shells") {
                    setShellCount(c => c + 10);
                    setPhase("prof_shells_got");
                  } else {
                    setPhase("walk");
                  }
                }}
                style={{
                  background:"rgba(240,200,90,0.15)",
                  border:"1px solid rgba(240,200,90,0.5)",
                  color:"#f0d070", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "prof_shells" ? "Take Shells ☯" : "OK"}</button>
            </div>
          </div>
        )}

        {/* ── SCRIPTED WYVRUNT CATCH ───────────────────────────────────── */}
        {(phase === "scripted_t1" || phase === "scripted_t2" || phase === "scripted_set" || phase === "scripted_caught") && (
          <>
            {/* Floating Wyvrunt above the dialog */}
            <div style={{
              position:"absolute", left:"50%", top:"20%",
              transform:"translateX(-50%)",
              width:150, textAlign:"center", zIndex:25, pointerEvents:"none",
            }}>
              <img
                src="/__mockup/images/wyvrunt.png"
                alt="Wyvrunt"
                style={{
                  width:140, height:140, objectFit:"contain",
                  filter:"drop-shadow(0 0 16px rgba(255,200,80,0.75)) drop-shadow(0 0 6px rgba(255,255,255,0.6))",
                  animation: phase === "scripted_set" ? "pulse 0.6s ease-in-out infinite" : "pulse 1.8s ease-in-out infinite",
                }}
              />
              <div style={{
                marginTop:-4, color:"#ffd060", fontSize:13, fontWeight:900, letterSpacing:1,
                textShadow:"0 0 6px #ffa030,0 0 12px #ff8020,0 0 3px #000",
              }}>WYVRUNT <span style={{ color:"#ffe080" }}>☯</span>
                <div style={{ fontSize:8, fontWeight:700, letterSpacing:1.5, color:"#ffbe60", marginTop:2 }}>
                  CHAOS · APEX
                </div>
              </div>
            </div>

            {/* Catch flash overlay during set / caught */}
            {(phase === "scripted_set" || phase === "scripted_caught") && (
              <div style={{
                position:"absolute", inset:0, zIndex:24, pointerEvents:"none",
                background: phase === "scripted_caught"
                  ? "radial-gradient(circle at 50% 28%, rgba(255,225,130,0.7) 0%, transparent 62%)"
                  : "radial-gradient(circle at 50% 28%, rgba(255,180,80,0.3) 0%, transparent 70%)",
                animation:"pulse 0.9s ease-in-out infinite",
              }}/>
            )}

            {/* Prof narration dialog */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0,
              background:"linear-gradient(to top,rgba(20,12,2,0.97),rgba(26,16,4,0.93))",
              borderTop:"2px solid rgba(240,200,90,0.6)",
              padding:"10px 14px 14px",
              zIndex:26, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <canvas ref={profR2PortraitRef}
                  style={{ width:44, height:44, borderRadius:8,
                    background:"#140c02", border:"1px solid rgba(240,200,90,0.4)" }}
                />
                <span style={{ color:"#f0d070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                  PROF. IRWYN
                </span>
              </div>
              <p style={{ color:"#ece0c8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
                {LINES[phase]}
              </p>
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <button
                  onClick={() => {
                    if (phase === "scripted_set") {
                      window.setTimeout(() => setPhase("scripted_caught"), 650);
                    } else if (phase === "scripted_caught") {
                      fadingRef.current = true; setFading(true);
                      window.setTimeout(() => {
                        setWyvruntCaught(true);
                        addCaughtMon(WYVRUNT_SPEC, true, 10); // story creature — level 10 baby form
                        // Seed the follower beside the player so it activates in-place
                        breadcrumbsRef.current   = [];
                        followPosRef.current     = {
                          x: worldPos.current.x,
                          y: worldPos.current.y + 24,
                        };
                        followAnimRef.current    = "idle_down";
                        followLastDirRef.current = "idle_down";
                        followFrameRef.current   = 0;
                        followFlipRef.current    = false;
                        followLastSrc.current    = "";
                        setPhase("walk");
                        window.setTimeout(() => { fadingRef.current = false; setFading(false); }, 450);
                      }, 450);
                    } else {
                      advanceDialog(phase);
                    }
                  }}
                  style={{
                    background:"rgba(240,200,90,0.18)",
                    border:"1px solid rgba(240,200,90,0.55)",
                    color:"#f5d878", padding:"6px 18px",
                    borderRadius:8, fontSize:13, fontWeight:700,
                    cursor:"pointer",
                  }}
                >{
                  phase === "scripted_set" ? "Set Obsidianeye Shell ☯"
                  : phase === "scripted_caught" ? "OK"
                  : "Next ▶"
                }</button>
              </div>
            </div>
          </>
        )}

        {/* ── EAST GATE / LOCKED NOTICES ───────────────────────────────── */}
        {(eastGateNotif || lockedDoorNotif) && (
          <div style={{
            position:"absolute", top:"44%", left:"50%",
            transform:"translate(-50%,-50%)",
            background:"rgba(8,6,3,0.94)",
            border:"1.5px solid rgba(240,200,90,0.55)",
            borderRadius:12, padding:"10px 18px",
            color:"#f0d8a0", fontSize:12, fontWeight:600,
            zIndex:60, pointerEvents:"none", textAlign:"center", maxWidth:260,
            boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          }}>
            {eastGateNotif
              ? "A quiet pull holds you back — better not head east just yet."
              : lockedDoorNotif}
          </div>
        )}

        {/* ── ELLIO DIALOG BOX ─────────────────────────────────────────── */}
        {(phase === "ellio_d1" || phase === "ellio_d2" || phase === "ellio_d3" || phase === "ellio_done") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(4,14,4,0.97),rgba(6,18,6,0.93))",
            borderTop:"2px solid rgba(120,200,80,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={ellioPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#040e04", border:"1px solid rgba(120,200,80,0.4)" }}
              />
              <span style={{ color:"#a8e070", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                ELLIO
              </span>
              <span style={{ color:"#6a9048", fontSize:9, fontWeight:600, letterSpacing:0.8, marginLeft:2 }}>
                · Aspiring Merchant
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "ellio_d3") {
                    setPhase("walk");
                    setHasResonanceStone(true);
                    setResonanceNotif(true);
                    setTimeout(() => setResonanceNotif(false), 3200);
                  } else if (phase === "ellio_done") {
                    setPhase("walk");
                    setEllioDone(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(120,200,80,0.12)",
                  border:"1px solid rgba(120,200,80,0.45)",
                  color:"#a8e070", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{(phase === "ellio_d3" || phase === "ellio_done") ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── LIA DIALOG BOX ───────────────────────────────────────────── */}
        {(phase === "lia_d1" || phase === "lia_d2" || phase === "lia_d3" || phase === "lia_d4" || phase === "lia_d5" || phase === "lia_done") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(18,5,2,0.97),rgba(24,7,3,0.93))",
            borderTop:"2px solid rgba(255,110,50,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={liaPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#120400", border:"1px solid rgba(255,110,50,0.4)" }}
              />
              <span style={{ color:"#ff9060", fontWeight:700, fontSize:13, letterSpacing:1 }}>
                LIA
              </span>
              <span style={{ color:"#8a4828", fontSize:9, fontWeight:600, letterSpacing:0.8, marginLeft:2 }}>
                · Keeper · Stone-Flame
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => {
                  if (phase === "lia_d5") {
                    setPhase("walk");
                    setHasHearthberries(true);
                    setHasSatchel(true);
                    setLiaDone(true);
                    setLiaItemsNotif(true);
                    setTimeout(() => setLiaItemsNotif(false), 3500);
                  } else if (phase === "lia_done") {
                    setPhase("walk");
                    setLiaDone(true);
                  } else {
                    advanceDialog(phase);
                  }
                }}
                style={{
                  background:"rgba(255,110,50,0.12)",
                  border:"1px solid rgba(255,110,50,0.45)",
                  color:"#ff9060", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{(phase === "lia_d5" || phase === "lia_done") ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── JAY A3 DIALOG BOX ────────────────────────────────────────── */}
        {(phase === "jay_a3_d1" || phase === "jay_a3_d2" || phase === "jay_a3_d3"
          || phase === "jay_a3_win" || phase === "jay_a3_lose") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(4,8,18,0.97),rgba(6,10,24,0.93))",
            borderTop:"2px solid rgba(80,130,220,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={jayPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#060810", border:"1px solid rgba(80,130,220,0.4)" }}
              />
              <span style={{ color:"#8ab0f0", fontWeight:700, fontSize:13, letterSpacing:1 }}>JAY</span>
              <span style={{ color:"#3a5080", fontSize:9, fontWeight:600, letterSpacing:0.8, marginLeft:2 }}>
                · Rival · {jayA3Wins === 0 ? "Undefeated" : `${jayA3Wins}W`}
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              {(phase === "jay_a3_win" || phase === "jay_a3_lose") ? (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(80,130,220,0.15)", border:"1px solid rgba(80,130,220,0.5)",
                    color:"#8ab0f0", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >OK</button>
              ) : phase === "jay_a3_d3" ? (
                <button
                  onClick={() => {
                    const tier = jayA3Team(jayA3Wins, starterLevel);
                    setTrainerEncounter({ trainer:"jay", name:"Jay", team:tier.team, levels:tier.levels });
                    transitionTo("battle", worldPos.current.x, worldPos.current.y);
                  }}
                  style={{ background:"rgba(220,60,40,0.18)", border:"1px solid rgba(220,60,40,0.55)",
                    color:"#e87050", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Battle!</button>
              ) : (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(80,130,220,0.15)", border:"1px solid rgba(80,130,220,0.5)",
                    color:"#8ab0f0", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              )}
            </div>
          </div>
        )}

        {/* ── LIA A3 DIALOG BOX ─────────────────────────────────────────── */}
        {(phase === "lia_a3_d1" || phase === "lia_a3_d2" || phase === "lia_a3_d3"
          || phase === "lia_a3_win" || phase === "lia_a3_lose") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(18,5,2,0.97),rgba(24,7,3,0.93))",
            borderTop:"2px solid rgba(255,110,50,0.55)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <canvas ref={liaPortraitRef}
                style={{ width:44, height:44, borderRadius:8,
                  background:"#120400", border:"1px solid rgba(255,110,50,0.4)" }}
              />
              <span style={{ color:"#ff9060", fontWeight:700, fontSize:13, letterSpacing:1 }}>LIA</span>
              <span style={{ color:"#8a4828", fontSize:9, fontWeight:600, letterSpacing:0.8, marginLeft:2 }}>
                · Keeper · {liaA3Wins === 0 ? "Undefeated" : `${liaA3Wins}W`}
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              {(phase === "lia_a3_win" || phase === "lia_a3_lose") ? (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(255,110,50,0.12)", border:"1px solid rgba(255,110,50,0.45)",
                    color:"#ff9060", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >OK</button>
              ) : phase === "lia_a3_d3" ? (
                <button
                  onClick={() => {
                    const tier = liaA3Team(liaA3Wins, starterLevel);
                    setTrainerEncounter({ trainer:"lia", name:"Lia", team:tier.team, levels:tier.levels });
                    transitionTo("battle", worldPos.current.x, worldPos.current.y);
                  }}
                  style={{ background:"rgba(220,60,40,0.18)", border:"1px solid rgba(220,60,40,0.55)",
                    color:"#e87050", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Battle!</button>
              ) : (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(255,110,50,0.12)", border:"1px solid rgba(255,110,50,0.45)",
                    color:"#ff9060", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              )}
            </div>
          </div>
        )}

        {/* ── JERBS DIALOG BOX ──────────────────────────────────────────── */}
        {(phase === "jerbs_appear" || phase === "jerbs_d1" || phase === "jerbs_d2"
          || phase === "jerbs_d3" || phase === "jerbs_d4"
          || phase === "jerbs_remind" || phase === "jerbs_return_d1" || phase === "jerbs_return_d2") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(8,5,2,0.97),rgba(18,11,3,0.93))",
            borderTop:"2px solid rgba(190,140,40,0.6)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              {/* Jerbs portrait — jerbeen sprite sheet clip, row 1 col 2 */}
              <div style={{
                width:36, height:60, borderRadius:6, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(190,140,40,0.4)",
                backgroundImage:"url(/__mockup/images/jerbs_sprite.png)",
                backgroundSize:`${36 * 5}px auto`,
                backgroundPosition:`${-36 * 2}px ${-Math.round(36 * JERBS_FH / JERBS_FW)}px`,
                backgroundRepeat:"no-repeat",
              }}/>
              <div>
                <span style={{ color:"#e8b840", fontWeight:700, fontSize:13, letterSpacing:1 }}>JERBS</span>
                <div style={{ color:"#7a6020", fontSize:9, fontWeight:600, letterSpacing:0.8 }}>
                  Clandestine Jerbeen · Traveler
                </div>
              </div>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              {phase === "jerbs_appear" ? (
                <button
                  onClick={() => { setPortalOpen(false); setCleminusMet(true); setPhase("jerbs_d1"); }}
                  style={{ background:"rgba(190,140,40,0.15)", border:"1px solid rgba(190,140,40,0.5)",
                    color:"#e8b840", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              ) : phase === "jerbs_remind" ? (
                <button
                  onClick={() => { setCleminusMet(true); setPhase("walk"); }}
                  style={{ background:"rgba(190,140,40,0.15)", border:"1px solid rgba(190,140,40,0.5)",
                    color:"#e8b840", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >OK</button>
              ) : (phase === "jerbs_d3" || phase === "jerbs_return_d2") ? (
                <button
                  onClick={() => {
                    if (jayA3Wins > 0 && liaA3Wins > 0) {
                      setShowCardIndex(0);
                      setPhase("jerbs_cards");
                    } else {
                      setCleminusMet(true);
                      setPhase("jerbs_remind");
                    }
                  }}
                  style={{ background:"rgba(190,140,40,0.15)", border:"1px solid rgba(190,140,40,0.5)",
                    color:"#e8b840", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              ) : (
                <button onClick={() => advanceDialog(phase)}
                  style={{ background:"rgba(190,140,40,0.15)", border:"1px solid rgba(190,140,40,0.5)",
                    color:"#e8b840", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              )}
            </div>
          </div>
        )}

        {/* ── JERBS TRIAL CARDS OVERLAY ─────────────────────────────────── */}
        {phase === "jerbs_cards" && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(4,2,0,0.94)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", zIndex:30, gap:10, overflow:"hidden",
          }}>
            <div style={{ color:"#e8b840", fontSize:12, fontWeight:700, letterSpacing:2, marginBottom:2, textAlign:"center" }}>
              JERBS: "Here. Your credentials. Official. Signed."
            </div>
            <div style={{
              display:"flex", gap:14, alignItems:"flex-start", justifyContent:"center",
              maxWidth:"100%", padding:"0 8px",
            }}>
              {/* Keeper Trial Card with player sprite */}
              <div style={{ position:"relative", width:180, flexShrink:0 }}>
                <img src="/__mockup/images/keeper_trial_card.png"
                  style={{ width:180, display:"block", borderRadius:4 }} alt="Keeper Trial Card"/>
                {/* Player sprite in photo slot */}
                <img
                  src={`/__mockup/images/${CHAR_IMG_KEY[characterId]}_front_idle.png`}
                  style={{
                    position:"absolute",
                    left: Math.round(88 * 180 / 1024),
                    top:  Math.round(233 * 180 / 1024),
                    width: Math.round(283 * 180 / 1024),
                    height: Math.round(320 * 180 / 1024),
                    objectFit:"cover", objectPosition:"center top",
                    mixBlendMode:"multiply",
                  }}
                  alt=""
                />
              </div>
              {/* Elder Trial Card */}
              <div style={{ position:"relative", width:180, flexShrink:0 }}>
                <img src="/__mockup/images/elder_trial_card.png"
                  style={{ width:180, display:"block", borderRadius:4 }} alt="Elder Trial Card"/>
              </div>
            </div>
            <button
              onClick={() => setPhase("jerbs_d4")}
              style={{
                marginTop:8,
                background:"linear-gradient(135deg,rgba(190,140,40,0.22),rgba(120,90,20,0.22))",
                border:"2px solid rgba(190,140,40,0.7)",
                color:"#e8b840", padding:"10px 28px",
                borderRadius:12, fontSize:13, fontWeight:800,
                cursor:"pointer", letterSpacing:1,
              }}
            >Accept Trial Licenses ✦</button>
          </div>
        )}

        {/* ── JERBS BATTLE INTRO ────────────────────────────────────────── */}
        {phase === "jerbs_battle_intro" && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(8,5,2,0.97),rgba(18,11,3,0.93))",
            borderTop:"2px solid rgba(190,140,40,0.6)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{
                width:36, height:60, borderRadius:6, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(190,140,40,0.4)",
                backgroundImage:"url(/__mockup/images/jerbs_sprite.png)",
                backgroundSize:`${36 * 5}px auto`,
                backgroundPosition:`${-36 * 2}px ${-Math.round(36 * JERBS_FH / JERBS_FW)}px`,
                backgroundRepeat:"no-repeat",
              }}/>
              <div>
                <span style={{ color:"#e8b840", fontWeight:700, fontSize:13, letterSpacing:1 }}>JERBS</span>
                <div style={{ color:"#7a6020", fontSize:9, fontWeight:600, letterSpacing:0.8 }}>
                  Clandestine Jerbeen · Traveler
                </div>
              </div>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES["jerbs_battle_intro"]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              {jerbsBattleDone ? (
                <button
                  onClick={() => setPhase(hasCrystalFang ? "demo_end" : "jerbs_crystal_d1")}
                  style={{ background:"rgba(190,140,40,0.15)", border:"1px solid rgba(190,140,40,0.5)",
                    color:"#e8b840", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Next ▶</button>
              ) : (
                <button
                  onClick={() => {
                    setTrainerEncounter({ trainer:"jerbs", name:"Jerbs",
                      team:[TR_CRYSTALFANG, TR_CINDRAX],
                      levels:[Math.min(28, Math.max(22, starterLevel + 5)), Math.min(30, Math.max(24, starterLevel + 7))] });
                    transitionTo("battle", worldPos.current.x, worldPos.current.y);
                  }}
                  style={{ background:"rgba(220,60,40,0.18)", border:"1px solid rgba(220,60,40,0.55)",
                    color:"#e87050", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
                >Battle! ⚔</button>
              )}
            </div>
          </div>
        )}

        {/* ── JERBS CRYSTALFANG DIALOGUE ────────────────────────────────── */}
        {(phase === "jerbs_crystal_d1" || phase === "jerbs_crystal_d2" || phase === "jerbs_crystal_d3") && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(to top,rgba(4,8,20,0.97),rgba(8,14,30,0.93))",
            borderTop:"2px solid rgba(100,180,255,0.5)",
            padding:"10px 14px 14px",
            zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{
                width:36, height:60, borderRadius:6, overflow:"hidden", flexShrink:0,
                border:"1px solid rgba(100,180,255,0.4)",
                backgroundImage:"url(/__mockup/images/jerbs_sprite.png)",
                backgroundSize:`${36 * 5}px auto`,
                backgroundPosition:`${-36 * 2}px ${-Math.round(36 * JERBS_FH / JERBS_FW)}px`,
                backgroundRepeat:"no-repeat",
              }}/>
              <div>
                <span style={{ color:"#7de8ff", fontWeight:700, fontSize:13, letterSpacing:1 }}>JERBS</span>
                <div style={{ color:"#2a5070", fontSize:9, fontWeight:600, letterSpacing:0.8 }}>
                  Clandestine Jerbeen · Traveler
                </div>
              </div>
            </div>
            <p style={{ color:"#d4eeff", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={() => advanceDialog(phase)}
                style={{ background:"rgba(100,180,255,0.12)", border:"1px solid rgba(100,180,255,0.45)",
                  color:"#7de8ff", padding:"6px 20px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}
              >Next ▶</button>
            </div>
          </div>
        )}

        {/* ── JERBS GIFT SCREEN ──────────────────────────────────────── */}
        {phase === "jerbs_gift" && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(2,8,20,0.97)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", zIndex:30, gap:18, padding:"0 16px",
          }}>
            <div style={{ color:"#7de8ff", fontSize:14, fontWeight:900, letterSpacing:2, textAlign:"center" }}>
              A GIFT FROM JERBS
            </div>
            <div style={{ display:"flex", gap:14, alignItems:"flex-end", justifyContent:"center" }}>
              <img src="/__mockup/images/crystalfang.png" style={{ width:88, height:88, objectFit:"contain" }} alt="Crystalfang"/>
              <div style={{ display:"flex", flexDirection:"column", gap:5, paddingBottom:4 }}>
                <img src="/__mockup/images/glacial-stone.png" style={{ width:34, height:34, objectFit:"contain" }} alt="Glacial Stone"/>
                <img src="/__mockup/images/earthfire-stone.png" style={{ width:34, height:34, objectFit:"contain" }} alt="Earthfire Stone"/>
                <img src="/__mockup/images/faestone.png" style={{ width:34, height:34, objectFit:"contain" }} alt="Faestone"/>
              </div>
            </div>
            <div style={{ color:"#d4eeff", fontSize:12, lineHeight:1.65, textAlign:"center", maxWidth:280 }}>
              <span style={{ color:"#7de8ff", fontWeight:800 }}>Crystalfang</span> joins your party.<br/>
              Three <span style={{ color:"#a0e8ff", fontWeight:700 }}>Catalyst Stones</span> are now in your bag.<br/>
              Use one on Crystalfang whenever you're ready.
            </div>
            <button
              onClick={() => {
                const giftMon: PartyMon = {
                  ...TR_CRYSTALFANG,
                  id:"crystalfang",
                  level:5, xp:0,
                  moves: defaultActiveMoves("Frostformed", 5),
                };
                setCaughtParty(prev => [...prev, giftMon]);
                setCatalystStones(["glacia","volcia","faelia"]);
                setHasCrystalFang(true);
                setPhase("demo_end");
              }}
              style={{
                background:"linear-gradient(135deg,rgba(60,160,240,0.18),rgba(40,120,200,0.18))",
                border:"2px solid rgba(100,180,255,0.65)",
                color:"#7de8ff", padding:"10px 32px",
                borderRadius:12, fontSize:13, fontWeight:900,
                cursor:"pointer", letterSpacing:1,
              }}
            >Accept ✓</button>
          </div>
        )}

        {/* ── JERBS STONE PICKER ────────────────────────────────────────── */}
        {phase === "jerbs_stone_pick" && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(2,6,18,0.97)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", zIndex:30, gap:12, padding:"0 10px",
          }}>
            <div style={{ color:"#7de8ff", fontSize:13, fontWeight:800, letterSpacing:2, textAlign:"center" }}>
              CHOOSE A CATALYST STONE
            </div>
            <div style={{ color:"rgba(200,230,255,0.5)", fontSize:10, textAlign:"center", marginTop:-6 }}>
              This will evolve Crystalfang permanently.
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"stretch", justifyContent:"center", maxWidth:380, width:"100%" }}>
              {([
                { key:"glacia" as const, stone:"glacial-stone.png", name:"Glacial Stone", evo:"Glacia", type:"Frostformed", desc:"Precise, proud, crystalline.", col:"#7de8ff", border:"rgba(100,200,255,0.6)", bg:"rgba(20,80,120,0.25)" },
                { key:"volcia" as const, stone:"earthfire-stone.png", name:"Earthfire Stone", evo:"Volcia", type:"Volcanic", desc:"Raw, rooted, burning.", col:"#ff6630", border:"rgba(220,80,30,0.6)", bg:"rgba(80,20,5,0.3)" },
                { key:"faelia" as const, stone:"faestone.png", name:"Faestone", evo:"Faelia", type:"Spirit", desc:"Strange, bright, boundless.", col:"#d080ff", border:"rgba(160,80,240,0.6)", bg:"rgba(50,10,80,0.3)" },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setCrystalFangEvo(opt.key);
                    setHasCrystalFang(true);
                    setPhase("jerbs_crystal_evo");
                  }}
                  style={{
                    flex:1, background:opt.bg,
                    border:`2px solid ${opt.border}`,
                    borderRadius:12, padding:"10px 6px 12px",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                    cursor:"pointer",
                  }}
                >
                  <img src={`/__mockup/images/${opt.stone}`} style={{ width:60, height:60, objectFit:"contain" }} alt={opt.name}/>
                  <div style={{ color:opt.col, fontSize:10, fontWeight:800, letterSpacing:0.5, textAlign:"center" }}>{opt.name}</div>
                  <div style={{ color:"rgba(200,220,255,0.7)", fontSize:9, fontWeight:600, textAlign:"center" }}>{opt.evo}</div>
                  <div style={{ color:opt.col, fontSize:8, opacity:0.7, textAlign:"center" }}>{opt.type}</div>
                  <div style={{ color:"rgba(180,210,240,0.55)", fontSize:8, textAlign:"center", lineHeight:1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── JERBS CRYSTALFANG EVO SCENE ───────────────────────────────── */}
        {phase === "jerbs_crystal_evo" && crystalFangEvo && (
          <div style={{ position:"absolute", inset:0, zIndex:50 }}>
            <EvoScene
              preEvoSpec={CRYSTALFANG_STARTER}
              postEvoSpec={crystalFangEvo === "glacia" ? GLACIA_SPEC : crystalFangEvo === "volcia" ? VOLCIA_SPEC : FAELIA_SPEC}
              onComplete={() => {
                const evoSpec = crystalFangEvo === "glacia" ? GLACIA_MON_SPEC
                  : crystalFangEvo === "volcia" ? VOLCIA_MON_SPEC : FAELIA_MON_SPEC;
                setCaughtParty(prev => prev.map(m =>
                  m.id === "crystalfang"
                    ? { ...evoSpec, level:m.level, xp:m.xp, moves: defaultActiveMoves(evoSpec.type as any, m.level) } as PartyMon
                    : m
                ));
                setCatalystStones(stones => stones.filter(s => s !== crystalFangEvo));
                setPhase("demo_end");
              }}
            />
          </div>
        )}

        {/* ── DEMO COMPLETE SCREEN ──────────────────────────────────────── */}
        {phase === "demo_end" && (
          <div style={{
            position:"absolute", inset:0,
            background:"#000",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"flex-start", zIndex:40, overflowY:"auto",
          }}>
            <img
              src="/__mockup/images/demo_complete.png"
              style={{ width:"100%", maxWidth:480, display:"block" }}
              alt="Demo Complete"
            />
            <div style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:10,
              padding:"16px 16px 32px", width:"100%",
            }}>
              <button
                onClick={() => { setDemoComplete(true); setPhase("jerbs_a3_idle"); }}
                style={{
                  background:"linear-gradient(135deg,rgba(80,120,220,0.22),rgba(60,90,180,0.22))",
                  border:"2px solid rgba(100,140,240,0.65)",
                  color:"#a0c0f8", padding:"10px 28px",
                  borderRadius:12, fontSize:13, fontWeight:800,
                  cursor:"pointer", letterSpacing:1, width:"100%", maxWidth:320,
                }}
              >Continue Exploring ▶</button>
              <button
                onClick={() => {
                  setDemoComplete(true);
                  // Show thank-you screen momentarily then walk
                  setPhase("walk");
                }}
                style={{
                  background:"transparent", border:"1px solid rgba(255,255,255,0.18)",
                  color:"rgba(255,255,255,0.45)", padding:"8px 20px",
                  borderRadius:10, fontSize:11, cursor:"pointer",
                }}
              >Thank You for Playing ♡</button>
            </div>
          </div>
        )}

        {/* ── AMBIENT CHAT BOX (idle NPC lines + Rowan's dream) ─────────── */}
        {(phase === "prof_idle" || phase === "jay_idle" || phase === "maya_idle"
          || phase === "maya_wait" || phase === "ellio_idle" || phase === "lia_idle"
          || phase === "jess_idle" || phase === "rowan_d1" || phase === "rowan_d2"
          || phase === "rowan_d3" || phase === "jay_a3_idle" || phase === "lia_a3_idle"
          || phase === "jerbs_a3_idle"
          || phase === "tova_d1" || phase === "tova_d2" || phase === "tova_idle"
          || phase === "senna_d1" || phase === "senna_d2" || phase === "senna_idle"
          || phase === "corvin_d1" || phase === "corvin_d2" || phase === "corvin_idle") && (() => {
          const speaker =
            phase === "prof_idle" ? { name: "PROF. IRWYN", color: "#f0d060" } :
            (phase === "jay_idle" || phase === "jay_a3_idle") ? { name: "JAY", color: "#6090e0" } :
            (phase === "maya_idle" || phase === "maya_wait") ? { name: "MAYA", color: "#80d0a0" } :
            phase === "ellio_idle" ? { name: "ELLIO", color: "#a8e878" } :
            (phase === "lia_idle" || phase === "lia_a3_idle") ? { name: "LIA", color: "#ff7a44" } :
            phase === "jess_idle" ? { name: "JESS", color: "#f0a050" } :
            phase === "jerbs_a3_idle" ? { name: "JERBS", color: "#e8b840" } :
            (phase === "tova_d1" || phase === "tova_d2" || phase === "tova_idle") ? { name: "TOVA", color: "#e8c878" } :
            (phase === "senna_d1" || phase === "senna_d2" || phase === "senna_idle") ? { name: "SENNA", color: "#88d8b0" } :
            (phase === "corvin_d1" || phase === "corvin_d2" || phase === "corvin_idle") ? { name: "CORVIN", color: "#c8a8f8" } :
            { name: "ROWAN", color: "#b8a0e0" };
          const more = phase === "rowan_d1" || phase === "rowan_d2"
            || phase === "tova_d1" || phase === "senna_d1" || phase === "corvin_d1";
          return (
            <div style={{
              position:"absolute", bottom:0, left:0, right:0,
              background:"linear-gradient(to top,rgba(4,8,18,0.97),rgba(6,10,24,0.93))",
              borderTop:`2px solid ${speaker.color}80`,
              padding:"10px 14px 14px",
              zIndex:20, boxShadow:"0 -6px 28px rgba(0,0,0,0.75)", animation:"dialogIn 0.2s ease-out",
            }}>
              <div style={{ marginBottom:8 }}>
                <span style={{ color:speaker.color, fontWeight:700, fontSize:13, letterSpacing:1 }}>
                  {speaker.name}
                </span>
              </div>
              <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
                {LINES[phase]}
              </p>
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <button
                  onClick={() => advanceDialog(phase)}
                  style={{
                    background:`${speaker.color}26`,
                    border:`1px solid ${speaker.color}80`,
                    color:speaker.color, padding:"6px 20px",
                    borderRadius:8, fontSize:13, fontWeight:700,
                    cursor:"pointer",
                  }}
                >{more ? "Next ▶" : "OK"}</button>
              </div>
            </div>
          );
        })()}

        {/* ── STARTER PICKER ───────────────────────────────────────────── */}
        {phase === "pick" && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(5,3,1,0.96)",
            display:"flex", flexDirection:"column",
            zIndex:30, overflowY:"auto",
          }}>
            {/* Header */}
            <div style={{
              padding:"14px 16px 8px",
              borderBottom:"1px solid rgba(240,208,80,0.25)",
              flexShrink:0,
            }}>
              <div style={{ color:"#f0d060", fontWeight:800, fontSize:14, letterSpacing:1.5, textTransform:"uppercase" }}>
                Choose Your Tayanari
              </div>
              <div style={{ color:"#a09070", fontSize:11, marginTop:2 }}>
                This will be your first companion
              </div>
            </div>

            {/* 2-column grid */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr",
              gap:10, padding:12, flex:1,
            }}>
              {STARTERS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  style={{
                    background: selected === s.id
                      ? `rgba(${s.color.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(",")},0.25)`
                      : "rgba(20,14,6,0.9)",
                    border: `2px solid ${selected === s.id ? s.color : "rgba(255,255,255,0.1)"}`,
                    borderRadius:12,
                    padding:"10px 6px 8px",
                    display:"flex", flexDirection:"column", alignItems:"center",
                    cursor:"pointer", gap:4,
                    transition:"border-color 0.15s, background 0.15s",
                  }}
                >
                  <img src={s.img} alt={s.name}
                    style={{ width:70, height:70, objectFit:"contain",
                      background:"#0a0604", borderRadius:8, mixBlendMode:"screen" }}
                  />
                  <div style={{ color:"#e8dcc8", fontWeight:700, fontSize:12 }}>{s.name}</div>
                  <div style={{
                    fontSize:10, fontWeight:700, letterSpacing:1,
                    color: s.color,
                    background:`rgba(${s.color.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(",")},0.12)`,
                    padding:"2px 8px", borderRadius:20,
                  }}>{s.type.toUpperCase()}</div>
                </button>
              ))}
            </div>

            {/* Choose button */}
            <div style={{ padding:"10px 16px 16px", flexShrink:0 }}>
              <button
                onClick={pickStarter}
                disabled={!selected}
                style={{
                  width:"100%", padding:"12px",
                  background: selected ? "#c8a030" : "#2a2010",
                  color: selected ? "#1a0c00" : "#604820",
                  border:"none", borderRadius:12,
                  fontSize:14, fontWeight:800, letterSpacing:1,
                  cursor: selected ? "pointer" : "default",
                  transition:"background 0.2s",
                }}
              >CHOOSE PARTNER</button>
            </div>
          </div>
        )}

        {/* ── ROLE PICKER (declared in the lab, after the starter) ──────── */}
        {phase === "role_pick" && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(5,3,1,0.96)",
            display:"flex", flexDirection:"column",
            zIndex:30, overflowY:"auto",
          }}>
            {/* Header */}
            <div style={{
              padding:"14px 16px 8px",
              borderBottom:"1px solid rgba(240,208,80,0.25)",
              flexShrink:0,
            }}>
              <div style={{ color:"#f0d060", fontWeight:800, fontSize:14, letterSpacing:1.5, textTransform:"uppercase" }}>
                Declare Your Path
              </div>
              <div style={{ color:"#a09070", fontSize:11, marginTop:2 }}>
                Prof. Irwyn: "Every Keeper walks their own road. Which is yours?"
              </div>
            </div>

            {/* Role cards */}
            <div style={{
              display:"flex", flexDirection:"column",
              gap:10, padding:12, flex:1,
            }}>
              {ROLES.map(r => {
                const isSel = roleSel === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRoleSel(r.id)}
                    style={{
                      background: isSel ? "rgba(240,208,80,0.16)" : "rgba(20,14,6,0.9)",
                      border: `2px solid ${isSel ? "#f0d060" : "rgba(255,255,255,0.1)"}`,
                      borderRadius:12,
                      padding:"12px 14px",
                      display:"flex", alignItems:"flex-start", gap:12,
                      cursor:"pointer", textAlign:"left",
                      transition:"border-color 0.15s, background 0.15s",
                    }}
                  >
                    <span style={{ color:"#f0d060", fontSize:26, lineHeight:1, flexShrink:0 }}>{r.glyph}</span>
                    <span style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <span style={{ color:"#e8dcc8", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>{r.title}</span>
                      <span style={{ color:"#a09070", fontSize:11, lineHeight:1.4 }}>{r.calling}</span>
                      <span style={{
                        marginTop:2, alignSelf:"flex-start",
                        fontSize:10, fontWeight:700, letterSpacing:0.5,
                        color:"#7be0a0",
                        background:"rgba(123,224,160,0.12)",
                        padding:"2px 8px", borderRadius:20,
                      }}>{r.buffLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Confirm button */}
            <div style={{ padding:"10px 16px 16px", flexShrink:0 }}>
              <button
                onClick={() => {
                  if (!roleSel) return;
                  setRoleId(roleSel);
                  updateRole(roleSel);
                  setRoleChosen(true);
                  setPhase("d4");
                }}
                disabled={!roleSel}
                style={{
                  width:"100%", padding:"12px",
                  background: roleSel ? "#c8a030" : "#2a2010",
                  color: roleSel ? "#1a0c00" : "#604820",
                  border:"none", borderRadius:12,
                  fontSize:14, fontWeight:800, letterSpacing:1,
                  cursor: roleSel ? "pointer" : "default",
                  transition:"background 0.2s",
                }}
              >DECLARE PATH</button>
            </div>
          </div>
        )}

        {/* ── KEEPER'S JOURNAL ─────────────────────────────────────────── */}
        {showJournal && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setShowJournal(false); }}
            style={{
              position:"absolute", inset:0,
              background:"rgba(10,6,2,0.72)",
              display:"flex", flexDirection:"column", justifyContent:"flex-end",
              zIndex:40,
            }}
          >
            <div style={{
              background:"linear-gradient(175deg,#f5e9cc 0%,#ecdcb4 55%,#e4d0a0 100%)",
              borderRadius:"18px 18px 0 0",
              borderTop:"4px solid #2c1a0e",
              borderLeft:"3px solid #2c1a0e",
              borderRight:"3px solid #2c1a0e",
              boxShadow:"0 -6px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
              maxHeight:"78vh", display:"flex", flexDirection:"column",
              overflow:"hidden",
            }}>
              {/* Leather spine */}
              <div style={{
                background:"linear-gradient(90deg,#1e0f06,#3d2010,#2c1608,#1e0f06)",
                padding: isMobile ? "10px 12px 0" : "10px 16px 0",
                display:"flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "flex-end",
                justifyContent:"space-between",
                flexShrink:0, gap: isMobile ? 4 : 10,
              }}>
                {isMobile ? (
                  <>
                    {/* Mobile row 1: title + close */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:4 }}>
                      <span style={{
                        color:"#c8a44a", fontSize:10, fontWeight:800,
                        letterSpacing:2.5, textTransform:"uppercase",
                        textShadow:"0 1px 3px rgba(0,0,0,0.9)",
                      }}>Keeper's Journal</span>
                      <button onClick={() => setShowJournal(false)} style={{
                        width:26, height:26, borderRadius:"50%", flexShrink:0,
                        background:"radial-gradient(circle at 38% 33%,#c0392b,#7b1c12)",
                        border:"1.5px solid #3d0f0a",
                        color:"#f5d5d0", fontSize:12, fontWeight:900,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        cursor:"pointer",
                        boxShadow:"0 2px 6px rgba(0,0,0,0.7)",
                      }}>✕</button>
                    </div>
                    {/* Mobile row 2: tabs full width */}
                    <div style={{ display:"flex", gap:3 }}>
                      {(["party","storage","shells","bag","equipment","guide"] as const).map(tab => (
                        <button key={tab} onClick={() => setJournalTab(tab)} style={{
                          flex:1, padding:"5px 4px 8px",
                          background: journalTab === tab
                            ? "linear-gradient(175deg,#f5e9cc,#ecdcb4)"
                            : "rgba(0,0,0,0.30)",
                          border:"none",
                          borderRadius:"7px 7px 0 0",
                          color: journalTab === tab ? "#3d1e04" : "#a08050",
                          fontSize:10, fontWeight:800, letterSpacing:0.8,
                          textTransform:"uppercase", cursor:"pointer",
                        }}>{tab === "party" ? "Party" : tab === "storage" ? "Box" : tab === "shells" ? "Shells" : tab === "equipment" ? "Equip" : tab === "guide" ? "Guide" : "Bag"}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{
                      color:"#c8a44a", fontSize:10, fontWeight:800,
                      letterSpacing:3.5, textTransform:"uppercase",
                      paddingBottom:10,
                      textShadow:"0 1px 3px rgba(0,0,0,0.9)",
                    }}>Keeper's Journal</span>

                    {/* Page tabs flush with bottom of spine */}
                    <div style={{ display:"flex", gap:3, alignSelf:"flex-end" }}>
                      {(["party","storage","shells","bag","equipment","guide"] as const).map(tab => (
                        <button key={tab} onClick={() => setJournalTab(tab)} style={{
                          padding:"5px 11px 8px",
                          background: journalTab === tab
                            ? "linear-gradient(175deg,#f5e9cc,#ecdcb4)"
                            : "rgba(0,0,0,0.30)",
                          border:"none",
                          borderRadius:"7px 7px 0 0",
                          color: journalTab === tab ? "#3d1e04" : "#a08050",
                          fontSize:10, fontWeight:800, letterSpacing:1.2,
                          textTransform:"uppercase", cursor:"pointer",
                        }}>{tab === "party" ? "Party" : tab === "storage" ? "Box" : tab === "shells" ? "Shells" : tab === "equipment" ? "Equip" : tab === "guide" ? "Guide" : "Bag"}</button>
                      ))}
                    </div>

                    {/* Wax-seal close */}
                    <button onClick={() => setShowJournal(false)} style={{
                      width:26, height:26, borderRadius:"50%", flexShrink:0,
                      background:"radial-gradient(circle at 38% 33%,#c0392b,#7b1c12)",
                      border:"1.5px solid #3d0f0a",
                      color:"#f5d5d0", fontSize:12, fontWeight:900,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      cursor:"pointer", marginBottom:8,
                      boxShadow:"0 2px 6px rgba(0,0,0,0.7)",
                    }}>✕</button>
                  </>
                )}
              </div>

              {/* Parchment body */}
              <div style={{ overflowY:"auto", padding:"14px 18px 22px", flex:1 }}>
                {/* Section header rule */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:"rgba(100,64,20,0.28)" }}/>
                  <span style={{
                    color:"#8a5c22", fontSize:9, fontWeight:800,
                    letterSpacing:2.5, textTransform:"uppercase",
                  }}>{journalTab === "party" ? "Companions" : journalTab === "storage" ? "Storage Box" : journalTab === "guide" ? "Tayanari Field Guide" : journalTab === "equipment" ? "Keeper Equipment" : "Carried Items"}</span>
                  <div style={{ flex:1, height:1, background:"rgba(100,64,20,0.28)" }}/>
                </div>

                {/* ── PARTY PAGE ──────────────────────────────────── */}
                {journalTab === "party" && (
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {starter ? (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src={starter.img} alt={starter.name} style={{
                          width:56, height:56, objectFit:"contain",
                          background:"rgba(60,30,0,0.05)", borderRadius:8,
                          mixBlendMode:"multiply", flexShrink:0,
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:15, letterSpacing:0.3 }}>
                            {starter.name}
                          </div>
                          <div style={{
                            display:"inline-block", marginTop:5,
                            fontSize:9, fontWeight:800, letterSpacing:1.8,
                            color:"#8a5c22", borderBottom:"1px solid rgba(100,64,20,0.35)",
                            paddingBottom:2,
                          }}>{starter.type.toUpperCase()}</div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:5 }}>
                            Lv.{starterLevel}&emsp;·&emsp;HP {starterStats.hp}
                          </div>
                          {/* XP progress bar */}
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6 }}>
                            <div style={{ flex:1, height:4, background:"rgba(100,64,20,0.18)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{
                                height:"100%", borderRadius:2,
                                background:"linear-gradient(90deg,#c8a030,#e8c860)",
                                width:`${Math.min(100, (starterXp / Math.max(1, starterLevel * 10 + 10)) * 100)}%`,
                                transition:"width 0.6s",
                              }}/>
                            </div>
                            <span style={{ fontSize:8, color:"#9a7840", fontWeight:700, flexShrink:0, letterSpacing:0.3 }}>
                              {starterLevel >= ((wyvruntCaught && wyvruntForm < 3) ? 30 : 25) && !(wyvruntCaught && wyvruntForm >= 3) ? "MAX LV" : `${starterXp}/${starterLevel * 10 + 10} XP`}
                            </span>
                          </div>
                          {/* Stat row */}
                          <div style={{ display:"flex", gap:10, marginTop:7 }}>
                            {(["atk","def","spd"] as const).map(k => (
                              <div key={k} style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:28 }}>
                                <span style={{ fontSize:7.5, color:"#7a5c28", fontWeight:800, letterSpacing:1.2 }}>{k.toUpperCase()}</span>
                                <span style={{ fontSize:12, color:"#2a1206", fontWeight:800, lineHeight:1.1 }}>{starterStats[k]}</span>
                              </div>
                            ))}
                          </div>
                          {/* Wyvrunt loyalty bar — shown while bonded + not yet Aureyvant */}
                          {wyvruntCaught && wyvruntForm < 3 && (
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                              <span style={{ fontSize:8, color:"#7060a0", fontWeight:800, letterSpacing:0.5, flexShrink:0 }}>☯ BOND</span>
                              <div style={{ flex:1, height:4, background:"rgba(80,50,140,0.18)", borderRadius:2, overflow:"hidden" }}>
                                <div style={{
                                  height:"100%", borderRadius:2,
                                  background:"linear-gradient(90deg,#8060c0,#b090f0)",
                                  width:`${wyrLoyalty}%`,
                                  transition:"width 0.6s",
                                }}/>
                              </div>
                              <span style={{ fontSize:8, color:"#9070c0", fontWeight:700, flexShrink:0, letterSpacing:0.3 }}>
                                {wyrLoyalty}/100
                              </span>
                            </div>
                          )}
                          {/* Equipment line — only shown when something is equipped */}
                          {(resonanceStoneEquipped || healingRuneEquipped) && (
                            <div style={{ color:"#6a50a0", fontSize:9, fontWeight:800, marginTop:5, letterSpacing:0.5 }}>
                              {resonanceStoneEquipped && "◈ Resonance Stone"}{resonanceStoneEquipped && healingRuneEquipped ? "  ·  " : ""}{healingRuneEquipped && "✦ Healing Rune"}
                            </div>
                          )}
                        </div>
                        <div style={{
                          color:"#9a7040", fontSize:10, fontWeight:700,
                          background:"rgba(100,64,20,0.09)",
                          padding:"3px 10px", borderRadius:20,
                          border:"1px solid rgba(100,64,20,0.18)",
                        }}>No. 1</div>
                      </div>
                    ) : (
                      <div style={{
                        textAlign:"center", padding:"26px 0",
                        color:"#b09468", fontSize:12, fontStyle:"italic",
                      }}>— No companion yet. Speak with the Professor. —</div>
                    )}

                    {/* ── Move manager (rearrange the active 4 from the learned pool) ── */}
                    {starter && (
                      <MoveManager
                        element={starter.type}
                        level={starterLevel}
                        active={starterMoves}
                        onChange={setStarterMoves}
                      />
                    )}

                    {/* ── Player (Keeper) equipment row ── */}
                    <div style={{
                      display:"flex", alignItems:"center", gap:13,
                      padding:"10px 2px 13px",
                      borderBottom:"1px dashed rgba(100,64,20,0.28)",
                    }}>
                      <div style={{
                        width:56, height:56, borderRadius:8, flexShrink:0,
                        background:"rgba(40,60,20,0.10)",
                        border:"1px solid rgba(80,140,40,0.22)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:26,
                      }}>🧭</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:"#2a1206", fontWeight:800, fontSize:14, letterSpacing:0.3 }}>
                          You (Keeper)
                        </div>
                        <div style={{ color:"#826040", fontSize:10, marginTop:4 }}>
                          Player equipment
                        </div>
                        {resonanceStoneEquipped && starter ? (
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                            <img src="/__mockup/images/resonance-stone.png" alt="Stone"
                              style={{ width:16, height:16, objectFit:"contain" }}/>
                            <div style={{ color:"#60a0e0", fontSize:10, fontWeight:700 }}>
                              Resonance Stone · {starter.type} move · scales with bond
                            </div>
                          </div>
                        ) : hasResonanceStone ? (
                          <div style={{ color:"#a07848", fontSize:10, marginTop:5, fontStyle:"italic" }}>
                            Resonance Stone — not equipped
                          </div>
                        ) : (
                          <div style={{ color:"#c0a070", fontSize:10, marginTop:5, fontStyle:"italic" }}>
                            No equipment
                          </div>
                        )}
                      </div>
                      {hasResonanceStone && (
                        <button
                          onClick={() => setResonanceStoneEquipped(v => !v)}
                          style={{
                            padding:"5px 11px", borderRadius:8, flexShrink:0,
                            background: resonanceStoneEquipped
                              ? "rgba(180,60,60,0.10)" : "rgba(40,80,160,0.10)",
                            border: resonanceStoneEquipped
                              ? "1px solid rgba(180,60,60,0.40)" : "1px solid rgba(80,140,200,0.40)",
                            color: resonanceStoneEquipped ? "#c04040" : "#5090c0",
                            fontSize:10, fontWeight:800, cursor:"pointer",
                          }}
                        >{resonanceStoneEquipped ? "Unequip" : "Equip"}</button>
                      )}
                    </div>

                    {/* Caught companions (slots 2…PARTY_CAP) */}
                    {caughtParty.map((mon, i) => {
                      const monEl = asElement(mon.type);
                      const monStats = partyBattleStats(mon.maxHp, mon.baseDmg, mon.rarity, mon.level);
                      const monMoves = mon.moves ?? (monEl ? defaultActiveMoves(monEl, mon.level) : []);
                      const xpThr = mon.level * 10 + 10;
                      return (
                      <div key={`${mon.id}-${i}`} style={{
                        padding:"12px 2px 4px",
                        borderBottom:"1px dashed rgba(100,64,20,0.22)",
                      }}>
                        {/* Header row: sprite + info + controls */}
                        <div style={{ display:"flex", alignItems:"flex-start", gap:13 }}>
                          {/* Sprite */}
                          {mon.playerSheet ? (() => {
                            const s = mon.playerSheet!;
                            const SZ = 56;
                            const sc = Math.min(SZ / s.w, SZ / s.h);
                            const dW = Math.round(s.w * sc), dH = Math.round(s.h * sc);
                            const iW = Math.round(s.sheetW * sc), iH = Math.round(s.sheetH * sc);
                            const oX = Math.round(s.x * sc), oY = Math.round(s.y * sc);
                            return (
                              <div style={{ width:SZ, height:SZ, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:"rgba(60,30,0,0.05)", borderRadius:8 }}>
                                <div style={{ width:dW, height:dH, overflow:"hidden", position:"relative", flexShrink:0 }}>
                                  <img src={s.url} alt="" style={{ position:"absolute", left:-oX, top:-oY, width:iW, height:iH, maxWidth:"none" }}/>
                                </div>
                              </div>
                            );
                          })() : (
                            <img src={mon.playerImg} alt={mon.name} style={{
                              width:56, height:56, objectFit:"contain",
                              background:"rgba(60,30,0,0.05)", borderRadius:8,
                              mixBlendMode:"multiply", flexShrink:0,
                            }}/>
                          )}
                          {/* Info */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:"#2a1206", fontWeight:800, fontSize:14, letterSpacing:0.3 }}>
                              {mon.name}{mon.nameIcon ? ` ${mon.nameIcon}` : ""}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:3 }}>
                              <span style={{
                                fontSize:8.5, fontWeight:800, letterSpacing:1.6,
                                color:"#8a5c22", borderBottom:"1px solid rgba(100,64,20,0.35)", paddingBottom:1,
                              }}>{mon.type.toUpperCase()}</span>
                              <span style={{ color: RARITY_COLOR[mon.rarity], fontSize:8.5, fontWeight:800, letterSpacing:0.5 }}>
                                ◈ {mon.rarity.toUpperCase()}
                              </span>
                            </div>
                            <div style={{ color:"#826040", fontSize:10.5, marginTop:3 }}>
                              Lv.{mon.level}&emsp;·&emsp;HP {monStats.hp}
                            </div>
                            {/* XP bar */}
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                              <div style={{ flex:1, height:4, background:"rgba(100,64,20,0.18)", borderRadius:2, overflow:"hidden" }}>
                                <div style={{
                                  height:"100%", borderRadius:2,
                                  background:"linear-gradient(90deg,#c8a030,#e8c860)",
                                  width:`${Math.min(100, (mon.xp / Math.max(1, xpThr)) * 100)}%`,
                                  transition:"width 0.6s",
                                }}/>
                              </div>
                              <span style={{ fontSize:8, color:"#9a7840", fontWeight:700, flexShrink:0 }}>
                                {mon.level >= 30 ? "MAX LV" : `${mon.xp}/${xpThr} XP`}
                              </span>
                            </div>
                            {/* Stat row */}
                            <div style={{ display:"flex", gap:10, marginTop:6 }}>
                              {(["atk","def","spd"] as const).map(k => (
                                <div key={k} style={{ display:"flex", flexDirection:"column", alignItems:"center", minWidth:28 }}>
                                  <span style={{ fontSize:7.5, color:"#7a5c28", fontWeight:800, letterSpacing:1.2 }}>{k.toUpperCase()}</span>
                                  <span style={{ fontSize:12, color:"#2a1206", fontWeight:800, lineHeight:1.1 }}>{monStats[k]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Controls column */}
                          <div style={{ display:"flex", flexDirection:"column", gap:3, flexShrink:0, alignItems:"flex-end" }}>
                            <div style={{
                              color:"#9a7040", fontSize:10, fontWeight:700,
                              background:"rgba(100,64,20,0.09)",
                              padding:"3px 9px", borderRadius:20,
                              border:"1px solid rgba(100,64,20,0.18)", marginBottom:3,
                            }}>No. {i + 2}</div>
                            <button
                              title="Set as battle lead (swaps with No. 1)"
                              onClick={() => promoteToLead(i)}
                              style={{
                                padding:"2px 7px", borderRadius:5, fontSize:9, fontWeight:800,
                                background:"rgba(200,160,20,0.12)", border:"1px solid rgba(200,160,20,0.40)",
                                color:"#b08010", cursor:"pointer", letterSpacing:0.2,
                              }}
                            >★ Lead</button>
                            <button
                              disabled={i === 0}
                              onClick={() => {
                                if (i === 0) return;
                                setCaughtParty(p => {
                                  const next = [...p];
                                  [next[i-1], next[i]] = [next[i], next[i-1]];
                                  return next;
                                });
                              }}
                              style={{
                                padding:"2px 7px", borderRadius:5, fontSize:10, fontWeight:800,
                                background:"rgba(100,64,20,0.08)", border:"1px solid rgba(100,64,20,0.25)",
                                color: i === 0 ? "#c0ab8e" : "#8a5c22",
                                cursor: i === 0 ? "not-allowed" : "pointer",
                              }}
                            >↑</button>
                            <button
                              disabled={i >= caughtParty.length - 1}
                              onClick={() => {
                                if (i >= caughtParty.length - 1) return;
                                setCaughtParty(p => {
                                  const next = [...p];
                                  [next[i], next[i+1]] = [next[i+1], next[i]];
                                  return next;
                                });
                              }}
                              style={{
                                padding:"2px 7px", borderRadius:5, fontSize:10, fontWeight:800,
                                background:"rgba(100,64,20,0.08)", border:"1px solid rgba(100,64,20,0.25)",
                                color: i >= caughtParty.length - 1 ? "#c0ab8e" : "#8a5c22",
                                cursor: i >= caughtParty.length - 1 ? "not-allowed" : "pointer",
                              }}
                            >↓</button>
                            <button
                              disabled={storageBox.length >= STORAGE_CAP}
                              onClick={() => {
                                if (storageBox.length >= STORAGE_CAP) return;
                                setCaughtParty(p => p.filter((_, j) => j !== i));
                                setStorageBox(b => [...b, mon]);
                              }}
                              style={{
                                padding:"4px 8px", borderRadius:7,
                                background:"rgba(100,64,20,0.08)",
                                border:"1px solid rgba(100,64,20,0.30)",
                                color: storageBox.length >= STORAGE_CAP ? "#c0ab8e" : "#8a5c22",
                                fontSize:9, fontWeight:800,
                                cursor: storageBox.length >= STORAGE_CAP ? "not-allowed" : "pointer",
                                marginTop:2,
                              }}
                            >{storageBox.length >= STORAGE_CAP ? "Box full" : "→ Box"}</button>
                          </div>
                        </div>
                        {/* Move manager — full picker, same as starter */}
                        {monEl && (
                          <MoveManager
                            element={mon.type}
                            level={mon.level}
                            active={monMoves}
                            onChange={next => setCaughtParty(p => p.map((m, j) => j === i ? { ...m, moves: next } : m))}
                          />
                        )}
                      </div>
                      );
                    })}

                    {/* Remaining empty party slots */}
                    {Array.from({ length: Math.max(0, PARTY_CAP - 1 - caughtParty.length) }).map((_, k) => (
                      <div key={`empty-${k}`} style={{
                        padding:"11px 2px",
                        borderBottom:"1px dashed rgba(100,64,20,0.16)",
                        display:"flex", alignItems:"center", gap:13,
                      }}>
                        <div style={{
                          width:56, height:40, borderRadius:7,
                          border:"1px dashed rgba(100,64,20,0.2)",
                          background:"rgba(100,64,20,0.03)",
                          flexShrink:0,
                        }}/>
                        <div style={{ color:"#c8a87a", fontSize:11, fontStyle:"italic" }}>
                          Slot {caughtParty.length + k + 2} — empty
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── STORAGE BOX PAGE ─────────────────────────── */}
                {journalTab === "storage" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div style={{ color:"#9a7c50", fontSize:10, lineHeight:1.6, fontStyle:"italic", marginBottom:2 }}>
                      Tayanari beyond your party of {PARTY_CAP} rest here at the lab.
                      {" "}Withdraw one when a party slot is free.
                      {" "}<span style={{ fontStyle:"normal", fontWeight:800, color:"#7a5e34" }}>({storageBox.length} / {STORAGE_CAP})</span>
                    </div>
                    {storageBox.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"26px 0", color:"#b09468", fontSize:12, fontStyle:"italic" }}>
                        — The Storage Box is empty. —
                      </div>
                    ) : (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        {storageBox.map((mon, i) => {
                          const partyFull = caughtParty.length >= PARTY_CAP - 1;
                          return (
                            <div key={`${mon.id}-${i}`} style={{
                              display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                              padding:"12px 8px",
                              background:"rgba(50,35,90,0.05)",
                              border:"1px solid rgba(100,80,160,0.22)",
                              borderRadius:12,
                            }}>
                              {mon.playerSheet ? (() => {
                                const s = mon.playerSheet!;
                                const SZ = 54;
                                const sc = Math.min(SZ / s.w, SZ / s.h);
                                const dW = Math.round(s.w * sc), dH = Math.round(s.h * sc);
                                const iW = Math.round(s.sheetW * sc), iH = Math.round(s.sheetH * sc);
                                const oX = Math.round(s.x * sc), oY = Math.round(s.y * sc);
                                return (
                                  <div style={{ width:SZ, height:SZ, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(60,30,0,0.04)", borderRadius:8 }}>
                                    <div style={{ width:dW, height:dH, overflow:"hidden", position:"relative", flexShrink:0 }}>
                                      <img src={s.url} alt="" style={{ position:"absolute", left:-oX, top:-oY, width:iW, height:iH, maxWidth:"none" }}/>
                                    </div>
                                  </div>
                                );
                              })() : (
                                <img src={mon.playerImg} alt={mon.name} style={{
                                  width:54, height:54, objectFit:"contain",
                                  background:"rgba(60,30,0,0.04)", borderRadius:8,
                                  mixBlendMode:"multiply",
                                }}/>
                              )}
                              <div style={{ color:"#2a1206", fontWeight:800, fontSize:12, textAlign:"center" }}>
                                {mon.name}{mon.nameIcon ? ` ${mon.nameIcon}` : ""}
                              </div>
                              <div style={{ color: RARITY_COLOR[mon.rarity], fontSize:8.5, fontWeight:800, letterSpacing:0.5 }}>
                                ◈ {mon.rarity.toUpperCase()}
                              </div>
                              <button
                                disabled={partyFull}
                                onClick={() => {
                                  if (caughtParty.length >= PARTY_CAP - 1) return;
                                  setStorageBox(b => b.filter((_, j) => j !== i));
                                  setCaughtParty(p => [...p, mon]);
                                }}
                                style={{
                                  marginTop:2, padding:"5px 12px", borderRadius:8,
                                  background: partyFull ? "rgba(100,64,20,0.05)" : "rgba(40,80,160,0.10)",
                                  border: partyFull ? "1px solid rgba(100,64,20,0.16)" : "1px solid rgba(80,140,200,0.40)",
                                  color: partyFull ? "#b8a888" : "#5090c0",
                                  fontSize:9.5, fontWeight:800,
                                  cursor: partyFull ? "not-allowed" : "pointer",
                                }}
                              >{partyFull ? "Party full" : "→ Party"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SHELLS PAGE ──────────────────────────────── */}
                {journalTab === "shells" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    {starter ? (
                      <div style={{
                        background:"rgba(30,20,50,0.06)",
                        border:"1px solid rgba(100,80,180,0.22)",
                        borderRadius:14, padding:14,
                      }}>
                        {/* Shell header */}
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <img src="/__mockup/images/obsidianeye-shell.png" alt="Obsidianeye Shell" style={{
                            width:48, height:48, objectFit:"contain", flexShrink:0,
                            filter:"drop-shadow(0 0 8px rgba(120,80,180,0.45))",
                          }}/>
                          <div>
                            <div style={{ color:"#2a1206", fontWeight:800, fontSize:13 }}>Obsidianeye Shell</div>
                            <div style={{ color:"#7060a0", fontSize:10, marginTop:2, fontStyle:"italic" }}>
                              "Sees what others cannot perceive."
                            </div>
                            <div style={{ color:"#7060a0", fontSize:10, marginTop:2 }}>Bonded · {starter.name} within</div>
                            <div style={{ color:"#4a6a30", fontSize:10, marginTop:2, fontWeight:700 }}>
                              {healingRuneEquipped ? "1 / 2 rune slots filled" : "2 rune slots — 1 empty"}
                            </div>
                          </div>
                        </div>

                        {/* Tayanari inside the shell */}
                        <div style={{
                          display:"flex", alignItems:"center", gap:10,
                          padding:"8px 10px", borderRadius:10,
                          background:"rgba(50,35,90,0.07)",
                          border:"1px dashed rgba(100,80,160,0.22)",
                          marginBottom:12,
                        }}>
                          <img src={starter.img} alt={starter.name} style={{
                            width:38, height:38, objectFit:"contain",
                            background:"rgba(60,30,0,0.04)", borderRadius:6,
                            mixBlendMode:"multiply", flexShrink:0,
                          }}/>
                          <div>
                            <div style={{ color:"#2a1206", fontWeight:700, fontSize:12 }}>{starter.name}</div>
                            <div style={{ color:starter.color, fontSize:9, fontWeight:800, letterSpacing:1 }}>{starter.type.toUpperCase()}</div>
                            <div style={{ color:"#826040", fontSize:10, marginTop:2 }}>Lv 4 · HP 50 / 50</div>
                          </div>
                        </div>

                        {/* Rune slot */}
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{
                            width:38, height:38, borderRadius:9, flexShrink:0,
                            background: healingRuneEquipped
                              ? "radial-gradient(circle at 38% 33%,#1a4a1a,#0a1a0a)"
                              : "rgba(60,40,20,0.07)",
                            border: healingRuneEquipped
                              ? "1.5px solid rgba(80,200,80,0.55)"
                              : "1.5px dashed rgba(100,64,20,0.28)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:18,
                            color: healingRuneEquipped ? "rgba(80,220,80,0.9)" : "rgba(150,120,80,0.35)",
                            boxShadow: healingRuneEquipped ? "0 0 8px rgba(80,200,80,0.3)" : "none",
                            transition:"all 0.25s",
                          overflow:"hidden",
                        }}>
                          {healingRuneEquipped
                            ? <img src="/__mockup/images/obsidian-healing-rune.png" alt="" style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
                            : "·"
                          }
                        </div>
                          <div style={{ flex:1 }}>
                            <div style={{ color:"#3a2a14", fontWeight:700, fontSize:11 }}>
                              {healingRuneEquipped ? "Obsidian Healing Rune" : "Rune Slot — empty"}
                            </div>
                            <div style={{ color:"#826040", fontSize:10, marginTop:2 }}>
                              {healingRuneEquipped
                                ? "Heals 50% of max HP once per battle"
                                : hasHealingRune ? "Tap Equip to socket the rune" : "No rune in bag"}
                            </div>
                          </div>
                          {hasHealingRune && (
                            <button
                              onClick={() => setHealingRuneEquipped(v => !v)}
                              style={{
                                padding:"5px 11px", borderRadius:8, flexShrink:0,
                                background: healingRuneEquipped
                                  ? "rgba(180,60,60,0.10)" : "rgba(50,35,90,0.10)",
                                border: healingRuneEquipped
                                  ? "1px solid rgba(180,60,60,0.40)" : "1px solid rgba(100,80,180,0.40)",
                                color: healingRuneEquipped ? "#c04040" : "#7060b0",
                                fontSize:10, fontWeight:800, cursor:"pointer",
                              }}
                            >{healingRuneEquipped ? "Unequip" : "Equip"}</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign:"center", padding:"26px 0", color:"#b09468", fontSize:12, fontStyle:"italic" }}>
                        — No shell yet. Choose a partner from the Professor. —
                      </div>
                    )}

                    {/* ── Weathered Realm Shells in Shells tab ── */}
                    {shellsCollected && (
                      <div style={{
                        background:"rgba(60,40,10,0.05)",
                        border:"1px solid rgba(140,100,40,0.25)",
                        borderRadius:14, padding:14,
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <img src="/__mockup/images/weathered-shell.png" alt="Weathered Shell" style={{
                            width:44, height:44, objectFit:"contain",
                            flexShrink:0, mixBlendMode:"multiply",
                          }}/>
                          <div>
                            <div style={{ color:"#2a1206", fontWeight:800, fontSize:13 }}>Weathered Realm Shell</div>
                            <div style={{ color:"#8a6030", fontSize:10, marginTop:2 }}>×{shellCount} · Catching Shell</div>
                            <div style={{ color:"#4a6a30", fontSize:10, marginTop:2, fontWeight:700 }}>+10% XP to bonded Tayanari</div>
                          </div>
                        </div>
                        <div style={{
                          display:"flex", alignItems:"center", gap:10,
                          padding:"8px 10px", borderRadius:10,
                          background:"rgba(80,50,10,0.06)",
                          border:"1px dashed rgba(140,100,40,0.20)",
                        }}>
                          <div style={{
                            width:38, height:38, borderRadius:9, flexShrink:0,
                            background:"rgba(80,60,30,0.07)",
                            border:"1.5px dashed rgba(150,110,60,0.30)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:16, color:"rgba(160,120,60,0.30)",
                          }}>✕</div>
                          <div>
                            <div style={{ color:"#7a5830", fontWeight:700, fontSize:11 }}>No rune slot</div>
                            <div style={{ color:"#a07848", fontSize:10, marginTop:2, fontStyle:"italic" }}>
                              Worn too smooth — the surface won't hold a socket
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Battle Shell equip ─────────────────────────── */}
                    {ownedBattleShellIds.length > 0 && (
                      <div style={{ background:"rgba(60,40,10,0.06)", border:"1px solid rgba(200,160,60,0.25)", borderRadius:14, padding:14, marginBottom:12 }}>
                        <div style={{ color:"#9a6e2e", fontWeight:900, fontSize:10, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>⚔ Battle Shell</div>
                        {ownedBattleShellIds.map(id => {
                          const bs = BATTLE_SHELLS.find(s => s.id === id);
                          if (!bs) return null;
                          const isEq = equippedBattleShellId === id;
                          return (
                            <div key={id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 9px", borderRadius:9, marginBottom:6, background: isEq ? "rgba(245,200,66,0.14)" : "rgba(0,0,0,0.03)", border:`1px solid ${isEq ? "#f5c842" : "rgba(200,160,60,0.2)"}` }}>
                              <div style={{ flex:1 }}>
                                <div style={{ color: isEq ? "#f5c842" : "#7a5820", fontWeight:800, fontSize:11 }}>{bs.icon} {bs.name}{isEq ? " (equipped)" : ""}</div>
                                <div style={{ color:"#906030", fontSize:9.5, marginTop:1 }}>{bs.element} element</div>
                              </div>
                              <button onClick={() => setEquippedBattleShellId(isEq ? null : id)} style={{ background: isEq ? "rgba(200,60,60,0.15)" : "rgba(80,140,60,0.15)", border:`1px solid ${isEq ? "#c04040" : "#60a040"}`, color: isEq ? "#d06060" : "#70b050", padding:"4px 10px", borderRadius:7, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                                {isEq ? "Unequip" : "Equip"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Battle Rune equip ─────────────────────────── */}
                    {ownedBattleRuneIds.length > 0 && (
                      <div style={{ background:"rgba(20,20,60,0.06)", border:"1px solid rgba(128,144,240,0.25)", borderRadius:14, padding:14, marginBottom:12 }}>
                        <div style={{ color:"#5060a0", fontWeight:900, fontSize:10, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>✦ Battle Rune</div>
                        {ownedBattleRuneIds.map(id => {
                          const br = BATTLE_RUNES.find(r => r.id === id);
                          if (!br) return null;
                          const isSlotted = slottedBattleRuneId === id;
                          return (
                            <div key={id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 9px", borderRadius:9, marginBottom:6, background: isSlotted ? "rgba(128,144,240,0.14)" : "rgba(0,0,0,0.03)", border:`1px solid ${isSlotted ? "#8090f0" : "rgba(128,144,240,0.2)"}` }}>
                              <div style={{ flex:1 }}>
                                <div style={{ color: isSlotted ? "#a0b0ff" : "#4a5890", fontWeight:800, fontSize:11 }}>{br.icon} {br.name}{isSlotted ? " (slotted)" : ""}</div>
                                <div style={{ color:"#6070a0", fontSize:9.5, marginTop:1 }}>{br.desc}</div>
                              </div>
                              <button onClick={() => setSlottedBattleRuneId(isSlotted ? null : id)} style={{ background: isSlotted ? "rgba(200,60,60,0.15)" : "rgba(80,80,200,0.15)", border:`1px solid ${isSlotted ? "#c04040" : "#6060c0"}`, color: isSlotted ? "#d06060" : "#8090e0", padding:"4px 10px", borderRadius:7, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                                {isSlotted ? "Remove" : "Slot"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Catalyst Stones ──────────────────────────── */}
                    {catalystStones.length > 0 && (
                      <div style={{ background:"rgba(20,50,80,0.08)", border:"1px solid rgba(100,200,255,0.25)", borderRadius:14, padding:14, marginBottom:12 }}>
                        <div style={{ color:"#5090b0", fontWeight:900, fontSize:10, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>✦ Catalyst Stones</div>
                        {([
                          { key:"glacia" as const, stone:"glacial-stone.png", name:"Glacial Stone", evo:"→ Glacia", col:"#7de8ff", bd:"rgba(100,200,255,0.5)" },
                          { key:"volcia" as const, stone:"earthfire-stone.png", name:"Earthfire Stone", evo:"→ Volcia", col:"#ff6630", bd:"rgba(220,100,40,0.5)" },
                          { key:"faelia" as const, stone:"faestone.png", name:"Faestone", evo:"→ Faelia", col:"#c070ff", bd:"rgba(160,80,240,0.5)" },
                        ] as const).filter(opt => catalystStones.includes(opt.key)).map(opt => {
                          const hasCF = caughtParty.some(m => m.id === "crystalfang");
                          return (
                            <div key={opt.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 9px", borderRadius:9, marginBottom:6, background:"rgba(0,0,0,0.03)", border:`1px solid ${opt.bd}` }}>
                              <img src={`/__mockup/images/${opt.stone}`} style={{ width:28, height:28, objectFit:"contain" }} alt={opt.name}/>
                              <div style={{ flex:1 }}>
                                <div style={{ color:opt.col, fontWeight:800, fontSize:11 }}>{opt.name}</div>
                                <div style={{ color:"rgba(180,220,255,0.6)", fontSize:9, marginTop:1 }}>{opt.evo}</div>
                              </div>
                              <button
                                onClick={() => {
                                  if (!hasCF) return;
                                  setShowJournal(false);
                                  setCrystalFangEvo(opt.key);
                                  setPhase("jerbs_crystal_evo");
                                }}
                                disabled={!hasCF}
                                style={{ background: hasCF ? "rgba(80,160,240,0.15)" : "rgba(60,60,60,0.1)", border:`1px solid ${hasCF ? opt.bd : "rgba(100,100,100,0.3)"}`, color: hasCF ? opt.col : "#666", padding:"4px 10px", borderRadius:7, fontSize:10, fontWeight:700, cursor: hasCF ? "pointer" : "not-allowed" }}
                              >{hasCF ? "Evolve ▶" : "Need Crystalfang"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── SHELL CODEX (all 18 known shells) ─────────── */}
                    <div style={{
                      background:"rgba(30,20,50,0.05)",
                      border:"1px solid rgba(100,80,180,0.22)",
                      borderRadius:14, padding:12,
                    }}>
                      <div style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        marginBottom:10,
                      }}>
                        <div style={{ color:"#2a1206", fontWeight:800, fontSize:13, letterSpacing:0.5 }}>
                          Shell Codex
                        </div>
                        <div style={{ color:"#7060a0", fontSize:10, fontWeight:700 }}>
                          {SHELLS.length} catalogued
                        </div>
                      </div>
                      <div style={{
                        color:"#7a5a8a", fontSize:10, fontStyle:"italic",
                        marginBottom:10, textAlign:"center",
                      }}>
                        Shells hold echoes of ancient Primians.<br/>
                        Each shape carries a story. Each pattern, a past.
                      </div>
                      <img
                        src="/__mockup/images/shells-chart.png"
                        alt="Primeria Shells chart"
                        style={{
                          width:"100%", height:"auto", borderRadius:10,
                          marginBottom:10, mixBlendMode:"multiply",
                        }}
                      />
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {SHELLS.map(s => {
                          // Discovery rule (mockup): only common (basic-tier)
                          // shells are found in the overworld so far. Advanced
                          // and awakened shells appear as silhouettes until the
                          // player obtains one from a merchant or tribal trial.
                          // Basic shells appear in the overworld; Obsidianeye
                          // is the unique starter shell granted by Professor.
                          const discovered = s.tier === "basic" || s.id === "obsidianeye";
                          const tierColor =
                            s.tier === "awakened" ? "#c89030" :
                            s.tier === "advanced" ? "#7060b0" : "#6a8a4a";

                          if (!discovered) {
                            return (
                              <div key={s.id} style={{
                                display:"flex", alignItems:"flex-start", gap:8,
                                padding:"7px 9px", borderRadius:8,
                                background:"rgba(20,15,30,0.06)",
                                border:"1px dashed rgba(80,60,120,0.30)",
                                opacity:0.85,
                              }}>
                                <div style={{
                                  width:8, height:8, borderRadius:"50%",
                                  background:"rgba(80,60,120,0.45)",
                                  marginTop:4, flexShrink:0,
                                }}/>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                                    <span style={{
                                      color:"#3a2a4a", fontWeight:800, fontSize:11,
                                      filter:"blur(0.6px)",
                                    }}>
                                      {s.name}
                                    </span>
                                    <span style={{ color:"#80708a", fontSize:8, fontWeight:800, letterSpacing:0.5 }}>
                                      ???
                                    </span>
                                  </div>
                                  <div style={{
                                    color:"#80708a", fontSize:9.5, fontStyle:"italic",
                                    marginTop:1, lineHeight:1.3,
                                  }}>
                                    "???"
                                  </div>
                                  <div style={{ color:"#80708a", fontSize:8.5, marginTop:3, fontStyle:"italic" }}>
                                    — undiscovered —
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={s.id} style={{
                              display:"flex", alignItems:"flex-start", gap:8,
                              padding:"7px 9px", borderRadius:8,
                              background:"rgba(255,255,255,0.35)",
                              border:`1px solid ${tierColor}33`,
                            }}>
                              <div style={{
                                width:8, height:8, borderRadius:"50%",
                                background: ELEMENT_COLOR[s.primary],
                                marginTop:4, flexShrink:0,
                                boxShadow:`0 0 6px ${ELEMENT_COLOR[s.primary]}80`,
                              }}/>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                                  <span style={{ color:"#2a1206", fontWeight:800, fontSize:11 }}>
                                    {s.name}
                                  </span>
                                  <span style={{ color: ELEMENT_COLOR[s.primary], fontSize:8, fontWeight:800, letterSpacing:0.5 }}>
                                    {s.primary.toUpperCase()}
                                    {s.secondary && (
                                      <span style={{ color:ELEMENT_COLOR[s.secondary] }}>
                                        {" / "}{s.secondary.toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div style={{
                                  color:"#5a4a30", fontSize:9.5, fontStyle:"italic",
                                  marginTop:1, lineHeight:1.3,
                                }}>
                                  "{s.flavor}"
                                </div>
                                <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                                  <span style={{
                                    color: tierColor, fontSize:8.5, fontWeight:800,
                                    letterSpacing:0.5,
                                  }}>
                                    {s.tier.toUpperCase()} · {s.runeSlots} slot{s.runeSlots>1?"s":""}
                                  </span>
                                  <span style={{ color:"#806080", fontSize:8.5 }}>
                                    align {s.alignmentLean>0?"+":""}{s.alignmentLean}
                                  </span>
                                  <span style={{ color:"#608060", fontSize:8.5 }}>
                                    xp ×{s.xpMod.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BAG PAGE ────────────────────────────────────── */}
                {journalTab === "bag" && (
                  <div style={{ display:"flex", flexDirection:"column" }}>

                    {/* ── Keeper's Errand tracker ──────────────────────────── */}
                    {(() => {
                      const errands = [
                        { label:"Weathered Realm Shells", done:shellsCollected, from:"Maya"  },
                        { label:"Obsidian Healing Rune",  done:hasHealingRune,  from:"Jay"   },
                        { label:"Resonance Stone",        done:hasResonanceStone, from:"Ellio" },
                        { label:"Hearthberries",          done:hasHearthberries, from:"Lia"  },
                        { label:"Keeper's Satchel",       done:hasSatchel,       from:"Lia"  },
                      ];
                      const n = errands.filter(e => e.done).length;
                      const allDone = n === 5;
                      return (
                        <div style={{
                          background: allDone ? "rgba(40,100,30,0.08)" : "rgba(60,40,10,0.06)",
                          borderRadius:10, padding:"10px 12px", marginBottom:10,
                          border:`1px solid ${allDone ? "rgba(80,160,60,0.28)" : "rgba(120,80,30,0.15)"}`,
                        }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                            <div style={{ color:"#9a6e2e", fontSize:9.5, fontWeight:900, letterSpacing:1.5, textTransform:"uppercase" }}>
                              Keeper's Errand
                            </div>
                            <div style={{
                              color: allDone ? "#60b850" : "#9a6e2e",
                              fontSize:10, fontWeight:900, letterSpacing:0.5,
                            }}>{n}/5</div>
                          </div>
                          {errands.map(e => (
                            <div key={e.label} style={{ display:"flex", alignItems:"center", gap:7, padding:"2px 0" }}>
                              <span style={{ color: e.done ? "#58c048" : "#906040", fontSize:11, lineHeight:1, flexShrink:0 }}>
                                {e.done ? "✓" : "○"}
                              </span>
                              <span style={{
                                color: e.done ? "#4a9038" : "#9a7040", fontSize:10,
                                fontWeight: e.done ? 700 : 400, flex:1,
                              }}>{e.label}</span>
                              {!e.done && (
                                <span style={{ color:"#7a5830", fontSize:9, flexShrink:0 }}>{e.from}</span>
                              )}
                            </div>
                          ))}
                          {allDone && (
                            <div style={{ color:"#60b850", fontSize:9, fontWeight:800, marginTop:5, letterSpacing:0.5 }}>
                              ✦ Ready for the Lab — speak with Prof. Irwyn
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {!shellsCollected && !hasHealingRune && !hasResonanceStone && !hasHearthberries && !hasSatchel
                     && (duskberries + thornberries + calmberries + brightberries === 0) && (
                      <div style={{
                        textAlign:"center", padding:"26px 0",
                        color:"#b09468", fontSize:12, fontStyle:"italic",
                      }}>— Your bag is empty. —</div>
                    )}

                    {/* ── Consumables ── */}
                    {(shellsCollected || hasHearthberries) && (
                      <div style={{
                        color:"#9a6e2e", fontSize:9.5, fontWeight:900, letterSpacing:1.5,
                        textTransform:"uppercase", padding:"8px 2px 2px",
                        borderBottom:"1px solid rgba(120,80,30,0.18)", marginBottom:2,
                      }}>Consumables</div>
                    )}

                    {/* Weathered Realm Shells — consumable catching stack */}
                    {shellsCollected && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src="/__mockup/images/weathered-shell.png" alt="Shell" style={{
                          width:50, height:50, objectFit:"contain",
                          flexShrink:0, mixBlendMode:"multiply",
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14 }}>
                            Weathered Realm Shell
                          </div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:4, lineHeight:1.5 }}>
                            A shell worn smooth by realms unknown. Draws wandering Tayanari close.
                          </div>
                          <div style={{ color:"#4a7a4a", fontSize:10, fontWeight:700, marginTop:4 }}>
                            +10% XP to bonded Tayanari
                          </div>
                          <div style={{ color:"#a07050", fontSize:10, marginTop:2, fontStyle:"italic" }}>
                            Too worn to socket a rune
                          </div>
                        </div>
                        <div style={{
                          color:"#7a4e1a", fontSize:14, fontWeight:900,
                          background:"rgba(100,64,20,0.10)",
                          padding:"4px 12px", borderRadius:20,
                          border:"1px solid rgba(100,64,20,0.22)",
                          flexShrink:0,
                        }}>×{shellCount}</div>
                      </div>
                    )}

                    {/* ── Field Berries (Hollis gift) ── */}
                    {(duskberries + thornberries + calmberries + brightberries > 0) && (
                      <div style={{ marginTop:2, marginBottom:2 }}>
                        <div style={{ color:"#9a6e2e", fontSize:9.5, fontWeight:900, letterSpacing:1.5, textTransform:"uppercase", padding:"8px 2px 2px", borderBottom:"1px solid rgba(120,80,30,0.18)", marginBottom:4 }}>Field Berries</div>
                        {[
                          { count: duskberries,   label:"Duskberry",   sub:"HP +30%",   img:"/__mockup/images/duskberry.png",   color:"#9860d0" },
                          { count: thornberries,  label:"Thornberry",  sub:"ATK +8",    img:"/__mockup/images/thornberry.png",  color:"#e03030" },
                          { count: calmberries,   label:"Calmberry",   sub:"DEF +8",    img:"/__mockup/images/calmberry.png",   color:"#30b870" },
                          { count: brightberries, label:"Brightberry", sub:"PP+CD fix", img:"/__mockup/images/brightberry.png", color:"#e0c020" },
                        ].filter(b => b.count > 0).map(b => (
                          <div key={b.label} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 2px 6px", borderBottom:"1px dashed rgba(100,64,20,0.18)" }}>
                            <img src={b.img} alt={b.label} style={{ width:36, height:36, objectFit:"contain", flexShrink:0 }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ color:"#2a1206", fontWeight:800, fontSize:13 }}>{b.label}</div>
                              <div style={{ color:"#826040", fontSize:10, marginTop:2 }}>{b.sub}</div>
                            </div>
                            <div style={{ color:b.color, fontSize:13, fontWeight:900 }}>×{b.count}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Relics ── (hidden once socketed/equipped) */}
                    {((hasResonanceStone && !resonanceStoneEquipped) || (hasHealingRune && !healingRuneEquipped)) && (
                      <div style={{
                        color:"#4a6a9a", fontSize:9.5, fontWeight:900, letterSpacing:1.5,
                        textTransform:"uppercase", padding:"10px 2px 2px",
                        borderBottom:"1px solid rgba(80,120,170,0.18)", marginBottom:2,
                      }}>Relics</div>
                    )}

                    {/* Resonance Stone — only shown when not equipped */}
                    {hasResonanceStone && !resonanceStoneEquipped && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src="/__mockup/images/resonance-stone.png" alt="Resonance Stone" style={{
                          width:48, height:48, objectFit:"contain", flexShrink:0,
                          filter:"drop-shadow(0 0 6px rgba(80,160,240,0.5))",
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14 }}>
                            Resonance Stone
                          </div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:4, lineHeight:1.5 }}>
                            Builds bond between Keeper and Tayanari. Equip to use elemental moves in battle.
                          </div>
                          {starter && (
                            <div style={{ color:"#4a80c0", fontSize:10, fontWeight:700, marginTop:4 }}>
                              Attuned to {starter.type} · scales with bond
                            </div>
                          )}
                        </div>
                        <div style={{
                          color:"#4a6a9a", fontSize:12, fontWeight:900,
                          background:"rgba(60,100,160,0.10)",
                          padding:"4px 12px", borderRadius:20,
                          border:"1px solid rgba(80,130,200,0.22)",
                          flexShrink:0,
                        }}>×1</div>
                      </div>
                    )}

                    {/* Obsidian Healing Rune — only shown when not equipped */}
                    {hasHealingRune && !healingRuneEquipped && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src="/__mockup/images/obsidian-healing-rune.png" alt="Obsidian Healing Rune"
                          style={{ width:44, height:44, borderRadius:9, flexShrink:0,
                            objectFit:"contain",
                            filter:"drop-shadow(0 0 6px rgba(120,80,220,0.6))" }}
                        />
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14 }}>
                            Obsidian Healing Rune
                          </div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:5, lineHeight:1.5 }}>
                            Heals 50% of max HP once per battle. Socket into a shell via the Shells tab.
                          </div>
                        </div>
                        <div style={{
                          color:"#406a40", fontSize:14, fontWeight:900,
                          background:"rgba(60,120,60,0.10)",
                          padding:"4px 12px", borderRadius:20,
                          border:"1px solid rgba(80,160,80,0.22)",
                          flexShrink:0,
                        }}>×1</div>
                      </div>
                    )}

                    {/* Hearthberries — from Lia */}
                    {hasHearthberries && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src="/__mockup/images/hearthberry.png" alt="Hearthberry" style={{
                          width:48, height:48, objectFit:"contain", flexShrink:0,
                          filter:"drop-shadow(0 0 5px rgba(255,100,40,0.45))",
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14 }}>
                            Hearthberry
                          </div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:4, lineHeight:1.5 }}>
                            Use before attempting a bond. Lowers a wild Tayanari's guard and raises catch chance.
                          </div>
                          <div style={{ color:"#c05020", fontSize:10, fontWeight:700, marginTop:4 }}>
                            +15% bond success rate
                          </div>
                        </div>
                        <div style={{
                          color:"#8a3a14", fontSize:14, fontWeight:900,
                          background:"rgba(180,70,30,0.10)",
                          padding:"4px 12px", borderRadius:20,
                          border:"1px solid rgba(200,90,40,0.22)",
                          flexShrink:0,
                        }}>×10</div>
                      </div>
                    )}

                    {/* ── Field Gear ── */}
                    {hasSatchel && (
                      <div style={{
                        color:"#7a5a28", fontSize:9.5, fontWeight:900, letterSpacing:1.5,
                        textTransform:"uppercase", padding:"10px 2px 2px",
                        borderBottom:"1px solid rgba(140,100,40,0.18)", marginBottom:2,
                      }}>Field Gear</div>
                    )}

                    {/* Keeper's Satchel — from Lia */}
                    {hasSatchel && (
                      <div style={{
                        display:"flex", alignItems:"center", gap:13,
                        padding:"10px 2px 13px",
                        borderBottom:"1px dashed rgba(100,64,20,0.28)",
                      }}>
                        <img src="/__mockup/images/keepers-satchel.png" alt="Keeper's Satchel" style={{
                          width:48, height:48, objectFit:"contain", flexShrink:0,
                          filter:"drop-shadow(0 0 4px rgba(160,100,40,0.4))",
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14 }}>
                            Keeper's Satchel
                          </div>
                          <div style={{ color:"#826040", fontSize:11, marginTop:4, lineHeight:1.5 }}>
                            Field-grade leather satchel. Expands carry capacity for items and shells on the road.
                          </div>
                          <div style={{ color:"#7a6030", fontSize:10, fontWeight:700, marginTop:4 }}>
                            +4 item slots
                          </div>
                        </div>
                        <div style={{
                          color:"#6a4818", fontSize:14, fontWeight:900,
                          background:"rgba(120,80,30,0.10)",
                          padding:"4px 12px", borderRadius:20,
                          border:"1px solid rgba(160,110,50,0.22)",
                          flexShrink:0,
                        }}>×1</div>
                      </div>
                    )}

                    {/* Empty satchel slots — only meaningful once the Satchel is carried */}
                    {hasSatchel && [1,2,3,4].map(n => (
                      <div key={n} style={{
                        padding:"11px 2px",
                        borderBottom:"1px dashed rgba(100,64,20,0.16)",
                        color:"#c8a87a", fontSize:11, fontStyle:"italic",
                      }}>— empty slot —</div>
                    ))}
                  </div>
                )}

                {/* ── GUIDE PAGE ──────────────────────────────── */}
                {/* ── EQUIPMENT PAGE ───────────────────────────────── */}
                {journalTab === "equipment" && (() => {
                  const slots = [
                    { id:"headband",  slot:"Head",    icon:"🎩", label:"Headband" },
                    { id:"armor",     slot:"Body",    icon:"🥼", label:"Armor" },
                    { id:"wristband", slot:"Wrists",  icon:"🪬", label:"Wristband" },
                    { id:"shoes",     slot:"Feet",    icon:"👟", label:"Shoes" },
                  ] as const;
                  return (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {/* Keeper label strip */}
                      <div style={{ textAlign:"center", padding:"4px 0 10px", color:"#8a5c22", fontSize:9, fontWeight:800, letterSpacing:2.5 }}>
                        KEEPER LOADOUT
                      </div>

                      {/* Empty gear slots */}
                      {slots.map(eq => (
                        <div key={eq.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 12px", borderRadius:10, background:"rgba(60,40,10,0.04)", border:"1.5px dashed rgba(100,64,20,0.20)" }}>
                          <div style={{ width:38, height:38, borderRadius:8, background:"rgba(60,40,10,0.06)", border:"1.5px dashed rgba(100,64,20,0.22)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>
                            {eq.icon}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ color:"#8a5c22", fontSize:8, fontWeight:800, letterSpacing:1.8, textTransform:"uppercase" }}>{eq.slot}</div>
                            <div style={{ color:"#2a1206", fontWeight:700, fontSize:11, marginTop:2 }}>{eq.label}</div>
                            <div style={{ color:"rgba(100,64,20,0.38)", fontSize:9, marginTop:2, fontStyle:"italic" }}>— Empty —</div>
                          </div>
                        </div>
                      ))}

                      {/* Divider */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0" }}>
                        <div style={{ flex:1, height:1, background:"rgba(100,64,20,0.18)" }}/>
                        <span style={{ color:"rgba(100,64,20,0.45)", fontSize:8, fontWeight:800, letterSpacing:2 }}>RESONANCE</span>
                        <div style={{ flex:1, height:1, background:"rgba(100,64,20,0.18)" }}/>
                      </div>

                      {/* Resonance Stone slot — live state */}
                      <div style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 12px", borderRadius:10, background: resonanceStoneEquipped ? "rgba(40,70,180,0.07)" : "rgba(60,40,10,0.04)", border:`1.5px solid ${resonanceStoneEquipped ? "rgba(80,110,220,0.35)" : "rgba(100,64,20,0.22)"}` }}>
                        <div style={{ width:38, height:38, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:20, background: resonanceStoneEquipped ? "rgba(60,90,220,0.12)" : "rgba(60,40,10,0.06)", border:`1.5px solid ${resonanceStoneEquipped ? "rgba(80,110,220,0.4)" : "rgba(100,64,20,0.22)"}` }}>
                          ◈
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ color: resonanceStoneEquipped ? "#3d5db0" : "#8a5c22", fontSize:8, fontWeight:800, letterSpacing:1.8, textTransform:"uppercase" }}>Resonance Slot</div>
                          <div style={{ color:"#2a1206", fontWeight:700, fontSize:11, marginTop:2 }}>Resonance Stone</div>
                          <div style={{ fontSize:9, marginTop:2, color: resonanceStoneEquipped ? "#5070c0" : hasResonanceStone ? "rgba(100,64,20,0.5)" : "rgba(100,64,20,0.35)", fontStyle: hasResonanceStone ? "normal" : "italic" }}>
                            {resonanceStoneEquipped ? "Equipped · +20% catch rate" : hasResonanceStone ? "Owned · not equipped" : "— Not obtained —"}
                          </div>
                        </div>
                        {hasResonanceStone && (
                          <button
                            onClick={() => setResonanceStoneEquipped(e => !e)}
                            style={{ background: resonanceStoneEquipped ? "rgba(180,40,40,0.10)" : "rgba(60,90,200,0.12)", border:`1px solid ${resonanceStoneEquipped ? "rgba(180,60,60,0.5)" : "rgba(60,90,200,0.5)"}`, color: resonanceStoneEquipped ? "#c05050" : "#4060c0", padding:"5px 11px", borderRadius:7, fontSize:10, fontWeight:700, cursor:"pointer", flexShrink:0 }}
                          >{resonanceStoneEquipped ? "Remove" : "Equip"}</button>
                        )}
                      </div>

                      {/* Coming soon note */}
                      <div style={{ textAlign:"center", color:"rgba(100,64,20,0.35)", fontSize:8, fontStyle:"italic", marginTop:6, letterSpacing:0.5 }}>
                        More equipment drops as you explore the world.
                      </div>
                    </div>
                  );
                })()}

                {journalTab === "guide" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    {([
                      { label:"Whisperroot Trail", mons: BESTIARY,    accent:"#50c040" },
                      { label:"Eastern Path",      mons: BESTIARY_R2, accent:"#40a8ff" },
                      { label:"Westwood Reaches",  mons: BESTIARY_A3, accent:"#c070ff" },
                    ]).map(({ label, mons, accent }) => (
                      <div key={label} style={{ marginBottom:12 }}>
                        <div style={{
                          color: accent, fontSize:9.5, fontWeight:900, letterSpacing:1.8,
                          textTransform:"uppercase", padding:"8px 2px 6px",
                          borderBottom:`1px solid ${accent}55`, marginBottom:6,
                        }}>{label}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                          {mons.filter((m, i, arr) => arr.findIndex(x => x.name === m.name) === i).map(m => {
                            const rc = RARITY_COLOR[m.rarity];
                            const tc = ELEMENT_COLOR[m.type as keyof typeof ELEMENT_COLOR] ?? "#aaa";
                            return (
                              <div key={m.id} style={{
                                display:"flex", flexDirection:"column", alignItems:"center",
                                background:"rgba(255,248,230,0.5)", borderRadius:7,
                                padding:"6px 4px 5px", gap:1,
                                border:`1px solid ${rc}33`,
                              }}>
                                {m.wildImg ? (
                                  <img src={m.wildImg} alt={m.name} style={{ width:52, height:52, objectFit:"contain" }}/>
                                ) : m.wildSheet ? (
                                  <div style={{ width:52, height:52, backgroundRepeat:"no-repeat", ...sheetBgStyle(m.wildSheet) }}/>
                                ) : (
                                  <div style={{ width:52, height:52, borderRadius:6, background: tc + "33", border:`1px solid ${tc}55` }}/>
                                )}
                                <div style={{ fontSize:8, fontWeight:800, color:"#2a1206", textAlign:"center", lineHeight:1.2, maxWidth:70, wordBreak:"break-word", marginTop:2 }}>{m.name}</div>
                                <div style={{ fontSize:7, color: tc, fontWeight:700 }}>{m.type}</div>
                                <div style={{ fontSize:7, fontWeight:900, color: rc, textTransform:"uppercase", letterSpacing:0.5 }}>{m.rarity}</div>
                                {(() => {
                                  const e1 = EVO_TABLE.find(e => e.from === m.id);
                                  if (!e1) return null;
                                  const e2 = EVO_TABLE.find(e => e.from === e1.to.id);
                                  return (
                                    <div style={{ fontSize:6, color:"#4a7a5a", fontWeight:700, marginTop:2, textAlign:"center", lineHeight:1.3, maxWidth:70 }}>
                                      →{e1.to.name}{e2 ? ` →${e2.to.name}` : ""}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom binding */}
              <div style={{
                height:5,
                background:"linear-gradient(90deg,#1e0f06,#3d2010,#2c1608,#1e0f06)",
                flexShrink:0,
              }}/>
            </div>
          </div>
        )}

        {/* Scene label */}
        <div style={{
          position:"absolute", top:8, left:"50%", transform:"translateX(-50%)",
          background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)",
          color:"#f0d060", fontSize:11, fontWeight:700, letterSpacing:1.5,
          padding:"4px 14px", borderRadius:20,
          border:"1px solid rgba(240,208,96,0.3)", pointerEvents:"none",
          textTransform:"uppercase", zIndex:5,
        }}>
          {scene === "overworld" ? "Primeria Village" : scene === "lab" ? "Prof. Irwyn's Lab" : scene === "maya" ? "Maya's Home" : scene === "jay" ? "Jay's Home" : scene === "ellio" ? "Ellio's Home" : scene === "lia" ? "Lia's Home" : scene === "route1" ? "Whisperroot Trail" : scene === "route2" ? "Route 2 — Eastern Path" : scene === "area3" ? "Westwood Reaches" : scene === "farm" ? "Primeria Farm" : scene === "shore" ? "Tidemark Shore" : scene === "town" ? "Clearbell Town" : scene === "town_left" ? "Clearbell — West Quarter" : scene === "town_right" ? "Clearbell — East Quarter" : scene === "battle" ? "Battle" : "Your Home"}
        </div>

        {/* Quest hint — current main objective */}
        {scene !== "battle" && !demoComplete && (() => {
          let hint = "";
          if (!starter)
            hint = "Visit the Lab — choose your first partner";
          else if (!shellsCollected)
            hint = "Maya — gather the Weathered Realm Shells";
          else if (!hasHealingRune)
            hint = "Jay — the Healing Rune awaits";
          else if (!hasResonanceStone)
            hint = "Ellio — pick up the Resonance Stone";
          else if (!hasHearthberries || !hasSatchel)
            hint = "Lia — Hearthberries & the Keeper's Satchel";
          else if (!route1Visited)
            hint = "Head north — Whisperroot Trail awaits";
          else if (!wifeIntercepted)
            hint = "Head east — explore the Eastern Path";
          else if (!route2Greeted)
            hint = "Speak with the farmer on the Eastern Path";
          else if (jayA3Wins === 0 && liaA3Wins === 0)
            hint = "Find the way west — Westwood Reaches";
          else if (jayA3Wins === 0 || liaA3Wins === 0)
            hint = "Face the remaining Keeper in Westwood Reaches";
          if (!hint) return null;
          return (
            <div style={{
              position:"absolute", top:36, left:"50%", transform:"translateX(-50%)",
              background:"rgba(0,0,0,0.52)", backdropFilter:"blur(5px)",
              color:"#b8e890", fontSize:9.5, fontWeight:700, letterSpacing:0.5,
              padding:"3px 13px", borderRadius:14,
              border:"1px solid rgba(100,180,60,0.3)", pointerEvents:"none",
              whiteSpace:"nowrap", zIndex:5,
            }}>▶ {hint}</div>
          );
        })()}

        {/* Role badge — declared path + active boon (hidden until declared) */}
        {roleChosen && (
        <div style={{
          position:"absolute", top:8, left:8,
          display:"flex", alignItems:"center", gap:6,
          background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)",
          padding:"4px 10px 4px 8px", borderRadius:18,
          border:"1px solid rgba(240,208,96,0.28)", pointerEvents:"none",
          zIndex:5,
        }}>
          <span style={{ color:"#f0d060", fontSize:12, lineHeight:1 }}>{role.glyph}</span>
          <span style={{ color:"#e8d8a8", fontSize:10, fontWeight:800, letterSpacing:0.6 }}>{role.name}</span>
          <span style={{ width:1, height:11, background:"rgba(240,208,96,0.22)" }} />
          <span style={{ color:"#9fd07a", fontSize:8.5, fontWeight:700, letterSpacing:0.3 }}>{role.buffLabel}</span>
        </div>
        )}

        {/* Encounter transition flourish — element-tinted radial burst on battle entry */}
        {/* ── SHELL PICKER MODAL (Shella) ────────────────────────────── */}
        {showShellPicker && (
          <div style={{ position:"absolute", inset:0, zIndex:90, background:"rgba(10,6,2,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 16px", overflowY:"auto" }}>
            <div style={{ color:"#f5c842", fontWeight:900, fontSize:16, letterSpacing:1, marginBottom:6 }}>Shella's Battle Shells</div>
            <div style={{ color:"#c8b080", fontSize:11, marginBottom:16, textAlign:"center" }}>Choose a Battle Shell to equip on your lead Tayanari. You can swap anytime from the Shells tab.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:360, marginBottom:16 }}>
              {BATTLE_SHELLS.map(bs => {
                const isEquipped = equippedBattleShellId === bs.id;
                return (
                  <button key={bs.id} onClick={() => {
                    if (!ownedBattleShellIds.includes(bs.id)) setOwnedBattleShellIds(ids => [...ids, bs.id]);
                    setEquippedBattleShellId(bs.id);
                  }} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:10, background: isEquipped ? "rgba(245,200,66,0.18)" : "rgba(255,255,255,0.05)", border:`1.5px solid ${isEquipped ? "#f5c842" : "rgba(245,200,66,0.25)"}`, cursor:"pointer", textAlign:"left" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background: isEquipped ? "#f5c842" : "#666", marginTop:3, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#f5e090", fontWeight:800, fontSize:12 }}>{bs.icon} {bs.name}{isEquipped ? " ✓" : ""}</div>
                      <div style={{ color:"#c0a060", fontSize:10, marginTop:2 }}>{bs.desc}</div>
                      <div style={{ color:"#90d060", fontSize:9.5, marginTop:2, fontStyle:"italic" }}>{bs.element} element</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => {
              if (!farmShellsGiven) { setFarmShellsGiven(true); setOwnedBattleShellIds(BATTLE_SHELLS.map(b => b.id)); }
              setShowShellPicker(false);
              setPhase("shella_done");
            }} style={{ background:"rgba(245,200,66,0.2)", border:"1.5px solid #f5c842", color:"#f5c842", padding:"8px 28px", borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer" }}>
              {equippedBattleShellId ? "Confirm ✓" : "Close"}
            </button>
          </div>
        )}

        {/* ── RUNE PICKER MODAL (Runrik) ──────────────────────────────── */}
        {showRunePicker && (
          <div style={{ position:"absolute", inset:0, zIndex:90, background:"rgba(4,4,16,0.93)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px 16px", overflowY:"auto" }}>
            <div style={{ color:"#8090f0", fontWeight:900, fontSize:16, letterSpacing:1, marginBottom:6 }}>Runrik's Battle Runes</div>
            <div style={{ color:"#a0a8e0", fontSize:11, marginBottom:16, textAlign:"center" }}>Pick one Battle Rune for your lead Tayanari — your first is free. Slot it before battle to feel the effect.</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:360, marginBottom:16 }}>
              {BATTLE_RUNES.map(br => {
                const isSlotted = slottedBattleRuneId === br.id;
                return (
                  <button key={br.id} onClick={() => {
                    setSlottedBattleRuneId(br.id);
                    if (!ownedBattleRuneIds.includes(br.id)) setOwnedBattleRuneIds(ids => [...ids, br.id]);
                  }} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:10, background: isSlotted ? "rgba(128,144,240,0.18)" : "rgba(255,255,255,0.05)", border:`1.5px solid ${isSlotted ? "#8090f0" : "rgba(128,144,240,0.25)"}`, cursor:"pointer", textAlign:"left" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background: isSlotted ? "#8090f0" : "#666", marginTop:3, flexShrink:0 }}/>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#c0c8ff", fontWeight:800, fontSize:12 }}>{br.icon} {br.name}{isSlotted ? " ✓" : ""}</div>
                      <div style={{ color:"#8090c0", fontSize:10, marginTop:2 }}>{br.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => {
              if (slottedBattleRuneId) setFarmRunesGiven(true);
              setShowRunePicker(false);
              setPhase("runrik_d4");
            }} style={{ background:"rgba(128,144,240,0.2)", border:"1.5px solid #8090f0", color:"#8090f0", padding:"8px 28px", borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer" }}>
              {slottedBattleRuneId ? "Slot Rune ✓" : "Close"}
            </button>
          </div>
        )}

        {encounterFlash && (
          <div key={encounterFlash.key} style={{
            position:"absolute", inset:0, pointerEvents:"none", zIndex:48,
            background:`radial-gradient(ellipse at 50% 52%, #fff 0%, ${encounterFlash.color} 30%, transparent 72%)`,
            animation:"encounterFlash 0.6s ease-out forwards",
            mixBlendMode:"screen",
          }}/>
        )}

        {/* Float message (flavor text on dormant hotspot click) */}
        {floatMsg && (
          <div key={floatMsg.key} style={{
            position:"absolute",
            left: floatMsg.x, top: floatMsg.y,
            transform:"translate(-50%, 0)",
            color:"#f0e0a0", fontSize:11, fontWeight:700,
            textShadow:"0 0 4px #000, 0 0 8px #000, 0 0 12px #000",
            pointerEvents:"none", zIndex:45,
            maxWidth:220, textAlign:"center", lineHeight:1.3,
            animation:"floatUp 2.5s ease-out forwards",
          }}>{floatMsg.text}</div>
        )}

        {/* Battle return notification */}
        {battleNotif && scene !== "battle" && (
          <div style={{
            position:"absolute", top:"38%", left:"50%",
            background:"rgba(8,4,2,0.94)",
            border:"1.5px solid rgba(240,200,80,0.6)",
            borderRadius:14, padding:"14px 22px",
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(240,200,80,0.3)",
            textAlign:"center",
            animation:"notifPop 0.4s ease-out forwards",
          }}>
            <div style={{ color:"#f0d890", fontSize:14, fontWeight:900 }}>{battleNotif.title}</div>
            {battleNotif.sub && <div style={{ color:"#a89070", fontSize:10, marginTop:3, letterSpacing:1 }}>{battleNotif.sub}</div>}
          </div>
        )}

        {/* ── Evolution animation overlay (fixed, covers everything) ───── */}
        {pendingEvo && starter && (
          <EvoScene
            preEvoSpec={starter}
            postEvoSpec={pendingEvo}
            evoBg={EVO_BG_IMG}
            onComplete={(evolved) => {
              setStarter(evolved);
              setPendingEvo(null);
              const rpt = pendingEvoDataRef.current;
              pendingEvoDataRef.current = null;
              if (rpt) window.setTimeout(() => setBattleReport(rpt), 400);
            }}
          />
        )}

        {/* Post-battle report — shell recovery + XP + level-up */}
        {battleReport && (
          <div
            onClick={() => setBattleReport(null)}
            style={{
              position:"absolute", inset:0,
              background:"rgba(0,0,0,0.72)",
              zIndex:75, display:"flex",
              alignItems:"center", justifyContent:"center",
              padding:24,
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth:340, width:"100%",
                background:"linear-gradient(180deg, rgba(40,24,12,0.98), rgba(20,10,4,0.98))",
                border:"2px solid rgba(180,130,60,0.6)",
                borderRadius:14, padding:"18px 20px",
                boxShadow:"0 6px 30px rgba(0,0,0,0.7)",
              }}>
              <div style={{ color:"#f0d060", fontSize:11, fontWeight:800, letterSpacing:2, marginBottom:10, textAlign:"center" }}>
                ━━ AFTER THE CLASH ━━
              </div>
              <div style={{ color:"#f0d890", fontSize:13, lineHeight:1.5, marginBottom:12 }}>
                {battleReport.outcome}
              </div>

              {battleReport.recovered > 0 && (
                <div style={{
                  background:"rgba(120,80,40,0.18)",
                  border:"1px solid rgba(180,130,60,0.35)",
                  borderRadius:8, padding:"8px 12px", marginBottom:8,
                }}>
                  <div style={{ color:"#e0c890", fontSize:11, fontWeight:700, marginBottom:2 }}>
                    🐚 Shells recovered: ×{battleReport.recovered}
                  </div>
                  <div style={{ color:"#a89070", fontSize:10, lineHeight:1.45, fontStyle:"italic" }}>
                    You gathered the empty Worn Realm Shells back from the brush — they didn't break, just opened.
                  </div>
                </div>
              )}

              {battleReport.lostToBond > 0 && (
                <div style={{
                  background:"rgba(80,40,120,0.18)",
                  border:"1px solid rgba(160,110,200,0.35)",
                  borderRadius:8, padding:"8px 12px", marginBottom:8,
                }}>
                  <div style={{ color:"#d0a8ff", fontSize:11, fontWeight:700 }}>
                    🐚 1 shell bonded with your new partner
                  </div>
                </div>
              )}

              {battleReport.xpGained > 0 && (
                <div style={{
                  background:"rgba(60,100,180,0.18)",
                  border:"1px solid rgba(100,160,255,0.35)",
                  borderRadius:8, padding:"8px 12px", marginBottom:8,
                }}>
                  <div style={{ color:"#a8c8ff", fontSize:11, fontWeight:700 }}>
                    ✦ {starter?.name ?? "Tayanari"} earned +{battleReport.xpGained} XP
                  </div>
                  <div style={{ color:"#7090c0", fontSize:10, marginTop:2 }}>
                    {(() => {
                      const cap = (wyvruntCaught && wyvruntForm >= 3) ? Infinity : (wyvruntCaught && wyvruntForm < 3) ? 30 : 25;
                      return (isFinite(cap) && battleReport.newLevel >= cap)
                        ? `Lv.${battleReport.newLevel} — MAX LEVEL`
                        : `Now Lv.${battleReport.newLevel} · ${starterXp}/${battleReport.newLevel * 10 + 10} XP`;
                    })()}
                  </div>
                  {(battleReport.companionCount ?? 0) > 0 && (
                    <div style={{ color:"#8ab0e0", fontSize:10, marginTop:4, borderTop:"1px solid rgba(100,160,255,0.2)", paddingTop:4 }}>
                      ✦ {battleReport.companionCount} companion{battleReport.companionCount === 1 ? "" : "s"} also earned +{battleReport.xpGained} XP
                    </div>
                  )}
                </div>
              )}

              {battleReport.levelUps > 0 && (
                <div style={{
                  background:"rgba(240,180,40,0.22)",
                  border:"1.5px solid rgba(240,200,80,0.6)",
                  borderRadius:8, padding:"10px 12px", marginBottom:8,
                  boxShadow:"0 0 16px rgba(240,200,80,0.25)",
                }}>
                  <div style={{ color:"#ffd860", fontSize:12, fontWeight:900, letterSpacing:1 }}>
                    ★ LEVEL UP ×{battleReport.levelUps}
                  </div>
                  <div style={{ color:"#e0b860", fontSize:10, marginTop:2, marginBottom:6 }}>
                    {starter?.name ?? "Tayanari"} is now Lv.{battleReport.newLevel}
                  </div>
                  {/* Stat gains */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
                    {(Object.keys(battleReport.statGains) as StatKey[]).map(k => (
                      <div key={k} style={{
                        background:"rgba(0,0,0,0.35)",
                        border:"1px solid rgba(240,200,80,0.45)",
                        borderRadius:6, padding:"3px 8px",
                        color:"#ffe890", fontSize:10, fontWeight:800,
                      }}>
                        +{battleReport.statGains[k]} {STAT_LABEL[k]}
                      </div>
                    ))}
                  </div>
                  {battleReport.newMoves.length > 0 && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop:"1px dashed rgba(240,200,80,0.3)" }}>
                      <div style={{ color:"#ffd860", fontSize:10, fontWeight:800, letterSpacing:1, marginBottom:4 }}>
                        ✦ NEW MOVE LEARNED
                      </div>
                      {battleReport.newMoves.map(m => (
                        <div key={m} style={{
                          color:"#fff0c0", fontSize:11, fontWeight:700,
                          padding:"3px 0",
                        }}>· {m}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setBattleReport(null)}
                style={{
                  marginTop:8, width:"100%", padding:"9px 22px",
                  background:"linear-gradient(180deg, #6a4a20, #3a2810)",
                  border:"1.5px solid rgba(240,200,80,0.55)",
                  borderRadius:8,
                  color:"#f0d890", fontSize:12, fontWeight:800,
                  cursor:"pointer",
                }}
              >Continue</button>
            </div>
          </div>
        )}

        {/* Starter gate dialogue */}
        {showStarterGate && (
          <div
            onClick={() => setShowStarterGate(false)}
            style={{
              position:"absolute", inset:0,
              background:"rgba(0,0,0,0.65)",
              zIndex:70, display:"flex",
              alignItems:"center", justifyContent:"center",
              padding:24,
            }}>
            <div style={{
              maxWidth:320,
              background:"linear-gradient(180deg, rgba(40,24,12,0.98), rgba(20,10,4,0.98))",
              border:"2px solid rgba(180,130,60,0.6)",
              borderRadius:14, padding:"18px 20px",
              boxShadow:"0 6px 30px rgba(0,0,0,0.7)",
              textAlign:"center",
            }}>
              <div style={{ color:"#f0d060", fontSize:11, fontWeight:800, letterSpacing:2, marginBottom:8 }}>
                ⚠ ROUTE BLOCKED ⚠
              </div>
              <div style={{ color:"#f0d890", fontSize:13, lineHeight:1.5 }}>
                Whisperroot Trail runs into wild ground where Tayanari don't hold back. Your village gave you everything you need — collect it first.
              </div>
              {(() => {
                const reqs = [
                  { ok: !!starter,                       label: "Choose a Tayanari at Prof. Irwyn's Lab" },
                  { ok: shellsCollected,                 label: "Maya — gather the Weathered Realm Shells" },
                  { ok: hasHealingRune,                  label: "Jay — receive the Obsidian Healing Rune" },
                  { ok: hasResonanceStone,               label: "Ellio — receive the Resonance Stone" },
                  { ok: hasHearthberries && hasSatchel,  label: "Lia — collect the Hearthberries & Satchel" },
                ];
                return (
                  <div style={{ textAlign:"left", marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
                    {reqs.map((r, i) => (
                      <div key={i} style={{
                        display:"flex", alignItems:"flex-start", gap:8,
                        fontSize:11.5, lineHeight:1.4,
                        color: r.ok ? "#86c878" : "#d8b486",
                      }}>
                        <span style={{ flexShrink:0, fontWeight:900, color: r.ok ? "#86c878" : "#9a7a4a" }}>
                          {r.ok ? "✓" : "○"}
                        </span>
                        <span style={{ textDecoration: r.ok ? "line-through" : "none", opacity: r.ok ? 0.7 : 1 }}>
                          {r.label}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <button
                onClick={() => setShowStarterGate(false)}
                style={{
                  marginTop:14, padding:"8px 22px",
                  background:"linear-gradient(180deg, #6a4a20, #3a2810)",
                  border:"1.5px solid rgba(240,200,80,0.55)",
                  borderRadius:8,
                  color:"#f0d890", fontSize:12, fontWeight:800,
                  cursor:"pointer",
                }}
              >OK</button>
            </div>
          </div>
        )}

        {/* Fade overlay */}
        <div style={{
          position:"absolute", inset:0, background:"#000",
          opacity: fading ? 1 : 0,
          transition:"opacity 0.35s ease",
          pointerEvents: fading ? "all" : "none",
          zIndex:50,
        }}/>
      </div>

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}

      {/* PORTRAIT + TOUCH — bottom bar */}
      {isTouch && !isLandscape && (
        <div style={{
          flexShrink:0,
          display:"flex", flexDirection:"column", alignItems:"center",
          gap:4, padding:"10px 0", paddingBottom:"max(18px, env(safe-area-inset-bottom, 18px))",
          background:"rgba(0,0,0,0.82)", backdropFilter:"blur(10px)",
        }}>
          <Btn d="up"   label="↑" />
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            <Btn d="left"  label="←" />
            {/* ── Character face avatar (HD portrait, face-cropped) ── */}
            <div style={{
              width:64, height:64, borderRadius:"50%",
              overflow:"hidden", flexShrink:0,
              border:"2px solid rgba(200,160,60,0.7)",
              boxShadow:"0 0 12px rgba(0,0,0,0.7), inset 0 0 6px rgba(200,160,60,0.15)",
              background:"rgba(18,10,5,0.92)",
              position:"relative",
            }}>
              <img
                src={`/__mockup/images/${CHAR_IMG_KEY[characterId]}_hero.png`}
                alt={characterId}
                style={{
                  position:"absolute",
                  height:200, width:"auto",
                  top:-10, left:"50%",
                  transform:"translateX(-50%)",
                  pointerEvents:"none",
                }}
              />
            </div>
            <Btn d="right" label="→" />
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <Btn d="down" label="↓" />
            <button onClick={() => { setJournalTab("party"); setShowJournal(true); }} style={{ width:52, height:52, borderRadius:12, background:"rgba(44,26,14,0.75)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }} aria-label="START — Menu">📖</button>
            <button onClick={() => { setJournalTab("bag"); setShowJournal(true); }} style={{ width:52, height:52, borderRadius:12, background:"rgba(44,26,14,0.75)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }} aria-label="SELECT — Bag">🎒</button>
            {primeriaCoin > 0 && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", width:52, height:52, borderRadius:12, background:"rgba(30,22,4,0.75)", border:"1.5px solid rgba(240,200,50,0.45)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)", backdropFilter:"blur(6px)", pointerEvents:"none" }}>
                <span style={{ fontSize:18, lineHeight:1 }}>₡</span>
                <span style={{ fontSize:7, fontWeight:700, color:"#f0c830", letterSpacing:0.5, lineHeight:1.2 }}>{primeriaCoin}</span>
              </div>
            )}
            <button onClick={() => { persistWorldRef.current(); setJustSaved(true); window.setTimeout(() => setJustSaved(false), 1600); }} style={{ width:52, height:52, borderRadius:12, background: justSaved ? "rgba(30,60,30,0.85)" : "rgba(14,34,14,0.75)", border: justSaved ? "1.5px solid rgba(80,200,80,0.75)" : "1.5px solid rgba(80,160,80,0.45)", color: justSaved ? "#80e880" : "#70b870", fontSize: justSaved ? 18 : 20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow: justSaved ? "0 2px 12px rgba(80,200,80,0.35)" : "0 2px 8px rgba(0,0,0,0.5)", transition:"background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s" }} aria-label="Save game">{justSaved ? <span style={{ fontSize:16, fontWeight:900, lineHeight:1 }}>✓</span> : "💾"}<span style={{ fontSize:7, letterSpacing:0.5, fontWeight:700, lineHeight:1, color: justSaved ? "#80e880" : "#507850" }}>{justSaved ? "SAVED" : "SAVE"}</span></button>
          </div>
        </div>
      )}

      {/* LANDSCAPE + TOUCH — floating corner overlays */}
      {isTouch && isLandscape && (
        <>
          <div style={{ position:"absolute", bottom:"max(8px, env(safe-area-inset-bottom, 8px))", left:"max(8px, env(safe-area-inset-left, 8px))", zIndex:6, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(10px)", borderRadius:16, padding:"8px" }}>
            <Btn d="up"   label="↑" small />
            <div style={{ display:"flex", gap:3, alignItems:"center" }}>
              <Btn d="left"  label="←" small />
              <div style={{ width:52 }} />
              <Btn d="right" label="→" small />
            </div>
            <Btn d="down" label="↓" small />
          </div>
          <div style={{ position:"absolute", bottom:"max(8px, env(safe-area-inset-bottom, 8px))", right:"max(8px, env(safe-area-inset-right, 8px))", zIndex:6, display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
            <button onClick={() => { setJournalTab("party"); setShowJournal(true); }} style={{ width:52, height:52, borderRadius:12, background:"rgba(44,26,14,0.75)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>📖</button>
            <button onClick={() => { setJournalTab("bag"); setShowJournal(true); }} style={{ width:52, height:52, borderRadius:12, background:"rgba(44,26,14,0.75)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }}>🎒</button>
            <button onClick={() => { persistWorldRef.current(); setJustSaved(true); window.setTimeout(() => setJustSaved(false), 1600); }} style={{ width:52, height:52, borderRadius:12, background: justSaved ? "rgba(30,60,30,0.85)" : "rgba(14,34,14,0.75)", border: justSaved ? "1.5px solid rgba(80,200,80,0.75)" : "1.5px solid rgba(80,160,80,0.45)", color: justSaved ? "#80e880" : "#70b870", fontSize: justSaved ? 18 : 20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow: justSaved ? "0 2px 12px rgba(80,200,80,0.35)" : "0 2px 8px rgba(0,0,0,0.5)", transition:"background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s" }}>{justSaved ? <span style={{ fontSize:16, fontWeight:900, lineHeight:1 }}>✓</span> : "💾"}<span style={{ fontSize:7, letterSpacing:0.5, fontWeight:700, lineHeight:1, color: justSaved ? "#80e880" : "#507850" }}>{justSaved ? "SAVED" : "SAVE"}</span></button>
          </div>
        </>
      )}

      {/* DESKTOP (non-touch) — floating action buttons only, no D-pad */}
      {!isTouch && (
        <div style={{ position:"absolute", bottom:14, right:14, zIndex:6, display:"flex", gap:6 }}>
          <button onClick={() => { setJournalTab("party"); setShowJournal(true); }} style={{ width:44, height:44, borderRadius:10, background:"rgba(44,26,14,0.82)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:18, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }} title="Journal (J)">📖</button>
          <button onClick={() => { setJournalTab("bag"); setShowJournal(true); }} style={{ width:44, height:44, borderRadius:10, background:"rgba(44,26,14,0.82)", border:"1.5px solid rgba(180,130,60,0.45)", color:"#c8a44a", fontSize:18, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow:"0 2px 8px rgba(0,0,0,0.5)" }} title="Bag (B)">🎒</button>
          <button onClick={() => { persistWorldRef.current(); setJustSaved(true); window.setTimeout(() => setJustSaved(false), 1600); }} style={{ width:44, height:44, borderRadius:10, background: justSaved ? "rgba(30,60,30,0.85)" : "rgba(14,34,14,0.82)", border: justSaved ? "1.5px solid rgba(80,200,80,0.75)" : "1.5px solid rgba(80,160,80,0.45)", color: justSaved ? "#80e880" : "#70b870", fontSize: justSaved ? 16 : 18, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, cursor:"pointer", backdropFilter:"blur(6px)", boxShadow: justSaved ? "0 2px 12px rgba(80,200,80,0.35)" : "0 2px 8px rgba(0,0,0,0.5)", transition:"background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s" }} title="Save (S)">{justSaved ? <span style={{ fontSize:14, fontWeight:900, lineHeight:1 }}>✓</span> : "💾"}<span style={{ fontSize:7, letterSpacing:0.5, fontWeight:700, lineHeight:1, color: justSaved ? "#80e880" : "#507850" }}>{justSaved ? "SAVED" : "SAVE"}</span></button>
        </div>
      )}

      {/* ── DEV door-placement tool ──────────────────────────────────────── */}
      <button
        onClick={() => { setDevMode(v => !v); setDevProbe(null); }}
        style={{
          position:"fixed", top:8, left:8, zIndex:9999,
          padding:"6px 10px", borderRadius:8, border:"1px solid #2a78ff",
          background: devMode ? "#2a78ff" : "rgba(10,10,12,0.7)",
          color:"#fff", fontSize:12, fontWeight:800, letterSpacing:0.5,
          fontFamily:"monospace", cursor:"pointer",
        }}
      >{devMode ? "DEV ✕" : "DEV"}</button>
      {devMode && (
        <div style={{
          position:"fixed", top:8, left:64, right:8, zIndex:9999,
          padding: devCollapsed ? "5px 10px" : "8px 10px", borderRadius:8,
          background:"rgba(10,10,14,0.82)", border:"1px solid #2a78ff",
          color:"#dfe8ff", fontSize:12, fontFamily:"monospace", lineHeight:1.45,
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
            <div style={{ flex:1, minWidth:0 }}>
              Player: <b style={{color:"#fff"}}>{devPlayerPos.x}, {devPlayerPos.y}</b>
              {" · "}Tapped: <b style={{color:"#ffd400"}}>{devProbe ? `${devProbe.x}, ${devProbe.y}` : "—"}</b>
            </div>
            <button onClick={() => setDevCollapsed(v => !v)} style={{
              flexShrink:0, padding:"2px 8px", borderRadius:5,
              border:"1px solid #2a78ff", background:"rgba(42,120,255,0.2)",
              color:"#7fb0ff", fontWeight:800, fontSize:11, fontFamily:"monospace", cursor:"pointer",
            }}>{devCollapsed ? "▼" : "▲"}</button>
          </div>
          {!devCollapsed && (<>
            <div style={{ fontWeight:800, color:"#7fb0ff", marginTop:6 }}>DOOR TOOL</div>
            <div style={{ color:"#9fb0d0" }}>Drag blue boxes to move doors · tap ✦ to toggle glow per door</div>
            <button onClick={copyDoorLayout} style={{
              marginTop:6, padding:"5px 12px", borderRadius:6,
              border:"1px solid #2a78ff", background: doorCopied ? "#1f7a36" : "#2a78ff",
              color:"#fff", fontWeight:800, fontSize:12, fontFamily:"monospace", cursor:"pointer",
            }}>{doorCopied ? "✓ COPIED — paste it to me" : "COPY door layout"}</button>
            <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid rgba(127,176,255,0.3)" }}>
              <div style={{ fontWeight:800, color:"#ff9a7f" }}>WALL TOOL</div>
              <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                <button onClick={toggleWalls} style={{
                  padding:"5px 10px", borderRadius:6, border:"1px solid #ff5a3c",
                  background: WALLS_ON ? "#b5341f" : "rgba(20,12,10,0.7)",
                  color:"#fff", fontWeight:800, fontSize:12, fontFamily:"monospace", cursor:"pointer",
                }}>Walls: {WALLS_ON ? "ON" : "OFF"}</button>
                <button onClick={() => { setWallEditMode((v) => !v); setWallPendA(null); setDevProbe(null); }} style={{
                  padding:"5px 10px", borderRadius:6, border:"1px solid #ff5a3c",
                  background: wallEditMode ? "#b5341f" : "rgba(20,12,10,0.7)",
                  color:"#fff", fontWeight:800, fontSize:12, fontFamily:"monospace", cursor:"pointer",
                }}>Edit: {wallEditMode ? "ON" : "OFF"}</button>
              </div>
              {wallEditMode && (
                <div style={{ color:"#e0b0a0", marginTop:4 }}>
                  Tap two corners to draw a wall · drag a box to move · double-tap a box to delete.
                  {" "}First corner: <b style={{color:"#39ff88"}}>{wallPendA ? `${wallPendA.x}, ${wallPendA.y}` : "—"}</b>
                </div>
              )}
              <button onClick={copyWallLayout} style={{
                marginTop:6, padding:"5px 12px", borderRadius:6,
                border:"1px solid #ff5a3c", background: wallsCopied ? "#1f7a36" : "#ff5a3c",
                color:"#fff", fontWeight:800, fontSize:12, fontFamily:"monospace", cursor:"pointer",
              }}>{wallsCopied ? "✓ COPIED — paste it to me" : "COPY wall layout"}</button>
            </div>
          </>)}
        </div>
      )}

      <style>{`
        @keyframes pulse       { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes bounce      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes hsCommon   { 0%,100%{transform:translate(-50%,-50%) scale(1.00);opacity:0.62} 50%{transform:translate(-50%,-50%) scale(1.07);opacity:1} }
        @keyframes hsUncommon { 0%,100%{transform:translate(-50%,-50%) scale(1.00)} 42%{transform:translate(-50%,-50%) scale(1.15)} }
        @keyframes hsRare     { 0%{transform:translate(-50%,-50%) scale(1.00) rotate(0deg)} 33%{transform:translate(-50%,-50%) scale(1.22) rotate(4deg)} 66%{transform:translate(-50%,-50%) scale(1.16) rotate(-2deg)} 100%{transform:translate(-50%,-50%) scale(1.00) rotate(0deg)} }
        @keyframes hsUltra    { 0%,100%{transform:translate(-50%,-50%) scale(1.00);filter:brightness(1)} 30%{transform:translate(-50%,-50%) scale(1.32);filter:brightness(1.65)} 68%{transform:translate(-50%,-50%) scale(1.24);filter:brightness(1.38)} }
        @keyframes hsApex     { 0%,100%{transform:translate(-50%,-50%) scale(1.00) rotate(0deg);filter:brightness(1)} 24%{transform:translate(-50%,-50%) scale(1.42) rotate(5deg);filter:brightness(2.05)} 60%{transform:translate(-50%,-50%) scale(1.32) rotate(-3deg);filter:brightness(1.7)} }
        @keyframes hsOuterRing{ 0%{transform:translate(-50%,-50%) scale(1);opacity:0.88} 100%{transform:translate(-50%,-50%) scale(2.7);opacity:0} }
        @keyframes hsSparkle  { 0%,100%{transform:translate(-50%,-50%) scale(0);opacity:0} 35%{transform:translate(-50%,-50%) scale(1.5);opacity:1} 65%{transform:translate(-50%,-50%) scale(1.1);opacity:0.6} }
        @keyframes pillarPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes runeSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes floatUp     { 0%{opacity:0;transform:translate(-50%,0)} 15%{opacity:1} 100%{opacity:0;transform:translate(-50%,-40px)} }
        @keyframes notifPop    { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.85)} 25%{opacity:1;transform:translate(-50%,-50%) scale(1.05)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes encounterFlash { 0%{opacity:0;transform:scale(0.4)} 18%{opacity:1;transform:scale(1.04)} 55%{opacity:0.75} 100%{opacity:0;transform:scale(1.9)} }
        @keyframes dialogIn        { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes npcReact        { 0%{transform:translateY(0)} 20%{transform:translateY(-10px)} 45%{transform:translateY(-2px)} 65%{transform:translateY(-6px)} 82%{transform:translateY(-1px)} 100%{transform:translateY(0)} }
        @keyframes moteFloat       { 0%{opacity:0;transform:translateY(0) scale(1)} 35%{opacity:1} 75%{opacity:0.45} 100%{opacity:0;transform:translateY(-55px) scale(0.4)} }
      `}</style>
    </div>
  );
}
