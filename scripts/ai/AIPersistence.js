class AIPersistence {
    constructor(ai) { this.ai = ai; }

    _loadLearnedData() {
        try {
            const saved = localStorage.getItem('summa_learned_data_v1');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.learnedSolutions && Array.isArray(data.learnedSolutions)) {
                    this.ai.learnedSolutions = data.learnedSolutions;
                }
                if (data.learnedTemplates && Array.isArray(data.learnedTemplates)) {
                    this.ai.learnedTemplates = data.learnedTemplates;
                }
                console.log(`[AI-Persist] 加载学习数据: ${this.ai.learnedSolutions.length} 个解法, ${this.ai.learnedTemplates.length} 个模板`);
            }
        } catch (e) {
            console.warn('[AI-Persist] 加载学习数据失败:', e);
        }
    }

    _saveLearnedData() {
        try {
            const data = {
                learnedSolutions: this.ai.learnedSolutions,
                learnedTemplates: this.ai.learnedTemplates,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('summa_learned_data_v1', JSON.stringify(data));
            console.log(`[AI-Persist] 保存学习数据: ${this.ai.learnedSolutions.length} 个解法, ${this.ai.learnedTemplates.length} 个模板`);
        } catch (e) {
            console.warn('[AI-Persist] 保存学习数据失败:', e);
        }
    }

    _saveArchiveRevengeTraining(archiveId, stats = {}) {
        if (!archiveId) return;
        try {
            const key = `summa_archive_${archiveId}`;
            const raw = localStorage.getItem(key);
            const archive = raw ? JSON.parse(raw) : null;
            if (!archive) return;
            archive.revengeTraining = {
                lastTrainedAt: new Date().toISOString(),
                stats,
            };
            localStorage.setItem(key, JSON.stringify(archive));
        } catch (e) {}
    }

    getTemplatesByDifficulty(difficulty) {
        switch (difficulty) {
            case 'easy':
                return ['x+{c}', 'x-{c}', '{n}*x', 'x/{n}'];
            case 'normal':
                return ['x^2+{c}', '{n}*x+{c}', 'abs(x-{c})', 'sin(x)+{c}'];
            case 'hard':
                return ['x^2-{n}*x+{c}', 'sin({n}*x)', 'exp(x/{n})', 'abs(x^2-{c})'];
            case 'expert':
                return ['x^3-{n}*x', 'sin(x)*cos(x)', 'exp(-x^2)+{c}', 'ln(abs(x)+1)*{n}'];
            default:
                return ['x'];
        }
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=AIPersistence;