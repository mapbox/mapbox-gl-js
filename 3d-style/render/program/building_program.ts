import {Uniform1f, Uniform3f, UniformMatrix4f} from '../../../src/render/uniform_binding';

import type Context from '../../../src/gl/context';
import type {mat4} from 'gl-matrix';
import type {UniformValues} from '../../../src/render/uniform_binding';

export type BuildingUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_normal_matrix']: UniformMatrix4f;
    ['u_opacity']: Uniform1f;
    ['u_faux_facade_ao_intensity']: Uniform1f;
    ['u_camera_pos']: Uniform3f;
    ['u_tile_to_meter']: Uniform1f;
    ['u_facade_emissive_chance']: Uniform1f;
    ['u_flood_light_color']: Uniform3f;
    ['u_flood_light_intensity']: Uniform1f;
};

export type BuildingDefinesType = 'DEBUG_SHOW_NORMALS' | 'HAS_ATTRIBUTE_a_part_color_emissive' | 'HAS_ATTRIBUTE_a_bloom_attenuation' | 'BUILDING_FAUX_FACADE' | 'HAS_ATTRIBUTE_a_faux_facade_color_emissive';

const buildingUniforms = (context: Context): BuildingUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_normal_matrix': new UniformMatrix4f(context),
    'u_opacity': new Uniform1f(context),
    'u_faux_facade_ao_intensity': new Uniform1f(context),
    'u_camera_pos': new Uniform3f(context),
    'u_tile_to_meter': new Uniform1f(context),
    'u_facade_emissive_chance': new Uniform1f(context),
    'u_flood_light_color': new Uniform3f(context),
    'u_flood_light_intensity': new Uniform1f(context),
});

const buildingUniformValues = (matrix: mat4, normalMatrix: mat4, opacity: number, aoIntensity: number, cameraPos: [number, number, number], tileToMeter: number, emissiveChance: number, floodLightColor: [number, number, number], floodLightIntensity: number): UniformValues<BuildingUniformsType> => {
    const uniformValues = {
        'u_matrix': matrix as Float32Array,
        'u_normal_matrix': normalMatrix as Float32Array,
        'u_opacity': opacity,
        'u_faux_facade_ao_intensity': aoIntensity,
        'u_camera_pos': cameraPos,
        'u_tile_to_meter': tileToMeter,
        'u_facade_emissive_chance': emissiveChance,
        'u_flood_light_color': floodLightColor,
        'u_flood_light_intensity': floodLightIntensity,
    };

    return uniformValues;
};

export type BuildingBloomUniformsType = {
    ['u_matrix']: UniformMatrix4f;
};

const buildingBloomUniforms = (context: Context): BuildingBloomUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
});

const buildingBloomUniformValues = (matrix: mat4): UniformValues<BuildingBloomUniformsType> => {
    const uniformValues = {
        'u_matrix': matrix as Float32Array,
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
    buildingBloomUniforms,
    buildingBloomUniformValues,
    buildingDepthUniforms,
    buildingDepthUniformValues,
};
