// @flow
import {createLayout} from '../../util/struct_array';

export const fillExtrusionAttributes = createLayout([
    {name: 'a_pos_normal_ed', components: 4, type: 'Int16'}
]);

export const centroidAttributes = createLayout([
    {name: 'aCentroidPos',  components: 2, type: 'Uint16'}
]);

export const {members, size, alignment} = fillExtrusionAttributes;
