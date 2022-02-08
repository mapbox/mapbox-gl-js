// @flow
import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

export const skyboxAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_3f',  components: 3, type: 'Float32'}
]);

export default skyboxAttributes;
export const {members, size, alignment} = skyboxAttributes;
