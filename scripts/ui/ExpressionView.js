class ExpressionView {
    constructor(ui) { this.ui = ui; }

    initDraggableElements() {
        const ui = this.ui;
        const phase = ui.gameController.currentPhase;
        if (phase === 'set_locks') { this.initLockElementsView(); return; }
        const elements = ui.parser.getAvailableElements();
        const state = ui.gameController.getGameState();
        const locked = state.roundState.lockedElements || [];
        ui.elementsContainer.innerHTML = '';
        const cats = [
            { key:'variable',       label:'变量' },
            { key:'numbers',        label:'数字' },
            { key:'basicOperators', label:'四则运算' },
            { key:'operators',      label:'其他运算符' },
            { key:'functions',      label:'函数' }
        ];
        const fnNames = { sin:'sin', cos:'cos', tan:'tan', abs:'abs', exp:'exp', ln:'ln', log:'log' };
        for (const cat of cats) {
            const catDiv = document.createElement('div'); catDiv.className = 'element-category';
            const lbl = document.createElement('div'); lbl.className = 'category-label'; lbl.textContent = cat.label;
            catDiv.appendChild(lbl);
            const items = document.createElement('div'); items.className = 'element-items';
            for (const item of elements[cat.key]) {
                const btn = document.createElement('button'); btn.className = 'element-btn';
                const disp = cat.key==='functions'&&fnNames[item.value] ? fnNames[item.value] : ui.getDisplaySymbol(item.value);
                btn.textContent = disp; btn.dataset.value = item.value;
                if (locked.includes(item.value) || item.locked) {
                    btn.classList.add('locked'); btn.disabled = true;
                    btn.innerHTML = `${disp} <span class="lock-icon">🔒</span>`;
                    if (locked.includes(item.value)) btn.title = '本回合被锁定';
                } else {
                    btn.addEventListener('click', () => ui.addElementToExpression(item.value));
                }
                items.appendChild(btn);
            }
            catDiv.appendChild(items); ui.elementsContainer.appendChild(catDiv);
        }
    }

    initLockElementsView() {
        const ui = this.ui;
        const elements = ui.parser.getAvailableElements();
        const state = ui.gameController.getGameState();
        const locked = state.roundState.lockedElements;
        ui.elementsContainer.innerHTML = '';
        const title = document.createElement('div'); title.className = 'element-category'; title.style.width = '100%';
        const lbl = document.createElement('div'); lbl.className = 'category-label';
        lbl.textContent = `选择要锁定的元素 (${locked.length}/${state.maxLocks})`;
        title.appendChild(lbl);
        if (ui.phaseHintElement) {
            ui.phaseHintElement.textContent = state.difficulty==='easy'
                ? `点击下方元素锁定对方 (${locked.length}/${state.maxLocks})，四则运算无法被锁定`
                : `点击下方元素锁定对方 (${locked.length}/${state.maxLocks})`;
        }
        const items = document.createElement('div'); items.className = 'element-items';
        const fnNames = { sin:'sin', cos:'cos', tan:'tan', abs:'abs', exp:'exp', ln:'ln', log:'log' };
        const all = [
            ...elements.numbers.map(e=>e.value),
            ...elements.basicOperators.map(e=>e.value),
            ...elements.operators.filter(e=>e.value!=='x'&&e.value!=='('&&e.value!==')').map(e=>e.value),
            ...elements.functions.map(e=>e.value)
        ];
        for (const el of all) {
            const btn = document.createElement('button'); btn.className = 'element-btn';
            btn.textContent = fnNames[el] || ui.getDisplaySymbol(el); btn.dataset.value = el;
            const lockCount = state.getElementLockCount ? state.getElementLockCount(el) : 0;
            if (locked.includes(el)) { btn.classList.add('selected'); btn.style.background = 'rgba(239,68,68,0.5)'; }
            if (lockCount >= 2) { btn.classList.add('locked'); btn.disabled = true; btn.title = `${ui.getDisplaySymbol(el)} 已达到最大锁定次数 (2/2)`; }
            btn.addEventListener('mouseenter', e => { if (lockCount>0) this.showLockCountTooltip(e, el, lockCount); });
            btn.addEventListener('mouseleave', () => this.hideLockCountTooltip());
            if (state.difficulty==='easy' && ['+','-','*','/'].includes(el)) {
                btn.classList.add('protected'); btn.disabled = true; btn.title = '四则运算无法被锁定';
            } else if (lockCount < 2) {
                btn.addEventListener('click', () => ui.toggleLockElement(el, btn));
            }
            items.appendChild(btn);
        }
        title.appendChild(items); ui.elementsContainer.appendChild(title);
    }

    updateLockedElements() {
        const ui = this.ui;
        const state = ui.gameController.getGameState();
        const locked = state.roundState.lockedElements;
        if (window.expressionModule) window.expressionModule.setLockedElements(locked);
        const fnNames = { sin:'sin', cos:'cos', tan:'tan', abs:'abs', exp:'exp', ln:'ln', log:'log' };
        ui.elementsContainer.querySelectorAll('.element-btn').forEach(btn => {
            const v = btn.dataset.value;
            btn.classList.remove('locked'); btn.disabled = false;
            if (btn.querySelector('.lock-icon')) btn.textContent = fnNames[v] || ui.getDisplaySymbol(v);
            if (locked.includes(v)) {
                btn.classList.add('locked'); btn.disabled = true;
                if (!btn.querySelector('.lock-icon')) btn.innerHTML = `${v} <span class="lock-icon">🔒</span>`;
            }
        });
    }

    showLockCountTooltip(event, element, count) {
        this.hideLockCountTooltip();
        const t = document.createElement('div'); t.id = 'lock-count-tooltip'; t.className = 'lock-count-tooltip';
        t.textContent = `(${count}/2)`;
        const r = event.target.getBoundingClientRect();
        Object.assign(t.style, { position:'fixed', left:`${r.right+8}px`, top:`${r.top+r.height/2-15}px`, zIndex:'10000', background:'rgba(0,0,0,0.8)', color:'#fff', padding:'4px 8px', borderRadius:'4px', fontSize:'12px', pointerEvents:'none' });
        document.body.appendChild(t);
    }

    hideLockCountTooltip() { document.getElementById('lock-count-tooltip')?.remove(); }

    updateExpressionDisplay() {
        const ui = this.ui;
        if (ui.gameController.isP2PMode() && ui.p2pController?.isConnected && ui.gameController.currentPhase==='input_function' && !ui.p2pController.isMyTurn(ui.gameController.currentPlayer)) {
            ui.expressionDisplay.innerHTML = '<span class="expression-prefix">y =</span><span style="opacity:0.5;font-style:italic">' + (ui._remoteExpression||'') + '</span>';
            return;
        }
        ui.currentExpression = ui.expressionElements.join('');
        ui.expressionDisplay.innerHTML = '';
        const prefix = document.createElement('span'); prefix.className='expression-prefix'; prefix.textContent='y ='; ui.expressionDisplay.appendChild(prefix);
        if (!ui.expressionElements.length) {
            const c=document.createElement('span'); c.className='cursor'; c.textContent='|'; ui.expressionDisplay.appendChild(c); ui.cursorIndex=0; return;
        }
        if (ui.cursorIndex > ui.expressionElements.length) ui.cursorIndex = ui.expressionElements.length;
        for (let i=0; i<ui.expressionElements.length; i++) {
            if (i===ui.cursorIndex) { const c=document.createElement('span'); c.className='cursor'; c.textContent='|'; ui.expressionDisplay.appendChild(c); }
            const s=document.createElement('span'); s.className='expression-element'; s.textContent=ui.getDisplaySymbol(ui.expressionElements[i]); s.dataset.index=i; ui.expressionDisplay.appendChild(s);
        }
        if (ui.cursorIndex===ui.expressionElements.length) { const c=document.createElement('span'); c.className='cursor'; c.textContent='|'; ui.expressionDisplay.appendChild(c); }
    }

    bindExpressionScrollSupport() {
        if (!this.ui.expressionDisplay || this.ui._expressionScrollBound) return;
        this.ui._expressionScrollBound = true;
        this.ui.expressionDisplay.style.overflowY = 'auto';
        this.ui.expressionDisplay.style.overflowX = 'hidden';
        this.ui.expressionDisplay.style.whiteSpace = 'normal';
        this.ui.expressionDisplay.style.scrollBehavior = 'smooth';
        this.ui.expressionDisplay.style.touchAction = 'pan-y';
        this.ui.expressionDisplay.addEventListener('wheel', (e) => {
            if (this.ui.gameController?.currentPhase !== 'input_function') return;
            const hasVerticalOverflow = this.ui.expressionDisplay.scrollHeight > this.ui.expressionDisplay.clientHeight + 2;
            if (!hasVerticalOverflow) return;
            e.preventDefault();
            this.ui.expressionDisplay.scrollTop += e.deltaY;
        }, { passive: false });
    }

    toggleLockElement(element, btn) {
        const state = this.ui.gameController.getGameState();
        const alreadyLocked = state.roundState.lockedElements;
        
        if (this.ui._isP2PBlocked()) {
            this.ui.showMessage('请等待对手操作', 'info');
            return;
        }
        
        if (alreadyLocked.includes(element)) {
            const rollback = () => { this.ui.gameController.addLockedElement(element); };
            this.ui.gameController.removeLockedElement(element);
            btn.classList.remove('selected');
            btn.style.background = '';
            this.ui._forwardP2PAction('unlock_element', { element }, rollback);
        } else {
            if (element === 'x') {
                this.ui.showMessage('变量 x 不能被锁定', 'warning');
                return;
            }
            if (element === '(' || element === ')') {
                this.ui.showMessage('括号不能被锁定', 'warning');
                return;
            }
            
            if (this.ui.gameController.addLockedElement(element)) {
                btn.classList.add('selected');
                btn.style.background = 'rgba(239, 68, 68, 0.5)';
                this.ui._forwardP2PAction('lock_element', { element });
            }
        }
        
        this.ui.initLockElementsView();
    }

    addElementToExpression(element) {
        const phase = this.ui.gameController.currentPhase;
        if (phase !== 'input_function') {
            if (window.audioManager) window.audioManager.playError();
            this.ui.showMessage('当前阶段不能输入函数', 'error');
            return;
        }

        const state = this.ui.gameController.getGameState();
        if (this.ui._isAITurn()) {
            this.ui.showMessage('Summa 正在思考中...', 'info');
            return;
        }

        if (this.ui.gameController.isP2PMode() && this.ui.p2pController &&
            !this.ui.p2pController.isMyTurn(this.ui.gameController.currentPlayer)) {
            this.ui.showMessage('请等待对手操作', 'info');
            return;
        }
        
        if (state.roundState.lockedElements.includes(element)) {
            if (window.audioManager) window.audioManager.playError();
            this.ui.showMessage(`元素 "${element}" 已被锁定，无法使用`, 'error');
            return;
        }
        
        const functionElements = ['sin', 'cos', 'tan', 'abs', 'exp', 'ln', 'log', 'sqrt'];
        if (functionElements.includes(element)) {
            this.ui.expressionElements.splice(this.ui.cursorIndex, 0, element, '(', ')');
            this.ui.cursorIndex += 2;
            if (window.expressionModule) window.expressionModule.insert(element, true);
        } else {
            this.ui.expressionElements.splice(this.ui.cursorIndex, 0, element);
            this.ui.cursorIndex++;
            if (window.expressionModule) window.expressionModule.insert(element, false);
        }
        
        if (window.audioManager) window.audioManager.playClick();
        this.ui.updateExpressionDisplay();
        this.ui._forwardP2PAction('expression_change', { expression: this.ui.currentExpression });
    }

    getDisplaySymbol(element) {
        const symbolMap = {
            '*': '×',
            '/': '÷',
            '!': '!'
        };
        return symbolMap[element] || element;
    }

    handleExpressionClick(e) {
        const phase = this.ui.gameController.currentPhase;
        if (phase !== 'input_function') return;
        
        const state = this.ui.gameController.getGameState();
        if (this.ui.gameController.gameMode === 'ai' && state.currentPlayer === 'B') {
            return;
        }
        
        const elementSpan = e.target.closest('.expression-element');
        if (elementSpan) {
            const index = parseInt(elementSpan.dataset.index);
            if (!isNaN(index)) {
                if (window.audioManager) window.audioManager.playElementClick();
                this.ui.expressionElements.splice(index, 1);
                if (index < this.ui.cursorIndex) {
                    this.ui.cursorIndex--;
                }
                this.ui.updateExpressionDisplay();
            }
            return;
        }
        
        const rect = this.ui.expressionDisplay.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY; // 使用绝对Y坐标来匹配元素
        
        const lineGroups = new Map(); // key: 行的Y坐标, value: [{elementIndex, left, right, center}]
        const elementIndices = []; // 记录每个子元素对应的 expressionElements 索引
        
        for (let i = 0; i < this.ui.expressionDisplay.children.length; i++) {
            const child = this.ui.expressionDisplay.children[i];
            
            if (child.classList.contains('cursor')) continue;
            
            if (child.dataset.index === undefined) continue;
            
            const childRect = child.getBoundingClientRect();
            const childLeft = childRect.left - rect.left;
            const childRight = childLeft + childRect.width;
            const childCenter = childLeft + childRect.width / 2;
            const childTop = Math.round(childRect.top);
            const elementIndex = parseInt(child.dataset.index);
            
            if (!lineGroups.has(childTop)) {
                lineGroups.set(childTop, []);
            }
            lineGroups.get(childTop).push({ 
                elementIndex, // 对应 expressionElements 的索引
                left: childLeft, 
                right: childRight, 
                center: childCenter 
            });
            elementIndices.push({ childIndex: i, elementIndex });
        }
        
        if (lineGroups.size === 0) {
            this.ui.cursorIndex = 0;
            this.ui.updateExpressionDisplay();
            return;
        }
        
        let targetLine = null;
        let minYDiff = Infinity;
        
        for (const lineY of lineGroups.keys()) {
            const yDiff = Math.abs(lineY - clickY);
            if (yDiff < minYDiff) {
                minYDiff = yDiff;
                targetLine = lineGroups.get(lineY);
            }
        }
        
        let newCursorIndex = 0;
        
        if (targetLine) {
            targetLine.sort((a, b) => a.left - b.left);
            
            for (let i = 0; i < targetLine.length; i++) {
                const item = targetLine[i];
                if (clickX < item.center) {
                    newCursorIndex = item.elementIndex;
                    break;
                }
                newCursorIndex = item.elementIndex + 1;
            }
        } else {
            const allItems = [];
            for (const line of lineGroups.values()) {
                allItems.push(...line);
            }
            allItems.sort((a, b) => a.left - b.left);
            
            for (let i = 0; i < allItems.length; i++) {
                if (clickX < allItems[i].center) {
                    newCursorIndex = allItems[i].elementIndex;
                    break;
                }
                newCursorIndex = allItems[i].elementIndex + 1;
            }
        }
        
        this.ui.cursorIndex = newCursorIndex;
        this.ui.updateExpressionDisplay();
    }

    handleVerticalCursorMove(direction) {
        const phase = this.ui.gameController.currentPhase;
        if (phase !== 'input_function') return;
        if (this.ui.expressionElements.length === 0) return;
        
        const rect = this.ui.expressionDisplay.getBoundingClientRect();
        
        const allItems = [];
        for (let i = 0; i < this.ui.expressionDisplay.children.length; i++) {
            const child = this.ui.expressionDisplay.children[i];
            if (child.classList.contains('cursor')) continue;
            if (child.dataset.index === undefined) continue;
            
            const childRect = child.getBoundingClientRect();
            allItems.push({
                index: parseInt(child.dataset.index),
                y: Math.round(childRect.top),
                left: childRect.left,
                right: childRect.right,
                center: childRect.left + childRect.width / 2
            });
        }
        
        if (allItems.length === 0) return;
        
        let cursorY = null;
        let cursorX = null;
        
        for (let i = 0; i < this.ui.expressionDisplay.children.length; i++) {
            const child = this.ui.expressionDisplay.children[i];
            if (child.classList.contains('cursor')) {
                const childRect = child.getBoundingClientRect();
                cursorY = Math.round(childRect.top);
                cursorX = childRect.left + childRect.width / 2;
                break;
            }
        }
        
        if (cursorY === null) {
            const lastItem = allItems[allItems.length - 1];
            if (lastItem) {
                cursorY = lastItem.y;
                cursorX = lastItem.right + 20;
            }
        }
        
        if (cursorY === null) return;
        
        const yValues = [...new Set(allItems.map(item => item.y))].sort((a, b) => a - b);
        
        let currentLineIdx = yValues.indexOf(cursorY);
        if (currentLineIdx === -1 && cursorY !== null) {
            let minDiff = Infinity;
            for (let i = 0; i < yValues.length; i++) {
                const diff = Math.abs(yValues[i] - cursorY);
                if (diff < minDiff) { minDiff = diff; currentLineIdx = i; }
            }
        }
        
        const targetLineIdx = currentLineIdx + direction;
        if (targetLineIdx < 0 || targetLineIdx >= yValues.length) return;
        
        const targetY = yValues[targetLineIdx];
        
        const targetItems = allItems.filter(item => item.y === targetY).sort((a, b) => a.index - b.index);
        
        if (targetItems.length === 0) return;
        
        let bestIndex = 0;
        let minDist = Infinity;
        
        for (let pos = 0; pos <= targetItems.length; pos++) {
            let x;
            if (pos === 0) {
                x = targetItems[0].left - 10;
            } else if (pos === targetItems.length) {
                x = targetItems[pos - 1].right + 10;
            } else {
                x = (targetItems[pos - 1].right + targetItems[pos].left) / 2;
            }
            
            const dist = Math.abs(x - cursorX);
            if (dist < minDist) {
                minDist = dist;
                bestIndex = pos === 0 ? targetItems[0].index : 
                           (pos === targetItems.length ? targetItems[pos - 1].index + 1 : 
                            targetItems[pos - 1].index + 1);
            }
        }
        
        this.ui.cursorIndex = bestIndex;
        this.ui.updateExpressionDisplay();
    }

    clearExpression() {
        if (window.audioManager && this.ui.expressionElements && this.ui.expressionElements.length > 0) {
            window.audioManager.playElementClick();
        }
        this.ui.expressionElements = [];
        this.ui.currentExpression = '';
        this.ui.updateExpressionDisplay();
        if (this.ui.gameController.isP2PMode() && this.ui.p2pController?.isConnected &&
            this.ui.p2pController.isMyTurn(this.ui.gameController.currentPlayer)) {
            this.ui._forwardP2PAction('expression_change', { expression: '' });
        }
    }

    getCurrentExpressionLength() {
        const expression = this.ui.currentExpression || this.ui.gameController?.getGameState?.()?.roundState?.functionExpression || '';
        if (!expression) return 0;
        const cleanExpr = expression.replace(/\s+/g, '').replace(/[()（）]/g, '');
        let length = 0;
        const tokenRegex = /(sin|cos|tan|abs|exp|ln|log|sqrt|factorial)|(\d+(?:\.\d+)?)|(PI|π|e|i)|([+\-*/^!])|(x)/gi;
        let match;
        while ((match = tokenRegex.exec(cleanExpr)) !== null) {
            length++;
        }
        if (length === 0 && cleanExpr.length > 0) {
            length = cleanExpr.length;
        }
        return length;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionView;
}
