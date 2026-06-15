/**
 * FunctionParser 模块
 * 负责解析函数表达式，计算函数值
 * 支持：多项式、abs、sin/cos/tan、1/x、exp、复数运算
 *
 * 求值引擎与 geogebra-lite/parser.js 保持同步：
 * tokenize → insertImplicitMultiplication → parse(递归下降) → evalAst(复数运算)
 */
class FunctionParser {
    constructor() {
        this.expressionAnalyzer = new ExpressionAnalyzer(this);
        // 支持的运算符和函数
        this.operators = ['+', '-', '*', '/', '^'];
        this.functions = ['sin', 'cos', 'tan', 'abs', 'ln', 'sqrt'];
        // 复数常量（与 geogebra-lite 一致）
        this.constants = { pi: { re: Math.PI, im: 0 }, e: { re: Math.E, im: 0 }, i: { re: 0, im: 1 } };

        // --- @deprecated: 以下字段将移入 ExpressionModule ---
        // lockedElements：锁定状态属于表达式构建器，不属于解析器
        // elementCategories：UI 分类数据属于表达式构建器
        this.lockedElements = [];
        this.elementCategories = {
            variable: ['x'],
            numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'π', 'e', 'i'],
            basicOperators: ['+', '-', '*', '/'],
            operators: ['.', '^', '!', '(', ')'],
            functions: ['sin', 'cos', 'tan', 'abs', 'ln', 'sqrt']
        };
        // --- end deprecated ---

        // 初始化函数复杂度分析器
        if (typeof FunctionComplexityAnalyzer !== 'undefined') {
            this.complexityAnalyzer = new FunctionComplexityAnalyzer();
        }
    }

    // ========== 复数运算体系（与 geogebra-lite 同步） ==========

    toComplex(...args) { return ComplexMath.toComplex(...args); }

    cAdd(...args) { return ComplexMath.cAdd(...args); }
    cSub(...args) { return ComplexMath.cSub(...args); }
    cMul(...args) { return ComplexMath.cMul(...args); }
    cDiv(...args) { return ComplexMath.cDiv(...args); }
    cNeg(...args) { return ComplexMath.cNeg(...args); }
    cPow(...args) { return ComplexMath.cPow(...args); }
    cAbs(...args) { return ComplexMath.cAbs(...args); }
    cLn(...args) { return ComplexMath.cLn(...args); }
    cSin(...args) { return ComplexMath.cSin(...args); }
    cCos(...args) { return ComplexMath.cCos(...args); }
    cTan(...args) { return ComplexMath.cTan(...args); }
    cSqrt(...args) { return ComplexMath.cSqrt(...args); }
    cFactorial(...args) { return ComplexMath.cFactorial(...args); }

    // ========== 伽马函数（与 geogebra-lite 同步） ==========

    gamma(...args) { return ComplexMath.gamma(...args); }

    // ========== 复数 → 实数转换 ==========

    complexToNumber(...args) { return ComplexMath.complexToNumber(...args); }

    // ========== Tokenizer（与 geogebra-lite 同步） ==========

    tokenize(expr) {
        const tokens = [];
        let i = 0;
        const s = expr.replace(/\s+/g, '').replace(/π/g, 'pi');
        while (i < s.length) {
            const ch = s[i];
            if (/[0-9.]/.test(ch)) {
                let num = ch; i++;
                while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
                tokens.push({ type: 'number', value: parseFloat(num) });
                continue;
            }
            const fn = this.functions.find(f => s.slice(i).toLowerCase().startsWith(f));
            if (fn) { tokens.push({ type: 'fn', value: fn }); i += fn.length; continue; }
            if (s.slice(i, i + 2).toLowerCase() === 'pi') { tokens.push({ type: 'const', value: 'pi' }); i += 2; continue; }
            if (ch === 'e') { tokens.push({ type: 'const', value: 'e' }); i++; continue; }
            if (ch === 'i') { tokens.push({ type: 'const', value: 'i' }); i++; continue; }
            if (ch === 'x' || ch === 'X') { tokens.push({ type: 'var', value: 'x' }); i++; continue; }
            if ('+-*/^!()'.includes(ch)) { tokens.push({ type: ch === '(' ? 'lparen' : ch === ')' ? 'rparen' : 'op', value: ch }); i++; continue; }
            throw new Error(`无法识别字符: ${ch}`);
        }
        return this.insertImplicitMultiplication(tokens);
    }

    // ========== 隐式乘法（与 geogebra-lite 同步） ==========

    insertImplicitMultiplication(tokens) {
        const out = [];
        const isLeft = t => ['number', 'var', 'const', 'rparen', 'fac'].includes(t.type) || (t.type === 'op' && t.value === '!');
        const isRight = t => ['number', 'var', 'const', 'fn', 'lparen'].includes(t.type);
        for (let i = 0; i < tokens.length; i++) {
            const a = out[out.length - 1], b = tokens[i];
            if (a && isLeft(a) && isRight(b)) out.push({ type: 'imult', value: '*' });
            out.push(b);
        }
        return out;
    }

    // ========== 递归下降解析器（与 geogebra-lite 同步） ==========

    parse(expr) {
        const tokens = this.tokenize(expr);
        let p = 0;
        const peek = () => tokens[p];
        const eat = () => tokens[p++];

        const primary = () => {
            const t = eat();
            if (!t) throw new Error('表达式不完整');
            if (t.type === 'number') return { t: 'num', v: t.value };
            if (t.type === 'var') return { t: 'x' };
            if (t.type === 'const') return { t: 'const', v: t.value };
            if (t.type === 'lparen') { const n = add(); if (!peek() || peek().type !== 'rparen') throw new Error('缺少右括号'); eat(); return n; }
            if (t.type === 'fn') {
                if (peek() && peek().type === 'lparen') {
                    eat(); // 吃掉 '('
                    const arg = add(); // 解析括号内表达式
                    if (!peek() || peek().type !== 'rparen') throw new Error('缺少右括号');
                    eat(); // 吃掉 ')'
                    return { t: 'fn', n: t.value, a: arg };
                }
                return { t: 'fn', n: t.value, a: primary() };
            }
            throw new Error('语法错误');
        };

        const postfix = () => {
            let n = primary();
            while (peek() && peek().type === 'op' && peek().value === '!') { eat(); n = { t: 'fac', a: n }; }
            return n;
        };

        const powerLeaf = () => {
            let n = postfix();
            if (peek() && peek().type === 'op' && peek().value === '^') { eat(); n = { t: '^', l: n, r: powerRight() }; }
            return n;
        };

        const powerRight = () => {
            let n = powerLeaf();
            while (peek() && peek().type === 'imult') {
                eat();
                const r = powerLeaf();
                n = { t: '*', l: n, r };
            }
            return n;
        };

        const unary = () => {
            if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
                const op = eat().value;
                const n = unary();
                return op === '-' ? { t: 'neg', a: n } : n;
            }
            return powerLeaf();
        };

        const implicitMul = () => {
            let n = unary();
            while (peek() && peek().type === 'imult') {
                eat();
                const r = unary();
                n = { t: '*', l: n, r };
            }
            return n;
        };

        const mul = () => {
            let n = implicitMul();
            while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
                const op = eat().value;
                const r = implicitMul();
                n = { t: op, l: n, r };
            }
            return n;
        };

        const add = () => {
            let n = mul();
            while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
                const op = eat().value;
                const r = mul();
                n = { t: op, l: n, r };
            }
            return n;
        };

        const ast = add();
        if (p !== tokens.length) throw new Error('表达式无法完整解析');
        return ast;
    }

    // ========== AST 求值器（与 geogebra-lite 同步） ==========

    evalAst(node, x) {
        switch (node.t) {
            case 'num': return node.v;
            case 'x': return x;
            case 'const': return this.constants[node.v];
            case 'neg': return this.cNeg(this.evalAst(node.a, x));
            case '+': return this.cAdd(this.evalAst(node.l, x), this.evalAst(node.r, x));
            case '-': return this.cSub(this.evalAst(node.l, x), this.evalAst(node.r, x));
            case '*': return this.cMul(this.evalAst(node.l, x), this.evalAst(node.r, x));
            case '/': return this.cDiv(this.evalAst(node.l, x), this.evalAst(node.r, x));
            case '^': {
                const left = this.evalAst(node.l, x);
                const right = this.evalAst(node.r, x);
                const a = this.toComplex(left);
                const b = this.toComplex(right);
                if (a.im === 0 && a.re === 0) {
                    if (b.im === 0 && b.re > 0) return 0;
                    return { re: NaN, im: NaN };
                }
                return this.cPow(left, right);
            }
            case 'fac': return this.cFactorial(this.evalAst(node.a, x));
            case 'fn': {
                const v = this.evalAst(node.a, x);
                switch (node.n) {
                    case 'sin': return this.cSin(v);
                    case 'cos': return this.cCos(v);
                    case 'tan': return this.cTan(v);
                    case 'abs': return this.cAbs(v);
                    case 'ln': return this.cLn(v);
                    case 'sqrt': {
                        const sv = this.evalAst(node.a, x);
                        const a = this.toComplex(sv);
                        if (a.im === 0 && a.re === 0) return 0;
                        return this.cSqrt(sv);
                    }
                    default: return { re: NaN, im: NaN };
                }
            }
            default: return NaN;
        }
    }

    // ========== 主求值方法 ==========

    evaluate(expression, x) {
        try {
            const v = this.evalAst(this.parse(expression), x);
            return this.complexToNumber(v);
        } catch {
            return null;
        }
    }

    /** 直接用预解析的 AST 求值，避免重复 parse 开销 */
    evaluateAst(ast, x) {
        try {
            const v = this.evalAst(ast, x);
            return this.complexToNumber(v);
        } catch {
            return null;
        }
    }

    clearCache() {
        // 预留给渲染器调用；当前解析器无持久缓存，保留接口用于统一清理
    }

    // ========== 锁定元素管理 ==========

    setLockedElements(elements) {
        this.lockedElements = [...elements];
    }

    clearLockedElements() {
        this.lockedElements = [];
    }

    isElementLocked(element) {
        return this.lockedElements.includes(element);
    }

    validateExpressionForLocks(...args) { return this.expressionAnalyzer.validateExpressionForLocks(...args); }

    containsElement(...args) { return this.expressionAnalyzer.containsElement(...args); }

    // ========== 阶乘（兼容保留） ==========

    factorial(n) {
        if (n < 0 && Number.isInteger(n)) return NaN;
        if (n === 0 || n === 1) return 1;
        if (n > 0 && Number.isInteger(n) && n <= 170) {
            let result = 1;
            for (let i = 2; i <= n; i++) result *= i;
            return result;
        }
        return this.gamma(n + 1);
    }

    // ========== 语法验证 ==========

    validateSyntax(...args) { return this.expressionAnalyzer.validateSyntax(...args); }

    // ========== 函数复杂度分析 ==========

    analyzeFunctionType(...args) { return this.expressionAnalyzer.analyzeFunctionType(...args); }

    // ========== 多项式次数计算 ==========

    getPolynomialDegree(...args) { return this.expressionAnalyzer.getPolynomialDegree(...args); }

    getNumeratorDegree(...args) { return this.expressionAnalyzer.getNumeratorDegree(...args); }

    getDenominatorDegree(...args) { return this.expressionAnalyzer.getDenominatorDegree(...args); }

    extractParenthesesContent(...args) { return this.expressionAnalyzer.extractParenthesesContent(...args); }

    getSimplePolynomialDegree(...args) { return this.expressionAnalyzer.getSimplePolynomialDegree(...args); }

    // ========== UI 辅助方法 ==========

    getAvailableElements() {
        const result = {};
        for (const [category, elements] of Object.entries(this.elementCategories)) {
            result[category] = elements.map(el => ({
                value: el,
                locked: this.isElementLocked(el)
            }));
        }
        return result;
    }

    formatExpression(expression) {
        let formatted = expression;
        formatted = formatted.replace(/([+\-*/^()])/g, ' $1 ');
        formatted = formatted.replace(/\s+/g, ' ').trim();
        return formatted;
    }

    // ========== 测试方法 ==========

    testEulerFormula(...args) { return this.expressionAnalyzer.testEulerFormula(...args); }

    testLogWithoutParen(...args) { return this.expressionAnalyzer.testLogWithoutParen(...args); }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunctionParser;
}
