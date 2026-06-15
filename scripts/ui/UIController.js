
class UIController {
    constructor(gridSystem, gameController) {
        this.gridSystem = gridSystem;
        this.gameController = gameController;
        this.parser = new FunctionParser();
        this.detector = new CollisionDetector(gridSystem); // 传入gridSystem以支持自适应容差
        this.renderer = new FunctionRenderer(gridSystem);        this.aiController = new AIController(gameController, gridSystem);
        this.aiController.uiController = this; // 设置UIController引用        if (typeof SummaCharacter !== 'undefined') {
            window.summaCharacter = new SummaCharacter('summa-container');
        }        if (typeof RandomChallengeMode !== 'undefined') {
            this.randomChallenge = new RandomChallengeMode(gameController, this, gridSystem);
        }        this.aiTriggerQueue = [];
        this.isProcessingAITrigger = false;        this._modalStates = new Map();        this._modalSkipCallbacks = new Map();        this._modalExitFinishers = new Map();        this._gameActive = false;        this.p2pController = null;
        this._p2pFirstPlayer = 'B';
        this._p2pMeWantRematch = false;
        this._p2pThemWantRematch = false;
        this._remoteExpression = '';        this.currentExpression = '';
        this.expressionElements = [];        this.cursorIndex = 0;        this.draggedElement = null;        this.gameEventView       = new GameEventView(this);
        this.gameFlowView        = new GameFlowView(this);
        this.startMenuView       = new StartMenuView(this);
        this.gameActionView      = new GameActionView(this);
        this.p2pView             = new P2PView(this);
        this.campaignView        = new CampaignView(this);
        this.testModeView        = new TestModeView(this);
        this.expressionView      = new ExpressionView(this);
        this.canvasInteraction   = new CanvasInteractionView(this);
        this.modalService        = new ModalService(this);
        this.initUI();
        this.bindEvents();
        this.gameEventView.bind();
    }

    initUI() {
        const g = id => document.getElementById(id);
        Object.assign(this, {
            scoreAElement: g('score-a'), scoreBElement: g('score-b'),
            scoreDisplays: document.querySelectorAll('.score-display'),
            roundElement: g('current-round'), totalRoundsElement: g('total-rounds'),
            timerElement: g('timer'), currentPlayerElement: g('current-player'),
            phaseHintElement: g('phase-hint'), expressionDisplay: g('expression-display'),
            messageElement: g('message'), messagePanel: g('message-panel'),
            bgmEnabledCheckbox: g('bgm-enabled'), bgmVolumeSlider: g('bgm-volume'),
            bgmVolumeValue: g('bgm-volume-value'), sfxVolumeSlider: g('sfx-volume'),
            sfxVolumeValue: g('sfx-volume-value'), bgmOpenBtn: g('bgm-open-btn'),
            startBgmOpenBtn: g('start-bgm-open-btn'), bgmModal: g('bgm-modal'),
            bgmCloseBtn: g('bgm-close-btn'), confirmBtn: g('confirm-btn'),
            clearBtn: g('clear-btn'), exitBtn: g('exit-btn'),
            exitPopover: g('exit-confirm-popover'), cancelExitBtn: g('cancel-exit-btn'),
            confirmExitBtn: g('confirm-exit-btn'), elementsContainer: g('elements-container'),
            gameOverModal: g('game-over-modal'), winnerElement: g('winner'),
            finalScoresElement: g('final-scores'), restartBtn: g('restart-btn'),
            viewReportBtn: g('view-report-btn'), campaignVictoryModal: g('campaign-victory-modal'),
            campaignVictoryText: g('campaign-victory-text'), campaignHomeBtn: g('campaign-home-btn'),
            campaignRetryBtn: g('campaign-retry-btn'), campaignNextBtn: g('campaign-next-btn'),
            reportModal: g('report-modal'), reportContentElement: g('report-content'),
            closeReportBtn: g('close-report-btn'), startModal: g('start-modal'),
            startBtn: g('start-btn'), roundStepper: g('round-stepper'),
            roundValue: g('round-value'), difficultyStepper: g('difficulty-stepper'),
            difficultyValue: g('difficulty-value'), difficultyHint: g('difficulty-hint'),
            header: g('header'), modeLocalBtn: g('mode-local'), modeAiBtn: g('mode-ai'),
            modeCampaignBtn: g('mode-campaign'), modeRandomBtn: g('mode-random'),
            modeTestBtn: g('mode-test'), modeMoreBtn: g('mode-more'),
            modeMoreSubmenu: g('mode-more-submenu'), modeHint: g('mode-hint'),
            selectedMode: 'local', campaignPanel: g('campaign-panel'),
            campaignLevelSelect: g('campaign-level-select'),
            campaignProgressText: g('campaign-progress'), campaignPack: null,
            campaignModal: g('campaign-modal'),
            campaignStepDifficulty: g('campaign-step-difficulty'),
            campaignStepLevels: g('campaign-step-levels'),
            campaignGlobalProgress: g('campaign-global-progress'),
            campaignStarProgress: g('campaign-star-progress'),
            summaDialog: g('summa-train-dialog'), summaDialogTitle: g('summa-dialog-title'),
            summaDialogMessage: g('summa-dialog-message'), summaDialogOptions: g('summa-dialog-options'),
            summaDialogInputArea: g('summa-dialog-input-area'), summaDialogInput: g('summa-dialog-input'),
            campaignLevelTitle: g('campaign-level-title'), campaignLevelProgress: g('campaign-level-progress'),
            campaignLevelGrid: g('campaign-level-grid'), campaignFileInput: g('campaign-file-input'),
            campaignDifficulty: null, campaignCurrentLevelId: null,
            campaignCurrentLevelBestRecord: null, battleUiHidden: false,
            campaignDrawDelayOptions: [0, 1000, 5000],
            aiModeHint: g('ai-mode-hint'), aiManageBtn: g('ai-manage-btn'),
            modeEditorBtn: g('mode-editor'), modeP2PBtn: g('mode-p2p'),
        });
        this.campaignDrawDelay = this.getCampaignDrawDelaySetting();
        this.bindSummaDialogEvents();
        this.initStartSelectors();
        this.refreshStartSelectorDisplay();
        const on = (id, fn) => { const el = g(id); if (el) el.addEventListener('click', fn); };
        if (this.modeLocalBtn) this.modeLocalBtn.addEventListener('click', () => this.selectMode('local'));
        if (this.modeAiBtn) this.modeAiBtn.addEventListener('click', () => this.selectMode('ai'));
        if (this.modeCampaignBtn) this.modeCampaignBtn.addEventListener('click', () => this.selectMode('campaign'));
        if (this.modeTestBtn) this.modeTestBtn.addEventListener('click', () => this.selectMode('test'));
        if (this.modeEditorBtn) this.modeEditorBtn.addEventListener('click', () => this.selectMode('editor'));
        if (this.modeP2PBtn) this.modeP2PBtn.addEventListener('click', () => this.selectMode('p2p'));
        if (this.modeRandomBtn) this.modeRandomBtn.addEventListener('click', () => this.selectMode('random'));
        if (this.modeMoreBtn) this.modeMoreBtn.addEventListener('click', () => {
            const open = this.modeMoreSubmenu?.style.display !== 'none';
            if (this.modeMoreSubmenu) this.modeMoreSubmenu.style.display = open ? 'none' : 'block';
            this.modeMoreBtn.textContent = open ? '更多模式 ▸' : '更多模式 ▾';
        });
        if (this.aiManageBtn) this.aiManageBtn.addEventListener('click', () => { if (window.summaTrainer) window.summaTrainer.showPanel(); });
        on('campaign-close-btn', () => this.closeCampaignUI());
        on('campaign-close-btn2', () => this.closeCampaignUI());
        on('campaign-back-btn', () => this.playUIButtonSound(() => this.showCampaignDifficulty()));
        on('campaign-reset-btn', () => this.playUIButtonSound(() => this.resetCampaignProgress()));
        on('campaign-diff-easy', () => this.playUIButtonSound(() => this.openCampaignLevels('easy')));
        on('campaign-diff-normal', () => this.playUIButtonSound(() => this.openCampaignLevels('normal')));
        on('campaign-diff-hard', () => this.playUIButtonSound(() => this.openCampaignLevels('hard')));
        on('campaign-diff-expert', () => this.playUIButtonSound(() => this.openCampaignLevels('expert')));
        on('campaign-diff-unsolvable', () => this.playUIButtonSound(() => this.openCampaignLevels('unsolvable')));
        on('campaign-return-difficulty-btn', () => this.playUIButtonSound(() => this.returnCampaignToDifficulty()));
        on('campaign-home-btn', () => this.playUIButtonSound(() => this.returnToCampaignLevelSelect()));
        on('campaign-retry-btn', () => this.playUIButtonSound(() => this.retryCampaignLevel()));
        on('campaign-next-btn', () => this.playUIButtonSound(() => this.goToNextCampaignLevel()));
        this.refreshUnsovableDifficultyVisibility();
        this.addCampaignDrawDelayToggle();
        this.updateCampaignDrawDelayToggleVisibility();
        this.bindBackgroundMusicControls();
        this.initBackgroundMusic();
    }

    _getModalState(el) {
        return this._modalStates.get(el) || 'hidden';
    }

    _setModalState(el, state) {
        this._modalStates.set(el, state);
    }

    showModal(modal, display = 'flex') {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) return;

        const state = this._getModalState(el);
        if (state === 'visible' || state === 'entering') return;

        if (state === 'exiting') {
            el.classList.remove('modal-exiting');
            el.removeEventListener('animationend', this._modalExitFinishers.get(el));
            this._modalExitFinishers.delete(el);
            el.style.display = 'none';
            this._setModalState(el, 'hidden');
            this._modalSkipCallbacks.delete(el);
        }

        this._setModalState(el, 'entering');
        el.classList.remove('modal-exiting');
        el.style.display = display;

        void el.offsetWidth;

        el.classList.add('modal-entering');

        const onEnterEnd = () => {
            el.classList.remove('modal-entering');
            el.removeEventListener('animationend', onEnterEnd);
            this._setModalState(el, 'visible');
        };
        el.addEventListener('animationend', onEnterEnd);
    }

    hideModal(modal, callback) {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) {
            if (callback) callback();
            return;
        }

        const computed = window.getComputedStyle(el).display;
        const styleNone = el.style.display === 'none';
        if (styleNone || computed === 'none') {
            this._setModalState(el, 'hidden');
            if (callback) callback();
            return;
        }

        const state = this._getModalState(el);
        if (state === 'exiting' || state === 'hidden') {
            if (callback) callback();
            return;
        }
        if (state === 'entering') {
            el.classList.remove('modal-entering');
        }

        this._setModalState(el, 'exiting');
        el.classList.remove('modal-entering');
        el.classList.add('modal-exiting');

        let called = false;
        const doCallback = () => {
            if (called) return;
            called = true;
            el.classList.remove('modal-exiting');
            el.style.display = 'none';
            this._setModalState(el, 'hidden');
            this._modalExitFinishers.delete(el);
            this._modalSkipCallbacks.delete(el);
            if (callback) callback();
        };

        const onExitEnd = () => {
            el.removeEventListener('animationend', onExitEnd);
            doCallback();
        };
        this._modalExitFinishers.set(el, onExitEnd);
        el.addEventListener('animationend', onExitEnd);

        setTimeout(() => {
            if (this._getModalState(el) === 'exiting') {
                doCallback();
            }
        }, 400);
    }

    updateDifficultyHint() { return this.startMenuView.updateDifficultyHint(); }
    initStartSelectors() { return this.startMenuView.initStartSelectors(); }
    bindStepperButtons() { return this.startMenuView.bindStepperButtons(); }
    stepRound(...args) { return this.startMenuView.stepRound(...args); }
    stepDifficulty(...args) { return this.startMenuView.stepDifficulty(...args); }
    playSelectorChangeFeedback(...args) { return this.startMenuView.playSelectorChangeFeedback(...args); }
    refreshStartSelectorDisplay() { return this.startMenuView.refreshStartSelectorDisplay(); }
    syncStartSelectionState() { return this.startMenuView.syncStartSelectionState(); }
    syncModeButtonsFromDifficulty() { return this.startMenuView.syncModeButtonsFromDifficulty(); }
    applyStartModeLayout() { return this.startMenuView.applyStartModeLayout(); }
    setStartSelectorsEnabled(...args) { return this.startMenuView.setStartSelectorsEnabled(...args); }
    applyStepperColors(...args) { return this.startMenuView.applyStepperColors(...args); }
    getRoundColor(...args) { return this.startMenuView.getRoundColor(...args); }
    getDifficultyColor(...args) { return this.startMenuView.getDifficultyColor(...args); }
    selectMode(...args) { return this.startMenuView.selectMode(...args); }

    bindGameEvents() { this.gameEventView.bind(); }

    bindSummaDialogEvents(...args) { return this.gameActionView.bindSummaDialogEvents(...args); }
    showGameDialog(...args) { return this.gameActionView.showGameDialog(...args); }
    hideSummaDialog(...args) { return this.gameActionView.hideSummaDialog(...args); }

    bindEvents() {
        this.gridSystem.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.gridSystem.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.gridSystem.canvas.addEventListener('mousemove', (e) => this.checkHistoryFunctionHover(e));
        
        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.clearBtn.addEventListener('click', () => this.handleClear());
        this.exitBtn.addEventListener('click', () => this.handleExitClick());
        this.restartBtn.addEventListener('click', () => this.handleRestart());
        document.getElementById('p2p-rematch-btn')?.addEventListener('click', () => this._requestP2PRematch());
        this.startBtn.addEventListener('click', () => this.handleStart());
        this.bindStartKeyboardSupport();
        if (this.viewReportBtn) {
            this.viewReportBtn.addEventListener('click', () => this.showGameReport());
        }
        if (this.closeReportBtn) {
            this.closeReportBtn.addEventListener('click', () => this.hideGameReport());
        }
        
        if (this.cancelExitBtn) {
            this.cancelExitBtn.addEventListener('click', () => this.hideExitConfirm());
        }
        if (this.confirmExitBtn) {
            this.confirmExitBtn.addEventListener('click', () => this.handleExit());
        }
        
        this.expressionDisplay.addEventListener('click', (e) => this.handleExpressionClick(e));
        this.bindExpressionScrollSupport();
        
        window.addEventListener('keydown', (e) => this.handleKeyboardInput(e), true);
        
        this.initDraggableElements();
    }

    bindExpressionScrollSupport(...args) { return this.expressionView.bindExpressionScrollSupport(...args); }
    handleStartSelectorKeys(...args) { return this.gameActionView.handleStartSelectorKeys(...args); }
    handleKeyboardInput(...args) { return this.gameActionView.handleKeyboardInput(...args); }
    initDraggableElements() { return this.expressionView.initDraggableElements(); }
    initLockElementsView() { return this.expressionView.initLockElementsView(); }
    toggleLockElement(...args) { return this.expressionView.toggleLockElement(...args); }
    showLockCountTooltip(...args) { return this.expressionView.showLockCountTooltip(...args); }
    hideLockCountTooltip() { return this.expressionView.hideLockCountTooltip(); }
    checkHistoryFunctionHover(...args) { return this.canvasInteraction.checkHistoryFunctionHover(...args); }
    isMouseNearFunction(...args) { return this.canvasInteraction.isMouseNearFunction(...args); }
    pointToLineDistance(...args) { return this.canvasInteraction.pointToLineDistance(...args); }
    showHistoryFunctionTooltip(...args) { return this.canvasInteraction.showHistoryFunctionTooltip(...args); }
    hideHistoryFunctionTooltip() { return this.canvasInteraction.hideHistoryFunctionTooltip(); }
    updateLockedElements() { return this.expressionView.updateLockedElements(); }
    async triggerAITurn(...args) { return await this.gameActionView.triggerAITurn(...args); }
    async processAITriggerQueue(...args) { return await this.gameActionView.processAITriggerQueue(...args); }
    handleCanvasClick(...args) { return this.canvasInteraction.handleCanvasClick(...args); }
    handleCanvasHover(...args) { return this.canvasInteraction.handleCanvasHover(...args); }
    addElementToExpression(...args) { return this.expressionView.addElementToExpression(...args); }
    getDisplaySymbol(...args) { return this.expressionView.getDisplaySymbol(...args); }
    updateExpressionDisplay() { return this.expressionView.updateExpressionDisplay(); }
    handleExpressionClick(...args) { return this.expressionView.handleExpressionClick(...args); }
    handleVerticalCursorMove(...args) { return this.expressionView.handleVerticalCursorMove(...args); }
    clearExpression(...args) { return this.expressionView.clearExpression(...args); }
    handleConfirm(...args) { return this.gameActionView.handleConfirm(...args); }
    submitFunction(...args) { return this.gameActionView.submitFunction(...args); }
    async renderTestModeFunction(...args) { return await this.testModeView.renderTestModeFunction(...args); }
    getTestModeColor() { return this.testModeView.getTestModeColor(); }
    async prepareRenderCanvas() {
        this._renderTempState = null;
        if (this.gridSystem && typeof this.gridSystem.draw === 'function') {
            this.gridSystem.draw(this._buildSnapshot());
        }
    }

    _buildSnapshot() { const gc=this.gameController; return {targetCells:gc?.roundState?.targetCells??[],forbiddenCells:gc?.roundState?.forbiddenCells??[],usedCells:window.boardModule?window.boardModule.getUsedCells():(gc?.usedCells??[]),functionHistory:window.renderModule?window.renderModule.getHistory():(gc?.functionHistory??[]),currentRound:gc?.currentRound??1}; }

    _isAITurn() { return this.gameController?.gameMode==='ai'&&this.gameController?.currentPlayer==='B'; }
    async postRenderRefresh() {
        if (!this.gridSystem) return;
        await new Promise(resolve => requestAnimationFrame(() => {
            // 仅等待下一帧，让浏览器完成本次绘制提交；不要再次清空画布，否则会把函数擦掉
            resolve();
        }));
    }
    getCampaignDrawDelaySetting() { return this.campaignView.getCampaignDrawDelaySetting(); }
    setCampaignDrawDelaySetting(...args) { return this.campaignView.setCampaignDrawDelaySetting(...args); }
    addCampaignDrawDelayToggle() { return this.campaignView.addCampaignDrawDelayToggle(); }
    updateCampaignDrawDelayToggleVisibility() { return this.campaignView.updateCampaignDrawDelayToggleVisibility(); }
    updateCampaignDrawDelayToggle() { return this.campaignView.updateCampaignDrawDelayToggle(); }
    bindBackgroundMusicControls(...args) { return this.gameActionView.bindBackgroundMusicControls(...args); }
    initBackgroundMusic(...args) { return this.gameActionView.initBackgroundMusic(...args); }
    async renderAndEvaluate(expression) {
        try {
            await this.prepareRenderCanvas();
            await this.renderer.drawFunction(expression, true);
            const isCampaignLike = (this.gameController && this.gameController.gameMode === 'campaign')
                || (this.levelEditor?.isActive && this.levelEditor.editMode === 'verify')
                || this.randomChallenge?.isActive;
            if (isCampaignLike && this.campaignDrawDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.campaignDrawDelay));
            }
            await this.postRenderRefresh();
            const range = this.gridSystem.getRange();
            const collisionPoints = this.renderer.sampleFunction(expression, range.min, range.max, true);
            const polyline = this.renderer.convertToPolyline(collisionPoints);
            const state = this.gameController.getGameState();
            const targetCells = state.roundState.targetCells;
            const forbiddenCells = state.roundState.forbiddenCells;
            const hitTargets = [];
            for (const targetCell of targetCells) {
                if (this.detector.checkHitTarget(polyline, targetCell, this.gridSystem)) hitTargets.push(targetCell);
            }
            let hitForbidden = false;
            if (forbiddenCells.length > 0) hitForbidden = this.detector.checkHitForbidden(polyline, forbiddenCells, this.gridSystem);
            const functionType = this.parser.analyzeFunctionType(expression);
            this.gameController.evaluateResult(hitTargets, hitForbidden, functionType);
        } catch (e) {
            console.error('[UI] renderAndEvaluate异常:', e);
            // 防止游戏卡死在EVALUATE阶段：以未命中降级处理
            if (this.gameController.currentPhase === this.gameController.phases.EVALUATE) {
                this.gameController.evaluateResult([], false, { type: 'unknown', score: -1 });
            }
        }
    }
    showEvaluationResult(...args) { return  this.gameActionView.showEvaluationResult(...args); }
    showScorePopup(...args) { return this.gameActionView.showScorePopup(...args); }
    flashGrid(...args) { return this.gameActionView.flashGrid(...args); }
    handleClear(...args) { return this.gameActionView.handleClear(...args); }
    handleSkip() { return this.gameActionView.handleSkip(); }
    forceStopGame(...args) { return this.gameActionView.forceStopGame(...args); }

    _markGameActive() {
        this._gameActive = true;
    }

    handleExitClick(...args) { return this.gameActionView.handleExitClick(...args); }
    showExitConfirm(...args) { return this.gameActionView.showExitConfirm(...args); }

    playUIButtonSound(action) {
        if (window.audioManager) window.audioManager.playClick();
        if (typeof action === 'function') action();
    }

    hideExitConfirm(...args) { return this.gameActionView.hideExitConfirm(...args); }
    handleExit(...args) { return this.gameActionView.handleExit(...args); }
    exitTestMode(...args) { return this.testModeView.exitTestMode(...args); }
    bindStartKeyboardSupport(...args) { return this.gameActionView.bindStartKeyboardSupport(...args); }
    async handleStart(...args) { return await this.gameActionView.handleStart(...args); }
    async loadCampaignPack(...args) { return await this.campaignView.loadCampaignPack(...args); }
    getCampaignClearedMax(...args) { return this.campaignView.getCampaignClearedMax(...args); }
    getCampaignCollectedStars(...args) { return this.campaignView.getCampaignCollectedStars(...args); }
    getCampaignLevelBestStars(...args) { return this.campaignView.getCampaignLevelBestStars(...args); }
    setCampaignLevelBestStars(...args) { return this.campaignView.setCampaignLevelBestStars(...args); }
    setCampaignCollectedStars(...args) { return this.campaignView.setCampaignCollectedStars(...args); }
    renderCampaignStarProgress(...args) { return this.campaignView.renderCampaignStarProgress(...args); }
    async refreshCampaignStartUI(...args) { return await this.campaignView.refreshCampaignStartUI(...args); }
    async startCampaign(...args) { return await this.campaignView.startCampaign(...args); }
    showCampaignVictory(...args) { return this.campaignView.showCampaignVictory(...args); }
    hideCampaignVictory() { return this.campaignView.hideCampaignVictory(); }
    getCurrentExpressionLength(...args) { return this.expressionView.getCurrentExpressionLength(...args); }
    getCampaignLevelBestRecord(...args) { return this.campaignView.getCampaignLevelBestRecord(...args); }
    setCampaignLevelBestRecord(...args) { return this.campaignView.setCampaignLevelBestRecord(...args); }
    renderCampaignVictoryStars(...args) { return this.campaignView.renderCampaignVictoryStars(...args); }
    retryCampaignLevel() { return this.campaignView.retryCampaignLevel(); }
    async goToNextCampaignLevel(...args) { return await this.campaignView.goToNextCampaignLevel(...args); }
    returnToCampaignLevelSelect() { return this.campaignView.returnToCampaignLevelSelect(); }
    returnCampaignToDifficulty() { return this.campaignView.returnCampaignToDifficulty(); }
    openCampaignUI() { return this.campaignView.openCampaignUI(); }
    closeCampaignUI() { return this.campaignView.closeCampaignUI(); }
    showCampaignDifficulty() { return this.campaignView.showCampaignDifficulty(); }
    hideBattleUI() { return this.campaignView.hideBattleUI(); }
    restoreBattleUI() { return this.campaignView.restoreBattleUI(); }
    resetBattleGrid() { return this.campaignView.resetBattleGrid(); }
    updateCampaignGlobalProgressText(...args) { return this.campaignView.updateCampaignGlobalProgressText(...args); }
    calculateLRSigma(...args) { return this.campaignView.calculateLRSigma(...args); }
    updateCampaignLRSigmaDisplay(...args) { return this.campaignView.updateCampaignLRSigmaDisplay(...args); }
    async resetCampaignProgress(...args) { return await this.campaignView.resetCampaignProgress(...args); }
    getDifficultyRange(...args) { return this.campaignView.getDifficultyRange(...args); }
    openCampaignLevels(...args) { return this.campaignView.openCampaignLevels(...args); }
    refreshUnsovableDifficultyVisibility() { return this.campaignView.refreshUnsovableDifficultyVisibility(); }
    updateCampaignLevelBadge(...args) { return this.campaignView.updateCampaignLevelBadge(...args); }
    renderCampaignLevelGrid(...args) { return this.campaignView.renderCampaignLevelGrid(...args); }
    initTestModeUI() { return this.testModeView.initTestModeUI(); }
    addWheelZoomSupport(...args) { return this.testModeView.addWheelZoomSupport(...args); }
    adjustRange(...args) { return this.testModeView.adjustRange(...args); }
    addZoomButtons() { return this.testModeView.addZoomButtons(); }
    updateZoomDisplay(...args) { return this.testModeView.updateZoomDisplay(...args); }
    lockZoomButtons() { return this.testModeView.lockZoomButtons(); }
    unlockZoomButtons() { return this.testModeView.unlockZoomButtons(); }
    addFunctionListContainer() { return this.testModeView.addFunctionListContainer(); }
    updateFunctionList() { return this.testModeView.updateFunctionList(); }
    async redrawTestModeFunctions(...args) { return await this.testModeView.redrawTestModeFunctions(...args); }
    tokenizeExpression(...args) { return this.testModeView.tokenizeExpression(...args); }
    editTestFunction(...args) { return this.testModeView.editTestFunction(...args); }
    deleteTestFunction(...args) { return this.testModeView.deleteTestFunction(...args); }
    async redrawAllTestFunctions(...args) { return await this.testModeView.redrawAllTestFunctions(...args); }
    addClearFunctionsButton(...args) { return this.testModeView.addClearFunctionsButton(...args); }
    handleRestart() { return this.gameActionView.handleRestart(); }
    refreshHistoryFunctionPoints(...args) { return this.gameFlowView.refreshHistoryFunctionPoints(...args); }
    updatePhaseUI(...args) { return this.gameFlowView.updatePhaseUI(...args); }
    updateTimer(...args) { return this.gameFlowView.updateTimer(...args); }
    updateScoreboard() { return this.gameFlowView.updateScoreboard(); }
    showMessage(...args) { return this.gameFlowView.showMessage(...args); }
    fadeOutMessage() { return this.gameFlowView.fadeOutMessage(); }
    showGameOver(...args) { return this.gameFlowView.showGameOver(...args); }
    showGameReport() { return this.gameFlowView.showGameReport(); }
    hideGameReport() { return this.gameFlowView.hideGameReport(); }
    getDifficultyName(...args) { return this.gameFlowView.getDifficultyName(...args); }
    getFunctionTypeName(...args) { return this.gameFlowView.getFunctionTypeName(...args); }
    startLevelEditor(...args) { return this.testModeView.startLevelEditor(...args); }
    showP2PRoomDialog() { return this.p2pView.showP2PRoomDialog(); }
    _createP2PRoomModal() { return this.p2pView._createP2PRoomModal(); }
    _bindP2PRoomEvents() { return this.p2pView._bindP2PRoomEvents(); }
    _createP2PRoom() { return this.p2pView._createP2PRoom(); }
    _joinP2PRoom() { return this.p2pView._joinP2PRoom(); }
    _setupP2PCallbacks() { return this.p2pView._setupP2PCallbacks(); }
    _startP2PGame() { return this.p2pView._startP2PGame(); }
    _receiveGameInit(...args) { return this.p2pView._receiveGameInit(...args); }
    _applyRemoteAction(...args) { return this.p2pView._applyRemoteAction(...args); }
    _handleNack(...args) { return this.p2pView._handleNack(...args); }

    _forwardP2PAction(action, payload, rollback = null) {
        if (!this.gameController.isP2PMode() || !this.p2pController?.isConnected) return;
        this.p2pController.sendGameAction(action, payload, rollback);
    }

    _updateP2PStatus(...args) { return this.p2pView._updateP2PStatus(...args); }
    _updateP2PTurnDisplay(...args) { return this.p2pView._updateP2PTurnDisplay(...args); }
    _isP2PBlocked(...args) { return this.p2pView._isP2PBlocked(...args); }
    _p2pSyncScores(...args) { return this.p2pView._p2pSyncScores(...args); }
    _applyStateSync(...args) { return this.p2pView._applyStateSync(...args); }
    _cleanupP2P(...args) { return this.p2pView._cleanupP2P(...args); }
    _requestP2PRematch(...args) { return this.p2pView._requestP2PRematch(...args); }
    _checkAndStartRematch(...args) { return this.p2pView._checkAndStartRematch(...args); }
}if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
