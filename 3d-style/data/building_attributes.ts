import {createLayout} from '../../src/util/struct_array';

import type {StructArrayLayout} from '../../src/util/struct_array';

export const buildingPositionAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos_3f', components: 3, type: 'Float32'}
]);

export const buildingNormalAttributes: StructArrayLayout = createLayout([
    {name: 'a_normal_3', components: 3, type: 'Int16'}
]);

export const buildingColorAttributes: StructArrayLayout = createLayout([
    {name: 'a_part_color_emissive', components: 2, type: 'Uint16'}
]);

export const buildingBloomAttenuationAttributes: StructArrayLayout = createLayout([
    {name: 'a_bloom_attenuation',  components: 4, type: 'Float32'}
]);

export const {members, size, alignment} = buildingPositionAttributes;
