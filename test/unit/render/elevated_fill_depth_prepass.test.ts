/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, describe, vi, waitFor, createMap} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';

const POLYGON = {
    type: 'Feature',
    properties: {},
    geometry: {type: 'Polygon', coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]]}
};

const LIGHTS = [
    {id: 'sun', type: 'directional', properties: {'cast-shadows': true, 'shadow-intensity': 1, direction: [210, 30]}},
    {id: 'env', type: 'ambient', properties: {intensity: 0.5}}
];

const HD_ROAD = {id: 'road', type: 'fill', source: 'geo', layout: {'fill-elevation-reference': 'hd-road-base'}, paint: {}};

// The HD runtime chunk (which defines the elevated-fill draw functions) loads lazily once a layer
// declares `fill-elevation-reference`. Wait for it, or the draw pass never runs and the assertion
// is vacuous.
async function waitForHD() {
    await vi.waitUntil(() => HD.loaded === true, {timeout: 3000, interval: 20});
}

// A geojson source produces no `elevatedStructures`, so the depth pass draws nothing and its
// `elevatedStructuresDepthReconstruct` program must never be linked.
async function depthProgramLinked(style) {
    const map = createMap({zoom: 16, center: [0, 0], style});
    await waitFor(map, 'idle');
    await waitForHD();
    // Force a frame after the HD chunk has loaded, so the depth pass actually runs.
    map.triggerRepaint();
    await waitFor(map, 'idle');
    return Object.values(map.painter.cache).some((program) => program.name === 'elevatedStructuresDepthReconstruct');
}

describe('elevated fill depth program', () => {
    // Guards the drawDepthPrepass path (runs without shadows).
    test('not linked without elevated geometry, no shadows', async () => {
        expect(await depthProgramLinked({
            version: 8,
            sources: {geo: {type: 'geojson', data: {type: 'FeatureCollection', features: [POLYGON]}}},
            layers: [HD_ROAD]
        })).toBe(false);
    });

    // Guards the drawGroundShadowMask path (runs only with shadows + a caster).
    test('not linked without elevated geometry, with shadows', async () => {
        expect(await depthProgramLinked({
            version: 8,
            lights: LIGHTS,
            sources: {geo: {type: 'geojson', data: {type: 'FeatureCollection', features: [POLYGON]}}},
            layers: [HD_ROAD, {id: 'buildings', type: 'fill-extrusion', source: 'geo', paint: {'fill-extrusion-height': 20}}]
        })).toBe(false);
    });
});
