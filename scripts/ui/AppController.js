/**
 * AppController — 顶层唯一控制器
 * 层级：App Layer
 * 职责：持有所有 Domain 单例引用，管理当前激活模式，模式切换时调用 teardown/setup
 * 对外：window.app 唯一入口（调试用）
 */
class AppController {

    constructor() {
        // Domain 单例引用（过渡期从 window.* 获取）
        this.board      = null;
        this.round      = null;
        this.scoring    = null;
        this.render     = null;
        this.expression = null;
        this.audio      = null;
        this.character  = null;
        this.ai         = null;
        this.network    = null;

        // 模式映射
        this._modes = {};
        this._currentMode = null;
        this._currentModeName = '';
    }

    /**
     * 初始化（在所有模块实例化完成后调用）
     */
    init() {
        this.board      = window.boardModule;
        this.round      = window.roundModule;
        this.scoring    = window.scoringModule || null;
        this.render     = window.renderModule;
        this.expression = window.expressionModule;
        this.audio      = window.audioModule;
        this.character  = window.characterModule;
        this.ai         = window.aiModule;
        this.network    = window.networkModule;

        this._modes = {
            local:    window.localMode,
            test:     window.testMode,
            campaign: window.campaignMode,
            ai:       window.aiMode,
            p2p:      window.p2pMode
        };
    }

    /**
     * 切换模式
     * @param {string} modeName - 'local' | 'test' | 'campaign' | 'ai' | 'p2p'
     * @param {Object} [config] - 额外配置（透传给 mode.setup）
     */
    switchMode(modeName, config = {}) {
        if (this._currentMode) {
            this._currentMode.teardown();
        }

        const mode = this._modes[modeName];
        if (!mode) {
            console.warn('[AppController] 未知模式:', modeName);
            return;
        }

        // 重置 Domain 层状态
        this.board?.resetAll();
        this.expression?.clear();

        this._currentMode = mode;
        this._currentModeName = modeName;
        this._currentMode.setup({
            ...config,
            gameController: window.gameController,
            uiController:   window.uiController
        });
    }

    getCurrentMode()     { return this._currentMode; }
    getCurrentModeName() { return this._currentModeName; }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppController;
}
