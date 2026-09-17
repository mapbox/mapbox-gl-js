import {ElevationCoverageManager} from '../source/elevation_coverage_manager';
import {makeFQID} from '../../src/util/fqid';
import {terrainEnabled} from '../../src/style/terrain';

import type SourceCache from '../../src/source/source_cache';
import type Tile from '../../src/source/tile';
import type {TypedStyleLayer} from '../../src/style/style_layer/typed_style_layer';
import type Style from '../../src/style/style';
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

function resolveIngestSourceCache(style: Style, fqid: string): SourceCache | undefined {
    return style._mergedOtherSourceCaches[fqid] ||
        style._mergedSymbolSourceCaches[fqid];
}

/// True for a visible `hd-road-base` fill on a vector source. Markup layers only
/// consume elevation. GeoJSON fills carry their own elevation and never produce
/// the `hd_road_elevation` sidecar, so they are excluded via the source-layer check.
/// Checks layout visibility, not zoom: below minzoom the cache keeps its tiles.
function layerContributesHdRoadElevation(layer: TypedStyleLayer): boolean {
    if (layer.visibility === 'none' || !layer.sourceLayer) return false;
    return layer.type === 'fill' && !!layer.layout &&
        layer.layout.get('fill-elevation-reference') === 'hd-road-base';
}

/// True when every provider-only source has finished loading.
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

/// Sources that contribute elevation and are not also consumers.
export function collectElevationProviderSourceFQIDs(style: Style): Set<string> {
    const consumerFQIDs = collectElevationConsumerSourceFQIDs(style);
    const providers = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (!layer.source || !layerContributesHdRoadElevation(layer)) continue;
        const fqid = makeFQID(layer.source, layer.scope);
        if (consumerFQIDs.has(fqid)) continue;
        providers.add(fqid);
    }
    return providers;
}

/// True when a consumer gets elevation from a different source.
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
}

/// Cached cross-source gate; refreshed on source change and each frame.
export function crossSourceElevationEnabledForStyle(style: Style): boolean {
    return style._crossSourceElevationActive === true;
}

/// Sources whose tiles are scanned to build the cross-source snapshot.
export function collectElevationIngestSourceFQIDs(style: Style): Set<string> {
    const ingest = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (!layer.source || !layerContributesHdRoadElevation(layer)) continue;
        ingest.add(makeFQID(layer.source, layer.scope));
    }
    return ingest;
}

/// Reload hd-road-markup consumer tiles.
/// Only sources with a visible consumer layer are reloaded; showing a hidden
/// layer reloads the source itself.
export function reparseElevationConsumerTiles(
    style: Style,
    shouldReload?: (tile: Tile) => boolean,
    includeSameSourceConsumers?: boolean,
): void {
    const consumerFQIDs = new Set<string>();
    for (const layerId in style._mergedLayers) {
        const layer = style._mergedLayers[layerId];
        if (layer.visibility !== 'none' && layerHasMvtRoadElevation(layer)) {
            consumerFQIDs.add(makeFQID(layer.source, layer.scope));
        }
    }
    if (consumerFQIDs.size === 0) return;
    if (!includeSameSourceConsumers) {
        // Same-source: elevation is parsed from the consumer tile itself.
        const ingestFQIDs = collectElevationIngestSourceFQIDs(style);
        for (const fqid of ingestFQIDs) consumerFQIDs.delete(fqid);
    }
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
    manager: ElevationCoverageManager;
    _needsCrossSourceElevation: boolean;
    _ingestFQIDs: Set<string>;
    _terrainActiveLast: boolean | undefined;

    constructor() {
        this.manager = new ElevationCoverageManager();
        this._needsCrossSourceElevation = false;
        this._ingestFQIDs = new Set();
        this._terrainActiveLast = undefined;
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

/// Clear the snapshot first, then reparse consumers so they do not keep the old elevation.
function deactivateCrossSourceElevation(style: Style): void {
    style._crossSourceElevationActive = false;
    if (crossSourceElevationAlreadyInactive(style)) return;
    const wasActive = !!style._hdElevation && style._hdElevation._needsCrossSourceElevation;
    clearElevationCoverageState(style);
    if (!style._hdElevation) return;
    style._hdElevation._needsCrossSourceElevation = false;
    style._hdElevation._ingestFQIDs.clear();
    style._hdElevation.manager.clear();
    style._hdElevation._terrainActiveLast = undefined;
    if (wasActive) reparseElevationConsumerTiles(style, undefined, true);
}

/// Ingest provider tiles and reparse consumers when cross-source elevation is active.
export function setupAndUpdateElevationCoverage(style: Style): void {
    if (!hasElevationConsumers(style)) {
        deactivateCrossSourceElevation(style);
        return;
    }

    const terrainActive = terrainEnabled(style, style.map && style.map.transform);
    if (!style._hdElevation) style._hdElevation = new HdElevationState();
    const prevTerrainActive = style._hdElevation._terrainActiveLast;
    style._hdElevation._terrainActiveLast = terrainActive;
    const flipped = prevTerrainActive !== undefined && prevTerrainActive !== terrainActive;
    if (flipped) {
        reparseElevationConsumerTiles(style, undefined, true);
    }

    if (terrainActive) {
        if (style.map.painter) style.map.painter.elevationCoverageSnapshot = null;
        return;
    }

    const crossSource = needsCrossSourceElevation(style);
    if (!crossSource) {
        deactivateCrossSourceElevation(style);
        return;
    }

    // First frame with cross-source active and terrain inactive: reparse consumers so they
    // pick up elevation immediately rather than waiting for a snapshot change.
    if (prevTerrainActive === undefined) {
        reparseElevationConsumerTiles(style, undefined, true);
    }

    const state = style._hdElevation;
    state._needsCrossSourceElevation = true;
    style._crossSourceElevationActive = true;
    state._ingestFQIDs = collectElevationIngestSourceFQIDs(style);

    updateElevationCoverage(style, state);
}

/// Ingest provider tiles and reparse consumers whose covering changed.
export function updateElevationCoverage(style: Style, state: HdElevationState) {
    // Active terrain: markup lines drape flat, no snapshot.
    if (terrainEnabled(style, style.map && style.map.transform)) {
        state.manager.clear();
        if (style.map.painter) style.map.painter.elevationCoverageSnapshot = null;
        return;
    }

    if (!state._needsCrossSourceElevation) {
        clearElevationCoverageState(style);
        return;
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
