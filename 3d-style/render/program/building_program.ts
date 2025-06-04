import {Uniform1f, UniformMatrix4f} from '../../../src/render/uniform_binding';

import type Context from '../../../src/gl/context';
import type {mat4} from 'gl-matrix';
import type {UniformValues} from '../../../src/render/uniform_binding';

export type BuildingUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_normal_matrix']: UniformMatrix4f;
    ['u_opacity']: Uniform1f;
};

export type BuildingDefinesType = 'DEBUG_SHOW_NORMALS' | 'HAS_ATTRIBUTE_a_part_color_emissive';

const buildingUniforms = (context: Context): BuildingUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_normal_matrix': new UniformMatrix4f(context),
    'u_opacity': new Uniform1f(context)
});

const buildingUniformValues = (matrix: mat4, normalMatrix: mat4): UniformValues<BuildingUniformsType> => {
    const uniformValues = {
        'u_matrix': matrix as Float32Array,
        'u_normal_matrix': normalMatrix as Float32Array,
        'u_opacity': 1.0
    };

    return uniformValues;
};

export type BuildingDepthUniformsType = {
    ['u_matrix']: UniformMatrix4f;
};

const buildingDepthUniforms = (context: Context): BuildingDepthUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
});

const buildingDepthUniformValues = (matrix: mat4): UniformValues<BuildingDepthUniformsType> => {
    const uniformValues = {
        'u_matrix': matrix as Float32Array,
    };

    return uniformValues;
};

export {
    buildingUniforms,
    buildingUniformValues,
    buildingDepthUniforms,
    buildingDepthUniformValues,
};
