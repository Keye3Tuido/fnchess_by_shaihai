/**
 * TestMode — 测试模式
 * 跳过目标/禁区/锁定阶段，函数提交后只渲染不计分
 */
class TestMode extends ModeBase {
    constructor() { super('test'); }

    setup(config) {
        this._gc = config.gameController;
        this._ui = config.uiController;
    }

    /** 模式启动入口 */
    start(rounds, difficulty) {
        if (!this._gc || !this._ui) return;
        this._ui._markGameActive();
        this._gc.initGame(rounds, 'test', 'local');
        this._ui.initTestModeUI?.();
    }

    teardown() {
        this._gc = null;
        this._ui = null;
    }

    // 测试模式无目标/禁区/锁定阶段
    onTargetConfirmed()  {}
    onForbiddenConfirmed() {}
    onLocksConfirmed()   {}

    /** 只渲染，不触发碰撞/计分 */
    async onFunctionSubmitted(expression) {
        if (!this._ui) return;
        // 测试模式直接绘制，不走 evaluateResult
        await this._ui.renderer.drawFunction(expression, true, this._ui.getTestModeColor());
        this._gc?.addTestModeFunction(expression);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestMode;
}
