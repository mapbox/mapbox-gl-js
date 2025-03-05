import {createLayout} from '../../util/struct_array';

import type {StructArrayLayout} from '../../util/struct_array';

export const fillLayoutAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos', components: 2, type: 'Int16'}
], 4);

export const fillLayoutAttributesExt: StructArrayLayout = createLayout([
    {name: 'a_road_z_offset', components: 1, type: 'Float32'}
], 4);

export const {members, size, alignment} = fillLayoutAttributes;
