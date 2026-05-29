import {pointWithinPolygon} from '../../src/style-spec/util/geometry_util';
import {featureFrcLevel} from '../data/frc_road_classes';
import EXTENT from '../../src/style-spec/data/extent';

import type {FrcCoveragePolygons} from '../../src/source/frc_coverage_snapshot';
import type {CanonicalTileID} from '../../src/source/tile_id';

/**
 * Anchor-in-polygon check for symbol placement under partial HD coverage. Each polygon
 * carries its own frcMask — no dependency on coverageFrcMask (which may be null for
 * partial coverage since getFullCoverageMask requires full containment).
 *
 * @returns true if the symbol should be skipped (anchor lies inside a covering polygon).
 * @private
 */
export function symbolAnchorInFrcCoverage(
    coveragePolygons: FrcCoveragePolygons,
    properties: Record<string, unknown>,
    anchor: {x: number; y: number},
    canonical: CanonicalTileID,
    coverageTileZoom: number | null,
): boolean {
    const frc = featureFrcLevel(properties);
    if (frc === null) return false;

    // Transform anchor from symbol tile coords to coverage tile coords
    let px = anchor.x, py = anchor.y;
    const covZ = coverageTileZoom != null ? coverageTileZoom : canonical.z;
    if (canonical.z !== covZ) {
        const dz = canonical.z - covZ;
        const scale = 1 << dz;
        const localX = canonical.x % scale;
        const localY = canonical.y % scale;
        const cellSize = EXTENT / scale;
        px = localX * cellSize + anchor.x / scale;
        py = localY * cellSize + anchor.y / scale;
    }

    for (const poly of coveragePolygons) {
        if (!poly.hasGeometry() || (poly.frcMask & (1 << frc)) === 0) continue;
        const positionRings = poly.rings.map(ring => ring.map(p => [p.x, p.y] as GeoJSON.Position));
        if (pointWithinPolygon([px, py], positionRings)) {
            return true;
        }
    }
    return false;
}
