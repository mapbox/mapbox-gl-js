// @flow

import {mat3, vec3} from 'gl-matrix';
import {
    Uniform1i,
    Uniform1f,
    Uniform3f,
    Uniform4f,
    UniformMatrix4f
} from '../../../src/render/uniform_binding.js';

import Color from '../../../src/style-spec/util/color.js';
import ModelStyleLayer from '../../style/style_layer/model_style_layer.js';
import TextureSlots from '../texture_slots.js';

import type {UniformValues} from '../../../src/render/uniform_binding.js';
import type Context from '../../../src/gl/context.js';
import type Painter from '../../../src/render/painter.js';
import type {Material} from '../../data/model.js';

export type ModelUniformsType = {
    'u_matrix': UniformMatrix4f,
    'u_lighting_matrix': UniformMatrix4f,
    'u_normal_matrix': UniformMatrix4f,
    'u_lightpos': Uniform3f,
    'u_lightintensity': Uniform1f,
    'u_lightcolor': Uniform3f,
    'u_camera_pos': Uniform3f,
    'u_opacity': Uniform1f,
    'u_baseColorFactor': Uniform4f,
    'u_emissiveFactor': Uniform4f,
    'u_metallicFactor': Uniform1f,
    'u_roughnessFactor': Uniform1f,
    'u_baseTextureIsAlpha': Uniform1i,
    'u_alphaMask': Uniform1i,
    'u_alphaCutoff': Uniform1f,
    'u_baseColorTexture': Uniform1i,
    'u_metallicRoughnessTexture': Uniform1i,
    'u_normalTexture': Uniform1i,
    'u_occlusionTexture': Uniform1i,
    'u_emissionTexture': Uniform1i,
    'u_color_mix': Uniform4f,
    'u_aoIntensity': Uniform1f,
    'u_emissive_strength': Uniform1f,
    'u_occlusionTextureTransform': Uniform4f
};

const modelUniforms = (context: Context): ModelUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_lighting_matrix': new UniformMatrix4f(context),
    'u_normal_matrix': new UniformMatrix4f(context),
    'u_lightpos': new Uniform3f(context),
    'u_lightintensity': new Uniform1f(context),
    'u_lightcolor': new Uniform3f(context),
    'u_camera_pos': new Uniform3f(context),
    'u_opacity': new Uniform1f(context),
    'u_baseColorFactor': new Uniform4f(context),
    'u_emissiveFactor': new Uniform4f(context),
    'u_metallicFactor': new Uniform1f(context),
    'u_roughnessFactor': new Uniform1f(context),
    'u_baseTextureIsAlpha': new Uniform1i(context),
    'u_alphaMask': new Uniform1i(context),
    'u_alphaCutoff': new Uniform1f(context),
    'u_baseColorTexture': new Uniform1i(context),
    'u_metallicRoughnessTexture': new Uniform1i(context),
    'u_normalTexture': new Uniform1i(context),
    'u_occlusionTexture': new Uniform1i(context),
    'u_emissionTexture': new Uniform1i(context),
    'u_color_mix': new Uniform4f(context),
    'u_aoIntensity': new Uniform1f(context),
    'u_emissive_strength' : new Uniform1f(context),
    'u_occlusionTextureTransform': new Uniform4f(context)

});

const modelUniformValues = (
    matrix: Float32Array,
    lightingMatrix: Float32Array,
    normalMatrix: Float32Array,
    painter: Painter,
    opacity: number,
    baseColorFactor: Color,
    emissiveFactor: [number, number, number],
    metallicFactor: number,
    roughnessFactor: number,
    material: Material,
    emissiveStrength: number,
    layer: ModelStyleLayer,
    cameraPos: [number, number, number] = [0, 0, 0],
    occlusionTextureTransform: ?[number, number, number, number]
): UniformValues<ModelUniformsType> => {

    const light = painter.style.light;
    const _lp = light.properties.get('position');
    const lightPos = [-_lp.x, -_lp.y, _lp.z];
    const lightMat = mat3.create();
    const anchor = light.properties.get('anchor');
    if (anchor === 'viewport') {
        mat3.fromRotation(lightMat, -painter.transform.angle);
        vec3.transformMat3(lightPos, lightPos, lightMat);
    }

    const alphaMask = material.alphaMode === 'MASK';

    const lightColor = light.properties.get('color');

    const aoIntensity = layer.paint.get('model-ambient-occlusion-intensity');
    const colorMix = layer.paint.get('model-color').constantOr(Color.white);
    const colorMixIntensity = layer.paint.get('model-color-mix-intensity').constantOr(0.0);

    const uniformValues = {
        'u_matrix': matrix,
        'u_lighting_matrix': lightingMatrix,
        'u_normal_matrix': normalMatrix,
        'u_lightpos': lightPos,
        'u_lightintensity': light.properties.get('intensity'),
        'u_lightcolor': [lightColor.r, lightColor.g, lightColor.b],
        'u_camera_pos': cameraPos,
        'u_opacity': opacity,
        'u_baseTextureIsAlpha': 0,
        'u_alphaMask': +alphaMask,
        'u_alphaCutoff': material.alphaCutoff,
        'u_baseColorFactor': [baseColorFactor.r, baseColorFactor.g, baseColorFactor.b, baseColorFactor.a],
        'u_emissiveFactor': [emissiveFactor[0], emissiveFactor[1], emissiveFactor[2], 1.0],
        'u_metallicFactor': metallicFactor,
        'u_roughnessFactor': roughnessFactor,
        'u_baseColorTexture': TextureSlots.BaseColor,
        'u_metallicRoughnessTexture': TextureSlots.MetallicRoughness,
        'u_normalTexture': TextureSlots.Normal,
        'u_occlusionTexture': TextureSlots.Occlusion,
        'u_emissionTexture': TextureSlots.Emission,
        'u_color_mix': [colorMix.r, colorMix.g, colorMix.b, colorMixIntensity],
        'u_aoIntensity': aoIntensity,
        'u_emissive_strength': emissiveStrength,
        'u_occlusionTextureTransform': occlusionTextureTransform ? occlusionTextureTransform : [0, 0, 0, 0]
    };

    return uniformValues;
};

export type ModelDepthUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_instance': UniformMatrix4f,
    'u_node_matrix': UniformMatrix4f
|};

const modelDepthUniforms = (context: Context): ModelDepthUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_instance': new UniformMatrix4f(context),
    'u_node_matrix': new UniformMatrix4f(context)
});

const emptyMat4 = new Float32Array(16);
const modelDepthUniformValues = (
    matrix: Float32Array,
    instance: Float32Array = emptyMat4,
    nodeMatrix: Float32Array = emptyMat4
): UniformValues<ModelDepthUniformsType> => {
    return {
        'u_matrix': matrix,
        'u_instance': instance,
        'u_node_matrix': nodeMatrix
    };
};

export {
    modelUniforms,
    modelUniformValues,
    modelDepthUniforms,
    modelDepthUniformValues
};
