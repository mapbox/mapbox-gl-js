// @flow

import Context from '../gl/context.js';
import type {UniformLocations, UniformValues} from './uniform_binding.js';
import type {UnwrappedTileID} from '../source/tile_id.js';
import Painter from './painter.js';
import Fog from '../style/fog.js';
import {Uniform1f, Uniform2f, Uniform4f, UniformMatrix4f} from './uniform_binding.js';

export type FogUniformsType = {|
    'u_fog_matrix': UniformMatrix4f,
    'u_fog_range': Uniform2f,
    'u_fog_color': Uniform4f,
    'u_fog_horizon_blend': Uniform1f,
    'u_fog_temporal_offset': Uniform1f,

|};

export const fogUniforms = (context: Context, locations: UniformLocations): FogUniformsType => ({
    'u_fog_matrix': new UniformMatrix4f(context, locations.u_fog_matrix),
    'u_fog_range': new Uniform2f(context, locations.u_fog_range),
    'u_fog_color': new Uniform4f(context, locations.u_fog_color),
    'u_fog_horizon_blend': new Uniform1f(context, locations.u_fog_horizon_blend),
    'u_fog_temporal_offset': new Uniform1f(context, locations.u_fog_temporal_offset),
});

export const fogUniformValues = (
    painter: Painter,
    fog: Fog,
    tileID: ?UnwrappedTileID,
    fogOpacity: number
): UniformValues<FogUniformsType> => {
    const fogColor = fog.properties.get('color');
    const temporalOffset = (painter.frameCounter / 1000.0) % 1;
    const fogColorUnpremultiplied = [
        fogColor.r / fogColor.a,
        fogColor.g / fogColor.a,
        fogColor.b / fogColor.a,
        fogOpacity
    ];
    return {
        'u_fog_matrix': tileID ? painter.transform.calculateFogTileMatrix(tileID) : painter.identityMat,
        'u_fog_range': fog.getFovAdjustedRange(painter.transform._fov),
        'u_fog_color': fogColorUnpremultiplied,
        'u_fog_horizon_blend': fog.properties.get('horizon-blend'),
        'u_fog_temporal_offset': temporalOffset
    };
};
