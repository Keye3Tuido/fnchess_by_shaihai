/**
 * BitmapCodec - 位图分层编码（稠密分布优化）
 *
 * 编码策略：
 * - 第一层：每格1bit表示是否非空（0=空，1=有值）
 * - 第二层：非空格用1bit区分类型（0=目标，1=禁止）
 *
 * 压缩效果：
 * - 50%非零：400格 → 200bit(掩码) + 100bit(类型) = 300bit（节省25%）
 * - 80%非零：400格 → 400bit(掩码) + 320bit(类型) = 720bit（节省10%）
 */
class BitmapCodec {
    static encode(map) {
        const bs = new BitStream();

        // 第一层：非零掩码
        const nonZeroIndices = [];
        for (let i = 0; i < map.length; i++) {
            const isNonZero = map[i] !== 0;
            bs.writeBits(isNonZero ? 1 : 0, 1);
            if (isNonZero) nonZeroIndices.push(i);
        }

        // 第二层：非零格类型（1→0, 2→1）
        for (const idx of nonZeroIndices) {
            bs.writeBits(map[idx] === 2 ? 1 : 0, 1);
        }

        return bs;
    }

    static decode(bs, totalCells) {
        const map = [];

        // 读取非零掩码
        const nonZeroMask = [];
        for (let i = 0; i < totalCells; i++) {
            nonZeroMask.push(bs.readBits(1));
        }

        // 读取非零格类型
        for (let i = 0; i < totalCells; i++) {
            if (nonZeroMask[i] === 0) {
                map.push(0);
            } else {
                const type = bs.readBits(1);
                map.push(type === 0 ? 1 : 2);
            }
        }

        return map;
    }
}
