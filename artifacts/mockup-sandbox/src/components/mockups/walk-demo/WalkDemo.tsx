import { useEffect, useRef, useState, useCallback } from "react";

// walk_side_2 faces opposite direction — only use frame 1 for side walking
const FRAMES: Record<string, string[]> = {
  idle:      ["/__mockup/images/stand_front_3d.png"],
  walk_side: ["/__mockup/images/walk_side_1.png"],
  walk_up:   ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down: ["/__mockup/images/walk_idle.png", "/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

const SPRITE_PX = 76;   // displayed size
const SPEED     = 0.4;  // % per rAF frame

// Image cache — crossOrigin required so canvas.getImageData() isn't blocked
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

// Remove near-black pixels on canvas; returns true on success
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
  } catch {
    /* CORS blocked — character shows with black background, still functional */
  }
  return true;
}

export function WalkDemo() {
  const [held, setHeld] = useState<string | null>(null);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const shadowRef  = useRef<HTMLDivElement>(null);
  const heldRef    = useRef<string | null>(null);
  const animRef    = useRef("idle");
  const flipRef    = useRef(false);
  const frameRef   = useRef(0);
  // lastDrawn tracks what's currently on canvas so we skip identical redraws
  const lastSrc    = useRef("");
  const lastFlip   = useRef(false);
  const pct        = useRef({ x: 50, y: 52 });

  // Preload all images upfront
  useEffect(() => {
    Object.values(FRAMES).flat().forEach(loadImg);
  }, []);

  useEffect(() => { heldRef.current = held; }, [held]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = FRAMES[animRef.current] || FRAMES.idle;
    const src    = frames[frameRef.current] || frames[0];
    // Only redraw if src or flip changed, OR if last draw failed (lastSrc still "")
    if (src === lastSrc.current && flipRef.current === lastFlip.current) return;
    const ok = drawSprite(canvas, src, flipRef.current);
    if (ok) { lastSrc.current = src; lastFlip.current = flipRef.current; }
  }, []);

  // Frame ticker at ~7fps
  useEffect(() => {
    const id = setInterval(() => {
      const frames = FRAMES[animRef.current] || FRAMES.idle;
      frameRef.current = (frameRef.current + 1) % frames.length;
      redraw();
    }, 145);
    return () => clearInterval(id);
  }, [redraw]);

  // Main game loop — handles movement + position DOM updates
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const h = heldRef.current;
      let newAnim = "idle";
      let newFlip = flipRef.current;
      let dx = 0, dy = 0;

      if (h === "right") { dx =  SPEED; newAnim = "walk_side"; newFlip = false; }
      if (h === "left")  { dx = -SPEED; newAnim = "walk_side"; newFlip = true;  }
      if (h === "up")    { dy = -SPEED; newAnim = "walk_up";   newFlip = false; }
      if (h === "down")  { dy =  SPEED; newAnim = "walk_down"; newFlip = false; }

      pct.current.x = Math.max(4, Math.min(pct.current.x + dx, 96));
      pct.current.y = Math.max(6, Math.min(pct.current.y + dy, 95));

      // Flip changed → immediate redraw with new orientation
      if (newFlip !== flipRef.current) {
        flipRef.current  = newFlip;
        lastSrc.current  = ""; // force redraw
        redraw();
      }

      // Animation state changed → reset frame, immediate redraw
      if (newAnim !== animRef.current) {
        animRef.current  = newAnim;
        frameRef.current = 0;
        lastSrc.current  = ""; // force redraw
        redraw();
      }

      // Update DOM positions without triggering React re-renders
      const { x, y } = pct.current;
      const canvas = canvasRef.current;
      const shadow = shadowRef.current;
      if (canvas) {
        canvas.style.left = `calc(${x}% - ${SPRITE_PX / 2}px)`;
        // Shift canvas down so the character's visual feet (~75% down the image)
        // land near y% rather than the canvas bottom edge
        canvas.style.top  = `calc(${y}% - ${Math.round(SPRITE_PX * 0.75)}px)`;
      }
      if (shadow) {
        // Shadow sits just below the foot-line, at y% + a small drop
        shadow.style.left = `calc(${x}% - 18px)`;
        shadow.style.top  = `calc(${y}% + 2px)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [redraw]);

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
    <div style={{
      width: "100vw", height: "100vh",
      background: "#060606",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Map */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <img
          src="/__mockup/images/overworld-map.png"
          alt="map"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />

        {/* Foot shadow */}
        <div ref={shadowRef} style={{
          position: "absolute",
          width: 36, height: 12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 75%)",
          pointerEvents: "none",
          left: `calc(${pct.current.x}% - 18px)`,
          top:  `calc(${pct.current.y}% + 2px)`,
        }} />

        {/* Sprite canvas — bottom 25% of canvas is empty space, so anchor at 75% */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            width:  SPRITE_PX,
            height: SPRITE_PX,
            imageRendering: "auto",
            pointerEvents: "none",
            left: `calc(${pct.current.x}% - ${SPRITE_PX / 2}px)`,
            top:  `calc(${pct.current.y}% - ${Math.round(SPRITE_PX * 0.75)}px)`,
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
