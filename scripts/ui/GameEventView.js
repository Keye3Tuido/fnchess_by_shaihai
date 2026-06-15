/**
 * GameEventView — 游戏事件处理器
 * 层级：UI View
 * 职责：绑定 GameController 的所有事件，更新 UI 和协调各视图
 */
class GameEventView {
 constructor(ui) { this.ui = ui; }
 bind() {
 const ui=this.ui;
 const gc=ui.gameController;
        gc.on('gameInit', (data) => {
            // 完全重置UI状态
            ui.gridSystem.clearAll();
            ui.clearExpression();
            ui.updateScoreboard();
            ui.roundElement.textContent = data.currentRound;
            ui.totalRoundsElement.textContent = data.totalRounds;
            ui.messageElement.textContent = '';
            const badge = document.getElementById('campaign-level-badge');
            if (badge) badge.style.display = 'none';
            ui.campaignDifficulty = null;
            ui.campaignCurrentLevelId = null;
            ui.campaignCurrentLevelBestRecord = null;
            
            // 测试模式特殊提示
            if (data.isTestMode) {
                ui.hideBattleUI();
                ui.showMessage('测试模式：自由构造函数，函数将持续显示在画布上');
            } else if (data.gameMode === 'campaign') {
                ui.hideBattleUI();
                ui.showMessage('闯关模式：请直接构造函数作答');
            } else {
                ui.restoreBattleUI();
                ui.showMessage('游戏开始！玩家B请选择目标网格');
            }
            
            // Summa: hook game start
            if (ui.gameController.gameMode === 'ai' && window.characterModule) {
                window.characterModule.show('ai');
                window.characterModule.reactStart();
            } else if (window.characterModule) {
                window.characterModule.show('local'); // Hides summa
            }
        });
        
        ui.gameController.on('phaseChange', (data) => {
            if (window.audioManager) window.audioManager.playPhaseChange();
            ui.updatePhaseUI(data.phase);
            if (data.phase === 'input_function' || data.phase === 'select_target') {
                // 闯关模式重新尝试时（input_function）不清空表达式，由 campaignLevelLoaded 负责首次清空
                if (!(ui.gameController.campaignState?.active && data.phase === 'input_function'))
                    ui.clearExpression();
            }
            // P2P模式：更新回合显示
            ui._updateP2PTurnDisplay();
            
            // Summa Reaction Hook for Phase Change
            if (ui.gameController.gameMode === 'ai' && window.characterModule) {
                if (data.phase === 'input_function') {
                    if (data.currentPlayer === 'B') {
                        window.characterModule.reactAiThink();
                    } else {
                        window.characterModule.reactPlayerAction();
                    }
                    // 玩家输入函数时，Summa 看向公式输入区
                    window.characterModule.setLookMode('expression');
                } else if (data.phase === 'evaluate') {
                    if (data.currentPlayer === 'B') {
                        window.characterModule.reactAiPlay();
                    }
                    window.characterModule.setLookMode('mouse');
                } else if (data.phase === 'select_target' || data.phase === 'set_forbidden' || data.phase === 'set_locks') {
                    // 选择目标格/禁止区/锁定：Summa 跟随鼠标在棋盘上的位置
                    window.characterModule.setLookMode('canvas');
                } else {
                    window.characterModule.setLookMode('mouse');
                }
            }
            
            // 同步历史使用过的格子到 GridSystem（不启动动画）
            const state = ui.gameController.getGameState();
            if (state.usedCells) {
                ui.gridSystem.usedCells = state.usedCells;
                // 新回合开始时立即重绘，显示历史格子
                if (data.phase === 'select_target') ui.gridSystem.draw(ui._buildSnapshot());
            }
            
            // 同步历史函数和当前回合数（确保在updateRange后能正确显示）
            if (state.functionHistory) {
                ui.gridSystem.functionHistory = state.functionHistory;
                ui.gridSystem.currentRound = state.currentRound;
            }
            
            // 如果是人机模式且当前是AI的回合，触发AI行动
            if (ui._isAITurn()) {
                ui.triggerAITurn(data.phase);
            }
        });
        
        ui.gameController.on('timerUpdate', (data) => {
            if (window.audioManager && data.remainingTime > 0 && data.remainingTime <= 5) {
                window.audioManager.playTick();
            }
            ui.updateTimer(data.remainingTime);
            if (ui.gameController.isP2PMode() && ui.p2pController && ui.p2pController.isHost) {
                ui.p2pController.sendTimerSync(data.remainingTime);
            }
        });

        // RoundModule 计时事件（优先于 GameController 的事件）
        if (window.roundModule) {
            window.roundModule.on('timerUpdate', (data) => {
                if (window.audioManager && data.remainingTime > 0 && data.remainingTime <= 5) {
                    window.audioManager.playTick();
                }
                ui.updateTimer(data.remainingTime);
                if (ui.gameController.isP2PMode() && ui.p2pController && ui.p2pController.isHost) {
                    ui.p2pController.sendTimerSync(data.remainingTime);
                }
            });
            window.roundModule.on('timeout', (data) => {
                if (window.audioManager) window.audioManager.playError();
                ui.showMessage(`玩家${data.player}超时！扣1分`, 'error');
                if (ui.gameController.isP2PMode() && ui.p2pController && ui.p2pController.isHost) {
                    ui.p2pController.sendTimeout(data.player);
                }
                // 委托 GameController 推进阶段（超时 → 扣分 → SWITCH_PLAYER）
                ui.gameController.handleTimeout();
            });
        }
        
        ui.gameController.on('timeout', (data) => {
            if (window.audioManager) window.audioManager.playError();
            ui.showMessage(`玩家${data.player}超时！扣1分`, 'error');
            // P2P Host：通知 Guest 超时
            if (ui.gameController.isP2PMode() && ui.p2pController && ui.p2pController.isHost) {
                ui.p2pController.sendTimeout(data.player);
                ui._p2pSyncScores();
            }
        });
        
        ui.gameController.on('targetSelected', (data) => {
            if (window.audioManager) window.audioManager.playClick();
            // 更新所有目标格的显示
            ui.gridSystem.setTargetCells(ui.gameController.roundState.targetCells);
            const progress = data.count && data.total ? ` (${data.count}/${data.total})` : '';
            ui.showMessage(`目标网格 ${data.count} 已选择: (${data.cell.x}, ${data.cell.y})${progress}`);
            
            // 更新阶段提示
            const state = ui.gameController.getGameState();
            if (state.targetCount > 1) {
                ui.phaseHintElement.textContent = `请点击棋盘选择 ${state.targetCount} 个目标网格 (${ui.gameController.roundState.targetCells.length}/${state.targetCount})`;
            }
        });
        
        ui.gameController.on('targetRemoved', (data) => {
            if (window.audioManager) window.audioManager.playElementClick();
            // 更新所有目标格的显示
            ui.gridSystem.setTargetCells(ui.gameController.roundState.targetCells);
            ui.showMessage(`目标网格已取消: (${data.cell.x}, ${data.cell.y})`);
            
            // 更新阶段提示
            const state = ui.gameController.getGameState();
            if (state.targetCount > 1) {
                ui.phaseHintElement.textContent = `请点击棋盘选择 ${state.targetCount} 个目标网格 (${ui.gameController.roundState.targetCells.length}/${state.targetCount})`;
            }
        });
        
        ui.gameController.on('forbiddenAdded', (data) => {
            if (window.audioManager) window.audioManager.playClick();
            ui.gridSystem.addForbiddenCell(data.cell);
            ui.showMessage(`禁止区已设置: (${data.cell.x}, ${data.cell.y})`);
            // 更新阶段提示中的计数
            const state = ui.gameController.getGameState();
            ui.phaseHintElement.textContent = `设置禁止区 (${state.roundState.forbiddenCells.length}/${state.maxForbidden}) - 点击棋盘选择，选好后点击确认`;
        });
        
        ui.gameController.on('forbiddenRemoved', (data) => {
            if (window.audioManager) window.audioManager.playElementClick();
            ui.gridSystem.removeForbiddenCell(data.cell);
            ui.showMessage(`禁止区已取消: (${data.cell.x}, ${data.cell.y})`);
            // 更新阶段提示中的计数
            const state = ui.gameController.getGameState();
            ui.phaseHintElement.textContent = `设置禁止区 (${state.roundState.forbiddenCells.length}/${state.maxForbidden}) - 点击棋盘选择，选好后点击确认`;
        });
        
        ui.gameController.on('elementLocked', (data) => {
            ui.updateLockedElements();
            ui.showMessage(`已锁定元素: ${data.element}`);
        });
        
        ui.gameController.on('evaluationComplete', (data) => {
            if (window.audioManager) {
                if (data.hitTarget && !data.hitForbidden) {
                    window.audioManager.playSuccess();
                } else {
                    window.audioManager.playError();
                }
            }
            ui.showEvaluationResult(data);
            
            // 保存函数到历史记录（用于淡化显示）
            if (data.expression && data.round && !ui.gameController.campaignState.active) {
                if (!ui.gameController.functionHistory) ui.gameController.functionHistory = [];
                const range = ui.gridSystem.getRange();
                const points = ui.renderer.sampleFunction(data.expression, range.min, range.max);
                const entry = {
                    expression: data.expression,
                    round: data.round,
                    points,
                    color: '#00d4ff',
                    sampledRange: ui.gridSystem.range
                };
                ui.gameController.functionHistory.push(entry);
                if (window.renderModule) window.renderModule.addToHistory(entry);
            }

            // ── 挑衅反转学习钉子 ────────────────────────────────────────────────
            // 当 AI 模式下玩家 A 正在解答 Summa 的挑衅题目，需要让 Summa 学习或反馈
            if (ui.gameController.gameMode === 'ai'
                && ui.gameController.currentPlayer === 'A'
                && ui.aiController.pendingRevengePuzzle !== null) {
                if (data.hitTarget && !data.hitForbidden) {
                    // 玩家成功解题：Summa 学习该解法
                    ui.aiController.learnFromPlayer(data.expression);
                } else {
                    // 玩家也失败：Summa 得意
                    ui.aiController.notifyPlayerFailedRevenge();
                }
            }

            // ── 玩家解析式深度训练 ─────────────────────────────────────────────────
            // AI 模式下，无论玩家成功与否，都对玩家的解析式进行 10000 局类似局面训练
            if (ui.gameController.gameMode === 'ai'
                && ui.gameController.currentPlayer === 'A'
                && data.expression) {
                const trainState = ui.gameController.getGameState();
                // 静默后台训练，不阻塞游戏流程
                ui.aiController.trainOnPlayerExpression(
                    data.expression,
                    trainState.roundState.targetCells,
                    trainState.roundState.forbiddenCells
                );
            }
        });

        // 闯关：关卡结果与自动进入下一关/重试
        ui.gameController.on('campaignLevelResult', (data) => {
            // 阻止随机关卡和编辑器污染闯关记录
            if (ui.randomChallenge?.isActive &&
                ui.gameController.campaignState?.isRandomChallenge) {
                ui.randomChallenge.handleResult(data);
                return;
            }
            if (ui.levelEditor?.isActive &&
                ui.levelEditor.editMode === 'verify') {
                ui.levelEditor.handleResult(data);
                return;
            }

            ui.refreshCampaignStartUI();
            const levelId = Number(data.levelId || ui.campaignCurrentLevelId || 1);
            let isNewRecord = false;
            let previousBest = ui.getCampaignLevelBestRecord(levelId);
            if (data.pass) {
                const length = ui.getCurrentExpressionLength();
                if (previousBest === null || length < previousBest) {
                    isNewRecord = true;
                    ui.campaignCurrentLevelBestRecord = previousBest;
                } else {
                    ui.campaignCurrentLevelBestRecord = previousBest;
                }
                data.expressionLength = length;
                data.isNewRecord = isNewRecord;
                data.previousBest = previousBest;
                if (isNewRecord) {
                    const gainedStars = Math.max(1, Math.min(5, Number(data.score) || 1));
                    const previousStars = ui.getCampaignLevelBestStars(levelId);
                    // 只在获得更高星星时更新总数
                    if (gainedStars > previousStars) {
                        const currentStars = ui.getCampaignCollectedStars();
                        ui.setCampaignCollectedStars(currentStars + (gainedStars - previousStars));
                        ui.setCampaignLevelBestStars(levelId, gainedStars);
                    }
                    ui.setCampaignLevelBestRecord(levelId, length);
                    setTimeout(() => {
                        if (ui.campaignCurrentLevelId === levelId) {
                            ui.campaignCurrentLevelBestRecord = length;
                            ui.updateCampaignGlobalProgressText(ui.getCampaignCollectedStars());
                        }
                    }, 0);
                }
            }
            setTimeout(() => {
                try {
                    if (!ui._gameActive) return;
                    if (data.pass) {
                        ui.showCampaignVictory(data);
                    } else {
                        ui.gameController.setPhase(ui.gameController.phases.INPUT_FUNCTION);
                    }
                } catch (e) {
                    console.error('[Campaign] 处理关卡结果失败:', e);
                }
            }, 900);
        });

        ui.gameController.on('campaignLevelLoaded', (data) => {
            try {
                ui.updateCampaignDrawDelayToggleVisibility();
                // 闯关：隐藏计时器与回合数显示
                if (ui.timerElement && ui.timerElement.parentElement) {
                    ui.timerElement.parentElement.style.display = 'none';
                }
                if (ui.currentPlayerElement && ui.currentPlayerElement.parentElement) {
                    ui.currentPlayerElement.parentElement.style.display = 'none';
                }
                document.querySelectorAll('.score-display').forEach(el => {
                    el.style.display = 'none';
                });
                const roundDisplay = document.getElementById('round-display');
                if (roundDisplay) roundDisplay.style.display = 'none';

                // 更新顶部回合显示为关卡编号
                ui.roundElement.textContent = data.levelId;
                ui.totalRoundsElement.textContent = data.totalLevels;

                // 清空画布标记与表达式
                ui.gridSystem.clearAll();
                ui.clearExpression();

                // 设置目标与禁区
                ui.gridSystem.setTargetCells(data.roundState.targetCells || []);
                ui.gridSystem.forbiddenCells = data.roundState.forbiddenCells || [];
                ui.gridSystem.draw(ui._buildSnapshot());

                // 初始化可拖拽元素（会根据 lockedElements 上锁）
                ui.initDraggableElements();
            } catch (e) {
                console.error('[Campaign] campaignLevelLoaded 处理失败:', e);
            }
        });
        gc.on('gameEnd', (data) => {
            if(window.audioManager)window.audioManager.playGameWin();
            if(ui.gameController.isP2PMode()&&ui.p2pController?.isHost)ui._p2pSyncScores();
            const finish=()=>ui.showGameOver(data);
            if(ui.gameController.gameMode==='ai'&&window.summaCharacter){
                const summa=window.summaCharacter, prev=summa.onSpeechQueueEmpty;
                summa.onSpeechQueueEmpty=()=>{summa.onSpeechQueueEmpty=prev||null;finish();if(typeof prev==='function')prev();};
                if(data.winner==='B'){summa.reactWin();return;}
                else if(data.winner==='A'){summa.reactLose();return;}
            }
            finish();
        });
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=GameEventView;