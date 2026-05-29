import {FrcCoverageSnapshot, combinedFrcMask} from './frc_coverage_snapshot';

import type {FrcCoverageTile, FrcCoveragePolygons} from '../../src/source/frc_coverage_snapshot';
import type {CanonicalTileID} from '../../src/source/tile_id';

/// Collects FRC coverage polygons from visible tiles during render tree creation.
/// Builds an immutable snapshot that can be passed to the renderer.
export class FrcCoverageManager {
    _tileCoverages: Array<FrcCoverageTile>;
    _snapshot: FrcCoverageSnapshot;

    constructor() {
        this._tileCoverages = [];
        this._snapshot = new FrcCoverageSnapshot();
    }

    clear() {
        this._tileCoverages = [];
    }

    addTileCoverage(tileId: CanonicalTileID, polygons: FrcCoveragePolygons) {
        this._tileCoverages.push({
            tileId,
            polygons,
            frcMask: combinedFrcMask(polygons),
        });
    }

    empty(): boolean { return this._tileCoverages.length === 0; }

    updateSnapshotIfNeeded(): FrcCoverageSnapshot {
        if (this._snapshot.equals(this._tileCoverages)) {
            return this._snapshot;
        }
        const tiles: Array<FrcCoverageTile> = this._tileCoverages.map(tc => ({
            tileId: tc.tileId,
            polygons: tc.polygons,
            frcMask: tc.frcMask,
        }));
        this._snapshot = new FrcCoverageSnapshot(tiles);
        return this._snapshot;
    }
}
