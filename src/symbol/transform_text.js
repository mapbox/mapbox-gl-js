// @flow

const rtlTextPlugin = require('../source/rtl_text_plugin');

import type StyleLayer from '../style/style_layer';

module.exports = function(text: string, layer: StyleLayer, globalProperties: Object, featureProperties: Object) {
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
