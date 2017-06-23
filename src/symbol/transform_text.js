'use strict';

const rtlTextPlugin = require('../source/rtl_text_plugin');

module.exports = function(text, layer, globalProperties, featureProperties) {
    const transform = layer.getLayoutValue('text-transform', globalProperties, featureProperties);
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    } else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }

    if (rtlTextPlugin.applyArabicShaping) {
        text = rtlTextPlugin.applyArabicShaping(text);
    }

    return text;
};
