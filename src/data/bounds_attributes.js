// @flow
import {createLayout} from '../util/struct_array.js';

export const rasterBoundsAttributes = createLayout([
    {name: 'a_pos', type: 'Int16', components: 2},
    {name: 'a_texture_pos', type: 'Int16', components: 2}
]);

export const stencilBoundsAttributes = createLayout([
    {name: 'a_pos', type: 'Int16', components: 2}
]);