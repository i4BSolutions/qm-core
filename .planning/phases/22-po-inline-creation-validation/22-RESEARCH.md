# Phase 22: PO Inline Item Creation & Validation - Research

**Researched:** 2026-02-06
**Domain:** Inline creation UX, form validation patterns, multi-tab auth session management
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inline Item Creation UX**
- **Form style:** Dialog/Modal overlay (not slide-out or inline expansion)
- **Required fields:** Full item form — all fields same as existing ItemDialog
- **Post-creation:** Toast success message, then auto-select item in the line row
- **Error handling:** Toast notification AND inline field errors (double feedback)
- **Trigger:** [+] button next to item selector (matching status/category inline create pattern)
- **Modal title:** "Create New Item"
- **SKU visibility:** Hide until saved — user doesn't see generated SKU in the modal
- **Cancel behavior:** Confirm discard if user has entered data before closing
- **Link to full form:** No link needed — modal has all fields
- **Visual style:** Reuse existing ItemDialog component exactly
- **New item indicator:** None — toast confirmation is sufficient
- **Partial failure:** If item created but auto-select fails, show error and keep item (user manually selects)
- **Keyboard shortcuts:** None for now (no Escape/Enter shortcuts)
- **Name pre-fill:** Start blank regardless of search term
- **Category default:** No default — user must select

**Contact Person Enforcement**
- **Validation timing:** On field blur (when user tabs out without selecting)
- **Required indicator:** Asterisk (*) on label ("Contact Person *")
- **Submit block:** Prevent submit + scroll to field with inline error
- **PO context:** New requirement — contact person field exists but wasn't required before

**Multi-tab Session Behavior**
- **Current issue:** Session expires in inactive tabs
- **Re-auth behavior:** Silent refresh in background — user doesn't notice
- **Refresh failure:** Redirect to login page
- **Expiration warning:** No warning — silent refresh handles it
- **Cross-tab sync:** Login and logout sync across all tabs
- **Unsaved work:** Show modal warning ("Session expired. You have unsaved changes.") before redirect
- **Session check triggers:** Both on tab focus AND on API 401 errors

**Item Selector Enhancement**
- **Create option location:** [+] button next to selector (matching existing pattern)
- **Item display:** Match existing pattern (Phase 21: SKU - Name format)
- **Search scope:** Match both item name AND SKU code
- **Price reference tooltip:** Yes, show on hover (Phase 21 behavior)
- **Post-create dropdown:** Close and show selected item in field
- **Price ref indicator:** No visual distinction between items with/without price reference

### Claude's Discretion
- Loading state in item dropdown
- Maximum items shown before requiring search
- Technical implementation of session refresh

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Summary

This phase enhances PO creation with three improvements: inline item creation during line entry, contact person validation for financial routes, and multi-tab session handling. The codebase already has most foundation pieces in place.

**Current State:**
- ItemDialog exists as a full-featured modal for creating items (name, category, price reference, photo)
- InlineCreateSelect pattern proven for status/category creation with [+] button trigger
- Contact person field exists in QMHQ forms but is not required
- Auth provider uses onAuthStateChange for session management but doesn't handle tab visibility
- PO line items table uses Select component from Radix UI with existing items

**Key Findings:**
- Supabase @supabase/ssr v0.8.0 handles session refresh automatically for active tabs via BroadcastChannel
- Inactive tabs do NOT auto-refresh sessions — manual refresh needed on tab focus
- React refs + scrollIntoView() pattern is standard for scroll-to-error validation
- Dialog component from Radix UI can wrap existing components via composition
- BroadcastChannel API is native in modern browsers (not Safari) for cross-tab sync

**Primary recommendation:** Add visibilitychange event listener to auth provider for silent session refresh on tab focus, wrap ItemDialog in a controller component triggered from PO line items table, add onBlur validation with scroll-to-error for contact person field, and extend InlineCreateSelect pattern to support item creation.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/ssr | ^0.8.0 | Session management | Built-in BroadcastChannel for multi-tab sync |
| @radix-ui/react-dialog | via shadcn/ui | Modal dialogs | Accessibility, focus management, portal rendering |
| @radix-ui/react-select | via shadcn/ui | Item selector dropdown | Keyboard nav, search, accessibility |
| @radix-ui/react-tooltip | ^1.1.3 | Price reference tooltips | Already used in Phase 21 |

### Browser APIs (Native)
| API | Purpose | Browser Support |
|-----|---------|-----------------|
| Page Visibility API | Detect tab focus/blur | All modern browsers |
| BroadcastChannel | Cross-tab messaging | Chrome/Edge/Firefox (not Safari) |
| scrollIntoView() | Scroll to error fields | All browsers |

### No New Dependencies Required
This phase uses existing libraries and browser APIs only.

## Architecture Patterns

### Pattern 1: Inline Creation via Component Composition

**What:** Trigger existing dialog from within a form, auto-select created item

**Existing Pattern (InlineCreateSelect):**
```tsx
// components/forms/inline-create-select.tsx
// Current: Inline expansion form below select
<div className="space-y-2">
  <div className="flex gap-2">
    <Popover>...</Popover>  {/* Searchable select */}
    <Button onClick={() => setIsCreating(true)}>  {/* [+] button */}
      <Plus />
    </Button>
  </div>
  {isCreating && <InlineForm />}  {/* Expands below */}
</div>
```

**New Pattern (Item Creation via Dialog):**
```tsx
// components/po/po-line-items-table.tsx (modified)
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [pendingLineId, setPendingLineId] = useState<string | null>(null);

const handleItemCreated = (newItem: Item) => {
  // Auto-select in pending line
  if (pendingLineId) {
    onUpdateItem(pendingLineId, "item_id", newItem.id);
    onUpdateItem(pendingLineId, "item_name", newItem.name);
    onUpdateItem(pendingLineId, "item_sku", newItem.sku || "");
    setPendingLineId(null);
  }
  setCreateDialogOpen(false);
};

// In line item row:
<div className="flex gap-2">
  <Select>...</Select>
  <Button
    onClick={() => {
      setPendingLineId(item.id);
      setCreateDialogOpen(true);
    }}
  >
    <Plus />
  </Button>
</div>

<ItemDialog
  open={createDialogOpen}
  onClose={(refresh, newItem) => {
    if (newItem) handleItemCreated(newItem);
    else setCreateDialogOpen(false);
  }}
  item={null}
/>
```

**Key Difference:** Status/category use inline form expansion; item uses dialog because it's complex (photo upload, multiple fields).

### Pattern 2: Field-Level Validation with Blur Timing

**What:** Validate on blur (not on change), show error inline, block submit

**Implementation:**
```tsx
// app/(dashboard)/qmhq/new/expense/page.tsx (example)
const [contactPersonTouched, setContactPersonTouched] = useState(false);
const [contactPersonError, setContactPersonError] = useState<string | null>(null);
const contactPersonRef = useRef<HTMLDivElement>(null);

const validateContactPerson = () => {
  // For expense and PO routes only
  if (formData.route_type === 'expense' || formData.route_type === 'po') {
    if (!formData.contact_person_id) {
      setContactPersonError("Contact person is required");
      return false;
    }
  }
  setContactPersonError(null);
  return true;
};

// In contact person field:
<div ref={contactPersonRef} className="grid gap-2">
  <Label>
    Contact Person
    {(formData.route_type === 'expense' || formData.route_type === 'po') && (
      <span className="text-red-400"> *</span>
    )}
  </Label>
  <Select
    value={formData.contact_person_id}
    onValueChange={(value) => {
      setFormData({ ...formData, contact_person_id: value });
      if (contactPersonTouched) validateContactPerson();
    }}
    onBlur={() => {
      setContactPersonTouched(true);
      validateContactPerson();
    }}
  >
    ...
  </Select>
  {contactPersonTouched && contactPersonError && (
    <p className="text-sm text-red-400">{contactPersonError}</p>
  )}
</div>

// On submit:
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const isValid = validateContactPerson();

  if (!isValid) {
    // Scroll to error
    contactPersonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    toast({
      title: "Validation Error",
      description: "Please fix the errors before submitting",
      variant: "destructive",
    });
    return;
  }

  // Submit...
};
```

**Why this pattern:**
- Blur timing prevents annoying errors while typing
- Ref + scrollIntoView() is simpler than form libraries for single field
- Double feedback (toast + inline) ensures user sees error

### Pattern 3: Silent Session Refresh on Tab Focus

**What:** Use Page Visibility API to detect tab activation, refresh session silently

**Current Implementation (auth-provider.tsx):**
```tsx
// Lines 164-185: Already listens to TOKEN_REFRESHED
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "TOKEN_REFRESHED" && session?.user) {
    console.log("Auth: Token refreshed");
    setSupabaseUser(session.user);
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  }
});
```

**Enhancement Needed:**
```tsx
// Add to AuthProvider useEffect
useEffect(() => {
  if (!supabaseUser) return;

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      // Tab became active - check session validity
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        // Session invalid - check for unsaved work
        const hasUnsavedWork = checkForUnsavedData(); // Custom logic

        if (hasUnsavedWork) {
          // Show warning modal before redirect
          setShowSessionExpiredModal(true);
        } else {
          // Redirect immediately
          await signOut();
        }
      } else {
        // Session valid - update activity marker
        localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [supabaseUser, signOut]);
```

**API 401 Error Handling:**
```tsx
// lib/supabase/client.ts (enhanced)
export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Add response interceptor for 401s
    // Note: Supabase client doesn't have interceptors like axios
    // Instead, handle in individual API calls or use a wrapper
  }
  return client;
}

// Pattern for API calls:
const { data, error } = await supabase.from('table').select();
if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) {
  // Session expired - trigger auth check
  window.dispatchEvent(new CustomEvent('auth:session-invalid'));
}
```

### Pattern 4: Cross-Tab Logout Sync (BroadcastChannel)

**What:** When user logs out in one tab, all tabs log out

**Implementation:**
```tsx
// components/providers/auth-provider.tsx
useEffect(() => {
  const channel = new BroadcastChannel('qm-auth');

  channel.onmessage = (event) => {
    if (event.data.type === 'SIGNED_OUT') {
      // Another tab signed out - sync this tab
      clearSessionMarkers();
      setUser(null);
      setSupabaseUser(null);
      router.push('/login');
    } else if (event.data.type === 'SIGNED_IN') {
      // Another tab signed in - refresh user
      refreshUser();
    }
  };

  return () => channel.close();
}, [router, refreshUser]);

// In signOut function:
const signOut = useCallback(async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearSessionMarkers();
  setUser(null);
  setSupabaseUser(null);

  // Broadcast to other tabs
  try {
    const channel = new BroadcastChannel('qm-auth');
    channel.postMessage({ type: 'SIGNED_OUT' });
    channel.close();
  } catch (e) {
    // BroadcastChannel not supported (Safari) - graceful degradation
  }

  router.push("/login");
}, [router]);
```

**Browser Support Note:**
- Chrome/Edge/Firefox: Full support
- Safari: Not supported (falls back to no sync, still functional)
- Graceful degradation: Try-catch ensures app works without it

### Pattern 5: Unsaved Work Detection

**What:** Check if form has unsaved changes before session redirect

**Implementation:**
```tsx
// Custom hook for tracking form changes
function useFormDirty<T>(initialData: T, currentData: T): boolean {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const dirty = JSON.stringify(initialData) !== JSON.stringify(currentData);
    setIsDirty(dirty);
  }, [initialData, currentData]);

  return isDirty;
}

// In PO form:
const [initialFormData] = useState(formData);
const hasUnsavedChanges = useFormDirty(initialFormData, formData);

// Session expired modal:
<Dialog open={showSessionExpiredModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Session Expired</DialogTitle>
      <DialogDescription>
        You have unsaved changes. Your session has expired and you'll need to log in again.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={() => router.push('/login')}>
        Return to Login
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session refresh logic | Custom polling | Supabase onAuthStateChange + visibilitychange | Built-in token refresh, auto BroadcastChannel sync |
| Cross-tab messaging | Custom WebSocket/polling | BroadcastChannel API (with fallback) | Native, efficient, auto-cleanup |
| Scroll to error | Custom animation | Element.scrollIntoView({ behavior: 'smooth' }) | Browser-native, accessible, smooth |
| Modal accessibility | Custom focus trap | Radix Dialog primitive | Handles focus lock, Esc key, backdrop click |
| Form validation library | React Hook Form for single field | Simple useState + onBlur | Overkill for one required field |

**Key insight:** Supabase already handles most session complexity via @supabase/ssr. Just need to add tab visibility hook.

## Common Pitfalls

### Pitfall 1: Validating on Every Keystroke
**What goes wrong:** Error appears immediately as user starts typing, annoying UX
**Why it happens:** Using onChange instead of onBlur for validation
**How to avoid:** Only validate after first blur (touched state), then on change
**Warning signs:** User complaints about "errors appearing too fast"

### Pitfall 2: Session Refresh Creating Infinite Loops
**What goes wrong:** Tab focus triggers refresh, which triggers visibilitychange, infinite loop
**Why it happens:** Not guarding against re-entrancy in visibility handler
**How to avoid:** Check if already refreshing, debounce handler, or use event.target check
**Warning signs:** Console logs showing repeated refresh calls

### Pitfall 3: Forgetting to Close BroadcastChannel
**What goes wrong:** Memory leaks in long-running app sessions
**Why it happens:** Creating channel but not calling .close() in cleanup
**How to avoid:** Always close in useEffect return function
**Warning signs:** Browser performance degradation over time

### Pitfall 4: ItemDialog State Not Resetting
**What goes wrong:** Second item creation shows data from first
**Why it happens:** Dialog state persists across open/close cycles
**How to avoid:** Reset form state in dialog's useEffect when open changes to true
**Warning signs:** "Create New Item" shows previously entered data

### Pitfall 5: Not Handling BroadcastChannel Absence
**What goes wrong:** App crashes in Safari or older browsers
**Why it happens:** Assuming BroadcastChannel exists globally
**How to avoid:** Wrap in try-catch, feature detection, or provide no-op fallback
**Warning signs:** Safari users report crashes

### Pitfall 6: Auto-Select Failing Silently
**What goes wrong:** Item created but not selected in line, user confused
**Why it happens:** Not passing created item back from dialog or line ID lost
**How to avoid:** Return item from dialog callback, show error toast if auto-select fails
**Warning signs:** Users report "created item not appearing in line"

### Pitfall 7: Contact Person Validation After Route Change
**What goes wrong:** User switches from PO to Item route, still sees "contact person required"
**Why it happens:** Not clearing error state when route type changes
**How to avoid:** Clear contactPersonError in route_type change handler
**Warning signs:** Validation errors persist when switching routes

## Code Examples

### Example 1: ItemDialog Callback for Auto-Select

```tsx
// Modify app/(dashboard)/item/item-dialog.tsx
interface ItemDialogProps {
  open: boolean;
  onClose: (refresh?: boolean, newItem?: Item) => void;  // Add newItem param
  item: Item | null;
}

export function ItemDialog({ open, onClose, item }: ItemDialogProps) {
  // ... existing code ...

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const supabase = createClient();

    try {
      const data = {
        name: formData.name,
        category_id: formData.category_id || null,
        photo_url: photoUrl,
        price_reference: formData.price_reference || null,
      };

      if (item) {
        // Update existing
        const { error } = await supabase
          .from("items")
          .update(data)
          .eq("id", item.id);

        if (error) throw error;

        toast({ title: "Success", description: "Item updated.", variant: "success" });
        onClose(true);  // Refresh list
      } else {
        // Create new
        const { data: newItem, error } = await supabase
          .from("items")
          .insert(data)
          .select()
          .single();

        if (error) throw error;

        toast({ title: "Success", description: "Item created.", variant: "success" });
        onClose(true, newItem as Item);  // Pass created item back
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  // ... rest of component ...
}
```

### Example 2: PO Line Items with Inline Creation Trigger

```tsx
// components/po/po-line-items-table.tsx (modification)
interface EditableLineItemsTableProps {
  items: LineItemFormData[];
  availableItems: Pick<Item, "id" | "name" | "sku" | "default_unit" | "price_reference">[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemFormData, value: unknown) => void;
  onItemCreated?: (newItem: Item) => void;  // New callback
  currency?: string;
  disabled?: boolean;
}

export function EditableLineItemsTable({
  items,
  availableItems,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onItemCreated,
  currency = "MMK",
  disabled = false,
}: EditableLineItemsTableProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  const handleItemCreated = (newItem: Item) => {
    // Auto-select in the line that triggered creation
    if (pendingLineId) {
      onUpdateItem(pendingLineId, "item_id", newItem.id);
      onUpdateItem(pendingLineId, "item_name", newItem.name);
      onUpdateItem(pendingLineId, "item_sku", newItem.sku || "");
      onUpdateItem(pendingLineId, "item_unit", newItem.default_unit || "");
    }

    // Notify parent to refresh available items
    onItemCreated?.(newItem);

    setCreateDialogOpen(false);
    setPendingLineId(null);
  };

  const handleCreateDialogClose = (refresh?: boolean, newItem?: Item) => {
    if (newItem) {
      handleItemCreated(newItem);
    } else {
      setCreateDialogOpen(false);
      setPendingLineId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* ... table header ... */}
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/50">
                  <td className="py-2 px-3">
                    {item.item_id ? (
                      <div className="flex items-center gap-2">
                        {/* Selected item display */}
                        <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm">
                          <code className="font-mono text-amber-400 mr-2">
                            {item.item_sku || "---"}
                          </code>
                          <span className="text-slate-400 mr-2">-</span>
                          <span className="text-slate-200">{item.item_name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onUpdateItem(item.id, "item_id", null);
                            onUpdateItem(item.id, "item_name", "");
                            onUpdateItem(item.id, "item_sku", "");
                            onUpdateItem(item.id, "item_unit", "");
                          }}
                          disabled={disabled}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {/* Item selector */}
                        <Select
                          value=""
                          onValueChange={(value) => {
                            const selectedItem = availableItems.find((i) => i.id === value);
                            if (selectedItem) {
                              onUpdateItem(item.id, "item_id", value);
                              onUpdateItem(item.id, "item_name", selectedItem.name);
                              onUpdateItem(item.id, "item_sku", selectedItem.sku || "");
                              onUpdateItem(item.id, "item_unit", selectedItem.default_unit || "");
                            }
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="flex-1 bg-slate-800 border-slate-700">
                            <SelectValue placeholder="Select item..." />
                          </SelectTrigger>
                          <SelectContent>
                            <TooltipProvider delayDuration={300}>
                              {availableItems.map((avail) => (
                                <Tooltip key={avail.id}>
                                  <TooltipTrigger asChild>
                                    <SelectItem value={avail.id}>
                                      <span className="flex items-center gap-2">
                                        <code className="font-mono text-amber-400 text-xs">
                                          {avail.sku || "---"}
                                        </code>
                                        <span className="text-slate-400">-</span>
                                        <span>{avail.name}</span>
                                      </span>
                                    </SelectItem>
                                  </TooltipTrigger>
                                  {avail.price_reference && (
                                    <TooltipContent side="right" className="max-w-xs">
                                      <p className="text-xs">
                                        <span className="text-slate-400">Price Ref: </span>
                                        <span className="text-slate-200">{avail.price_reference}</span>
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              ))}
                            </TooltipProvider>
                          </SelectContent>
                        </Select>

                        {/* [+] Create button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setPendingLineId(item.id);
                            setCreateDialogOpen(true);
                          }}
                          disabled={disabled}
                          className="border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/10"
                          title="Create new item"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                  {/* ... quantity, price, total, delete columns ... */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" onClick={onAddItem} disabled={disabled}>
          + Add Line Item
        </Button>
      </div>

      {/* Item creation dialog */}
      <ItemDialog
        open={createDialogOpen}
        onClose={handleCreateDialogClose}
        item={null}
      />
    </>
  );
}
```

### Example 3: Contact Person Validation with Scroll

```tsx
// app/(dashboard)/qmhq/new/expense/page.tsx
// Or app/(dashboard)/po/new/page.tsx

function ExpenseRouteForm() {
  const [formData, setFormData] = useState({ /* ... */ });
  const [contactPersonTouched, setContactPersonTouched] = useState(false);
  const [contactPersonError, setContactPersonError] = useState<string | null>(null);
  const contactPersonRef = useRef<HTMLDivElement>(null);

  const validateContactPerson = (): boolean => {
    if (!formData.contact_person_id) {
      setContactPersonError("Contact person is required for expense transactions");
      return false;
    }
    setContactPersonError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const isValid = validateContactPerson();

    if (!isValid) {
      // Scroll to error field
      contactPersonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      toast({
        title: "Validation Error",
        description: "Please select a contact person",
        variant: "destructive",
      });
      return;
    }

    // Submit form...
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... other fields ... */}

      <div ref={contactPersonRef} className="grid gap-2">
        <Label htmlFor="contact_person_id">
          Contact Person <span className="text-red-400">*</span>
        </Label>
        <Select
          value={formData.contact_person_id || ""}
          onValueChange={(value) => {
            setFormData({ ...formData, contact_person_id: value });
            // Re-validate if already touched
            if (contactPersonTouched) {
              validateContactPerson();
            }
          }}
          onOpenChange={(open) => {
            // Treat closing without selection as blur
            if (!open && !contactPersonTouched) {
              setContactPersonTouched(true);
              validateContactPerson();
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "bg-slate-800/50 border-slate-700",
              contactPersonError && "border-red-400"
            )}
          >
            <SelectValue placeholder="Select contact person" />
          </SelectTrigger>
          <SelectContent>
            {contactPersons.map((cp) => (
              <SelectItem key={cp.id} value={cp.id}>
                {cp.name} {cp.position && `- ${cp.position}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {contactPersonTouched && contactPersonError && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {contactPersonError}
          </p>
        )}
      </div>

      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### Example 4: Auth Provider with Tab Visibility

```tsx
// components/providers/auth-provider.tsx (additions)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const router = useRouter();

  // ... existing code ...

  // Tab visibility handling for session refresh
  useEffect(() => {
    if (!supabaseUser) return;

    let isRefreshing = false;  // Prevent re-entrancy

    const handleVisibilityChange = async () => {
      // Only act when tab becomes visible
      if (document.visibilityState !== 'visible') return;
      if (isRefreshing) return;

      isRefreshing = true;

      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // Session invalid - check for unsaved work
          const hasUnsavedWork = sessionStorage.getItem('qmhq_draft') ||
                                  sessionStorage.getItem('po_draft');

          if (hasUnsavedWork) {
            setShowSessionExpiredModal(true);
          } else {
            await signOut();
          }
        } else {
          // Session valid - update activity
          localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        isRefreshing = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseUser, signOut]);

  // Cross-tab logout sync
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('qm-auth');

      channel.onmessage = (event) => {
        if (event.data.type === 'SIGNED_OUT') {
          clearSessionMarkers();
          setUser(null);
          setSupabaseUser(null);
          router.push('/login');
        }
      };

      return () => channel.close();
    } catch (e) {
      // BroadcastChannel not supported - no cross-tab sync (Safari)
      console.log('BroadcastChannel not available');
    }
  }, [router]);

  // Enhanced signOut with broadcast
  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearSessionMarkers();
    setUser(null);
    setSupabaseUser(null);

    // Broadcast to other tabs
    try {
      const channel = new BroadcastChannel('qm-auth');
      channel.postMessage({ type: 'SIGNED_OUT' });
      channel.close();
    } catch (e) {
      // Graceful degradation
    }

    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ /* ... */ }}>
      {children}

      {/* Session expired modal */}
      <Dialog open={showSessionExpiredModal} onOpenChange={setShowSessionExpiredModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Expired</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Your session has expired and you'll need to log in again.
              Your unsaved work will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem('qmhq_draft');
                sessionStorage.removeItem('po_draft');
                setShowSessionExpiredModal(false);
                signOut();
              }}
            >
              Discard & Login
            </Button>
            <Button onClick={() => setShowSessionExpiredModal(false)}>
              Stay on Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No inline item creation | Inline creation via dialog | This phase | Faster PO entry workflow |
| Contact person optional | Required for financial routes | This phase | Better audit trail |
| Session expires in bg tabs | Silent refresh on tab focus | This phase | Fewer login interruptions |
| Manual refresh after logout | Cross-tab sync via BroadcastChannel | This phase | Consistent multi-tab UX |
| Generic validation errors | Scroll to field + inline error | This phase | Clearer error feedback |

**Session Management Evolution:**
- Supabase @supabase/ssr v0.8.0 (Dec 2024) added automatic BroadcastChannel sync for active tabs
- Inactive tabs still need manual handling via visibilitychange
- TOKEN_REFRESHED event allows detecting successful background refreshes

## Open Questions

1. **Should we limit maximum items in dropdown before requiring search?**
   - What we know: Current PO form shows all items, could be slow with 1000+ items
   - What's unclear: At what count does Select component slow down?
   - Recommendation: Start with no limit, add virtualization if performance issue reported

2. **Should BroadcastChannel fallback to localStorage events for Safari?**
   - What we know: Safari doesn't support BroadcastChannel, localStorage events work across tabs
   - What's unclear: Is the added complexity worth supporting Safari users?
   - Recommendation: Start without fallback (graceful degradation), add if Safari users complain

3. **Should session refresh happen on every tab focus or only after inactivity?**
   - What we know: Checking on every focus is safest but adds API calls
   - What's unclear: Performance impact of frequent getSession calls
   - Recommendation: Check on every focus (Supabase caches internally, minimal overhead)

## Sources

### Primary (HIGH confidence)
- Codebase: `/components/forms/inline-create-select.tsx` - Existing inline creation pattern
- Codebase: `/app/(dashboard)/item/item-dialog.tsx` - Full item creation form
- Codebase: `/components/po/po-line-items-table.tsx` - PO line items with item selector
- Codebase: `/components/providers/auth-provider.tsx` - Current auth session management
- Codebase: `/lib/supabase/client.ts` - Supabase client setup with @supabase/ssr v0.8.0
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions) - Session refresh behavior
- [Supabase onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) - Auth event listener
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) - visibilitychange event
- [MDN BroadcastChannel](https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/) - Cross-tab messaging

### Secondary (MEDIUM confidence)
- [Supabase Multi-Tab Discussion](https://github.com/orgs/supabase/discussions/35069) - Known issues with inactive tabs
- [Supabase SSR Session Refresh](https://github.com/orgs/supabase/discussions/30465) - Auto-refresh behavior with @supabase/ssr
- [React Hook Form Scroll to Error](https://github.com/react-hook-form/react-hook-form/issues/612) - Community patterns for error scrolling
- [Creating Reusable Modal in React](https://blog.logrocket.com/creating-reusable-pop-up-modal-react/) - Dialog composition patterns
- [BroadcastChannel for Auth Sync](https://dev.to/henriqueschroeder/stop-using-localstorage-discover-the-power-of-broadcastchannel-26fe) - Cross-tab auth synchronization

### Tertiary (LOW confidence)
- WebSearch general patterns for form validation timing - Not specific to this stack

## Metadata

**Confidence breakdown:**
- Inline creation pattern: HIGH - Existing InlineCreateSelect proves pattern works
- Contact person validation: HIGH - Standard React pattern, simple implementation
- Multi-tab session handling: HIGH - Supabase docs + Page Visibility API are authoritative
- Cross-tab sync: MEDIUM - BroadcastChannel works but Safari limitation is real concern

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain, APIs unlikely to change)
