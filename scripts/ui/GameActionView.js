class GameActionView {
    constructor(ui) { this.ui=ui; this.summaDialogView=new SummaDialogView(ui); this.aITurnHandler=new AITurnHandler(ui); }

    async handleStart() {
        const ui = this.ui;
        if(window.audioManager){if(window.audioManager.audioCtx?.state==='suspended')window.audioManager.audioCtx.resume();window.audioManager.playClick();}
        if(ui.selectedMode==='p2p'){ui.showP2PRoomDialog();return;}
        if(ui.selectedMode==='campaign'){ui.openCampaignUI();return;}
        if(ui.selectedMode==='editor'){ui.hideModal(ui.startModal);ui.startLevelEditor();return;}
        if(ui.selectedMode==='random'){ui.hideModal(ui.startModal);ui.randomChallenge?.activate();return;}
        const rounds=parseInt(ui.roundSelect?.value||ui.roundOptions?.[ui.currentRoundIndex||0]?.value||8);
        let gameMode=ui.selectedMode, difficulty;
        if(gameMode==='test'){difficulty='test';gameMode='local';}
        else difficulty=ui.difficultySelect?.value||ui.difficultyOptions?.[ui.currentDifficultyIndex||0]?.value||'easy';
        if(gameMode==='ai'&&window.summaTrainer){
            if(ui.aiModeHint)ui.aiModeHint.textContent='正在检查 AI 训练状态...';
            let shouldTrain=false, trainAmount=50000;
            if(window.summaTrainer.isModelTrained(difficulty)){
                const choice=await ui.showGameDialog?.({title:'检测到已有模型',message:`检测到 [${difficulty}] 难度的神经网络模型。<br><br>若想继续升维训练，请选择训练规模：`,options:[{label:'1,000,000',value:1000000},{label:'5,000,000',value:5000000},{label:'20,000,000',value:20000000},{label:'100,000,000',value:100000000}],showSkip:true,skipText:'跳过，使用现有模型直接开始'});
                if(choice&&choice>0){trainAmount=choice;shouldTrain=true;}
            } else {
                const wantTrain=await ui.showGameDialog?.({title:'唤醒 Summa',message:`AI 尚未针对「${difficulty}」难度训练。<br><br>请选择训练规模：`,options:[{label:'1,000,000',value:1000000},{label:'5,000,000',value:5000000},{label:'20,000,000',value:20000000},{label:'100,000,000',value:100000000}],showSkip:true,skipText:'暂不训练，取消'});
                if(wantTrain&&wantTrain>0){trainAmount=wantTrain;shouldTrain=true;}
            }
            if(shouldTrain){
                if(ui.aiModeHint)ui.aiModeHint.textContent='正在训练 AI，请稍候...';
                ui.hideModal(ui.startModal);
                localStorage.removeItem(`summa_model_v2_${difficulty}`);
                await window.summaTrainer.startTraining(difficulty,trainAmount);
            } else if(!window.summaTrainer.isModelTrained(difficulty)){
                ui.showModal(ui.startModal); return;
            }
            ui.hideModal(ui.startModal);
        } else {
            ui.hideModal(ui.startModal);
        }
        ui._markGameActive();
        ui.gameController.initGame(rounds,difficulty,gameMode);
        if(ui.aiModeHint&&gameMode==='ai')ui.aiModeHint.textContent='AI 模式已启动，Summa 正在对战';
        if(ui.gameController.isTestMode())ui.initTestModeUI();
    }

    handleRestart() {
        const ui=this.ui;
        if(window.audioManager)window.audioManager.playClick();
        if(ui.gameOverModal&&ui.gameOverModal.style.display!=='none'){
            ui.forceStopGame(); ui._cleanupP2P();
            ui.hideModal(ui.gameOverModal,()=>ui.showModal(ui.startModal)); return;
        }
        if(ui.gameController.isP2PMode()&&ui.p2pController?.isConnected){
            ui.forceStopGame(); ui._p2pMeWantRematch=true;
            ui.p2pController.sendRematchRequest();
            ui.showMessage('等待对手确认...','info');
            ui._checkAndStartRematch(); return;
        }
        ui.forceStopGame(); ui._cleanupP2P();
        ui.hideModal(ui.gameOverModal,()=>{
            if(ui.gameController.isTestMode())ui.exitTestMode();
            ui.showModal(ui.startModal);
        });
    }

    handleSkip() {
        const ui=this.ui;
        if(ui.gameController.isTestMode()){ui.exitTestMode();return;}
        const state=ui.gameController.getGameState();
        if(ui.gameController.gameMode==='ai'&&state.currentPlayer==='B'){ui.showMessage('Summa 正在思考中...','info');return;}
        ui.gameController.skipPhase();
    }

    handleKeyboardInput(e) {
        const ui=this.ui, phase=ui.gameController.currentPhase, key=e.key;
        if(ui._isAITurn()) return;
        if(this.handleStartSelectorKeys(e))return;
        if(ui.campaignVictoryModal&&ui.campaignVictoryModal.style.display!=='none'){
            if(key==='Enter'){e.preventDefault();ui.goToNextCampaignLevel();return;}
            if(key==='Delete'||key==='Backspace'){e.preventDefault();ui.retryCampaignLevel();return;}
        }
        if(ui.levelEditor?.isActive&&ui.levelEditor.editMode==='edit')return;
        if(key==='Enter'){
            e.preventDefault();
            if(['set_forbidden','set_locks','input_function'].includes(phase)){ui.handleConfirm();}
            else if(phase==='select_target'){const s=ui.gameController.getGameState();s.roundState.targetCell?ui.handleConfirm():ui.showMessage('请先点击棋盘选择目标网格','error');}
            return;
        }
        if(phase!=='input_function')return;
        if(ui.levelEditor?.isActive&&ui.levelEditor.editMode==='edit')return;
        const map={x:'x',X:'x',p:'π',P:'π',e:'e',E:'e',i:'i',I:'i',s:'sin',S:'sin',c:'cos',C:'cos',t:'tan',T:'tan',a:'abs',A:'abs',r:'sqrt',R:'sqrt',l:'ln',L:'ln'};
        if(map[key]){e.preventDefault();ui.addElementToExpression(map[key]);return;}
        if(/^[0-9]$/.test(key)||['+','-','*','/','.',  '!','(',')','^'].includes(key)){e.preventDefault();ui.addElementToExpression(key);return;}
        if(key==='Backspace'){e.preventDefault();if(ui.cursorIndex>0){if(window.audioManager)window.audioManager.playElementClick();ui.expressionElements.splice(ui.cursorIndex-1,1);ui.cursorIndex--;ui.updateExpressionDisplay();ui._forwardP2PAction('expression_change',{expression:ui.currentExpression});}return;}
        if(key==='Delete'){e.preventDefault();if(ui.cursorIndex<ui.expressionElements.length){if(window.audioManager)window.audioManager.playElementClick();ui.expressionElements.splice(ui.cursorIndex,1);ui.updateExpressionDisplay();ui._forwardP2PAction('expression_change',{expression:ui.currentExpression});}return;}
        if(key==='ArrowLeft'){e.preventDefault();if(ui.cursorIndex>0){ui.cursorIndex--;ui.updateExpressionDisplay();}return;}
        if(key==='ArrowRight'){e.preventDefault();if(ui.cursorIndex<ui.expressionElements.length){ui.cursorIndex++;ui.updateExpressionDisplay();}return;}
        if(key==='ArrowUp'||key==='ArrowDown'){e.preventDefault();ui.handleVerticalCursorMove(key==='ArrowUp'?-1:1);return;}
        if(key==='Home'){e.preventDefault();ui.cursorIndex=0;ui.updateExpressionDisplay();return;}
        if(key==='End'){e.preventDefault();ui.cursorIndex=ui.expressionElements.length;ui.updateExpressionDisplay();return;}
        if(key==='Escape'){e.preventDefault();ui.handleClear();}
    }

    handleStartSelectorKeys(e) {
        const ui=this.ui;
        if(!ui.startModal||ui.startModal.style.display==='none')return false;
        if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
            if(document.activeElement===ui.roundValue||ui.roundStepper?.contains(document.activeElement)){
                e.preventDefault();ui.stepRound(e.key==='ArrowRight'?1:-1);return true;
            }
            if(document.activeElement===ui.difficultyValue||ui.difficultyStepper?.contains(document.activeElement)){
                e.preventDefault();ui.stepDifficulty(e.key==='ArrowRight'?1:-1);return true;
            }
        }
        return false;
    }

    showEvaluationResult(data) {
        const ui=this.ui, state=ui.gameController.getGameState();
        if((ui.levelEditor?.isActive&&ui.levelEditor.editMode==='verify')||ui.randomChallenge?.isActive||state.campaignState?.active){
            let msg='';
            if(data.hitForbidden){msg='❌ 函数进入禁止区！';this.flashGrid('forbidden');}
            else if(data.hitTarget){msg=data.targetCount>1?`✅ 命中全部 ${data.targetCount} 个目标！`:'✅ 命中目标！';this.flashGrid('target');}
            else msg=data.targetCount>1&&data.hitCount>0?`❌ 只命中 ${data.hitCount}/${data.targetCount} 个目标`:'❌ 未命中目标！';
            ui.showMessage(msg,data.hitTarget&&!data.hitForbidden?'success':'error'); return;
        }
        let cp=state.currentPlayer, pd=`玩家${cp}`;
        if(state.gameMode==='ai'&&cp==='B')pd='Summa';
        let msg='';
        if(data.hitForbidden){msg=`❌ ${pd}的函数进入禁止区！扣1分`;this.flashGrid('forbidden');this.showScorePopup(cp,-1);}
        else if(data.hitTarget){msg=data.targetCount>1?`✅ ${pd}命中全部 ${data.targetCount} 个目标！函数类型: ${data.functionType.type}，得分: ${data.score}`:`✅ ${pd}命中目标！函数类型: ${data.functionType.type}，得分: ${data.score}`;this.flashGrid('target');this.showScorePopup(cp,data.score);}
        else{msg=data.targetCount>1&&data.hitCount>0?`❌ ${pd}只命中 ${data.hitCount}/${data.targetCount} 个目标，扣1分`:`❌ ${pd}未命中目标！扣1分`;this.showScorePopup(cp,-1);}
        if(state.gameMode==='ai'&&window.summaCharacter){
            const ok=data.hitTarget&&!data.hitForbidden, args={hitTarget:data.hitTarget,hitForbidden:data.hitForbidden,targetCount:data.targetCount||1,expression:data.expression};
            if(cp==='B'){ok?window.summaCharacter.reactAiSuccess(args):window.summaCharacter.reactAiError(args);}
            else{ok?window.summaCharacter.reactPlayerSuccess(args):window.summaCharacter.reactPlayerError(args);}
        }
        ui.showMessage(msg,data.hitTarget&&!data.hitForbidden?'success':'error');
        ui.updateScoreboard();
    }

    showScorePopup(player, scoreChange) {
        const ui=this.ui;
        if(ui.gameController?.gameMode==='campaign')return;
        const el=player==='A'?ui.scoreAElement:ui.scoreBElement; if(!el)return;
        const popup=document.createElement('div'); popup.className='score-popup';
        popup.textContent=scoreChange>=0?`+${scoreChange}`:`${scoreChange}`;
        popup.style.color=scoreChange>=0?'#5b9e6e':'#ef4444';
        const rect=el.getBoundingClientRect();
        popup.style.left=`${rect.left+rect.width/2}px`; popup.style.top=`${rect.top}px`;
        document.body.appendChild(popup); setTimeout(()=>popup.remove(),1500);
    }

    flashGrid(type) {
        const canvas=this.ui.gridSystem.canvas;
        canvas.style.boxShadow=type==='target'?'0 0 30px #5b9e6e':'0 0 30px #ef4444';
        setTimeout(()=>canvas.style.boxShadow='none',1000);
    }

    bindSummaDialogEvents(...args) { return this.summaDialogView.bindSummaDialogEvents(...args); }

    showGameDialog(...args) { return this.summaDialogView.showGameDialog(...args); }

    hideSummaDialog(...args) { return this.summaDialogView.hideSummaDialog(...args); }

    async triggerAITurn(...args) { return await this.aITurnHandler.triggerAITurn(...args); }

    async processAITriggerQueue(...args) { return await this.aITurnHandler.processAITriggerQueue(...args); }

    handleConfirm() {
        if (window.audioManager) window.audioManager.playClick();
        const phase = this.ui.gameController.currentPhase;
        const state = this.ui.gameController.getGameState();
            
        if (this.ui._isAITurn()) {
            this.ui.showMessage('Summa 正在思考中...', 'info');
            return;
        }

        if (this.ui._isP2PBlocked()) {
            this.ui.showMessage('请等待对手操作', 'info');
            return;
        }
            
        if (phase === 'select_target') {
            if (this.ui.gameController.confirmTargetSelection())
                this.ui._forwardP2PAction('confirm_target', {});
        } else if (phase === 'set_forbidden') {
            if (this.ui.gameController.confirmForbiddenSelection())
                this.ui._forwardP2PAction('confirm_forbidden', {});
        } else if (phase === 'set_locks') {
            if (this.ui.gameController.confirmLockSelection())
                this.ui._forwardP2PAction('confirm_locks', {});
        } else if (phase === 'input_function') {
            this.ui.submitFunction();
        }
    }

    submitFunction() {
        if (this.ui.expressionElements.length === 0) {
            this.ui.showMessage('请输入函数表达式', 'error');
            return;
        }
        
        const expression = this.ui.currentExpression;
        
        const validation = this.ui.parser.validateSyntax(expression);
        if (!validation.valid) {
            this.ui.showMessage(validation.error, 'error');
            return;
        }
        
        if (this.ui.gameController.isTestMode()) {
            this.ui.renderTestModeFunction(expression);
            return;
        }
        
        const lockCheck = this.ui.parser.validateExpressionForLocks(expression);
        if (!lockCheck.valid) {
            this.ui.showMessage(`表达式包含被锁定的元素: ${lockCheck.lockedElement}`, 'error');
            return;
        }
        
        this.ui.gameController.submitFunction(expression);

        this.ui._forwardP2PAction('submit_function', { expression });

        this.ui.renderAndEvaluate(expression).then(() => {
            if (this.ui.gameController.isP2PMode() && this.ui.p2pController?.isHost) this.ui._p2pSyncScores();
        }).catch(e => console.error('[UI] renderAndEvaluate失败:', e));
    }

    bindBackgroundMusicControls() {
        if (this.ui.bgmEnabledCheckbox) {
            this.ui.bgmEnabledCheckbox.addEventListener('change', () => {
                if (window.audioManager) window.audioManager.setBgmEnabled(this.ui.bgmEnabledCheckbox.checked);
            });
        }
        if (this.ui.bgmVolumeSlider) {
            this.ui.bgmVolumeSlider.addEventListener('input', () => {
                const volume = Number(this.ui.bgmVolumeSlider.value) / 100;
                if (this.ui.bgmVolumeValue) this.ui.bgmVolumeValue.textContent = `${this.ui.bgmVolumeSlider.value}%`;
                if (window.audioManager) window.audioManager.setBgmVolume(volume);
            });
        }
        if (this.ui.sfxVolumeSlider) {
            this.ui.sfxVolumeSlider.addEventListener('input', () => {
                const volume = Number(this.ui.sfxVolumeSlider.value) / 100;
                if (this.ui.sfxVolumeValue) this.ui.sfxVolumeValue.textContent = `${this.ui.sfxVolumeSlider.value}%`;
                if (window.audioManager) window.audioManager.setSfxVolume(volume);
            });
        }
        if (this.ui.bgmOpenBtn) {
            this.ui.bgmOpenBtn.addEventListener('click', () => {
                if (this.ui.bgmModal) this.ui.showModal(this.ui.bgmModal);
            });
        }
        if (this.ui.startBgmOpenBtn) {
            this.ui.startBgmOpenBtn.addEventListener('click', () => {
                if (this.ui.bgmModal) this.ui.showModal(this.ui.bgmModal);
            });
        }
        if (this.ui.bgmCloseBtn) {
            this.ui.bgmCloseBtn.addEventListener('click', () => {
                if (window.audioManager) window.audioManager.playClick();
                if (this.ui.bgmModal) this.ui.hideModal(this.ui.bgmModal);
            });
        }
    }

    initBackgroundMusic() {
        if (!window.audioManager) return;
        if (this.ui.bgmEnabledCheckbox) this.ui.bgmEnabledCheckbox.checked = window.audioManager.bgmEnabled;
        if (this.ui.bgmVolumeSlider) {
            this.ui.bgmVolumeSlider.value = String(Math.round(window.audioManager.bgmVolume * 100));
        }
        if (this.ui.bgmVolumeValue && this.ui.bgmVolumeSlider) {
            this.ui.bgmVolumeValue.textContent = `${this.ui.bgmVolumeSlider.value}%`;
        }
        if (this.ui.sfxVolumeSlider) {
            this.ui.sfxVolumeSlider.value = String(Math.round((window.audioManager.sfxVolume ?? 1) * 100));
        }
        if (this.ui.sfxVolumeValue && this.ui.sfxVolumeSlider) {
            this.ui.sfxVolumeValue.textContent = `${this.ui.sfxVolumeSlider.value}%`;
        }
        window.audioManager.startBgm();
    }

    handleClear() {
        if (this.ui.gameController.isTestMode()) {
            this.ui.clearExpression();
            this.ui.showMessage('已清除当前输入');
            return;
        }
        
        this.ui.clearExpression();
        this.ui.gridSystem.draw(this.ui._buildSnapshot());
    }

    forceStopGame() {
        if (this.ui.gameController && typeof this.ui.gameController.stopTimer === 'function') {
            this.ui.gameController.stopTimer();
        }

        this.ui.aiTriggerQueue = [];
        this.ui.isProcessingAITrigger = false;

        this.ui._gameActive = false;

        this.ui.showMessage('');
    }

    handleExitClick() {
        if (this.ui.levelEditor?.isActive) {
            this.ui.showExitConfirm();
        } else if (this.ui.gameController.isTestMode()) {
            this.ui.handleExit();
        } else {
            this.ui.showExitConfirm();
        }
    }

    showExitConfirm() {
        if (window.audioManager) window.audioManager.playClick();
        if (this.ui.exitPopover) {
            const p = this.ui.exitPopover.querySelector('p');
            if (p) p.textContent = this.ui.levelEditor?.isActive
                ? '确定要退出关卡编辑器吗？'
                : '确定要退出当前对局吗？';
            this.ui.exitPopover.classList.add('visible');
        }
    }

    hideExitConfirm() {
        if (this.ui.exitPopover) {
            this.ui.exitPopover.classList.remove('visible');
        }
    }

    handleExit() {
        if (window.audioManager) window.audioManager.playClick();
        this.ui.hideExitConfirm();

        this.ui.forceStopGame();

        if (this.ui.gameController.gameMode === 'campaign') {
            this.ui.returnCampaignToDifficulty();
            return;
        }

        if (this.ui.levelEditor?.isActive) {
            this.ui.levelEditor.deactivate();
        }

        if (this.ui.randomChallenge?.isActive) {
            this.ui.randomChallenge.deactivate();
        }

        if (this.ui.gameController.isTestMode()) {
            this.ui.exitTestMode();
        } else {
            this.ui._cleanupP2P();
            this.ui.gameController.resetGame();
            this.ui.resetBattleGrid();
            this.ui.hideModal(this.ui.gameOverModal);
            this.ui.showModal(this.ui.startModal);
        }
    }

    bindStartKeyboardSupport() {
        if (this.ui._startKeyBound) return;
        this.ui._startKeyBound = true;
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            if (!this.ui.startModal || this.ui.startModal.style.display === 'none') return;
            const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
            if (['input', 'textarea', 'select'].includes(targetTag)) return;
            e.preventDefault();
            this.ui.handleStart();
        });
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=GameActionView;
