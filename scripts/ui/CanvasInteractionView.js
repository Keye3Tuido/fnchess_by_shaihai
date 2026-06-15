/**
 * CanvasInteractionView — 棋盘 Canvas 交互视图
 * 层级：UI View（由 UIController 持有）
 * 职责：历史函数 hover 检测、tooltip 显示/隐藏、点到线段距离计算
 */
class CanvasInteractionView {
    /** @param {UIController} ui */
    constructor(ui) { this.ui = ui; }

    checkHistoryFunctionHover(event) {
        const ui = this.ui;
        const canvas = ui.gridSystem.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = event.clientY;
        this.hideHistoryFunctionTooltip();
        const state = ui.gameController.getGameState();
        if (!state.functionHistory?.length) return;
        for (const func of state.functionHistory) {
            const diff = state.currentRound - func.round;
            if (diff < 1 || diff > 2) continue;
            if (this.isMouseNearFunction(mouseX, mouseY, func.points, 15)) {
                this.showHistoryFunctionTooltip(event, func.expression, func.round);
                return;
            }
        }
    }

    isMouseNearFunction(mouseX, mouseY, points, threshold) {
        const valid = points.filter(p => p.y !== null);
        for (let i = 0; i < valid.length - 1; i++) {
            const p1 = this.ui.gridSystem.mathToCanvas(valid[i].x, valid[i].y);
            const p2 = this.ui.gridSystem.mathToCanvas(valid[i+1].x, valid[i+1].y);
            if (this.pointToLineDistance(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y) <= threshold) return true;
        }
        return false;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A=px-x1, B=py-y1, C=x2-x1, D=y2-y1;
        const lenSq = C*C + D*D;
        if (lenSq === 0) return Math.sqrt(A*A + B*B);
        const param = Math.max(0, Math.min(1, (A*C + B*D) / lenSq));
        const dx = px - (x1 + param*C), dy = py - (y1 + param*D);
        return Math.sqrt(dx*dx + dy*dy);
    }

    showHistoryFunctionTooltip(event, expression, round) {
        this.hideHistoryFunctionTooltip();
        const t = document.createElement('div');
        t.id = 'history-function-tooltip';
        t.className = 'history-function-tooltip';
        t.innerHTML = `<div style="font-weight:bold;">第 ${round} 回合</div><div style="margin-top:4px;">${expression}</div>`;
        Object.assign(t.style, { position:'fixed', left:`${event.clientX+15}px`, top:`${event.clientY-10}px`, zIndex:'10000', background:'rgba(0,0,0,0.85)', color:'#fff', padding:'8px 12px', borderRadius:'6px', fontSize:'13px', pointerEvents:'none', maxWidth:'300px', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' });
        document.body.appendChild(t);
    }

    hideHistoryFunctionTooltip() {
        document.getElementById('history-function-tooltip')?.remove();
    }

    handleCanvasClick(e) {
        const canvas = this.ui.gridSystem.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const cell = this.ui.gridSystem.getCellFromCanvas(x, y);
        if (!cell) return;

        const phase = this.ui.gameController.currentPhase;
        const state = this.ui.gameController.getGameState();

        // 人机模式下，如果当前是AI的回合，阻止玩家操作
        if (this.ui.gameController.gameMode === 'ai' && state.currentPlayer === 'B') {
            console.log('[UI] AI回合中，阻止玩家点击');
            return;
        }

        // P2P模式：非己方回合禁止操作
        if (this.ui._isP2PBlocked()) {
            this.ui.showMessage('请等待对手操作', 'info');
            return;
        }

        // 检查是否是历史使用过的格子
        const isUsedCell = state.usedCells && state.usedCells.some(c => c.x === cell.x && c.y === cell.y);
        if (isUsedCell) {
            this.ui.showMessage('此格子已在之前的回合中使用过，无法再次选择', 'warning');
            return;
        }

        if (phase === 'select_target') {
            if (!this.ui.gameController.selectTargetCell(cell)) return;
            this.ui._forwardP2PAction('select_target', { cell: { x: cell.x, y: cell.y } },
                () => this.ui.gameController.selectTargetCell(cell));
        } else if (phase === 'set_forbidden') {
            if (!this.ui.gameController.addForbiddenCell(cell)) return;
            this.ui._forwardP2PAction('add_forbidden', { cell: { x: cell.x, y: cell.y } },
                () => this.ui.gameController.addForbiddenCell(cell));
        }
    }

    handleCanvasHover(e) {
        const canvas = this.ui.gridSystem.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // 考虑CSS缩放
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        const cell = this.ui.gridSystem.getCellFromCanvas(x, y);
        const state = this.ui.gameController.getGameState();
        
        // 人机模式下，如果当前是AI的回合，禁用悬停效果
        if (this.ui.gameController.gameMode === 'ai' && state.currentPlayer === 'B') {
            this.ui.gridSystem.canvas.style.cursor = 'not-allowed';
            this.ui.gridSystem.canvas.title = 'Summa 正在操作中...';
            return;
        }

        // P2P模式：非己方回合显示等待光标（不用 _isP2PBlocked 避免 showMessage 副作用）
        if (this.ui.gameController.isP2PMode() && this.ui.p2pController && this.ui.p2pController.isConnected &&
            !this.ui.p2pController.isMyTurn(this.ui.gameController.currentPlayer)) {
            this.ui.gridSystem.canvas.style.cursor = 'not-allowed';
            this.ui.gridSystem.canvas.title = '等待对手操作...';
            return;
        }
        
        if (cell) {
            this.ui.gridSystem.canvas.style.cursor = 'pointer';
            this.ui.gridSystem.canvas.title = `(${cell.x}, ${cell.y})`;
        } else {
            this.ui.gridSystem.canvas.style.cursor = 'default';
            this.ui.gridSystem.canvas.title = '';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasInteractionView;
}
