import { useEffect, useRef, useState, useCallback } from "react";
import { BattleScene, RARITY_COLOR, type MonSpec, type MonRarity, type BattleResult, type StarterStats } from "./BattleScene";
import { SHELLS, ELEMENT_COLOR } from "./progression";
import { type CharId, type RoleId, type PartySave, readSave, updateParty, roleDef } from "./save";

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

// Element move names — placeholders; user will replace later.
const MOVE_NAMES = ["Strike", "Flare", "Surge", "Howl", "Pulse", "Crescent", "Maelstrom", "Dirge"];
function newMoveFor(type: string, existing: string[]): string {
  const idx = existing.length % MOVE_NAMES.length;
  return `${type} ${MOVE_NAMES[idx]}`;
}

// ── World sizes (pixels) ────────────────────────────────────────────────────
const OW = { w: 1124, h: 900 }; // overworld — matches full 1402×1122 map image at 900px height
const LB = { w: 700, h: 700 }; // lab
const R1 = { w: 1024, h: 780 }; // Whisperroot Trail (Area 1)
const SPEED     = 3.5;
const ZOOM      = 0.82; // zoom-out factor — values <1 show more of the world
const SPRITE_PX = 96;   // bigger on mobile
const ANCHOR    = 0.75; // fraction of sprite above anchor point

// ── Tayanari starter data ───────────────────────────────────────────────────
const STARTERS = [
  { id: "burg",       name: "Burg",       type: "Frostformed",  color: "#7ddeff", img: "/__mockup/images/frostbite-baby.png" },
  { id: "pebble",     name: "Pebble",     type: "Earthbound",   color: "#c8a020", img: "/__mockup/images/grrountain-baby.png" },
  { id: "peachi",     name: "Pea-chi",    type: "Nature",       color: "#50c040", img: "/__mockup/images/leafkit.png" },
  { id: "cerepup",    name: "Cerepup",    type: "Volcanic",     color: "#ff6020", img: "/__mockup/images/emberfox.png" },
  { id: "cunbubble",  name: "Cun-bubble", type: "Oceanic",      color: "#3080ff", img: "/__mockup/images/phantorch.png" },
  { id: "shockit",    name: "Shockit",    type: "Stormproven",  color: "#ffd000", img: "/__mockup/images/voltfang.png" },
  { id: "mentyke",    name: "Mentyke",    type: "Mind",         color: "#c080ff", img: "/__mockup/images/lumacorn.png" },
  { id: "foxin",      name: "Foxin",      type: "Spirit",       color: "#60a070", img: "/__mockup/images/vixgrim.png" },
] as const;
type StarterId = typeof STARTERS[number]["id"];

// ── Dialog phases ───────────────────────────────────────────────────────────
type Phase = "walk" | "d1" | "d2" | "pick" | "d3" | "d4" | "d5"
           | "maya_d1" | "maya_d2" | "maya_d3" | "maya_d4"
           | "maya_post1" | "maya_post2" | "maya_post3"
           | "jay_d1"  | "jay_d2"  | "jay_d3"  | "jay_d4"  | "jay_d5"  | "jay_done"
           | "jess_d1" | "jess_d2" | "jess_d3"
           | "ellio_d1" | "ellio_d2" | "ellio_d3" | "ellio_done"
           | "lia_d1"  | "lia_d2"  | "lia_d3"  | "lia_d4"  | "lia_d5"  | "lia_done"
           | "jess_path_d1" | "jess_path_d2"
           | "prof2_d1" | "prof2_d2" | "prof2_d3" | "prof2_d4"
           | "scripted_t1" | "scripted_t2" | "scripted_throw" | "scripted_caught";
type Scene = "overworld" | "lab" | "maya" | "jay" | "home" | "ellio" | "lia" | "route1" | "route2" | "battle";
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
    wildImg:"/__mockup/images/peachi-wild-a.png",  playerImg:"/__mockup/images/peachi-wild-b.png",
    wildFaces:"left", playerFaces:"left", maxHp:80, baseDmg:[8,14] },
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

// ── Route 2 (east of Maya's home) ───────────────────────────────────────────
// route2-map.png native 1024w × 1536h — vertical scrolling route, enter west.
const R2 = { w: 1024, h: 1536 };
const R2_SPAWN     = { x: 290, y: 1180 };   // red cross — west-side path entry
const PROF_R2_POS  = { x: 470, y: 1040 };   // yellow X — prof at signpost
const WYV_R2_POS   = { x: 620, y: 780 };    // wyvrunt appears north of prof
// Return-to-overworld trigger (west edge — aligned with the carved gap in the left forest mass)
const R2_RETURN_OW: Rect    = [0,  1120,  40, 1240];
// Locked future-content beats — show a "blocked"/"locked" toast
const R2_NORTH_BLOCKED: Rect = [520,   0, 780,  40]; // cliff stairs (top-right)
const R2_SOUTH_BLOCKED: Rect = [360, 1510, 600,1536]; // south continuation
const R2_LOCKED_DOOR: Rect   = [820, 760, 900, 830]; // locked house door
const R2_BLOCKED: Rect[] = [
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
const OW_EAST_EXIT: Rect = [1080, 600, 1124, 690]; // east-edge gap (x1<=1094 so it's inside the player X clamp world.w-30)
// Wife intercepts on the open central plaza (reachable open ground, not inside any building body)
const JESS_PATH_POS = { x: 430, y: 500 };

const RARITY_BASE: Record<MonRarity, number> = {
  common: 55, uncommon: 30, rare: 11, ultra: 3.5, apex: 0.5,
};

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

function pickMon(rarity: MonRarity): MonSpec {
  const pool = BESTIARY.filter(m => m.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)] ?? BESTIARY[0];
}

// ── Route 1 disturbance hotspots (clickable bushes/rocks/trees in world-space)
type Hotspot = { x: number; y: number; r: number; kind: "bush" | "rock" | "tree" };
const R1_HOTSPOTS: Hotspot[] = [
  { x: 180, y: 620, r: 38, kind: "bush" },
  { x: 320, y: 520, r: 36, kind: "rock" },
  { x: 500, y: 460, r: 42, kind: "tree" },
  { x: 680, y: 540, r: 38, kind: "bush" },
  { x: 820, y: 640, r: 38, kind: "rock" },
  { x: 240, y: 380, r: 38, kind: "tree" },
  { x: 580, y: 280, r: 40, kind: "bush" },
  { x: 760, y: 380, r: 38, kind: "bush" },
];

const FLAVOR_TRACKS = [
  "Soft prints curl into the leaves — Tayanari passed here, but not now.",
  "A scuffed patch of moss. Something small was sleeping under it.",
  "The branches still tremble. Whatever it was, it's long gone.",
  "You catch the scent of feathers and damp soil. Empty for now.",
  "Pawprints disappear into the brush. The trail goes cold.",
];

// ── Collision zones ─────────────────────────────────────────────────────────
const OW_BLOCKED: Rect[] = [
  // ── OUTER BORDERS ──────────────────────────────────────────────────────────
  [0,    0,   155,  900],  // left forest
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
  [160, 225,  214,  452],  // west fence
  [327, 225,  335,  452],  // east fence (shrunk x=327–335 — opens Route-1 corridor east of Jay)
  [160, 440,  240,  452],  // south fence — left of gate
  [308, 440,  335,  452],  // south fence — right of gate (shrunk to match east fence)

  // ── MAYA'S HOME — fence perimeter + body (south gate x 845–912) ────────────
  [807, 225,  928,  383],  // building body
  [775, 225,  807,  452],  // west fence
  [965, 225,  970,  452],  // east fence — shrunk (visible door extends east; was [928,225,970,452])
  [775, 440,  895,  452],  // south fence — left of gate (gate widened east to align with visible door)
  [960, 440,  970,  452],  // south fence — right of gate (gate widened east)

  // ── PLAYER HOME — fence perimeter + body (north gate x 532–602) ────────────
  [367, 590,  757,  820],  // building body — pushed south to leave a real yard
  [359, 537,  532,  547],  // north fence — left of gate  (was x1=340; trimmed for PH↔Elio south corridor)
  [602, 537,  765,  547],  // north fence — right of gate (was x2=782; trimmed for PH↔Lia south corridor)
  // PH west fence REMOVED — Elio↔PH corridor now spans body-to-body (x=327–367, ~40 wide)
  // PH east fence REMOVED — PH↔Lia corridor now spans body-to-body (x=757–807, ~50 wide)

  // ── ELLIO'S HOME — fence perimeter + body (north gate x 238–308) ───────────
  [214, 565,  327,  780],  // building body
  [188, 537,  238,  547],  // north fence — left of gate  (was x1=155; trimmed for west-side corridor x=155–188)
  [308, 537,  335,  547],  // north fence — right of gate (was x2=365; trimmed for Elio↔PH south corridor)
  [188, 537,  214,  790],  // west fence (narrowed for west-side corridor x=155–188)
  // Elio east fence REMOVED — Elio↔PH corridor widened to body-to-body

  // ── LIA'S HOME — fence perimeter + body (north gate x 846–910) ─────────────
  [807, 565,  942,  780],  // building body
  [789, 537,  846,  547],  // north fence — left of gate  (was x1=775; trimmed for PH↔Lia south corridor)
  [910, 537,  950,  547],  // north fence — right of gate (was x2=978; trimmed for east-side corridor x=950–978)
  // Lia west fence REMOVED — PH↔Lia corridor widened to body-to-body
  [942, 537,  950,  790],  // east fence (narrowed for east-side corridor x=950–978)
];

// ── Lia's Home ─────────────────────────────────────────────────────────────
const LH = { w: 800, h: 800 };
const LIA_POS = { x: 385, y: 355 }; // Lia near the center rug
const OW_LIA_DOOR: Rect  = [890, 780, 950, 810]; // ON visible front door — right side of Lia's south face (mailbox is on the LEFT)
const LIA_HOME_EXIT: Rect = [310, 722, 490, 790]; // bottom-center door
const LH_BLOCKED: Rect[] = [
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
const OW_ROUTE1_EXIT: Rect = [212, 0, 327, 15];
const OW_PROF_DOOR: Rect = [498, 328, 580, 378]; // tight zone around lab door (glow center x≈538)

// ── Whisperroot Trail (Route 1 / Area 1) ─────────────────────────────────────
// South gate (blue) connects back to town; north continues deeper (future)
const R1_SOUTH_GATE: Rect = [418, 750, 582, 780]; // bottom-center exit → overworld
const R1_BLOCKED: Rect[] = [
  // ── OUTER FOREST BORDER (thin strips only) ───────────────────────────────
  [0,    0,  1024,   50],  // top forest strip
  [0,    0,    52,  780],  // left forest strip
  [972,  0,  1024,  780],  // right forest strip
  [0,   750,  418,  780],  // bottom — left of south gate
  [582, 750,  1024, 780],  // bottom — right of south gate
  // ── POND / STREAM (water body only — bridge at x≈140–200 is walkable) ────
  [52,  330,  138,  580],  // pond water body
  // ── TOP STONE FENCE LINE (blocks passage into top forest) ────────────────
  [52,   50,  285,  108],  // top-left fence/wall line
  [680,  50,  972,  145],  // top-right rock wall + obelisk base
  // ── RIGHT OBELISK PILLARS (narrow columns) ────────────────────────────────
  [900,  145,  972,  320],  // tall right obelisk
  [888,  430,  972,  530],  // lower-right rock cluster
];

const LAB_BLOCKED: Rect[] = [
  [0,   0,   700, 22 ],  // top
  [0,   0,   22,  700],  // left wall
  [678, 0,   700, 700],  // right wall
  [0,   638, 262, 700],  // bottom-left
  [438, 638, 700, 700],  // bottom-right
  [0,   0,   700, 240],  // desk / board top area
  [0,   0,   142, 700],  // left cylinders
  [558, 0,   700, 700],  // right cylinders
];
const LAB_EXIT: Rect = [262, 645, 438, 692]; // exit lab

// ── Maya's Home ───────────────────────────────────────────────────────────────
const MY = { w: 800, h: 800 };
const MAYA_POS = { x: 870, y: 427 }; // Maya standing at her doorstep
const OW_MAYA_DOOR: Rect  = [895, 383, 960, 445]; // moved EAST to actual visible door art (mailbox/eaves were east of trigger before)
const MAYA_HOME_EXIT: Rect = [310, 722, 490, 790]; // exit trigger at interior door
const MAYA_SHELL: Rect     = [385, 400, 455, 460]; // pickup zone — center of the living-room rug
const MAYA_BLOCKED: Rect[] = [
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
const OW_JAY_DOOR: Rect  = [240, 400, 308, 448]; // tight zone at Jay's door (house body ends y=400)
const JAY_HOME_EXIT: Rect = [310, 725, 490, 790]; // interior door at bottom
const JAY_BLOCKED: Rect[] = [
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

// ── Ellio's Home ─────────────────────────────────────────────────────────────
const EH = { w: 800, h: 800 };
const ELLIO_POS = { x: 400, y: 350 };
const OW_ELLIO_DOOR: Rect  = [155, 780, 215, 810]; // ON visible front door — left side of Ellio's south face (mailbox is on the RIGHT)
const ELLIO_HOME_EXIT: Rect = [305, 725, 505, 790];
const EH_BLOCKED: Rect[] = [
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
const OW_PLAYER_HOME_DOOR: Rect = [545, 820, 605, 850]; // ON visible front door — narrowed to door art only (mailbox sits to the WEST outside this band); also requires "up" key to enter (anti walk-by)
const PLAYER_HOME_EXIT: Rect = [305, 725, 505, 790]; // bottom-center door
const PH_BLOCKED: Rect[] = [
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
function dirFrames(c: string): Record<string, string[]> {
  const p = (n: string) => `/__mockup/images/${c}_${n}.png`;
  const cycle = (dir: string) => [1, 2, 3, 4, 5, 6].map(i => p(`${dir}_${i}`));
  return {
    idle:       [p("front_idle")], // shown at game start, facing forward
    idle_up:    [p("back_idle")],  // stopped, facing away
    idle_side:  [p("side_idle")],  // stopped, facing side (right; mirrored for left)
    idle_down:  [p("front_idle")], // stopped, facing forward
    walk_side:  cycle("side"),
    walk_up:    cycle("back"),
    walk_down:  cycle("front"),
  };
}

const CHAR_FRAMES: Record<CharId, Record<string, string[]>> = {
  kael:  dirFrames("kael"),
  rowan: dirFrames("rowan"),
  jess:  dirFrames("jess"),
};

// Wyvrunt follower frame set (Pokémon-Yellow style trailing companion).
const WYV_FRAMES = dirFrames("wyvrunt");

const ALL_FRAME_SRCS: string[] = Object.values(CHAR_FRAMES)
  .flatMap(set => Object.values(set).flat());

// Sprites have transparent backgrounds. Normalise to displayW so all frames
// maintain their natural aspect ratio rather than being squashed into a square.
function drawSprite(
  canvas: HTMLCanvasElement, src: string, flipX: boolean, displayW = SPRITE_PX
): boolean {
  const img = imgCache[src];
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
function blocked(x: number, y: number, zones: Rect[]) {
  return zones.some(r => inRect(x, y, r));
}
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

// ── Prof Irwyn NPC world position in lab ────────────────────────────────────
const PROF = { x: 350, y: 268 }; // feet position in lab world

// Party holds the starter (slot 1) plus up to PARTY_CAP-1 caught companions.
const PARTY_CAP = 6;

// ── Main component ──────────────────────────────────────────────────────────
export function WalkDemo({ characterId = "kael", roleId = "keeper" }: { characterId?: CharId; roleId?: RoleId } = {}) {
  const role = roleDef(roleId);
  // Hydrate persisted party once on mount (Continue resumes; New Game cleared it).
  const savedParty = useRef<PartySave | null>(readSave()?.party ?? null).current;

  // Active character's animation frame set (stable for the session).
  const charFrames = CHAR_FRAMES[characterId] ?? CHAR_FRAMES.kael;

  // ── Role / spawn swap ──────────────────────────────────────────────────────
  // The spouse waiting at home is whichever of Kael/Jess you are NOT playing
  // (playing Rowan keeps Jess as spouse). Rowan, when not the player, becomes
  // the professor's disciple in the lab. When you play Rowan, Kael also waits at
  // home alongside Jess.
  const partnerId: CharId = characterId === "jess" ? "kael" : "jess";
  const partnerName  = partnerId === "kael" ? "Kael" : "Jess";
  const partnerSprite = `/__mockup/images/${partnerId}_front_idle.png`;
  const rowanInLab    = characterId !== "rowan";   // Rowan is the lab disciple
  const kaelAtHome    = characterId === "rowan";    // extra figure at home

  const [scene,       setScene]       = useState<Scene>("home");
  const [phase,       setPhase]       = useState<Phase>("walk");
  const [fading,      setFading]      = useState(false);
  const [held,        setHeld]        = useState<string | null>(null);
  const [nearProf,         setNearProf]         = useState(false);
  const [nearMaya,         setNearMaya]         = useState(false);
  const [nearJay,          setNearJay]          = useState(false);
  const [nearShell,        setNearShell]        = useState(false);
  const [shellsCollected,  setShellsCollected]  = useState(false);
  const [pickupNotif,      setPickupNotif]      = useState(false);
  const [selected,         setSelected]         = useState<StarterId | null>(null);
  const [starter,          setStarter]          = useState<typeof STARTERS[number] | null>(
    () => STARTERS.find(s => s.id === savedParty?.starterId) ?? null
  );
  const [showJournal,      setShowJournal]      = useState(false);
  const [journalTab,       setJournalTab]       = useState<"party"|"storage"|"shells"|"bag">("party");
  const [interactPos,      setInteractPos]      = useState({ sx: 0, sy: 0 });
  const [mayaInteractPos,  setMayaInteractPos]  = useState({ sx: 0, sy: 0 });
  const [jayInteractPos,   setJayInteractPos]   = useState({ sx: 0, sy: 0 });
  const [shellInteractPos, setShellInteractPos] = useState({ sx: 0, sy: 0 });
  const [nearJess,               setNearJess]               = useState(false);
  const [jessInteractPos,        setJessInteractPos]        = useState({ sx: 0, sy: 0 });
  const [hasHealingRune,         setHasHealingRune]         = useState(false);
  const [healingRuneEquipped,    setHealingRuneEquipped]    = useState(false);
  const [runeNotif,              setRuneNotif]              = useState(false);
  const [nearEllio,              setNearEllio]              = useState(false);
  const [ellioInteractPos,       setEllioInteractPos]       = useState({ sx: 0, sy: 0 });
  const [hasResonanceStone,      setHasResonanceStone]      = useState(false);
  const [resonanceStoneEquipped, setResonanceStoneEquipped] = useState(false);
  const [resonanceNotif,         setResonanceNotif]         = useState(false);
  // ── Quest-done guards — hide ! bubble once each NPC arc is finished ─────────
  const [jessDone,       setJessDone]       = useState(false);
  const [jayDone,        setJayDone]        = useState(false);
  const [mayaInitDone,   setMayaInitDone]   = useState(false); // after first convo (d4)
  const [mayaDone,       setMayaDone]       = useState(false); // after post-shell convo (post3)
  const [ellioDone,      setEllioDone]      = useState(false);
  const [nearLia,          setNearLia]          = useState(false);
  const [liaInteractPos,   setLiaInteractPos]   = useState({ sx: 0, sy: 0 });
  const [liaDone,          setLiaDone]          = useState(false);
  const [hasHearthberries, setHasHearthberries] = useState(false);
  const [hasSatchel,       setHasSatchel]       = useState(false);
  const [liaItemsNotif,    setLiaItemsNotif]    = useState(false);
  // ── Route 2 / Wyvrunt arc ────────────────────────────────────────────────
  const [route1Visited,        setRoute1Visited]        = useState(false);
  const [wifeOnPath,           setWifeOnPath]           = useState(false);
  const [wifeIntercepted,      setWifeIntercepted]      = useState(false);
  const [route2Greeted,        setRoute2Greeted]        = useState(false);
  const [profRoute2Done,       setProfRoute2Done]       = useState(false);
  const [nearProfR2,           setNearProfR2]           = useState(false);
  const [profR2InteractPos,    setProfR2InteractPos]    = useState({ sx: 0, sy: 0 });
  const [hasObsidianRealmShell, setHasObsidianRealmShell] = useState(false);
  const [wyvruntCaught,        setWyvruntCaught]        = useState(false);
  const [nearWyvrunt,          setNearWyvrunt]          = useState(false);
  const [eastGateNotif,        setEastGateNotif]        = useState(false);
  const [lockedDoorNotif,      setLockedDoorNotif]      = useState<string | null>(null);

  // ── Encounter / battle state ────────────────────────────────────────────
  const [shellCount,    setShellCount]    = useState(() => savedParty?.shells ?? 0);
  const [wildEncounter, setWildEncounter] = useState<MonSpec | null>(null);
  const [caughtParty,   setCaughtParty]   = useState<MonSpec[]>(() => savedParty?.caught ?? []);
  const [storageBox,    setStorageBox]    = useState<MonSpec[]>(() => savedParty?.box ?? []);
  const [activeDisturbances, setActiveDisturbances] = useState<Record<number, { mon: MonSpec; expiresAt: number }>>({});
  const [hotspotCd,     setHotspotCd]     = useState<Record<number, number>>({});
  const [checksStreak,  setChecksStreak]  = useState(0);
  const [floatMsg,      setFloatMsg]      = useState<{ x: number; y: number; text: string; key: number } | null>(null);
  const [showStarterGate, setShowStarterGate] = useState(false);
  const [battleNotif,   setBattleNotif]   = useState<{ title: string; sub: string } | null>(null);
  // ── Starter progression ───────────────────────────────────────────────────
  const [starterLevel, setStarterLevel] = useState(() => savedParty?.level ?? 5);
  const [starterXp,    setStarterXp]    = useState(() => savedParty?.xp ?? 0);
  const [starterStats, setStarterStats] = useState<StarterStats>(() => savedParty?.stats ?? { hp: 40, atk: 6, def: 4, spd: 5 });
  const [starterMoves, setStarterMoves] = useState<string[]>(() => savedParty?.moves ?? []);

  // Persist party progress whenever it changes (resumed via Continue).
  useEffect(() => {
    updateParty({
      starterId: starter?.id ?? null,
      level: starterLevel,
      xp: starterXp,
      stats: starterStats,
      moves: starterMoves,
      caught: caughtParty,
      box: storageBox,
      shells: shellCount,
    });
  }, [starter, starterLevel, starterXp, starterStats, starterMoves, caughtParty, storageBox, shellCount]);

  // Fresh snapshot of in-party caught mons for the catch handler closure.
  const caughtPartyRef = useRef<MonSpec[]>(caughtParty);
  useEffect(() => { caughtPartyRef.current = caughtParty; }, [caughtParty]);

  // Single source of truth for adding a captured mon: respects the party cap,
  // overflowing into the storage box. Returns true if the mon was boxed.
  const addCaughtMon = useCallback((mon: MonSpec): boolean => {
    if (caughtPartyRef.current.length >= PARTY_CAP - 1) {
      setStorageBox(b => [...b, mon]);
      return true;
    }
    setCaughtParty(p => [...p, mon]);
    return false;
  }, []);

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
  const kaelHomeCanvasRef  = useRef<HTMLCanvasElement>(null);

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

  const sceneRef   = useRef<Scene>("home");
  const phaseRef   = useRef<Phase>("walk");
  const fadingRef  = useRef(false);
  const heldRef    = useRef<string | null>(null);
  const animRef    = useRef("idle");
  const lastDirRef = useRef("idle_down"); // remembers facing direction when stopped
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  const lastSrc    = useRef("");
  const lastFlip   = useRef(false);
  const worldPos   = useRef({ x: 400, y: 670 }); // start inside Player Home (matches OW→home enter spawn)
  const cam        = useRef({ x: 0, y: 0 });

  // Preload everything
  useEffect(() => {
    [
      ...ALL_FRAME_SRCS,
      "/__mockup/images/overworld-map.png",
      "/__mockup/images/prof-lab-interior.png",
      "/__mockup/images/prof-irwyn-sprite.png",
      "/__mockup/images/maya-home-interior.png",
      "/__mockup/images/maya-sprite.png",
      "/__mockup/images/jay-home-interior.png",
      "/__mockup/images/jay-sprite.png",
      "/__mockup/images/player-home-interior.png",
      "/__mockup/images/jess-sprite.png",
      "/__mockup/images/ellio-home-interior.png",
      "/__mockup/images/ellio-sprite.png",
      "/__mockup/images/resonance-stone.png",
      "/__mockup/images/lia.png",
      "/__mockup/images/lia-home.png",
      "/__mockup/images/cindrax.png",
      "/__mockup/images/hearthberry.png",
      "/__mockup/images/keepers-satchel.png",
      "/__mockup/images/weathered-shell.png",
      "/__mockup/images/worn-realm-shell.png",
      "/__mockup/images/forest-arena.png",
      ...STARTERS.map(s => s.img),
      ...BESTIARY.flatMap(m => [m.wildImg, m.playerImg]),
      WYVRUNT_SPEC.wildImg,
      ...Object.values(WYV_FRAMES).flat(), // follower frames
      "/__mockup/images/route2-map.png",
    ].forEach(loadImg);
  }, []);

  useEffect(() => { heldRef.current = held; },      [held]);
  useEffect(() => { wifeOnPathRef.current      = wifeOnPath; },      [wifeOnPath]);
  useEffect(() => { wifeInterceptedRef.current = wifeIntercepted; }, [wifeIntercepted]);
  useEffect(() => { route2GreetedRef.current   = route2Greeted; },   [route2Greeted]);
  useEffect(() => { profRoute2DoneRef.current  = profRoute2Done; },  [profRoute2Done]);
  useEffect(() => { wyvruntCaughtRef.current   = wyvruntCaught; },   [wyvruntCaught]);
  useEffect(() => { route1VisitedRef.current   = route1Visited; },   [route1Visited]);
  useEffect(() => { starterRefArc.current      = !!starter; },       [starter]);
  useEffect(() => {
    allTownItemsRef.current = shellsCollected && hasHealingRune && hasResonanceStone && hasHearthberries && hasSatchel;
  }, [shellsCollected, hasHealingRune, hasResonanceStone, hasHearthberries, hasSatchel]);
  useEffect(() => { phaseRef.current = phase; },    [phase]);
  useEffect(() => { sceneRef.current = scene; },    [scene]);

  // Draw Prof Irwyn world sprite via canvas (proper transparency, no blend-mode)
  useEffect(() => {
    if (scene !== "lab") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 72)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, src, false, 68)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, src, false, 72)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, src, false, 82)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, src, false, 82)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, "/__mockup/images/rowan_front_idle.png", false, 78))
        setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, rowanInLab]);

  // Draw Kael also waiting at home when you are playing Rowan
  useEffect(() => {
    if (scene !== "home" || !kaelAtHome) return;
    const tryDraw = () => {
      const c = kaelHomeCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, "/__mockup/images/kael_front_idle.png", false, 82))
        setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, kaelAtHome]);

  // Draw Lia world sprite inside Lia's home
  useEffect(() => {
    if (scene !== "lia") return;
    const src = "/__mockup/images/lia.png";
    const tryDraw = () => {
      const c = liaCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 82)) setTimeout(tryDraw, 150);
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
      if (!drawSprite(c, src, false, 72)) setTimeout(tryDraw, 150);
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

  // Draw wife on the town path (overworld) only while intercepting
  useEffect(() => {
    if (scene !== "overworld" || !wifeOnPath) return;
    const src = partnerSprite;
    const tryDraw = () => {
      const c = jessPathCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 68)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene, wifeOnPath]);

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
    setTimeout(() => {
      worldPos.current = { x: sx, y: sy };
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
    const loop = () => {
      if (!fadingRef.current && phaseRef.current === "walk" && sceneRef.current !== "battle") {
        const h       = heldRef.current;
        const sc      = sceneRef.current;
        const world   = sc === "overworld" ? OW : sc === "lab" ? LB : sc === "route1" ? R1 : sc === "route2" ? R2 : sc === "maya" ? MY : sc === "jay" ? JY : sc === "ellio" ? EH : sc === "lia" ? LH : PH;
        const zones   = sc === "overworld" ? OW_BLOCKED : sc === "lab" ? LAB_BLOCKED : sc === "route1" ? R1_BLOCKED : sc === "route2" ? R2_BLOCKED : sc === "maya" ? MAYA_BLOCKED : sc === "jay" ? JAY_BLOCKED : sc === "ellio" ? EH_BLOCKED : sc === "lia" ? LH_BLOCKED : PH_BLOCKED;

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
        if (!blocked(nx, y,  zones)) worldPos.current.x = nx;
        if (!blocked(x,  ny, zones)) worldPos.current.y = ny;

        // Door triggers
        if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_ROUTE1_EXIT)) {
          if (!starterRefArc.current || !allTownItemsRef.current) {
            // Route 1 gate — need a starter AND all town errands done
            worldPos.current.y = OW_ROUTE1_EXIT[3] + 20;
            setShowStarterGate(true);
          } else {
            transitionTo("route1", 500, 718);     // enter Whisperroot Trail from south gate
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
          transitionTo("overworld", 1080, 645);
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_NORTH_BLOCKED)) {
          worldPos.current.y = R2_NORTH_BLOCKED[3] + 20;
          setLockedDoorNotif("The cliff stairs are sealed for now.");
          window.setTimeout(() => setLockedDoorNotif(null), 1600);
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_SOUTH_BLOCKED)) {
          worldPos.current.y = R2_SOUTH_BLOCKED[1] - 20;
          setLockedDoorNotif("The south path is blocked.");
          window.setTimeout(() => setLockedDoorNotif(null), 1600);
        } else if (sc === "route2" && inRect(worldPos.current.x, worldPos.current.y, R2_LOCKED_DOOR)) {
          worldPos.current.y = R2_LOCKED_DOOR[3] + 20;
          setLockedDoorNotif("It's locked.");
          window.setTimeout(() => setLockedDoorNotif(null), 1600);
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_PROF_DOOR as Rect)) {
          transitionTo("lab", 350, 590);
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
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_ELLIO_DOOR)) {
          transitionTo("ellio", 400, 670);      // enter Ellio's Home — trigger on visible front door
        } else if (sc === "ellio" && inRect(worldPos.current.x, worldPos.current.y, ELLIO_HOME_EXIT)) {
          transitionTo("overworld", 270, 830);  // exit onto south road, S of door
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_LIA_DOOR)) {
          transitionTo("lia", 400, 670);        // enter Lia's Home — trigger on visible front door
        } else if (sc === "lia" && inRect(worldPos.current.x, worldPos.current.y, LIA_HOME_EXIT)) {
          transitionTo("overworld", 875, 830);  // exit onto south road, S of door
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
        const wvpW = vpW  / ZOOM; // world units visible horizontally
        const wvpH = vpH  / ZOOM; // world units visible vertically
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
        if (wd)     wd.style.transform = `scale(${ZOOM}) translate(${-cam.current.x}px,${-cam.current.y}px)`;
        if (canvas) { canvas.style.left = `${px - spriteW/2}px`; canvas.style.top = `${py - topOff}px`; }
        if (shadow) { shadow.style.left = `${px - 18}px`;          shadow.style.top  = `${py + 2}px`; }

        // ── Wyvrunt follower (Pokémon-Yellow style trailing companion) ────────
        const followOn = wyvruntCaughtRef.current
          && (sc === "overworld" || sc === "route1" || sc === "route2");
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
        }
        // Near-Maya check (overworld only)
        if (sc === "overworld") {
          const d = dist(px, py, MAYA_POS.x, MAYA_POS.y);
          const near = d < 90;
          const screenX = (px - cam.current.x) * ZOOM;
          const screenY = (py - cam.current.y - topOff - 28) * ZOOM;
          setNearMaya(near);
          if (near) setMayaInteractPos({ sx: screenX, sy: screenY });
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
      scripted_t1: "scripted_t2", scripted_t2: "scripted_throw",
      scripted_throw: "scripted_caught", scripted_caught: "walk",
    };
    const next = map[from];
    if (next) setPhase(next);
  }, []);

  const pickStarter = useCallback(() => {
    if (!selected) return;
    const s = STARTERS.find(t => t.id === selected)!;
    setStarter(s);
    // Reset progression for the newly chosen starter
    setStarterLevel(5);
    setStarterXp(0);
    setStarterStats({ hp: 40, atk: 6, def: 4, spd: 5 });
    setStarterMoves([`${s.type} ${MOVE_NAMES[0]}`]); // L5 starts with one element move
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
    d1: "Ah — right on time. I knew today would be the day. I've had your partner selection ready since last week, if I'm honest. No more waiting — it is finally time. Choose your first Tayanari.",
    d2: "The bond between a Keeper and their Tayanari deepens through trust, exploration, and challenge. Treat them well and they will never let you down. Now — who is it going to be?",
    pick: "",
    d3: starter ? `${starter.name}! A wonderful choice. I can already sense a connection forming. Treat them well — they will never let you down.` : "",
    d4: "Head north past the village gate through Route 1 to the Wild Area. Wild Tayanari roam freely there. It is the best place for a new Keeper to earn their first bonds.",
    d5: "But be careful — wild Tayanari are spirited and won't hesitate to test you. Keep your partner healthy and your wits sharp. I'll meet you in the Wild Area. Safe travels, Keeper.",
    maya_d1: "There you are — I was hoping you'd stop by before you left. I've had something set aside for you for a while. My father's collection. I think today is finally the day I hand it over.",
    maya_d2: "My father... he was a legendary Keeper. He spent his whole life exploring, bonding with Tayanari no one else could ever reach. He passed last winter. I still miss him every single day.",
    maya_d3: "Before he left us, he entrusted me with his collection of Weathered Realm Shells — rare items that Keepers use in the wild. He told me: 'Give these to someone worthy, Maya. You'll know them when you see them.'",
    maya_d4: "I've been holding onto them, wondering who that person could be. But looking at you... I think he would be so proud. Please — go inside and take them. Make us both proud out there.",
    jay_d1: "Today's the day — you're walking into that lab and picking your first Tayanari. I've been thinking about this for months. I know exactly who I'm going for when it's my turn. You ready? Actually — doesn't matter. Today you're doing it either way.",
    jay_d2: "I've been training harder than you know. Every morning before you were even awake. I'm not stepping out of this village to finish second. That's not who I am and you know it.",
    jay_d3: "But I'm glad it's you out there with me. Nobody else I'd want watching my back. Stay sharp. And don't even think about falling behind — I won't be slowing down. Not for anyone.",
    jay_d4: "I don't go into anything blind. While everyone else was sparring in the yard I was reading — Realm theory, bonding science, rune taxonomy. There are rune types out there most Keepers have never even laid eyes on. Common, rare, mythic. Every single one of them has a name on my list. I'm collecting them all.",
    jay_d5: "Here's what they don't teach you early enough — socket a rune into a shell that holds a Tayanari and the bond amplifies. Offensive surge, healing pulse, barrier field. The right rune changes a battle in seconds. This one's yours. An Obsidian Healing Rune. Call it a head start. Don't waste it.",
    jess_d1: "Professor Irwyn sent word — he's ready for you whenever you are. But before you head to the lab, please stop and say a proper goodbye to everyone. Maya's been up since dawn. Jay has something for you too, though he'll act like it's nothing.",
    jess_d2: "This whole village has watched you grow up. They love you. Half of them were probably at their windows last night just knowing today was the day. Don't you dare sneak out without seeing them first.",
    jess_d3: "I packed your favourite bread in the outer pocket — you'll find it when you need it most. I love you. Now go. Come home with stories worth telling. And just... come home.",
    maya_post1: "You found them! Those Weathered Realm Shells have been waiting for someone like you. Here's something my father taught me — Tayanari are drawn to beautiful shells. Place one on the ground and a wild one may stop to investigate.",
    maya_post2: "It's never guaranteed. A calm Tayanari might wander in out of curiosity. Even a rampaging one can blunder straight into a shell and bond with it. The shell becomes its home — if it chooses to accept.",
    maya_post3: "And my father used to say: 'A shell is just a home, but a rune makes it a welcome.' There are many types of shells, each with their own energy — and so many runes to socket inside them. You've already found one, I hear.",
    jay_done: "You're good. Go find some wild ones to catch — I'll be right behind you.",
    ellio_d1: "I knew you'd stop by before you left — the whole village knew today was the day. I'm Ellio. Ask anyone in Primeria — my plan is to join the Merchants Collective. I've been studying trade routes, supply margins, market gaps. One day I'll be running caravans across every region. But right now, I've actually got something for you.",
    ellio_d2: "A Resonance Stone. I came across it on a trade caravan last season. The merchants swore these things build a genuine bond between a Keeper and their Tayanari — something about frequencies, shared energy, resonance between spirits. I don't fully understand the mechanics. But I know it's real.",
    ellio_d3: "Here's how they said to use it in battle: equip it to yourself — not your Tayanari. When you channel it, you can throw a small elemental move tuned to your partner's type. Raw and basic, but yours. I'm told it grows with you over time, though I don't know the full details yet. Take it. A merchant always travels light — and this one belongs with a Keeper.",
    ellio_done: "Safe roads. Come find me when you're a legend — I'll have something worth trading.",
    lia_d1: "Oh look — the kid finally made it to my door. Took you long enough. Come in. Draco won't bite... probably. He's in a decent mood today.",
    lia_d2: "That's Draco. Stone-Flame type. Stubborn, fierce, runs entirely on attitude and spite. We get along perfectly. He was bonded to me before you even knew what a Tayanari was.",
    lia_d3: "Look — strength alone doesn't cut it out there. The land gives you tools, you just have to know how to read them. Hearthberries. I've been collecting them for months. One before you attempt a bond and the wild Tayanari's guard drops — makes the whole thing smoother.",
    lia_d4: "Here. Ten of them. And take this satchel — good leather, field-grade. A Keeper who can't carry their kit is just a kid with a dragon, and you're not going to be that kid.",
    lia_d5: "Now get out of my house. And don't lose to anything on Route 1, alright? I will absolutely hear about it and I will not let it go. Ever. Go do something worth bragging about.",
    lia_done: "You're still here? Go. If you need more berries later, you know where I live.",
    jess_path_d1: "There you are! Professor Irwyn was looking for you. He said to meet him on Route 2 — past Maya's house, east of town. Wouldn't tell me why. Only that you'd understand when you got there.",
    jess_path_d2: "Go on. I'll head back home. ...Just be careful out there, alright?",
    prof2_d1: "There you are. I felt you on the wind. ...Or maybe just heard your boots on the path. Either way — come closer. There is something I want you to see.",
    prof2_d2: "I have been tracking a creature. Chaos-aligned. They do not behave like the others — and even their colors come in wrong. Lia bonded with one years ago. She calls hers Draco. Stubborn as her, and just as fierce.",
    prof2_d3: "But this one is rarer still. It came down from the high cliffs and stopped here. I think it has been waiting. For you, specifically. Here — take this. An Obsidianeye Realm Shell. Carved for the truly singular.",
    prof2_d4: "Go to it. Slowly. I will watch from here. If it is what I believe it is, it will not fight you. It will test you. Trust the moment.",
    scripted_t1: "The Wyvrunt is still. Watching you. Its tail-flame ripples but it does not strike. PROF: \"Don't move yet. Let it read you.\"",
    scripted_t2: "Its eyes soften — curiosity replacing caution. The yin-yang sigils on its scales flicker brighter. PROF: \"Now. The shell. It is ready.\"",
    scripted_throw: "You raise the Obsidianeye Realm Shell. Wyvrunt tilts its head — and waits.",
    scripted_caught: "The shell hums, drinks the light, and seals shut. Wyvrunt ☯ chose you. PROF: \"...Incredible. It bonded on the first try.\"",
  };

  // ── Encounter handlers & disturbance tick ──────────────────────────────────
  const hotspotCdRef     = useRef<Record<number, number>>({});
  const activeDistRef    = useRef<Record<number, { mon: MonSpec; expiresAt: number }>>({});
  const checksStreakRef  = useRef(0);
  useEffect(() => { hotspotCdRef.current   = hotspotCd; },          [hotspotCd]);
  useEffect(() => { activeDistRef.current  = activeDisturbances; }, [activeDisturbances]);
  useEffect(() => { checksStreakRef.current = checksStreak; },      [checksStreak]);

  useEffect(() => {
    if (scene !== "route1") return;
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
      const free = R1_HOTSPOTS.map((_, i) => i)
        .filter(i => !(i in nextActive) && (!cd[i] || cd[i] <= now) && !(i in newCds));
      if (Object.keys(nextActive).length < 4 && free.length > 0 && Math.random() < 0.75) {
        const idx = free[Math.floor(Math.random() * free.length)];
        const rarity = rollRarity(checksStreakRef.current);
        nextActive[idx] = { mon: pickMon(rarity), expiresAt: now + 30000 };
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
  }, [scene]);

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
      if (dist.mon.rarity === "ultra" || dist.mon.rarity === "apex") setChecksStreak(0);
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

  const handleBattleEnd = useCallback((result: BattleResult) => {
    const returnX = worldPos.current.x;
    const returnY = worldPos.current.y;

    // Shell recovery: thrown shells aren't destroyed, just emptied. Recover all except
    // the one consumed in the bond (if caught).
    const thrown   = result.shellsThrown;
    const lostBond = result.kind === "caught" ? Math.min(1, thrown) : 0;
    const recovered = Math.max(0, thrown - lostBond);
    if (recovered > 0) setShellCount(c => c + recovered);

    // XP + level-up math (gentle curve: level × 10, +2 per level — not skyrocket, not grindy)
    // Keeper's boon: bond XP is multiplied by the declared role's xpMult.
    const rawXp = (result.kind === "caught" || result.kind === "ko") ? result.xpGained : 0;
    const xpGained = rawXp > 0 ? Math.round(rawXp * role.xpMult) : 0;
    let newLevel  = starterLevel;
    let newXp     = starterXp + xpGained;
    let levelUps  = 0;
    let threshold = newLevel * 10 + 10;
    // Aggregate stat gains and new moves across every level gained this battle
    const totalGains: Partial<Record<StatKey, number>> = {};
    const newMoves: string[] = [];
    let workingMoves = [...starterMoves];
    while (newXp >= threshold) {
      newXp    -= threshold;
      newLevel += 1;
      levelUps += 1;
      const g = rollLevelUpGains();
      for (const k of Object.keys(g) as StatKey[]) {
        totalGains[k] = (totalGains[k] ?? 0) + (g[k] ?? 0);
      }
      // Learn a new move every 3 levels (L8, L11, L14, ...)
      if (newLevel % 3 === 0) {
        const m = newMoveFor(starter?.type ?? "Element", workingMoves);
        workingMoves.push(m);
        newMoves.push(m);
      }
      threshold = newLevel * 10 + 10;
    }
    if (xpGained > 0) {
      setStarterXp(newXp);
      if (levelUps > 0) {
        setStarterLevel(newLevel);
        setStarterStats(s => ({
          hp:  s.hp  + (totalGains.hp  ?? 0),
          atk: s.atk + (totalGains.atk ?? 0),
          def: s.def + (totalGains.def ?? 0),
          spd: s.spd + (totalGains.spd ?? 0),
        }));
        if (newMoves.length > 0) setStarterMoves(workingMoves);
      }
    }

    let outcome: string;
    if (result.kind === "caught") {
      const toBox = addCaughtMon(result.mon);
      if (toBox) {
        setBattleNotif({ title: `Bond formed — ${result.mon.name}!`, sub: "Party full · sent to Storage Box" });
        outcome = `${result.mon.name} bonded with you, but your party was full — it was sent to the Storage Box.`;
      } else {
        setBattleNotif({ title: `Bond formed — ${result.mon.name}!`, sub: "Joined your party · full heal" });
        outcome = `${result.mon.name} bonded with you and joined the party!`;
      }
      setChecksStreak(0);
    } else if (result.kind === "ko") {
      setBattleNotif({ title: `${result.mon.name} fainted!`, sub: `+${xpGained} XP` });
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
    transitionTo("route1", returnX, returnY);

    // Show post-battle report modal if there's anything to report (shells or xp)
    if (thrown > 0 || xpGained > 0) {
      window.setTimeout(() => {
        setBattleReport({
          outcome, xpGained, recovered, lostToBond: lostBond,
          levelUps, newLevel, statGains: totalGains, newMoves,
        });
      }, 1200);
    }
  }, [transitionTo, starter, healingRuneEquipped, starterLevel, starterXp, starterMoves, addCaughtMon]);

  // ── Battle scene — full takeover when scene === "battle" ───────────────────
  if (scene === "battle" && wildEncounter && starter) {
    return (
      <div style={{ width:"100vw", height:"100vh", background:"#000", position:"relative", overflow:"hidden" }}>
        <BattleScene
          wild={wildEncounter}
          starter={starter}
          starterLevel={starterLevel}
          starterStats={starterStats}
          hasResonanceStone={resonanceStoneEquipped}
          healingRuneEquipped={healingRuneEquipped}
          catchMult={role.catchMult}
          shellsCount={shellCount}
          onConsumeShell={() => setShellCount(c => Math.max(0, c - 1))}
          onConsumeRune={() => {}}
          onEnd={handleBattleEnd}
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
    <div style={{ width:"100vw", height:"100vh", background:"#060606", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── MAP VIEWPORT ─────────────────────────────────────────────────── */}
      <div ref={vpRef} style={{ flex:1, position:"relative", overflow:"hidden" }}>

        {/* World container — camera-scrolled + zoomed */}
        <div ref={worldRef} style={{
          position: "absolute",
          width:  scene === "overworld" ? OW.w : scene === "lab" ? LB.w : scene === "route1" ? R1.w : scene === "route2" ? R2.w : scene === "maya" ? MY.w : scene === "jay" ? JY.w : scene === "ellio" ? EH.w : scene === "lia" ? LH.w : PH.w,
          height: scene === "overworld" ? OW.h : scene === "lab" ? LB.h : scene === "route1" ? R1.h : scene === "route2" ? R2.h : scene === "maya" ? MY.h : scene === "jay" ? JY.h : scene === "ellio" ? EH.h : scene === "lia" ? LH.h : PH.h,
          willChange: "transform",
          transformOrigin: "0 0",
          transform: `scale(${ZOOM}) translate(${-cam.current.x}px,${-cam.current.y}px)`,
        }}>
          {/* Map background */}
          <img
            key={scene}
            src={scene === "ellio" ? "/__mockup/images/ellio-home-interior.png"
              : scene === "lia"    ? "/__mockup/images/lia-home.png"
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
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit: scene === "overworld" ? "fill" : "cover" }}
          />

          {/* Prof Irwyn */}
          {scene === "lab" && (
            <canvas
              ref={profCanvasRef}
              style={{
                position: "absolute",
                imageRendering: "auto",
                pointerEvents: "none",
                left: PROF.x - 36,
                top:  PROF.y - 54,
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
                  left: PROF.x + 78 - 34,
                  top:  PROF.y + 6 - 51,
                }}
              />
              <div style={{
                position:"absolute",
                left: PROF.x + 78 - 14, top: PROF.y + 6 - 78,
                color:"#cdbce8", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>ROWAN</div>
            </>
          )}

          {/* Lab door glow on overworld */}
          {scene === "overworld" && (
            <div style={{
              position:"absolute", left:516, top:348,
              width:44, height:10, borderRadius:"50%",
              background:"radial-gradient(ellipse,rgba(255,210,60,0.6)0%,transparent 80%)",
              animation:"pulse 1.4s ease-in-out infinite",
              pointerEvents:"none",
            }}/>
          )}

          {/* Jay NPC sprite inside his home — no fixed CSS w/h; canvas pixel dims set by drawSprite */}
          {scene === "jay" && (
            <canvas ref={jayCanvasRef} style={{
              position:"absolute",
              imageRendering:"auto", pointerEvents:"none",
              left: JAY_POS.x - 36,
              top:  JAY_POS.y - 54,
            }}/>
          )}

          {/* Maya NPC sprite outside her home */}
          {scene === "overworld" && (
            <>
              {/* no fixed CSS w/h — canvas pixel dims set by drawSprite to 68×(aspect-height) */}
              <canvas ref={mayaCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: MAYA_POS.x - 34,
                top:  MAYA_POS.y - 51,
              }}/>
              <div style={{
                position:"absolute",
                left: MAYA_POS.x - 20, top: MAYA_POS.y - 80,
                color:"#d4f0c0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>MAYA</div>
              {/* Maya's home door glow — south face yard (matches trigger center ~927,414) */}
              <div style={{
                position:"absolute", left:910, top:408,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(120,220,140,0.7)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Jay's home door glow — south face yard (matches trigger center ~274,424) */}
              <div style={{
                position:"absolute", left:252, top:418,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(100,160,255,0.7)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Player home door glow — south face on south road (matches trigger center ~575,835) */}
              <div style={{
                position:"absolute", left:553, top:828,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(255,160,90,0.75)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Ellio's home door glow — south face on south road (matches trigger center ~185,795) */}
              <div style={{
                position:"absolute", left:163, top:788,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(140,220,255,0.75)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Lia's home door glow — south face on south road (matches trigger center ~920,795) */}
              <div style={{
                position:"absolute", left:898, top:788,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(255,120,80,0.75)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
            </>
          )}

          {/* Jess NPC sprite inside player home */}
          {scene === "ellio" && (
            <>
              <canvas ref={ellioCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: ELLIO_POS.x - 34,
                top:  ELLIO_POS.y - 51,
              }}/>
              <div style={{
                position:"absolute",
                left: ELLIO_POS.x - 18, top: ELLIO_POS.y - 80,
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
                left: JESS_POS.x - 34,
                top:  JESS_POS.y - 51,
              }}/>
              <div style={{
                position:"absolute",
                left: JESS_POS.x - 16, top: JESS_POS.y - 80,
                color:"#f8d8b0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>{partnerName.toUpperCase()}</div>
              {kaelAtHome && (
                <>
                  <canvas ref={kaelHomeCanvasRef} style={{
                    position:"absolute",
                    imageRendering:"auto", pointerEvents:"none",
                    left: JESS_POS.x + 70 - 34,
                    top:  JESS_POS.y + 4 - 51,
                  }}/>
                  <div style={{
                    position:"absolute",
                    left: JESS_POS.x + 70 - 16, top: JESS_POS.y + 4 - 80,
                    color:"#f8d8b0", fontSize:8, fontWeight:800,
                    letterSpacing:1, pointerEvents:"none",
                    textShadow:"0 0 4px #000,0 0 8px #000",
                  }}>KAEL</div>
                </>
              )}
            </>
          )}

          {/* Lia NPC + Cindrax inside Lia's home */}
          {scene === "lia" && (
            <>
              <canvas ref={liaCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: LIA_POS.x - 36,
                top:  LIA_POS.y - 54,
              }}/>
              <div style={{
                position:"absolute",
                left: LIA_POS.x - 12, top: LIA_POS.y - 80,
                color:"#ffaa70", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>LIA</div>
              {/* Cindrax — static image beside Lia */}
              <img
                src="/__mockup/images/cindrax.png"
                alt="Cindrax"
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
              }}>CINDRAX</div>
            </>
          )}

          {/* Prof Irwyn + Wyvrunt on Route 2 */}
          {scene === "route2" && (
            <>
              <canvas ref={profR2CanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: PROF_R2_POS.x - 36,
                top:  PROF_R2_POS.y - 54,
              }}/>
              <div style={{
                position:"absolute",
                left: PROF_R2_POS.x - 30, top: PROF_R2_POS.y - 82,
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

              {/* Locked house door glow */}
              <div style={{
                position:"absolute",
                left:(R2_LOCKED_DOOR[0]+R2_LOCKED_DOOR[2])/2 - 22, top:R2_LOCKED_DOOR[3] - 8,
                width:44, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(200,150,120,0.45)0%,transparent 80%)",
                animation:"pulse 1.6s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
            </>
          )}

          {/* Wife on the south town path (overworld) — during intercept only */}
          {scene === "overworld" && wifeOnPath && (
            <>
              <canvas ref={jessPathCanvasRef} style={{
                position:"absolute",
                imageRendering:"auto", pointerEvents:"none",
                left: JESS_PATH_POS.x - 34,
                top:  JESS_PATH_POS.y - 51,
              }}/>
              <div style={{
                position:"absolute",
                left: JESS_PATH_POS.x - 16, top: JESS_PATH_POS.y - 80,
                color:"#f8d8b0", fontSize:8, fontWeight:800,
                letterSpacing:1, pointerEvents:"none",
                textShadow:"0 0 4px #000,0 0 8px #000",
              }}>{partnerName.toUpperCase()}</div>
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

          {/* Whisperroot Trail — south gate glow (world-space, visible through gate from road) */}
          {scene === "route1" && (
            <>
              <div style={{
                position:"absolute", left:460, top:742,
                width:80, height:14, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(100,220,120,0.6)0%,transparent 80%)",
                animation:"pulse 1.6s ease-in-out infinite",
                pointerEvents:"none",
              }}/>

              {/* Disturbance hotspots — clickable bushes/rocks/trees */}
              {R1_HOTSPOTS.map((h, i) => {
                const dist = activeDisturbances[i];
                const onCd = !!hotspotCd[i];
                const rarity = dist?.mon.rarity;
                const ringColor = rarity ? RARITY_COLOR[rarity] : "transparent";
                const drama = rarity === "apex" ? 1 : rarity === "ultra" ? 0.8 : rarity === "rare" ? 0.55 : rarity === "uncommon" ? 0.4 : rarity === "common" ? 0.25 : 0.15;
                return (
                  <button
                    key={i}
                    onClick={() => handleHotspotClick(i, h)}
                    style={{
                      position:"absolute",
                      left: h.x - h.r, top: h.y - h.r,
                      width: h.r * 2, height: h.r * 2,
                      borderRadius:"50%",
                      background: dist
                        ? `radial-gradient(circle, ${ringColor}66 0%, ${ringColor}22 55%, transparent 78%)`
                        : "transparent",
                      border: dist ? `2px solid ${ringColor}` : "2px dashed rgba(180,160,80,0.18)",
                      boxShadow: dist ? `0 0 ${20 + drama * 30}px ${ringColor}99` : "none",
                      animation: dist ? `disturb${rarity === "apex" || rarity === "ultra" ? "Big" : "Sml"} ${rarity === "apex" ? "1.0s" : rarity === "ultra" ? "1.2s" : "1.5s"} ease-in-out infinite` : undefined,
                      cursor:"pointer",
                      padding:0,
                      opacity: onCd ? 0.25 : 1,
                      zIndex: 4,
                    }}
                    aria-label={dist ? `disturbance-${rarity}` : `inspect-${h.kind}`}
                  />
                );
              })}

              {/* Apex pillar fx overlay */}
              {Object.entries(activeDisturbances).map(([k, d]) => {
                if (d.mon.rarity !== "apex" && d.mon.rarity !== "ultra") return null;
                const h = R1_HOTSPOTS[Number(k)];
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
          )}

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
        {scene === "lab" && nearProf && phase === "walk" && !starter && (
          <button
            onClick={() => setPhase("d1")}
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
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Jay ─────────────────────────────────────── */}
        {scene === "jay" && nearJay && phase === "walk" && !jayDone && (
          <button
            onClick={() => setPhase(hasHealingRune ? "jay_done" : "jay_d1")}
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
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Maya ────────────────────────────────────── */}
        {/* Green = first quest; amber = second quest (shells collected); hidden when both done */}
        {scene === "overworld" && nearMaya && phase === "walk"
          && !mayaDone && (shellsCollected || !mayaInitDone) && (
          <button
            onClick={() => setPhase(shellsCollected ? "maya_post1" : "maya_d1")}
            style={{
              position:"absolute",
              left: mayaInteractPos.sx - 14,
              top:  mayaInteractPos.sy - 10,
              width:28, height:28, borderRadius:"50%",
              background: shellsCollected ? "#f0c060" : "#80d0a0",
              border:"2px solid #fff",
              color: shellsCollected ? "#3a2000" : "#0a2018",
              fontSize:16, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Ellio ───────────────────────────────────── */}
        {scene === "ellio" && nearEllio && phase === "walk" && !ellioDone && (
          <button
            onClick={() => setPhase(hasResonanceStone ? "ellio_done" : "ellio_d1")}
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
            }}>!</button>
        )}

        {/* ── INTERACT BUTTON — Lia ─────────────────────────────────────── */}
        {scene === "lia" && nearLia && phase === "walk" && !liaDone && (
          <button
            onClick={() => setPhase(hasHearthberries ? "lia_done" : "lia_d1")}
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
            }}>!</button>
        )}

        {/* ── INTERACT BUTTON — Jess ────────────────────────────────────── */}
        {scene === "home" && nearJess && phase === "walk" && !jessDone && (
          <button
            onClick={() => setPhase("jess_d1")}
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
          >!</button>
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
            transform:"translate(-50%,-50%)",
            background:"rgba(4,12,4,0.96)",
            border:"1.5px solid rgba(80,200,80,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,200,80,0.25)",
          }}>
            <div style={{
              width:42, height:42, borderRadius:8, flexShrink:0,
              background:"radial-gradient(circle at 38% 33%,#1a4a1a,#0a1a0a)",
              border:"1.5px solid rgba(80,200,80,0.55)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"rgba(80,220,80,0.9)",
              boxShadow:"0 0 10px rgba(80,200,80,0.4)",
            }}>✦</div>
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
            transform:"translate(-50%,-50%)",
            background:"rgba(4,14,4,0.97)",
            border:"1.5px solid rgba(80,180,240,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,160,240,0.25)",
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
            transform:"translate(-50%,-50%)",
            background:"rgba(18,6,2,0.97)",
            border:"1.5px solid rgba(255,120,60,0.65)",
            borderRadius:14, padding:"14px 18px",
            display:"flex", flexDirection:"column", gap:10,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(255,100,40,0.25)",
            minWidth:210,
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
            transform:"translate(-50%,-50%)",
            background:"rgba(6,18,12,0.96)",
            border:"1.5px solid rgba(80,220,180,0.65)",
            borderRadius:14, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            zIndex:60, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(80,220,180,0.25)",
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
            zIndex:20,
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
                onClick={() => advanceDialog(phase)}
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
            zIndex:20,
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
            zIndex:20,
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
            zIndex:20,
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
            zIndex:20,
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
            zIndex:20,
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

        {/* ── SCRIPTED WYVRUNT CATCH ───────────────────────────────────── */}
        {(phase === "scripted_t1" || phase === "scripted_t2" || phase === "scripted_throw" || phase === "scripted_caught") && (
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
                  animation: phase === "scripted_throw" ? "pulse 0.6s ease-in-out infinite" : "pulse 1.8s ease-in-out infinite",
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

            {/* Catch flash overlay during throw / caught */}
            {(phase === "scripted_throw" || phase === "scripted_caught") && (
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
              zIndex:26,
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
                    if (phase === "scripted_throw") {
                      window.setTimeout(() => setPhase("scripted_caught"), 650);
                    } else if (phase === "scripted_caught") {
                      setWyvruntCaught(true);
                      addCaughtMon(WYVRUNT_SPEC);
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
                  phase === "scripted_throw" ? "Throw Obsidianeye Shell ☯"
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
            zIndex:20,
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
            zIndex:20,
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
                padding:"10px 16px 0",
                display:"flex", alignItems:"flex-end", justifyContent:"space-between",
                flexShrink:0, gap:10,
              }}>
                <span style={{
                  color:"#c8a44a", fontSize:10, fontWeight:800,
                  letterSpacing:3.5, textTransform:"uppercase",
                  paddingBottom:10,
                  textShadow:"0 1px 3px rgba(0,0,0,0.9)",
                }}>Keeper's Journal</span>

                {/* Page tabs flush with bottom of spine */}
                <div style={{ display:"flex", gap:3, alignSelf:"flex-end" }}>
                  {(["party","storage","shells","bag"] as const).map(tab => (
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
                    }}>{tab === "party" ? "Party" : tab === "storage" ? "Box" : tab === "shells" ? "Shells" : "Bag"}</button>
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
              </div>

              {/* Parchment body */}
              <div style={{ overflowY:"auto", padding:"14px 18px 22px", flex:1 }}>
                {/* Section header rule */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1, height:1, background:"rgba(100,64,20,0.28)" }}/>
                  <span style={{
                    color:"#8a5c22", fontSize:9, fontWeight:800,
                    letterSpacing:2.5, textTransform:"uppercase",
                  }}>{journalTab === "party" ? "Companions" : journalTab === "storage" ? "Storage Box" : "Carried Items"}</span>
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
                            Level&nbsp;1&emsp;·&emsp;HP 50 / 50
                          </div>
                          <div style={{ color:"#6a50a0", fontSize:9, fontWeight:800, marginTop:4, letterSpacing:0.5 }}>
                            ◈ Obsidianeye Shell{healingRuneEquipped ? "  ·  ✦ Healing Rune" : ""}
                          </div>
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
                              Resonance Stone · {starter.type} move · 10–20 dmg
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
                    {caughtParty.map((mon, i) => (
                      <div key={`${mon.id}-${i}`} style={{
                        padding:"11px 2px",
                        borderBottom:"1px dashed rgba(100,64,20,0.16)",
                        display:"flex", alignItems:"center", gap:13,
                      }}>
                        <img src={mon.playerImg} alt={mon.name} style={{
                          width:56, height:56, objectFit:"contain",
                          background:"rgba(60,30,0,0.05)", borderRadius:8,
                          mixBlendMode:"multiply", flexShrink:0,
                        }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#2a1206", fontWeight:800, fontSize:14, letterSpacing:0.3 }}>
                            {mon.name}{mon.nameIcon ? ` ${mon.nameIcon}` : ""}
                          </div>
                          <div style={{
                            display:"inline-block", marginTop:4,
                            fontSize:8.5, fontWeight:800, letterSpacing:1.6,
                            color:"#8a5c22", borderBottom:"1px solid rgba(100,64,20,0.35)",
                            paddingBottom:2,
                          }}>{mon.type.toUpperCase()}</div>
                          <div style={{ color: RARITY_COLOR[mon.rarity], fontSize:9, fontWeight:800, marginTop:4, letterSpacing:0.5 }}>
                            ◈ {mon.rarity.toUpperCase()}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setCaughtParty(p => p.filter((_, j) => j !== i));
                            setStorageBox(b => [...b, mon]);
                          }}
                          style={{
                            padding:"5px 10px", borderRadius:8, flexShrink:0,
                            background:"rgba(100,64,20,0.08)",
                            border:"1px solid rgba(100,64,20,0.30)",
                            color:"#8a5c22", fontSize:9.5, fontWeight:800, cursor:"pointer",
                          }}
                        >→ Box</button>
                        <div style={{
                          color:"#9a7040", fontSize:10, fontWeight:700,
                          background:"rgba(100,64,20,0.09)",
                          padding:"3px 9px", borderRadius:20,
                          border:"1px solid rgba(100,64,20,0.18)", flexShrink:0,
                        }}>No. {i + 2}</div>
                      </div>
                    ))}

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
                              <img src={mon.playerImg} alt={mon.name} style={{
                                width:54, height:54, objectFit:"contain",
                                background:"rgba(60,30,0,0.04)", borderRadius:8,
                                mixBlendMode:"multiply",
                              }}/>
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
                          }}>{healingRuneEquipped ? "✦" : "·"}</div>
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
                            <div style={{ color:"#8a6030", fontSize:10, marginTop:2 }}>×24 · Catching Shell</div>
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
                    {!shellsCollected && !hasHealingRune && !hasResonanceStone && !hasHearthberries && !hasSatchel && (
                      <div style={{
                        textAlign:"center", padding:"26px 0",
                        color:"#b09468", fontSize:12, fontStyle:"italic",
                      }}>— Your bag is empty. —</div>
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
                        }}>×24</div>
                      </div>
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
                              Attuned to {starter.type} · 10–20 dmg · scales with bond
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
                        <div style={{
                          width:44, height:44, borderRadius:9, flexShrink:0,
                          background:"radial-gradient(circle at 38% 33%,#1a4a1a,#0a1a0a)",
                          border:"1.5px solid rgba(80,200,80,0.5)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:22, color:"rgba(80,220,80,0.9)",
                          boxShadow:"0 0 8px rgba(80,200,80,0.25)",
                        }}>✦</div>
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

                    {[1,2,3].map(n => (
                      <div key={n} style={{
                        padding:"11px 2px",
                        borderBottom:"1px dashed rgba(100,64,20,0.16)",
                        color:"#c8a87a", fontSize:11, fontStyle:"italic",
                      }}>—</div>
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
          {scene === "overworld" ? "Primeria Village" : scene === "lab" ? "Prof. Irwyn's Lab" : scene === "maya" ? "Maya's Home" : scene === "jay" ? "Jay's Home" : scene === "ellio" ? "Ellio's Home" : scene === "lia" ? "Lia's Home" : scene === "route1" ? "Whisperroot Trail" : scene === "route2" ? "Route 2 — Eastern Path" : scene === "battle" ? "Battle" : "Your Home"}
        </div>

        {/* Role badge — declared path + active boon */}
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
                    Now Lv.{battleReport.newLevel} · {starterXp}/{battleReport.newLevel * 12} XP
                  </div>
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
                The trail beyond Primeria is wild ground. Finish what the town needs from you first.
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

      {/* ── D-PAD ───────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink:0,
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:4, padding:"10px 0", paddingBottom:"max(18px, env(safe-area-inset-bottom, 18px))",
        background:"rgba(0,0,0,0.82)", backdropFilter:"blur(10px)",
      }}>
        <Btn d="up"   label="↑" />
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <Btn d="left"  label="←" />
          <div style={{ width:64 }} />
          <Btn d="right" label="→" />
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Btn d="down" label="↓" />
          <button
            onClick={() => { setJournalTab("party"); setShowJournal(true); }}
            style={{
              width:52, height:52, borderRadius:12,
              background:"rgba(44,26,14,0.75)",
              border:"1.5px solid rgba(180,130,60,0.45)",
              color:"#c8a44a", fontSize:20,
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:1,
              cursor:"pointer", backdropFilter:"blur(6px)",
              boxShadow:"0 2px 8px rgba(0,0,0,0.5)",
            }}
            aria-label="START — Menu"
          >📖</button>
          <button
            onClick={() => { setJournalTab("bag"); setShowJournal(true); }}
            style={{
              width:52, height:52, borderRadius:12,
              background:"rgba(44,26,14,0.75)",
              border:"1.5px solid rgba(180,130,60,0.45)",
              color:"#c8a44a", fontSize:20,
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:1,
              cursor:"pointer", backdropFilter:"blur(6px)",
              boxShadow:"0 2px 8px rgba(0,0,0,0.5)",
            }}
            aria-label="SELECT — Bag"
          >🎒</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse       { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes bounce      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes disturbSml  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes disturbBig  { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.18) rotate(2deg)} }
        @keyframes pillarPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes floatUp     { 0%{opacity:0;transform:translate(-50%,0)} 15%{opacity:1} 100%{opacity:0;transform:translate(-50%,-40px)} }
        @keyframes notifPop    { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.85)} 25%{opacity:1;transform:translate(-50%,-50%) scale(1.05)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </div>
  );
}
