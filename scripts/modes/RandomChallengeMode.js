/**
 * RandomChallengeMode - 随机关卡模式
 * 职责：协调随机生成器和种子导入器，管理关卡状态
 */
class RandomChallengeMode {
    constructor(gameController, uiController, gridSystem) {
        this.gameController = gameController;
        this.uiController = uiController;
        this.gridSystem = gridSystem;
        this.crypto = new SeedCrypto();
        this.randomChallengeUI = new RandomChallengeUI(this);
        this.levelGenerator = new RandomLevelGenerator();
        this.seedImporter = new SeedImporter(
            this.crypto,
            (data) => this._onImportSuccess(data),
            () => this._showModeSelection()
        );

        this.isActive = false;
        this.currentLevel = null;
        this.originalTokens = 0;
        this.isImportMode = false;
    }

    activate() {
        this.isActive = true;
        this._originalFixedCampaignRange = this.gridSystem.fixedCampaignRange;
        this._showModeSelection();
    }

    deactivate() {
        this.isActive = false;
        this.currentLevel = null;
        this.originalTokens = 0;
        this.isImportMode = false;
        
        this.gridSystem.isCampaignFixedRange = false;
        
        this.gridSystem.fixedCampaignRange = this._originalFixedCampaignRange;
        
        const display = document.getElementById('random-best-record');
        if (display) display.remove();
        
        const buttons = document.getElementById('random-ingame-buttons');
        if (buttons) buttons.remove();
        const zoomControls = document.getElementById('zoom-controls');
        if (zoomControls) zoomControls.style.display = '';
        if (this.uiController.confirmBtn) {
            this.uiController.confirmBtn.textContent = '确认目标';
        }
    }

    handleResult(data) {
        if (data.pass) {
            this.handleWin();
        } else {
            setTimeout(() => {
                
                this.gameController.setPhase(this.gameController.phases.INPUT_FUNCTION);
            }, 900);
        }
    }

    _showModeSelection(...args) { return this.randomChallengeUI._showModeSelection(...args); }

    _startRandomLevel() {
        this.isImportMode = false;
        this.currentLevel = this.levelGenerator.generate();
        this.originalTokens = 0;
        this._loadLevel(this.currentLevel);
    }

    _showImportDialog() {
        this.seedImporter.showDialog();
    }

    _onImportSuccess(data) {
        this.isImportMode = true;
        this.currentLevel = data;
        this.originalTokens = data.solutionTokens || 0;
        this._loadLevel(data);
    }

    _loadLevel(levelData) {
        this.gridSystem.gridSize = levelData.mapSize;
        this.gridSystem.range = levelData.mapSize / 2;
        this.gridSystem.resize();

        
        this.gridSystem.isCampaignFixedRange = true;
        this.gridSystem.fixedCampaignRange = this.gridSystem.range;

        this.gameController.initGame(1, 'test', 'test');

        this.gameController.difficulty = 'easy';
        this.gameController.campaignState = {
            active: true,
            isRandomChallenge: true,
            levelPack: null,
            totalLevels: 1,
            currentLevelId: 999
        };

        this.gameController.targetCount = levelData.targetCells.length;
        this.gameController.currentPhase = this.gameController.phases.INPUT_FUNCTION;
        this.gameController.roundState.targetCells = [...levelData.targetCells];
        this.gameController.roundState.forbiddenCells = [...levelData.forbiddenCells];
        this.gameController.roundState.lockedElements = [...levelData.lockedElements];

        this.gridSystem.setTargetCells(levelData.targetCells);
        this.gridSystem.forbiddenCells = [...levelData.forbiddenCells];

        this.uiController.parser.lockedElements = [...levelData.lockedElements];
        this.uiController.hideBattleUI();
        this.uiController.confirmBtn.textContent = '提交答案';
        if (this.uiController.exitBtn) {
            this.uiController.exitBtn.textContent = '退出关卡';
        }

        
        const zoomControls = document.getElementById('zoom-controls');
        if (zoomControls) {
            zoomControls.style.display = 'none';
        }
        this.uiController.lockZoomButtons();

        this.uiController.updateLockedElements();
        this.uiController.phaseHintElement.textContent = '输入函数表达式';
        this.uiController.initDraggableElements();
        this.uiController.updateCampaignDrawDelayToggleVisibility();

        
        this._createBestRecordDisplay();
        this._updateBestRecordDisplay();

        
        this._createInGameButtons();

        setTimeout(() => {
            this.uiController.showMessage('随机关卡：构造函数通关');
        }, 100);

        this.gridSystem.draw();
    }

    handleWin() {
        if (!this.isActive) return;

        const currentTokens = this.uiController.getCurrentExpressionLength();
        const improved = this.originalTokens === 0 || currentTokens < this.originalTokens;

        if (improved) {
            this.originalTokens = currentTokens;
        }

        
        this._updateBestRecordDisplay();

        const newLevelBtnText = this.isImportMode ? '导入新的种子' : '新的随机关卡';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🎉 通关成功！</h2>
                <p>Token 使用: ${currentTokens}</p>
                ${improved ? '<p style="color: #4CAF50;">✨ 新记录！</p>' : ''}
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
                    <button id="random-new-level-btn" class="btn btn-primary">${newLevelBtnText}</button>
                    <button id="random-retry-btn" class="btn">重试当前关卡</button>
                    <button id="random-copy-seed-btn" class="btn">📋 复制关卡种子</button>
                    <button id="random-home-btn" class="btn btn-secondary">返回主界面</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#random-new-level-btn').onclick = () => {
            document.body.removeChild(modal);
            if (this.isImportMode) {
                this._showImportDialog();
            } else {
                this._startRandomLevel();
            }
        };

        modal.querySelector('#random-retry-btn').onclick = () => {
            document.body.removeChild(modal);
            this._loadLevel(this.currentLevel);
        };

        modal.querySelector('#random-copy-seed-btn').onclick = () => {
            this._copySeedWithTokens();
        };

        modal.querySelector('#random-home-btn').onclick = () => {
            document.body.removeChild(modal);
            this.deactivate();
            this.uiController.selectMode('local');
            this.uiController.showModal(this.uiController.startModal);
        };
    }

    _copySeedWithTokens() {
        const seedData = {
            mapSize: this.currentLevel.mapSize,
            targetCells: this.currentLevel.targetCells,
            forbiddenCells: this.currentLevel.forbiddenCells,
            lockedElements: this.currentLevel.lockedElements,
            solutionTokens: this.originalTokens
        };

        try {
            const seed = this.crypto.encrypt(seedData, { allowZeroToken: true });
            navigator.clipboard.writeText(seed).then(() => {
                alert(`种子已复制 (Token: ${seedData.solutionTokens})`);
            });
        } catch (e) {
            alert('复制失败: ' + e.message);
        }
    }

    _createBestRecordDisplay(...args) { return this.randomChallengeUI._createBestRecordDisplay(...args); }

    _createInGameButtons(...args) { return this.randomChallengeUI._createInGameButtons(...args); }

    _updateBestRecordDisplay() {
        const display = document.getElementById('random-best-record');
        if (!display) return;

        if (this.originalTokens > 0) {
            display.textContent = `最佳记录: ${this.originalTokens} Token`;
            display.style.display = 'block';
        } else {
            display.textContent = '最佳记录: 暂无';
            display.style.display = 'block';
        }
    }

    static validateLockedElements(lockedElements) {
        return SeedImporter.validateLockedElements(lockedElements);
    }
}
