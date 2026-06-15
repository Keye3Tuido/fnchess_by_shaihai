class RandomChallengeUI {
    constructor(parent) { this.parent = parent; }

    _createBestRecordDisplay() {
        
        const old = document.getElementById('random-best-record');
        if (old) old.remove();

        
        const display = document.createElement('div');
        display.id = 'random-best-record';
        display.style.cssText = 'margin-bottom: 8px; padding: 8px; background: rgba(100, 181, 246, 0.15); border-radius: 6px; font-size: 14px; color: #64b5f6;';

        const phaseHint = document.getElementById('phase-hint');
        if (phaseHint && phaseHint.parentElement) {
            phaseHint.parentElement.insertBefore(display, phaseHint);
        }
    }

    _createInGameButtons() {
        
        const old = document.getElementById('random-ingame-buttons');
        if (old) old.remove();

        
        const container = document.createElement('div');
        container.id = 'random-ingame-buttons';
        container.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

        const buttonText = this.parent.isImportMode ? '📥 导入种子' : '🎲 新关卡';
        container.innerHTML = `
            <button id="random-copy-seed-ingame-btn" class="btn btn-secondary btn-small">📋 复制种子</button>
            <button id="random-new-ingame-btn" class="btn btn-secondary btn-small">${buttonText}</button>
        `;

        
        const phaseHint = document.getElementById('phase-hint');
        if (phaseHint && phaseHint.parentElement) {
            phaseHint.parentElement.insertBefore(container, phaseHint.nextSibling);
        }

        
        document.getElementById('random-copy-seed-ingame-btn').onclick = () => {
            this.parent._copySeedWithTokens();
        };

        document.getElementById('random-new-ingame-btn').onclick = () => {
            if (this.parent.isImportMode) {
                this.parent._showImportDialog();
            } else {
                this.parent._startRandomLevel();
            }
        };
    }

    _showModeSelection() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>随机关卡</h2>
                <div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;">
                    <button id="random-new-btn" class="btn btn-primary">随机生成关卡</button>
                    <button id="random-import-btn" class="btn">导入种子关卡</button>
                    <button id="random-back-btn" class="btn btn-secondary">返回</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#random-new-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.parent._startRandomLevel();
        });

        modal.querySelector('#random-import-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.parent._showImportDialog();
        });

        modal.querySelector('#random-back-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.parent.deactivate();
            this.parent.uiController.selectMode('local');
            this.parent.uiController.showModal(this.parent.uiController.startModal);
        });
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=RandomChallengeUI;