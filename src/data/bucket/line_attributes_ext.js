// @flow
import {createLayout} from '../../util/struct_array';

const lineLayoutAttributesExt = createLayout([
    {name: 'a_line_progress', components: 1, type: 'Float32'}
], 4);

export default lineLayoutAttributesExt;
export const {members, size, alignment} = lineLayoutAttributesExt;
