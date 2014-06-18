'use strict';

var resolveTokens = require('../util/token.js');

module.exports = getRanges;

// For an array of features determine what glyph ranges need to be loaded
// and apply any text preprocessing. The remaining users of text should
// use the `text_features` key returned by this function rather than accessing
// feature text directly.
function getRanges(features, info) {
    var text_features = [];
    var ranges = [];
    var codepoints = [];

    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = resolveTokens(features[i].properties, info['text-field']);
        var hastext = false;
        if (!text) continue;
        text = text.toString();
        for (var j = 0, jl = text.length; j < jl; j++) {
            if (text.charCodeAt(j) <= 65533) {
                codepoints.push(text.charCodeAt(j));
                hastext = true;
            }
        }
        // Track indexes of features with text.
        if (hastext) text_features.push({
            text: text,
            geometry: features[i].loadGeometry()
        });
    }

    codepoints = uniq(codepoints);

    var start;
    var end;
    var codepoint;
    // Codepoints are now sorted and unique.
    for (var k = 0, cl = codepoints.length; k < cl; k++) {
        codepoint = codepoints[k];
        if (start === undefined || (codepoint-start > 255)) {
            start = Math.min(65280, Math.floor(codepoint/256) * 256);
            end = Math.min(65533, start + 255);
            ranges.push(start + '-' + end);
        }
    }

    return {
        ranges: ranges,
        text_features: text_features,
        codepoints: codepoints
    };
}

function uniq(ids) {
    var u = [];
    var last;
    ids.sort(sortNumbers);
    for (var i = 0; i < ids.length; i++) {
        if (ids[i] !== last) {
            last = ids[i];
            u.push(ids[i]);
        }
    }
    return u;
}

function sortNumbers(a, b) {
    return a - b;
}

