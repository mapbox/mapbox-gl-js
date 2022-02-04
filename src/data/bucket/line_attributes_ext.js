// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

const lineLayoutAttributesExt: StructArrayLayout = createLayout([
    {name: 'a_packed', components: 3, type: 'Float32'}
]);

export default lineLayoutAttributesExt;
export const {members, size, alignment} = lineLayoutAttributesExt;
