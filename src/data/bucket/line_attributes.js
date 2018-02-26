// @flow
import { createLayout } from '../../util/struct_array';

export default createLayout([
    {name: 'a_pos_normal', components: 4, type: 'Int16'},
    {name: 'a_data', components: 4, type: 'Uint8'}
], 4);
