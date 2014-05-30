'use strict';

module.exports = getRanges;

// For an array of features determine what glyph ranges need to be loaded.
function getRanges(features, info) {
    var text_features = [];
    var ranges = [];
    var codepoints = [];

    var field = info['text-field'];
    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = features[i][field];
        if (text) {
            for (var j = 0, jl = text.length; j < jl; j++) {
                codepoints.push(text.charCodeAt(j));
            }
            // Track indexes of features with text.
            text_features.push(i);
        }
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
    ids.sort(function(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    });
    for (var i = 0; i < ids.length; i++) {
        if (ids[i] !== last) {
            last = ids[i];
            u.push(ids[i]);
        }
    }
    return u;
}

