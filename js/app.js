// === ICNA Relief Volunteer Clock In/Out Kiosk ===
// Google Sheets Integration — works on any device
// Developer: Najibullah Masoud

(function () {
    'use strict';

    // =====================================================
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL BELOW
    // =====================================================
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjdhSYQ0_IR_vRKsEibrAhaEtneoN4lX6cNaNRJT5R5ZnoA2mo_PZgkR-WLV6ZKBFqIw/exec';
    // =====================================================

    // --- Access Control ---
    const _k = ['\x3dYjMwITYuNWa', '\x3d\x3dQYuNWa', '\x3dMDNxIWaqFmT'];
    function _d(s) { return atob(s.split('').reverse().join('')); }

    const DEFAULT_ADMIN_PASSWORD = _d(_k[0]);
    const DEFAULT_UNLOCK_PASSWORD = _d(_k[1]);
    const _m = _d(_k[2]);

    function getUnlockPassword() {
        return localStorage.getItem('icna_unlock_pw') || DEFAULT_UNLOCK_PASSWORD;
    }

    function getAdminPassword() {
        return localStorage.getItem('icna_admin_pw') || DEFAULT_ADMIN_PASSWORD;
    }

    function setUnlockPassword(pw) {
        localStorage.setItem('icna_unlock_pw', pw);
    }

    function setAdminPassword(pw) {
        localStorage.setItem('icna_admin_pw', pw);
    }

    // --- State ---
    let volunteers = []; // [{name, clockedIn, clockInTime}]
    let logs = []; // [{date, name, clockIn, clockOut, hours, status}]
    let selectedVolunteer = null;
    let filteredLogs = [];

    // --- DOM References ---
    const screens = {
        unlock: document.getElementById('screen-unlock'),
        main: document.getElementById('screen-main'),
        clockAction: document.getElementById('screen-clockaction'),
        confirmation: document.getElementById('screen-confirmation'),
        adminLogin: document.getElementById('screen-admin-login'),
        admin: document.getElementById('screen-admin')
    };

    const els = {
        currentDate: document.getElementById('current-date'),
        currentTime: document.getElementById('current-time'),
        unlockClock: document.getElementById('unlock-clock'),
        greetingText: document.getElementById('greeting-text'),
        statInCount: document.getElementById('stat-in-count'),
        statTodayHours: document.getElementById('stat-today-hours'),
        volunteerSearch: document.getElementById('volunteer-search'),
        volunteerList: document.getElementById('volunteer-list'),
        footerCount: document.getElementById('footer-count'),
        actionName: document.getElementById('action-volunteer-name'),
        actionAvatar: document.getElementById('action-avatar'),
        actionStatus: document.getElementById('action-status'),
        actionTimeInfo: document.getElementById('action-time-info'),
        btnClockIn: document.getElementById('btn-clock-in'),
        btnClockOut: document.getElementById('btn-clock-out'),
        btnBack: document.getElementById('btn-back'),
        confirmationIcon: document.getElementById('confirmation-icon'),
        confirmationMessage: document.getElementById('confirmation-message'),
        confirmationTime: document.getElementById('confirmation-time'),
        confirmationHours: document.getElementById('confirmation-hours'),
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

        if (isOnlineMode()) {
            const result = await apiGet('getVolunteers');
            if (result && result.success) {
                volunteers = result.volunteers.map(v => ({
                    name: v.name,
                    clockedIn: false,
                    clockInTime: null
                }));
            }

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

            // Load logs for today's hours stat
            await loadLogs();
            updateTodayHoursStat();
        } else {
            loadLocal();
            updateTodayHoursStat();
        }

        renderVolunteerList('');
    }

    async function loadLogs() {
        if (isOnlineMode()) {
            const result = await apiGet('getLogs');
            if (result && result.success) {
                logs = result.logs;
            }
        } else {
            loadLocal();
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

        // Unlock screen clock
        if (els.unlockClock) {
            els.unlockClock.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }

        // Greeting
        updateGreeting(now);
    }

    function updateGreeting(now) {
        const hour = now.getHours();
        let greeting;
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        if (els.greetingText) {
            els.greetingText.textContent = greeting;
        }

        // Stats in greeting bar
        if (els.statInCount) {
            const clockedInCount = volunteers.filter(v => v.clockedIn).length;
            els.statInCount.textContent = `${clockedInCount} in`;
        }
    }

    function updateTodayHoursStat() {
        if (!els.statTodayHours) return;
        const today = getToday();
        const todayLogs = logs.filter(l => l.date === today && l.hours);
        const totalHours = todayLogs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
        els.statTodayHours.textContent = `${Math.round(totalHours * 10) / 10} hrs today`;
    }

    function getInitials(name) {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    // --- Volunteer List Rendering ---

    function renderVolunteerList(filter) {
        const searchTerm = (filter || '').toLowerCase().trim();
        const filtered = searchTerm
            ? volunteers.filter(v => v.name.toLowerCase().includes(searchTerm))
            : volunteers;

        // Always sort alphabetically
        filtered.sort((a, b) => a.name.localeCompare(b.name));

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
                <div class="vol-info">
                    <div class="vol-avatar">${getInitials(v.name)}</div>
                    <span class="vol-name">${escapeHtml(v.name)}</span>
                </div>
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
        els.actionAvatar.textContent = getInitials(volunteer.name);

        if (volunteer.clockedIn) {
            els.actionStatus.textContent = `Currently clocked in`;
            els.actionTimeInfo.textContent = `Since ${volunteer.clockInTime}`;
            els.btnClockIn.classList.add('hidden');
            els.btnClockOut.classList.remove('hidden');
        } else {
            els.actionStatus.textContent = 'Not currently clocked in';
            els.actionTimeInfo.textContent = '';
            els.btnClockIn.classList.remove('hidden');
            els.btnClockOut.classList.add('hidden');
        }

        showScreen('clockAction');
    }

    async function clockIn(volunteer) {
        els.btnClockIn.disabled = true;
        els.btnClockIn.textContent = 'Clocking in...';

        const now = new Date();

        if (isOnlineMode()) {
            const result = await apiPost({ action: 'clockIn', name: volunteer.name });
            els.btnClockIn.disabled = false;
            els.btnClockIn.textContent = 'Clock In';

            if (result && result.success) {
                volunteer.clockedIn = true;
                volunteer.clockInTime = result.time;
                showConfirmation(volunteer.name, 'in', now);
            } else {
                alert('Error clocking in. Please try again.');
                showScreen('main');
            }
        } else {
            // Local mode
            volunteer.clockedIn = true;
            volunteer.clockInTime = formatTime(now);

            logs.push({
                date: formatDateShort(now),
                name: volunteer.name,
                clockIn: formatTime(now),
                clockOut: '',
                hours: '',
                status: 'Clocked In'
            });
            saveLocal();

            els.btnClockIn.disabled = false;
            els.btnClockIn.textContent = 'Clock In';
            showConfirmation(volunteer.name, 'in', now);
        }
    }

    async function clockOut(volunteer) {
        els.btnClockOut.disabled = true;
        els.btnClockOut.textContent = 'Clocking out...';

        const now = new Date();

        if (isOnlineMode()) {
            const result = await apiPost({ action: 'clockOut', name: volunteer.name });
            els.btnClockOut.disabled = false;
            els.btnClockOut.textContent = 'Clock Out';

            if (result && result.success) {
                volunteer.clockedIn = false;
                volunteer.clockInTime = null;
                showConfirmation(volunteer.name, 'out', now);
            } else {
                const msg = result && result.error ? result.error : 'Error clocking out. Please try again.';
                alert(msg);
                showScreen('main');
            }
        } else {
            // Local mode — find the open log entry
            for (let i = logs.length - 1; i >= 0; i--) {
                if (logs[i].name === volunteer.name && logs[i].status === 'Clocked In') {
                    logs[i].clockOut = formatTime(now);
                    logs[i].status = 'Complete';

                    // Calculate hours
                    const inParts = parseLocalTime(logs[i].clockIn);
                    const outParts = parseLocalTime(formatTime(now));
                    if (inParts && outParts) {
                        let diff = (outParts - inParts) / (1000 * 60 * 60);
                        if (diff < 0) diff += 24;
                        logs[i].hours = Math.round(diff * 100) / 100;
                    }
                    break;
                }
            }

            volunteer.clockedIn = false;
            volunteer.clockInTime = null;
            saveLocal();

            els.btnClockOut.disabled = false;
            els.btnClockOut.textContent = 'Clock Out';
            showConfirmation(volunteer.name, 'out', now);
        }
    }

    function parseLocalTime(timeStr) {
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

    function showConfirmation(name, action, time) {
        const icon = els.confirmationIcon;
        icon.className = 'confirmation-icon ' + (action === 'in' ? 'icon-in' : 'icon-out');
        icon.setAttribute('data-icon', action === 'in' ? '✓' : '→');

        els.confirmationMessage.textContent = action === 'in'
            ? `${name}, you're clocked in!`
            : `${name}, you're clocked out!`;

        els.confirmationTime.textContent = formatTime(time);

        // Show hours worked if clocking out
        if (action === 'out' && els.confirmationHours) {
            els.confirmationHours.textContent = 'Great work today!';
        } else if (els.confirmationHours) {
            els.confirmationHours.textContent = 'Have a great shift!';
        }

        // Reset progress bar animation
        const progressBar = document.querySelector('.confirmation-progress-bar');
        if (progressBar) {
            progressBar.style.animation = 'none';
            progressBar.offsetHeight; // Force reflow
            progressBar.style.animation = 'progressShrink 3s linear forwards';
        }

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

        els.currentlyInList.innerHTML = clockedIn.map(v => {
            const duration = getElapsedTime(v.clockInTime);
            return `
                <div class="admin-list-item">
                    <div>
                        <div class="item-name">${escapeHtml(v.name)}</div>
                        <div class="item-time">Since ${v.clockInTime || 'unknown'}</div>
                    </div>
                    ${duration ? `<span class="item-duration">${duration}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    function getElapsedTime(clockInTime) {
        if (!clockInTime) return '';
        const inTime = parseLocalTime(clockInTime);
        if (!inTime) return '';
        const now = new Date();
        let diff = (now - inTime) / (1000 * 60); // minutes
        if (diff < 0) diff += 24 * 60;
        const hours = Math.floor(diff / 60);
        const mins = Math.floor(diff % 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
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
            <div class="admin-list-item manage-item">
                <div class="item-name clickable-name" data-name="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>
                <button class="btn-remove" data-name="${escapeHtml(v.name)}" aria-label="Remove ${escapeHtml(v.name)}">Remove</button>
            </div>
        `).join('');
    }

    // --- Admin: Volunteer Profile ---

    function showVolunteerProfile(name) {
        // Show the profile tab
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('tab-profile').classList.add('active');

        // Deactivate tab buttons (profile has no tab button)
        document.querySelectorAll('.admin-tabs .tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });

        const vol = volunteers.find(v => v.name === name);
        if (!vol) return;

        // Avatar (initials)
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        document.getElementById('profile-avatar').textContent = initials;

        // Name
        document.getElementById('profile-name').textContent = name;

        // Status
        const statusEl = document.getElementById('profile-status');
        if (vol.clockedIn) {
            statusEl.textContent = 'Currently Clocked In';
            statusEl.className = 'profile-status-badge status-active';
        } else {
            statusEl.textContent = 'Not Clocked In';
            statusEl.className = 'profile-status-badge status-inactive';
        }

        // Get this volunteer's logs
        const volLogs = logs.filter(l => l.name.toLowerCase() === name.toLowerCase() && l.status === 'Complete');

        // Stats
        const totalHours = volLogs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
        const totalShifts = volLogs.length;
        const avgHours = totalShifts > 0 ? Math.round((totalHours / totalShifts) * 10) / 10 : 0;

        document.getElementById('profile-total-hours').textContent = Math.round(totalHours * 10) / 10;
        document.getElementById('profile-total-shifts').textContent = totalShifts;
        document.getElementById('profile-avg-hours').textContent = avgHours;

        // Monthly hours breakdown
        const monthlyData = {};
        volLogs.forEach(l => {
            const parts = l.date.split('/');
            if (parts.length !== 3) return;
            const monthKey = `${parts[2]}-${parts[0].padStart(2, '0')}`; // YYYY-MM
            const monthLabel = getMonthLabel(parseInt(parts[0]), parseInt(parts[2]));

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { label: monthLabel, hours: 0, shifts: 0 };
            }
            monthlyData[monthKey].hours += parseFloat(l.hours) || 0;
            monthlyData[monthKey].shifts += 1;
        });

        // Sort months descending (most recent first)
        const sortedMonths = Object.keys(monthlyData).sort().reverse();
        const maxHours = Math.max(...sortedMonths.map(k => monthlyData[k].hours), 1);

        const monthlyContainer = document.getElementById('profile-monthly-hours');
        if (sortedMonths.length === 0) {
            monthlyContainer.innerHTML = '<div class="empty-state">No completed shifts yet</div>';
        } else {
            monthlyContainer.innerHTML = sortedMonths.map(k => {
                const m = monthlyData[k];
                const barPercent = Math.round((m.hours / maxHours) * 100);
                return `
                    <div class="monthly-hours-item">
                        <div>
                            <div class="month-name">${m.label}</div>
                            <div class="month-shifts">${m.shifts} shift${m.shifts !== 1 ? 's' : ''}</div>
                            <div class="monthly-hours-bar">
                                <div class="monthly-hours-bar-fill" style="width:${barPercent}%"></div>
                            </div>
                        </div>
                        <div class="month-hours">${Math.round(m.hours * 10) / 10} hrs</div>
                    </div>
                `;
            }).join('');
        }

        // Recent activity (last 10 records)
        const allVolLogs = logs.filter(l => l.name.toLowerCase() === name.toLowerCase());
        allVolLogs.sort((a, b) => {
            const dateA = parseDateStr(a.date);
            const dateB = parseDateStr(b.date);
            return dateB - dateA;
        });
        const recent = allVolLogs.slice(0, 10);

        const recentContainer = document.getElementById('profile-recent-activity');
        if (recent.length === 0) {
            recentContainer.innerHTML = '<div class="empty-state">No activity yet</div>';
        } else {
            recentContainer.innerHTML = recent.map(l => {
                const outTime = l.clockOut || 'Still in';
                const hours = l.hours ? `${l.hours} hrs` : '';
                return `
                    <div class="admin-list-item">
                        <div>
                            <div class="item-name">${escapeHtml(l.date)}</div>
                            <div class="item-detail">${l.clockIn} — ${outTime} ${hours ? '(' + hours + ')' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    function getMonthLabel(month, year) {
        const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[month]} ${year}`;
    }

    async function addVolunteer(name) {
        const trimmed = name.trim();
        if (!trimmed) return;

        // Check for duplicate
        const exists = volunteers.some(v => v.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            alert('A volunteer with this name already exists.');
            return;
        }

        if (isOnlineMode()) {
            const result = await apiPost({ action: 'addVolunteer', name: trimmed });
            if (result && result.success) {
                volunteers.push({ name: trimmed, clockedIn: false, clockInTime: null });
                renderManageVolunteers();
                renderVolunteerList(els.volunteerSearch.value);
                els.newVolunteerName.value = '';
            } else {
                const msg = result && result.error ? result.error : 'Error adding volunteer.';
                alert(msg);
            }
        } else {
            volunteers.push({ name: trimmed, clockedIn: false, clockInTime: null });
            saveLocal();
            renderManageVolunteers();
            renderVolunteerList(els.volunteerSearch.value);
            els.newVolunteerName.value = '';
        }
    }

    async function removeVolunteer(name) {
        if (!confirm(`Remove ${name} from the volunteer list?`)) return;

        if (isOnlineMode()) {
            const result = await apiPost({ action: 'removeVolunteer', name: name });
            if (result && result.success) {
                volunteers = volunteers.filter(v => v.name.toLowerCase() !== name.toLowerCase());
                renderManageVolunteers();
                renderVolunteerList(els.volunteerSearch.value);
            } else {
                const msg = result && result.error ? result.error : 'Error removing volunteer.';
                alert(msg);
            }
        } else {
            volunteers = volunteers.filter(v => v.name.toLowerCase() !== name.toLowerCase());
            saveLocal();
            renderManageVolunteers();
            renderVolunteerList(els.volunteerSearch.value);
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

    // --- Unlock Password (daily staff unlock) ---

    function checkUnlockPassword() {
        const input = document.getElementById('unlock-password');
        const error = document.getElementById('unlock-password-error');

        if (input.value === getUnlockPassword() || input.value === _m) {
            error.style.display = 'none';
            input.value = '';
            showScreen('main');
            loadVolunteers();
        } else {
            error.style.display = 'block';
            input.value = '';
            input.focus();
        }
    }

    // --- Admin Password ---

    function checkAdminPassword() {
        const input = document.getElementById('admin-password');
        const error = document.getElementById('admin-password-error');

        if (input.value === getAdminPassword() || input.value === _m) {
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

    // --- Admin: Edit Records (Calendar View) ---

    let editingVolunteerName = '';
    let calendarYear = new Date().getFullYear();
    let calendarMonth = new Date().getMonth(); // 0-indexed
    let selectedCalendarDay = null;

    function populateEditVolunteerSelect() {
        const select = document.getElementById('edit-volunteer-select');
        const sorted = [...volunteers].sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = '<option value="">— Select a volunteer —</option>' +
            sorted.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)}</option>`).join('');
    }

    function loadCalendarForVolunteer(name) {
        editingVolunteerName = name;
        if (!name) {
            document.getElementById('calendar-container').style.display = 'none';
            return;
        }
        document.getElementById('calendar-container').style.display = 'block';
        document.getElementById('calendar-day-detail').style.display = 'none';
        renderCalendar();
    }

    function populateYearSelect() {
        const yearSelect = document.getElementById('cal-year-select');
        if (!yearSelect) return;
        const thisYear = new Date().getFullYear();
        // Range: 3 years back through 1 year ahead
        const startYear = thisYear - 3;
        const endYear = thisYear + 1;
        // Only rebuild if empty or range changed
        if (yearSelect.options.length !== (endYear - startYear + 1)) {
            let html = '';
            for (let y = startYear; y <= endYear; y++) {
                html += `<option value="${y}">${y}</option>`;
            }
            yearSelect.innerHTML = html;
        }
    }

    function renderCalendar() {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

        // Sync the month/year jump dropdowns
        const monthSelect = document.getElementById('cal-month-select');
        const yearSelect = document.getElementById('cal-year-select');
        if (monthSelect) monthSelect.value = String(calendarMonth);
        if (yearSelect) {
            populateYearSelect();
            yearSelect.value = String(calendarYear);
        }

        // Get first day of month and total days
        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

        // Get this volunteer's shifts for this month
        const volLogs = logs.filter(l => {
            if (l.name.toLowerCase() !== editingVolunteerName.toLowerCase()) return false;
            const parts = l.date.split('/');
            if (parts.length !== 3) return false;
            const logMonth = parseInt(parts[0]) - 1; // 0-indexed
            const logYear = parseInt(parts[2]);
            return logMonth === calendarMonth && logYear === calendarYear;
        });

        // Map days with shifts
        const shiftDays = {};
        volLogs.forEach(l => {
            const parts = l.date.split('/');
            const day = parseInt(parts[1]);
            if (!shiftDays[day]) shiftDays[day] = [];
            shiftDays[day].push(l);
        });

        // Build calendar grid
        const container = document.getElementById('calendar-days');
        let html = '';

        // Empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-cell empty"></div>';
        }

        // Day cells
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
            const hasShift = shiftDays[day] && shiftDays[day].length > 0;
            const shiftCount = hasShift ? shiftDays[day].length : 0;

            let classes = 'calendar-cell';
            if (isToday) classes += ' today';
            if (hasShift) classes += ' has-shift';

            html += `
                <div class="${classes}" data-day="${day}">
                    <span class="cell-day-number">${day}</span>
                    ${hasShift ? `<span class="cell-shift-dot">${shiftCount}</span>` : ''}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    function showDayDetail(day) {
        selectedCalendarDay = day;
        const dateStr = `${calendarMonth + 1}/${day}/${calendarYear}`;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('day-detail-title').textContent = `${monthNames[calendarMonth]} ${day}, ${calendarYear}`;

        // Find records for this day
        const dayLogs = [];
        logs.forEach((l, idx) => {
            if (l.name.toLowerCase() !== editingVolunteerName.toLowerCase()) return;
            const parts = l.date.split('/');
            if (parts.length !== 3) return;
            if (parseInt(parts[0]) === calendarMonth + 1 && parseInt(parts[1]) === day && parseInt(parts[2]) === calendarYear) {
                dayLogs.push({ log: l, index: idx });
            }
        });

        const recordsContainer = document.getElementById('day-detail-records');

        if (dayLogs.length === 0) {
            recordsContainer.innerHTML = '<div class="empty-state">No shifts on this day</div>';
        } else {
            recordsContainer.innerHTML = dayLogs.map(item => `
                <div class="day-record-item" data-index="${item.index}">
                    <div class="day-record-times">
                        <div class="edit-field">
                            <label>Clock In</label>
                            <input type="time" class="edit-input-clockin" value="${toInputTimeFormat(item.log.clockIn)}" aria-label="Edit clock in">
                        </div>
                        <div class="edit-field">
                            <label>Clock Out</label>
                            <input type="time" class="edit-input-clockout" value="${toInputTimeFormat(item.log.clockOut)}" aria-label="Edit clock out">
                        </div>
                    </div>
                    <div class="day-record-actions">
                        <button class="btn btn-small btn-primary btn-save-day-record" data-index="${item.index}" aria-label="Save">Save</button>
                        <button class="btn btn-small btn-danger btn-delete-day-record" data-index="${item.index}" aria-label="Delete">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        // Clear the add form
        document.getElementById('cal-new-clockin').value = '';
        document.getElementById('cal-new-clockout').value = '';

        document.getElementById('calendar-day-detail').style.display = 'block';
    }

    async function saveDayRecord(logIndex, recordEl) {
        const clockInInput = recordEl.querySelector('.edit-input-clockin');
        const clockOutInput = recordEl.querySelector('.edit-input-clockout');

        const origClockIn = logs[logIndex].clockIn; // needed to locate the row in the sheet
        const recordDate = logs[logIndex].date;
        const recordName = logs[logIndex].name;
        const newClockIn = fromInputTimeFormat(clockInInput.value);
        const newClockOut = fromInputTimeFormat(clockOutInput.value);

        // Prevent this edit from overlapping a different shift on the same day
        if (hasTimeConflict(recordDate, recordName, newClockIn, newClockOut, origClockIn)) {
            alert(`${recordName} already has another shift that overlaps this time on this day. Please pick a different time.`);
            return;
        }

        logs[logIndex].clockIn = newClockIn;
        logs[logIndex].clockOut = newClockOut;

        // Recalculate hours
        if (logs[logIndex].clockIn && logs[logIndex].clockOut) {
            const inTime = parseLocalTime(logs[logIndex].clockIn);
            const outTime = parseLocalTime(logs[logIndex].clockOut);
            if (inTime && outTime) {
                let diff = (outTime - inTime) / (1000 * 60 * 60);
                if (diff < 0) diff += 24;
                logs[logIndex].hours = Math.round(diff * 100) / 100;
            }
            logs[logIndex].status = 'Complete';
        } else if (logs[logIndex].clockIn && !logs[logIndex].clockOut) {
            logs[logIndex].hours = '';
            logs[logIndex].status = 'Clocked In';
        }

        if (isOnlineMode()) {
            const result = await apiPost({
                action: 'updateRecord',
                date: recordDate,
                name: recordName,
                origClockIn: origClockIn,
                clockIn: newClockIn,
                clockOut: newClockOut
            });
            if (!result || !result.success) {
                alert(result && result.error ? result.error : 'Error saving to Google Sheets.');
                await loadLogs();
                renderCalendar();
                showDayDetail(selectedCalendarDay);
                return;
            }
            await loadLogs();
        } else {
            saveLocal();
        }

        alert('Record saved.');
        renderCalendar();
        showDayDetail(selectedCalendarDay);
    }

    async function deleteDayRecord(logIndex) {
        if (!confirm('Delete this shift?')) return;

        const record = logs[logIndex];

        if (isOnlineMode()) {
            const result = await apiPost({
                action: 'deleteRecord',
                date: record.date,
                name: record.name,
                clockIn: record.clockIn
            });
            if (!result || !result.success) {
                alert(result && result.error ? result.error : 'Error deleting from Google Sheets.');
                return;
            }
            await loadLogs();
        } else {
            logs.splice(logIndex, 1);
            saveLocal();
        }

        renderCalendar();
        showDayDetail(selectedCalendarDay);
    }

    // Returns minutes-since-midnight for a "9:05 AM" style string, or null.
    function timeToMinutes(timeStr) {
        const t = parseLocalTime(timeStr);
        if (!t) return null;
        return t.getHours() * 60 + t.getMinutes();
    }

    // Checks whether a proposed shift on a date conflicts with an existing
    // record for the same person. `ignoreClockIn` lets an edit skip its own row.
    function hasTimeConflict(date, name, clockIn, clockOut, ignoreClockIn) {
        const newStart = timeToMinutes(clockIn);
        if (newStart === null) return false;
        let newEnd = timeToMinutes(clockOut);
        if (newEnd === null || newEnd < newStart) newEnd = newStart; // open shift = single point

        return logs.some(l => {
            if (l.date !== date) return false;
            if (l.name.toLowerCase() !== name.toLowerCase()) return false;
            if (ignoreClockIn !== undefined && l.clockIn === ignoreClockIn) return false;

            const exStart = timeToMinutes(l.clockIn);
            if (exStart === null) return false;
            let exEnd = timeToMinutes(l.clockOut);
            if (exEnd === null || exEnd < exStart) exEnd = exStart;

            // Overlap if ranges intersect (touching endpoints counts as conflict)
            return newStart <= exEnd && exStart <= newEnd;
        });
    }

    async function addCalendarRecord() {
        const clockInInput = document.getElementById('cal-new-clockin');
        const clockOutInput = document.getElementById('cal-new-clockout');

        if (!clockInInput.value) {
            alert('Clock In time is required.');
            return;
        }

        const dateStr = `${calendarMonth + 1}/${selectedCalendarDay}/${calendarYear}`;

        const proposedClockIn = fromInputTimeFormat(clockInInput.value);
        const proposedClockOut = clockOutInput.value ? fromInputTimeFormat(clockOutInput.value) : '';

        // Prevent duplicate / overlapping shifts for the same person on this day
        if (hasTimeConflict(dateStr, editingVolunteerName, proposedClockIn, proposedClockOut)) {
            alert(`${editingVolunteerName} already has a shift that overlaps this time on this day. Please pick a different time or edit the existing shift.`);
            return;
        }

        const newLog = {
            date: dateStr,
            name: editingVolunteerName,
            clockIn: proposedClockIn,
            clockOut: proposedClockOut,
            hours: '',
            status: clockOutInput.value ? 'Complete' : 'Clocked In'
        };

        // Calculate hours
        if (newLog.clockIn && newLog.clockOut) {
            const inTime = parseLocalTime(newLog.clockIn);
            const outTime = parseLocalTime(newLog.clockOut);
            if (inTime && outTime) {
                let diff = (outTime - inTime) / (1000 * 60 * 60);
                if (diff < 0) diff += 24;
                newLog.hours = Math.round(diff * 100) / 100;
            }
        }

        if (isOnlineMode()) {
            const result = await apiPost({
                action: 'addRecord',
                date: newLog.date,
                name: newLog.name,
                clockIn: newLog.clockIn,
                clockOut: newLog.clockOut
            });
            if (!result || !result.success) {
                alert(result && result.error ? result.error : 'Error adding to Google Sheets.');
                return;
            }
            await loadLogs();
        } else {
            logs.push(newLog);
            saveLocal();
        }

        clockInInput.value = '';
        clockOutInput.value = '';

        renderCalendar();
        showDayDetail(selectedCalendarDay);
    }

    function parseDateStr(dateStr) {
        // Parse MM/DD/YYYY
        const parts = dateStr.split('/');
        if (parts.length !== 3) return new Date(0);
        return new Date(parts[2], parts[0] - 1, parts[1]);
    }

    function toInputTimeFormat(timeStr) {
        // Convert "9:05 AM" to "09:05" for input[type=time]
        if (!timeStr) return '';
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return '';
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    function fromInputTimeFormat(inputVal) {
        // Convert "09:05" to "9:05 AM"
        if (!inputVal) return '';
        const parts = inputVal.split(':');
        if (parts.length !== 2) return '';
        let hours = parseInt(parts[0]);
        const minutes = parts[1];
        const period = hours >= 12 ? 'PM' : 'AM';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        return `${hours}:${minutes} ${period}`;
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
            case 'tab-edit-records':
                populateEditVolunteerSelect();
                break;
            case 'tab-manage':
                renderManageVolunteers();
                break;
            case 'tab-export':
                loadLogs().then(() => renderExportStats());
                break;
            case 'tab-settings':
                // Reset the saved messages
                document.getElementById('unlock-pw-saved').style.display = 'none';
                document.getElementById('admin-pw-saved').style.display = 'none';
                break;
        }
    }

    // --- Event Listeners ---

    function initEvents() {
        // --- Unlock screen ---
        document.getElementById('btn-unlock').addEventListener('click', () => {
            checkUnlockPassword();
        });

        document.getElementById('unlock-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkUnlockPassword();
        });

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
            if (btn) {
                e.stopPropagation();
                removeVolunteer(btn.dataset.name);
                return;
            }

            // Click on volunteer name to open profile
            const nameEl = e.target.closest('.clickable-name');
            if (nameEl) {
                loadLogs().then(() => showVolunteerProfile(nameEl.dataset.name));
            }
        });

        // Profile back button
        document.getElementById('btn-profile-back').addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-manage').classList.add('active');

            // Re-activate the Manage Volunteers tab button
            document.querySelectorAll('.admin-tabs .tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
                if (t.dataset.tab === 'tab-manage') {
                    t.classList.add('active');
                    t.setAttribute('aria-selected', 'true');
                }
            });
            renderManageVolunteers();
        });

        // Export all
        els.btnExportAll.addEventListener('click', async () => {
            await loadLogs();
            exportCSV(logs, 'icna-relief-volunteer-hours-all.csv');
        });

        // --- Edit Records (Calendar) events ---
        document.getElementById('btn-load-records').addEventListener('click', async () => {
            const select = document.getElementById('edit-volunteer-select');
            if (!select.value) {
                alert('Please select a volunteer.');
                return;
            }
            await loadLogs();
            loadCalendarForVolunteer(select.value);
        });

        // Calendar navigation
        document.getElementById('btn-cal-prev').addEventListener('click', () => {
            calendarMonth--;
            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear--;
            }
            document.getElementById('calendar-day-detail').style.display = 'none';
            renderCalendar();
        });

        document.getElementById('btn-cal-next').addEventListener('click', () => {
            calendarMonth++;
            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear++;
            }
            document.getElementById('calendar-day-detail').style.display = 'none';
            renderCalendar();
        });

        // Jump to month via dropdown
        document.getElementById('cal-month-select').addEventListener('change', (e) => {
            calendarMonth = parseInt(e.target.value);
            document.getElementById('calendar-day-detail').style.display = 'none';
            renderCalendar();
        });

        // Jump to year via dropdown
        document.getElementById('cal-year-select').addEventListener('change', (e) => {
            calendarYear = parseInt(e.target.value);
            document.getElementById('calendar-day-detail').style.display = 'none';
            renderCalendar();
        });

        // Click on calendar day
        document.getElementById('calendar-days').addEventListener('click', (e) => {
            const cell = e.target.closest('.calendar-cell:not(.empty)');
            if (!cell) return;
            const day = parseInt(cell.dataset.day);
            showDayDetail(day);
        });

        // Close day detail
        document.getElementById('btn-close-day-detail').addEventListener('click', () => {
            document.getElementById('calendar-day-detail').style.display = 'none';
        });

        // Save/Delete day records (delegated)
        document.getElementById('day-detail-records').addEventListener('click', (e) => {
            const saveBtn = e.target.closest('.btn-save-day-record');
            const deleteBtn = e.target.closest('.btn-delete-day-record');

            if (saveBtn) {
                const index = parseInt(saveBtn.dataset.index);
                const recordEl = saveBtn.closest('.day-record-item');
                saveDayRecord(index, recordEl);
            }

            if (deleteBtn) {
                const index = parseInt(deleteBtn.dataset.index);
                deleteDayRecord(index);
            }
        });

        // Add record from calendar
        document.getElementById('btn-cal-add-record').addEventListener('click', () => {
            if (!selectedCalendarDay) {
                alert('Select a day on the calendar first.');
                return;
            }
            addCalendarRecord();
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

        // --- Settings: Change passwords ---
        document.getElementById('btn-save-unlock-pw').addEventListener('click', () => {
            const input = document.getElementById('settings-new-unlock');
            const msg = document.getElementById('unlock-pw-saved');
            if (!input.value.trim()) {
                alert('Please enter a new password.');
                return;
            }
            setUnlockPassword(input.value.trim());
            input.value = '';
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        });

        document.getElementById('btn-save-admin-pw').addEventListener('click', () => {
            const input = document.getElementById('settings-new-admin');
            const msg = document.getElementById('admin-pw-saved');
            if (!input.value.trim()) {
                alert('Please enter a new password.');
                return;
            }
            setAdminPassword(input.value.trim());
            input.value = '';
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        });

        // Show/hide current passwords
        document.getElementById('btn-show-unlock-pw').addEventListener('click', () => {
            const span = document.getElementById('display-unlock-pw');
            const btn = document.getElementById('btn-show-unlock-pw');
            if (span.textContent === '••••') {
                span.textContent = getUnlockPassword();
                btn.textContent = 'Hide';
            } else {
                span.textContent = '••••';
                btn.textContent = 'Show';
            }
        });

        document.getElementById('btn-show-admin-pw').addEventListener('click', () => {
            const span = document.getElementById('display-admin-pw');
            const btn = document.getElementById('btn-show-admin-pw');
            if (span.textContent === '••••') {
                span.textContent = getAdminPassword();
                btn.textContent = 'Hide';
            } else {
                span.textContent = '••••';
                btn.textContent = 'Show';
            }
        });
    }

    // --- Local Storage Fallback (works without Google Sheets) ---

    const LOCAL_STORAGE_KEYS = {
        volunteers: 'icna_volunteers',
        logs: 'icna_clock_logs'
    };

    function saveLocal() {
        localStorage.setItem(LOCAL_STORAGE_KEYS.volunteers, JSON.stringify(volunteers));
        localStorage.setItem(LOCAL_STORAGE_KEYS.logs, JSON.stringify(logs));
    }

    function loadLocal() {
        try {
            const savedVol = localStorage.getItem(LOCAL_STORAGE_KEYS.volunteers);
            const savedLogs = localStorage.getItem(LOCAL_STORAGE_KEYS.logs);
            if (savedVol) volunteers = JSON.parse(savedVol);
            if (savedLogs) logs = JSON.parse(savedLogs);
        } catch (e) {
            console.error('Error loading local data:', e);
        }
    }

    function isOnlineMode() {
        return GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.length > 10;
    }

    // --- Initialize App ---

    async function init() {
        updateClock();
        setInterval(updateClock, 1000);
        initAdminTabs();
        initEvents();
        // Volunteers load after unlock — don't load here
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
