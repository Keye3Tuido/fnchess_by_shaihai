/**
 * P2PController - P2P 联机对战控制器
 * 基于 PeerJS (WebRTC DataChannel) 实现跨网络 P2P 连接
 * 
 * 架构：
 * - Host（房主）创建房间 → 获得房间码 → 等待 Guest 加入
 * - Guest（访客）输入房间码 → 连接到 Host
 * - 连接成功后通过 DataChannel 同步游戏操作
 * - Host = 玩家A, Guest = 玩家B
 */
class P2PController {
    constructor() {
        this.peer = null;          // PeerJS 实例
        this.conn = null;          // DataConnection 实例
        this.isHost = false;       // 是否是房主
        this.roomCode = '';        // 当前房间码
        this.isConnected = false;  // 是否已连接
        this.isConnecting = false; // 是否正在连接中
        this._timeoutId = null;    // 连接超时计时器
        this.myPlayerId = '';      // 'A' 或 'B'
        this.opponentPlayerId = '';// 对方玩家ID

        // 回调
        this.onStatusChange = null;    // (status, message) => {}
        this.onGameAction = null;      // (action) => {}  收到对方操作
        this.onConnected = null;       // () => {}
        this.onDisconnected = null;    // () => {}
        this.onError = null;           // (error) => {}

        // STUN 服务器列表（用于 NAT 穿透）
        // Cloudflare 在国内可达；腾讯/小米为国内常用 STUN
        this.iceServers = [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.qq.com:3478' },
            { urls: 'stun:stun.miwifi.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' }
        ];

        // 房间码字符集（排除易混淆字符: 0/O/1/I/L）
        this._codeChars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    }

    /**
     * 生成6位房间码
     */
    _generateRoomCode() {
        let code = '';
        const len = this._codeChars.length;
        for (let i = 0; i < 6; i++) {
            code += this._codeChars[Math.floor(Math.random() * len)];
        }
        return code;
    }

    /**
     * 创建房间（作为房主）
     */
    createRoom() {
        if (this.isConnecting || this.isConnected) {
            this._notifyStatus('error', '已有进行中的连接');
            return;
        }

        this.roomCode = this._generateRoomCode();
        this.isHost = true;
        this.myPlayerId = 'A';
        this.opponentPlayerId = 'B';
        this.isConnecting = true;

        this._notifyStatus('connecting', '正在创建房间...');
        this._startTimeout('创建房间超时，请检查网络后重试');

        try {
            this.peer = new Peer(this.roomCode, {
                debug: 0,
                config: { iceServers: this.iceServers }
            });

            this.peer.on('open', (id) => {
                console.log('[P2P] 房间已创建，房间码:', id);
                this._clearTimeout();
                this._notifyStatus('waiting', '等待对手加入...');
                // Guest 连接超时：60 秒无人加入
                this._startTimeout('等待对手超时，请确认房间码已分享给对方', 60000);
            });

            this.peer.on('connection', (conn) => {
                console.log('[P2P] 收到连接请求');
                this._clearTimeout();
                this._setupConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[P2P] Peer错误:', err);
                this._handleError(err);
            });

            this.peer.on('disconnected', () => {
                console.log('[P2P] Peer断开，尝试重连...');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });

        } catch (err) {
            console.error('[P2P] 创建Peer失败:', err);
            this._handleError(err);
        }
    }

    /**
     * 加入房间（作为访客）
     * @param {string} roomCode - 房间码
     */
    joinRoom(roomCode) {
        if (this.isConnecting || this.isConnected) {
            this._notifyStatus('error', '已有进行中的连接');
            return;
        }

        const normalized = roomCode.trim().toUpperCase();
        if (normalized.length !== 6) {
            this._notifyStatus('error', '房间码必须是6位字符');
            return;
        }

        this.roomCode = normalized;
        this.isHost = false;
        this.myPlayerId = 'B';
        this.opponentPlayerId = 'A';
        this.isConnecting = true;

        this._notifyStatus('connecting', '正在连接房间...');
        this._startTimeout('连接房间超时，请检查房间码和网络后重试');

        try {
            const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);

            this.peer = new Peer(guestId, {
                debug: 0,
                config: { iceServers: this.iceServers }
            });

            this.peer.on('open', (id) => {
                console.log('[P2P] 访客Peer已就绪，连接到房间:', normalized);
                const conn = this.peer.connect(normalized, {
                    reliable: true
                });
                this._setupConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('[P2P] Peer错误:', err);
                this._handleError(err);
            });

            this.peer.on('disconnected', () => {
                console.log('[P2P] Peer断开，尝试重连...');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });

        } catch (err) {
            console.error('[P2P] 创建Peer失败:', err);
            this._handleError(err);
        }
    }

    /**
     * 设置 DataConnection
     */
    _setupConnection(conn) {
        this._clearTimeout();
        this.conn = conn;

        conn.on('open', () => {
            console.log('[P2P] DataConnection已建立');
            this.isConnected = true;
            this.isConnecting = false;

            // 通知连接成功
            this._notifyStatus('connected',
                this.isHost ? '对手已加入！游戏即将开始...' : '已连接到房间！游戏即将开始...');

            if (this.onConnected) {
                this.onConnected();
            }
        });

        conn.on('data', (data) => {
            this._handleMessage(data);
        });

        conn.on('close', () => {
            console.log('[P2P] DataConnection关闭');
            this._handleDisconnect();
        });

        conn.on('error', (err) => {
            console.error('[P2P] DataConnection错误:', err);
            this._handleDisconnect();
        });
    }

    /**
     * 处理收到的消息
     */
    _handleMessage(data) {
        if (!data || !data.type) return;

        console.log('[P2P] 收到消息:', data.type);

        switch (data.type) {
            case 'game_init':
                // Host 发送的初始游戏配置
                if (this.onGameAction) {
                    this.onGameAction({ type: 'game_init', config: data.config });
                }
                break;

            case 'action':
                // 对方执行的操作
                if (this.onGameAction) {
                    this.onGameAction({ type: 'action', action: data.action, payload: data.payload });
                }
                break;

            case 'state_sync':
                if (this.onGameAction) {
                    this.onGameAction({ type: 'state_sync', state: data.state });
                }
                break;

            case 'timer_sync':
                if (this.onGameAction) {
                    this.onGameAction({ type: 'timer_sync', remainingTime: data.remainingTime });
                }
                break;

            case 'timeout':
                if (this.onGameAction) {
                    this.onGameAction({ type: 'timeout', player: data.player });
                }
                break;

            case 'chat':
                // 预留聊天功能
                break;

            case 'ping':
                this.send({ type: 'pong' });
                break;

            default:
                console.warn('[P2P] 未知消息类型:', data.type);
        }
    }

    /**
     * 发送消息
     */
    send(data) {
        if (!this.conn || !this.isConnected) {
            console.warn('[P2P] 未连接，无法发送消息');
            return false;
        }
        try {
            this.conn.send(data);
            return true;
        } catch (err) {
            console.error('[P2P] 发送消息失败:', err);
            return false;
        }
    }

    /**
     * 发送游戏初始化配置（仅Host调用）
     */
    sendGameInit(config) {
        this.send({
            type: 'game_init',
            config: config
        });
    }

    /**
     * 发送游戏操作
     */
    sendAction(action, payload) {
        this.send({
            type: 'action',
            action: action,
            payload: payload
        });
    }

    /**
     * 发送状态同步
     */
    sendStateSync(state) {
        this.send({
            type: 'state_sync',
            state: state
        });
    }

    /**
     * 发送计时同步（Host → Guest）
     */
    sendTimerSync(remainingTime) {
        this.send({
            type: 'timer_sync',
            remainingTime: remainingTime
        });
    }

    /**
     * 发送超时通知（Host → Guest）
     */
    sendTimeout(player) {
        this.send({
            type: 'timeout',
            player: player
        });
    }

    /**
     * 处理错误
     */
    _handleError(err) {
        this.isConnecting = false;
        this.isConnected = false;

        let message = '连接失败';
        if (err && err.type === 'peer-unavailable') {
            message = '无法连接到房间，请检查房间码是否正确';
        } else if (err && err.type === 'network') {
            message = '网络连接失败，请检查网络后重试';
        } else if (err && err.type === 'server-error') {
            message = '信令服务器异常，请稍后重试';
        } else if (err && err.type === 'timeout') {
            message = err.message || '连接超时，请重试';
        } else if (err && err.message) {
            message = err.message;
        }

        this._notifyStatus('error', message);

        if (this.onError) {
            this.onError(err || new Error(message));
        }
    }

    /**
     * 处理断开
     */
    _handleDisconnect() {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.isConnecting = false;

        if (wasConnected) {
            this._notifyStatus('disconnected', '对手已断开连接');
            if (this.onDisconnected) {
                this.onDisconnected();
            }
        }
    }

    /**
     * 通知状态变化
     */
    _notifyStatus(status, message) {
        if (this.onStatusChange) {
            this.onStatusChange(status, message);
        }
    }

    /**
     * 获取对手的玩家ID
     */
    getOpponentPlayerId() {
        return this.opponentPlayerId;
    }

    /**
     * 获取我的玩家ID
     */
    getMyPlayerId() {
        return this.myPlayerId;
    }

    /**
     * 启动连接超时计时器
     * @param {string} message - 超时提示
     * @param {number} duration - 超时毫秒数，默认 30000
     */
    _startTimeout(message, duration = 30000) {
        this._clearTimeout();
        this._timeoutId = setTimeout(() => {
            console.warn('[P2P] 连接超时');
            this._handleError({ type: 'timeout', message: message });
            this.disconnect();
        }, duration);
    }

    /**
     * 清除超时计时器
     */
    _clearTimeout() {
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
    }

    /**
     * 断开连接并清理
     */
    disconnect() {
        this._clearTimeout();
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
        this.isHost = false;
        this.roomCode = '';
        console.log('[P2P] 已断开连接');
    }

    /**
     * 检查是否是我可以操作的阶段
     * @param {string} currentPlayer - 当前 GameController 中的 currentPlayer
     * @returns {boolean}
     */
    isMyTurn(currentPlayer) {
        return currentPlayer === this.myPlayerId;
    }
}
