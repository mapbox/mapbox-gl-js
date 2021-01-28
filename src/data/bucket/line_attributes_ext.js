// @flow
import {createLayout} from '../../util/struct_array.js';

const lineLayoutAttributesExt = createLayout([
    {name: 'a_uv_x', components: 1, type: 'Float32'},
    {name: 'a_split_index', components: 1, type: 'Float32'},
]);

export default lineLayoutAttributesExt;
export const {members, size, alignment} = lineLayoutAttributesExt;
