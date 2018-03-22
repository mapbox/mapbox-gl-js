// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    UniformMatrix4fv
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {OverscaledTileID} from '../../source/tile_id';
import type Tile from '../../source/tile';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Painter from '../painter';


type u_camera_to_center_distance = Uniform1f;
type u_scale_with_map = Uniform1i;
type u_pitch_with_map = Uniform1i;
type u_extrude_scale = Uniform2fv;
type u_matrix = UniformMatrix4fv;

export type CircleUniformsType = [
    u_matrix,
    u_camera_to_center_distance,
    u_scale_with_map,
    u_pitch_with_map,
    u_extrude_scale
];

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ([
    new UniformMatrix4fv(context, locations['u_matrix']),
    new Uniform1f(context, locations['u_camera_to_center_distance']),
    new Uniform1i(context, locations['u_scale_with_map']),
    new Uniform1i(context, locations['u_pitch_with_map']),
    new Uniform2fv(context, locations['u_extrude_scale'])
]);

const circleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;

    let pitchWithMap: boolean, extrudeScale: [number, number];
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
        pitchWithMap = true;
        extrudeScale = [pixelRatio, pixelRatio];
    } else {
        pitchWithMap = false;
        extrudeScale = transform.pixelsToGLUnits;
    }

    return [
        painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint.get('circle-translate'),
            layer.paint.get('circle-translate-anchor')),
        transform.cameraToCenterDistance,
        +(layer.paint.get('circle-pitch-scale') === 'map'),
        +(pitchWithMap),
        extrudeScale
    ];
};

export { circleUniforms, circleUniformValues };
