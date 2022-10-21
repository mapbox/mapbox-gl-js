// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

const dashAttributes: StructArrayLayout = createLayout([
    {name: 'a_dash_to', components: 3, type: 'Uint16'} // [x, y, width]
]);

export default dashAttributes;
