// @flow

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform4f,
    UniformMatrix4f
} from '../uniform_binding';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Painter from '../painter';

export type CircleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_scale_with_map': Uniform1i,
    'u_pitch_with_map': Uniform1i,
    'u_extrude_scale': Uniform2f,
    'u_matrix': UniformMatrix4f,
    'u_center_pos': Uniform4f
|};

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_scale_with_map': new Uniform1i(context, locations.u_scale_with_map),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_center_pos': new Uniform4f(context, locations.u_center_pos)
});

const circleUniformValues = (
    painter: Painter,
    wrap: number,
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;

    let pitchWithMap: boolean, extrudeScale: [number, number];
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
    const pixelRatio = transform.globalPixelRatio();
        pitchWithMap = true;
        extrudeScale = [pixelRatio, pixelRatio];
    } else {
        pitchWithMap = false;
        extrudeScale = transform.pixelsToGLUnits;
    }

    const matrix = painter.relativeToEyeMatrix(
        wrap,
        layer.paint.get('circle-translate'),
        layer.paint.get('circle-translate-anchor'));

    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_scale_with_map': +(layer.paint.get('circle-pitch-scale') === 'map'),
        'u_matrix': matrix,
        'u_pitch_with_map': +(pitchWithMap),
        'u_extrude_scale': extrudeScale,
        'u_center_pos': transform.globalCenterPos
    };
};

export { circleUniforms, circleUniformValues };
