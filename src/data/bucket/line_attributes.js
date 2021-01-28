// @flow
import {createLayout} from '../../util/struct_array.js';

const lineLayoutAttributes = createLayout([
    {name: 'a_pos_normal', components: 2, type: 'Int16'},
    {name: 'a_data', components: 4, type: 'Uint8'},
    {name: 'a_linesofar', components: 1, type: 'Float32'}
], 4);

export default lineLayoutAttributes;
export const {members, size, alignment} = lineLayoutAttributes;
