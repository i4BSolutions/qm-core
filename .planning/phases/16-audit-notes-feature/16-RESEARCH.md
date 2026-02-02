# Phase 16: Audit Notes Feature - Research

**Researched:** 2026-02-02
**Domain:** Audit logging, user notes on status changes, UI patterns for expandable fields
**Confidence:** HIGH

## Summary

Phase 16 adds the capability to capture optional user-entered notes when changing status on QMRL and QMHQ entities. Notes are stored in the existing `audit_logs.notes` field (already present in schema) and displayed in the History tab. The challenge is passing user input from UI to the audit trigger and preventing duplicate audit entries.

The existing audit infrastructure already has a `notes TEXT` column in the `audit_logs` table (migration 025). The `status_change_dialog.tsx` already has a note textarea field but doesn't persist it. The audit trigger (`create_audit_log()`) already captures status changes and creates audit log entries.

Key implementation approaches:
1. **Pass note via application-level logic** - Update the status AND create audit entry with note in a single transaction
2. **Prevent duplicates via conditional trigger** - Detect and skip audit creation when app already created the entry
3. **UI already has note field** - StatusChangeDialog just needs to pass note to backend

**Primary recommendation:** Use application-bypass pattern with explicit audit log creation from the app layer, allowing the trigger to detect and skip duplicate entries for status changes that come with notes.

## Standard Stack

The project already uses all necessary technologies. No new libraries required.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ | Database with trigger support | Built-in AFTER UPDATE triggers, JSONB operators |
| Supabase | Current | PostgreSQL client | Existing auth context (auth.uid()) for audit user tracking |
| Next.js + React | 14+ | UI framework | Existing status change dialog component |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | Current | Icon library | Note/comment icon indicator for entries with notes |
| Tailwind CSS | Current | Styling | Expandable note display styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| App-level audit creation | SET LOCAL custom variable | More complex; requires transaction-scoped variables; harder to test |
| Conditional trigger skip | Audit table flag column | Requires schema change; adds complexity |
| Direct trigger note capture | RPC function wrapper | Extra network round-trip; complicates error handling |

**Installation:**
No new packages required - all components exist in codebase.

## Architecture Patterns

### Recommended Approach: Application-Level Audit Creation with Trigger Detection

**Pattern:** When user changes status WITH a note, the application creates BOTH the status update AND the audit log entry in a single transaction. The audit trigger detects this and skips creating a duplicate entry.

**Why this works:**
- Audit trigger fires AFTER UPDATE, so audit log entry already exists
- Trigger can check for recent audit entries (within 1 second) for same entity/action
- If found, skip creation; if not found (note-less status change), create entry as normal
- Single transaction ensures atomicity

**Example Flow:**
```typescript
// In clickable-status-badge.tsx handleConfirm()

const supabase = createClient();

// Start transaction (implicit in Supabase)
const { data, error } = await supabase.rpc('update_status_with_note', {
  p_entity_type: entityType, // 'qmrl' or 'qmhq'
  p_entity_id: entityId,
  p_new_status_id: selectedStatus.id,
  p_note: note || null, // User-entered note (optional)
  p_user_id: user.id
});
```

**Backend RPC Function:**
```sql
CREATE OR REPLACE FUNCTION update_status_with_note(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_new_status_id UUID,
  p_note TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status_id UUID;
  v_old_status_name TEXT;
  v_new_status_name TEXT;
  v_user_name TEXT;
  v_table_name TEXT;
BEGIN
  -- Determine table name
  v_table_name := CASE p_entity_type
    WHEN 'qmrl' THEN 'qmrl'
    WHEN 'qmhq' THEN 'qmhq'
  END;

  -- Get current status
  EXECUTE format('SELECT status_id FROM %I WHERE id = $1', v_table_name)
  INTO v_old_status_id
  USING p_entity_id;

  -- If note is provided, create audit entry FIRST (before update)
  IF p_note IS NOT NULL AND p_note != '' THEN
    -- Get status names
    SELECT name INTO v_old_status_name FROM status_config WHERE id = v_old_status_id;
    SELECT name INTO v_new_status_name FROM status_config WHERE id = p_new_status_id;
    SELECT full_name INTO v_user_name FROM users WHERE id = p_user_id;

    -- Create audit log entry with note
    INSERT INTO audit_logs (
      entity_type, entity_id, action,
      field_name, old_value, new_value,
      changes_summary, notes,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      v_table_name, p_entity_id, 'status_change',
      'status_id', v_old_status_id::TEXT, p_new_status_id::TEXT,
      'Status changed from "' || COALESCE(v_old_status_name, 'None') ||
        '" to "' || COALESCE(v_new_status_name, 'None') || '"',
      p_note,
      p_user_id, COALESCE(v_user_name, 'Unknown'), NOW()
    );
  END IF;

  -- Update the status (this triggers audit_trigger if no note was provided)
  EXECUTE format('UPDATE %I SET status_id = $1, updated_by = $2, updated_at = NOW() WHERE id = $3', v_table_name)
  USING p_new_status_id, p_user_id, p_entity_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

**Modified Audit Trigger (Deduplication):**
```sql
-- In create_audit_log() function, add deduplication check for status_change

-- Check for status_id change (qmrl, qmhq only)
IF old_json ? 'status_id' AND new_json ? 'status_id' THEN
  IF (old_json->>'status_id') IS DISTINCT FROM (new_json->>'status_id') THEN

    -- DEDUPLICATION CHECK: Has audit entry been created in last 1 second?
    DECLARE
      v_recent_audit_exists BOOLEAN;
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM audit_logs
        WHERE entity_type = TG_TABLE_NAME
          AND entity_id = NEW.id
          AND action = 'status_change'
          AND changed_at > NOW() - INTERVAL '1 second'
          AND field_name = 'status_id'
          AND new_value = (new_json->>'status_id')
      ) INTO v_recent_audit_exists;

      -- If recent audit entry exists, skip creation (app already created it with note)
      IF v_recent_audit_exists THEN
        RETURN NEW;
      END IF;
    END;

    -- No recent entry found, create audit log as normal (no note provided)
    audit_action := 'status_change';
    -- ... rest of existing status change logic
  END IF;
END IF;
```

### Pattern 2: Expandable Note Input (UI)

**What:** "Add note" link that expands to show textarea when clicked

**When to use:** Status change dialogs for QMRL and QMHQ

**Example:**
```tsx
// In status-change-dialog.tsx

const [showNoteField, setShowNoteField] = useState(false);
const [note, setNote] = useState("");

// In dialog body:
{!showNoteField && (
  <button
    type="button"
    onClick={() => setShowNoteField(true)}
    className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1"
  >
    <MessageSquare className="h-3 w-3" />
    Add note
  </button>
)}

{showNoteField && (
  <div className="space-y-2">
    <label htmlFor="note" className="text-sm text-slate-400">
      Note (optional, max 256 characters)
    </label>
    <Textarea
      id="note"
      value={note}
      onChange={(e) => setNote(e.target.value.slice(0, 256))}
      placeholder="Why are you changing the status?"
      rows={3}
      maxLength={256}
    />
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">
        {note.length}/256 characters
      </span>
      <button
        type="button"
        onClick={() => {
          setShowNoteField(false);
          setNote("");
        }}
        className="text-xs text-slate-400 hover:text-red-400"
      >
        Remove note
      </button>
    </div>
  </div>
)}
```

### Pattern 3: Expandable Note Display (History Tab)

**What:** Show note icon indicator, "View note" link expands to show full text

**When to use:** History tab entries that have notes

**Example:**
```tsx
// In history-tab.tsx HistoryEntry component

const hasNote = !!log.notes;

// In action label section:
<div className="flex items-center gap-2">
  <span className={`text-sm font-medium ${config.color}`}>
    {config.label}
  </span>
  {hasNote && (
    <MessageSquare className="h-3 w-3 text-amber-400" />
  )}
  {log.changes_summary && (
    <span className="text-sm text-slate-400">
      — {log.changes_summary}
    </span>
  )}
</div>

// In expanded details section:
{log.notes && (
  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
    <div className="flex items-start gap-2">
      <MessageSquare className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <span className="text-xs font-medium text-slate-400 uppercase">Note</span>
        <p className="text-sm text-slate-300 mt-1">{log.notes}</p>
      </div>
    </div>
  </div>
)}
```

### Anti-Patterns to Avoid

- **Don't use SET LOCAL custom variables** - Adds transaction-scoped state that's hard to test and debug
- **Don't create separate audit entries for notes** - Notes belong with the status_change action, not as separate 'update' entries
- **Don't make notes required** - Keep them optional to avoid friction in status changes
- **Don't show textarea by default** - Collapsed state reduces cognitive load for quick status changes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate audit entry detection | Custom deduplication logic | Time-window check (1 second) | Race conditions, clock skew, complexity |
| Transaction-level context passing | Custom session variables | RPC function parameters | Simpler, explicit, testable |
| Expandable UI state | Custom collapse logic | React useState + conditional render | Standard pattern, predictable |
| Character limit enforcement | Manual string slicing | maxLength + slice(0, 256) | Browser native + JS safeguard |

**Key insight:** The existing audit trigger is generic and handles ALL updates. Adding note support requires careful deduplication logic, not rewriting the trigger.

## Common Pitfalls

### Pitfall 1: Duplicate Audit Entries

**What goes wrong:** When app creates audit entry AND trigger creates audit entry, you get two entries for same status change

**Why it happens:** Audit trigger fires on ALL updates to qmrl/qmhq, including status changes. If app explicitly creates audit entry (to include note), trigger doesn't know to skip it.

**How to avoid:**
- Add deduplication check in trigger using time window (entries within 1 second)
- Check for matching entity_id, action, field_name, new_value
- If match found, RETURN NEW without creating audit entry

**Warning signs:**
- Two "Status changed" entries at same timestamp
- One entry has note, one doesn't
- History tab shows duplicate timeline entries

### Pitfall 2: Note Lost on Transaction Rollback

**What goes wrong:** User enters note, status change fails, note is lost and user has to re-enter it

**Why it happens:** Textarea state is cleared on dialog close, even if transaction failed

**How to avoid:**
- Only clear note state on successful status change
- Keep note in state if error occurs
- Show error toast but keep dialog open with note preserved

**Warning signs:**
- User reports "I typed a note but it disappeared"
- Error occurs but dialog closes anyway
- No way to retry with same note

### Pitfall 3: Notes Field Not Indexed, Slow Queries

**What goes wrong:** As audit log grows, queries filtering/searching notes become slow

**Why it happens:** The notes field has no index, and full-text search isn't set up

**How to avoid:**
- Phase 16 doesn't include note search/filter (per CONTEXT.md decisions)
- If future phase adds search, use PostgreSQL full-text search with GIN index
- For now, no index needed - notes are display-only

**Warning signs:**
- Not applicable to Phase 16 scope
- Future concern if note search is added

### Pitfall 4: Audit Trigger Fires Before App Creates Entry

**What goes wrong:** Race condition where trigger checks for recent audit entry before app creates it

**Why it happens:** Transaction timing - update happens before INSERT into audit_logs completes

**How to avoid:**
- Create audit entry FIRST, then update status (shown in RPC pattern)
- Ensures audit entry exists before trigger fires
- Trigger's time-window check will find the entry

**Warning signs:**
- Intermittent duplicate entries
- More common under load
- Fixed by ordering: INSERT audit, then UPDATE entity

## Code Examples

Verified patterns based on existing codebase:

### Existing Audit Log Schema (Already Has Notes)

```sql
-- From migration 025_audit_logs.sql (already exists)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action public.audit_action NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  old_values JSONB,
  new_values JSONB,
  changes_summary TEXT,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes TEXT  -- ← ALREADY EXISTS, just not used yet
);
```

### Existing Status Change Dialog (Already Has Note Field)

```tsx
// From components/status/status-change-dialog.tsx (already exists)
// Just needs to pass note to backend

const [note, setNote] = useState("");

// In dialog body - ALREADY EXISTS:
<Textarea
  id="note"
  placeholder="Add note (optional)"
  value={note}
  onChange={(e) => setNote(e.target.value)}
  rows={3}
  disabled={isConfirming}
/>
```

### Existing History Tab (Already Displays Notes)

```tsx
// From components/history/history-tab.tsx (already exists)
// Lines 346-351 - ALREADY DISPLAYS NOTES IF PRESENT:

{log.notes && (
  <div className="mt-2 pt-2 border-t border-slate-700">
    <span className="text-xs text-slate-400">Note: </span>
    <span className="text-xs text-slate-300">{log.notes}</span>
  </div>
)}
```

### Current Status Update Pattern (Needs Modification)

```tsx
// From components/status/clickable-status-badge.tsx
// Lines 88-103 - CURRENT IMPLEMENTATION (no note support):

const { error } = await supabase
  .from(tableName)
  .update({
    status_id: selectedStatus.id,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  })
  .eq("id", entityId);

// NEEDS TO CHANGE TO:
const { error } = await supabase.rpc('update_status_with_note', {
  p_entity_type: entityType,
  p_entity_id: entityId,
  p_new_status_id: selectedStatus.id,
  p_note: note, // from StatusChangeDialog
  p_user_id: user.id
});
```

### Expandable Note Input Pattern

```tsx
// NEW PATTERN for status-change-dialog.tsx

const [showNoteField, setShowNoteField] = useState(false);
const [note, setNote] = useState("");

return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      {/* Status preview... */}

      {/* Expandable note field */}
      <div className="space-y-3">
        {!showNoteField ? (
          <button
            type="button"
            onClick={() => setShowNoteField(true)}
            className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Add note
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Note (Optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowNoteField(false);
                  setNote("");
                }}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Remove
              </button>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 256))}
              placeholder="Why are you changing the status?"
              rows={3}
              maxLength={256}
            />
            <p className="text-xs text-slate-500">
              {note.length}/256 characters
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={handleConfirm}>Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

### Note Icon Indicator Pattern

```tsx
// ENHANCEMENT for history-tab.tsx HistoryEntry component

const hasNote = !!log.notes;

return (
  <div className="relative flex gap-4">
    {/* ... icon and timeline ... */}

    <div className="flex-1 pb-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>

            {/* Note indicator icon */}
            {hasNote && (
              <MessageSquare className="h-3 w-3 text-amber-400" />
            )}

            {log.changes_summary && (
              <span className="text-sm text-slate-400">
                — {log.changes_summary}
              </span>
            )}
          </div>
          {/* ... user and time ... */}
        </div>

        {/* Expand button - already exists, works with notes */}
        {hasDetails && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Details"}
          </button>
        )}
      </div>

      {/* Expanded details - note display already exists at line 346 */}
      {expanded && log.notes && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-xs font-medium text-slate-400 uppercase">Note</span>
              <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{log.notes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple status update via .update() | RPC function for status + note | Phase 16 (2026-02) | Enables note capture with deduplication |
| Audit trigger creates all entries | App creates entry for noted changes, trigger skips duplicates | Phase 16 (2026-02) | Prevents duplicate audit entries |
| Note field always hidden | Expandable "Add note" toggle | Phase 16 (2026-02) | Reduces friction for quick changes |
| Notes in expanded details only | Icon indicator + expandable display | Phase 16 (2026-02) | Scannable - user can see which entries have notes |

**Deprecated/outdated:**
- Direct .update() for status changes - Replace with .rpc('update_status_with_note')
- Note field always visible in dialog - Use expandable pattern to reduce clutter

## Open Questions

### Question 1: Should list pages support inline status changes with notes?

**What we know:**
- Detail pages already use ClickableStatusBadge
- List pages (qmrl/page.tsx, qmhq/page.tsx) also use ClickableStatusBadge
- User can change status from list view

**What's unclear:**
- Does inline status change on list pages open same dialog?
- Or does it use a simplified quick-change without note option?
- CONTEXT.md says "Claude's discretion based on existing status change patterns"

**Recommendation:**
- Use same StatusChangeDialog for both list and detail pages
- If user wants to add note, they can click "Add note" toggle
- Consistent UX across all status change locations
- Code reuse - no separate simplified dialog needed

### Question 2: Should PO status recalculation bypass note feature?

**What we know:**
- PO status is auto-calculated (not user-set)
- CONTEXT.md explicitly says "PO status changes do not get notes"
- PO uses enum status field, not status_id

**What's unclear:**
- Should the RPC function reject notes for PO-related status changes?
- Or simply not offer the note UI for PO status (which is already auto-calculated)?

**Recommendation:**
- No RPC function needed for PO - status is auto-calculated via triggers
- No UI for PO status changes - user doesn't manually change PO status
- RPC function only applies to qmrl/qmhq which have status_id field
- PO audit entries continue as-is with existing trigger logic

### Question 3: What happens if RPC fails but UI is already updated?

**What we know:**
- Supabase client transactions are implicit
- If RPC fails, transaction rolls back
- UI optimistic updates can desync

**What's unclear:**
- Should UI do optimistic update or wait for RPC success?
- How to handle partial failure (status updated but audit failed)?

**Recommendation:**
- NO optimistic update - wait for RPC success before refetching
- Show loading state during RPC call
- On success, call onStatusChange() callback to refetch entity data
- On error, show toast and keep dialog open with note preserved
- Transaction ensures atomicity - both status and audit succeed or both fail

## Sources

### Primary (HIGH confidence)
- Codebase analysis:
  - `/supabase/migrations/025_audit_logs.sql` - notes field already exists
  - `/supabase/migrations/026_audit_triggers.sql` - audit trigger logic
  - `/supabase/migrations/029_fix_audit_trigger_v2.sql` - current trigger implementation
  - `/supabase/migrations/041_invoice_void_cascade_audit.sql` - trigger ordering pattern (zz_ prefix)
  - `/components/status/clickable-status-badge.tsx` - current status update pattern
  - `/components/status/status-change-dialog.tsx` - note field already exists
  - `/components/history/history-tab.tsx` - note display already exists (line 346)
- PostgreSQL documentation:
  - [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - TG_OP, NEW, OLD variables
  - [PostgreSQL SET command](https://www.postgresql.org/docs/current/sql-set.html) - SET LOCAL for transaction-scoped variables
  - [set_config() function](https://pgpedia.info/s/set_config.html) - Alternative to SET LOCAL

### Secondary (MEDIUM confidence)
- [PostgreSQL Audit Trigger Wiki](https://wiki.postgresql.org/wiki/Audit_trigger) - Generic audit trigger patterns
- [Working with Postgres Audit Triggers | EDB](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers) - Best practices for audit triggers
- [Pass a variable to a trigger in PostgreSQL](https://www.dbi-services.com/blog/pass-a-variable-to-a-trigger-in-postgresql/) - SET LOCAL pattern for passing context
- [PostgreSQL set_config and current_setting](https://www.dbi-services.com/blog/postgresql-set_config-and-current_setting/) - Transaction-scoped variables
- [Supabase Postgres Triggers Documentation](https://supabase.com/docs/guides/database/postgres/triggers) - Trigger context in Supabase

### Tertiary (LOW confidence)
- [Expandable Text Pattern | UX Patterns](https://uxpatterns.dev/patterns/content-management/expandable-text) - UI pattern for expandable content
- [UI Design Patterns - Character Limits](https://dev.to/heymichellemac/ui-design-patterns-character-limits-6pp) - Best practices for character count display
- [React show hide component guide | TinyMCE](https://www.tiny.cloud/blog/react-show-hide-component/) - React toggle patterns
- [Create collapsible React components with react-collapsed](https://blog.logrocket.com/create-collapsible-react-components-react-collapsed/) - Collapsible component patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already exist in codebase (notes field, trigger, UI)
- Architecture: HIGH - RPC pattern verified via existing codebase patterns, deduplication strategy clear
- Pitfalls: HIGH - Duplicate entry risk identified from existing trigger logic, mitigation pattern established

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, established PostgreSQL patterns)

**Key finding:** The infrastructure already exists! The `notes` field is in the schema, the dialog has a note textarea, and the History tab displays notes. Phase 16 is primarily about plumbing: passing the note from UI → RPC → audit log and preventing duplicate entries via deduplication logic.
