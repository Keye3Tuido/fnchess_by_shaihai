/**
 * CharacterModule — Summa 角色模块
 * 层级：Domain Layer
 * 职责：情绪状态机、对话气泡驱动；独占 #summa-container DOM 区域
 * Delegate（注入）：SummaCharacter（底层动画 + 对话实现）
 */
class CharacterModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    /** 传入 SummaCharacter 实例作为 delegate */
    init(characterDelegate) {
        this._delegate = characterDelegate || window.summaCharacter;
    }

    destroy() {
        // SummaCharacter 没有显式销毁接口；动画帧由其内部管理
        this._delegate = null;
    }

    // ─── Controller（对外接口） ───────────────────────────────────────────────

    /** 设置情绪表情 */
    setEmotion(mood, animated = true) {
        if (!this._delegate) return;
        animated
            ? this._delegate.setExpressionAnimated(mood)
            : this._delegate.setExpression(mood);
    }

    /** 说一句自定义台词 */
    say(message, mood = 'neutral') {
        this._delegate?.say(message, mood);
    }

    /** 根据预设情境触发对话 */
    react(situation, payload = {}) {
        if (!this._delegate) return;
        switch (situation) {
            case 'start':          return this._delegate.reactStart();
            case 'aiThink':        return this._delegate.reactAiThink();
            case 'aiPlay':         return this._delegate.reactAiPlay(payload);
            case 'playerAction':   return this._delegate.reactPlayerAction(payload.phase);
            case 'aiSuccess':      return this._delegate.reactAiSuccess(payload);
            case 'aiError':        return this._delegate.reactAiError();
            case 'playerSuccess':  return this._delegate.reactPlayerSuccess();
            case 'playerError':    return this._delegate.reactPlayerError();
            case 'win':            return this._delegate.reactWin();
            case 'lose':           return this._delegate.reactLose();
            default:
                console.warn('[CharacterModule] 未知情境:', situation);
        }
    }

    /** 显示/隐藏角色 */
    show(mode) { this._delegate?.show(mode); }

    /** 眼珠追踪模式 */
    setLookMode(mode) { this._delegate?.setLookMode(mode); }

    // ─── 别名方法（供 UIController 直接调用，兼容旧路径） ────────────────────
    reactStart()                 { this.react('start'); }
    reactAiThink()               { this.react('aiThink'); }
    reactAiPlay(payload)         { this.react('aiPlay', payload || {}); }
    reactPlayerAction(phase)     { this.react('playerAction', { phase }); }
    reactAiSuccess(payload)      { this.react('aiSuccess', payload || {}); }
    reactAiError()               { this.react('aiError'); }
    reactPlayerSuccess()         { this.react('playerSuccess'); }
    reactPlayerError()           { this.react('playerError'); }
    reactWin()                   { this.react('win'); }
    reactLose()                  { this.react('lose'); }

    /**
     * 设置语音队列清空回调（用于等待台词结束后再触发下一逻辑）
     * @param {Function|null} fn
     */
    set onSpeechQueueEmpty(fn) {
        if (this._delegate) this._delegate.onSpeechQueueEmpty = fn;
    }
    get onSpeechQueueEmpty() {
        return this._delegate?.onSpeechQueueEmpty ?? null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterModule;
}
