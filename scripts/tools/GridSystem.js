/**
 * GridSystem — 坐标系工具层
 * 层级：Tool Layer
 * 职责：Canvas 初始化、坐标转换、zoom/range 管理
 * 绘制职责已提取到 GridRenderer
 */
class GridSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.gridSize = 10;
        this.range    = 5;
        this.cellSize = 0;

        this.colors = {
            gridLine:       'rgba(255, 255, 255, 0.2)',
            axis:           'rgba(255, 255, 255, 0.6)',
            target:         'rgba(34, 197, 94, 0.5)',
            targetBorder:   '#22c55e',
            forbidden:      'rgba(239, 68, 68, 0.3)',
            forbiddenBorder:'#ef4444',
            background:     '#0a0a1a'
        };

        // @deprecated — 过渡期保留，新代码通过 draw(snapshot) 传入
        this.targetCell  = null;
        this.targetCells = [];
        this.forbiddenCells = [];
        this.usedCells = [];
        this.functionHistory = [];

        this.minRange = 5;
        this.maxRange = 50;
        this.rangeStep = 5;
        this.fixedCampaignRange = 10;
        this.isCampaignFixedRange = false;

        this._renderer = null; // 延迟绑定，GridRenderer 在 GridSystem 之后加载
        this.resizeTimeout = null;

        window.addEventListener('resize', () => this.debounceResize());
        this.resize();
    }

    // ─── 绘制入口（委托 GridRenderer） ────────────────────────────────────────

    draw(snapshot = null) {
        if (!this._renderer) {
            this._renderer = typeof GridRenderer !== 'undefined' ? new GridRenderer(this) : null;
        }
        const gc = window.gameController;
        const bm = window.boardModule;
        const rm = window.renderModule;
        const s = snapshot || {
            targetCells:    gc?.roundState?.targetCells    ?? this.targetCells,
            forbiddenCells: gc?.roundState?.forbiddenCells ?? this.forbiddenCells,
            usedCells:      bm ? bm.getUsedCells()         : this.usedCells,
            functionHistory:rm ? rm.getHistory()           : this.functionHistory,
            currentRound:   gc?.currentRound               ?? this.currentRound
        };
        if (this._renderer) {
            this._renderer.draw(s);
        }
    }

    // ─── 尺寸与缩放 ────────────────────────────────────────────────────────────

    debounceResize() {
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.resize(), 100);
    }

    resize() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvas.width  = size;
        this.canvas.height = size;
        this.cellSize = size / this.gridSize;
        this.draw();
    }

    zoomOut() {
        if (this.range < this.maxRange) {
            this.range += this.rangeStep;
            this.gridSize = this.range * 2;
            requestAnimationFrame(() => this.resize());
        }
        return this.range;
    }

    zoomIn() {
        if (this.range > this.minRange) {
            this.range -= this.rangeStep;
            this.gridSize = this.range * 2;
            requestAnimationFrame(() => this.resize());
        }
        return this.range;
    }

    setRange(newRange) {
        if (newRange >= this.minRange && newRange <= this.maxRange) {
            this.range = newRange;
            this.gridSize = newRange * 2;
            this.resize();
        }
    }

    setCampaignFixedRange(enabled) {
        this.isCampaignFixedRange = !!enabled;
        if (this.isCampaignFixedRange) {
            this.range    = this.fixedCampaignRange;
            this.gridSize = this.range * 2;
        } else {
            this.range    = 5;
            this.gridSize = 10;
        }
        this.resize();
    }

    updateRange(round) {
        if (this.isCampaignFixedRange) {
            this.range    = this.fixedCampaignRange;
            this.gridSize = this.range * 2;
            this.resize();
            return false;
        }
        const oldRange = this.range;
        const table = [[4,5,10],[8,6,12],[12,7,14],[16,8,16],[20,9,18]];
        let r = 10, g = 20;
        for (const [maxRound, range, gridSize] of table) {
            if (round <= maxRound) { r = range; g = gridSize; break; }
        }
        this.range    = r;
        this.gridSize = g;
        this.resize();
        return this.range !== oldRange;
    }

    // ─── 坐标转换（纯工具，无副作用） ─────────────────────────────────────────

    mathToCanvas(x, y) {
        const size = this.canvas.width;
        return {
            x: (x + this.range) / (this.range * 2) * size,
            y: size - (y + this.range) / (this.range * 2) * size
        };
    }

    canvasToMath(canvasX, canvasY) {
        const size = this.canvas.width;
        return {
            x: (canvasX / size) * (this.range * 2) - this.range,
            y: ((size - canvasY) / size) * (this.range * 2) - this.range
        };
    }

    getCellFromCanvas(canvasX, canvasY) {
        const size = this.canvas.width;
        const cellPixelSize = size / this.gridSize;
        const ix = Math.max(0, Math.min(this.gridSize - 1, Math.floor(canvasX / cellPixelSize)));
        const iy = Math.max(0, Math.min(this.gridSize - 1, Math.floor(canvasY / cellPixelSize)));
        const cx = ix - this.range;
        const cy = this.range - 1 - iy;
        if (cx >= -this.range && cx < this.range && cy >= -this.range && cy < this.range) {
            return { x: cx, y: cy };
        }
        return null;
    }

    getRange() {
        if (this.isCampaignFixedRange) return { min: -this.fixedCampaignRange, max: this.fixedCampaignRange };
        return { min: -this.range, max: this.range };
    }

    getCellRect(cell) {
        return { x1: cell.x, y1: cell.y, x2: cell.x + 1, y2: cell.y + 1 };
    }

    getTickStep() {
        if (this.range <= 10) return 1;
        if (this.range <= 20) return 2;
        if (this.range <= 40) return 5;
        return 10;
    }

    // ─── @deprecated 棋盘状态方法（过渡期兼容，不含绘制逻辑） ─────────────────

    setTargetCell(cell) {
        this.targetCell  = cell;
        this.targetCells = cell ? [cell] : [];
        this.draw();
    }
    setTargetCells(cells) {
        this.targetCells = cells || [];
        this.targetCell  = this.targetCells[0] || null;
        this.draw();
    }
    addTargetCell(cell) {
        if (!this.targetCells.some(c => c.x === cell.x && c.y === cell.y)) {
            this.targetCells.push(cell);
            this.targetCell = this.targetCells[0];
            this.draw();
            return true;
        }
        return false;
    }
    removeTargetCell(cell) {
        const i = this.targetCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (i !== -1) { this.targetCells.splice(i, 1); this.targetCell = this.targetCells[0] || null; this.draw(); return true; }
        return false;
    }
    addForbiddenCell(cell) {
        if (!this.forbiddenCells.some(c => c.x === cell.x && c.y === cell.y)) {
            this.forbiddenCells.push(cell);
            this.draw();
            return true;
        }
        return false;
    }
    removeForbiddenCell(cell) {
        const i = this.forbiddenCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (i !== -1) { this.forbiddenCells.splice(i, 1); this.draw(); return true; }
        return false;
    }
    clearTargetCell()     { this.targetCell = null; this.targetCells = []; this.draw(); }
    clearForbiddenCells() { this.forbiddenCells = []; this.draw(); }
    clearAll()            { this.targetCell = null; this.targetCells = []; this.forbiddenCells = []; this.draw(); }
    getTargetCell()       { return this.targetCell; }
    getTargetCells()      { return [...this.targetCells]; }
    getForbiddenCells()   { return [...this.forbiddenCells]; }

    // @deprecated clearFunctionCache 存根
    clearFunctionCache() {}
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridSystem;
}
