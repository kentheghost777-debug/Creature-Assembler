import { useEffect, useRef, useState, useCallback } from "react";

// ── World sizes (pixels) ────────────────────────────────────────────────────
const OW = { w: 800, h: 900 }; // overworld
const LB = { w: 700, h: 700 }; // lab
const SPEED     = 3.5;
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
type Phase = "walk" | "d1" | "d2" | "pick" | "d3" | "d4" | "d5";
type Scene = "overworld" | "lab";
type Rect  = [number, number, number, number]; // x1 y1 x2 y2 world-px

// ── Collision zones ─────────────────────────────────────────────────────────
// Only block solid structures. Leave wide paths (~90 px) on both sides.
const OW_BLOCKED: Rect[] = [
  // Hard map edges
  [0,   0,   800, 58 ],  // top tree strip
  [0,   852, 800, 900],  // bottom strip
  [0,   0,   58,  900],  // left tree column
  [742, 0,   800, 900],  // right tree column
  // Prof Lab — dome body only (not fences/garden)
  [210, 58,  590, 295],
  // Small fence posts either side of lab gate (leave 200–590 as walkable approach)
  [150, 295, 212, 370],  // left post
  [588, 295, 650, 370],  // right post
  // Player Home — dome body only
  [210, 482, 590, 692],
  // Small fence posts either side of home gate
  [150, 692, 212, 778],  // left post
  [588, 692, 650, 778],  // right post
];
const OW_PROF_DOOR: Rect = [295, 340, 505, 400]; // step into lab

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

function drawSprite(canvas: HTMLCanvasElement, src: string, flipX: boolean): boolean {
  const img = imgCache[src];
  if (!img?.complete || !img.naturalWidth) return false;
  const W = img.naturalWidth, H = img.naturalHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);
  if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0);
  if (flipX) ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    const id = ctx.getImageData(0, 0, W, H);
    const d  = id.data;
    // BFS flood-fill from every edge — only pixels that are EXACTLY pure black
    // (0,0,0) get erased. Character dark areas are ≥ 1 on at least one channel
    // so they are never removed, no matter how dark the armor or shadows.
    // Threshold 4: catches pure black + anti-alias fringe (values 0-3).
    // Any character pixel with at least one channel ≥ 4 is preserved.
    const isPureBlack = (p: number) => d[p] < 4 && d[p+1] < 4 && d[p+2] < 4;
    const vis = new Uint8Array(W * H);
    const q: number[] = [];
    const seed = (idx: number) => {
      if (!vis[idx] && isPureBlack(idx * 4)) { vis[idx] = 1; q.push(idx); }
    };
    for (let x = 0; x < W; x++) { seed(x); seed((H-1)*W + x); }
    for (let y = 1; y < H-1; y++) { seed(y*W); seed(y*W + W-1); }
    while (q.length) {
      const i = q.pop()!;
      d[i*4+3] = 0;
      const x = i%W, y = (i/W)|0;
      if (x > 0)   seed(i-1);
      if (x < W-1) seed(i+1);
      if (y > 0)   seed(i-W);
      if (y < H-1) seed(i+W);
    }
    ctx.putImageData(id, 0, 0);
  } catch { /* no CORS issue on same-origin but guard anyway */ }
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
const PROF = { x: 350, y: 242 }; // feet position in lab world

// ── Main component ──────────────────────────────────────────────────────────
export function WalkDemo() {
  const [scene,       setScene]       = useState<Scene>("overworld");
  const [phase,       setPhase]       = useState<Phase>("walk");
  const [fading,      setFading]      = useState(false);
  const [held,        setHeld]        = useState<string | null>(null);
  const [nearProf,    setNearProf]    = useState(false);
  const [selected,    setSelected]    = useState<StarterId | null>(null);
  const [starter,     setStarter]     = useState<typeof STARTERS[number] | null>(null);
  const [showParty,   setShowParty]   = useState(false);
  const [interactPos, setInteractPos] = useState({ sx: 0, sy: 0 });

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const profCanvasRef    = useRef<HTMLCanvasElement>(null);
  const portraitCanvasRef = useRef<HTMLCanvasElement>(null);
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
  const worldPos   = useRef({ x: 400, y: 430 }); // overworld start
  const cam        = useRef({ x: 0, y: 0 });

  // Preload everything
  useEffect(() => {
    [
      ...Object.values(FRAMES).flat(),
      "/__mockup/images/overworld-map.png",
      "/__mockup/images/prof-lab-interior.png",
      "/__mockup/images/prof-irwyn-sprite.png",
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

  // Draw Prof portrait in dialog box
  useEffect(() => {
    if (phase === "walk" || phase === "pick") return;
    const src = "/__mockup/images/prof-irwyn-sprite.png";
    const tryDraw = () => {
      const c = portraitCanvasRef.current;
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
        const world   = sc === "overworld" ? OW : LB;
        const zones   = sc === "overworld" ? OW_BLOCKED : LAB_BLOCKED;

        let newAnim = "idle";
        let newFlip = flipRef.current;
        let dx = 0, dy = 0;
        if (h === "right") { dx =  SPEED; newAnim = "walk_side"; newFlip = false; }
        if (h === "left")  { dx = -SPEED; newAnim = "walk_side"; newFlip = true;  }
        if (h === "up")    { dy = -SPEED; newAnim = "walk_up";   newFlip = false; }
        if (h === "down")  { dy =  SPEED; newAnim = "walk_down"; newFlip = false; }

        const { x, y } = worldPos.current;
        const nx = Math.max(30, Math.min(x + dx, world.w - 30));
        const ny = Math.max(30, Math.min(y + dy, world.h - 30));
        if (!blocked(nx, y,  zones)) worldPos.current.x = nx;
        if (!blocked(x,  ny, zones)) worldPos.current.y = ny;

        // Door triggers
        if (sc === "overworld" && inRect(worldPos.current.x, worldPos.current.y, OW_PROF_DOOR as Rect)) {
          transitionTo("lab", 350, 590);
        } else if (sc === "lab" && inRect(worldPos.current.x, worldPos.current.y, LAB_EXIT)) {
          transitionTo("overworld", 400, 445);
        }

        // Flip / anim change
        if (newFlip !== flipRef.current) { flipRef.current = newFlip; lastSrc.current = ""; redraw(); }
        if (newAnim !== animRef.current) {
          animRef.current = newAnim; frameRef.current = 0; lastSrc.current = ""; redraw();
        }

        // Camera
        const vp  = vpRef.current;
        const vpW = vp?.clientWidth  ?? 390;
        const vpH = vp?.clientHeight ?? 520;
        const px  = worldPos.current.x;
        const py  = worldPos.current.y;
        cam.current.x = Math.max(0, Math.min(px - vpW / 2, world.w - vpW));
        cam.current.y = Math.max(0, Math.min(py - vpH / 2, world.h - vpH));

        // Update DOM
        const wd     = worldRef.current;
        const canvas = canvasRef.current;
        const shadow = shadowRef.current;
        const topOff = Math.round(SPRITE_PX * ANCHOR);
        if (wd)     wd.style.transform = `translate(${-cam.current.x}px,${-cam.current.y}px)`;
        if (canvas) { canvas.style.left = `${px - SPRITE_PX/2}px`; canvas.style.top = `${py - topOff}px`; }
        if (shadow) { shadow.style.left = `${px - 18}px`;          shadow.style.top  = `${py + 2}px`; }

        // Near-prof check (lab only) — update React state at low freq via ref flag
        if (sc === "lab") {
          const d = dist(px, py, PROF.x, PROF.y);
          const near = d < 120;
          const screenX = px - cam.current.x;
          const screenY = py - cam.current.y - topOff - 28;
          setNearProf(near);
          if (near) setInteractPos({ sx: screenX, sy: screenY });
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
  };

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#060606", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── MAP VIEWPORT ─────────────────────────────────────────────────── */}
      <div ref={vpRef} style={{ flex:1, position:"relative", overflow:"hidden" }}>

        {/* World container — camera-scrolled */}
        <div ref={worldRef} style={{
          position: "absolute",
          width:  scene === "overworld" ? OW.w : LB.w,
          height: scene === "overworld" ? OW.h : LB.h,
          willChange: "transform",
          transform: `translate(${-cam.current.x}px,${-cam.current.y}px)`,
        }}>
          {/* Map background */}
          <img
            key={scene}
            src={scene === "overworld"
              ? "/__mockup/images/overworld-map.png"
              : "/__mockup/images/prof-lab-interior.png"}
            alt="map"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
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
              position:"absolute", left:354, top:348,
              width:44, height:10, borderRadius:"50%",
              background:"radial-gradient(ellipse,rgba(255,210,60,0.6)0%,transparent 80%)",
              animation:"pulse 1.4s ease-in-out infinite",
              pointerEvents:"none",
            }}/>
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

        {/* ── INTERACT BUTTON (viewport-relative, above player) ─────────── */}
        {scene === "lab" && nearProf && phase === "walk" && (
          <button
            onClick={() => setPhase("d1")}
            style={{
              position:"absolute",
              left: interactPos.sx - 18,
              top:  interactPos.sy - 10,
              width:36, height:36, borderRadius:"50%",
              background:"#f0d050",
              border:"2px solid #fff",
              color:"#1a1200", fontSize:20, fontWeight:900,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", animation:"bounce 0.7s ease-in-out infinite",
              zIndex:10,
            }}
          >!</button>
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

        {/* ── PARTY OVERLAY ────────────────────────────────────────────── */}
        {showParty && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(5,3,1,0.95)",
            display:"flex", flexDirection:"column",
            zIndex:40,
          }}>
            <div style={{
              padding:"14px 16px 10px",
              borderBottom:"1px solid rgba(240,208,80,0.25)",
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div style={{ color:"#f0d060", fontWeight:800, fontSize:14, letterSpacing:1.5 }}>PARTY</div>
              <button onClick={() => setShowParty(false)} style={{
                background:"none", border:"1px solid rgba(255,255,255,0.2)",
                color:"#888", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:13,
              }}>✕</button>
            </div>
            <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
              {/* Slot 1 — starter */}
              {starter ? (
                <div style={{
                  background:"rgba(20,14,6,0.9)",
                  border:`2px solid ${starter.color}`,
                  borderRadius:14, padding:"12px 14px",
                  display:"flex", alignItems:"center", gap:14,
                }}>
                  <img src={starter.img} alt={starter.name}
                    style={{ width:64, height:64, objectFit:"contain",
                      background:"#0a0604", borderRadius:8, mixBlendMode:"screen" }}
                  />
                  <div>
                    <div style={{ color:"#e8dcc8", fontWeight:700, fontSize:15 }}>{starter.name}</div>
                    <div style={{
                      fontSize:11, fontWeight:700, letterSpacing:1,
                      color: starter.color, marginTop:4,
                      background:`rgba(${starter.color.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(",")},0.12)`,
                      display:"inline-block", padding:"2px 10px", borderRadius:20,
                    }}>{starter.type.toUpperCase()}</div>
                    <div style={{ color:"#706050", fontSize:11, marginTop:4 }}>Lv 1 · HP 40/40</div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background:"rgba(12,8,3,0.7)",
                  border:"2px dashed rgba(255,255,255,0.1)",
                  borderRadius:14, padding:"22px 14px",
                  color:"#403020", fontSize:13, textAlign:"center",
                }}>— Empty slot —</div>
              )}
              {/* Slot 2 — always empty */}
              <div style={{
                background:"rgba(12,8,3,0.7)",
                border:"2px dashed rgba(255,255,255,0.1)",
                borderRadius:14, padding:"22px 14px",
                color:"#403020", fontSize:13, textAlign:"center",
              }}>— Empty slot —</div>
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
          {scene === "overworld" ? "Primeria Village" : "Prof. Irwyn's Lab"}
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
        gap:4, padding:"10px 0 18px",
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
          {starter && (
            <button
              onClick={() => setShowParty(true)}
              style={{
                width:52, height:52, borderRadius:12,
                background:"rgba(200,160,30,0.2)",
                border:"1.5px solid rgba(240,208,50,0.5)",
                color:"#f0d060", fontSize:9, fontWeight:800,
                letterSpacing:0.5, cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:1, backdropFilter:"blur(6px)",
              }}
            >
              <span style={{ fontSize:18 }}>🐾</span>
              <span>PARTY</span>
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
