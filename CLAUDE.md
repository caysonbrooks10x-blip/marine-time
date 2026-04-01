# MarineTime

GPS-verified field attendance and timesheet system for marine operations. Workers clock in/out via phone or shared tablet. GPS captures location at clock events only — not continuously. Offline queue syncs when connectivity restores.

## Quick Start

```bash
cd /Users/a1/Downloads/marine-time
npm install
cp .env.example .env.local
# Add Supabase URL and keys to .env.local
npm run dev   # http://localhost:3000
```

Run migrations in Supabase Studio SQL editor in order:
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/migrations/003_indexes.sql
4. supabase/seed.sql (dev only)

## Development Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npx vitest           # Unit tests
npx playwright test  # E2E tests
```

## Project Structure

```
src/
  app/
    (worker)/         # Worker-facing routes: login, clock-in/out
    (supervisor)/     # Supervisor routes: approvals, worker list, daily roster
    (admin)/          # Admin routes: dashboard, workers, sites, payroll
    api/              # All backend API routes
  components/
    CameraCapture.tsx       # MediaDevices selfie — always has Skip button
    ProjectSelector.tsx     # Project + sub-project picker (large tap targets)
    SiteSelector.tsx        # Work site picker
    OfflineBanner.tsx       # Yellow offline indicator
    PinPad.tsx              # Large PIN numpad
  lib/
    supabase/
      server.ts             # createServerClient — use in API routes ONLY
      client.ts             # createBrowserClient — use in 'use client' components ONLY
    haversine.ts            # Haversine distance formula — use this, don't reimplement
    rate-limit.ts           # In-memory rate limiter (PIN login: 5 attempts/60s per IP)
    offline-queue.ts        # IndexedDB clock event queue
    company-timesheet/
      rules.ts              # Break deductions, pay rules, day types
      excel-export.ts       # Monthly company workbook generation
      daily-sheet-export.ts # Daily sheet Excel (replaces paper form)
  hooks/
    useOfflineSync.ts       # Syncs queue on window online event
supabase/
  migrations/               # SQL migrations — run in numbered order
docs/
  architecture.md, security-audit.md, deployment.md, user-guide.md
tests/
  e2e/                      # Playwright tests
  unit/                     # Vitest unit tests
public/
  manifest.json, sw.js, icon-192.png, icon-512.png
```

## Code Style

- TypeScript strict mode — no implicit any, no non-null assertions without explanation
- zod for all API input validation — never trust req.json() directly
- Tailwind CSS only — no inline styles
- Minimum touch target: 48x48px (field workers on phones in bad conditions)
- Minimum font size: 18px body text (outdoor readability)
- Dark theme base: bg-slate-900 text-slate-50 for worker screens

## Key Rules

### GPS
- GPS fires ONLY when worker taps Clock In or Clock Out — never on page load, never on a timer
- Always: `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }`
- GPS failure: show specific error with retry option — do NOT silently skip
- Never log GPS coordinates to console — security finding

### Photo
- Photo capture always optional — Skip button must always be visible without scrolling
- Upload to private Supabase Storage bucket "attendance-photos"
- Always createSignedUrl with 604800s expiry — never store public bucket URLs
- Never store base64 photo in IndexedDB offline queue — store null for photo_url when offline

### Security
- SUPABASE_SERVICE_ROLE_KEY: used ONLY in `src/app/api/` and `src/lib/supabase/server.ts`
- Every API route: `supabase.auth.getUser()` then check error, then DB operation
- Every API route: `zod.parse()` body before DB operation
- PIN hash: bcryptjs saltRounds 12 — never MD5, SHA1, plain text
- PIN login rate-limited: 5 attempts per IP per 60 seconds (src/lib/rate-limit.ts)
- API error responses: never expose err.message to clients — use generic messages

### Daily Roster
- The `daily_roster_entries` table records non-attendance statuses (POFF, MC, Home Leave, etc.)
- Workers who clock in are automatically "present" — no roster entry needed
- Only workers who did NOT clock in need a roster entry from a supervisor
- Valid statuses: project_off, off, absent, home_leave, mc, no_job, supply, resign
- UNIQUE(worker_id, work_date) — one status per worker per day
- Migration: `004_daily_roster.sql`

### Database
- Never query Supabase from client components with service role key
- RLS is the security boundary — do not rely on WHERE clauses alone
- All dates stored as UTC timestamptz
- Workers table has `position` column for trade/role (Fitter, Welder, etc.)

### Offline
- IndexedDB queue stores: worker_id, project_id, sub_project_id, site_id, lat, lng, type, timestamp, log_id
- photo_url is always null in offline queue
- Show queue depth in UI: "2 records pending sync"
- Supabase free tier pauses after 1 week inactivity — handle this error gracefully

## Git Workflow

Commit format: `type(scope): message`
Types: feat, fix, security, chore, docs, test

Examples:
- `feat(clock): add geofence validation with distance feedback`
- `security(photos): switch to signed URL storage`
- `fix(offline): resolve duplicate sync on rapid reconnect`

## Non-Obvious Rules

1. Route groups (worker), (supervisor), (admin) use parentheses — Next.js App Router grouping, not URL paths.
2. Import idb dynamically: `const { openDB } = await import('idb')` — avoids SSR errors.
3. On shared tablets: use sessionStorage for PIN state, NOT localStorage.
4. Marine GPS accuracy: 5-15m on Android at a dock. Minimum geofence radius is 50m.
5. photo_url is always null in the offline queue — photos only upload when online.
