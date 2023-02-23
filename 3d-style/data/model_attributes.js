// @flow
import {createLayout} from '../../src/util/struct_array.js';

import type {StructArrayLayout} from '../../src/util/struct_array.js';

export const modelAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_3f',  components: 3, type: 'Float32'}
]);

export const {members, size, alignment} = modelAttributes;
