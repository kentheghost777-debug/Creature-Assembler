import { useEffect, useRef, useState, useCallback } from "react";

// "walk_side" is shared for left AND right; flip is handled separately
const FRAME_SRCS: Record<string, string[]> = {
  idle:       ["/__mockup/images/stand_front_3d.png"],
  walk_side:  ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_up:    ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down:  ["/__mockup/images/walk_idle.png",   "/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

const SPRITE_DISPLAY = 76; // px
const SPEED = 0.4;

// Cache + preload images with crossOrigin (needed for getImageData on canvas)
const imgCache: Record<string, HTMLImageElement> = {};
function getImg(src: string) {
  if (!imgCache[src]) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    imgCache[src] = img;
  }
  return imgCache[src];
}

// Draw sprite onto canvas, turning near-black pixels transparent
function drawTransparent(canvas: HTMLCanvasElement, img: HTMLImageElement, flipX: boolean) {
  if (!img.complete || !img.naturalWidth) return;
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
  } catch {
    // getImageData blocked — leave image as-is (black bg visible but sprite still shows)
  }
}

export function WalkDemo() {
  // "animDir" is the animation set key; flip is separate from direction
  const [animDir, setAnimDir] = useState("idle");
  const [frameIdx, setFrameIdx] = useState(0);
  const [held, setHeld] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  const animDirRef = useRef("idle");
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  const heldRef    = useRef<string | null>(null);
  const pct        = useRef({ x: 50, y: 55 });

  // Preload all sprites
  useEffect(() => {
    Object.values(FRAME_SRCS).flat().forEach(getImg);
  }, []);

  useEffect(() => { heldRef.current = held; }, [held]);

  // Draw to canvas whenever frame or direction changes
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = (FRAME_SRCS[animDirRef.current] || FRAME_SRCS.idle)[frameRef.current];
    drawTransparent(canvas, getImg(src), flipRef.current);
  }, []);

  // Frame ticker — advances frame on interval
  useEffect(() => {
    const id = setInterval(() => {
      const frames = FRAME_SRCS[animDirRef.current] || FRAME_SRCS.idle;
      frameRef.current = (frameRef.current + 1) % frames.length;
      setFrameIdx(frameRef.current);
    }, 150);
    return () => clearInterval(id);
  }, []);

  // Redraw whenever frameIdx or animDir changes
  useEffect(() => { renderFrame(); }, [frameIdx, animDir, renderFrame]);

  // Game loop — movement only, no canvas draw (that's handled by the effect above)
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const h = heldRef.current;

      // Map input → animDir + flip
      let newAnimDir = "idle";
      let newFlip    = flipRef.current;
      let dx = 0, dy = 0;

      if (h === "right") { dx = SPEED;  newAnimDir = "walk_side"; newFlip = false; }
      if (h === "left")  { dx = -SPEED; newAnimDir = "walk_side"; newFlip = true; }
      if (h === "up")    { dy = -SPEED; newAnimDir = "walk_up";   newFlip = false; }
      if (h === "down")  { dy = SPEED;  newAnimDir = "walk_down"; newFlip = false; }

      // Update position
      pct.current.x = Math.max(4, Math.min(pct.current.x + dx, 96));
      pct.current.y = Math.max(6, Math.min(pct.current.y + dy, 95));

      // Apply flip change (re-render without resetting frame)
      if (newFlip !== flipRef.current) {
        flipRef.current = newFlip;
        renderFrame();
      }

      // Change animation set only when it actually changes (preserves frame continuity)
      if (newAnimDir !== animDirRef.current) {
        animDirRef.current = newAnimDir;
        frameRef.current   = 0;
        setAnimDir(newAnimDir); // triggers redraw via effect
      }

      // DOM position update (no re-render needed)
      const canvas = canvasRef.current;
      const shadow = shadowRef.current;
      if (canvas) {
        canvas.style.left = `calc(${pct.current.x}% - ${SPRITE_DISPLAY / 2}px)`;
        canvas.style.top  = `calc(${pct.current.y}% - ${SPRITE_DISPLAY}px)`;
      }
      if (shadow) {
        shadow.style.left = `calc(${pct.current.x}% - 16px)`;
        shadow.style.top  = `calc(${pct.current.y}% - 6px)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [renderFrame]);

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

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#060606", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Map area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <img
          src="/__mockup/images/overworld-map.png"
          alt="map"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {/* Ground shadow under sprite */}
        <div ref={shadowRef} style={{
          position: "absolute",
          width: 32, height: 10,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 80%)",
          pointerEvents: "none",
          left: `calc(${pct.current.x}% - 16px)`,
          top:  `calc(${pct.current.y}% - 6px)`,
        }} />

        {/* Sprite canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            width: SPRITE_DISPLAY,
            height: SPRITE_DISPLAY,
            imageRendering: "auto",
            pointerEvents: "none",
            left: `calc(${pct.current.x}% - ${SPRITE_DISPLAY / 2}px)`,
            top:  `calc(${pct.current.y}% - ${SPRITE_DISPLAY}px)`,
          }}
        />
      </div>

      {/* D-pad */}
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
    </div>
  );
}
