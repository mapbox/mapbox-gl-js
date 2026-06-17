import type {ElevationFeature} from '../../3d-style/elevation/elevation_feature';
import type {CanonicalTileID} from './tile_id';

/// One elevation feature tagged with the canonical tile that parsed it.
/// Serialized to workers for cross-source `3d_elevation_id` lookup.
export type ElevationTiledFeature = {
    tileId: CanonicalTileID;
    feature: ElevationFeature;
};

/// Cross-source elevation payload for a feature tile.
/// When an id has no match: deferred while providers are loading, hidden if a provider
/// tile covers the area (data genuinely absent), flat otherwise (e.g. below provider minzoom).
export type ElevationParams = {
    registry: ElevationTiledFeature[];
    hasCoveringTile: boolean;
    allProvidersReady: boolean;
};

/// Per-provider tile in the elevation index. `generation` advances on every parse for change detection.
export type ElevationCoverageTile = {
    sourceFQID: string;
    tileId: CanonicalTileID;
    features: ElevationFeature[];
    generation: number;
};

/// Main-thread view of loaded HD road elevation provider tiles. The concrete class
/// lives in the HD chunk; core holds types and the interface for `import type` only.
export interface ElevationCoverageSnapshot {
    tiles: ElevationCoverageTile[];
    equals: (other: ElevationCoverageTile[]) => boolean;
    getTilesIntersecting: (featureTile: CanonicalTileID) => ElevationCoverageTile[];
    empty: () => boolean;
}
