/**
 * GameFlowView — 游戏流程视图
 * 层级：UI View（由 UIController 持有）
 * 职责：阶段UI更新、计时器显示、记分板、消息提示、游戏结束弹窗、游戏报告
 */
class GameFlowView {
    /** @param {UIController} ui */
    constructor(ui) { this.ui = ui; }

    refreshHistoryFunctionPoints() {
        const ui=this.ui, state=ui.gameController.getGameState();
        if (!state.functionHistory?.length) return;
        const r=ui.gridSystem.range;
        for (const func of state.functionHistory) {
            if ((func.sampledRange||0) < r) {
                try { func.points=ui.renderer.sampleFunction(func.expression,-r,r); func.sampledRange=r; }
                catch(e) { console.warn('[UI] 重采样历史函数失败:',func.expression,e); }
            }
        }
        ui.gridSystem.functionHistory = state.functionHistory;
    }

    updatePhaseUI(phase) {
        const ui=this.ui, state=ui.gameController.getGameState();
        if (state.isTestMode) {
            ui.currentPlayerElement.textContent='测试模式';
            ui.phaseHintElement.textContent='构造函数并点击确认，函数将持续显示在画布上';
            ui.confirmBtn.textContent='绘制函数';
            ui.initDraggableElements(); return;
        }
        ui.currentPlayerElement.textContent = ui._isAITurn() ? 'Summa' : `玩家 ${state.currentPlayer}`;
        let hint='', confirmText='确认';
        switch(phase){
            case 'select_target':
                hint=state.targetCount>1?`请点击棋盘选择 ${state.targetCount} 个目标网格 (${state.roundState.targetCells.length}/${state.targetCount})`:'请点击棋盘选择目标网格';
                confirmText='确认目标'; ui.confirmBtn.disabled=state.roundState.targetCells.length<state.targetCount; break;
            case 'set_forbidden':
                hint=`设置禁止区 (${state.roundState.forbiddenCells.length}/${state.maxForbidden})`; confirmText='确认禁止区'; break;
            case 'set_locks':
                hint=state.difficulty==='easy'?`点击下方元素锁定对方 (${state.roundState.lockedElements.length}/${state.maxLocks})，四则运算无法被锁定`:`点击下方元素锁定对方 (${state.roundState.lockedElements.length}/${state.maxLocks})`;
                confirmText='确认锁定'; ui.initDraggableElements(); break;
            case 'input_function':
                hint='点击下方元素构建函数表达式'; confirmText='提交函数';
                ui.initDraggableElements();
                if(ui._isAITurn()){ui.confirmBtn.disabled=true;ui.clearBtn.disabled=true;if(ui.elementsContainer)ui.elementsContainer.style.pointerEvents='none';}
                else{ui.confirmBtn.disabled=false;ui.clearBtn.disabled=false;if(ui.elementsContainer)ui.elementsContainer.style.pointerEvents='';} break;
            case 'evaluate': case 'init': hint='正在评估...'; ui.confirmBtn.disabled=true; break;
            case 'switch_player': hint='回合切换中...'; break;
        }
        ui.phaseHintElement.textContent=hint;
        ui.confirmBtn.textContent=confirmText;
        const aiInput=ui._isAITurn()&&phase==='input_function';
        if(!aiInput) ui.confirmBtn.disabled=false;
        if(!ui.levelEditor?.isActive||ui.levelEditor.editMode!=='verify'){
            const changed=ui.gridSystem.updateRange(state.currentRound);
            if(changed){this.refreshHistoryFunctionPoints();ui.gridSystem.draw(ui._buildSnapshot());}
        }
    }

    updateTimer(t) {
        const ui=this.ui;
        ui.timerElement.textContent=t;
        t<=10?ui.timerElement.classList.add('warning'):ui.timerElement.classList.remove('warning');
    }

    updateScoreboard() {
        const ui=this.ui, state=ui.gameController.getGameState();
        ui.scoreAElement.textContent=state.scores.A;
        ui.scoreBElement.textContent=state.scores.B;
    }

    showMessage(message, type='info') {
        const ui=this.ui;
        if(ui.messageTimeout) clearTimeout(ui.messageTimeout);
        ui.messageElement.textContent=message;
        ui.messageElement.style.opacity='1';
        if(ui.gameController.isTestMode()||ui.levelEditor?.isActive){
            if(ui.messagePanel) ui.messagePanel.classList.add('visible');
            ui.messageElement.className='message';
            if(type==='error') ui.messageElement.classList.add('error');
            else if(type==='success') ui.messageElement.classList.add('success');
            ui.messageTimeout=setTimeout(()=>this.fadeOutMessage(),2000);
        } else {
            if(ui.messagePanel) ui.messagePanel.classList.remove('visible');
        }
    }

    fadeOutMessage() {
        const ui=this.ui;
        let opacity=1;
        const iv=setInterval(()=>{
            opacity-=0.05;
            if(opacity<=0){clearInterval(iv);ui.messageElement.textContent='';ui.messageElement.className='message';ui.messageElement.style.opacity='1';}
            else ui.messageElement.style.opacity=opacity.toString();
        },50);
    }

    showGameOver(data) {
        const ui=this.ui;
        if(ui.gameController.isP2PMode()&&ui.p2pController?.isConnected){
            ui._p2pMeWantRematch=false; ui._p2pThemWantRematch=false;
            if(ui.restartBtn) ui.restartBtn.textContent='返回主页';
            const rb=document.getElementById('p2p-rematch-btn');
            if(rb){rb.textContent='再来一局';rb.style.display='';rb.disabled=false;}
        } else {
            ui._cleanupP2P?.();
            if(ui.restartBtn) ui.restartBtn.textContent='再来一局';
            const rb=document.getElementById('p2p-rematch-btn'); if(rb) rb.style.display='none';
        }
        ui.winnerElement.textContent=data.winner==='draw'?'平局！':`玩家 ${data.winner} 获胜！`;
        ui.finalScoresElement.innerHTML=`<div>玩家A: ${data.scores.A} 分</div><div>玩家B: ${data.scores.B} 分</div>`;
        ui.showModal(ui.gameOverModal);
    }

    showGameReport() {
        const ui=this.ui;
        if(window.audioManager) window.audioManager.playClick();
        const report=ui.gameController.getGameReport();
        let html=`<div class="report-summary"><h3>比赛总结</h3><p>难度: ${this.getDifficultyName(report.difficulty)}</p><p>总回合: ${report.totalRounds}</p><p>获胜者: ${report.winner==='draw'?'平局':'玩家 '+report.winner}</p><p>最终比分: A ${report.finalScores.A} - ${report.finalScores.B} B</p></div><div class="report-history"><h3>回合详情</h3><table class="report-table"><thead><tr><th>回合</th><th>选择方</th><th>构建方</th><th>目标坐标</th><th>禁止区</th><th>锁定元素</th><th>函数表达式</th><th>类型</th><th>结果</th><th>得分</th><th>总分(A-B)</th></tr></thead><tbody>`;
        for(const r of report.history){
            const res=r.hitForbidden?'进入禁区':r.hitTarget?'命中目标':'未命中';
            const sc=r.score>=0?'score-positive':'score-negative';
            html+=`<tr><td>${r.round}</td><td>玩家 ${r.selector}</td><td>玩家 ${r.constructor}</td><td class="coord-cell">${r.targetCells.map(c=>`(${c.x},${c.y})`).join(', ')}</td><td class="coord-cell">${r.forbiddenCells.length>0?r.forbiddenCells.map(c=>`(${c.x},${c.y})`).join(', '):'-'}</td><td class="elem-cell">${r.lockedElements.length>0?r.lockedElements.join(', '):'-'}</td><td class="expr-cell">${r.expression||'-'}</td><td>${this.getFunctionTypeName(r.functionType?.type)}</td><td>${res}</td><td class="${sc}">${r.score>=0?'+':''}${r.score}</td><td>${r.totalScoreA} - ${r.totalScoreB}</td></tr>`;
        }
        html+='</tbody></table></div>';
        ui.reportContentElement.innerHTML=html;
        ui.reportContentElement.scrollTop=0;
        ui.reportContentElement.style.overflowY='auto';
        ui.reportContentElement.style.maxHeight='calc(90vh - 100px)';
        ui.showModal(ui.reportModal);
    }

    hideGameReport() { const ui=this.ui; if(window.audioManager)window.audioManager.playClick(); ui.hideModal(ui.reportModal); }

    getDifficultyName(d) { return {easy:'简单',normal:'普通',hard:'困难',expert:'专家',unsolvable:'无解',test:'测试'}[d]||d; }
    getFunctionTypeName(t) { return {constant:'常值函数',degree_1:'一次函数',degree_2:'二次函数',degree_3:'三次函数',degree_4:'四次及以上',fraction:'分式函数',abs:'绝对值函数',sin:'正弦函数',cos:'余弦函数',tan:'正切函数',exp:'指数函数',ln:'自然对数',log:'常用对数',sqrt:'根号函数',factorial:'阶乘函数',euler:'欧拉公式'}[t]||t; }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameFlowView;
}
