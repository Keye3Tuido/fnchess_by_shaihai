/**
 * P2PMode — P2P 联机对战模式
 * 回调链：每步操作先 NetworkModule.sendGameAction 等 ack，再继续 LocalMode 的链
 */
class P2PMode extends ModeBase {
    constructor() { super('p2p'); }

    setup(config) {
        this._gc = config.gameController;
        this._ui = config.uiController;
    }

    /** 模式启动入口（由 handleStart 调用） */
    start() {
        this._ui?.showP2PRoomDialog();
    }

    teardown() {
        this._gc = null;
        this._ui = null;
    }

    /** P2P 模式：确认目标前先同步给对方 */
    onTargetConfirmed(roundState) {
        const nm = window.networkModule;
        if (nm?.isConnected && !nm.isMyTurn(this._gc?.currentPlayer)) return;
        if (nm?.isConnected) {
            nm.sendGameAction('confirm_target', {}, null);
        }
        this._gc?.confirmTargetSelection();
    }

    onForbiddenConfirmed(roundState) {
        const nm = window.networkModule;
        if (nm?.isConnected) {
            nm.sendGameAction('confirm_forbidden', {}, null);
        }
        this._gc?.confirmForbiddenSelection();
    }

    onLocksConfirmed(roundState) {
        const nm = window.networkModule;
        if (nm?.isConnected) {
            nm.sendGameAction('confirm_locks', {}, null);
        }
        this._gc?.confirmLockSelection();
    }

    /**
     * 函数提交回调链：
     * Host 驱动渲染+碰撞+计分；Guest 接收 state_sync 校正
     */
    async onFunctionSubmitted(expression) {
        if (!this._ui) return;
        const nm = window.networkModule;
        if (nm?.isConnected && nm.isHost) {
            // Host：执行后广播 state_sync
            await this._ui.renderAndEvaluate(expression);
            nm.sendStateSync(this._gc?.getGameState());
        } else {
            // Guest：执行本地渲染（state_sync 会校正分数）
            await this._ui.renderAndEvaluate(expression);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PMode;
}
