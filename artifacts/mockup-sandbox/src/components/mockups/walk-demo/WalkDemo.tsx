import { useEffect, useRef, useState } from "react";

const FRAME_SETS: Record<string, string[]> = {
  idle:       ["/__mockup/images/walk_idle.png"],
  walk_right: ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_left:  ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_up:    ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down:  ["/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

const AUTO_SEQUENCE = [
  { dir: "walk_right", dx: 3,    dy: 0,    steps: 60 },
  { dir: "walk_up",    dx: 0,    dy: 0.8,  steps: 30 },
  { dir: "walk_left",  dx: -3,   dy: 0,    steps: 60 },
  { dir: "walk_down",  dx: 0,    dy: -0.8, steps: 30 },
];

export function WalkDemo() {
  const [frameIdx, setFrameIdx]   = useState(0);
  const [direction, setDirection] = useState("idle");
  const [flip, setFlip]           = useState(false);
  const [label, setLabel]         = useState("AUTO DEMO");
  const [manualDir, setManualDir] = useState<string | null>(null);

  const pos        = useRef({ x: 120, y: 10 });
  const dirRef     = useRef("idle");
  const flipRef    = useRef(false);
  const manualRef  = useRef<string | null>(null);
  const seqIdx     = useRef(0);
  const stepCount  = useRef(0);
  const spriteRef  = useRef<HTMLImageElement>(null);

  // sync manualDir into ref
  useEffect(() => { manualRef.current = manualDir; }, [manualDir]);

  // Frame ticker — 7fps
  useEffect(() => {
    const id = setInterval(() => {
      const set = FRAME_SETS[dirRef.current] || FRAME_SETS.idle;
      setFrameIdx(i => (i + 1) % set.length);
    }, 140);
    return () => clearInterval(id);
  }, []);

  // Game loop
  useEffect(() => {
    let raf: number;
    const ARENA_W = 560;

    const loop = () => {
      let newDir = "idle";
      let newFlip = false;
      let dx = 0, dy = 0;

      const manual = manualRef.current;

      if (manual) {
        // Manual D-pad
        if (manual === "right") { dx = 3; newDir = "walk_right"; }
        if (manual === "left")  { dx = -3; newDir = "walk_left"; newFlip = true; }
        if (manual === "up")    { dy = 0.8; newDir = "walk_up"; }
        if (manual === "down")  { dy = -0.8; newDir = "walk_down"; }
        setLabel(newDir.replace("_", " ").toUpperCase());
      } else {
        // Auto sequence
        const step = AUTO_SEQUENCE[seqIdx.current % AUTO_SEQUENCE.length];
        newDir  = step.dir;
        newFlip = step.dir === "walk_left";
        dx = step.dx;
        dy = step.dy;
        stepCount.current++;
        if (stepCount.current >= step.steps) {
          stepCount.current = 0;
          seqIdx.current = (seqIdx.current + 1) % AUTO_SEQUENCE.length;
        }
        setLabel("AUTO DEMO — " + newDir.replace("walk_", "").toUpperCase());
      }

      pos.current.x = Math.max(0, Math.min(pos.current.x + dx, ARENA_W - 10));
      pos.current.y = Math.max(0, Math.min(pos.current.y + dy, 55));

      if (newDir !== dirRef.current) {
        dirRef.current = newDir;
        setDirection(newDir);
        setFrameIdx(0);
      }
      if (newFlip !== flipRef.current) {
        flipRef.current = newFlip;
        setFlip(newFlip);
      }

      if (spriteRef.current) {
        spriteRef.current.style.left   = pos.current.x + "px";
        spriteRef.current.style.bottom = pos.current.y + "px";
        spriteRef.current.style.transform = newFlip ? "scaleX(-1)" : "scaleX(1)";
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentFrames = FRAME_SETS[direction] || FRAME_SETS.idle;
  const src = currentFrames[frameIdx % currentFrames.length];

  const DpadBtn = ({ dir, symbol }: { dir: string; symbol: string }) => (
    <button
      onPointerDown={() => setManualDir(dir)}
      onPointerUp={() => setManualDir(null)}
      onPointerLeave={() => setManualDir(null)}
      style={{
        width: 52, height: 52,
        background: manualDir === dir ? "rgba(200,168,64,0.25)" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(200,168,64,0.3)",
        borderRadius: 8,
        color: "#c8a840",
        fontSize: 20,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
      }}
    >
      {symbol}
    </button>
  );

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "#0d0d0d",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
      gap: 14,
    }}>
      <p style={{ color: "#c8a840", fontSize: 11, letterSpacing: 2, opacity: 0.6, margin: 0 }}>
        KINJU — SPRITE WALK DEMO
      </p>

      {/* Arena */}
      <div style={{
        width: 600, height: 200,
        background: "#111",
        border: "1px solid #222",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(200,168,64,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(200,168,64,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(200,168,64,0.2) 20%, rgba(200,168,64,0.2) 80%, transparent)",
        }} />
        <img
          ref={spriteRef}
          src={src}
          alt="Kinju"
          style={{
            position: "absolute",
            width: 120, height: 120,
            objectFit: "contain",
            left: pos.current.x,
            bottom: pos.current.y,
          }}
        />
      </div>

      {/* State label */}
      <p style={{ color: "#555", fontSize: 10, letterSpacing: 2, margin: 0 }}>{label}</p>

      {/* D-Pad */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <DpadBtn dir="up" symbol="↑" />
        <div style={{ display: "flex", gap: 4 }}>
          <DpadBtn dir="left" symbol="←" />
          <div style={{ width: 52, height: 52 }} />
          <DpadBtn dir="right" symbol="→" />
        </div>
        <DpadBtn dir="down" symbol="↓" />
      </div>

      <p style={{ color: "#2a2a2a", fontSize: 10, margin: 0, letterSpacing: 1, textAlign: "center" }}>
        Hold a direction to take over · Release to resume auto demo
      </p>
    </div>
  );
}
