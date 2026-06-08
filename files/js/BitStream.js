/**
 * BitStream - 位级读写工具
 */
class BitStream {
    constructor(buffer = null) {
        this.bytes = buffer ? Array.from(buffer) : [];
        this.bitPos = 0;
    }

    writeBits(value, numBits) {
        for (let i = numBits - 1; i >= 0; i--) {
            const bit = (value >> i) & 1;
            const byteIdx = Math.floor(this.bitPos / 8);
            const bitIdx = 7 - (this.bitPos % 8);
            if (byteIdx >= this.bytes.length) this.bytes.push(0);
            this.bytes[byteIdx] |= (bit << bitIdx);
            this.bitPos++;
        }
    }

    readBits(numBits) {
        let value = 0;
        for (let i = 0; i < numBits; i++) {
            const byteIdx = Math.floor(this.bitPos / 8);
            const bitIdx = 7 - (this.bitPos % 8);
            if (byteIdx >= this.bytes.length) throw new Error('读取超出边界');
            const bit = (this.bytes[byteIdx] >> bitIdx) & 1;
            value = (value << 1) | bit;
            this.bitPos++;
        }
        return value;
    }

    toBytes() {
        return new Uint8Array(this.bytes);
    }

    getBitLength() {
        return this.bitPos;
    }
}
