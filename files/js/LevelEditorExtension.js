/**
 * LevelEditorExtension - 关卡编辑器扩展
 * 编辑模式：只编辑格子和锁定元素，隐藏函数输入UI
 * 验证模式：difficulty改为'easy'，设置好roundState，走renderAndEvaluate真实碰撞检测
 */
class LevelEditorExtension {
    constructor(gameController, uiController, gridSystem) {
        this.gameController = gameController;
        this.uiController = uiController;
        this.gridSystem = gridSystem;
        this.crypto = new SeedCrypto();

        this.isActive = false;
        this.editMode = 'edit'; // 'edit' | 'verify'
        this.targetCells = [];
        this.forbiddenCells = [];
        this.lockedElements = [];
        this.solutionVerified = false;
        this.solutionTokens = 0;

        this._canvasBindDone = false;
        this._evalIntercepted = false;
    }

    activate() {
        this.isActive = true;
        this.editMode = 'edit';
        this.targetCells = [];
        this.forbiddenCells = [];
        this.lockedElements = [];
        this.solutionVerified = false;
        this.solutionTokens = 0;

        this.gameController.initGame(1, 'test', 'test');

        setTimeout(() => {
            this._buildEditorUI();
            this._bindCanvasEvents();
            this.switchToEditMode();
        }, 150);
    }

    handleResult(data) {
        if (data.pass) {
            this.solutionTokens = this._countTokens(this.uiController.currentExpression || '');
            this.solutionVerified = true;
            setTimeout(() => { this._resetToInputPhase(); this._showSeedDialog(); }, 0);
        } else {
            setTimeout(() => this._resetToInputPhase(true), 0);
        }
    }

    _buildEditorUI() {
        if (document.getElementById('editor-mode-switcher')) return;
        const phaseCard = document.getElementById('phase-hint')?.closest('.panel-card');
        if (!phaseCard) return;
        const div = document.createElement('div');
        div.id = 'editor-mode-switcher';
        div.className = 'panel-card';
        div.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <button class="btn btn-primary" id="editor-edit-btn">编辑模式</button>
                <button class="btn" id="editor-verify-btn">验证模式</button>
            </div>
            <div id="editor-hint" style="font-size:13px;line-height:1.7;padding:8px;background:rgba(15,23,42,0.5);border-radius:6px;"></div>
            <div id="editor-edit-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-small" id="editor-clear-cells-btn">清除所有格子</button>
                <button class="btn btn-secondary btn-small" id="editor-import-btn">导入种子</button>
                <button class="btn btn-exit btn-small" id="editor-exit-btn">退出编辑器</button>
            </div>`;
        phaseCard.parentNode.insertBefore(div, phaseCard);
        document.getElementById('editor-edit-btn').addEventListener('click', () => this.switchToEditMode());
        document.getElementById('editor-verify-btn').addEventListener('click', () => this.switchToVerifyMode());
        document.getElementById('editor-clear-cells-btn').addEventListener('click', () => {
            this.targetCells = []; this.forbiddenCells = [];
            this.solutionVerified = false;
            this._refreshGrid(); this._refreshHint();
        });
        document.getElementById('editor-import-btn').addEventListener('click', () => this._showImportDialog());
        document.getElementById('editor-exit-btn').addEventListener('click', () => this.uiController.handleExitClick());
    }

    _bindCanvasEvents() {
        if (this._canvasBindDone) return;
        this._canvasBindDone = true;
        const canvas = this.gridSystem.canvas;
        let dragButton = -1;
        let dragging = false;
        let startX = 0, startY = 0;

        const getCell = (e) => {
            const rect = canvas.getBoundingClientRect();
            return this.gridSystem.getCellFromCanvas(
                (e.clientX - rect.left) * (canvas.width / rect.width),
                (e.clientY - rect.top)  * (canvas.height / rect.height)
            );
        };

        // 创建坐标提示元素
        let coordHint = document.getElementById('editor-coord-hint');
        if (!coordHint) {
            coordHint = document.createElement('div');
            coordHint.id = 'editor-coord-hint';
            coordHint.style.cssText = 'position:fixed;padding:4px 8px;background:rgba(0,0,0,0.8);color:#fff;font-size:12px;border-radius:4px;pointer-events:none;display:none;z-index:1000;';
            document.body.appendChild(coordHint);
        }
        this._coordHint = coordHint;

        canvas.addEventListener('mousedown', (e) => {
            if (!this.isActive || this.editMode !== 'edit') return;
            e.preventDefault();
            dragButton = e.button;
            dragging = false;
            startX = e.clientX; startY = e.clientY;
        });
        canvas.addEventListener('mousemove', (e) => {
            // 显示坐标提示
            if (this.isActive && this.editMode === 'edit') {
                const cell = getCell(e);
                if (cell) {
                    this._coordHint.textContent = `(${cell.x}, ${cell.y})`;
                    this._coordHint.style.left = (e.clientX + 15) + 'px';
                    this._coordHint.style.top = (e.clientY + 15) + 'px';
                    this._coordHint.style.display = 'block';
                } else {
                    this._coordHint.style.display = 'none';
                }
            }

            // 拖动涂抹逻辑
            if (dragButton < 0 || !this.isActive || this.editMode !== 'edit') return;
            if (!dragging && (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4)) {
                dragging = true;
            }
            if (!dragging) return;
            const cell = getCell(e);
            if (!cell) return;
            if (dragButton === 0) this._setTarget(cell);
            else if (dragButton === 2) this._setForbidden(cell);
            else if (dragButton === 1) this._removeCell(cell);
            this._refreshGrid(); this._refreshHint();
        });
        canvas.addEventListener('mouseup', (e) => {
            if (!dragging && dragButton >= 0 && this.isActive && this.editMode === 'edit') {
                const cell = getCell(e);
                if (cell) {
                    if (dragButton === 0) this._toggleTarget(cell);
                    else if (dragButton === 2) this._toggleForbidden(cell);
                    else if (dragButton === 1) this._removeCell(cell);
                    this._refreshGrid(); this._refreshHint();
                }
            }
            dragButton = -1; dragging = false;
        });
        canvas.addEventListener('mouseleave', () => {
            dragButton = -1;
            dragging = false;
            if (this._coordHint) this._coordHint.style.display = 'none';
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    // 拖动时"涂抹"模式：只添加，不切换
    _setTarget(cell) {
        if (this.forbiddenCells.some(c => c.x === cell.x && c.y === cell.y)) return;
        if (!this.targetCells.some(c => c.x === cell.x && c.y === cell.y))
            this.targetCells.push(cell);
        this.solutionVerified = false;
    }

    _setForbidden(cell) {
        if (this.targetCells.some(c => c.x === cell.x && c.y === cell.y)) return;
        if (!this.forbiddenCells.some(c => c.x === cell.x && c.y === cell.y))
            this.forbiddenCells.push(cell);
        this.solutionVerified = false;
    }

    _toggleTarget(cell) {
        if (this.forbiddenCells.some(c => c.x === cell.x && c.y === cell.y)) {
            this.forbiddenCells = this.forbiddenCells.filter(c => !(c.x === cell.x && c.y === cell.y));
            this.targetCells.push(cell);
            this.solutionVerified = false;
            return;
        }
        const idx = this.targetCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx >= 0) this.targetCells.splice(idx, 1); else this.targetCells.push(cell);
        this.solutionVerified = false;
    }

    _toggleForbidden(cell) {
        if (this.targetCells.some(c => c.x === cell.x && c.y === cell.y)) {
            this.targetCells = this.targetCells.filter(c => !(c.x === cell.x && c.y === cell.y));
            this.forbiddenCells.push(cell);
            this.solutionVerified = false;
            return;
        }
        const idx = this.forbiddenCells.findIndex(c => c.x === cell.x && c.y === cell.y);
        if (idx >= 0) this.forbiddenCells.splice(idx, 1); else this.forbiddenCells.push(cell);
        this.solutionVerified = false;
    }

    _removeCell(cell) {
        this.targetCells    = this.targetCells.filter(c => !(c.x === cell.x && c.y === cell.y));
        this.forbiddenCells = this.forbiddenCells.filter(c => !(c.x === cell.x && c.y === cell.y));
        this.solutionVerified = false;
    }

    _refreshGrid() {
        this.gridSystem.setTargetCells(this.targetCells);
        this.gridSystem.forbiddenCells = [...this.forbiddenCells];
        this.gridSystem.draw();
    }

    switchToEditMode() {
        this.editMode = 'edit';
        document.getElementById('editor-edit-btn')?.classList.add('btn-primary');
        document.getElementById('editor-verify-btn')?.classList.remove('btn-primary');
        const editActions = document.getElementById('editor-edit-actions');
        if (editActions) editActions.style.display = 'flex';

        this.gameController.difficulty = 'test';
        this.gameController.campaignState = { active: false };
        this.gameController.currentPhase = this.gameController.phases.INPUT_FUNCTION;

        // 隐藏函数输入UI，但单独显示元素面板用于编辑锁定
        this._setInputUIVisible(false);
        const elems = document.getElementById('elements-container');
        if (elems) elems.style.display = 'flex';

        this.uiController.parser.lockedElements = [];
        this._renderLockEditor();

        this._refreshGrid(); this._refreshHint();
        this.uiController.showMessage('编辑模式：左键=目标格，右键=禁止格，中键=清除');
        if (this.uiController.exitBtn) this.uiController.exitBtn.textContent = '退出编辑器';
        this.uiController.updateCampaignDrawDelayToggleVisibility();

        // 重置缩放到默认值
        this.gridSystem.range = this.gridSystem.gridSize / 2;
        this.gridSystem.resize();

        // 解锁地图大小（编辑模式允许缩放）
        this.gridSystem.isCampaignFixedRange = false;

        // 显示并添加缩放功能
        const existingZoom = document.getElementById('zoom-controls');
        if (existingZoom) existingZoom.style.display = '';
        this.uiController.addZoomButtons();
        this.uiController.addWheelZoomSupport();
        this.uiController.unlockZoomButtons();

        // 更新缩放显示
        this.uiController.updateZoomDisplay(this.gridSystem.range);
    }

    switchToVerifyMode() {
        if (this.targetCells.length === 0) { alert('请先添加至少一个目标格'); return; }

        // 校验 lockedElements 合法性
        const validation = RandomChallengeMode.validateLockedElements(this.lockedElements);
        if (!validation.valid) {
            alert('禁用列表不合法: ' + validation.reason);
            return;
        }

        this.editMode = 'verify';
        document.getElementById('editor-edit-btn')?.classList.remove('btn-primary');
        document.getElementById('editor-verify-btn')?.classList.add('btn-primary');
        const editActions = document.getElementById('editor-edit-actions');
        if (editActions) editActions.style.display = 'none';

        // 显示函数输入UI
        this._setInputUIVisible(true);

        this.gameController.difficulty = 'easy';
        this.gameController.campaignState = {
            active: true,
            isEditorVerify: true,
            levelPack: { levels: [] },
            totalLevels: 1,
            currentLevelId: 0
        };
        this.gameController.targetCount = this.targetCells.length;
        this.gameController.currentPhase = this.gameController.phases.INPUT_FUNCTION;
        this.gameController.roundState.targetCells    = [...this.targetCells];
        this.gameController.roundState.forbiddenCells = [...this.forbiddenCells];
        this.gameController.roundState.lockedElements = [...this.lockedElements];

        this.uiController.parser.lockedElements = [...this.lockedElements];
        this.uiController.initDraggableElements();
        this.uiController.clearExpression();

        // 锁定地图大小（验证模式禁用缩放）
        this.gridSystem.isCampaignFixedRange = true;
        this.gridSystem.fixedCampaignRange = this.gridSystem.range;

        // 隐藏并禁用缩放控件
        const zoomControls = document.getElementById('zoom-controls');
        if (zoomControls) zoomControls.style.display = 'none';
        this.uiController.lockZoomButtons();

        this._refreshGrid(); this._refreshHint();
        if (this.uiController.exitBtn) this.uiController.exitBtn.textContent = '退出编辑器';
        this.uiController.showMessage('验证模式：构建函数表达式，提交后判定是否通关');
        this.uiController.updateCampaignDrawDelayToggleVisibility();
    }

    _setInputUIVisible(v) {
        const exprCard = document.getElementById('expression-display')?.closest('.panel-card');
        const btnCard  = document.getElementById('confirm-btn')?.closest('.panel-card');
        const elems    = document.getElementById('elements-container');
        if (exprCard) exprCard.style.display = v ? '' : 'none';
        if (btnCard)  btnCard.style.display  = v ? '' : 'none';
        if (elems)    elems.style.display    = v ? 'flex' : 'none';
    }

    _renderLockEditor() {
        const container = document.getElementById('elements-container');
        if (!container) return;
        const elements = this.uiController.parser.getAvailableElements();
        const categories = [
            { key: 'variable', label: '变量' },
            { key: 'numbers', label: '数字' },
            { key: 'basicOperators', label: '四则运算' },
            { key: 'operators', label: '其他运算符' },
            { key: 'functions', label: '函数' }
        ];
        container.innerHTML = '';
        for (const cat of categories) {
            const catDiv = document.createElement('div');
            catDiv.className = 'element-category';
            const label = document.createElement('div');
            label.className = 'category-label';
            label.textContent = cat.label;
            catDiv.appendChild(label);
            const itemsDiv = document.createElement('div');
            itemsDiv.className = 'element-items';
            for (const item of elements[cat.key]) {
                const btn = document.createElement('button');
                const isLocked = this.lockedElements.includes(item.value);
                btn.className = 'element-btn' + (isLocked ? ' locked' : '');
                btn.textContent = this.uiController.getDisplaySymbol(item.value);
                if (isLocked) btn.innerHTML += ' <span class="lock-icon">🔒</span>';
                btn.title = isLocked ? '点击解锁' : '点击禁用';
                btn.addEventListener('click', () => {
                    // 括号不可禁用
                    if (item.value === '(' || item.value === ')') {
                        alert('括号不能被禁用');
                        return;
                    }
                    const allNumbers = ['0','1','2','3','4','5','6','7','8','9','π','e','i'];
                    const idx = this.lockedElements.indexOf(item.value);
                    if (idx >= 0) {
                        this.lockedElements.splice(idx, 1);
                    } else {
                        // 互斥检查：x 被锁时数字不能全锁；数字全锁时 x 不能被锁
                        if (item.value === 'x') {
                            const allNumsLocked = allNumbers.every(n => this.lockedElements.includes(n));
                            if (allNumsLocked) { alert('数字已全被禁用，x 不能再被禁用'); return; }
                        } else if (allNumbers.includes(item.value)) {
                            const xLocked = this.lockedElements.includes('x');
                            const otherNumsLocked = allNumbers.filter(n => n !== item.value).every(n => this.lockedElements.includes(n));
                            if (xLocked && otherNumsLocked) { alert('x 已被禁用，数字不能全被禁用'); return; }
                        }
                        this.lockedElements.push(item.value);
                    }
                    this._renderLockEditor();
                });
                itemsDiv.appendChild(btn);
            }
            catDiv.appendChild(itemsDiv);
            container.appendChild(catDiv);
        }
    }


    _resetToInputPhase(keepExpression = false) {
        this.gameController.resetRoundState();
        this.gameController.roundState.targetCells    = [...this.targetCells];
        this.gameController.roundState.forbiddenCells = [...this.forbiddenCells];
        this.gameController.roundState.lockedElements = [...this.lockedElements];
        this.gameController.currentPhase = this.gameController.phases.INPUT_FUNCTION;
        this.uiController.updatePhaseUI(this.gameController.phases.INPUT_FUNCTION);
        // this.uiController.clearExpression(); // 验证失败后不再自动清空输入，由 keepExpression 参数控制
        if (!keepExpression) {
            this.uiController.clearExpression();
        }
        this.gridSystem.clearAll();
        this._refreshGrid();
    }

    _countTokens(expr) {
        try {
            return this.uiController.parser.tokenize(expr)
                .filter(t => !['lparen','rparen','imult'].includes(t.type)).length;
        } catch { return 0; }
    }

    _refreshHint() {
        const hint = document.getElementById('editor-hint');
        if (!hint) return;
        if (this.editMode === 'edit') {
            hint.innerHTML = `<b>棋盘操作：</b><br>
                左键：添加/删除目标格 🟩（覆盖禁止格）<br>
                右键：添加/删除禁止格 🟥（覆盖目标格）<br>
                中键：删除格子<br>
                <span style="opacity:.7;">目标格 <b>${this.targetCells.length}</b> 个，禁止格 <b>${this.forbiddenCells.length}</b> 个</span>`;
        } else {
            hint.innerHTML = `<b>验证模式：</b>构建函数通关<br>
                <span style="opacity:.7;">目标格 ${this.targetCells.length} 个，禁止格 ${this.forbiddenCells.length} 个<br>通关后自动弹出种子</span>`;
        }
    }

    _showSeedDialog() {
        const seed = this.crypto.encrypt({
            targetCells: this.targetCells, forbiddenCells: this.forbiddenCells,
            lockedElements: this.lockedElements, solutionTokens: this.solutionTokens,
            mapSize: this.gridSystem.gridSize
        });
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `<div class="modal-content">
            <h2>✅ 关卡验证通过！</h2>
            <p>目标格 ${this.targetCells.length} | 禁止格 ${this.forbiddenCells.length} | 禁用：${this.lockedElements.join(',')||'无'}</p>
            <p>答案复杂度：${this.solutionTokens} tokens</p>
            <hr style="margin:12px 0;border:1px solid rgba(255,255,255,.2);">
            <textarea readonly style="width:100%;height:80px;font-family:monospace;font-size:11px;
                padding:6px;background:rgba(0,0,0,.4);color:#e5e7eb;
                border:1px solid rgba(255,255,255,.2);border-radius:4px;resize:none;">${seed}</textarea>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn btn-primary" id="seed-copy-btn">复制种子</button>
                <button class="btn btn-secondary" id="seed-close-btn">关闭</button>
            </div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#seed-copy-btn').onclick = () =>
            navigator.clipboard.writeText(seed).then(() => alert('已复制！'));
        modal.querySelector('#seed-close-btn').onclick = () => modal.remove();
    }

    deactivate() {
        this.isActive = false;
        document.getElementById('editor-mode-switcher')?.remove();
        this._setInputUIVisible(true);
        // 恢复正常游戏状态
        this.gameController.campaignState = { active: false, levelPack: null, totalLevels: 0, currentLevelId: 1 };
        this.gameController.difficulty = 'normal';
        // 解锁地图大小
        this.gridSystem.isCampaignFixedRange = false;
        // 恢复原始的 UIController 事件监听器
        if (this._originalCampaignResultCallback) {
            this.gameController.callbacks['campaignLevelResult'] = this._originalCampaignResultCallback;
            this._originalCampaignResultCallback = null;
        }
        this._evalIntercepted = false;
    }

    _showImportDialog() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `<div class="modal-content">
            <h2>导入关卡种子</h2>
            <textarea id="seed-import-input" placeholder="粘贴种子..."
                style="width:100%;height:100px;font-family:monospace;font-size:11px;
                padding:6px;background:rgba(0,0,0,.4);color:#e5e7eb;
                border:1px solid rgba(255,255,255,.2);border-radius:4px;resize:none;"></textarea>
            <div style="display:flex;gap:10px;margin-top:12px;">
                <button class="btn btn-primary" id="import-confirm-btn">导入</button>
                <button class="btn btn-secondary" id="import-cancel-btn">取消</button>
            </div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('#import-confirm-btn').onclick = () => {
            try {
                const d = this.crypto.decrypt(modal.querySelector('#seed-import-input').value.trim());
                if (!d.mapSize || typeof d.mapSize !== 'number' || d.mapSize < 10) {
                    throw new Error('种子格式不正确');
                }
                // 校验 lockedElements 合法性
                const validation = RandomChallengeMode.validateLockedElements(d.lockedElements);
                if (!validation.valid) {
                    alert('种子不合法: ' + validation.reason);
                    return;
                }
                this.targetCells    = d.targetCells;
                this.forbiddenCells = d.forbiddenCells;
                this.lockedElements = d.lockedElements;
                this.solutionTokens = d.solutionTokens;
                // 恢复地图大小
                this.gridSystem.gridSize = d.mapSize;
                this.gridSystem.range = d.mapSize / 2;
                this.gridSystem.resize();
                modal.remove();
                this.switchToEditMode();
                // 更新缩放显示
                this.uiController.updateZoomDisplay(this.gridSystem.range);
                alert('导入成功！');
            } catch (e) { alert('导入失败'); }
        };
        modal.querySelector('#import-cancel-btn').onclick = () => modal.remove();
    }
}

