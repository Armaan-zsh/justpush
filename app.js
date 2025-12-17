// ===== Pushup Tracker - Secure Supabase Version =====

const SUPABASE_URL = 'https://glamztevtjslfxhdwjuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsYW16dGV2dGpzbGZ4aGR3anVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODYwOTMsImV4cCI6MjA4MTU2MjA5M30.WYHzFGDMiqYFOMVEiHboQ0z6xzes5tzExV4lyt8jIVM';

// Admin token - you'll add this as a secret in the URL
// Visit: justpush.vercel.app?token=YOUR_SECRET_TOKEN
let adminToken = null;

// ===== Data from Supabase =====
async function getData() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pushups?select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const rows = await response.json();
        const data = {};
        if (Array.isArray(rows)) {
            rows.forEach(row => {
                data[row.date] = row.count;
            });
        }
        return data;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return {};
    }
}

// ===== Admin Auth =====
function isAdmin() {
    return sessionStorage.getItem('adminToken') !== null;
}

function checkAdmin() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    // If token in URL, save it and show add form
    if (token) {
        sessionStorage.setItem('adminToken', token);
        adminToken = token;
        document.getElementById('addForm').style.display = 'flex';
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    // Check if already logged in
    const savedToken = sessionStorage.getItem('adminToken');
    if (savedToken) {
        adminToken = savedToken;
        document.getElementById('addForm').style.display = 'flex';
    }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    checkAdmin();

    const addBtn = document.getElementById('addEntryBtn');
    const dateInput = document.getElementById('entryDate');
    const countInput = document.getElementById('entryCount');

    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (addBtn) addBtn.addEventListener('click', addEntry);
    if (countInput) countInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') addEntry();
    });

    render();
});

async function addEntry() {
    const date = document.getElementById('entryDate').value;
    const count = parseInt(document.getElementById('entryCount').value);
    const token = sessionStorage.getItem('adminToken');

    if (!date || isNaN(count) || count < 0) return;
    if (!token) {
        alert('Not logged in as admin');
        return;
    }

    try {
        // Use the token as the service key for writes
        const response = await fetch(`${SUPABASE_URL}/rest/v1/pushups`, {
            method: 'POST',
            headers: {
                'apikey': token,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ date, count })
        });

        if (!response.ok) {
            const error = await response.text();
            alert('Failed to add: ' + error);
            return;
        }

        document.getElementById('entryCount').value = '';
        render();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function render() {
    const data = await getData();

    // Progress
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const goal = 10000;
    document.getElementById('totalPushups').textContent = total.toLocaleString();
    document.getElementById('goalCount').textContent = goal.toLocaleString();
    document.getElementById('progressBar').style.width = `${Math.min((total / goal) * 100, 100)}%`;

    // Heatmap
    renderHeatmap(data);

    // Stats (last 30 days)
    const dates = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    const values = dates.map(d => data[d] || 0);
    const nonZero = values.filter(v => v > 0);

    document.getElementById('avgPushups').textContent = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
    document.getElementById('maxPushups').textContent = nonZero.length ? Math.max(...nonZero) : 0;
    document.getElementById('streakDays').textContent = calcStreak(data);

    renderChart(dates, values);

    // History
    const tbody = document.getElementById('historyTableBody');
    const sorted = Object.keys(data).sort((a, b) => new Date(b) - new Date(a));
    tbody.innerHTML = sorted.map(date => {
        const d = new Date(date + 'T00:00:00');
        const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<tr><td>${formatted}</td><td>${data[date]}</td></tr>`;
    }).join('');
}

function calcStreak(data) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        if (data[key] > 0) streak++;
        else if (i > 0) break;
    }
    return streak;
}

// ===== Heatmap =====
function renderHeatmap(data) {
    const grid = document.getElementById('heatmapGrid');
    const months = document.getElementById('heatmapMonths');
    grid.innerHTML = '';
    months.innerHTML = '';

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const maxVal = Math.max(...Object.values(data), 1);
    const monthLabels = [];
    let currentMonth = -1;
    let weekIdx = 0;
    const current = new Date(start);

    while (current <= today) {
        const week = document.createElement('div');
        week.className = 'heatmap-week';

        if (current.getMonth() !== currentMonth) {
            monthLabels.push({ month: current.getMonth(), week: weekIdx });
            currentMonth = current.getMonth();
        }

        for (let d = 0; d < 7; d++) {
            const el = document.createElement('div');
            el.className = 'heatmap-day';
            const key = current.toISOString().split('T')[0];
            const count = data[key] || 0;
            const level = count === 0 ? 0 : count <= maxVal * 0.25 ? 1 : count <= maxVal * 0.5 ? 2 : count <= maxVal * 0.75 ? 3 : 4;
            if (level) el.classList.add(`level-${level}`);
            el.dataset.date = key;
            el.dataset.count = count;
            el.addEventListener('mouseenter', showTip);
            el.addEventListener('mouseleave', hideTip);
            week.appendChild(el);
            current.setDate(current.getDate() + 1);
        }
        grid.appendChild(week);
        weekIdx++;
    }

    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthLabels.forEach(({ month, week }, i) => {
        const span = document.createElement('span');
        span.textContent = names[month];
        const next = monthLabels[i + 1]?.week || weekIdx;
        span.style.minWidth = `${(next - week) * 15}px`;
        months.appendChild(span);
    });

    document.getElementById('heatmapScroll').scrollLeft = 9999;
}

function showTip(e) {
    const tip = document.getElementById('tooltip');
    tip.textContent = `${e.target.dataset.date}: ${e.target.dataset.count}`;
    tip.classList.add('visible');
    const r = e.target.getBoundingClientRect();
    tip.style.left = `${r.left + r.width / 2 - tip.offsetWidth / 2}px`;
    tip.style.top = `${r.top - 28}px`;
}

function hideTip() {
    document.getElementById('tooltip').classList.remove('visible');
}

// ===== Chart =====
let chart = null;
function renderChart(dates, values) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                data: values,
                backgroundColor: values.map(v => v > 0 ? '#000' : '#eee'),
                borderRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: { weight: '600' },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#999', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    ticks: { color: '#999', font: { size: 10 } },
                    border: { display: false }
                }
            }
        }
    });
}
