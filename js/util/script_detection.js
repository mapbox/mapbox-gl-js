'use strict';
/* eslint-disable new-cap */

const isChar = require('./is_char_in_unicode_block');

module.exports.allowsIdeographicBreaking = function(chars) {
    for (const char of chars) {
        if (!exports.charAllowsIdeographicBreaking(char.charCodeAt(0))) return false;
    }
    return true;
};

module.exports.allowsVerticalWritingMode = function(chars) {
    for (const char of chars) {
        if (exports.charAllowsVerticalWritingMode(char.charCodeAt(0))) return true;
    }
    return false;
};

module.exports.charAllowsIdeographicBreaking = function(char) {
    // Return early for characters outside all ideographic ranges.
    if (char < 0x2E80) return false;

    if (isChar['Bopomofo Extended'](char)) return true;
    if (isChar['Bopomofo'](char)) return true;
    if (isChar['CJK Compatibility Forms'](char)) return true;
    if (isChar['CJK Compatibility Ideographs'](char)) return true;
    if (isChar['CJK Compatibility'](char)) return true;
    if (isChar['CJK Radicals Supplement'](char)) return true;
    if (isChar['CJK Strokes'](char)) return true;
    if (isChar['CJK Symbols and Punctuation'](char)) return true;
    if (isChar['CJK Unified Ideographs Extension A'](char)) return true;
    if (isChar['CJK Unified Ideographs'](char)) return true;
    if (isChar['Enclosed CJK Letters and Months'](char)) return true;
    if (isChar['Halfwidth and Fullwidth Forms'](char)) return true;
    if (isChar['Hiragana'](char)) return true;
    if (isChar['Ideographic Description Characters'](char)) return true;
    if (isChar['Kangxi Radicals'](char)) return true;
    if (isChar['Katakana Phonetic Extensions'](char)) return true;
    if (isChar['Katakana'](char)) return true;
    if (isChar['Vertical Forms'](char)) return true;
    if (isChar['Yi Radicals'](char)) return true;
    if (isChar['Yi Syllables'](char)) return true;

    return false;
};

exports.charAllowsVerticalWritingMode = function(char, includeNeutrals) {
    // Return early for characters outside all ranges that allow the vertical
    // writing mode.
    if (char < 0x1100) return false;

    if (isChar['Bopomofo Extended'](char)) return true;
    if (isChar['Bopomofo'](char)) return true;
    if (isChar['CJK Compatibility Forms'](char)) return true;
    if (isChar['CJK Compatibility Ideographs'](char)) return true;
    if (isChar['CJK Compatibility'](char)) return true;
    if (isChar['CJK Radicals Supplement'](char)) return true;
    if (isChar['CJK Strokes'](char)) return true;
    if (isChar['CJK Symbols and Punctuation'](char)) return true;
    if (isChar['CJK Unified Ideographs Extension A'](char)) return true;
    if (isChar['CJK Unified Ideographs'](char)) return true;
    if (isChar['Enclosed CJK Letters and Months'](char)) return true;
    if (isChar['Hangul Compatibility Jamo'](char)) return true;
    if (isChar['Hangul Jamo Extended-A'](char)) return true;
    if (isChar['Hangul Jamo Extended-B'](char)) return true;
    if (isChar['Hangul Jamo'](char)) return true;
    if (isChar['Hangul Syllables'](char)) return true;
    if (isChar['Hiragana'](char)) return true;
    if (isChar['Ideographic Description Characters'](char)) return true;
    if (isChar['Kanbun'](char)) return true;
    if (isChar['Kangxi Radicals'](char)) return true;
    if (isChar['Katakana Phonetic Extensions'](char)) return true;
    if (isChar['Katakana'](char)) return true;
    if (isChar['Vertical Forms'](char)) return true;

    if (isCharFullwidthForm(char)) return true;

    if (includeNeutrals) {
        if (isChar['General Punctuation'](char)) return true;
    }

    return false;
};

function isCharFullwidthForm(char) {
    // Fullwidth Forms: "！" to "～"
    if (char >= 0xFF01 && char <= 0xFF5E) return true;

    // Fullwidth Forms: "￠" to "￦"
    if (char >= 0xFFE0 && char <= 0xFFE6) return true;

    return false;
}
