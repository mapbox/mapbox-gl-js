// @flow
import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

const layout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_globe_pos', components: 3},
    {type: 'Float32', name: 'a_merc_pos', components: 2},
    {type: 'Float32', name: 'a_uv', components: 2}
]);

export const atmosphereLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_pos', components: 3},
    {type: 'Float32', name: 'a_uv', components: 2}
]);

export default layout;
export const {members, size, alignment} = layout;
