const GRID_SIZE = 8;
let gridState = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
let score = 0;
let highScore = localStorage.getItem('block_blast_perfect_highscore') || 0;
let comboCount = 0;
let selectedBlockIndex = null;
let currentOptions = [];

// Daftar Bentuk Balok Komplit dengan Sistem Pembobotan (Weight)
const BLOCK_SHAPES = [
    { name: '1x1', shape: [[1]], color: '#ff5722', weight: 35 }, 
    { name: '1x2-H', shape: [[1, 1]], color: '#2196f3', weight: 25 }, 
    { name: '2x1-V', shape: [[1], [1]], color: '#2196f3', weight: 25 },
    { name: '1x3-H', shape: [[1, 1, 1]], color: '#4caf50', weight: 20 },
    { name: '3x1-V', shape: [[1], [1], [1]], color: '#4caf50', weight: 20 },
    { name: 'L-Kecil', shape: [[1, 0], [1, 1]], color: '#e91e63', weight: 15 },
    { name: 'Kotak-2x2', shape: [[1, 1], [1, 1]], color: '#9c27b0', weight: 10 }, 
    { name: 'T-Shape', shape: [[1, 1, 1], [0, 1, 0]], color: '#00bcd4', weight: 8 } 
];

const gridElement = document.getElementById('grid');
const optionsContainer = document.getElementById('block-options');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const restartBtn = document.getElementById('restart-btn');

// Set High Score Awal di Tampilan
highScoreElement.innerText = highScore;

// 1. Pembuatan Grid Utama
function createGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleGridClick(r, c));
            gridElement.appendChild(cell);
        }
    }
}

// Render Ulang DOM Grid sesuai Array Logika
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

// Ambil balok acak berdasarkan sistem bobot peluang
function getRandomBlockByWeight() {
    const totalWeight = BLOCK_SHAPES.reduce((sum, block) => sum + block.weight, 0);
    let randomNum = Math.random() * totalWeight;
    
    for (let i = 0; i < BLOCK_SHAPES.length; i++) {
        if (randomNum < BLOCK_SHAPES[i].weight) {
            return BLOCK_SHAPES[i];
        }
        randomNum -= BLOCK_SHAPES[i].weight;
    }
    return BLOCK_SHAPES[0];
}

// 2. SISTEM CERDAS: Generate Balok yang Pasti Bisa Dimainkan (Anti-Stuck Fail Safe)
function generateOptions() {
    optionsContainer.innerHTML = '';
    currentOptions = [];

    // Tentukan dua balok pertama secara normal berdasarkan bobot peluang
    for (let i = 0; i < 2; i++) {
        currentOptions.push(getRandomBlockByWeight());
    }

    // Balok ketiga diproteksi: harus lolos validasi bisa dipasang di sisa grid kosong saat ini
    let validThirdBlock = null;
    let attempts = 0;
    
    while (!validThirdBlock && attempts < 100) {
        let testBlock = getRandomBlockByWeight();
        if (hasAnyValidMove(testBlock.shape)) {
            validThirdBlock = testBlock;
        }
        attempts++;
    }

    // Jika grid darurat super kritis dan sangat penuh, paksa lempar balok penyelamat 1x1
    if (!validThirdBlock) {
        validThirdBlock = BLOCK_SHAPES[0]; 
    }

    currentOptions.push(validThirdBlock);

    // Render Balok Pilihan ke Layar
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

        blockOpt.addEventListener('click', () => selectBlockOption(i));
        optionsContainer.appendChild(blockOpt);
    });
}

function selectBlockOption(index) {
    if (!currentOptions[index]) return;
    
    document.querySelectorAll('.block-option').forEach(el => el.style.outline = '');
    
    selectedBlockIndex = index;
    optionsContainer.children[index].style.outline = '3px solid #ffffff';
}

// 3. Logika Penempatan Balok
function handleGridClick(row, col) {
    if (selectedBlockIndex === null) return;
    
    const block = currentOptions[selectedBlockIndex];
    if (!block) return;

    if (canPlaceBlock(row, col, block.shape)) {
        placeBlock(row, col, block);
        
        optionsContainer.children[selectedBlockIndex].innerHTML = '';
        currentOptions[selectedBlockIndex] = null;
        selectedBlockIndex = null;

        // Proses eliminasi baris dan kolom
        checkLineBlasts();

        // Regenerasi jika ketiga pilihan sudah terpakai habis
        if (currentOptions.every(opt => opt === null)) {
            generateOptions();
        }

        // Deteksi Game Over final
        if (isGameOver()) {
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('block_blast_perfect_highscore', highScore);
                highScoreElement.innerText = highScore;
                alert(`🎉 REKOR BARU YANG SEMPURNA: ${score} Poin!`);
            } else {
                alert(`Game Over! Skor Akhir Kamu: ${score}`);
            }
            restartBtn.classList.remove('hidden');
        }
    }
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
            if (canPlaceBlock(r, c, shape)) {
                return true; 
            }
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

// 4. Logika Eliminasi (Blast) dengan Animasi Partikel & Sistem Combo Multiplier
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
            if (gridState[r][c] === 0) {
                colFilled = false;
                break;
            }
        }
        if (colFilled) colsToBlast.push(c);
    }

    const totalLines = rowsToBlast.length + colsToBlast.length;

    if (totalLines > 0) {
        comboCount += 1;
        // Rumus Skor Combo Sempurna: (Garis * 100) * Combo Multiplier
        let bonusScore = (totalLines * 100) * comboCount;
        score += bonusScore;

        // Munculkan teks pop-up skor melayang
        createPointsPop(`+${bonusScore} ${comboCount > 1 ? 'Combo x' + comboCount : ''}`);

        // Beri class animasi peledakan partikel ke grid target
        rowsToBlast.forEach(r => {
            for (let c = 0; c < GRID_SIZE; c++) cells[r * GRID_SIZE + c].classList.add('blasting');
        });
        colsToBlast.forEach(c => {
            for (let r = 0; r < GRID_SIZE; r++) cells[r * GRID_SIZE + c].classList.add('blasting');
        });

        // Beri jeda 350ms agar animasi ledakan selesai diputar, baru hapus balok dari memori
        setTimeout(() => {
            rowsToBlast.forEach(r => gridState[r] = Array(GRID_SIZE).fill(0));
            colsToBlast.forEach(c => {
                for (let r = 0; r < GRID_SIZE; r++) gridState[r][c] = 0;
            });

            scoreElement.innerText = score;
            updateGridDOM();

            const allCells = document.querySelectorAll('.cell.blasting');
            allCells.forEach(cell => cell.classList.remove('blasting'));
        }, 350);

    } else {
        comboCount = 0;
    }
}

function createPointsPop(text) {
    const pop = document.createElement('div');
    pop.className = 'points-pop';
    pop.innerText = text;
    const gridRect = gridElement.getBoundingClientRect();
    pop.style.left = `${gridRect.width / 4}px`;
    pop.style.top = `${gridRect.height / 3}px`;
    gridElement.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
}

function isGameOver() {
    for (let i = 0; i < currentOptions.length; i++) {
        const block = currentOptions[i];
        if (!block) continue;
        if (hasAnyValidMove(block.shape)) return false; 
    }
    return true; 
}

// Reset State Total Game
restartBtn.addEventListener('click', () => {
    gridState = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    score = 0;
    comboCount = 0;
    scoreElement.innerText = score;
    selectedBlockIndex = null;
    restartBtn.classList.add('hidden');
    createGrid();
    generateOptions();
});

// Inisialisasi Pertama
createGrid();
generateOptions();
