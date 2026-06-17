import {ElevationCoverageManager} from '../source/elevation_coverage_manager';
import SourceCache from '../../src/source/source_cache';
import {RenderSourceType} from '../../src/source/render_source_type';
import {getNameFromFQID, getOuterScopeFromFQID, makeFQID} from '../../src/util/fqid';

import type Tile from '../../src/source/tile';
import type {TypedStyleLayer} from '../../src/style/style_layer/typed_style_layer';
import type Style from '../../src/style/style';
import type VectorTileSource from '../../src/source/vector_tile_source';
import type {CanonicalTileID} from '../../src/source/tile_id';
import type {ElevationCoverageSnapshot} from '../../src/source/elevation_coverage_snapshot';

type SourceCacheTiles = {_tiles: Record<string, Tile>; _sourceLoaded?: boolean; used?: boolean};

/// Signature of provider tiles covering featureTile; changes on add, remove, or reparse.
function coverageSignature(snapshot: ElevationCoverageSnapshot, featureTile: CanonicalTileID): string {
    const parts: string[] = [];
    for (const tile of snapshot.getTilesIntersecting(featureTile)) {
        parts.push(`${tile.tileId.z}/${tile.tileId.x}/${tile.tileId.y}:${tile.generation}`);
    }
    parts.sort();
    return parts.join('|');
}

/// True when the provider tiles covering `featureTile` changed between two snapshots.
function coveringChanged(prev: ElevationCoverageSnapshot, next: ElevationCoverageSnapshot, featureTile: CanonicalTileID): boolean {
    return coverageSignature(prev, featureTile) !== coverageSignature(next, featureTile);
}

function fqidBelongsToFragment(fqid: string, fragmentScope: string): boolean {
    const scope = getOuterScopeFromFQID(fqid);
    return scope === fragmentScope || (!scope && !fragmentScope);
}

function resolveIngestSourceCache(style: Style, fqid: string): SourceCache | undefined {
    return style._mergedOtherSourceCaches[fqid] ||
        style._mergedSymbolSourceCaches[fqid] ||
        style._mergedHdRoadElevationSourceCaches[fqid];
}

function layerUsesHdRoadSourceLayer(layer: TypedStyleLayer): boolean {
    const sourceLayer = layer.sourceLayer;
    return !!sourceLayer && sourceLayer.startsWith('hd_road_');
}

/// True when every provider-only source has finished loading.
/// Dual-role sources are excluded to avoid circular deferral.
function areElevationProvidersReady(style: Style, providerFQIDs: Set<string>): boolean {
    for (const fqid of providerFQIDs) {
        const sc = resolveIngestSourceCache(style, fqid) as unknown as SourceCacheTiles | undefined;
        if (!sc) return false;
        if (!sc._sourceLoaded) return false;
        for (const key in sc._tiles) {
            const tile = sc._tiles[key];
            if (tile && (tile.state === 'loading' || tile.state === 'reloading')) return false;
        }
    }
    return true;
}

/// True when a layer uses an hd-road-markup elevation reference.
export function layerHasMvtRoadElevation(layer: TypedStyleLayer): boolean {
    if (!layer.layout) return false;
    if (layer.type === 'line' && layer.layout.get('line-elevation-reference') === 'hd-road-markup') {
        return true;
    }
    if (layer.type === 'circle' && layer.layout.get('circle-elevation-reference') === 'hd-road-markup') {
        return true;
    }
    if (layer.type === 'symbol' && layer.layout.get('symbol-elevation-reference') === 'hd-road-markup') {
        return true;
    }
    if (layer.type === 'fill' && layer.layout.get('fill-elevation-reference') === 'hd-road-markup') {
        return true;
    }
    return false;
}

function hasElevationConsumers(style: Style): boolean {
    for (const layerId in style._mergedLayers) {
        if (layerHasMvtRoadElevation(style._mergedLayers[layerId])) return true;
    }
    return false;
}

/// Source FQIDs with hd-road-markup consumer layers.
export function collectElevationConsumerSourceFQIDs(style: Style): Set<string> {
    const consumers = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (layerHasMvtRoadElevation(layer)) {
            consumers.add(makeFQID(layer.source, layer.scope));
        }
    }
    return consumers;
}

/// Provider-only sources: hd_road_* layers that are not also consumers.
export function collectElevationProviderSourceFQIDs(style: Style): Set<string> {
    const consumerFQIDs = collectElevationConsumerSourceFQIDs(style);
    const providers = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (!layer.source || !layerUsesHdRoadSourceLayer(layer)) continue;
        const fqid = makeFQID(layer.source, layer.scope);
        if (consumerFQIDs.has(fqid)) continue;
        providers.add(fqid);
    }
    return providers;
}

/// True when a consumer resolves elevation from a different source.
export function needsCrossSourceElevation(style: Style): boolean {
    const consumers = collectElevationConsumerSourceFQIDs(style);
    if (consumers.size === 0) return false;
    const ingest = collectElevationIngestSourceFQIDs(style);
    for (const consumer of consumers) {
        for (const source of ingest) {
            if (consumer !== source) return true;
        }
    }
    return false;
}

/// Recompute the cached cross-source gate after a source change.
export function updateCrossSourceElevationGate(style: Style): void {
    style._crossSourceElevationActive = needsCrossSourceElevation(style);
    if (Object.keys(style._mergedHdRoadElevationSourceCaches).length === 0) return;
    if (!style._hdElevation) style._hdElevation = new HdElevationState();
    style._hdElevation._needsCrossSourceElevation = style._crossSourceElevationActive;
}

/// Reparse consumer tiles after terrain on/off (flat ↔ elevated geometry).
export function handleTerrainToggle(style: Style, hadTerrain: boolean): void {
    if (hadTerrain === !!style.terrain) return;
    reparseElevationConsumerTiles(style);
}

/// Cached cross-source gate; refreshed on source change and each frame.
export function crossSourceElevationEnabledForStyle(style: Style): boolean {
    return style._crossSourceElevationActive === true;
}

/// Sources whose tiles feed the elevation snapshot (providers and dual-role).
/// This is exactly every source with an hd_road_* source-layer: provider-only
/// and dual-role sources together make up the full set, so no consumer/provider
/// split is needed.
export function collectElevationIngestSourceFQIDs(style: Style): Set<string> {
    const ingest = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (!layer.source || !layerUsesHdRoadSourceLayer(layer)) continue;
        ingest.add(makeFQID(layer.source, layer.scope));
    }
    return ingest;
}

/// Mark ingest caches used so provider sources load tiles even without visible consumer layers.
export function markElevationIngestSourceCachesUsed(style: Style): void {
    if (!style._hdElevation || !style._hdElevation._needsCrossSourceElevation) return;
    const ingestFQIDs = style._hdElevation._ingestFQIDs;
    if (!ingestFQIDs) return;
    for (const fqid of ingestFQIDs) {
        const cache = resolveIngestSourceCache(style, fqid);
        if (cache) cache.used = true;
    }
}

/// Reload consumer tiles (optionally filtered). Skips non-consumers like raster-dem.
export function reparseElevationConsumerTiles(
    style: Style,
    shouldReload?: (tile: Tile) => boolean,
): void {
    // Skip dual-role ingest sources — reparsing them causes a reload loop.
    const consumerFQIDs = collectElevationConsumerSourceFQIDs(style);
    if (consumerFQIDs.size === 0) return;
    const ingestFQIDs = collectElevationIngestSourceFQIDs(style);
    for (const fqid of ingestFQIDs) consumerFQIDs.delete(fqid);
    if (consumerFQIDs.size === 0) return;

    const caches = [style._mergedOtherSourceCaches, style._mergedSymbolSourceCaches];
    for (const cacheMap of caches) {
        for (const cacheFqid in cacheMap) {
            if (!consumerFQIDs.has(cacheFqid)) continue;
            const sc = cacheMap[cacheFqid] as unknown as SourceCacheTiles & {_reloadTile: (id: number, state: string) => void};
            for (const key in sc._tiles) {
                const tile = sc._tiles[key];
                if (!tile) continue;
                if (shouldReload && !shouldReload(tile)) continue;
                tile.hasDeferredElevationFeatures = false;
                sc._reloadTile(+key, 'reloading');
            }
        }
    }
}

/// Per-Style state for cross-source HD road elevation.
export class HdElevationState {
    elevationSourceCaches: Record<string, SourceCache>;
    manager: ElevationCoverageManager;
    _needsCrossSourceElevation: boolean;
    _ingestFQIDs: Set<string>;

    constructor() {
        this.elevationSourceCaches = {};
        this.manager = new ElevationCoverageManager();
        this._needsCrossSourceElevation = false;
        this._ingestFQIDs = new Set();
    }
}

function clearElevationCoverageState(style: Style): void {
    if (style.map && style.map.painter) {
        style.map.painter.elevationCoverageSnapshot = null;
        style.map.painter.elevationProvidersReady = undefined;
    }
}

function crossSourceElevationAlreadyInactive(style: Style): boolean {
    const state = style._hdElevation;
    const painterHasSnapshot = !!(style.map && style.map.painter && style.map.painter.elevationCoverageSnapshot);
    if (!state) {
        return !painterHasSnapshot;
    }
    return !state._needsCrossSourceElevation &&
        state._ingestFQIDs.size === 0 &&
        state.manager._tiles.length === 0 &&
        !painterHasSnapshot;
}

/// Clear cross-source state after style edit so stale ingest FQIDs stop forcing loads.
function deactivateCrossSourceElevation(style: Style): void {
    style._crossSourceElevationActive = false;
    if (crossSourceElevationAlreadyInactive(style)) return;
    clearElevationCoverageState(style);
    if (!style._hdElevation) return;
    style._hdElevation._needsCrossSourceElevation = false;
    style._hdElevation._ingestFQIDs.clear();
    style._hdElevation.manager.clear();
}

/// Setup provider caches, merge fragments, ingest tiles, and reparse consumers.
export function setupAndUpdateElevationCoverage(style: Style): void {
    // Under terrain: skip. Use style.terrain, not painter.terrain (lags a frame). Keep gate for toggle.
    if (style.terrain) {
        if (style.map.painter) style.map.painter.elevationCoverageSnapshot = null;
        return;
    }

    if (!hasElevationConsumers(style)) {
        deactivateCrossSourceElevation(style);
        return;
    }

    const crossSource = needsCrossSourceElevation(style);
    if (!crossSource) {
        deactivateCrossSourceElevation(style);
        return;
    }

    if (!style._hdElevation) {
        style._hdElevation = new HdElevationState();
    }
    const state = style._hdElevation;
    state._needsCrossSourceElevation = true;
    style._crossSourceElevationActive = true;
    state._ingestFQIDs = collectElevationIngestSourceFQIDs(style);

    const pureProviders = collectElevationProviderSourceFQIDs(style);
    style.forEachFragmentStyle((fragmentStyle: Style) => {
        for (const fqid of pureProviders) {
            if (!fqidBelongsToFragment(fqid, fragmentStyle.scope)) continue;
            const sourceId = getNameFromFQID(fqid);
            if (fragmentStyle._otherSourceCaches[sourceId] || fragmentStyle._symbolSourceCaches[sourceId]) {
                continue;
            }
            const source = fragmentStyle.getOwnSource(sourceId);
            if (source && source.type === 'vector') {
                if (!fragmentStyle._hdElevation) {
                    fragmentStyle._hdElevation = new HdElevationState();
                }
                updateHdElevationSourceCache(fragmentStyle, fragmentStyle._hdElevation, source);
            }
        }
    });
    style.mergeSources();

    updateElevationCoverage(style, state);
}

/// Dedicated cache for hd_road_elevation on provider-only sources.
export function updateHdElevationSourceCache(style: Style, state: HdElevationState, source: VectorTileSource) {
    const sourceFQID = makeFQID(source.id, style.scope);
    if (state.elevationSourceCaches[sourceFQID]) return;

    const sourceCacheId = `hd-road-elevation:${source.id}`;
    const sourceCacheFQID = makeFQID(sourceCacheId, style.scope);
    const sourceCache = style._sourceCaches[sourceCacheId] = new SourceCache(sourceCacheFQID, source, RenderSourceType.HdRoadElevation);
    state.elevationSourceCaches[sourceFQID] = sourceCache;
    sourceCache.onAdd(style.map);

    // Mirror regular cache loaded flag if tiles already loaded.
    const regularCache = style._otherSourceCaches[source.id] as unknown as SourceCacheTiles;
    if (regularCache && regularCache._sourceLoaded) {
        (sourceCache as unknown as SourceCacheTiles)._sourceLoaded = true;
    }
}

/// Ingest provider tiles and reparse consumers whose covering changed.
export function updateElevationCoverage(style: Style, state: HdElevationState) {
    // Under terrain: clear snapshot (lines drape flat).
    if (style.terrain) {
        state.manager.clear();
        if (style.map.painter) style.map.painter.elevationCoverageSnapshot = null;
        return;
    }

    if (!state._needsCrossSourceElevation) {
        clearElevationCoverageState(style);
        return;
    }

    for (const fqid of state._ingestFQIDs) {
        const cache = resolveIngestSourceCache(style, fqid);
        if (cache) cache.used = true;
    }

    state.manager.clear();

    // Readiness waits for parsedElevationFeatures (undefined = not parsed yet, [] = parsed empty),
    // not just loaded() — checked on parsed state only, so a reparsing tile can't pin readiness false.
    let allIngestElevationParsed = true;
    for (const fqid of state._ingestFQIDs) {
        const sourceCache = resolveIngestSourceCache(style, fqid);
        if (!sourceCache) continue;
        const tiles = (sourceCache as unknown as SourceCacheTiles)._tiles;
        for (const key in tiles) {
            const tile = tiles[key];
            if (!tile || !tile.loaded()) continue;
            const features = tile.parsedElevationFeatures;
            if (features === undefined) {
                allIngestElevationParsed = false;
                continue;
            }
            state.manager.addTileElevation(fqid, tile.tileID.canonical, features, tile.parsedElevationGeneration);
        }
    }

    const prevSnapshot = state.manager._snapshot;
    const snapshot = state.manager.updateSnapshotIfNeeded();
    if (style.map.painter) {
        style.map.painter.elevationCoverageSnapshot = snapshot.empty() ? null : snapshot;
    }

    const providersReady = allIngestElevationParsed &&
        areElevationProvidersReady(style, collectElevationProviderSourceFQIDs(style));
    if (style.map.painter) {
        style.map.painter.elevationProvidersReady = providersReady;
    }
    const snapshotChanged = state.manager.consumeSnapshotChanged();
    // Reparse when ready even if snapshot unchanged — consumer may have deferred first.
    if (!snapshotChanged && !providersReady) return;

    reparseElevationConsumerTiles(style, (tile) => {
        if (tile.hasDeferredElevationFeatures) return true;
        return snapshotChanged && coveringChanged(prevSnapshot, snapshot, tile.tileID.canonical);
    });
}
