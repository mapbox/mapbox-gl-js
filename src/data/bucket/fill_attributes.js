// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

const layout: StructArrayLayout = createLayout([
    {name: 'a_pos', components: 2, type: 'Int16'}
], 4);

export default layout;
export const {members, size, alignment} = layout;
