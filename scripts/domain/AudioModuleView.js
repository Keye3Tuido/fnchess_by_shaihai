/**
 * AudioModuleView — 音频模块视图层
 * 层级：Domain Layer / View
 * 职责：独占 #bgm-modal DOM 区域；订阅 AudioModule 事件
 * 由外部（AppView 或 index.html 初始化脚本）实例化并挂载
 */
class AudioModuleView {
    /**
     * @param {AudioModule} audioModule
     */
    init(audioModule) {
        this._module   = audioModule;
        this._delegate = audioModule._delegate; // AudioManager
        this._ls       = [];

        this._modal      = document.getElementById('bgm-modal');
        this._enabledCb  = document.getElementById('bgm-enabled');
        this._bgmSlider  = document.getElementById('bgm-volume');
        this._bgmValue   = document.getElementById('bgm-volume-value');
        this._sfxSlider  = document.getElementById('sfx-volume');
        this._sfxValue   = document.getElementById('sfx-volume-value');
        this._closeBtn   = document.getElementById('bgm-close-btn');

        // 打开按钮（游戏内 + 开始界面）
        ['bgm-open-btn', 'start-bgm-open-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) this._on(btn, 'click', () => this.openModal());
        });

        this._on(this._closeBtn, 'click', () => {
            this._delegate?.playClick();
            this.closeModal();
        });
        this._on(this._enabledCb, 'change', () => {
            this._delegate?.setBgmEnabled(this._enabledCb.checked);
        });
        this._on(this._bgmSlider, 'input', () => {
            const v = Number(this._bgmSlider.value) / 100;
            if (this._bgmValue) this._bgmValue.textContent = `${this._bgmSlider.value}%`;
            this._delegate?.setBgmVolume(v);
        });
        this._on(this._sfxSlider, 'input', () => {
            const v = Number(this._sfxSlider.value) / 100;
            if (this._sfxValue) this._sfxValue.textContent = `${this._sfxSlider.value}%`;
            this._delegate?.setSfxVolume(v);
        });

        // 订阅 AudioModule 事件
        audioModule.on('settingsRequested', () => this.openModal());
    }

    openModal() {
        if (!this._modal || !this._delegate) return;
        if (this._enabledCb) this._enabledCb.checked = this._delegate.bgmEnabled;
        if (this._bgmSlider) {
            this._bgmSlider.value = String(Math.round(this._delegate.bgmVolume * 100));
            if (this._bgmValue) this._bgmValue.textContent = `${this._bgmSlider.value}%`;
        }
        if (this._sfxSlider) {
            this._sfxSlider.value = String(Math.round((this._delegate.sfxVolume ?? 1) * 100));
            if (this._sfxValue) this._sfxValue.textContent = `${this._sfxSlider.value}%`;
        }
        this._modal.style.display = 'flex';
        this._delegate?.startBgm();
    }

    closeModal() {
        if (this._modal) this._modal.style.display = 'none';
    }

    destroy() {
        this._ls.forEach(({ el, type, fn }) => el?.removeEventListener(type, fn));
        this._ls = [];
        this._module?.off('settingsRequested');
    }

    _on(el, type, fn) {
        if (!el) return;
        el.addEventListener(type, fn);
        this._ls.push({ el, type, fn });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioModuleView;
}
