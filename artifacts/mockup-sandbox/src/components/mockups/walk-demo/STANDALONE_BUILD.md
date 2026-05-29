# Primeria — Standalone / Downloadable Build Guide

This game currently lives inside the canvas mockup-sandbox and runs at
`/preview/walk-demo/GameLauncher`. This guide is the exact recipe to turn it into a
**standalone downloadable demo**: first a self-contained web build, then an Android
**APK** (Capacitor) and/or a **desktop app** (Tauri).

Everything below has been kept "finish-ready" — the game has no exotic dependencies, so
packaging is mostly mechanical.

---

## 0. What the game actually needs (good news)

- **Code:** only 5 files, all in this folder:
  `GameLauncher.tsx`, `WalkDemo.tsx`, `BattleScene.tsx`, `progression.ts`, `save.ts`
- **Runtime deps:** `react` + `react-dom` only. (No framer-motion, no router, no backend.)
- **State/saves:** 100% client-side in `localStorage` (key `primeria_v2`). No server needed.
- **Assets:** image files in `artifacts/mockup-sandbox/public/images/` (175 files),
  referenced in code with the prefix **`/__mockup/images/...`**.

The single portability detail to handle is that asset prefix (see step 2).

---

## 1. Scaffold a standalone Vite app

```bash
# from anywhere outside the monorepo (or a fresh folder)
npm create vite@latest primeria -- --template react-ts
cd primeria
npm install
```

Copy the 5 game files into `src/game/`:

```
src/game/GameLauncher.tsx
src/game/WalkDemo.tsx
src/game/BattleScene.tsx
src/game/progression.ts
src/game/save.ts
```

Replace `src/App.tsx` with:

```tsx
import { GameLauncher } from "./game/GameLauncher";
export default function App() {
  return <GameLauncher />;
}
```

In `src/main.tsx` remove the default Vite CSS import (or keep an empty reset) and make the
root fill the viewport:

```css
/* src/index.css */
html, body, #root { margin: 0; height: 100%; background: #000; }
```

## 2. Handle the `/__mockup/images/` asset prefix (the one real gotcha)

The code references images as `/__mockup/images/foo.png`. In a standalone app the web root
is the `public/` folder, so place the images at the **matching path**:

```bash
mkdir -p public/__mockup
cp -r /path/to/monorepo/artifacts/mockup-sandbox/public/images public/__mockup/images
```

Now `/__mockup/images/foo.png` resolves with **zero code changes**.

> Alternative (if you prefer clean URLs): copy images to `public/images/` instead and run a
> one-line find/replace across the 5 files: `/__mockup/images/` → `/images/`. There are 96
> references (WalkDemo 82, GameLauncher 10, BattleScene 4). The copy-to-`__mockup` approach
> above avoids touching code and is recommended for the demo.

## 3. Run & verify the standalone web build

```bash
npm run dev      # play it in the browser at the printed localhost URL
npm run build    # produces dist/ — a fully static, shareable web build
npm run preview  # serve dist/ locally to confirm the production build works
```

At this point `dist/` **is** a downloadable, playable demo — zip it and it runs by opening
`index.html` through any static host. Saves persist per-browser via localStorage.

> Note: opening `dist/index.html` directly via `file://` can break asset loading in some
> browsers. Serve it over http (`npm run preview`, or any static server) for a clean demo.

---

## 4. Android APK (Capacitor)

Capacitor wraps the static web build in a native Android shell.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Primeria com.primeria.demo --web-dir=dist
npm run build
npx cap add android
npx cap copy
```

Then build the APK (**requires Android SDK + JDK installed — done off-Replit**):

```bash
npx cap open android      # opens Android Studio → Build > Build APK(s)
# OR headless, from android/:
cd android && ./gradlew assembleDebug
# APK output: android/app/build/outputs/apk/debug/app-debug.apk
```

Tips:
- Lock orientation to landscape in `android/app/src/main/AndroidManifest.xml`
  (`android:screenReorientation="landscape"`) — the game is designed wide.
- localStorage works inside the Capacitor WebView, so saves persist on-device.
- For a signed release APK, set up a keystore and run `./gradlew assembleRelease`.

---

## 5. Desktop app (Tauri) — optional

Tauri produces small native binaries (Windows `.exe`/`.msi`, macOS `.app`/`.dmg`,
Linux `.deb`/AppImage).

```bash
npm install --save-dev @tauri-apps/cli
npx tauri init
# Answer prompts: dev URL http://localhost:5173, build cmd `npm run build`, dist dir ../dist
npm run build
npx tauri build   # requires Rust toolchain + each OS's build tools, off-Replit
```

Output lands in `src-tauri/target/release/bundle/`.

---

## 6. Final checklist when you come back to finish

- [ ] Scaffold Vite app + copy the 5 files (step 1)
- [ ] Drop images at `public/__mockup/images/` (step 2)
- [ ] `npm run build` → confirm `dist/` plays via `npm run preview` (step 3)
- [ ] (APK) `npx cap add android` → build in Android Studio / `gradlew assembleDebug` (step 4)
- [ ] (Desktop) `npx tauri build` (step 5)
- [ ] Smoke test: new game, change scene, close, reopen → resumes (localStorage save)

The web build (step 3) is the deliverable that's ready with no SDKs. APK and desktop only
need their respective toolchains, which is why those final compiles happen off-Replit.
