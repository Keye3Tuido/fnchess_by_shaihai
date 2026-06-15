class CampaignView {
    constructor(ui) { this.ui=ui; this.storage=new CampaignStorage(ui); }

    getCampaignDrawDelaySetting(...args) { return this.storage.getCampaignDrawDelaySetting(...args); }
    setCampaignDrawDelaySetting(...args) { return this.storage.setCampaignDrawDelaySetting(...args); }
    updateCampaignDrawDelayToggle() {
        const wrap=document.getElementById('campaign-draw-delay-toggle'); if(!wrap)return;
        wrap.querySelectorAll('.campaign-delay-btn').forEach(btn=>{
            const active=Number(btn.dataset.delay)===this.ui.campaignDrawDelay;
            btn.style.background=active?'#4d8c5e':'rgba(255,255,255,0.12)';
            btn.style.color=active?'#fff':'#e5e7eb';
            btn.style.boxShadow=active?'0 0 0 1px rgba(255,255,255,0.18) inset':'none';
        });
    }
    addCampaignDrawDelayToggle() {
        if(document.getElementById('campaign-draw-delay-toggle'))return;
        const host=this.ui.confirmBtn?.parentElement; if(!host)return;
        const wrap=document.createElement('div');
        wrap.id='campaign-draw-delay-toggle';
        wrap.style.cssText='display:none;align-items:center;gap:4px;margin-left:8px;padding:2px 4px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);user-select:none';
        wrap.innerHTML='<span style="font-size:11px;color:#e5e7eb;opacity:.85;">延迟</span><button class="campaign-delay-btn" data-delay="0">0s</button><button class="campaign-delay-btn" data-delay="1000">1s</button><button class="campaign-delay-btn" data-delay="5000">5s</button>';
        wrap.querySelectorAll('.campaign-delay-btn').forEach(btn=>{
            btn.style.cssText='min-width:30px;height:22px;padding:0 6px;border-radius:999px;border:none;font-size:11px;cursor:pointer';
            btn.addEventListener('click',()=>{if(window.audioManager)window.audioManager.playClick();this.setCampaignDrawDelaySetting(btn.dataset.delay);});
        });
        host.appendChild(wrap);
        this.updateCampaignDrawDelayToggle();
    }
    updateCampaignDrawDelayToggleVisibility() {
        const wrap=document.getElementById('campaign-draw-delay-toggle'); if(!wrap)return;
        const ui=this.ui;
        const show=ui.gameController?.gameMode==='campaign'||(ui.levelEditor?.isActive&&ui.levelEditor.editMode==='verify')||ui.randomChallenge?.isActive;
        wrap.style.display=show?'inline-flex':'none';
    }
    refreshUnsovableDifficultyVisibility() {
        const grid=document.getElementById('campaign-difficulty-grid'), btn=document.getElementById('campaign-diff-unsolvable');
        if(!grid||!btn)return;
        const cleared=this.ui.getCampaignClearedMax?.()??0, show=cleared>=81;
        btn.style.display=show?'':'none';
        grid.style.gridTemplateColumns=show?'repeat(5, minmax(0, 1fr))':'repeat(4, minmax(0, 1fr))';
    }
    openCampaignLevels(diff) {
        const ui=this.ui; ui.campaignDifficulty=diff;
        if(ui.campaignStepDifficulty)ui.campaignStepDifficulty.style.display='none';
        if(ui.campaignStepLevels)ui.campaignStepLevels.style.display='block';
        ui.renderCampaignLevelGrid?.();
    }
    showCampaignDifficulty() {
        const ui=this.ui;
        if(ui.campaignStepLevels)ui.campaignStepLevels.style.display='none';
        if(ui.campaignStepDifficulty)ui.campaignStepDifficulty.style.display='block';
        const badge=document.getElementById('campaign-level-badge'); if(badge)badge.style.display='none';
        ui.campaignDifficulty=null;
        ui.updateCampaignGlobalProgressText?.();
    }
    openCampaignUI() {
        const ui=this.ui;
        ui.hideModal(ui.startModal,()=>ui.showModal(ui.campaignModal));
        this.showCampaignDifficulty();
        this.hideBattleUI();
        this.updateCampaignDrawDelayToggleVisibility();
        ui.loadCampaignPack?.().then(()=>ui.updateCampaignGlobalProgressText?.());
    }
    closeCampaignUI() {
        const ui=this.ui;
        ui.forceStopGame();
        ui.hideModal(ui.campaignModal,()=>ui.showModal(ui.startModal));
        ui.hideCampaignVictory?.();
        this.resetBattleGrid();
        this.restoreBattleUI();
        const badge=document.getElementById('campaign-level-badge'); if(badge)badge.style.display='none';
        ui.campaignDifficulty=null; ui.campaignCurrentLevelId=null; ui.campaignCurrentLevelBestRecord=null;
    }
    hideCampaignVictory() {
        if(this.ui.campaignVictoryModal)this.ui.hideModal(this.ui.campaignVictoryModal);
    }
    retryCampaignLevel() {
        const ui=this.ui; if(!ui.campaignPack)return;
        const id=Number(ui.campaignCurrentLevelId||ui.campaignVictoryModal?.dataset.levelId||1);
        this.hideCampaignVictory(); ui.startCampaign?.(id);
    }
    async goToNextCampaignLevel() {
        const ui=this.ui; if(!ui.campaignPack)return;
        const cur=Number(ui.campaignCurrentLevelId||ui.campaignVictoryModal?.dataset.levelId||1);
        const next=cur+1, total=Array.isArray(ui.campaignPack.levels)?ui.campaignPack.levels.length:0;
        this.hideCampaignVictory();
        if(next>total){ui.showMessage('✅ 已经是最后一关','success');this.openCampaignUI();return;}
        ui.startCampaign?.(next);
    }
    returnToCampaignLevelSelect() {
        const ui=this.ui;
        this.hideCampaignVictory();
        if(ui.campaignModal)ui.showModal(ui.campaignModal);
        this.showCampaignDifficulty();
        ui.refreshCampaignStartUI?.();
    }
    returnCampaignToDifficulty() {
        const ui=this.ui;
        ui.forceStopGame();
        this.hideCampaignVictory();
        this.resetBattleGrid();
        ui.gameController.resetGame();
        ui.campaignCurrentLevelId=null; ui.campaignCurrentLevelBestRecord=null;
        if(ui.campaignModal)ui.showModal(ui.campaignModal);
        this.showCampaignDifficulty();
        this.updateCampaignDrawDelayToggleVisibility();
        this.restoreBattleUI();
        const badge=document.getElementById('campaign-level-badge'); if(badge)badge.style.display='none';
    }
    hideBattleUI() {
        const ui=this.ui; ui.battleUiHidden=true;
        if(ui.header)ui.header.classList.add('campaign-mode');
        document.querySelectorAll('.score-display').forEach(el=>el.style.display='none');
        if(ui.currentPlayerElement?.parentElement)ui.currentPlayerElement.parentElement.style.display='none';
        if(ui.timerElement?.parentElement)ui.timerElement.parentElement.style.display='none';
        const rd=document.getElementById('round-display'); if(rd)rd.style.display='none';
    }
    restoreBattleUI() {
        const ui=this.ui; ui.battleUiHidden=false;
        this.updateCampaignDrawDelayToggleVisibility();
        if(ui.header)ui.header.classList.remove('campaign-mode');
        document.querySelectorAll('.score-display').forEach(el=>el.style.display='');
        if(ui.currentPlayerElement?.parentElement)ui.currentPlayerElement.parentElement.style.display='';
        if(ui.timerElement?.parentElement)ui.timerElement.parentElement.style.display='';
        const rd=document.getElementById('round-display'); if(rd)rd.style.display='';
        const badge=document.getElementById('campaign-level-badge'); if(badge)badge.style.display='none';
    }
    resetBattleGrid() {
        const gs=this.ui.gridSystem; if(!gs)return;
        gs.setCampaignFixedRange?.(false);
        gs.clearAll?.();
        gs.setRange?.(5);
        gs.draw?.();
    }

    async loadCampaignPack() {
        if (this.ui.campaignPack) return this.ui.campaignPack;
        this.ui.campaignPack = window.CAMPAIGN_LEVEL_PACK || null;
        return this.ui.campaignPack;
    }

    getCampaignClearedMax(...args) { return this.storage.getCampaignClearedMax(...args); }

    getCampaignCollectedStars(...args) { return this.storage.getCampaignCollectedStars(...args); }

    getCampaignLevelBestStars(...args) { return this.storage.getCampaignLevelBestStars(...args); }

    setCampaignLevelBestStars(...args) { return this.storage.setCampaignLevelBestStars(...args); }

    setCampaignCollectedStars(...args) { return this.storage.setCampaignCollectedStars(...args); }

    renderCampaignStarProgress(starCount) {
        if (!this.ui.campaignStarProgress) return;
        const totalSlots = 500;
        const filled = Math.max(0, Math.min(totalSlots, Number(starCount) || 0));
        const pct = Math.max(0, Math.min(100, (filled / totalSlots) * 100));
        const starSvg = `<svg class="star filled" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 14c3.1 0 5.6 1.6 6.9 4.3l11.3 22.9 25.3 3.7c3 .5 5.5 2.5 6.5 5.4 1 2.9.3 6-1.9 8.2L90 74.5l4.5 25.1c.5 3.1-.7 6.2-3.1 8-2.5 1.8-5.8 2.1-8.5.7L60 96.1 37.1 108.3c-2.7 1.4-6 .1-8.5-.7-2.4-1.8-3.6-4.9-3.1-8L30 74.5 12.9 54.5c-2.2-2.2-2.9-5.3-1.9-8.2 1-2.9 3.5-4.9 6.5-5.4l25.3-3.7L54.1 18.3C55.4 15.6 57.9 14 61 14Z"/></svg>`;
        this.ui.campaignStarProgress.innerHTML = `
            <div class="campaign-star-bar">
                <div class="campaign-star-bar-fill" style="width:${pct}%;"></div>
                <div class="campaign-star-bar-glow" style="width:${pct}%;"></div>
            </div>
            <span class="star-count">${filled}/${totalSlots}${starSvg}</span>
        `;
    }

    async refreshCampaignStartUI() {
        if (!this.ui.campaignLevelSelect || !this.ui.campaignProgressText) return;
        try {
            const pack = await this.ui.loadCampaignPack();
            if (!pack) throw new Error('no-pack');
            const total = Array.isArray(pack.levels) ? pack.levels.length : 0;
            const cleared = this.ui.getCampaignClearedMax();
            const unlockedMax = Math.min(total, cleared + 1);
            const stars = this.ui.getCampaignCollectedStars();
            this.ui.campaignProgressText.textContent = `已通关：${cleared} / ${total}`;
            this.ui.refreshUnsovableDifficultyVisibility();
            this.ui.updateCampaignGlobalProgressText(stars);

            const current = Number(this.ui.campaignLevelSelect.value || 1);
            this.ui.campaignLevelSelect.innerHTML = '';
            for (let i = 1; i <= total; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = i <= unlockedMax ? `关卡 ${i}` : `关卡 ${i}（未解锁）`;
                opt.disabled = i > unlockedMax;
                this.ui.campaignLevelSelect.appendChild(opt);
            }
            const fixed = Math.min(Math.max(1, current), unlockedMax || 1);
            this.ui.campaignLevelSelect.value = String(fixed);
        } catch (e) {
            this.ui.campaignProgressText.textContent = '关卡加载失败，请确认关卡数据已内置。';
        }
    }

    async startCampaign(startLevelId) {
        const pack = await this.ui.loadCampaignPack();
        if (!pack) {
            this.ui.showMessage('关卡未加载：请先加载内置关卡数据', 'error');
            this.ui.openCampaignUI();
            return;
        }
        const safeStart = Number(startLevelId) || 1;
        this.ui.campaignCurrentLevelId = safeStart;
        this.ui.campaignCurrentLevelBestRecord = this.ui.getCampaignLevelBestRecord(safeStart);
        this.ui._markGameActive();
        this.ui.gameController.initCampaign(pack, safeStart);
        if (this.ui.gridSystem && this.ui.gridSystem.setCampaignFixedRange) {
            this.ui.gridSystem.setCampaignFixedRange(true);
        }
    }

    showCampaignVictory(data) {
        if (!this.ui.campaignVictoryModal) return;
        this.ui.campaignCurrentLevelId = data.levelId || this.ui.campaignCurrentLevelId;
        const levelId = Number(this.ui.campaignCurrentLevelId || data.levelId || 1);
        const bestRecord = Number.isFinite(Number(this.ui.campaignCurrentLevelBestRecord)) ? Number(this.ui.campaignCurrentLevelBestRecord) : null;
        const length = Number.isFinite(Number(data.expressionLength)) ? Number(data.expressionLength) : this.ui.getCurrentExpressionLength();
        const levelText = `第 ${levelId} 关`;
        if (this.ui.campaignVictoryText) {
            if (bestRecord === null || !Number.isFinite(bestRecord)) {
                this.ui.campaignVictoryText.innerHTML = `${levelText} 记录：<span style="color:#fff">${length}</span>`;
            } else if (data.isNewRecord) {
                const previousBest = Number(data.previousBest);
                const diff = previousBest > 0 ? previousBest - length : null;
                this.ui.campaignVictoryText.innerHTML = Number.isFinite(diff)
                    ? `new record：${length} <span style="color:#22c55e;">（-${diff}）</span>`
                    : `new record：${length}`;
            } else {
                const diff = length - bestRecord;
                this.ui.campaignVictoryText.innerHTML = `best record：${bestRecord} &nbsp;&nbsp;&nbsp; score：${length} <span style="color:#ef4444;">(+${diff})</span>`;
            }
        }
        const starCount = Math.max(1, Math.min(5, Number(data.score) || 1));
        this.ui.renderCampaignVictoryStars(starCount);
        this.ui.campaignVictoryModal.dataset.levelId = String(levelId);
        this.ui.campaignVictoryModal.dataset.totalLevels = String(data.totalLevels || (this.ui.campaignPack && this.ui.campaignPack.levels ? this.ui.campaignPack.levels.length : 0));
        this.ui.campaignVictoryModal.dataset.difficulty = data.difficulty || this.ui.campaignDifficulty || '';
        this.ui.campaignVictoryModal.dataset.stars = String(starCount);
        this.ui.campaignVictoryModal.dataset.length = String(length);
        this.ui.showModal(this.ui.campaignVictoryModal);
    }

    getCampaignLevelBestRecord(...args) { return this.storage.getCampaignLevelBestRecord(...args); }

    setCampaignLevelBestRecord(...args) { return this.storage.setCampaignLevelBestRecord(...args); }

    renderCampaignVictoryStars(count) {
        if (!this.ui.campaignVictoryModal) return;
        let stars = this.ui.campaignVictoryModal.querySelector('.campaign-victory-stars');
        if (!stars) {
            stars = document.createElement('div');
            stars.className = 'campaign-victory-stars';
            this.ui.campaignVictoryModal.querySelector('.campaign-victory-content')?.insertBefore(stars, this.ui.campaignVictoryText || null);
        }
        const filled = Math.max(1, Math.min(5, count));
        stars.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 120 120');
            svg.setAttribute('aria-hidden', 'true');
            svg.classList.add('star');
            if (i <= filled) svg.classList.add('filled');
            svg.innerHTML = '<path d="M60 14c3.1 0 5.6 1.6 6.9 4.3l11.3 22.9 25.3 3.7c3 .5 5.5 2.5 6.5 5.4 1 2.9.3 6-1.9 8.2L90 74.5l4.5 25.1c.5 3.1-.7 6.2-3.1 8-2.5 1.8-5.8 2.1-8.5.7L60 96.1 37.1 108.3c-2.7 1.4-6 .1-8.5-.7-2.4-1.8-3.6-4.9-3.1-8L30 74.5 12.9 54.5c-2.2-2.2-2.9-5.3-1.9-8.2 1-2.9 3.5-4.9 6.5-5.4l25.3-3.7L54.1 18.3C55.4 15.6 57.9 14 61 14Z"/>';
            stars.appendChild(svg);
        }
    }

    updateCampaignGlobalProgressText(stars = null) {
        if (!this.ui.campaignGlobalProgress) return;
        const cleared = this.ui.getCampaignClearedMax();
        const total = this.ui.campaignPack && Array.isArray(this.ui.campaignPack.levels) ? this.ui.campaignPack.levels.length : 0;
        const visibleTotal = cleared >= 81 ? total : Math.min(total, 81);
        const starCount = stars === null ? this.ui.getCampaignCollectedStars() : stars;
        this.ui.campaignGlobalProgress.textContent = total > 0
            ? `已通关 ${cleared}/${visibleTotal}`
            : '未加载关卡：请导入 levels.json（本地打开HTML时浏览器可能拦截自动读取）';
        if (this.ui.campaignStarProgress) {
            this.ui.renderCampaignStarProgress(starCount);
        }
        // 更新LRΣ显示
        this.ui.updateCampaignLRSigmaDisplay(cleared);
    }

    calculateLRSigma(...args) { return this.storage.calculateLRSigma(...args); }

    updateCampaignLRSigmaDisplay(cleared = null) {
        const container = document.getElementById('campaign-lrsigma-container');
        const display = document.getElementById('campaign-lrsigma-display');
        if (!container || !display) return;
        
        if (cleared === null) {
            cleared = this.ui.getCampaignClearedMax();
        }
        
        if (cleared <= 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'flex';
        const lrSigma = this.ui.calculateLRSigma(cleared);
        // 显示格式：LRΣ = 整数部分大，小数部分靠上与整数底部齐平，精确到6位小数
        const intPart = Math.floor(lrSigma);
        const decPart = (lrSigma - intPart).toFixed(6).substring(1); // 去掉前导0
        display.innerHTML = `<span class="lrsigma-label">LRΣ =</span> <span class="lrsigma-int">${intPart}</span><span class="lrsigma-dec">${decPart}</span>`;
    }

    async resetCampaignProgress() {
        try {
            const firstConfirm = await this.ui.showGameDialog({
                title: '重置闯关进度',
                message: '你确定要重置所有闯关进度吗？\n此操作会清空已解锁关卡、星星和最佳记录。',
                options: [
                    { label: '取消', value: false },
                    { label: '重置', value: true }
                ],
                showSkip: false
            });
            if (!firstConfirm) return;

            // 等待 200ms 间隙，让第一次弹窗退场动画完成
            await new Promise(r => setTimeout(r, 200));

            const secondConfirm = await this.ui.showGameDialog({
                title: '再次确认',
                message: '请再次确认：重置后将无法恢复已保存的闯关数据。\n真的要继续吗？',
                options: [
                    { label: '取消', value: false },
                    { label: '确认重置', value: true }
                ],
                showSkip: false
            });
            if (!secondConfirm) return;

            localStorage.removeItem('function_chess_campaign_cleared');
            localStorage.removeItem('function_chess_campaign_stars');
            for (let i = 1; i <= 90; i++) {
                localStorage.removeItem(`function_chess_campaign_best_${i}`);
                localStorage.removeItem(`function_chess_campaign_best_stars_${i}`);
            }
            this.ui.campaignCurrentLevelBestRecord = null;
            this.ui.showMessage('✅ 闯关进度已重置', 'success');
            this.ui.updateCampaignGlobalProgressText(0);
            this.ui.refreshUnsovableDifficultyVisibility();
        } catch (e) {
            this.ui.showMessage('❌ 重置失败', 'error');
        }
    }

    getDifficultyRange(...args) { return this.storage.getDifficultyRange(...args); }

    updateCampaignLevelBadge(levelId = null, totalLevels = null, difficulty = null) {
        const badge = document.getElementById('campaign-level-badge');
        const value = document.getElementById('campaign-level-value');
        if (!badge || !value) return;

        const diff = difficulty || this.ui.campaignDifficulty;
        if (!diff) {
            badge.style.display = 'none';
            return;
        }

        const range = this.ui.getDifficultyRange(diff);
        const currentLevelId = Number(levelId ?? this.ui.campaignCurrentLevelId ?? range.start);
        const bestRecord = this.ui.getCampaignLevelBestRecord(currentLevelId);

        // 根据关卡号确定颜色，而不是根据 difficulty
        let color, bgColor, borderColor;
        if (currentLevelId >= 82) { // 无解（82-90）
            color = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.15)';
            borderColor = 'rgba(239, 68, 68, 0.5)';
        } else if (currentLevelId >= 70) { // 专家（70-81）
            color = '#b87a4e';
            bgColor = 'rgba(249, 115, 22, 0.10)';
            borderColor = 'rgba(249, 115, 22, 0.3)';
        } else if (currentLevelId >= 54) { // 困难（54-69）
            color = '#b8944a';
            bgColor = 'rgba(234, 179, 8, 0.10)';
            borderColor = 'rgba(234, 179, 8, 0.3)';
        } else if (currentLevelId >= 30) { // 普通（30-53）
            color = '#7a9e3a';
            bgColor = 'rgba(132, 204, 22, 0.10)';
            borderColor = 'rgba(132, 204, 22, 0.3)';
        } else { // 简单（1-29）
            color = '#5b9e6e';
            bgColor = 'rgba(34, 197, 94, 0.10)';
            borderColor = 'rgba(34, 197, 94, 0.3)';
        }

        badge.className = `campaign-level-badge`;
        value.style.setProperty('color', color, 'important');
        badge.style.setProperty('color', color, 'important');
        badge.style.setProperty('border-color', borderColor, 'important');
        badge.style.setProperty('background', bgColor, 'important');
        if (bestRecord !== null && Number.isFinite(bestRecord)) {
            value.textContent = `Lv. ${currentLevelId} (best record:${bestRecord})`;
        } else {
            value.textContent = `Lv. ${currentLevelId}`;
        }
        badge.style.display = 'inline-flex';
    }

    renderCampaignLevelGrid() {
        if (!this.ui.campaignLevelGrid || !this.ui.campaignLevelTitle || !this.ui.campaignLevelProgress) return;
        const range = this.ui.getDifficultyRange(this.ui.campaignDifficulty);
        this.ui.campaignLevelTitle.textContent = `选择关卡：${range.label}`;

        const cleared = this.ui.getCampaignClearedMax();
        const total = this.ui.campaignPack && Array.isArray(this.ui.campaignPack.levels) ? this.ui.campaignPack.levels.length : 0;
        const unlockedMax = Math.min(total, cleared + 1);
        this.ui.campaignLevelProgress.textContent = `已通关 ${cleared}/${total}，当前可进入 ≤ ${unlockedMax}`;

        this.ui.campaignLevelGrid.innerHTML = '';
        for (let id = range.start; id <= range.end; id++) {
            const cell = document.createElement('div');
            cell.className = `campaign-level-cell ${range.cls}`;

            const locked = id > unlockedMax;
            if (locked) cell.classList.add('locked');
            if (id <= cleared) cell.classList.add('cleared');

            // 检查通关后获得的星星
            const stars = this.ui.getCampaignLevelBestStars(id);
            const hasStars = id <= cleared && stars > 0;

            // 创建星星显示区
            {
                const starsContainer = document.createElement('div');
                starsContainer.className = 'campaign-cell-stars';
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    star.setAttribute('viewBox', '0 0 120 120');
                    star.setAttribute('aria-hidden', 'true');
                    star.classList.add('star');
                    if (hasStars && i <= stars) star.classList.add('filled');
                    star.innerHTML = '<path d="M60 14c3.1 0 5.6 1.6 6.9 4.3l11.3 22.9 25.3 3.7c3 .5 5.5 2.5 6.5 5.4 1 2.9.3 6-1.9 8.2L90 74.5l4.5 25.1c.5 3.1-.7 6.2-3.1 8-2.5 1.8-5.8 2.1-8.5.7L60 96.1 37.1 108.3c-2.7 1.4-6 .1-8.5-.7-2.4-1.8-3.6-4.9-3.1-8L30 74.5 12.9 54.5c-2.2-2.2-2.9-5.3-1.9-8.2 1-2.9 3.5-4.9 6.5-5.4l25.3-3.7L54.1 18.3C55.4 15.6 57.9 14 61 14Z"/>';
                    starsContainer.appendChild(star);
                }
                cell.appendChild(starsContainer);
            }

            // 创建关卡数字
            const numberSpan = document.createElement('span');
            numberSpan.className = 'campaign-cell-number';
            numberSpan.textContent = String(id);
            cell.appendChild(numberSpan);

            cell.addEventListener('click', async () => {
                if (locked) return;
                if (window.audioManager) window.audioManager.playClick();
                // 进入游戏界面
                if (this.ui.campaignModal) this.ui.hideModal(this.ui.campaignModal);
                this.ui.startCampaign(id).catch(err => console.error('[Campaign] startCampaign failed:', err));
            });
            this.ui.campaignLevelGrid.appendChild(cell);
        }
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=CampaignView;
