import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Scene = "overworld" | "lab";
type Rect  = { x1: number; y1: number; x2: number; y2: number };

// ── Animation frames ──────────────────────────────────────────────────────
const FRAMES: Record<string, string[]> = {
  idle:      ["/__mockup/images/stand_front_3d.png"],
  walk_side: ["/__mockup/images/walk_side_1.png"],
  walk_up:   ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down: ["/__mockup/images/walk_idle.png", "/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

const SPRITE_PX = 76;
const SPEED     = 0.4;
// Fraction of sprite height above anchor point (y%). 0.75 → top 75% is body.
const ANCHOR    = 0.75;

// ── Collision / trigger zones (percentage coords) ─────────────────────────
// Overworld: things Kinju CANNOT walk through
const OW_BLOCKED: Rect[] = [
  // Hard map edges
  { x1: 0,   y1: 0,   x2: 100, y2: 7   }, // top strip
  { x1: 0,   y1: 93,  x2: 100, y2: 100 }, // bottom strip
  { x1: 0,   y1: 0,   x2: 6,   y2: 100 }, // left strip
  { x1: 94,  y1: 0,   x2: 100, y2: 100 }, // right strip
  // Professor Lab building + fence sides (leave 38–62 gap for the door path)
  { x1: 14,  y1: 7,   x2: 86,  y2: 37  }, // lab body
  { x1: 14,  y1: 37,  x2: 37,  y2: 44  }, // lab left fence wing
  { x1: 63,  y1: 37,  x2: 86,  y2: 44  }, // lab right fence wing
  // Player Home building + fence sides (door is visible but blocked)
  { x1: 18,  y1: 52,  x2: 82,  y2: 83  }, // home body
  { x1: 18,  y1: 83,  x2: 37,  y2: 90  }, // home left fence wing
  { x1: 63,  y1: 83,  x2: 82,  y2: 90  }, // home right fence wing
  // Signpost / bench patch top-right
  { x1: 66,  y1: 37,  x2: 82,  y2: 53  },
];

// Overworld: step into this → enter the lab
const OW_LAB_DOOR: Rect = { x1: 38, y1: 40, x2: 62, y2: 47 };

// Lab interior: things Kinju CANNOT walk through
const LAB_BLOCKED: Rect[] = [
  // Outer walls
  { x1: 0,   y1: 0,   x2: 100, y2: 5  },
  { x1: 0,   y1: 0,   x2: 3,   y2: 100 },
  { x1: 97,  y1: 0,   x2: 100, y2: 100 },
  { x1: 0,   y1: 92,  x2: 38,  y2: 100 }, // bottom-left wall
  { x1: 62,  y1: 92,  x2: 100, y2: 100 }, // bottom-right wall
  // Top desk + board area
  { x1: 0,   y1: 0,   x2: 100, y2: 32  },
  // Left cylinder bank
  { x1: 0,   y1: 0,   x2: 20,  y2: 100 },
  // Right cylinder bank
  { x1: 80,  y1: 0,   x2: 100, y2: 100 },
];

// Lab: step into this → return to overworld
const LAB_EXIT: Rect = { x1: 38, y1: 88, x2: 62, y2: 96 };

// ── Image cache ───────────────────────────────────────────────────────────
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

// Draw sprite to canvas, making near-black pixels transparent
function drawSprite(canvas: HTMLCanvasElement, src: string, flipX: boolean): boolean {
  const img = imgCache[src];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const W = img.naturalWidth, H = img.naturalHeight;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);
  if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0);
  if (flipX) ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    const data = ctx.getImageData(0, 0, W, H);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 32 && d[i + 1] < 32 && d[i + 2] < 32) d[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
  } catch { /* leave with black bg if CORS blocks */ }
  return true;
}

function inRect(px: number, py: number, r: Rect) {
  return px >= r.x1 && px <= r.x2 && py >= r.y1 && py <= r.y2;
}
function isBlocked(px: number, py: number, zones: Rect[]) {
  return zones.some(r => inRect(px, py, r));
}

// ── Component ─────────────────────────────────────────────────────────────
export function WalkDemo() {
  const [scene,  setScene]  = useState<Scene>("overworld");
  const [fading, setFading] = useState(false);
  const [held,   setHeld]   = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null); // player sprite
  const shadowRef = useRef<HTMLDivElement>(null);

  const sceneRef   = useRef<Scene>("overworld");
  const fadingRef  = useRef(false);
  const heldRef    = useRef<string | null>(null);
  const animRef    = useRef("idle");
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  const lastSrc    = useRef("");
  const lastFlip   = useRef(false);
  const pct        = useRef({ x: 50, y: 52 }); // overworld start position

  // Preload all assets
  useEffect(() => {
    [
      ...Object.values(FRAMES).flat(),
      "/__mockup/images/overworld-map.png",
      "/__mockup/images/prof-lab-interior.png",
      "/__mockup/images/prof-irwyn-sprite.png",
    ].forEach(loadImg);
  }, []);

  useEffect(() => { heldRef.current = held; }, [held]);

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

  // Scene transition helper
  const transitionTo = useCallback((next: Scene, startX: number, startY: number) => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setFading(true);
    setTimeout(() => {
      pct.current      = { x: startX, y: startY };
      sceneRef.current = next;
      animRef.current  = "idle";
      frameRef.current = 0;
      lastSrc.current  = "";
      setScene(next);
      setTimeout(() => {
        fadingRef.current = false;
        setFading(false);
      }, 350);
    }, 350);
  }, []);

  // Main game loop
  useEffect(() => {
    let raf: number;
    const loop = () => {
      if (!fadingRef.current) {
        const h          = heldRef.current;
        const curScene   = sceneRef.current;
        const blocked    = curScene === "overworld" ? OW_BLOCKED : LAB_BLOCKED;

        let newAnim = "idle";
        let newFlip = flipRef.current;
        let dx = 0, dy = 0;
        if (h === "right") { dx =  SPEED; newAnim = "walk_side"; newFlip = false; }
        if (h === "left")  { dx = -SPEED; newAnim = "walk_side"; newFlip = true;  }
        if (h === "up")    { dy = -SPEED; newAnim = "walk_up";   newFlip = false; }
        if (h === "down")  { dy =  SPEED; newAnim = "walk_down"; newFlip = false; }

        // Try to move — slide along walls if blocked on one axis
        const nx = Math.max(2, Math.min(pct.current.x + dx, 98));
        const ny = Math.max(2, Math.min(pct.current.y + dy, 98));

        if (!isBlocked(nx, pct.current.y, blocked)) pct.current.x = nx;
        if (!isBlocked(pct.current.x, ny, blocked)) pct.current.y = ny;

        // Door / exit triggers
        const { x, y } = pct.current;
        if (curScene === "overworld" && inRect(x, y, OW_LAB_DOOR)) {
          transitionTo("lab", 50, 82);
        } else if (curScene === "lab" && inRect(x, y, LAB_EXIT)) {
          transitionTo("overworld", 50, 50);
        }

        // Flip change
        if (newFlip !== flipRef.current) {
          flipRef.current = newFlip;
          lastSrc.current = "";
          redraw();
        }
        // Anim change
        if (newAnim !== animRef.current) {
          animRef.current  = newAnim;
          frameRef.current = 0;
          lastSrc.current  = "";
          redraw();
        }

        // DOM position update
        const canvas = canvasRef.current;
        const shadow = shadowRef.current;
        const topPx  = Math.round(SPRITE_PX * ANCHOR);
        if (canvas) {
          canvas.style.left = `calc(${x}% - ${SPRITE_PX / 2}px)`;
          canvas.style.top  = `calc(${y}% - ${topPx}px)`;
        }
        if (shadow) {
          shadow.style.left = `calc(${x}% - 18px)`;
          shadow.style.top  = `calc(${y}% + 2px)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [redraw, transitionTo]);

  const Btn = ({ d, label }: { d: string; label: string }) => (
    <button
      onPointerDown={e => { e.preventDefault(); setHeld(d); }}
      onPointerUp={e   => { e.preventDefault(); setHeld(null); }}
      onPointerLeave={e => { e.preventDefault(); setHeld(null); }}
      style={{
        width: 64, height: 64,
        background: held === d ? "rgba(200,168,50,0.45)" : "rgba(10,10,10,0.7)",
        border: `2px solid ${held === d ? "#c8a840" : "rgba(255,255,255,0.18)"}`,
        borderRadius: 12,
        color: held === d ? "#f5d050" : "#bbb",
        fontSize: 26,
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
        backdropFilter: "blur(8px)", cursor: "pointer",
      }}
    >{label}</button>
  );

  const { x, y } = pct.current;
  const topPx    = Math.round(SPRITE_PX * ANCHOR);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#060606", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Map area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Background — swaps on scene change */}
        <img
          key={scene}
          src={scene === "overworld"
            ? "/__mockup/images/overworld-map.png"
            : "/__mockup/images/prof-lab-interior.png"}
          alt="map"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {/* Prof Irwyn NPC — only visible inside the lab, near desk */}
        {scene === "lab" && (
          <img
            src="/__mockup/images/prof-irwyn-sprite.png"
            alt="Prof Irwyn"
            style={{
              position: "absolute",
              width: 72, height: 72,
              objectFit: "contain",
              imageRendering: "auto",
              pointerEvents: "none",
              // Lab: near desk, top-center, facing player
              left: "calc(50% - 36px)",
              top:  "calc(22% - 36px)",
              mixBlendMode: "screen",  // dark lab bg → screen removes black perfectly
            }}
          />
        )}

        {/* Door indicator — glowing arch over Prof Lab door */}
        {scene === "overworld" && (
          <div style={{
            position: "absolute",
            left: "calc(50% - 18px)",
            top:  "38%",
            width: 36, height: 8,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255,210,60,0.55) 0%, transparent 80%)",
            animation: "pulse 1.4s ease-in-out infinite",
            pointerEvents: "none",
          }} />
        )}

        {/* Ground shadow */}
        <div ref={shadowRef} style={{
          position: "absolute",
          width: 36, height: 12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 75%)",
          pointerEvents: "none",
          left: `calc(${x}% - 18px)`,
          top:  `calc(${y}% + 2px)`,
        }} />

        {/* Player sprite */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            width:  SPRITE_PX,
            height: SPRITE_PX,
            imageRendering: "auto",
            pointerEvents: "none",
            left: `calc(${x}% - ${SPRITE_PX / 2}px)`,
            top:  `calc(${y}% - ${topPx}px)`,
          }}
        />

        {/* Fade overlay for scene transition */}
        <div style={{
          position: "absolute", inset: 0,
          background: "#000",
          opacity: fading ? 1 : 0,
          transition: "opacity 0.35s ease",
          pointerEvents: fading ? "all" : "none",
        }} />

        {/* Scene label */}
        <div style={{
          position: "absolute", top: 8, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          color: "#f0d060",
          fontSize: 11, fontWeight: 700,
          letterSpacing: 1.5,
          padding: "4px 12px",
          borderRadius: 20,
          border: "1px solid rgba(240,208,96,0.3)",
          pointerEvents: "none",
          textTransform: "uppercase",
        }}>
          {scene === "overworld" ? "Primeria Village" : "Prof. Irwyn's Lab"}
        </div>
      </div>

      {/* ── D-pad ────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, padding: "12px 0 20px",
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)",
      }}>
        <Btn d="up"   label="↑" />
        <div style={{ display: "flex", gap: 4 }}>
          <Btn d="left"  label="←" />
          <div style={{ width: 64 }} />
          <Btn d="right" label="→" />
        </div>
        <Btn d="down" label="↓" />
      </div>

      {/* Pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
    </div>
  );
}
