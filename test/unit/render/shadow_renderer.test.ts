/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, describe, waitFor, createMap} from '../../util/vitest';

const POLYGON = {
    type: 'Feature',
    properties: {},
    geometry: {type: 'Polygon', coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]]}
};

const LIGHTS = [
    {id: 'sun', type: 'directional', properties: {'cast-shadows': true, 'shadow-intensity': 1, direction: [210, 30]}},
    {id: 'env', type: 'ambient', properties: {intensity: 0.5}}
];

function styleWithCaster(features) {
    return {
        version: 8,
        sources: {
            geo: {type: 'geojson', data: {type: 'FeatureCollection', features}}
        },
        lights: LIGHTS,
        layers: [
            {id: 'extrusion', type: 'fill-extrusion', source: 'geo', paint: {'fill-extrusion-height': 20}}
        ]
    };
}

// A `model` source declares its models in the style
function styleWithModelSource(models) {
    return {
        version: 8,
        sources: {
            models: {type: 'model', models}
        },
        lights: LIGHTS,
        layers: [
            {id: 'model', type: 'model', source: 'models'}
        ]
    };
}

async function drewGroundShadows(style) {
    const map = createMap({zoom: 12, center: [0, 0], style});
    await waitFor(map, 'idle');
    return Object.values(map.painter.cache).some((program) => program.name === 'groundShadow');
}

function drewGroundShadowsForCaster(features) {
    return drewGroundShadows(styleWithCaster(features));
}

describe('ShadowRenderer', () => {
    test('no ground shadows are drawn when the caster layer has no geometry', async () => {
        expect(await drewGroundShadowsForCaster([])).toEqual(false);
    });

    test('ground shadows are drawn when the caster layer has geometry', async () => {
        expect(await drewGroundShadowsForCaster([POLYGON])).toEqual(true);
    });

    test('no ground shadows are drawn when a `model` source has no loaded models', async () => {
        expect(await drewGroundShadows(styleWithModelSource({}))).toEqual(false);
    });

    test('ground shadows are drawn when a `model` source has a loaded model', async () => {
        expect(await drewGroundShadows(styleWithModelSource({
            box: {uri: '/test/integration/models/BoxVertexColors.glb', position: [0, 0]}
        }))).toEqual(true);
    });
});
