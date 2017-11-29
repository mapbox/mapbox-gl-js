// @flow
const {createLayout} = require('../../util/struct_array');
module.exports = createLayout([
    {name: 'a_pos',          components: 2, type: 'Int16'},
    {name: 'a_normal',       components: 3, type: 'Int16'},
    {name: 'a_edgedistance', components: 1, type: 'Int16'}
], 4);
