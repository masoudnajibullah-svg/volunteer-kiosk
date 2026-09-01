// ============================================
// ICNA Relief Volunteer Kiosk — Google Apps Script
// Paste this entire file into Extensions → Apps Script
// ============================================

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();
const LOGS_SHEET = SPREADSHEET.getSheetByName('Logs');
const VOLUNTEERS_SHEET = SPREADSHEET.getSheetByName('Volunteers');

// Handle GET requests (fetch data)
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getVolunteers') {
      return jsonResponse(getVolunteers());
    }

    if (action === 'getLogs') {
      return jsonResponse(getLogs());
    }

    if (action === 'getActiveShifts') {
      return jsonResponse(getActiveShifts());
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// Handle POST requests (write data)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'clockIn') {
      return jsonResponse(clockIn(data));
    }

    if (action === 'clockOut') {
      return jsonResponse(clockOut(data));
    }

    if (action === 'addVolunteer') {
      return jsonResponse(addVolunteer(data));
    }

    if (action === 'removeVolunteer') {
      return jsonResponse(removeVolunteer(data));
    }

    if (action === 'addRecord') {
      return jsonResponse(addRecord(data));
    }

    if (action === 'updateRecord') {
      return jsonResponse(updateRecord(data));
    }

    if (action === 'deleteRecord') {
      return jsonResponse(deleteRecord(data));
    }

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// --- Volunteer Functions ---

function getVolunteers() {
  const data = VOLUNTEERS_SHEET.getDataRange().getValues();
  const volunteers = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      volunteers.push({
        name: data[i][0].toString().trim(),
        addedDate: data[i][1] ? data[i][1].toString() : ''
      });
    }
  }

  return { success: true, volunteers: volunteers };
}

function addVolunteer(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  // Check for duplicate
  const existing = getVolunteers().volunteers;
  const duplicate = existing.find(v => v.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return { success: false, error: 'Volunteer already exists' };

  // Add to sheet
  const today = new Date().toLocaleDateString('en-US');
  VOLUNTEERS_SHEET.appendRow([name, today]);

  return { success: true, name: name };
}

function removeVolunteer(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  const allData = VOLUNTEERS_SHEET.getDataRange().getValues();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0].toString().trim().toLowerCase() === name.toLowerCase()) {
      VOLUNTEERS_SHEET.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
      return { success: true, removed: name };
    }
  }

  return { success: false, error: 'Volunteer not found' };
}

// --- Edit Records Functions (used by admin calendar) ---

// Add a manual record. data: { date, name, clockIn, clockOut, hours, status }
function addRecord(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };
  if (!data.date) return { success: false, error: 'Date is required' };

  // Guard against duplicate / overlapping shifts for the same person + day.
  if (recordConflicts(data.date, name, data.clockIn, data.clockOut)) {
    return { success: false, error: 'A shift already exists that overlaps this time for this person on this day.' };
  }

  const hours = (data.clockIn && data.clockOut)
    ? calculateTimeDiff(data.clockIn, data.clockOut)
    : '';
  const status = data.clockOut ? 'Complete' : 'Clocked In';

  LOGS_SHEET.appendRow([
    data.date,
    name,
    data.clockIn || '',
    data.clockOut || '',
    hours,
    status
  ]);

  return { success: true };
}

// Convert "9:05 AM" to minutes since midnight, or null.
function timeToMinutes(timeStr) {
  const d = parseTimeString(timeStr);
  if (!d) return null;
  return d.getHours() * 60 + d.getMinutes();
}

// True if a shift on `date` for `name` overlaps an existing row.
// `ignoreClockIn` skips a row (used when editing).
function recordConflicts(date, name, clockIn, clockOut, ignoreClockIn) {
  const newStart = timeToMinutes(clockIn);
  if (newStart === null) return false;
  let newEnd = timeToMinutes(clockOut);
  if (newEnd === null || newEnd < newStart) newEnd = newStart;

  const allData = LOGS_SHEET.getDataRange().getDisplayValues();
  const d = (date || '').trim();
  const n = (name || '').trim().toLowerCase();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0].trim() !== d) continue;
    if (allData[i][1].trim().toLowerCase() !== n) continue;
    if (ignoreClockIn !== undefined && allData[i][2].trim() === (ignoreClockIn || '').trim()) continue;

    const exStart = timeToMinutes(allData[i][2].trim());
    if (exStart === null) continue;
    let exEnd = timeToMinutes(allData[i][3].trim());
    if (exEnd === null || exEnd < exStart) exEnd = exStart;

    if (newStart <= exEnd && exStart <= newEnd) return true;
  }
  return false;
}

// Update an existing record. Matches on original date + name + original clockIn.
// data: { date, name, origClockIn, clockIn, clockOut }
function updateRecord(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  // Guard against overlapping a different shift (ignore the row being edited).
  if (recordConflicts(data.date, name, data.clockIn, data.clockOut, data.origClockIn)) {
    return { success: false, error: 'Another shift already overlaps this time for this person on this day.' };
  }

  const allData = LOGS_SHEET.getDataRange().getDisplayValues();

  for (let i = 1; i < allData.length; i++) {
    const rowDate = allData[i][0].trim();
    const rowName = allData[i][1].trim();
    const rowClockIn = allData[i][2].trim();

    if (rowDate === data.date.trim() &&
        rowName.toLowerCase() === name.toLowerCase() &&
        rowClockIn === (data.origClockIn || '').trim()) {

      const hours = (data.clockIn && data.clockOut)
        ? calculateTimeDiff(data.clockIn, data.clockOut)
        : '';
      const status = data.clockOut ? 'Complete' : 'Clocked In';

      const row = i + 1;
      LOGS_SHEET.getRange(row, 3).setValue(data.clockIn || '');   // Clock In
      LOGS_SHEET.getRange(row, 4).setValue(data.clockOut || '');  // Clock Out
      LOGS_SHEET.getRange(row, 5).setValue(hours);                // Hours
      LOGS_SHEET.getRange(row, 6).setValue(status);               // Status

      return { success: true };
    }
  }

  return { success: false, error: 'Record not found' };
}

// Delete a record. Matches on date + name + clockIn.
// data: { date, name, clockIn }
function deleteRecord(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  const allData = LOGS_SHEET.getDataRange().getDisplayValues();

  for (let i = 1; i < allData.length; i++) {
    const rowDate = allData[i][0].trim();
    const rowName = allData[i][1].trim();
    const rowClockIn = allData[i][2].trim();

    if (rowDate === data.date.trim() &&
        rowName.toLowerCase() === name.toLowerCase() &&
        rowClockIn === (data.clockIn || '').trim()) {
      LOGS_SHEET.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Record not found' };
}

// --- Clock In/Out Functions ---

function clockIn(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  const now = new Date();
  const date = now.toLocaleDateString('en-US');
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Add row: Date, Name, Clock In, Clock Out (blank), Hours (blank), Status
  LOGS_SHEET.appendRow([date, name, time, '', '', 'Clocked In']);

  return { success: true, name: name, time: time, date: date };
}

function clockOut(data) {
  const name = data.name ? data.name.trim() : '';
  if (!name) return { success: false, error: 'Name is required' };

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Find the most recent "Clocked In" row for this volunteer
  const allData = LOGS_SHEET.getDataRange().getDisplayValues();
  let targetRow = -1;

  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][1].trim().toLowerCase() === name.toLowerCase() &&
        allData[i][5].trim() === 'Clocked In') {
      targetRow = i + 1; // Sheet is 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: 'No active clock-in found for ' + name };
  }

  // Calculate hours
  const clockInTime = allData[targetRow - 1][2].trim();
  const hours = calculateTimeDiff(clockInTime, time);

  // Update the row: Clock Out time, Hours, Status
  LOGS_SHEET.getRange(targetRow, 4).setValue(time);        // Column D: Clock Out
  LOGS_SHEET.getRange(targetRow, 5).setValue(hours);       // Column E: Hours
  LOGS_SHEET.getRange(targetRow, 6).setValue('Complete');   // Column F: Status

  return { success: true, name: name, time: time, hours: hours };
}

function getActiveShifts() {
  const allData = LOGS_SHEET.getDataRange().getDisplayValues();
  const active = [];

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][5].trim() === 'Clocked In') {
      active.push({
        name: allData[i][1].trim(),
        date: allData[i][0].trim(),
        clockIn: allData[i][2].trim()
      });
    }
  }

  return { success: true, active: active };
}

function getLogs() {
  const allData = LOGS_SHEET.getDataRange().getDisplayValues();
  const logs = [];

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0]) {
      logs.push({
        date: allData[i][0].trim(),
        name: allData[i][1].trim(),
        clockIn: allData[i][2].trim(),
        clockOut: allData[i][3].trim(),
        hours: allData[i][4].trim(),
        status: allData[i][5].trim()
      });
    }
  }

  return { success: true, logs: logs };
}

// --- Utility ---

function calculateTimeDiff(startStr, endStr) {
  // Parse times like "9:05 AM" or "2:30 PM"
  const start = parseTimeString(startStr);
  const end = parseTimeString(endStr);

  if (!start || !end) return 0;

  let diff = (end - start) / (1000 * 60 * 60); // Convert ms to hours
  if (diff < 0) diff += 24; // Handle midnight crossing

  return Math.round(diff * 100) / 100;
}

function parseTimeString(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
