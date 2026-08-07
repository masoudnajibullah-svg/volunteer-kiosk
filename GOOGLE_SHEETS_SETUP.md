# Google Sheets Setup for ICNA Relief Volunteer Kiosk

## Step 1: Create the Google Sheet

1. Go to https://sheets.google.com
2. Click "+ Blank" to create a new spreadsheet
3. Rename it to: **ICNA Relief Volunteer Hours**
4. You need TWO sheets (tabs at the bottom):

### Sheet 1: "Logs" (rename the first tab)
Click on "Sheet1" at the bottom and rename it to **Logs**
Add these headers in Row 1:
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| Date | Volunteer Name | Clock In | Clock Out | Hours | Status |

### Sheet 2: "Volunteers"
Click the "+" at the bottom to add a new sheet tab, rename it to **Volunteers**
Add these headers in Row 1:
| A | B |
|---|---|
| Name | Added Date |

Then add your volunteer names in column A (one per row, starting from row 2).

---

## Step 2: Add the Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete all the code in the editor
3. Paste the ENTIRE script from the file: `google-apps-script.js` (in this project folder)
4. Click the floppy disk icon (or Ctrl+S) to save
5. Name the project: "Volunteer Kiosk API"

---

## Step 3: Deploy as Web App

1. In the Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Set these options:
   - Description: "Volunteer Kiosk API"
   - Execute as: **Me** (your email)
   - Who has access: **Anyone**
4. Click **Deploy**
5. It will ask for permissions — click "Authorize access" and allow it
6. Copy the **Web app URL** it shows you (looks like: https://script.google.com/macros/s/XXXXX/exec)

---

## Step 4: Paste the URL in the App

1. Open `js/app.js` in the volunteer-kiosk folder
2. Find this line near the top:
   ```
   const GOOGLE_SCRIPT_URL = '';
   ```
3. Paste your Web app URL between the quotes:
   ```
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR-ID-HERE/exec';
   ```
4. Save the file

---

## Done!

Now the app will:
- Load volunteer names from the "Volunteers" sheet
- Write every clock-in and clock-out to the "Logs" sheet
- Work from any device (iPad, laptop, phone) — all sharing the same data
- Still work offline (saves locally and syncs when connection returns)

---

## Notes

- The Google Sheet is your database — you can view, sort, filter, and print from it anytime
- You can add/remove volunteers directly in the Sheet OR through the app's Admin panel
- If you need to re-deploy after making script changes: Deploy → Manage deployments → Edit → New version → Deploy
- Free forever — Google Sheets has no usage limits for this kind of thing
