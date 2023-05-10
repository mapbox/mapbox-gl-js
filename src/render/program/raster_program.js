// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';
import type RasterStyleLayer from '../../style/style_layer/raster_style_layer.js';

export type RasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_tl_parent': Uniform2f,
    'u_scale_parent': Uniform1f,
    'u_fade_t': Uniform1f,
    'u_opacity': Uniform1f,
    'u_image0': Uniform1i,
    'u_image1': Uniform1i,
    'u_brightness_low': Uniform1f,
    'u_brightness_high': Uniform1f,
    'u_saturation_factor': Uniform1f,
    'u_contrast_factor': Uniform1f,
    'u_spin_weights': Uniform3f,
    'u_perspective_transform': Uniform2f
|};

const rasterUniforms = (context: Context): RasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_tl_parent': new Uniform2f(context),
    'u_scale_parent': new Uniform1f(context),
    'u_fade_t': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_image0': new Uniform1i(context),
    'u_image1': new Uniform1i(context),
    'u_brightness_low': new Uniform1f(context),
    'u_brightness_high': new Uniform1f(context),
    'u_saturation_factor': new Uniform1f(context),
    'u_contrast_factor': new Uniform1f(context),
    'u_spin_weights': new Uniform3f(context),
    'u_perspective_transform': new Uniform2f(context)
});

const rasterUniformValues = (
    matrix: Float32Array,
    parentTL: [number, number],
    parentScaleBy: number,
    fade: {mix: number, opacity: number},
    layer: RasterStyleLayer,
    perspectiveTransform: [number, number]
): UniformValues<RasterUniformsType> => ({
    'u_matrix': matrix,
    'u_tl_parent': parentTL,
    'u_scale_parent': parentScaleBy,
    'u_fade_t': fade.mix,
    'u_opacity': fade.opacity * layer.paint.get('raster-opacity'),
    'u_image0': 0,
    'u_image1': 1,
    'u_brightness_low': layer.paint.get('raster-brightness-min'),
    'u_brightness_high': layer.paint.get('raster-brightness-max'),
    'u_saturation_factor': saturationFactor(layer.paint.get('raster-saturation')),
    'u_contrast_factor': contrastFactor(layer.paint.get('raster-contrast')),
    'u_spin_weights': spinWeights(layer.paint.get('raster-hue-rotate')),
    'u_perspective_transform': perspectiveTransform
});

function spinWeights(angle: number) {
    angle *= Math.PI / 180;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return [
        (2 * c + 1) / 3,
        (-Math.sqrt(3) * s - c + 1) / 3,
        (Math.sqrt(3) * s - c + 1) / 3
    ];
}

function contrastFactor(contrast: number) {
    return contrast > 0 ?
        1 / (1 - contrast) :
        1 + contrast;
}

function saturationFactor(saturation: number) {
    return saturation > 0 ?
        1 - 1 / (1.001 - saturation) :
        -saturation;
}

export {rasterUniforms, rasterUniformValues};
