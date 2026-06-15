/**
 * AIMode — 人机对战模式
 * LocalMode 基础上，非玩家回合委托 AIModule.playTurn()
 */
class AIMode extends ModeBase {
    constructor() { super('ai'); }

    setup(config) {
        this._gc = config.gameController;
        this._ui = config.uiController;
    }

    teardown() {
        this._gc = null;
        this._ui = null;
    }

    /** 模式启动入口：先 prepareGame，再初始化游戏 */
    async start(rounds, difficulty) {
        if (!this._gc || !this._ui) return;
        const showHint = (t) => { if (this._ui.aiModeHint) this._ui.aiModeHint.textContent = t; };
        const canStart = await this.prepareGame(
            difficulty,
            (cfg) => this._ui.showGameDialog(cfg),
            showHint
        );
        if (!canStart) {
            this._ui.showModal(this._ui.startModal);
            return;
        }
        this._ui.hideModal(this._ui.startModal);
        this._ui._markGameActive();
        this._gc.initGame(rounds, difficulty, 'ai');
    }

    onTargetConfirmed(roundState) {
        this._gc?.confirmTargetSelection();
    }

    onForbiddenConfirmed(roundState) {
        this._gc?.confirmForbiddenSelection();
    }

    onLocksConfirmed(roundState) {
        this._gc?.confirmLockSelection();
    }

    /**
     * 函数提交回调链（与 LocalMode 相同；AI 的表达式由 AIModule 构建后也走此链）
     */
    async onFunctionSubmitted(expression) {
        if (!this._ui) return;
        await this._ui.renderAndEvaluate(expression);
    }

    /** AI 回合驱动入口（由 UIController 在阶段切换时调用） */
    async playAITurn(phase) {
        return window.aiModule?.playTurn(phase);
    }

    /**
     * AI 模式游戏准备：检查/执行训练，返回 true 表示可以开始游戏
     * @param {string} difficulty
     * @param {Function} showDialog - UIController.showGameDialog 的引用
     * @param {Function} showHint  - 设置 aiModeHint 文字的回调
     */
    async prepareGame(difficulty, showDialog, showHint) {
        const trainer = window.summaTrainer;
        if (!trainer) return true;

        showHint('正在检查 AI 训练状态...');
        let shouldTrain = false;
        let trainAmount = 50000;

        if (trainer.isModelTrained(difficulty)) {
            const choice = await showDialog({
                title: '检测到已有模型',
                message: `检测到 [${difficulty}] 难度的神经网络模型。<br><br>若想继续升维训练，请选择训练规模：`,
                options: [
                    { label: '1,000,000', value: 1000000, desc: '快速训练' },
                    { label: '5,000,000', value: 5000000, desc: '标准训练' },
                    { label: '20,000,000', value: 20000000, desc: '深度训练' },
                    { label: '100,000,000', value: 100000000, desc: '极限训练' }
                ],
                showSkip: true,
                skipText: '跳过，使用现有模型直接开始'
            });
            if (choice && choice > 0) { trainAmount = choice; shouldTrain = true; }
        } else {
            const wantTrain = await showDialog({
                title: '唤醒 Summa',
                message: `AI 尚未针对「${difficulty}」难度进行训练。<br><br>首次必须推演地图拓扑算力，请选择训练规模：`,
                options: [
                    { label: '1,000,000', value: 1000000, desc: '快速入门' },
                    { label: '5,000,000', value: 5000000, desc: '标准训练' },
                    { label: '20,000,000', value: 20000000, desc: '深度学习' },
                    { label: '100,000,000', value: 100000000, desc: '极限挑战' }
                ],
                showSkip: true,
                skipText: '暂不训练，取消开始'
            });
            if (wantTrain && wantTrain > 0) { trainAmount = wantTrain; shouldTrain = true; }
            else if (!trainer.isModelTrained(difficulty)) return false; // 取消且未训练
        }

        if (shouldTrain) {
            showHint('正在训练 AI，请稍候...');
            localStorage.removeItem(`summa_model_v2_${difficulty}`);
            await trainer.startTraining(difficulty, trainAmount);
        }
        showHint('AI 模式已启动，Summa 正在对战');
        return true;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIMode;
}
