import {
    ElevationCoverageSnapshot,
    compareCoverageTiles,
} from './elevation_coverage_snapshot';

import type {ElevationCoverageTile} from '../../src/source/elevation_coverage_snapshot';
import type {ElevationFeature} from '../elevation/elevation_feature';
import type {CanonicalTileID} from '../../src/source/tile_id';

/// Collects elevation features from HD road elevation provider tiles on the main thread.
export class ElevationCoverageManager {
    _tiles: ElevationCoverageTile[];
    _snapshot: ElevationCoverageSnapshot;
    _snapshotChanged: boolean;

    constructor() {
        this._tiles = [];
        this._snapshot = new ElevationCoverageSnapshot();
        this._snapshotChanged = false;
    }

    clear() {
        this._tiles.length = 0;
    }

    consumeSnapshotChanged(): boolean {
        const changed = this._snapshotChanged;
        this._snapshotChanged = false;
        return changed;
    }

    addTileElevation(sourceFQID: string, tileId: CanonicalTileID, features: ElevationFeature[], generation: number) {
        this._tiles.push({sourceFQID, tileId, features, generation});
    }

    updateSnapshotIfNeeded(): ElevationCoverageSnapshot {
        // Sort in-place; only copy on change (snapshot owns its array).
        this._tiles.sort(compareCoverageTiles);
        if (this._snapshot.equals(this._tiles)) {
            return this._snapshot;
        }
        this._snapshot = new ElevationCoverageSnapshot(this._tiles.slice());
        this._snapshotChanged = true;
        return this._snapshot;
    }
}
