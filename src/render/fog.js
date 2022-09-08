// @flow

import Context from '../gl/context.js';
import type {UniformValues} from './uniform_binding.js';
import type {UnwrappedTileID} from '../source/tile_id.js';
import Painter from './painter.js';
import Fog from '../style/fog.js';
import {Uniform1f, Uniform1i, Uniform2f, Uniform3f, Uniform4f, UniformMatrix4f} from './uniform_binding.js';
import {globeToMercatorTransition} from '../geo/projection/globe_util.js';

export type FogUniformsType = {|
    'u_fog_matrix': UniformMatrix4f,
    'u_fog_range': Uniform2f,
    'u_fog_color': Uniform4f,
    'u_fog_horizon_blend': Uniform1f,
    'u_fog_temporal_offset': Uniform1f,
    'u_frustum_tl': Uniform3f,
    'u_frustum_tr': Uniform3f,
    'u_frustum_br': Uniform3f,
    'u_frustum_bl': Uniform3f,
    'u_globe_pos': Uniform3f,
    'u_globe_radius': Uniform1f,
    'u_globe_transition': Uniform1f,
    'u_is_globe': Uniform1i,
    'u_viewport': Uniform2f,
|};

export const fogUniforms = (context: Context): FogUniformsType => ({
    'u_fog_matrix': new UniformMatrix4f(context),
    'u_fog_range': new Uniform2f(context),
    'u_fog_color': new Uniform4f(context),
    'u_fog_horizon_blend': new Uniform1f(context),
    'u_fog_temporal_offset': new Uniform1f(context),
    'u_frustum_tl': new Uniform3f(context),
    'u_frustum_tr': new Uniform3f(context),
    'u_frustum_br': new Uniform3f(context),
    'u_frustum_bl': new Uniform3f(context),
    'u_globe_pos': new Uniform3f(context),
    'u_globe_radius': new Uniform1f(context),
    'u_globe_transition': new Uniform1f(context),
    'u_is_globe': new Uniform1i(context),
    'u_viewport': new Uniform2f(context)
});

export const fogUniformValues = (
    painter: Painter,
    fog: Fog,
    tileID: ?UnwrappedTileID,
    fogOpacity: number,
    frustumDirTl: [number, number, number],
    frustumDirTr: [number, number, number],
    frustumDirBr: [number, number, number],
    frustumDirBl: [number, number, number],
    globePosition: [number, number, number],
    globeRadius: number,
    viewport: [number, number]
): UniformValues<FogUniformsType> => {
    const tr = painter.transform;
    const fogColor = fog.properties.get('color').toArray01();
    fogColor[3] = fogOpacity; // Update Alpha
    const temporalOffset = (painter.frameCounter / 1000.0) % 1;
    return {
        'u_fog_matrix': tileID ? tr.calculateFogTileMatrix(tileID) : painter.identityMat,
        'u_fog_range': fog.getFovAdjustedRange(tr._fov),
        'u_fog_color': fogColor,
        'u_fog_horizon_blend': fog.properties.get('horizon-blend'),
        'u_fog_temporal_offset': temporalOffset,
        'u_frustum_tl': frustumDirTl,
        'u_frustum_tr': frustumDirTr,
        'u_frustum_br': frustumDirBr,
        'u_frustum_bl': frustumDirBl,
        'u_globe_pos': globePosition,
        'u_globe_radius': globeRadius,
        'u_viewport': viewport,
        'u_globe_transition': globeToMercatorTransition(tr.zoom),
        'u_is_globe': +(tr.projection.name === 'globe')
    };
};
