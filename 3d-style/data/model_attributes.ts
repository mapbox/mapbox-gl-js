import {createLayout} from '../../src/util/struct_array';

import type {StructArrayLayout} from '../../src/util/struct_array';

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

export const instanceAttributes: StructArrayLayout = createLayout([
    {name: 'a_normal_matrix0',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix1',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix2',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix3',  components: 4, type: 'Float32'}
]);

export const featureAttributes: StructArrayLayout = createLayout([
    // pbr encoding: | color.rgba (4 bytes) | emissivity (a byte) | roughness (a nibble) | metallic (a nibble)
    {name: 'a_pbr', components: 4, type: 'Uint16'},
    {name: 'a_heightBasedEmissiveStrength', components: 3, type: 'Float32'}
]);

export const {members, size, alignment} = modelAttributes;
