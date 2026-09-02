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

// Used instead of texcoordAttributes when the glTF accessor is already normalized. Coordinates
// that are not normalized may fall outside [0, 1] and have to stay float.
export const texcoordNormalizedAttributes: StructArrayLayout = createLayout([
    {name: 'a_uv_2f',  components: 2, type: 'Uint16', normalized: true}
]);

export const normalAttributes: StructArrayLayout = createLayout([
    {name: 'a_normal_4n',  components: 4, type: 'Int8', normalized: true}
]);

export const instanceAttributes: StructArrayLayout = createLayout([
    {name: 'a_normal_matrix0',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix1',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix2',  components: 4, type: 'Float32'},
    {name: 'a_normal_matrix3',  components: 4, type: 'Float32'}
]);

export const featureAttributes: StructArrayLayout = createLayout([
    // .x vertex color, RGBA4444. .y feature id, whose low 4 bits select a part style.
    {name: 'a_feature', components: 2, type: 'Uint16'}
]);

export const {members, size, alignment} = modelAttributes;
