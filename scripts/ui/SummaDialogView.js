class SummaDialogView {
    constructor(ui) { this.ui = ui; }

    bindSummaDialogEvents() {
        document.getElementById('summa-dialog-input-cancel')?.addEventListener('click', () => {
            if (window.audioManager) window.audioManager.playClick();
            this.ui.summaDialogResolve && this.ui.summaDialogResolve(null);
            this.ui.hideSummaDialog();
        });
        
        document.getElementById('summa-dialog-input-confirm')?.addEventListener('click', () => {
            if (window.audioManager) window.audioManager.playClick();
            const value = this.ui.summaDialogInput.value;
            this.ui.summaDialogResolve && this.ui.summaDialogResolve(value);
            this.ui.hideSummaDialog();
        });
        
        this.ui.summaDialogInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const value = this.ui.summaDialogInput.value;
                this.ui.summaDialogResolve && this.ui.summaDialogResolve(value);
                this.ui.hideSummaDialog();
            }
        });
    }

    showGameDialog(options) {
        return new Promise((resolve) => {
            this.ui.summaDialogResolve = resolve;

            const sd = this.ui.summaDialog;
            if (sd) {
                const s = this.ui._getModalState(sd);
                if (s === 'exiting' || s === 'entering') {
                    sd.classList.remove('modal-entering', 'modal-exiting');
                    sd.style.display = 'none';
                    const finisher = this.ui._modalExitFinishers.get(sd);
                    if (finisher) { sd.removeEventListener('animationend', finisher); }
                    this.ui._modalExitFinishers.delete(sd);
                    this.ui._modalSkipCallbacks.delete(sd);
                    this.ui._setModalState(sd, 'hidden');
                }
            }

            const {
                title = '提示',
                message = '',
                options: optButtons = [],
                showInput = false,
                inputPlaceholder = '',
                defaultValue = '',
                showSkip = true,
                skipText = '跳过，直接使用现有模型'
            } = options;
            
            this.ui.summaDialogTitle.textContent = title;
            this.ui.summaDialogMessage.innerHTML = message.replace(/\n/g, '<br>');
            
            this.ui.summaDialogOptions.innerHTML = '';
            
            if (showInput) {
                this.ui.summaDialogOptions.style.display = 'none';
                this.ui.summaDialogInputArea.style.display = 'block';
                this.ui.summaDialogInput.value = defaultValue;
                this.ui.summaDialogInput.placeholder = inputPlaceholder;
                setTimeout(() => this.ui.summaDialogInput.focus(), 100);
            } else {
                this.ui.summaDialogOptions.style.display = 'grid';
                this.ui.summaDialogInputArea.style.display = 'none';

                optButtons.forEach(opt => {
                    const btn = document.createElement('button');
                    btn.className = 'summa-dialog-option-btn';
                    btn.textContent = opt.label;
                    btn.addEventListener('click', () => {
                        resolve(opt.value);
                        this.ui.hideSummaDialog();
                    });
                    this.ui.summaDialogOptions.appendChild(btn);
                });

                const footerActions = document.querySelector('.summa-dialog-footer-actions');
                const skipBtn = document.getElementById('summa-dialog-skip-btn');
                const exitBtn = document.getElementById('summa-dialog-exit-btn');

                if (footerActions && skipBtn && exitBtn) {
                    footerActions.style.display = showSkip ? 'flex' : 'none';
                    skipBtn.textContent = skipText;
                    skipBtn.onclick = () => {
                        if (window.audioManager) window.audioManager.playClick();
                        resolve(null);
                        this.ui.hideSummaDialog();
                    };
                    exitBtn.textContent = '退出';
                    exitBtn.onclick = () => {
                        if (window.audioManager) window.audioManager.playClick();
                        this.ui.forceStopGame();
                        this.ui.hideSummaDialog();
                        this.ui.showModal(this.ui.startModal);
                    };
                }
            }
            
            this.ui.showModal(this.ui.summaDialog);
        });
    }

    hideSummaDialog() {
        this.ui.hideModal(this.ui.summaDialog, () => {
            this.ui.summaDialogResolve = null;
        });
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=SummaDialogView;