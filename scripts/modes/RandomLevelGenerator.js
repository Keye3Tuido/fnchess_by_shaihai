/**
 * RandomLevelGenerator - 随机关卡生成器
 * 职责：生成随机目标格、禁止格、锁定元素
 */
class RandomLevelGenerator {
    constructor() {
        this.mapSize = 10;
    }

    generate() {
        const N = this.mapSize * this.mapSize;
        const toDistribute = Math.floor((N - 1) / 2);

        const rand1 = Math.random();
        const rand2 = Math.random();
        const splits = [rand1, rand2].sort((x, y) => x - y);

        const a = Math.floor(splits[0] * toDistribute);
        const b = Math.floor((splits[1] - splits[0]) * toDistribute);

        const targetCount = a + 1;
        const forbiddenCount = b;
        const density = (targetCount + forbiddenCount) / N;

        let groupCountDist;
        if (density < 0.15) {
            groupCountDist = [0.05, 0.15, 0.25, 0.30, 0.25];
        } else if (density < 0.30) {
            groupCountDist = [0.20, 0.25, 0.25, 0.20, 0.10];
        } else {
            groupCountDist = [0.35, 0.30, 0.20, 0.10, 0.05];
        }

        const usedCells = new Set();
        const targetCells = [];
        const forbiddenCells = [];

        while (targetCells.length < targetCount) {
            const x = Math.floor(Math.random() * this.mapSize) - Math.floor(this.mapSize / 2);
            const y = Math.floor(Math.random() * this.mapSize) - Math.floor(this.mapSize / 2);
            const key = `${x},${y}`;
            if (!usedCells.has(key)) {
                usedCells.add(key);
                targetCells.push({ x, y });
            }
        }

        while (forbiddenCells.length < forbiddenCount) {
            const x = Math.floor(Math.random() * this.mapSize) - Math.floor(this.mapSize / 2);
            const y = Math.floor(Math.random() * this.mapSize) - Math.floor(this.mapSize / 2);
            const key = `${x},${y}`;
            if (!usedCells.has(key)) {
                usedCells.add(key);
                forbiddenCells.push({ x, y, type: Math.random() < 0.5 ? 1 : 2 });
            }
        }

        const lockGroups = [
            { elements: ['x'], weight: 0.03 },
            { elements: ['0','1','2','3','4','5','6','7','8','9'], weight: 0.10 },
            { elements: ['+', '-'], weight: 1.00 },
            { elements: ['*', '/'], weight: 1.00 },
            { elements: ['^', 'sqrt', 'abs'], weight: 1.00 },
            { elements: ['ln'], weight: 1.00 },
            { elements: ['sin'], weight: 1.00 },
            { elements: ['cos'], weight: 1.00 },
            { elements: ['tan'], weight: 1.00 },
            { elements: ['!'], weight: 1.00 },
            { elements: ['.'], weight: 1.00 },
            { elements: ['π'], weight: 1.00 },
            { elements: ['e'], weight: 1.00 },
            { elements: ['i'], weight: 1.00 },
        ];

        const numGroups = this._weightedRandomIndex(groupCountDist);
        const selectedGroups = this._weightedRandomSelect(lockGroups, numGroups);

        let lockedElements = [];
        for (const g of selectedGroups) {
            lockedElements.push(...g.elements);
        }

        const hasXGroup = selectedGroups.some(g => g.elements.includes('x'));
        const hasDigitsGroup = selectedGroups.some(g => g.elements.some(e => /^[0-9]$/.test(e)));
        if (hasXGroup && hasDigitsGroup) {
            if (Math.random() < 0.5) {
                lockedElements = lockedElements.filter(e => !/^[0-9]$/.test(e));
            } else {
                lockedElements = lockedElements.filter(e => e !== 'x');
            }
        }

        lockedElements = lockedElements.filter(e => e !== '(' && e !== ')');

        return {
            mapSize: this.mapSize,
            targetCells,
            forbiddenCells,
            lockedElements,
            solutionTokens: 0
        };
    }

    _weightedRandomIndex(weights) {
        const total = weights.reduce((s, w) => s + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    _weightedRandomSelect(groups, num) {
        if (num <= 0) return [];
        if (num >= groups.length) return [...groups];

        const remaining = groups.map((g, i) => ({ ...g, idx: i }));
        const selected = [];

        for (let k = 0; k < num; k++) {
            const totalWeight = remaining.reduce((sum, g) => sum + g.weight, 0);
            if (totalWeight <= 0) break;

            let r = Math.random() * totalWeight;
            let pickedIdx = 0;
            for (let i = 0; i < remaining.length; i++) {
                r -= remaining[i].weight;
                if (r <= 0) { pickedIdx = i; break; }
            }

            selected.push(remaining[pickedIdx]);
            remaining.splice(pickedIdx, 1);
        }

        return selected;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RandomLevelGenerator;
}
