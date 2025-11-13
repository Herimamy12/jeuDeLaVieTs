"use strict";
// src/main.ts
// Simple Conway's Game of Life — TypeScript single-file implementation
class Life {
    constructor(width, height, wrap = true) {
        this.width = width;
        this.height = height;
        this.wrap = wrap;
        this.cells = this.createEmpty();
    }
    createEmpty() {
        const g = [];
        for (let y = 0; y < this.height; y++) {
            g[y] = new Array(this.width).fill(0);
        }
        return g;
    }
    randomize(prob = 0.3) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.cells[y][x] = Math.random() < prob ? 1 : 0;
            }
        }
    }
    clear() {
        this.cells = this.createEmpty();
    }
    cloneCells() {
        return this.cells.map(row => row.slice());
    }
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    getWrapped(x, y) {
        const wx = (x + this.width) % this.width;
        const wy = (y + this.height) % this.height;
        return this.cells[wy][wx];
    }
    countNeighbors(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0)
                    continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.wrap) {
                    count += this.getWrapped(nx, ny);
                }
                else {
                    if (this.inBounds(nx, ny))
                        count += this.cells[ny][nx];
                }
            }
        }
        return count;
    }
    nextGeneration() {
        const newCells = this.createEmpty();
        let population = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const n = this.countNeighbors(x, y);
                const alive = this.cells[y][x] === 1;
                let next = 0;
                if (alive) {
                    // Survive on 2 or 3 neighbors
                    next = (n === 2 || n === 3) ? 1 : 0;
                }
                else {
                    // Birth on exactly 3
                    next = (n === 3) ? 1 : 0;
                }
                newCells[y][x] = next;
                population += next;
            }
        }
        this.cells = newCells;
        return { newCells, population };
    }
}
class Renderer {
    constructor(canvas, life, cellSize = 10) {
        this.aliveColor = "#222";
        this.deadColor = "#ffffff";
        this.gridColor = "#b7b7b7ff";
        this.canvas = canvas;
        const c = canvas.getContext("2d");
        if (!c)
            throw new Error("2D context not available");
        this.ctx = c;
        this.life = life;
        this.cellSize = cellSize;
        this.resizeCanvas();
    }
    resizeCanvas() {
        // Set canvas size in pixels according to life grid and cellSize
        this.canvas.width = this.life.width * this.cellSize;
        this.canvas.height = this.life.height * this.cellSize;
        // Keep CSS size as-is (index.html sets width/height initially) — it will scale accordingly
    }
    setCellSize(s) {
        this.cellSize = s;
        this.resizeCanvas();
    }
    draw() {
        const ctx = this.ctx;
        const w = this.life.width;
        const h = this.life.height;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Background
        ctx.fillStyle = this.deadColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Cells
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.life.cells[y][x] === 1) {
                    ctx.fillStyle = this.aliveColor;
                    ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }
        // optional grid lines
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= w; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize + 0.5, 0);
            ctx.lineTo(x * this.cellSize + 0.5, h * this.cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize + 0.5);
            ctx.lineTo(w * this.cellSize, y * this.cellSize + 0.5);
            ctx.stroke();
        }
    }
    // Convert mouse event to cell coordinates
    xyFromEvent(ev) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const x = Math.floor((cx / rect.width) * this.canvas.width / this.cellSize);
        const y = Math.floor((cy / rect.height) * this.canvas.height / this.cellSize);
        if (x < 0 || x >= this.life.width || y < 0 || y >= this.life.height)
            return null;
        return { x, y };
    }
}
// Main app control
class App {
    constructor(canvas) {
        this.animationId = null;
        this.running = false;
        this.speedMs = 200;
        this.generation = 0;
        this.population = 0;
        this.loopStep = () => {
            const res = this.life.nextGeneration();
            this.population = res.population;
            this.generation++;
            this.renderer.draw();
            this.updateUI();
        };
        // derive grid size from canvas initial pixel size and default cell size
        const initialCellSize = 8;
        const cols = Math.floor(canvas.width / initialCellSize);
        const rows = Math.floor(canvas.height / initialCellSize);
        this.life = new Life(cols, rows, true);
        this.renderer = new Renderer(canvas, this.life, initialCellSize);
        // UI
        this.startBtn = document.getElementById("startBtn");
        this.stopBtn = document.getElementById("stopBtn");
        this.stepBtn = document.getElementById("stepBtn");
        this.clearBtn = document.getElementById("clearBtn");
        this.randomBtn = document.getElementById("randomBtn");
        this.speedRange = document.getElementById("speedRange");
        this.speedVal = document.getElementById("speedVal");
        this.cellRange = document.getElementById("cellRange");
        // this.cellVal = document.getElementById("cellVal");
        this.genEl = document.getElementById("gen");
        this.popEl = document.getElementById("pop");
        this.wrapSelect = document.getElementById("wrapSelect");
        this.addEventListeners();
        this.renderer.draw();
        this.updateUI();
    }
    addEventListeners() {
        this.startBtn.addEventListener("click", () => this.start());
        this.stopBtn.addEventListener("click", () => this.stop());
        this.stepBtn.addEventListener("click", () => this.step());
        this.clearBtn.addEventListener("click", () => {
            this.life.clear();
            this.generation = 0;
            this.population = 0;
            this.renderer.draw();
            this.updateUI();
        });
        this.randomBtn.addEventListener("click", () => {
            this.life.randomize(0.25);
            this.generation = 0;
            this.renderer.draw();
            this.updateUI();
        });
        this.speedRange.addEventListener("input", () => {
            this.speedMs = Number(this.speedRange.value);
            this.speedVal.textContent = String(this.speedMs);
        });
        // this.cellRange.addEventListener("input", () => {
        //     const s = Number(this.cellRange.value);
        //     this.cellVal.textContent = String(s);
        //     this.renderer.setCellSize(s);
        //     this.renderer.draw();
        // });
        this.wrapSelect.addEventListener("change", () => {
            this.life.wrap = this.wrapSelect.value === "wrap";
        });
        // Click on canvas to toggle cell
        this.renderer.canvas.addEventListener("click", (ev) => {
            const pos = this.renderer.xyFromEvent(ev);
            if (!pos)
                return;
            const { x, y } = pos;
            this.life.cells[y][x] = this.life.cells[y][x] === 1 ? 0 : 1;
            this.renderer.draw();
            this.updateUI();
        });
    }
    updateUI() {
        this.genEl.textContent = String(this.generation);
        this.popEl.textContent = String(this.population);
        this.speedVal.textContent = String(this.speedMs);
        // this.cellVal.textContent = String(this.renderer.cellSize);
        this.startBtn.disabled = this.running;
        this.stopBtn.disabled = !this.running;
    }
    // Start using setInterval (kept simple)
    start() {
        if (this.running)
            return;
        this.running = true;
        this.updateUI();
        // use setInterval for predictable ms control
        const tick = () => {
            this.loopStep();
            if (!this.running)
                return;
            this.animationId = window.setTimeout(tick, this.speedMs);
        };
        tick();
    }
    stop() {
        this.running = false;
        if (this.animationId !== null) {
            clearTimeout(this.animationId);
            this.animationId = null;
        }
        this.updateUI();
    }
    step() {
        if (this.running)
            return;
        this.loopStep();
    }
}
// Wait for DOM loaded
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
        console.error("Canvas not found");
        return;
    }
    // Ensure crisp pixel rendering on high-DPI screens
    const DPR = window.devicePixelRatio || 1;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";
    canvas.width = Math.floor(canvas.width * DPR);
    canvas.height = Math.floor(canvas.height * DPR);
    const app = new App(canvas);
    // Optional: initial random
    app.life.randomize(0.15);
    app.renderer.draw();
    app.updateUI();
});
