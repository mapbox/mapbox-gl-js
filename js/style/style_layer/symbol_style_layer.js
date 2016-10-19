'use strict';

const StyleLayer = require('../style_layer');

class SymbolStyleLayer extends StyleLayer {

    getLayoutValue(name, globalProperties, featureProperties) {
        const value = super.getLayoutValue(name, globalProperties, featureProperties);
        if (value !== 'auto') {
            return value;
        }

        switch (name) {
        case 'text-rotation-alignment':
        case 'icon-rotation-alignment':
            return this.getLayoutValue('symbol-placement', globalProperties, featureProperties) === 'line' ? 'map' : 'viewport';
        case 'text-pitch-alignment':
            return this.getLayoutValue('text-rotation-alignment', globalProperties, featureProperties);
        default:
            return value;
        }
    }
}

module.exports = SymbolStyleLayer;
