'use strict';

var resolveTokens = require('../util/token');

module.exports = resolveText;

/**
 * For an array of features determine what glyphs need to be loaded
 * and apply any text preprocessing. The remaining users of text should
 * use the `textFeatures` key returned by this function rather than accessing
 * feature text directly.
 * @private
 */
function resolveText(features, layoutProperties, codepoints) {
    var textFeatures = [];
    var textField = layoutProperties['text-field'];
    var transform = layoutProperties['text-transform'];
    var numericPrecision = layoutProperties['numeric-precision'];
    if (numericPrecision === undefined) numericPrecision = 8; // to be replaced with spec default
    var numericMultiplier = Math.pow(10, numericPrecision);

    for (var i = 0, fl = features.length; i < fl; i++) {
        var text = resolveTokens(features[i].properties, textField, numericMultiplier);
        if (!text) {
            textFeatures[i] = null;
            continue;
        }
        text = text.toString();

        if (transform === 'uppercase') {
            text = text.toLocaleUpperCase();
        } else if (transform === 'lowercase') {
            text = text.toLocaleLowerCase();
        }

        for (var j = 0; j < text.length; j++) {
            codepoints[text.charCodeAt(j)] = true;
        }

        // Track indexes of features with text.
        textFeatures[i] = text;
    }

    return textFeatures;
}
