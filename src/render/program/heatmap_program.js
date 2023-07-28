// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix4f
} from '../uniform_binding.js';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';

import type Context from '../../gl/context.js';
import type Tile from '../../source/tile.js';
import type {UniformValues} from '../uniform_binding.js';
import type Painter from '../painter.js';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer.js';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id.js';
import {mat4} from 'gl-matrix';
import {globeToMercatorTransition, globePixelsToTileUnits} from '../../geo/projection/globe_util.js';
import EXTENT from '../../style-spec/data/extent.js';

export type HeatmapUniformsType = {|
    'u_extrude_scale': Uniform1f,
    'u_intensity': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_up_dir': Uniform3f,
|};

export type HeatmapTextureUniformsType = {|
    'u_image': Uniform1i,
    'u_color_ramp': Uniform1i,
    'u_opacity': Uniform1f
|};

const heatmapUniforms = (context: Context): HeatmapUniformsType => ({
    'u_extrude_scale': new Uniform1f(context),
    'u_intensity': new Uniform1f(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_up_dir': new Uniform3f(context)
});

const heatmapTextureUniforms = (context: Context): HeatmapTextureUniformsType => ({
    'u_image': new Uniform1i(context),
    'u_color_ramp': new Uniform1i(context),
    'u_opacity': new Uniform1f(context)
});

const identityMatrix = mat4.create();

const heatmapUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    invMatrix: Float32Array,
    mercatorCenter: [number, number],
    zoom: number,
    intensity: number
): UniformValues<HeatmapUniformsType> => {
    const transform = painter.transform;
    const isGlobe = transform.projection.name === 'globe';
    const extrudeScale = isGlobe ? globePixelsToTileUnits(transform.zoom, coord.canonical) * transform._pixelsPerMercatorPixel : pixelsToTileUnits(tile, 1, zoom);

    const values = {
        'u_matrix': coord.projMatrix,
        'u_extrude_scale': extrudeScale,
        'u_intensity': intensity,
        'u_inv_rot_matrix': identityMatrix,
        'u_merc_center': [0, 0],
        'u_tile_id': [0, 0, 0],
        'u_zoom_transition': 0,
        'u_up_dir': [0, 0, 0],
    };

    if (isGlobe) {
        values['u_inv_rot_matrix'] = invMatrix;
        values['u_merc_center'] = mercatorCenter;
        values['u_tile_id'] = [coord.canonical.x, coord.canonical.y, 1 << coord.canonical.z];
        values['u_zoom_transition'] = globeToMercatorTransition(transform.zoom);
        const x = mercatorCenter[0] * EXTENT;
        const y = mercatorCenter[1] * EXTENT;
        values['u_up_dir'] = (transform.projection.upVector(new CanonicalTileID(0, 0, 0), x, y): any);
    }

    return values;
};

const heatmapTextureUniformValues = (
    painter: Painter,
    layer: HeatmapStyleLayer,
    textureUnit: number,
    colorRampUnit: number
): UniformValues<HeatmapTextureUniformsType> => {
    return {
        'u_image': textureUnit,
        'u_color_ramp': colorRampUnit,
        'u_opacity': layer.paint.get('heatmap-opacity')
    };
};

export {
    heatmapUniforms,
    heatmapTextureUniforms,
    heatmapUniformValues,
    heatmapTextureUniformValues
};

export type HeatmapDefinesType = 'PROJECTION_GLOBE_VIEW';
