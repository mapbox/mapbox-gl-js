// @flow

import {
    Uniform1f,
    Uniform2f,
    Uniform3f,
    UniformMatrix2f,
    UniformMatrix4f
} from '../uniform_binding.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id.js';
import type Tile from '../../source/tile.js';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer.js';
import type Painter from '../painter.js';
import browser from '../../util/browser.js';
import {mat4} from 'gl-matrix';
import {globeToMercatorTransition, globePixelsToTileUnits} from '../../geo/projection/globe_util.js';
import EXTENT from '../../style-spec/data/extent.js';

export type CircleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_extrude_scale': UniformMatrix2f,
    'u_device_pixel_ratio': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_inv_rot_matrix': UniformMatrix4f,
    'u_merc_center': Uniform2f,
    'u_tile_id': Uniform3f,
    'u_zoom_transition': Uniform1f,
    'u_up_dir': Uniform3f,
    'u_emissive_strength': Uniform1f,
|};

export type CircleDefinesType = 'PITCH_WITH_MAP' | 'SCALE_WITH_MAP';

const circleUniforms = (context: Context): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context),
    'u_extrude_scale': new UniformMatrix2f(context),
    'u_device_pixel_ratio': new Uniform1f(context),
    'u_matrix': new UniformMatrix4f(context),
    'u_inv_rot_matrix': new UniformMatrix4f(context),
    'u_merc_center': new Uniform2f(context),
    'u_tile_id': new Uniform3f(context),
    'u_zoom_transition': new Uniform1f(context),
    'u_up_dir': new Uniform3f(context),
    'u_emissive_strength': new Uniform1f(context),
});

const identityMatrix = mat4.create();

const circleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    invMatrix: Float32Array,
    mercatorCenter: [number, number],
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;
    const isGlobe = transform.projection.name === 'globe';

    let extrudeScale;
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        if (isGlobe) {
            const s = globePixelsToTileUnits(transform.zoom, coord.canonical) * transform._pixelsPerMercatorPixel;
            extrudeScale = Float32Array.from([s, 0, 0, s]);
        } else {
            extrudeScale = transform.calculatePixelsToTileUnitsMatrix(tile);
        }
    } else {
        extrudeScale = new Float32Array([
            transform.pixelsToGLUnits[0],
            0,
            0,
            transform.pixelsToGLUnits[1]]);
    }

    const values = {
        'u_camera_to_center_distance': painter.transform.getCameraToCenterDistance(transform.projection),
        'u_matrix': painter.translatePosMatrix(
            coord.projMatrix,
            tile,
            layer.paint.get('circle-translate'),
            layer.paint.get('circle-translate-anchor')),
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_extrude_scale': extrudeScale,
        'u_inv_rot_matrix': identityMatrix,
        'u_merc_center': [0, 0],
        'u_tile_id': [0, 0, 0],
        'u_zoom_transition': 0,
        'u_up_dir': [0, 0, 0],
        'u_emissive_strength': layer.paint.get('circle-emissive-strength')
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

const circleDefinesValues = (layer: CircleStyleLayer): CircleDefinesType[] => {
    const values = [];
    if (layer.paint.get('circle-pitch-alignment') === 'map') values.push('PITCH_WITH_MAP');
    if (layer.paint.get('circle-pitch-scale') === 'map') values.push('SCALE_WITH_MAP');

    return values;
};

export {circleUniforms, circleUniformValues, circleDefinesValues};
