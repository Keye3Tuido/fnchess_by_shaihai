/**
 * LobbyClient — 匹配大厅客户端
 * 层级：Core Layer
 * 职责：SSE 大厅连接、房间列表订阅、创建/加入/快速匹配
 */
class LobbyClient {
    constructor() {
        this._es = null;          // EventSource
        this._server = '';       // 大厅服务器地址
        this.rooms = [];         // 当前房间列表
        this.onlineCount = 0;

        // ── 回调 ──
        this.onRoomList  = null;  // (rooms, onlineCount) => void
        this.onMatched   = null;  // ({ roomCode, isHost }) => void
        this.onError     = null;  // (message) => void
        this.onStatus    = null;  // (status, message) => void
    }

    /** 连接大厅 SSE 流 */
    connect(serverHost) {
        // 防止重复连接泄露
        if (this._es) { this._es.close(); this._es = null; }
        this._server = `https://${serverHost}/lobby`;
        this._notify('connecting', '正在连接大厅...');
        this._es = new EventSource(`${this._server}/stream`);
        this._es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'room_list') {
                    this.rooms = data.rooms || [];
                    this.onlineCount = data.online || 0;
                    if (this.onRoomList) this.onRoomList(this.rooms, this.onlineCount);
                }
            } catch (err) { /* ignore parse errors */ }
        };
        this._es.onopen = () => this._notify('connected', '已连接大厅');
        this._es.onerror = () => {
            this._notify('error', '大厅连接断开，正在重连...');
            if (this.onError) this.onError('大厅连接失败');
        };
    }

    /** 断开大厅 */
    disconnect() {
        if (this._es) { this._es.close(); this._es = null; }
        this.rooms = [];
        this.onlineCount = 0;
        this._notify('idle', '已离开大厅');
    }

    // ─── 大厅操作 ──────────────────────────────────────────

    async createRoom(rounds, difficulty) {
        try {
            const resp = await fetch(`${this._server}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rounds, difficulty })
            });
            if (!resp.ok) throw new Error((await resp.json()).error || '创建失败');
            return (await resp.json()).roomCode;
        } catch (e) {
            if (this.onError) this.onError(e.message);
            return null;
        }
    }

    async joinRoom(roomCode) {
        try {
            const resp = await fetch(`${this._server}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode })
            });
            if (!resp.ok) throw new Error((await resp.json()).error || '加入失败');
            const data = await resp.json();
            return { roomCode: data.roomCode, rounds: data.rounds, difficulty: data.difficulty };
        } catch (e) {
            if (this.onError) this.onError(e.message);
            return null;
        }
    }

    async quickMatch() {
        try {
            const resp = await fetch(`${this._server}/quick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!resp.ok) throw new Error((await resp.json()).error || '匹配失败');
            const data = await resp.json();
            if (data.matched) {
                if (this.onMatched) this.onMatched(data);
            } else {
                if (this.onError) this.onError(data.reason || '匹配超时');
            }
        } catch (e) {
            if (this.onError) this.onError(e.message);
        }
    }

    async cancel(roomCode) {
        try {
            await fetch(`${this._server}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode })
            });
        } catch (e) { /* ignore */ }
    }

    // ─── 内部 ──────────────────────────────────────────────

    _notify(status, message) {
        if (this.onStatus) this.onStatus(status, message);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LobbyClient;
}
