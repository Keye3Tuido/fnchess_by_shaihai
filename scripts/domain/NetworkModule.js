/**
 * NetworkModule — P2P 网络模块
 * 层级：Domain Layer
 * 职责：封装 WebRTC P2P 连接层；管理连接建立、消息收发、心跳
 * Delegate（注入）：P2PController（底层 Peer.js 实现）
 */
class NetworkModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    /** @param {P2PController} p2pController */
    init(p2pController) {
        this._p2p = p2pController;
    }

    destroy() {
        this._p2p?.disconnect();
        this._p2p = null;
    }

    // ─── Controller（对外接口） ───────────────────────────────────────────────

    /** 创建房间（Host） */
    async createRoom() {
        return this._p2p?.createRoom();
    }

    /** 加入房间（Guest） */
    async joinRoom(roomCode) {
        return this._p2p?.joinRoom(roomCode);
    }

    /** 断开连接 */
    disconnect() {
        return this._p2p?.disconnect();
    }

    /** 发送带 ack 的游戏动作 */
    sendGameAction(action, payload, rollback) {
        return this._p2p?.sendGameAction(action, payload, rollback);
    }

    /** 发送游戏初始化（Host 调用） */
    sendGameInit(config) {
        return this._p2p?.sendGameInit(config);
    }

    /** 发送计时同步 */
    sendTimerSync(remainingTime) {
        return this._p2p?.sendTimerSync(remainingTime);
    }

    /** 发送超时通知 */
    sendTimeout(player) {
        return this._p2p?.sendTimeout(player);
    }

    /** 发送状态同步 */
    sendStateSync(state) {
        return this._p2p?.sendStateSync(state);
    }

    /** 发送再来一局请求 */
    sendRematchRequest() {
        return this._p2p?.sendRematchRequest();
    }

    /** 翻转 Host/Guest 角色（再来一局） */
    flipRoleForRematch() {
        return this._p2p?.flipRoleForRematch();
    }

    // ─── 查询 ────────────────────────────────────────────────────────────────

    get isConnected()  { return this._p2p?.isConnected  ?? false; }
    get isHost()       { return this._p2p?.isHost        ?? false; }
    get roomCode()     { return this._p2p?.roomCode      ?? ''; }
    get myPlayerId()   { return this._p2p?.myPlayerId    ?? ''; }

    isMyTurn(currentPlayer) { return this._p2p?.isMyTurn(currentPlayer) ?? false; }

    /** 暴露底层 P2PController 引用（过渡期供 UIController 直接访问回调） */
    get raw() { return this._p2p; }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkModule;
}
