'use strict';

const resolveTokens = require('../util/token');

module.exports = function resolveText(layer, globalProperties, featureProperties) {
    let text = resolveTokens(featureProperties, layer.getLayoutValue('text-field', globalProperties, featureProperties));
    if (!text) {
        return;
    }
    text = text.toString();

    const transform = layer.getLayoutValue('text-transform', globalProperties, featureProperties);
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    } else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }

    return text;
};
