'use strict';

module.exports = resolveTokens;

var tokenPattern = /{([^{}()\[\]<>$=:;.,^]+)}/;

function resolveTokens(properties, expression) {
    var match;
    var value;
    var text = expression;
    while ((match = text.match(tokenPattern))) {
        value = typeof properties[match[1]] === 'undefined' ? '' : properties[match[1]];
        text = text.replace(match[0], value);
    }
    return text;
}
