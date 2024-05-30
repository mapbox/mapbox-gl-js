// @flow
import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

export const occlusionLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_offset_xy', components: 2},
]);
