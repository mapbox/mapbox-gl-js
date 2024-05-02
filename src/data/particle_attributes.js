// @flow

import {createLayout} from '../util/struct_array.js';
import type {StructArrayLayout} from '../util/struct_array.js';

export default (createLayout([
    {name: 'a_index', type: 'Int16', components: 1}
]): StructArrayLayout);
