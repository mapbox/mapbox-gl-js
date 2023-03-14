// @flow
import {createLayout} from '../../src/util/struct_array.js';

import type {StructArrayLayout} from '../../src/util/struct_array.js';

export const modelAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_3f',  components: 3, type: 'Float32'}
]);

export const color3fAttributes: StructArrayLayout = createLayout([
    {name: 'a_color_3f',  components: 3, type: 'Float32'}
]);

export const color4fAttributes: StructArrayLayout = createLayout([
    {name: 'a_color_4f',  components: 4, type: 'Float32'}
]);

export const texcoordAttributes: StructArrayLayout = createLayout([
    {name: 'a_uv_2f',  components: 2, type: 'Float32'}
]);

export const normalAttributes: StructArrayLayout = createLayout([
    {name: 'a_normal_3f',  components: 3, type: 'Float32'}
]);

export const {members, size, alignment} = modelAttributes;
