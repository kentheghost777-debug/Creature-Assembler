import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(
  new URL("../artifacts/mockup-sandbox/", import.meta.url),
);
const server = spawn("node", ["server.ts"], {
  cwd,
  env: { ...process.env, PORT: "3000" },
});
let output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
let browser;
try {
  await new Promise((resolve, reject) => {
    const check = setInterval(() => {
      if (output.includes("Server started")) {
        clearInterval(check);
        resolve();
      }
    }, 200);
    setTimeout(() => {
      clearInterval(check);
      reject(new Error(output));
    }, 20000);
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: process.env.CHROMIUM_ARGS
      ? JSON.parse(process.env.CHROMIUM_ARGS)
      : ["--no-sandbox"],
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(14000);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /NEW GAME/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Your Story/ }).click();
  await page.getByLabel("Your name").fill("Ghost");
  await page.getByLabel("Hearth & Kin").selectOption("lia");

  const journeyButton = page
    .getByRole("button", { name: /BEGIN|JOURNEY|ENTER|Start/i })
    .last();
  await journeyButton.click();
  await page.waitForTimeout(800);
  if ((await page.locator('[data-book-page="intro-1-custom"]').count()) !== 1)
    throw new Error("intro book missing");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /Next|Continue/ }).click();
    await page.waitForTimeout(550);
  }
  await page.getByLabel("Open Guide Soul").first().click();
  await page.getByRole("button", { name: "Chronicle", exact: true }).click();
  if (!(await page.getByText("Ex Libris · Ghost").count()))
    throw new Error("custom identity lost");
  await page.getByLabel("Close Guide Soul").click();
  async function mount(kind = "wild", options = {}) {
    await page.evaluate(
      async ({ kind, options }) => {
        const React = (await import("/node_modules/.vite/deps/react.js"))
          .default;
        const { createRoot } = (
          await import("/node_modules/.vite/deps/react-dom_client.js")
        ).default;
        const { BattleScene } =
          await import("/src/components/mockups/walk-demo/BattleScene.tsx");
        const { newJourney } =
          await import("/src/components/mockups/walk-demo/journeySystems.ts");
        const moves =
          await import("/src/components/mockups/walk-demo/moves.ts");
        let host = document.getElementById("fixture");
        if (host) {
          window.fixtureRoot.unmount();
          host.remove();
        }
        host = document.createElement("div");
        host.id = "fixture";
        Object.assign(host.style, {
          position: "fixed",
          inset: 0,
          zIndex: 99999,
        });
        document.body.appendChild(host);
        window.fixtureRoot = createRoot(host);
        let j = newJourney();
        j.keeperXp = 500;
        j.resonanceNodes = ["prime", "support", "control", "bench", "chain"];
        j.spells = [
          "elemental_pulse",
          "living_ward",
          "mending_light",
          "recall_breath",
        ];
        j.spellNodes = [...j.spells];
        j.vessels = [
          { id: "fresh-Nature", element: "Nature", quality: 3, count: 2 },
        ];
        window.fixtureJourney = j;
        window.result = null;
        window.fixtureRoot.render(
          React.createElement(BattleScene, {
            wild: {
              id: "test",
              name: "Test Wild",
              type: "Nature",
              rarity: "common",
              wildImg: "/images/kinju_front_idle.png",
              playerImg: "/images/kinju_front_idle.png",
              wildFaces: "left",
              playerFaces: "right",
              maxHp: 1000,
              baseDmg: [1, 2],
            },
            starter: {
              id: "starter-test",
              name: "Test Partner",
              type: "Nature",
              color: "#5ac070",
              img: "/images/kinju_front_idle.png",
            },
            starterLevel: 15,
            starterStats: { hp: 100, atk: 15, def: 15, spd: 10 },
            starterMoves: moves.defaultActiveMoves("Nature", 15),
            hasResonanceStone: true,
            healingRuneEquipped: true,
            shellsCount: 4,
            heroName: "Ghost",
            opponentKind: kind,
            keeperName: "Jay",
            journey: j,
            bondKeys: ["a", "b"],
            teamShellIds: ["bshell_moss", "bshell_tide"],
            teamRuneEffects: [["resonance_fill"], []],
            bench: [
              {
                id: "bench-test",
                name: "Bench Friend",
                type: "Oceanic",
                color: "#4af",
                img: "/images/jess_front_idle.png",
                level: 10,
                stats: { hp: 100, atk: 10, def: 10, spd: 8 },
                moves: moves.defaultActiveMoves("Oceanic", 10),
                faces: "right",
              },
            ],
            ...options,
            onJourneyChange: (j) => (window.fixtureJourney = j),
            onConsumeShell: () => {},
            onEnd: (r) => (window.result = r),
            berries: { dusk: 2, thorn: 2, calm: 2, bright: 2 },
          }),
        );
      },
      { kind, options },
    );
    await page.waitForTimeout(2200);
  }
  await mount();
  await page.getByRole("button", { name: /^Moves/ }).click();
  const move = page
    .getByRole("button")
    .filter({ hasText: /Nature Barrage/ })
    .first();
  await move.click();
  await page.waitForTimeout(2000);
  if (!(await page.getByText(/Tayanari action: used/).count()))
    throw new Error("Tayanari-first action did not wait for Keeper");
  await page.getByRole("button", { name: /^Spells/ }).click();
  await page.getByRole("button", { name: /Living Ward/ }).click();
  await page.waitForTimeout(2300);
  if (
    !(await page
      .getByText(/Keeper action: ready · Tayanari action: ready/)
      .count())
  )
    throw new Error("round did not reset");
  await page.getByRole("button", { name: /^Prime/ }).click();
  await page.getByRole("button").filter({ hasText: /Prime/ }).first().click();
  await page.waitForTimeout(2300);
  if (
    !(await page
      .getByText(/Keeper action: ready · Tayanari action: ready/)
      .count())
  )
    throw new Error("Prime did not consume fused turn");
  await page.getByRole("button", { name: /^Resonance Path/ }).click();
  await page.getByRole("button", { name: "support", exact: true }).click();
  await page.getByRole("button", { name: /^Resonance\s+15/ }).click();
  await page.waitForTimeout(1100);
  const resXp = await page.evaluate(() => window.fixtureJourney.resonanceXp);
  if (resXp !== 25) throw new Error("separate Resonance XP not persisted");
  await page.getByLabel("Bonding shell").selectOption("fresh-Nature");
  await mount();
  await page.getByRole("button", { name: /^Resonance\s+15/ }).click();
  await page.waitForTimeout(1300);
  if (!(await page.getByLabel("Resonance assist Bench Friend").count()))
    throw new Error("reserve party did not appear for chain");
  await page.waitForTimeout(2200);
  await mount("keeper");
  if (!(await page.getByRole("button", { name: /^Shells/ }).isDisabled()))
    throw new Error("keeper capture allowed");
  if (!(await page.getByRole("button", { name: /^Flee/ }).isDisabled()))
    throw new Error("keeper flee allowed");
  await page.evaluate(() => (Math.random = () => 0.5));
  await mount("wild", {
    starterStats: { hp: 10, atk: 15, def: 1, spd: 1 },
    wild: {
      id: "danger",
      name: "Danger Wild",
      type: "Volcanic",
      rarity: "common",
      wildImg: "/images/kinju_front_idle.png",
      playerImg: "/images/kinju_front_idle.png",
      wildFaces: "left",
      playerFaces: "right",
      maxHp: 1000,
      baseDmg: [80, 90],
    },
  });
  await page.getByRole("button", { name: /Pass Keeper/ }).click();
  await page.getByRole("button", { name: /^Moves/ }).click();
  await page.getByRole("button", { name: /Nature Barrage/ }).click();
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: /Bench Friend/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /^Spells/ }).click();
  await page.getByRole("button", { name: /Recall Breath/ }).click();
  await page.waitForTimeout(1000);
  let bond = await page.evaluate(() => window.fixtureJourney.bonds.a);
  if (bond?.loyalty !== 4) throw new Error("revival did not gain Loyalty");
  await page.getByRole("button", { name: /^Moves/ }).click();
  await page
    .getByRole("button")
    .filter({ hasText: /Oceanic/ })
    .first()
    .click();
  await page.waitForTimeout(2500);
  await page.evaluate(() => (Math.random = () => 0));
  await page.getByRole("button", { name: /^Flee/ }).click();
  await page.waitForTimeout(1900);
  const result = await page.evaluate(() => ({
    result: window.result,
    journey: window.fixtureJourney,
  }));
  if (result.result?.kind !== "fled") throw new Error("escape failed");
  if (result.journey.bonds.a.chaos !== 0)
    throw new Error("revived creature gained Chaos");
  await mount();
  await page.evaluate(() => (Math.random = () => 0.99));
  await page.getByRole("button", { name: /^Flee/ }).click();
  await page.waitForTimeout(2400);
  if (
    !(await page
      .getByText(/Keeper action: ready · Tayanari action: ready/)
      .count())
  )
    throw new Error("failed flee did not consume round");
  await mount();
  await page.getByLabel("Bonding shell").selectOption("fresh-Nature");
  await page.evaluate(() => (Math.random = () => 0));
  await page.getByRole("button", { name: /^Shells/ }).click();
  await page.getByRole("button", { name: /Set Shell/ }).click();
  await page.waitForTimeout(5000);
  const captured = await page.evaluate(() => ({
    result: window.result,
    journey: window.fixtureJourney,
  }));
  if (
    captured.result?.bondShellId !== "fresh-Nature" ||
    captured.journey.vessels[0].count !== 1
  )
    throw new Error("crafted capture inventory incorrect");
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log(
    "PASS book/custom identity, both action orders, Prime, Resonance, Keeper restrictions, revival/bonds, failed escape and crafted capture; page errors=0",
  );
} finally {
  await browser?.close();
  server.kill();
}
