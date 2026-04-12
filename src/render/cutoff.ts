import {Uniform4f} from './uniform_binding';
import {smoothstep, warnOnce} from '../util/util';
import {MIN_LOD_PITCH} from '../geo/transform';

import type {UniformValues} from './uniform_binding';
import type Context from '../gl/context';
import type Painter from './painter';

export type CutoffUniformsType = {
    ['u_cutoff_params']: Uniform4f;
};

export type CutoffParams = {
    shouldRenderCutoff: boolean;
    uniformValues: UniformValues<CutoffUniformsType>;
};

export const cutoffUniforms = (context: Context): CutoffUniformsType => ({
    'u_cutoff_params': new Uniform4f(context),
});

// Constants below are based on heuristics.
// Multiplier applied to cutoffFadeRange * screenHeight to widen the visible fade band.
const FADE_RANGE_HEIGHT_SCALE = 1.3;
// Exponent for zoom-based scaling: 2^(dz * exp). Values < 1 slow the exponential
// growth so the cutoff line moves up slower (isn't achored to location) with zoom.
const ZOOM_SCALE_EXPONENT = 0.85;
// Base multiplier on cameraToCenterDistance that sets the cutoff distance at the
// activation pitch. Larger values push the cutoff farther from the camera.
const CUTOFF_DISTANCE_BASE_MULTIPLIER = 1.4;
// Pitch in degrees over which the cutoff effect ramps from inactive to fully active.
const ACTIVATION_PITCH_RAMP_WIDTH = 15;

// This function returns the parameters of the cutoff effect for the LOD content
// (before the tileCover shows lower zoom level tiles).
//
// The returned vec4 u_cutoff_params contains:
//   x: nearZ - near plane distance in pixels, used to linearize depth
//   y: farZ  - far plane distance in pixels, used to linearize depth
//   z: relativeCutoffDistance - normalized depth where content fully disappears
//   w: relativeCutoffFadeDistance - normalized depth where fade begins (closer to camera than z)
//
// The cutoff distance is anchored to the ground-plane position where effective zoom
// drops ~1 level below the source minzoom. It scales with a half-rate exponential
// (2^(dz*0.5)) to move the cutoff line up on screen as you zoom in, while staying
// bounded at high zoom deltas. The fade range (controlled by cutoffFadeRange) is
// clamped so it never extends past the near plane.
//
// Activation is smoothly blended over a pitch range using the LOD pitch threshold
// (which accounts for top padding via edge insets).
export const getCutoffParams = (painter: Painter, cutoffFadeRange: number): CutoffParams => {
    if (cutoffFadeRange > 0.0 && painter.terrain) {
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
    const pitch = tr.pitch;

    // Activation threshold: padding-aware (MIN_LOD_PITCH) or fixed 30° for terrain exaggeration
    const activationThreshold = tr.isLODDisabled(false) ? MIN_LOD_PITCH : 30;
    if (pitch < activationThreshold - ACTIVATION_PITCH_RAMP_WIDTH) {
        return {
            shouldRenderCutoff: false,
            uniformValues: {
                'u_cutoff_params': [0, 0, 0, 1]
            }
        };
    }

    const zRange = tr._farZ - tr._nearZ;
    const fadeRangePixels = cutoffFadeRange * tr.height * FADE_RANGE_HEIGHT_SCALE;

    // Half-rate exponential zoom scaling: grows with zoom but stays bounded
    const zoomScale = Math.pow(2.0, Math.max(tr._zoom - painter.minCutoffZoom, 0.0) * ZOOM_SCALE_EXPONENT);
    const cutoffDistance = tr.cameraToCenterDistance * CUTOFF_DISTANCE_BASE_MULTIPLIER * zoomScale;

    // Smooth activation over pitch range
    const activation = smoothstep(activationThreshold - ACTIVATION_PITCH_RAMP_WIDTH, activationThreshold, pitch);
    const effectiveCutoffDistance = lerp(tr._farZ + fadeRangePixels, cutoffDistance, activation);

    // Clamp fade range to not extend past near plane
    const clampedFadeRange = Math.min(fadeRangePixels, effectiveCutoffDistance - tr._nearZ);
    const relativeCutoffDistance = (effectiveCutoffDistance - tr._nearZ) / zRange;
    const relativeCutoffFadeDistance = (effectiveCutoffDistance - clampedFadeRange - tr._nearZ) / zRange;

    return {
        shouldRenderCutoff: activation > 0.0,
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
