/**
 * LocalMode — 本地对战模式
 * 回调链：目标确认 → 禁区确认 → 锁定确认 → 函数提交 → 渲染 → 碰撞 → 计分 → 推进回合
 */
class LocalMode extends ModeBase {
    constructor() {
        super('local');
        this._gc = null;  // GameController
        this._ui = null;  // UIController（过渡期引用）
    }

    // ─── LifecycleService ─────────────────────────────────────────────────────

    setup(config) {
        this._gc = config.gameController;
        this._ui = config.uiController;
    }

    /** 模式启动入口 */
    start(rounds, difficulty) {
        if (!this._gc || !this._ui) return;
        this._ui._markGameActive();
        this._gc.initGame(rounds, difficulty, 'local');
    }

    teardown() {
        this._gc = null;
        this._ui = null;
    }

    // ─── 回调链 ────────────────────────────────────────────────────────────────

    onTargetConfirmed(roundState) {
        // 本地对战：直接推进到禁区阶段（由 GameController 状态机驱动）
        this._gc?.confirmTargetSelection();
    }

    onForbiddenConfirmed(roundState) {
        this._gc?.confirmForbiddenSelection();
    }

    onLocksConfirmed(roundState) {
        this._gc?.confirmLockSelection();
    }

    /**
     * 函数提交回调链：
     * RenderModule.draw → CollisionDetector → ScoringModule.evaluate → GameController.evaluateResult
     */
    async onFunctionSubmitted(expression) {
        if (!this._ui) return;
        // 委托 UIController 的 renderAndEvaluate（过渡期保留，P8 再完全拆解）
        await this._ui.renderAndEvaluate(expression);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalMode;
}
