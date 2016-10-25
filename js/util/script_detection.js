'use strict';

module.exports.allowsIdeographicBreaking = function(input) {
    for (let i = 0; i < input.length; i++) {
        if (!exports.charAllowsIdeographicBreaking(input.charCodeAt(i), input.charCodeAt(i + 1))) {
            return false;
        }
    }
    return true;
};


module.exports.charAllowsIdeographicBreaking = function(char, nextChar) {
    // "一" to "鿌"
    if (char >= 0x4E00 && char <= 0x9FCC) return true;

    // "㐀" to "䶵"
    if (char >= 0x3400 && char <= 0x4DB5) return true;

    // eslint-disable-next-line no-irregular-whitespace
    // "　" to "〿"
    if (char >= 0x3000 && char <= 0x303F) return true;

    // "𠀀" to "𬺯"
    if (char === 0xD840 && nextChar >= 0xDC00) return true;
    if (char >= 0xD841 && char <= 0xD872) return true;
    if (char === 0xD873 && nextChar <= 0xDEAF) return true;

    // "！" to "￮"
    if (char >= 0xFF01 && char <= 0xFFEE) return true;

    // "ぁ" to "ゟ"
    if (char >= 0x3041 && char <= 0x309F) return true;

    // "゠" to "ヿ"
    if (char >= 0x30A0 && char <= 0x30FF) return true;

    // "ㇰ" to "ㇿ"
    if (char >= 0x31F0 && char <= 0x31FF) return true;

    // "ꀀ" to "꓆"
    if (char >= 0xA000 && char <= 0xA4C6) return true;

    return false;
};
