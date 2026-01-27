# Project Research Summary

**Project:** QM System V1.1 Enhancement (File Attachments, Real-time Dashboard, UX Improvements)
**Domain:** Internal Business Management Application
**Researched:** 2026-01-27
**Confidence:** HIGH

## Executive Summary

QM System V1.1 adds file attachments, management dashboards, and inline status updates to an existing Next.js 14 + Supabase application. Research shows the recommended approach leverages **Server Actions with signed upload URLs** for files (avoiding 1MB Server Action body limits), **on-demand database queries** for dashboards (not real-time subscriptions for this use case), and the **existing audit trigger system** for status change logging (no new logging layer needed).

The critical architectural decision is to treat file attachments as a separate entity with RLS policies that mirror parent entity permissions. This maintains security while avoiding tight coupling. For dashboards, research strongly recommends on-demand queries over real-time subscriptions given the low-frequency update pattern and small admin audience. The existing audit system (migration 026) already handles status changes comprehensively, requiring no additional logging infrastructure.

Key risks center on **storage security** (missing RLS policies exposing files), **orphaned files** from SQL-based deletion, and **N+1 query performance** in dashboards. All three are preventable through proper RLS implementation, using Storage API for deletions, and query aggregation patterns. The recommended tech stack minimizes new dependencies while following 2025 Next.js App Router best practices.

## Key Findings

### Recommended Stack

The research confirms sticking with the existing Next.js 14 + Supabase architecture while adding minimal new dependencies. For 2026, the ecosystem has matured around Server Actions as the primary mutation pattern, with strong community adoption (63% of Next.js developers) and official Supabase integration patterns.

**Core technologies:**
- **Server Actions + Signed URLs**: Orchestration via Server Actions, direct client-to-Supabase upload with signed URLs — bypasses 1MB Server Action body limit, better performance than proxying through server
- **react-pdf v10**: PDF preview with modern ESM architecture — most popular option (1,004 dependents), actively maintained, just released major version in January 2026
- **react-dropzone v14**: Drag-and-drop upload UI — industry standard (4,400+ dependents), TypeScript support, proven at scale
- **Supabase Realtime (optional)**: WebSocket subscriptions for live updates — only if required for activity feeds, recommend polling/on-demand for low-frequency dashboards
- **Next.js Image (built-in)**: Image optimization and preview — native, automatic WebP/AVIF conversion, works seamlessly with Supabase Storage

**Critical version requirements:**
- react-pdf: Must use v10.3.0+ (latest, ESM-only)
- Next.js: Already on 14.2.13 (sufficient, though 15+ adds useOptimistic for better status updates)

### Expected Features

Research into file attachment systems, dashboard design, and inline status updates reveals clear table stakes vs. differentiators.

**Must have (table stakes):**
- **File Attachments**: Drag-drop upload, file list display, individual file delete, preview/download, type/size validation, progress indicators — users expect this in any modern business app
- **Management Dashboard**: Status count KPI cards, recent activity feed, inventory alerts, role-based views, date range filters — admins need at-a-glance workload visibility
- **Inline Status Change**: Click badge to open dropdown, grouped by workflow stage, immediate save with optimistic UI, keyboard navigation — avoiding full edit form for simple updates
- **Transaction Detail**: View mode by default, edit mode toggle, maintain context (drawer not modal), related data tabs — users need quick reference without losing place in list

**Should have (competitive):**
- File inline viewer (PDF/image embed in page, not just download)
- Dashboard drill-down (click metric to see filtered list)
- Status change notes (optional comment field)
- Customizable dashboard widgets (user preferences)

**Defer (v2+):**
- File version history
- Bulk status changes
- Scheduled email reports
- Predictive alerts
- File search across all attachments

### Architecture Approach

The architecture extends the existing V1.0 system without modifying core tables or RLS policies. File attachments use a **separate metadata table with polymorphic entity relationships**, avoiding JSON fields for better queryability and referential integrity. Dashboard data comes from **on-demand queries** rather than real-time subscriptions, appropriate for the low-frequency update pattern and small admin audience. Status changes leverage the **existing audit trigger system** (migration 026), requiring no new logging code.

**Major components:**
1. **File Storage System** — Separate `file_attachments` table for metadata, Supabase Storage bucket for bytes, RLS policies on both `file_attachments` and `storage.objects` mirroring entity permissions, Server Actions coordinating upload (metadata + storage)
2. **Dashboard Data System** — Server Component fetches on-demand from 4 data sources (qmrl, qmhq, audit_logs, inventory_transactions), materialized views optional if load time >2 seconds, no client-side state management
3. **Quick Status Change** — Client component (StatusBadge) calls Server Action to update `status_id`, existing audit trigger fires automatically, optimistic UI with rollback on error, RLS enforces permissions
4. **File Metadata Storage** — Dedicated table (not JSON field) for queryability, indexing on entity_id and uploaded_by, foreign keys for referential integrity, audit logging via existing triggers

**Integration points:**
- File attachments use polymorphic `entity_type` + `entity_id` to link to qmrl/qmhq without modifying those tables
- Dashboard queries join existing tables (no new tables except optional materialized views)
- Status changes use existing audit system (lines 107-138 in migration 026)
- All new features build on existing RLS patterns and Supabase client utilities

### Critical Pitfalls

Research into production deployments and CVE disclosures reveals specific failure modes to avoid.

1. **Missing RLS Policies on Storage** — CVE-2025-48757 affected 170+ apps due to missing RLS on storage.objects, exposing all uploaded files publicly. **Prevention:** Enable RLS immediately on both `file_attachments` table and `storage.objects`, test with anon key (never service role during development), use Supabase Security Advisor before deployment.

2. **Orphaned Files from SQL Deletion** — Deleting file metadata via SQL leaves actual files in S3 forever, consuming quota and costing money. **Prevention:** Never use SQL to delete files, always use `supabase.storage.from().remove()`, implement database triggers to cascade deletes to storage, consider soft delete with `is_active` flag.

3. **Service Role Key Exposure** — Using service role key in client code to bypass RLS during development, then accidentally shipping to production. **Prevention:** Separate client (`lib/supabase/client.ts` with anon key) and admin (`lib/supabase/admin.ts` with service role) utilities, runtime check to throw error if service role detected in NEXT_PUBLIC_ env var, fix RLS policies instead of bypassing them.

4. **Client-Side Validation Only** — Validating file types/sizes only in browser allows trivial bypass via curl or request manipulation. **Prevention:** Mandatory server-side validation in Server Actions, use magic byte detection (file-type library) not Content-Type header, generate server-side filenames (never trust user input), configure Supabase bucket-level size limits.

5. **N+1 Queries in Dashboard** — Loading entities then looping to fetch counts/relationships causes hundreds of queries and 30+ second page loads. **Prevention:** Use joins and aggregations in single query, materialized views for complex dashboards (if load time >2 seconds), index all foreign keys used in joins, monitor query count in development.

## Implications for Roadmap

Based on research, the feature set naturally groups into 4 phases with clear dependencies and risk mitigation.

### Phase 1: File Storage Foundation (Days 1-2)
**Rationale:** File uploads have the most infrastructure dependencies (storage bucket, RLS policies on two surfaces, metadata table). Must be complete before UI can be built. Research shows this is the highest security risk area (Pitfall #1, #2, #3), so getting foundation right is critical.

**Delivers:**
- `file_attachments` table with RLS policies
- Supabase Storage bucket `attachments` (private)
- RLS policies on `storage.objects`
- File upload/download utility functions

**Addresses:** Table stakes file attachment system foundation

**Avoids:** Pitfall #1 (missing RLS), Pitfall #2 (orphaned files) via proper setup, Pitfall #3 (service key exposure) via separate client utilities

**Research flag:** Standard pattern — no additional research needed, well-documented by Supabase

### Phase 2: File Upload & Preview UI (Days 3-6)
**Rationale:** With foundation secure, can build user-facing upload/preview features. Research shows react-dropzone and react-pdf are the established libraries with 2026 updates. File preview is a table stakes feature users expect.

**Delivers:**
- File upload form with drag-drop (react-dropzone)
- File list display component
- Image preview (Next.js Image)
- PDF preview (react-pdf v10)
- File delete functionality
- Integration into QMRL/QMHQ pages

**Uses:** react-dropzone v14.3.8, react-pdf v10.3.0, Next.js Image built-in

**Addresses:** Table stakes drag-drop upload, file list, preview, delete

**Avoids:** Pitfall #4 (client-side validation only) via server-side checks, Pitfall #8 (CORS) via signed URLs, Pitfall #9 (Server Action 1MB limit) via signed upload URLs, Pitfall #10 (trusting filenames) via server-side UUID generation

**Research flag:** Standard pattern — library documentation sufficient, no deep dive needed

### Phase 3: Dashboard Implementation (Days 7-8)
**Rationale:** Dashboard queries existing data (qmrl, qmhq, audit_logs, inventory) without new tables. Research strongly recommends on-demand queries over real-time subscriptions for low-frequency updates with small admin audience. Can parallelize with file preview completion.

**Delivers:**
- Dashboard utility functions (getQMRLStatusCounts, getRecentActivity, getLowStockItems)
- Dashboard page with KPI cards
- Activity feed component
- Role-based dashboard views
- Loading states with Suspense

**Implements:** Dashboard Data System component (Server Component pattern)

**Addresses:** Table stakes status counts, activity feed, inventory alerts

**Avoids:** Pitfall #5 (N+1 queries) via joins and aggregations, Pitfall #7 (memory leaks) by avoiding unnecessary Realtime subscriptions

**Research flag:** Standard pattern — PostgreSQL aggregation docs sufficient

### Phase 4: Status Updates & Polish (Days 9-12)
**Rationale:** Status updates leverage existing audit system (no new infrastructure). Research confirms migration 026 already handles status change logging. Polish phase includes transaction modal, loading states, and integration testing.

**Delivers:**
- StatusBadge component with dropdown
- updateStatusAction Server Action
- Optimistic UI with rollback
- Transaction detail drawer/modal
- Edit mode for transaction date/notes
- Integration testing across all features
- Bug fixes (PO creation, stock-in)

**Uses:** Existing audit trigger system (migration 026, lines 107-138)

**Addresses:** Table stakes inline status change, transaction detail view/edit

**Avoids:** Pitfall #6 (race conditions) via optimistic locking, Pitfall #12 (no loading state) via optimistic UI, avoid creating dual audit logging (trigger handles it)

**Research flag:** Standard pattern — React optimistic UI docs sufficient

### Phase Ordering Rationale

- **Security-first approach:** File storage foundation (Phase 1) addresses highest-risk security pitfalls before exposing UI
- **Dependency chain:** UI components (Phase 2) require foundation (Phase 1) to be complete and secure
- **Parallelization opportunity:** Dashboard (Phase 3) can run parallel with file preview portion of Phase 2 — no dependencies between them
- **Existing infrastructure reuse:** Status updates (Phase 4) saved for last because they're lowest risk, leveraging migration 026 audit triggers already in production
- **Testing efficiency:** Integration testing (Phase 4) catches issues across all features before deployment

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Supabase Storage RLS patterns well-documented, official examples available
- **Phase 2:** react-pdf and react-dropzone have comprehensive docs, Next.js Image is native
- **Phase 3:** PostgreSQL aggregation queries are standard pattern, existing audit_logs table provides data
- **Phase 4:** React optimistic UI and Server Actions are documented patterns

**No phases require deeper research.** All technology choices have official documentation, active community support, and verified 2026 examples. The architecture builds on existing V1.0 patterns (RLS policies, audit triggers, Server Components) with minimal new surface area.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Server Actions are 63% adopted in production (Vercel 2025 survey), react-pdf v10 released Jan 2026, Supabase Storage patterns verified in official docs |
| Features | HIGH | Table stakes features verified across multiple 2026 UX best practice sources, OWASP file upload standards, Carbon Design System patterns |
| Architecture | HIGH | Extends existing V1.0 architecture without modifications to core tables, RLS policy patterns match existing system, audit trigger integration confirmed in migration 026 |
| Pitfalls | HIGH | Critical pitfalls backed by CVE disclosures (CVE-2025-48757), official OWASP standards, Supabase community reports, PostgreSQL performance case studies |

**Overall confidence:** HIGH

Research cross-referenced official documentation (Supabase, Next.js, React, PostgreSQL), industry standards (OWASP), and verified 2026 sources. All major decisions have multiple confirming sources. The existing V1.0 codebase provides architectural patterns to extend rather than invent new approaches.

### Gaps to Address

Minor gaps that need attention during implementation:

- **Virus scanning:** File upload validation checks MIME types but doesn't scan for malware. **Decision:** Out of scope for V1.1, consider Supabase Edge Function integration in V2.0. Mitigation: strict file type allowlist reduces executable upload risk.

- **Storage quota management:** No automated enforcement of org-level storage limits. **Decision:** Monitor via Supabase Dashboard for V1.1, add quota enforcement in V2.0. Track total storage usage and set alerts at 80% of plan limit.

- **Dashboard refresh strategy:** Research recommends on-demand over real-time, but doesn't specify when to auto-refresh. **Decision:** Manual refresh (F5) for V1.1, optionally add `revalidatePath()` in relevant Server Actions if users request auto-refresh.

- **Materialized views timing:** Research recommends adding if dashboard load time >2 seconds, but exact thresholds depend on data volume. **Decision:** Start with direct queries, benchmark with production-like data in Phase 3, add materialized views only if needed.

- **Status transition rules:** Current approach allows any status to any status (if user has permissions). **Decision:** Sufficient for V1.1, consider finite state machine with allowed transitions in V2.0 if workflow violations occur.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — RLS policy patterns
- [Signed URL file uploads with Next.js and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) — Upload pattern
- [react-pdf v10 npm package](https://www.npmjs.com/package/react-pdf) — Version verification
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — Subscription patterns

**Features Research:**
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — Security requirements
- [Dashboard Design Principles](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles) — UX best practices
- [Carbon Design System - Modal Usage](https://carbondesignsystem.com/components/modal/usage/) — Detail drawer patterns

**Architecture Research:**
- [Building a scalable document management system](https://www.infoworld.com/article/4092063/building-a-scalable-document-management-system-lessons-from-separating-metadata-and-content.html) — Metadata storage patterns
- [Materialized Views Performance Case Study](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/) — Dashboard optimization
- [Database Audit Logging Guide](https://www.bytebase.com/blog/database-audit-logging/) — Audit pattern verification

**Pitfalls Research:**
- [CVE-2025-48757 Disclosure](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — RLS vulnerability evidence
- [OWASP Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload) — Attack vectors
- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization) — N+1 prevention

### Secondary (MEDIUM confidence)

- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic) — Optimistic UI pattern
- [Supabase Realtime Memory Leak](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak) — Community-reported issue
- [File Upload Validation Techniques](https://www.triaxiomsecurity.com/file-upload-validation-techniques/) — Security best practices

---
*Research completed: 2026-01-27*
*Ready for roadmap: yes*
