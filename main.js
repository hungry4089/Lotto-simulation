// Lotto One-View Logic
const state = {
    myNumberSets: [], 
    drawCount: 0,
    isSimulating: false,
    randomizeEachDraw: false,
    frequencies: new Array(46).fill(0),
    winStats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    history: [],
    targetRank: 1,
    miniChart: null
};

// --- Lotto Core ---
function generateNumbers() {
    const pool = Array.from({ length: 45 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const numbers = pool.slice(0, 6).sort((a, b) => a - b);
    const bonus = pool[6];
    return { numbers, bonus };
}

function checkWinning(mySet, winningNumbers, bonus) {
    const matchCount = mySet.filter(n => winningNumbers.includes(n)).length;
    const bonusMatch = mySet.includes(bonus);
    if (matchCount === 6) return 1;
    if (matchCount === 5 && bonusMatch) return 2;
    if (matchCount === 5) return 3;
    if (matchCount === 4) return 4;
    if (matchCount === 3) return 5;
    return 0;
}

function getBallColorClass(num) {
    if (num <= 10) return 'ball-yellow';
    if (num <= 20) return 'ball-blue';
    if (num <= 30) return 'ball-red';
    if (num <= 40) return 'ball-gray';
    return 'ball-green';
}

// --- UI Components ---
function createBallElement(num, sizeClass = '') {
    const ball = document.createElement('div');
    ball.className = `ball ${getBallColorClass(num)} ${sizeClass}`;
    ball.textContent = num;
    return ball;
}

function updateHistoryWheel(winningResult, highestRank, isWinHistory = false) {
    const wheelId = isWinHistory ? 'win-history-wheel' : 'history-wheel';
    const wheel = document.getElementById(wheelId);
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    
    const ballsDiv = document.createElement('div');
    ballsDiv.className = 'entry-balls';
    winningResult.numbers.forEach(n => {
        const b = document.createElement('div');
        b.className = `entry-ball ${getBallColorClass(n)}`;
        b.textContent = n;
        ballsDiv.appendChild(b);
    });
    const plus = document.createElement('span'); plus.textContent = '+'; plus.style.fontSize = '10px';
    ballsDiv.appendChild(plus);
    const bonusB = document.createElement('div');
    bonusB.className = `entry-ball ${getBallColorClass(winningResult.bonus)}`;
    bonusB.textContent = winningResult.bonus;
    ballsDiv.appendChild(bonusB);

    entry.appendChild(ballsDiv);

    if (highestRank > 0) {
        const tag = document.createElement('span');
        tag.className = `win-tag win-${highestRank}`;
        tag.textContent = `${highestRank}등`;
        entry.appendChild(tag);
    }

    wheel.prepend(entry);
    
    // Performance: limit history size
    const limit = isWinHistory ? 100 : 50;
    if (wheel.childNodes.length > limit) wheel.removeChild(wheel.lastChild);
}

function updateStats(numbers) {
    numbers.forEach(n => state.frequencies[n]++);
    if (state.miniChart) {
        state.miniChart.data.datasets[0].data = state.frequencies.slice(1);
        state.miniChart.update('none'); 
    }
}

function updateWinStats(rank) {
    if (rank >= 1 && rank <= 5) {
        state.winStats[rank]++;
        document.getElementById(`stat-win-${rank}`).textContent = `${state.winStats[rank].toLocaleString()}회`;
    }
}

function updateWeeklyCostUI() {
    const rowCount = document.querySelectorAll('.number-row').length;
    const cost = rowCount * 1000;
    document.getElementById('weekly-cost').textContent = `${cost.toLocaleString()}원/주 (${rowCount}개)`;
}

function initChart() {
    const ctx = document.getElementById('mini-freq-chart').getContext('2d');
    state.miniChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 45 }, (_, i) => i + 1),
            datasets: [{
                data: state.frequencies.slice(1),
                backgroundColor: Array.from({ length: 45 }, (_, i) => {
                    const n = i + 1;
                    if (n <= 10) return '#facc15'; 
                    if (n <= 20) return '#3b82f6'; 
                    if (n <= 30) return '#ef4444'; 
                    if (n <= 40) return '#94a3b8'; 
                    return '#22c55e'; 
                }),
                borderRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400 }, 
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { display: false, beginAtZero: true }
            }
        }
    });
}

// --- Simulation Loop ---
let animationFrameId = null;
let lastTimestamp = 0;

function performDraws(batchSize) {
    let lastDraw = null;
    let lastWinHits = [];
    const rows = document.querySelectorAll('.number-row');
    const rowCount = rows.length;

    for (let i = 0; i < batchSize; i++) {
        state.drawCount++;
        const draw = generateNumbers();
        lastDraw = draw;
        updateStats([...draw.numbers, draw.bonus]);

        if (state.randomizeEachDraw) {
            state.myNumberSets = [];
            rows.forEach(row => {
                const rnd = generateNumbers().numbers;
                state.myNumberSets.push(rnd);
                
                if (i === batchSize - 1) {
                    const inputs = row.querySelectorAll('input');
                    inputs.forEach((inp, idx) => inp.value = rnd[idx]);
                }
            });
        } else {
            syncMyNumbers();
        }

        let currentHighest = 0;
        let hitsForHighest = [];
        state.myNumberSets.forEach(set => {
            const rank = checkWinning(set, draw.numbers, draw.bonus);
            if (rank > 0) {
                updateWinStats(rank);
                if (currentHighest === 0 || rank < currentHighest) {
                    currentHighest = rank;
                    hitsForHighest = set.filter(n => draw.numbers.includes(n));
                    if (set.includes(draw.bonus)) hitsForHighest.push(draw.bonus);
                }
            }
        });

        // Log to real-time history (all draws)
        updateHistoryWheel(draw, currentHighest, false);

        if (currentHighest > 0) {
            // Log to winning history
            updateHistoryWheel(draw, currentHighest, true);
            lastWinHits = hitsForHighest;
            if (currentHighest === 1) {
                triggerCelebration();
                stopSimulation(`축하합니다! 1등 당첨입니다!`);
                renderCurrentBalls(draw, hitsForHighest);
                return true;
            }
            if (currentHighest <= state.targetRank) {
                stopSimulation(`축하합니다! ${currentHighest}등에 당첨되어 중단합니다.`);
                renderCurrentBalls(draw, hitsForHighest);
                return true;
            }
        }
    }

    const totalSpent = state.drawCount * rowCount * 1000;
    document.getElementById('draw-count').textContent = `${state.drawCount.toLocaleString()}회 시도`;
    document.getElementById('total-cost').textContent = `${totalSpent.toLocaleString()}원`;
    document.getElementById('total-time').textContent = formatTime(state.drawCount);
    renderCurrentBalls(lastDraw, lastWinHits);
    return false;
}

function triggerCelebration() {
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.innerHTML = `
        <div class="celebration-text">1등 당첨!</div>
        <div style="font-size: 2rem; color: white;">당신은 이제 부자입니다!</div>
    `;
    document.body.appendChild(overlay);

    for (let i = 0; i < 50; i++) {
        createFirework();
    }

    setTimeout(() => {
        overlay.remove();
    }, 5000);
}

function createFirework() {
    const fw = document.createElement('div');
    fw.className = 'firework';
    fw.style.left = Math.random() * 100 + 'vw';
    fw.style.top = Math.random() * 100 + 'vh';
    fw.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
    fw.style.boxShadow = `0 0 10px ${fw.style.backgroundColor}`;
    document.body.appendChild(fw);
    
    const animation = fw.animate([
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(20)', opacity: 0 }
    ], {
        duration: 1000 + Math.random() * 1000,
        easing: 'ease-out'
    });

    animation.onfinish = () => fw.remove();
}

function simLoop(timestamp) {
    if (!state.isSimulating) return;

    const speed = parseInt(document.getElementById('speed-slider').value);
    let shouldStop = false;

    if (speed <= 10) {
        const interval = 1000 / speed;
        if (timestamp - lastTimestamp >= interval) {
            shouldStop = performDraws(1);
            lastTimestamp = timestamp;
        }
    } else {
        // High speed mode: 11~100 (more draws per frame)
        // Note: Logging ALL draws at high speed may impact performance, 
        // but we'll try to keep it balanced by limiting DOM size in updateHistoryWheel.
        const batchSize = Math.floor((speed - 10) * 0.2) + 1;
        shouldStop = performDraws(batchSize);
    }

    if (!shouldStop) {
        animationFrameId = requestAnimationFrame(simLoop);
    }
}

function renderCurrentBalls(draw, hits = []) {
    if (!draw) return;
    const container = document.getElementById('current-balls');
    container.innerHTML = '';
    draw.numbers.forEach(n => {
        const ball = createBallElement(n);
        if (hits.includes(n)) ball.classList.add('win-hit');
        container.appendChild(ball);
    });
    const plus = document.createElement('div'); plus.className = 'bonus-plus'; plus.textContent = '+'; plus.style.fontSize = '2rem';
    container.appendChild(plus);
    const bonusBall = createBallElement(draw.bonus);
    if (hits.includes(draw.bonus)) bonusBall.classList.add('win-hit');
    container.appendChild(bonusBall);
}

function formatTime(count) {
    const weeks = Math.floor(count / 5);
    const years = Math.floor(weeks / 52);
    if (years > 0) return `${years}년 ${weeks % 52}주`;
    return `${weeks}주`;
}

function startSimulation() {
    state.randomizeEachDraw = document.getElementById('random-each-draw-toggle').checked;
    
    if (!state.randomizeEachDraw) {
        syncMyNumbers();
        if (state.myNumberSets.length === 0) {
            alert('최소 하나 이상의 번호 세트를 입력하세요.');
            return;
        }
    } else {
        const rowCount = document.querySelectorAll('.number-row').length;
        if (rowCount === 0) {
            alert('번호 목록이 비어있습니다. 줄을 먼저 추가해주세요.');
            return;
        }
    }

    state.targetRank = parseInt(document.getElementById('target-rank').value);
    state.isSimulating = true;
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'block';
    lastTimestamp = performance.now();
    simLoop(lastTimestamp);
}

function stopSimulation(msg) {
    state.isSimulating = false;
    cancelAnimationFrame(animationFrameId);
    document.getElementById('start-btn').style.display = 'block';
    document.getElementById('stop-btn').style.display = 'none';
    if (msg) alert(msg);
}

// --- My Numbers Management ---
function addNumberRow(values = [null,null,null,null,null,null]) {
    const list = document.getElementById('my-numbers-list');
    const row = document.createElement('div');
    row.className = 'number-row';
    
    for (let i = 0; i < 6; i++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1; input.max = 45;
        if (values[i]) input.value = values[i];
        row.appendChild(input);
    }

    const rndBtn = document.createElement('button');
    rndBtn.textContent = '🎲';
    rndBtn.className = 'icon-btn';
    rndBtn.style.background = '#334155';
    rndBtn.style.fontSize = '0.8rem';
    rndBtn.onclick = () => {
        const rnd = generateNumbers().numbers;
        row.querySelectorAll('input').forEach((inp, idx) => inp.value = rnd[idx]);
    };
    row.appendChild(rndBtn);

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '&times;';
    delBtn.className = 'remove-row-btn';
    delBtn.onclick = () => {
        list.removeChild(row);
        updateWeeklyCostUI();
    };
    row.appendChild(delBtn);

    list.appendChild(row);
    updateWeeklyCostUI();
}

function syncMyNumbers() {
    const rows = document.querySelectorAll('.number-row');
    state.myNumberSets = [];
    rows.forEach(row => {
        const nums = Array.from(row.querySelectorAll('input')).map(i => parseInt(i.value)).filter(n => !isNaN(n) && n >= 1 && n <= 45);
        if (nums.length === 6) state.myNumberSets.push(nums);
    });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    addNumberRow([7, 12, 23, 31, 40, 45]); 
    
    document.getElementById('add-row-btn').onclick = () => addNumberRow();
    
    document.getElementById('batch-add-btn').onclick = () => {
        const count = parseInt(document.getElementById('batch-count').value);
        if (isNaN(count) || count < 1) return;
        for (let i = 0; i < count; i++) {
            const rnd = generateNumbers().numbers;
            addNumberRow(rnd);
        }
    };

    document.getElementById('fill-random-btn').onclick = () => {
        document.querySelectorAll('.number-row').forEach(row => {
            const rnd = generateNumbers().numbers;
            row.querySelectorAll('input').forEach((inp, idx) => inp.value = rnd[idx]);
        });
    };

    document.getElementById('start-btn').onclick = startSimulation;
    document.getElementById('stop-btn').onclick = () => stopSimulation();
    document.getElementById('reset-btn').onclick = resetSimulation;
});

function resetSimulation() {
    if (state.isSimulating) {
        stopSimulation();
    }
    
    if (!confirm('모든 추첨 데이터를 초기화할까요? (내 번호 목록은 유지됩니다)')) return;

    state.drawCount = 0;
    state.frequencies.fill(0);
    state.winStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    document.getElementById('draw-count').textContent = '0회 시도';
    document.getElementById('total-cost').textContent = '0원';
    document.getElementById('total-time').textContent = '0주';
    document.getElementById('history-wheel').innerHTML = '';
    document.getElementById('win-history-wheel').innerHTML = '';
    document.getElementById('current-balls').innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`stat-win-${i}`).textContent = '0회';
    }

    if (state.miniChart) {
        state.miniChart.data.datasets[0].data = state.frequencies.slice(1);
        state.miniChart.update();
    }
}
