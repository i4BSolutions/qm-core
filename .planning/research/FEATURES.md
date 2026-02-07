# Features Research: v1.5 Enhancement Features

**Domain:** Internal ticket/inventory management platform
**Researched:** 2026-02-07
**Context:** Adding comments, responsive typography, two-step selectors, and currency unification to existing QM System

---

## Comments

### Table Stakes

Features users expect from a commenting system. Missing these would make the feature feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **One-level threading** | Standard in modern comment systems; allows direct replies without overwhelming nesting | Medium | Parent-child only; industry best practice to cap at one level for readability |
| **Visual hierarchy** | Users need to instantly recognize parent-child relationships | Low | Indentation, borders, or background colors to show reply relationships |
| **Author & timestamp** | Core accountability and context for comments | Low | Show who commented and when |
| **Delete own comments** | Users expect to remove their own content | Low | Standard permission pattern across platforms |
| **Soft delete (7-day recovery)** | Safety net for accidental deletions | Medium | Follow existing audit pattern; mark deleted but keep in DB for 7 days |
| **Polymorphic entity reference** | Comments must attach to QMRL, QMHQ, PO, Invoice | Medium | Leverage existing polymorphic attachment pattern from file uploads |
| **Role-based visibility** | Users only see comments on entities they can access | Medium | Follow existing RLS patterns for QMRL/QMHQ/PO/Invoice |
| **Real-time updates** | Comments appear without page refresh | Medium | Use Supabase realtime subscriptions |
| **Chronological ordering** | Newest first or oldest first toggle | Low | Standard sorting expectation |

### Differentiators

Features that enhance the experience beyond basic expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **NO edit capability** | Preserves comment integrity and audit trail; prevents abuse after moderation | Low (by omission) | Design decision: delete-only prevents post-publication content manipulation |
| **Admin can delete any comment** | Moderation capability for inappropriate content | Low | Admin role already has elevated permissions |
| **Collapse/expand threads** | Reduces clutter while preserving context | Medium | Helpful for long comment chains |
| **Comment count badge** | Quick visibility into discussion activity | Low | Show count on detail page tabs |
| **@mention notifications** | Alert users when tagged in comments | High | Defer to post-v1.5; requires notification system |
| **Markdown support** | Rich formatting for clearer communication | Medium | Consider for v1.6; adds significant complexity |
| **File attachments in comments** | Supporting evidence or context | Medium | Could leverage existing attachment system; defer to v1.6 |

### Anti-Features

Features to deliberately NOT build based on research.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-level threading (>1 level)** | Creates overwhelming visual complexity and confusing conversation flow | Hard cap at one level of replies; forces focused discussion |
| **Edit comments** | Breaks audit integrity; allows post-publication manipulation after moderation | Delete and re-comment if correction needed |
| **Upvoting/reactions** | Not relevant for internal operational tool; creates unnecessary gamification | Simple threaded discussion only |
| **Comment anonymization** | Internal accountability tool requires attribution | Always show commenter name |
| **Public/private toggle** | Adds complexity; RLS already handles visibility based on entity access | Rely on existing permission model |
| **Comment drafts** | Overkill for simple comment system | Post immediately or discard |

### Dependencies on Existing Features

- **Polymorphic associations**: Already implemented for file attachments; reuse pattern for `commentable_type` and `commentable_id`
- **Audit logging**: Comments should trigger audit events (create, delete)
- **User context**: Leverage existing auth context for commenter identity
- **RLS policies**: Comments inherit access from parent entity (QMRL/QMHQ/PO/Invoice)

---

## Responsive Typography

### Table Stakes

Essential features for handling large number displays.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **CSS clamp() for fluid scaling** | Modern standard for responsive typography; scales between min/max based on viewport | Low | `clamp(minRem, preferredVw, maxRem)` for smooth scaling |
| **Relative units (rem/em)** | WCAG AA compliance requires text resizable to 200% | Low | Never use fixed px for font sizes |
| **Truncation with ellipsis** | Prevents layout breakage from 15+ digit numbers | Low | Use `text-overflow: ellipsis` with `overflow: hidden` |
| **Non-breaking spaces for number groups** | Prevents awkward line breaks mid-number | Low | Format: `123 456 789` stays on one line |
| **Accessibility: 200% zoom support** | WCAG AA requirement | Low | Using rem/em inherently supports this |
| **Mobile-first breakpoints** | Numbers need more aggressive scaling on small screens | Medium | Start with mobile constraints, scale up for desktop |

### Differentiators

Features that enhance large number readability beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Abbreviation for very large numbers** | "1.5M" instead of "1,500,000" improves scannability | Medium | Use K (thousands), M (millions), B (billions) for card views |
| **Full number on hover/focus** | Preserve precision while showing abbreviated version | Low | Tooltip or expand on interaction |
| **Monospace font for alignment** | Numbers align vertically in tables for easier comparison | Low | Use `font-variant-numeric: tabular-nums` or monospace |
| **Locale-aware formatting** | Support both comma (1,000,000) and space (1 000 000) separators | Medium | System already uses space separators for international clarity |
| **Scientific notation toggle** | For extremely large numbers (>1 billion) | Low | Show 1.23e9 option for very large amounts |
| **Color-coded magnitude** | Visual cue for order of magnitude (millions vs billions) | Medium | Subtle color shift based on number size |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Auto-abbreviation without user control** | Finance users need full precision; auto-abbreviation loses trust | Only abbreviate in card/summary views; show full in detail views |
| **Fixed pixel font sizes** | Breaks WCAG accessibility; doesn't scale with user preferences | Always use rem/em units |
| **Truncation without hover reveal** | Frustrating for users who need the full number | Always provide way to see full value (hover, click, or detail view) |
| **Inconsistent number formatting** | Mixing formats (1,000 vs 1K vs 1000) creates confusion | Define clear rules: full in tables, abbreviated in cards |
| **Dynamic font size based on viewport only** | Can cause layout shift and readability issues | Use clamp() with sensible min/max bounds |

### Dependencies on Existing Features

- **CurrencyDisplay component**: Already shows two-line Org + EUSD format; enhance with responsive sizing
- **Tailwind CSS**: Existing design system provides responsive utilities
- **Financial amounts**: All use DECIMAL(15,2) format; 15 digits is the target edge case

---

## Two-Step Selector (Category → Item)

### Table Stakes

Essential features for cascading dropdown functionality.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Parent selection filters child** | Core definition of cascading dropdown; selecting category limits item choices | Medium | When category selected, only show items in that category |
| **Parent-independent usage** | Child dropdown should work without parent if all options needed | Low | Allow "All Categories" option or empty parent state |
| **Search within child dropdown** | Users expect searchable selects for long lists | Low | Already implemented in existing searchable selects |
| **Clear visual indication of dependency** | Users need to understand the relationship | Low | Label like "Category" → "Item (filtered by category)" |
| **Reset child when parent changes** | Changing category should clear selected item | Medium | Prevents invalid state (item not in new category) |
| **Loading state for child** | When parent changes, child options are loading | Low | Show spinner while fetching filtered items |
| **Empty state handling** | Clear message when no items in selected category | Low | "No items found in this category" message |

### Differentiators

Features that enhance the two-step selector beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Recently used items at top** | Speeds up repetitive PO creation | Medium | Track user's recent selections, show first in dropdown |
| **Item count per category** | Helps users find categories with available items | Low | Show "(23 items)" next to category name |
| **Keyboard navigation between steps** | Power users can tab from category → item → quantity | Low | Standard HTML form behavior, ensure it works |
| **Fuzzy search across both fields** | Single search box filters both category and item | High | Defer to v1.6; adds significant complexity |
| **Favorite/pin items** | Quick access to frequently used items | Medium | Defer to v1.6; requires user preferences storage |
| **Bulk add from category** | Select all items in category at once | Medium | Useful for standard orders; defer to v1.6 |
| **Preview item details on hover** | Show SKU, price, stock without leaving selector | Medium | Tooltip or popover with quick info |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Auto-select category based on item search** | Confusing reversal of filter direction; breaks mental model | Keep one-way filtering: category → item only |
| **Multi-select category** | Items can't belong to multiple categories simultaneously in this context | Single category selection; follow existing data model |
| **Infinite scroll in dropdowns** | Problematic for keyboard navigation and performance | Use pagination or "Load more" button if needed |
| **Automatic item selection** | Surprising behavior; user should explicitly choose | Never auto-select; require user action |
| **Inline item creation from selector** | Creates complex nested forms; breaks focus | Use separate "Create Item" flow, then return to PO |

### Dependencies on Existing Features

- **Searchable selects**: Already implemented for status and category; reuse pattern
- **Items table**: Has `category_id` foreign key for filtering
- **Categories table**: Provides parent dropdown options
- **Existing PO line item form**: Enhance with two-step pattern

---

## Currency Unification (Money-Out Inherits from Money-In)

### Table Stakes

Essential features for consistent currency handling.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auto-populate currency** | Money-out inherits currency from money-in for same QMHQ | Low | Prevents currency mismatch errors |
| **Auto-populate exchange rate** | Money-out uses same exchange rate as money-in | Low | Ensures consistent conversion calculations |
| **Display org currency + EUSD** | Two-line format already established in system | Low | Leverage existing CurrencyDisplay component |
| **Prevent currency mismatch** | Cannot create money-out in different currency than money-in | Medium | Database constraint + UI validation |
| **Show inherited values clearly** | User understands currency is locked/inherited | Low | Disabled field with "Inherited from Money In" helper text |
| **Calculate remaining balance** | Show available balance after money-out deductions | Medium | `balance = money_in - SUM(money_out)` |
| **Validation: money-out ≤ available** | Cannot withdraw more than available balance | Medium | Form validation + database check |

### Differentiators

Features that enhance currency unification beyond basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Visual flow diagram** | Show money-in → money-out relationship graphically | Medium | Helps users understand fund flow |
| **Multi-currency money-in handling** | If multiple money-in transactions in different currencies, clarify which to inherit | High | Edge case; defer to v1.6 if not MVP requirement |
| **Exchange rate history** | Track if rate changed between money-in and money-out | Medium | Useful for audit trail; show "Rate as of [date]" |
| **Currency conversion tool** | Quick converter within form for reference | Low | Helpful but not critical; defer to v1.6 |
| **Partial withdrawals in different tranches** | Multiple money-out transactions from one money-in | Medium | Likely already supported; clarify in requirements |
| **Warning for stale exchange rates** | Alert if money-out uses old exchange rate (e.g., >30 days old) | Medium | Helps catch potential rate drift |

### Anti-Features

Features to deliberately avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Manual currency override** | Defeats purpose of unification; creates inconsistency | Hard-lock currency to money-in value; no exceptions |
| **Manual exchange rate override for money-out** | Creates calculation discrepancies and audit issues | Inherit rate from money-in; if rate changed, update money-in |
| **Currency conversion on-the-fly** | Adds complexity; system should track actual currencies used | Store actual currencies; EUSD is for display/comparison only |
| **Multiple currencies per QMHQ** | Creates confusion in balance calculations | One currency per QMHQ PO route (inherited from first money-in) |
| **Historical rate lookups** | Over-engineering; money-in already has rate at transaction time | Use rate from money-in transaction, don't re-fetch historical rates |

### Dependencies on Existing Features

- **CurrencyDisplay component**: Two-line Org + EUSD format already implemented
- **Financial transactions table**: Tracks money-in/money-out with currency and exchange rate
- **QMHQ PO route**: Money-in creates budget, money-out reduces it
- **EUSD calculations**: Existing formula `amount / exchange_rate = amount_eusd`
- **Validation patterns**: Form validation infrastructure already exists

---

## Summary: Complexity & Priority Assessment

### Overall Complexity by Feature

| Feature Area | Overall Complexity | Implementation Risk |
|--------------|-------------------|---------------------|
| **Comments** | Medium | Low - reuse polymorphic pattern from attachments |
| **Responsive Typography** | Low | Low - CSS-based, incremental enhancement |
| **Two-Step Selector** | Low-Medium | Low - pattern already exists in system |
| **Currency Unification** | Low | Low - mostly UI logic, minimal DB changes |

### Recommended MVP Scope

**Include in v1.5 MVP:**
1. Comments: Core threading (1 level), delete-only, polymorphic attachment
2. Responsive Typography: CSS clamp() for all financial displays, abbreviation in card views
3. Two-Step Selector: Basic category → item filtering with reset logic
4. Currency Unification: Auto-inherit currency/rate, balance validation

**Defer to v1.6:**
- Comments: @mentions, markdown, file attachments
- Typography: Color-coded magnitude, scientific notation
- Selector: Recently used items, fuzzy search, bulk add
- Currency: Multi-currency handling, exchange rate warnings, flow diagrams

### Cross-Feature Integration Points

1. **Comments + Audit System**: Comment create/delete should trigger audit logs
2. **Responsive Typography + CurrencyDisplay**: Enhance existing component with clamp()
3. **Two-Step Selector + Searchable Selects**: Reuse existing select component infrastructure
4. **Currency Unification + Financial Transactions**: Minimal schema changes, mostly UI constraints

---

## Sources

### Comments Research
- [Comment Designs Trends for Web Designers in 2026](https://www.resultfirst.com/blog/web-design/15-best-comment-designs-trends-for-web-designers/)
- [25 Comment Thread Design Examples For Inspiration](https://www.subframe.com/tips/comment-thread-design-examples)
- [Common Patterns: Comments Best Practices](https://app.uxcel.com/courses/common-patterns/comments-best-practices-499)
- [Styling Comment Threads | CSS-Tricks](https://css-tricks.com/styling-comment-threads/)
- [Web Discussions: Flat by Design](https://blog.codinghorror.com/web-discussions-flat-by-design/)
- [Polymorphic Associations: Database Design Basics](https://patrickkarsh.medium.com/polymorphic-associations-database-design-basics-17faf2eb313)
- [Choosing a Database Schema for Polymorphic Data](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/)
- [Remove and Edit Your Comments | Disqus](https://help.disqus.com/en/articles/1717071-remove-and-edit-your-comments)

### Responsive Typography Research
- [Modern Fluid Typography Using CSS Clamp](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/)
- [Linearly Scale font-size with CSS clamp() Based on the Viewport](https://css-tricks.com/linearly-scale-font-size-with-css-clamp-based-on-the-viewport/)
- [CSS Clamp() Calculator](https://www.cssportal.com/css-clamp-calculator/)
- [Responsive Typography with Clamp](https://blog.openreplay.com/responsive-typography-with-clamp/)
- [Design for Truncation](https://medium.com/design-bootcamp/design-for-truncation-946951d5b6b8)
- [Font Size Requirements Guide | WCAG 2.1 AA/AAA Compliance](https://font-converters.com/accessibility/font-size-requirements)
- [MM (Millions) - Definition and Examples](https://corporatefinanceinstitute.com/resources/fixed-income/mm-millions/)
- [Different Abbreviations for Thousand, Million & Billion](https://www.yourdictionary.com/articles/abbreviations-million-thousand-billion)

### Two-Step Selector Research
- [How To Create a Cascading Dropdown](https://www.w3schools.com/howto/howto_js_cascading_dropdown.asp)
- [Cascading in Blazor DropDown List Component](https://blazor.syncfusion.com/documentation/dropdown-list/cascading)
- [Parent-Child Filter | Holistics Docs](https://docs.holistics.io/docs/filters/parent-child)
- [Helpful Filter Categories and Values for Better UX](https://www.nngroup.com/articles/filter-categories-values/)
- [Filter UX Design Patterns & Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)

### Currency Unification Research
- [The 10 Best Invoice Matching Software Solutions in 2026](https://www.highradius.com/resources/Blog/best-invoice-matching-platform/)
- [Purchase Order and Invoice Matching Software Solution](https://tipalti.com/ap-automation/po-matching/)
- [Invoice Matching Process](https://www.artsyltech.com/blog/invoice-matching)

---

**Confidence Level: HIGH**

All feature areas are well-documented in industry research. Table stakes, differentiators, and anti-features are clearly categorized based on current UX best practices and the specific context of the QM System internal tool.
