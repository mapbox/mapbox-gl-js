// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

const patternAttributes: StructArrayLayout = createLayout([
    // [tl.x, tl.y, br.x, br.y]
    {name: 'a_pattern', components: 4, type: 'Uint16'},
    {name: 'a_pixel_ratio', components: 1, type: 'Float32'}
]);

export default patternAttributes;
