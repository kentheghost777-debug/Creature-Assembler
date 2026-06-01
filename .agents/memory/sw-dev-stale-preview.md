---
name: Service worker stales the dev preview
description: Why code edits sometimes "don't show" in the Primeria dev preview, and the fix
---

# Service worker can serve stale code in the dev preview

`artifacts/primeria/index.html` registers a PWA service worker (`sw.js`). When that
SW is active on the **dev** domain it becomes a hidden variable: the running browser
tab keeps being controlled by an already-installed SW, so users (esp. on mobile)
report "nothing changed / it cost me money" even though the code was edited and HMR
ran.

**Rule:** never let the service worker register on a development host. In `index.html`
the registration script gates on hostname — if it's `localhost`/`127.0.0.1`/
`*.replit.dev`/`*.repl.co` it instead *unregisters* all SWs and clears all caches,
and only registers in production (`*.replit.app` / custom domains).

**Why:** a network-first SW still intercepts navigation/code and, across reloads,
can pin an old `index.html`/module graph. Tearing it down in dev removes the whole
class of "preview is behind" confusion.

**How to apply:** if a user says edits aren't showing in the preview, suspect the SW
first. After deploying the gate, the user may need ONE extra reload so the old SW
unregisters itself; subsequent loads are clean. Only the production build keeps the SW.

**The index.html gate alone is NOT enough.** A service worker installed *before* the
gate existed can serve its own cached `index.html`, so the in-page gate script never
runs — the user stays stuck no matter how many times they reset the preview. Fix:
`sw.js` must ALSO self-destruct on dev hosts. The browser re-fetches `sw.js` on every
navigation (bypassing the SW), so shipping a new `sw.js` (bump CACHE_VERSION so its
bytes change) lets a dev-host branch run on activate: delete all caches,
`self.registration.unregister()`, then `clients.matchAll → c.navigate(c.url)` to reload
every tab SW-free. Also early-return the `fetch` handler on dev so it never intercepts.
Both the index.html host gate and the sw.js dev self-destruct use the same IS_DEV host
check (localhost/127.0.0.1/*.replit.dev/*.repl.co).
