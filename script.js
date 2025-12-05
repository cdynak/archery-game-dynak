const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreElement = document.getElementById('score');
const arrowsElement = document.getElementById('arrow-count');
const finalScoreElement = document.getElementById('final-score');
const gameStartOverlay = document.getElementById('game-start');
const gameOverOverlay = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let currentState = 'START'; // 'START', 'PLAYING', 'GAMEOVER'
let score = 0;
let arrowsLeft = 10;
let animationId;

// Physics Constants
const GRAVITY = 0.5;
const AIR_RESISTANCE = 0.99;

// Classes
class Arrow {
    constructor(x, y, angle, power) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * power;
        this.vy = Math.sin(angle) * power;
        this.angle = angle;
        this.active = true;
        this.width = 60;
        this.tipX = 0;
        this.tipY = 0;
    }

    update() {
        if (!this.active) return;

        this.vy += GRAVITY;
        this.vx *= AIR_RESISTANCE;
        this.vy *= AIR_RESISTANCE;

        this.x += this.vx;
        this.y += this.vy;

        this.angle = Math.atan2(this.vy, this.vx);

        // Calculate tip position for collision
        this.tipX = this.x + Math.cos(this.angle) * this.width;
        this.tipY = this.y + Math.sin(this.angle) * this.width;

        // Ground collision
        if (this.y > canvas.height - 20) {
            this.active = false;
            this.y = canvas.height - 20;
            updateArrowsCount();
        }

        // Out of bounds
        if (this.x > canvas.width || this.x < 0) {
            this.active = false;
            updateArrowsCount();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Arrow Shaft
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.width, 0);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Arrow Head
        ctx.beginPath();
        ctx.moveTo(this.width, 0);
        ctx.lineTo(this.width - 10, -5);
        ctx.lineTo(this.width - 10, 5);
        ctx.closePath();
        ctx.fillStyle = '#555';
        ctx.fill();

        // Fletching
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -5);
        ctx.lineTo(0, 0);
        ctx.lineTo(-10, 5);
        ctx.strokeStyle = '#ff4757'; // Red fletching
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

class Bow {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.isDrawn = false;
        this.drawPower = 0;
    }

    update(mousePos) {
        // Look at mouse
        const dx = mousePos.x - this.x;
        const dy = mousePos.y - this.y;
        this.angle = Math.atan2(dy, dx);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Bow Body
        ctx.beginPath();
        ctx.arc(0, 0, 40, 1.5 * Math.PI, 0.5 * Math.PI); // Simple arc
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#8B4513';
        ctx.stroke();

        // Bow String
        ctx.beginPath();
        ctx.moveTo(0, -40);
        if (this.isDrawn) {
            // Visualize draw
            ctx.lineTo(-this.drawPower * 2, 0);
            ctx.lineTo(0, 40);
        } else {
            ctx.lineTo(0, 40);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#eee';
        ctx.stroke();

        ctx.restore();
    }
}

let bow;
let arrows = [];
let mousePos = { x: 0, y: 0 };
let target;

// Target Class
class Target {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.rings = [
            { r: 40, score: 10, color: 'white' },
            { r: 30, score: 30, color: 'black' },
            { r: 20, score: 50, color: 'blue' },
            { r: 10, score: 100, color: 'red' },
            { r: 5, score: 150, color: 'yellow' }
        ];
        this.speedY = 2; // Moving target
        this.direction = 1;
    }

    update() {
        this.y += this.speedY * this.direction;
        if (this.y > canvas.height - 100 || this.y < 100) {
            this.direction *= -1;
        }
    }

    draw(ctx) {
        // Stand
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, canvas.height); // Pole to ground
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#666';
        ctx.stroke();

        // Rings
        this.rings.forEach(ring => {
            ctx.beginPath();
            ctx.arc(this.x, this.y, ring.r, 0, Math.PI * 2);
            ctx.fillStyle = ring.color;
            ctx.fill();
            ctx.stroke();
        });
    }

    checkCollision(arrow) {
        if (!arrow.active) return false;

        // Simple distance check to target center for now
        const dx = arrow.tipX - this.x;
        const dy = arrow.tipY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.radius) {
            // Hit!
            let points = 0;
            for (let ring of this.rings) {
                if (dist <= ring.r) {
                    points = ring.score; // Take the highest score (smallest ring)
                }
            }
            return points;
        }
        return 0;
    }
}


// Resize handling
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!bow) bow = new Bow(100, canvas.height / 2);
    else bow.y = canvas.height / 2;

    if (!target) target = new Target(canvas.width - 150, canvas.height / 2);
    else target.x = canvas.width - 150;
}
window.addEventListener('resize', resize);
resize();

// Input handling
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

canvas.addEventListener('mousedown', (e) => {
    if (currentState !== 'PLAYING' || arrowsLeft <= 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    bow.isDrawn = true;
});

canvas.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;

    if (isDragging) {
        const dx = dragStartX - e.clientX;
        const dy = dragStartY - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        bow.drawPower = Math.min(dist / 5, 20); // Cap power

        // Aim is derived from the drag vector
        // Dragging left/down should aim up/right
        // Let's make it simpler: Aiming is purely mouse position relative to bow
        // But power is drag distance

        // Revising aim logic:
        // Aim = line from bow to mouse
        const aimDx = mousePos.x - bow.x;
        const aimDy = mousePos.y - bow.y;
        bow.angle = Math.atan2(aimDy, aimDx);

    } else {
        bow.update(mousePos);
    }
});

canvas.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    bow.isDrawn = false;

    // Shoot Logic
    if (currentState === 'PLAYING') {
        fireArrow();
    }
    bow.drawPower = 0;
});

function fireArrow() {
    if (arrowsLeft > 0) {
        const arrowPower = bow.drawPower * 1.5 + 10; // Base power + draw
        const arrow = new Arrow(bow.x, bow.y, bow.angle, arrowPower);
        arrows.push(arrow);
        arrowsLeft--;
        arrowsElement.textContent = arrowsLeft;
    }
}

function updateArrowsCount() {
    if (arrowsLeft === 0 && arrows.every(a => !a.active)) {
        setTimeout(endGame, 1000); // Delay slightly
    }
}

function endGame() {
    currentState = 'GAMEOVER';
    finalScoreElement.textContent = score;
    gameOverOverlay.classList.remove('hidden');
}

// Particle System for hits
let particles = [];
class Particle {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.life = 1.0;
        this.vy = -1;
    }
    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 30px Arial';
        ctx.fillText("+" + this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// Game Loop
function update() {
    if (currentState === 'PLAYING' || arrows.length > 0) {
        target.update();

        arrows.forEach(arrow => {
            if (arrow.active) {
                arrow.update();

                // Check collision
                const points = target.checkCollision(arrow);
                if (points > 0) {
                    arrow.active = false;
                    arrow.vx = 0;
                    arrow.vy = 0;
                    // Stick arrow to target (visual approximation by just stopping it)
                    // In a real physics engine we'd parent it, but here we just freeze it

                    score += points;
                    scoreElement.textContent = score;
                    particles.push(new Particle(arrow.tipX, arrow.tipY, points));

                    updateArrowsCount();
                }
            }
        });

        particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) particles.splice(index, 1);
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.8, '#E0F7FA');
    gradient.addColorStop(0.8, '#4CAF50');
    gradient.addColorStop(1, '#2E7D32');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentState === 'PLAYING' || currentState === 'GAMEOVER') {
        target.draw(ctx);
        bow.draw(ctx);
        arrows.forEach(arrow => arrow.draw(ctx));
        particles.forEach(p => p.draw(ctx));
    }
}

function loop() {
    update();
    draw();
    animationId = requestAnimationFrame(loop);
}

// Start Game
startBtn.addEventListener('click', () => {
    currentState = 'PLAYING';
    gameStartOverlay.classList.add('hidden');
    if (!animationId) loop();
});

restartBtn.addEventListener('click', () => {
    score = 0;
    arrowsLeft = 10;
    arrows = [];
    particles = [];
    scoreElement.textContent = score;
    arrowsElement.textContent = arrowsLeft;

    currentState = 'PLAYING';
    gameOverOverlay.classList.add('hidden');
});

// Initial loop
loop();
