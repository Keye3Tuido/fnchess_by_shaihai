/**
 * AudioModule — 音频模块（Controller + Model）
 * 层级：Domain Layer
 * 职责：BGM 播放列表、音效触发、音量持久化
 * Delegate（注入）：AudioManager（底层实现）
 * View 层由 AudioModuleView（独立文件）外部挂载
 */
class AudioModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    init(audioManagerDelegate) {
        this._delegate = audioManagerDelegate || window.audioManager;
        this._listeners = {};
    }

    destroy() {
        this._delegate?.stopBgm();
        this._listeners = {};
    }

    // ─── Controller（对外接口） ───────────────────────────────────────────────

    startBgm()                        { this._delegate?.startBgm(); }
    stopBgm()                         { this._delegate?.stopBgm(); }
    playClick()                       { this._delegate?.playClick(); }
    playElementClick()                { this._delegate?.playElementClick(); }
    playTick()                        { this._delegate?.playTick(); }
    playError()                       { this._delegate?.playError(); }
    playSuccess()                     { this._delegate?.playSuccess(); }
    playGameWin()                     { this._delegate?.playGameWin(); }
    playPhaseChange()                 { this._delegate?.playPhaseChange(); }
    playSummaGrab()                   { this._delegate?.playSummaGrab(); }
    playSummaDrag()                   { this._delegate?.playSummaDrag(); }
    playSummaThrow()                  { this._delegate?.playSummaThrow(); }
    playSummaFling()                  { this._delegate?.playSummaFling(); }
    playSummaTalkSequence(text, mood, onChar) {
        this._delegate?.playSummaTalkSequence(text, mood, onChar);
    }

    /** 请求打开设置弹窗（通知 View 层） */
    openSettings() { this._emit('settingsRequested'); }

    // ─── EventEmitter ─────────────────────────────────────────────────────────

    on(event, fn)  { this._listeners[event] = fn; }
    off(event)     { delete this._listeners[event]; }
    _emit(event)   { if (this._listeners[event]) this._listeners[event](); }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioModule;
}
