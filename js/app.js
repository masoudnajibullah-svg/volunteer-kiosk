// === ICNA Relief Volunteer Clock In/Out Kiosk ===
// Google Sheets Integration — works on any device

(function () {
    'use strict';

    // =====================================================
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL BELOW
    // =====================================================
    const GOOGLE_SCRIPT_URL = '';
    // =====================================================

    // =====================================================
    // ADMIN PASSWORD — change this to whatever you want
    // =====================================================
    const ADMIN_PASSWORD = 'icna2026';
    // =====================================================

    // --- State ---
    let volunteers = []; // [{name, clockedIn, clockInTime}]
    let logs = []; // [{date, name, clockIn, clockOut, hours, status}]
    let selectedVolunteer = null;
    let filteredLogs = [];

    // --- DOM References ---
    const screens = {
        main: document.getElementById('screen-main'),
        clockAction: document.getElementById('screen-clockaction'),
        confirmation: document.getElementById('screen-confirmation'),
        adminLogin: document.getElementById('screen-admin-login'),
        admin: document.getElementById('screen-admin')
    };

    const els = {
        currentDate: document.getElementById('current-date'),
        currentTime: document.getElementById('current-time'),
        volunteerSearch: document.getElementById('volunteer-search'),
        volunteerList: document.getElementById('volunteer-list'),
        footerCount: document.getElementById('footer-count'),
        actionName: document.getElementById('action-volunteer-name'),
        actionStatus: document.getElementById('action-status'),
        btnClockIn: document.getElementById('btn-clock-in'),
        btnClockOut: document.getElementById('btn-clock-out'),
        btnBack: document.getElementById('btn-back'),
        confirmationIcon: document.getElementById('confirmation-icon'),
        confirmationMessage: document.getElementById('confirmation-message'),
        confirmationTime: document.getElementById('confirmation-time'),
        btnAdmin: document.getElementById('btn-admin'),
        btnAdminBack: document.getElementById('btn-admin-back'),
        currentlyInList: document.getElementById('currently-in-list'),
        todayLogList: document.getElementById('today-log-list'),
        manageVolunteerList: document.getElementById('manage-volunteer-list'),
        newVolunteerName: document.getElementById('new-volunteer-name'),
        btnAddVolunteer: document.getElementById('btn-add-volunteer'),
        btnExportAll: document.getElementById('btn-export-all'),
        exportStats: document.getElementById('export-stats')
    };

    // --- Utility Functions ---

    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    function formatDate(date) {
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatDateShort(date) {
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }

    function getToday() {
        return new Date().toLocaleDateString('en-US');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading(message) {
        els.volunteerList.innerHTML = `<div class="empty-state">${message || 'Loading...'}</div>`;
    }

    // --- Google Sheets API ---

    async function apiGet(action) {
        if (!GOOGLE_SCRIPT_URL) {
            console.warn('Google Script URL not set. Using local mode.');
            return null;
        }

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}`);
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('API GET error:', err);
            return null;
        }
    }

    async function apiPost(payload) {
        if (!GOOGLE_SCRIPT_URL) {
            console.warn('Google Script URL not set. Using local mode.');
            return null;
        }

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('API POST error:', err);
            return null;
        }
    }

    // --- Data Loading ---

    async function loadVolunteers() {
        showLoading('Loading volunteers...');

        const result = await apiGet('getVolunteers');
        if (result && result.success) {
            volunteers = result.volunteers.map(v => ({
                name: v.name,
                clockedIn: false,
                clockInTime: null
            }));
        }

        // Now check who's currently clocked in
        const activeResult = await apiGet('getActiveShifts');
        if (activeResult && activeResult.success) {
            activeResult.active.forEach(shift => {
                const vol = volunteers.find(v => v.name.toLowerCase() === shift.name.toLowerCase());
                if (vol) {
                    vol.clockedIn = true;
                    vol.clockInTime = shift.clockIn;
                }
            });
        }

        renderVolunteerList('');
    }

    async function loadLogs() {
        const result = await apiGet('getLogs');
        if (result && result.success) {
            logs = result.logs;
        }
    }

    // --- Screen Navigation ---

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // --- Clock Display ---

    function updateClock() {
        const now = new Date();
        els.currentDate.textContent = formatDate(now);
        els.currentTime.textContent = formatTime(now);
    }

    // --- Volunteer List Rendering ---

    function renderVolunteerList(filter) {
        const searchTerm = (filter || '').toLowerCase().trim();
        const filtered = searchTerm
            ? volunteers.filter(v => v.name.toLowerCase().includes(searchTerm))
            : volunteers;

        // Sort: clocked-in first, then alphabetical
        filtered.sort((a, b) => {
            if (a.clockedIn && !b.clockedIn) return -1;
            if (!a.clockedIn && b.clockedIn) return 1;
            return a.name.localeCompare(b.name);
        });

        if (filtered.length === 0 && volunteers.length === 0) {
            els.volunteerList.innerHTML = '<div class="empty-state">No volunteers added yet.<br>Go to Admin → Manage Volunteers to add names.</div>';
            updateFooterCount();
            return;
        }

        if (filtered.length === 0) {
            els.volunteerList.innerHTML = '<div class="empty-state">No volunteers found</div>';
            updateFooterCount();
            return;
        }

        els.volunteerList.innerHTML = filtered.map(v => `
            <div class="volunteer-item" data-name="${escapeHtml(v.name)}" role="listitem" tabindex="0">
                <span class="vol-name">${escapeHtml(v.name)}</span>
                <span class="vol-status ${v.clockedIn ? 'status-in' : 'status-out'}">
                    ${v.clockedIn ? 'Clocked In' : 'Not In'}
                </span>
            </div>
        `).join('');

        updateFooterCount();
    }

    function updateFooterCount() {
        const clockedInCount = volunteers.filter(v => v.clockedIn).length;
        els.footerCount.textContent = `${clockedInCount} volunteer${clockedInCount !== 1 ? 's' : ''} clocked in`;
    }

    // --- Clock In / Out Logic ---

    function showClockAction(volunteer) {
        selectedVolunteer = volunteer;
        els.actionName.textContent = volunteer.name;

        if (volunteer.clockedIn) {
            els.actionStatus.textContent = `Clocked in since ${volunteer.clockInTime}`;
            els.btnClockIn.classList.add('hidden');
            els.btnClockOut.classList.remove('hidden');
        } else {
            els.actionStatus.textContent = 'Not currently clocked in';
            els.btnClockIn.classList.remove('hidden');
            els.btnClockOut.classList.add('hidden');
        }

        showScreen('clockAction');
    }

    async function clockIn(volunteer) {
        // Disable buttons while processing
        els.btnClockIn.disabled = true;
        els.btnClockIn.textContent = 'Clocking in...';

        const result = await apiPost({ action: 'clockIn', name: volunteer.name });

        els.btnClockIn.disabled = false;
        els.btnClockIn.textContent = 'Clock In';

        if (result && result.success) {
            volunteer.clockedIn = true;
            volunteer.clockInTime = result.time;
            showConfirmation(volunteer.name, 'in', new Date());
        } else {
            alert('Error clocking in. Please try again.');
            showScreen('main');
        }
    }

    async function clockOut(volunteer) {
        // Disable buttons while processing
        els.btnClockOut.disabled = true;
        els.btnClockOut.textContent = 'Clocking out...';

        const result = await apiPost({ action: 'clockOut', name: volunteer.name });

        els.btnClockOut.disabled = false;
        els.btnClockOut.textContent = 'Clock Out';

        if (result && result.success) {
            volunteer.clockedIn = false;
            volunteer.clockInTime = null;
            showConfirmation(volunteer.name, 'out', new Date());
        } else {
            const msg = result && result.error ? result.error : 'Error clocking out. Please try again.';
            alert(msg);
            showScreen('main');
        }
    }

    function showConfirmation(name, action, time) {
        const icon = els.confirmationIcon;
        icon.className = 'confirmation-icon ' + (action === 'in' ? 'icon-in' : 'icon-out');
        icon.setAttribute('data-icon', action === 'in' ? '✓' : '→');

        els.confirmationMessage.textContent = action === 'in'
            ? `${name}, you're clocked in!`
            : `${name}, you're clocked out!`;

        els.confirmationTime.textContent = formatTime(time);

        showScreen('confirmation');

        // Auto-return to main screen after 3 seconds
        setTimeout(() => {
            showScreen('main');
            renderVolunteerList(els.volunteerSearch.value);
        }, 3000);
    }

    // --- Admin: Currently In ---

    function renderCurrentlyIn() {
        const clockedIn = volunteers.filter(v => v.clockedIn);

        if (clockedIn.length === 0) {
            els.currentlyInList.innerHTML = '<div class="empty-state">No volunteers currently clocked in</div>';
            return;
        }

        els.currentlyInList.innerHTML = clockedIn.map(v => `
            <div class="admin-list-item">
                <div>
                    <div class="item-name">${escapeHtml(v.name)}</div>
                    <div class="item-time">Since ${v.clockInTime || 'unknown'}</div>
                </div>
            </div>
        `).join('');
    }

    // --- Admin: Today's Log ---

    async function renderTodayLog() {
        els.todayLogList.innerHTML = '<div class="empty-state">Loading...</div>';

        await loadLogs();

        const today = getToday();
        const todayLogs = logs.filter(l => l.date === today);

        if (todayLogs.length === 0) {
            els.todayLogList.innerHTML = '<div class="empty-state">No activity today</div>';
            return;
        }

        els.todayLogList.innerHTML = todayLogs.map(l => {
            const outTime = l.clockOut || 'Still in';
            const hours = l.hours ? `${l.hours} hrs` : '';

            return `
                <div class="admin-list-item">
                    <div>
                        <div class="item-name">${escapeHtml(l.name)}</div>
                        <div class="item-detail">${l.clockIn} — ${outTime} ${hours ? '(' + hours + ')' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Admin: Manage Volunteers ---

    function renderManageVolunteers() {
        if (volunteers.length === 0) {
            els.manageVolunteerList.innerHTML = '<div class="empty-state">No volunteers added yet</div>';
            return;
        }

        const sorted = [...volunteers].sort((a, b) => a.name.localeCompare(b.name));

        els.manageVolunteerList.innerHTML = sorted.map(v => `
            <div class="admin-list-item">
                <div class="item-name">${escapeHtml(v.name)}</div>
                <button class="btn-remove" data-name="${escapeHtml(v.name)}" aria-label="Remove ${escapeHtml(v.name)}">Remove</button>
            </div>
        `).join('');
    }

    async function addVolunteer(name) {
        const trimmed = name.trim();
        if (!trimmed) return;

        const result = await apiPost({ action: 'addVolunteer', name: trimmed });

        if (result && result.success) {
            volunteers.push({
                name: trimmed,
                clockedIn: false,
                clockInTime: null
            });
            renderManageVolunteers();
            renderVolunteerList(els.volunteerSearch.value);
            els.newVolunteerName.value = '';
        } else {
            const msg = result && result.error ? result.error : 'Error adding volunteer.';
            alert(msg);
        }
    }

    async function removeVolunteer(name) {
        if (!confirm(`Remove ${name} from the volunteer list?`)) return;

        const result = await apiPost({ action: 'removeVolunteer', name: name });

        if (result && result.success) {
            volunteers = volunteers.filter(v => v.name.toLowerCase() !== name.toLowerCase());
            renderManageVolunteers();
            renderVolunteerList(els.volunteerSearch.value);
        } else {
            const msg = result && result.error ? result.error : 'Error removing volunteer.';
            alert(msg);
        }
    }

    // --- Admin: Export & Print ---

    function exportCSV(logsToExport, filename) {
        if (logsToExport.length === 0) {
            alert('No records to export.');
            return;
        }

        const headers = ['Date', 'Volunteer Name', 'Clock In', 'Clock Out', 'Total Hours', 'Status'];
        const rows = logsToExport.map(l => [
            l.date,
            l.name,
            l.clockIn,
            l.clockOut || 'Still in',
            l.hours || '',
            l.status || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function renderFilteredResults() {
        const fromInput = document.getElementById('export-date-from');
        const toInput = document.getElementById('export-date-to');

        if (!fromInput.value || !toInput.value) {
            alert('Please select both a start and end date.');
            return;
        }

        // Reload logs from Google Sheets
        await loadLogs();

        const from = new Date(fromInput.value + 'T00:00:00');
        const to = new Date(toInput.value + 'T23:59:59');

        filteredLogs = logs.filter(l => {
            // Parse the date string (MM/DD/YYYY format)
            const parts = l.date.split('/');
            if (parts.length !== 3) return false;
            const logDate = new Date(parts[2], parts[0] - 1, parts[1]);
            return logDate >= from && logDate <= to;
        });

        const resultsDiv = document.getElementById('filtered-results');
        const summaryDiv = document.getElementById('filtered-summary');
        const tbody = document.getElementById('records-table-body');

        if (filteredLogs.length === 0) {
            resultsDiv.style.display = 'block';
            summaryDiv.textContent = 'No records found for this date range.';
            tbody.innerHTML = '';
            return;
        }

        // Count unique volunteers and total hours
        const uniqueNames = new Set(filteredLogs.map(l => l.name));
        const totalHours = filteredLogs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

        summaryDiv.textContent = `${filteredLogs.length} records | ${uniqueNames.size} volunteers | ${Math.round(totalHours * 100) / 100} total hours`;

        tbody.innerHTML = filteredLogs.map(l => `
            <tr>
                <td>${escapeHtml(l.date)}</td>
                <td>${escapeHtml(l.name)}</td>
                <td>${escapeHtml(l.clockIn)}</td>
                <td>${l.clockOut ? escapeHtml(l.clockOut) : 'Still in'}</td>
                <td>${l.hours ? l.hours + ' hrs' : '-'}</td>
            </tr>
        `).join('');

        resultsDiv.style.display = 'block';
    }

    function printFilteredRecords() {
        if (filteredLogs.length === 0) {
            alert('No records to print. Use the date filter first.');
            return;
        }

        const fromInput = document.getElementById('export-date-from');
        const toInput = document.getElementById('export-date-to');
        const uniqueNames = new Set(filteredLogs.map(l => l.name));
        const totalHours = filteredLogs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

        const rows = filteredLogs.map(l => `<tr>
            <td>${escapeHtml(l.date)}</td>
            <td>${escapeHtml(l.name)}</td>
            <td>${escapeHtml(l.clockIn)}</td>
            <td>${l.clockOut ? escapeHtml(l.clockOut) : 'Still in'}</td>
            <td>${l.hours || '-'}</td>
        </tr>`).join('');

        // Remove existing print area if any
        const existingPrint = document.getElementById('print-area');
        if (existingPrint) existingPrint.remove();

        const printArea = document.createElement('div');
        printArea.id = 'print-area';
        printArea.innerHTML = `
            <div class="print-header">
                <h2>ICNA Relief — Volunteer Hours Report</h2>
                <p>${fromInput.value} to ${toInput.value}</p>
            </div>
            <table class="print-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Volunteer Name</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Hours</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="print-summary">
                <p><strong>Total Records:</strong> ${filteredLogs.length} | <strong>Volunteers:</strong> ${uniqueNames.size} | <strong>Total Hours:</strong> ${Math.round(totalHours * 100) / 100}</p>
            </div>
        `;

        document.body.appendChild(printArea);
        window.print();

        setTimeout(() => { printArea.remove(); }, 1000);
    }

    function renderExportStats() {
        const totalRecords = logs.length;
        const totalVolunteers = volunteers.length;
        const todayCount = logs.filter(l => l.date === getToday()).length;

        els.exportStats.innerHTML = `
            <p><strong>Total records:</strong> ${totalRecords}</p>
            <p><strong>Total volunteers:</strong> ${totalVolunteers}</p>
            <p><strong>Today's entries:</strong> ${todayCount}</p>
        `;
    }

    // --- Admin Password ---

    function checkAdminPassword() {
        const input = document.getElementById('admin-password');
        const error = document.getElementById('admin-password-error');

        if (input.value === ADMIN_PASSWORD) {
            error.style.display = 'none';
            input.value = '';
            showScreen('admin');
            renderCurrentlyIn();
        } else {
            error.style.display = 'block';
            input.value = '';
            input.focus();
        }
    }

    // --- Admin Tab Switching ---

    function initAdminTabs() {
        const tabs = document.querySelectorAll('.admin-tabs .tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const target = document.getElementById(tab.dataset.tab);
                target.classList.add('active');

                refreshAdminTab(tab.dataset.tab);
            });
        });
    }

    function refreshAdminTab(tabId) {
        switch (tabId) {
            case 'tab-currently-in':
                renderCurrentlyIn();
                break;
            case 'tab-log':
                renderTodayLog();
                break;
            case 'tab-manage':
                renderManageVolunteers();
                break;
            case 'tab-export':
                loadLogs().then(() => renderExportStats());
                break;
        }
    }

    // --- Event Listeners ---

    function initEvents() {
        // Search filter
        els.volunteerSearch.addEventListener('input', (e) => {
            renderVolunteerList(e.target.value);
        });

        // Volunteer item click
        els.volunteerList.addEventListener('click', (e) => {
            const item = e.target.closest('.volunteer-item');
            if (!item) return;
            const vol = volunteers.find(v => v.name === item.dataset.name);
            if (vol) showClockAction(vol);
        });

        // Clock In button
        els.btnClockIn.addEventListener('click', () => {
            if (selectedVolunteer) clockIn(selectedVolunteer);
        });

        // Clock Out button
        els.btnClockOut.addEventListener('click', () => {
            if (selectedVolunteer) clockOut(selectedVolunteer);
        });

        // Back button
        els.btnBack.addEventListener('click', () => {
            showScreen('main');
            renderVolunteerList(els.volunteerSearch.value);
        });

        // Admin button — show password screen
        els.btnAdmin.addEventListener('click', () => {
            showScreen('adminLogin');
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password-error').style.display = 'none';
            document.getElementById('admin-password').focus();
        });

        // Admin login
        document.getElementById('btn-admin-login').addEventListener('click', () => {
            checkAdminPassword();
        });

        document.getElementById('admin-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkAdminPassword();
        });

        document.getElementById('btn-admin-login-back').addEventListener('click', () => {
            showScreen('main');
        });

        // Admin back button
        els.btnAdminBack.addEventListener('click', () => {
            showScreen('main');
            loadVolunteers(); // Refresh data when leaving admin
        });

        // Add volunteer
        els.btnAddVolunteer.addEventListener('click', () => {
            addVolunteer(els.newVolunteerName.value);
        });

        els.newVolunteerName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addVolunteer(els.newVolunteerName.value);
            }
        });

        // Remove volunteer (delegated)
        els.manageVolunteerList.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-remove');
            if (btn) removeVolunteer(btn.dataset.name);
        });

        // Export all
        els.btnExportAll.addEventListener('click', async () => {
            await loadLogs();
            exportCSV(logs, 'icna-relief-volunteer-hours-all.csv');
        });

        // Date range filter
        document.getElementById('btn-filter-dates').addEventListener('click', () => {
            renderFilteredResults();
        });

        // Print filtered records
        document.getElementById('btn-print-filtered').addEventListener('click', () => {
            printFilteredRecords();
        });

        // Export filtered records as CSV
        document.getElementById('btn-export-filtered').addEventListener('click', () => {
            if (filteredLogs.length === 0) {
                alert('No records to export. Use the date filter first.');
                return;
            }
            const from = document.getElementById('export-date-from').value;
            const to = document.getElementById('export-date-to').value;
            exportCSV(filteredLogs, `icna-relief-hours-${from}-to-${to}.csv`);
        });
    }

    // --- No Google Sheets URL Warning ---

    function checkConfig() {
        if (!GOOGLE_SCRIPT_URL) {
            els.volunteerList.innerHTML = `
                <div class="empty-state" style="padding:2rem;">
                    <p style="font-size:1.3rem; font-weight:600; margin-bottom:1rem;">Setup Required</p>
                    <p style="font-size:1.1rem; line-height:1.6;">
                        Open <strong>js/app.js</strong> and paste your Google Apps Script URL at the top of the file.<br><br>
                        See <strong>GOOGLE_SHEETS_SETUP.md</strong> for step-by-step instructions.
                    </p>
                </div>
            `;
            return false;
        }
        return true;
    }

    // --- Initialize App ---

    async function init() {
        updateClock();
        setInterval(updateClock, 1000);
        initAdminTabs();
        initEvents();

        if (checkConfig()) {
            await loadVolunteers();
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
