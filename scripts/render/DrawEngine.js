class DrawEngine {
    constructor(parent) { this.parent = parent; }

    _animateDrawFromSegments(segments, color) {
        return new Promise((resolve) => {
            this.parent.cancelDrawing();
            this.parent.isDrawing = true;

            const ctx = this.parent.gridSystem.ctx;
            const animationDuration = 600;
            const startTime = performance.now();

            // 设置绘制样式
            ctx.strokeStyle = color || this.parent.colors.function;
            ctx.lineWidth = this.parent.getAdaptiveLineWidth();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (!color) {
                ctx.shadowColor = this.parent.getAdaptiveGlowColor(color);
                ctx.shadowBlur = this.parent.getAdaptiveGlowSize();
            }

            // 计算总点数
            const totalPoints = segments.reduce((sum, seg) => sum + seg.length, 0);
            if (totalPoints === 0) {
                ctx.shadowBlur = 0;
                this.parent.isDrawing = false;
                resolve();
                return;
            }

            // 每段已绘制到的索引
            const segmentProgress = segments.map(() => 0);

            const drawFrame = (currentTime) => {
                if (!this.parent.isDrawing) {
                    ctx.shadowBlur = 0;
                    resolve();
                    return;
                }

                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);
                const targetPoints = Math.floor(totalPoints * progress);
                let pointsDrawn = 0;

                for (let segIdx = 0; segIdx < segments.length; segIdx++) {
                    const segment = segments[segIdx];
                    const alreadyDrawn = segmentProgress[segIdx];
                    if (pointsDrawn >= targetPoints) break;

                    const pointsToDraw = Math.min(segment.length, targetPoints - pointsDrawn);

                    if (pointsToDraw > alreadyDrawn && pointsToDraw >= 2) {
                        ctx.beginPath();

                        if (alreadyDrawn === 0) {
                            const p0 = this.parent.gridSystem.mathToCanvas(segment[0].x, segment[0].y);
                            ctx.moveTo(p0.x, p0.y);
                            for (let i = 1; i < pointsToDraw; i++) {
                                const p = this.parent.gridSystem.mathToCanvas(segment[i].x, segment[i].y);
                                ctx.lineTo(p.x, p.y);
                            }
                        } else {
                            const startP = this.parent.gridSystem.mathToCanvas(
                                segment[alreadyDrawn - 1].x, segment[alreadyDrawn - 1].y
                            );
                            ctx.moveTo(startP.x, startP.y);
                            for (let i = alreadyDrawn; i < pointsToDraw; i++) {
                                const p = this.parent.gridSystem.mathToCanvas(segment[i].x, segment[i].y);
                                ctx.lineTo(p.x, p.y);
                            }
                        }

                        ctx.stroke();
                        segmentProgress[segIdx] = pointsToDraw;
                    }

                    pointsDrawn += segment.length;
                }

                if (progress < 1 && this.parent.isDrawing) {
                    this.parent.animationFrameId = requestAnimationFrame(drawFrame);
                } else {
                    ctx.shadowBlur = 0;
                    this.parent.isDrawing = false;
                    this.parent.animationFrameId = null;
                    resolve();
                }
            };

            this.parent.animationFrameId = requestAnimationFrame(drawFrame);
        });
    }

    _drawViaGeoGebra(expr, color) {
        const ctx = this.parent.gridSystem.ctx;
        const view = this.parent._buildView();

        // 设置绘制样式
        ctx.strokeStyle = color || this.parent.colors.function;
        ctx.lineWidth = this.parent.getAdaptiveLineWidth();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 光晕效果（测试模式有自定义颜色时不显示）
        if (!color) {
            ctx.shadowColor = this.parent.getAdaptiveGlowColor(color);
            ctx.shadowBlur = this.parent.getAdaptiveGlowSize();
        }

        // ln(...) 走专用轻量采样
        if (/(?:^|[^a-z])ln\s*(?:\(|x|X)/i.test(expr)) {
            const range = this.parent.gridSystem.getRange();
            const points = this.parent._buildLnPoints(expr, range.min, range.max);
            this._drawLnPolyline(points, ctx);
            ctx.shadowBlur = 0;
            return;
        }

        // 其他函数：直接通过 GeneralPathClippedForCurvePlotter 绘制
        const adapter = this.parent._buildAdapter(expr);
        const range = this.parent.gridSystem.getRange();

        const gp = new GeneralPathClippedForCurvePlotter(view, ctx);
        ctx.beginPath();

        try {
            CurvePlotter.plotCurve(adapter, range.min, range.max, view, gp, false, Gap.MOVE_TO);
        } catch (e) {
            console.warn('[FunctionRenderer] geogebra-lite 绘制异常，回退到等步长:', e);
            // 回退到 polyline
            const segments = this.parent._fallbackSegments(expr, range.min, range.max);
            this._drawSegmentsImmediate(segments, ctx);
        }

        ctx.shadowBlur = 0;
    }

    _drawLnPolyline(points, ctx) {
        let started = false;
        ctx.beginPath();
        for (const p of points) {
            if (p.break || p.y === null) {
                if (started) { ctx.stroke(); ctx.beginPath(); }
                started = false;
                continue;
            }
            const c = this.parent.gridSystem.mathToCanvas(p.x, p.y);
            if (!started) {
                ctx.moveTo(c.x, c.y);
                started = true;
            } else {
                ctx.lineTo(c.x, c.y);
            }
        }
        if (started) ctx.stroke();
    }

    _drawSegmentsImmediate(segments, ctx) {
        for (const seg of segments) {
            if (seg.length < 2) continue;
            ctx.beginPath();
            const p0 = this.parent.gridSystem.mathToCanvas(seg[0].x, seg[0].y);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < seg.length; i++) {
                const p = this.parent.gridSystem.mathToCanvas(seg[i].x, seg[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }

    _drawSingleSegment(segment, ctx) {
        if (segment.length < 2) return;
        ctx.beginPath();
        const p0 = this.parent.gridSystem.mathToCanvas(segment[0].x, segment[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < segment.length; i++) {
            const p = this.parent.gridSystem.mathToCanvas(segment[i].x, segment[i].y);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

}

if(typeof module!=='undefined'&&module.exports)module.exports=DrawEngine;