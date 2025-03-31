
import {describe, test, expect} from '../../util/vitest';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {ElevationFeature, ElevationFeatures, type Edge, type Range, type Vertex} from '../../../3d-style/elevation/elevation_feature';
// @ts-expect-error: Cannot find module
import vectorTileStubZ14 from '../../fixtures/elevation/14-8717-5683.mvt?arraybuffer';
// @ts-expect-error: Cannot find module
import vectorTileStubZ17 from '../../fixtures/elevation/17-69826-45367.mvt?arraybuffer';
import {vec2} from "gl-matrix";
import {CanonicalTileID} from '../../../src/source/tile_id';
import {HD_ELEVATION_SOURCE_LAYER} from '../../../3d-style/elevation/elevation_constants';
import Point from '@mapbox/point-geometry';

import type {Bounds} from '../../../3d-style/elevation/elevation_feature_parser';

interface ConstantFeature {
    id: number;
    height: number;
}

interface VaryingFeature {
    id: number;
    minHeight: number;
    maxHeight: number;
    edges: Array<Edge>;
}

function expand(...segments: Range[]): Array<Edge> {
    const result = new Array<Edge>();

    for (const segment of segments) {
        for (let i = segment.min; i < segment.max; i++) {
            result.push({a: i, b: i + 1});
        }
    }

    return result;
}

describe('ElevationFeature', () => {
    test('#boundsAndHeightRange', () => {
        const vertices: Vertex[] = [
            {position: vec2.fromValues(-10, 0), height: 0.0, extent: 1.0},
            {position: vec2.fromValues(0, -0.12), height: 5.0, extent: 1.0},
            {position: vec2.fromValues(1000, 10), height: -20.0, extent: 1.0},
            {position: vec2.fromValues(-1, 150), height: 10.0, extent: 1.0},
            {position: vec2.fromValues(50, 50), height: -2.0, extent: 1.0}
        ];

        const edges: Edge[] = [
            {a: 0, b: 1}, {a: 1, b: 2}, {a: 2, b: 3}, {a: 3, b: 4}
        ];

        const bounds: Bounds = {
            min: new Point(-10, -10),
            max: new Point(100, 10)
        };

        const id = 12345;

        const feature = new ElevationFeature(id, bounds, undefined, vertices, edges, 1.0);

        expect(feature.id).toBe(id);
        expect(feature.safeArea).toMatchObject(bounds);
        expect(feature.constantHeight).toBeUndefined();
        expect(feature.heightRange.min).toBe(-20.0);
        expect(feature.heightRange.max).toBe(10.0);
        expect(feature.edges).toHaveLength(5);
        expect(feature.vertices).toHaveLength(6);
    });

    test('#duplicateEdges', () => {
        const vertices: Vertex[] = [
            {position: vec2.fromValues(-10, 0), height: 1.0, extent: 1.0},
            {position: vec2.fromValues(0, -10), height: 2.0, extent: 1.0},
            {position: vec2.fromValues(0, -10), height: -3.0, extent: 1.0},
            {position: vec2.fromValues(20, 5), height: 4.0, extent: 1.0},
            {position: vec2.fromValues(30, 5), height: 5.0, extent: 1.0}
        ];

        const edges: Edge[] = [
            {a: 0, b: 1},
            {a: 1, b: 2},     // zero-length
            {a: 2, b: 3},
            {a: 2, b: 3},     // duplicate
            {a: 3, b: 4},
            {a: 4, b: 5}      // out-of-bounds
        ];

        const bounds: Bounds = {
            min: new Point(0, 0),
            max: new Point(0, 0)
        };

        const feature = new ElevationFeature(0, bounds, undefined, vertices, edges, 1.0);

        const expectedEdges: Edge[] = [
            {a: 0, b: 1},
            {a: 2, b: 3},
            {a: 2, b: 3},
            {a: 3, b: 4}
        ];

        expect(feature.edges).toMatchObject(expectedEdges);
    });

    test('#pointElevation', () => {
        const safeArea: Bounds = {
            min: new Point(0, 0),
            max: new Point(32, 32)
        };

        let vertices: Vertex[];
        let edges: Edge[];

        // Case 1: constant height
        const constantHeightFeature = new ElevationFeature(0, safeArea, 5.0);
        expect(constantHeightFeature.pointElevation(new Point(0, 0))).toBe(5.0);
        expect(constantHeightFeature.pointElevation(new Point(-1000, 256))).toBe(5.0);
        expect(constantHeightFeature.constantHeight).toBe(5.0);

        // Case 2: linear & straight line
        vertices = [
            {position: vec2.fromValues(-10.0, 0.0), height: 0.0, extent: 1.0},
            {position: vec2.fromValues(0.0, 0.0), height: 1.0, extent: 1.0},
            {position: vec2.fromValues(10.0, 0.0), height: 2.0, extent: 1.0},
        ];

        edges = [
            {a: 0, b: 1},
            {a: 1, b: 2}
        ];

        const feature = new ElevationFeature(0, safeArea, undefined, vertices, edges, 1.0);
        expect(feature.pointElevation(new Point(-10, 0))).toBeCloseTo(0.0, 5);
        expect(feature.pointElevation(new Point(-10, 10))).toBeCloseTo(0.0, 5);
        expect(feature.pointElevation(new Point(-20, 10))).toBeCloseTo(0.0, 5);
        expect(feature.pointElevation(new Point(0, 0))).toBeCloseTo(1.0, 5);
        expect(feature.pointElevation(new Point(0, -1))).toBeCloseTo(1.0, 5);
        expect(feature.pointElevation(new Point(10, 0))).toBeCloseTo(2.0, 5);
        expect(feature.pointElevation(new Point(10000, 0))).toBeCloseTo(2.0, 5);

        expect(feature.pointElevation(new Point(-5, 0))).toBeCloseTo(0.5, 5);
        expect(feature.pointElevation(new Point(2, 0))).toBeCloseTo(1.2, 5);

        // Case 3: Curved lines
        vertices = [
            {position: vec2.fromValues(0.0, 0.0), height: 0.0, extent: 1.0},
            {position: vec2.fromValues(4.0, 0.0), height: -1.0, extent: 1.0},
            {position: vec2.fromValues(4.0, 4.0), height: -3.0, extent: 1.0},
            {position: vec2.fromValues(0.0, 4.0), height: -4.0, extent: 1.0}
        ];

        edges = [
            {a: 0, b: 1},
            {a: 1, b: 2},
            {a: 2, b: 3}
        ];

        const curvedFeature = new ElevationFeature(0, safeArea, undefined, vertices, edges, 1.0);
        expect(curvedFeature.pointElevation(new Point(0, 0))).toBeCloseTo(0.0, 5);
        expect(curvedFeature.pointElevation(new Point(-4, 1))).toBeCloseTo(0.0, 5);
        expect(curvedFeature.pointElevation(new Point(2, 1))).toBeCloseTo(-0.64644, 4);
        expect(curvedFeature.pointElevation(new Point(6, -2))).toBeCloseTo(-1.0, 5);

        expect(curvedFeature.pointElevation(new Point(3, 2))).toBeCloseTo(-2.0, 5);
        expect(curvedFeature.pointElevation(new Point(8, 8))).toBeCloseTo(-3.0, 5);

        expect(curvedFeature.pointElevation(new Point(2, 3))).toBeCloseTo(-3.35355, 4);
        expect(curvedFeature.pointElevation(new Point(1, 6))).toBeCloseTo(-3.82322, 4);
        expect(curvedFeature.pointElevation(new Point(-1, 6))).toBeCloseTo(-4.0, 5);
    });

    test('#parseTileZ14', () => {
        // Load a fill feature from fixture tile.
        const vt = new VectorTile(new Protobuf(vectorTileStubZ14));
        const layer = vt.layers[HD_ELEVATION_SOURCE_LAYER];

        expect(layer).toBeDefined();
        expect(layer.length).equal(184);

        const tileID = new CanonicalTileID(14, 8717, 5683);

        const elevationFeatures = new Map<number, ElevationFeature>();
        for (const feature of ElevationFeatures.parseFrom(layer, tileID)) {
            elevationFeatures.set(feature.id, feature);
        }

        const expectedConstant: Array<ConstantFeature> = [
            {id: 3474545696571392, height: 5.0},
            {id: 3474545696571396, height: 5.0},
            {id: 3474545696571406, height: 10.0},
            {id: 3474545696571407, height: 5.0},
            {id: 3474545696571408, height: -5.0},
            {id: 3474545696571409, height: -5.0},
            {id: 3474545797234690, height: -5.0},
            {id: 3474545797234691, height: -5.0}
        ];

        const expectedVarying: Array<VaryingFeature> = [
            {id: 3474545696571393, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 13})},
            {id: 3474545696571394, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 13})},
            {id: 3474545696571395, minHeight: 0.0, maxHeight: 10.0, edges: expand({min: 0, max: 15})},
            {id: 3474545696571397, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 13})},
            {id: 3474545696571398, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 13})},
            {id: 3474545696571399, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 8})},
            {id: 3474545696571400, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 8})},
            {id: 3474545696571401, minHeight: -5.0, maxHeight: 0.0, edges: expand({min: 0, max: 8})},
            {id: 3474545696571402, minHeight: -5.0, maxHeight: 0.0, edges: expand({min: 0, max: 8})},
            {id: 3474545696571403, minHeight: 5.0, maxHeight: 10.0, edges: expand({min: 0, max: 5})},
            {id: 3474545696571404, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 4})},
            {id: 3474545696571405, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 4})}
        ];

        expect(expectedConstant.length + expectedVarying.length).toBe(elevationFeatures.size);

        for (const expected of expectedConstant) {
            const feature = elevationFeatures.get(expected.id);
            expect(feature).toBeDefined();
            expect(feature.constantHeight).toEqual(expected.height);
            expect(feature.edges).toHaveLength(0);
            expect(feature.vertices).toHaveLength(0);
            expect(feature.heightRange.min).toBeCloseTo(expected.height, 6);
            expect(feature.heightRange.max).toBeCloseTo(expected.height, 6);
        }

        for (const expected of expectedVarying) {
            const feature = elevationFeatures.get(expected.id);
            expect(feature).toBeDefined();
            expect(feature.constantHeight).toBeUndefined();
            expect(feature.edges).not.toHaveLength(0);
            expect(feature.vertices).not.toHaveLength(0);
            expect(feature.heightRange.min).toBeCloseTo(expected.minHeight, 6);
            expect(feature.heightRange.max).toBeCloseTo(expected.maxHeight, 6);
            expect(feature.edges).toMatchObject(expected.edges);
        }
    });

    test('#parseTileZ17', () => {
        // Load a fill feature from fixture tile.
        const vt = new VectorTile(new Protobuf(vectorTileStubZ17));
        const layer = vt.layers[HD_ELEVATION_SOURCE_LAYER];

        expect(layer).toBeDefined();
        expect(layer.length).equal(62);

        const tileID = new CanonicalTileID(17, 69826, 45367);

        const elevationFeatures = new Map<number, ElevationFeature>();
        for (const feature of ElevationFeatures.parseFrom(layer, tileID)) {
            elevationFeatures.set(feature.id, feature);
        }

        const expectedConstant: Array<ConstantFeature> = [
            {id: 3474537542844416, height: 5.0}
        ];

        const expectedVarying: Array<VaryingFeature> = [
            {id: 3474537542844419, minHeight: 3.339500, maxHeight: 5.0, edges: expand({min: 0, max: 4})},
            {id: 3474537542844421, minHeight: 0.269500, maxHeight: 5.0, edges: expand({min: 0, max: 3}, {min: 4, max: 9})},
            {id: 3474537542844424, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 3})},
            {id: 3474537542844427, minHeight: 0.0, maxHeight: 5.0, edges: expand({min: 0, max: 2})}
        ];

        expect(expectedConstant.length + expectedVarying.length).toBe(elevationFeatures.size);

        for (const expected of expectedConstant) {
            const feature = elevationFeatures.get(expected.id);
            expect(feature).toBeDefined();
            expect(feature.constantHeight).toEqual(expected.height);
            expect(feature.edges).toHaveLength(0);
            expect(feature.vertices).toHaveLength(0);
            expect(feature.heightRange.min).toBeCloseTo(expected.height, 6);
            expect(feature.heightRange.max).toBeCloseTo(expected.height, 6);
        }

        for (const expected of expectedVarying) {
            const feature = elevationFeatures.get(expected.id);
            expect(feature).toBeDefined();
            expect(feature.constantHeight).toBeUndefined();
            expect(feature.edges).not.toHaveLength(0);
            expect(feature.vertices).not.toHaveLength(0);
            expect(feature.heightRange.min).toBeCloseTo(expected.minHeight, 6);
            expect(feature.heightRange.max).toBeCloseTo(expected.maxHeight, 6);
            expect(feature.edges).toMatchObject(expected.edges);
        }
    });
});
