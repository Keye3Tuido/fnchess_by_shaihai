/**
 * GameTimer — 游戏计时器服务
 * 层级：Game Logic（由 GameController 内部持有）
 * 职责：计时器启动/停止/超时处理；P2P 计时同步
 */
class GameTimer {
    /**
     * @param {{ emit: Function, phases: Object }} gameController - 事件总线引用
     */
    constructor(gameController) {
        this._gc              = gameController;
        this._interval        = null;
        this._timeoutHandled  = false;
        this.p2pTimerSync     = false;
        this.remainingTime    = 40;
        this.timeLimit        = 40;
    }

    // ─── 公开接口 ──────────────────────────────────────────────────────────────

    updateTimeLimit(round) {
        const group = Math.floor((round - 1) / 4);
        if      (group === 0) this.timeLimit = 40;
        else if (group === 1) this.timeLimit = 50;
        else                  this.timeLimit = Math.min(50 + (group - 1) * 10, 90);
        this.remainingTime = this.timeLimit;
    }

    start(gameMode, campaignActive) {
        if (campaignActive || gameMode === 'test') return;
        this._timeoutHandled = false;
        if (this._gc.p2pTimerSync) return;

        this.stop();
        this.remainingTime = this.timeLimit;
        this._gc.emit('timerUpdate', { remainingTime: this.remainingTime });

        // 委托 RoundModule（已有）
        if (window.roundModule) {
            window.roundModule.startTimerFor(this.timeLimit, gameMode, this._gc.p2pTimerSync);
            return;
        }

        this._interval = setInterval(() => {
            this.remainingTime--;
            this._gc.emit('timerUpdate', { remainingTime: this.remainingTime });
            if (this.remainingTime <= 0) this.handleTimeout();
        }, 1000);
    }

    stop() {
        if (window.roundModule) window.roundModule.stopTimer();
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
    }

    handleTimeout() {
        if (this._timeoutHandled) return;
        this._timeoutHandled = true;
        this.stop();
        const gc = this._gc;
        if (gc.currentPhase === gc.phases.INPUT_FUNCTION) {
            gc.roundState.score = -1;
            gc.players[gc.currentPlayer].score -= 1;
            gc.emit('timeout', { player: gc.currentPlayer });
            gc.setPhase(gc.phases.SWITCH_PLAYER);
        } else {
            gc.nextPhase();
        }
    }

    /** P2P Guest：接收 Host 的计时同步 */
    syncRemote(remainingTime) {
        if (!this._gc.p2pTimerSync) return;
        this.remainingTime = remainingTime;
        this._gc.emit('timerUpdate', { remainingTime });
        if (remainingTime <= 0) this._applyRemoteTimeout();
    }

    _applyRemoteTimeout() {
        if (this._timeoutHandled) return;
        this._timeoutHandled = true;
        this.stop();
        const gc = this._gc;
        if (gc.currentPhase === gc.phases.INPUT_FUNCTION) {
            gc.roundState.score = -1;
            gc.players[gc.currentPlayer].score -= 1;
            gc.emit('timeout', { player: gc.currentPlayer });
            gc.setPhase(gc.phases.SWITCH_PLAYER);
        } else {
            gc.nextPhase();
        }
    }

    reset() {
        this.stop();
        this._timeoutHandled = false;
        this.p2pTimerSync    = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameTimer;
}
