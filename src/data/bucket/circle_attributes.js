// @flow
import {createLayout} from '../../util/struct_array.js';

export const circleAttributes = createLayout([
    {name: 'a_pos', components: 2, type: 'Int16'}
], 4);

export const circleGlobeAttributesExt = createLayout([
    {name: 'a_pos_3', components: 3, type: 'Int16'},
    {name: 'a_pos_normal_3', components: 3, type: 'Int16'},
    {name: 'a_scale', components: 1, type: 'Float32'},
]);

export const {members, size, alignment} = circleAttributes;
