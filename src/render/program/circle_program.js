// @flow

import {
    Uniform1f,
    Uniform2f,
    UniformMatrix4f
} from '../uniform_binding.js';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';

import type Context from '../../gl/context.js';
import type {UniformValues, UniformLocations} from '../uniform_binding.js';
import type {OverscaledTileID} from '../../source/tile_id.js';
import type Tile from '../../source/tile.js';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer.js';
import type Painter from '../painter.js';
import browser from '../../util/browser.js';

export type CircleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_extrude_scale': Uniform2f,
    'u_device_pixel_ratio': Uniform1f,
    'u_matrix': UniformMatrix4f
|};

export type CircleDefinesType = 'PITCH_WITH_MAP' | 'SCALE_WITH_MAP';

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix)
});

const circleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;

    let extrudeScale: [number, number];
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
        extrudeScale = [pixelRatio, pixelRatio];
    } else {
        extrudeScale = transform.pixelsToGLUnits;
    }

    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_matrix': painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint.get('circle-translate'),
            layer.paint.get('circle-translate-anchor')),
        'u_device_pixel_ratio': browser.devicePixelRatio,
        'u_extrude_scale': extrudeScale
    };
};

const circleDefinesValues = (layer: CircleStyleLayer): CircleDefinesType[] => {
    const values = [];
    if (layer.paint.get('circle-pitch-alignment') === 'map') values.push('PITCH_WITH_MAP');
    if (layer.paint.get('circle-pitch-scale') === 'map') values.push('SCALE_WITH_MAP');

    return values;
};

export {circleUniforms, circleUniformValues, circleDefinesValues};
