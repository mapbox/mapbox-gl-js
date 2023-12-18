// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformMatrix3f,
    UniformMatrix4f
} from '../uniform_binding.js';

import {COLOR_RAMP_RES} from '../../style/style_layer/raster_style_layer.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';
import type RasterStyleLayer from '../../style/style_layer/raster_style_layer.js';

export type RasterUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_normalize_matrix': UniformMatrix4f,
    'u_globe_matrix': UniformMatrix4f,
    'u_merc_matrix': UniformMatrix4f,
    'u_grid_matrix': UniformMatrix3f,
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
    'u_perspective_transform': Uniform2f,
    'u_raster_elevation': Uniform1f,
    'u_tl_br': Uniform4f,
    'u_zoom_transition': Uniform1f,
    'u_merc_center': Uniform2f,
    'u_cutoff_params': Uniform4f,
    'u_colorization_mix': Uniform4f,
    'u_colorization_offset': Uniform1f,
    'u_color_ramp': Uniform1i,
    'u_texture_offset': Uniform2f,
    'u_texture_res': Uniform2f,
    'u_emissive_strength': Uniform1f
|};

export type RasterDefinesType = 'RASTER_COLOR' | 'RENDER_CUTOFF';

const rasterUniforms = (context: Context): RasterUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_normalize_matrix': new UniformMatrix4f(context),
    'u_globe_matrix': new UniformMatrix4f(context),
    'u_merc_matrix': new UniformMatrix4f(context),
    'u_grid_matrix': new UniformMatrix3f(context),
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
    'u_perspective_transform': new Uniform2f(context),
    'u_raster_elevation': new Uniform1f(context),
    'u_tl_br': new Uniform4f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_merc_center': new Uniform2f(context),
    'u_cutoff_params': new Uniform4f(context),
    'u_colorization_mix': new Uniform4f(context),
    'u_colorization_offset': new Uniform1f(context),
    'u_color_ramp': new Uniform1i(context),
    'u_texture_offset': new Uniform2f(context),
    'u_texture_res': new Uniform2f(context),
    'u_emissive_strength': new Uniform1f(context)
});

const rasterUniformValues = (
    matrix: Float32Array,
    normalizeMatrix: Float32Array,
    globeMatrix: Float32Array,
    mercMatrix: Float32Array,
    gridMatrix: Float32Array,
    parentTL: [number, number],
    globeTlBr: [number, number, number, number],
    zoomTransition: number,
    mercatorCenter: [number, number],
    cutoffParams: [number, number, number, number],
    parentScaleBy: number,
    fade: {mix: number, opacity: number},
    layer: RasterStyleLayer,
    perspectiveTransform: [number, number],
    elevation: number,
    colorRampUnit: number,
    colorMix: [number, number, number, number],
    colorOffset: number,
    colorRange: [number, number],
    tileSize: number,
    buffer: number,
    emissiveStrength: number
): UniformValues<RasterUniformsType> => ({
    'u_matrix': matrix,
    'u_normalize_matrix': normalizeMatrix,
    'u_globe_matrix': globeMatrix,
    'u_merc_matrix': mercMatrix,
    'u_grid_matrix': gridMatrix,
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
    'u_perspective_transform': perspectiveTransform,
    'u_raster_elevation': elevation,
    'u_tl_br': globeTlBr,
    'u_zoom_transition': zoomTransition,
    'u_merc_center': mercatorCenter,
    'u_cutoff_params': cutoffParams,
    'u_colorization_mix': computeRasterColorMix(colorMix, colorRange),
    'u_colorization_offset': computeRasterColorOffset(colorOffset, colorRange),
    'u_color_ramp': colorRampUnit,
    'u_texture_offset': [
        buffer / (tileSize + 2 * buffer),
        tileSize / (tileSize + 2 * buffer)
    ],
    'u_texture_res': [tileSize + 2 * buffer, tileSize + 2 * buffer],
    'u_emissive_strength': emissiveStrength
});

const rasterPoleUniformValues = (
    matrix: Float32Array,
    normalizeMatrix: Float32Array,
    globeMatrix: Float32Array,
    fade: {mix: number, opacity: number},
    layer: RasterStyleLayer,
    perspectiveTransform: [number, number],
    elevation: number,
    colorRampUnit: number,
    colorMix: [number, number, number, number],
    colorOffset: number,
    colorRange: [number, number],
    emissiveStrength: number
): UniformValues<RasterUniformsType> => (rasterUniformValues(
    matrix,
    normalizeMatrix,
    globeMatrix,
    new Float32Array(16),
    new Float32Array(9),
    [0, 0],
    [0, 0, 0, 0],
    0.0,
    [0, 0],
    [0, 0, 0, 0],
    1,
    fade,
    layer,
    perspectiveTransform || [0, 0],
    elevation,
    colorRampUnit,
    colorMix,
    colorOffset,
    colorRange,
    1,
    0,
    emissiveStrength
));

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

function computeRasterColorMix([mr, mg, mb, ma]: [number, number, number, number], [min, max]: [number, number]): [number, number, number, number] {
    if (min === max) return [0, 0, 0, 0];

    // The following computes a mix which, together with the offset, transforms a
    // normalized pixel value in the range (0, 1) to a texture lookup position. It
    // combines the following mappings:
    //
    //   1. value = offset + scale * (256 * 256 * 256 * R + 256 * 256 * G + 256 * B + A)
    //   2. normalized = (value - min) / (max - min)
    //   3. stretched = -1/(N+1) + (N+3)/(N+1) * normalized
    //
    // The first mapping reconstructs the numerical value. The second normalizes
    // the value to the range [0, 1] by way of the selected raster-color-range.
    //
    // The third requires some explanation. Since tabulated color map values are
    // defined at the *center* of each texel, we actually stretch the range [0, 1]
    // just slightly so that the *center* of the texels are at 0 and 1, respectively.

    const factor = (COLOR_RAMP_RES + 3) / (COLOR_RAMP_RES + 1) / (max - min);

    return [
        mr * factor,
        mg * factor,
        mb * factor,
        ma * factor
    ];
}

function computeRasterColorOffset(offset: number, [min, max]: [number, number]): number {
    if (min === max) return 0;

    // See above for an explanation. This separately captures the constant-offset
    // component of the mapping.
    return ((offset - min) / (max - min) * (COLOR_RAMP_RES + 3) - 1) / (COLOR_RAMP_RES + 1);

}

export {rasterUniforms, rasterUniformValues, rasterPoleUniformValues};
