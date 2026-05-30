---
name: Character portrait framing normalization
description: Why character portraits must share the same internal figure proportions, not just CSS positioning
---

# Character portrait framing must be normalized at the asset level

Character HD portraits (`hero-art.png`=Rowan, `kinju.png`=Kinju, etc.) are rendered
in the char_reveal / intro / thumbnail slots with `objectFit: contain` +
`objectPosition: bottom center`. With a portrait image in a shorter container,
`contain` scales the image to fill the container HEIGHT — so vertical
`objectPosition` has NO effect and CSS cannot shift the figure up/down.

**Why:** The only thing that controls where a character's feet/head sit in the
frame is the transparent margin baked into the PNG. If one portrait's figure
fills 91% of its canvas (tiny margins) and another fills 73% (big margins), they
render at different heights and one looks "too south" / floating.

**How to apply:** When a portrait looks mis-positioned vs the others, do NOT patch
CSS. Measure the figure bbox with PIL (`Image.getbbox()`), then re-pad the
offending PNG so its top-margin%, figure-height%, and bottom-margin% match the
reference portrait (Kinju is the canonical reference: ~10.8% top / 73.5% figure /
15.7% bottom, figure ~48% of width, horizontally centered). Save to BOTH
`artifacts/mockup-sandbox/public/images/` and `artifacts/primeria/public/images/`,
then bump the primeria `public/sw.js` cache version so clients refetch.
