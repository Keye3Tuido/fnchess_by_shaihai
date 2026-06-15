/**
 * AppView — 顶层视图
 * 层级：App Layer
 * 职责：管理开始界面（模式选择、难度、回合数）；响应 AppController 事件
 * 注：游戏进行中的 UI 由各模式的 View 层负责
 */
class AppView {
    /**
     * @param {AppController} appController
     * @param {UIController} uiController - 过渡期引用，P8-3 后逐步替换
     */
    init(appController, uiController) {
        this._app = appController;
        this._ui  = uiController;
        this._startModal = document.getElementById('start-modal');
    }

    /** 显示开始界面 */
    showStart() {
        if (this._startModal && this._ui) {
            this._ui.showModal(this._startModal);
        }
    }

    /** 隐藏开始界面 */
    hideStart() {
        if (this._startModal && this._ui) {
            this._ui.hideModal(this._startModal);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppView;
}
