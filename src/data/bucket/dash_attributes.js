// @flow
import {createLayout} from '../../util/struct_array.js';

const dashAttributes = createLayout([
    // [tl.x, tl.y, br.x, br.y]
    {name: 'a_dash_to', components: 4, type: 'Uint16'},
    {name: 'a_dash_from', components: 4, type: 'Uint16'},
    {name: 'a_pixel_ratio_to', components: 1, type: 'Uint16'},
    {name: 'a_pixel_ratio_from', components: 1, type: 'Uint16'},
]);

export default dashAttributes;
