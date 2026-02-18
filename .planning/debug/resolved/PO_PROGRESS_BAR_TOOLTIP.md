---
status: resolved
trigger: "po-detail-progress-bar-tooltip"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED — POLineItemProgress component in po-line-items-table.tsx renders three plain divs for the bar segments with zero tooltip wrapper
test: Read the component in full
expecting: Find the exact JSX to wrap with Tooltip/TooltipTrigger from the existing tooltip.tsx
next_action: Wrap the progress bar div in po-line-items-table.tsx with Tooltip, add quantity breakdown to TooltipContent

## Symptoms

expected: When hovering over the progress bar segments on PO detail line items, a tooltip should appear showing the exact quantities (e.g. "Ordered: 500, Invoiced: 300, Received: 200")
actual: The progress bar has no tooltip — users can only see the visual proportions but not the exact numbers
errors: No errors — this is a missing UX feature
reproduction: Open any PO detail page (/po/[id]) and look at the line items table; progress bars show visual segments but no tooltip on hover
started: Feature has never existed — this is a feature addition

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:00:01Z
  checked: components/po/po-line-items-table.tsx — POLineItemProgress function (lines 323-376)
  found: The component renders a plain div with three overlapping absolute-positioned divs (gray baseline, blue invoiced, green received). No Tooltip wrapper anywhere.
  implication: This is exactly where the tooltip should be added.

- timestamp: 2026-02-18T00:00:01Z
  checked: components/ui/tooltip.tsx
  found: Radix-based Tooltip, TooltipProvider, TooltipTrigger, TooltipContent already exist and are styled for the dark theme.
  implication: No new tooltip component needed — can import and use directly.

- timestamp: 2026-02-18T00:00:01Z
  checked: po-line-items-table.tsx imports
  found: Tooltip, TooltipContent, TooltipProvider, TooltipTrigger are already imported at line 8-12.
  implication: Zero additional import changes needed — only JSX wrapping required.

- timestamp: 2026-02-18T00:00:01Z
  checked: app/(dashboard)/po/[id]/page.tsx — KPI panel POProgressBar usage (lines 460-467)
  found: POProgressBar receives invoicedPercent and receivedPercent but NOT raw counts; the actual qty counts (totalQty, invoicedQty, receivedQty) are calculated in the page and passed only to the KPI cards as text labels.
  implication: POProgressBar also needs tooltip support but requires prop additions; or we can add tooltip inline in the page's KPI panel — however the objective specifically calls out the LINE ITEMS table progress bars as the priority.

## Resolution

root_cause: POLineItemProgress component (components/po/po-line-items-table.tsx) renders the stepped bar segments as plain divs with no interactive tooltip wrapper. The Tooltip primitives were already imported in the same file. The component already received ordered/invoiced/received as numeric props — exactly the values needed in the tooltip.

fix: (1) Wrapped the progress bar div in POLineItemProgress with TooltipProvider > Tooltip > TooltipTrigger + TooltipContent showing color-coded Ordered/Invoiced/Received row breakdown. (2) Added optional totalQty/invoicedQty/receivedQty props to POProgressBar in po-progress-bar.tsx and wrapped each bar with a focused tooltip (invoiced bar shows Ordered+Invoiced; received bar shows Ordered+Received). (3) Passed the already-computed qty counts from the PO detail page to POProgressBar.

verification: tsc --noEmit returned zero errors. All three files compile cleanly. Logic is minimal-touch — only JSX wrapping added, no data flow changes needed since all quantities were already available at the call sites.

files_changed:
  - components/po/po-line-items-table.tsx
  - components/po/po-progress-bar.tsx
  - app/(dashboard)/po/[id]/page.tsx
