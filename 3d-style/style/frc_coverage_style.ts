import {FrcCoverageManager} from '../source/frc_coverage_manager';
import SourceCache from '../../src/source/source_cache';
import {RenderSourceType} from '../../src/source/render_source_type';
import {HD_ROAD_COVERAGE_SOURCE_LAYER} from '../../src/source/frc_coverage_snapshot';
import {makeFQID} from '../../src/util/fqid';

import type Tile from '../../src/source/tile';
import type {TypedStyleLayer} from '../../src/style/style_layer/typed_style_layer';
import type Style from '../../src/style/style';

// Barrel re-export so the HD module gets the full FRC surface from one import.
// Importing the eager pair directly from `./frc_coverage_eager` is what keeps the
// lazy code below out of core.
export {updateFrcCoverageFadeRange} from './frc_coverage_eager';

type SourceCacheTiles = {_tiles: Record<string, Tile>; _sourceLoaded?: boolean};

/// Per-Style state for HD road coverage conflation.
/// Owned by Style via _hdCoverage; null when conflation is not configured.
export class HdCoverageState {
    coverageSourceCaches: Record<string, SourceCache>;
    manager: FrcCoverageManager;

    constructor() {
        this.coverageSourceCaches = {};
        this.manager = new FrcCoverageManager();
    }
}

/// Collect FRC coverage from HD road coverage source caches and update painter's snapshot.
/// Triggers re-parse of tiles with deferred road/structure layers when coverage changes.
export function updateFrcCoverage(style: Style, state: HdCoverageState) {
    state.manager.clear();

    for (const fqid in style._mergedHdRoadCoverageSourceCaches) {
        const sourceCache = style._mergedHdRoadCoverageSourceCaches[fqid];
        const tiles = (sourceCache as unknown as SourceCacheTiles)._tiles;
        // Single loop over all loaded tiles — covers tiles with coverage data and
        // loaded/errored tiles without data (frcMask=0 unblocks deferred parse).
        for (const key in tiles) {
            const tile = tiles[key];
            if (!tile || !tile.loaded()) continue;
            const polygons = tile.frcCoveragePolygons;
            if (polygons && polygons.length > 0) {
                state.manager.addTileCoverage(tile.tileID.canonical, polygons);
            } else {
                state.manager.addTileCoverage(tile.tileID.canonical, []);
            }
        }
    }

    const snapshot = state.manager.updateSnapshotIfNeeded();
    if (style.map.painter) {
        style.map.painter.frcCoverageSnapshot = snapshot.empty() ? null : snapshot;
    }
    if (!snapshot.empty()) {
        const caches = [style._mergedOtherSourceCaches, style._mergedSymbolSourceCaches];
        for (const cacheMap of caches) {
            for (const cacheFqid in cacheMap) {
                const sc = cacheMap[cacheFqid] as unknown as SourceCacheTiles & {_reloadTile: (id: number, state: string) => void};
                for (const key in sc._tiles) {
                    const tile = sc._tiles[key];
                    if (tile && tile.hasDeferredRoadStructure) {
                        tile.hasDeferredRoadStructure = false;
                        sc._reloadTile(+key, 'reloading');
                    }
                }
            }
        }
    }
}

/// Create a dedicated SourceCache for an hd_road_coverage fill layer.
/// Called from Style._addLayers whenever such a layer is first encountered.
export function updateHdCoverageSourceCache(style: Style, state: HdCoverageState, layer: TypedStyleLayer) {
    if (layer.type !== 'fill' || layer.sourceLayer !== HD_ROAD_COVERAGE_SOURCE_LAYER) return;
    if (state.coverageSourceCaches[layer.source]) return;
    const sourceInstance = style.getOwnSource(layer.source);
    if (!sourceInstance || sourceInstance.type !== 'vector') return;
    const sourceCacheId = `hd-road-coverage:${layer.source}`;
    const sourceCacheFQID = makeFQID(sourceCacheId, style.scope);
    const sourceCache = style._sourceCaches[sourceCacheId] = new SourceCache(sourceCacheFQID, sourceInstance, RenderSourceType.HdRoadCoverage);
    state.coverageSourceCaches[layer.source] = sourceCache;
    sourceCache.setMaxzoomOverride(14);
    sourceCache.onAdd(style.map);
    // In ESM builds the source may already be loaded (regular cache was set up earlier) but
    // source.onAdd() defers its metadata event via requestAnimationFrame. If that frame gets
    // cancelled the coverage cache stays uninitialized. Mirror the source-loaded state from
    // the regular cache so update() can immediately start loading coverage tiles.
    const regularCache = style._otherSourceCaches[layer.source] as unknown as SourceCacheTiles;
    if (regularCache && regularCache._sourceLoaded) {
        (sourceCache as unknown as SourceCacheTiles)._sourceLoaded = true;
    }
}
