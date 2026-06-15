/**
 * AIModule — AI 对手模块
 * 层级：Domain Layer
 * 职责：封装 Summa AI 策略、学习数据持久化；内含 DevService（SummaTrainer）
 * Delegate（注入）：AIController（AI 决策实现）、SummaTrainer（训练框架）
 */
class AIModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    /**
     * @param {AIController} aiController
     * @param {SummaTrainer} [summaTrainer]
     */
    init(aiController, summaTrainer) {
        this._ai      = aiController;
        this._trainer = summaTrainer || null;
        // 学习数据由 AIController 内部在构造时已加载
    }

    destroy() {
        // AIController 内部会在需要时保存，此处无需额外操作
        this._ai = null;
        this._trainer = null;
    }

    // ─── Controller（对外接口） ───────────────────────────────────────────────

    /**
     * 执行 AI 回合（单个阶段）
     * @param {string} phase - 当前阶段
     * @returns {Promise<void>}
     */
    async playTurn(phase) {
        return this._ai?.playTurn(phase);
    }

    /** 设置 UIController 引用（AI 提交表达式时需要） */
    setUIController(uiController) {
        if (this._ai) this._ai.uiController = uiController;
    }

    // ─── DevService（训练框架） ───────────────────────────────────────────────

    /** 开始训练 */
    startTraining(config) {
        return this._trainer?.startTraining(config);
    }

    /** 停止训练 */
    stopTraining() {
        return this._trainer?.stopTraining();
    }

    /** 查看训练统计 */
    getTrainingStats() {
        return this._trainer?.getTrainingStats();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIModule;
}
