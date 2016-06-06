'use strict';

var StructArrayType = require('../util/struct_array');
var util = require('../util/util');
var Point = require('point-geometry');

/*
 *
 * A StructArray implementation of symbolInstances from data/bucket/symbol_bucket.js
 * this will allow symbolInstances to be transferred between the worker and main threads
 *
 * @class SymbolInstanceArray
 * @private
 */

var SymbolInstancesArray = module.exports = new StructArrayType({
    members: [

        { type: 'Uint16', name: 'textBoxStartIndex' },
        { type: 'Uint16', name: 'textBoxEndIndex' },
        { type: 'Uint16', name: 'iconBoxStartIndex' },
        { type: 'Uint16', name: 'iconBoxEndIndex' },
        { type: 'Uint16', name: 'glyphQuadStartIndex' },
        { type: 'Uint16', name: 'glyphQuadEndIndex' },
        { type: 'Uint16', name: 'iconQuadStartIndex' },
        { type: 'Uint16', name: 'iconQuadEndIndex' },

        // each symbolInstance is centered around the anchor point
        { type: 'Int16', name: 'anchorPointX' },
        { type: 'Int16', name: 'anchorPointY' },

        // index -- not sure if we need this -@mollymerp
        { type: 'Int8', name: 'index' }
    ]
});

util.extendAll(SymbolInstancesArray.prototype.StructType.prototype, {
    get anchorPoint() {
        return new Point(this.anchorPointX, this.anchorPointY);
    }
});


