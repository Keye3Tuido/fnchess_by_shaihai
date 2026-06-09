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
        // 解锁地图大小
        this.gridSystem.isCampaignFixedRange = false;
        // 恢复原始的闯关固定范围
        this.gridSystem.fixedCampaignRange = this._originalFixedCampaignRange;
        // 清理最佳记录显示
        const display = document.getElementById('random-best-record');
        if (display) display.remove();
        // 清理游戏内按钮
        const buttons = document.getElementById('random-ingame-buttons');
        if (buttons) buttons.remove();
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
        const N = mapSize * mapSize; // 总格子数
        const toDistribute = Math.floor((N - 1) / 2); // 只分配一半

        // 随机分三份：a+1目标格，b禁止格，c空格
        const rand1 = Math.random();
        const rand2 = Math.random();
        const splits = [rand1, rand2].sort((x, y) => x - y);

        const a = Math.floor(splits[0] * toDistribute);
        const b = Math.floor((splits[1] - splits[0]) * toDistribute);
        // c = toDistribute - a - b (空格，不使用)

        const targetCount = a + 1; // 至少1个目标格
        const forbiddenCount = b;

        // 计算密度：(目标+禁止) / 总数
        const density = (targetCount + forbiddenCount) / N;

        // 难度越高（密度越大），禁用组数期望越少
        // 密度低（简单棋盘）→ 多禁用来平衡；密度高（困难棋盘）→ 少禁用给玩家留工具
        let groupCountDist; // 0~4 组的概率分布
        if (density < 0.15) {
            groupCountDist = [0.05, 0.15, 0.25, 0.30, 0.25]; // 期望 ≈ 2.55
        } else if (density < 0.30) {
            groupCountDist = [0.20, 0.25, 0.25, 0.20, 0.10]; // 期望 ≈ 1.75
        } else {
            groupCountDist = [0.35, 0.30, 0.20, 0.10, 0.05]; // 期望 ≈ 1.20
        }

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

        // ========== 分组权重禁用系统 ==========
        // x 概率最低；0~9 次之；其余各组概率均等
        // 括号不考虑（不在任何分组中）
        const lockGroups = [
            { elements: ['x'],                         weight: 0.03 },  // 最低
            { elements: ['0','1','2','3','4','5','6','7','8','9'], weight: 0.10 },  // 次低
            { elements: ['+', '-'],                    weight: 1.00 },
            { elements: ['*', '/'],                    weight: 1.00 },
            { elements: ['^', 'sqrt', 'abs'],          weight: 1.00 },
            { elements: ['ln'],                        weight: 1.00 },
            { elements: ['sin'],                       weight: 1.00 },
            { elements: ['cos'],                       weight: 1.00 },
            { elements: ['tan'],                       weight: 1.00 },
            { elements: ['!'],                         weight: 1.00 },
            { elements: ['.'],                         weight: 1.00 },
            { elements: ['π'],                         weight: 1.00 },
            { elements: ['e'],                         weight: 1.00 },
            { elements: ['i'],                         weight: 1.00 },
        ];

        // 按分布随机抽取禁用组数（0~4）
        const numGroups = this._weightedRandomIndex(groupCountDist);

        // 加权无放回抽取分组
        const selectedGroups = this._weightedRandomSelect(lockGroups, numGroups);

        // 整组禁用
        let lockedElements = [];
        for (const g of selectedGroups) {
            lockedElements.push(...g.elements);
        }

        // 兜底：x 和常数(0-9) 不能全锁
        const xGroup = lockGroups[0];
        const digitsGroup = lockGroups[1];
        if (selectedGroups.includes(xGroup) && selectedGroups.includes(digitsGroup)) {
            // 随机保留一组
            if (Math.random() < 0.5) {
                lockedElements = lockedElements.filter(e => !digitsGroup.elements.includes(e));
            } else {
                lockedElements = lockedElements.filter(e => e !== 'x');
            }
        }

        // 安全过滤：括号绝不出现在禁用列表
        lockedElements = lockedElements.filter(e => e !== '(' && e !== ')');

        return {
            mapSize,
            targetCells,
            forbiddenCells,
            lockedElements,
            solutionTokens: 0
        };
    }

    _startRandomLevel() {
        this.isImportMode = false;
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
                    info.style.color = '#666';
                    return;
                }
                const data = this.crypto.decrypt(seed);
                const validation = RandomChallengeMode.validateLockedElements(data.lockedElements);
                let status = `目标格: ${data.targetCells.length}, 禁止格: ${data.forbiddenCells.length}, Token: ${data.solutionTokens || 0}`;
                if (!validation.valid) {
                    status += `\n⚠️ ${validation.reason}`;
                    info.style.color = '#ef4444';
                } else {
                    info.style.color = '#666';
                }
                info.textContent = status;
            } catch (e) {
                info.textContent = '无效种子';
                info.style.color = '#666';
            }
        });

        modal.querySelector('#random-import-confirm-btn').addEventListener('click', () => {
            try {
                const seed = input.value.trim();
                const data = this.crypto.decrypt(seed);
                const validation = RandomChallengeMode.validateLockedElements(data.lockedElements);
                if (!validation.valid) {
                    alert('种子不合法: ' + validation.reason);
                    return;
                }
                document.body.removeChild(modal);
                this.isImportMode = true;
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
            this.uiController.exitBtn.textContent = '退出关卡';
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

        // 添加最佳记录显示
        this._createBestRecordDisplay();
        this._updateBestRecordDisplay();

        // 添加游戏内操作按钮
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

        // 更新最佳记录显示
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

    _createBestRecordDisplay() {
        // 移除旧的显示
        const old = document.getElementById('random-best-record');
        if (old) old.remove();

        // 创建新的显示
        const display = document.createElement('div');
        display.id = 'random-best-record';
        display.style.cssText = 'margin-bottom: 8px; padding: 8px; background: rgba(100, 181, 246, 0.15); border-radius: 6px; font-size: 14px; color: #64b5f6;';

        const phaseHint = document.getElementById('phase-hint');
        if (phaseHint && phaseHint.parentElement) {
            phaseHint.parentElement.insertBefore(display, phaseHint);
        }
    }

    _createInGameButtons() {
        // 移除旧的按钮
        const old = document.getElementById('random-ingame-buttons');
        if (old) old.remove();

        // 创建按钮容器
        const container = document.createElement('div');
        container.id = 'random-ingame-buttons';
        container.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

        const buttonText = this.isImportMode ? '📥 导入种子' : '🎲 新关卡';
        container.innerHTML = `
            <button id="random-copy-seed-ingame-btn" class="btn btn-secondary btn-small">📋 复制种子</button>
            <button id="random-new-ingame-btn" class="btn btn-secondary btn-small">${buttonText}</button>
        `;

        // 插入到phase-hint下方
        const phaseHint = document.getElementById('phase-hint');
        if (phaseHint && phaseHint.parentElement) {
            phaseHint.parentElement.insertBefore(container, phaseHint.nextSibling);
        }

        // 绑定事件
        document.getElementById('random-copy-seed-ingame-btn').onclick = () => {
            this._copySeedWithTokens();
        };

        document.getElementById('random-new-ingame-btn').onclick = () => {
            if (this.isImportMode) {
                this._showImportDialog();
            } else {
                this._startRandomLevel();
            }
        };
    }

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

    /**
     * 按权重分布随机抽取一个索引（0 ~ weights.length-1）
     */
    _weightedRandomIndex(weights) {
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    /**
     * 加权随机无放回抽取 num 个分组
     */
    _weightedRandomSelect(groups, num) {
        if (num <= 0) return [];
        if (num >= groups.length) return [...groups];

        const remaining = groups.map((g, i) => ({ ...g, idx: i }));
        const selected = [];

        for (let k = 0; k < num; k++) {
            const totalWeight = remaining.reduce((sum, g) => sum + g.weight, 0);
            if (totalWeight <= 0) break;

            let r = Math.random() * totalWeight;
            let pickedIdx = 0;
            for (let i = 0; i < remaining.length; i++) {
                r -= remaining[i].weight;
                if (r <= 0) { pickedIdx = i; break; }
            }

            selected.push(remaining[pickedIdx]);
            remaining.splice(pickedIdx, 1);
        }

        return selected;
    }

    /**
     * 校验 lockedElements 合法性（静态方法，供编辑器等外部调用）
     * 规则：括号不可禁用；x 和常数(0-9) 不可同时全锁
     * @returns {{ valid: boolean, reason?: string }}
     */
    static validateLockedElements(lockedElements) {
        if (!lockedElements || !Array.isArray(lockedElements)) {
            return { valid: false, reason: '数据格式错误' };
        }

        // 括号不可禁用
        if (lockedElements.includes('(') || lockedElements.includes(')')) {
            return { valid: false, reason: '括号不能被禁用' };
        }

        // x 和常数(0-9) 不能全锁
        const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const xLocked = lockedElements.includes('x');
        const allDigitsLocked = digits.every(d => lockedElements.includes(d));

        if (xLocked && allDigitsLocked) {
            return { valid: false, reason: 'x 和常数(0-9) 不能同时全部禁用' };
        }

        return { valid: true };
    }
}
