/**
 * TestModeView — 测试模式视图
 * 层级：UI View（由 UIController 持有）
 * 职责：测试模式UI初始化、缩放控制、函数列表管理
 */
class TestModeView {
    /** @param {UIController} ui */
    constructor(ui) { this.ui = ui; }

    getTestModeColor() {
        const ui = this.ui;
        const colors = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7','#dfe6e9','#fd79a8','#a29bfe'];
        return colors[(ui.gameController.getTestModeFunctions().length) % colors.length];
    }

    initTestModeUI() {
        const ui = this.ui;
        if (ui.messagePanel) ui.messagePanel.classList.add('visible');
        if (ui.header) ui.header.classList.add('test-mode');
        document.querySelector('.canvas-section')?.classList.add('test-mode');
        const title = document.querySelector('.game-title');
        if (title) { title.textContent='测试模式'; title.style.cssText='color:#fff;position:absolute;left:20px;top:10px;margin:0;transform:none;'; }
        ui.timerElement.parentElement.style.display = 'none';
        ui.currentPlayerElement.parentElement.style.display = 'none';
        document.querySelectorAll('.score-display').forEach(el => el.style.display='none');
        const rd = document.getElementById('round-display'); if (rd) rd.style.display='none';
        ui.showMessage('测试模式：自由构造函数，点击函数表达式可编辑或删除');
        this.addFunctionListContainer();
        this.addZoomButtons();
        this.addWheelZoomSupport();
        if (ui.exitBtn) { ui.exitBtn.textContent='结束测试'; ui.exitBtn.className='btn btn-danger'; }
        ui.initDraggableElements();
    }

    addWheelZoomSupport() {
        const ui = this.ui;
        if (ui.wheelHandler) ui.gridSystem.canvas.removeEventListener('wheel', ui.wheelHandler);
        ui._wheelThrottled = false;
        if (ui._wheelTimer) { clearTimeout(ui._wheelTimer); ui._wheelTimer = null; }
        ui.wheelHandler = (e) => {
            e.preventDefault();
            if (!ui.gameController.isTestMode()) return;
            if (ui.renderer.isDrawing || ui._wheelThrottled) return;
            ui._wheelThrottled = true;
            setTimeout(() => { ui._wheelThrottled = false; }, 400);
            const newRange = this.adjustRange(e.deltaY > 0 ? 5 : -5);
            this.updateZoomDisplay(newRange);
            this.redrawAllTestFunctions();
        };
        ui.gridSystem.canvas.addEventListener('wheel', ui.wheelHandler, { passive: false });
    }

    adjustRange(step) {
        const gs = this.ui.gridSystem;
        if (gs.isCampaignFixedRange) return gs.range;
        const clamped = Math.max(gs.minRange, Math.min(gs.range + step, gs.maxRange));
        if (clamped !== gs.range) {
            gs.range = clamped; gs.gridSize = clamped * 2;
            requestAnimationFrame(() => gs.resize());
        }
        return gs.range;
    }

    addZoomButtons() {
        if (document.getElementById('zoom-controls')) return;
        const c = document.createElement('div'); c.id='zoom-controls'; c.className='zoom-controls';
        c.innerHTML = `<button id="zoom-out-btn" class="zoom-btn" title="+">+</button><span id="zoom-range" class="zoom-range">±${this.ui.gridSystem.range}</span><button id="zoom-in-btn" class="zoom-btn" title="−">−</button>`;
        document.querySelector('.canvas-section')?.appendChild(c);
        const ui = this.ui;
        document.getElementById('zoom-out-btn').addEventListener('click', () => { if(ui.renderer.isDrawing)return; this.updateZoomDisplay(this.adjustRange(5)); this.redrawAllTestFunctions(); });
        document.getElementById('zoom-in-btn').addEventListener('click', () => { if(ui.renderer.isDrawing)return; this.updateZoomDisplay(this.adjustRange(-5)); this.redrawAllTestFunctions(); });
    }

    updateZoomDisplay(range) { const d=document.getElementById('zoom-range'); if(d) d.textContent=`±${range}`; }
    lockZoomButtons()   { ['zoom-out-btn','zoom-in-btn'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=true; }); }
    unlockZoomButtons() { ['zoom-out-btn','zoom-in-btn'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=false; }); }

    addFunctionListContainer() {
        if (document.getElementById('function-list')) return;
        const c = document.createElement('div'); c.id='function-list'; c.className='function-list';
        c.innerHTML='<div class="function-list-title">已绘制函数（点击编辑或删除）</div>';
        const ba = this.ui.confirmBtn.parentElement;
        ba.parentElement.insertBefore(c, ba.nextSibling);
    }

    updateFunctionList() {
        const ui = this.ui;
        const c = document.getElementById('function-list'); if (!c) return;
        const title = c.querySelector('.function-list-title');
        c.innerHTML = ''; c.appendChild(title);
        ui.gameController.getTestModeFunctions().forEach((func, i) => {
            const item = document.createElement('div'); item.className='function-item'; item.style.borderLeftColor=func.color;
            item.innerHTML = `<span class="function-expr">${func.expression}</span><div class="function-actions"><button class="btn-edit" data-index="${i}" title="编辑">✎</button><button class="btn-delete" data-index="${i}" title="删除">✕</button></div>`;
            item.querySelector('.btn-edit').addEventListener('click', () => this.editTestFunction(i));
            item.querySelector('.btn-delete').addEventListener('click', () => this.deleteTestFunction(i));
            c.appendChild(item);
        });
    }

    editTestFunction(index) {
        const ui = this.ui;
        const func = ui.gameController.getTestModeFunctions()[index]; if (!func) return;
        ui.expressionElements = ui.tokenizeExpression(func.expression);
        ui.cursorIndex = ui.expressionElements.length;
        ui.updateExpressionDisplay();
        this.deleteTestFunction(index);
        ui.showMessage(`正在编辑: ${func.expression}`);
    }

    deleteTestFunction(index) {
        const ui = this.ui;
        ui.gameController.getTestModeFunctions().splice(index, 1);
        this.redrawAllTestFunctions();
        this.updateFunctionList();
        ui.showMessage('函数已删除');
    }

    async redrawAllTestFunctions() {
        const ui = this.ui;
        ui.renderer.cancelDrawing();
        await ui.prepareRenderCanvas();
        await new Promise(resolve => requestAnimationFrame(async () => {
            for (const func of ui.gameController.getTestModeFunctions()) {
                await ui.renderer.drawFunction(func.expression, false, func.color, true);
            }
            await ui.postRenderRefresh();
            resolve();
        }));
    }

    async renderTestModeFunction(expression) {
        // 防止重复提交
        if (this.ui.isRenderingTestFunction) {
            return;
        }
        this.ui.isRenderingTestFunction = true;

        // 锁定缩放按钮
        this.ui.lockZoomButtons();

        try {
            // 检查是否已存在相同的函数
            const existingFunctions = this.ui.gameController.getTestModeFunctions();
            if (existingFunctions.some(f => f.expression === expression)) {
                this.ui.showMessage('该函数已存在', 'error');
                this.ui.isRenderingTestFunction = false;
                this.ui.unlockZoomButtons();
                return;
            }

            await this.ui.prepareRenderCanvas();

            // 绘制函数（使用不同颜色，测试模式无光晕）
            const color = this.ui.getTestModeColor();
            const points = await this.ui.renderer.drawFunction(expression, true, color, true);

            if (points && points.length > 0) {
                // 保存函数
                this.ui.gameController.addTestModeFunction(expression, color);

                // 清空当前表达式
                this.ui.clearExpression();

                // 更新函数列表
                this.ui.updateFunctionList();

                // 重新绘制所有测试模式函数，避免新函数绘制时把旧函数覆盖掉
                await this.ui.redrawTestModeFunctions();

                // 渲染后再刷新一次，确保调试层/曲线层都稳定显示
                await this.ui.postRenderRefresh();

                this.ui.showMessage(`函数已绘制: ${expression}`, 'success');
            } else {
                this.ui.showMessage('函数绘制失败，请检查表达式', 'error');
            }
        } catch (error) {
            this.ui.showMessage('函数计算错误: ' + error.message, 'error');
        } finally {
            // 重置提交标志并解锁缩放按钮
            this.ui.isRenderingTestFunction = false;
            this.ui.unlockZoomButtons();
        }
    }

    async prepareRenderCanvas() {
        this.ui._renderTempState = null;
        if (this.ui.gridSystem && typeof this.ui.gridSystem.draw === 'function') {
            this.ui.gridSystem.draw(this.ui._buildSnapshot());
        }
    }

    async postRenderRefresh() {
        if (!this.ui.gridSystem) return;
        await new Promise(resolve => requestAnimationFrame(() => {
            // 仅等待下一帧，让浏览器完成本次绘制提交；不要再次清空画布，否则会把函数擦掉
            resolve();
        }));
    }

    async renderAndEvaluate(expression) {
        await this.ui.prepareRenderCanvas();

        // 1. 渲染用采样（标准精度）- 等待绘制完成
        await this.ui.renderer.drawFunction(expression, true);

        // 闯关模式或编辑器验证模式或随机关卡模式：图像绘制完成后额外延迟一小段时间再进行后续判定与反馈
        const isCampaignLike = (this.ui.gameController && this.ui.gameController.gameMode === 'campaign')
            || (this.ui.levelEditor?.isActive && this.ui.levelEditor.editMode === 'verify')
            || this.ui.randomChallenge?.isActive;
        if (isCampaignLike && this.ui.campaignDrawDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.ui.campaignDrawDelay));
        }

        // 渲染后再刷新一次画布显示，避免首次绘图时调试层/函数层未稳定
        await this.ui.postRenderRefresh();
        
        // 2. 碰撞检测用采样（高精度）
        const range = this.ui.gridSystem.getRange();
        const collisionPoints = this.ui.renderer.sampleFunction(expression, range.min, range.max, true);
        const polyline = this.ui.renderer.convertToPolyline(collisionPoints);
        
        // 获取目标网格和禁止区
        const state = this.ui.gameController.getGameState();
        const targetCells = state.roundState.targetCells;
        const forbiddenCells = state.roundState.forbiddenCells;
        
        // 碰撞检测 - 检测所有目标格（视觉检测）
        const hitTargets = [];
        for (const targetCell of targetCells) {
            if (this.ui.detector.checkHitTarget(polyline, targetCell, this.ui.gridSystem)) {
                hitTargets.push(targetCell);
            }
        }
        
        // 检测禁止区（视觉检测）
        let hitForbidden = false;
        if (forbiddenCells.length > 0) {
            hitForbidden = this.ui.detector.checkHitForbidden(polyline, forbiddenCells, this.ui.gridSystem);
        }
        
        // 分析函数类型
        const functionType = this.ui.parser.analyzeFunctionType(expression);
        
        // 评估结果
        this.ui.gameController.evaluateResult(hitTargets, hitForbidden, functionType);
    }

    exitTestMode() {
        // 隐藏消息面板
        if (this.ui.messagePanel) this.ui.messagePanel.classList.remove('visible');
        
        // 清空函数
        this.ui.gameController.clearTestModeFunctions();
        this.ui.gridSystem.clearAll();
        
        // 恢复 header 样式
        if (this.ui.header) this.ui.header.classList.remove('test-mode');
                
        // 移除 Canvas 容器的测试模式类
        const canvasSection = document.querySelector('.canvas-section');
        if (canvasSection) {
            canvasSection.classList.remove('test-mode');
        }
        
        // 恢复标题
        const gameTitle = document.querySelector('.game-title');
        if (gameTitle) {
            gameTitle.textContent = '函数棋';
            gameTitle.style.color = '';
            gameTitle.style.position = '';
            gameTitle.style.left = '';
            gameTitle.style.top = '';
            gameTitle.style.margin = '';
            gameTitle.style.transform = '';
        }
        
        // 恢复UI显示
        this.ui.timerElement.parentElement.style.display = '';
        this.ui.currentPlayerElement.parentElement.style.display = '';
        document.querySelectorAll('.score-display').forEach(el => {
            el.style.display = '';
        });
        const roundDisplay = document.getElementById('round-display');
        if (roundDisplay) roundDisplay.style.display = '';
        
        // 移除函数列表
        const functionList = document.getElementById('function-list');
        if (functionList) functionList.remove();
        
        // 移除缩放按钮
        const zoomControls = document.getElementById('zoom-controls');
        if (zoomControls) zoomControls.remove();
        
        // 移除滚轮事件监听
        if (this.ui.wheelHandler) {
            this.ui.gridSystem.canvas.removeEventListener('wheel', this.ui.wheelHandler);
            this.ui.wheelHandler = null;
        }
        
        // 恢复坐标系范围
        this.ui.gridSystem.setRange(5);
        
        // 恢复退出按钮样式和文本
        if (this.ui.exitBtn) {
            if (this.ui.gameController.gameMode === 'campaign') {
                this.ui.exitBtn.textContent = '返回难度';
                this.ui.exitBtn.className = 'btn btn-exit';
            } else {
                this.ui.exitBtn.textContent = '退出对局';
                this.ui.exitBtn.className = 'btn btn-exit';
            }
        }
        
        // 返回开始界面
        this.ui.showModal(this.ui.startModal);
        this.ui.showMessage('');
        this.ui.refreshStartSelectorDisplay();
    }

    async redrawTestModeFunctions() {
        if (!this.ui.gameController?.isTestMode()) return;
        if (!this.ui.gridSystem || !this.ui.renderer) return;

        const functions = this.ui.gameController.getTestModeFunctions();
        this.ui.gridSystem.draw();
        for (const func of functions) {
            await this.ui.renderer.drawFunction(func.expression, false, func.color);
        }
    }

    tokenizeExpression(expr) {
        const tokens = [];
        let i = 0;
        const len = expr.length;
        
        // 多字母函数名列表
        const multiCharFuncs = ['sin', 'cos', 'tan', 'abs', 'exp', 'ln', 'log', 'sqrt'];
        
        while (i < len) {
            let matched = false;
            
            // 尝试匹配多字母函数
            for (const func of multiCharFuncs) {
                if (expr.substring(i, i + func.length) === func) {
                    tokens.push(func);
                    i += func.length;
                    matched = true;
                    break;
                }
            }
            
            if (matched) continue;
            
            // 匹配单个字符（变量、数字、运算符、括号等）
            tokens.push(expr[i]);
            i++;
        }
        
        return tokens;
    }

    addClearFunctionsButton() {
        // 检查是否已存在
        if (document.getElementById('clear-functions-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'clear-functions-btn';
        btn.className = 'btn btn-secondary';
        btn.textContent = '清空所有函数';
        btn.addEventListener('click', () => {
            this.ui.gameController.clearTestModeFunctions();
            this.ui.gridSystem.clearAll();
            this.ui.showMessage('已清空所有函数');
        });
        
        // 插入到确认按钮之前
        this.ui.confirmBtn.parentElement.insertBefore(btn, this.ui.confirmBtn);
    }

    startLevelEditor() {
        // 初始化编辑器扩展（如果还没有）
        if (!this.ui.levelEditor) {
            this.ui.levelEditor = new LevelEditorExtension(
                this.ui.gameController,
                this.ui,
                this.ui.gridSystem
            );
        }

        // 激活编辑器
        this.ui.levelEditor.activate();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestModeView;
}
