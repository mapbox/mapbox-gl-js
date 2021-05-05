// @flow
import {vec3} from 'gl-matrix';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import {smoothstep} from '../util/util.js';
import type LngLat from '../geo/lng_lat.js';
import type {UnwrappedTileID} from '../source/tile_id.js';
import type Transform from '../geo/transform.js';

export const FOG_PITCH_START = 45;
export const FOG_PITCH_END = 65;
export const FOG_SYMBOL_CLIPPING_THRESHOLD = 0.9;

export type FogState = {
    range: [number, number],
    horizonBlend: number,
    alpha: number
};

// As defined in _prelude_fog.fragment.glsl#fog_opacity
export function getFogOpacity(state: FogState, pos: Array<number>, pitch: number, fov: number): number {
    const fogPitchOpacity = smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
    const [start, end] = getFovAdjustedFogRange(state, fov);

    // The output of this function must match _prelude_fog.fragment.glsl
    // For further details, refer to the implementation in the shader code
    const decay = 6;
    const depth = vec3.length(pos);
    const fogRange = (depth - start) / (end - start);
    let falloff = 1.0 - Math.min(1, Math.exp(-decay * fogRange));

    falloff *= falloff * falloff;
    falloff = Math.min(1.0, 1.00747 * falloff);

    return falloff * fogPitchOpacity * state.alpha;
}

export function getFovAdjustedFogRange(state: FogState, fov: number): [number, number] {
    // This function computes a shifted fog range so that the appearance is unchanged
    // when the fov changes. We define range=0 starting at the camera position given
    // the default fov. We avoid starting the fog range at the camera center so that
    // ranges aren't generally negative unless the FOV is modified.
    const shift = 0.5 / Math.tan(fov * 0.5);
    return [state.range[0] + shift, state.range[1] + shift];
}

export function getFogOpacityAtTileCoord(state: FogState, x: number, y: number, z: number, tileId: UnwrappedTileID, transform: Transform): number {
    const mat = transform.calculateFogTileMatrix(tileId);
    const pos = [x, y, z];
    vec3.transformMat4(pos, pos, mat);

    return getFogOpacity(state, pos, transform.pitch, transform._fov);
}

export function getFogOpacityAtLngLat(state: FogState, lngLat: LngLat, transform: Transform): number {
    const meters = MercatorCoordinate.fromLngLat(lngLat);
    const elevation = transform.elevation ? transform.elevation.getAtPointOrZero(meters) : 0;
    const pos = [meters.x, meters.y, elevation];
    vec3.transformMat4(pos, pos, transform.mercatorFogMatrix);

    return getFogOpacity(state, pos, transform.pitch, transform._fov);
}
