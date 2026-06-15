/**
 * RoundStateMachine — 回合阶段状态机
 * 层级：Game Logic（由 GameController 内部持有）
 * 职责：阶段流转 + 回合操作（select/confirm 系列）
 */
class RoundStateMachine {
    /**
     * @param {GameController} gc - 宿主 GameController，提供 emit/roundState/players 等
     */
    constructor(gc) {
        this._gc = gc;
    }

    // ─── 阶段流转 ──────────────────────────────────────────────────────────────

    nextPhase() {
        const gc = this._gc;
        const order = [
            gc.phases.SELECT_TARGET, gc.phases.SET_FORBIDDEN,
            gc.phases.SET_LOCKS,     gc.phases.INPUT_FUNCTION,
            gc.phases.EVALUATE,      gc.phases.SWITCH_PLAYER
        ];
        const idx = order.indexOf(gc.currentPhase);
        if (idx < 0 || idx >= order.length - 1) return;

        let next = order[idx + 1];

        if (gc.currentPhase === gc.phases.SET_LOCKS && next === gc.phases.INPUT_FUNCTION) {
            gc.switchToInputPhase(); return;
        }
        if (next === gc.phases.SET_FORBIDDEN && gc.getMaxForbiddenCount() === 0) {
            next = gc.phases.SET_LOCKS;
        }
        if (next === gc.phases.SET_LOCKS && gc.getMaxLockCount() === 0) {
            gc.switchToInputPhase(); return;
        }
        gc.setPhase(next);
    }

    switchPlayer() {
        const gc = this._gc;
        if (window.boardModule) {
            window.boardModule.commitRoundToHistory(gc.currentRound, gc.roundState.targetCells, gc.roundState.forbiddenCells);
        } else {
            for (const cell of gc.roundState.targetCells) {
                if (!gc.usedCells.some(c => c.x === cell.x && c.y === cell.y))
                    gc.usedCells.push({ x: cell.x, y: cell.y, type: 'target', round: gc.currentRound });
            }
            for (const cell of gc.roundState.forbiddenCells) {
                if (!gc.usedCells.some(c => c.x === cell.x && c.y === cell.y))
                    gc.usedCells.push({ x: cell.x, y: cell.y, type: 'forbidden', round: gc.currentRound });
            }
        }
        gc.currentRound++;
        if (gc.currentRound > gc.totalRounds) { gc.setPhase(gc.phases.END); return; }
        gc.currentPlayer = (gc.currentRound % 2 === 1) ? 'B' : 'A';
        gc.updateTimeLimit();
        gc.resetRoundState();
        gc.emit('roundComplete', { currentRound: gc.currentRound, totalRounds: gc.totalRounds, scores: { A: gc.players.A.score, B: gc.players.B.score } });
        gc.setPhase(gc.phases.SELECT_TARGET);
    }

    // ─── 回合操作 ──────────────────────────────────────────────────────────────

    selectTargetCell(cell) {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SELECT_TARGET) return false;
        const idx = gc.roundState.targetCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx !== -1) {
            gc.roundState.targetCells.splice(idx, 1);
            gc.roundState.targetCell = gc.roundState.targetCells[0] || null;
            gc.emit('targetRemoved', { cell, count: gc.roundState.targetCells.length });
            return true;
        }
        if (gc.roundState.targetCells.length >= gc.targetCount) {
            const removed = gc.roundState.targetCells.pop();
            gc.emit('targetRemoved', { cell: removed, count: gc.roundState.targetCells.length });
        }
        gc.roundState.targetCells.push(cell);
        gc.roundState.targetCell = gc.roundState.targetCells[0];
        gc.emit('targetSelected', { cell, count: gc.roundState.targetCells.length, total: gc.targetCount });
        return true;
    }

    confirmTargetSelection() {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SELECT_TARGET) return false;
        if (gc.roundState.targetCells.length < gc.targetCount) return false;
        this.nextPhase();
        return true;
    }

    addForbiddenCell(cell) {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SET_FORBIDDEN) return false;
        if (gc.roundState.targetCells.some(c => c.x === cell.x && c.y === cell.y)) return false;
        const idx = gc.roundState.forbiddenCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx !== -1) {
            const removed = gc.roundState.forbiddenCells.splice(idx, 1)[0];
            gc.emit('forbiddenRemoved', { cell: removed, count: gc.roundState.forbiddenCells.length });
            return true;
        }
        if (gc.roundState.forbiddenCells.length >= gc.getMaxForbiddenCount()) {
            const removed = gc.roundState.forbiddenCells.pop();
            gc.emit('forbiddenRemoved', { cell: removed, count: gc.roundState.forbiddenCells.length });
        }
        gc.roundState.forbiddenCells.push(cell);
        gc.emit('forbiddenAdded', { cell, count: gc.roundState.forbiddenCells.length });
        return true;
    }

    confirmForbiddenSelection() {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SET_FORBIDDEN) return false;
        this.nextPhase();
        return true;
    }

    addLockedElement(element) {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SET_LOCKS) return false;
        if (gc.roundState.lockedElements.length >= gc.getMaxLockCount()) return false;
        if (['x', '(', ')'].includes(element)) return false;
        if (!gc.canLockElement(element)) return false;
        if (gc.roundState.lockedElements.includes(element)) return false;
        gc.roundState.lockedElements.push(element);
        gc.emit('elementLocked', { element, count: gc.roundState.lockedElements.length });
        return true;
    }

    removeLockedElement(element) {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SET_LOCKS) return false;
        const idx = gc.roundState.lockedElements.indexOf(element);
        if (idx === -1) return false;
        gc.roundState.lockedElements.splice(idx, 1);
        gc.emit('elementUnlocked', { element, count: gc.roundState.lockedElements.length });
        return true;
    }

    confirmLockSelection() {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.SET_LOCKS) return false;
        for (const el of gc.roundState.lockedElements) gc.incrementElementLockCount(el);
        this.nextPhase();
        return true;
    }

    submitFunction(expression) {
        const gc = this._gc;
        if (gc.currentPhase !== gc.phases.INPUT_FUNCTION) return false;
        gc.roundState.functionExpression = expression;
        if (gc.isTestMode()) return true;
        gc.setPhase(gc.phases.EVALUATE);
        return true;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoundStateMachine;
}
