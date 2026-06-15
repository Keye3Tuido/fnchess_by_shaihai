/**
 * GridRenderer — 棋盘 Canvas 绘制层
 * 层级：Tool Layer
 * 职责：负责所有棋盘绘制（网格线/坐标轴/刻度/格子/历史函数淡化）
 * 依赖：GridSystem（坐标转换 + 颜色配置）
 */
class GridRenderer {
    /** @param {GridSystem} gridSystem */
    constructor(gridSystem) {
        this._gs = gridSystem;
    }

    get ctx()    { return this._gs.ctx; }
    get colors() { return this._gs.colors; }

    /**
     * 主绘制入口
     * @param {Object} snapshot - { targetCells, forbiddenCells, usedCells, functionHistory, currentRound }
     */
    draw(snapshot) {
        const gs = this._gs;
        const ctx = this.ctx;
        const size = gs.canvas.width;
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, size, size);
        this.drawUsedCells(snapshot.usedCells || []);
        this.drawForbiddenCells(snapshot.forbiddenCells || []);
        this.drawTargetCell(snapshot.targetCells || []);
        this.drawGridLines();
        this.drawAxes();
        this.drawHistoryFunctions(snapshot.functionHistory || [], snapshot.currentRound || 1);
    }

    drawGridLines() {
        const gs = this._gs;
        const ctx = this.ctx;
        const size = gs.canvas.width;
        ctx.strokeStyle = this.colors.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= gs.gridSize; i++) {
            const x = (i / gs.gridSize) * size;
            ctx.moveTo(x, 0); ctx.lineTo(x, size);
        }
        for (let i = 0; i <= gs.gridSize; i++) {
            const y = (i / gs.gridSize) * size;
            ctx.moveTo(0, y); ctx.lineTo(size, y);
        }
        ctx.stroke();
    }

    drawAxes() {
        const gs = this._gs;
        const ctx = this.ctx;
        const size = gs.canvas.width;
        const center = gs.mathToCanvas(0, 0);
        ctx.strokeStyle = this.colors.axis;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, center.y); ctx.lineTo(size, center.y);
        ctx.moveTo(center.x, 0); ctx.lineTo(center.x, size);
        ctx.stroke();
        this.drawTicks();
    }

    drawTicks() {
        const gs = this._gs;
        const ctx = this.ctx;
        const center = gs.mathToCanvas(0, 0);
        const step = gs.getTickStep();
        ctx.fillStyle = this.colors.axis;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.beginPath();
        for (let i = -gs.range; i <= gs.range; i++) {
            if (i === 0) continue;
            const p = gs.mathToCanvas(i, 0);
            ctx.moveTo(p.x, center.y - 3); ctx.lineTo(p.x, center.y + 3);
        }
        for (let i = -gs.range; i <= gs.range; i++) {
            if (i === 0) continue;
            const p = gs.mathToCanvas(0, i);
            ctx.moveTo(center.x - 3, p.y); ctx.lineTo(center.x + 3, p.y);
        }
        ctx.stroke();
        for (let i = -gs.range; i <= gs.range; i++) {
            if (i === 0 || i % step !== 0) continue;
            ctx.fillText(i.toString(), gs.mathToCanvas(i, 0).x, center.y + 15);
        }
        ctx.textAlign = 'right';
        for (let i = -gs.range; i <= gs.range; i++) {
            if (i === 0 || i % step !== 0) continue;
            ctx.fillText(i.toString(), center.x - 8, gs.mathToCanvas(0, i).y);
        }
        ctx.fillText('0', center.x - 8, center.y + 15);
    }

    drawTargetCell(targetCells) {
        const ctx = this.ctx;
        for (const cell of targetCells) {
            const tl = this._gs.mathToCanvas(cell.x, cell.y + 1);
            const br = this._gs.mathToCanvas(cell.x + 1, cell.y);
            const w = br.x - tl.x, h = br.y - tl.y;
            ctx.fillStyle = this.colors.target;
            ctx.fillRect(tl.x, tl.y, w, h);
            ctx.strokeStyle = this.colors.targetBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(tl.x, tl.y, w, h);
        }
    }

    drawForbiddenCells(forbiddenCells) {
        const ctx = this.ctx;
        for (const cell of forbiddenCells) {
            const tl = this._gs.mathToCanvas(cell.x, cell.y + 1);
            const br = this._gs.mathToCanvas(cell.x + 1, cell.y);
            const w = br.x - tl.x, h = br.y - tl.y;
            ctx.fillStyle = this.colors.forbidden;
            ctx.fillRect(tl.x, tl.y, w, h);
            ctx.strokeStyle = this.colors.forbiddenBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(tl.x, tl.y, w, h);
        }
    }

    drawUsedCells(usedCells) {
        const ctx = this.ctx;
        for (const cell of usedCells) {
            const tl = this._gs.mathToCanvas(cell.x, cell.y + 1);
            const br = this._gs.mathToCanvas(cell.x + 1, cell.y);
            const w = br.x - tl.x, h = br.y - tl.y;
            ctx.fillStyle = 'rgba(100, 100, 100, 0.25)';
            ctx.fillRect(tl.x, tl.y, w, h);
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tl.x, tl.y, w, h);
        }
    }

    drawHistoryFunctions(functionHistory, currentRound) {
        if (this._gs.isCampaignFixedRange) return;
        const ctx = this.ctx;
        for (const func of functionHistory) {
            const diff = currentRound - func.round;
            if (diff < 1 || diff > 2) continue;
            const opacity = diff === 2 ? 0.1 : 0.3;
            const points = func.points;
            if (!points || points.length < 2) continue;
            ctx.strokeStyle = this._alphaColor('#ffffff', opacity);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            let seg = -1;
            for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                if (pt.y === null || pt.isBreak) {
                    if (seg !== -1 && i - seg >= 2) this._drawSeg(ctx, points, seg, i);
                    seg = -1;
                } else {
                    if (seg === -1) seg = i;
                }
            }
            if (seg !== -1 && points.length - seg >= 2) this._drawSeg(ctx, points, seg, points.length);
        }
    }

    _drawSeg(ctx, points, from, to) {
        ctx.beginPath();
        const p0 = this._gs.mathToCanvas(points[from].x, points[from].y);
        ctx.moveTo(p0.x, p0.y);
        for (let j = from + 1; j < to; j++) {
            const p = this._gs.mathToCanvas(points[j].x, points[j].y);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

    _alphaColor(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridRenderer;
}
