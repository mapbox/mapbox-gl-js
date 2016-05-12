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
        // the indices of the glyph quads applicable to this particular symbol instance
        { type: 'Int16', name: 'glyphQuadsStart' },
        { type: 'Int16', name: 'glyphQuadsEnd' },
        { type: 'Int16', name: 'iconQuadIndex' },

        // each symbolInstance is centered around the anchor point
        { type: 'Int16', name: 'anchorPointX' },
        { type: 'Int16', name: 'anchorPointY' },

        // index
        {type: 'Int8', name: 'index'}
    ]
});

util.extendAll(SymbolInstancesArray.prototype.StructType.prototype, {
    get anchorPoint() {
        return new Point(this.anchorPointX, this.anchorPointY);
    }
});

