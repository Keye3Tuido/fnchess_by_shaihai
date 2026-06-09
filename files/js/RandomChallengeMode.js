/**
 * RandomChallengeMode - 随机关卡模式
 * 支持随机生成关卡或导入种子关卡
 */
class RandomChallengeMode {
    constructor(gameController, uiController, gridSystem) {
        this.gameController = gameController;
        this.uiController = uiController;
        this.gridSystem = gridSystem;
        this.crypto = new SeedCrypto();

        this.isActive = false;
        this.currentLevel = null;
        this.originalTokens = 0;
    }

    activate() {
        this.isActive = true;
        this._showModeSelection();
    }

    deactivate() {
        this.isActive = false;
        this.currentLevel = null;
        this.originalTokens = 0;
        // 解锁地图大小
        this.gridSystem.isCampaignFixedRange = false;
        if (this.uiController.confirmBtn) {
            this.uiController.confirmBtn.textContent = '确认目标';
        }
    }

    handleResult(data) {
        if (data.pass) {
            this.handleWin();
        } else {
            setTimeout(() => {
                this.uiController.clearExpression();
                this.gameController.setPhase(this.gameController.phases.INPUT_FUNCTION);
            }, 900);
        }
    }

    _showModeSelection() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>随机关卡</h2>
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
                    <button id="random-new-btn" class="btn btn-primary">随机生成关卡</button>
                    <button id="random-import-btn" class="btn">导入种子关卡</button>
                    <button id="random-back-btn" class="btn btn-secondary">返回</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#random-new-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this._startRandomLevel();
        });

        modal.querySelector('#random-import-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this._showImportDialog();
        });

        modal.querySelector('#random-back-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.deactivate();
            this.uiController.selectMode('local');
            this.uiController.showModal(this.uiController.startModal);
        });
    }

    _generateRandomLevel() {
        const mapSize = 10;
        const targetCount = Math.floor(Math.random() * 20) + 1;
        const forbiddenCount = Math.floor(Math.random() * 11);

        const usedCells = new Set();
        const targetCells = [];
        const forbiddenCells = [];

        while (targetCells.length < targetCount) {
            const x = Math.floor(Math.random() * mapSize) - Math.floor(mapSize / 2);
            const y = Math.floor(Math.random() * mapSize) - Math.floor(mapSize / 2);
            const key = `${x},${y}`;
            if (!usedCells.has(key)) {
                usedCells.add(key);
                targetCells.push({ x, y });
            }
        }

        while (forbiddenCells.length < forbiddenCount) {
            const x = Math.floor(Math.random() * mapSize) - Math.floor(mapSize / 2);
            const y = Math.floor(Math.random() * mapSize) - Math.floor(mapSize / 2);
            const key = `${x},${y}`;
            if (!usedCells.has(key)) {
                usedCells.add(key);
                forbiddenCells.push({ x, y, type: Math.random() < 0.5 ? 1 : 2 });
            }
        }

        const lockableElements = ['ln', 'sin', 'tan', 'sqrt', 'abs', '!', '+', '-', '*', '/', '^', '.'];
        const lockedElements = lockableElements.filter(() => Math.random() < 0.3);

        return {
            mapSize,
            targetCells,
            forbiddenCells,
            lockedElements,
            solutionTokens: 0
        };
    }

    _startRandomLevel() {
        this.currentLevel = this._generateRandomLevel();
        this.originalTokens = 0;
        this._loadLevel(this.currentLevel);
    }

    _showImportDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>导入种子</h2>
                <textarea id="random-seed-input" style="width: 100%; height: 100px; margin: 10px 0;"></textarea>
                <div id="random-seed-info" style="margin: 10px 0; color: #666;"></div>
                <div style="display: flex; gap: 10px;">
                    <button id="random-import-confirm-btn" class="btn btn-primary">导入</button>
                    <button id="random-import-cancel-btn" class="btn btn-secondary">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#random-seed-input');
        const info = modal.querySelector('#random-seed-info');

        input.addEventListener('input', () => {
            try {
                const seed = input.value.trim();
                if (!seed) {
                    info.textContent = '';
                    return;
                }
                const data = this.crypto.decrypt(seed);
                info.textContent = `目标格: ${data.targetCells.length}, 禁止格: ${data.forbiddenCells.length}, Token: ${data.solutionTokens || 0}`;
            } catch (e) {
                info.textContent = '无效种子';
            }
        });

        modal.querySelector('#random-import-confirm-btn').addEventListener('click', () => {
            try {
                const seed = input.value.trim();
                const data = this.crypto.decrypt(seed);
                document.body.removeChild(modal);
                this.currentLevel = data;
                this.originalTokens = data.solutionTokens || 0;
                this._loadLevel(data);
            } catch (e) {
                alert('导入失败: ' + e.message);
            }
        });

        modal.querySelector('#random-import-cancel-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this._showModeSelection();
        });
    }

    _loadLevel(levelData) {
        this.gridSystem.gridSize = levelData.mapSize;
        this.gridSystem.range = levelData.mapSize / 2;
        this.gridSystem.resize();

        // 锁定地图大小（禁用缩放）
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
            this.uiController.exitBtn.textContent = '退出随机关卡';
        }

        // 隐藏并禁用缩放控件
        const zoomControls = document.getElementById('zoom-controls');
        if (zoomControls) {
            zoomControls.style.display = 'none';
        }
        this.uiController.lockZoomButtons();

        this.uiController.updateLockedElements();
        this.uiController.phaseHintElement.textContent = '输入函数表达式';
        this.uiController.initDraggableElements();
        this.uiController.updateCampaignDrawDelayToggleVisibility();

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

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>🎉 通关成功！</h2>
                <p>Token 使用: ${currentTokens}</p>
                ${improved ? '<p style="color: #4CAF50;">✨ 新记录！</p>' : ''}
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
                    <button id="random-new-level-btn" class="btn btn-primary">新的随机关卡</button>
                    <button id="random-retry-btn" class="btn">重试当前关卡</button>
                    <button id="random-copy-seed-btn" class="btn">📋 复制关卡种子</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#random-new-level-btn').onclick = () => {
            document.body.removeChild(modal);
            this._startRandomLevel();
        };

        modal.querySelector('#random-retry-btn').onclick = () => {
            document.body.removeChild(modal);
            this._loadLevel(this.currentLevel);
        };

        modal.querySelector('#random-copy-seed-btn').onclick = () => {
            this._copySeedWithTokens();
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
            const seed = this.crypto.encrypt(seedData);
            navigator.clipboard.writeText(seed).then(() => {
                alert(`种子已复制 (Token: ${seedData.solutionTokens})`);
            });
        } catch (e) {
            alert('复制失败: ' + e.message);
        }
    }
}
