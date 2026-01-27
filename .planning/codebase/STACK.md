# Technology Stack

**Analysis Date:** 2025-01-27

## Languages

**Primary:**
- TypeScript 5.6.2 - Full application codebase with strict mode enabled
- JavaScript - Next.js configuration and build scripts

**Secondary:**
- SQL - Supabase database migrations (PostgreSQL 14.1)

## Runtime

**Environment:**
- Node.js (version managed via npm)
- Vercel deployment platform

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 14.2.13 - Frontend framework with App Router (server/client component hybrid)
- React 18.3.1 - UI library

**UI & Component System:**
- Radix UI - Headless UI primitive library for accessible components
  - @radix-ui/react-dialog (modal dialogs)
  - @radix-ui/react-dropdown-menu (menu components)
  - @radix-ui/react-label (form labels)
  - @radix-ui/react-popover (popover overlays)
  - @radix-ui/react-select (dropdown selects)
  - @radix-ui/react-separator (dividers)
  - @radix-ui/react-slot (component composition)
  - @radix-ui/react-tabs (tab interfaces)
  - @radix-ui/react-toast (toast notifications)
  - @radix-ui/react-tooltip (tooltips)

**Styling & Theming:**
- Tailwind CSS 3.4.13 - Utility-first CSS framework with dark mode support
- Class Variance Authority 0.7.1 - Component variant system for consistent styling
- Tailwind Merge 2.5.2 - Smart CSS class merging to prevent conflicts
- Tailwindcss Animate 1.0.7 - Animation utilities extension
- Motion 11.11.4 - Animation library for declarative motion

**Data & State Management:**
- React Hook Form 7.53.0 - Lightweight form state management
- @hookform/resolvers 3.9.0 - Zod validation integration for React Hook Form
- Zod 3.23.8 - TypeScript-first schema validation library

**Tables & Data Display:**
- @tanstack/react-table 8.21.3 - Headless table library for complex data tables

**Date/Time:**
- date-fns 3.6.0 - Date manipulation utilities (immutable, functional)
- react-day-picker 8.10.1 - Calendar date picker component

**Icons:**
- lucide-react 0.447.0 - Icon library with React components

**Database & Backend:**
- @supabase/supabase-js 2.50.0 - Supabase SDK for client-side and server-side operations
- @supabase/ssr 0.8.0 - Server-Side Rendering utilities for Supabase auth with Next.js

**Development & Build Tools:**
- TypeScript - Type checking with strict mode (`strict: true`)
- ESLint 8.57.1 - Code linting and style enforcement
- Prettier 3.3.3 - Code formatting with 100 character print width
- prettier-plugin-tailwindcss 0.6.6 - Tailwind CSS class sorting in Prettier
- PostCSS 8.4.47 - CSS transformation
- Autoprefixer 10.4.20 - Vendor prefix management

**Utilities:**
- clsx 2.1.1 - Conditional CSS class concatenation

## Key Dependencies

**Critical:**
- @supabase/supabase-js - Database, auth, file storage, and real-time data management
- Next.js - Framework backbone with server components, middleware, API routes
- React - UI rendering engine
- Tailwind CSS - All styling and layout
- TypeScript - Type safety across entire codebase

**Infrastructure:**
- Zod - Schema validation for forms and API payloads
- React Hook Form - Form state without bloat
- @tanstack/react-table - Complex data table rendering with sorting/filtering/pagination

## Configuration

**Environment:**
- Supabase project credentials via environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase API endpoint
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key for client-side auth
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for server-side privileged operations
  - `NEXT_PUBLIC_APP_NAME` - Application display name
  - `NEXT_PUBLIC_APP_URL` - App base URL for redirects
- See `.env.local.example` for template

**Build:**
- `next.config.mjs` - Next.js configuration with remote image patterns for Supabase storage
- `tsconfig.json` - TypeScript configuration with path aliases for clean imports
- `tailwind.config.ts` - Tailwind theming with dark mode, custom colors (brand, sidebar, status), and semantic color tokens
- `postcss.config.mjs` - PostCSS with Tailwind and Autoprefixer
- `.eslintrc.json` - ESLint extending Next.js core-web-vitals and Prettier
- `.prettierrc` - Prettier config with semicolons, double quotes, 2-space tabs, 100 char line width, Tailwind class sorting

## Platform Requirements

**Development:**
- Node.js and npm installed
- Supabase account and project
- .env.local with Supabase credentials
- Run `npm run dev` on localhost:3000

**Production:**
- Deployment via Vercel (configured in `.vercel/project.json`)
- Environment variables configured in Vercel project settings
- Automatic builds and deployments on git push
- Edge Functions support via Supabase

## Database

**Technology:**
- PostgreSQL 14.1 via Supabase managed cloud

**Architecture:**
- Role-Based Access Control (RBAC) with Supabase Auth
- Row-Level Security (RLS) policies for data isolation
- 30+ migration files in `supabase/migrations/` with incremental schema builds
- Types auto-generated to `types/database.ts` from schema

**Key Components:**
- Audit logging system with trigger-based history
- Soft-delete pattern using `is_active` boolean fields
- Hierarchical departments with self-referential foreign keys
- Normalized schema with proper indexing for performance

---

*Stack analysis: 2025-01-27*
