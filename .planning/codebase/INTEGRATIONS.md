# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**None detected** - QM System is self-contained with no third-party API integrations (e.g., payment processors, SMS services, shipping APIs). All external communication is through Supabase.

## Data Storage

**Databases:**
- Supabase PostgreSQL (hosted)
  - Connection: Via `NEXT_PUBLIC_SUPABASE_URL` environment variable
  - Client: `@supabase/supabase-js` + `@supabase/ssr` for server-side rendering
  - Type-safe queries through generated TypeScript types in `types/database.ts`
  - Database version: PostgreSQL 14.1

**File Storage:**
- Supabase Storage (cloud-hosted object storage)
  - Bucket: `attachments` (auto-created at runtime)
  - Location: `app/api/upload/route.ts` handles file uploads
  - Supported: Image files only (JPEG, PNG, GIF, WebP)
  - Size limit: 5MB per file
  - Cache control: 3600 seconds
  - Access: Public URLs generated for uploaded files

**Caching:**
- None explicit - relies on Next.js built-in caching and browser cache headers

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (Email OTP / Magic Link)
  - Implementation: Email magic links for passwordless authentication
  - User invitations via admin API (`inviteUserByEmail`)
  - Session management via HTTP-only cookies
  - Middleware: `middleware.ts` handles session refresh and route protection
  - Server client: `lib/supabase/server.ts` for server-side auth operations
  - Browser client: `lib/supabase/client.ts` for client-side operations

**Authorization:**
- Custom RBAC (Role-Based Access Control) via user roles:
  - Roles: admin, quartermaster, finance, inventory, proposal, frontline, requester
  - Stored in `users` table with `role` column
  - RLS (Row-Level Security) policies planned in migrations
  - Permission checks via `lib/hooks/use-permissions.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected - standard console logging used

**Logs:**
- Server-side: Console logs in API routes and server components
- Client-side: Browser console (development)
- No centralized logging service integrated

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js optimized platform)
  - Connected via `next.config.mjs`
  - Image optimization configured for Supabase storage domain

**CI Pipeline:**
- None detected in codebase - deployment likely via Vercel's Git integration

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project endpoint (required)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public client key (required)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations (required)
- `NEXT_PUBLIC_APP_NAME` - Display name (optional, default: "QM System")
- `NEXT_PUBLIC_APP_URL` - Base URL for the application (optional, default: http://localhost:3000)

**Secrets location:**
- `.env.local` (git-ignored) - stores all credentials
- Template: `.env.local.example` documents required variables
- Service role key is loaded only on server-side, never exposed to client

## Webhooks & Callbacks

**Incoming:**
- `app/api/admin/invite-user/route.ts` - Admin endpoint to send user invitations
- `app/api/upload/route.ts` - File upload endpoint for attachment storage
- Auth callback routes: `/auth/callback` and `/auth/confirm` (Supabase Auth redirects)

**Outgoing:**
- None detected - no webhooks to external services

## Supabase Integration Details

**Authentication Flow:**
1. User requests magic link on `/login`
2. Supabase Auth sends email with confirmation link
3. User clicks link → redirects to `/auth/callback` or `/auth/confirm`
4. Session established via HTTP-only cookies
5. Middleware (`middleware.ts`) validates and refreshes session on each request

**Database Access:**
- Server components use `lib/supabase/server.ts` (cookie-aware, safe for SSR)
- Client components use `lib/supabase/client.ts` (browser-based)
- Admin operations use service role key via `createClient()` with `supabase-js`
- Queries are type-safe via generated `types/database.ts` from schema

**Storage Access:**
- Upload endpoint (`app/api/upload/route.ts`) uses admin client
- Files stored in `attachments` bucket with folder organization
- Public URLs returned for frontend display
- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

**Audit Trail:**
- Database triggers log changes to `audit_logs` table
- Migrations include audit logging setup (planned in iteration 10)
- User who made change tracked via `created_by` and `updated_by` columns

---

*Integration audit: 2026-01-26*
