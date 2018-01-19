// @flow
const {createLayout} = require('../util/struct_array');
module.exports = createLayout([
    { name: 'a_pos', type: 'Int16', components: 2 },
    { name: 'a_texture_pos', type: 'Int16', components: 2 }
]);
