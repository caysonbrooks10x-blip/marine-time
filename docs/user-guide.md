# MarineTime — User Guide

## For Workers

### First-Time Login
1. Open the app URL on your phone
2. Enter your Employee Code (e.g., W001)
3. Enter your 4-digit PIN
4. Tap "Clock In"
5. When prompted, allow GPS and Camera access

### Clocking In
1. Select your project from the list
2. Select a sub-project if applicable
3. Take a selfie (optional — tap "Skip Photo" to skip)
4. Wait for GPS to lock — stay in an open area
5. You'll see a confirmation with your distance from the site

### Clocking Out
1. Open the app — your active session shows automatically
2. Tap the red "CLOCK OUT" button
3. Wait for GPS to lock
4. You'll see your total hours for the shift

### Offline Mode
- If you have no internet, you can still clock in/out
- A yellow banner shows "You are offline"
- Records queue locally and sync automatically when you're back online
- Do not clear browser data while offline — queued records will be lost

### Install as App (PWA)
- **Android**: Tap the browser menu > "Add to Home Screen"
- **iOS**: Tap Share > "Add to Home Screen"
- The app works like a native app after installation

## For Supervisors

### Login
1. Go to `/supervisor/login`
2. Sign in with your email and password

### Approving Records
1. The Approvals page shows pending attendance records
2. Each card shows: worker name, project, times, GPS distance, photo
3. Add an optional note in the text field
4. Tap "Approve" or "Reject"
5. Use "Show All" to see previously reviewed records

### What to Check
- GPS distance: green (< 100m) is good, amber (> 100m) may need review
- "Submitted offline" flag: the record was queued and synced later
- Photo: verify the worker matches the expected person
- Duration: check for unusually long or short shifts

## For Admins

### Dashboard (`/admin/dashboard`)
- Summary cards: total workers, currently clocked in, pending approvals, weekly hours
- Quick links to all admin pages
- Recent activity feed

### Workers (`/admin/workers`)
- View all workers with their codes and roles
- Add new workers: set employee code, name, role, and 4-digit PIN
- Edit existing workers: change name, role, PIN, or supervisor assignment
- Deactivate workers who leave (preserves their attendance history)

### Sites (`/admin/sites`)
- View all geofenced work sites
- Add new sites: enter name, GPS coordinates, and geofence radius
- Use "Use Current Location" button when physically at the site
- Preview location on OpenStreetMap before saving
- Deactivate sites no longer in use

### Payroll Export (`/admin/payroll`)
- Select a date range using the date pickers or quick presets
- Tap "Export CSV" to download the attendance report
- CSV includes: employee code, name, project, times, hours, GPS distance, status
- Import the CSV into your payroll system or spreadsheet
