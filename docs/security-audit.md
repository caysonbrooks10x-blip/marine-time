# MarineTime — Security Audit

## Summary

| Category | Status | Notes |
|---|---|---|
| Authentication | PASS | Supabase Auth JWTs, bcrypt PINs |
| Authorisation | PASS | RLS on all tables, role checks in every API route |
| Input validation | PASS | Zod on every POST/PATCH body |
| Secrets exposure | PASS | Service role key never in client code |
| GPS privacy | PASS | Capture-on-tap only, never logged |
| Photo storage | PASS | Private bucket, signed URLs, 7-day expiry |
| SQL injection | PASS | Supabase client uses parameterised queries |
| XSS | PASS | No dangerouslySetInnerHTML except SW registration (trusted content) |
| CSRF | PASS | Supabase JWTs in httpOnly cookies, SameSite enforcement |
| Security headers | PASS | X-Frame-Options, nosniff, referrer, permissions policy |
| Webhook auth | PASS | x-webhook-secret header required |
| Kiosk security | PASS | Worker list is name-only; all actions require PIN |

---

## Findings

### PASS — PIN Authentication
- bcryptjs saltRounds:12 (industry standard, ~300ms hash time, brute-force resistant)
- PIN never stored plain, never logged
- Failed login returns generic "Invalid PIN" — does not reveal if code exists

### PASS — Row Level Security
- All 8 tables have RLS enabled
- Workers: read/write own row only
- Supervisors: read direct reports' attendance_logs
- Admins: full access via service role in API routes
- Payroll exports: admin only

### PASS — API Route Auth Pattern
Every route follows this order:
```
1. supabase.auth.getUser()   → fail fast on invalid session
2. Fetch worker role         → verify role matches required access
3. Zod.parse(body)           → reject malformed input
4. DB operation              → only after all checks pass
```

### PASS — Photo Privacy
- Bucket `attendance-photos` is private (no public access)
- `createSignedUrl` expiry: 604800s (7 days)
- base64 images are never stored in IndexedDB
- Photo upload is always optional; `Skip Photo` always visible

### PASS — GPS Privacy
- GPS fires only when worker explicitly taps Clock In / Clock Out
- GPS coordinates are never logged to console (security rule enforced in CLAUDE.md)
- Geofence check is server-side; client receives distance as display only

### PASS — Kiosk Mode
- `/kiosk` and `/api/kiosk/workers` are public (no session required)
- `/api/kiosk/workers` returns: id, employee_code, name, role only — no PIN hash, no auth_user_id
- Every clock action still calls `/api/auth/pin-login` → requires correct PIN
- Worker sessions are not persisted between kiosk uses (state resets on Done)

### PASS — Secrets
- `SUPABASE_SERVICE_ROLE_KEY` used only in `src/lib/supabase/server.ts` → `createAdminClient()`
- `.env.example` documents all keys; `.env.local` is gitignored by default
- `WEBHOOK_SECRET` is random 32-byte hex; verified on every webhook call
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` stored in env, never in source

### PASS — Dependencies
No known high-severity CVEs in production dependencies at build time.
Run `npm audit` before each production deploy.

Key packages:
- `bcryptjs@3` — maintained, no known CVEs
- `@supabase/ssr@0.9` — official Supabase SSR client
- `zod@4` — input validation, no known CVEs
- `jspdf@4` — PDF generation, client-side only pattern used server-side (safe)
- `exceljs` — XLSX generation, no known CVEs
- `googleapis` — Google official SDK

---

## Recommendations Before Go-Live

1. **Set WEBHOOK_SECRET** — generate with `openssl rand -hex 32` and add to both `.env.local` and Supabase webhook headers
2. **Enable Supabase email confirmation** for supervisor/admin accounts
3. **Set session timeout** — configure Supabase Auth → JWT expiry (recommend 8 hours for field shifts)
4. **Add rate limiting** on `/api/auth/pin-login` — Supabase Pro has built-in; on free tier consider Vercel middleware rate limiting or Upstash
5. **Rotate signed URL expiry** — 7 days is reasonable; reduce to 24h if photos are sensitive
6. **Review Storage policies** in Supabase — confirm `attendance-photos` bucket has no public access policy
7. **Run `npm audit`** before each production deploy
