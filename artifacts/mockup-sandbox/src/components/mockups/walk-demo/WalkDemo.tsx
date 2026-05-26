import { useEffect, useState } from "react";

const POSES = [
  { src: "/__mockup/images/stand_front_3d.png", label: "IDLE — Front Stand",       sub: "Used when still" },
  { src: "/__mockup/images/walk_side_1.png",    label: "SIDE WALK — Frame 1",       sub: "Walking left or right" },
  { src: "/__mockup/images/walk_side_2.png",    label: "SIDE WALK — Frame 2",       sub: "Alternates with Frame 1" },
  { src: "/__mockup/images/walk_back_1.png",    label: "BACK WALK — Frame 1",       sub: "Walking away from camera" },
  { src: "/__mockup/images/walk_back_2.png",    label: "BACK WALK — Frame 2",       sub: "Alternates with Frame 1" },
  { src: "/__mockup/images/walk_idle.png",      label: "FRONT WALK — Frame 1",      sub: "Walking toward camera" },
  { src: "/__mockup/images/walk_front_1.png",   label: "FRONT WALK — Frame 2",      sub: "Alternates through 3" },
  { src: "/__mockup/images/walk_front_2.png",   label: "FRONT WALK — Frame 3",      sub: "Completes the cycle" },
];

export function WalkDemo() {
  const [current, setCurrent] = useState(0);
  const [paused,  setPaused]  = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setCurrent(i => (i + 1) % POSES.length), 1800);
    return () => clearInterval(id);
  }, [paused]);

  const pose = POSES[current];

  return (
    <div style={{
      width: "100vw", minHeight: "100vh",
      background: "#0d0d0d",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      fontFamily: "monospace",
      padding: "24px 16px",
      gap: 0,
    }}>

      {/* Header */}
      <p style={{ color: "#c8a840", fontSize: 11, letterSpacing: 2, opacity: 0.55, margin: "0 0 16px" }}>
        KINJU — SPRITE SHEET VIEWER
      </p>

      {/* Large frame */}
      <div style={{
        width: 300, height: 300,
        background: "#0a0a0a",
        border: "1px solid #2a2a2a",
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <img
          key={pose.src}
          src={pose.src}
          alt={pose.label}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {/* frame counter badge */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(200,168,64,0.15)",
          border: "1px solid rgba(200,168,64,0.3)",
          borderRadius: 4,
          padding: "2px 8px",
          color: "#c8a840",
          fontSize: 9,
          letterSpacing: 1,
        }}>
          {current + 1} / {POSES.length}
        </div>
      </div>

      {/* Label */}
      <div style={{ textAlign: "center", margin: "14px 0 4px" }}>
        <p style={{ color: "#e0d0a0", fontSize: 13, letterSpacing: 1.5, margin: 0, fontWeight: "bold" }}>{pose.label}</p>
        <p style={{ color: "#555", fontSize: 10, margin: "4px 0 0", letterSpacing: 1 }}>{pose.sub}</p>
      </div>

      {/* Prev / Play / Next */}
      <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
        <button
          onClick={() => setCurrent(i => (i - 1 + POSES.length) % POSES.length)}
          style={btnStyle}
        >◀</button>
        <button
          onClick={() => setPaused(p => !p)}
          style={{ ...btnStyle, minWidth: 80, color: paused ? "#c8a840" : "#777", borderColor: paused ? "rgba(200,168,64,0.6)" : "rgba(255,255,255,0.1)" }}
        >
          {paused ? "▶ PLAY" : "⏸ PAUSE"}
        </button>
        <button
          onClick={() => setCurrent(i => (i + 1) % POSES.length)}
          style={btnStyle}
        >▶</button>
      </div>

      {/* All 8 thumbnails */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        width: "100%",
        maxWidth: 360,
      }}>
        {POSES.map((p, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); setPaused(true); }}
            style={{
              background: i === current ? "rgba(200,168,64,0.12)" : "#111",
              border: `1px solid ${i === current ? "rgba(200,168,64,0.7)" : "#222"}`,
              borderRadius: 6,
              padding: 4,
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}
          >
            <img src={p.src} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "contain" }} />
            <span style={{ color: i === current ? "#c8a840" : "#333", fontSize: 7, letterSpacing: 0.5 }}>
              {p.label.split("—")[0].trim()}
            </span>
          </button>
        ))}
      </div>

      <p style={{ color: "#222", fontSize: 9, marginTop: 16, letterSpacing: 1, textAlign: "center" }}>
        TAP A FRAME TO PAUSE ON IT · TRANSPARENT PNGs REMOVE BLACK BG
      </p>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "#888",
  fontSize: 14,
  padding: "8px 14px",
  cursor: "pointer",
  fontFamily: "monospace",
};
