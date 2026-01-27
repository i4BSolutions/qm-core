# QM System - V1.1 Enhancement

## What This Is

An internal ticket, expense, and inventory management platform serving as a Single Source of Truth (SSOT) for request-to-fulfillment workflows. This milestone focuses on bug fixes for critical workflows (PO creation, stock-in), adding file attachment capabilities, building a live dashboard for management, and improving UX for status changes and transaction viewing.

## Core Value

Users can reliably create purchase orders and receive inventory, with full visibility into request status and attached documentation.

## Requirements

### Validated

<!-- Existing functionality from V1.0 -->

- ✓ Email OTP authentication with role-based access — existing
- ✓ QMRL creation with Notion-style status system — existing
- ✓ QMHQ with three routes (Item, Expense, PO) — existing
- ✓ Invoice creation with 4-step wizard — existing
- ✓ Inventory transactions (stock-in/out) — existing
- ✓ WAC valuation for inventory items — existing
- ✓ Audit logging with history tabs — existing
- ✓ Card/List view toggle for QMHQ, PO, Invoice — existing

### Active

<!-- Current scope for V1.1 -->

**Bug Fixes:**
- [ ] Fix PO creation workflow (cannot create PO)
- [ ] Fix stock-in functionality (cannot receive inventory)
- [ ] Verify invoice creation works correctly
- [ ] Verify stock-out functionality works correctly

**File Attachments:**
- [ ] Add file upload to QMRL create form
- [ ] Add file upload to QMRL detail page
- [ ] Add file upload to QMHQ create form
- [ ] Add file upload to QMHQ detail page
- [ ] Display uploaded files sorted by upload date
- [ ] Full in-app preview for images and PDFs
- [ ] File deletion by users with edit access

**Dashboard:**
- [ ] Live dashboard for Admin/Quartermaster roles
- [ ] QMRL counts by status group (to_do, in_progress, done)
- [ ] QMHQ counts by status group
- [ ] Recent activity feed (5 most recent)
- [ ] Low stock warnings (items below 10 units)
- [ ] Recent stock movements display
- [ ] Redirect other roles to their primary page

**UX Improvements:**
- [ ] Quick status change via badge click (QMRL)
- [ ] Quick status change via badge click (QMHQ)
- [ ] Status changes logged in audit history
- [ ] Transaction detail modal with view/edit
- [ ] Transaction date and notes editable (amount locked for audit integrity)
- [ ] Date picker UI consistency for money in/out forms

**Invoice Behavior:**
- [ ] Invoice line item qty cannot exceed PO line item qty
- [ ] Invoice total amount CAN exceed PO total amount (price flexibility)

### Out of Scope

- Real-time notifications — complexity, defer to V2
- Batch file uploads via drag-drop zone — single file picker sufficient for now
- Custom low stock thresholds per item — global default (10 units) for V1.1
- Transaction amount editing — locked for audit integrity by design
- Dashboard for non-management roles — redirect to their main pages instead

## Context

**Existing Codebase:**
- Next.js 14+ with App Router, TypeScript strict mode
- Supabase for auth, database, and now file storage
- Tailwind CSS with dark theme support
- 30+ database migrations, RLS policies in place
- Complete RBAC permission system

**Known Issues:**
- PO creation fails (needs investigation)
- Stock-in not working (needs investigation)
- Dashboard currently shows dummy/placeholder data

**File Storage:**
- Use Supabase Storage buckets
- Max file size: 25 MB
- Max files per entity: 10
- Allowed types: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Images (PNG, JPG, GIF)

## Constraints

- **Storage**: Supabase Storage — already integrated, no additional infrastructure
- **File Size**: 25 MB max — Supabase free tier limit consideration
- **Compatibility**: Must work with existing RLS policies and audit system
- **UX**: Quick status change must still trigger audit logging

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Storage for files | Already using Supabase, no new infrastructure | — Pending |
| Global low stock threshold (10 units) | Simpler than per-item config, sufficient for V1.1 | — Pending |
| Amount locked after transaction creation | Audit integrity, prevents financial tampering | — Pending |
| Full preview for all file types | Better UX than download-only | — Pending |
| Dashboard for Admin/Quartermaster only | Other roles have specific workflows, redirect them | — Pending |
| Quick status via badge click | Minimal UI change, intuitive interaction | — Pending |

---
*Last updated: 2025-01-27 after initialization*
