'use strict';

const createStructArrayType = require('../util/struct_array');
const Point = require('point-geometry');
const SymbolQuad = require('./quads').SymbolQuad;

// notes from ansis on slack:
// it would be best if they are added to a buffer in advance so that they are only created once. There would be a separate buffer with all the individual collision boxes and then SymbolInstance would store the beginning and end indexes of a feature's collisionboxes. CollisionFeature wouldn't really exist as a standalone thing, it would just be a range of boxes in the big collision box buffer

/*
 *
 * A StructArray implementation of glyphQuad from symbol/quads
 * this will allow glyph quads to be transferred between the worker and main threads along with the rest of
 * the symbolInstances
 *
 * @class SymbolQuadsArray
 * @private
 */

const SymbolQuadsArray = createStructArrayType({
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
        { type: 'Float32', name: 'minScale' },

        { type: 'Uint8', name: 'writingMode' }
    ]
});

Object.defineProperty(SymbolQuadsArray.prototype.StructType.prototype, 'anchorPoint', {
    get() { return new Point(this.anchorPointX, this.anchorPointY); }
});

Object.defineProperty(SymbolQuadsArray.prototype.StructType.prototype, 'SymbolQuad', {
    get() {
        return new SymbolQuad(this.anchorPoint,
            new Point(this.tlX, this.tlY),
            new Point(this.trX, this.trY),
            new Point(this.blX, this.blY),
            new Point(this.brX, this.brY),
            { x: this.texX, y: this.texY, h: this.texH, w: this.texW, height: this.texH, width: this.texW },
            this.anchorAngle,
            this.glyphAngle,
            this.minScale,
            this.maxScale,
            this.writingMode);
    }
});

module.exports = SymbolQuadsArray;
