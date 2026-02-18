
import {describe, test, expect} from '../../util/vitest';
import {vi} from 'vitest';
import {ViewportIntersectionStrategy} from '../../../src/style/indoor_building_detection';
import Point from '@mapbox/point-geometry';

import type {IndoorBuilding} from '../../../src/style/indoor_data';
import type {LngLatBounds, default as LngLat} from '../../../src/geo/lng_lat';

const mockLngLat = (lng: number, lat: number) => ({lng, lat});

const mockBounds = {
    contains: vi.fn(),
    getCenter: vi.fn(),
    getSouthWest: vi.fn(),
    getNorthEast: vi.fn(),
    isEmpty: vi.fn()
} as unknown as LngLatBounds;

describe('ViewportIntersectionStrategy', () => {
    const createStrategy = () => new ViewportIntersectionStrategy();

    const createBuilding = (id: string, center: [number, number], geometry?: GeoJSON.Geometry): IndoorBuilding => {
        const floors: Record<string, any> = {};
        const floorIds = new Set<string>();

        if (geometry) {
            const floorId = `${id}-f1`;
            floors[floorId] = {
                name: 'Floor 1',
                zIndex: 0,
                geometry
            };
            floorIds.add(floorId);
        } else {
            const floorId = `${id}-f1`;
            floors[floorId] = {
                name: 'Floor 1',
                zIndex: 0
            };
            floorIds.add(floorId);
        }

        return {
            center,
            floorIds,
            floors
        };
    };

    const createPolygon = (coords: number[][]): GeoJSON.Polygon => {
        return {
            type: 'Polygon',
            coordinates: [coords]
        };
    };

    const createViewportPolygon = (coords: number[][]): Point[] => {
        return coords.map(c => new Point(c[0], c[1]));
    };

    test('ReturnNullIfNoViewport', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [30, 30])
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds);
        expect(result).toBeNull();
    });

    test('RespectsViewportPolygon', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildingPoly = createPolygon([
            [29, 29], [31, 29], [31, 31], [29, 31], [29, 29]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [30, 30], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBeNull();
    });

    test('VisibleComplexGeometry', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildingPoly = createPolygon([
            [0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10], [0, 0]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [30, 30], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const viewport = createViewportPolygon([
            [8, 1], [11, 1], [11, 3], [8, 3], [8, 1]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('TouchingEdges', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildingPoly = createPolygon([
            [10, 10], [20, 10], [20, 20], [10, 20], [10, 10]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [15, 15], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const viewport = createViewportPolygon([
            [0, 0], [11, 0], [11, 30], [0, 30], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('BuildingInsideViewport', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildingPoly = createPolygon([
            [4, 4], [6, 4], [6, 6], [4, 6], [4, 4]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [5, 5], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('ViewportInsideBuilding', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildingPoly = createPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [5, 5], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const viewport = createViewportPolygon([
            [4, 4], [6, 4], [6, 6], [4, 6], [4, 4]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('Prioritizes visual proximity hysteresis', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const poly = createPolygon([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], poly),
            'B2': createBuilding('B2', [11, 11], poly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;

        const result1 = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, [new Point(0, 0)]);
        expect(result1).toBe('B1');

        // Simulating the hysteresis check for B1 vs B2 where B2 is slightly closer but within ratio
        const buildings2: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], poly),
            'B2': createBuilding('B2', [9.5, 9.5], poly)
        };

        const strategy2 = createStrategy();
        strategy2.findClosestBuilding({'B1': buildings2['B1']}, center, zoom, mockBounds, [new Point(0, 0)]);

        const result3 = strategy2.findClosestBuilding(buildings2, center, zoom, mockBounds, [new Point(0, 0)]);
        expect(result3).toBe('B1');

        // Move much closer to B2
        const buildings3: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [20, 20], poly),
            'B2': createBuilding('B2', [1, 1], poly)
        };
        const result4 = strategy2.findClosestBuilding(buildings3, center, zoom, mockBounds, [new Point(0, 0)]);
        expect(result4).toBe('B2');
    });

    test('RespectsMinZoom', () => {
        const strategy = createStrategy();
        const zoom = 15.9;
        const buildingPoly = createPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], buildingPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBeNull();
    });

    test('IgnoresBuildingsWithoutGeometry', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10])
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBeNull();
    });

    test('SupportsMultiPolygon', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const multiPoly: GeoJSON.MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
            ]]
        };

        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], multiPoly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
        expect(result).toBe('B1');
    });

    test('VisibleIfAnyFloorVisible', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const floor1Poly = createPolygon([[100, 100], [101, 100], [101, 101], [100, 101], [100, 100]]);
        const floor2Poly = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);

        const buildings: Record<string, IndoorBuilding> = {
            'B1': {
                center: [10, 10],
                floorIds: new Set(['f1', 'f2']),
                floors: {
                    'f1': {name: 'F1', zIndex: 0, geometry: floor1Poly},
                    'f2': {name: 'F2', zIndex: 1, geometry: floor2Poly}
                }
            }
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([
            [0, 0], [10, 0], [10, 10], [0, 10], [0, 0]
        ]);

        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('HysteresisKeepsLegacyIfCurrentVisibleAndNoOthers', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const poly = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], poly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);

        strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        const result = strategy.findClosestBuilding(buildings, center, zoom, mockBounds, viewport);
        expect(result).toBe('B1');
    });

    test('HysteresisSwitchesIfPreviousNotVisible', () => {
        const strategy = createStrategy();
        const zoom = 17;
        const poly = createPolygon([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
        const buildings: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], poly),
            'B2': createBuilding('B2', [20, 20], poly)
        };
        const center = mockLngLat(0, 0) as unknown as LngLat;
        const viewport = createViewportPolygon([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);

        strategy.findClosestBuilding({'B1': buildings['B1']}, center, zoom, mockBounds, viewport);

        // Set B1 to have non-intersecting geometry for the second check
        const buildingsMoved: Record<string, IndoorBuilding> = {
            'B1': createBuilding('B1', [10, 10], createPolygon([[100, 100], [101, 100], [101, 101], [100, 101], [100, 100]])),
            'B2': buildings['B2']
        };

        const result = strategy.findClosestBuilding(buildingsMoved, center, zoom, mockBounds, viewport);
        expect(result).toBe('B2');
    });
});
