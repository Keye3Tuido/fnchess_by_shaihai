/**
 * GameController — 游戏主控制器（过渡期胶水层）
 * 内部委托给：RoundStateMachine / GameTimer / GameHistoryService
 */
class GameController {
    constructor() {
        this.totalRounds = 8;
        this.currentRound = 1;
        this.gameMode = 'local';
        this.difficulty = 'normal';
        this.targetCount = 1;
        this.testModeFunctions = [];
        this.players = { A: { score: 0, role: 'constructor' }, B: { score: 0, role: 'selector' } };
        this.currentPlayer = 'B';
        this.phases = { INIT:'init', SELECT_TARGET:'select_target', SET_FORBIDDEN:'set_forbidden', SET_LOCKS:'set_locks', INPUT_FUNCTION:'input_function', EVALUATE:'evaluate', SETTLE:'settle', SWITCH_PLAYER:'switch_player', END:'end' };
        this.currentPhase = this.phases.INIT;
        this.timeLimit = 40;
        this.remainingTime = 40;
        this.timerInterval = null;
        this.p2pTimerSync = false;
        this._timeoutHandled = false;
        this.roundState = { targetCells:[], targetCell:null, forbiddenCells:[], lockedElements:[], functionExpression:'', hitTargets:[], hitTarget:false, hitForbidden:false, score:0 };
        this.usedCells = [];
        this.callbacks = {};
        this.gameHistory = [];
        this.functionHistory = [];
        this.campaignState = { active:false, levelPack:null, totalLevels:0, currentLevelId:1 };
        this.elementLockCounts = new Map();
        // 服务注入
        this._roundSM  = typeof RoundStateMachine  !== 'undefined' ? new RoundStateMachine(this)  : null;
        this._timer    = typeof GameTimer          !== 'undefined' ? new GameTimer(this)          : null;
        this._history  = typeof GameHistoryService !== 'undefined' ? new GameHistoryService()     : null;
    }

    // ─── EventBus ──────────────────────────────────────────────────────────────
    on(event, cb)   { this.callbacks[event] = cb; }
    emit(event, d)  { if (this.callbacks[event]) this.callbacks[event](d); }

    // ─── 游戏初始化 ────────────────────────────────────────────────────────────
    initGame(rounds=8, difficulty='normal', gameMode='local', firstPlayer='B') {
        if (gameMode !== 'p2p') this.p2pTimerSync = false;
        this._timeoutHandled = false;
        Object.assign(this.campaignState, { active:false, levelPack:null, totalLevels:0, currentLevelId:1 });
        this.totalRounds = Math.min(Math.max(rounds,4),24);
        this.difficulty = difficulty;
        this.targetCount = this.getTargetCountByDifficulty(difficulty);
        this.currentRound = 1;
        this.gameMode = gameMode;
        this.players.A.score = 0; this.players.B.score = 0;
        this.testModeFunctions = [];
        this.clearGameHistory();
        this.usedCells = [];
        if (window.boardModule) window.boardModule.resetAll();
        if (window.renderModule) window.renderModule.clearHistory();
        this.elementLockCounts = new Map();
        this.functionHistory = [];
        this.currentPlayer = firstPlayer;
        this.updateTimeLimit();
        this.resetRoundState();
        if (window.roundModule) window.roundModule.startGame({ totalRounds:this.totalRounds, timeLimit:this.timeLimit, firstPlayer:this.currentPlayer, gameMode:this.gameMode });
        this.setPhase(this.isTestMode() ? this.phases.INPUT_FUNCTION : this.phases.SELECT_TARGET);
        this.emit('gameInit', { totalRounds:this.totalRounds, currentRound:this.currentRound, timeLimit:this.timeLimit, difficulty:this.difficulty, targetCount:this.targetCount, isTestMode:this.isTestMode(), gameMode:this.gameMode });
    }

    initCampaign(levelPack, startLevelId=1) {
        if (!levelPack || !Array.isArray(levelPack.levels)) return false;
        this.clearGameHistory();
        this.usedCells = []; this.functionHistory = []; this.testModeFunctions = [];
        this.elementLockCounts = new Map();
        if (window.boardModule) window.boardModule.resetAll();
        if (window.renderModule) window.renderModule.clearHistory();
        this.gameMode = 'campaign';
        this.campaignState.active = true;
        this.campaignState.levelPack = levelPack;
        this.campaignState.totalLevels = levelPack.levels.length;
        this.players.A.score = 0; this.players.B.score = 0;
        if (!this.loadCampaignLevel(startLevelId)) return false;
        this.emit('gameInit', { totalRounds:this.totalRounds, currentRound:this.currentRound, timeLimit:this.timeLimit, difficulty:this.difficulty, targetCount:this.targetCount, isTestMode:false, gameMode:this.gameMode });
        this.emit('campaignLevelLoaded', { levelId:this.campaignState.currentLevelId, totalLevels:this.campaignState.totalLevels, difficulty:this.difficulty, targetCount:this.targetCount, roundState:{...this.roundState} });
        this.setPhase(this.phases.INPUT_FUNCTION);
        return true;
    }

    loadCampaignLevel(levelId) {
        if (!this.campaignState.active || !this.campaignState.levelPack) return false;
        const id = Number(levelId);
        const level = this.campaignState.levelPack.levels.find(l => Number(l.id) === id);
        if (!level) return false;
        this.campaignState.currentLevelId = id;
        this.currentRound = id;
        this.totalRounds = this.campaignState.totalLevels;
        if      (id<=29) this.difficulty = 'easy';
        else if (id<=53) this.difficulty = 'normal';
        else if (id<=69) this.difficulty = 'hard';
        else             this.difficulty = 'expert';
        this.targetCount = Array.isArray(level.targetCells) ? level.targetCells.length : 1;
        this.updateTimeLimit();
        this.resetRoundState();
        this.roundState.targetCells    = (level.targetCells    ||[]).map(c=>({x:c.x,y:c.y}));
        this.roundState.targetCell     = this.roundState.targetCells[0] || null;
        this.roundState.forbiddenCells = (level.forbiddenCells ||[]).map(c=>({x:c.x,y:c.y}));
        this.roundState.lockedElements = (level.lockedElements ||[]).slice();
        this.currentPlayer = 'A';
        this.emit('campaignLevelLoaded', { levelId:id, totalLevels:this.campaignState.totalLevels, difficulty:this.difficulty, targetCount:this.targetCount, roundState:{...this.roundState} });
        return true;
    }

    getCampaignProgress() { return this._history ? this._history.getCampaignProgress() : (() => { try { const v=Number(localStorage.getItem('function_chess_campaign_cleared')); return Number.isFinite(v)?v:0; } catch{return 0;} })(); }
    setCampaignProgress(v) { if (this._history) this._history.setCampaignProgress(v); else try{localStorage.setItem('function_chess_campaign_cleared',String(v));}catch{} }
    advanceCampaignLevel() { return this.campaignState.active ? this.loadCampaignLevel(this.campaignState.currentLevelId+1) : false; }

    // ─── 查询 ──────────────────────────────────────────────────────────────────
    isTestMode()  { return this.difficulty === 'test'; }
    isEasyMode()  { return this.difficulty === 'easy'; }
    isP2PMode()   { return this.gameMode   === 'p2p';  }
    getTargetCountByDifficulty(d) { return d==='test'?0:d==='normal'?2:d==='expert'?3:1; }
    getMaxForbiddenCount() { return this.currentRound<=8?1:this.currentRound<=16?2:3; }
    getMaxLockCount()      { return this.currentRound<=4?0:this.currentRound<=12?1:2; }
    canLockElement(el)     { return (this.elementLockCounts.get(el)||0)<2; }
    incrementElementLockCount(el) { this.elementLockCounts.set(el,(this.elementLockCounts.get(el)||0)+1); }
    getElementLockCount(el) { return this.elementLockCounts.get(el)||0; }

    // ─── P2P 动作代理 ─────────────────────────────────────────────────────────
    applyRemoteAction(action, payload) {
        if (!this.isP2PMode()) return false;
        const p = payload||{};
        switch(action) {
            case 'select_target':    return p.cell ? this.selectTargetCell(p.cell) : false;
            case 'confirm_target':   return this.confirmTargetSelection();
            case 'add_forbidden':    return p.cell ? this.addForbiddenCell(p.cell) : false;
            case 'confirm_forbidden':return this.confirmForbiddenSelection();
            case 'lock_element':     return p.element ? this.addLockedElement(p.element) : false;
            case 'unlock_element':   return p.element ? this.removeLockedElement(p.element) : false;
            case 'confirm_locks':    return this.confirmLockSelection();
            default: return false;
        }
    }

    // ─── 回合状态 ─────────────────────────────────────────────────────────────
    updateTimeLimit() { const g=Math.floor((this.currentRound-1)/4); this.timeLimit=g===0?40:g===1?50:Math.min(50+(g-1)*10,90); this.remainingTime=this.timeLimit; }
    resetRoundState()  { this.roundState={targetCells:[],targetCell:null,forbiddenCells:[],lockedElements:[],functionExpression:'',hitTargets:[],hitTarget:false,hitForbidden:false,score:0}; if(window.boardModule)window.boardModule.resetRound(); }

    setPhase(phase) {
        this.currentPhase = phase;
        this.emit('phaseChange', { phase, currentPlayer:this.currentPlayer, currentRound:this.currentRound });
        switch(phase) {
            case this.phases.SELECT_TARGET: this.stopTimer(); this.remainingTime=this.timeLimit; this.emit('timerUpdate',{remainingTime:this.remainingTime}); break;
            case this.phases.INPUT_FUNCTION: this.startTimer(); break;
            case this.phases.EVALUATE:       this.stopTimer(); break;
            case this.phases.SWITCH_PLAYER:  this.switchPlayer(); break;
            case this.phases.END:            this.endGame(); break;
        }
    }

    switchToInputPhase() { this.currentPlayer = this.currentPlayer==='A'?'B':'A'; this.setPhase(this.phases.INPUT_FUNCTION); }

    // ─── 计时器 ───────────────────────────────────────────────────────────────
    startTimer() {
        if (this.isTestMode()||(this.campaignState&&this.campaignState.active)) return;
        this._timeoutHandled = false;
        if (this.p2pTimerSync) return;
        this.stopTimer();
        this.remainingTime = this.timeLimit;
        this.emit('timerUpdate', {remainingTime:this.remainingTime});
        if (window.roundModule) { window.roundModule.startTimerFor(this.timeLimit,this.gameMode,this.p2pTimerSync); return; }
        this.timerInterval = setInterval(()=>{ this.remainingTime--; this.emit('timerUpdate',{remainingTime:this.remainingTime}); if(this.remainingTime<=0)this.handleTimeout(); },1000);
    }
    stopTimer() { if(window.roundModule)window.roundModule.stopTimer(); if(this.timerInterval){clearInterval(this.timerInterval);this.timerInterval=null;} }
    syncRemoteTimer(t) { if(this._timer){this._timer.syncRemote(t);return;} }
    applyRemoteTimeout() { if(this._timer){this._timer._applyRemoteTimeout();return;} }
    handleTimeout() {
        if(this._timer){this._timer.handleTimeout();return;}
        if(this._timeoutHandled)return; this._timeoutHandled=true; this.stopTimer();
        if(this.currentPhase===this.phases.INPUT_FUNCTION){this.roundState.score=-1;this.players[this.currentPlayer].score-=1;this.emit('timeout',{player:this.currentPlayer});this.setPhase(this.phases.SWITCH_PLAYER);}else{this.nextPhase();}
    }

    // ─── 回合操作（委托 RoundStateMachine） ────────────────────────────────────
    selectTargetCell(cell)      { return this._roundSM?this._roundSM.selectTargetCell(cell):false; }
    confirmTargetSelection()    { return this._roundSM?this._roundSM.confirmTargetSelection():false; }
    addForbiddenCell(cell)      { return this._roundSM?this._roundSM.addForbiddenCell(cell):false; }
    confirmForbiddenSelection() { return this._roundSM?this._roundSM.confirmForbiddenSelection():false; }
    addLockedElement(el)        { return this._roundSM?this._roundSM.addLockedElement(el):false; }
    removeLockedElement(el)     { return this._roundSM?this._roundSM.removeLockedElement(el):false; }
    confirmLockSelection()      { return this._roundSM?this._roundSM.confirmLockSelection():false; }
    submitFunction(expr)        { return this._roundSM?this._roundSM.submitFunction(expr):false; }
    nextPhase()                 { if(this._roundSM){this._roundSM.nextPhase();return;} }
    switchPlayer()              { if(this._roundSM){this._roundSM.switchPlayer();return;} }
    skipPhase()                 { this.nextPhase(); }

    // ─── 评估结果 ─────────────────────────────────────────────────────────────
    evaluateResult(hitTargets, hitForbidden, functionType) {
        if (this.currentPhase !== this.phases.EVALUATE) return;
        if (typeof hitTargets === 'boolean') {
            this.roundState.hitTarget  = hitTargets;
            this.roundState.hitTargets = hitTargets ? this.roundState.targetCells : [];
        } else {
            this.roundState.hitTargets = hitTargets || [];
            this.roundState.hitTarget  = this.roundState.hitTargets.length >= this.targetCount;
        }
        this.roundState.hitForbidden = hitForbidden;
        const scoring = typeof ScoringModule !== 'undefined' ? new ScoringModule() : null;
        const score = scoring ? scoring.evaluate(this.roundState.hitTargets, hitForbidden, functionType, this.targetCount) : (hitForbidden||!this.roundState.hitTarget ? -1 : functionType.score);
        this.roundState.score = score;
        this.players[this.currentPlayer].score += score;
        this.recordRoundHistory({ round:this.currentRound, selector:this.currentPlayer, constructor:this.currentPlayer==='A'?'B':'A', targetCells:this.roundState.targetCells, forbiddenCells:this.roundState.forbiddenCells, lockedElements:this.roundState.lockedElements, expression:this.roundState.functionExpression, functionType, hitTarget:this.roundState.hitTarget, hitForbidden, score, totalScoreA:this.players.A.score, totalScoreB:this.players.B.score });
        this.emit('evaluationComplete', { hitTarget:this.roundState.hitTarget, hitTargets:this.roundState.hitTargets, hitForbidden, functionType, score, totalScore:this.players[this.currentPlayer].score, targetCount:this.targetCount, hitCount:this.roundState.hitTargets.length, expression:this.roundState.functionExpression, round:this.currentRound });
        if (this.campaignState && this.campaignState.active) {
            const pass = !!this.roundState.hitTarget && !hitForbidden;
            if (pass && this.currentRound > this.getCampaignProgress() && !this.campaignState.isRandomChallenge && !this.campaignState.isEditorVerify) this.setCampaignProgress(this.currentRound);
            this.emit('campaignLevelResult', { levelId:this.currentRound, pass, score, expression:this.roundState.functionExpression, clearedMax:this.getCampaignProgress(), totalLevels:this.campaignState.totalLevels });
            this.setPhase(this.phases.INIT); return;
        }
        this.setPhase(this.phases.SWITCH_PLAYER);
    }

    // ─── 历史（委托 GameHistoryService） ─────────────────────────────────────
    recordRoundHistory(d) { if(this._history){this._history.recordRound(d);return;} this.gameHistory.push(d); }
    clearGameHistory()    { if(this._history){this._history.clearHistory();} this.gameHistory=[]; }
    getGameReport()       { return this._history ? this._history.getReport(this.difficulty,this.totalRounds,{A:this.players.A.score,B:this.players.B.score}) : {difficulty:this.difficulty,totalRounds:this.totalRounds,winner:this.players.A.score>this.players.B.score?'A':this.players.B.score>this.players.A.score?'B':'draw',finalScores:{A:this.players.A.score,B:this.players.B.score},history:this.gameHistory}; }

    // ─── 测试模式 ─────────────────────────────────────────────────────────────
    addTestModeFunction(expression, color=null) {
        if (!this.isTestMode()) return;
        if (this._history) { const c=this._history.addTestFunction(expression,color); this.testModeFunctions=this._history.getTestFunctions(); this.emit('testModeFunctionAdded',{expression,color:c}); }
    }
    clearTestModeFunctions() { if(this._history)this._history.clearTestFunctions(); this.testModeFunctions=[]; }
    getTestModeFunctions()   { return this._history?this._history.getTestFunctions():this.testModeFunctions; }

    // ─── 游戏结束 ─────────────────────────────────────────────────────────────
    endGame() {
        this.stopTimer();
        const winner = this.players.A.score>this.players.B.score?'A':this.players.B.score>this.players.A.score?'B':'draw';
        this.emit('gameEnd', { winner, scores:{A:this.players.A.score,B:this.players.B.score}, report:this.getGameReport() });
    }

    resetGame() {
        this.totalRounds=8; this.difficulty='normal'; this.targetCount=1; this.currentRound=1; this.gameMode='local';
        this.players.A.score=0; this.players.B.score=0; this.testModeFunctions=[]; this.clearGameHistory(); this.resetRoundState();
        this.setPhase(this.phases.SELECT_TARGET); this.emit('gameReset');
    }

    // ─── 状态快照 ─────────────────────────────────────────────────────────────
    getGameState() {
        return { currentRound:this.currentRound, totalRounds:this.totalRounds, currentPlayer:this.currentPlayer, currentPhase:this.currentPhase, remainingTime:this.remainingTime, timeLimit:this.timeLimit, difficulty:this.difficulty, targetCount:this.targetCount, isTestMode:this.isTestMode(), gameMode:this.gameMode, testModeFunctions:this.getTestModeFunctions(), scores:{A:this.players.A.score,B:this.players.B.score}, roundState:{...this.roundState}, maxForbidden:this.getMaxForbiddenCount(), maxLocks:this.getMaxLockCount(), usedCells:window.boardModule?window.boardModule.getUsedCells():this.usedCells, elementLockCounts:this.elementLockCounts, getElementLockCount:(el)=>this.getElementLockCount(el), functionHistory:this.functionHistory };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameController;
}
