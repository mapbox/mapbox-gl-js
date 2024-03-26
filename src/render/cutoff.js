// @flow

import Context from '../gl/context.js';
import type {UniformValues} from './uniform_binding.js';
import {Uniform4f} from './uniform_binding.js';
import {smoothstep, warnOnce} from '../util/util.js';
import {MIN_LOD_PITCH} from '../geo/transform.js';

import type Painter from './painter.js';

export type CutoffUniformsType = {|
    'u_cutoff_params': Uniform4f,
|};

export type CutoffParams = {
    shouldRenderCutoff: boolean;
    uniformValues: UniformValues<CutoffUniformsType>;
}

export const cutoffUniforms = (context: Context): CutoffUniformsType => ({
    'u_cutoff_params': new Uniform4f(context),
});

// This function returns the parameters of the cutoff effect for the LOD content (before the tileCover shows lower zoom
// level tiles)
//
// The first 2 values are the near and far plane distances in pixels, which are used to linearize the depth values of
// the vertices after the projection
//
// The 3rd value is the distance from which the content will be hidden, which is relative to the range of the near and
// far plane distance
//
// The 4th value is the distance where the linear fade out from value 3 should end
export const getCutoffParams = (
    painter: Painter,
    cutoffFadeRange: number
): CutoffParams => {
    if (cutoffFadeRange > 0.0 && painter.terrain)  {
        // To be fixed: https://mapbox.atlassian.net/browse/MAPS3D-1034
        warnOnce("Cutoff is currently disabled on terrain");
    }
    if (cutoffFadeRange <= 0.0 || painter.terrain) {
        return {
            shouldRenderCutoff: false,
            uniformValues: {
                'u_cutoff_params': [0, 0, 0, 1]
            }
        };
    }

    const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };
    const tr = painter.transform;
    const zoomScale = Math.max(Math.abs(tr._zoom - (painter.minCutoffZoom - 1.0)), 1.0);
    const pitchScale = tr.isLODDisabled(false) ? smoothstep(MIN_LOD_PITCH, MIN_LOD_PITCH - 15.0, tr.pitch) : smoothstep(30, 15, tr.pitch);
    const zRange = tr._farZ - tr._nearZ;
    const cameraToCenterDistance = tr.cameraToCenterDistance;
    const fadeRangePixels = cutoffFadeRange * tr.height;
    const cutoffDistance = lerp(cameraToCenterDistance, tr._farZ + fadeRangePixels, pitchScale) * zoomScale;
    const relativeCutoffDistance = ((cutoffDistance - tr._nearZ) / zRange);
    const relativeCutoffFadeDistance = ((cutoffDistance - fadeRangePixels - tr._nearZ) / zRange);
    return {
        shouldRenderCutoff: pitchScale < 1.0,
        uniformValues: {
            'u_cutoff_params': [
                tr._nearZ,
                tr._farZ,
                relativeCutoffDistance,
                relativeCutoffFadeDistance
            ]
        }
    };
};
