import {createLayout} from '../util/struct_array';

import type {StructArrayLayout} from '../util/struct_array';

export const occlusionLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_offset_xy', components: 2},
]);
