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
function resolveText(features, featureLayoutProperties, stacks) {
    var textFeatures = [];
    var fontstackCodepoints = {};
    var fontstack;

    for (var i = 0, fl = features.length; i < fl; i++) {
        var layoutProperties = featureLayoutProperties[i];
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

        fontstack = layoutProperties['text-font'];

        var codepoints = fontstackCodepoints[fontstack];
        if (codepoints === undefined) {
            codepoints = fontstackCodepoints[fontstack] = [];
        }

        for (var j = 0, jl = text.length; j < jl; j++) {
            codepoints.push(text.charCodeAt(j));
        }

        // Track indexes of features with text.
        textFeatures[i] = text;
    }

    for (fontstack in fontstackCodepoints) {
        var glyphs = stacks[fontstack];
        if (glyphs === undefined) {
            glyphs = stacks[fontstack] = {};
        }

        // get a list of unique codepoints we are missing
        fontstackCodepoints[fontstack] = uniq(fontstackCodepoints[fontstack], glyphs);
    }

    return {
        textFeatures: textFeatures,
        codepoints: fontstackCodepoints
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
