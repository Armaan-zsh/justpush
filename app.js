// ===== Pushup Tracker - Simple JSON Version =====

let currentMode = 'pushups';
// Load data from json file based on mode
async function getData(mode) {
    try {
        const response = await fetch(`./${mode}.json`);
        return await response.json();
    } catch (error) {
        console.error(`Failed to load ${mode} data:`, error);
        return {};
    }
}

// Global state
let historyExpanded = false;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    // Setup Toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.mode;
            switchMode(mode);
        });
    });

    // Setup Show More
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            historyExpanded = !historyExpanded;
            render();
        });
    }

    render();
});

async function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    // Update Toggle UI
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update Title? Optional, sticking to minimal change
    // document.title = mode === 'pushups' ? 'Pushups' : 'Squats';

    render();
}

async function render() {
    const data = await getData(currentMode);

    // Progress
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const goal = 10000; // Both have 10k goal

    // Update goal text color/label if needed, but keeping it simple
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
    // History
    const tbody = document.getElementById('historyTableBody');
    const sorted = Object.keys(data).sort((a, b) => new Date(b) - new Date(a));

    // Limits
    const limit = historyExpanded ? sorted.length : 7;
    const historySlice = sorted.slice(0, limit);

    tbody.innerHTML = historySlice.map(date => {
        const d = new Date(date + 'T00:00:00');
        const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<tr><td>${formatted}</td><td>${data[date]}</td></tr>`;
    }).join('');

    // Show More Button Logic
    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
        if (sorted.length <= 7) {
            showMoreBtn.style.display = 'none';
        } else {
            showMoreBtn.style.display = 'inline-block';
            showMoreBtn.textContent = historyExpanded ? 'Show Less' : 'Show History';
        }
    }
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

    const maxVal = Math.max(...Object.values(data), 1); // Dynamic scaling
    // Fallback if no data
    const scaleMax = maxVal > 0 ? maxVal : 1;

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
            const level = count === 0 ? 0 : count <= scaleMax * 0.25 ? 1 : count <= scaleMax * 0.5 ? 2 : count <= scaleMax * 0.75 ? 3 : 4;
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

    // Auto scroll to end
    setTimeout(() => {
        document.getElementById('heatmapScroll').scrollLeft = 9999;
    }, 0);
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
