# QM System — Product Requirements Document (PRD) V1

**Version:** 1.7  
**Date:** 2025-01-21  
**Owner:** Product Team  
**Status:** Draft  

---

## 1. Overview

The QM System is an internal ticket, expense, and inventory management platform. It serves as a **Single Source of Truth (SSOT)** for all request-to-fulfillment workflows across departments.

**V1 Focus:** Establish the complete request-to-fulfillment workflow including expense handling, inventory management with WAC valuation, purchase orders with smart status lifecycle, and invoices with partial invoicing support.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Authentication** | Supabase Auth (Email OTP / Magic Link) |
| **Database** | Supabase PostgreSQL |
| **Authorization** | Supabase RLS (Row Level Security) + Custom RBAC |
| **Backend** | Supabase Edge Functions |
| **Frontend** | Next.js / React |
| **Deployment** | Vercel |

### Financial Display Standard

| Rule | Description |
|------|-------------|
| **Decimal Precision** | All financial amounts use 2 decimals (DECIMAL(15,2)) |
| **EUSD Display** | EUSD equivalent shown wherever financial amounts appear |
| **Exchange Rate** | 4 decimals for calculation accuracy |

---

## 2. Goals & Objectives

### Primary Goals

| Goal | Description |
|------|-------------|
| **Secure Authentication** | Email OTP login with admin-controlled user provisioning |
| **Role-Based Access** | Users see and act only on data permitted by their role |
| **Single Status System** | Notion-style status with grouping (to_do, in_progress, done) |
| **Smart PO Lifecycle** | Auto-calculated PO status based on invoice and inventory matching |
| **Partial Invoicing** | Support multiple invoices per PO with quantity tracking |
| **3-Way Matching** | PO ↔ Invoice ↔ Inventory In reconciliation |
| **WAC Valuation** | Weighted Average Cost tracking for inventory |
| **Flexible Views** | Card View + List View for QMHQ, PO, Invoice |

### Success Criteria for V1

- All entities have functional detail pages with proper relationships
- Complete expense route: Money In/Out tracking with EUSD calculations
- Complete item route: Inventory Out with warehouse availability
- PO → Invoice → Inventory In flow with quantity tracking
- Smart PO status auto-updates based on fulfillment progress
- Void functionality for invoices (no hard delete)
- WAC valuation displayed for inventory items
- EUSD shown on all financial displays

---

## 3. Key Features for MVP

### 3.1 Authentication & User Management

#### 3.1.1 Email OTP Login

| ID | Requirement | Type |
|----|-------------|------|
| AUTH-01 | User enters email on login page | Functional |
| AUTH-02 | System sends OTP/magic link via Supabase Auth | Functional |
| AUTH-03 | Only pre-created users can log in | Security |
| AUTH-04 | Unknown emails show "Contact administrator" | UX |

#### 3.1.2 Role-Based Access Control (RBAC)

**Roles:**

| Role | Code | Description |
|------|------|-------------|
| **Admin** | `admin` | Full system access, user management |
| **Quartermaster** | `quartermaster` | Approve requests, view all, manage inventory |
| **Finance** | `finance` | Financial transactions, PO, Invoice |
| **Inventory** | `inventory` | Inventory transactions, warehouses, items |
| **Proposal** | `proposal` | Process requests, create QMHQ |
| **Frontline** | `frontline` | Validate draft requests |
| **Requester** | `requester` | Create requests, view own only |

**Permission Matrix:**

| Resource | Admin | Quartermaster | Finance | Inventory | Proposal | Frontline | Requester |
|----------|-------|---------------|---------|-----------|----------|-----------|-----------|
| Users | CRUD | R | - | - | - | - | - |
| QMRL | CRUD | CRUD | R | R | RU | RU | CR (own) |
| QMHQ | CRUD | CRUD | RU | RU | CRUD | R | R (own) |
| Financial Trans. | CRUD | R | CRUD | R | R | - | - |
| Inventory Trans. | CRUD | CRUD | R | CRUD | R | - | - |
| POs | CRUD | CRUD | CRUD | R | CRUD | - | - |
| Invoices | CRUD | CRUD | CRUD | RU | R | - | - |
| Items | CRUD | CRUD | R | CRUD | R | R | R |
| Warehouses | CRUD | CRUD | R | CRUD | R | - | - |
| Suppliers | CRUD | CRUD | CRUD | R | CRUD | R | R |
| Contact Persons | CRUD | CRUD | R | R | CRUD | CRUD | R |

---

### 3.2 Status System (Single Status - Notion Style)

Both QMRL and QMHQ use a **single status system** similar to Notion Database Status column:

| Field | Description | Control |
|-------|-------------|---------|
| **Status** | Workflow state with visual grouping | User selectable, user-creatable |
| **Category** | Classification/grouping | User selectable, user-creatable |
| **Assigned To** | Current responsible user | User selectable |

#### 3.2.1 Status Configuration (User-Creatable)

```sql
CREATE TABLE status_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  status_group TEXT NOT NULL CHECK (status_group IN ('to_do', 'in_progress', 'done')),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- Hex color (e.g., '#3B82F6')
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, name)
);

CREATE INDEX idx_status_config_entity ON status_config(entity_type, is_active);
```

**Default QMRL Statuses:**

| Group | Name | Default | Color |
|-------|------|---------|-------|
| to_do | Draft | ✓ | #9CA3AF |
| to_do | Pending Review | | #F59E0B |
| in_progress | Under Processing | | #3B82F6 |
| in_progress | Awaiting Approval | | #8B5CF6 |
| done | Completed | | #10B981 |
| done | Rejected | | #EF4444 |

**Default QMHQ Statuses:**

| Group | Name | Default | Color |
|-------|------|---------|-------|
| to_do | Not Started | ✓ | #9CA3AF |
| to_do | Pending | | #F59E0B |
| in_progress | Processing | | #3B82F6 |
| in_progress | Awaiting Delivery | | #8B5CF6 |
| done | Completed | | #10B981 |
| done | Cancelled | | #EF4444 |

#### 3.2.2 Categories (User-Creatable)

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, name)
);

CREATE INDEX idx_categories_entity ON categories(entity_type, is_active);
```

**Default QMRL Categories:** Operations, Logistics, Equipment, Personnel, Emergency

**Default QMHQ Categories:** Purchase, Service, Travel, Maintenance, Other

#### 3.2.3 Inline Creation UI Pattern

Both **Status** and **Category** support **inline creation** during QMRL/QMHQ creation:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Category: *                                                   [+]  │
│  [🔍 Select category...                                    ▼]       │
│                                                                     │
│  Clicking [+] expands inline form:                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Name: * [_______________]                                   │   │
│  │ Color: [🎨 #3B82F6]                                         │   │
│  │                                   [Cancel] [Create & Select] │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2.4 QMRL Single Page Creation

**Route:** `/qmrl/new`

QMRL uses categories for classification only (NOT route selection like QMHQ).

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to QMRL List                                               │
│                                                                     │
│  Create New Request Letter (QMRL)                                  │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BASIC INFORMATION                                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Title: *                                                    │   │
│  │ [Request for field equipment - Unit A                    ]  │   │
│  │                                                             │   │
│  │ Category: *                                            [+]  │   │
│  │ [Equipment ▼]  (Classification only - not route selector)   │   │
│  │                                                             │   │
│  │ Priority: *                                                 │   │
│  │ [Medium ▼]  (Low / Medium / High / Critical)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DEPARTMENT & CONTACTS                                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Department: *                                               │   │
│  │ [🔍 Search department...                           ▼]       │   │
│  │                                                             │   │
│  │ Contact Person:                                        [+]  │   │
│  │ [🔍 Search contact...                              ▼]       │   │
│  │                                                             │   │
│  │ Request Date: *                                             │   │
│  │ [2025-01-21 📅]                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ASSIGNMENT & STATUS                                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Assigned To: *                                              │   │
│  │ [🔍 Search user...                                 ▼]       │   │
│  │ (Current responsible person)                                │   │
│  │                                                             │   │
│  │ Status: *                                              [+]  │   │
│  │ [Draft ▼]                                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ DESCRIPTION                                                 │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Description:                                                │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │                                                     │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  │ Notes:                                                      │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │                                                     │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [Cancel]              [Create QMRL]    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2.5 QMHQ Two-Page Creation Flow

**Route:** `/qmhq/new?qmrl={qmrl_id}`

QMHQ creation uses a **2-page flow**:
- **Page 1:** Basic info + Route selection
- **Page 2:** Route-specific fields

#### Page 1: Basic Info & Route Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to QMRL Detail                                             │
│                                                                     │
│  Create QMHQ - Step 1 of 2: Basic Info                             │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ PARENT QMRL                                                 │   │
│  │ QMRL-2025-00001: Request for field equipment - Unit A       │   │
│  │ Category: Equipment | Department: Field Operations          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BASIC INFORMATION                                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Line Name: *                                                │   │
│  │ [Laptop procurement for Field Team A                     ]  │   │
│  │                                                             │   │
│  │ Category: *                                            [+]  │   │
│  │ [Purchase ▼]                                                │   │
│  │                                                             │   │
│  │ Contact Person:                                        [+]  │   │
│  │ [🔍 Search contact...                              ▼]       │   │
│  │                                                             │   │
│  │ Assigned To: *                                              │   │
│  │ [🔍 Search user...                                 ▼]       │   │
│  │                                                             │   │
│  │ Status: *                                              [+]  │   │
│  │ [Not Started ▼]                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SELECT ROUTE *                                              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│   │
│  │  │ 📦 ITEM ROUTE   │ │ 💵 EXPENSE      │ │ 🛒 PO ROUTE     ││   │
│  │  │                 │ │    ROUTE        │ │                 ││   │
│  │  │ Issue items     │ │ Direct expense  │ │ Purchase via PO ││   │
│  │  │ from warehouse  │ │ (Money In/Out)  │ │ (Money In → PO) ││   │
│  │  │                 │ │                 │ │                 ││   │
│  │  │ ○ Select        │ │ ○ Select        │ │ ● Selected      ││   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘│   │
│  │                                                             │   │
│  │ Selected: PO Route - Items will be purchased via PO         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ NOTES                                                       │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │                                                     │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [Cancel]              [Next →]         │
└─────────────────────────────────────────────────────────────────────┘
```

#### Page 2A: Item Route Details

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                            │
│                                                                     │
│  Create QMHQ - Step 2 of 2: Item Route Details                     │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  Route: 📦 ITEM ROUTE (Issue from Warehouse)                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ITEM SELECTION                                              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Item: *                                                     │   │
│  │ [🔍 Search item...                                 ▼]       │   │
│  │                                                             │   │
│  │ Quantity: *                                                 │   │
│  │ [10        ]                                                │   │
│  │                                                             │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │ 📦 WAREHOUSE AVAILABILITY                           │    │   │
│  │ │ Main Warehouse: 15 units                            │    │   │
│  │ │ Sub Warehouse:  8 units                             │    │   │
│  │ │ Total Available: 23 units ✓                         │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [← Back]              [Create QMHQ]    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Page 2B: Expense Route Details

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                            │
│                                                                     │
│  Create QMHQ - Step 2 of 2: Expense Route Details                  │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  Route: 💵 EXPENSE ROUTE (Direct Expense)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ EXPENSE DETAILS                                             │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Amount: *                    Exchange Rate: *               │   │
│  │ [5,000,000.00    ] MMK       [2,100.0000      ]             │   │
│  │                                                             │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │ 💵 EUSD EQUIVALENT                                  │    │   │
│  │ │ Amount: 5,000,000.00 MMK                            │    │   │
│  │ │ EUSD:   2,380.95 USD                                │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [← Back]              [Create QMHQ]    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Page 2C: PO Route Details

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                                            │
│                                                                     │
│  Create QMHQ - Step 2 of 2: PO Route Details                       │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  Route: 🛒 PO ROUTE (Purchase via PO)                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BUDGET DETAILS                                              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Budget Amount: *             Exchange Rate: *               │   │
│  │ [10,000,000.00   ] MMK       [2,100.0000      ]             │   │
│  │                                                             │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │ 💵 EUSD EQUIVALENT                                  │    │   │
│  │ │ Amount: 10,000,000.00 MMK                           │    │   │
│  │ │ EUSD:   4,761.90 USD                                │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  │                                                             │   │
│  │ ℹ️ Money In → Balance in Hand → Create PO                   │   │
│  │    PO Total cannot exceed Balance in Hand                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [← Back]              [Create QMHQ]    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2.6 QMHQ Routes Summary

| Route | Type Code | Flow | Financial Handling |
|-------|-----------|------|-------------------|
| **Item Route** | `item` | QMHQ → Inventory Out | No financial transactions |
| **Expense Route** | `expense` | QMHQ → Money In → Money Out | Direct Money In/Out |
| **PO Route** | `po` | QMHQ → Money In → PO → Invoice → Stock In | Balance in Hand → PO |

#### Balance in Hand (PO Route Only)

| Field | Calculation |
|-------|-------------|
| `amount` | Budget amount (user input) |
| `total_money_in` | SUM(Money In transactions) |
| `total_po_committed` | SUM(PO totals where status ≠ cancelled) |
| `balance_in_hand` | `total_money_in - total_po_committed` |

**PO Route Rules:**
- Money Out is **disabled** for PO Route
- PO Total cannot exceed Balance in Hand
- When PO is cancelled, balance is restored

---

### 3.3 Smart PO Status Lifecycle

#### 3.3.1 PO Status Engine

PO status is **auto-calculated** based on 3-way matching:

| Status | Condition |
|--------|-----------|
| `not_started` | No invoices or goods received |
| `partially_invoiced` | Some line items invoiced |
| `awaiting_delivery` | Fully invoiced but not fully received |
| `partially_received` | Some goods received into stock |
| `closed` | All matched: PO qty = Invoice qty = Stock-In qty |
| `cancelled` | PO has been cancelled |

#### 3.3.2 Status Calculation Logic

```
For each PO:
  total_ordered = SUM(po_line_items.quantity)
  total_invoiced = SUM(invoice_line_items.quantity) WHERE invoice.is_voided = false
  total_received = SUM(inventory_transactions.quantity) WHERE type = 'inventory_in'

  IF cancelled: status = 'cancelled'
  ELSE IF total_invoiced = 0 AND total_received = 0: status = 'not_started'
  ELSE IF total_invoiced < total_ordered: status = 'partially_invoiced'
  ELSE IF total_received = 0: status = 'awaiting_delivery'
  ELSE IF total_received < total_invoiced: status = 'partially_received'
  ELSE IF total_ordered = total_invoiced = total_received: status = 'closed'
```

#### 3.3.3 Lock Mechanism

When PO status = `closed`:
- PO becomes read-only
- Linked invoices become read-only
- **Only Admin can reopen/unlock**

---

### 3.4 Invoice Creation (NEXUS Pattern)

Based on NEXUS ID-111, Invoice creation follows a **multi-step form pattern**:

**Flow:** Header Info → PO Selection → Line Items → Summary → Submit

#### 3.4.1 Acceptance Criteria

| ID | Given | When | Then |
|----|-------|------|------|
| AC01 | User opens Create Invoice | Selects a PO | Shows PO line items with available-to-invoice qty |
| AC02 | PO line item partially invoiced | User views it | Qty reflects: `PO qty - already invoiced qty` |
| AC03 | User inputs invoice qty | Saves invoice | Validates invoiced qty ≤ available qty |
| AC04 | User enters currency/rate | Previews | Shows total in local currency AND EUSD |
| AC05 | Invoice submitted | System stores | Exchange rate stored separately from PO |
| AC06 | User inputs unit price | Views form | Shows "PO Unit Price: X" as reference |
| AC07 | Line items modified | Before submit | Real-time subtotal updates (no DB call) |
| AC08 | PO is closed | User tries to create | Invoice creation blocked |

#### 3.4.2 Multi-Step Invoice Creation

**Route:** `/invoice/new` or `/invoice/new?po={po_id}`

##### Step 1: Header Information

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Invoice - Step 1 of 4: Header Info                         │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ INVOICE HEADER                                              │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Invoice No: * (Auto-generated or manual)                    │   │
│  │ [INV-2025-00001      ]                                      │   │
│  │                                                             │   │
│  │ Invoice Date: *              Due Date: *                    │   │
│  │ [2025-01-21 📅]              [2025-02-21 📅]                 │   │
│  │                                                             │   │
│  │ Supplier Invoice No:                                        │   │
│  │ [SUP-INV-12345       ]                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ CURRENCY & EXCHANGE RATE                                    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Currency: *                                                 │   │
│  │ [MMK ▼]  (MMK / USD / THB / CNY)                           │   │
│  │                                                             │   │
│  │ Exchange Rate to USD: * (4 decimals)                        │   │
│  │ [2,100.0000        ]                                        │   │
│  │                                                             │   │
│  │ ℹ️ Exchange rate is independent from PO exchange rate       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Notes:                                                      │   │
│  │ ┌─────────────────────────────────────────────────────┐    │   │
│  │ │                                                     │    │   │
│  │ └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [Cancel]              [Next →]         │
└─────────────────────────────────────────────────────────────────────┘
```

##### Step 2: PO Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Invoice - Step 2 of 4: PO Selection                        │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SELECT PURCHASE ORDER                                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ PO: * (Only open POs shown)                                 │   │
│  │ [🔍 Search PO...                                   ▼]       │   │
│  │                                                             │   │
│  │ ⚠️ Closed or Cancelled POs are not available                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SELECTED PO DETAILS                                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ PO Number: PO-2025-00001                                    │   │
│  │ Supplier: ABC Corporation                                   │   │
│  │ PO Date: 2025-01-15                                         │   │
│  │ PO Currency: MMK @ 2,100.0000                               │   │
│  │ PO Total: 5,000,000.00 MMK (2,380.95 EUSD)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ PO LINE ITEMS (Available to Invoice)                        │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Item       │ SKU    │ PO Price │Ordered│Invoiced│Available │   │
│  ├────────────┼────────┼──────────┼───────┼────────┼──────────┤   │
│  │ Laptop     │ EQ-001 │ 400,000  │ 5     │ 2      │ 3        │   │
│  │ Mouse      │ EQ-002 │ 10,000   │ 20    │ 10     │ 10       │   │
│  │ Keyboard   │ EQ-003 │ 15,000   │ 10    │ 10     │ 0 (Full) │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                         [← Back]  [Cancel]  [Next →]               │
└─────────────────────────────────────────────────────────────────────┘
```

##### Step 3: Line Items

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Invoice - Step 3 of 4: Line Items                          │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  Invoice Currency: MMK @ 2,100.0000                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SELECT LINE ITEMS TO INVOICE                                │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │ ☑ Laptop (EQ-001)                                          │   │
│  │   PO Price: 400,000.00 MMK (190.48 EUSD) ← Reference        │   │
│  │   Available: 3 units                                        │   │
│  │   Invoice Qty: * [3    ] (Max: 3)                           │   │
│  │   Unit Price: * [400,000.00    ] MMK                        │   │
│  │   Subtotal: 1,200,000.00 MMK (571.43 EUSD)                  │   │
│  │                                                             │   │
│  │ ☑ Mouse (EQ-002)                                           │   │
│  │   PO Price: 10,000.00 MMK (4.76 EUSD) ← Reference           │   │
│  │   Available: 10 units                                       │   │
│  │   Invoice Qty: * [5    ] (Max: 10)                          │   │
│  │   Unit Price: * [10,000.00     ] MMK                        │   │
│  │   Subtotal: 50,000.00 MMK (23.81 EUSD)                      │   │
│  │                                                             │   │
│  │ ☐ Keyboard (EQ-003) - FULLY INVOICED (disabled)            │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ REAL-TIME TOTALS                                            │   │
│  │ Subtotal: 1,250,000.00 MMK                                  │   │
│  │ EUSD:     595.24 USD                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                         [← Back]  [Cancel]  [Next →]               │
└─────────────────────────────────────────────────────────────────────┘
```

##### Step 4: Summary & Submit

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Invoice - Step 4 of 4: Summary                             │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ INVOICE SUMMARY                                             │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Invoice No: INV-2025-00001                                  │   │
│  │ Invoice Date: 2025-01-21      Due Date: 2025-02-21          │   │
│  │ Linked PO: PO-2025-00001                                    │   │
│  │ Supplier: ABC Corporation                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ LINE ITEMS                                                  │   │
│  ├──────────────┬────────┬──────────────┬──────────┬───────────┤   │
│  │ Item         │ Qty    │ Unit Price   │ Total    │ EUSD      │   │
│  ├──────────────┼────────┼──────────────┼──────────┼───────────┤   │
│  │ Laptop       │ 3      │ 400,000.00   │1,200,000 │ 571.43    │   │
│  │ Mouse        │ 5      │ 10,000.00    │ 50,000   │ 23.81     │   │
│  ├──────────────┴────────┴──────────────┼──────────┼───────────┤   │
│  │                              TOTAL:  │1,250,000 │ 595.24    │   │
│  └──────────────────────────────────────┴──────────┴───────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ CURRENCY DETAILS                                            │   │
│  │ Invoice Currency: MMK                                       │   │
│  │ Exchange Rate: 2,100.0000                                   │   │
│  │ Total (MMK): 1,250,000.00                                   │   │
│  │ Total (EUSD): 595.24                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                 [← Back]  [Cancel]  [Create Invoice]               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Warehouse & Inventory Management

#### 3.5.1 WAC (Weighted Average Cost) Valuation

**WAC Calculation:**

```
WAC = (Existing Stock Value + New Stock Value) / (Existing Qty + New Qty)

Where:
- Existing Stock Value = Current On-Hand × Current WAC
- New Stock Value = Received Qty × Purchase Price
```

**WAC Display:**
- Shown on Warehouse Detail Page
- Shown on Item Detail Page
- Shown in Inventory Dashboard
- All financial values displayed with EUSD equivalent

#### 3.5.2 Enhanced Items Table with WAC

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('equipment', 'consumable', 'uniform', 'other')),
  sku TEXT UNIQUE,
  default_unit TEXT DEFAULT 'pcs',
  
  -- WAC Valuation (auto-updated by triggers)
  wac_amount DECIMAL(15,2) DEFAULT 0.00,
  wac_currency TEXT DEFAULT 'MMK',
  wac_exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  wac_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN wac_exchange_rate > 0 THEN ROUND(wac_amount / wac_exchange_rate, 2) ELSE 0 END
  ) STORED,
  
  is_active BOOLEAN DEFAULT true,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.5.3 Warehouse Inventory View with WAC

```sql
CREATE OR REPLACE VIEW warehouse_inventory_with_wac AS
SELECT 
  w.id AS warehouse_id,
  w.name AS warehouse_name,
  i.id AS item_id,
  i.name AS item_name,
  i.sku,
  i.category,
  
  -- Current stock
  COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_in' THEN it.quantity ELSE 0 END
  ), 0) -
  COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_out' THEN it.quantity ELSE 0 END
  ), 0) AS current_stock,
  
  -- WAC valuation
  i.wac_amount,
  i.wac_currency,
  i.wac_amount_eusd,
  
  -- Total value at WAC
  (COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_in' THEN it.quantity ELSE 0 END
  ), 0) -
  COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_out' THEN it.quantity ELSE 0 END
  ), 0)) * i.wac_amount AS total_value,
  
  -- Total value EUSD
  (COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_in' THEN it.quantity ELSE 0 END
  ), 0) -
  COALESCE(SUM(
    CASE WHEN it.movement_type = 'inventory_out' THEN it.quantity ELSE 0 END
  ), 0)) * i.wac_amount_eusd AS total_value_eusd

FROM warehouses w
CROSS JOIN items i
LEFT JOIN inventory_transactions it ON it.warehouse_id = w.id AND it.item_id = i.id AND it.status = 'completed'
WHERE w.is_active = true AND i.is_active = true
GROUP BY w.id, w.name, i.id, i.name, i.sku, i.category, i.wac_amount, i.wac_currency, i.wac_amount_eusd;
```

#### 3.5.4 Warehouse Detail Page with WAC

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to List                                    [Edit] [Archive]  │
├─────────────────────────────────────────────────────────────────────┤
│  Main Warehouse                                                     │
│  Location: Building A, Floor 1                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ KPI CARDS                                                   │   │
│  ├─────────────┬─────────────┬─────────────┬───────────────────┤   │
│  │ Total Items │ Total Units │ Total Value │ Total Value EUSD  │   │
│  │    45       │   1,234     │ 50,000,000  │ 23,809.52 USD     │   │
│  │             │             │ MMK         │                   │   │
│  └─────────────┴─────────────┴─────────────┴───────────────────┘   │
│                                                                     │
│  [Inventory Tab]  [Stock Movement Tab]                             │
│                                                                     │
│  ══════════════════════════════════════════════════════════════    │
│  INVENTORY TAB                                                     │
│  ══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ SKU    │ Product  │ Stock │ WAC      │ EUSD    │ Total Value│   │
│  ├────────┼──────────┼───────┼──────────┼─────────┼────────────┤   │
│  │ EQ-001 │ Laptop   │ 15    │400,000.00│ 190.48  │ 6,000,000  │   │
│  │        │          │       │ MMK      │ USD     │ (2,857.14) │   │
│  │ EQ-002 │ Mouse    │ 50    │ 10,000.00│ 4.76    │ 500,000    │   │
│  │        │          │       │ MMK      │ USD     │ (238.10)   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Card View & List View

QMHQ, PO, and Invoice support both **Card View** (detailed) and **List View** (compact).

#### 3.6.1 View Toggle UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  QMHQ List                                    [🔲 Card] [≡ List]    │
│  ═══════════════════════════════════════════════════════════════    │
```

#### 3.6.2 QMHQ Card View

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────┐  ┌───────────────────────────┐      │
│  │ QMHQ-2025-00001          │  │ QMHQ-2025-00002          │      │
│  │ ─────────────────────────│  │ ─────────────────────────│      │
│  │ Laptop procurement       │  │ Office supplies          │      │
│  │                          │  │                          │      │
│  │ Route: 🛒 PO             │  │ Route: 💵 Expense        │      │
│  │ Category: Purchase       │  │ Category: Service        │      │
│  │ Status: [Processing]     │  │ Status: [Completed]      │      │
│  │                          │  │                          │      │
│  │ Amount: 5,000,000.00 MMK │  │ Amount: 500,000.00 MMK   │      │
│  │ EUSD:   2,380.95 USD     │  │ EUSD:   238.10 USD       │      │
│  │                          │  │                          │      │
│  │ Balance: 1,500,000.00    │  │ Balance: 0.00            │      │
│  │                          │  │                          │      │
│  │ Assigned: John Doe       │  │ Assigned: Jane Smith     │      │
│  │ Updated: 2 hours ago     │  │ Updated: 1 day ago       │      │
│  └───────────────────────────┘  └───────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.6.3 QMHQ List View

```
┌─────────────────────────────────────────────────────────────────────┐
│ ID            │ Name           │ Route │ Status    │ Amount  │EUSD │
├───────────────┼────────────────┼───────┼───────────┼─────────┼─────┤
│ QMHQ-2025-001 │ Laptop proc... │ 🛒 PO │Processing │5,000,000│2,381│
│ QMHQ-2025-002 │ Office supp... │ 💵    │Completed  │ 500,000 │ 238 │
│ QMHQ-2025-003 │ Uniforms is... │ 📦    │Pending    │ -       │ -   │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.6.4 PO Card View

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────┐  ┌───────────────────────────┐      │
│  │ PO-2025-00001            │  │ PO-2025-00002            │      │
│  │ ─────────────────────────│  │ ─────────────────────────│      │
│  │ ABC Corporation          │  │ XYZ Supplies Ltd         │      │
│  │                          │  │                          │      │
│  │ Status: [Part. Invoiced] │  │ Status: [Closed]         │      │
│  │ ████████░░░░░░ 60%       │  │ ████████████████ 100%    │      │
│  │                          │  │                          │      │
│  │ Total: 5,000,000.00 MMK  │  │ Total: 2,000,000.00 MMK  │      │
│  │ EUSD:  2,380.95 USD      │  │ EUSD:  952.38 USD        │      │
│  │                          │  │                          │      │
│  │ Items: 3 │ Invoices: 2   │  │ Items: 5 │ Invoices: 1   │      │
│  │ PO Date: 2025-01-15      │  │ PO Date: 2025-01-10      │      │
│  └───────────────────────────┘  └───────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.6.5 Invoice Card View

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────┐  ┌───────────────────────────┐      │
│  │ INV-2025-00001           │  │ INV-2025-00002           │      │
│  │ ─────────────────────────│  │ ─────────────────────────│      │
│  │ PO: PO-2025-00001        │  │ PO: PO-2025-00001        │      │
│  │ ABC Corporation          │  │ ABC Corporation          │      │
│  │                          │  │                          │      │
│  │ Status: [Received]       │  │ Status: [Draft]          │      │
│  │                          │  │                          │      │
│  │ Total: 1,250,000.00 MMK  │  │ Total: 800,000.00 MMK    │      │
│  │ EUSD:  595.24 USD        │  │ EUSD:  380.95 USD        │      │
│  │                          │  │                          │      │
│  │ Date: 2025-01-21         │  │ Date: 2025-01-22         │      │
│  │ Due: 2025-02-21          │  │ Due: 2025-02-22          │      │
│  │ Items: 2                 │  │ Items: 1                 │      │
│  └───────────────────────────┘  └───────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Database Schema

#### Table: `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester')),
  department_id UUID REFERENCES departments(id),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `departments`

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES departments(id),
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `contact_persons`

```sql
CREATE TABLE contact_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `suppliers`

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_name TEXT,
  department_id UUID REFERENCES departments(id),
  position TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_id TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `items`

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('equipment', 'consumable', 'uniform', 'other')),
  sku TEXT UNIQUE,
  default_unit TEXT DEFAULT 'pcs',
  
  -- WAC Valuation
  wac_amount DECIMAL(15,2) DEFAULT 0.00,
  wac_currency TEXT DEFAULT 'MMK',
  wac_exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  wac_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN wac_exchange_rate > 0 THEN ROUND(wac_amount / wac_exchange_rate, 2) ELSE 0 END
  ) STORED,
  
  is_active BOOLEAN DEFAULT true,
  photo_url TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `warehouses`

```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  description TEXT,
  capacity_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `qmrl`

```sql
CREATE TABLE qmrl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  
  -- Status (single status - Notion style)
  status_id UUID REFERENCES status_config(id),
  
  -- Category (classification only - NOT route selector)
  category_id UUID REFERENCES categories(id),
  
  department_id UUID REFERENCES departments(id) NOT NULL,
  contact_person_id UUID REFERENCES contact_persons(id),
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  requester_id UUID REFERENCES users(id) NOT NULL,
  
  request_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qmrl_status ON qmrl(status_id);
CREATE INDEX idx_qmrl_category ON qmrl(category_id);
CREATE INDEX idx_qmrl_assigned ON qmrl(assigned_to);
```

#### Table: `qmhq`

```sql
CREATE TABLE qmhq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qmhq_id TEXT UNIQUE NOT NULL,
  qmrl_id UUID REFERENCES qmrl(id) ON DELETE CASCADE NOT NULL,
  line_name TEXT NOT NULL,
  
  -- Route type (determines workflow)
  route_type TEXT NOT NULL CHECK (route_type IN ('item', 'expense', 'po')),
  
  -- Status (single status - Notion style)
  status_id UUID REFERENCES status_config(id),
  
  -- Category (classification)
  category_id UUID REFERENCES categories(id),
  
  contact_person_id UUID REFERENCES contact_persons(id),
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  
  -- Financial fields (for expense and po routes) - 2 decimals
  amount DECIMAL(15,2),
  exchange_rate DECIMAL(10,4),
  amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN ROUND(amount / exchange_rate, 2) ELSE NULL END
  ) STORED,
  
  -- Item fields (for item route)
  item_id UUID REFERENCES items(id),
  quantity INTEGER,
  
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qmhq_route ON qmhq(route_type);
CREATE INDEX idx_qmhq_status ON qmhq(status_id);
CREATE INDEX idx_qmhq_assigned ON qmhq(assigned_to);
CREATE INDEX idx_qmhq_qmrl ON qmhq(qmrl_id);
```

#### Table: `financial_transactions`

```sql
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('money_in', 'money_out')),
  
  -- Financial amounts - 2 decimals
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) NOT NULL,
  amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN ROUND(amount / exchange_rate, 2) ELSE NULL END
  ) STORED,
  
  transaction_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `purchase_orders`

```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  qmhq_id UUID REFERENCES qmhq(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  
  po_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  
  -- Currency & Exchange (4 decimals for rate)
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) NOT NULL,
  
  -- Contact Roles
  contact_person_name TEXT NOT NULL,
  sign_person_name TEXT,
  authorized_signer_name TEXT,
  
  -- Totals - 2 decimals
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN ROUND(total_amount / exchange_rate, 2) ELSE NULL END
  ) STORED,
  
  -- Smart Status (auto-calculated)
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'partially_invoiced', 'awaiting_delivery', 
    'partially_received', 'closed', 'cancelled'
  )),
  
  approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'approved', 'rejected')),
  
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `po_line_items`

```sql
CREATE TABLE po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES items(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Price - 2 decimals
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  -- Tracking fields
  invoiced_quantity INTEGER DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(po_id, item_id)
);
```

#### Table: `invoices`

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id) NOT NULL,
  
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  received_date DATE,
  supplier_invoice_no TEXT,
  
  -- Currency & Exchange (independent from PO)
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4) NOT NULL,
  
  -- Totals - 2 decimals
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN ROUND(total_amount / exchange_rate, 2) ELSE NULL END
  ) STORED,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'partially_received', 'completed', 'voided')),
  
  -- Void fields
  is_voided BOOLEAN DEFAULT false,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT,
  
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `invoice_line_items`

```sql
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  po_line_item_id UUID REFERENCES po_line_items(id) NOT NULL,
  item_id UUID REFERENCES items(id) NOT NULL,
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Price - 2 decimals (can differ from PO price)
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `inventory_transactions`

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  movement_type TEXT NOT NULL CHECK (movement_type IN ('inventory_in', 'inventory_out')),
  
  item_id UUID REFERENCES items(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_of_measure TEXT DEFAULT 'pcs',
  
  -- Cost tracking for WAC - 2 decimals
  unit_cost DECIMAL(15,2),
  currency TEXT DEFAULT 'MMK',
  exchange_rate DECIMAL(10,4),
  unit_cost_eusd DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN exchange_rate > 0 THEN ROUND(unit_cost / exchange_rate, 2) ELSE NULL END
  ) STORED,
  
  -- Stock Out reason
  reason TEXT CHECK (
    movement_type = 'inventory_in' OR 
    reason IN ('request', 'consumption', 'damage', 'lost', 'transfer', 'adjustment')
  ),
  
  -- Transfer support
  destination_warehouse_id UUID REFERENCES warehouses(id),
  transfer_id UUID,
  
  -- Source references
  qmhq_id UUID REFERENCES qmhq(id),
  invoice_id UUID REFERENCES invoices(id),
  invoice_line_item_id UUID REFERENCES invoice_line_items(id),
  
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  
  transaction_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_transfer_destination CHECK (
    reason != 'transfer' OR destination_warehouse_id IS NOT NULL
  ),
  CONSTRAINT chk_transfer_different_warehouse CHECK (
    destination_warehouse_id IS NULL OR destination_warehouse_id != warehouse_id
  )
);

CREATE INDEX idx_inventory_trans_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_trans_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX idx_inventory_trans_date ON inventory_transactions(transaction_date DESC);
```

#### Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity reference
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'user', 'qmrl', 'qmhq', 'item', 'warehouse', 
    'purchase_order', 'invoice', 'inventory_transaction',
    'financial_transaction', 'supplier', 'contact_person', 'department'
  )),
  entity_id UUID NOT NULL,
  
  -- Action type
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'void', 'restore',
    'status_change', 'assignment_change', 'transfer',
    'approve', 'reject', 'close', 'cancel', 'reopen'
  )),
  
  -- Change details
  field_name TEXT, -- Specific field changed (for updates)
  old_value TEXT,  -- Previous value (human readable)
  new_value TEXT,  -- New value (human readable)
  
  -- Full snapshot (JSONB for complex changes)
  old_values JSONB,
  new_values JSONB,
  changes_summary TEXT, -- Human-readable summary
  
  -- User & metadata
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT, -- Denormalized for display
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Request context
  ip_address TEXT,
  user_agent TEXT,
  
  -- Additional context
  notes TEXT
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_entity_date ON audit_logs(entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_date ON audit_logs(changed_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

---

### 3.9 Audit Log & History Tab

All major entities have comprehensive audit logging with a **History Tab** on their detail pages.

#### 3.9.1 Audited Entities

| Entity | Tracked Actions |
|--------|-----------------|
| **User** | create, update, delete, role_change, status_change |
| **QMRL** | create, update, status_change, assignment_change, delete |
| **QMHQ** | create, update, status_change, assignment_change, delete |
| **Item** | create, update, delete, wac_update |
| **Warehouse** | create, update, archive, restore |
| **PO** | create, update, status_change, approve, reject, close, cancel |
| **Invoice** | create, update, void, status_change |
| **Inventory Transaction** | create, update, cancel, transfer |
| **Financial Transaction** | create, update, delete |
| **Supplier** | create, update, delete |
| **Contact Person** | create, update, delete |

#### 3.9.2 History Tab UI

Every detail page includes a **History Tab** showing audit trail:

```
┌─────────────────────────────────────────────────────────────────────┐
│  QMRL-2025-00001: Request for field equipment                      │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  [Details Tab]  [QMHQ Lines Tab]  [📜 History Tab]                 │
│                                                                     │
│  ══════════════════════════════════════════════════════════════    │
│  HISTORY                                              [Filter ▼]    │
│  ══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📝 Status Changed                          Jan 21, 2025     │   │
│  │    By: John Doe                            10:45 AM         │   │
│  │    ┌──────────────────────────────────────────────────┐    │   │
│  │    │ Status: Draft → Under Processing                 │    │   │
│  │    └──────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 👤 Assignment Changed                      Jan 20, 2025     │   │
│  │    By: Admin User                          3:30 PM          │   │
│  │    ┌──────────────────────────────────────────────────┐    │   │
│  │    │ Assigned To: (none) → John Doe                   │    │   │
│  │    └──────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✏️ Updated                                  Jan 20, 2025     │   │
│  │    By: Jane Smith                          2:15 PM          │   │
│  │    ┌──────────────────────────────────────────────────┐    │   │
│  │    │ Priority: Low → High                             │    │   │
│  │    │ Description: "Request for..." → "Urgent requ..." │    │   │
│  │    └──────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ➕ Created                                  Jan 19, 2025     │   │
│  │    By: Jane Smith                          9:00 AM          │   │
│  │    ┌──────────────────────────────────────────────────┐    │   │
│  │    │ Request Letter created                           │    │   │
│  │    │ Title: Request for field equipment - Unit A      │    │   │
│  │    │ Category: Equipment                              │    │   │
│  │    │ Department: Field Operations                     │    │   │
│  │    └──────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [Load More...]                         │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.9.3 History Tab Filter Options

```
┌─────────────────────────────────────────────────────────────────────┐
│  Filter History                                              [×]    │
│  ───────────────────────────────────────────────────────────────    │
│                                                                     │
│  Action Type:                                                       │
│  ☑ All  ☐ Create  ☐ Update  ☐ Status Change  ☐ Assignment         │
│                                                                     │
│  Date Range:                                                        │
│  [All Time ▼]  or  [From 📅] - [To 📅]                             │
│                                                                     │
│  Changed By:                                                        │
│  [All Users ▼]                                                      │
│                                                                     │
│                                    [Reset]  [Apply Filter]          │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.9.4 Action Icons & Colors

| Action | Icon | Color |
|--------|------|-------|
| create | ➕ | Green |
| update | ✏️ | Blue |
| delete | 🗑️ | Red |
| status_change | 📝 | Purple |
| assignment_change | 👤 | Orange |
| void | ⛔ | Red |
| approve | ✅ | Green |
| reject | ❌ | Red |
| close | 🔒 | Gray |
| cancel | 🚫 | Red |
| transfer | 🔄 | Blue |

#### 3.9.5 Audit Log Triggers

```sql
-- Generic audit log function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_changes_summary TEXT;
  v_user_name TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new_values := to_jsonb(NEW);
    v_changes_summary := 'Record created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Detect specific changes
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
      v_action := 'status_change';
    ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      v_action := 'assignment_change';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old_values := to_jsonb(OLD);
    v_changes_summary := 'Record deleted';
  END IF;
  
  -- Get user name
  SELECT full_name INTO v_user_name 
  FROM users 
  WHERE id = COALESCE(NEW.updated_by, NEW.created_by, OLD.created_by);
  
  -- Insert audit log
  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    changes_summary,
    changed_by,
    changed_by_name
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    v_changes_summary,
    COALESCE(NEW.updated_by, NEW.created_by, OLD.created_by),
    v_user_name
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all audited entities
CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_qmrl
  AFTER INSERT OR UPDATE OR DELETE ON qmrl
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_qmhq
  AFTER INSERT OR UPDATE OR DELETE ON qmhq
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_items
  AFTER INSERT OR UPDATE OR DELETE ON items
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_warehouses
  AFTER INSERT OR UPDATE OR DELETE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_inventory_transactions
  AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_financial_transactions
  AFTER INSERT OR UPDATE OR DELETE ON financial_transactions
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER trg_audit_contact_persons
  AFTER INSERT OR UPDATE OR DELETE ON contact_persons
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
```

#### 3.9.6 View: Formatted Audit Log

```sql
CREATE OR REPLACE VIEW audit_log_formatted AS
SELECT 
  al.id,
  al.entity_type,
  al.entity_id,
  al.action,
  al.field_name,
  al.old_value,
  al.new_value,
  al.changes_summary,
  al.changed_by,
  COALESCE(al.changed_by_name, u.full_name, 'System') AS changed_by_name,
  al.changed_at,
  al.notes,
  
  -- Formatted display
  CASE al.action
    WHEN 'create' THEN '➕ Created'
    WHEN 'update' THEN '✏️ Updated'
    WHEN 'delete' THEN '🗑️ Deleted'
    WHEN 'status_change' THEN '📝 Status Changed'
    WHEN 'assignment_change' THEN '👤 Assignment Changed'
    WHEN 'void' THEN '⛔ Voided'
    WHEN 'approve' THEN '✅ Approved'
    WHEN 'reject' THEN '❌ Rejected'
    WHEN 'close' THEN '🔒 Closed'
    WHEN 'cancel' THEN '🚫 Cancelled'
    WHEN 'transfer' THEN '🔄 Transferred'
    ELSE al.action
  END AS action_display,
  
  -- Time formatting
  TO_CHAR(al.changed_at, 'Mon DD, YYYY') AS date_display,
  TO_CHAR(al.changed_at, 'HH:MI AM') AS time_display,
  
  -- Relative time
  CASE 
    WHEN al.changed_at > NOW() - INTERVAL '1 minute' THEN 'Just now'
    WHEN al.changed_at > NOW() - INTERVAL '1 hour' THEN 
      EXTRACT(MINUTE FROM NOW() - al.changed_at)::INT || ' minutes ago'
    WHEN al.changed_at > NOW() - INTERVAL '1 day' THEN 
      EXTRACT(HOUR FROM NOW() - al.changed_at)::INT || ' hours ago'
    WHEN al.changed_at > NOW() - INTERVAL '7 days' THEN 
      EXTRACT(DAY FROM NOW() - al.changed_at)::INT || ' days ago'
    ELSE TO_CHAR(al.changed_at, 'Mon DD, YYYY')
  END AS relative_time

FROM audit_logs al
LEFT JOIN users u ON u.id = al.changed_by
ORDER BY al.changed_at DESC;
```

#### 3.9.7 API Endpoints for History

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/audit-logs?entity_type={type}&entity_id={id}` | GET | Get history for specific entity |
| `/api/audit-logs?entity_type={type}&entity_id={id}&action={action}` | GET | Filter by action type |
| `/api/audit-logs?entity_type={type}&entity_id={id}&from={date}&to={date}` | GET | Filter by date range |
| `/api/audit-logs?entity_type={type}&entity_id={id}&changed_by={user_id}` | GET | Filter by user |

#### 3.9.8 Detail Page Tab Structure

All detail pages follow this tab structure:

| Entity | Tabs |
|--------|------|
| **User** | Details, Activity, 📜 History |
| **QMRL** | Details, QMHQ Lines, Attachments, 📜 History |
| **QMHQ** | Details, Transactions, POs (if PO route), 📜 History |
| **Item** | Details, Stock by Warehouse, Transactions, 📜 History |
| **Warehouse** | Details, Inventory (with WAC), Stock Movement, 📜 History |
| **PO** | Details, Line Items, Invoices, 📜 History |
| **Invoice** | Details, Line Items, Stock Receipts, 📜 History |

---

### 3.8 Key Functions

#### Function: Update WAC on Stock In

```sql
CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  v_current_stock INTEGER;
  v_current_wac DECIMAL(15,2);
  v_new_wac DECIMAL(15,2);
  v_total_value DECIMAL(15,2);
BEGIN
  IF NEW.movement_type = 'inventory_in' AND NEW.unit_cost IS NOT NULL THEN
    -- Get current stock and WAC
    SELECT 
      COALESCE(SUM(CASE WHEN movement_type = 'inventory_in' THEN quantity ELSE -quantity END), 0),
      COALESCE(wac_amount, 0)
    INTO v_current_stock, v_current_wac
    FROM inventory_transactions it
    JOIN items i ON i.id = NEW.item_id
    WHERE it.item_id = NEW.item_id AND it.status = 'completed';
    
    -- Calculate new WAC
    v_total_value := (v_current_stock * v_current_wac) + (NEW.quantity * NEW.unit_cost);
    v_new_wac := v_total_value / (v_current_stock + NEW.quantity);
    
    -- Update item WAC
    UPDATE items SET
      wac_amount = v_new_wac,
      wac_currency = NEW.currency,
      wac_exchange_rate = NEW.exchange_rate,
      updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_item_wac
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_item_wac();
```

#### Function: Validate Invoice Quantity

```sql
CREATE OR REPLACE FUNCTION validate_invoice_line_quantity()
RETURNS TRIGGER AS $$
DECLARE
  v_available INTEGER;
  v_ordered INTEGER;
  v_invoiced INTEGER;
BEGIN
  -- Get ordered and already invoiced quantities
  SELECT quantity, invoiced_quantity INTO v_ordered, v_invoiced
  FROM po_line_items WHERE id = NEW.po_line_item_id;
  
  v_available := v_ordered - v_invoiced;
  
  IF NEW.quantity > v_available THEN
    RAISE EXCEPTION 'Invoice quantity (%) exceeds available quantity (%). Ordered: %, Already Invoiced: %',
      NEW.quantity, v_available, v_ordered, v_invoiced;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_invoice_qty
  BEFORE INSERT ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_line_quantity();
```

#### Function: Block Invoice for Closed PO

```sql
CREATE OR REPLACE FUNCTION block_invoice_for_closed_po()
RETURNS TRIGGER AS $$
DECLARE
  v_po_status TEXT;
BEGIN
  SELECT status INTO v_po_status
  FROM purchase_orders WHERE id = NEW.po_id;
  
  IF v_po_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot create invoice for % PO', v_po_status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_invoice_closed_po
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION block_invoice_for_closed_po();
```

---

## 4. Frontend Routes

| Route | Page | Type | Access |
|-------|------|------|--------|
| `/login` | Login | Page | Public |
| `/dashboard` | Dashboard | Page | All |
| `/qmrl` | QMRL List | Page | All |
| `/qmrl/new` | Create QMRL (Single Page) | Page | Requester+ |
| `/qmrl/[id]` | QMRL Detail | Page | Role-based |
| `/qmhq/new?qmrl={id}` | Create QMHQ (2-Page) | Page | Proposal+ |
| `/qmhq` | QMHQ List (Card/List) | Page | Role-based |
| `/qmhq/[id]` | QMHQ Detail | Page | Role-based |
| `/po` | PO List (Card/List) | Page | Proposal, Finance |
| `/po/new` | Multi-Step PO Creation | Page | Proposal, Finance |
| `/po/[id]` | PO Detail | Page | Proposal, Finance |
| `/invoice` | Invoice List (Card/List) | Page | Finance |
| `/invoice/new` | Multi-Step Invoice (4 steps) | Page | Finance |
| `/invoice/[id]` | Invoice Detail | Page | Finance, Inventory |
| `/inventory` | Inventory Dashboard | Page | Inventory, Admin |
| `/inventory/stock-in` | Stock In Form | Page | Inventory |
| `/inventory/stock-out` | Stock Out Form | Page | Inventory |
| `/warehouse` | Warehouse List | Page | Inventory, Admin |
| `/warehouse/[id]` | Warehouse Detail (with WAC) | Page | Inventory, Admin |
| `/item` | Item List | Page | All |
| `/item/[id]` | Item Detail (with WAC) | Page | Role-based |
| `/admin/users` | User Management | Page | Admin |
| `/admin/categories` | Category Management | Page | Admin |
| `/admin/statuses` | Status Management | Page | Admin |

---

## 5. Business Rules Summary

### 5.1 Financial Display Rules

| Rule | Description |
|------|-------------|
| FIN-01 | All amounts displayed with 2 decimals |
| FIN-02 | EUSD shown alongside every financial amount |
| FIN-03 | Exchange rate uses 4 decimals for accuracy |
| FIN-04 | Currency stored independently per entity |

### 5.2 Invoice Rules (NEXUS Pattern)

| Rule | Description |
|------|-------------|
| INV-01 | Invoice Qty ≤ Available Qty (PO Qty - Invoiced) |
| INV-02 | Invoice currency/rate independent from PO |
| INV-03 | PO Unit Price shown as read-only reference |
| INV-04 | Real-time subtotal updates before submission |
| INV-05 | Cannot create invoice for closed/cancelled PO |
| INV-06 | Cannot delete, only void |

### 5.3 WAC Rules

| Rule | Description |
|------|-------------|
| WAC-01 | WAC updated on every Stock In with cost |
| WAC-02 | WAC displayed on warehouse inventory view |
| WAC-03 | Total Value = Stock × WAC |
| WAC-04 | WAC stored in item's default currency with EUSD |

---

## 6. Out of Scope (V2)

| Feature | Reason |
|---------|--------|
| Photo Evidence for Stock In/Out | File storage infrastructure |
| Stock Out Approval Workflow | Additional complexity |
| Low Stock Alerts | Nice-to-have |
| Batch/Serial Number Tracking | Complex inventory |
| Multi-Currency Dashboard | V2 enhancement |

---

## Appendix: Migration Order

```
1. departments
2. users
3. contact_persons
4. suppliers
5. status_config
6. categories
7. items (with WAC fields)
8. warehouses
9. qmrl
10. qmhq
11. financial_transactions
12. purchase_orders
13. po_line_items
14. invoices
15. invoice_line_items
16. inventory_transactions
17. audit_logs
18. Views
19. Functions & Triggers
```

---

**Document End**
