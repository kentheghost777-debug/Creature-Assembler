import { useEffect, useRef, useState, useCallback } from "react";

const FRAME_SRCS: Record<string, string[]> = {
  idle:       ["/__mockup/images/stand_front_3d.png"],
  walk_right: ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_left:  ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_up:    ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down:  ["/__mockup/images/walk_idle.png",   "/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

// Draw image onto a canvas with black pixels removed (alpha = 0)
function drawTransparent(canvas: HTMLCanvasElement, img: HTMLImageElement, flipX: boolean) {
  const W = img.naturalWidth  || img.width  || 300;
  const H = img.naturalHeight || img.height || 300;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  if (flipX) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0);
  if (flipX) ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, W, H);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Remove pixels that are close to black (the baked-in background)
    if (r < 28 && g < 28 && b < 28) d[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
}

// Preload all images once
const imageCache: Record<string, HTMLImageElement> = {};
function preloadAll() {
  const all = Object.values(FRAME_SRCS).flat();
  all.forEach(src => {
    if (!imageCache[src]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      imageCache[src] = img;
    }
  });
}

export function WalkDemo() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [dir, setDir]           = useState("idle");
  const [held, setHeld]         = useState<string | null>(null);

  const dirRef    = useRef("idle");
  const flipRef   = useRef(false);
  const heldRef   = useRef<string | null>(null);
  const pct       = useRef({ x: 50, y: 55 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frameRef  = useRef(0);

  useEffect(() => { preloadAll(); }, []);
  useEffect(() => { heldRef.current = held; }, [held]);

  // Render current frame to canvas with transparency
  const renderFrame = useCallback(() => {
    const src = (FRAME_SRCS[dirRef.current] || FRAME_SRCS.idle)[frameRef.current];
    const img = imageCache[src];
    if (!img || !img.complete || !canvasRef.current) return;
    drawTransparent(canvasRef.current, img, flipRef.current);
  }, []);

  // Frame ticker
  useEffect(() => {
    const id = setInterval(() => {
      const set = FRAME_SRCS[dirRef.current] || FRAME_SRCS.idle;
      frameRef.current = (frameRef.current + 1) % set.length;
      setFrameIdx(frameRef.current); // triggers re-render for canvas draw
      renderFrame();
    }, 150);
    return () => clearInterval(id);
  }, [renderFrame]);

  // Re-draw canvas when frameIdx or dir changes
  useEffect(() => { renderFrame(); }, [frameIdx, dir, renderFrame]);

  // Game loop
  useEffect(() => {
    let raf: number;
    const SPEED = 0.45;

    const loop = () => {
      const h = heldRef.current;
      let newDir  = "idle";
      let newFlip = false;
      let dx = 0, dy = 0;

      if (h === "right") { dx = SPEED;  newDir = "walk_right"; }
      if (h === "left")  { dx = -SPEED; newDir = "walk_left";  newFlip = true; }
      if (h === "up")    { dy = -SPEED; newDir = "walk_up"; }
      if (h === "down")  { dy = SPEED;  newDir = "walk_down"; }

      pct.current.x = Math.max(3, Math.min(pct.current.x + dx, 97));
      pct.current.y = Math.max(5, Math.min(pct.current.y + dy, 96));

      if (newDir !== dirRef.current) {
        dirRef.current = newDir;
        frameRef.current = 0;
        setDir(newDir);
      }
      if (newFlip !== flipRef.current) {
        flipRef.current = newFlip;
        renderFrame();
      }

      if (canvasRef.current) {
        canvasRef.current.style.left = `calc(${pct.current.x}% - 60px)`;
        canvasRef.current.style.top  = `calc(${pct.current.y}% - 110px)`;
      }
      if (shadowRef.current) {
        shadowRef.current.style.left = `calc(${pct.current.x}% - 24px)`;
        shadowRef.current.style.top  = `calc(${pct.current.y}% - 8px)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [renderFrame]);

  const Btn = ({ d, symbol }: { d: string; symbol: string }) => (
    <button
      onPointerDown={e => { e.preventDefault(); setHeld(d); }}
      onPointerUp={e   => { e.preventDefault(); setHeld(null); }}
      onPointerLeave={e => { e.preventDefault(); setHeld(null); }}
      style={{
        width: 64, height: 64,
        background: held === d ? "rgba(200,168,64,0.4)" : "rgba(0,0,0,0.6)",
        border: `2px solid ${held === d ? "#c8a840" : "rgba(255,255,255,0.2)"}`,
        borderRadius: 12,
        color: held === d ? "#f0d060" : "#ccc",
        fontSize: 26, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
        backdropFilter: "blur(6px)",
      }}
    >{symbol}</button>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Map */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <img
          src="/__mockup/images/overworld-map.png"
          alt="map"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Ground shadow */}
        <div ref={shadowRef} style={{
          position: "absolute",
          left: `calc(${pct.current.x}% - 24px)`,
          top:  `calc(${pct.current.y}% - 8px)`,
          width: 48, height: 14,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 75%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }} />

        {/* Sprite drawn on canvas with black bg removed */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            left: `calc(${pct.current.x}% - 60px)`,
            top:  `calc(${pct.current.y}% - 110px)`,
            width: 120, height: 120,
            imageRendering: "auto",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* D-Pad */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 4, padding: "12px 0 18px",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      }}>
        <Btn d="up"    symbol="↑" />
        <div style={{ display: "flex", gap: 4 }}>
          <Btn d="left"  symbol="←" />
          <div style={{ width: 64, height: 64 }} />
          <Btn d="right" symbol="→" />
        </div>
        <Btn d="down"  symbol="↓" />
      </div>
    </div>
  );
}
