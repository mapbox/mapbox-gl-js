'use strict';

const StyleLayer = require('../style_layer');
const util = require('../../util/util');

class LineStyleLayer extends StyleLayer {

    getPaintValue(name, globalProperties, featureProperties) {
        const value = super.getPaintValue(name, globalProperties, featureProperties);

        // If the line is dashed, scale the dash lengths by the line
        // width at the previous round zoom level.
        if (value && name === 'line-dasharray') {
            const flooredZoom = Math.floor(globalProperties.zoom);
            if (this._flooredZoom !== flooredZoom) {
                this._flooredZoom = flooredZoom;
                const flooredGlobalProperties = util.clone(globalProperties);
                flooredGlobalProperties.zoom = flooredZoom;
                this._flooredLineWidth = this.getPaintValue('line-width', flooredGlobalProperties, featureProperties);
            }

            value.fromScale *= this._flooredLineWidth;
            value.toScale *= this._flooredLineWidth;
        }

        return value;
    }
}

module.exports = LineStyleLayer;
