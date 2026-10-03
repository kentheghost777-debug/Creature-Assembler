import { BATTLE_RUNES } from "./progression";
import { useState } from "react";
import { Chronicle } from "./Chronicle";
import {
  SPELLS,
  RESONANCE_NODES,
  FAMILIES,
  guideTier,
  masteryLevel,
  emptyBond,
  bondEvent,
  tayanariBranches,
  recordChronicle,
  craftVessel,
  chooseBondPath,
  type Journey,
} from "./journeySystems";
export type Companion = {
  key: string;
  name: string;
  level: number;
  form: number;
};
export function GuideSoul({
  journey: j,
  onChange,
  companions,
  onClose,
  campAllowed,
  onFeed,
  onCraft,
  availableRunes,
  runeSlots,
  craftAllowed,
}: {
  journey: Journey;
  onChange: (j: Journey) => void;
  companions: Companion[];
  onClose: () => void;
  campAllowed: boolean;
  onFeed: () => boolean;
  onCraft: () => boolean;
  availableRunes: string[];
  runeSlots: number;
  craftAllowed: boolean;
}) {
  const [tab, setTab] = useState("Guide Soul");
  const [selected, setSelected] = useState(companions[0]?.key ?? "");
  const [message, setMessage] = useState("");
  const tier = guideTier(j);
  const bond = j.bonds[selected] ?? emptyBond();
  const mon = companions.find((m) => m.key === selected);
  const points = Math.max(
    0,
    masteryLevel(j.keeperXp) + 2 - j.spellNodes.length,
  );
  const resPoints = Math.max(
    0,
    masteryLevel(j.resonanceXp) - 1 - j.resonanceNodes.length,
  );
  const btn = {
    padding: "9px 12px",
    margin: 4,
    border: "1px solid #886c3a",
    borderRadius: 5,
    background: "#efe2c2",
    color: "#392714",
    cursor: "pointer",
  };
  const care = (feed = false) => {
    if (!selected) return;
    const next = bondEvent(j, selected, "care");
    if (next === j) {
      setMessage("Let your companion rest before more care.");
      return;
    }
    if (feed && !onFeed()) {
      setMessage("No Duskberries in the Satchel.");
      return;
    }
    onChange(next);
    setMessage(`${mon?.name} remembers this quiet moment.`);
  };
  return (
    <div
      role="dialog"
      aria-label="Guide Soul"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "#080502bb",
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div style={{ width: "min(900px,100%)", height: "min(720px,92%)" }}>
        <Chronicle page={tab} frame>
          <div
            style={{
              height: "100%",
              overflowY: "auto",
              padding: 16,
              touchAction: "pan-y",
            }}
          >
            <button
              style={{ ...btn, float: "right" }}
              onClick={onClose}
              aria-label="Close Guide Soul"
            >
              ✕
            </button>
            <nav style={{ display: "flex", flexWrap: "wrap" }}>
              {[
                "Guide Soul",
                "Companions",
                "Resonance",
                "Camp",
                "Crafting",
                "Chronicle",
              ].map((t) => (
                <button
                  style={btn}
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    setMessage("");
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
            <h2>{tab}</h2>
            {tab === "Guide Soul" && (
              <>
                <p>
                  Keeper mastery {masteryLevel(j.keeperXp)} · Guide Stones{" "}
                  {j.guideStones} · Tier {tier} · Spell points {points}
                </p>
                <p>
                  Equip up to six spells. Guide Stones open deeper branches.
                </p>
                <h3>Wristband rune sockets · {runeSlots}</h3>
                {!runeSlots && (
                  <p>
                    Equip wristbands in the Satchel to open Keeper rune sockets.
                  </p>
                )}
                {BATTLE_RUNES.filter((r) => availableRunes.includes(r.id)).map(
                  (r) => (
                    <button
                      style={btn}
                      key={r.id}
                      disabled={
                        !j.keeperRunes.includes(r.id) &&
                        j.keeperRunes.length >= runeSlots
                      }
                      onClick={() =>
                        onChange({
                          ...j,
                          keeperRunes: j.keeperRunes.includes(r.id)
                            ? j.keeperRunes.filter((id) => id !== r.id)
                            : [...j.keeperRunes, r.id],
                        })
                      }
                    >
                      {r.name} {j.keeperRunes.includes(r.id) ? "✓" : "Socket"}
                    </button>
                  ),
                )}
                {["Offense", "Defense", "Support"].map((branch) => (
                  <section key={branch}>
                    <h3>{branch}</h3>
                    {SPELLS.filter((s) => s.branch === branch).map((s) => {
                      const learned = j.spellNodes.includes(s.id);
                      const equipped = j.spells.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          style={btn}
                          disabled={
                            (!learned && (tier < s.tier || points < 1)) ||
                            (!equipped && learned && j.spells.length >= 6)
                          }
                          onClick={() =>
                            onChange(
                              learned
                                ? {
                                    ...j,
                                    spells: equipped
                                      ? j.spells.filter((id) => id !== s.id)
                                      : [...j.spells, s.id],
                                  }
                                : {
                                    ...j,
                                    spellNodes: [...j.spellNodes, s.id],
                                    spells:
                                      j.spells.length < 6
                                        ? [...j.spells, s.id]
                                        : j.spells,
                                  },
                            )
                          }
                        >
                          {s.name}{" "}
                          {equipped
                            ? "✓"
                            : learned
                              ? "Equip"
                              : tier < s.tier
                                ? `— tier ${s.tier}`
                                : "Learn"}
                        </button>
                      );
                    })}
                  </section>
                ))}
              </>
            )}
            {tab === "Companions" && (
              <>
                <select
                  aria-label="Companion"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {companions.map((m) => (
                    <option value={m.key} key={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {mon && (
                  <>
                    <p>
                      Loyalty {bond.loyalty}/100{" "}
                      <progress max={100} value={bond.loyalty} />
                    </p>
                    <p>
                      Chaos {bond.chaos}/100{" "}
                      <progress max={100} value={bond.chaos} />
                    </p>
                    <p>
                      Both histories endure. Reaching a threshold unlocks a
                      path; it never forces a change.
                    </p>
                    <button style={btn} onClick={() => care()}>
                      Spend time together
                    </button>
                    <button style={btn} onClick={() => care(true)}>
                      Feed Duskberry
                    </button>
                    {bond.unlocked.map((path) => (
                      <button
                        style={btn}
                        key={path}
                        disabled={bond[path] < 100 || bond.path === path}
                        onClick={() =>
                          onChange(chooseBondPath(j, selected, path))
                        }
                      >
                        {path} path {bond.path === path ? "✓" : "Choose"}
                      </button>
                    ))}
                    <h3>Tayanari mastery</h3>
                    <p>
                      Form {mon.form} ·{" "}
                      {tayanariBranches(mon.form).reduce((a, b) => a + b, 0)}{" "}
                      branches ·{" "}
                      {Math.max(
                        0,
                        mon.level -
                          1 -
                          (j.tayanariNodes[selected]?.length ?? 0),
                      )}{" "}
                      points
                    </p>
                    {tayanariBranches(mon.form).flatMap((count, b) =>
                      Array.from({ length: count }, (_, n) => {
                        const id = `${b}-${n}`;
                        const nodes = j.tayanariNodes[selected] ?? [];
                        return (
                          <button
                            style={btn}
                            key={id}
                            disabled={
                              nodes.includes(id) ||
                              nodes.length >= mon.level - 1
                            }
                            onClick={() =>
                              onChange({
                                ...j,
                                tayanariNodes: {
                                  ...j.tayanariNodes,
                                  [selected]: [...nodes, id],
                                },
                              })
                            }
                          >
                            {["Force", "Guard", "Flow"][b]} {n + 1}{" "}
                            {nodes.includes(id) ? "✓" : "Learn"}
                          </button>
                        );
                      }),
                    )}
                  </>
                )}
              </>
            )}
            {tab === "Resonance" && (
              <>
                <p>
                  Resonance mastery {masteryLevel(j.resonanceXp)} · {resPoints}{" "}
                  points · Attack / Support / Control
                </p>
                {RESONANCE_NODES.map((n) => (
                  <button
                    style={btn}
                    key={n.id}
                    disabled={
                      j.resonanceNodes.includes(n.id) ||
                      tier < n.tier ||
                      resPoints < 1 ||
                      ((n.id === "loyalty" || n.id === "chaos") &&
                        !companions.some((m) =>
                          (j.bonds[m.key]?.unlocked ?? []).includes(
                            n.id as "loyalty" | "chaos",
                          ),
                        ))
                    }
                    onClick={() =>
                      onChange({
                        ...j,
                        resonanceNodes: [...j.resonanceNodes, n.id],
                      })
                    }
                  >
                    {n.branch}: {n.name}{" "}
                    {j.resonanceNodes.includes(n.id)
                      ? "✓"
                      : tier < n.tier
                        ? `— tier ${n.tier}`
                        : "Learn"}
                  </button>
                ))}
              </>
            )}
            {tab === "Crafting" && (
              <>
                {!craftAllowed && (
                  <p>
                    Use a laboratory/town workbench or your tier-three field
                    camp worktable.
                  </p>
                )}
                <p>
                  A natural shell, elemental essence, and a Keeper rune form a
                  Fresh Shell. Balance vessels cannot be crafted.
                </p>
                {Object.entries(j.essences).map(([el, count]) => (
                  <button
                    style={btn}
                    key={el}
                    disabled={count < 1 || tier < 2 || !craftAllowed}
                    onClick={() => {
                      const next = craftVessel(j, el);
                      if (next !== j && onCraft()) {
                        onChange(next);
                        setMessage(`${el} Fresh Shell crafted.`);
                      } else
                        setMessage(
                          "A natural shell and an equipped Keeper rune are required.",
                        );
                    }}
                  >
                    {el} essence ×{count} · craft
                  </button>
                ))}
                {j.vessels.map((v) => (
                  <p key={v.id}>
                    Fresh {v.element} Shell ×{v.count} · 1 rune slot
                  </p>
                ))}
              </>
            )}
            {tab === "Camp" && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(3, j.campTier)},1fr)`,
                    gap: 8,
                    padding: 12,
                    border: "2px dashed #80663b",
                  }}
                >
                  {[
                    "Bedroll",
                    "Shelter & Satchel",
                    "Worktable",
                    "Shared hearth",
                    "Party quarters",
                  ]
                    .slice(0, j.campTier)
                    .map((place) => (
                      <div
                        key={place}
                        style={{
                          padding: 16,
                          background: "#dac393",
                          borderRadius: 10,
                        }}
                      >
                        {place}
                      </div>
                    ))}
                </div>
                <p>
                  Field camp · tier {j.campTier}/5 · {j.time}
                </p>
                <p>
                  {
                    [
                      "A bedroll and a quiet place beside one companion.",
                      "A shelter with room for supplies and preparation.",
                      "A worktable and gathering place for the party.",
                      "A shared hearth with space to practice and tell stories.",
                      "A complete field home with room for every companion.",
                    ][j.campTier - 1]
                  }
                </p>
                <button
                  style={btn}
                  disabled={!campAllowed}
                  onClick={() => {
                    onChange({
                      ...j,
                      time: j.time === "day" ? "night" : "day",
                    });
                    setMessage(
                      "Camp is settled. The pocket watch marks a new hour.",
                    );
                  }}
                >
                  Make camp · choose {j.time === "day" ? "night" : "day"}
                </button>
                <button
                  style={btn}
                  disabled={j.campTier >= 5 || j.campTier >= tier}
                  onClick={() => onChange({ ...j, campTier: j.campTier + 1 })}
                >
                  Expand camp
                </button>
                <select
                  aria-label="Camp companion"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {companions.map((m) => (
                    <option value={m.key} key={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  style={btn}
                  disabled={!campAllowed}
                  onClick={() => care()}
                >
                  Rest beside companion
                </button>
                {j.campTier >= 4 && (
                  <button
                    style={btn}
                    onClick={() =>
                      onChange(
                        recordChronicle(
                          j,
                          `camp-${j.chronicles.length}`,
                          `At the hearth, ${mon?.name ?? "my companions"} and I shared a moment of quiet. Our road still has room for both tenderness and unrest.`,
                        ),
                      )
                    }
                  >
                    Write by the hearth
                  </button>
                )}
              </>
            )}
            {tab === "Chronicle" && (
              <>
                <p>Ex Libris · {j.name}</p>
                <p>
                  Hearth & Kin · {FAMILIES.find((f) => f.id === j.family)?.name}
                </p>
                {j.chronicles.length ? (
                  j.chronicles.map((c) => (
                    <p
                      key={c.key}
                      style={{ fontFamily: "Georgia,serif", lineHeight: 1.7 }}
                    >
                      {c.text}
                    </p>
                  ))
                ) : (
                  <p>The next page waits for our first journey together.</p>
                )}
              </>
            )}
            {message && <p role="status">{message}</p>}
          </div>
        </Chronicle>
      </div>
    </div>
  );
}
