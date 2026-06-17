import {RenderSourceType} from '../../src/source/render_source_type';

import type {
    ElevationCoverageSnapshot as IElevationCoverageSnapshot,
    ElevationCoverageTile,
    ElevationParams,
    ElevationTiledFeature,
} from '../../src/source/elevation_coverage_snapshot';
import type Tile from '../../src/source/tile';
import type {Map as MapboxMap} from '../../src/ui/map';
import type {CanonicalTileID} from '../../src/source/tile_id';

// True when one canonical tile is the other or an ancestor of it (either direction).
function tilesIntersect(a: CanonicalTileID, b: CanonicalTileID): boolean {
    if (a.z <= b.z) {
        const dz = b.z - a.z;
        return (b.x >> dz) === a.x && (b.y >> dz) === a.y;
    }
    const dz = a.z - b.z;
    return (a.x >> dz) === b.x && (a.y >> dz) === b.y;
}

export function compareCoverageTiles(a: ElevationCoverageTile, b: ElevationCoverageTile): number {
    if (a.sourceFQID !== b.sourceFQID) return a.sourceFQID < b.sourceFQID ? -1 : 1;
    if (a.tileId.z !== b.tileId.z) return a.tileId.z - b.tileId.z;
    if (a.tileId.x !== b.tileId.x) return a.tileId.x - b.tileId.x;
    return a.tileId.y - b.tileId.y;
}

export class ElevationCoverageSnapshot implements IElevationCoverageSnapshot {
    tiles: ElevationCoverageTile[];

    constructor(tiles: ElevationCoverageTile[] = []) {
        this.tiles = tiles;
    }

    // All snapshot tiles overlapping `featureTile` (ancestors and descendants).
    getTilesIntersecting(featureTile: CanonicalTileID): ElevationCoverageTile[] {
        const result: ElevationCoverageTile[] = [];
        for (const tile of this.tiles) {
            if (tilesIntersect(tile.tileId, featureTile)) result.push(tile);
        }
        return result;
    }

    // Compares by source + canonical + generation; a generation advance catches any content change.
    equals(other: ElevationCoverageTile[]): boolean {
        if (this.tiles.length !== other.length) return false;
        for (let i = 0; i < this.tiles.length; ++i) {
            const a = this.tiles[i];
            const b = other[i];
            if (a.sourceFQID !== b.sourceFQID ||
                a.tileId.z !== b.tileId.z || a.tileId.x !== b.tileId.x || a.tileId.y !== b.tileId.y ||
                a.generation !== b.generation) {
                return false;
            }
        }
        return true;
    }

    empty(): boolean {
        return this.tiles.length === 0;
    }
}

export function sortElevationCoverageTiles(tiles: ElevationCoverageTile[]): ElevationCoverageTile[] {
    return tiles.slice().sort(compareCoverageTiles);
}

/// Build cross-source elevation payload for a feature tile. Workers can't read provider caches.
export function buildElevationParamsForTile(
    snapshot: IElevationCoverageSnapshot,
    featureTile: CanonicalTileID,
    allProvidersReady: boolean,
): ElevationParams {
    const covering = snapshot.getTilesIntersecting(featureTile);
    if (covering.length === 0) {
        return {registry: [], hasCoveringTile: false, allProvidersReady};
    }

    const registry: ElevationTiledFeature[] = [];
    for (const tile of covering) {
        for (const feature of tile.features) {
            registry.push({tileId: tile.tileId, feature});
        }
    }
    registry.sort((a, b) => a.feature.id - b.feature.id);
    return {registry, hasCoveringTile: true, allProvidersReady};
}

/// Build the cross-source elevation payload for a feature tile, or null when no elevation applies.
export function buildElevationRequestParams(
    map: MapboxMap,
    tile: Tile,
    crossSourceElevationEnabled: boolean,
): ElevationParams | null {
    if (tile.renderSourceType === RenderSourceType.HdRoadElevation) return null;
    // Under terrain: skip snapshot — HD road-markup lines drape flat.
    // style.terrain is synchronous; painter.terrain lags one frame.
    if (map.style && map.style.terrain) return null;
    if (!crossSourceElevationEnabled) return null;
    const snapshot = map.painter ? map.painter.elevationCoverageSnapshot : null;
    // Defaults false (defer) until providers settle.
    const ready = !!(map.painter && map.painter.elevationProvidersReady);
    if (snapshot) {
        return buildElevationParamsForTile(snapshot, tile.tileID.canonical, ready);
    }
    // HD loaded but no snapshot → stub with readiness flag so the worker can tell
    // "providers still streaming" (defer) from "no coverage here" (render flat, e.g. below minzoom).
    return {registry: [], hasCoveringTile: false, allProvidersReady: ready};
}
