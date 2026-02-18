---
status: resolved
trigger: "pdf-myanmar-font-not-rendering - Myanmar text is not rendering correctly in PDF exports"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T18:30:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED - fontkit SHAPERS map missing Myanmar entries caused DefaultShaper to be used instead of UniversalShaper, resulting in no GSUB substitutions being applied to Myanmar text
test: Verified shaping with explicit feature lists vs DefaultShaper features
expecting: Fix applied via patch-package to fontkit dist files
next_action: RESOLVED - committed fix

## Symptoms

expected: Myanmar unicode text should render correctly in PDF exports (PO, Invoice, all PDFs)
actual: Myanmar text is garbled/not rendering - the characters `ရှွေဈေးတက်ချနိ မ် ှာ Panic ဝယ်ခြင်` do not display properly
errors: No explicit error messages - the text just does not render correctly
reproduction: Export any PDF that contains Myanmar text
started: Never worked - the previous font registration fix (commit 3b5e824) did not resolve the issue

## Prior Context

- Commit 3b5e824: "fix: register Noto Sans Myanmar font to fix garbled Myanmar text in PDFs" - attempted but never worked
- Commit 5980b4e: "docs: resolve debug pdf-myanmar-font-garbled" - debug session marked resolved prematurely
- All PDF exports are affected

## Eliminated

- hypothesis: Font not loading from Google Fonts URL
  evidence: URL returns HTTP 200, font IS downloaded correctly by @react-pdf/font
  timestamp: 2026-02-18

- hypothesis: Font does not contain Myanmar glyphs
  evidence: Noto Sans Myanmar font has GSUB features (abvs, blwf, blws, ccmp) with 4 features in mym2 script
  timestamp: 2026-02-18

- hypothesis: Font family not set on page
  evidence: styles.ts correctly sets fontFamily NotoSansMyanmar on the page style, and NotoSansMyanmar is registered with Font.register()
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: fontkit SHAPERS map in node_modules/fontkit/src/opentype/shapers/index.js
  found: Myanmar script tags (mym2, mymr) are NOT listed in the SHAPERS map, causing fontkit to fall through to DefaultShaper
  implication: DefaultShaper does not include Myanmar-specific GSUB features (abvs, blwf, blws), so no glyph substitution happens

- timestamp: 2026-02-18
  checked: "@react-pdf/textkit layoutRun function in textkit.js line 977"
  found: Calls font[0].layout(runString, undefined, undefined, undefined, 'ltr') - features are undefined so auto-detected by fontkit
  implication: Shaping WOULD work if the right shaper was selected by fontkit's OTLayoutEngine

- timestamp: 2026-02-18
  checked: USE trie data (use.trie) for Myanmar codepoints U+1000-U+109F
  found: Myanmar codepoints DO have entries in the Universal Shaping Engine trie (e.g. U+1000 = 4, U+102B = 10)
  implication: UniversalShaper CAN handle Myanmar text - data is already there

- timestamp: 2026-02-18
  checked: Layout test comparing DefaultShaper features vs Myanmar-specific features
  found: DefaultShaper features (ccmp, locl, rlig, mark, calt, clig, liga, kern) -> glyph 31 for ra (unshaped). Myanmar features (abvs, blwf, blws, ccmp) -> glyph 277 for ra (properly shaped with medials)
  implication: The GSUB substitutions work in the font - the problem is ONLY that the wrong shaper is selected

- timestamp: 2026-02-18
  checked: Layout after adding mym2/mymr to UniversalShaper in SHAPERS map
  found: "ရှွေဈေးတက်ချနိ မ် ှာ Panic ဝယ်ခြင်" - 34 codepoints -> 36 glyphs (was 20 codepoints -> 20 glyphs before fix)
  implication: Fix is working - Myanmar text is now being properly shaped with GSUB substitutions applied

## Resolution

root_cause: fontkit's SHAPERS map in node_modules/fontkit/src/opentype/shapers/index.js does not include Myanmar script tags (mym2, mymr), causing OTLayoutEngine to select DefaultShaper instead of UniversalShaper. DefaultShaper only applies features ccmp, locl, rlig, mark, mkmk, calt, clig, liga, rclt, curs, kern. Myanmar's critical GSUB features are abvs, blwf, blws - none of which are in DefaultShaper. Without these features, Myanmar combining characters (medials, vowel signs, asat) are not substituted into composed glyphs via GSUB lookup tables, resulting in each codepoint being mapped to its raw individual glyph and rendering as garbled text.

fix: Applied patch-package to fontkit@2.0.4 adding mym2 and mymr to the SHAPERS map pointing to UniversalShaper (which handles Myanmar via USE data that already includes Myanmar codepoints). Added postinstall script to package.json to auto-apply the patch after npm install. The patch modifies all four compiled dist files (main.cjs, browser.cjs, module.mjs, browser-module.mjs) plus the source file.

verification: Test confirmed - before fix: 20 Myanmar codepoints -> 20 glyphs (no GSUB substitution). After fix: 34 codepoints -> 36 glyphs with correct glyph substitution applied (e.g. ရ + medials -> glyph 277 instead of raw glyph 31). The exact call that @react-pdf/textkit makes (font.layout(str, undefined, undefined, undefined, 'ltr')) now produces properly shaped Myanmar text. Latin text still works correctly (11 glyphs for "Hello Panic").

files_changed:
  - patches/fontkit+2.0.4.patch (new - persistent patch for fontkit Myanmar shaping fix)
  - package.json (added postinstall patch-package to auto-apply patch after npm install)
  - node_modules/fontkit/src/opentype/shapers/index.js (patched)
  - node_modules/fontkit/dist/main.cjs (patched)
  - node_modules/fontkit/dist/browser.cjs (patched)
  - node_modules/fontkit/dist/module.mjs (patched)
  - node_modules/fontkit/dist/browser-module.mjs (patched)
