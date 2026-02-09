# Stack Research: Stock-Out Approval, Deletion Protection, Context Sliders

**Research Date:** 2026-02-09
**Milestone:** v1.6 Inventory Workflow & Protection
**Confidence:** HIGH

## Summary

All three features require **ZERO new dependencies**. The existing QM System stack (Next.js 14, Supabase PostgreSQL, Radix UI, Tailwind CSS) already provides all necessary capabilities:

- **Stock-out approval workflow** → Extend existing status_config table + reuse `update_status_with_note()` RPC
- **Entity deletion protection** → Native PostgreSQL FK constraints with `RESTRICT` + validation RPC
- **Context side slider** → Proven pattern exists in `QmrlContextPanel` component (640 lines)

**Recommendation:** NO npm installs. Use existing patterns. Focus on database migrations and component extraction.

---

## Core Stack (No Changes)

### Framework & Runtime
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| Next.js | 14.2.13 | ✓ Keep | App Router, Server Components, Server Actions |
| React | 18.3.1 | ✓ Keep | Client components for interactivity |
| TypeScript | 5.6.2 | ✓ Keep | Strict mode enabled |

### Database & Backend
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| PostgreSQL | via Supabase | ✓ Keep | 52 migrations, triggers, RLS policies, audit system |
| Supabase JS | 2.50.0 | ✓ Keep | Auth, database client, RPC functions, RLS |
| @supabase/ssr | 0.8.0 | ✓ Keep | Server-side rendering integration |

### UI & Styling
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| Tailwind CSS | 3.4.13 | ✓ Keep | Animations, transitions, responsive utilities |
| Radix UI | Multiple (^1.x-2.x) | ✓ Keep | Dialog, Toast, Popover, Tabs |
| lucide-react | 0.447.0 | ✓ Keep | Icon library |

### Forms & Validation
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| react-hook-form | 7.53.0 | ✓ Keep | Form state management |
| @hookform/resolvers | 3.9.0 | ✓ Keep | Zod integration |
| Zod | 3.23.8 | ✓ Keep | Schema validation, type inference |
| react-number-format | 5.4.4 | ✓ Keep | Already used for currency/number inputs |

---

## Feature-Specific Stack Decisions

### 1. Stock-Out Approval Workflow

**Requirement:** Multi-step workflow with Draft → Pending → Approved/Rejected → Fulfilled states, approval/rejection with notes, audit trail.

**Solution:** Extend existing status_config system (NO new libraries)

#### Why Existing Stack Covers This

**Status System (Already Implemented):**
- File: `/supabase/migrations/003_status_config.sql`
- Table: `status_config` with `entity_type` ENUM, `status_group` ENUM
- Existing entity types: `qmrl`, `qmhq`
- **Action:** Add `stock_out` to entity_type ENUM

**Status Transition RPC (Already Implemented):**
- File: `/supabase/migrations/048_status_update_with_note.sql`
- Function: `update_status_with_note(entity_type, entity_id, new_status_id, note, user_id)`
- Features:
  - Atomic transaction (status update + audit entry)
  - Deduplication to prevent duplicate audit logs
  - Optional note parameter (required for rejection)
- **Action:** Works with any entity_type, including new `stock_out`

**Audit System (Already Implemented):**
- File: `/supabase/migrations/048_status_update_with_note.sql` (lines 106-412)
- Function: `create_audit_log()` trigger
- Automatic tracking:
  - Status changes with human-readable summaries
  - Approval actions (checks `approval_status` field)
  - Assignment changes
  - Soft deletes, voids
- **Action:** Add trigger to `stock_out_requests` table

#### Database Architecture

```sql
-- 1. Extend entity type enum
ALTER TYPE public.entity_type ADD VALUE 'stock_out';

-- 2. Create stock_out_requests table
CREATE TABLE stock_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL, -- STOCK-OUT-YYYY-NNNNN format

  -- Inventory references
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity NUMERIC(15,2) NOT NULL CHECK (quantity > 0),

  -- Workflow fields
  status_id UUID NOT NULL REFERENCES status_config(id),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 10),
  notes TEXT,

  -- Approval tracking
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Fulfillment tracking
  fulfilled_at TIMESTAMPTZ,
  inventory_transaction_id UUID REFERENCES inventory_transactions(id),

  -- Audit fields
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  is_active BOOLEAN DEFAULT true
);

-- 3. Seed workflow statuses
INSERT INTO status_config (entity_type, status_group, name, color, is_default) VALUES
  ('stock_out', 'to_do', 'Draft', '#9CA3AF', true),
  ('stock_out', 'to_do', 'Pending Approval', '#F59E0B', false),
  ('stock_out', 'in_progress', 'Approved', '#10B981', false),
  ('stock_out', 'done', 'Fulfilled', '#10B981', false),
  ('stock_out', 'done', 'Rejected', '#EF4444', false);

-- 4. Add audit trigger (reuses existing function)
CREATE TRIGGER audit_stock_out_requests
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();
```

#### Application Layer

**Request Form (Server Component + Client Form):**
```tsx
// app/(dashboard)/inventory/stock-out/request/new/page.tsx
// Pattern: Same as QMHQ/PO creation forms

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { stockOutRequestSchema } from '@/lib/validations/stock-out';

// Zod schema
const stockOutRequestSchema = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.string().min(10),
  notes: z.string().optional(),
});
```

**Approval UI (Server Action):**
```tsx
// app/actions/stock-out.ts
'use server';

export async function approveStockOut(requestId: string, note: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use existing RPC
  const { error } = await supabase.rpc('update_status_with_note', {
    p_entity_type: 'stock_out',
    p_entity_id: requestId,
    p_new_status_id: approvedStatusId,
    p_note: note,
    p_user_id: user.id
  });

  if (!error) {
    // Update approval tracking fields
    await supabase
      .from('stock_out_requests')
      .update({
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);
  }

  revalidatePath('/inventory/stock-out');
}
```

#### Why NOT Use State Machine Libraries

| Library | Why Not |
|---------|---------|
| **XState** | Client-side complexity, requires state serialization to DB, overkill for linear workflow |
| **Robot** | Same issues as XState, adds dependency for simple state transitions |
| **Custom FSM library** | PostgreSQL CHECK constraints + status_config table already implement state machine semantics |

**Existing pattern is superior:**
- Database-level state enforcement (CHECK constraints)
- Audit trail built-in (trigger system)
- Works with Server Components (no client-side state sync)
- Proven in production (QMRL/QMHQ use same pattern)

---

### 2. Entity Deletion Protection

**Requirement:** Prevent deletion of items/warehouses/suppliers if referenced by POs/invoices/transactions. Show user-friendly warning before attempting delete.

**Solution:** PostgreSQL FK constraints with `RESTRICT` + pre-delete validation RPC (NO new libraries)

#### Why Existing Stack Covers This

**Native PostgreSQL Foreign Key Constraints:**
- Standard SQL feature, zero dependencies
- Atomic enforcement (can't be bypassed)
- Error code `23503` for FK violations (standard)
- **Current issue:** Some FK constraints use `CASCADE` inappropriately

**Example of Current Problematic Pattern:**
```sql
-- From migration 011_qmhq.sql
qmrl_id UUID NOT NULL REFERENCES qmrl(id) ON DELETE CASCADE
```
This is **correct** for QMHQ (child record should cascade when parent deleted).

**But for master data, CASCADE is wrong:**
```sql
-- If this exists, it would be problematic
item_id UUID REFERENCES items(id) ON DELETE CASCADE
-- ^ Deleting an item would delete all PO line items (data loss!)
```

#### Database Architecture

**Step 1: Audit Current FK Constraints**
```sql
-- Find all CASCADE constraints on master data
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
  AND ccu.table_name IN ('items', 'warehouses', 'suppliers', 'contact_persons');
```

**Step 2: Change to RESTRICT**
```sql
-- Example: Protect items from deletion if in PO line items
ALTER TABLE po_line_items
DROP CONSTRAINT po_line_items_item_id_fkey,
ADD CONSTRAINT po_line_items_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES items(id)
  ON DELETE RESTRICT;

-- Repeat for all master data FK references
```

**Step 3: Pre-Delete Validation RPC**
```sql
-- Check if entity has references before attempting delete
CREATE OR REPLACE FUNCTION check_entity_references(
  p_entity_type TEXT,
  p_entity_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_references JSONB := '[]'::JSONB;
  v_count INTEGER;
BEGIN
  -- Check based on entity type
  IF p_entity_type = 'item' THEN
    -- Check PO line items
    SELECT COUNT(*) INTO v_count
    FROM po_line_items
    WHERE item_id = p_entity_id AND is_active = true;

    IF v_count > 0 THEN
      v_references := v_references || jsonb_build_object(
        'table', 'Purchase Orders',
        'count', v_count,
        'type', 'po_line'
      );
    END IF;

    -- Check inventory transactions
    SELECT COUNT(*) INTO v_count
    FROM inventory_transactions
    WHERE item_id = p_entity_id;

    IF v_count > 0 THEN
      v_references := v_references || jsonb_build_object(
        'table', 'Inventory Transactions',
        'count', v_count,
        'type', 'inventory'
      );
    END IF;

    -- Check QMHQ item routes
    SELECT COUNT(*) INTO v_count
    FROM qmhq
    WHERE route_type = 'item' AND item_id = p_entity_id AND is_active = true;

    IF v_count > 0 THEN
      v_references := v_references || jsonb_build_object(
        'table', 'QMHQ Lines',
        'count', v_count,
        'type', 'qmhq'
      );
    END IF;
  END IF;

  -- Similar checks for warehouse, supplier, etc.

  RETURN jsonb_build_object(
    'has_references', jsonb_array_length(v_references) > 0,
    'references', v_references
  );
END;
$$;
```

#### Application Layer

**Delete Button with Pre-Flight Check:**
```tsx
// components/items/delete-item-dialog.tsx
'use client';

export function DeleteItemDialog({ itemId }: { itemId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [references, setReferences] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkReferences = async () => {
    setIsChecking(true);
    const supabase = createClient();

    const { data } = await supabase.rpc('check_entity_references', {
      p_entity_type: 'item',
      p_entity_id: itemId
    });

    setReferences(data);
    setIsChecking(false);
  };

  useEffect(() => {
    if (isOpen) checkReferences();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </DialogTrigger>
      <DialogContent>
        {isChecking ? (
          <p>Checking references...</p>
        ) : references?.has_references ? (
          <>
            <DialogTitle>Cannot Delete Item</DialogTitle>
            <DialogDescription>
              This item is referenced by:
              {references.references.map((ref: any) => (
                <div key={ref.table}>
                  {ref.table}: {ref.count} records
                </div>
              ))}
            </DialogDescription>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </>
        ) : (
          <>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone.
            </DialogDescription>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Server Action with Graceful Error Handling:**
```tsx
'use server';

export async function deleteItem(itemId: string) {
  const supabase = createServerClient();

  // Pre-flight check
  const { data: checkResult } = await supabase.rpc('check_entity_references', {
    p_entity_type: 'item',
    p_entity_id: itemId
  });

  if (checkResult?.has_references) {
    return {
      success: false,
      error: 'Item has references',
      details: checkResult.references
    };
  }

  // Attempt soft delete
  const { error } = await supabase
    .from('items')
    .update({ is_active: false })
    .eq('id', itemId);

  if (error) {
    // Check if FK constraint violation (race condition)
    if (error.code === '23503') {
      return {
        success: false,
        error: 'Item is now referenced by other records'
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/item');
  return { success: true };
}
```

#### Why NOT Use ORM Delete Hooks

| Approach | Why Not |
|----------|---------|
| **Prisma beforeDelete hook** | Not using Prisma ORM, Supabase client doesn't have hooks |
| **Drizzle onDelete callbacks** | Not using Drizzle ORM |
| **Application-level cascade logic** | Race conditions, not atomic, database constraints more reliable |

**Database-level enforcement is superior:**
- Atomic and reliable (can't have race conditions)
- Works even if accessed via SQL console or other tools
- Pre-flight RPC provides user-friendly warnings
- Fallback to constraint error if RPC check missed something

---

### 3. Context Side Slider

**Requirement:** Collapsible side panel (default open on desktop), right-side slider for contextual information.

**Solution:** Extract pattern from existing `QmrlContextPanel` component (NO new libraries)

#### Why Existing Stack Covers This

**Existing Component Analysis:**
- File: `/components/qmhq/qmrl-context-panel.tsx`
- Lines: 640
- Status: Production-ready, proven pattern

**Proven Capabilities:**
```tsx
// State management
const [isPanelOpen, setIsPanelOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768; // Default open on desktop
  }
  return true;
});

// Responsive behavior
// Desktop: Always visible (md:block md:relative md:translate-x-0)
// Mobile: Slide-in drawer with backdrop
<div className={cn(
  'md:block md:relative md:translate-x-0',
  'fixed inset-y-0 right-0 z-50',
  'transform transition-transform duration-300 ease-in-out',
  isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
)}>

// Scroll management
useEffect(() => {
  if (isOpen && window.innerWidth < 768) {
    document.body.style.overflow = 'hidden'; // Lock body scroll on mobile
  } else {
    document.body.style.overflow = 'auto';
  }
}, [isOpen]);
```

**Features Already Implemented:**
- ✓ Smooth slide animation (Tailwind `transition-transform duration-300`)
- ✓ Mobile backdrop with blur (`bg-black/60 backdrop-blur-sm`)
- ✓ Floating toggle button on mobile
- ✓ Close button (mobile only)
- ✓ Collapsible content sections (description, notes with "Show more/less")
- ✓ Responsive width (`w-80 md:w-80 lg:w-96`)
- ✓ Sticky header
- ✓ Scrollable content area

#### Component Architecture

**Step 1: Extract Reusable Container**
```tsx
// components/layout/context-slider.tsx
interface ContextSliderProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean; // Default: true for desktop
}

export function ContextSlider({
  isOpen,
  onToggle,
  title,
  icon: Icon,
  children,
  defaultOpen = true
}: ContextSliderProps) {
  // Same logic as QmrlContextPanel
  // - Mobile backdrop
  // - Floating toggle button
  // - Smooth animations
  // - Body scroll lock
}
```

**Step 2: Create Content Components**
```tsx
// components/inventory/stock-out-context.tsx
interface StockOutContextProps {
  itemId: string | null;
  warehouseId: string | null;
}

export function StockOutContext({ itemId, warehouseId }: StockOutContextProps) {
  const [item, setItem] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const [stockLevel, setStockLevel] = useState(null);

  useEffect(() => {
    if (!itemId || !warehouseId) return;

    // Fetch item details, warehouse info, stock levels
    // Display: Item info, WAC, current stock, transaction history
  }, [itemId, warehouseId]);

  return (
    <div className="space-y-4">
      {/* Item info section */}
      {/* Warehouse stock section */}
      {/* Recent transactions section */}
    </div>
  );
}
```

**Step 3: Integration in Forms**
```tsx
// app/(dashboard)/inventory/stock-out/request/new/page.tsx
'use client';

export default function NewStockOutRequestPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 768;
  });

  const [formData, setFormData] = useState({
    item_id: null,
    warehouse_id: null,
    quantity: 0,
    reason: ''
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_384px] gap-0 h-[calc(100vh-4rem)]">
      {/* Form content */}
      <div className="overflow-y-auto p-6">
        <form>
          <ItemSelect
            value={formData.item_id}
            onChange={(id) => setFormData(prev => ({ ...prev, item_id: id }))}
          />
          <WarehouseSelect
            value={formData.warehouse_id}
            onChange={(id) => setFormData(prev => ({ ...prev, warehouse_id: id }))}
          />
        </form>
      </div>

      {/* Context slider */}
      <ContextSlider
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(prev => !prev)}
        title="Stock Context"
        icon={Package}
      >
        <StockOutContext
          itemId={formData.item_id}
          warehouseId={formData.warehouse_id}
        />
      </ContextSlider>
    </div>
  );
}
```

#### CSS Pattern (Tailwind Classes)

```tsx
// Key classes from QmrlContextPanel
const sliderClasses = cn(
  // Desktop: visible in grid, relative positioning
  'md:block md:relative md:translate-x-0',

  // Mobile: fixed slide-in from right
  'fixed inset-y-0 right-0 z-50',

  // Width
  'w-80 md:w-80 lg:w-96',

  // Smooth animation
  'transform transition-transform duration-300 ease-in-out',
  isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0',

  // Styling
  'border-l border-slate-700 bg-slate-900',
  'overflow-hidden flex flex-col'
);

const backdropClasses = cn(
  'md:hidden fixed inset-0 z-40',
  'bg-black/60 backdrop-blur-sm'
);

const toggleButtonClasses = cn(
  'md:hidden fixed bottom-4 right-4 z-40',
  'flex items-center gap-2 rounded-full',
  'bg-gradient-to-r from-amber-600 to-amber-500',
  'px-4 py-3 shadow-lg',
  'hover:from-amber-500 hover:to-amber-400',
  'transition-all duration-200'
);
```

#### State Persistence Decision

**NO sessionStorage/localStorage:**
- Matches existing QMHQ creation pattern
- Panel state resets between pages (intentional)
- Simpler UX: users know what to expect

**Rationale from milestone context:**
```tsx
// From QmrlContextPanel (lines 76-82)
const [isPanelOpen, setIsPanelOpen] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth >= 768; // Open on desktop, closed on mobile
  }
  return true;
});
// No sessionStorage - resets per step per user decision
```

#### Why NOT Use Third-Party Slider Libraries

| Library | Why Not |
|---------|---------|
| **Headless UI Slide Over** | Already have Radix UI primitives, custom solution more flexible |
| **Radix UI Sheet** | Doesn't exist yet (no Sheet primitive in Radix UI) |
| **Framer Motion** | Overkill for simple slide animation, Tailwind transitions sufficient |
| **React Spring** | Complex API for simple use case |
| **Custom slider libraries** | Existing QmrlContextPanel already solves problem perfectly |

**Existing pattern is superior:**
- Zero dependencies
- Proven in production (QMHQ creation workflow)
- Exact UX needed (default open on desktop)
- Tailwind animations are smooth enough
- Full control over behavior

---

## Integration Points with Existing Stack

### 1. Status System Integration

**Existing Infrastructure:**
```sql
-- status_config table (migration 003)
CREATE TABLE status_config (
  entity_type public.entity_type, -- ENUM: 'qmrl', 'qmhq'
  status_group public.status_group, -- ENUM: 'to_do', 'in_progress', 'done'
  name TEXT,
  color TEXT,
  is_default BOOLEAN
);
```

**Extension for Stock-Out:**
```sql
-- 1. Add new entity type
ALTER TYPE public.entity_type ADD VALUE 'stock_out';

-- 2. Insert workflow statuses
INSERT INTO status_config (entity_type, status_group, name, color, is_default) VALUES
  ('stock_out', 'to_do', 'Draft', '#9CA3AF', true),
  ('stock_out', 'to_do', 'Pending Approval', '#F59E0B', false),
  ('stock_out', 'in_progress', 'Approved', '#10B981', false),
  ('stock_out', 'done', 'Fulfilled', '#10B981', false),
  ('stock_out', 'done', 'Rejected', '#EF4444', false);

-- 3. Workflow works with existing RPC
SELECT update_status_with_note(
  'stock_out',
  request_id,
  approved_status_id,
  'Approved for warehouse transfer',
  user_id
);
```

### 2. Audit System Integration

**Existing Trigger Function:**
```sql
-- From migration 048 (lines 106-412)
CREATE FUNCTION create_audit_log() RETURNS TRIGGER;
-- Handles: create, update, delete, status_change, void, approval, etc.
```

**Add to New Table:**
```sql
-- Single line addition
CREATE TRIGGER audit_stock_out_requests
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();
```

**Audit Entries Automatically Captured:**
- Status changes (Draft → Pending → Approved → Fulfilled)
- Assignment changes
- Soft deletes (is_active = false)
- All field updates with old/new values

### 3. RLS Policies

**Existing Pattern:**
```sql
-- QMRL policies (role-based)
CREATE POLICY "Inventory can view all"
  ON qmrl FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'quartermaster', 'inventory')
    )
  );
```

**Apply to Stock-Out:**
```sql
-- Enable RLS
ALTER TABLE stock_out_requests ENABLE ROW LEVEL SECURITY;

-- Inventory role can CRUD stock-out requests
CREATE POLICY "Inventory can manage stock-out requests"
  ON stock_out_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('inventory', 'admin', 'quartermaster')
    )
  );

-- Others can view own requests
CREATE POLICY "Users can view own stock-out requests"
  ON stock_out_requests FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
```

### 4. Toast Notifications

**Existing System:**
```tsx
// Already installed: @radix-ui/react-toast
// Component: components/ui/toast.tsx
// Hook: components/ui/use-toast.ts

// Usage in Server Actions
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: 'Stock-out request approved',
  description: 'Inventory transaction created',
  variant: 'success'
});

toast({
  title: 'Cannot delete item',
  description: 'Item is referenced by 3 purchase orders',
  variant: 'destructive'
});
```

**Existing Variants:**
- `default` - Neutral notification
- `success` - Green, for confirmations
- `destructive` - Red, for errors/warnings
- Supports actions (undo buttons)

---

## What NOT to Add

### State Management Libraries
| Library | Why Not Needed |
|---------|---------------|
| **Zustand** | Status state lives in database, no global client state required |
| **Redux Toolkit** | Server Components + Server Actions sufficient, database is source of truth |
| **XState** | Status_config table + PostgreSQL constraints already implement state machine |
| **Jotai/Recoil** | Form state handled by react-hook-form, no atom-based state needed |

### UI Component Libraries (Additional)
| Library | Why Not Needed |
|---------|---------------|
| **Headless UI** | Radix UI already provides Dialog, Popover, Toast |
| **Mantine** | Full component library, conflicts with existing Tailwind + Radix pattern |
| **Ant Design** | Opinionated UI, doesn't fit dark theme aesthetic |
| **Material UI** | Heavy bundle, unnecessary when Radix + Tailwind already in use |

### Animation Libraries
| Library | Why Not Needed |
|---------|---------------|
| **Framer Motion** | Tailwind transitions sufficient for slide animations |
| **React Spring** | No complex physics-based animations required |
| **GSAP** | Overkill for simple UI transitions |

### ORM Libraries
| Library | Why Not Needed |
|---------|---------------|
| **Prisma** | Supabase client already provides type-safe queries |
| **Drizzle** | Not needed, direct SQL migrations work well |
| **TypeORM** | Supabase JS client sufficient |

---

## Recommended File Structure

### New Files to Create

```
/lib
  /workflows
    stock-out-workflow.ts              # Workflow state definitions, helpers
  /database
    deletion-checks.ts                 # Pre-delete reference checking helpers

/components
  /layout
    context-slider.tsx                 # Reusable slider container (extracted pattern)
  /inventory
    stock-out-request-form.tsx         # Request creation form
    stock-out-approval-ui.tsx          # Approval/rejection interface
    stock-out-context.tsx              # Context slider content
    item-context.tsx                   # Item details panel
    warehouse-stock-context.tsx        # Warehouse stock levels panel
  /items
    delete-item-dialog.tsx             # Delete with reference checking
  /warehouses
    delete-warehouse-dialog.tsx        # Delete with reference checking

/app/(dashboard)
  /inventory
    /stock-out
      /request
        new/page.tsx                   # Create stock-out request
        [id]/page.tsx                  # View request details
      /approve
        page.tsx                       # List pending requests
        [id]/page.tsx                  # Approve/reject request

/app/actions
  stock-out.ts                         # Server actions for workflow
  deletion.ts                          # Server actions for delete checks

/lib/validations
  stock-out.ts                         # Zod schemas

/supabase/migrations
  0XX_stock_out_requests.sql           # Main table + indexes
  0XX_stock_out_status_config.sql      # Status workflow entries
  0XX_fk_constraint_audit.sql          # Change CASCADE to RESTRICT
  0XX_deletion_protection_rpc.sql      # check_entity_references()
```

---

## Development Workflow

### Phase 1: Database Schema (Day 1)

```bash
# Create migrations
npx supabase migration new stock_out_requests
npx supabase migration new stock_out_status_config
npx supabase migration new fk_constraint_audit
npx supabase migration new deletion_protection_rpc

# Apply locally
npx supabase db reset

# Generate TypeScript types
npx supabase gen types typescript --local > types/database.ts
```

### Phase 2: Deletion Protection (Day 2)

```sql
-- 1. Audit all CASCADE constraints
-- 2. Change to RESTRICT for master data
-- 3. Create check_entity_references() RPC
-- 4. Test with existing data
```

```tsx
// 5. Create delete dialog component
// 6. Create server action with error handling
// 7. Add to items/warehouses/suppliers pages
```

### Phase 3: Context Slider Component (Day 3)

```tsx
// 1. Extract ContextSlider from QmrlContextPanel
// 2. Create StockOutContext content component
// 3. Create ItemContext component
// 4. Test responsive behavior (desktop + mobile)
```

### Phase 4: Stock-Out Workflow (Days 4-5)

```tsx
// 1. Create request form with context slider
// 2. Create approval list page
// 3. Create approval/rejection UI
// 4. Integrate with inventory_transactions
// 5. Add RLS policies
// 6. Add tests
```

---

## Type Safety

All features leverage existing TypeScript setup:

```typescript
// types/database.ts (extend existing)

export interface StockOutRequest {
  id: string;
  request_id: string; // STOCK-OUT-YYYY-NNNNN
  item_id: string;
  warehouse_id: string;
  quantity: number;
  reason: string;
  notes: string | null;
  status_id: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  fulfilled_at: string | null;
  inventory_transaction_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// lib/validations/stock-out.ts

import { z } from 'zod';

export const stockOutRequestSchema = z.object({
  item_id: z.string().uuid('Invalid item'),
  warehouse_id: z.string().uuid('Invalid warehouse'),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  notes: z.string().optional(),
});

export type StockOutRequestInput = z.infer<typeof stockOutRequestSchema>;

export const stockOutApprovalSchema = z.object({
  request_id: z.string().uuid(),
  note: z.string().min(10, 'Approval note must be at least 10 characters'),
});

export const stockOutRejectionSchema = z.object({
  request_id: z.string().uuid(),
  reason: z.string().min(20, 'Rejection reason must be at least 20 characters'),
});
```

---

## Performance Considerations

### Database Indexes

```sql
-- Stock-out requests
CREATE INDEX idx_stock_out_requests_status
  ON stock_out_requests(status_id, created_at DESC);

CREATE INDEX idx_stock_out_requests_item
  ON stock_out_requests(item_id) WHERE is_active = true;

CREATE INDEX idx_stock_out_requests_warehouse
  ON stock_out_requests(warehouse_id) WHERE is_active = true;

-- Reference lookup (for deletion checks)
CREATE INDEX idx_po_line_items_item_lookup
  ON po_line_items(item_id) WHERE is_active = true;

CREATE INDEX idx_inventory_transactions_item
  ON inventory_transactions(item_id);

CREATE INDEX idx_qmhq_item_lookup
  ON qmhq(item_id) WHERE route_type = 'item' AND is_active = true;
```

### Query Patterns

**Server Component (list page):**
```tsx
async function StockOutRequestsPage() {
  const supabase = createServerClient();

  // Single query with joins
  const { data: requests } = await supabase
    .from('stock_out_requests')
    .select(`
      *,
      status:status_config(name, color),
      item:items(name, sku),
      warehouse:warehouses(name),
      created_by_user:users!created_by(full_name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return <RequestsList requests={requests} />;
}
```

**Context Slider (client component with data props):**
```tsx
// Parent passes data as props
<ContextSlider>
  <StockOutContext item={item} warehouse={warehouse} stockLevel={stockLevel} />
</ContextSlider>

// No additional queries inside slider component
// Data fetched once by parent, passed down
```

### Caching Strategy

- **Use Next.js revalidatePath()** after mutations
- **No client-side caching** (database is source of truth)
- **Server Components** for read-heavy pages
- **Server Actions** for mutations

```tsx
// Server Action
export async function approveStockOut(requestId: string) {
  'use server';

  // ... approval logic

  // Revalidate affected pages
  revalidatePath('/inventory/stock-out');
  revalidatePath('/inventory/stock-out/approve');
  revalidatePath(`/inventory/stock-out/request/${requestId}`);
}
```

---

## Testing Strategy

### Database Layer Tests

```sql
-- Test 1: Deletion protection
BEGIN;
  INSERT INTO items (name, sku) VALUES ('Test Item', 'TEST-001');
  INSERT INTO po_line_items (po_id, item_id, quantity)
    VALUES (test_po_id, test_item_id, 10);

  -- Should fail with FK violation
  DELETE FROM items WHERE id = test_item_id;
  -- Expected: ERROR: update or delete on table "items" violates foreign key constraint
ROLLBACK;

-- Test 2: Status workflow
BEGIN;
  INSERT INTO stock_out_requests (item_id, warehouse_id, quantity, status_id)
    VALUES (item_id, warehouse_id, 10, draft_status_id);

  -- Change to pending
  UPDATE stock_out_requests SET status_id = pending_status_id;

  -- Check audit log created
  SELECT * FROM audit_logs
  WHERE entity_type = 'stock_out'
    AND action = 'status_change';
ROLLBACK;
```

### Application Layer Tests

```typescript
describe('Stock-Out Workflow', () => {
  it('prevents invalid status transitions', async () => {
    // Test status validation
  });

  it('requires note for rejection', async () => {
    // Test rejection validation
  });

  it('creates inventory transaction on fulfillment', async () => {
    // Test inventory integration
  });
});

describe('Deletion Protection', () => {
  it('prevents deletion of referenced item', async () => {
    // Test FK constraint
  });

  it('shows friendly warning with reference counts', async () => {
    // Test pre-flight check
  });

  it('allows deletion of unreferenced item', async () => {
    // Test successful soft delete
  });
});

describe('Context Slider', () => {
  it('opens by default on desktop', () => {
    // Test responsive behavior
  });

  it('shows floating button on mobile', () => {
    // Test mobile UX
  });

  it('locks body scroll when open on mobile', () => {
    // Test scroll management
  });
});
```

---

## Security Considerations

### RLS Policies

```sql
-- Enable RLS on new table
ALTER TABLE stock_out_requests ENABLE ROW LEVEL SECURITY;

-- Inventory role can CRUD all requests
CREATE POLICY "Inventory full access"
  ON stock_out_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('inventory', 'admin', 'quartermaster')
    )
  );

-- Requesters can view own
CREATE POLICY "Users view own"
  ON stock_out_requests FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
```

### Server Actions

```typescript
export async function approveStockOut(requestId: string, note: string) {
  'use server';

  // 1. Authenticate
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 2. Authorize
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!['inventory', 'admin', 'quartermaster'].includes(userProfile.role)) {
    throw new Error('Insufficient permissions');
  }

  // 3. Execute with SECURITY DEFINER RPC (prevents RLS bypass)
  const { error } = await supabase.rpc('update_status_with_note', {
    p_entity_type: 'stock_out',
    p_entity_id: requestId,
    p_new_status_id: approvedStatusId,
    p_note: note,
    p_user_id: user.id
  });

  // 4. Revalidate
  revalidatePath('/inventory/stock-out');
}
```

---

## Confidence Assessment

| Feature | Confidence | Rationale |
|---------|------------|-----------|
| **Stock-out workflow** | HIGH | Existing RPC (`update_status_with_note`) proven in QMRL/QMHQ, 52 migrations show stability |
| **Deletion protection** | HIGH | Native PostgreSQL FK constraints, standard SQL approach, error code 23503 well-documented |
| **Context slider** | HIGH | 640-line `QmrlContextPanel` component already implements exact pattern needed |
| **Form handling** | HIGH | react-hook-form + Zod used throughout 37,410-line codebase |
| **Audit logging** | HIGH | Existing trigger system handles all entity types, deduplication logic proven |
| **RLS policies** | MEDIUM | Pattern is clear from existing tables, requires careful permission testing |
| **Integration** | HIGH | All features extend existing patterns, no paradigm shifts |

**Overall confidence:** HIGH

Zero new dependencies required. All features leverage existing, battle-tested stack components. Integration points are well-defined. Risk is minimal.

---

## Sources

**Codebase Analysis (PRIMARY):**
- `/components/qmhq/qmrl-context-panel.tsx` - Side panel pattern (640 lines)
- `/supabase/migrations/048_status_update_with_note.sql` - Status workflow RPC (412 lines)
- `/supabase/migrations/003_status_config.sql` - Status system architecture (100 lines)
- `/supabase/migrations/011_qmhq.sql` - FK constraint patterns
- `/package.json` - Dependency versions (Next.js 14.2.13, React 18.3.1, Supabase 2.50.0)
- `/CLAUDE.md` - Architecture patterns, component structure

**PostgreSQL Documentation:**
- Foreign key constraints with ON DELETE RESTRICT (standard SQL-92)
- Error code 23503: foreign_key_violation
- CHECK constraints for state validation
- Trigger functions for audit logging

**Next.js Documentation:**
- Server Components for data fetching
- Server Actions for mutations
- `revalidatePath()` for cache invalidation
- App Router patterns

**Tailwind CSS:**
- Transition utilities for animations
- Responsive design (mobile-first)
- Transform utilities for slide effects

---

## Final Recommendation

**DO NOT install any new npm packages.**

All three features are fully achievable with the existing QM System stack:

1. **Stock-out approval workflow**
   - Extend `status_config` table with `stock_out` entity type
   - Reuse `update_status_with_note()` RPC for transactions
   - Follow QMRL/QMHQ form patterns

2. **Entity deletion protection**
   - Change FK constraints from `CASCADE` to `RESTRICT`
   - Create `check_entity_references()` RPC for pre-flight checks
   - Use existing Dialog + Toast components for warnings

3. **Context side slider**
   - Extract pattern from `QmrlContextPanel` (640 lines)
   - Create reusable `ContextSlider` container component
   - Use Tailwind transitions (no Framer Motion needed)

**Benefits of this approach:**
- Zero bundle size increase
- No additional maintenance burden
- Consistent patterns across codebase
- Faster development (familiar patterns)
- Lower risk (battle-tested components)

This assessment prioritizes architectural patterns and existing capabilities over adding new dependencies, ensuring long-term maintainability and consistency with the established QM System architecture.
