// @flow
import {createLayout} from '../../util/struct_array.js';

const dashAttributes = createLayout([
    {name: 'a_dash_to', components: 4, type: 'Uint16'}, // [x, y, width, unused]
    {name: 'a_dash_from', components: 4, type: 'Uint16'}
]);

export default dashAttributes;
