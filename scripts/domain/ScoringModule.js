/**
 * ScoringModule — 得分规则模块
 * 层级：Domain Layer
 * 职责：函数复杂度分析 + 回合得分计算
 * 依赖：无（纯逻辑，不依赖 DOM 或其他 Domain 模块）
 */
class ScoringModule {

    // ─── Controller ───────────────────────────────────────────────────────────

    /**
     * 分析函数表达式的 token 数量与对应得分档位
     * @param {string} expression
     * @returns {{ type: string, score: number }}
     */
    analyzeFunctionType(expression) {
        return ScoringBusinessService.analyzeFunctionType(expression);
    }

    /**
     * 计算本回合得分
     * @param {boolean[]} hitTargets  - 每个目标格是否被命中
     * @param {boolean}   hitForbidden
     * @param {{ score: number }} functionType - 由 analyzeFunctionType 返回
     * @param {number}    targetCount - 本回合需要命中的目标格总数
     * @returns {number}  得分（可为负）
     */
    evaluate(hitTargets, hitForbidden, functionType, targetCount) {
        return ScoringBusinessService.evaluate(hitTargets, hitForbidden, functionType, targetCount);
    }
}

// ─── Business Service ──────────────────────────────────────────────────────────

const ScoringBusinessService = {

    /** token 计数 → 得分档位 */
    analyzeFunctionType(expression) {
        const cleanExpr = expression.replace(/\s+/g, '').replace(/[()（）]/g, '');
        let length = 0;
        const tokenRegex = /(sin|cos|tan|abs|exp|ln|log|sqrt|factorial)|(\d+(?:\.\d+)?)|(PI|π|e|i)|([+\-*/^!])|(x)/gi;
        while (tokenRegex.exec(cleanExpr) !== null) length++;
        if (length === 0 && cleanExpr.length > 0) length = cleanExpr.length;

        let score = 1;
        if      (length <= 2)  score = 5;
        else if (length <= 5)  score = 4;
        else if (length <= 9)  score = 3;
        else if (length <= 15) score = 2;

        return { type: `len_${length}`, score };
    },

    /**
     * 规则：
     *   进入禁区          → -1
     *   未命中所有目标格   → -1
     *   命中所有目标格     → functionType.score
     */
    evaluate(hitTargets, hitForbidden, functionType, targetCount) {
        if (hitForbidden) return -1;
        const hitAll = Array.isArray(hitTargets)
            ? hitTargets.length >= targetCount
            : !!hitTargets;
        return hitAll ? functionType.score : -1;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoringModule;
}
