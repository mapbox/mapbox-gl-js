'use strict';

var resolveTokens = require('../util/token');

module.exports = resolveText;

/**
 * For an array of features determine what glyph ranges need to be loaded
 * and apply any text preprocessing. The remaining users of text should
 * use the `textFeatures` key returned by this function rather than accessing
 * feature text directly.
 * @private
 */
function resolveText(features, layoutProperties, glyphs) {
    var textFeatures = [];
    var codepoints = [];

    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = resolveTokens(features[i].properties, layoutProperties['text-field']);
        if (!text) {
            textFeatures[i] = null;
            continue;
        }
        text = text.toString();

        var transform = layoutProperties['text-transform'];
        if (transform === 'uppercase') {
            text = text.toLocaleUpperCase();
        } else if (transform === 'lowercase') {
            text = text.toLocaleLowerCase();
        }

        for (var j = 0, jl = text.length; j < jl; j++) {
            codepoints.push(text.charCodeAt(j));
        }

        // Track indexes of features with text.
        textFeatures[i] = text;
    }

    // get a list of unique codepoints we are missing
    codepoints = uniq(codepoints, glyphs);

    return {
        textFeatures: textFeatures,
        codepoints: codepoints
    };
}

function uniq(ids, alreadyHave) {
    var u = [];
    var last;
    ids.sort(sortNumbers);
    for (var i = 0; i < ids.length; i++) {
        if (ids[i] !== last) {
            last = ids[i];
            if (!alreadyHave[last]) u.push(ids[i]);
        }
    }
    return u;
}

function sortNumbers(a, b) {
    return a - b;
}
