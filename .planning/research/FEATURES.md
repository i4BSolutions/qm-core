# Feature Landscape

**Domain:** Business Management Application (File Attachments, Dashboards, UX Enhancements)
**Researched:** 2026-01-27
**Confidence:** HIGH (verified with current 2026 sources for all major feature categories)

## Table Stakes

Features users expect. Missing these makes the product feel incomplete or frustrating.

### File Attachment System

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop upload | Standard in all modern business apps. Faster than browse dialogs. | Low | Desktop users especially expect this. Must show visual feedback (border change, cursor change). |
| Click-to-browse fallback | Accessibility requirement. Users without drag capability need alternative. | Low | Standard file picker dialog. |
| File preview thumbnails | Users need to verify uploaded files without downloading. | Medium | Images: inline thumbnail. Documents: icon + filename + size. |
| Individual file delete | Users must be able to remove incorrect uploads before submission. | Low | Close icon (X) on each file item. |
| File list display | Show all attached files with metadata (name, size, upload date, uploader). | Low | Table or card view with filename, size, uploaded by, uploaded at. |
| Multiple file upload | Users often need to attach several supporting documents. | Low | Allow selecting/dropping multiple files at once. |
| Upload progress indicator | Users need feedback during upload, especially for large files. | Low | Progress bar with percentage. Three states: loading, success, error. |
| File size validation | Prevent server overload and user frustration from failed large uploads. | Low | Client-side check before upload. Display max size clearly (e.g., "Max 10MB per file"). |
| File type restrictions | Security requirement and UX clarity. | Low | Allowlist approach only. Show accepted types (e.g., "PDF, JPG, PNG, DOCX, XLSX"). |
| Clear error messages | Users need to understand why upload failed. | Low | Specific errors: "File too large", "File type not allowed", "Network error - try again". |

### Management Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Status count KPI cards | Admin/Quartermaster need at-a-glance view of workload distribution. | Low | Count of items by status group (to_do, in_progress, done). Color-coded. |
| Inventory alert cards | Warehouse managers need immediate notification of stock issues. | Medium | Show items below threshold. Include reorder recommendations. |
| Recent activity feed | Teams need to see what happened recently across the system. | Medium | Reverse chronological list. Most recent at top. Show action, entity, user, timestamp. |
| Quick navigation | Dashboard should provide shortcuts to common tasks. | Low | "Create QMRL", "Stock In", "New Invoice" buttons. |
| Real-time or near-real-time updates | Users expect current data, not stale snapshots. | Medium | Update every 30-60 seconds, or use WebSocket for live updates. |
| Role-based dashboard views | Different roles need different metrics. | Medium | Admin sees everything. Inventory sees stock. Finance sees financial metrics. |
| Date range filters | Users need to scope metrics to relevant timeframe. | Low | Quick filters: Today, This Week, This Month, Custom Range. |

### Inline Status Change

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Click badge to open dropdown | Users expect to change status without opening full edit form. | Medium | Status badge is clickable. Opens dropdown with all available statuses. |
| Visual status grouping | Users need to understand status progression. | Low | Group dropdown by to_do, in_progress, done. Use visual separators. |
| Immediate save on selection | Users expect instant update, not separate save button. | Low | Select status → API call → update badge. Show loading state during save. |
| Keyboard navigation | Accessibility and power user requirement. | Low | Arrow keys to navigate dropdown. Enter to select. Escape to cancel. |
| Optimistic UI update | Status badge should update immediately, rollback on error. | Medium | Update UI instantly, show error toast if API fails, revert badge. |

### Transaction Detail Modals/Drawers

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| View mode by default | Users typically check details before editing. | Low | Read-only view with clean layout. "Edit" button to switch to edit mode. |
| Edit mode toggle | Users need to modify transaction details inline. | Low | Toggle between view and edit modes. Clear visual distinction. |
| Maintain context | Users shouldn't lose their place in the main list. | Low | Drawer (slide from right) better than modal for this. User can still see list. |
| Quick close action | Users need fast exit without scrolling. | Low | X button in header. Click outside drawer to close. Escape key support. |
| Related data tabs | Users need to see connected information (e.g., QMHQ lines under QMRL). | Medium | Tab navigation: Details, Related Items, History. Lazy load tab content. |
| Dirty form warning | Prevent accidental data loss on navigation. | Low | "You have unsaved changes" confirmation before closing if form is dirty. |

## Differentiators

Features that set the product apart. Not expected, but create delight.

### File Attachment Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inline file viewer | Users can view PDFs/images without downloading. | High | Embed PDF viewer or image lightbox. Major UX improvement but complex. |
| Version history | Track file replacements for audit trail. | Medium | When user uploads same filename, create version. Show version list. |
| File download all | Users can download all attachments as ZIP. | Medium | Generate ZIP server-side. Useful for archival or offline review. |
| Smart file naming | Auto-rename files with entity ID for organization. | Low | "QMRL-2025-00001_InvoiceCopy.pdf" instead of "IMG_1234.pdf". |
| File search | Users can search across all attachments by filename or metadata. | Medium | Full-text search in filenames. Admin feature for finding documents. |
| Attachment templates | Common file types can be pre-filled forms for download. | Low | E.g., "Download Request Form Template" for users who need structure. |

### Dashboard Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Customizable dashboard widgets | Users can arrange and select metrics they care about. | High | Drag-and-drop widget arrangement. Save per-user preferences. |
| Drill-down capability | Click metric to see underlying details. | Medium | Click "15 Pending QMRLs" → filtered QMRL list. Deep linking. |
| Export dashboard to PDF/Excel | Users can share snapshots with management. | Medium | Generate static report from current dashboard view. |
| Scheduled email reports | Users receive dashboard summary without logging in. | High | Background job sends email digest. Configurable frequency. |
| Predictive alerts | AI/ML suggests actions based on patterns. | Very High | "3 items likely to miss deadline" based on historical data. Future enhancement. |
| Comparison view | Show current vs previous period metrics. | Medium | "15 completed this month (+3 from last month)". Trend indicators. |
| Activity filtering | Users can filter feed by entity type, user, action type. | Low | Dropdown filters above activity feed. Client-side or server-side filtering. |
| Mobile-optimized dashboard | Users can check status on phone. | Medium | Responsive design with stacked KPI cards. Touch-friendly interactions. |

### Status Change Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bulk status change | Users can change status for multiple items at once. | Medium | Multi-select in list view, then change status. Confirm action. |
| Status change notes | Add context when changing status (e.g., reason for rejection). | Low | Optional text field in dropdown. Saved to history. |
| Smart status suggestions | System suggests next status based on workflow. | Medium | "Usually moved from Pending Review to Under Processing. Suggested: Under Processing." |
| Status change shortcuts | Keyboard shortcuts for common status changes. | Low | Power user feature. Press "c" for Complete, "r" for Reject while item focused. |

### Transaction Detail Enhancements

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Activity timeline in drawer | See all changes to transaction in detail view. | Medium | Vertical timeline with icons per action type. Already planned in History tab. |
| Related entity links | Click linked QMRL/QMHQ/PO to open in new drawer. | Medium | Stack drawers or replace current drawer. Navigation breadcrumbs. |
| Print-friendly view | Users can print transaction details for paper trails. | Low | Dedicated print CSS. Hide irrelevant UI elements. |
| Transaction comparison | Compare two transactions side-by-side. | High | Select two items, click "Compare". Show diff view. Niche feature. |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

### File Attachment Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Unlimited file size | Server costs explode, user uploads fail silently, poor UX. | Set reasonable limit (10-50MB per file). Display limit clearly. Suggest compression for large files. |
| Accept all file types | Security nightmare. Executable files, scripts can be uploaded. | Use strict allowlist: PDF, images (JPG, PNG), documents (DOCX, XLSX), text files. Block executables (.exe, .sh, .bat, .js). |
| Client-only validation | Users bypass restrictions, server crashes, security vulnerability. | Always validate server-side. Client validation only for UX speed. |
| Store files in database as BLOB | Poor performance, expensive scaling, backup bloat. | Store files in object storage (Supabase Storage). Store only metadata and file path in database. |
| User-supplied filenames directly | Security risk (path traversal), conflicts, messy organization. | Generate unique filenames (UUID or hash). Store original filename as metadata for display. |
| No rate limiting | Users can flood server with uploads, denial of service. | Limit uploads per user per minute (e.g., 10 files/minute). |
| Virus scanning not implemented | Malware spreads through your system. | Integrate virus scanning service for uploaded files. Quarantine suspicious files. |

### Dashboard Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Too many metrics on one view | Information overload. Users can't find what they need. Cognitive overload. | Limit to 6-8 KPI cards. Provide drill-down for more detail. Use tabs or separate pages for different metric categories. |
| Vanity metrics without context | Numbers without meaning. "1000 QMRLs" - is that good? Compared to what? | Always show comparison (vs last period, vs target). Provide trend indicators (up/down arrows). |
| Auto-refresh without indicator | Users confused when numbers change unexpectedly. Data trustworthiness questioned. | Show "Last updated: 2 minutes ago". Smooth transitions on update, not jarring number changes. |
| Complex visualizations | Users can't interpret charts quickly. Decision paralysis. | Use simple charts (bar, line, pie). Avoid 3D, unusual chart types. Dashboard should be scannable in 10 seconds. |
| No clear hierarchy | All metrics look equally important. Users don't know where to look first. | Use size, position, color to indicate priority. Critical alerts at top, supporting metrics below. |
| Dashboard for every role | Too many dashboards to maintain. Redundant code. | Build modular dashboard with role-based widget visibility. One dashboard, filtered by role. |
| Real-time at all costs | Unnecessary server load. Most business metrics don't need sub-second updates. | Refresh every 30-60 seconds for activity feed. Every 5 minutes for status counts. Real-time only for critical alerts. |

### Status Change Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Allow any status to any status | Workflow chaos. Items jump from Draft to Completed without review. | Enforce valid status transitions. Draft → Pending Review → Processing → Completed. Block invalid jumps. |
| No audit trail for status changes | Compliance issues. Can't track who changed what when. | Log every status change with user, timestamp, old status, new status. Display in history. Already planned. |
| Inline status change for everything | Some changes require additional input (rejection reason, completion notes). | Use inline change only for simple status moves. Open form/modal for status changes requiring context. |
| Too many status options in dropdown | Users overwhelmed by 15+ statuses. Slow to scan. | Limit to 6-8 statuses per entity type. Use status groups (to_do, in_progress, done) to organize. |

### Transaction Detail Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Modal for long forms | Users can't reference main list while filling form. Frustrating UX. | Use full-page form for complex creation. Use drawer for quick edits and views. |
| Edit mode always | Accidental edits. Users accidentally change data while browsing. | Default to read-only view. Explicit "Edit" button to enter edit mode. |
| No loading states | Drawer appears empty before data loads. Users think system is broken. | Show skeleton loaders in drawer while fetching data. Smooth transition to content. |
| Nested modals/drawers | Stack of dialogs confuses users. Back button doesn't work. Difficult to navigate. | Avoid nesting. If need related data, replace drawer content or open in new tab. Max one drawer at a time. |
| Full entity reload on drawer open | Slow performance. User waits for data they may not need. | Lazy load drawer content. Fetch summary first, load tabs on demand. Use caching. |

## Feature Dependencies

### Dependency Chain

```
File Attachments
├─ Basic upload (drag-drop + browse) → REQUIRED FIRST
├─ File list display → Depends on: Basic upload
├─ Delete file → Depends on: File list display
├─ Preview/download → Depends on: File list display
└─ Version history → Depends on: All above (future enhancement)

Dashboard
├─ Status count KPIs → REQUIRED FIRST (reads from DB)
├─ Activity feed → Depends on: Audit logging (Iteration 10 complete)
├─ Inventory alerts → Depends on: Items table with stock levels
├─ Real-time updates → Depends on: All KPIs implemented
└─ Customizable widgets → Depends on: All above (future enhancement)

Inline Status Change
├─ Status badge display → REQUIRED FIRST (already exists)
├─ Dropdown on click → Depends on: Status config table (exists)
├─ Optimistic update → Depends on: Basic status change API
└─ Bulk status change → Depends on: Single status change working

Transaction Detail Drawer
├─ Read-only view → REQUIRED FIRST
├─ Edit mode toggle → Depends on: Read-only view
├─ Related tabs → Depends on: Basic drawer structure
└─ Activity timeline → Depends on: Audit logs (already exists)
```

### Critical Path for MVP

**Phase 1: Foundation (Week 1)**
1. File upload infrastructure (Supabase Storage setup)
2. Basic dashboard page with placeholder widgets
3. Drawer component shell (reusable)

**Phase 2: Core Features (Week 2)**
1. File upload with drag-drop, preview, delete
2. Dashboard KPI cards (status counts, inventory alerts)
3. Inline status change (badge → dropdown → save)
4. Transaction detail drawer (view mode)

**Phase 3: Polish (Week 3)**
1. Activity feed on dashboard
2. Real-time/near-real-time dashboard updates
3. Transaction detail drawer edit mode
4. Error handling and loading states

**Defer to Post-MVP:**
- File inline viewer (PDF/image embed)
- File version history
- Customizable dashboard widgets
- Bulk status change
- Scheduled email reports
- Predictive alerts

## Implementation Complexity Matrix

| Feature Category | Core Complexity | Risk Factors | Time Estimate |
|------------------|----------------|--------------|---------------|
| File Attachments | Medium | Storage quotas, security validation, large file handling | 3-5 days |
| Management Dashboard | Medium | Real-time data aggregation, role-based filtering | 4-6 days |
| Inline Status Change | Low | Status workflow validation, optimistic UI | 1-2 days |
| Transaction Detail Drawer | Low | Component reusability, tab lazy loading | 2-3 days |

**Total Estimated MVP:** 10-16 days (2-3 weeks)

## MVP Recommendation

For MVP, prioritize table stakes features that users expect:

### Must Have (P0)
1. **File Attachments**
   - Drag-drop upload with browse fallback
   - File list display (name, size, uploader, date)
   - Individual file delete
   - File type and size validation
   - Upload progress indicator
   - Download files

2. **Management Dashboard**
   - Status count KPI cards (grouped by to_do, in_progress, done)
   - Inventory alert cards (low stock items)
   - Recent activity feed (last 20 actions)
   - Date range filter
   - Role-based view (show relevant metrics per role)

3. **Inline Status Change**
   - Click badge to open dropdown
   - Status grouped by workflow stage
   - Immediate save with optimistic update
   - Error handling with rollback

4. **Transaction Detail Drawer**
   - Slide from right (maintain context)
   - View mode by default
   - Edit mode toggle
   - Related data tabs (Details, Related Items, History)
   - Close with X or click outside

### Should Have (P1) - Post-MVP
1. File preview (inline PDF/image viewer)
2. Dashboard drill-down (click metric → filtered list)
3. Status change notes (optional comment)
4. Transaction comparison view

### Could Have (P2) - Future Enhancements
1. File version history
2. Customizable dashboard widgets
3. Bulk status change
4. Scheduled email reports
5. Predictive alerts

## Sources

### File Attachment Systems
- [Top 5 File Management Examples & Best Practices in 2026](https://research.aimultiple.com/file-management-examples/)
- [Streamline Your Workflow: Best Practices for Managing Attachments in Project Management Software](https://ones.com/blog/best-practices-managing-attachments-project-management-software/)
- [7 Document Management Best Practices in 2026](https://thedigitalprojectmanager.com/project-management/document-management-best-practices/)
- [Managing File Attachments: Best Practices for Cloud Security](https://softwaremind.com/blog/managing-file-attachments-best-practices-for-cloud-security/)
- [UX best practices for designing a file uploader](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [Drag-and-Drop UX: Guidelines and Best Practices](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/)
- [File Upload - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [File Upload Protection – 10 Best Practices for Preventing Cyber Attacks](https://www.opswat.com/blog/file-upload-protection-best-practices)

### Management Dashboard Design
- [Product Management Dashboard: How to Build One (2026 Guide)](https://monday.com/blog/rnd/product-management-dashboard/)
- [9 Dashboard Design Principles (2026)](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Top Admin Dashboard Design Ideas for 2026](https://www.fanruan.com/en/blog/top-admin-dashboard-design-ideas-inspiration)
- [What is a KPI Dashboard? Complete Guide to Key Performance Indicators Dashboards 2026](https://improvado.io/blog/kpi-dashboard)
- [Top 10 dashboard design mistakes (and what to do about them)](https://www.domo.com/learn/article/top-10-dashboard-design-mistakes-and-what-to-do-about-them)
- [Bad Dashboard Examples: 10 Common Dashboard Design Mistakes to Avoid](https://databox.com/bad-dashboard-examples)
- [Seven Anti-Patterns for Analytics Dashboards](https://kevingee.biz/?p=144)

### Inventory Alerts
- [Modernizing operations: your guide to unified stock inventory software for 2026](https://monday.com/blog/service/stock-inventory-software/)
- [Low Stock & Inventory Alert Software](https://www.dynamicinventory.net/low-stock-alerts/)
- [Top 10 Low Stock Alert Apps to Prevent Stockouts](https://www.sumtracker.com/blog/10-low-stock-alert-apps)

### Activity Feeds
- [A Guide to Designing Chronological Activity Feeds](https://www.aubergine.co/insights/a-guide-to-designing-chronological-activity-feeds)
- [Activity Stream design pattern](https://ui-patterns.com/patterns/ActivityStream)
- [What are Activity Feeds in UI Design and How to Use Them?](https://www.uinkits.com/blog-post/what-are-activity-feeds-in-ui-design-and-how-to-use-them)
- [Activity Feed Design the Ultimate Guide](https://getstream.io/blog/activity-feed-design/)

### Inline Status Changes
- [Status indicators - Carbon Design System](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Exploring Badge UI Design: Tips, Tricks, Usability, and Use Cases](https://www.setproduct.com/blog/badge-ui-design)
- [Case study: Designing for status changes](https://medium.com/design-bootcamp/ux-design-for-status-19e8a92b2aa3)
- [The Right Way to Design Table Status Badges](https://uxmovement.medium.com/the-right-way-to-design-table-status-badges-31f65a927dab)

### Transaction Detail Modals/Drawers
- [Modal UX Design for SaaS in 2026 - Best Practices & Examples](https://userpilot.com/blog/modal-ux-design/)
- [Modal vs Drawer — When to use the right component](https://medium.com/@ninad.kotasthane/modal-vs-drawer-when-to-use-the-right-component-af0a76b952da)
- [Side Drawer UI: A Guide to Smarter Navigation](https://www.designmonks.co/blog/side-drawer-ui)
- [Carbon Design System - Modal Usage](https://carbondesignsystem.com/components/modal/usage/)
- [Modal vs Popover vs Drawer vs Tooltip: When to Use Each (2025 Guide)](https://uxpatterns.dev/pattern-guide/modal-vs-popover-guide)

### File Size & Type Restrictions
- [SharePoint limits - Service Descriptions](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits)
- [Is there a size limit for documents to be e-signed?](https://www.esignglobal.com/blog/size-limit-documents-e-signed-upload-capacity)
- [Unrestricted File Upload - OWASP Foundation](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [File Upload Vulnerabilities and Security Best Practices](https://www.vaadata.com/blog/file-upload-vulnerabilities-and-security-best-practices/)
