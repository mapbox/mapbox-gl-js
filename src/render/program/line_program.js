// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding.js';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';
import browser from '../../util/browser.js';

import type Context from '../../gl/context.js';
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
import type Transform from '../../geo/transform.js';
import type Tile from '../../source/tile.js';
import type LineStyleLayer from '../../style/style_layer/line_style_layer.js';
import type Painter from '../painter.js';
import type {CrossfadeParameters} from '../../style/evaluation_parameters.js';

export type LineUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_ratio': Uniform1f,
    'u_device_pixel_ratio': Uniform1f,
    'u_units_to_pixels': Uniform2f,
    'u_dash_image': Uniform1i,
    'u_gradient_image': Uniform1i,
    'u_image_height': Uniform1f,
    'u_texsize': Uniform2f,
    'u_scale': Uniform3f,
    'u_mix': Uniform1f
|};

export type LinePatternUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_texsize': Uniform2f,
    'u_ratio': Uniform1f,
    'u_device_pixel_ratio': Uniform1f,
    'u_units_to_pixels': Uniform2f,
    'u_image': Uniform1i,
    'u_scale': Uniform3f,
    'u_fade': Uniform1f
|};

export type LineDefinesType = 'RENDER_LINE_GRADIENT' | 'RENDER_LINE_DASH';

const lineUniforms = (context: Context, locations: UniformLocations): LineUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_dash_image': new Uniform1i(context, locations.u_dash_image),
    'u_gradient_image': new Uniform1i(context, locations.u_gradient_image),
    'u_image_height': new Uniform1f(context, locations.u_image_height),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_mix': new Uniform1f(context, locations.u_mix)
});

const linePatternUniforms = (context: Context, locations: UniformLocations): LinePatternUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_ratio': new Uniform1f(context, locations.u_ratio),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_units_to_pixels': new Uniform2f(context, locations.u_units_to_pixels),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)
});

const lineUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    crossfade: CrossfadeParameters,
    matrix: ?Float32Array,
    imageHeight: number
): UniformValues<LineUniformsType> => {
    const transform = painter.transform;
    const values = {
        'u_matrix': calculateMatrix(painter, tile, layer, matrix),
        'u_ratio': 1 / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ],
        'u_dash_image': 0,
        'u_gradient_image': 1,
        'u_image_height': imageHeight,
        'u_texsize': [0, 0],
        'u_scale': [0, 0, 0],
        'u_mix': 0
    };
    if (hasDash(layer)) {
        const tileZoomRatio = calculateTileRatio(tile, painter.transform);
        values['u_texsize'] = tile.lineAtlasTexture.size;
        values['u_scale'] = [tileZoomRatio, crossfade.fromScale, crossfade.toScale];
        values['u_mix'] = crossfade.t;
    }
    return values;
};

const linePatternUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: LineStyleLayer,
    crossfade: CrossfadeParameters,
    matrix: ?Float32Array
): UniformValues<LinePatternUniformsType> => {
    const transform = painter.transform;
    const tileZoomRatio = calculateTileRatio(tile, transform);
    return {
        'u_matrix': calculateMatrix(painter, tile, layer, matrix),
        'u_texsize': tile.imageAtlasTexture.size,
        // camera zoom ratio
        'u_ratio': 1 / pixelsToTileUnits(tile, 1, transform.zoom),
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_image': 0,
        'u_scale': [tileZoomRatio, crossfade.fromScale, crossfade.toScale],
        'u_fade': crossfade.t,
        'u_units_to_pixels': [
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        ]
    };
};

function calculateTileRatio(tile: Tile, transform: Transform) {
    return 1 / pixelsToTileUnits(tile, 1, transform.tileZoom);
}

function calculateMatrix(painter, tile, layer, matrix) {
    return painter.translatePosMatrix(
        matrix ? matrix : tile.tileID.projMatrix,
        tile,
        layer.paint.get('line-translate'),
        layer.paint.get('line-translate-anchor')
    );
}

const lineDefinesValues = (layer: LineStyleLayer): LineDefinesType[] => {
    const values = [];
    if (hasDash(layer)) values.push('RENDER_LINE_DASH');
    if (layer.paint.get('line-gradient')) values.push('RENDER_LINE_GRADIENT');
    return values;
};

function hasDash(layer) {
    const dashPropertyValue = layer.paint.get('line-dasharray').value;
    return dashPropertyValue.value || dashPropertyValue.kind !== "constant";
}

export {
    lineUniforms,
    linePatternUniforms,
    lineUniformValues,
    linePatternUniformValues,
    lineDefinesValues
};
