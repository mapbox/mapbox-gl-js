'use strict';

var StructArrayType = require('../util/struct_array');
var util = require('../util/util');
var Point = require('point-geometry');

/*
 *
 * A StructArray implementation of glyphQuad from symbol/quads
 * this will allow glyph quads to be transferred between the worker and main threads along with the rest of
 * the symbolInstances
 *
 * @class SymbolQuadsArray
 * @private
 */

var SymbolQuadsArray = module.exports = new StructArrayType({
    members: [
        // the quad is centered around the anchor point
        { type: 'Int16', name: 'anchorPointX' },
        { type: 'Int16', name: 'anchorPointY' },

        // the offsets of the tl (top-left), tr, bl, br corners from the anchor point
        // do these need to be floats?
        { type: 'Float32', name: 'tlX' },
        { type: 'Float32', name: 'tlY' },
        { type: 'Float32', name: 'trX' },
        { type: 'Float32', name: 'trY' },
        { type: 'Float32', name: 'blX' },
        { type: 'Float32', name: 'blY' },
        { type: 'Float32', name: 'brX' },
        { type: 'Float32', name: 'brY' },

        // texture coordinates (height, width, x, and y)
        { type: 'Int16', name: 'texH' },
        { type: 'Int16', name: 'texW' },
        { type: 'Int16', name: 'texX' },
        { type: 'Int16', name: 'texY' },

        // the angle of the label at it's center, not the angle of this quad.
        { type: 'Float32', name: 'anchorAngle' },
        // the angle of this quad.
        { type: 'Float32', name: 'glyphAngle' },

        // quad is only valid for scales < maxScale && scale > minScale.
        { type: 'Float32', name: 'maxScale' },
        { type: 'Float32', name: 'minScale' }
    ]
});

util.extendAll(SymbolQuadsArray.prototype.StructType.prototype, {
    get anchorPoint() {
        return new Point(this.anchorPointX, this.anchorPointY);
    },
    get SymbolQuad() {
        return {
            anchorPoint: this.anchorPoint,
            tl: new Point(this.tlX, this.tlY),
            tr: new Point(this.trX, this.trY),
            bl: new Point(this.blX, this.blY),
            br: new Point(this.brX, this.brY),
            tex: { x: this.texX, y: this.texY, h: this.texH, w: this.texW, height: this.texH, width: this.texW },
            anchorAngle: this.anchorAngle,
            glyphAngle: this.glyphAngle,
            minScale: this.minScale,
            maxScale: this.maxScale
        };
    }
});
