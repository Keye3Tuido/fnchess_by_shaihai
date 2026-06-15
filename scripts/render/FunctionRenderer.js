/**
 * FunctionRenderer 模块
 * 函数采样与绘制 —— 内部调用 geogebra-lite 引擎（CurvePlotter + Cohen-Sutherland 裁剪）
 * 保留动画绘制和发光效果
 * 外部接口不变：drawFunction, sampleFunction, cancelDrawing, convertToPolyline, clear, getYAtX 等
 */
class FunctionRenderer {
    constructor(gridSystem) {
        this.pointSampler=new PointSampler(this);
        this.drawEngine=new DrawEngine(this);
        this.gridSystem = gridSystem;
        this.parser = new FunctionParser();

        // 采样配置（保留供外部查询和 sampleFallback 使用）
        this.deltaX = 0.001;
        this.maxDeltaY = 100;
        this.collisionDeltaX = 0.0002;
        this.collisionMaxDeltaY = 500;

        // 颜色配置
        this.colors = {
            function: '#ffffff',
            glow: 'rgba(255, 255, 255, 0.3)'
        };

        // 动画绘制控制
        this.animationFrameId = null;
        this.isDrawing = false;
    }

    cancelDrawing() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDrawing = false;
    }

    clearRenderCache() {
    }

    // ========== 自适应样式（保持原版） ==========

    getAdaptiveGlowSize() {
        const range = this.gridSystem.range;
        if (range <= 5) return 15;
        if (range <= 10) return 12;
        if (range <= 20) return 8;
        if (range <= 35) return 5;
        return 2;
    }

    getAdaptiveLineWidth() {
        const range = this.gridSystem.range;
        if (range <= 5) return 3;
        if (range <= 10) return 2.5;
        if (range <= 20) return 2;
        if (range <= 35) return 1.5;
        return 1;
    }

    getAdaptiveBatchSize() {
        const range = this.gridSystem.range;
        if (range <= 5) return 25;
        if (range <= 10) return 35;
        if (range <= 20) return 50;
        if (range <= 35) return 70;
        return 100;
    }

    getAdaptiveGlowColor(color = null) {
        const range = this.gridSystem.range;
        let alpha;
        if (range <= 5) alpha = 0.5;
        else if (range <= 10) alpha = 0.4;
        else if (range <= 20) alpha = 0.3;
        else if (range <= 35) alpha = 0.2;
        else alpha = 0.1;

        if (color && color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(255, 255, 255, ${alpha})`;
    }

    // ========== 适配层：将 GridSystem 包装为 geogebra-lite 需要的接口 ==========

    /**
     * 构造 view 对象，供 geogebra-lite 的 GeneralPathClippedForCurvePlotter 和 CurveSegmentInfo 使用
     */
    _buildView(...args){return this.pointSampler._buildView(...args);}

    /**
     * 构造 curve adapter，供 CurveSegmentPlotter.evaluateCurve() 使用
     * geogebra-lite 的 curve 接口要求：evaluateCurve(x, out) → out[0]=x, out[1]=y
     */
    /**
     * 判断两点之间是否为跳跃间断点（而非连续的陡峭函数）
     * 算法：二分取中点验证法（自适应迭代次数）
     * - 取中点 a = (x1+x2)/2，求 f(a)
     * - 如果差值 <= threshold → 连续，返回 false
     * - 如果中点 y 在两端 y 之间 → 函数平滑过渡，继续迭代（最多 32 次）
     * - 如果中点 y 不在两端 y 之间 → 间断特征，6 次后停止，返回 true
     * - 32 次仍差值 >= threshold → 不连线，返回 true
     * @param {object} ast 预解析的 AST
     * @param {number} threshold 跳跃量阈值（= range/100）
     * @returns {boolean} true = 跳跃间断点（不连线）
     */
    _isJumpDiscontinuity(ast, x1, y1, x2, y2, threshold) {
        const dy = Math.abs(y2 - y1);
        if (dy <= threshold) return false;

        let leftX = x1, leftY = y1;
        let rightX = x2, rightY = y2;
        const MAX_ITER = 32;
        const QUICK_STOP = 6;

        for (let i = 0; i < MAX_ITER; i++) {
            const midX = (leftX + rightX) / 2;
            const midY = this.parser.evaluateAst(ast, midX);

            if (midY === null || !Number.isFinite(midY)) return true;

            const diffLeft = Math.abs(midY - leftY);
            const diffRight = Math.abs(midY - rightY);

            if (diffLeft <= threshold && diffRight <= threshold) return false;

            // 区间非常小时：y 差值仍大 → 跳跃；y 差值也小 → 连续
            if (Math.abs(rightX - leftX) < 1e-12) {
                return Math.abs(rightY - leftY) > threshold;
            }

            // 判断中点 y 是否在当前两端 y 之间
            const minY = Math.min(leftY, rightY);
            const maxY = Math.max(leftY, rightY);
            const midBetween = midY >= minY && midY <= maxY;

            // 中点不在两端之间 → 间断特征，6 次后停止判定为跳跃
            if (!midBetween && i >= QUICK_STOP) return true;

            // 向差值更大的方向收缩
            if (diffLeft > diffRight) {
                rightX = midX;
                rightY = midY;
            } else {
                leftX = midX;
                leftY = midY;
            }
        }

        // 32 次迭代仍未收敛 → 不连线
        return true;
    }

    _buildAdapter(...args){return this.pointSampler._buildAdapter(...args);}

    // ========== CapturingPath：捕获数学坐标 segments 供动画回放 ==========

    /**
     * CapturingPath 继承 PathPlotter，但不绘制到 Canvas。
     * 它记录每次 moveTo / lineTo 的数学坐标，形成 segments 数组。
     * 每个 segment 是一个连续曲线段（数学坐标点数组），segment 之间代表断点。
     */
    _createCapturingPath(view) {
        const segments = []; // segments: [ [{x,y}, ...], [{x,y}, ...], ... ]
        let currentSegment = [];

        const cp = new PathPlotter(null); // 基类
        const viewRef = view; // 闭包引用

        // 覆盖基类方法
        cp.firstPoint = function(pos, moveToAllowed) {
            currentSegment = [{ x: pos[0], y: pos[1] }];
        };

        cp.lineTo = function(pos) {
            currentSegment.push({ x: pos[0], y: pos[1] });
        };

        cp.moveTo = function(pos) {
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
            currentSegment = [{ x: pos[0], y: pos[1] }];
        };

        cp.drawTo = function(pos, lineTo) {
            if (lineTo === Gap.LINE_TO) {
                this.lineTo(pos);
            } else {
                this.moveTo(pos);
            }
        };

        cp.corner = function() {};
        cp.cornerPos = function(pos) {
            currentSegment.push({ x: pos[0], y: pos[1] });
        };
        cp.cornerXY = function(x, y) {
            // cornerXY 接收屏幕坐标，这里我们无法完美还原数学坐标，但 corner 在动画中不关键
        };
        cp.endPlot = function() {
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
        };

        cp.newDoubleArray = function() { return [0, 0]; };
        cp.supports = function() { return true; };

        cp._getSegments = function() { return segments; };

        return cp;
    }

    // ========== 采样方法 ==========

    /**
     * 使用 geogebra-lite 引擎采样，返回 segments（数学坐标分段数组）
     * ln(...) 走专用轻量采样，其他走 CurvePlotter.plotCurve()
     */
    _sampleToSegments(...args){return this.pointSampler._sampleToSegments(...args);}

    _shouldForceDenseResample(expr) {
        const s = String(expr || '').toLowerCase().replace(/\s+/g, '');
        return s.includes('!') || s.includes('/cos(') || s.includes('/x') || s.includes('tan(') || s.includes('cot(') || s.includes('sec(') || s.includes('csc(') || s.includes('x^');
    }

    /**
     * ln(...) 专用轻量采样（参考 geogebra-lite/app.js buildLnPoints）
     * 返回 segments 格式
     */
    _buildLnSegments(...args){return this.pointSampler._buildLnSegments(...args);}

    /**
     * ln(...) 采样（参考 geogebra-lite/app.js buildLnPoints）
     * 返回 geogebra-lite 格式: [{x, y}, {break: true}, {x, y}, ...]
     */
    _buildLnPoints(...args){return this.pointSampler._buildLnPoints(...args);}

    /**
     * 等步长回退采样（当 geogebra-lite 异常时使用）
     */
    _fallbackSegments(...args){return this.pointSampler._fallbackSegments(...args);}

    _denseResampleSegments(...args){return this.pointSampler._denseResampleSegments(...args);}

    _estimateLocalSlope(...args){return this.pointSampler._estimateLocalSlope(...args);}

    // ========== 直接绘制（无动画，geogebra-lite 引擎即时绘制） ==========

    /**
     * 通过 geogebra-lite 引擎即时绘制函数曲线到 Canvas
     * ln(...) 走专用采样 + polyline 绘制
     */
    _drawViaGeoGebra(...args){return this.drawEngine._drawViaGeoGebra(...args);}

    /**
     * 绘制 ln points（geogebra-lite 格式：{break: true} 分隔）
     */
    _drawLnPolyline(...args){return this.drawEngine._drawLnPolyline(...args);}

    /**
     * 即时绘制 segments（回退用）
     */
    _drawSegmentsImmediate(...args){return this.drawEngine._drawSegmentsImmediate(...args);}

    // ========== 动画绘制 ==========

    /**
     * 从 segments 逐帧动画绘制函数曲线
     */
    _animateDrawFromSegments(...args){return this.drawEngine._animateDrawFromSegments(...args);}

    // ========== 外部接口 ==========

    /**
     * 采样函数（供碰撞检测使用）
     * 返回原格式 [{x, y}, {x, y: null, isBreak: true}, ...]
     */
    sampleFunction(expression, xMin, xMax, forCollision = false) {
        const range = this.gridSystem.getRange();
        const sampleMin = Math.max(xMin, range.min - 1);
        const sampleMax = Math.min(xMax, range.max + 1);
        return this._segmentsToPoints(this._sampleToSegments(expression, sampleMin, sampleMax));
    }

    /**
     * 绘制函数（主入口）
     * @param {string} expression - 函数表达式
     * @param {boolean} animate - 是否使用动画绘制
     * @param {string} color - 自定义颜色（可选）
     * @returns {Promise<Array>} 采样点数组
     */
    async drawFunction(expression, animate = true, color = null) {
        const range = this.gridSystem.getRange();
        const segments = this._sampleToSegments(expression, range.min, range.max);

        // 统一使用同一份采样结果来绘制和调试，避免“图像”和“蓝点”不对应
        if (animate) {
            await this._animateDrawFromSegments(segments, color);
        } else {
            const ctx = this.gridSystem.ctx;
            ctx.save();
            ctx.strokeStyle = color || this.colors.function;
            ctx.lineWidth = this.getAdaptiveLineWidth();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (!color) {
                ctx.shadowColor = this.getAdaptiveGlowColor(color);
                ctx.shadowBlur = this.getAdaptiveGlowSize();
            }
            this._drawSegmentsImmediate(segments, ctx);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        this.clearRenderCache();
        if (typeof this.gridSystem.clearFunctionCache === 'function') {
            this.gridSystem.clearFunctionCache();
        }
        if (typeof this.parser.clearCache === 'function') {
            this.parser.clearCache();
        }

        return this._segmentsToPoints(segments);
    }

    /**
     * 将 segments 转换为原格式 points
     */
    _segmentsToPoints(segments) {
        const points = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (i > 0) {
                points.push({ x: 0, y: null, isBreak: true });
            }
            for (const p of seg) {
                points.push({ x: p.x, y: p.y });
            }
        }
        return points;
    }

    /**
     * 将采样点转换为折线（用于碰撞检测）
     */
    convertToPolyline(points) {
        const polyline = [];
        for (const p of points) {
            if (p.y === null || p.isBreak) {
                polyline.push(null);
            } else {
                polyline.push({ x: p.x, y: p.y });
            }
        }
        return polyline;
    }

    /**
     * 清除函数图像（重绘网格）
     */
    clear() {
        this.gridSystem.draw();
    }

    /**
     * 预览函数（快速绘制，用于输入时预览）
     */
    previewFunction(expression) {
        this.gridSystem.draw();
        this._drawViaGeoGebra(expression, null);
    }

    /**
     * 获取函数在特定 x 值处的 y 值
     */
    getYAtX(expression, x) {
        return this.parser.evaluate(expression, x);
    }

    /**
     * 等步长兼容采样（旧接口）
     */
    sampleFallback(expression, xMin, xMax) {
        const segments = this._fallbackSegments(expression, xMin, xMax);
        return this._segmentsToPoints(segments);
    }

    /**
     * 即时绘制点数组（旧接口兼容，供 drawPoints 调用）
     */
    drawPoints(points, color = null) {
        const ctx = this.gridSystem.ctx;
        ctx.strokeStyle = color || this.colors.function;
        ctx.lineWidth = this.getAdaptiveLineWidth();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (!color) {
            ctx.shadowColor = this.colors.glow;
            ctx.shadowBlur = this.getAdaptiveGlowSize();
        }

        let currentSegment = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point.y === null) {
                this._drawSingleSegment(currentSegment, ctx);
                currentSegment = [];
            } else {
                currentSegment.push(point);
            }
        }
        if (currentSegment.length > 1) {
            this._drawSingleSegment(currentSegment, ctx);
        }
        ctx.shadowBlur = 0;
    }

    _drawSingleSegment(...args){return this.drawEngine._drawSingleSegment(...args);}

    isPointVisible(point, size) {
        return point.x >= -50 && point.x <= size + 50 &&
               point.y >= -50 && point.y <= size + 50;
    }
    
    
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunctionRenderer;
}
