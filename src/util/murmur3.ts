// MurmurHash3 (x86, 32-bit) by Austin Appleby — public domain.
// Operates on the low byte of each char code; intended for ASCII-only keys.

export default function murmur3(key: string, seed: number = 0): number {
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const len = key.length;
    const bytes = len - (len & 3);
    let h1 = seed | 0;
    let k1: number;
    let i = 0;

    while (i < bytes) {
        k1 = (key.charCodeAt(i) & 0xff)
            | ((key.charCodeAt(i + 1) & 0xff) << 8)
            | ((key.charCodeAt(i + 2) & 0xff) << 16)
            | ((key.charCodeAt(i + 3) & 0xff) << 24);
        i += 4;

        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, c2);

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1 = Math.imul(h1, 5) + 0xe6546b64 | 0;
    }

    k1 = 0;
    const rem = len & 3;
    if (rem > 0) {
        if (rem >= 3) k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        if (rem >= 2) k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        k1 ^= key.charCodeAt(i) & 0xff;
        k1 = Math.imul(k1, c1);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, c2);
        h1 ^= k1;
    }

    h1 ^= len;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}
