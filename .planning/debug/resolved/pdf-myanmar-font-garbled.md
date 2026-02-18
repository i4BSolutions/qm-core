---
status: resolved
trigger: "pdf-myanmar-font-garbled"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Completed
expecting: Completed
next_action: DONE - archived

## Symptoms

expected: Myanmar Unicode text (Burmese script) should render correctly in downloaded PDFs, showing proper Myanmar characters.
actual: Myanmar text appears garbled — characters like `:8>.8</:>6>/ tips =1-/,:2/6<:8` appear instead of proper Myanmar/Burmese script. This looks like a font encoding/embedding issue.
errors: No runtime errors — the PDF generates but Myanmar text is garbled.
reproduction: Download any PDF (PO, Invoice, etc.) that contains Myanmar text. The Myanmar characters will be garbled.
started: Current issue across all PDFs.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: package.json
  found: @react-pdf/renderer v4.3.2 is the PDF library used
  implication: Font.register() API is available for custom font registration

- timestamp: 2026-02-18T00:01:30Z
  checked: lib/pdf/styles.ts line 11
  found: fontFamily is set to "Helvetica" (a built-in PDF standard font)
  implication: Helvetica has zero Myanmar glyph support (covers only Latin/Western charset)

- timestamp: 2026-02-18T00:02:00Z
  checked: entire codebase for Font.register calls
  found: Zero Font.register() calls anywhere in the project
  implication: No custom fonts are registered at all. Myanmar characters get encoded with wrong glyph indices, producing garbled output.

- timestamp: 2026-02-18T00:02:30Z
  checked: filesystem for .ttf/.otf/.woff font files (outside node_modules)
  found: No font files exist in the project outside of .next/static (Next.js web fonts, not PDF fonts)
  implication: No Myanmar font file is available to embed in PDFs

- timestamp: 2026-02-18T00:03:00Z
  checked: @react-pdf/font/lib/index.d.ts
  found: Font.register() accepts src (URL or file path), family, fontStyle, fontWeight; supports TTF/WOFF/WOFF2
  implication: Can register a Myanmar font via CDN URL (Google Fonts) without needing local font files

## Resolution

root_cause: No Myanmar-capable font was registered in @react-pdf/renderer. The default "Helvetica" built-in PDF font has no Myanmar Unicode glyphs (U+1000-U+109F). When Myanmar text is passed through Helvetica's glyph encoder, the codepoints map to wrong or missing glyph indices, producing garbled ASCII-looking characters like `:8>.8</:>6>/ tips =1-/,:2/6<:8`.
fix: Added Font.register() call in lib/pdf/styles.ts to register "NotoSansMyanmar" font (both regular and bold weights) via verified Google Fonts gstatic.com TTF URLs. Changed page default fontFamily from "Helvetica" to "NotoSansMyanmar". All text nodes without explicit fontFamily override now inherit Myanmar-capable rendering. Courier font is retained for number/amount nodes (ASCII-only, safe).
verification: TypeScript type-check passes (npm run type-check). TTF URLs verified returning HTTP 200. Only one file changed - minimal targeted fix.
files_changed:
  - lib/pdf/styles.ts
