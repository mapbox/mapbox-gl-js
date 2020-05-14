// @flow
import {createLayout} from '../../util/struct_array';

const lineLayoutAttributesExt = createLayout([
    {name: 'a_line_progress', components: 1, type: 'Float32'},
    {name: 'a_line_clip', components: 1, type: 'Float32'},
    {name: 'a_split_index', components: 1, type: 'Float32'},
]);

export default lineLayoutAttributesExt;
export const {members, size, alignment} = lineLayoutAttributesExt;
