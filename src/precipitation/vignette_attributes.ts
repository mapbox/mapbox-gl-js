import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

export const vignetteLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_pos_2f', components: 2},
]);
