import {mat3, mat4, vec3} from 'gl-matrix';
import {
    Uniform1i,
    Uniform1f,
    Uniform3f,
    Uniform4f,
    UniformMatrix4f
} from '../../../src/render/uniform_binding';
import Color from '../../../src/style-spec/util/color';
import TextureSlots from '../texture_slots';

import type ModelStyleLayer from '../../style/style_layer/model_style_layer';
import type {UniformValues} from '../../../src/render/uniform_binding';
import type Context from '../../../src/gl/context';
import type Painter from '../../../src/render/painter';
import type {Material, MaterialOverride} from '../../data/model';

export type ModelUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_lighting_matrix']: UniformMatrix4f;
    ['u_normal_matrix']: UniformMatrix4f;
    ['u_node_matrix']: UniformMatrix4f;
    ['u_lightpos']: Uniform3f;
    ['u_lightintensity']: Uniform1f;
    ['u_lightcolor']: Uniform3f;
    ['u_camera_pos']: Uniform3f;
    ['u_opacity']: Uniform1f;
    ['u_baseColorFactor']: Uniform4f;
    ['u_emissiveFactor']: Uniform4f;
    ['u_metallicFactor']: Uniform1f;
    ['u_roughnessFactor']: Uniform1f;
    ['u_alphaMask']: Uniform1i;
    ['u_alphaCutoff']: Uniform1f;
    ['u_baseColorTexture']: Uniform1i;
    ['u_metallicRoughnessTexture']: Uniform1i;
    ['u_normalTexture']: Uniform1i;
    ['u_occlusionTexture']: Uniform1i;
    ['u_emissionTexture']: Uniform1i;
    ['u_lutTexture']: Uniform1i;
    ['u_color_mix']: Uniform4f;
    ['u_aoIntensity']: Uniform1f;
    ['u_emissive_strength']: Uniform1f;
    ['u_occlusionTextureTransform']: Uniform4f;
    ['u_dithered_discard_threshold']: Uniform1f;
    ['u_model_mesh_params']: Uniform4f;
};

export type ModelDefinesType = 'DIFFUSE_SHADED' | 'SHADOWS_SINGLE_CASCADE' | 'OCCLUSION_TEXTURE_TRANSFORM' | 'DITHERED_DISCARD';

const modelUniforms = (context: Context): ModelUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_lighting_matrix': new UniformMatrix4f(context),
    'u_normal_matrix': new UniformMatrix4f(context),
    'u_node_matrix': new UniformMatrix4f(context),
    'u_lightpos': new Uniform3f(context),
    'u_lightintensity': new Uniform1f(context),
    'u_lightcolor': new Uniform3f(context),
    'u_camera_pos': new Uniform3f(context),
    'u_opacity': new Uniform1f(context),
    'u_baseColorFactor': new Uniform4f(context),
    'u_emissiveFactor': new Uniform4f(context),
    'u_metallicFactor': new Uniform1f(context),
    'u_roughnessFactor': new Uniform1f(context),
    'u_alphaMask': new Uniform1i(context),
    'u_alphaCutoff': new Uniform1f(context),
    'u_baseColorTexture': new Uniform1i(context),
    'u_metallicRoughnessTexture': new Uniform1i(context),
    'u_normalTexture': new Uniform1i(context),
    'u_occlusionTexture': new Uniform1i(context),
    'u_emissionTexture': new Uniform1i(context),
    'u_lutTexture': new Uniform1i(context),
    'u_color_mix': new Uniform4f(context),
    'u_aoIntensity': new Uniform1f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_occlusionTextureTransform': new Uniform4f(context),
    'u_dithered_discard_threshold': new Uniform1f(context),
    'u_model_mesh_params': new Uniform4f(context)
});

const emptyMat4 = new Float32Array(mat4.identity([]));

const lightMatScratch = mat3.create();

export type ModelLayerUniformValues = {
    lightPos: [number, number, number];
    lightIntensity: number;
    lightColor: [number, number, number];
    colorMix: [number, number, number, number];
    aoIntensity: number;
};

// Values that are the same for every mesh of a layer draw. Uniform3f/Uniform4f keep a reference to the array they
// were set with, so these arrays must not be mutated after creation.
const modelLayerUniformValues = (painter: Painter, layer: ModelStyleLayer): ModelLayerUniformValues => {
    const light = painter.style.light.properties;
    const p = light.get('position');
    const lightPos: [number, number, number] = [-p.x, -p.y, p.z];
    if (light.get('anchor') === 'viewport') {
        vec3.transformMat3(lightPos, lightPos, mat3.fromRotation(lightMatScratch, -painter.transform.angle));
    }
    const c = light.get('color').toNonPremultipliedRenderColor(null);
    const colorMix = layer.paint.get('model-color').constantOr(Color.white).toNonPremultipliedRenderColor(null).toArray01();
    colorMix[3] = layer.paint.get('model-color-mix-intensity').constantOr(0.0);

    return {
        lightPos,
        lightIntensity: light.get('intensity'),
        lightColor: [c.r, c.g, c.b],
        colorMix,
        aoIntensity: layer.paint.get('model-ambient-occlusion-intensity')
    };
};

const modelUniformValues = (
    matrix: mat4,
    lightingMatrix: mat4,
    normalMatrix: mat4,
    nodeMatrix: mat4,
    layerValues: ModelLayerUniformValues,
    opacity: number,
    material: Material,
    emissiveStrength: number,
    cameraPos: [number, number, number] = [0, 0, 0],
    occlusionTextureTransform?: [number, number, number, number] | null,
    materialOverride?: MaterialOverride | null,
    modelColorMix?: [number, number, number, number],
    ditheredDiscardThreshold: number = 1.0,
): UniformValues<ModelUniformsType> => {

    const alphaMask = material.alphaMode === 'MASK';
    const pbr = material.pbrMetallicRoughness;

    let colorMix = modelColorMix || layerValues.colorMix;
    if (materialOverride) {
        const c = materialOverride.color;
        colorMix = [c.r, c.g, c.b, materialOverride.colorMix];
        emissiveStrength = materialOverride.emissionStrength;
        opacity = materialOverride.opacity * opacity;
    }

    const uniformValues = {
        'u_matrix': matrix as Float32Array,
        'u_lighting_matrix': lightingMatrix as Float32Array,
        'u_normal_matrix': normalMatrix as Float32Array,
        'u_node_matrix': (nodeMatrix ? nodeMatrix : emptyMat4) as Float32Array,
        'u_lightpos': layerValues.lightPos,
        'u_lightintensity': layerValues.lightIntensity,
        'u_lightcolor': layerValues.lightColor,
        'u_camera_pos': cameraPos,
        'u_opacity': opacity,
        'u_alphaMask': +alphaMask,
        'u_alphaCutoff': material.alphaCutoff,
        'u_baseColorFactor': pbr.baseColorFactor.toNonPremultipliedRenderColor(null).toArray01(),
        'u_emissiveFactor': material.emissiveFactor.toNonPremultipliedRenderColor(null).toArray01(),
        'u_metallicFactor': pbr.metallicFactor,
        'u_roughnessFactor': pbr.roughnessFactor,
        'u_baseColorTexture': TextureSlots.BaseColor,
        'u_metallicRoughnessTexture': TextureSlots.MetallicRoughness,
        'u_normalTexture': TextureSlots.Normal,
        'u_occlusionTexture': TextureSlots.Occlusion,
        'u_emissionTexture': TextureSlots.Emission,
        'u_lutTexture': TextureSlots.LUT,
        'u_color_mix': colorMix,
        'u_aoIntensity': layerValues.aoIntensity,
        'u_emissive_strength': emissiveStrength,
        'u_occlusionTextureTransform': occlusionTextureTransform ? occlusionTextureTransform : [0, 0, 0, 0] as [number, number, number, number],
        'u_dithered_discard_threshold': ditheredDiscardThreshold,
        // Only the landmark path reads this; it overwrites the value after this call.
        'u_model_mesh_params': [0, 1, 0, 0] as [number, number, number, number]
    };

    return uniformValues;
};

export type ModelDepthUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_instance']: UniformMatrix4f;
    ['u_node_matrix']: UniformMatrix4f;
};

const modelDepthUniforms = (context: Context): ModelDepthUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_instance': new UniformMatrix4f(context),
    'u_node_matrix': new UniformMatrix4f(context)
});

const modelDepthUniformValues = (
    matrix: mat4,
    instance: mat4 = emptyMat4,
    nodeMatrix: mat4 = emptyMat4,
): UniformValues<ModelDepthUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_instance': instance,
        'u_node_matrix': nodeMatrix
    };
};

export {
    modelUniforms,
    modelLayerUniformValues,
    modelUniformValues,
    modelDepthUniforms,
    modelDepthUniformValues
};
