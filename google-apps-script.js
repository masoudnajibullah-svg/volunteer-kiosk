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
  const allData = LOGS_SHEET.getDataRange().getValues();
  let targetRow = -1;

  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][1].toString().trim().toLowerCase() === name.toLowerCase() &&
        allData[i][5].toString().trim() === 'Clocked In') {
      targetRow = i + 1; // Sheet is 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: 'No active clock-in found for ' + name };
  }

  // Calculate hours
  const clockInTime = allData[targetRow - 1][2].toString();
  const hours = calculateTimeDiff(clockInTime, time);

  // Update the row: Clock Out time, Hours, Status
  LOGS_SHEET.getRange(targetRow, 4).setValue(time);        // Column D: Clock Out
  LOGS_SHEET.getRange(targetRow, 5).setValue(hours);       // Column E: Hours
  LOGS_SHEET.getRange(targetRow, 6).setValue('Complete');   // Column F: Status

  return { success: true, name: name, time: time, hours: hours };
}

function getActiveShifts() {
  const allData = LOGS_SHEET.getDataRange().getValues();
  const active = [];

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][5].toString().trim() === 'Clocked In') {
      active.push({
        name: allData[i][1].toString().trim(),
        date: allData[i][0].toString(),
        clockIn: allData[i][2].toString()
      });
    }
  }

  return { success: true, active: active };
}

function getLogs() {
  const allData = LOGS_SHEET.getDataRange().getValues();
  const logs = [];

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0]) {
      logs.push({
        date: allData[i][0].toString(),
        name: allData[i][1].toString().trim(),
        clockIn: allData[i][2].toString(),
        clockOut: allData[i][3].toString(),
        hours: allData[i][4].toString(),
        status: allData[i][5].toString()
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
