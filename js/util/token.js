'use strict';

module.exports = resolveTokens;

var tokenPattern = /{{(\w+)}}/;

function resolveTokens(feature, expression) {
    var match;
    var value;
    var text = expression;
    while ((match = text.match(tokenPattern))) {
        if (typeof feature[match[1]] === 'undefined') {
            console.warn("[WARNING] feature doesn't have property '%s' required for labelling", match[1]);
        }
        value = typeof feature[match[1]] === 'undefined' ? '' : feature[match[1]];
        text = text.replace(match[0], value);
    }
    return text;
}

