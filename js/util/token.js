'use strict';

module.exports = resolveTokens;

var tokenPattern = /{{(\w+)}}/;

function resolveTokens(feature, expression) {
    var text;
    var match;
    var value;
    if (tokenPattern.test(expression)) {
        text = expression;
        while ((match = text.match(tokenPattern))) {
            if (typeof feature[match[1]] === 'undefined') {
                console.warn("[WARNING] feature doesn't have property '%s' required for labelling", match[1]);
            }
            value = typeof feature[match[1]] === 'undefined' ? '' : feature[match[1]];
            text = text.replace(match[0], value);
        }
    // @TODO nuke this case: if it's not a field token, it's literal text.
    // https://github.com/mapbox/mapbox-gl-native/issues/300
    } else {
        text = feature[expression];
    }
    return text;
}

