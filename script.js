const GRID_SIZE = 8;
let gridState = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
let score = 0;
let highScore = localStorage.getItem('block_blast_hd_highscore') || 0;
let comboCount = 0;
let currentOptions = [];

// Audio Context Engine (Sintesis Suara Tanpa File MP3)
let audioCtx = null;
let bgmNode = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    playBGM();
}

// 1. SOUND EFFECT: Suara Musik Latar (BGM) - Nada Looping Otomatis
function playBGM() {
    const duration = 2.0; 
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    // Membuat chord synth santai sederhana
    for (let i = 0; i < buffer.length; i++) {
        let t = i / audioCtx.sampleRate;
        data[i] = (Math.sin(2 * Math.PI * 130.81 * t) + Math.sin(2 * Math.PI * 164.81 * t)) * 0.03; 
    }
    bgmNode = audioCtx.createBufferSource();
    bgmNode.buffer = buffer;
    bgmNode.loop = true;
    bgmNode.connect(audioCtx.destination);
    bgmNode.start();
}

// 2. SOUND EFFECT: Suara Pasang Balok (Pop Ringan)
function playPlaceSound() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// 3. SOUND EFFECT: Suara Ledakan Blast (Bass Drop)
function playBlastSound() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

// Setup Balok & Pembobotan (Anti Stuck)
const BLOCK_SHAPES = [
    { name: '1x1', shape: [[1]], color: '#ff5722', weight: 35 }, 
    { name: '1x2-H', shape: [[1, 1]], color: '#2196f3', weight: 25 }, 
    { name: '2x1-V', shape: [[1], [1]], color: '#2196f3', weight: 25 },
    { name: '1x3-H', shape: [[1, 1, 1]], color: '#4caf50', weight: 20 },
    { name: '3x1-V', shape: [[1], [1], [1]], color: '#4caf50', weight: 20 },
    { name: 'Kotak-2x2', shape: [[1, 1], [1, 1]], color: '#9c27b0', weight: 12 }, 
    { name: 'T-Shape', shape: [[1, 1, 1], [0, 1, 0]], color: '#00bcd4', weight: 10 } 
];

const gridElement = document.getElementById('grid');
const optionsContainer = document.getElementById('block-options');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const restartBtn = document.getElementById('restart-btn');
const dragOverlay = document.getElementById('drag-overlay');

highScoreElement.innerText = highScore;

// Hubungkan tombol start audio awal
document.getElementById('start-audio-btn').addEventListener('click', () => {
    initAudio();
    document.getElementById('audio-prompt').classList.add('hidden');
});

function createGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            gridElement.appendChild(cell);
        }
    }
}

function updateGridDOM() {
    const cells = gridElement.children;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const index = r * GRID_SIZE + c;
            if (gridState[r][c] !== 0) {
                cells[index].classList.add('filled');
                cells[index].style.backgroundColor = gridState[r][c];
            } else {
                cells[index].classList.remove('filled');
                cells[index].style.backgroundColor = '';
            }
        }
    }
}

function getRandomBlockByWeight() {
    const totalWeight = BLOCK_SHAPES.reduce((sum, block) => sum + block.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (let i = 0; i < BLOCK_SHAPES.length; i++) {
        if (randomNum < BLOCK_SHAPES[i].weight) return BLOCK_SHAPES[i];
        randomNum -= BLOCK_SHAPES[i].weight;
    }
    return BLOCK_SHAPES[0];
}

function generateOptions() {
    optionsContainer.innerHTML = '';
    currentOptions = [];

    for (let i = 0; i < 2; i++) currentOptions.push(getRandomBlockByWeight());

    let validThirdBlock = null;
    let attempts = 0;
    while (!validThirdBlock && attempts < 100) {
        let testBlock = getRandomBlockByWeight();
        if (hasAnyValidMove(testBlock.shape)) validThirdBlock = testBlock;
        attempts++;
    }
    if (!validThirdBlock) validThirdBlock = BLOCK_SHAPES[0]; 
    currentOptions.push(validThirdBlock);

    currentOptions.forEach((block, i) => {
        const blockOpt = document.createElement('div');
        blockOpt.classList.add('block-option');
        blockOpt.dataset.index = i;
        blockOpt.style.gridTemplateRows = `repeat(${block.shape.length}, 1fr)`;
        blockOpt.style.gridTemplateColumns = `repeat(${block.shape[0].length}, 1fr)`;

        block.shape.forEach(row => {
            row.forEach(cellValue => {
                const blockCell = document.createElement('div');
                blockCell.classList.add('block-cell');
                if (cellValue === 1) {
                    blockCell.classList.add('filled');
                    blockCell.style.backgroundColor = block.color;
                }
                blockOpt.appendChild(blockCell);
            });
        });

        // Event listener Jari/Kursor untuk DRAG & DROP
        blockOpt.addEventListener('mousedown', (e) => startDrag(e, i));
        blockOpt.addEventListener('touchstart', (e) => startDrag(e, i), {passive: false});

        optionsContainer.appendChild(blockOpt);
    });
}

// LOGIKA DRAG & DROP MENGIKUTI JARI (60 FPS ENGINE)
let isDragging = false;
let dragBlockIdx = null;
let touchOffsetX = 0;
let touchOffsetY = 0;

function startDrag(e, index) {
    if (!currentOptions[index]) return;
    e.preventDefault();
    initAudio(); // Pengaman Audio agar aktif
    
    isDragging = true;
    dragBlockIdx = index;
    const block = currentOptions[index];

    // Buat tampilan bayangan balok melayang
    dragOverlay.innerHTML = '';
    dragOverlay.style.display = 'grid';
    dragOverlay.style.gridTemplateRows = `repeat(${block.shape.length}, 1fr)`;
    dragOverlay.style.gridTemplateColumns = `repeat(${block.shape[0].length}, 1fr)`;

    block.shape.forEach(row => {
        row.forEach(val => {
            const c = document.createElement('div');
            c.classList.add('drag-cell');
            if (val === 1) c.style.backgroundColor = block.color;
            else c.style.opacity = '0';
            dragOverlay.appendChild(c);
        });
    });

    moveDragOverlay(e);
}

function moveDragOverlay(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Sinkronisasi posisi 60 FPS menggunakan requestAnimationFrame otomatis oleh browser
    dragOverlay.style.left = `${clientX}px`;
    dragOverlay.style.top = `${clientY}px`;
}

// Dengarkan pergerakan jari di layar global
window.addEventListener('mousemove', moveDragOverlay);
window.addEventListener('touchmove', moveDragOverlay, {passive: false});

window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    dragOverlay.style.display = 'none';

    // Cari tahu posisi jari terakhir dilepas di atas grid mana
    const change = e.changedTouches ? e.changedTouches[0] : e;
    const targetEl = document.elementFromPoint(change.clientX, change.clientY);
    
    if (targetEl && targetEl.classList.contains('cell')) {
        // Ambil baris & kolom grid tempat dilepas
        const cellsArray = Array.from(gridElement.children);
        const cellIdx = cellsArray.indexOf(targetEl);
        const row = Math.floor(cellIdx / GRID_SIZE);
        const col = cellIdx % GRID_SIZE;

        const block = currentOptions[dragBlockIdx];

        if (canPlaceBlock(row, col, block.shape)) {
            placeBlock(row, col, block);
            playPlaceSound(); // Bunyi Tarok Balok!

            optionsContainer.children[dragBlockIdx].innerHTML = '';
            currentOptions[dragBlockIdx] = null;

            checkLineBlasts();

            if (currentOptions.every(opt => opt === null)) generateOptions();

            if (isGameOver()) {
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('block_blast_hd_highscore', highScore);
                    highScoreElement.innerText = highScore;
                }
                alert(`Game Over! Skor Akhir: ${score}`);
                restartBtn.classList.remove('hidden');
            }
        }
    }
    dragBlockIdx = null;
}

function canPlaceBlock(startRow, startCol, shape) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                if (targetRow >= GRID_SIZE || targetCol >= GRID_SIZE) return false;
                if (gridState[targetRow][targetCol] !== 0) return false;
            }
        }
    }
    return true;
}

function hasAnyValidMove(shape) {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlaceBlock(r, c, shape)) return true;
        }
    }
    return false;
}

function placeBlock(startRow, startCol, block) {
    for (let r = 0; r < block.shape.length; r++) {
        for (let c = 0; c < block.shape[r].length; c++) {
            if (block.shape[r][c] === 1) {
                gridState[startRow + r][startCol + c] = block.color;
                score += 10;
            }
        }
    }
    scoreElement.innerText = score;
    updateGridDOM();
}

function checkLineBlasts() {
    let rowsToBlast = [];
    let colsToBlast = [];
    const cells = gridElement.children;

    for (let r = 0; r < GRID_SIZE; r++) {
        if (gridState[r].every(cell => cell !== 0)) rowsToBlast.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
        let colFilled = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            if (gridState[r][c] === 0) { colFilled = false; break; }
        }
        if (colFilled) colsToBlast.push(c);
    }

    const totalLines = rowsToBlast.length + colsToBlast.length;

    if (totalLines > 0) {
        comboCount += 1;
        let bonusScore = (totalLines * 100) * comboCount;
        score += bonusScore;

        playBlastSound(); // Bunyi Meledak!
        createPointsPop(`+${bonusScore}`);

        rowsToBlast.forEach(r => {
            for (let c = 0; c < GRID_SIZE; c++) cells[r * GRID_SIZE + c].classList.add('blasting');
        });
        colsToBlast.forEach(c => {
            for (let r = 0; r < GRID_SIZE; r++) cells[r * GRID_SIZE + c].classList.add('blasting');
        });

        setTimeout(() => {
            rowsToBlast.forEach(r => gridState[r] = Array(GRID_SIZE).fill(0));
            colsToBlast.forEach(c => {
                for (let r = 0; r < GRID_SIZE; r++) gridState[r][c] = 0;
            });
            scoreElement.innerText = score;
            updateGridDOM();
            document.querySelectorAll('.cell.blasting').forEach(cell => cell.classList.remove('blasting'));
        }, 300);
    } else {
        comboCount = 0;
    }
}

function createPointsPop(text) {
    const pop = document.createElement('div');
    pop.className = 'points-pop';
    pop.innerText = text;
    pop.style.left = '50%';
    pop.style.top = '40%';
    gridElement.appendChild(pop);
    setTimeout(() => pop.remove(), 500);
}

function isGameOver() {
    for (let i = 0; i < currentOptions.length; i++) {
        const block = currentOptions[i];
        if (!block) continue;
        if (hasAnyValidMove(block.shape)) return false;
    }
    return true;
}

restartBtn.addEventListener('click', () => {
    gridState = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    score = 0; comboCount = 0;
    scoreElement.innerText = score;
    restartBtn.classList.add('hidden');
    createGrid();
    generateOptions();
});

createGrid();
generateOptions();
