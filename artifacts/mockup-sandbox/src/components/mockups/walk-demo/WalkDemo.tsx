import { useEffect, useRef, useState, useCallback } from "react";

// ── World sizes (pixels) ────────────────────────────────────────────────────
const OW = { w: 1124, h: 900 }; // overworld — matches full 1402×1122 map image at 900px height
const LB = { w: 700, h: 700 }; // lab
const SPEED     = 3.5;
const ZOOM      = 0.82; // zoom-out factor — values <1 show more of the world
const SPRITE_PX = 96;   // bigger on mobile
const ANCHOR    = 0.75; // fraction of sprite above anchor point

// ── Tayanari starter data ───────────────────────────────────────────────────
const STARTERS = [
  { id: "frostbite",   name: "Frostbite",    type: "Ice",      color: "#7ddeff", img: "/__mockup/images/frostbite-baby.png" },
  { id: "grrountain",  name: "Grr-ountain",  type: "Rock",     color: "#c8a020", img: "/__mockup/images/grrountain-baby.png" },
  { id: "leafkit",     name: "Leafkit",      type: "Grass",    color: "#50c040", img: "/__mockup/images/leafkit.png" },
  { id: "emberfox",    name: "Emberfox",     type: "Fire",     color: "#ff6020", img: "/__mockup/images/emberfox.png" },
  { id: "phantorch",   name: "Phantorch",    type: "Water",    color: "#3080ff", img: "/__mockup/images/phantorch.png" },
  { id: "voltfang",    name: "Voltfang",     type: "Electric", color: "#ffd000", img: "/__mockup/images/voltfang.png" },
  { id: "lumacorn",    name: "Lumacorn",     type: "Fairy",    color: "#ff80cc", img: "/__mockup/images/lumacorn.png" },
  { id: "vixgrim",     name: "Vixgrim",      type: "Dark",     color: "#9040a0", img: "/__mockup/images/vixgrim.png" },
] as const;
type StarterId = typeof STARTERS[number]["id"];

// ── Dialog phases ───────────────────────────────────────────────────────────
type Phase = "walk" | "d1" | "d2" | "pick" | "d3" | "d4" | "d5"
           | "maya_d1" | "maya_d2" | "maya_d3" | "maya_d4"
           | "jay_d1"  | "jay_d2"  | "jay_d3"
           | "jess_d1" | "jess_d2" | "jess_d3";
type Scene = "overworld" | "lab" | "maya" | "jay" | "home";
type Rect  = [number, number, number, number]; // x1 y1 x2 y2 world-px

// ── Collision zones ─────────────────────────────────────────────────────────
// All OW x-coords shifted +162 from original 800-wide calibration to match the
// full 1124-wide world (the image was cover-cropping 162px from each side before).
const OW_BLOCKED: Rect[] = [
  // ── OUTER BORDERS ──────────────────────────────────────────────────────────
  [0,    0,   155,  900],  // left forest edge (newly visible original left side)
  [155,  0,   214,   85],  // top strip left of Route-1 path
  [327,  0,  1124,   85],  // north border (right of Route-1 gap)
  [962,  85, 1124,  900],  // right forest border
  [0,   865, 1124,  900],  // southern boundary

  // ── PROFESSOR LAB ──────────────────────────────────────────────────────────
  [367,  85,  732,  310],

  // ── RIVAL'S HOME (Jay) — body only, stop well above door strip ─────────────
  [214, 250,  327,  400],

  // ── MAYA'S HOME — body only, stop well above door strip ────────────────────
  [807, 250,  928,  400],

  // ── PLAYER HOME (center bottom) ────────────────────────────────────────────
  [367, 505,  757,  815],

  // ── ELIO'S HOME (bottom left) ──────────────────────────────────────────────
  [214, 565,  327,  780],

  // ── LIA'S HOME (bottom right) ──────────────────────────────────────────────
  [807, 565,  942,  780],
];

// Route-1 exit trigger aligned with the top-left gap
const OW_ROUTE1_EXIT: Rect = [212, 0, 327, 15];
const OW_PROF_DOOR: Rect = [457, 340, 667, 400]; // step into lab

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
const MAYA_POS = { x: 838, y: 446 }; // Maya standing just south of her door
const OW_MAYA_DOOR: Rect  = [847, 392, 937, 408]; // must walk UP to enter — y≤408 only reachable by pressing UP
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
const OW_JAY_DOOR: Rect  = [185, 365, 330, 422]; // wider + taller zone so entrance is easy to hit
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

// ── Player's Home ────────────────────────────────────────────────────────────
const PH = { w: 800, h: 800 };
const JESS_POS = { x: 395, y: 370 }; // Jess standing in the open center of the home
const OW_PLAYER_HOME_DOOR: Rect = [460, 484, 650, 522]; // wider + taller — walk SOUTH to enter
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

const FRAMES: Record<string, string[]> = {
  idle:      ["/__mockup/images/stand_front_3d.png"],
  walk_side: ["/__mockup/images/walk_side_1.png"],
  walk_up:   ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down: ["/__mockup/images/walk_idle.png", "/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

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

// ── Main component ──────────────────────────────────────────────────────────
export function WalkDemo() {
  const [scene,       setScene]       = useState<Scene>("overworld");
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
  const [starter,          setStarter]          = useState<typeof STARTERS[number] | null>(null);
  const [showJournal,      setShowJournal]      = useState(false);
  const [journalTab,       setJournalTab]       = useState<"party"|"shells"|"bag">("party");
  const [interactPos,      setInteractPos]      = useState({ sx: 0, sy: 0 });
  const [mayaInteractPos,  setMayaInteractPos]  = useState({ sx: 0, sy: 0 });
  const [jayInteractPos,   setJayInteractPos]   = useState({ sx: 0, sy: 0 });
  const [shellInteractPos, setShellInteractPos] = useState({ sx: 0, sy: 0 });
  const [nearJess,            setNearJess]            = useState(false);
  const [jessInteractPos,     setJessInteractPos]     = useState({ sx: 0, sy: 0 });
  const [hasHealingRune,      setHasHealingRune]      = useState(false);
  const [healingRuneEquipped, setHealingRuneEquipped] = useState(false);
  const [runeNotif,           setRuneNotif]           = useState(false);

  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const profCanvasRef      = useRef<HTMLCanvasElement>(null);
  const portraitCanvasRef  = useRef<HTMLCanvasElement>(null);
  const mayaCanvasRef      = useRef<HTMLCanvasElement>(null);
  const mayaPortraitRef    = useRef<HTMLCanvasElement>(null);
  const jayCanvasRef       = useRef<HTMLCanvasElement>(null);
  const jayPortraitRef     = useRef<HTMLCanvasElement>(null);
  const jessCanvasRef      = useRef<HTMLCanvasElement>(null);
  const jessPortraitRef    = useRef<HTMLCanvasElement>(null);
  const shadowRef  = useRef<HTMLDivElement>(null);
  const worldRef   = useRef<HTMLDivElement>(null);
  const vpRef      = useRef<HTMLDivElement>(null);

  const sceneRef   = useRef<Scene>("overworld");
  const phaseRef   = useRef<Phase>("walk");
  const fadingRef  = useRef(false);
  const heldRef    = useRef<string | null>(null);
  const animRef    = useRef("idle");
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  const lastSrc    = useRef("");
  const lastFlip   = useRef(false);
  const worldPos   = useRef({ x: 562, y: 430 }); // overworld start (centred in new 1124-wide world)
  const cam        = useRef({ x: 0, y: 0 });

  // Preload everything
  useEffect(() => {
    [
      ...Object.values(FRAMES).flat(),
      "/__mockup/images/overworld-map.png",
      "/__mockup/images/prof-lab-interior.png",
      "/__mockup/images/prof-irwyn-sprite.png",
      "/__mockup/images/maya-home-interior.png",
      "/__mockup/images/maya-sprite.png",
      "/__mockup/images/jay-home-interior.png",
      "/__mockup/images/jay-sprite.png",
      "/__mockup/images/player-home-interior.png",
      "/__mockup/images/jess-sprite.png",
      "/__mockup/images/weathered-shell.png",
      ...STARTERS.map(s => s.img),
    ].forEach(loadImg);
  }, []);

  useEffect(() => { heldRef.current = held; },      [held]);
  useEffect(() => { phaseRef.current = phase; },    [phase]);
  useEffect(() => { sceneRef.current = scene; },    [scene]);

  // Draw Prof Irwyn world sprite via canvas (proper transparency, no blend-mode)
  useEffect(() => {
    if (scene !== "lab") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = profCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
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

  // Draw Jess world sprite inside player home
  useEffect(() => {
    if (scene !== "home") return;
    const src = "/__mockup/images/jess-sprite.png";
    const tryDraw = () => {
      const c = jessCanvasRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false, 68)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [scene]);

  // Draw Jess portrait in dialog box
  useEffect(() => {
    if (!phase.startsWith("jess_")) return;
    const src = "/__mockup/images/jess-sprite.png";
    const tryDraw = () => {
      const c = jessPortraitRef.current;
      if (!c) return;
      if (!drawSprite(c, src, false)) setTimeout(tryDraw, 150);
    };
    tryDraw();
  }, [phase]);

  // Redraw player canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = FRAMES[animRef.current] || FRAMES.idle;
    const src    = frames[frameRef.current] || frames[0];
    if (src === lastSrc.current && flipRef.current === lastFlip.current) return;
    const ok = drawSprite(canvas, src, flipRef.current);
    if (ok) { lastSrc.current = src; lastFlip.current = flipRef.current; }
  }, []);

  // Frame ticker
  useEffect(() => {
    const id = setInterval(() => {
      const frames = FRAMES[animRef.current] || FRAMES.idle;
      frameRef.current = (frameRef.current + 1) % frames.length;
      redraw();
    }, 145);
    return () => clearInterval(id);
  }, [redraw]);

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
      sceneRef.current = next;
      setScene(next);
      setTimeout(() => { fadingRef.current = false; setFading(false); }, 350);
    }, 350);
  }, []);

  // Main game loop
  useEffect(() => {
    let raf: number;
    const loop = () => {
      if (!fadingRef.current && phaseRef.current === "walk") {
        const h       = heldRef.current;
        const sc      = sceneRef.current;
        const world   = sc === "overworld" ? OW : sc === "lab" ? LB : sc === "maya" ? MY : sc === "jay" ? JY : PH;
        const zones   = sc === "overworld" ? OW_BLOCKED : sc === "lab" ? LAB_BLOCKED : sc === "maya" ? MAYA_BLOCKED : sc === "jay" ? JAY_BLOCKED : PH_BLOCKED;

        let newAnim = "idle";
        let newFlip = flipRef.current;
        let dx = 0, dy = 0;
        if (h === "right") { dx =  SPEED; newAnim = "walk_side"; newFlip = false; }
        if (h === "left")  { dx = -SPEED; newAnim = "walk_side"; newFlip = true;  }
        if (h === "up")    { dy = -SPEED; newAnim = "walk_up";   newFlip = false; }
        if (h === "down")  { dy =  SPEED; newAnim = "walk_down"; newFlip = false; }

        const { x, y } = worldPos.current;
        const nx = Math.max(30, Math.min(x + dx, world.w - 30));
        // Allow y=0 so the northern path exit is reachable
        const ny = Math.max(0,  Math.min(y + dy, world.h - 30));
        if (!blocked(nx, y,  zones)) worldPos.current.x = nx;
        if (!blocked(x,  ny, zones)) worldPos.current.y = ny;

        // Door triggers
        if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_PROF_DOOR as Rect)) {
          transitionTo("lab", 350, 590);
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_MAYA_DOOR)) {
          transitionTo("maya", 400, 660);
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_JAY_DOOR)) {
          transitionTo("jay", 400, 660);
        } else if (sc === "lab" && inRect(worldPos.current.x, worldPos.current.y, LAB_EXIT)) {
          transitionTo("overworld", 562, 445);  // lab exit → centred in new OW
        } else if (sc === "maya" && inRect(worldPos.current.x, worldPos.current.y, MAYA_HOME_EXIT)) {
          transitionTo("overworld", 867, 460);  // just south of Maya's door (y=460 > 408 safe)
        } else if (sc === "jay" && inRect(worldPos.current.x, worldPos.current.y, JAY_HOME_EXIT)) {
          transitionTo("overworld", 272, 460);  // just south of Jay's door
        } else if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_PLAYER_HOME_DOOR)) {
          transitionTo("home", 405, 660);       // enter player's home
        } else if (sc === "home" && inRect(worldPos.current.x, worldPos.current.y, PLAYER_HOME_EXIT)) {
          transitionTo("overworld", 562, 470);  // exit north of home collision (safe walkable path)
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
        const topOff = Math.round(SPRITE_PX * ANCHOR);
        if (wd)     wd.style.transform = `scale(${ZOOM}) translate(${-cam.current.x}px,${-cam.current.y}px)`;
        if (canvas) { canvas.style.left = `${px - SPRITE_PX/2}px`; canvas.style.top = `${py - topOff}px`; }
        if (shadow) { shadow.style.left = `${px - 18}px`;          shadow.style.top  = `${py + 2}px`; }

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
      jay_d1: "jay_d2", jay_d2: "jay_d3", jay_d3: "walk",
      jess_d1: "jess_d2", jess_d2: "jess_d3", jess_d3: "walk",
    };
    const next = map[from];
    if (next) setPhase(next);
  }, []);

  const pickStarter = useCallback(() => {
    if (!selected) return;
    const s = STARTERS.find(t => t.id === selected)!;
    setStarter(s);
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
    d1: "Ah — there you are! Welcome to Primeria Lab. I am Professor Irwyn. I have spent my life studying Tayanari — the remarkable bond-creatures that share this world with us.",
    d2: "Every Keeper begins with a single companion. The bond deepens through trust, exploration, and challenge. Today, that journey starts for you. Choose your first Tayanari.",
    pick: "",
    d3: starter ? `${starter.name}! A wonderful choice. I can already sense a connection forming. Treat them well — they will never let you down.` : "",
    d4: "Head north past the village gate through Route 1 to the Wild Area. Wild Tayanari roam freely there. It is the best place for a new Keeper to earn their first bonds.",
    d5: "But be careful — wild Tayanari are spirited and won't hesitate to test you. Keep your partner healthy and your wits sharp. I'll meet you in the Wild Area. Safe travels, Keeper.",
    maya_d1: "Oh! You must be the new Keeper everyone's talking about. I'm Maya. I barely leave the village myself — the wild Tayanari out there terrify me. You must be so incredibly brave to set out like this.",
    maya_d2: "My father... he was a legendary Keeper. He spent his whole life exploring, bonding with Tayanari no one else could ever reach. He passed last winter. I still miss him every single day.",
    maya_d3: "Before he left us, he entrusted me with his collection of Weathered Realm Shells — rare items that Keepers use in the wild. He told me: 'Give these to someone worthy, Maya. You'll know them when you see them.'",
    maya_d4: "I've been holding onto them, wondering who that person could be. But looking at you... I think he would be so proud. Please — go inside and take them. Make us both proud out there.",
    jay_d1: "After everything we've been through — the fences we climbed, mornings we slipped out before sunrise just to see what was past those trees... you really doing this? For real, today?",
    jay_d2: "I've been training harder than you know. Every morning before you were even awake. I'm not stepping out of this village to finish second. That's not who I am and you know it.",
    jay_d3: "But I'm glad it's you out there with me. Nobody else I'd want watching my back. Stay sharp. And don't even think about falling behind — I won't be slowing down. Not for anyone.",
    jess_d1: "You're really going, aren't you. I've known this day was coming ever since I caught you sneaking off before sunrise to watch the wild Tayanari out in the meadow. You were nine years old. You've been ready since then.",
    jess_d2: "I'm not going to beg you to stay. That's not what love is. Love is packing your favourite bread in the outer pocket of your pack so you find it when you need it most. I did that last night while you were sleeping.",
    jess_d3: "Come home with stories worth telling. And come home. That's all I ask. I love you. Now go — before I change my mind and chain you to that kitchen table.",
  };

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#060606", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── MAP VIEWPORT ─────────────────────────────────────────────────── */}
      <div ref={vpRef} style={{ flex:1, position:"relative", overflow:"hidden" }}>

        {/* World container — camera-scrolled + zoomed */}
        <div ref={worldRef} style={{
          position: "absolute",
          width:  scene === "overworld" ? OW.w : scene === "lab" ? LB.w : scene === "maya" ? MY.w : scene === "jay" ? JY.w : PH.w,
          height: scene === "overworld" ? OW.h : scene === "lab" ? LB.h : scene === "maya" ? MY.h : scene === "jay" ? JY.h : PH.h,
          willChange: "transform",
          transformOrigin: "0 0",
          transform: `scale(${ZOOM}) translate(${-cam.current.x}px,${-cam.current.y}px)`,
        }}>
          {/* Map background */}
          <img
            key={scene}
            src={scene === "overworld"
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
                width: 80, height: 80,
                imageRendering: "auto",
                pointerEvents: "none",
                left: PROF.x - 40,
                top:  PROF.y - 80,
              }}
            />
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
              {/* Maya's home door glow */}
              <div style={{
                position:"absolute", left:860, top:426,
                width:36, height:10, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(120,220,140,0.5)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Jay's home door glow */}
              <div style={{
                position:"absolute", left:250, top:426,
                width:44, height:10, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(100,160,255,0.5)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
              {/* Player home door glow — south face at y≈498 */}
              <div style={{
                position:"absolute", left:544, top:498,
                width:44, height:10, borderRadius:"50%",
                background:"radial-gradient(ellipse,rgba(255,160,90,0.55)0%,transparent 80%)",
                animation:"pulse 1.4s ease-in-out infinite",
                pointerEvents:"none",
              }}/>
            </>
          )}

          {/* Jess NPC sprite inside player home */}
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
              }}>JESS</div>
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

          {/* Ground shadow */}
          <div ref={shadowRef} style={{
            position:"absolute",
            width:36, height:12, borderRadius:"50%",
            background:"radial-gradient(ellipse,rgba(0,0,0,0.6)0%,transparent 75%)",
            pointerEvents:"none",
            left: px - 18, top: py + 2,
          }}/>

          {/* Player sprite */}
          <canvas ref={canvasRef} style={{
            position:"absolute",
            width:SPRITE_PX, height:SPRITE_PX,
            imageRendering:"auto", pointerEvents:"none",
            left: px - SPRITE_PX/2, top: py - topOff,
          }}/>
        </div>

        {/* ── INTERACT BUTTON — Prof ────────────────────────────────────── */}
        {scene === "lab" && nearProf && phase === "walk" && (
          <button
            onClick={() => setPhase("d1")}
            style={{
              position:"absolute",
              left: interactPos.sx - 18,
              top:  interactPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#f0d050", border:"2px solid #fff",
              color:"#1a1200", fontSize:20, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Jay ─────────────────────────────────────── */}
        {scene === "jay" && nearJay && phase === "walk" && (
          <button
            onClick={() => setPhase("jay_d1")}
            style={{
              position:"absolute",
              left: jayInteractPos.sx - 18,
              top:  jayInteractPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#6090e0", border:"2px solid #fff",
              color:"#0a1030", fontSize:20, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Maya ────────────────────────────────────── */}
        {scene === "overworld" && nearMaya && phase === "walk" && (
          <button
            onClick={() => setPhase("maya_d1")}
            style={{
              position:"absolute",
              left: mayaInteractPos.sx - 18,
              top:  mayaInteractPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#80d0a0", border:"2px solid #fff",
              color:"#0a2018", fontSize:20, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
        )}

        {/* ── INTERACT BUTTON — Jess ────────────────────────────────────── */}
        {scene === "home" && nearJess && phase === "walk" && (
          <button
            onClick={() => setPhase("jess_d1")}
            style={{
              position:"absolute",
              left: jessInteractPos.sx - 18,
              top:  jessInteractPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#f0a050", border:"2px solid #fff",
              color:"#3a1200", fontSize:20, fontWeight:900,
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
              setPickupNotif(true);
              setTimeout(() => setPickupNotif(false), 2800);
            }}
            style={{
              position:"absolute",
              left: shellInteractPos.sx - 18,
              top:  shellInteractPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#50dcc0", border:"2px solid #fff",
              color:"#0a2018", fontSize:20, fontWeight:900,
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
        {(phase === "jay_d1" || phase === "jay_d2" || phase === "jay_d3") && (
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
                  if (phase === "jay_d3") {
                    setPhase("walk");
                    setHasHealingRune(true);
                    setRuneNotif(true);
                    setTimeout(() => setRuneNotif(false), 3200);
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
              >{phase === "jay_d3" ? "OK" : "Next ▶"}</button>
            </div>
          </div>
        )}

        {/* ── MAYA DIALOG BOX ──────────────────────────────────────────── */}
        {(phase === "maya_d1" || phase === "maya_d2" || phase === "maya_d3" || phase === "maya_d4") && (
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
                onClick={() => advanceDialog(phase)}
                style={{
                  background:"rgba(80,180,120,0.15)",
                  border:"1px solid rgba(80,180,120,0.5)",
                  color:"#80d0a0", padding:"6px 20px",
                  borderRadius:8, fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >{phase === "maya_d4" ? "OK" : "Next ▶"}</button>
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
                JESS
              </span>
            </div>
            <p style={{ color:"#e8dcc8", fontSize:13, lineHeight:1.55, margin:"0 0 10px" }}>
              {LINES[phase]}
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button
                onClick={() => advanceDialog(phase)}
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
                  {(["party","shells","bag"] as const).map(tab => (
                    <button key={tab} onClick={() => setJournalTab(tab)} style={{
                      padding:"5px 12px 8px",
                      background: journalTab === tab
                        ? "linear-gradient(175deg,#f5e9cc,#ecdcb4)"
                        : "rgba(0,0,0,0.30)",
                      border:"none",
                      borderRadius:"7px 7px 0 0",
                      color: journalTab === tab ? "#3d1e04" : "#a08050",
                      fontSize:10, fontWeight:800, letterSpacing:1.5,
                      textTransform:"uppercase", cursor:"pointer",
                    }}>{tab === "party" ? "Party" : tab === "shells" ? "Shells" : "Bag"}</button>
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
                  }}>{journalTab === "party" ? "Companions" : "Carried Items"}</span>
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
                            Level&nbsp;1&emsp;·&emsp;HP 40 / 40
                          </div>
                          <div style={{ color:"#6a50a0", fontSize:9, fontWeight:800, marginTop:4, letterSpacing:0.5 }}>
                            ◈ Obsidian Realm Shell{healingRuneEquipped ? "  ·  ✦ Healing Rune" : ""}
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

                    {[2,3,4,5,6].map(n => (
                      <div key={n} style={{
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
                          Slot {n} — empty
                        </div>
                      </div>
                    ))}
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
                          <div style={{
                            width:44, height:44, borderRadius:"50%", flexShrink:0,
                            background:"radial-gradient(circle at 38% 33%,#38344a,#0c0a12)",
                            border:"1.5px solid rgba(140,120,200,0.45)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:20, color:"rgba(190,170,230,0.85)",
                            boxShadow:"0 0 12px rgba(80,60,140,0.3)",
                          }}>◈</div>
                          <div>
                            <div style={{ color:"#2a1206", fontWeight:800, fontSize:13 }}>Obsidian Realm Shell</div>
                            <div style={{ color:"#7060a0", fontSize:10, marginTop:2 }}>Bonded · {starter.name} within</div>
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
                            <div style={{ color:"#826040", fontSize:10, marginTop:2 }}>Lv 1 · HP 40 / 40</div>
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
                  </div>
                )}

                {/* ── BAG PAGE ────────────────────────────────────── */}
                {journalTab === "bag" && (
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {shellsCollected ? (
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
                          <div style={{ color:"#826040", fontSize:11, marginTop:5, lineHeight:1.5 }}>
                            A shell worn smooth by realms unknown. Said to draw wandering Tayanari close.
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
                    ) : (
                      <div style={{
                        textAlign:"center", padding:"26px 0",
                        color:"#b09468", fontSize:12, fontStyle:"italic",
                      }}>— Your bag is empty. —</div>
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
          {scene === "overworld" ? "Primeria Village" : scene === "lab" ? "Prof. Irwyn's Lab" : scene === "maya" ? "Maya's Home" : scene === "jay" ? "Jay's Home" : "Your Home"}
        </div>

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
            onClick={() => setShowJournal(true)}
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
          >📖</button>
        </div>
      </div>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
