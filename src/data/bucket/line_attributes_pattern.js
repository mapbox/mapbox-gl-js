// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

const lineLayoutAttributesPattern: StructArrayLayout = createLayout([
    {name: 'a_pattern_data', components: 2, type: 'Float32'}
]);

export default lineLayoutAttributesPattern;
export const {members, size, alignment} = lineLayoutAttributesPattern;
