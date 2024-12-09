import {createLayout} from '../util/struct_array.js';

import type {StructArrayLayout} from '../util/struct_array.js';

export const rainLayout: StructArrayLayout = createLayout([
    {type: 'Float32', name: 'a_pos_3f', components: 3},
    {type: 'Float32', name: 'a_uv', components: 2},
    {type: 'Float32', name: 'a_rainParticleData', components: 4},
]);
