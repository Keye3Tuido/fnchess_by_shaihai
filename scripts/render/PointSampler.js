class PointSampler {
    constructor(parent) { this.parent = parent; }

    _buildView() {
        const gs = this.parent.gridSystem;
        return {
            getWidth: () => gs.canvas.width,
            getHeight: () => gs.canvas.height,
            toScreenCoordXd: (x) => gs.mathToCanvas(x, 0).x,
            toScreenCoordYd: (y) => gs.mathToCanvas(0, y).y,
            isOnView: () => true,
            getYscale: () => gs.canvas.height / (gs.range * 2),
            isSegmentOffView: (a, b) => {
                const left = gs.mathToCanvas(a[0], a[1]);
                const right = gs.mathToCanvas(b[0], b[1]);
                const w = gs.canvas.width, h = gs.canvas.height;
                return (left.x < 0 && right.x < 0) || (left.x > w && right.x > w) ||
                       (left.y < 0 && right.y < 0) || (left.y > h && right.y > h);
            },
            getMaxBend: () => Math.tan(10 * Math.PI / 180),
            getMaxBendOffScreen: () => Math.tan(45 * Math.PI / 180),
            getEuclidianController: () => ({ addZoomerAnimationListener() {}, removeZoomerAnimationListener() {} }),
            getSettings: () => null
        };
    }

    _buildAdapter(expr) {
        const parser = this.parent.parser;
        const gs = this.parent.gridSystem;
        // 预解析 AST，避免 evaluateCurve 和 _isJumpDiscontinuity 中重复 parse
        const ast = parser.parse(expr);
        const jumpThresh = Math.max(gs.range / 100, 0.01);
        const isJumpFn = (x1, y1, x2, y2) => this.parent._isJumpDiscontinuity(ast, x1, y1, x2, y2, jumpThresh);
        // 跳跃间断点检测：上次有效求值点，用于判断 Y 跳变
        let lastValidX = null;
        let lastValidY = null;

        return {
            expr,
            newDoubleArray() { return [0, 0]; },
            isFunctionInX() { return true; },
            getMinDistX() { return 1e-4; },
            /** 无副作用求值：不修改 lastValidX/Y 追踪状态，供间断检测使用 */
            evaluateRaw(x) { return parser.evaluateAst(ast, x); },
            evaluateCurve(x, out) {
                out[0] = x;
                const y = parser.evaluateAst(ast, x);

                // 求值失败 → 标记 undefined，重置追踪
                if (y === null || !Number.isFinite(y)) {
                    out[1] = NaN;
                    lastValidX = null;
                    lastValidY = null;
                    return;
                }

                // 跳跃间断点检测：与上一个有效点比较 Y 跳变
                if (lastValidX !== null && lastValidY !== null) {
                    const dx = Math.abs(x - lastValidX);
                    // 只在 x 间距较小时才检测跳变（避免跨区间误判）
                    if (dx > 1e-12 && dx < gs.range * 0.1) {
                        if (isJumpFn(lastValidX, lastValidY, x, y)) {
                            out[1] = NaN;
                            // 不更新 lastValid，下次将从新位置重新开始追踪
                            return;
                        }
                    }
                }

                out[1] = y;
                lastValidX = x;
                lastValidY = y;
            },
            updateExpandedFunctions() {},
            distanceMax(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); }
        };
    }

    _sampleToSegments(expr, xMin, xMax) {

        if (/(?:^|[^a-z])ln\s*(?:\(|x|X)/i.test(expr)) {
            const lnSeg = this._buildLnSegments(expr, xMin, xMax);
            return lnSeg;
        }

        const segments = this._denseResampleSegments(expr, xMin, xMax);
        return segments;
    }

    _buildLnSegments(expr, xMin, xMax) {
        const points = this._buildLnPoints(expr, xMin, xMax);
        // 将 geogebra-lite 格式的 points [{x, y}, {break: true}, ...] 转换为 segments
        const segments = [];
        let currentSegment = [];

        for (const p of points) {
            if (p.break) {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
            } else {
                currentSegment.push({ x: p.x, y: p.y });
            }
        }
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        return segments;
    }

    _buildLnPoints(expr, xMin, xMax) {
        const width = Math.max(1, this.parent.gridSystem.canvas.width || 800);
        const baseStep = Math.max((xMax - xMin) / Math.max(7000, width * 30), (xMax - xMin) / 60000);
        const points = [];
        let lastValid = false;
        const ast = this.parent.parser.parse(expr);
        // 画布可视范围
        const viewRange = Math.max(this.parent.gridSystem.range, (xMax - xMin) / 2);

        const stepFor = (x, y) => {
            const ax = Math.abs(x);
            const ay = Math.abs(y);
            const s = expr.toLowerCase().replace(/\s+/g, '');
            let step = baseStep;
            if (ax < 0.15) step *= 0.06;
            else if (ax < 0.35) step *= 0.1;
            else if (ax < 1) step *= 0.18;
            else if (ax < 3) step *= 0.4;
            if (s.includes('ln(-x)') || s.includes('ln(-x+') || s.includes('ln(-x-')) step *= 0.65;
            if (ay > 4) step *= 0.35;
            if (ay > 8) step *= 0.2;
            return Math.max(step, baseStep / 30);
        };

        let lastInvalidX = xMin; // 记录最近一次离开画布/无效的 x 位置

        for (let x = xMin; x <= xMax;) {
            const y = this.parent.parser.evaluateAst(ast, x);
            if (y !== null && isFinite(y)) {
                const offCanvas = Math.abs(y) > viewRange;

                // 超画布的点：二分搜索精确边界穿越点，再断开
                if (offCanvas) {
                    // 找到最后一个画布内的点，做二分搜索
                    let lastPt = null;
                    for (let k = points.length - 1; k >= 0; k--) {
                        if (!points[k].break && points[k].y !== undefined) { lastPt = points[k]; break; }
                    }
                    if (lastPt) {
                        let lo = lastPt.x, hi = x;
                        for (let iter = 0; iter < 6; iter++) {
                            const mid = (lo + hi) / 2;
                            const midY = this.parent.parser.evaluateAst(ast, mid);
                            if (midY !== null && isFinite(midY) && Math.abs(midY) <= viewRange) {
                                lo = mid; // mid 在画布内，推高 lo
                            } else {
                                hi = mid; // mid 在画布外，拉低 hi
                            }
                        }
                        const finalY = this.parent.parser.evaluateAst(ast, lo);
                        if (finalY !== null && isFinite(finalY) && Math.abs(finalY) <= viewRange && lo > lastPt.x) {
                            points.push({ x: lo, y: finalY });
                        }
                    }
                    if (points.length && !points[points.length - 1].break) points.push({ break: true });
                    lastInvalidX = x;
                    lastValid = false;
                    x += baseStep;
                    continue;
                }

                // 跳跃间断点检测：与上一个有效点比较
                let isJump = false;
                if (lastValid && points.length) {
                    let lastPt = null;
                    for (let k = points.length - 1; k >= 0; k--) {
                        if (!points[k].break && points[k].y !== undefined) { lastPt = points[k]; break; }
                    }
                    if (lastPt) {
                        const dy = Math.abs(y - lastPt.y);
                        const jumpThresh = Math.max(this.parent.gridSystem.range / 100, 0.01);
                        if (dy > jumpThresh && this.parent._isJumpDiscontinuity(ast, lastPt.x, lastPt.y, x, y, jumpThresh)) {
                            isJump = true;
                        }
                    }
                }

                if (isJump) {
                    points.push({ break: true });
                    points.push({ x, y });
                } else if (lastValid && points.length && !points[points.length - 1].break) {
                    points.push({ x, y });
                } else {
                    // 从无效区域回到画布内 → 二分搜索找精确入口
                    if (!lastValid && lastInvalidX < x) {
                        let lo = lastInvalidX, hi = x;
                        for (let iter = 0; iter < 6; iter++) {
                            const mid = (lo + hi) / 2;
                            const midY = this.parent.parser.evaluateAst(ast, mid);
                            if (midY !== null && isFinite(midY) && Math.abs(midY) <= viewRange) {
                                hi = mid; // mid 在画布内，拉低 hi
                            } else {
                                lo = mid; // mid 在画布外/无效，推高 lo
                            }
                        }
                        const finalY = this.parent.parser.evaluateAst(ast, hi);
                        if (finalY !== null && isFinite(finalY) && Math.abs(finalY) <= viewRange && hi < x) {
                            points.push({ break: true });
                            points.push({ x: hi, y: finalY });
                        }
                    }
                    points.push({ break: true });
                    points.push({ x, y });
                }
                lastValid = true;
                x += stepFor(x, y);
            } else {
                if (points.length && !points[points.length - 1].break) points.push({ break: true });
                lastInvalidX = x;
                lastValid = false;
                x += baseStep;
            }
        }
        return points;
    }

    _fallbackSegments(expr, xMin, xMax) {
        const segments = [];
        let currentSegment = [];
        const step = 0.001;
        const ast = this.parent.parser.parse(expr);
        const viewRange = Math.max(this.parent.gridSystem.range, (xMax - xMin) / 2);

        for (let x = xMin; x <= xMax; x += step) {
            const y = this.parent.parser.evaluateAst(ast, x);
            if (y !== null && isFinite(y)) {
                // 超画布的点：断开当前段，不加入
                if (Math.abs(y) > viewRange) {
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment);
                        currentSegment = [];
                    }
                    continue;
                }
                // 跳跃间断点检测：与当前段最后一个点比较
                if (currentSegment.length > 0) {
                    const last = currentSegment[currentSegment.length - 1];
                    const dy = Math.abs(y - last.y);
                    const jumpThresh = Math.max(this.parent.gridSystem.range / 100, 0.01);
                    if (dy > jumpThresh && this.parent._isJumpDiscontinuity(ast, last.x, last.y, x, y, jumpThresh)) {
                        segments.push(currentSegment);
                        currentSegment = [];
                    }
                }
                currentSegment.push({ x, y });
            } else {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
            }
        }
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }
        return segments;
    }

    _denseResampleSegments(expr, xMin, xMax) {
        const width = Math.max(1, this.parent.gridSystem.canvas.width || 800);
        const span = xMax - xMin;
        const targetPixelGap = 12;
        const dyThreshold = 8;
        const maxRounds = 6;
        const maxStep = Math.max(span / Math.max(3200, width * 18), span / 120000, 0.0005);
        const minStep = Math.max(span / Math.max(50000, width * 140), span / 500000, 0.00008);
        const ast = this.parent.parser.parse(expr);
        // 画布可视范围：超出此范围的点标记 isOffCanvas，不参与连线/调试描点
        const viewRange = Math.max(this.parent.gridSystem.range, span / 2);

        let points = [];
        for (let x = xMin; x <= xMax;) {
            const y = this.parent.parser.evaluateAst(ast, x);
            if (y !== null && isFinite(y)) {
                points.push({ x, y, isOffCanvas: Math.abs(y) > viewRange });
                const slope = this._estimateLocalSlope(ast, x, span);
                const slopeFactor = Math.sqrt(1 + slope * slope);
                const step = Math.min(maxStep, Math.max(minStep, targetPixelGap / Math.max(slopeFactor, 1)));
                x += step;
            } else {
                points.push({ x, y: null, isBreak: true });
                x += maxStep;
            }
        }

        for (let round = 0; round < maxRounds; round++) {
            const refined = [];
            let changed = false;

            for (let i = 0; i < points.length; i++) {
                const cur = points[i];
                refined.push(cur);
                const next = points[i + 1];
                if (!next || cur.isBreak || next.isBreak || cur.y == null || next.y == null) continue;

                // 两个点都在画布外 → 跳过迭代，不插入中点
                if (cur.isOffCanvas && next.isOffCanvas) continue;

                const dy = Math.abs(next.y - cur.y);
                // 一点在画布内、一点在画布外 → 强制插入中点（边界细化）
                const isBoundaryPair = cur.isOffCanvas !== next.isOffCanvas;
                if (!isBoundaryPair && dy <= dyThreshold) continue;

                // 跳跃间断点检测：y 变化 > jumpThresh → 用二分中点验证法
                const jumpThresh = Math.max(this.parent.gridSystem.range / 100, 0.01);
                if (dy > jumpThresh && this.parent._isJumpDiscontinuity(ast, cur.x, cur.y, next.x, next.y, jumpThresh)) {
                    refined.push({ x: (cur.x + next.x) / 2, y: null, isBreak: true });
                    changed = true;
                    continue;
                }

                const midX = (cur.x + next.x) / 2;
                if (midX === cur.x || midX === next.x) continue;
                const midY = this.parent.parser.evaluateAst(ast, midX);
                if (midY === null || !isFinite(midY)) {
                    refined.push({ x: midX, y: null, isBreak: true });
                } else {
                    refined.push({ x: midX, y: midY, isOffCanvas: Math.abs(midY) > viewRange });
                }
                changed = true;
            }

            points = refined;
            if (!changed) break;
        }

        // 构建 segments：超画布的点完全不加入（不连线、不描点）
        const segments = [];
        let currentSegment = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.isBreak || p.y === null) {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
                continue;
            }
            // 超画布的点：断开当前段，不加入
            if (p.isOffCanvas) {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
                continue;
            }
            if (currentSegment.length > 0) {
                const last = currentSegment[currentSegment.length - 1];
                const segDy = Math.abs(p.y - last.y);
                // 跳跃间断点检测
                const jumpThresh = Math.max(this.parent.gridSystem.range / 100, 0.01);
                if (segDy > dyThreshold || (segDy > jumpThresh && this.parent._isJumpDiscontinuity(ast, last.x, last.y, p.x, p.y, jumpThresh))) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
            }
            currentSegment.push({ x: p.x, y: p.y });
        }
        if (currentSegment.length > 0) segments.push(currentSegment);
        return segments;
    }

    _estimateLocalSlope(ast, x, span) {
        const eps = Math.max(span / 4000, 0.0001);
        const y1 = this.parent.parser.evaluateAst(ast, x - eps);
        const y2 = this.parent.parser.evaluateAst(ast, x + eps);
        if (!Number.isFinite(y1) || !Number.isFinite(y2)) return 0;
        return Math.abs((y2 - y1) / Math.max(2 * eps, 1e-12));
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=PointSampler;