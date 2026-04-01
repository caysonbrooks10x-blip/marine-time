# MarineTime — Architecture

## Overview

MarineTime is a GPS-verified field attendance system for marine operations. It is a mobile-first Progressive Web App built on Next.js and Supabase.

```
Browser / PWA
  └── Next.js 14 (App Router, React 18)
        ├── (worker)/        — PIN login, clock in/out, history
        ├── (supervisor)/    — approvals, live worker status
        ├── (admin)/         — dashboard, workers, sites, projects, analytics, payroll
        ├── /kiosk           — shared tablet mode (public, PIN-secured per action)
        └── /api/            — all server logic (API routes)
              ├── auth/      — PIN login → Supabase session
              ├── attendance/ — clock-in, clock-out, active, history, force-clock-out
              ├── approvals/ — supervisor approval workflow
              ├── projects/  — project list for picker
              ├── payroll/   — CSV + PDF export
              ├── admin/     — dashboard, workers, sites, projects, analytics, sheets
              ├── kiosk/     — public worker list (no auth, PIN required per action)
              └── webhooks/  — Supabase DB webhook receiver → Google Sheets + Excel sync

Supabase (Postgres)
  ├── Auth         — sessions for supervisors, admins, and workers (via PIN→JWT)
  ├── Database     — 8 tables with Row Level Security
  └── Storage      — attendance-photos (private), payroll-exports (private)

Google Sheets (optional)
  — Real-time sync via Supabase webhook → googleapis service account

Excel (always-on)
  — Regenerated on every clock event, stored as live-attendance.xlsx in Storage
```

## Request Flow

### Worker Clock-In
```
Phone → POST /api/attendance/clock-in
  1. supabase.auth.getUser()         → verify JWT session
  2. Fetch worker by auth_user_id    → get worker.id
  3. Check no open session exists    → 409 if already clocked in
  4. Fetch site_location             → get lat/lng/radius
  5. haversineMeters(...)            → compute distance
  6. Insert attendance_log           → status: 'pending'
  7. Return { log_id, distance }
  ↓
Phone → POST /api/attendance/upload-photo (if photo taken)
  1. Decode base64 → Buffer
  2. Upload to Supabase Storage "attendance-photos"
  3. createSignedUrl (7-day expiry)
  4. Update attendance_log.photo_proof_url
  ↓
Supabase webhook → POST /api/webhooks/clock-event
  1. Verify x-webhook-secret header
  2. Fetch full log with joins
  3. syncToGoogleSheets(log)   → append row to Sheet 1
  4. regenerateExcel(client)   → overwrite live-attendance.xlsx
```

### Offline Clock-In
```
Phone (no internet)
  → addClockEvent() → IndexedDB queue
  → OfflineBanner shows queue count

Phone comes online
  → useOfflineSync hook detects window 'online' event
  → syncQueue() iterates IndexedDB
  → POST /api/attendance/clock-in with offline_queued: true
  → Removes from queue on success
```

## Database Schema

```
workers              — employees with role, PIN hash, supervisor link
projects             — project codes (BERTH-MAINT-2024)
sub_projects         — task codes under projects (PAINT-HULL)
site_locations       — GPS-geofenced work sites (lat, lng, radius_meters)
attendance_logs      — core table: clock_in_at, clock_out_at, GPS, photo, status
gps_logs             — optional GPS breadcrumbs at clock events
approvals            — supervisor decisions: approved/rejected + notes
payroll_exports      — audit trail of every export run
```

## Security Model

- **Authentication**: Supabase Auth (JWTs). Workers use PIN → auto-created `{code}@marinetime.internal` auth user. Supervisors/admins use email+password.
- **Authorization**: Row Level Security on all 8 tables. Workers see own records only. Supervisors see their direct reports. Admins see all.
- **PIN storage**: bcrypt saltRounds:12. Never stored plain or as MD5/SHA.
- **Photos**: Private Supabase Storage bucket. Signed URLs with 7-day expiry. Never public URLs.
- **Service role key**: Used only in API routes via `createAdminClient()`. Never exposed to browser.
- **GPS**: Captured only on explicit user action (clock-in/out tap). Never on page load or timer. Never logged to console.
- **Kiosk mode**: Worker list is public (names only, no sensitive data). Every action still requires PIN verification.
- **Webhooks**: Protected by `x-webhook-secret` header (random 32-byte hex secret).

## Key Design Decisions

| Decision | Rationale |
|---|---|
| GPS only on tap | Privacy + battery. Never continuous tracking. |
| Server-side geofence | Client-side GPS distance is display-only. Can't be spoofed. |
| IndexedDB offline queue | Workers in poor connectivity zones. Clock events never lost. |
| PIN → Supabase auth user | Workers don't have emails. Bridge: deterministic email from code. |
| Private photo bucket + signed URLs | Photos contain faces. 7-day URLs limit exposure. |
| Supabase free tier | Fits 50 workers comfortably. 500MB DB, 1GB storage. |
| Vercel free tier | Serverless API routes. Zero cold start penalty for field use. |

## Spreadsheet Sync Architecture

```
Clock event in DB
       ↓
Supabase Database Webhook (INSERT/UPDATE on attendance_logs)
       ↓
POST /api/webhooks/clock-event
       ├── syncToGoogleSheets()   → googleapis JWT → Sheets API
       │     - Append row on clock-in
       │     - Update row on clock-out (match by Log ID column)
       │
       └── regenerateExcel()      → exceljs
             - Fetch last 90 days of logs
             - Build 4-sheet workbook (Attendance, Daily, Projects, Pending)
             - Upload as live-attendance.xlsx to Supabase Storage (upsert)
             - Admin downloads via signed URL from /api/admin/export/excel
```
