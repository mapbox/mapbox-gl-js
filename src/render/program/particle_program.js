// @flow

import {
    Uniform1f,
    UniformMatrix2f,
    UniformMatrix4f
} from '../uniform_binding.js';

import type Context from '../../gl/context.js';
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
import type {OverscaledTileID} from '../../source/tile_id.js';
import type Tile from '../../source/tile.js';
import type ParticleStyleLayer from '../../style/style_layer/particle_style_layer.js';
import type Painter from '../painter.js';
import browser from '../../util/browser.js';

export type ParticleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_extrude_scale': UniformMatrix2f,
    'u_device_pixel_ratio': Uniform1f,
    'u_matrix': UniformMatrix4f
|};

export type ParticleDefinesType = 'PITCH_WITH_MAP' | 'SCALE_WITH_MAP';

const particleUniforms = (context: Context, locations: UniformLocations): ParticleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_extrude_scale': new UniformMatrix2f(context, locations.u_extrude_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix)
});

const particleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: ParticleStyleLayer
): UniformValues<ParticleUniformsType> => {
    const transform = painter.transform;

    let extrudeScale;
    if (layer.paint.get('particle-pitch-alignment') === 'map') {
        extrudeScale = transform.calculatePixelsToTileUnitsMatrix(tile);
    } else {
        extrudeScale = new Float32Array([
            transform.pixelsToGLUnits[0],
            0,
            0,
            transform.pixelsToGLUnits[1]]);
    }

    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_matrix': painter.translatePosMatrix(
            coord.projMatrix,
            tile,
            layer.paint.get('particle-translate'),
            layer.paint.get('particle-translate-anchor')),
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_extrude_scale': extrudeScale
    };
};

const particleDefinesValues = (layer: ParticleStyleLayer): ParticleDefinesType[] => {
    const values = [];
    if (layer.paint.get('particle-pitch-alignment') === 'map') values.push('PITCH_WITH_MAP');
    if (layer.paint.get('particle-pitch-scale') === 'map') values.push('SCALE_WITH_MAP');

    return values;
};

export {particleUniforms, particleUniformValues, particleDefinesValues};
