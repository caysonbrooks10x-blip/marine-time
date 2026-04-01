/**
 * Google Sheets sync — appends/updates rows in real time.
 *
 * Setup (one-time):
 * 1. Go to console.cloud.google.com → New Project → Enable "Google Sheets API"
 * 2. IAM & Admin → Service Accounts → Create → Download JSON key
 * 3. Create a Google Sheet, share it with the service account email (Editor)
 * 4. Add to .env.local:
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
 *      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
 *      GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
 */

import { google } from 'googleapis'
import {
  SHEET_NAMES,
  ATTENDANCE_HEADERS,
  DAILY_HEADERS,
  PROJECT_HEADERS,
  PENDING_HEADERS,
  type AttendanceLogRow,
  formatAttendanceRow,
} from './structure'

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error('Google Sheets credentials not configured')
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID
  if (!id) throw new Error('GOOGLE_SHEETS_ID not configured')
  return id
}

/** Ensure all 4 sheets exist with correct headers. Call once on first sync. */
export async function initializeSheets() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getSheetId()

  const { data } = await sheets.spreadsheets.get({ spreadsheetId })
  const existingSheets = data.sheets?.map(s => s.properties?.title) ?? []

  const sheetsToCreate = Object.values(SHEET_NAMES).filter(n => !existingSheets.includes(n))

  if (sheetsToCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetsToCreate.map(title => ({
          addSheet: { properties: { title } },
        })),
      },
    })
  }

  // Write headers to each sheet if sheet is empty
  const headerSets: Record<string, string[]> = {
    [SHEET_NAMES.ATTENDANCE]: ATTENDANCE_HEADERS,
    [SHEET_NAMES.DAILY]: DAILY_HEADERS,
    [SHEET_NAMES.PROJECTS]: PROJECT_HEADERS,
    [SHEET_NAMES.PENDING]: PENDING_HEADERS,
  }

  for (const [sheetName, headers] of Object.entries(headerSets)) {
    const range = `${sheetName}!A1:Z1`
    const { data: existing } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    if (!existing.values || existing.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      })

      // Style the header row: bold, sky-blue background, freeze row
      const { data: sheetData } = await sheets.spreadsheets.get({ spreadsheetId })
      const sheetObj = sheetData.sheets?.find(s => s.properties?.title === sheetName)
      const sheetId = sheetObj?.properties?.sheetId ?? 0

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.008, green: 0.518, blue: 0.78 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
            {
              updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      })
    }
  }
}

/** Append or update a row in the Attendance Log sheet for a clock event */
export async function syncToGoogleSheets(log: AttendanceLogRow) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SHEETS_ID) {
    return // Silently skip if not configured
  }

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getSheetId()
  const sheetName = SHEET_NAMES.ATTENDANCE
  const row = formatAttendanceRow(log)

  // Check if this log ID already exists (clock-out update scenario)
  const { data: existing } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!Q:Q`, // Log ID column
  })

  const rows = existing.values ?? []
  const existingRowIndex = rows.findIndex(r => r[0] === log.id)

  if (existingRowIndex > 0) {
    // Row exists — update it (clock-out or status change)
    const rowNumber = existingRowIndex + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowNumber}:Q${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
  } else {
    // New row — append (clock-in)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Q`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    })
  }
}

/** Refresh the Pending Approvals sheet — replaces all rows */
export async function refreshPendingSheet(logs: AttendanceLogRow[]) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SHEETS_ID) return

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getSheetId()
  const sheetName = SHEET_NAMES.PENDING

  const pendingRows = logs
    .filter(l => l.status === 'pending')
    .map(l => {
      const row = formatAttendanceRow(l)
      // Pending sheet is a subset: Date, Code, Name, Project, ClockIn, ClockOut, Hours, GPS, Offline, ID
      return [row[0], row[2], row[3], row[5], row[10], row[11], row[12], row[13], row[15], row[16]]
    })

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A2:Z`,
  })

  if (pendingRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: pendingRows },
    })
  }
}
