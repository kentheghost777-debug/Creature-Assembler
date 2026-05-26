import { useEffect, useRef, useState } from "react";

// All 8 provided assets mapped to their roles
const FRAME_SETS: Record<string, string[]> = {
  idle:       ["/__mockup/images/stand_front_3d.png"],                                          // 1 — 3D front standing
  walk_right: ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],         // 2, 3
  walk_left:  ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],         // 2, 3 (flipped)
  walk_up:    ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],         // 4, 5
  walk_down:  ["/__mockup/images/walk_idle.png",   "/__mockup/images/walk_front_1.png",
               "/__mockup/images/walk_front_2.png"],                                            // 6, 7, 8
};

const AUTO_SEQUENCE: { dir: string; dx: number; dy: number; steps: number }[] = [
  { dir: "idle",       dx: 0,   dy: 0,    steps: 20  },
  { dir: "walk_right", dx: 3,   dy: 0,    steps: 60  },
  { dir: "idle",       dx: 0,   dy: 0,    steps: 14  },
  { dir: "walk_up",    dx: 0,   dy: 0.8,  steps: 35  },
  { dir: "idle",       dx: 0,   dy: 0,    steps: 14  },
  { dir: "walk_left",  dx: -3,  dy: 0,    steps: 60  },
  { dir: "idle",       dx: 0,   dy: 0,    steps: 14  },
  { dir: "walk_down",  dx: 0,   dy: -0.8, steps: 35  },
];

const DIR_LABELS: Record<string, string> = {
  idle:       "IDLE (3D STAND)",
  walk_right: "WALK RIGHT (SIDE × 2)",
  walk_left:  "WALK LEFT  (SIDE × 2, FLIPPED)",
  walk_up:    "WALK AWAY  (BACK × 2)",
  walk_down:  "WALK TOWARD (FRONT × 3)",
};

export function WalkDemo() {
  const [frameIdx, setFrameIdx]   = useState(0);
  const [direction, setDirection] = useState("idle");
  const [flip, setFlip]           = useState(false);
  const [label, setLabel]         = useState("IDLE (3D STAND)");
  const [manualDir, setManualDir] = useState<string | null>(null);

  const pos       = useRef({ x: 220, y: 10 });
  const dirRef    = useRef("idle");
  const flipRef   = useRef(false);
  const manualRef = useRef<string | null>(null);
  const seqIdx    = useRef(0);
  const stepCount = useRef(0);
  const spriteRef = useRef<HTMLImageElement>(null);

  useEffect(() => { manualRef.current = manualDir; }, [manualDir]);

  // Frame ticker — 6 fps gives a nice walking pace
  useEffect(() => {
    const id = setInterval(() => {
      const set = FRAME_SETS[dirRef.current] || FRAME_SETS.idle;
      setFrameIdx(i => (i + 1) % set.length);
    }, 160);
    return () => clearInterval(id);
  }, []);

  // Game loop
  useEffect(() => {
    let raf: number;
    const ARENA_W = 540;

    const loop = () => {
      const manual = manualRef.current;
      let newDir = "idle";
      let newFlip = false;
      let dx = 0, dy = 0;

      if (manual) {
        if (manual === "right") { dx = 3;   newDir = "walk_right"; }
        if (manual === "left")  { dx = -3;  newDir = "walk_left";  newFlip = true; }
        if (manual === "up")    { dy = 0.8; newDir = "walk_up"; }
        if (manual === "down")  { dy = -0.8; newDir = "walk_down"; }
      } else {
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
      }

      pos.current.x = Math.max(0, Math.min(pos.current.x + dx, ARENA_W));
      pos.current.y = Math.max(0, Math.min(pos.current.y + dy, 55));

      if (newDir !== dirRef.current) {
        dirRef.current = newDir;
        setDirection(newDir);
        setFrameIdx(0);
        setLabel((manual ? "MANUAL — " : "AUTO — ") + (DIR_LABELS[newDir] ?? newDir));
      }
      if (newFlip !== flipRef.current) {
        flipRef.current = newFlip;
        setFlip(newFlip);
      }

      if (spriteRef.current) {
        spriteRef.current.style.left      = pos.current.x + "px";
        spriteRef.current.style.bottom    = pos.current.y + "px";
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
        width: 56, height: 56,
        background: manualDir === dir ? "rgba(200,168,64,0.28)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${manualDir === dir ? "rgba(200,168,64,0.7)" : "rgba(200,168,64,0.25)"}`,
        borderRadius: 8,
        color: "#c8a840",
        fontSize: 22,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        transition: "background 0.1s",
      }}
    >
      {symbol}
    </button>
  );

  // Asset inventory strip
  const allAssets = [
    { src: "/__mockup/images/stand_front_3d.png", tag: "IDLE" },
    { src: "/__mockup/images/walk_side_1.png",    tag: "SIDE 1" },
    { src: "/__mockup/images/walk_side_2.png",    tag: "SIDE 2" },
    { src: "/__mockup/images/walk_back_1.png",    tag: "BACK 1" },
    { src: "/__mockup/images/walk_back_2.png",    tag: "BACK 2" },
    { src: "/__mockup/images/walk_idle.png",      tag: "FWD 1" },
    { src: "/__mockup/images/walk_front_1.png",   tag: "FWD 2" },
    { src: "/__mockup/images/walk_front_2.png",   tag: "FWD 3" },
  ];

  return (
    <div style={{
      width: "100vw", minHeight: "100vh",
      background: "#0d0d0d",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "monospace",
      gap: 12, padding: "16px 0",
    }}>
      <p style={{ color: "#c8a840", fontSize: 11, letterSpacing: 2, opacity: 0.6, margin: 0 }}>
        KINJU — ALL 8 SPRITES
      </p>

      {/* Arena */}
      <div style={{
        width: 600, height: 200,
        background: "#111",
        border: "1px solid #222",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(200,168,64,0.025) 1px, transparent 1px), linear-gradient(90deg,rgba(200,168,64,0.025) 1px,transparent 1px)",
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
            left: pos.current.x + "px",
            bottom: pos.current.y + "px",
          }}
        />
      </div>

      {/* Label */}
      <p style={{ color: "#555", fontSize: 9, letterSpacing: 1.5, margin: 0, textAlign: "center", maxWidth: 580, lineHeight: 1.6 }}>
        {label}
      </p>

      {/* D-Pad */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <DpadBtn dir="up" symbol="↑" />
        <div style={{ display: "flex", gap: 4 }}>
          <DpadBtn dir="left" symbol="←" />
          <div style={{ width: 56, height: 56 }} />
          <DpadBtn dir="right" symbol="→" />
        </div>
        <DpadBtn dir="down" symbol="↓" />
      </div>

      <p style={{ color: "#2a2a2a", fontSize: 9, margin: 0, letterSpacing: 1 }}>
        HOLD TO TAKE OVER · RELEASE FOR AUTO DEMO
      </p>

      {/* Asset strip — all 8 frames displayed */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center",
        maxWidth: 620, marginTop: 4,
      }}>
        {allAssets.map((a, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{
              width: 60, height: 60,
              background: "#111",
              border: `1px solid ${src === a.src ? "rgba(200,168,64,0.7)" : "#222"}`,
              borderRadius: 4,
              overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <img src={a.src} alt={a.tag} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ color: src === a.src ? "#c8a840" : "#333", fontSize: 8, letterSpacing: 0.5 }}>{a.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
