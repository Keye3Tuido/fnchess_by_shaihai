/**
 * CampaignMode — 闯关模式
 * 预置目标/禁区，单人，无计时，函数提交后判定通关
 */
class CampaignMode extends ModeBase {
    constructor() { super('campaign'); }

    setup(config) {
        this._gc = config.gameController;
        this._ui = config.uiController;
    }

    /** 模式启动入口 */
    start() {
        this._ui?.openCampaignUI();
    }

    teardown() {
        this._gc = null;
        this._ui = null;
    }

    // 闯关模式目标和禁区由关卡数据预置，无需玩家操作
    onTargetConfirmed()    {}
    onForbiddenConfirmed() {}
    onLocksConfirmed()     {}

    /**
     * 函数提交回调链（无动画延迟可选）：
     * RenderModule.draw → 碰撞 → 通关判定 → emit campaignResult
     */
    async onFunctionSubmitted(expression) {
        if (!this._ui) return;
        // 过渡期委托 UIController.renderAndEvaluate（GameController 内部处理闯关逻辑）
        await this._ui.renderAndEvaluate(expression);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CampaignMode;
}
