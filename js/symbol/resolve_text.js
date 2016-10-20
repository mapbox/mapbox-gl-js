'use strict';

const resolveTokens = require('../util/token');

module.exports = function resolveText(feature, layout) {
    let text = resolveTokens(feature.properties, layout['text-field']);
    if (!text) {
        return;
    }
    text = text.toString();

    const transform = layout['text-transform'];
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    } else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }

    return text;
};
