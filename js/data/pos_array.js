'use strict';

const StructArrayType = require('../util/struct_array');

const PosArray = new StructArrayType({
    members: [{ name: 'a_pos', type: 'Int16', components: 2 }]
});

module.exports = PosArray;
