'use strict';

const assert = require('assert');
const StyleLayer = require('../style_layer');
const SymbolBucket = require('../../data/bucket/symbol_bucket');

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

    // return a pair of {text,icon}-size zoom stops that cover the given zoom
    // range
    getLayoutValueCoveringZoomStops(name, lowerZoom, upperZoom) {
        assert(!this.isLayoutValueZoomConstant(name));
        const levels = this.getLayoutValueStopZoomLevels(name);
        let lower = 0;
        while (lower < levels.length && levels[lower] <= lowerZoom) lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < levels.length && levels[upper] < upperZoom) upper++;
        upper = Math.min(levels.length - 1, upper);
        return [levels[lower], levels[upper]];
    }

    createBucket(options) {
        return new SymbolBucket(options);
    }
}

module.exports = SymbolStyleLayer;
