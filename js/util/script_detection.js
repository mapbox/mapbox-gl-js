'use strict';

module.exports.allowsIdeographicBreaking = function(chars) {
    for (const char of chars) {
        if (!exports.charAllowsIdeographicBreaking(char.charCodeAt(0))) {
            return false;
        }
    }
    return true;
};


module.exports.charAllowsIdeographicBreaking = function(char) {
    // early termination for characters outside all ideographic ranges
    if (char < 0x3000) return false;

    // "一" to "鿌"
    if (char >= 0x4E00 && char <= 0x9FCC) return true;

    // "㐀" to "䶵"
    if (char >= 0x3400 && char <= 0x4DB5) return true;

    // eslint-disable-next-line no-irregular-whitespace
    // "　" to "〿"
    if (char >= 0x3000 && char <= 0x303F) return true;

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
