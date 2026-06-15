/**
 * BoardModule — 棋盘格子状态模块
 * 层级：Domain Layer
 * 职责：管理目标格、禁止格、锁定元素、历史已用格子；
 *       提供 getBoardSnapshot() 供 RenderModule 渲染
 * 不操作 Canvas，不知道 DOM 存在
 */
class BoardModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    init() {
        this._reset();
        this._usedCells = [];
    }

    destroy() {
        this._reset();
        this._usedCells = [];
    }

    // ─── BusinessService ──────────────────────────────────────────────────────

    /**
     * 回合开始时重置本回合状态（不清空 usedCells）
     */
    resetRound() { this._reset(); }

    /**
     * 游戏开始时完全重置（含历史）
     */
    resetAll() {
        this._reset();
        this._usedCells = [];
    }

    /**
     * 从关卡数据预置格子（闯关模式）
     */
    loadFromLevel(levelData) {
        this._reset();
        this._targetCells    = (levelData.targetCells    || []).map(c => ({ x: c.x, y: c.y }));
        this._forbiddenCells = (levelData.forbiddenCells || []).map(c => ({ x: c.x, y: c.y }));
        this._lockedElements = (levelData.lockedElements || []).slice();
    }

    // ── 目标格 ──

    selectTarget(cell, maxCount) {
        const idx = this._targetCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx !== -1) {
            this._targetCells.splice(idx, 1);
            return { action: 'removed', count: this._targetCells.length };
        }
        if (this._targetCells.length >= maxCount) {
            this._targetCells.pop();
        }
        this._targetCells.push(cell);
        return { action: 'added', count: this._targetCells.length };
    }

    // ── 禁止格 ──

    selectForbidden(cell, maxCount) {
        const isTarget = this._targetCells.some(c => c.x === cell.x && c.y === cell.y);
        if (isTarget) return null;

        const idx = this._forbiddenCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx !== -1) {
            this._forbiddenCells.splice(idx, 1);
            return { action: 'removed', count: this._forbiddenCells.length };
        }
        if (this._forbiddenCells.length >= maxCount) {
            this._forbiddenCells.pop();
        }
        this._forbiddenCells.push(cell);
        return { action: 'added', count: this._forbiddenCells.length };
    }

    // ── 锁定元素 ──

    addLockedElement(element, maxCount) {
        if (this._lockedElements.length >= maxCount) return false;
        if (this._lockedElements.includes(element)) return false;
        this._lockedElements.push(element);
        return true;
    }

    removeLockedElement(element) {
        const idx = this._lockedElements.indexOf(element);
        if (idx === -1) return false;
        this._lockedElements.splice(idx, 1);
        return true;
    }

    /**
     * 回合结束：将本回合目标格和禁区归入历史
     */
    commitRoundToHistory(round, targetCells, forbiddenCells) {
        const targets  = targetCells  || this._targetCells;
        const forbidden = forbiddenCells || this._forbiddenCells;
        for (const cell of targets) {
            if (!this._usedCells.some(c => c.x === cell.x && c.y === cell.y))
                this._usedCells.push({ x: cell.x, y: cell.y, type: 'target', round });
        }
        for (const cell of forbidden) {
            if (!this._usedCells.some(c => c.x === cell.x && c.y === cell.y))
                this._usedCells.push({ x: cell.x, y: cell.y, type: 'forbidden', round });
        }
    }

    // ─── Controller（对外查询接口） ────────────────────────────────────────────

    getTargetCells()    { return [...this._targetCells]; }
    getForbiddenCells() { return [...this._forbiddenCells]; }
    getLockedElements() { return [...this._lockedElements]; }
    getUsedCells()      { return [...this._usedCells]; }

    /**
     * 返回渲染所需的纯数据快照（供 GridSystem.draw(snapshot) / RenderModule 使用）
     * @param {number} currentRound - 当前回合（供历史函数淡化计算）
     * @param {Array}  functionHistory - 历史函数列表（由 RenderModule 持有）
     */
    getBoardSnapshot(currentRound = 1, functionHistory = []) {
        return {
            targetCells:     this.getTargetCells(),
            forbiddenCells:  this.getForbiddenCells(),
            usedCells:       this.getUsedCells(),
            functionHistory,
            currentRound
        };
    }

    // ─── 私有 ─────────────────────────────────────────────────────────────────

    _reset() {
        this._targetCells    = [];
        this._forbiddenCells = [];
        this._lockedElements = [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardModule;
}
