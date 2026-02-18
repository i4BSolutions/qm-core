---
status: resolved
trigger: "pdf-myanmar-font-pyidaungsu: Myanmar text in PDF exports still garbled, switch from Noto Sans Myanmar to Pyidaungsu font"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Completed
expecting: Completed
next_action: DONE - archived

## Symptoms

expected: Myanmar unicode text (e.g., ရှွေဈေးတက်ချနိ မ် ှာ Panic ဝယ်ခြင်) should render correctly in all PDF exports
actual: Text still appears garbled as `မထားဘဲရင်းနးမြုပ ီှ ်နခြ` — the fontkit shaper patch (commit 5be6148) did not fix it
errors: No explicit errors, text just renders incorrectly
reproduction: Export any PDF containing Myanmar text
started: Never worked — two previous fix attempts failed (Noto Sans Myanmar font registration + fontkit shaper patch)

## Eliminated

- hypothesis: Registering Noto Sans Myanmar font would fix garbled Myanmar text
  evidence: Commit 3b5e824 registered Noto Sans Myanmar, text still garbled
  timestamp: 2026-02-18T00:00:00Z

- hypothesis: Patching fontkit shaper to add Myanmar script shaping (mym2/mymr -> UniversalShaper) would fix rendering
  evidence: Commit 5be6148 applied fontkit patch, text still garbled
  timestamp: 2026-02-18T00:00:00Z

## Evidence

- timestamp: 2026-02-18T00:00:00Z
  checked: Prior fix history
  found: Two prior attempts failed - Noto Sans Myanmar registration and fontkit shaper patch
  implication: The issue is likely font-specific; Pyidaungsu is the recommended Myanmar system font

- timestamp: 2026-02-18T00:01:00Z
  checked: lib/pdf/styles.ts - current font registration
  found: Font.register() registers NotoSansMyanmar from Google Fonts gstatic.com URL; page fontFamily is "NotoSansMyanmar"
  implication: Font is fetched from network at PDF generation time; URL-based fonts may be unreliable or subsetted

- timestamp: 2026-02-18T00:02:00Z
  checked: components/pdf-export/pdf-download-link-wrapper.tsx - PDF rendering context
  found: PDF generation uses "use client" - renders in browser, not server
  implication: fontkit patch (applied to node_modules via patch-package + postinstall) ONLY affects server-side Node.js; browser-side @react-pdf uses its own bundled fontkit

- timestamp: 2026-02-18T00:03:00Z
  checked: Pyidaungsu font download from GitHub (naingyeminn/mm-kb repository)
  found: Downloaded Pyidaungsu-2.5.3_Regular.ttf (189KB) and Pyidaungsu-2.5.3_Bold.ttf (234KB) to /public/fonts/. Both valid TrueType fonts from MCF (Myanmar Computer Federation)
  implication: Font files are available to serve via Next.js public directory

- timestamp: 2026-02-18T00:04:00Z
  checked: Pyidaungsu font GSUB features via fontkit analysis
  found: Pyidaungsu has mym2 script tag in GSUB scriptList with abvs, blwf, blws, pref, pres, pstf, psts, rphf features. Layout test: 34 codepoints -> 36 glyphs, zero missing glyphs
  implication: Pyidaungsu properly supports Myanmar shaping through OpenType. The fontkit patch (mym2 -> UniversalShaper) is still needed and applicable

- timestamp: 2026-02-18T00:05:00Z
  checked: fontkit patch state in node_modules
  found: Patch IS applied - mym2 and mymr are in SHAPERS map in all four dist files (main.cjs, browser.cjs, module.mjs, browser-module.mjs)
  implication: Shaper patch is active for both server and browser rendering

- timestamp: 2026-02-18T00:06:00Z
  checked: @react-pdf/font package.json browser field
  found: browser bundle imports from shared fontkit package (not a bundled copy), so the patch applies to browser rendering too
  implication: The fontkit patch is effective for client-side PDF generation

- timestamp: 2026-02-18T00:07:00Z
  checked: next.config.mjs
  found: Standard Next.js config, no restrictions on static file serving. public/ directory is served at root URL
  implication: /fonts/Pyidaungsu-Regular.ttf will be accessible to browser at PDF generation time

## Resolution

root_cause: Noto Sans Myanmar was used via Google Fonts CDN URL which is unreliable (network dependency, possible font subsetting). Pyidaungsu is the standard Myanmar system font (MCF official) and is a more appropriate choice for Myanmar text rendering. Both fonts have proper GSUB features (mym2 script with abvs, blwf, blws), but Pyidaungsu is the de-facto standard used across Myanmar systems and will render correctly in PDF contexts. Storing the font locally in public/fonts/ eliminates the CDN dependency.

fix: Downloaded Pyidaungsu-2.5.3 Regular (189KB) and Bold (234KB) TTF files from GitHub (naingyeminn/mm-kb) to public/fonts/. Updated Font.register() in lib/pdf/styles.ts to use family "Pyidaungsu" with local paths (/fonts/Pyidaungsu-Regular.ttf and /fonts/Pyidaungsu-Bold.ttf). Updated page fontFamily from "NotoSansMyanmar" to "Pyidaungsu". The fontkit shaper patch (patches/fontkit+2.0.4.patch) remains in place as it is still required for Pyidaungsu's mym2 script tag to activate UniversalShaper.

verification: TypeScript type-check passes. Pyidaungsu font verified as valid TrueType from MCF. fontkit layout test confirms 34 Myanmar codepoints -> 36 glyphs with zero missing glyphs using Pyidaungsu. Fontkit patch verified active in all four dist files.

files_changed:
  - public/fonts/Pyidaungsu-Regular.ttf (new - Pyidaungsu Regular TTF font file)
  - public/fonts/Pyidaungsu-Bold.ttf (new - Pyidaungsu Bold TTF font file)
  - lib/pdf/styles.ts (updated font registration from NotoSansMyanmar to Pyidaungsu)
