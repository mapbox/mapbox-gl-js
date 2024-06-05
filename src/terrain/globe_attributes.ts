import {createLayout} from '../util/struct_array';

import type {StructArrayLayout} from '../util/struct_array';

const layout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_globe_pos', components: 3},
    {type: 'Float32', name: 'a_uv', components: 2}
]);

export default layout;
export const {members, size, alignment} = layout;
