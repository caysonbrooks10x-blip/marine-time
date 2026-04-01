# MarineTime — Deployment Runbook

## Prerequisites

- Node.js 18+
- Supabase project (free tier works)
- Vercel account (free tier works)

## 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run migrations in order:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_rls_policies.sql
   supabase/migrations/003_indexes.sql
   ```
3. Create Storage buckets:
   - `attendance-photos` (private)
   - `payroll-exports` (private)
4. Copy your project URL and keys from Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (keep secret — never expose to client)

## 2. Create Admin User

1. In Supabase Auth > Users, create a user with email/password
2. Run this SQL to link them as admin:
   ```sql
   INSERT INTO workers (employee_code, name, role, auth_user_id, is_active)
   VALUES ('ADMIN1', 'Admin Name', 'admin', '<auth-user-uuid>', true);
   ```

## 3. Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = your Vercel domain
4. Deploy

## 4. Post-Deploy Checklist

- [ ] Test worker PIN login with a test worker
- [ ] Test clock-in with GPS (must be at a configured site)
- [ ] Test clock-out
- [ ] Test supervisor login and approval workflow
- [ ] Test admin dashboard loads
- [ ] Test payroll CSV export
- [ ] Test PWA install prompt on mobile
- [ ] Test offline mode: enable airplane mode, clock in, re-enable, verify sync
- [ ] Verify HTTPS is enforced (Vercel does this automatically)

## 5. Supabase Webhook (Google Sheets + Live Excel)

This enables real-time sync to Google Sheets and auto-regeneration of the live Excel file on every clock event.

1. Generate a webhook secret: `openssl rand -hex 32`
2. Add to Vercel env vars: `WEBHOOK_SECRET=<your-secret>`
3. In Supabase Dashboard → Database → Webhooks → Create a new webhook:
   - **Table**: `attendance_logs`
   - **Events**: `INSERT`, `UPDATE`
   - **URL**: `https://your-domain.com/api/webhooks/clock-event`
   - **Method**: POST
   - **Headers**: `x-webhook-secret: <your-secret>`
4. Save the webhook
5. To initialize Google Sheets (if configured):
   - Go to Admin → Payroll → Initialize Google Sheets
   - This creates 4 sheets with headers and formatting
6. To generate the first Excel file:
   - Go to Admin → Payroll → Regenerate (next to Download Live Excel)

## 6. PWA Icons

Replace placeholder icons in `public/icons/`:
- `icon-192.png` — 192x192 PNG
- `icon-512.png` — 512x512 PNG

Use your company logo on a navy (#0f172a) background.

## 6. Custom Domain (Optional)

1. Add domain in Vercel project settings
2. Update DNS records
3. Update `NEXT_PUBLIC_APP_URL` env var
4. Update Supabase Auth > URL Configuration with the new domain

## 7. Monitoring

- Supabase Dashboard: monitor DB size, auth users, storage usage
- Vercel Analytics: page load times, error rates
- Check Supabase free tier limits:
  - 500MB database
  - 1GB storage
  - 50,000 monthly active users
  - 2GB bandwidth
