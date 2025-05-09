import {Uniform1i, Uniform1f, Uniform2f, Uniform3f, Uniform4f, UniformMatrix2f, UniformMatrix4f} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';
import {clamp} from '../../../src/util/util';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';

import type {mat4} from 'gl-matrix';
import type Context from '../../gl/context';
import type {UniformValues} from '../uniform_binding';
import type Transform from '../../geo/transform';
import type Tile from '../../source/tile';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type Painter from '../painter';

export type LineUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_pixels_to_tile_units']: UniformMatrix2f;
    ['u_device_pixel_ratio']: Uniform1f;
    ['u_width_scale']: Uniform1f;
    ['u_floor_width_scale']: Uniform1f;
    ['u_units_to_pixels']: Uniform2f;
    ['u_dash_image']: Uniform1i;
    ['u_gradient_image']: Uniform1i;
    ['u_image_height']: Uniform1f;
    ['u_texsize']: Uniform2f;
    ['u_tile_units_to_pixels']: Uniform1f;
    ['u_alpha_discard_threshold']: Uniform1f;
    ['u_trim_offset']: Uniform2f;
    ['u_trim_fade_range']: Uniform2f;
    ['u_trim_color']: Uniform4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_zbias_factor']: Uniform1f;
    ['u_tile_to_meter']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
};

export type LinePatternUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_texsize']: Uniform2f;
    ['u_pixels_to_tile_units']: UniformMatrix2f;
    ['u_device_pixel_ratio']: Uniform1f;
    ['u_width_scale']: Uniform1f;
    ['u_floor_width_scale']: Uniform1f;
    ['u_units_to_pixels']: Uniform2f;
    ['u_image']: Uniform1i;
    ['u_tile_units_to_pixels']: Uniform1f;
    ['u_alpha_discard_threshold']: Uniform1f;
    ['u_trim_offset']: Uniform2f;
    ['u_trim_fade_range']: Uniform2f;
    ['u_trim_color']: Uniform4f;
    ['u_emissive_strength']: Uniform1f;
    ['u_zbias_factor']: Uniform1f;
    ['u_tile_to_meter']: Uniform1f;
    ['u_ground_shadow_factor']: Uniform3f;
    ['u_pattern_transition']: Uniform1f;
};

export type LineDefinesType = 'RENDER_LINE_GRADIENT' | 'RENDER_LINE_DASH' | 'RENDER_LINE_TRIM_OFFSET' | 'RENDER_LINE_BORDER' | 'LINE_JOIN_NONE' | 'ELEVATED' | 'VARIABLE_LINE_WIDTH' | 'CROSS_SLOPE_VERTICAL' | 'CROSS_SLOPE_HORIZONTAL' | 'ELEVATION_REFERENCE_SEA' | 'LINE_PATTERN_TRANSITION';

const lineUniforms = (context: Context): LineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_pixels_to_tile_units': new UniformMatrix2f(context),
    'u_device_pixel_ratio': new Uniform1f(context),
    'u_width_scale': new Uniform1f(context),
    'u_floor_width_scale': new Uniform1f(context),
    'u_units_to_pixels': new Uniform2f(context),
    'u_dash_image': new Uniform1i(context),
    'u_gradient_image': new Uniform1i(context),
    'u_image_height': new Uniform1f(context),
    'u_texsize': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context),
    'u_alpha_discard_threshold': new Uniform1f(context),
    'u_trim_offset': new Uniform2f(context),
    'u_trim_fade_range': new Uniform2f(context),
    'u_trim_color': new Uniform4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_zbias_factor': new Uniform1f(context),
    'u_tile_to_meter': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
});

const linePatternUniforms = (context: Context): LinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_texsize': new Uniform2f(context),
    'u_pixels_to_tile_units': new UniformMatrix2f(context),
    'u_device_pixel_ratio': new Uniform1f(context),
    'u_width_scale': new Uniform1f(context),
    'u_floor_width_scale': new Uniform1f(context),
    'u_image': new Uniform1i(context),
    'u_units_to_pixels': new Uniform2f(context),
    'u_tile_units_to_pixels': new Uniform1f(context),
    'u_alpha_discard_threshold': new Uniform1f(context),
    'u_trim_offset': new Uniform2f(context),
    'u_trim_fade_range': new Uniform2f(context),
    'u_trim_color': new Uniform4f(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_zbias_factor': new Uniform1f(context),
    'u_tile_to_meter': new Uniform1f(context),
    'u_ground_shadow_factor': new Uniform3f(context),
    'u_pattern_transition': new Uniform1f(context),
});

const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    matrix: mat4 | null | undefined,
    imageHeight: number,
    pixelRatio: number,
    widthScale: number,
    floorWidthScale: number,
    trimOffset: [number, number],
    groundShadowFactor: [number, number, number],
): UniformValues<LineUniformsType> => {
    const transform = painter.transform;
    const pixelsToTileUnits = transform.calculatePixelsToTileUnitsMatrix(tile);
    const ignoreLut = layer.paint.get('line-trim-color-use-theme').constantOr("default") === 'none';

    // Increase zbias factor for low pitch values based on the zoom level. Lower zoom level increases the zbias factor.
    // The values were found experimentally, to make an elevated line look good over a terrain with high elevation differences.
    const zbiasFactor = transform.pitch < 15.0 ? lerp(0.07, 0.7, clamp((14.0 - transform.zoom) / (14.0 - 9.0), 0.0, 1.0)) : 0.07;
    return {
        'u_matrix': calculateMatrix(painter, tile, layer, matrix) as Float32Array,
        'u_pixels_to_tile_units': pixelsToTileUnits as Float32Array,
        'u_device_pixel_ratio': pixelRatio,
        'u_width_scale': widthScale,
        'u_floor_width_scale': floorWidthScale,
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ],
        'u_dash_image': 0,
        'u_gradient_image': 1,
        'u_image_height': imageHeight,
        'u_texsize': hasDash(layer) && tile.lineAtlasTexture ? tile.lineAtlasTexture.size : [0, 0],
        'u_tile_units_to_pixels': calculateTileRatio(tile, painter.transform),
        'u_alpha_discard_threshold': 0.0,
        'u_trim_offset': trimOffset,
        'u_trim_fade_range': layer.paint.get('line-trim-fade-range'),
        'u_trim_color': layer.paint.get('line-trim-color').toPremultipliedRenderColor(ignoreLut ? null : layer.lut).toArray01(),
        'u_emissive_strength': layer.paint.get('line-emissive-strength'),
        'u_zbias_factor': zbiasFactor,
        'u_tile_to_meter': tileToMeter(tile.tileID.canonical, 0.0),
        'u_ground_shadow_factor': groundShadowFactor,
    };
};

const linePatternUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    matrix: mat4 | null | undefined,
    pixelRatio: number,
    widthScale: number,
    floorWidthScale: number,
    trimOffset: [number, number],
    groundShadowFactor: [number, number, number],
    transition: number
): UniformValues<LinePatternUniformsType> => {
    const transform = painter.transform;
    const zbiasFactor = transform.pitch < 15.0 ? lerp(0.07, 0.7, clamp((14.0 - transform.zoom) / (14.0 - 9.0), 0.0, 1.0)) : 0.07;
    const ignoreLut = layer.paint.get('line-trim-color-use-theme').constantOr("default") === 'none';

    // Increase zbias factor for low pitch values based on the zoom level. Lower zoom level increases the zbias factor.
    // The values were found experimentally, to make an elevated line look good over a terrain with high elevation differences.
    return {
        'u_matrix': calculateMatrix(painter, tile, layer, matrix) as Float32Array,
        'u_texsize': tile.imageAtlasTexture ? tile.imageAtlasTexture.size : [0, 0],
        // camera zoom ratio
        'u_pixels_to_tile_units': transform.calculatePixelsToTileUnitsMatrix(tile) as Float32Array,
        'u_device_pixel_ratio': pixelRatio,
        'u_width_scale': widthScale,
        'u_floor_width_scale': floorWidthScale,
        'u_image': 0,
        'u_tile_units_to_pixels': calculateTileRatio(tile, transform),
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ],
        'u_alpha_discard_threshold': 0.0,
        'u_trim_offset': trimOffset,
        'u_trim_fade_range': layer.paint.get('line-trim-fade-range'),
        'u_trim_color': layer.paint.get('line-trim-color').toPremultipliedRenderColor(ignoreLut ? null : layer.lut).toArray01(),
        'u_emissive_strength': layer.paint.get('line-emissive-strength'),
        'u_zbias_factor': zbiasFactor,
        'u_tile_to_meter': tileToMeter(tile.tileID.canonical, 0.0),
        'u_ground_shadow_factor': groundShadowFactor,
        'u_pattern_transition': transition,
    };
};

function calculateTileRatio(tile: Tile, transform: Transform) {
    return 1 / pixelsToTileUnits(tile, 1, transform.tileZoom);
}

function calculateMatrix(painter: Painter, tile: Tile, layer: LineStyleLayer, matrix?: mat4) {
    return painter.translatePosMatrix(
        matrix ? matrix : tile.tileID.projMatrix,
        tile,

        layer.paint.get('line-translate'),
        layer.paint.get('line-translate-anchor')
    );
}

const lineDefinesValues = (layer: LineStyleLayer): LineDefinesType[] => {
    const values: LineDefinesType[] = [];
    if (hasDash(layer)) values.push('RENDER_LINE_DASH');
    if (layer.paint.get('line-gradient')) values.push('RENDER_LINE_GRADIENT');

    const trimOffset = layer.paint.get('line-trim-offset');
    if (trimOffset[0] !== 0 || trimOffset[1] !== 0) {
        values.push('RENDER_LINE_TRIM_OFFSET');
    }

    const hasBorder = layer.paint.get('line-border-width').constantOr(1.0) !== 0.0;
    if (hasBorder) values.push('RENDER_LINE_BORDER');

    const hasJoinNone = layer.layout.get('line-join').constantOr('miter') === 'none';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasPattern = !!layer.paint.get('line-pattern').constantOr((1 as any));
    if (hasJoinNone && hasPattern) {
        values.push('LINE_JOIN_NONE');
    }

    return values;
};

function hasDash(layer: LineStyleLayer) {
    const dashPropertyValue = layer.paint.get('line-dasharray').value;
    // @ts-expect-error - TS2339 - Property 'value' does not exist on type 'PossiblyEvaluatedValue<number[]>'.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return dashPropertyValue.value || dashPropertyValue.kind !== "constant";
}

export {
    lineUniforms,
    linePatternUniforms,
    lineUniformValues,
    linePatternUniformValues,
    lineDefinesValues
};
