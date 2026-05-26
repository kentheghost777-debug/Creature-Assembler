import { useEffect, useRef, useState } from "react";

const frames: Record<string, string[]> = {
  idle:       ["/__mockup/images/walk_idle.png"],
  walk_right: ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_left:  ["/__mockup/images/walk_side_1.png", "/__mockup/images/walk_side_2.png"],
  walk_up:    ["/__mockup/images/walk_back_1.png", "/__mockup/images/walk_back_2.png"],
  walk_down:  ["/__mockup/images/walk_front_1.png", "/__mockup/images/walk_front_2.png"],
};

export function WalkDemo() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [state, setState] = useState("idle");
  const [flip, setFlip] = useState(false);
  const pos = useRef({ x: 260, y: 4 });
  const stateRef = useRef("idle");
  const keys = useRef<Record<string, boolean>>({});
  const spriteRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
      e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => { keys.current[e.key] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  // Frame ticker
  useEffect(() => {
    const id = setInterval(() => {
      const set = frames[stateRef.current] || frames.idle;
      setFrameIdx(i => (i + 1) % set.length);
    }, 1000 / 7);
    return () => clearInterval(id);
  }, []);

  // Game loop
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const k = keys.current;
      const SPEED = 3;
      let newState = "idle";
      let newFlip = false;

      if (k["ArrowRight"]) { pos.current.x = Math.min(pos.current.x + SPEED, 560); newState = "walk_right"; }
      if (k["ArrowLeft"])  { pos.current.x = Math.max(pos.current.x - SPEED, 0);   newState = "walk_left"; newFlip = true; }
      if (k["ArrowUp"])    { pos.current.y = Math.min(pos.current.y + SPEED * 0.5, 55); if (newState === "idle") newState = "walk_up"; }
      if (k["ArrowDown"])  { pos.current.y = Math.max(pos.current.y - SPEED * 0.5, 4);  if (newState === "idle") newState = "walk_down"; }

      if (newState !== stateRef.current) {
        stateRef.current = newState;
        setState(newState);
        setFrameIdx(0);
      }
      setFlip(newFlip);

      if (spriteRef.current) {
        spriteRef.current.style.left   = pos.current.x + "px";
        spriteRef.current.style.bottom = pos.current.y + "px";
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const currentFrames = frames[state] || frames.idle;
  const src = currentFrames[frameIdx % currentFrames.length];

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
      <p style={{ color: "#c8a840", fontSize: 11, letterSpacing: 2, marginBottom: 10, opacity: 0.6 }}>KINJU — SPRITE WALK DEMO</p>

      {/* Arena */}
      <div style={{ width: 600, height: 210, background: "#111", border: "1px solid #222", borderRadius: 6, position: "relative", overflow: "hidden" }}>
        {/* Grid lines for depth feel */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(200,168,64,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Ground line */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(200,168,64,0.25) 20%, rgba(200,168,64,0.25) 80%, transparent)" }} />

        <img
          ref={spriteRef}
          src={src}
          alt="Kinju"
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            objectFit: "contain",
            left: pos.current.x,
            bottom: pos.current.y,
            transform: flip ? "scaleX(-1)" : "scaleX(1)",
            transition: "none",
            imageRendering: "auto",
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {[
          { key: "← →", label: "Sideways" },
          { key: "↑", label: "Away" },
          { key: "↓", label: "Toward" },
        ].map(item => (
          <div key={item.key} style={{ background: "#181818", border: "1px solid #2a2a2a", borderRadius: 4, padding: "7px 12px", fontSize: 11, color: "#666" }}>
            <span style={{ color: "#c8a840", fontWeight: "bold" }}>{item.key}</span>
            {"  "}{item.label}
          </div>
        ))}
      </div>

      <p style={{ color: "#444", fontSize: 10, marginTop: 10, letterSpacing: 1.5 }}>
        {state.replace("_", " ").toUpperCase()}
      </p>

      <p style={{ color: "#333", fontSize: 10, marginTop: 20, letterSpacing: 1, maxWidth: 480, textAlign: "center", lineHeight: 1.7 }}>
        This cycles 2 frames per direction. Transparent PNGs would remove the black background.
        4 frames per direction gives a smoother walk. This is the core mechanic.
      </p>
    </div>
  );
}
