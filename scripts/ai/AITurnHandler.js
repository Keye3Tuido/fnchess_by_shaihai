class AITurnHandler {
    constructor(ui) { this.ui = ui; }

    async triggerAITurn(phase) {
        if (this.ui.gameController.isTestMode()) return;

        if (!this.ui._gameActive) return;

        const aiActionablePhases = ['select_target', 'set_forbidden', 'set_locks', 'input_function'];
        if (!aiActionablePhases.includes(phase)) {
            console.log(`[UI] 阶段 ${phase} 无需AI操作，跳过`);
            return;
        }

        const state = this.ui.gameController.getGameState();
        if (state.currentPlayer !== 'B') {
            console.log('[UI] 当前不是AI的回合，跳过');
            return;
        }

        if (!this.ui._gameActive) return;

        this.ui.aiTriggerQueue.push(phase);
        console.log(`[UI] AI触发请求入队: ${phase}, 队列长度: ${this.ui.aiTriggerQueue.length}`);
        
        if (this.ui.isProcessingAITrigger) {
            console.log('[UI] 正在处理AI触发，等待');
            return;
        }
        
        await this.ui.processAITriggerQueue();
    }

    async processAITriggerQueue() {
        if (this.ui.aiTriggerQueue.length === 0 || this.ui.isProcessingAITrigger) {
            return;
        }

        this.ui.isProcessingAITrigger = true;

        while (this.ui.aiTriggerQueue.length > 0) {
            if (!this.ui._gameActive) {
                this.ui.aiTriggerQueue = [];
                break;
            }

            const phase = this.ui.aiTriggerQueue.shift();

            if (this.ui.aiController.isThinking) {
                console.log('[UI] AI正在思考，等待完成');
                this.ui.aiTriggerQueue.unshift(phase); // 放回队首，不丢弃
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
            
            console.log(`[UI] 处理AI触发，阶段: ${phase}`);
            this.ui.showMessage(`Summa 正在思考...`, 'info');
            
            try {
                await this.ui.aiController.playTurn(phase);
                console.log('[UI] AI阶段完成');
            } catch (error) {
                console.error('[UI] AI阶段出错:', error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.ui.isProcessingAITrigger = false;
        console.log('[UI] AI触发队列处理完毕');
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=AITurnHandler;