# Roadmap: QM System V1.1

## Overview

QM System V1.1 builds on the completed V1.0 foundation to deliver critical bug fixes, comprehensive file attachment capabilities, a management dashboard for visibility, and enhanced UX through inline status updates and transaction editing. This roadmap prioritizes unblocking broken workflows first (PO creation, stock-in), establishes secure file storage infrastructure before UI, enables management oversight through live dashboards, and polishes the user experience with quick-access interactions.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Critical Bug Fixes** - Restore broken PO creation and stock-in workflows
- [x] **Phase 2: File Storage Foundation** - Secure file upload infrastructure with RLS policies
- [ ] **Phase 3: File Upload UI** - Drag-drop file attachments on QMRL/QMHQ detail pages
- [ ] **Phase 4: File Preview & Download** - Full in-app preview for images and PDFs
- [ ] **Phase 5: Management Dashboard** - Live dashboard with status counts and activity feeds
- [ ] **Phase 6: Status & Transaction UX** - Quick status changes and transaction editing

## Phase Details

### Phase 1: Critical Bug Fixes
**Goal**: Users can create purchase orders and receive inventory without errors
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, INV-01, INV-02
**Plans:** 3 plans

**Success Criteria** (what must be TRUE):
  1. User can create PO from QMHQ (PO route) without system errors
  2. User can complete stock-in transaction from invoice without system errors
  3. Invoice creation wizard completes all 3 steps successfully
  4. Stock-out form processes transactions and updates warehouse quantities
  5. Invoice line item quantity validation enforces PO quantity limits
  6. Invoice total amount can exceed PO total amount (price flexibility)

Plans:
- [x] 01-01-PLAN.md — Investigate and fix PO creation workflow
- [x] 01-02-PLAN.md — Investigate and fix stock-in functionality
- [x] 01-03-PLAN.md — Verify invoice creation and stock-out, confirm invoice qty validation

### Phase 2: File Storage Foundation
**Goal**: Secure file storage infrastructure ready for uploads
**Depends on**: Phase 1
**Requirements**: FILE-05, FILE-06, FILE-12
**Plans:** 2 plans

**Success Criteria** (what must be TRUE):
  1. File attachments table exists with RLS policies mirroring entity permissions
  2. Supabase Storage bucket configured with RLS policies on storage.objects
  3. Server-side validation enforces file type allowlist and 25MB size limit
  4. File deletion removes both metadata and storage object (no orphans)

Plans:
- [x] 02-01-PLAN.md — Create file attachments table and storage bucket with RLS
- [x] 02-02-PLAN.md — Build server-side upload/delete utilities with validation

### Phase 3: File Upload UI
**Goal**: Users can attach files to QMRL and QMHQ entities via detail pages
**Depends on**: Phase 2
**Requirements**: FILE-02, FILE-04, FILE-08, FILE-11
**Plans:** 3 plans

**Success Criteria** (what must be TRUE):
  1. User can drag-drop files onto QMRL detail page to upload
  2. User can drag-drop files onto QMHQ detail page to upload
  3. User sees list of uploaded files sorted by upload date with thumbnail previews
  4. Upload progress indicators display during file transfer

**Note:** Per 03-CONTEXT.md, file uploads are on detail pages only, NOT create forms.
Requirements FILE-01 and FILE-03 (create form uploads) are deferred - entities must exist first.

Plans:
- [ ] 03-01-PLAN.md — Build file upload components (dropzone, cards, progress, delete dialog)
- [ ] 03-02-PLAN.md — Integrate file upload into QMRL detail page
- [ ] 03-03-PLAN.md — Integrate file upload into QMHQ detail page

### Phase 4: File Preview & Download
**Goal**: Users can view files without leaving the application
**Depends on**: Phase 3
**Requirements**: FILE-09, FILE-10, FILE-13
**Success Criteria** (what must be TRUE):
  1. User can click image file to see full-size inline preview
  2. User can click PDF file to see in-app document viewer
  3. User can download all files as ZIP archive in one click
  4. Preview modal shows file metadata (name, size, upload date, uploader)
**Plans**: TBD

Plans:
- [ ] 04-01: Build image preview with Next.js Image
- [ ] 04-02: Build PDF preview with react-pdf
- [ ] 04-03: Build ZIP download functionality

### Phase 5: Management Dashboard
**Goal**: Admin and Quartermaster roles have real-time visibility into system activity
**Depends on**: Phase 1 (independent of file features)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. Admin and Quartermaster see live dashboard when visiting /dashboard
  2. Non-management roles redirect to their primary workflow page
  3. Dashboard displays QMRL counts grouped by status (to_do, in_progress, done)
  4. Dashboard displays QMHQ counts grouped by status
  5. Dashboard shows low stock alerts for items below 10 units
  6. Dashboard shows 5 most recent audit log entries
  7. Dashboard shows recent stock movements (in/out transactions)
**Plans**: TBD

Plans:
- [ ] 05-01: Build dashboard data queries with aggregations
- [ ] 05-02: Build dashboard UI with KPI cards and activity feed
- [ ] 05-03: Implement role-based routing and access control

### Phase 6: Status & Transaction UX
**Goal**: Users can make quick updates without full edit forms
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09
**Success Criteria** (what must be TRUE):
  1. User can click QMRL status badge to change status via dropdown
  2. User can click QMHQ status badge to change status via dropdown
  3. Status changes appear in audit history with user and timestamp
  4. User can click transaction row to open detail modal
  5. Transaction modal displays full transaction data in read-only view
  6. User can edit transaction date in modal
  7. User can edit transaction notes in modal
  8. Transaction amount and exchange rate remain read-only (audit integrity)
  9. Money in/out date picker design matches QMRL/QMHQ/PO forms
**Plans**: TBD

Plans:
- [ ] 06-01: Build quick status change component with dropdown
- [ ] 06-02: Build transaction detail modal with edit mode
- [ ] 06-03: Standardize date picker UI across all forms

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Bug Fixes | 3/3 | Complete | 2026-01-27 |
| 2. File Storage Foundation | 2/2 | Complete | 2026-01-27 |
| 3. File Upload UI | 0/3 | Planned | - |
| 4. File Preview & Download | 0/3 | Not started | - |
| 5. Management Dashboard | 0/3 | Not started | - |
| 6. Status & Transaction UX | 0/3 | Not started | - |

---
*Roadmap created: 2026-01-27*
*Last updated: 2026-01-28 - Phase 3 planned*
