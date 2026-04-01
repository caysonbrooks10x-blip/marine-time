# MarineTime — Admin Runbook

## Common Tasks

### Add a New Worker
1. Go to Admin > Workers
2. Click "+ Add Worker"
3. Fill in:
   - **Employee Code**: unique identifier (e.g., W005)
   - **Name**: full name
   - **Role**: worker, supervisor, or admin
   - **PIN**: 4-digit PIN for clock-in/out
   - **Supervisor**: assign a supervisor (for workers only)
4. Click "Create"

### Reset a Worker's PIN
1. Go to Admin > Workers
2. Click "Edit" on the worker's card
3. Enter a new 4-digit PIN
4. Click "Update"
5. Communicate the new PIN to the worker securely

### Add a New Site
1. Go to Admin > Sites
2. Click "+ Add Site"
3. Enter the site name
4. For coordinates, either:
   - Go to the site physically and tap "Use Current Location"
   - Find coordinates on Google Maps (right-click > copy coordinates)
5. Set the geofence radius (typically 50–150m for marine sites)
6. Click "Create"

### Deactivate a Worker
1. Go to Admin > Workers
2. Click "Deactivate" on the worker's card
3. The worker can no longer log in
4. Their attendance history is preserved

### Run Payroll Export
1. Go to Admin > Payroll
2. Select the pay period dates
3. Click "Export CSV"
4. The CSV downloads automatically
5. A copy is also stored in Supabase Storage (payroll-exports bucket)

## Troubleshooting

### Worker Can't Clock In
1. **GPS denied**: Worker must allow location access in phone settings
2. **Outside geofence**: Check the site's radius — may need to increase it
3. **Already clocked in**: Worker has an open session — must clock out first
4. **Offline**: Record will queue and sync when online — this is normal

### Attendance Record Shows Wrong Location
- GPS accuracy varies by device and environment
- Indoor locations or near tall structures reduce accuracy
- The distance shown is from the site center point
- Consider increasing the geofence radius for difficult sites

### Worker Lost Their PIN
- Admin resets it via Workers page (see above)
- There is no self-service PIN reset — by design for field security

### Payroll Export Shows No Records
- Check the date range — records must have both clock-in AND clock-out
- Records still "clocked in" (no clock-out) are excluded
- Any approval status is included in the export

### Offline Records Not Syncing
- Worker must open the app while online
- Check for the blue "Syncing" banner
- If stuck, check browser developer tools > Application > IndexedDB
- As a last resort, the worker can clear the browser cache (queued records will be lost)

## Database Maintenance

### Check Database Size
- Supabase Dashboard > Database > Database size
- Free tier limit: 500MB
- Attendance records are small (~200 bytes each)
- Photos are stored in Supabase Storage, not the database

### Archive Old Records
If approaching the database limit, export old records via payroll export, then:
```sql
-- Delete attendance logs older than 1 year (adjust as needed)
DELETE FROM attendance_logs
WHERE clock_in_at < NOW() - INTERVAL '1 year'
  AND status IN ('approved', 'rejected');
```

### Storage Cleanup
Photo signed URLs expire after 7 days. The actual files remain in storage.
To clean old photos:
```sql
-- Find photo URLs older than 90 days
SELECT id, photo_proof_url, clock_in_at
FROM attendance_logs
WHERE photo_proof_url IS NOT NULL
  AND clock_in_at < NOW() - INTERVAL '90 days';
```
Then delete from Supabase Storage > attendance-photos bucket.
