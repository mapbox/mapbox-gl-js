// @flow
import {vec3} from 'gl-matrix';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import {smoothstep} from '../util/util.js';
import type LngLat from '../geo/lng_lat.js';
import type {UnwrappedTileID} from '../source/tile_id.js';
import type Transform from '../geo/transform.js';

export const FOG_PITCH_START = 55;
export const FOG_PITCH_END = 65;
export const FOG_SYMBOL_CLIPPING_THRESHOLD = 0.9;

export type FogState = {
    range: [number, number],
    density: number,
    skyBlend: number
};

// As defined in _prelude_fog.fragment.glsl#fog_sky_blending
export function queryFogSkyBlending(state: FogState, cameraDirection: Array<number>): number {
    const t = Math.max(0.0, cameraDirection[2] / state.skyBlend);
    return Math.exp(-3 * t * t);
}

// As defined in _prelude_fog.fragment.glsl#fog_opacity
export function getFogOpacity(state: FogState, pos: Array<number>, pitch: number): number {
    const fogOpacity = smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
    const [start, end] = state.range;
    const fogDensity = state.density;

    // The fog is not physically accurate, so we seek an expression which satisfies a
    // couple basic constraints:
    //   - opacity should be 0 at the near limit
    //   - opacity should be 1 at the far limit
    //   - the onset should have smooth derivatives to avoid a sharp band
    // To this end, we use an (1 - e^x)^n, where n is set to 3 to ensure the
    // function is C2 continuous at the onset. The fog is about 99% opaque at
    // the far limit, so we simply scale it and clip to achieve 100% opacity.
    // https://www.desmos.com/calculator/3taufutxid
    // The output of this function should match src/shaders/_prelude_fog.fragment.glsl
    const decay = 6;
    const depth = vec3.length(pos);
    const t = (depth - start) / (end - start);
    let falloff = 1.0 - Math.min(1, Math.exp(-decay * t));

    // Cube without pow()
    falloff *= falloff * falloff;

    // Scale and clip to 1 at the far limit
    falloff = Math.min(1.0, 1.00747 * falloff);

    // From src/render/painter.js via fog uniforms:
    const fogExponent = 12 * Math.pow(1 - fogDensity, 2);

    // Account for fog density
    falloff *= Math.pow(smoothstep(0, 1, t), fogExponent);

    const cameraDirection = vec3.scale(vec3.create(), pos, 1.0 / depth);
    falloff *= queryFogSkyBlending(state, cameraDirection);

    return falloff * fogOpacity;
}

export function getFogOpacityAtTileCoord(state: FogState, x: number, y: number, z: number, tileId: UnwrappedTileID, transform: Transform): number {
    const mat = transform.calculateFogTileMatrix(tileId);
    const pos = [x, y, z];
    vec3.transformMat4(pos, pos, mat);

    return getFogOpacity(state, pos, transform.pitch);
}

export function getFogOpacityAtLatLng(state: FogState, lngLat: LngLat, transform: Transform): number {
    const meters = MercatorCoordinate.fromLngLat(lngLat);
    const elevation = transform.elevation ? transform.elevation.getAtPointOrZero(meters) : 0;
    const pos = [meters.x, meters.y, elevation];
    vec3.transformMat4(pos, pos, transform.mercatorFogMatrix);

    return getFogOpacity(state, pos, transform.pitch);
}
