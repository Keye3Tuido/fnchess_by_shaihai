/**
 * StartMenuView — 开始界面视图
 * 层级：UI View（由 UIController 持有）
 * 职责：模式选择、难度/回合步进器、开始界面所有 DOM 交互
 */
class StartMenuView {
    /** @param {UIController} ui */
    constructor(ui) { this.ui = ui; }

    updateDifficultyHint() {
        if (this.ui.difficultyHint) this.ui.difficultyHint.textContent = '';
        this.syncModeButtonsFromDifficulty();
        this.refreshStartSelectorDisplay();
    }

    initStartSelectors() {
        const ui = this.ui;
        ui.roundOptions = [
            { value: 8, label: '8 回合（快速对战）' },
            { value: 12, label: '12 回合（深度对战）' },
            { value: 16, label: '16 回合（持久战）' },
            { value: 20, label: '20 回合（极限挑战）' },
            { value: 24, label: '24 回合（终极对决）' }
        ];
        ui.difficultyOptions = [
            { value: 'easy', label: '简单 - 1个目标格' },
            { value: 'normal', label: '普通 - 2个目标格' },
            { value: 'expert', label: '专家 - 3个目标格' }
        ];
        const rv = ui.roundSelect ? Number(ui.roundSelect.value || 8) : 8;
        const dv = ui.difficultySelect ? ui.difficultySelect.value : 'easy';
        ui.currentRoundIndex      = Math.max(0, ui.roundOptions.findIndex(o => o.value === rv));
        ui.currentDifficultyIndex = Math.max(0, ui.difficultyOptions.findIndex(o => o.value === dv));
        this.bindStepperButtons();
        this.refreshStartSelectorDisplay();
        this.syncStartSelectionState();
    }

    bindStepperButtons() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        bind('round-prev',     () => this.stepRound(-1));
        bind('round-next',     () => this.stepRound(1));
        bind('difficulty-prev',() => this.stepDifficulty(-1));
        bind('difficulty-next',() => this.stepDifficulty(1));
    }

    stepRound(dir) {
        const ui = this.ui;
        if (ui.selectedMode === 'campaign') return;
        const len = ui.roundOptions.length;
        ui.currentRoundIndex = ((ui.currentRoundIndex ?? 0) + dir + len) % len;
        if (ui.roundSelect) ui.roundSelect.value = String(ui.roundOptions[ui.currentRoundIndex].value);
        this.playSelectorChangeFeedback(ui.roundStepper || ui.roundValue);
        this.refreshStartSelectorDisplay();
        this.syncStartSelectionState();
    }

    stepDifficulty(dir) {
        const ui = this.ui;
        if (ui.selectedMode === 'campaign') return;
        const len = ui.difficultyOptions.length;
        ui.currentDifficultyIndex = ((ui.currentDifficultyIndex ?? 0) + dir + len) % len;
        const val = ui.difficultyOptions[ui.currentDifficultyIndex].value;
        if (ui.difficultySelect) { ui.difficultySelect.value = val; ui.difficultySelect.dispatchEvent(new Event('change', { bubbles: true })); }
        this.playSelectorChangeFeedback(ui.difficultyStepper || ui.difficultyValue);
        this.refreshStartSelectorDisplay();
        this.updateDifficultyHint();
        this.syncStartSelectionState();
    }

    playSelectorChangeFeedback(host) {
        if (window.audioManager) window.audioManager.playClick();
        if (!host) return;
        host.classList.remove('selector-change');
        void host.offsetWidth;
        host.classList.add('selector-change');
        clearTimeout(this.ui._selectorChangeTimeout);
        this.ui._selectorChangeTimeout = setTimeout(() => host.classList.remove('selector-change'), 220);
    }

    refreshStartSelectorDisplay() {
        const ui = this.ui;
        if (ui.roundValue && ui.roundOptions?.length) {
            const o = ui.roundOptions[Math.min(ui.roundOptions.length-1, Math.max(0, ui.currentRoundIndex||0))];
            ui.roundValue.textContent = o.label;
            ui.roundValue.dataset.value = String(o.value);
            ui.roundValue.style.color = this.getRoundColor(o.value);
            this.applyStepperColors('round', o.value);
        }
        if (ui.difficultyValue && ui.difficultyOptions?.length) {
            const o = ui.difficultyOptions[Math.min(ui.difficultyOptions.length-1, Math.max(0, ui.currentDifficultyIndex||0))];
            ui.difficultyValue.textContent = o.label;
            ui.difficultyValue.dataset.value = o.value;
            ui.difficultyValue.style.color = this.getDifficultyColor(o.value);
            this.applyStepperColors('difficulty', o.value);
        }
        if (ui.difficultyHint) ui.difficultyHint.textContent = '';
        this.applyStartModeLayout();
    }

    syncStartSelectionState() { this.syncModeButtonsFromDifficulty(); this.refreshStartSelectorDisplay(); this.applyStartModeLayout(); }

    syncModeButtonsFromDifficulty() {
        const ui = this.ui;
        if (!ui.modeLocalBtn) return;
        ['local','ai','campaign','test'].forEach(m => ui['mode'+m[0].toUpperCase()+m.slice(1)+'Btn']?.classList.toggle('active', ui.selectedMode===m));
        if (ui.modeEditorBtn) ui.modeEditorBtn.classList.toggle('active', ui.selectedMode==='editor');
        if (ui.modeRandomBtn) ui.modeRandomBtn.classList.toggle('active', ui.selectedMode==='random');
        if (ui.modeP2PBtn)    ui.modeP2PBtn.classList.toggle('active',    ui.selectedMode==='p2p');
        const isMore = ['p2p','random','editor'].includes(ui.selectedMode);
        if (ui.modeMoreBtn) ui.modeMoreBtn.classList.toggle('active', isMore);
        if (ui.modeAiBtn) { ui.modeAiBtn.disabled=false; ui.modeAiBtn.style.opacity='1'; ui.modeAiBtn.style.cursor='pointer'; }
        const lock = ['campaign','test','editor','random'].includes(ui.selectedMode);
        this.setStartSelectorsEnabled(!lock);
        [ui.roundStepper, ui.difficultyStepper].forEach(el => el?.classList.toggle('disabled', lock));
    }

    applyStartModeLayout() {
        const layout=document.querySelector('.start-settings-layout'), left=document.querySelector('.start-modes-left'), right=document.querySelector('.start-selectors-right');
        if (!layout||!left||!right) return;
        const narrow = window.innerWidth < 720;
        layout.style.flexDirection = narrow?'column':'row';
        left.style.flexBasis = narrow?'auto':'170px';
        right.style.flexBasis = narrow?'auto':'1';
    }

    setStartSelectorsEnabled(enabled) {
        const ui = this.ui;
        [ui.roundStepper, ui.difficultyStepper, ui.roundValue, ui.difficultyValue].forEach(el => {
            if (!el) return;
            el.style.pointerEvents = enabled?'':'none';
            el.style.opacity = enabled?'':'0.55';
        });
        if (ui.roundSelect) ui.roundSelect.disabled = !enabled;
        if (ui.difficultySelect) ui.difficultySelect.disabled = !enabled;
    }

    applyStepperColors(kind, value) {
        const prev=document.getElementById(kind==='round'?'round-prev':'difficulty-prev'), next=document.getElementById(kind==='round'?'round-next':'difficulty-next');
        const valueEl=kind==='round'?this.ui.roundValue:this.ui.difficultyValue;
        const themes = { round:{ 8:{bg:'rgba(96,165,250,0.12)',fg:'#7a9bb5',sh:'rgba(96,165,250,0.10)'}, 12:{bg:'rgba(52,211,153,0.12)',fg:'#6b9f8e',sh:'rgba(52,211,153,0.10)'}, 16:{bg:'rgba(251,191,36,0.12)',fg:'#b8944a',sh:'rgba(251,191,36,0.10)'}, 20:{bg:'rgba(249,115,22,0.12)',fg:'#b87a4e',sh:'rgba(249,115,22,0.10)'}, 24:{bg:'rgba(244,63,94,0.12)',fg:'#b06e6e',sh:'rgba(244,63,94,0.10)'} }, difficulty:{ easy:{bg:'rgba(34,197,94,0.12)',fg:'#6b9f6e',sh:'rgba(34,197,94,0.10)'}, normal:{bg:'rgba(59,130,246,0.12)',fg:'#6b84a8',sh:'rgba(59,130,246,0.10)'}, expert:{bg:'rgba(245,158,11,0.12)',fg:'#b8944a',sh:'rgba(245,158,11,0.10)'}, test:{bg:'rgba(168,85,247,0.12)',fg:'#8b7bb0',sh:'rgba(168,85,247,0.10)'} } };
        const t=themes[kind]?.[value]||{bg:'rgba(255,255,255,0.12)',fg:'#e5e7eb',sh:'rgba(255,255,255,0.12)'};
        [prev,next].forEach(b=>{ if(!b)return; b.style.background=t.bg; b.style.color=t.fg; b.style.boxShadow=`0 0 14px ${t.sh}`; });
        if(valueEl){valueEl.style.color=t.fg;valueEl.style.borderColor=t.fg;valueEl.style.boxShadow=`0 0 18px ${t.sh}`;}
    }

    getRoundColor(v)      { return {8:'#7a9bb5',12:'#6b9f8e',16:'#b8944a',20:'#b87a4e',24:'#b06e6e'}[v]||'#b0bdd0'; }
    getDifficultyColor(v) { return {easy:'#6b9f6e',normal:'#6b84a8',expert:'#b8944a',test:'#8b7bb0'}[v]||'#b0bdd0'; }

    selectMode(mode) {
        const ui = this.ui;
        if (window.audioManager) { if(window.audioManager.audioCtx?.state==='suspended')window.audioManager.audioCtx.resume(); window.audioManager.playClick(); window.audioManager.startBgm(); }
        ui.selectedMode = mode;
        if (mode !== 'p2p') ui._cleanupP2P?.();
        const isMore = ['p2p','random','editor'].includes(mode);
        if (ui.modeMoreSubmenu) ui.modeMoreSubmenu.style.display = isMore?'block':'none';
        if (ui.modeMoreBtn) ui.modeMoreBtn.textContent = isMore?'更多模式 ▾':'更多模式 ▸';
        const hints = { local:'本地对战：两位玩家轮流操作', ai:'人机对战：你将对抗AI Summa', campaign:'闯关模式：通关解锁下一关', test:'测试模式：自由绘图，已绘制函数会保留在画布上', editor:'关卡编辑器：创建并导出自定义关卡', random:'随机关卡：挑战随机生成或导入种子的关卡', p2p:'联机对战：输入相同房间码匹配对手' };
        if (ui.modeHint) ui.modeHint.textContent = hints[mode] || '';
        if (ui.campaignPanel) ui.campaignPanel.style.display = 'none';
        if (ui.difficultyHint) ui.difficultyHint.style.display = 'none';
        this.syncStartSelectionState();
        this.refreshStartSelectorDisplay();
        ui.updateCampaignDrawDelayToggleVisibility?.();
        if (mode !== 'campaign') ui.restoreBattleUI?.();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StartMenuView;
}
