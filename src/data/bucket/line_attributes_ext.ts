import {createLayout} from '../../util/struct_array';

import type {StructArrayLayout} from '../../util/struct_array';

const lineLayoutAttributesExt: StructArrayLayout = createLayout([
    {name: 'a_packed', components: 3, type: 'Float32'}
]);

export default lineLayoutAttributesExt;
export const {members, size, alignment} = lineLayoutAttributesExt;
