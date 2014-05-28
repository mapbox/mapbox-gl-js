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
var glyphStops = [];
for (var i = 0; i < (65536/256); i++) {
    glyphStops[i] = Math.min((i+1) * 256, 65533);
}

