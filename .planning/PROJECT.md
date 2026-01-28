# QM System

## What This Is

An internal ticket, expense, and inventory management platform serving as a Single Source of Truth (SSOT) for request-to-fulfillment workflows. The system handles QMRL (request letters), QMHQ (headquarters processing with Item/Expense/PO routes), purchase orders, invoices, and inventory with WAC valuation.

## Core Value

Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## Current State (v1.1 Shipped)

**Tech Stack:**
- Next.js 14+ with App Router, TypeScript strict mode
- Supabase for auth, database, and file storage
- Tailwind CSS with dark theme support
- ~31,689 lines of TypeScript
- 33 database migrations with RLS policies

**Shipped Features:**
- Email OTP authentication with 7-role RBAC
- QMRL/QMHQ with Notion-style status system
- Purchase orders with smart status calculation
- Invoice creation with quantity validation
- Inventory stock-in/out with WAC valuation
- File attachments with drag-drop upload, preview, and ZIP download
- Live management dashboard with KPIs and alerts
- Quick status changes via clickable badges
- Complete audit logging

## Requirements

### Validated

<!-- V1.0 Features -->
- ✓ Email OTP authentication with role-based access — v1.0
- ✓ QMRL creation with Notion-style status system — v1.0
- ✓ QMHQ with three routes (Item, Expense, PO) — v1.0
- ✓ Invoice creation with 4-step wizard — v1.0
- ✓ Inventory transactions (stock-in/out) — v1.0
- ✓ WAC valuation for inventory items — v1.0
- ✓ Audit logging with history tabs — v1.0
- ✓ Card/List view toggle for QMHQ, PO, Invoice — v1.0

<!-- V1.1 Features -->
- ✓ PO creation workflow fixed — v1.1
- ✓ Stock-in functionality fixed — v1.1
- ✓ Invoice quantity validation (cannot exceed PO qty) — v1.1
- ✓ File attachments on QMRL/QMHQ detail pages — v1.1
- ✓ In-app image and PDF preview — v1.1
- ✓ Download all files as ZIP — v1.1
- ✓ Live management dashboard with status KPIs — v1.1
- ✓ Low stock alerts (items below 10 units) — v1.1
- ✓ Quick status change via badge click — v1.1
- ✓ DD/MM/YYYY date picker standardization — v1.1

### Active

<!-- Next milestone scope — TBD -->

(Run `/gsd:new-milestone` to define next goals)

### Out of Scope

- Real-time WebSocket dashboard updates — polling sufficient
- Per-item low stock thresholds — global default (10) works
- Transaction editing after creation — audit integrity
- File attachments on PO/Invoice — QMRL/QMHQ scope first
- Create form file uploads — entity must exist first

## Context

**Milestones:**
- v1.0 MVP — Foundation (pre-existing)
- v1.1 Enhancement — Bug fixes, files, dashboard, UX (shipped 2026-01-28)

**Technical Patterns Established:**
- Enhanced Supabase error extraction for PostgresError
- Safe JSONB column access in audit triggers
- Polymorphic file attachments (entity_type + entity_id)
- Storage RLS policies mirroring entity permissions
- Cascade soft-delete with 30-day grace period
- RPC functions for dashboard aggregations
- useInterval hook with ref-based stale closure prevention

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Storage for files | Already using Supabase, no new infrastructure | ✓ Good |
| Global low stock threshold (10 units) | Simpler than per-item config | ✓ Good |
| Amount locked after transaction creation | Audit integrity | ✓ Good |
| Full preview for all file types | Better UX than download-only | ✓ Good |
| Dashboard for Admin/Quartermaster only | Other roles have specific workflows | ✓ Good |
| Quick status via badge click | Minimal UI change, intuitive | ✓ Good |
| View-only transaction modal | Audit integrity over editability | ✓ Good |
| Detail page uploads only | Entity must exist to attach files | ✓ Good |

## Constraints

- **Storage**: Supabase Storage with 25MB file limit
- **Compatibility**: Must work with existing RLS and audit system
- **Audit**: All status/financial changes must be logged

---
*Last updated: 2026-01-28 after v1.1 milestone*
