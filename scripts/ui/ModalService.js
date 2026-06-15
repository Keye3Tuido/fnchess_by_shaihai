/**
 * ModalService — 模态框动效状态机
 * 层级：UI 工具服务（由 UIController 持有）
 * 职责：showModal / hideModal 的状态机逻辑（防重复触发、退场动画竞态保护）
 */
class ModalService {
    constructor() {
        this._states      = new Map(); // el → 'hidden'|'entering'|'visible'|'exiting'
        this._exitFinishers = new Map();
        this._skipCallbacks = new Map();
    }

    getState(el) { return this._states.get(el) || 'hidden'; }
    setState(el, s) { this._states.set(el, s); }

    show(modal, display = 'flex') {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) return;
        const s = this.getState(el);
        if (s === 'visible' || s === 'entering') return;
        if (s === 'exiting') {
            el.classList.remove('modal-exiting');
            el.removeEventListener('animationend', this._exitFinishers.get(el));
            this._exitFinishers.delete(el);
            el.style.display = 'none';
            this.setState(el, 'hidden');
            this._skipCallbacks.delete(el);
        }
        this.setState(el, 'entering');
        el.classList.remove('modal-exiting');
        el.style.display = display;
        void el.offsetWidth;
        el.classList.add('modal-entering');
        const onEnd = () => {
            el.classList.remove('modal-entering');
            el.removeEventListener('animationend', onEnd);
            this.setState(el, 'visible');
        };
        el.addEventListener('animationend', onEnd);
    }

    hide(modal, callback) {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) { if (callback) callback(); return; }
        const computed = window.getComputedStyle(el).display;
        if (el.style.display === 'none' || computed === 'none') {
            this.setState(el, 'hidden');
            if (callback) callback();
            return;
        }
        const s = this.getState(el);
        if (s === 'exiting' || s === 'hidden') { if (callback) callback(); return; }
        if (s === 'entering') el.classList.remove('modal-entering');
        this.setState(el, 'exiting');
        el.classList.remove('modal-entering');
        el.classList.add('modal-exiting');
        let called = false;
        const done = () => {
            if (called) return; called = true;
            el.classList.remove('modal-exiting');
            el.style.display = 'none';
            this.setState(el, 'hidden');
            this._exitFinishers.delete(el);
            this._skipCallbacks.delete(el);
            if (callback) callback();
        };
        const onEnd = () => { el.removeEventListener('animationend', onEnd); done(); };
        this._exitFinishers.set(el, onEnd);
        el.addEventListener('animationend', onEnd);
        setTimeout(() => { if (this.getState(el) === 'exiting') done(); }, 400);
    }
    showModal(modal, display = 'flex') {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) return;

        const state = this.ui._getModalState(el);
        // 已在显示或正在入场 → 忽略
        if (state === 'visible' || state === 'entering') return;

        // 正在退场中：立即同步完成上一次隐藏（彻底杜绝竞态）
        if (state === 'exiting') {
            // 取消退场动画和监听器
            el.classList.remove('modal-exiting');
            el.removeEventListener('animationend', this.ui._modalExitFinishers.get(el));
            this.ui._modalExitFinishers.delete(el);
            // 立即完成隐藏：display:none + 状态归 hidden
            el.style.display = 'none';
            this.ui._setModalState(el, 'hidden');
            this.ui._modalSkipCallbacks.delete(el);
        }

        this.ui._setModalState(el, 'entering');
        el.classList.remove('modal-exiting');
        el.style.display = display;

        // 强制 reflow 确保动画从头播放
        void el.offsetWidth;

        el.classList.add('modal-entering');

        const onEnterEnd = () => {
            el.classList.remove('modal-entering');
            el.removeEventListener('animationend', onEnterEnd);
            this.ui._setModalState(el, 'visible');
        };
        el.addEventListener('animationend', onEnterEnd);
    }

    hideModal(modal, callback) {
        const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
        if (!el) {
            if (callback) callback();
            return;
        }

        const computed = window.getComputedStyle(el).display;
        const styleNone = el.style.display === 'none';
        // 已经隐藏了
        if (styleNone || computed === 'none') {
            this.ui._setModalState(el, 'hidden');
            if (callback) callback();
            return;
        }

        const state = this.ui._getModalState(el);
        // 已经在退场或已隐藏 → 忽略（callback 至多执行一次）
        if (state === 'exiting' || state === 'hidden') {
            if (callback) callback();
            return;
        }
        // 正在入场：先取消入场类
        if (state === 'entering') {
            el.classList.remove('modal-entering');
        }

        this.ui._setModalState(el, 'exiting');
        el.classList.remove('modal-entering');
        el.classList.add('modal-exiting');

        let called = false;
        const doCallback = () => {
            if (called) return;
            called = true;
            el.classList.remove('modal-exiting');
            el.style.display = 'none';
            this.ui._setModalState(el, 'hidden');
            this.ui._modalExitFinishers.delete(el);
            this.ui._modalSkipCallbacks.delete(el);
            if (callback) callback();
        };

        const onExitEnd = () => {
            el.removeEventListener('animationend', onExitEnd);
            doCallback();
        };
        // 记录退场监听器引用，以便 showModal 在需要时强制移除
        this.ui._modalExitFinishers.set(el, onExitEnd);
        el.addEventListener('animationend', onExitEnd);

        // 保险：若动画未正常触发，400ms 后强制完成
        setTimeout(() => {
            if (this.ui._getModalState(el) === 'exiting') {
                doCallback();
            }
        }, 400);
    }

}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalService;
}
