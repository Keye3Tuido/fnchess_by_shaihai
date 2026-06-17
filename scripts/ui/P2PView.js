/**
 * P2PView — P2P 联机对战视图
 * 层级：UI View（由 UIController 持有）
 * 职责：P2P 房间弹窗、连接状态、游戏同步
 */
class P2PView {
    /** @param {UIController} ui */
    constructor(ui) { this.ui = ui; }

    showP2PRoomDialog() {
        const ui = this.ui;
        if (typeof Peer === 'undefined') { ui.showMessage('联机模块加载失败，请检查网络连接后刷新页面重试','error'); return; }
        if (typeof P2PController === 'undefined') { ui.showMessage('P2P模块未加载','error'); return; }
        ui._cleanupP2P?.();
        ui.p2pController = new P2PController();
        this._setupP2PCallbacks();
        if (!document.getElementById('p2p-room-modal')) this._createP2PRoomModal();
        const $=id=>document.getElementById(id);
        const cb=$('p2p-create-btn'); if(cb)cb.disabled=false;
        const jb=$('p2p-join-btn'); if(jb)jb.disabled=false;
        const d=$('p2p-room-code-display'); if(d)d.style.display='none';
        const inp=$('p2p-room-input'); if(inp)inp.value='';
        this._updateP2PStatus('idle','准备就绪');
        ui.showModal(document.getElementById('p2p-room-modal'));
        // 初始化大厅客户端
        if (typeof LobbyClient !== 'undefined') {
            this._lobby = new LobbyClient();
            this._setupLobbyCallbacks();
        }
    }

    _createP2PRoomModal() {
        const modal=document.createElement('div'); modal.id='p2p-room-modal'; modal.className='modal'; modal.style.display='none';
        modal.innerHTML='<div class="modal-content p2p-room-content"><h2>联机对战</h2><div class="p2p-status" id="p2p-status"><span class="p2p-status-dot"></span><span class="p2p-status-text">准备就绪</span></div><div class="p2p-tabs"><button class="p2p-tab active" id="p2p-tab-create">创建房间</button><button class="p2p-tab" id="p2p-tab-join">加入房间</button><button class="p2p-tab" id="p2p-tab-lobby">匹配大厅</button></div><div class="p2p-tab-content" id="p2p-tab-create-content"><p class="p2p-desc">创建房间后将获得一个6位房间码，分享给对手即可开始对战</p><div class="p2p-room-code-display" id="p2p-room-code-display" style="display:none;"><span class="p2p-label">房间码</span><span class="p2p-room-code" id="p2p-room-code-text">------</span><button class="btn btn-small p2p-copy-btn" id="p2p-copy-btn">复制</button></div><button class="btn btn-primary p2p-action-btn" id="p2p-create-btn">创建房间</button></div><div class="p2p-tab-content" id="p2p-tab-join-content" style="display:none;"><p class="p2p-desc">输入对手分享的6位房间码加入对战</p><div class="p2p-input-group"><input type="text" id="p2p-room-input" class="p2p-room-input" maxlength="6" placeholder="输入6位房间码" autocomplete="off"></div><button class="btn btn-primary p2p-action-btn" id="p2p-join-btn">加入房间</button></div><div class="p2p-tab-content" id="p2p-tab-lobby-content" style="display:none;"><div class="lobby-header"><span class="lobby-online" id="lobby-online">🟢 大厅 0 人</span></div><div class="lobby-room-list" id="lobby-room-list"><p class="lobby-empty">暂无等待中的房间</p></div><div class="lobby-actions"><div class="lobby-create-row"><select id="lobby-rounds"><option value="8">8 局</option><option value="12">12 局</option><option value="16">16 局</option><option value="20">20 局</option></select><select id="lobby-difficulty"><option value="normal">普通</option><option value="easy">简单</option><option value="hard">困难</option><option value="expert">专家</option></select><button class="btn btn-primary" id="lobby-create-btn">创建公开房间</button></div><button class="btn btn-accent" id="lobby-quick-btn" style="width:100%;margin-top:4px;">🎲 快速匹配</button></div></div><div class="p2p-battle-hint"><small>房主为<strong>玩家A</strong>，访客为<strong>玩家B</strong></small><br><small>双方轮流操作，玩法与本地对战一致</small></div><button class="btn btn-secondary p2p-back-btn" id="p2p-back-btn" style="width:100%;margin-top:8px;">返回</button></div>';
        const sm=document.getElementById('start-modal'); sm.parentNode.insertBefore(modal,sm.nextSibling);
        this._bindP2PRoomEvents();
    }

    _bindP2PRoomEvents() {
        const modal=document.getElementById('p2p-room-modal'); if(!modal)return;
        const $=id=>document.getElementById(id);
        const tc=$('p2p-tab-create'),tj=$('p2p-tab-join'),tl=$('p2p-tab-lobby');
        const cc=$('p2p-tab-create-content'),cj=$('p2p-tab-join-content'),cl=$('p2p-tab-lobby-content');
        const showTab = (tab, content) => {
            [tc,tj,tl].forEach(t => t?.classList.remove('active'));
            [cc,cj,cl].forEach(c => { if(c) c.style.display='none'; });
            tab?.classList.add('active');
            if(content) content.style.display='block';
        };
        if(tc) tc.addEventListener('click',()=>{showTab(tc,cc); this._lobby?.disconnect(); const ri=$('p2p-room-input'); if(ri)ri.value=''; const jb=$('p2p-join-btn'); if(jb)jb.disabled=false;});
        if(tj) tj.addEventListener('click',()=>{showTab(tj,cj); this._lobby?.disconnect();});
        if(tl) tl.addEventListener('click',()=>{
            showTab(tl,cl);
            // 连接大厅
            if (!this._lobby) { this._lobby = new LobbyClient(); this._setupLobbyCallbacks(); }
            const host = P2PController.signaling?.host || 'fnchess.peerserver.keye3tuido.site';
            this._lobby.connect(host);
        });
        $('p2p-create-btn')?.addEventListener('click',()=>this._createP2PRoom());
        $('p2p-join-btn')?.addEventListener('click',()=>this._joinP2PRoom());
        $('lobby-create-btn')?.addEventListener('click',()=>this._lobbyCreateRoom());
        $('lobby-quick-btn')?.addEventListener('click',()=>this._lobbyQuickMatch());
        const ri=$('p2p-room-input');
        if(ri){ri.addEventListener('keydown',e=>{if(e.key==='Enter')this._joinP2PRoom();}); ri.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});}
        $('p2p-copy-btn')?.addEventListener('click',()=>{const code=$('p2p-room-code-text')?.textContent||''; if(!code)return; if(navigator.clipboard?.writeText){navigator.clipboard.writeText(code).then(()=>this.ui.showMessage('房间码已复制！','success')).catch(()=>this.ui.showMessage('复制失败，请手动复制','warning'));}else{const ta=document.createElement('textarea');ta.value=code;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');this.ui.showMessage('房间码已复制！','success');}catch(e){this.ui.showMessage('复制失败，请手动复制: '+code,'warning');}document.body.removeChild(ta);}});
        $('p2p-back-btn')?.addEventListener('click',()=>{this.ui._cleanupP2P?.();this.ui.hideModal(modal);this.ui.showModal(this.ui.startModal);this._updateP2PStatus('idle','准备就绪');});
    }

    _createP2PRoom() {
        const ui=this.ui; if(!ui.p2pController)return;
        document.getElementById('p2p-create-btn').disabled=true;
        ui.p2pController.createRoom();
        document.getElementById('p2p-room-code-display').style.display='flex';
        document.getElementById('p2p-room-code-text').textContent=ui.p2pController.roomCode;
        if(window.audioManager)window.audioManager.playClick();
    }

    _joinP2PRoom() {
        const ui=this.ui; if(!ui.p2pController)return;
        const code=document.getElementById('p2p-room-input').value.trim().toUpperCase();
        if(!code||code.length!==6){ui.showMessage('请输入6位房间码','warning');return;}
        document.getElementById('p2p-join-btn').disabled=true;
        ui.p2pController.joinRoom(code);
        if(window.audioManager)window.audioManager.playClick();
    }

    _setupP2PCallbacks() {
        const ui=this.ui; if(!ui.p2pController)return;
        const p2p=ui.p2pController;
        p2p.onStatusChange = (s,m)=>this._updateP2PStatus(s,m);
        p2p.onConnected    = ()=>this._startP2PGame();
        p2p.onDisconnected = ()=>{
            if(ui.gameController.isP2PMode()){
                ui.forceStopGame?.();
                const sA=ui.gameController.players?.A?.score??0, sB=ui.gameController.players?.B?.score??0;
                ui.winnerElement.textContent='对手已断开连接';
                ui.finalScoresElement.innerHTML=`<div>玩家A: ${sA} 分</div><div>玩家B: ${sB} 分</div>`;
                ui._cleanupP2P?.(); ui.showModal(ui.gameOverModal);
            }
        };
        p2p.onError     = err=>{ui.showMessage('连接失败：'+(err.message||'未知错误'),'error'); document.getElementById('p2p-create-btn')?.removeAttribute('disabled'); document.getElementById('p2p-join-btn')?.removeAttribute('disabled');};
        p2p.onGameAction = (action,payload)=>ui._applyRemoteAction(action,payload);
        p2p.onNack       = (action,rb,reason)=>ui._handleNack(action,rb,reason);
        p2p.onGameInit   = config=>ui._receiveGameInit(config);
        p2p.onStateSync  = state=>ui._applyStateSync(state);
        p2p.onTimerSync  = t=>ui.gameController.syncRemoteTimer(t);
        p2p.onTimeout    = ()=>ui.gameController.applyRemoteTimeout();
        p2p.onRematch    = ()=>{ui._p2pThemWantRematch=true; if(ui._p2pMeWantRematch){ui._checkAndStartRematch?.();}else{ui.showMessage('对手想再来一局，点击"再来一局"确认','info'); const btn=document.getElementById('p2p-rematch-btn'); if(btn)btn.textContent='再来一局 ✓';}};
    }

    _startP2PGame() {
        const ui=this.ui;
        // 连接已建立，从大厅销毁房间（无论公私，只剩 P2P 连接）
        if (this._lobby) { this._lobby.cancel(ui.p2pController?.roomCode); this._lobby.disconnect(); this._lobby = null; }
        const p2pModal=document.getElementById('p2p-room-modal'); if(p2pModal)ui.hideModal(p2pModal);
        ui.hideModal(ui.startModal);
        if(ui.p2pController.isHost){
            // 优先用大厅设置，否则用开始菜单选择
            const rounds = this._lobbyGameRounds || parseInt(ui.roundSelect?.value||ui.roundOptions?.[ui.currentRoundIndex||0]?.value||8,10);
            const diff   = this._lobbyGameDiff   || ui.difficultySelect?.value||ui.difficultyOptions?.[ui.currentDifficultyIndex||0]?.value||'normal';
            this._lobbyGameRounds = null;
            this._lobbyGameDiff   = null;
            ui._p2pFirstPlayer='B'; ui._markGameActive?.(); ui.gameController.p2pTimerSync=false;
            ui.gameController.initGame(rounds,diff,'p2p','B');
            ui.p2pController.sendGameInit({rounds,difficulty:diff,firstPlayer:'B'});
            ui._updateP2PTurnDisplay?.();
        }else{ui._markGameActive?.();ui.gameController.p2pTimerSync=true;this._updateP2PStatus('waiting','等待房主开始游戏...');}
    }

    _updateP2PStatus(status,message){
        const el=document.getElementById('p2p-status'); if(!el)return;
        el.querySelector('.p2p-status-dot')?.setAttribute('class','p2p-status-dot '+status);
        const t=el.querySelector('.p2p-status-text'); if(t)t.textContent=message;
    }

    // ─── 大厅 ──────────────────────────────────────────────

    _setupLobbyCallbacks() {
        if (!this._lobby) return;
        this._lobby.onRoomList = (rooms, online) => this._renderLobbyList(rooms, online);
        this._lobby.onMatched = (data) => this._lobbyOnMatched(data);
        this._lobby.onError   = (msg) => this.ui.showMessage(msg, 'warning');
        this._lobby.onStatus  = (s, m) => {/* SSE 状态，静默 */};
    }

    _renderLobbyList(rooms, online) {
        const countEl = document.getElementById('lobby-online');
        if (countEl) countEl.textContent = `🟢 大厅 ${online} 人`;
        const listEl = document.getElementById('lobby-room-list');
        if (!listEl) return;
        if (!rooms || rooms.length === 0) {
            listEl.innerHTML = '<p class="lobby-empty">暂无等待中的房间，点击下方按钮创建</p>';
            return;
        }
        const diffNames = { easy: '简单', normal: '普通', hard: '困难', expert: '专家' };
        let html = '<table class="lobby-table"><tr><th>房间码</th><th>回合</th><th>难度</th><th></th></tr>';
        for (const r of rooms) {
            html += `<tr><td class="lobby-code">${r.roomCode}</td><td>${r.rounds} 局</td><td>${diffNames[r.difficulty] || r.difficulty}</td><td><button class="btn btn-small lobby-join-btn" data-room="${r.roomCode}">加入</button></td></tr>`;
        }
        html += '</table>';
        listEl.innerHTML = html;
        // 绑定加入按钮
        listEl.querySelectorAll('.lobby-join-btn').forEach(btn => {
            btn.addEventListener('click', () => this._lobbyJoinRoom(btn.dataset.room));
        });
    }

    async _lobbyCreateRoom() {
        const rounds = parseInt(document.getElementById('lobby-rounds')?.value || 8, 10);
        const difficulty = document.getElementById('lobby-difficulty')?.value || 'normal';
        const code = await this._lobby?.createRoom(rounds, difficulty);
        if (!code) return;
        // 记住大厅设置，_startP2PGame 会用
        this._lobbyGameRounds = rounds;
        this._lobbyGameDiff   = difficulty;
        // 退出大厅 SSE
        this._lobby?.disconnect();
        // 用获得的 roomCode 进入创建流程
        this.ui.p2pController.roomCode = code;
        this._updateP2PStatus('connecting', `房间 ${code} 已发布到大厅，等待对手...`);
        document.getElementById('p2p-room-code-display').style.display = 'flex';
        document.getElementById('p2p-room-code-text').textContent = code;
        // 切回创建房间 tab 显示房间码
        document.getElementById('p2p-tab-create')?.click();
        this.ui.p2pController.createRoomWithCode?.(code);
        if (window.audioManager) window.audioManager.playClick();
    }

    async _lobbyJoinRoom(code) {
        if (!code) return;
        const info = await this._lobby?.joinRoom(code);
        if (!info) return;
        this._lobby?.disconnect();
        document.getElementById('p2p-tab-join')?.click();
        const inp = document.getElementById('p2p-room-input');
        if (inp) inp.value = code;
        this.ui.p2pController.joinRoom(code);
        if (window.audioManager) window.audioManager.playClick();
    }

    async _lobbyQuickMatch() {
        const btn = document.getElementById('lobby-quick-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ 匹配中...'; }
        // 匹配到后 Host 用自己的开始菜单设置
        this._lobbyGameRounds = parseInt(this.ui.roundSelect?.value||this.ui.roundOptions?.[this.ui.currentRoundIndex||0]?.value||8,10);
        this._lobbyGameDiff   = this.ui.difficultySelect?.value||this.ui.difficultyOptions?.[this.ui.currentDifficultyIndex||0]?.value||'normal';
        this._updateP2PStatus('connecting', '正在寻找对手...');
        await this._lobby?.quickMatch();
        if (btn) { btn.disabled = false; btn.textContent = '🎲 快速匹配'; }
    }

    _lobbyOnMatched(data) {
        this._lobby?.disconnect();
        if (data.isHost) {
            // 我是房主：创建房间并等待
            this.ui.p2pController.roomCode = data.roomCode;
            this._updateP2PStatus('connecting', `匹配成功！房间 ${data.roomCode}，等待对手...`);
            document.getElementById('p2p-room-code-display').style.display = 'flex';
            document.getElementById('p2p-room-code-text').textContent = data.roomCode;
            document.getElementById('p2p-tab-create')?.click();
            this.ui.p2pController.createRoomWithCode?.(data.roomCode);
        } else {
            // 我是访客：加入房间
            this._updateP2PStatus('connecting', '匹配成功！正在连接...');
            document.getElementById('p2p-tab-join')?.click();
            const inp = document.getElementById('p2p-room-input');
            if (inp) inp.value = data.roomCode;
            this.ui.p2pController.joinRoom(data.roomCode);
        }
        if (window.audioManager) window.audioManager.playClick();
    }

    _receiveGameInit(config) {
        if (this.ui.gameOverModal?.style.display !== 'none') this.ui.hideModal(this.ui.gameOverModal);
        this.ui._markGameActive();
        this.ui.gameController.p2pTimerSync = true;
        this.ui._p2pMeWantRematch = false;
        this.ui._p2pThemWantRematch = false;
        this.ui.gameController.initGame(config.rounds, config.difficulty, 'p2p', config.firstPlayer || 'B');
        this.ui._updateP2PTurnDisplay();
        this.ui._updateP2PStatus('connected', '游戏开始！');
    }

    _applyRemoteAction(action, payload) {
        // 表达式预览：纯UI同步，不改变游戏状态
        if (action === 'expression_change') {
            this.ui._remoteExpression = payload?.expression || '';
            this.ui.updateExpressionDisplay();
            return true;
        }
        // 提交函数：触发完整评估流程
        if (action === 'submit_function') {
            const expr = payload?.expression;
            if (!expr) return false;
            const ok = this.ui.gameController.submitFunction(expr);
            if (!ok) return false;
            this.ui.renderAndEvaluate(expr).then(() => {
                if (this.ui.p2pController?.isHost) {
                    this.ui._p2pSyncScores();
                } else if (this.ui._lastStateSync) {
                    // state_sync 可能在本地 eval 前到达并被覆盖，重新应用
                    this.ui._applyStateSync(this.ui._lastStateSync);
                }
            }).catch(e => console.error('[P2P] renderAndEvaluate:', e));
            this.ui._updateP2PTurnDisplay();
            return true;
        }
        // 通用游戏动作
        const ok = this.ui.gameController.applyRemoteAction(action, payload);
        if (ok === false) return false;
        this.ui._updateP2PTurnDisplay();
        if (action === 'lock_element' || action === 'unlock_element') {
            if (this.ui.gameController.currentPhase === 'set_locks') this.ui.initLockElementsView();
        } else if (action === 'confirm_target' || action === 'confirm_forbidden' || action === 'confirm_locks') {
            this.ui.gridSystem.draw?.();
            this.ui.updateExpressionDisplay();
        }
        return true;
    }

    _handleNack(action, rollback, reason) {
        console.warn('[P2P] nack:', action, reason);
        if (typeof rollback === 'function') rollback();
        this.ui.showMessage('操作失败，请重试', 'warning');
        // 刷新相关UI
        if (action === 'lock_element' || action === 'unlock_element') this.ui.initLockElementsView();
    }

    _updateP2PTurnDisplay() {
        if (!this.ui.gameController.isP2PMode() || !this.ui.p2pController) return;
        const myId = this.ui.p2pController.getMyPlayerId();
        const isMyTurn = this.ui.p2pController.isMyTurn(this.ui.gameController.currentPlayer);
        if (this.ui.phaseHintElement) {
            const phaseNames = { 'select_target': '选择目标网格', 'set_forbidden': '设置禁区', 'set_locks': '锁定元素', 'input_function': '构建函数表达式', 'evaluate': '评估中...', 'settle': '结算中...', 'switch_player': '切换回合...' };
            const phaseText = phaseNames[this.ui.gameController.currentPhase] || this.ui.gameController.currentPhase;
            this.ui.phaseHintElement.textContent = (isMyTurn ? '【你的回合】' : '【对方回合】') + ' ' + phaseText;
        }
        if (this.ui.currentPlayerElement) {
            const playerName = this.ui.gameController.currentPlayer === 'A' ? '玩家 A' : '玩家 B';
            this.ui.currentPlayerElement.textContent = playerName + ((this.ui.gameController.currentPlayer === myId) ? '（你）' : '（对手）');
        }
    }

    _isP2PBlocked() {
        if (!this.ui.gameController.isP2PMode() || !this.ui.p2pController) return false;
        if (!this.ui.p2pController.isConnected) { this.ui.showMessage('等待对手连接...', 'warning'); return true; }
        return !this.ui.p2pController.isMyTurn(this.ui.gameController.currentPlayer);
    }

    _p2pSyncScores() {
        if (!this.ui.p2pController?.isConnected || !this.ui.p2pController.isHost) return;
        const gc = this.ui.gameController;
        this.ui.p2pController.sendStateSync({
            scores: { A: gc.players.A.score, B: gc.players.B.score },
            round: gc.currentRound,
            phase: gc.currentPhase,
            roundState: {
                targetCells:    gc.roundState.targetCells,
                forbiddenCells: gc.roundState.forbiddenCells,
                lockedElements: gc.roundState.lockedElements
            }
        });
    }

    _applyStateSync(state) {
        if (!state?.scores) return;
        this.ui._lastStateSync = state;
        this.ui.gameController.players.A.score = state.scores.A;
        this.ui.gameController.players.B.score = state.scores.B;
        this.ui.updateScoreboard();
        if (this.ui.gameOverModal?.style.display !== 'none') {
            const { A, B } = state.scores;
            this.ui.winnerElement.textContent = A > B ? '玩家 A 获胜！' : B > A ? '玩家 B 获胜！' : '平局！';
            this.ui.finalScoresElement.innerHTML = `<div>玩家A: ${A} 分</div><div>玩家B: ${B} 分</div>`;
        }
    }

    _cleanupP2P() {
        if (this._lobby) { this._lobby.disconnect(); this._lobby = null; }
        if (this.ui.p2pController) {
            this.ui.p2pController.disconnect();
            this.ui.p2pController = null;
        }
        this.ui.gameController.gameMode = 'local';
        this.ui.gameController.p2pTimerSync = false;
        this.ui._remoteExpression = '';
        this.ui._lastStateSync = null;
        this.ui._p2pMeWantRematch = false;
        this.ui._p2pThemWantRematch = false;
        this.ui._p2pFirstPlayer = 'B';
        this._lobbyGameRounds = null;
        this._lobbyGameDiff   = null;
    }

    _requestP2PRematch() {
        if (!this.ui.p2pController?.isConnected) return;
        this.ui._p2pMeWantRematch = true;
        this.ui.p2pController.sendRematchRequest();
        const btn = document.getElementById('p2p-rematch-btn');
        if (btn) { btn.disabled = true; btn.textContent = '等待对手...'; }
        if (this.ui._p2pThemWantRematch) this.ui._checkAndStartRematch();
    }

    _checkAndStartRematch() {
        if (!this.ui._p2pMeWantRematch || !this.ui._p2pThemWantRematch) return;
        // 立即清标志，防止双端同时进入时 double-flip
        this.ui._p2pMeWantRematch = false;
        this.ui._p2pThemWantRematch = false;
        this.ui.p2pController.flipRoleForRematch();
        if (!this.ui.p2pController.isHost) return; // 新 Guest 等待 game_init
        const rounds = this.ui.gameController.totalRounds;
        const difficulty = this.ui.gameController.difficulty;
        const nextFirst = this.ui._p2pFirstPlayer === 'B' ? 'A' : 'B';
        this.ui._p2pFirstPlayer = nextFirst;
        this.ui._p2pMeWantRematch = false;
        this.ui._p2pThemWantRematch = false;
        this.ui._markGameActive();
        this.ui.gameController.p2pTimerSync = false;
        this.ui.hideModal(this.ui.gameOverModal);
        this.ui.gameController.initGame(rounds, difficulty, 'p2p', nextFirst);
        this.ui.p2pController.sendGameInit({ rounds, difficulty, firstPlayer: nextFirst });
        this.ui._updateP2PTurnDisplay();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = P2PView;
}
