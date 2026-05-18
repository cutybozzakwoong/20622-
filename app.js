/* ==========================================================================
   Cleaning Duty Picker - Interactive Logic (app.js)
   ========================================================================== */

// 1. Audio Synthesis Engine using browser's AudioContext
class SoundSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // Lazy initialize the audio context due to browser autoplay policies
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Retro arcade click sound for lottery ticks
  playTick() {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      // Fast exponential pitch drop makes a satisfying tick/clack
      osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Sound synthesis error: ", e);
    }
  }

  // Happy ascending synthesizer arpeggio for victory fanfare
  playWinFanfare() {
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      
      // Happy pentatonic/major chord progression: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.50];
      
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now);

        gain.gain.setValueAtTime(0.15, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.28);
      });
    } catch (e) {
      console.warn("Sound synthesis error: ", e);
    }
  }

  // Smooth pitch-down sweep for resetting the app
  playReset() {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Sound synthesis error: ", e);
    }
  }

  // Low frequency buzz buzz for validation errors
  playError() {
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.setValueAtTime(100, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn("Sound synthesis error: ", e);
    }
  }
}

// 2. Application Setup & State Management
const synth = new SoundSynth();

// DOM References
const totalInput = document.getElementById('total-candidates');
const winnerInput = document.getElementById('winner-count');
const soundToggle = document.getElementById('sound-toggle');
const candidateCountDisplay = document.getElementById('candidate-count-display');
const numberGrid = document.getElementById('number-grid');
const drawStatus = document.getElementById('draw-status');
const rollingNumber = document.getElementById('current-rolling-number');
const btnDraw = document.getElementById('btn-draw');
const btnReset = document.getElementById('btn-reset');
const winnersContainer = document.getElementById('winners-container');
const emptyWinnersMsg = document.getElementById('empty-winners-msg');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyList = document.getElementById('history-list');
const emptyHistoryMsg = document.getElementById('empty-history-msg');
const wheelOuter = document.querySelector('.wheel-outer');

// App Variables
let totalCandidates = 30;
let winnerCount = 5;
let skippedCandidates = new Set(); // Stores absent numbers (e.g. clicked cells)
let selectedWinners = [];
let isDrawing = false;
let drawHistory = [];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadHistory();
  renderGrid();
  renderHistory();
  setupEventListeners();
});

// Helper for delays inside async loops
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load user settings from localStorage if available
function loadSettings() {
  const savedTotal = localStorage.getItem('cleaning_duty_total');
  const savedWinner = localStorage.getItem('cleaning_duty_winner');
  const savedSound = localStorage.getItem('cleaning_duty_sound');

  if (savedTotal) {
    totalCandidates = parseInt(savedTotal, 10);
    totalInput.value = totalCandidates;
  }
  if (savedWinner) {
    winnerCount = parseInt(savedWinner, 10);
    winnerInput.value = winnerCount;
  }
  if (savedSound) {
    synth.enabled = savedSound === 'true';
    soundToggle.checked = synth.enabled;
  }
}

// Load draw history from localStorage
function loadHistory() {
  const savedHistory = localStorage.getItem('cleaning_duty_history');
  if (savedHistory) {
    try {
      drawHistory = JSON.parse(savedHistory);
    } catch (e) {
      drawHistory = [];
    }
  }
}

// 3. Grid Renderer
function renderGrid() {
  numberGrid.innerHTML = '';
  
  // Update candidate labels
  const activeCount = totalCandidates - skippedCandidates.size;
  candidateCountDisplay.textContent = `참가자 ${activeCount}명 / 총 ${totalCandidates}명`;

  for (let i = 1; i <= totalCandidates; i++) {
    const cell = document.createElement('button');
    cell.className = 'number-cell';
    cell.id = `cell-${i}`;
    cell.textContent = i;
    cell.setAttribute('aria-label', `후보 ${i}번`);

    // Restore classes based on state
    if (skippedCandidates.has(i)) {
      cell.classList.add('skipped');
      cell.setAttribute('title', '열외됨 (추첨 제외)');
    } else if (selectedWinners.includes(i)) {
      cell.classList.add('winner-selected');
      cell.setAttribute('title', '당첨자');
    } else {
      cell.setAttribute('title', '참가 중 (클릭 시 열외)');
    }

    // Single cell interactive toggle (Toggle Absence/Skipped)
    cell.addEventListener('click', () => {
      if (isDrawing || selectedWinners.length > 0) return; // Prevent edits during or after a draw
      
      synth.init(); // Initialize audio
      if (skippedCandidates.has(i)) {
        skippedCandidates.delete(i);
        cell.classList.remove('skipped');
        cell.setAttribute('title', '참가 중 (클릭 시 열외)');
        synth.playTick();
      } else {
        // Prevent skipping everyone
        if (skippedCandidates.size >= totalCandidates - 1) {
          synth.playError();
          alert('최소 1명의 후보자는 참가 중이어야 합니다!');
          return;
        }
        skippedCandidates.add(i);
        cell.classList.add('skipped');
        cell.setAttribute('title', '열외됨 (추첨 제외)');
        synth.playTick();
      }
      
      // Update candidate numbers
      const updatedActiveCount = totalCandidates - skippedCandidates.size;
      candidateCountDisplay.textContent = `참가자 ${updatedActiveCount}명 / 총 ${totalCandidates}명`;
    });

    numberGrid.appendChild(cell);
  }
}

// 4. Setup Input & Button Interactions
function setupEventListeners() {
  // Input validations
  totalInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 5) val = 5;
    if (val > 100) val = 100;
    
    totalCandidates = val;
    e.target.value = val;
    localStorage.setItem('cleaning_duty_total', val);
    
    // Clear skip set if it has invalid index
    skippedCandidates.clear();
    resetDrawState();
  });

  winnerInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 10) val = 10;
    
    winnerCount = val;
    e.target.value = val;
    localStorage.setItem('cleaning_duty_winner', val);
  });

  soundToggle.addEventListener('change', (e) => {
    synth.enabled = e.target.checked;
    localStorage.setItem('cleaning_duty_sound', synth.enabled);
    synth.init(); // Init Audio Context
  });

  // Action Buttons
  btnDraw.addEventListener('click', () => {
    if (isDrawing) return;
    if (selectedWinners.length > 0) {
      // If already drawn, let drawing start fresh after visual reset
      resetDrawState();
    }
    startDrawFlow();
  });

  btnReset.addEventListener('click', () => {
    if (isDrawing) return;
    resetDrawState();
    synth.playReset();
  });

  btnClearHistory.addEventListener('click', () => {
    if (confirm('모든 추첨 기록을 삭제하시겠습니까?')) {
      drawHistory = [];
      localStorage.removeItem('cleaning_duty_history');
      renderHistory();
      synth.playReset();
    }
  });
}

// 5. Lottery Sequential Animation Loop
async function startDrawFlow() {
  // Assemble active lottery pool
  const activePool = [];
  for (let i = 1; i <= totalCandidates; i++) {
    if (!skippedCandidates.has(i)) {
      activePool.push(i);
    }
  }

  // Validate pool capability
  if (activePool.length < winnerCount) {
    synth.playError();
    alert(`활성 후보자 수(${activePool.length}명)가 선정하려는 당번 수(${winnerCount}명)보다 적습니다.\n설정의 '최대 번호'를 늘리거나 '열외자'를 해제해 주세요.`);
    return;
  }

  // Enable Drawing Lock
  isDrawing = true;
  selectedWinners = [];
  toggleInputs(true);
  
  // Prepare layout
  emptyWinnersMsg.style.display = 'none';
  winnersContainer.innerHTML = '';
  drawStatus.classList.add('drawing');
  wheelOuter.classList.add('spinning');
  
  // Clear any previously highlighted cells in rendering
  document.querySelectorAll('.number-cell').forEach(c => {
    c.classList.remove('winner-selected');
  });

  // Draw each winner one by one sequentially
  for (let currentRound = 0; currentRound < winnerCount; currentRound++) {
    drawStatus.textContent = `당번 추첨 중... (${currentRound + 1} / ${winnerCount})`;
    
    // Slowdown exponential speed progression (Slot machine brake simulation)
    const rollingIntervals = [30, 35, 40, 50, 65, 80, 105, 135, 175, 225, 290, 370, 470, 600];
    let temporaryHighlightCell = null;

    for (let step = 0; step < rollingIntervals.length; step++) {
      // Pick random temporary candidate from remaining active members
      const tempPool = activePool.filter(num => !selectedWinners.includes(num));
      const tempWinner = tempPool[Math.floor(Math.random() * tempPool.length)];

      // Visually flash in grid
      if (temporaryHighlightCell) {
        temporaryHighlightCell.classList.remove('active-rolling');
      }
      temporaryHighlightCell = document.getElementById(`cell-${tempWinner}`);
      if (temporaryHighlightCell) {
        temporaryHighlightCell.classList.add('active-rolling');
      }

      // Update slot display
      rollingNumber.textContent = tempWinner;
      
      // Play satisfying click sound
      synth.playTick();
      
      await delay(rollingIntervals[step]);
    }

    // Finalize actual winner for this round
    const finalPool = activePool.filter(num => !selectedWinners.includes(num));
    const roundWinner = finalPool[Math.floor(Math.random() * finalPool.length)];
    selectedWinners.push(roundWinner);

    // Clean up rolling highlight
    if (temporaryHighlightCell) {
      temporaryHighlightCell.classList.remove('active-rolling');
    }

    // Lock in the winner visually in the grid
    const winnerCell = document.getElementById(`cell-${roundWinner}`);
    if (winnerCell) {
      winnerCell.classList.add('winner-selected');
      winnerCell.setAttribute('title', '당첨자');
    }

    // Lock in slot display
    rollingNumber.textContent = roundWinner;
    rollingNumber.classList.add('lock-in');

    // Create and append Winner Badge Card
    createWinnerBadge(roundWinner, currentRound + 1);
    
    // Play fanfare
    synth.playWinFanfare();

    // 1.5s delay to admire the win before initiating next round
    await delay(1300);
    rollingNumber.classList.remove('lock-in');
  }

  // Drawing Completed successfully
  isDrawing = false;
  wheelOuter.classList.remove('spinning');
  drawStatus.classList.remove('drawing');
  drawStatus.textContent = '🎉 당번 선정 완료!';
  btnDraw.querySelector('.btn-text').textContent = '🚀 다시 추첨하기';
  
  toggleInputs(false);

  // Add selection to history list
  saveSelectionToHistory();
}

// Add a winner display card dynamically with cascade reveal styling
function createWinnerBadge(number, rank) {
  const badge = document.createElement('div');
  badge.className = 'winner-badge';
  badge.innerHTML = `
    <span class="winner-badge-rank">${rank}순위 당번</span>
    <span class="winner-badge-num">${number}번</span>
  `;
  
  // Dynamic scale transition
  winnersContainer.appendChild(badge);
}

// Reset UI state to original layout
function resetDrawState() {
  selectedWinners = [];
  isDrawing = false;
  
  // Re-enable inputs
  toggleInputs(false);
  
  // Reset texts
  drawStatus.textContent = '대기 중...';
  drawStatus.classList.remove('drawing');
  rollingNumber.textContent = '?';
  rollingNumber.className = 'current-draw-number';
  wheelOuter.classList.remove('spinning');
  
  btnDraw.querySelector('.btn-text').textContent = '🚀 당번 추첨 시작!';
  
  // Clear display badges
  winnersContainer.innerHTML = '';
  emptyWinnersMsg.style.display = 'block';
  
  // Redraw complete grid (this maintains skipped settings but removes selection states)
  renderGrid();
}

// Lock inputs during dynamic lottery sessions to maintain data purity
function toggleInputs(disabled) {
  totalInput.disabled = disabled;
  winnerInput.disabled = disabled;
  btnReset.disabled = disabled;
  
  if (disabled) {
    btnDraw.disabled = true;
    btnDraw.classList.add('disabled');
  } else {
    btnDraw.disabled = false;
    btnDraw.classList.remove('disabled');
  }
}

// 6. History Module Manager
function saveSelectionToHistory() {
  const timestamp = getFormattedTimestamp();
  
  // Add item to beginning of history array (newest first)
  drawHistory.unshift({
    id: Date.now(),
    timestamp: timestamp,
    winners: [...selectedWinners].sort((a, b) => a - b), // Sort numbers for clean historical layout
    total: totalCandidates
  });

  // Keep history capped at 10 items for visual brevity
  if (drawHistory.length > 10) {
    drawHistory.pop();
  }

  localStorage.setItem('cleaning_duty_history', JSON.stringify(drawHistory));
  renderHistory();
}

// Generate human-readable date format (YYYY.MM.DD HH:MM:SS)
function getFormattedTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}.${month}.${date} ${hours}:${minutes}:${seconds}`;
}

// Render history item structures
function renderHistory() {
  historyList.innerHTML = '';
  
  if (drawHistory.length === 0) {
    emptyHistoryMsg.style.display = 'block';
    historyList.appendChild(emptyHistoryMsg);
    return;
  }
  
  emptyHistoryMsg.style.display = 'none';
  
  drawHistory.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    
    // Header for history element
    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-timestamp';
    timeSpan.textContent = item.timestamp;
    li.appendChild(timeSpan);
    
    // Small row containing circles for winning numbers
    const winnersRow = document.createElement('div');
    winnersRow.className = 'history-winners-row';
    
    item.winners.forEach(num => {
      const badge = document.createElement('span');
      badge.className = 'history-mini-badge';
      badge.textContent = num;
      winnersRow.appendChild(badge);
    });
    
    li.appendChild(winnersRow);
    historyList.appendChild(li);
  });
}
