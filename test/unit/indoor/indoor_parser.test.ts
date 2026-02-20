/* eslint-disable camelcase, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import {describe, test, expect} from '../../util/vitest';
import {parseActiveFloors} from '../../../src/render/indoor_parser';
import {CanonicalTileID} from '../../../src/source/tile_id';
import Actor from '../../../src/util/actor';

// Mock Actor
const mockTarget = {
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {}
};
const actor = new Actor(mockTarget as any, {} as any, 0);
actor.send = () => ({cancel: () => {}});

describe('IndoorParser', () => {
    test('parses buildings with center_lat and center_lon', () => {
        const feature = {
            properties: {
                type: 'structure',
                id: '123',
                name: 'Test Building',
                center_lat: 40.7128,
                center_lon: -74.0060
            },
            loadGeometry: () => []
        };

        const data = {
            layers: {
                'indoor-layer': {
                    length: 1,
                    feature: () => feature
                }
            }
        };

        const indoorTileOptions = {
            indoorState: {
                activeFloorsVisible: false,
                activeFloors: new Set(),
                selectedFloorId: ''
            },
            sourceLayers: new Set(['indoor-layer'])
        };

        let parsedData: any;
        actor.send = (type, data) => {
            if (type === 'setIndoorData') {
                parsedData = data;
            }
            return {cancel: () => {}};
        };

        parseActiveFloors(data as any, indoorTileOptions as any, actor, new CanonicalTileID(0, 0, 0));

        expect(parsedData).toBeDefined();
        expect(parsedData.buildings['123']).toBeDefined();
        expect(parsedData.buildings['123'].center).toEqual([-74.0060, 40.7128]);
    });

    test('parses floors with structure_ids', () => {
        const buildingFeature = {
            properties: {
                type: 'structure',
                id: '123',
                name: 'Test Building',
                center_lat: 40,
                center_lon: -74
            },
            loadGeometry: () => []
        };

        const floorFeature = {
            properties: {
                type: 'floor',
                id: 'f1',
                name: 'Floor 1',
                z_index: 0,
                structure_ids: '123;456'
            },
            loadGeometry: () => [[[{x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 10}, {x: 0, y: 10}, {x: 0, y: 0}]]]
        };

        const data = {
            layers: {
                'indoor-layer': {
                    length: 2,
                    feature: (index: number) => (index === 0 ? buildingFeature : floorFeature)
                }
            }
        };

        const indoorTileOptions = {
            indoorState: {
                activeFloorsVisible: false,
                activeFloors: new Set(),
                selectedFloorId: ''
            },
            sourceLayers: new Set(['indoor-layer'])
        };

        let parsedData: any;
        actor.send = (type, data) => {
            if (type === 'setIndoorData') {
                parsedData = data;
            }
            return {cancel: () => {}};
        };

        parseActiveFloors(data as any, indoorTileOptions as any, actor, new CanonicalTileID(0, 0, 0));

        expect(parsedData).toBeDefined();
        expect(parsedData.buildings['123'].floors['f1']).toBeDefined();
        expect(parsedData.buildings['123'].floors['f1'].buildings.has('123')).toBe(true);
        expect(parsedData.buildings['123'].floors['f1'].buildings.has('456')).toBe(true);
        expect(parsedData.buildings['456']).toBeDefined();
        expect(parsedData.buildings['456'].floors['f1']).toBeDefined();
    });
});
