import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

export const snowLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_pos_3f', components: 3},
    {type: 'Float32', name: 'a_uv', components: 2},
    {type: 'Float32', name: 'a_snowParticleData', components: 4},
    {type: 'Float32', name: 'a_snowParticleDataHorizontalOscillation', components: 2}
]);
