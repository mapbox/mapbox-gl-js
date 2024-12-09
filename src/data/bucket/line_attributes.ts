import {createLayout} from '../../util/struct_array';

import type {StructArrayLayout} from '../../util/struct_array';

export const lineLayoutAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_normal', components: 2, type: 'Int16'},
    {name: 'a_data', components: 4, type: 'Uint8'},
    {name: 'a_linesofar', components: 1, type: 'Float32'}
], 4);

export const lineZOffsetAttributes: StructArrayLayout = createLayout([
    {name: 'a_z_offset_width', components: 2, type: 'Float32'}
], 4);

export const {members, size, alignment} = lineLayoutAttributes;
