'use strict';

const StructArrayType = require('../util/struct_array');

const RasterBoundsArray = new StructArrayType({
    members: [
        { name: 'a_pos', type: 'Int16', components: 2 },
        { name: 'a_texture_pos', type: 'Int16', components: 2 }
    ]
});

module.exports = RasterBoundsArray;
