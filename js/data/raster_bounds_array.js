'use strict';

const createStructArrayType = require('../util/struct_array');

const RasterBoundsArray = createStructArrayType({
    members: [
        { name: 'a_pos', type: 'Int16', components: 2 },
        { name: 'a_texture_pos', type: 'Int16', components: 2 }
    ]
});

module.exports = RasterBoundsArray;
