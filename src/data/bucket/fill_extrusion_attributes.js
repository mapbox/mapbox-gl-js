// @flow
import {createLayout} from '../../util/struct_array.js';

import type {StructArrayLayout} from '../../util/struct_array.js';

export const fillExtrusionAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_normal_ed', components: 4, type: 'Int16'}
]);

export const centroidAttributes: StructArrayLayout = createLayout([
    {name: 'a_centroid_pos',  components: 2, type: 'Uint16'}
]);

export const fillExtrusionAttributesExt: StructArrayLayout = createLayout([
    {name: 'a_pos_3', components: 3, type: 'Int16'},
    {name: 'a_pos_normal_3', components: 3, type: 'Int16'}
]);

export const {members, size, alignment} = fillExtrusionAttributes;
