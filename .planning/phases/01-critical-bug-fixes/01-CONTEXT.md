# Phase 1: Critical Bug Fixes - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore broken PO creation and stock-in workflows. Users must be able to create purchase orders from QMHQ and receive inventory through stock-in transactions without system errors. Also ensure invoice creation wizard completes successfully and stock-out processes transactions correctly. Add invoice line item quantity validation (qty ≤ PO qty).

</domain>

<decisions>
## Implementation Decisions

### Fix Strategy
- Clean while fixing — fix the bug and clean up obvious issues in the same file/function
- If shared code is the root cause, fix comprehensively so all consumers benefit
- Add brief comments explaining what was wrong and why it's fixed for future maintainers
- Minimize additions — prefer using existing code, only add new utilities if absolutely necessary

### Claude's Discretion
- Investigation approach and root cause analysis
- Specific technical implementation of fixes
- Test coverage decisions
- Error message wording

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard debugging and fixing approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-critical-bug-fixes*
*Context gathered: 2026-01-27*
