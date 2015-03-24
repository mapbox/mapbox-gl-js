'use strict';

module.exports = resolveTokens;

function resolveTokens(properties, text) {
    return text.replace(/{([^{}()\[\]<>$=:;.,^]+)}/g, function(match, key) {
        return key in properties ? properties[key] : '';
    });
}
