import {createLayout} from '../../util/struct_array';

import type {StructArrayLayout} from '../../util/struct_array';

const lineLayoutAttributesPattern: StructArrayLayout = createLayout([
    {name: 'a_pattern_data', components: 3, type: 'Float32'}
]);

export default lineLayoutAttributesPattern;
export const {members, size, alignment} = lineLayoutAttributesPattern;
