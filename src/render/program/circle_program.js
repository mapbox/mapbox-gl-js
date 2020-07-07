// @flow

import {
    Uniform1f,
    Uniform2f,
    UniformMatrix4f,
    Uniform2fv
} from '../uniform_binding';
import pixelsToTileUnits from '../../source/pixels_to_tile_units';

import type Context from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {OverscaledTileID} from '../../source/tile_id';
import type Tile from '../../source/tile';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Painter from '../painter';
import browser from '../../util/browser';

export type CircleUniformsType = {|
    'u_camera_to_center_distance': Uniform1f,
    'u_extrude_scale': Uniform2f,
    'u_device_pixel_ratio': Uniform1f,
    'u_matrix': UniformMatrix4f,
    'u_sample_pattern': Uniform2fv
|};

export type CircleDefinesType = 'PITCH_WITH_MAP' | 'SCALE_WITH_MAP';

//sync with #define in shaders/circle.vertex.glsl
const NUM_SAMPLES_PER_RING = 16;

const circleUniforms = (context: Context, locations: UniformLocations): CircleUniformsType => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_sample_pattern': new Uniform2fv(context, locations.u_sample_pattern, NUM_SAMPLES_PER_RING)
});

const depthSamplePatterns = {
    map: null,
    viewport: null
};

const depthSampleRange = {
    map: [ 0, 2 * Math.PI ],
    // We want to only sample the top half of the circle when it is viewport-aligned.
    // This is to prevent the circle from intersecting with the ground plane below it at high pitch.
    viewport: [ 0, Math.PI ]
};

// Generates a ring of radial unit vectors, in an arc specified by depthSampleRange
const getSamplePattern = (alignment: string): Float32Array => {
    if (!depthSamplePatterns[alignment]) {
        const pattern = new Float32Array(2 * NUM_SAMPLES_PER_RING);
        depthSamplePatterns[alignment] = pattern;

        const [min, max] = depthSampleRange[alignment];
        const step = (max - min) / NUM_SAMPLES_PER_RING;
        for (let i = 0; i < NUM_SAMPLES_PER_RING; i++) {
            const angle = min + step * i;

            pattern[2 * i] = Math.cos(angle);
            // Circle quad space is left-handed so we invert y-axis
            pattern[2 * i + 1] = -Math.sin(angle);
        }
    }

    const pattern = ((depthSamplePatterns[alignment]: any): Float32Array);

    return pattern;
};

const circleUniformValues = (
    painter: Painter,
    coord: OverscaledTileID,
    tile: Tile,
    layer: CircleStyleLayer
): UniformValues<CircleUniformsType> => {
    const transform = painter.transform;
    const alignment = layer.paint.get('circle-pitch-alignment');

    let extrudeScale: [number, number];
    if (alignment === 'map') {
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
        'u_extrude_scale': extrudeScale,
        'u_sample_pattern': getSamplePattern(alignment)
    };
};

const circleDefinesValues = (layer: CircleStyleLayer): CircleDefinesType[] => {
    const values = [];
    if (layer.paint.get('circle-pitch-alignment') === 'map') values.push('PITCH_WITH_MAP');
    if (layer.paint.get('circle-pitch-scale') === 'map') values.push('SCALE_WITH_MAP');

    return values;
};

export {circleUniforms, circleUniformValues, circleDefinesValues};
