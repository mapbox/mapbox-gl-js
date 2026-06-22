// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import Point from '@mapbox/point-geometry';
import {CanonicalTileID} from '../../../src/source/tile_id';
import EXTENT from '../../../src/style-spec/data/extent';
import {
    featureFrcLevel,
    isFeatureCoveredByFrcMask,
    matchesCoverageSourceLayer,
} from '../../../3d-style/data/frc_road_classes';
import {FrcCoveragePolygon} from '../../../src/source/frc_coverage_snapshot';
import {FrcCoverageSnapshot, combinedFrcMask} from '../../../3d-style/source/frc_coverage_snapshot';
import {FrcCoverageManager} from '../../../3d-style/source/frc_coverage_manager';
import {parseFrcCoverageFromLayer} from '../../../3d-style/source/frc_coverage_parser';
import {symbolAnchorInFrcCoverage} from '../../../3d-style/symbol/frc_symbol_filter';
import {frcCoverageFadeFactor} from '../../../3d-style/render/draw_frc_coverage';
import {FrcSegmentData, buildFrcLevelSegments} from '../../../3d-style/data/frc_segment_builder';
import {TriangleIndexArray} from '../../../src/data/array_types';
import SegmentVector from '../../../src/data/segment';
import {updateFrcCoverageFadeRange} from '../../../3d-style/style/frc_coverage_eager';

// Convenience: build a polygon covering the entire tile (5-point closed ring around [0,EXTENT]).
function fullTileRing(): Array<Point> {
    return [
        new Point(0, 0),
        new Point(EXTENT, 0),
        new Point(EXTENT, EXTENT),
        new Point(0, EXTENT),
        new Point(0, 0),
    ];
}

// Square polygon at the given corner, inset by `inset` so it sits strictly inside the tile.
function squareRing(x0: number, y0: number, size: number): Array<Point> {
    return [
        new Point(x0, y0),
        new Point(x0 + size, y0),
        new Point(x0 + size, y0 + size),
        new Point(x0, y0 + size),
        new Point(x0, y0),
    ];
}

describe('frc_road_classes', () => {
    describe('featureFrcLevel', () => {
        test('maps known road classes to expected FRC levels', () => {
            expect(featureFrcLevel({class: 'motorway'})).toBe(0);
            expect(featureFrcLevel({class: 'trunk'})).toBe(1);
            expect(featureFrcLevel({class: 'primary'})).toBe(2);
            expect(featureFrcLevel({class: 'secondary'})).toBe(3);
            expect(featureFrcLevel({class: 'tertiary'})).toBe(4);
            expect(featureFrcLevel({class: 'unclassified'})).toBe(5);
            expect(featureFrcLevel({class: 'street'})).toBe(6);
            expect(featureFrcLevel({class: 'service'})).toBe(7);
            expect(featureFrcLevel({class: 'pedestrian'})).toBe(8);
        });

        test('link variants share the parent class FRC level', () => {
            expect(featureFrcLevel({class: 'motorway_link'})).toBe(0);
            expect(featureFrcLevel({class: 'trunk_link'})).toBe(1);
            expect(featureFrcLevel({class: 'primary_link'})).toBe(2);
        });

        test('unknown class returns null', () => {
            expect(featureFrcLevel({class: 'aeroway'})).toBeNull();
        });

        test('non-string class returns null', () => {
            expect(featureFrcLevel({class: 7})).toBeNull();
        });

        test('missing class returns null', () => {
            expect(featureFrcLevel({})).toBeNull();
        });

        test('incident_class used as fallback when class is absent', () => {
            expect(featureFrcLevel({'incident_class': 'motorway'})).toBe(0);
            expect(featureFrcLevel({'incident_class': 'primary'})).toBe(2);
        });

        test('class takes precedence over incident_class', () => {
            expect(featureFrcLevel({'class': 'motorway', 'incident_class': 'service'})).toBe(0);
        });

        test('unknown incident_class returns null', () => {
            expect(featureFrcLevel({'incident_class': 'aeroway'})).toBeNull();
        });
    });

    describe('isFeatureCoveredByFrcMask', () => {
        test('returns true when feature FRC bit is set in mask', () => {
            expect(isFeatureCoveredByFrcMask({class: 'motorway'}, 0b1)).toBe(true);
            expect(isFeatureCoveredByFrcMask({class: 'trunk'}, 0b10)).toBe(true);
        });

        test('returns false when feature FRC bit is not set', () => {
            expect(isFeatureCoveredByFrcMask({class: 'motorway'}, 0b10)).toBe(false);
        });

        test('returns false for unknown class regardless of mask', () => {
            expect(isFeatureCoveredByFrcMask({class: 'unknown'}, 0xff)).toBe(false);
        });

        test('frcMask=0 yields false for all known classes', () => {
            expect(isFeatureCoveredByFrcMask({class: 'motorway'}, 0)).toBe(false);
            expect(isFeatureCoveredByFrcMask({class: 'tertiary'}, 0)).toBe(false);
        });

        test('multi-level mask covers each bit independently', () => {
            const mask = 0b111; // FRC 0,1,2
            expect(isFeatureCoveredByFrcMask({class: 'motorway'}, mask)).toBe(true);
            expect(isFeatureCoveredByFrcMask({class: 'trunk'}, mask)).toBe(true);
            expect(isFeatureCoveredByFrcMask({class: 'primary'}, mask)).toBe(true);
            expect(isFeatureCoveredByFrcMask({class: 'secondary'}, mask)).toBe(false);
        });

        test('incident_class fallback works in coverage check', () => {
            expect(isFeatureCoveredByFrcMask({'incident_class': 'motorway'}, 0b1)).toBe(true);
            expect(isFeatureCoveredByFrcMask({'incident_class': 'motorway'}, 0b10)).toBe(false);
        });
    });

    describe('matchesCoverageSourceLayer', () => {
        test('bare "road" entry matches any source with sourceLayer "road"', () => {
            expect(matchesCoverageSourceLayer(['road'], 'any-source', 'road')).toBe(true);
            expect(matchesCoverageSourceLayer(['road'], 'other', 'road')).toBe(true);
        });

        test('bare entry does NOT match a different sourceLayer', () => {
            expect(matchesCoverageSourceLayer(['road'], 'src', 'structure')).toBe(false);
        });

        test('"(source)layer" matches only the named source and layer', () => {
            expect(matchesCoverageSourceLayer(['(sd-traffic)traffic'], 'sd-traffic', 'traffic')).toBe(true);
        });

        test('"(source)layer" rejects a different source', () => {
            expect(matchesCoverageSourceLayer(['(sd-traffic)traffic'], 'composite', 'traffic')).toBe(false);
        });

        test('"(source)layer" rejects a different layer', () => {
            expect(matchesCoverageSourceLayer(['(sd-traffic)traffic'], 'sd-traffic', 'road')).toBe(false);
        });

        test('malformed entry (missing closing paren) is skipped', () => {
            expect(matchesCoverageSourceLayer(['(broken'], 'any', 'any')).toBe(false);
        });

        test('empty entries array returns false', () => {
            expect(matchesCoverageSourceLayer([], 'src', 'road')).toBe(false);
        });
    });
});

describe('FrcCoveragePolygon', () => {
    test('hasGeometry true when rings have points', () => {
        const poly = new FrcCoveragePolygon(0b1, [squareRing(100, 100, 1000)]);
        expect(poly.hasGeometry()).toBe(true);
    });

    test('hasGeometry false when rings empty', () => {
        const poly = new FrcCoveragePolygon(0b1, []);
        expect(poly.hasGeometry()).toBe(false);
    });
});

describe('FrcCoverageSnapshot', () => {
    test('getTile returns the tile when tileId matches exactly', () => {
        const tile = {tileId: new CanonicalTileID(14, 8796, 5373), polygons: [], frcMask: 0b1};
        const snap = new FrcCoverageSnapshot([tile]);
        expect(snap.getTile(new CanonicalTileID(14, 8796, 5373))).toBe(tile);
    });

    test('getTile returns null when no match', () => {
        const snap = new FrcCoverageSnapshot([]);
        expect(snap.getTile(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('getTileOrParent finds the exact tile', () => {
        const tile = {tileId: new CanonicalTileID(14, 8796, 5373), polygons: [], frcMask: 0b1};
        const snap = new FrcCoverageSnapshot([tile]);
        expect(snap.getTileOrParent(new CanonicalTileID(14, 8796, 5373))).toBe(tile);
    });

    test('getTileOrParent falls back to parent tile (z-1)', () => {
        const parent = {tileId: new CanonicalTileID(13, 4398, 2686), polygons: [], frcMask: 0b1};
        const snap = new FrcCoverageSnapshot([parent]);
        expect(snap.getTileOrParent(new CanonicalTileID(14, 8796, 5373))).toBe(parent);
    });

    test('getTileOrParent falls back to grandparent (z-2)', () => {
        const grand = {tileId: new CanonicalTileID(12, 2199, 1343), polygons: [], frcMask: 0b1};
        const snap = new FrcCoverageSnapshot([grand]);
        expect(snap.getTileOrParent(new CanonicalTileID(14, 8796, 5373))).toBe(grand);
    });

    test('getTileOrParent returns null when nothing matches', () => {
        const snap = new FrcCoverageSnapshot([
            {tileId: new CanonicalTileID(14, 1, 1), polygons: [], frcMask: 0b1},
        ]);
        expect(snap.getTileOrParent(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('getTileOrParent skips tiles with frcMask=0', () => {
        const parent = {tileId: new CanonicalTileID(13, 4398, 2686), polygons: [], frcMask: 0};
        const snap = new FrcCoverageSnapshot([parent]);
        expect(snap.getTileOrParent(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('getFullCoverageMask: child fully inside a full-tile polygon → polygon frcMask', () => {
        const poly = new FrcCoveragePolygon(0b101, []); // full tile, FRC 0 + 2
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(13, 4398, 2686), polygons: [poly], frcMask: 0b101}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBe(0b101);
    });

    test('getFullCoverageMask: partial polygon containing child quad → mask', () => {
        // Parent z=13 covers child z=14, x%2=0, y%2=1 → child quad is (0,EXTENT/2)..(EXTENT/2,EXTENT).
        // The containment check is strict (vertices ON the rect boundary fail), so use a polygon
        // whose vertices are all OUTSIDE the child rect with a small margin.
        const partialRing = [
            new Point(-100, EXTENT / 2 - 100),
            new Point(EXTENT / 2 + 100, EXTENT / 2 - 100),
            new Point(EXTENT / 2 + 100, EXTENT + 100),
            new Point(-100, EXTENT + 100),
            new Point(-100, EXTENT / 2 - 100),
        ];
        const poly = new FrcCoveragePolygon(0b10, [partialRing]);
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(13, 4398, 2686), polygons: [poly], frcMask: 0b10}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBe(0b10);
    });

    test('getFullCoverageMask: partial polygon that misses the child quad → null', () => {
        // Same setup, but polygon is in the OPPOSITE quadrant.
        const poly = new FrcCoveragePolygon(0b10, [squareRing(EXTENT / 2, 0, EXTENT / 2)]);
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(13, 4398, 2686), polygons: [poly], frcMask: 0b10}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('getFullCoverageMask: multi-polygon ORs masks of all polygons that contain child', () => {
        const fullA = new FrcCoveragePolygon(0b1, []);   // full-tile FRC 0
        const fullB = new FrcCoveragePolygon(0b100, []); // full-tile FRC 2
        const miss = new FrcCoveragePolygon(0b1000, [squareRing(EXTENT - 100, EXTENT - 100, 50)]); // tiny far corner
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(13, 4398, 2686), polygons: [fullA, fullB, miss], frcMask: 0b1101}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBe(0b101);
    });

    test('getFullCoverageMask: coverage tile with frcMask=0 returns null', () => {
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(13, 4398, 2686), polygons: [], frcMask: 0}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('getFullCoverageMask: child at same zoom with only partial polygons → null', () => {
        // dz === 0 → partial-polygon containment branch short-circuits, only full-tile counts.
        const poly = new FrcCoveragePolygon(0b1, [squareRing(0, 0, EXTENT)]);
        const snap = new FrcCoverageSnapshot([{tileId: new CanonicalTileID(14, 8796, 5373), polygons: [poly], frcMask: 0b1}]);
        expect(snap.getFullCoverageMask(new CanonicalTileID(14, 8796, 5373))).toBeNull();
    });

    test('equals: same tiles → true, different → false', () => {
        const t1 = {tileId: new CanonicalTileID(14, 1, 1), polygons: [], frcMask: 0b1};
        const t2 = {tileId: new CanonicalTileID(14, 2, 2), polygons: [], frcMask: 0b1};
        const snap = new FrcCoverageSnapshot([t1, t2]);

        expect(snap.equals([t1, t2])).toBe(true);
        expect(snap.equals([t1])).toBe(false);
        expect(snap.equals([t1, {tileId: new CanonicalTileID(14, 3, 3), polygons: [], frcMask: 0b1}])).toBe(false);
        expect(snap.equals([t1, {tileId: new CanonicalTileID(14, 2, 2), polygons: [], frcMask: 0b10}])).toBe(false);
    });

    test('empty', () => {
        expect(new FrcCoverageSnapshot([]).empty()).toBe(true);
        expect(new FrcCoverageSnapshot([{tileId: new CanonicalTileID(14, 0, 0), polygons: [], frcMask: 0}]).empty()).toBe(false);
    });
});

describe('FrcCoverageManager', () => {
    test('empty manager → empty snapshot', () => {
        const m = new FrcCoverageManager();
        const s = m.updateSnapshotIfNeeded();
        expect(s.empty()).toBe(true);
    });

    test('addTileCoverage then update → snapshot contains tile', () => {
        const m = new FrcCoverageManager();
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5373), [new FrcCoveragePolygon(0b1, [])]);
        const s = m.updateSnapshotIfNeeded();
        expect(s.tiles.length).toBe(1);
        expect(s.tiles[0].frcMask).toBe(0b1);
    });

    test('same data twice → returns same snapshot object (no realloc)', () => {
        const m = new FrcCoverageManager();
        const poly = new FrcCoveragePolygon(0b1, []);
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5373), [poly]);
        const s1 = m.updateSnapshotIfNeeded();
        m.clear();
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5373), [poly]);
        const s2 = m.updateSnapshotIfNeeded();
        expect(s1).toBe(s2);
    });

    test('changed data → new snapshot object', () => {
        const m = new FrcCoverageManager();
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5373), [new FrcCoveragePolygon(0b1, [])]);
        const s1 = m.updateSnapshotIfNeeded();
        m.clear();
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5374), [new FrcCoveragePolygon(0b1, [])]);
        const s2 = m.updateSnapshotIfNeeded();
        expect(s1).not.toBe(s2);
    });

    test('clear + update → empty snapshot', () => {
        const m = new FrcCoverageManager();
        m.addTileCoverage(new CanonicalTileID(14, 8796, 5373), [new FrcCoveragePolygon(0b1, [])]);
        m.updateSnapshotIfNeeded();
        m.clear();
        const s = m.updateSnapshotIfNeeded();
        expect(s.empty()).toBe(true);
    });

    test('combinedFrcMask ORs polygon masks', () => {
        const polys = [
            new FrcCoveragePolygon(0b001, []),
            new FrcCoveragePolygon(0b100, []),
            new FrcCoveragePolygon(0b010, []),
        ];
        expect(combinedFrcMask(polys)).toBe(0b111);
    });
});

describe('parseFrcCoverageFromLayer', () => {
    function makeLayer(features) {
        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            length: features.length,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            feature(i) { return features[i]; },
        };
    }

    function feature(frcMask, rings) {
        return {
            // eslint-disable-next-line camelcase, @typescript-eslint/no-unsafe-assignment
            properties: {frc_mask: frcMask},
            loadGeometry() { return rings; },
        };
    }

    test('partial polygon → FrcCoveragePolygon with rings', () => {
        const ring = squareRing(100, 100, 1000);
        const result = parseFrcCoverageFromLayer(makeLayer([feature(0b1, [ring])]));
        expect(result.length).toBe(1);
        expect(result[0].frcMask).toBe(1);
        expect(result[0].rings.length).toBe(1);
        expect(result[0].rings[0].length).toBe(5);
    });

    test('full-tile 5-point bbox detected → rings=[] (hasGeometry false)', () => {
        const result = parseFrcCoverageFromLayer(makeLayer([feature(0b1, [fullTileRing()])]));
        expect(result.length).toBe(1);
        expect(result[0].hasGeometry()).toBe(false);
    });

    test('missing frc_mask → skipped', () => {
        const f = {properties: {}, loadGeometry() { return [squareRing(0, 0, 100)]; }};
        expect(parseFrcCoverageFromLayer(makeLayer([f])).length).toBe(0);
    });

    test('frc_mask=0 → skipped', () => {
        const result = parseFrcCoverageFromLayer(makeLayer([feature(0, [squareRing(0, 0, 100)])]));
        expect(result.length).toBe(0);
    });

    test('neighbor tile feature (coord outside [0,EXTENT]) → skipped', () => {
        const neighborRing = [
            new Point(EXTENT + 10, 100),
            new Point(EXTENT + 200, 100),
            new Point(EXTENT + 200, 300),
            new Point(EXTENT + 10, 300),
            new Point(EXTENT + 10, 100),
        ];
        expect(parseFrcCoverageFromLayer(makeLayer([feature(0b1, [neighborRing])])).length).toBe(0);
    });

    test('multiple features → multiple entries', () => {
        const r1 = squareRing(0, 0, 100);
        const r2 = squareRing(200, 200, 100);
        const result = parseFrcCoverageFromLayer(makeLayer([feature(0b1, [r1]), feature(0b10, [r2])]));
        expect(result.length).toBe(2);
        expect(result[0].frcMask).toBe(1);
        expect(result[1].frcMask).toBe(2);
    });

    test('empty layer → []', () => {
        expect(parseFrcCoverageFromLayer(makeLayer([])).length).toBe(0);
    });
});

describe('symbolAnchorInFrcCoverage', () => {
    const canonical = new CanonicalTileID(14, 8796, 5373);

    test('anchor inside polygon with matching FRC → true', () => {
        const poly = new FrcCoveragePolygon(0b1, [squareRing(1000, 1000, 2000)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 2000, y: 2000}, canonical, 14)).toBe(true);
    });

    test('anchor outside polygon → false', () => {
        const poly = new FrcCoveragePolygon(0b1, [squareRing(1000, 1000, 2000)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 5000, y: 5000}, canonical, 14)).toBe(false);
    });

    test('frcMask does not cover this FRC level → false', () => {
        // motorway is FRC 0 (bit 0), mask covers only FRC 1
        const poly = new FrcCoveragePolygon(0b10, [squareRing(1000, 1000, 2000)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 2000, y: 2000}, canonical, 14)).toBe(false);
    });

    test('unknown road class → false (frc null)', () => {
        const poly = new FrcCoveragePolygon(0xff, [squareRing(1000, 1000, 2000)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'unknown'}, {x: 2000, y: 2000}, canonical, 14)).toBe(false);
    });

    test('full-tile polygon (rings=[]) is not matched by anchor-in-polygon path', () => {
        const poly = new FrcCoveragePolygon(0b1, []);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 0, y: 0}, canonical, 14)).toBe(false);
    });

    test('anchor scaled from child zoom into parent coverage tile (dz=1)', () => {
        // Child canonical = (14, 8796, 5373). Parent = (13, 4398, 2686).
        // (8796 & 1, 5373 & 1) = (0, 1) → child's bottom-left occupies parent quadrant (0, EXTENT/2).
        // Anchor (x=1000, y=1000) maps to parent coords ((1000/2)+0, (1000/2)+EXTENT/2) = (500, 4596).
        // Place polygon covering that point.
        const poly = new FrcCoveragePolygon(0b1, [squareRing(400, 4500, 300)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 1000, y: 1000}, canonical, 13)).toBe(true);
    });

    test('anchor scaled from child zoom into grandparent coverage tile (dz=2)', () => {
        // child=(14, 8796, 5373), grandparent=(12, 2199, 1343).
        // (8796 % 4, 5373 % 4) = (0, 1) → child sits in row 1 of the 4×4 grid inside the grandparent.
        // Anchor (4000, 4000) in child coords → grandparent ((4000/4)+0, (4000/4)+EXTENT/4)
        //   = (1000, 1000 + 2048) = (1000, 3048).
        const poly = new FrcCoveragePolygon(0b1, [squareRing(900, 2900, 300)]);
        expect(symbolAnchorInFrcCoverage([poly], {class: 'motorway'}, {x: 4000, y: 4000}, canonical, 12)).toBe(true);
    });

    test('multiple polygons: true if anchor is inside ANY polygon with matching mask', () => {
        const miss = new FrcCoveragePolygon(0b1, [squareRing(5000, 5000, 500)]);
        const hit = new FrcCoveragePolygon(0b1, [squareRing(1000, 1000, 2000)]);
        expect(symbolAnchorInFrcCoverage([miss, hit], {class: 'motorway'}, {x: 2000, y: 2000}, canonical, 14)).toBe(true);
    });
});

describe('frcCoverageFadeFactor', () => {
    function mkPainter(zoom: number, fadeRange: [number, number] | null) {
        return {transform: {zoom}, frcCoverageFadeRange: fadeRange};
    }

    test('null fadeRange → 0', () => {
        expect(frcCoverageFadeFactor(mkPainter(15, null))).toBe(0);
    });

    test('zoom below range → 1.0 (fully faded)', () => {
        expect(frcCoverageFadeFactor(mkPainter(13, [14, 15]))).toBe(1);
    });

    test('zoom above range → 0.0 (no fade)', () => {
        expect(frcCoverageFadeFactor(mkPainter(16, [14, 15]))).toBe(0);
    });

    test('zoom mid-range → interpolated', () => {
        // zoom 14.5, range [14,15] → t=0.5 → 1-0.5 = 0.5
        expect(frcCoverageFadeFactor(mkPainter(14.5, [14, 15]))).toBeCloseTo(0.5);
    });

    test('equal min/max → 0 (divide-by-zero guard)', () => {
        expect(frcCoverageFadeFactor(mkPainter(14, [14, 14]))).toBe(0);
    });
});

describe('buildFrcLevelSegments', () => {
    function makeTriangles(count: number): TriangleIndexArray {
        const a = new TriangleIndexArray();
        for (let i = 0; i < count; i++) {
            // Distinct triple per triangle so we can tell groups apart after reorder.
            a.emplaceBack(i * 3, i * 3 + 1, i * 3 + 2);
        }
        return a;
    }

    function makeSegments(vertexLength: number, primitiveLength: number): SegmentVector {
        return new SegmentVector([{
            vertexOffset: 0,
            primitiveOffset: 0,
            vertexLength,
            primitiveLength,
            vaos: {},
            sortKey: undefined,
        }]);
    }

    test('no-op when frcCoverage is empty', () => {
        const data = new FrcSegmentData();
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        const tris = makeTriangles(1);
        const before = Array.from(tris.uint16.slice(0, 3));
        buildFrcLevelSegments(data, tris, makeSegments(3, 1));
        expect(Array.from(tris.uint16.slice(0, 3))).toEqual(before);
        expect(data.frcPerLevel.size).toBe(0);
    });

    test('all features same FRC → single frcPerLevel entry, no non-road segments', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0);
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        data.featureTriSegments.push({start: 3, end: 6, segIdx: 0, frc: 0});
        buildFrcLevelSegments(data, makeTriangles(2), makeSegments(6, 2));
        expect(data.frcPerLevel.size).toBe(1);
        expect(data.frcPerLevel.get(0).segments.length).toBe(1);
        expect(data.frcNonRoadSegments.segments.length).toBe(0);
        expect(data.featureTriSegments.length).toBe(0);
    });

    test('mixed FRC levels → separate frcPerLevel entries per level', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0).add(2);
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        data.featureTriSegments.push({start: 3, end: 6, segIdx: 0, frc: 2});
        buildFrcLevelSegments(data, makeTriangles(2), makeSegments(6, 2));
        expect(data.frcPerLevel.size).toBe(2);
        expect(data.frcPerLevel.has(0)).toBe(true);
        expect(data.frcPerLevel.has(2)).toBe(true);
    });

    test('null-FRC features go to frcNonRoadSegments', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0);
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: null});
        data.featureTriSegments.push({start: 3, end: 6, segIdx: 0, frc: 0});
        buildFrcLevelSegments(data, makeTriangles(2), makeSegments(6, 2));
        expect(data.frcNonRoadSegments.segments.length).toBe(1);
        expect(data.frcPerLevel.has(0)).toBe(true);
        expect(data.frcPerLevel.has(null)).toBe(false);
    });

    test('triangle indices reordered in-place by FRC group (descending)', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0).add(2);
        // Triangle 0 marked frc=0, triangle 1 marked frc=2.
        // Sort is descending by FRC → frc=2 (originally indices 3,4,5) should land first.
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        data.featureTriSegments.push({start: 3, end: 6, segIdx: 0, frc: 2});
        const tris = makeTriangles(2);
        buildFrcLevelSegments(data, tris, makeSegments(6, 2));
        // After reorder: indices 3,4,5 first (frc=2 group), then 0,1,2 (frc=0).
        expect(Array.from(tris.uint16.slice(0, 6))).toEqual([3, 4, 5, 0, 1, 2]);
    });

    test('vertexOffset is preserved from source segment across groups', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0).add(2);
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        data.featureTriSegments.push({start: 3, end: 6, segIdx: 0, frc: 2});
        const segs = new SegmentVector([{
            vertexOffset: 42, primitiveOffset: 0, vertexLength: 6, primitiveLength: 2, vaos: {}, sortKey: undefined,
        }]);
        buildFrcLevelSegments(data, makeTriangles(2), segs);
        expect(data.frcPerLevel.get(0).segments[0].vertexOffset).toBe(42);
        expect(data.frcPerLevel.get(2).segments[0].vertexOffset).toBe(42);
    });

    test('featureTriSegments cleared after build (no double-build leak)', () => {
        const data = new FrcSegmentData();
        data.frcCoverage.add(0);
        data.featureTriSegments.push({start: 0, end: 3, segIdx: 0, frc: 0});
        buildFrcLevelSegments(data, makeTriangles(1), makeSegments(3, 1));
        expect(data.featureTriSegments.length).toBe(0);
    });
});

describe('updateFrcCoverageFadeRange', () => {
    function mkOption(value) {
        return {value: {evaluate: () => value}};
    }

    // Minimal Style + Painter stand-ins. The function only touches forEachFragmentStyle,
    // stylesheet.schema, stylesheet.imports, options.get(), scope, and assigns to two
    // painter fields. We don't need to construct a real Style/Painter for that.
    function mkStyle(fragment) {
        return {
            stylesheet: {imports: []},
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            forEachFragmentStyle(fn) { fn(fragment); },
        };
    }

    function mkPainter() {
        return {frcCoverageFadeRange: null, frcCoverageSourceLayers: []};
    }

    test('no fragment with sdCoverageFadeRange schema → painter unchanged', () => {
        const painter = mkPainter();
        updateFrcCoverageFadeRange(mkStyle({scope: 'foo', stylesheet: {schema: null}, options: null}), painter);
        expect(painter.frcCoverageFadeRange).toBeNull();
        expect(painter.frcCoverageSourceLayers).toEqual([]);
    });

    test('[0,0] default → painter unchanged (skip condition)', () => {
        const painter = mkPainter();
        // scope='' makes makeFQID('name', '') return just 'name', so the Map keys can match.
        const fragment = {
            scope: '',
            stylesheet: {schema: {sdCoverageFadeRange: {default: [0, 0]}}},
            options: new Map([['sdCoverageFadeRange', mkOption([0, 0])]]),
        };
        updateFrcCoverageFadeRange(mkStyle(fragment), painter);
        expect(painter.frcCoverageFadeRange).toBeNull();
    });

    test('valid [14,15] sets painter.frcCoverageFadeRange', () => {
        const painter = mkPainter();
        const fragment = {
            scope: '',
            stylesheet: {schema: {sdCoverageFadeRange: {default: [0, 0]}}},
            options: new Map([
                ['sdCoverageFadeRange', mkOption([14, 15])],
                ['sdCoverageSourceLayers', mkOption(['road', 'structure'])],
            ]),
        };
        updateFrcCoverageFadeRange(mkStyle(fragment), painter);
        expect(painter.frcCoverageFadeRange).toEqual([14, 15]);
        expect(painter.frcCoverageSourceLayers).toEqual(['road', 'structure']);
    });

    test('sdCoverageSourceLayers absent → defaults to ["road","structure"]', () => {
        const painter = mkPainter();
        const fragment = {
            scope: '',
            stylesheet: {schema: {sdCoverageFadeRange: {default: [0, 0]}}},
            options: new Map([['sdCoverageFadeRange', mkOption([14, 15])]]),
        };
        updateFrcCoverageFadeRange(mkStyle(fragment), painter);
        expect(painter.frcCoverageSourceLayers).toEqual(['road', 'structure']);
    });

    test('first matching fragment wins (early exit)', () => {
        const painter = mkPainter();
        const first = {
            scope: '',
            stylesheet: {schema: {sdCoverageFadeRange: {default: [0, 0]}}},
            options: new Map([['sdCoverageFadeRange', mkOption([14, 15])]]),
        };
        const second = {
            scope: '',
            stylesheet: {schema: {sdCoverageFadeRange: {default: [0, 0]}}},
            options: new Map([['sdCoverageFadeRange', mkOption([16, 17])]]),
        };
        const style = {
            stylesheet: {imports: []},
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            forEachFragmentStyle(fn) { fn(first); fn(second); },
        };
        updateFrcCoverageFadeRange(style, painter);
        expect(painter.frcCoverageFadeRange).toEqual([14, 15]);
    });
});

// ---------------------------------------------------------------------------
// HD eager/lazy split (modularization invariant)
//
// Core hot path: `vector_tile_source` reads `painter.frcCoverageFadeRange` on the
// FIRST tile request — before any tiles have triggered HD loading. That field is
// set by `HD.updateFrcCoverageFadeRange`, so this method MUST be exposed
// synchronously from `hd_main_esm` (before `prepareHD()` resolves). Everything
// else stays in the lazy chunk to keep core bundle size down.
//
// This test imports `hd_main_esm` directly. The standard test environment uses
// the UMD `hd_main` alias where everything is synchronous; importing the ESM
// variant explicitly is the only way to observe the eager/lazy split.
// ---------------------------------------------------------------------------

describe('HD eager/lazy split (hd_main_esm)', () => {
    test('updateFrcCoverageFadeRange is callable before prepareHD()', async () => {
        const mod = await import('../../../modules/hd_main_esm');
        const {HD, prepareHD} = mod;

        // Eager state: only updateFrcCoverageFadeRange is hooked up. The lazy
        // methods are undefined until prepareHD() runs the dynamic import.
        expect(typeof HD.updateFrcCoverageFadeRange).toBe('function');
        // HD.loaded is set by hd_main_imports; absent (falsy) in the eager shape.
        expect(HD.loaded).toBeFalsy();
        expect(HD.FrcCoverageRenderer).toBeUndefined();
        expect(HD.HdCoverageState).toBeUndefined();
        expect(HD.updateFrcCoverage).toBeUndefined();
        expect(HD.updateHdCoverageSourceCache).toBeUndefined();
        // Render-time hooks are also lazy.
        expect(HD.drawLineFrcCoverageDetect).toBeUndefined();
        expect(HD.drawFillFrcCoverageFirstPass).toBeUndefined();

        // After prepareHD() resolves: all HD-main methods are hydrated.
        await prepareHD();
        expect(HD.loaded).toBe(true);
        expect(HD.FrcCoverageRenderer).toBeDefined();
        expect(HD.HdCoverageState).toBeDefined();
        expect(typeof HD.updateFrcCoverage).toBe('function');
        expect(typeof HD.updateHdCoverageSourceCache).toBe('function');
        expect(typeof HD.drawLineFrcCoverageDetect).toBe('function');
        expect(typeof HD.drawFillFrcCoverageFirstPass).toBe('function');
        // The eager method is still there and still callable.
        expect(typeof HD.updateFrcCoverageFadeRange).toBe('function');
    });

    test('prepareHD() is idempotent — second call leaves HD methods stable', async () => {
        const mod = await import('../../../modules/hd_main_esm');
        const {HD, prepareHD} = mod;

        await prepareHD();
        const renderer = HD.FrcCoverageRenderer;
        const updateFrc = HD.updateFrcCoverage;
        await prepareHD();
        // Same references — Object.assign overwrote with the same module exports.
        expect(HD.FrcCoverageRenderer).toBe(renderer);
        expect(HD.updateFrcCoverage).toBe(updateFrc);
    });
});
