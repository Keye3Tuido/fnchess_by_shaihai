/**
 * ExpressionModule — 表达式构建器模块
 * 层级：Domain Layer
 * 职责：管理表达式元素数组、光标位置、拖拽状态；发出变化事件
 * Delegate（注入）：FunctionParser（元素分类）、RenderModule（实时预览）
 */
class ExpressionModule {

    // ─── LifecycleService ─────────────────────────────────────────────────────

    init() {
        this._listeners = {};
        this._reset();
    }

    destroy() {
        this._listeners = {};
        this._reset();
    }

    // ─── BusinessService ──────────────────────────────────────────────────────

    /** 设置当前回合的锁定元素列表（由外部在锁定状态变化时调用） */
    setLockedElements(elements) {
        this._locked = new Set(elements || []);
    }

    /** 检查元素是否被锁定 */
    isLocked(element) {
        return this._locked ? this._locked.has(element) : false;
    }

    /**
     * 在光标处插入元素
     * @param {string} element
     * @param {boolean} isFunction - 函数类型自动追加括号
     */
    insert(element, isFunction = false) {
        if (isFunction) {
            this._elements.splice(this._cursor, 0, element, '(', ')');
            this._cursor += 2;
        } else {
            this._elements.splice(this._cursor, 0, element);
            this._cursor++;
        }
        this._sync();
    }

    /** 退格删除（删光标前一个元素） */
    deleteBack() {
        if (this._cursor > 0) {
            this._elements.splice(this._cursor - 1, 1);
            this._cursor--;
            this._sync();
        }
    }

    /** Delete 键（删光标后一个元素） */
    deleteFwd() {
        if (this._cursor < this._elements.length) {
            this._elements.splice(this._cursor, 1);
            this._sync();
        }
    }

    /** 移动光标 */
    moveCursor(dir) {
        if (dir === 'left'  && this._cursor > 0)                    this._cursor--;
        if (dir === 'right' && this._cursor < this._elements.length) this._cursor++;
        if (dir === 'home') this._cursor = 0;
        if (dir === 'end')  this._cursor = this._elements.length;
        this._emit('cursorMoved', { cursorIndex: this._cursor });
    }

    /** 删除指定索引的元素（拖拽移除） */
    removeAt(index) {
        if (index < 0 || index >= this._elements.length) return;
        this._elements.splice(index, 1);
        if (index < this._cursor) this._cursor--;
        this._cursor = Math.min(this._cursor, this._elements.length);
        this._sync();
    }

    /** 设置完整元素数组（从历史函数加载时使用） */
    setElements(elements, cursorAtEnd = true) {
        this._elements = [...elements];
        this._cursor = cursorAtEnd ? this._elements.length : 0;
        this._sync();
    }

    /** 清空表达式 */
    clear() {
        this._reset();
        this._emit('expressionChanged', { expression: '', elements: [], cursorIndex: 0 });
    }

    // ─── Controller（对外查询接口） ────────────────────────────────────────────

    getExpression()  { return this._expression; }
    getElements()    { return [...this._elements]; }
    getCursorIndex() { return this._cursor; }

    /** EventEmitter */
    on(event, fn)  { this._listeners[event] = fn; }
    off(event)     { delete this._listeners[event]; }

    // ─── 私有 ─────────────────────────────────────────────────────────────────

    _reset() {
        this._elements   = [];
        this._cursor     = 0;
        this._expression = '';
    }

    _sync() {
        this._expression = this._elements.join('');
        this._emit('expressionChanged', {
            expression:  this._expression,
            elements:    [...this._elements],
            cursorIndex: this._cursor
        });
    }

    _emit(event, data) {
        if (this._listeners[event]) this._listeners[event](data);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionModule;
}
