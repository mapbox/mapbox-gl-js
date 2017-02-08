'use strict';

const createStructArrayType = require('../util/struct_array');

const PosArray = createStructArrayType({
    members: [{ name: 'a_pos', type: 'Int16', components: 2 }]
});

module.exports = PosArray;
