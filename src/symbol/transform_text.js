// @flow

import {plugin as rtlTextPlugin} from '../source/rtl_text_plugin.js';

import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer.js';
import type {Feature} from '../style-spec/expression/index.js';
import Formatted from '../style-spec/expression/types/formatted.js';

function transformText(text: string, layer: SymbolStyleLayer, feature: Feature) {
    const transform = layer.layout.get('text-transform').evaluate(feature, {});
    if (transform === 'uppercase') {
        text = text.toLocaleUpperCase();
    } else if (transform === 'lowercase') {
        text = text.toLocaleLowerCase();
    }

    if (rtlTextPlugin.applyArabicShaping) {
        text = rtlTextPlugin.applyArabicShaping(text);
    }

    return text;
}

export default function(text: Formatted, layer: SymbolStyleLayer, feature: Feature): Formatted {
    text.sections.forEach(section => {
        section.text = transformText(section.text, layer, feature);
    });
    return text;
}
