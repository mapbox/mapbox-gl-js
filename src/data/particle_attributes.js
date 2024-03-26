// @flow

import {createLayout} from '../util/struct_array.js';
import type {StructArrayLayout} from '../util/struct_array.js';

export default (createLayout([
    {name: 'a_pos', type: 'Float32', components: 3}
]): StructArrayLayout);
