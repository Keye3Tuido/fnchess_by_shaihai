/**
 * SeedCrypto - 关卡种子加密/解密模块
 *
 * 你好！既然你看到了这段代码，说明你有一定的技术能力。
 *
 * 本项目的加密不是为了对抗你，而是为了：
 * 1. 防止普通用户随意构造无效关卡
 * 2. 确保分享的关卡经过验证（包含答案token数）
 * 3. 提供基本的数据完整性检查
 *
 * 如果你想创建自定义关卡，请使用关卡编辑器(level-editor.html)。
 * 如果你发现了bug或有改进建议，欢迎提交issue或PR。
 *
 * 请不要：
 * - 生成不可解的恶意关卡误导其他玩家
 * - 用于任何商业目的
 *
 * 感谢理解！
 */
class SeedCrypto {
    constructor() {
        this._printWarningIfNeeded();
        this.key = this._deriveKey();
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
        const base = 'FNCHESS2026';
        const derived = [];
        for (let i = 0; i < base.length; i++) {
            derived.push(base.charCodeAt(i) ^ (i * 7 + 13));
        }
        return derived;
    }

    /**
     * 计算数据签名（防篡改）
     */
    _computeSignature(data) {
        const str = JSON.stringify(data);
        let hash = 0x811c9dc5; // FNV-1a 初始值
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(36);
    }

    /**
     * 加密关卡数据为种子
     * @param {Object} levelData - 关卡数据
     * @returns {string} 加密后的种子字符串
     */
    encrypt(levelData) {
        // 验证必需字段
        if (!levelData.targetCells || levelData.targetCells.length === 0) {
            throw new Error('关卡必须包含至少一个目标格');
        }
        if (!levelData.solutionTokens || levelData.solutionTokens <= 0) {
            throw new Error('必须提供有效的解决方案');
        }

        // 构建数据对象
        const data = {
            v: 1, // 版本号
            t: levelData.targetCells,
            f: levelData.forbiddenCells || [],
            l: levelData.lockedElements || [],
            s: levelData.solutionTokens,
            m: levelData.mapSize || 20
        };

        // 添加签名（防篡改）
        data.sig = this._computeSignature(data);

        // JSON序列化
        const json = JSON.stringify(data);

        // 转换为字节数组
        const bytes = this._stringToBytes(json);

        // XOR加密
        const encrypted = this._xorEncrypt(bytes);

        // Base64编码
        return this._bytesToBase64(encrypted);
    }

    /**
     * 解密种子为关卡数据
     * @param {string} seed - 种子字符串
     * @returns {Object} 关卡数据
     */
    decrypt(seed) {
        try {
            // Base64解码
            const encrypted = this._base64ToBytes(seed);

            // XOR解密
            const bytes = this._xorDecrypt(encrypted);

            // 转换为字符串
            const json = this._bytesToString(bytes);

            // 解析JSON
            const data = JSON.parse(json);

            // 验证数据结构
            if (!data.v || !data.t || data.t.length === 0) {
                throw new Error('无效的种子格式');
            }

            // 验证签名（防篡改）
            const providedSig = data.sig;
            delete data.sig; // 计算签名时不包含签名字段本身
            const expectedSig = this._computeSignature(data);

            if (providedSig !== expectedSig) {
                throw new Error('种子签名验证失败，数据可能被篡改');
            }

            return {
                targetCells: data.t,
                forbiddenCells: data.f || [],
                lockedElements: data.l || [],
                solutionTokens: data.s,
                mapSize: data.m || 20
            };
        } catch (e) {
            throw new Error('种子解密失败：' + e.message);
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
