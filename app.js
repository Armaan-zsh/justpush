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
let selectedYear = new Date().getFullYear(); // Default to current year

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

    // Stats (all time for chart, last 30 days for averages)
    const allDates = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));
    const allValues = allDates.map(d => data[d] || 0);

    // For stats display, use last 30 days
    const today = new Date();
    const last30Dates = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        last30Dates.push(d.toISOString().split('T')[0]);
    }
    const last30Values = last30Dates.map(d => data[d] || 0);
    const nonZero = last30Values.filter(v => v > 0);

    document.getElementById('avgPushups').textContent = nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
    document.getElementById('maxPushups').textContent = nonZero.length ? Math.max(...nonZero) : 0;
    document.getElementById('streakDays').textContent = calcStreak(data);

    // Chart uses ALL data
    renderChart(allDates, allValues);

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
    const yearSelector = document.getElementById('yearSelector');
    grid.innerHTML = '';
    months.innerHTML = '';

    // Get available years from data
    const years = [...new Set(Object.keys(data).map(d => parseInt(d.split('-')[0])))].sort((a, b) => b - a);

    // Add current year if not in data
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) {
        years.unshift(currentYear);
    }

    // Ensure selectedYear is valid
    if (!years.includes(selectedYear)) {
        selectedYear = years[0];
    }

    // Render year selector
    yearSelector.innerHTML = years.map(year =>
        `<button class="year-btn ${year === selectedYear ? 'active' : ''}" data-year="${year}">${year}</button>`
    ).join('');

    // Add click handlers for year buttons
    yearSelector.querySelectorAll('.year-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedYear = parseInt(btn.dataset.year);
            render(); // Re-render everything
        });
    });

    // Calculate date range for selected year
    const yearEnd = new Date(selectedYear, 11, 31);
    const yearStart = new Date(selectedYear, 0, 1);

    // Adjust start to previous Sunday for grid alignment
    const start = new Date(yearStart);
    start.setDate(start.getDate() - start.getDay());

    // Always show full year grid
    const today = new Date();
    const end = yearEnd;

    const maxVal = Math.max(...Object.values(data), 1);
    const scaleMax = maxVal > 0 ? maxVal : 1;

    const monthLabels = [];
    let currentMonth = -1;
    let weekIdx = 0;
    const current = new Date(start);

    while (current <= end) {
        const week = document.createElement('div');
        week.className = 'heatmap-week';

        if (current.getMonth() !== currentMonth && current.getFullYear() === selectedYear) {
            monthLabels.push({ month: current.getMonth(), week: weekIdx });
            currentMonth = current.getMonth();
        }

        for (let d = 0; d < 7; d++) {
            const el = document.createElement('div');
            el.className = 'heatmap-day';

            // Use local date format to avoid timezone issues
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            const count = data[key] || 0;

            // Only hide days outside the selected year (grid alignment days)
            const isInYear = year === selectedYear;
            const isFuture = current > today;

            if (!isInYear) {
                // Days from previous year used for grid alignment
                el.style.visibility = 'hidden';
            } else if (isFuture) {
                // Future days in current year - show as empty gray cells
                el.dataset.date = key;
                el.dataset.count = 0;
                el.addEventListener('mouseenter', showTip);
                el.addEventListener('mouseleave', hideTip);
            } else {
                // Past/present days with potential data
                const level = count === 0 ? 0 : count <= scaleMax * 0.25 ? 1 : count <= scaleMax * 0.5 ? 2 : count <= scaleMax * 0.75 ? 3 : 4;
                if (level) el.classList.add(`level-${level}`);
                el.dataset.date = key;
                el.dataset.count = count;
                el.addEventListener('mouseenter', showTip);
                el.addEventListener('mouseleave', hideTip);
            }

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

    // Auto scroll to end for current year
    if (selectedYear === currentYear) {
        setTimeout(() => {
            document.getElementById('heatmapScroll').scrollLeft = 9999;
        }, 0);
    } else {
        document.getElementById('heatmapScroll').scrollLeft = 0;
    }
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

// Calculate moving average for trend line
function movingAverage(data, windowSize = 5) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
            if (data[j] > 0) {
                sum += data[j];
                count++;
            }
        }
        result.push(count > 0 ? sum / count : null);
    }
    return result;
}

function renderChart(dates, values) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (chart) chart.destroy();

    const labels = dates.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const trendData = movingAverage(values, 5);

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                // Smooth trend line
                {
                    data: trendData,
                    borderColor: '#00d4aa',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#00d4aa',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#2c2e31',
                    titleColor: '#d1d0c5',
                    bodyColor: '#00d4aa',
                    titleFont: { weight: '600', size: 12 },
                    bodyFont: { weight: '600', size: 14 },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    filter: (item) => item.datasetIndex === 0,
                    callbacks: {
                        label: (item) => `${values[item.dataIndex]} pushups`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#646669',
                        font: { size: 11 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 6
                    },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: '#646669', font: { size: 11 } },
                    border: { display: false }
                }
            }
        }
    });
}
