// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    Uniform3fv,
    UniformMatrix4fv
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type RasterStyleLayer from '../../style/style_layer/raster_style_layer';

type u_matrix = UniformMatrix4fv;
type u_tl_parent = Uniform2fv;
type u_scale_parent = Uniform1f;
type u_buffer_scale = Uniform1f;
type u_fade_t = Uniform1f;
type u_opacity = Uniform1f;
type u_image0 = Uniform1i;
type u_image1 = Uniform1i;
type u_brightness_low = Uniform1f;
type u_brightness_high = Uniform1f;
type u_saturation_factor = Uniform1f;
type u_contrast_factor = Uniform1f;
type u_spin_weights = Uniform3fv;

export type RasterUniformsType = [
    u_matrix,
    u_tl_parent,
    u_scale_parent,
    u_buffer_scale,
    u_fade_t,
    u_opacity,
    u_image0,
    u_image1,
    u_brightness_low,
    u_brightness_high,
    u_saturation_factor,
    u_contrast_factor,
    u_spin_weights
];

const rasterUniforms = (context: Context, locations: UniformLocations): RasterUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform2fv(context, locations['u_tl_parent']),
    new Uniform1f(context, locations['u_scale_parent']),
    new Uniform1f(context, locations['u_buffer_scale']),
    new Uniform1f(context, locations['u_fade_t']),
    new Uniform1f(context, locations['u_opacity']),
    new Uniform1i(context, locations['u_image0']),
    new Uniform1i(context, locations['u_image1']),
    new Uniform1f(context, locations['u_brightness_low']),
    new Uniform1f(context, locations['u_brightness_high']),
    new Uniform1f(context, locations['u_saturation_factor']),
    new Uniform1f(context, locations['u_contrast_factor']),
    new Uniform3fv(context, locations['u_spin_weights'])
]);

const rasterUniformValues = (
    matrix: Float32Array,
    parentTL: [number, number],
    parentScaleBy: number,
    fade: {mix: number, opacity: number},
    layer: RasterStyleLayer
): UniformValues<RasterUniformsType> => ([
    matrix,
    parentTL,
    parentScaleBy,
    1,
    fade.mix,
    fade.opacity * layer.paint.get('raster-opacity'),
    0,
    1,
    layer.paint.get('raster-brightness-min'),
    layer.paint.get('raster-brightness-max'),
    saturationFactor(layer.paint.get('raster-saturation')),
    contrastFactor(layer.paint.get('raster-contrast')),
    spinWeights(layer.paint.get('raster-hue-rotate'))
]);

function spinWeights(angle) {
    angle *= Math.PI / 180;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return [
        (2 * c + 1) / 3,
        (-Math.sqrt(3) * s - c + 1) / 3,
        (Math.sqrt(3) * s - c + 1) / 3
    ];
}

function contrastFactor(contrast) {
    return contrast > 0 ?
        1 / (1 - contrast) :
        1 + contrast;
}

function saturationFactor(saturation) {
    return saturation > 0 ?
        1 - 1 / (1.001 - saturation) :
        -saturation;
}

export { rasterUniforms, rasterUniformValues };
