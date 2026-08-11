import {
    Uniform1f,
    Uniform3f,
    Uniform4f,
} from '../render/uniform_binding';

import type Context from '../gl/context';
import type {UniformValues} from '../render/uniform_binding';
import type {NonPremultipliedRenderColor} from '../style-spec/util/color';

export type AtmosphereUniformsType = {
    ['u_frustum_tl']: Uniform3f;
    ['u_frustum_tr']: Uniform3f;
    ['u_frustum_br']: Uniform3f;
    ['u_frustum_bl']: Uniform3f;
    ['u_horizon']: Uniform1f;
    ['u_transition']: Uniform1f;
    ['u_fadeout_range']: Uniform1f;
    ['u_atmosphere_fog_color']: Uniform4f;
    ['u_high_color']: Uniform4f;
    ['u_space_color']: Uniform4f;
    ['u_temporal_offset']: Uniform1f;
    ['u_horizon_angle']: Uniform1f;
};

export const atmosphereUniforms = (context: Context): AtmosphereUniformsType => ({
    'u_frustum_tl': new Uniform3f(context),
    'u_frustum_tr': new Uniform3f(context),
    'u_frustum_br': new Uniform3f(context),
    'u_frustum_bl': new Uniform3f(context),
    'u_horizon': new Uniform1f(context),
    'u_transition': new Uniform1f(context),
    'u_fadeout_range': new Uniform1f(context),
    'u_atmosphere_fog_color': new Uniform4f(context),
    'u_high_color': new Uniform4f(context),
    'u_space_color': new Uniform4f(context),
    'u_temporal_offset': new Uniform1f(context),
    'u_horizon_angle': new Uniform1f(context),
});

export const atmosphereUniformValues = (
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    horizon: number,
    transitionT: number,
    fadeoutRange: number,
    atmosphereFogColor: NonPremultipliedRenderColor,
    highColor: NonPremultipliedRenderColor,
    spaceColor: NonPremultipliedRenderColor,
    temporalOffset: number,
    horizonAngle: number,
): UniformValues<AtmosphereUniformsType> => ({
    'u_frustum_tl': frustumDirTl,
    'u_frustum_tr': frustumDirTr,
    'u_frustum_br': frustumDirBr,
    'u_frustum_bl': frustumDirBl,
    'u_horizon': horizon,
    'u_transition': transitionT,
    'u_fadeout_range': fadeoutRange,
    'u_atmosphere_fog_color': atmosphereFogColor.toArray01(),
    'u_high_color': highColor.toArray01(),
    'u_space_color': spaceColor.toArray01(),
    'u_temporal_offset': temporalOffset,
    'u_horizon_angle': horizonAngle
});
