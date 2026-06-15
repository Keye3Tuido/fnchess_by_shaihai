/**
 * RoundModule — 回合流程模块
 * 层级：Domain Layer
 * 职责：阶段状态机、计时器、玩家切换、回合历史
 * 不依赖 DOM，通过 EventEmitter 发出事件
 */
class RoundModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    init() {
        this._listeners = {};
        this._timerInterval = null;
        this._timeoutHandled = false;
        this.p2pTimerSync = false;
        this._reset();
    }

    destroy() {
        this._stopTimer();
        this._listeners = {};
    }

    // ─── BusinessService ──────────────────────────────────────────────────────

    /**
     * 开始新一局
     * @param {{ totalRounds, timeLimit, firstPlayer, gameMode }} config
     */
    startGame(config) {
        this._stopTimer();
        this._timeoutHandled = false;
        this.totalRounds   = config.totalRounds  ?? 8;
        this.currentRound  = 1;
        this.currentPlayer = config.firstPlayer  ?? 'B';
        this.gameMode      = config.gameMode     ?? 'local';
        this.timeLimit     = config.timeLimit    ?? 40;
        this.remainingTime = this.timeLimit;
        this._history      = [];
        this.setPhase('select_target');
    }

    /** 回合结束后推进到下一回合 */
    advanceRound() {
        this.currentRound++;
        if (this.currentRound > this.totalRounds) {
            this.setPhase('end');
            return;
        }
        // 奇数回合 B 选，偶数回合 A 选（前4回合同规则）
        this.currentPlayer = (this.currentRound % 2 === 1) ? 'B' : 'A';
        this._emit('roundComplete', {
            currentRound: this.currentRound,
            totalRounds:  this.totalRounds
        });
        this.setPhase('select_target');
    }

    /** 设置阶段，触发计时器逻辑 */
    setPhase(phase) {
        this.currentPhase = phase;
        this._emit('phaseChange', {
            phase,
            currentPlayer: this.currentPlayer,
            currentRound:  this.currentRound
        });
        if (phase === 'input_function') {
            this._startTimer();
        } else if (phase === 'evaluate' || phase === 'end') {
            this._stopTimer();
        } else if (phase === 'select_target') {
            this._stopTimer();
            this.remainingTime = this.timeLimit;
            this._emit('timerUpdate', { remainingTime: this.remainingTime });
        }
    }

    /** 记录回合历史 */
    recordRound(data) {
        this._history.push({ ...data });
    }

    getHistory() { return [...this._history]; }

    /** P2P Guest：接收 Host 的计时同步 */
    syncRemoteTimer(remainingTime) {
        if (!this.p2pTimerSync) return;
        this.remainingTime = remainingTime;
        this._emit('timerUpdate', { remainingTime });
        if (remainingTime <= 0) this._handleTimeout();
    }

    // ─── Controller（EventEmitter） ───────────────────────────────────────────

    on(event, fn)   { this._listeners[event] = fn; }
    off(event)      { delete this._listeners[event]; }

    /** 外部驱动计时开始（供 GameController 过渡期调用） */
    startTimerFor(timeLimit, gameMode, p2pTimerSync) {
        this.timeLimit     = timeLimit;
        this.gameMode      = gameMode      ?? this.gameMode;
        this.p2pTimerSync  = p2pTimerSync  ?? this.p2pTimerSync;
        this._startTimer();
    }

    /** 外部驱动计时停止 */
    stopTimer() { this._stopTimer(); }

    /** 外部同步剩余时间（P2P用） */
    syncTimer(remainingTime) { this.syncRemoteTimer(remainingTime); }

    // ─── 私有 ─────────────────────────────────────────────────────────────────

    _emit(event, data) {
        if (this._listeners[event]) this._listeners[event](data);
    }

    _startTimer() {
        if (this.gameMode === 'campaign' || this.gameMode === 'test') return;
        if (this.p2pTimerSync) return;
        this._stopTimer();
        this._timeoutHandled = false;
        this.remainingTime = this.timeLimit;
        this._emit('timerUpdate', { remainingTime: this.remainingTime });
        this._timerInterval = setInterval(() => {
            this.remainingTime--;
            this._emit('timerUpdate', { remainingTime: this.remainingTime });
            if (this.remainingTime <= 0) this._handleTimeout();
        }, 1000);
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    _handleTimeout() {
        if (this._timeoutHandled) return;
        this._timeoutHandled = true;
        this._stopTimer();
        this._emit('timeout', { player: this.currentPlayer });
    }

    _reset() {
        this.currentPhase  = 'init';
        this.currentRound  = 1;
        this.totalRounds   = 8;
        this.currentPlayer = 'B';
        this.timeLimit     = 40;
        this.remainingTime = 40;
        this.gameMode      = 'local';
        this._history      = [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoundModule;
}
