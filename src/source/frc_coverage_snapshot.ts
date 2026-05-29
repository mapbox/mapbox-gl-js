import {register} from '../util/web_worker_transfer';

import type Point from '@mapbox/point-geometry';
import type {CanonicalTileID} from './tile_id';

/// Source layer name for HD road coverage polygons.
export const HD_ROAD_COVERAGE_SOURCE_LAYER = 'hd_road_coverage';

/// Coverage polygon data for a single feature in an hd_road_coverage tile.
/// Multiple polygons per tile are supported, each with its own frcMask.
/// Registered for cross-thread transfer; stays in core because the parsed
/// polygons travel from worker to main on every tile load.
export class FrcCoveragePolygon {
    frcMask: number; // bitmask of FRC levels covered (bit N = FRC level N)
    rings: Array<Array<Point>>; // polygon rings in tile coordinates (0..EXTENT)

    constructor(frcMask: number = 0, rings: Array<Array<Point>> = []) {
        this.frcMask = frcMask;
        this.rings = rings;
    }

    hasGeometry(): boolean {
        return this.rings.length > 0 && this.rings[0].length > 0;
    }
}

register(FrcCoveragePolygon, 'FrcCoveragePolygon');

/// Array of coverage polygons for a single tile.
export type FrcCoveragePolygons = Array<FrcCoveragePolygon>;

/// Coverage parameters sent from main thread to tile worker on each loadTile/reloadTile.
/// null when SD-HD conflation is not configured (no sdCoverageFadeRange in style).
export type FrcCoverageParams = {
    frcMask: number | null;              // bitmask of fully-covered FRC levels at this tile; non-null triggers parse-time feature skip above fadeRange.max
    resolved: boolean;                   // false = coverage tile still loading; worker defers road/structure source layers
    sourceLayers: string[];              // source layers subject to conflation (from sdCoverageSourceLayers config)
    polygons: FrcCoveragePolygons | null; // partial-coverage polygon geometry for stencil rendering and symbol anchor checks
    tileZoom: number | null;             // zoom of the coverage tile (for coordinate scaling when road and coverage tile differ)
};

export interface FrcCoverageTile {
    tileId: CanonicalTileID;
    polygons: FrcCoveragePolygons;
    frcMask: number; // OR of all polygon masks (cached)
}

/// Main-thread view onto the loaded HD coverage tiles. The concrete class lives in the
/// HD chunk (`3d-style/source/frc_coverage_snapshot`); core only sees this interface
/// via `import type`, so the polygon-containment math and tile-lookup runtime stay in HD.
export interface FrcCoverageSnapshot {
    tiles: Array<FrcCoverageTile>;
    getTile: (id: CanonicalTileID) => FrcCoverageTile | null;
    getTileOrParent: (id: CanonicalTileID) => FrcCoverageTile | null;
    getFullCoverageMask: (childId: CanonicalTileID) => number | null;
    equals: (other: Array<FrcCoverageTile>) => boolean;
    empty: () => boolean;
}

