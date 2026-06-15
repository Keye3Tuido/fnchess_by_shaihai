class CampaignStorage {
    constructor(ui) { this.ui = ui; }

    getCampaignClearedMax() {
        try {
            const raw = localStorage.getItem('function_chess_campaign_cleared');
            const v = raw ? Number(raw) : 0;
            return Number.isFinite(v) ? v : 0;
        } catch (e) {
            return 0;
        }
    }

    getCampaignCollectedStars() {
        try {
            const raw = localStorage.getItem('function_chess_campaign_stars');
            const v = raw ? Number(raw) : 0;
            return Number.isFinite(v) ? v : 0;
        } catch (e) {
            return 0;
        }
    }

    getCampaignLevelBestStars(levelId) {
        try {
            const raw = localStorage.getItem(`function_chess_campaign_best_stars_${levelId}`);
            const v = raw ? Number(raw) : 0;
            return Number.isFinite(v) ? v : 0;
        } catch (e) {
            return 0;
        }
    }

    setCampaignLevelBestStars(levelId, stars) {
        try {
            localStorage.setItem(`function_chess_campaign_best_stars_${levelId}`, String(Math.max(0, Number(stars) || 0)));
        } catch (e) { }
    }

    setCampaignCollectedStars(stars) {
        try {
            localStorage.setItem('function_chess_campaign_stars', String(Math.max(0, Number(stars) || 0)));
        } catch (e) { }
    }

    getCampaignLevelBestRecord(levelId) {
        try {
            const raw = localStorage.getItem(`function_chess_campaign_best_${levelId}`);
            const n = raw ? Number(raw) : null;
            return Number.isFinite(n) ? n : null;
        } catch (e) {
            return null;
        }
    }

    setCampaignLevelBestRecord(levelId, length) {
        try {
            localStorage.setItem(`function_chess_campaign_best_${levelId}`, String(length));
        } catch (e) { }
    }

    getCampaignDrawDelaySetting() {
        try { const v=Number(localStorage.getItem('function_chess_campaign_draw_delay')); return this.ui.campaignDrawDelayOptions.includes(v)?v:0; } catch(e){return 0;}
    }

    setCampaignDrawDelaySetting(value) {
        const ui=this.ui, next=ui.campaignDrawDelayOptions.includes(Number(value))?Number(value):0;
        ui.campaignDrawDelay=next;
        try{localStorage.setItem('function_chess_campaign_draw_delay',String(next));}catch(e){}
        this.updateCampaignDrawDelayToggle();
    }

    calculateLRSigma(cleared) {
        if (!cleared || cleared <= 0) return 0;
        let sum = 0;
        for (let i = 1; i <= cleared; i++) {
            const best = this.ui.getCampaignLevelBestRecord(i);
            if (best !== null && best > 0) {
                sum += 100 / (10 + best);
            }
        }
        return sum;
    }

    getDifficultyRange(diff) {
        if (diff === 'easy') return { start: 1, end: 29, cls: 'easy', label: '简单（1-29）' };
        if (diff === 'normal') return { start: 30, end: 53, cls: 'normal', label: '普通（30-53）' };
        if (diff === 'hard') return { start: 54, end: 69, cls: 'hard', label: '困难（54-69）' };
        if (diff === 'expert') return { start: 70, end: 81, cls: 'expert', label: '专家（70-81）' };
        return { start: 82, end: 90, cls: 'unsolvable', label: '无解（82-90）' };
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=CampaignStorage;