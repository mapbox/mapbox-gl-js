// @flow

const rtlTextPlugin = require('../source/rtl_text_plugin');

import type StyleLayer from '../style/style_layer';
import type {Feature} from '../style-spec/expression';

module.exports = function(text: string, layer: StyleLayer, globalProperties: Object, feature: Feature) {
    const transform = layer.getLayoutValue('text-transform', globalProperties, feature);
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
