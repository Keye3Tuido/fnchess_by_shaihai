// AutoSolver - 函数棋通关脚本（精简版）
// y = SUM (y_i+0.5) * D(x, x_i+m_i), D=0.5*(sign(z+eps)-sign(z-eps)), sign≈z/abs(z)

var AutoSolver = (function() {
    var gc = function() { return window.gameController; };
    var ui = function() { return window.uiController; };
    var st = function() { var g = gc(); return g ? g.getGameState() : null; };
    var ts = function() { var s = st(); return s && s.roundState ? s.roundState.targetCells || [] : []; };
    var lk = function() { var s = st(); return s && s.roundState ? s.roundState.lockedElements || [] : []; };
    var il = function(e) { return lk().indexOf(e) !== -1; };

    function offsets(ts) {
        var byX = {}, idx = {};
        for (var i = 0; i < ts.length; i++) { var k = ts[i].x; byX[k] = (byX[k] || 0) + 1; idx[k] = 0; }
        return ts.map(function(t) {
            var k = t.x, n = byX[k], j = idx[k]; idx[k] = j + 1;
            return n === 1 ? 0.5 : 0.15 + 0.7 * j / (n - 1);
        });
    }

    function computeEPS(ts) {
        var m = {}; for (var i = 0; i < ts.length; i++) { var k = ts[i].x; m[k] = (m[k] || 0) + 1; }
        var max = 1; for (var k in m) { if (m[k] > max) max = m[k]; }
        return Math.max(0.01, 0.7 / max * 0.25);
    }

    function N(v) { return { t: 'num', v: v }; }
    function X() { return { t: 'var' }; }
    function B(o, l, r) { return { t: 'bin', op: o, l: l, r: r }; }
    function F(n, a) { return { t: 'fn', name: n, arg: a }; }
    function C(n) { return { t: 'const', name: n }; }

    function buildD(xma, e) {
        var ep = N(e), h = N(0.5);
        var z1 = B('+', xma, ep), z2 = B('-', xma, ep);
        var s1 = B('/', z1, F('abs', z1)), s2 = B('/', z2, F('abs', z2));
        return B('*', h, B('-', s1, s2));
    }

    function buildAst(ts) {
        var o = offsets(ts), e = computeEPS(ts);
        var terms = ts.map(function(t, i) {
            return B('*', buildD(B('-', X(), N(t.x + o[i])), e), N(t.y + 0.5));
        });
        var s = terms[0];
        for (var i = 1; i < terms.length; i++) s = B('+', s, terms[i]);
        return s;
    }

    var ONE = B('/', X(), X());

    function buildInt(n) {
        var s = String(n), clean = true;
        for (var i = 0; i < s.length; i++) { if (il(s[i])) { clean = false; break; } }
        if (clean) return N(n);
        if (n === 0) return B('-', X(), X());
        if (n === 1) return ONE;
        if (n <= 9) { var nd = ONE; for (var i = 1; i < n; i++) nd = B('+', nd, ONE); return nd; }
        for (var a = Math.floor(Math.sqrt(n)); a >= 2; a--) {
            if (n % a === 0) return B('*', buildInt(a), buildInt(n / a));
        }
        return B('+', buildInt(n - 1), ONE);
    }

    function adaptDigits(nd) {
        var v = nd.v;
        if (!Number.isInteger(v)) return nd;
        // 检查负号是否需要处理
        var needNeg = v < 0 && il('-');
        var s = String(Math.abs(v)), need = false;
        for (var i = 0; i < s.length; i++) { if (il(s[i])) { need = true; break; } }
        if (!need && !needNeg) return nd;
        // 负数且 - 被锁：用 i²*|v| 表示
        if (needNeg) {
            var posNode = need ? adaptDigits(N(Math.abs(v))) : N(Math.abs(v));
            if (posNode === N(Math.abs(v)) && need) posNode = N(Math.abs(v)); // fallback
            if (il('i')) {
                console.warn('[AutoSolver] 无法生成负数：- 和 i 都被锁定，数字 ' + v);
                return nd;
            }
            // 如果正数部分的数字也需要适配，递归处理
            var absNode = need ? adaptDigits(N(Math.abs(v))) : N(Math.abs(v));
            if (absNode.t === 'num' && absNode.v === Math.abs(v) && need) {
                // adaptDigits 没能处理正数部分，走 buildInt
                absNode = buildInt(Math.abs(v));
            }
            return B('*', B('*', C('i'), C('i')), absNode);
        }
        // 以下只处理正数（或负数但 - 没被锁）的数字替换
        for (var d = 1; d <= 3; d++) {
            var cand = Math.abs(v) + d, cs = String(cand), ok = true;
            for (var j = 0; j < cs.length; j++) { if (il(cs[j])) { ok = false; break; } }
            if (ok) {
                var base = v < 0 ? B('-', N(0), N(cand)) : N(cand);
                return B('-', base, buildInt(d));
            }
            cand = Math.abs(v) - d;
            if (cand >= 0) {
                cs = String(cand); ok = true;
                for (var j = 0; j < cs.length; j++) { if (il(cs[j])) { ok = false; break; } }
                if (ok) {
                    var base = v < 0 ? B('-', N(0), N(cand)) : N(cand);
                    return B('+', base, buildInt(d));
                }
            }
        }
        var an = buildInt(Math.abs(v));
        return v < 0 ? B('*', B('*', C('i'), C('i')), an) : an;
    }

    function adaptDecimal(v) {
        if (Math.abs(v - 0.5) < 0.0001 && !il('1') && !il('2')) return B('/', N(1), N(2));
        var s = String(v), d = s.indexOf('.');
        var ip = parseInt(s.slice(0, d)) || 0, fp = s.slice(d + 1);
        var den = Math.pow(10, fp.length);
        var num = Math.abs(ip) * den + parseInt(fp);
        return B('/', adapt(N(v < 0 ? -num : num)), adapt(N(den)));
    }

    // 树形替换：自底向上单遍遍历，每个节点只处理一次，替换产物不回溯
    function adapt(node) {
        if (node.t === 'var' || node.t === 'const') return node;

        // 数字节点：先适配数字本身，再对产物做一次 adaptTree（不回 adapt 本体）
        if (node.t === 'num') {
            if (il('.') && !Number.isInteger(node.v)) return adaptTree(adaptDecimal(node.v));
            // 负小数 + - 被锁：拆为 i² * |v|
            if (!Number.isInteger(node.v) && node.v < 0 && il('-')) {
                if (il('i')) { console.warn('[AutoSolver] 无法生成负小数：- 和 i 都被锁定'); return node; }
                return adaptTree(B('*', B('*', C('i'), C('i')), N(-node.v)));
            }
            // 正小数但含 - 的情况不存在，正小数不需要 -
            // 负整数、正整数含锁定数字的情况
            var nd = adaptDigits(node);
            if (nd !== node) return adaptTree(nd);
            // 负数（整数，数字本身干净）但 - 被锁
            if (node.v < 0 && il('-')) {
                if (il('i')) { console.warn('[AutoSolver] 无法生成负数：- 和 i 都被锁定'); return node; }
                return B('*', B('*', C('i'), C('i')), N(-node.v));
            }
            return nd;
        }

        // 函数/运算符节点：先递归处理子树
        if (node.t === 'fn') {
            var a = adapt(node.arg);
            if (node.name === 'abs' && il('abs')) {
                var sq = B('*', a, a);
                if (il('sqrt')) return adaptTree(B('^', sq, adaptTree(adaptDecimal(0.5))));
                if (!il('sqrt')) return F('sqrt', sq);
            }
            if (node.name === 'sqrt' && il('sqrt')) {
                return adaptTree(B('^', a, adaptTree(adaptDecimal(0.5))));
            }
            if (il(node.name)) {
                console.warn('[AutoSolver] 无法替换被锁函数: ' + node.name);
            }
            return F(node.name, a);
        }

        // 二元运算符：先递归子树，再处理当前运算符
        var l = adapt(node.l), r = adapt(node.r);
        return adaptOp(node.op, l, r);
    }

    // adaptOp: 对单个运算符做一次替换，替换产物用 adaptTree 清理（不递归回 adaptOp 自身）
    function adaptOp(o, l, r) {
        if (o === '/' && il('/')) {
            // a/b → a * b^(-1)，需要 ^
            if (il('^')) {
                console.warn('[AutoSolver] 无法替换 /：^ 也被锁定');
                return B(o, l, r);
            }
            var neg1 = il('-') ? adaptNeg(N(1)) : B('-', N(0), N(1));
            var rInv = B('^', r, adaptTree(neg1));
            return adaptMul(l, rInv);
        }
        if (o === '^' && il('^')) {
            // ^ 无通用替换路径（e^(b*ln(a)) 仍需 ^）
            console.warn('[AutoSolver] 无法替换 ^：无可用替代');
            return B(o, l, r);
        }
        if (o === '-' && il('-')) {
            // a-b → a + i²*b，需要 + 和 *
            if (il('i')) {
                console.warn('[AutoSolver] 无法替换 -：i 也被锁定');
                return B(o, l, r);
            }
            var neg = B('*', B('*', C('i'), C('i')), r);
            return adaptAdd(l, neg);
        }
        if (o === '+' && il('+')) {
            // a+b → ln(e^a * e^b)，需要 ln、e、^、*
            if (il('ln')) {
                console.warn('[AutoSolver] 无法替换 +：ln 也被锁定');
                return B(o, l, r);
            }
            var ea = B('^', C('e'), l), eb = B('^', C('e'), r);
            var prod = adaptMul(ea, eb);
            return F('ln', prod);
        }
        if (o === '*' && il('*')) {
            // * 通过 toStr 隐式乘法处理，AST 层面保留
            return B(o, l, r);
        }
        return B(o, l, r);
    }

    // adaptAdd: 生成加法，如果 + 被锁则替换
    function adaptAdd(l, r) {
        if (!il('+')) return B('+', l, r);
        if (il('ln')) {
            console.warn('[AutoSolver] 无法替换 +：ln 也被锁定');
            return B('+', l, r);
        }
        var ea = B('^', C('e'), l), eb = B('^', C('e'), r);
        return F('ln', adaptMul(ea, eb));
    }

    // adaptMul: 生成乘法（* 在 toStr 层面通过隐式乘法绕过，AST 直接保留）
    function adaptMul(l, r) {
        return B('*', l, r);
    }

    // adaptNeg: 生成 -n 的等价形式（当 - 被锁时用 i²*n）
    function adaptNeg(n) {
        if (!il('-')) return B('-', N(0), n);
        if (il('i')) {
            console.warn('[AutoSolver] 无法生成负数：- 和 i 都被锁定');
            return B('-', N(0), n);
        }
        return B('*', B('*', C('i'), C('i')), n);
    }

    // adaptTree: 对已经替换过的子树做一遍自底向上清理（处理替换产物中的被锁元素）
    // 只对结构做单遍遍历，不会回溯
    function adaptTree(node) {
        if (node.t === 'var' || node.t === 'const') return node;
        if (node.t === 'num') {
            if (il('.') && !Number.isInteger(node.v)) return adaptTree(adaptDecimal(node.v));
            if (!Number.isInteger(node.v) && node.v < 0 && il('-')) {
                if (il('i')) return node;
                return adaptTree(B('*', B('*', C('i'), C('i')), N(-node.v)));
            }
            var nd = adaptDigits(node);
            if (nd !== node) return adaptTree(nd);
            if (node.v < 0 && il('-')) {
                if (il('i')) return node;
                return B('*', B('*', C('i'), C('i')), N(-node.v));
            }
            return nd;
        }
        if (node.t === 'fn') {
            var a = adaptTree(node.arg);
            if (node.name === 'abs' && il('abs')) {
                var sq = B('*', a, a);
                if (il('sqrt')) return B('^', sq, adaptTree(adaptDecimal(0.5)));
                return F('sqrt', sq);
            }
            if (node.name === 'sqrt' && il('sqrt')) {
                return B('^', a, adaptTree(adaptDecimal(0.5)));
            }
            if (il(node.name)) {
                console.warn('[AutoSolver] 无法替换被锁函数: ' + node.name);
            }
            return F(node.name, a);
        }
        var l = adaptTree(node.l), r = adaptTree(node.r);
        return adaptOp(node.op, l, r);
    }

    var PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

    function needP(c, p, s) {
        if (c.t !== 'bin') return false;
        var cp = PREC[c.op] || 0, pp = PREC[p] || 0;
        if (cp < pp) return true;
        if (cp === pp) {
            if (s === 'right' && (p === '-' || p === '/')) return true;
            if (s === 'left' && p === '/' && (c.op === '+' || c.op === '-')) return true;
        }
        return false;
    }

    function toStr(n, p, s) {
        if (n.t === 'var') return 'x';
        if (n.t === 'num') {
            var str = String(n.v);
            if (str.indexOf('e') !== -1) str = n.v.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
            return str;
        }
        if (n.t === 'const') return n.name;
        if (n.t === 'fn') return n.name + '(' + toStr(n.arg) + ')';
        if (n.t === 'bin') {
            // x - (-n) → x+n 的简写，但 + 被锁时不能用
            if (n.op === '-' && n.l.t === 'var' && n.r.t === 'num' && n.r.v < 0 && !il('+')) return 'x+' + toStr(N(-n.r.v));
            var op = n.op, L = toStr(n.l, n.op, 'left'), R = toStr(n.r, n.op, 'right');
            if (op === '*' && il('*')) {
                op = '';
                if (n.r.t === 'num' && n.r.v < 0 && !il('-')) return L + '(ii' + toStr(N(-n.r.v)) + ')';
                L = '(' + L + ')';
                R = '(' + R + ')';
            }
            var str = L + op + R;
            if (p && needP(n, p, s)) str = '(' + str + ')';
            return str;
        }
        return '';
    }

    function tokenize(expr) {
        var elems = [], fns = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'ln'];
        var i = 0;
        while (i < expr.length) {
            var matched = false;
            for (var j = 0; j < fns.length; j++) {
                if (expr.slice(i, i + fns[j].length).toLowerCase() === fns[j]) {
                    elems.push(fns[j]); i += fns[j].length; matched = true; break;
                }
            }
            if (matched) continue;
            elems.push(expr[i]); i++;
        }
        return elems;
    }

    function campaignLv() {
        var gc = window.gameController;
        return (gc && gc.campaignState && gc.campaignState.active) ? gc.campaignState.currentLevelId : null;
    }

    // ============ 高斯乘积构造（备用路径，仅经典路径被锁死时启用）============
    // 称"高斯"是因为核心峰 D(x,p)=(e^(2px)/(e^(p²)*e^(x²)))^K = e^(-(x-p)²K)
    //   正是以 p 为中心的高斯（钟形）函数。
    //   f=ΣD → e^f=Πe^D (积代替和)；值 g=Πe^(ln|b|·D)；负号 Πe^(iπ·D)
    //   域限制 e^(0^(ii·cos(π·e^f/(2e^H))))：仅目标附近有定义。
    // 锁感知发射器：每个常数/运算符若被锁，用等价式合成
    //   小数 → 整数·(10^k)^(-1)；  /  → a·b^(-1)；  *  → 括号并列；  负 → i*i*

    function gRecipExp() {
        // ^(-1) 的指数串：优先 i*i（再处理 * 锁），退路 0-1
        if (!il('i')) return il('*') ? '(i)(i)' : 'i*i';
        return '0-1';
    }

    function gMul(arr) {
        if (!il('*')) return arr.join('*');
        // * 被锁：括号并列（避免 e^(A)e^(B) 退化为幂塔）
        return arr.map(function(t) { return '(' + t + ')'; }).join('');
    }

    function gPow(base, expStr) {
        return '(' + base + ')^(' + expStr + ')';
    }

    function gDiv(a, b) {
        if (!il('/')) return a + '/(' + b + ')';
        return gMul([a, gPow(b, gRecipExp())]); // a · b^(-1)
    }

    // 非负数字面量（锁感知）
    function gNum(v) {
        if (!isFinite(v)) return '0';
        if (Number.isInteger(v)) return String(v);
        if (!il('.')) {
            var s = v.toFixed(10);
            return s.replace(/0+$/, '').replace(/\.$/, '');
        }
        // . 被锁：有理逼近 M·(10^8)^(-1)
        var P = 100000000, M = Math.round(v * P);
        return gMul([String(M), gPow(String(P), gRecipExp())]);
    }

    // 带符号常量：负数用 i*i* 合成（避免 - 号）
    function gConst(v) {
        if (v >= 0) return gNum(v);
        if (!il('i')) return gMul(['i', 'i', gNum(-v)]);
        return '0-' + gNum(-v);
    }

    // 高斯峰 D(x,p,K) = (e^(2p*x) / (e^(p²)*e^(x·x)))^K
    //   注意用 x·x 而非 x^2：负 x 的 x^2 会走复数幂(θ=π)引入虚部→严格容差下变 null
    function gaussD(p, K) {
        var numer = 'e^(' + gMul([gConst(2 * p), 'x']) + ')';
        var denom = gMul(['e^(' + gNum(p * p) + ')', 'e^(' + gMul(['x', 'x']) + ')']);
        return gPow(gDiv(numer, denom), gNum(K));
    }

    function buildGaussianExpr(ts) {
        var byX = {};
        for (var i = 0; i < ts.length; i++) { var k = ts[i].x; (byX[k] = byX[k] || []).push(ts[i]); }
        var pts = [];
        for (var kx in byX) {
            var arr = byX[kx].slice().sort(function(a, b) { return a.y - b.y; });
            var n = arr.length;
            for (var j = 0; j < n; j++) {
                var mx = n === 1 ? 0.5 : 0.2 + 0.6 * j / (n - 1);
                pts.push({ p: arr[j].x + mx, b: arr[j].y + 0.5 });
            }
        }
        // K：指示峰 Kf 远大于值/符号峰（窄指示窗内值已饱和），保证不溢出格
        // 符号用 cos(π·D)（实数：峰=-1, 远处=+1），避免 e^(iπD) 的复数（严格容差下会变 null）
        var N = pts.length, Kf = 22000, Kg = 320, Ks = 320, H = 0.5;
        var magF = [], signF = [], efF = [];
        for (var i = 0; i < pts.length; i++) {
            var p = pts[i].p, b = pts[i].b, absb = Math.abs(b), lnb = Math.log(absb);
            magF.push('e^(' + gMul([gConst(lnb), gaussD(p, Kg)]) + ')');
            efF.push('e^(' + gaussD(p, Kf) + ')');
            if (b < 0) signF.push('cos(' + gMul(['π', gaussD(p, Ks)]) + ')'); // 实数符号 -1↔+1
        }
        var ef = gMul(efF);
        var eHexpr = 'e^(' + gNum(H) + ')';
        var theta = gDiv(gMul(['π', ef]), gMul(['2', eHexpr]));
        var zeroExp = gMul(['i', 'i', 'cos(' + theta + ')']);
        var domain = 'e^(0^(' + zeroExp + '))';
        var allF = magF.concat(signF, [domain]);
        return gMul(allF);
    }

    // 检查表达式 token 是否全部为当前关卡允许的元素
    function exprViolations(expr) {
        var elems = tokenize(expr);
        var fnNames = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'ln'];
        var v = [];
        for (var i = 0; i < elems.length; i++) {
            var tok = elems[i];
            if (fnNames.indexOf(tok) !== -1 && il(tok) && v.indexOf(tok) === -1) v.push(tok);
            if (tok.length === 1 && il(tok) && v.indexOf(tok) === -1) v.push(tok);
        }
        if (il('.') && expr.indexOf('.') !== -1 && v.indexOf('.') === -1) v.push('.');
        return v;
    }

    function solve() {
        var s = st();
        if (!s || s.currentPhase !== 'input_function') return false;
        var t = ts();
        if (!t.length) return false;
        var u = ui();
        if (!u) return false;
        var lvl = campaignLv();

        var expr = toStr(adapt(buildAst(t)));
        var locked = lk();

        // 经典路径自检：若含被锁元素，尝试高斯乘积备用路径
        if (locked.length > 0) {
            var violations = exprViolations(expr);
            if (violations.length > 0) {
                console.warn('[AutoSolver] 经典路径含被锁元素 [' + violations.join(', ') + ']，尝试高斯乘积路径');
                var gexpr = buildGaussianExpr(t);
                var gv = exprViolations(gexpr);
                if (gv.length === 0) {
                    console.log('[AutoSolver] 高斯路径可用 (表达式 ' + gexpr.length + ' 字符)');
                    expr = gexpr;
                } else {
                    console.error('[AutoSolver] Lv.' + (lvl || '?') + ' 两条路径均含被锁元素，放弃提交');
                    console.error('[AutoSolver] 经典缺: [' + violations.join(', ') + '] | 高斯缺: [' + gv.join(', ') + ']');
                    return false;
                }
            }
        }

        var elems = tokenize(expr);

        // 提交前最终自检
        if (locked.length > 0) {
            var fin = exprViolations(expr);
            if (fin.length > 0) {
                console.error('[AutoSolver] Lv.' + (lvl || '?') + ' 生成的表达式包含被锁元素: [' + fin.join(', ') + ']，放弃提交');
                console.error('[AutoSolver] 表达式: ' + expr.slice(0, 200));
                return false;
            }
        }

        console.log('Lv.' + (lvl || '?') + ' | 目标:', t.length, '| 锁定:', locked.join(',') || '无');
        console.log('表达式(' + expr.length + '字符):', expr.slice(0, 100) + (expr.length > 100 ? '...' : ''));
        u.clearExpression();
        u.expressionElements = elems;
        u.cursorIndex = elems.length;
        u.updateExpressionDisplay();
        setTimeout(function() { var u = ui(); if (u) u.handleConfirm(); }, 200);
        return true;
    }

    function showFormula() {
        var t = ts();
        if (!t.length) return null;
        var expr = toStr(adapt(buildAst(t)));
        var locked = lk();

        if (locked.length > 0) {
            var violations = exprViolations(expr);
            if (violations.length > 0) {
                var gexpr = buildGaussianExpr(t);
                var gv = exprViolations(gexpr);
                if (gv.length === 0) {
                    expr = gexpr;
                    console.log('[AutoSolver] 经典路径含被锁元素，改用高斯乘积路径');
                } else {
                    console.error('[AutoSolver] 两条路径均含被锁元素: 经典[' + violations.join(', ') + '] 高斯[' + gv.join(', ') + ']');
                    console.log('\n=== ⚠️ 无法生成合法公式 ===\n经典: ' + expr.slice(0, 120) + '\n==================');
                    return null;
                }
            }
        }

        console.log('\n=== 通关公式 ===\n' + expr + '\n==================');
        return expr;
    }

    window.AutoSolver = { solve: solve, showFormula: showFormula };
    console.log('✅ AutoSolver 已就绪');
    return { solve: solve, showFormula: showFormula };
})();

// 手动求解按钮
(function() {
    setTimeout(function() {
        var b = document.createElement('button');
        b.id = 'manual-solve-btn';
        b.textContent = '🎯 求解';
        b.style.cssText = 'position:fixed;bottom:80px;left:20px;z-index:9999;padding:10px 20px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:25px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,0.4)';
        b.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
        b.onmouseout = function() { this.style.transform = 'scale(1)'; };
        b.onclick = function() {
            if (window.audioManager) window.audioManager.playClick();
            if (window.AutoSolver) AutoSolver.solve();
        };
        document.body.appendChild(b);
    }, 800);
})();

// 自动通关功能
(function() {
    var running = false, timer = null, lastPhase = '';
    function currentPhase() {
        var gc = window.gameController;
        return gc ? (gc.currentPhase || (gc.getGameState ? gc.getGameState().currentPhase : null)) : null;
    }
    function tick() {
        if (!running) return;
        var vic = document.getElementById('campaign-victory-modal');
        if (vic && vic.style.display !== 'none' && vic.style.display !== '') {
            var nextBtn = document.getElementById('campaign-next-btn');
            if (nextBtn) { nextBtn.click(); lastPhase = ''; }
            timer = setTimeout(tick, 1500); return;
        }
        var over = document.getElementById('game-over-modal');
        if (over && over.style.display !== 'none' && over.style.display !== '') { stop(); return; }
        var ph = currentPhase();
        if (!ph || ph === 'init' || ph === 'end') { timer = setTimeout(tick, 800); return; }
        if (ph === 'evaluate' || ph === 'settle' || ph === 'switch_player') { timer = setTimeout(tick, 500); return; }
        if (ph !== lastPhase) {
            lastPhase = ph;
            if (ph === 'input_function' && window.AutoSolver) AutoSolver.solve();
            else if (ph === 'select_target' || ph === 'set_forbidden' || ph === 'set_locks') {
                var u = window.uiController; if (u) u.handleConfirm();
            }
            timer = setTimeout(tick, 600);
        } else { timer = setTimeout(tick, 500); }
    }
    function stop() {
        running = false; lastPhase = '';
        if (timer) { clearTimeout(timer); timer = null; }
        var b = document.getElementById('autoplay-btn');
        if (b) { b.textContent = '▶ 自动通关'; b.style.background = 'linear-gradient(135deg,#667eea,#764ba2)'; }
    }
    function start() {
        if (running) return;
        running = true; lastPhase = '';
        var b = document.getElementById('autoplay-btn');
        if (b) { b.textContent = '⏸ 暂停'; b.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'; }
        tick();
    }
    function toggle() { if (running) stop(); else start(); }
    setTimeout(function() {
        var b = document.createElement('button');
        b.id = 'autoplay-btn';
        b.textContent = '▶ 自动通关';
        b.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:30px;font-size:15px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(102,126,234,0.4)';
        b.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
        b.onmouseout = function() { this.style.transform = 'scale(1)'; };
        b.onclick = function() { if (window.audioManager) window.audioManager.playClick(); toggle(); };
        document.body.appendChild(b);
    }, 800);
})();
