/**
 * RenderModule — 渲染模块
 * 层级：Domain Layer
 * 职责：Canvas 的唯一写入者；曲线采样/绘制/动画；棋盘格子绘制；碰撞检测；历史函数淡化
 * Delegate（注入）：FunctionRenderer（采样+绘制），CollisionDetector（碰撞）
 */
class RenderModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    /**
     * @param {GridSystem} gridSystem
     * @param {FunctionRenderer} renderer
     * @param {CollisionDetector} detector
     */
    init(gridSystem, renderer, detector) {
        this._grid     = gridSystem;
        this._renderer = renderer;
        this._detector = detector;
        this._functionHistory = []; // [{expression, round, points, color}]
    }

    destroy() {
        this._renderer?.cancelDrawing();
        this._functionHistory = [];
    }

    // ─── BusinessService ──────────────────────────────────────────────────────

    /** 添加历史函数（供回合结束时记录） */
    addToHistory(entry) {
        // entry: { expression, round, points, color }
        this._functionHistory.push(entry);
    }

    clearHistory() { this._functionHistory = []; }

    getHistory() { return [...this._functionHistory]; }

    // ─── Controller（对外接口） ───────────────────────────────────────────────

    /**
     * 重绘整个棋盘（格子 + 坐标网格 + 历史函数淡化）
     * @param {Object} boardSnapshot - 来自 BoardModule.getBoardSnapshot()
     */
    redraw(boardSnapshot) {
        const snap = boardSnapshot || {
            targetCells: [], forbiddenCells: [], usedCells: [],
            functionHistory: this._functionHistory,
            currentRound: 1
        };
        // 合并 RenderModule 持有的 functionHistory
        snap.functionHistory = this._functionHistory;
        this._grid.draw(snap);
    }

    /**
     * 绘制函数曲线（含动画）并返回采样点
     * @param {string} expression
     * @param {boolean} animate
     * @param {string|null} color
     * @returns {Promise<Array>} 采样点数组
     */
    async draw(expression, animate = true, color = null) {
        return this._renderer.drawFunction(expression, animate, color);
    }

    /** 实时预览（无动画） */
    preview(expression) {
        this._renderer.previewFunction(expression);
    }

    /** 取消正在进行的动画 */
    cancelDrawing() { this._renderer.cancelDrawing(); }

    /**
     * 碰撞检测：检查折线是否命中所有目标格
     * @param {Array} polyline
     * @param {Array} targetCells
     * @returns {Array} 命中的目标格列表
     */
    checkHitTargets(polyline, targetCells) {
        return targetCells.filter(cell =>
            this._detector.checkHitTarget(polyline, cell, this._grid)
        );
    }

    /**
     * 碰撞检测：检查折线是否进入任意禁止格
     * @param {Array} polyline
     * @param {Array} forbiddenCells
     * @returns {boolean}
     */
    checkHitForbidden(polyline, forbiddenCells) {
        return this._detector.checkHitForbidden(polyline, forbiddenCells, this._grid);
    }

    /** 将采样点转换为折线格式（供碰撞检测使用） */
    toPolyline(points) { return this._renderer.convertToPolyline(points); }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RenderModule;
}
