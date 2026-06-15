/**
 * GameHistoryService — 游戏历史与测试数据服务
 * 层级：Game Logic（由 GameController 内部持有）
 * 职责：回合历史记录、测试模式函数、闯关进度持久化
 */
class GameHistoryService {
    constructor() {
        this.gameHistory     = [];
        this.testModeFunctions = [];
        this.functionHistory   = []; // 历史函数淡化显示
    }

    // ─── 回合历史 ──────────────────────────────────────────────────────────────

    recordRound(roundData) {
        this.gameHistory.push({
            round:        roundData.round,
            selector:     roundData.selector,
            constructor:  roundData.constructor,
            targetCells:  [...roundData.targetCells],
            forbiddenCells:[...roundData.forbiddenCells],
            lockedElements:[...roundData.lockedElements],
            expression:   roundData.expression,
            functionType: roundData.functionType,
            hitTarget:    roundData.hitTarget,
            hitForbidden: roundData.hitForbidden,
            score:        roundData.score,
            totalScoreA:  roundData.totalScoreA,
            totalScoreB:  roundData.totalScoreB
        });
    }

    getReport(difficulty, totalRounds, scores) {
        const A = scores.A, B = scores.B;
        return {
            difficulty,
            totalRounds,
            winner: A > B ? 'A' : B > A ? 'B' : 'draw',
            finalScores: { A, B },
            history: this.gameHistory
        };
    }

    clearHistory() { this.gameHistory = []; }

    // ─── 测试模式函数 ──────────────────────────────────────────────────────────

    addTestFunction(expression, color) {
        const colors = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7','#dfe6e9','#fd79a8','#a29bfe'];
        const c = color || colors[this.testModeFunctions.length % colors.length];
        this.testModeFunctions.push({ expression, color: c, timestamp: Date.now() });
        return c;
    }

    clearTestFunctions()   { this.testModeFunctions = []; }
    getTestFunctions()     { return this.testModeFunctions; }

    // ─── 历史函数（淡化显示） ──────────────────────────────────────────────────

    clearFunctionHistory() { this.functionHistory = []; }

    // ─── 闯关进度（LocalStorage） ────────────────────────────────────────────────

    getCampaignProgress() {
        try {
            const v = Number(localStorage.getItem('function_chess_campaign_cleared'));
            return Number.isFinite(v) ? v : 0;
        } catch { return 0; }
    }

    setCampaignProgress(clearedMax) {
        try { localStorage.setItem('function_chess_campaign_cleared', String(clearedMax)); } catch {}
    }

    // ─── 全局重置 ──────────────────────────────────────────────────────────────

    reset() {
        this.clearHistory();
        this.clearTestFunctions();
        this.clearFunctionHistory();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameHistoryService;
}
