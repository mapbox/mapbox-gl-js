// @flow
const {createLayout} = require('../../util/struct_array');
module.exports = createLayout([
    {name: 'a_pos',          components: 2, type: 'Int16'},
    {name: 'a_normal_ed',    components: 4, type: 'Int16'},
], 4);
