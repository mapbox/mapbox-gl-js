import EXTENT from '../../src/style-spec/data/extent';
import {FrcCoveragePolygon} from '../../src/source/frc_coverage_snapshot';

import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {FrcCoveragePolygons} from '../../src/source/frc_coverage_snapshot';

/**
 * Parse FrcCoveragePolygons from an `hd_road_coverage` VectorTileLayer.
 * @param {VectorTileLayer} layer Source layer to parse polygons from.
 * @returns {FrcCoveragePolygons} Array of parsed coverage polygons.
 * @private
 */
export function parseFrcCoverageFromLayer(layer: VectorTileLayer): FrcCoveragePolygons {
    const result: FrcCoveragePolygons = [];
    for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        const frcMaskRaw = feature.properties['frc_mask'];
        if (frcMaskRaw == null) continue;
        const frcMask = Number(frcMaskRaw);
        if (!frcMask) continue;
        const rings = feature.loadGeometry();
        // Skip neighbor-tile features: all points should be within [0, EXTENT]
        if (rings.length > 0) {
            let isNeighbor = false;
            for (const pt of rings[0]) {
                if (pt.x < 0 || pt.x > EXTENT || pt.y < 0 || pt.y > EXTENT) {
                    isNeighbor = true;
                    break;
                }
            }
            if (isNeighbor) continue;
        }
        // Full-tile polygon: no rings stored (frcMask only)
        const isFull = rings.length === 1 && rings[0].length === 5 &&
            rings[0].some(p => p.x <= 0 && p.y <= 0) &&
            rings[0].some(p => p.x >= EXTENT && p.y <= 0) &&
            rings[0].some(p => p.x >= EXTENT && p.y >= EXTENT) &&
            rings[0].some(p => p.x <= 0 && p.y >= EXTENT);
        result.push(new FrcCoveragePolygon(frcMask, isFull ? [] : rings));
    }
    return result;
}
