// ═══════════════════════════════════════════════════════════════════════════════
// AutoSolver - 函数棋自动通关脚本
// ═══════════════════════════════════════════════════════════════════════════════
// 求解策略（按优先级）:
//   1. 硬编码特解 —— 少数无法通用求解的关卡
//   2. 经典 Dirac-delta 路径 —— 绝大多数关卡，快速
//   3. 高斯乘积备用路径 —— 经典路径因元素锁定失败时启用（88/89）
//   4. 提交前双重自检 —— 不通过则放弃，绝不提交非法表达式
// ═══════════════════════════════════════════════════════════════════════════════

var AutoSolver = (function() {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // § 游戏状态访问
    // ─────────────────────────────────────────────────────────────────────────
    var gc = function() { return window.gameController; };
    var ui = function() { return window.uiController; };
    var st = function() { var g = gc(); return g ? g.getGameState() : null; };
    var ts = function() { var s = st(); return s && s.roundState ? s.roundState.targetCells || [] : []; };
    var lk = function() { var s = st(); return s && s.roundState ? s.roundState.lockedElements || [] : []; };
    var il = function(e) { return lk().indexOf(e) !== -1; };
    function campaignLv() {
        var g = window.gameController;
        return (g && g.campaignState && g.campaignState.active) ? g.campaignState.currentLevelId : null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § 硬编码特解（无法通用求解的关卡）
    // ─────────────────────────────────────────────────────────────────────────
    var SPECIAL_SOLUTIONS = {
        50: 'ln(xxxx)',
        51: 'ln(3)x!'
    };

    // ─────────────────────────────────────────────────────────────────────────
    // § AST 构建工具
    // ─────────────────────────────────────────────────────────────────────────
    function N(v) { return { t: 'num', v: v }; }
    function X() { return { t: 'var' }; }
    function B(o, l, r) { return { t: 'bin', op: o, l: l, r: r }; }
    function F(n, a) { return { t: 'fn', name: n, arg: a }; }
    function C(n) { return { t: 'const', name: n }; }

    // ─────────────────────────────────────────────────────────────────────────
    // § 经典路径：Dirac-delta 叠加
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // § 经典路径：AST 树形替换（锁定元素 → 等价式）
    // ─────────────────────────────────────────────────────────────────────────
    var ONE = B('/', X(), X());

    var _biCache = {};
    function buildInt(n) {
        if (_biCache[n]) return _biCache[n];
        var s = String(n), clean = true;
        for (var i = 0; i < s.length; i++) { if (il(s[i])) { clean = false; break; } }
        if (clean) return (_biCache[n] = N(n));
        if (n === 0) return (_biCache[n] = B('-', X(), X()));
        if (n === 1) return (_biCache[n] = ONE);
        if (n <= 9) { var nd = ONE; for (var i = 1; i < n; i++) nd = B('+', nd, ONE); return (_biCache[n] = nd); }
        var best = null, bestSize = Infinity;
        for (var a = 2; a * a <= n; a++) {
            if (n % a !== 0) continue;
            var la = buildInt(a), lb = buildInt(n / a);
            var size = astSize(la) + astSize(lb);
            if (size < bestSize) { bestSize = size; best = B('*', la, lb); }
        }
        if (best) return (_biCache[n] = best);
        return (_biCache[n] = B('+', buildInt(n - 1), ONE));
    }

    function astSize(node) {
        if (!node) return 0;
        if (node.t === 'num' || node.t === 'var' || node.t === 'const') return 1;
        if (node.t === 'fn') return 1 + astSize(node.arg);
        return 1 + astSize(node.l) + astSize(node.r);
    }

    function adaptDigits(nd) {
        var v = nd.v;
        if (!Number.isInteger(v)) return nd;
        var needNeg = v < 0 && il('-');
        var s = String(Math.abs(v)), need = false;
        for (var i = 0; i < s.length; i++) { if (il(s[i])) { need = true; break; } }
        if (!need && !needNeg) return nd;
        if (needNeg) {
            if (il('i')) { console.warn('[AutoSolver] 无法生成负数：- 和 i 都被锁定'); return nd; }
            var absNode = need ? adaptDigits(N(Math.abs(v))) : N(Math.abs(v));
            if (absNode.t === 'num' && absNode.v === Math.abs(v) && need) absNode = buildInt(Math.abs(v));
            return B('*', B('*', C('i'), C('i')), absNode);
        }
        for (var d = 1; d <= 3; d++) {
            var cand = Math.abs(v) + d, cs = String(cand), ok = true;
            for (var j = 0; j < cs.length; j++) { if (il(cs[j])) { ok = false; break; } }
            if (ok) { return B('-', v < 0 ? B('-', N(0), N(cand)) : N(cand), buildInt(d)); }
            cand = Math.abs(v) - d;
            if (cand >= 0) { cs = String(cand); ok = true;
                for (var j = 0; j < cs.length; j++) { if (il(cs[j])) { ok = false; break; } }
                if (ok) { return B('+', v < 0 ? B('-', N(0), N(cand)) : N(cand), buildInt(d)); }
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

    // 主 adapt：自底向上单遍，替换产物不回溯
    function adapt(node) {
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
            var a = adapt(node.arg);
            if (node.name === 'abs' && il('abs')) {
                var sq = B('*', a, a);
                if (il('sqrt')) return adaptTree(B('^', sq, adaptTree(adaptDecimal(0.5))));
                return F('sqrt', sq);
            }
            if (node.name === 'sqrt' && il('sqrt')) return adaptTree(B('^', a, adaptTree(adaptDecimal(0.5))));
            if (il(node.name)) console.warn('[AutoSolver] 无法替换被锁函数: ' + node.name);
            return F(node.name, a);
        }
        return adaptOp(node.op, adapt(node.l), adapt(node.r));
    }

    function adaptOp(o, l, r) {
        if (o === '/' && il('/')) {
            if (il('^')) { console.warn('[AutoSolver] 无法替换 /'); return B(o, l, r); }
            return B('*', l, B('^', r, adaptTree(il('-') ? B('*', B('*', C('i'), C('i')), N(1)) : B('-', N(0), N(1)))));
        }
        if (o === '^' && il('^')) { console.warn('[AutoSolver] 无法替换 ^'); return B(o, l, r); }
        if (o === '-' && il('-')) {
            if (il('i')) { console.warn('[AutoSolver] 无法替换 -'); return B(o, l, r); }
            return adaptAdd(l, B('*', B('*', C('i'), C('i')), r));
        }
        if (o === '+' && il('+')) {
            if (il('ln')) { console.warn('[AutoSolver] 无法替换 +'); return B(o, l, r); }
            return F('ln', B('*', B('^', C('e'), l), B('^', C('e'), r)));
        }
        return B(o, l, r);
    }

    function adaptAdd(l, r) {
        if (!il('+')) return B('+', l, r);
        if (il('ln')) return B('+', l, r);
        return F('ln', B('*', B('^', C('e'), l), B('^', C('e'), r)));
    }

    // adaptTree：对替换产物做自底向上清理（不回溯到 adapt 入口）
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
            if (node.v < 0 && il('-')) { if (il('i')) return node; return B('*', B('*', C('i'), C('i')), N(-node.v)); }
            return nd;
        }
        if (node.t === 'fn') {
            var a = adaptTree(node.arg);
            if (node.name === 'abs' && il('abs')) { var sq = B('*', a, a); return il('sqrt') ? B('^', sq, adaptTree(adaptDecimal(0.5))) : F('sqrt', sq); }
            if (node.name === 'sqrt' && il('sqrt')) return B('^', a, adaptTree(adaptDecimal(0.5)));
            return F(node.name, a);
        }
        return adaptOp(node.op, adaptTree(node.l), adaptTree(node.r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § AST → 字符串序列化
    // ─────────────────────────────────────────────────────────────────────────
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
            if (n.op === '-' && n.l.t === 'var' && n.r.t === 'num' && n.r.v < 0 && !il('+')) return 'x+' + toStr(N(-n.r.v));
            var op = n.op, L = toStr(n.l, n.op, 'left'), R = toStr(n.r, n.op, 'right');
            if (op === '*' && il('*')) {
                op = '';
                if (n.r.t === 'num' && n.r.v < 0 && !il('-')) return L + '(ii' + toStr(N(-n.r.v)) + ')';
                L = '(' + L + ')'; R = '(' + R + ')';
            }
            var str = L + op + R;
            if (p && needP(n, p, s)) str = '(' + str + ')';
            return str;
        }
        return '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § 高斯乘积备用路径（经典路径被锁死时启用）
    // ─────────────────────────────────────────────────────────────────────────
    // 核心峰 D(x,p)=(e^(2px)/(e^(p²)*e^(x·x)))^K = e^(-(x-p)²K)
    // f=ΣD → e^f=Πe^D（积代替和）；值 |b|^D；符号 cos(πD)
    // 域限制 e^(0^(ii·cos(π·e^f/(2e^H))))
    // 锁感知发射器：小数→整数倒数, /→^(ii), *→括号并列, 负→i*i

    function gRecipExp() { return il('i') ? '0-1' : (il('*') ? '(i)(i)' : 'i*i'); }
    function gMul(arr) { return il('*') ? arr.map(function(t) { return '(' + t + ')'; }).join('') : arr.join('*'); }
    function gPow(base, exp) { return '(' + base + ')^(' + exp + ')'; }
    function gDiv(a, b) { return il('/') ? gMul([a, gPow(b, gRecipExp())]) : a + '/(' + b + ')'; }

    function gNum(v) {
        if (!isFinite(v)) return '0';
        if (Number.isInteger(v)) return String(v);
        if (!il('.')) { var s = v.toFixed(10); return s.replace(/0+$/, '').replace(/\.$/, ''); }
        var P = 100000000, M = Math.round(v * P);
        return gMul([String(M), gPow(String(P), gRecipExp())]);
    }

    function gConst(v) {
        if (v >= 0) return gNum(v);
        return il('i') ? '0-' + gNum(-v) : gMul(['i', 'i', gNum(-v)]);
    }

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
        var Kf = 22000, Kg = 320, Ks = 320, H = 0.5;
        var magF = [], signF = [], efF = [];
        for (var i = 0; i < pts.length; i++) {
            var p = pts[i].p, b = pts[i].b, absb = Math.abs(b);
            magF.push(gPow(gNum(absb), gaussD(p, Kg)));
            efF.push('e^(' + gaussD(p, Kf) + ')');
            if (b < 0) signF.push('cos(' + gMul(['\u03c0', gaussD(p, Ks)]) + ')');
        }
        var ef = gMul(efF);
        var theta = gDiv(gMul(['\u03c0', ef]), gMul(['2', 'e^(' + gNum(H) + ')']));
        var domain = 'e^(0^(' + gMul(['i', 'i', 'cos(' + theta + ')']) + '))';
        return gMul(magF.concat(signF, [domain]));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Token 化与合法性检查
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // § 求解主流程
    // ─────────────────────────────────────────────────────────────────────────
    function generateExpr(t, lvl) {
        _biCache = {}; // 每次求解清缓存（锁定不同）
        // 1. 硬编码特解
        if (lvl && SPECIAL_SOLUTIONS[lvl]) return SPECIAL_SOLUTIONS[lvl];

        // 2. 经典路径
        var expr = toStr(adapt(buildAst(t)));
        if (lk().length === 0) return expr;

        var violations = exprViolations(expr);
        if (violations.length === 0) return expr;

        // 3. 高斯乘积备用路径
        console.warn('[AutoSolver] 经典路径含被锁元素 [' + violations.join(', ') + ']，尝试高斯路径');
        var gexpr = buildGaussianExpr(t);
        var gv = exprViolations(gexpr);
        if (gv.length === 0) {
            console.log('[AutoSolver] 高斯路径可用 (' + gexpr.length + ' 字符)');
            return gexpr;
        }

        // 4. 两条路径均失败
        console.error('[AutoSolver] Lv.' + (lvl || '?') + ' 无可用路径，放弃');
        return null;
    }

    function solve() {
        var s = st();
        if (!s || s.currentPhase !== 'input_function') return false;
        var t = ts();
        if (!t.length) return false;
        var u = ui();
        if (!u) return false;
        var lvl = campaignLv();

        var expr = generateExpr(t, lvl);
        if (!expr) return false;

        // 提交前最终自检
        var locked = lk();
        if (locked.length > 0) {
            var fin = exprViolations(expr);
            if (fin.length > 0) {
                console.error('[AutoSolver] Lv.' + (lvl || '?') + ' 最终自检失败: [' + fin.join(', ') + ']');
                return false;
            }
        }

        var elems = tokenize(expr);
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
        var lvl = campaignLv();
        var expr = generateExpr(t, lvl);
        if (!expr) {
            console.log('\n=== \u26a0\ufe0f 无法生成合法公式 ===\n==================');
            return null;
        }
        console.log('\n=== 通关公式 ===\n' + expr + '\n==================');
        return expr;
    }

    window.AutoSolver = { solve: solve, showFormula: showFormula };
    console.log('\u2705 AutoSolver 已就绪');
    return { solve: solve, showFormula: showFormula };
})();

// ─────────────────────────────────────────────────────────────────────────────
// § UI：可拖动按钮组（求解 + 自动通关，绑定为一体拖动）
// ─────────────────────────────────────────────────────────────────────────────
(function() {
    setTimeout(function() {
        // 容器：两个按钮作为一个整体拖动
        var wrap = document.createElement('div');
        wrap.id = 'autosolver-panel';
        wrap.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;user-select:none;touch-action:none';
        document.body.appendChild(wrap);

        // 求解按钮
        var solveBtn = document.createElement('button');
        solveBtn.id = 'manual-solve-btn';
        solveBtn.textContent = '\ud83c\udfaf 求解';
        solveBtn.style.cssText = 'padding:10px 20px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:25px;font-size:14px;font-weight:bold;cursor:grab;box-shadow:0 4px 15px rgba(16,185,129,0.4)';
        wrap.appendChild(solveBtn);

        // 自动通关按钮
        var autoBtn = document.createElement('button');
        autoBtn.id = 'autoplay-btn';
        autoBtn.textContent = '\u25b6 自动通关';
        autoBtn.style.cssText = 'padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:30px;font-size:15px;font-weight:bold;cursor:grab;box-shadow:0 4px 15px rgba(102,126,234,0.4)';
        wrap.appendChild(autoBtn);

        // 拖拽逻辑（整个容器）
        var startX, startY, origLeft, origTop, dragging = false, moved = false;
        function onDown(e) {
            var ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX; startY = ev.clientY;
            origLeft = wrap.offsetLeft; origTop = wrap.offsetTop;
            dragging = true; moved = false;
            e.preventDefault();
        }
        function onMove(e) {
            if (!dragging) return;
            var ev = e.touches ? e.touches[0] : e;
            var dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
            if (moved) {
                wrap.style.left = (origLeft + dx) + 'px';
                wrap.style.top = (origTop + dy) + 'px';
                wrap.style.bottom = 'auto'; wrap.style.right = 'auto';
            }
        }
        function onUp() { dragging = false; }
        wrap.addEventListener('mousedown', onDown);
        wrap.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);

        // 点击（非拖拽时触发）
        solveBtn.addEventListener('click', function() {
            if (moved) return;
            if (window.audioManager) window.audioManager.playClick();
            if (window.AutoSolver) AutoSolver.solve();
        });

        // 自动通关逻辑
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
            autoBtn.textContent = '\u25b6 自动通关';
            autoBtn.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
        }
        function start() {
            if (running) return;
            running = true; lastPhase = '';
            autoBtn.textContent = '\u23f8 暂停';
            autoBtn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
            tick();
        }
        autoBtn.addEventListener('click', function() {
            if (moved) return;
            if (window.audioManager) window.audioManager.playClick();
            if (running) stop(); else start();
        });
    }, 800);
})();

