'use strict';

module.exports = getRanges;

// For an array of features determine what glyph ranges need to be loaded.
function getRanges(features, info) {
    var text_features = [];

    var ranges = [],
        codepoints = [],
        codepoint,
        glyphStopIndex,
        prevGlyphStop,
        rangeMin,
        rangeMax,
        range;

    var feature;
    for (var i = 0; i < features.length; i++) {
        feature = features[i];

        var text = feature[info['text-field']];
        if (!text) continue;

        for (var j = 0; j < text.length; j++) {
            codepoint = text.charCodeAt(j);
            if (codepoints.indexOf(codepoint) === -1) codepoints.push(codepoint);
        }

        // Track indexes of features with text.
        text_features.push(i);
    }

    for (var k = 0; k < codepoints.length; k++) {
        codepoint = codepoints[k];

        if (!isNaN(glyphStopIndex)) {
            prevGlyphStop = glyphStops[glyphStopIndex - 1] - 1 || -1;

            if (codepoint > prevGlyphStop && 
                codepoint < glyphStops[glyphStopIndex]) {
                // Range matches previous codepoint.
                continue;
            }
        } 

        for (var m = 0; m < glyphStops.length; m++) {
            if (codepoint < glyphStops[m]) {
                // Cache matching glyphStops index.
                glyphStopIndex = m;

                // Beginning of the glyph range
                rangeMin = glyphStops[m - 1] || 0;

                // End of the glyph range
                rangeMax = glyphStops[m] - 1;

                // Range string.
                range = rangeMin + '-' + rangeMax;

                // Add to glyph ranges if not already present.
                if (ranges.indexOf(range) === -1) {
                    ranges.push(range);
                }

                break;
            }
        }
    }

    return {
        ranges: ranges,
        text_features: text_features,
        codepoints: codepoints
    };
}

var glyphStops = [
    128, // Basic Latin
    256, // Latin-1 Supplement
    384, // Latin Extended-A
    592, // Latin Extended-B
    688, // IPA Extensions
    768, // Spacing Modifier Letters
    880, // Combining Diacritical Marks
    1024, // Greek
    1280, // Cyrillic
    1424, // Armenian
    1536, // Hebrew
    1792, // Arabic
    1872, // Syriac
    1984, // Thaana
    2432, // Devanagari
    2560, // Bengali
    2688, // Gurmukhi
    2816, // Gujarati
    2944, // Oriya
    3072, // Tamil
    3200, // Telugu
    3328, // Kannada
    3456, // Malayalam
    3584, // Sinhala
    3712, // Thai
    3840, // Lao
    4096, // Tibetan
    4256, // Myanmar
    4352, // Georgian
    4608, // Hangul Jamo
    4992, // Ethiopic
    5120, // Cherokee
    5760, // Unified Canadian Aboriginal Syllabics
    5792, // Ogham
    5888, // Runic
    6144, // Khmer
    6320, // Mongolian
    7936, // Latin Extended Additional
    8192, // Greek Extended
    8304, // General Punctuation
    8352, // Superscripts and Subscripts
    8400, // Currency Symbols
    8448, // Combining Marks for Symbols
    8528, // Letterlike Symbols
    8592, // Number Forms
    8704, // Arrows
    8960, // Mathematical Operators
    9216, // Miscellaneous Technical
    9280, // Control Pictures
    9312, // Optical Character Recognition
    9472, // Enclosed Alphanumerics
    9600, // Box Drawing
    9632, // Block Elements
    9728, // Geometric Shapes
    9984, // Miscellaneous Symbols
    10176, // Dingbats
    10496, // Braille Patterns
    12032, // CJK Radicals Supplement
    12256, // Kangxi Radicals
    12288, // Ideographic Description Characters
    12352, // CJK Symbols and Punctuation
    12448, // Hiragana
    12544, // Katakana
    12592, // Bopomofo
    12688, // Hangul Compatibility Jamo
    12704, // Kanbun
    12736, // Bopomofo Extended
    13056, // Enclosed CJK Letters and Months
    13312, // CJK Compatibility
    19894, // CJK Unified Ideographs Extension A
    40960, // CJK Unified Ideographs
    42128, // Yi Syllables
    42192, // Yi Radicals
    55204, // Hangul Syllables
    56192, // High Surrogates
    56320, // High Private Use Surrogates
    57344, // Low Surrogates
    63744, // Private Use
    64256, // CJK Compatibility Ideographs
    64336, // Alphabetic Presentation Forms
    65024, // Arabic Presentation Forms-A
    65072, // Combining Half Marks
    65104, // CJK Compatibility Forms
    65136, // Small Form Variants
    65279, // Arabic Presentation Forms-B
    65280, // Specials
    65520, // Halfwidth and Fullwidth Forms
    65534 // Specials
];

