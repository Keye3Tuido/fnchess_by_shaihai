/**
 * ModeBase — 游戏模式基类
 * 每个具体模式继承此类，重写 setup/teardown 和回调链
 */
class ModeBase {
    constructor(name) {
        this.name = name;
        this._listeners = {};
    }

    // ─── LifecycleService ─────────────────────────────────────────────────────

    /** 模式启动（由 AppController 调用）@param {Object} config */
    setup(config) {}

    /** 模式销毁（由 AppController 调用） */
    teardown() {}

    // ─── 回调链钩子（子类重写） ────────────────────────────────────────────────

    /** 目标格确认后的回调链 */
    onTargetConfirmed(roundState) {}

    /** 禁区确认后的回调链 */
    onForbiddenConfirmed(roundState) {}

    /** 锁定元素确认后的回调链 */
    onLocksConfirmed(roundState) {}

    /** 函数提交后的回调链（核心：渲染→碰撞→计分→推进回合） */
    async onFunctionSubmitted(expression) {}

    // ─── EventEmitter ─────────────────────────────────────────────────────────

    on(event, fn)  { this._listeners[event] = fn; }
    off(event)     { delete this._listeners[event]; }
    emit(event, d) { if (this._listeners[event]) this._listeners[event](d); }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModeBase;
}
