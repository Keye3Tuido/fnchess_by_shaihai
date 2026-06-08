/**
 * AdaptiveRLE - 自适应游程编码（混合三算法）
 *
 * 自动选择最优算法：
 * - 密度<15%: RLE（游程编码）
 * - 密度15-50%: Bitmap（位图分层）
 * - 密度>50%: Raw（直接存储）
 */
class AdaptiveRLE {
    static encode(map) {
        // 尝试三种算法，选择最小的
        const rle = this._encodeRLE(map);
        const bitmap = BitmapCodec.encode(map);
        const raw = this._encodeRaw(map);

        const sizes = [
            {type: 0, bs: rle, size: rle.getBitLength()},
            {type: 1, bs: bitmap, size: bitmap.getBitLength()},
            {type: 2, bs: raw, size: raw.getBitLength()}
        ];
        const best = sizes.sort((a, b) => a.size - b.size)[0];

        const result = new BitStream();
        result.writeBits(best.type, 2); // 算法类型
        const bytes = best.bs.toBytes();
        for (const byte of bytes) {
            result.writeBits(byte, 8);
        }
        return result;
    }

    static _encodeRaw(map) {
        const bs = new BitStream();
        for (const val of map) {
            bs.writeBits(val, 2);
        }
        return bs;
    }

    static _encodeRLE(map) {
        const bs = new BitStream();
        let i = 0;

        while (i < map.length) {
            const val = map[i];
            let runLen = 1;
            while (i + runLen < map.length && map[i + runLen] === val && runLen < 67) {
                runLen++;
            }

            if (runLen >= 4) {
                bs.writeBits(1, 1);
                bs.writeBits(val, 2);
                bs.writeBits(runLen - 4, 6);
                i += runLen;
            } else {
                const directStart = i;
                let directLen = 0;
                while (i < map.length && directLen < 16) {
                    const v = map[i];
                    let ahead = 1;
                    while (i + ahead < map.length && map[i + ahead] === v && ahead < 4) {
                        ahead++;
                    }
                    if (ahead >= 4) break;
                    directLen++;
                    i++;
                }

                bs.writeBits(0, 1);
                bs.writeBits(directLen - 1, 4);
                for (let j = 0; j < directLen; j++) {
                    bs.writeBits(map[directStart + j], 2);
                }
            }
        }

        return bs;
    }

    static decode(bs, totalCells) {
        const type = bs.readBits(2);

        if (type === 0) {
            // RLE模式
            return this._decodeRLE(bs, totalCells);
        } else if (type === 1) {
            // Bitmap模式
            return BitmapCodec.decode(bs, totalCells);
        } else {
            // Raw模式
            const map = [];
            for (let i = 0; i < totalCells; i++) {
                map.push(bs.readBits(2));
            }
            return map;
        }
    }

    static _decodeRLE(bs, totalCells) {
        const map = [];
        while (map.length < totalCells) {
            const segType = bs.readBits(1);

            if (segType === 1) {
                const val = bs.readBits(2);
                const runLen = bs.readBits(6) + 4;
                for (let i = 0; i < runLen && map.length < totalCells; i++) {
                    map.push(val);
                }
            } else {
                const directLen = bs.readBits(4) + 1;
                for (let i = 0; i < directLen && map.length < totalCells; i++) {
                    map.push(bs.readBits(2));
                }
            }
        }
        return map.slice(0, totalCells);
    }
}
