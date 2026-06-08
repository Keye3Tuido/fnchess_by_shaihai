/**
 * SeedCrypto - 关卡种子加密/解密模块（二进制优化版本）
 *
 * 编码格式：
 * - mapSize索引(4bit) + 压缩地图 + 锁定掩码(16bit) + token数(12bit) + padding + 签名(32bit)
 * - mapSize档位: 实际游戏使用的14个档位
 * - 地图用混合RLE压缩: 自动选择RLE/Bitmap/Raw
 * - 锁定元素用16bit掩码
 */
class SeedCrypto {
    constructor() {
        this._printWarningIfNeeded();
        this.key = this._deriveKey();
        // 编辑器使用的gridSize档位（range: 5,10,15,...,50 对应 gridSize=range*2）
        this.MAP_SIZES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        this.ELEMENTS = ['x','+','-','*','/','ln','sin','cos','tan','sqrt','abs','^','e','pi','i','!'];
    }

    /**
     * 检测非正常使用并显示警告
     */
    _printWarningIfNeeded() {
        // 如果在控制台直接调用，显示警告
        if (!window._seedCryptoWarningShown) {
            console.log(
                '欢迎使用关卡编辑器(level-editor.html)创建关卡！\n' +
                '如需技术交流，请访问项目主页。\n\n',
                'color: #51cf66; font-weight: bold;',
                'color: #adb5bd;',
                'color: #ffd43b; font-weight: bold;',
                'color: #adb5bd;'
            );
            window._seedCryptoWarningShown = true;
        }
    }

    /**
     * 动态派生密钥（增加逆向难度）
     */
    _deriveKey() {
        const base = 'FNCHESS_SHAIHAI_FEAT_KEYE3TUIDO';
        const derived = [];
        for (let i = 0; i < base.length; i++) {
            derived.push(base.charCodeAt(i) ^ (i * 7 + 13));
        }
        return derived;
    }

    /**
     * 计算字节数组签名（防篡改）
     */
    _computeSignature(bytes) {
        let hash = 0x811c9dc5; // FNV-1a 初始值
        for (let i = 0; i < bytes.length; i++) {
            hash ^= bytes[i];
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    }

    /**
     * 加密关卡数据为种子（二进制优化版）
     */
    encrypt(levelData) {
        if (!levelData.targetCells || levelData.targetCells.length === 0) {
            throw new Error('关卡必须包含至少一个目标格');
        }
        if (!levelData.solutionTokens || levelData.solutionTokens <= 0) {
            throw new Error('必须提供有效的解决方案');
        }

        const bs = new BitStream();

        // 1. mapSize索引(4bit)
        const mapSize = levelData.mapSize || 20;
        const sizeIdx = this.MAP_SIZES.indexOf(mapSize);
        if (sizeIdx < 0) throw new Error('不支持的地图尺寸');
        bs.writeBits(sizeIdx, 4);

        // 2. 构建地图数组（从左下到右上，横向优先）
        const totalCells = mapSize * mapSize;
        const map = new Array(totalCells).fill(0);
        const half = mapSize / 2;

        for (const c of levelData.targetCells) {
            const row = half - 1 - c.y;
            const col = c.x + half;
            const idx = row * mapSize + col;
            if (idx < 0 || idx >= totalCells || row < 0 || row >= mapSize || col < 0 || col >= mapSize) {
                throw new Error(`坐标越界: (${c.x}, ${c.y}), mapSize=${mapSize}`);
            }
            map[idx] = 1;
        }
        for (const c of (levelData.forbiddenCells || [])) {
            const row = half - 1 - c.y;
            const col = c.x + half;
            const idx = row * mapSize + col;
            if (idx < 0 || idx >= totalCells || row < 0 || row >= mapSize || col < 0 || col >= mapSize) {
                throw new Error(`坐标越界: (${c.x}, ${c.y}), mapSize=${mapSize}`);
            }
            map[idx] = 2;
        }

        // 3. 自适应混合压缩地图
        const compressedMap = AdaptiveRLE.encode(map);
        const mapBitLen = compressedMap.getBitLength();
        bs.writeBits(mapBitLen, 16); // 地图位长度

        // 写入地图数据（按位）
        const mapBs = compressedMap;
        for (let i = 0; i < mapBitLen; i++) {
            const byteIdx = Math.floor(i / 8);
            const bitIdx = 7 - (i % 8);
            const bit = (mapBs.bytes[byteIdx] >> bitIdx) & 1;
            bs.writeBits(bit, 1);
        }

        // 地图数据对齐到字节边界
        const mapEndPos = bs.getBitLength();
        const mapPadding = (8 - (mapEndPos % 8)) % 8;
        if (mapPadding > 0) {
            bs.writeBits(0, mapPadding);
        }

        // 4. 锁定元素掩码(16bit)
        let lockMask = 0;
        for (const elem of (levelData.lockedElements || [])) {
            const idx = this.ELEMENTS.indexOf(elem);
            if (idx >= 0) lockMask |= (1 << idx);
        }
        bs.writeBits(lockMask, 16);

        // 5. token数(16bit，支持0-65535)
        bs.writeBits(levelData.solutionTokens, 16);

        // 6. 对齐到字节边界
        const bitPos = bs.getBitLength();
        const paddingBits = (8 - (bitPos % 8)) % 8;
        if (paddingBits > 0) {
            bs.writeBits(0, paddingBits);
        }

        // 7. 计算签名并追加
        const dataBytes = bs.toBytes();
        const sig = this._computeSignature(dataBytes);
        bs.writeBits(sig, 32);

        // XOR加密 + Base64
        const encrypted = this._xorEncrypt(bs.toBytes());
        return this._bytesToBase64(encrypted);
    }

    /**
     * 解密种子为关卡数据
     */
    decrypt(seed) {
        try {
            const encrypted = this._base64ToBytes(seed);
            const bytes = this._xorDecrypt(encrypted);
            const bs = new BitStream(bytes);

            // 读取mapSize
            const sizeIdx = bs.readBits(4);
            const mapSize = this.MAP_SIZES[sizeIdx];

            // 读取压缩地图
            const mapBitLen = bs.readBits(16);
            const mapBytes = [];

            // 按位读取地图数据
            for (let i = 0; i < mapBitLen; i++) {
                const bit = bs.readBits(1);
                const byteIdx = Math.floor(i / 8);
                const bitIdx = 7 - (i % 8);
                if (byteIdx >= mapBytes.length) mapBytes.push(0);
                mapBytes[byteIdx] |= (bit << bitIdx);
            }

            // 跳过地图对齐padding
            const mapEndPos = bs.bitPos;
            const mapPadding = (8 - (mapEndPos % 8)) % 8;
            if (mapPadding > 0) {
                bs.readBits(mapPadding);
            }

            const mapBs = new BitStream(new Uint8Array(mapBytes));
            const map = AdaptiveRLE.decode(mapBs, mapSize * mapSize);

            // 还原坐标
            const targetCells = [];
            const forbiddenCells = [];
            const half = mapSize / 2;
            for (let i = 0; i < map.length; i++) {
                if (map[i] !== 0) {
                    const row = Math.floor(i / mapSize);
                    const col = i % mapSize;
                    const x = col - half;
                    const y = half - 1 - row;
                    if (map[i] === 1) targetCells.push({x, y});
                    else forbiddenCells.push({x, y});
                }
            }

            // 读取锁定掩码
            const lockMask = bs.readBits(16);
            const lockedElements = [];
            for (let i = 0; i < 16; i++) {
                if (lockMask & (1 << i)) lockedElements.push(this.ELEMENTS[i]);
            }

            // 读取token数
            const solutionTokens = bs.readBits(16);

            // 对齐到字节边界（跳过padding）
            const bitPos = bs.bitPos;
            const paddingBits = (8 - (bitPos % 8)) % 8;
            if (paddingBits > 0) {
                bs.readBits(paddingBits);
            }

            // 验证签名
            const dataByteLen = Math.ceil(bs.bitPos / 8);
            const dataBytes = bytes.slice(0, dataByteLen);
            const expectedSig = this._computeSignature(dataBytes);
            const providedSig = bs.readBits(32) >>> 0; // 转为无符号

            if (providedSig !== expectedSig) {
                throw new Error('签名验证失败');
            }

            return {targetCells, forbiddenCells, lockedElements, solutionTokens, mapSize};
        } catch (e) {
            throw new Error('种子解密失败');
        }
    }

    /**
     * XOR加密
     */
    _xorEncrypt(bytes) {
        const result = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            result[i] = bytes[i] ^ this.key[i % this.key.length];
        }
        return result;
    }

    /**
     * XOR解密（与加密相同）
     */
    _xorDecrypt(bytes) {
        return this._xorEncrypt(bytes);
    }

    /**
     * 字符串转字节数组
     */
    _stringToBytes(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
    }

    /**
     * 字节数组转字符串
     */
    _bytesToString(bytes) {
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    /**
     * 字节数组转Base64
     */
    _bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Base64转字节数组
     */
    _base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}
