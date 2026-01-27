# External Integrations

**Analysis Date:** 2025-01-27

## APIs & External Services

**Supabase:**
- Service: PostgreSQL database, authentication, file storage, real-time subscriptions
- SDK: `@supabase/supabase-js` 2.50.0 and `@supabase/ssr` 0.8.0
- Auth method: Email OTP / Magic Link via Supabase Auth
- Endpoints: `https://{project-ref}.supabase.co`
- Client initialization: `createClient()` in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server)

## Data Storage

**Databases:**
- **PostgreSQL 14.1** (Supabase managed)
  - Connection: Via `@supabase/supabase-js` client
  - Client: Supabase PostgREST API (auto-generated REST endpoints)
  - ORM: None - direct SQL via PostgREST queries
  - Schema: 30+ migrations in `supabase/migrations/` with audit triggers and RLS policies
  - Tables include: departments, users, status_config, categories, contact_persons, suppliers, items, warehouses, qmrl, qmhq, purchase_orders, invoices, inventory_transactions, financial_transactions

**File Storage:**
- **Supabase Storage**
  - Bucket: `attachments` (auto-created if missing)
  - Upload endpoint: `POST /api/upload` in `app/api/upload/route.ts`
  - File types: Images only (JPEG, PNG, GIF, WebP)
  - Size limit: 5MB per file
  - Access: Public URLs for image retrieval
  - Implementation: Uses service role key for server-side uploads with admin client

**Caching:**
- None - real-time data through Supabase PostgREST API
- Optional: Client-side state management with React context (auth provider in `components/providers/auth-provider.tsx`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email-based)
- Implementation in `lib/supabase/middleware.ts`:
  - Magic Link / Email OTP sign-in via `/app/(auth)/login/page.tsx`
  - Session management with automatic token refresh
  - Middleware-based route protection in `middleware.ts`
  - Public routes: `/login`, `/auth/callback`, `/auth/confirm`
  - Protected routes: All dashboard routes redirect to `/login` if unauthenticated

**User Context:**
- Auth provider: `components/providers/auth-provider.tsx`
- Exposes: `useUser()` hook for accessing current user and role
- Session tracking: 6-hour timeout with activity markers
- Tab-aware session management using `sessionStorage` and `localStorage`

**Roles:**
- admin, quartermaster, finance, inventory, proposal, frontline, requester
- Stored in `users` table with `role` enum field
- Used for permission checks and RLS policy enforcement

## Monitoring & Observability

**Error Tracking:**
- Not detected - error handling is manual with try-catch blocks
- Console logging for debugging in development
- Error response returns via Next.js API routes and client-side error states

**Logs:**
- Console-based logging (browser console and server logs)
- Audit logs stored in database via triggers (see `supabase/migrations/` for audit table)
- Supabase automatically logs all database queries in cloud project

## CI/CD & Deployment

**Hosting:**
- Vercel (configured via `.vercel/project.json` with project ID and org ID)
- Environment: Node.js runtime on Vercel edge and serverless functions
- Automatic deployments on git push to connected repository

**CI Pipeline:**
- Vercel Builds: Automatic on repository push
- Build command: `npm run build` (Next.js build)
- Lint/Type checking: `npm run lint` and `npm run type-check` (can be configured in Vercel settings)
- No additional CI/CD service - Vercel handles build automation

**Database Deployment:**
- Supabase migrations: `supabase/migrations/*.sql` files
- Push to remote: `npx supabase db push`
- Local development: `npx supabase start` (local PostgreSQL)
- Reset: `npx supabase db reset` (runs all migrations locally)

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (e.g., `https://xxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only, NEVER expose to client)
- `NEXT_PUBLIC_APP_NAME` - Application name for display
- `NEXT_PUBLIC_APP_URL` - Base URL for redirects and links

**Secrets location:**
- Development: `.env.local` file (git-ignored)
- Production: Vercel environment variables in project settings
- Template: `.env.local.example` provides structure

**Public vs Private:**
- Prefix `NEXT_PUBLIC_` makes vars available in browser
- Private vars (no prefix) only available on server
- Service role key MUST NOT have `NEXT_PUBLIC_` prefix

## Authentication Flow

**Email OTP/Magic Link:**

1. User enters email on `/app/(auth)/login/page.tsx`
2. Supabase Auth sends OTP/magic link to email
3. User clicks link or enters OTP → redirects to `/auth/callback`
4. Callback route confirms authentication and creates session
5. Middleware (`middleware.ts`) validates session on each request
6. If authenticated: access to `/app/(dashboard)/*` routes
7. If not authenticated: redirects back to `/login`

**Session Management:**
- Stored in secure HTTP-only cookies (managed by Supabase)
- Auto-refresh via middleware on each request
- 6-hour timeout on inactivity (via auth provider)
- Cross-tab detection prevents sessions from persisting across browser tab closures

## API Routes

**Internal Endpoints:**
- `POST /api/upload` - File upload to Supabase Storage
  - Location: `app/api/upload/route.ts`
  - Auth: Requires valid session
  - Accepts: multipart/form-data with `file` and `folder` fields
  - Returns: `{ url, path }` with public image URL
  - Validation: Image type check, 5MB size limit

- `POST /api/admin/invite-user` - Invite new user (admin only)
  - Location: `app/api/admin/invite-user/route.ts`
  - Auth: Requires admin role
  - Body: `{ email, full_name, role, department_id, phone }`
  - Action: Sends invitation email via Supabase Auth
  - Creates user record in `users` table

**Database API:**
- All data queries go through Supabase PostgREST API
- Automatic REST endpoints for each table
- RLS policies enforce row-level permissions
- Queries made via `supabase.from('table').select()` pattern

## Webhooks & Callbacks

**Incoming:**
- `/auth/callback` - OAuth/magic link callback from Supabase Auth
  - Handled by middleware, confirms auth session
  - Returns to dashboard on success

- `/auth/confirm` - Email confirmation endpoint
  - Listed as public route in middleware
  - Handled by Supabase Auth callback flow

**Outgoing:**
- None detected - no outbound webhooks to external services
- Internal audit triggers record all data mutations to `audit_logs` table

## Data Flow Architecture

**Client to Server:**
1. Client browser makes request via fetch/Supabase SDK
2. Middleware validates auth session and token
3. Request reaches Next.js API route or server component
4. Server uses service role key (with elevated permissions) or client key (restricted by RLS)
5. Response sent back with results or error

**Server Persistence:**
1. Server-side code uses `createClient()` from `lib/supabase/server.ts`
2. Server client gets user from session
3. Queries execute against PostgreSQL via PostgREST
4. RLS policies enforce user-level restrictions
5. Audit triggers capture changes automatically

**Real-time Capabilities:**
- Supabase supports real-time subscriptions (included in SDK)
- Not heavily used in current codebase
- Can be added with `supabase.on()` for live data sync

---

*Integration audit: 2025-01-27*
