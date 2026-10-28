import KDBush from 'kdbush';
import EXTENT from '../style-spec/data/extent';
import SymbolBucket from '../data/bucket/symbol_bucket';
import {calculateKey} from '../source/tile_id';

import type Tile from '../source/tile';
import type {CanonicalTileID, OverscaledTileID} from '../source/tile_id';

/**
 * Spatial and stable id lookup of the symbols of one symbol bucket, used to find the same symbol
 * in a bucket of a related tile. Stores the symbol's index in its bucket, which together with the
 * bucket is all that is needed to read or write its placement state.
 * @private
 */
export class BucketSymbolIndex {
    bucket: SymbolBucket;
    index: KDBush;
    keys: Array<number>;
    indices: Array<number>;
    stableIdMap: Map<number, number>;
    canonical: CanonicalTileID;

    constructor(bucket: SymbolBucket, canonical: CanonicalTileID) {
        this.bucket = bucket;
        this.canonical = canonical;
        this.keys = [];
        this.indices = [];
        this.stableIdMap = new Map();

        const instances = bucket.symbolInstances;
        const points: Array<number> = [];

        for (let i = 0; i < instances.length; i++) {
            const stableId = bucket.stableIdFor(i);
            if (stableId !== undefined) {
                this.stableIdMap.set(stableId, i);
                continue;
            }
            const {key, tileAnchorX, tileAnchorY} = instances.get(i);
            points.push(tileAnchorX, tileAnchorY);
            this.keys.push(key);
            this.indices.push(i);
        }

        // Low nodeSize: optimized for search, not indexing
        this.index = new KDBush(this.indices.length, 16);
        for (let i = 0; i < points.length; i += 2) this.index.add(points[i], points[i + 1]);
        this.index.finish();
    }

    // Index in this bucket of the same symbol as `target`'s instance at `targetIndex`, laid out in
    // the tile `targetCanonical`, or -1. Symbols with a stable id are matched by it only; the rest by
    // key within the cells of this tile covered by the anchor's cell. `matched` holds the symbols of
    // this bucket already matched in the same operation, which are skipped so that each is matched
    // at most once; the returned one is added to it.
    findMatch(target: SymbolBucket, targetIndex: number, targetCanonical: CanonicalTileID, matched: Set<number>): number {
        const stableId = target.stableIdFor(targetIndex);
        if (stableId !== undefined) {
            const match = this.stableIdMap.get(stableId);
            if (match === undefined || matched.has(match)) return -1;
            matched.add(match);
            return match;
        }

        const scale = Math.pow(2, this.canonical.z - targetCanonical.z);
        const {key, tileAnchorX, tileAnchorY} = target.symbolInstances.get(targetIndex);
        const x = targetCanonical.x * EXTENT + tileAnchorX;
        const y = targetCanonical.y * EXTENT + tileAnchorY;
        // A coordinate names the cell [n, n + 1) and is encoded with floor, so the anchor's cell
        // covers exactly these cells of this tile: one if this tile is coarser, 2^zDiff per axis if finer
        const minX = Math.floor(x * scale) - this.canonical.x * EXTENT;
        const minY = Math.floor(y * scale) - this.canonical.y * EXTENT;
        const maxX = Math.ceil((x + 1) * scale) - 1 - this.canonical.x * EXTENT;
        const maxY = Math.ceil((y + 1) * scale) - 1 - this.canonical.y * EXTENT;

        // KDBush.range doesn't return ids in insertion order; take the lowest matching one so the
        // result doesn't depend on the tree layout
        let best = -1;
        for (const id of this.index.range(minX, minY, maxX, maxY)) {
            if (this.keys[id] === key && !matched.has(this.indices[id]) && (best < 0 || id < best)) best = id;
        }
        if (best < 0) return -1;
        matched.add(this.indices[best]);
        return this.indices[best];
    }
}

// A zoom level of rendered tiles: the overscaled zoom and the canonical zoom laid out at it
type ZoomLevel = {
    overscaledZ: number;
    z: number;
};

type TileRelationEntry = {
    tile: Tile;
    // One per symbol bucket, keyed by the bucket's owning layer (bucket.layerIds[0])
    buckets: Map<string, BucketSymbolIndex>;
    // Whether the tile was held for fading as of the last sync
    held: boolean;
};

// Tiles by key, with the zoom levels they are at, finest first
type TileLookup = {
    byKey: Map<number, TileRelationEntry>;
    zooms: Array<ZoomLevel>;
};

// Built from the tiles' current ids whenever needed rather than kept, since a wrap jump changes them
function createLookup(entries: Iterable<TileRelationEntry>): TileLookup {
    const byKey = new Map<number, TileRelationEntry>();
    const zooms: Array<ZoomLevel> = [];
    for (const entry of entries) {
        const {key, overscaledZ, canonical} = entry.tile.tileID;
        byKey.set(key, entry);
        if (!zooms.some((zoom) => zoom.overscaledZ === overscaledZ && zoom.z === canonical.z)) zooms.push({overscaledZ, z: canonical.z});
    }
    zooms.sort((a, b) => b.overscaledZ - a.overscaledZ);
    return {byKey, zooms};
}

function createLookups(entries: Iterable<TileRelationEntry>): {owning: TileLookup, held: TileLookup} {
    const owning: Array<TileRelationEntry> = [];
    const held: Array<TileRelationEntry> = [];
    for (const entry of entries) (entry.held ? held : owning).push(entry);
    return {owning: createLookup(owning), held: createLookup(held)};
}

// Key of the tile at `level` covering the point (x, y) of the tile `tileID`
function keyAt(tileID: OverscaledTileID, x: number, y: number, level: ZoomLevel): number {
    const {canonical} = tileID;
    const scale = Math.pow(2, level.z - canonical.z) / EXTENT;
    const tx = Math.floor((canonical.x * EXTENT + x) * scale);
    const ty = Math.floor((canonical.y * EXTENT + y) * scale);
    return calculateKey(tileID.wrap, level.overscaledZ, level.z, tx, ty);
}

// Finest tile of `lookup` covering the point (x, y) of the tile `tileID`, among the levels coarser
// than `belowZ`. Symbol anchors lie inside their own tile (see addSymbolAtAnchor), so with
// `belowZ` set to the tile's own zoom, any anchor gives the tile's nearest ancestor.
function finestCovering(lookup: TileLookup, tileID: OverscaledTileID, x: number, y: number, belowZ: number = Infinity): TileRelationEntry | undefined {
    for (const level of lookup.zooms) {
        if (level.overscaledZ >= belowZ) continue;
        const entry = lookup.byKey.get(keyAt(tileID, x, y, level));
        if (entry) return entry;
    }
    return undefined;
}

function nearestAncestor(lookup: TileLookup, tileID: OverscaledTileID): TileRelationEntry | undefined {
    return finestCovering(lookup, tileID, 0, 0, tileID.overscaledZ);
}

/**
 * Ownership of the map's area between the rendered tiles of one source, used by global placement.
 *
 * Every point of the map is owned by the finest rendered tile covering it, and only the owner
 * feeds the symbols anchored there to placement (see SymbolBucket#nonOwnedSymbols). When the owner of an area
 * changes -- a tile is added, removed or laid out again -- the new owner's symbols continue the
 * placement state of the same symbols in the previous owner.
 *
 * Tiles of different wrap values are different copies of the world, placed separately, so state is
 * never shared between them.
 *
 * Kept in sync by SourceCache; keyed by tile uid, which unlike the tile key survives wrap jumps.
 * @private
 */
export class TilePlacementRelationsIndex {
    entries: Map<number, TileRelationEntry>;

    constructor() {
        this.entries = new Map();
    }

    clear() {
        this.entries.clear();
    }

    // Brings the index in line with `tiles`, the source's rendered tiles. Cheap when nothing changed.
    sync(tiles: ReadonlyArray<Tile>) {
        // 1. Relayout: the new buckets continue the state of their own previous version only. Symbols
        // it doesn't have are left to the migration below. Added tiles are indexed without state.
        const current = new Map<number, TileRelationEntry>();
        const added: Array<TileRelationEntry> = [];
        const relayouted = new Map<TileRelationEntry, Map<string, Uint8Array>>();
        const holdChanged: Array<TileRelationEntry> = [];
        for (const tile of tiles) {
            let entry = this.entries.get(tile.uid);
            if (entry) {
                const unmatched = this._updateBuckets(entry);
                if (unmatched) relayouted.set(entry, unmatched);
                if (entry.held !== tile.holdingForFade()) holdChanged.push(entry);
            } else {
                entry = {tile, buckets: this._indexBuckets(tile), held: tile.holdingForFade()};
                added.push(entry);
            }
            current.set(tile.uid, entry);
        }
        const removed: Array<TileRelationEntry> = [];
        for (const [uid, entry] of this.entries) {
            if (!current.has(uid)) removed.push(entry);
        }
        if (added.length === 0 && removed.length === 0 && relayouted.size === 0 && holdChanged.length === 0) return;

        const before = createLookups(this.entries.values());
        for (const entry of holdChanged) entry.held = !entry.held;
        const after = createLookups(current.values());

        // A tile that starts owning area is like an added one, a tile that stops like a removed one
        const startedOwning = added.filter((entry) => !entry.held);
        const stoppedOwning = removed.filter((entry) => !entry.held);
        for (const entry of holdChanged) (entry.held ? stoppedOwning : startedOwning).push(entry);

        // 2. Migrate: every tile that now owns area it didn't own before continues the state of the
        // area's previous owner, directly, however many levels apart they are. The tiles whose owned
        // symbols may have changed get their non owned symbols marked again.
        const gaining = new Set<TileRelationEntry>(startedOwning);
        const ownershipChanged = new Set<TileRelationEntry>(startedOwning);
        for (const entry of relayouted.keys()) {
            if (!entry.held) ownershipChanged.add(entry);
        }
        for (const entry of stoppedOwning) {
            const owner = nearestAncestor(after.owning, entry.tile.tileID);
            if (owner) gaining.add(owner);
        }
        // The nearest ancestor of a tile that starts or stops owning area owns different area. It
        // covers the whole tile, so the coarser ancestors own none of that area either way.
        for (const entry of [...startedOwning, ...stoppedOwning]) {
            const ancestor = nearestAncestor(after.owning, entry.tile.tileID);
            if (ancestor) ownershipChanged.add(ancestor);
        }
        for (const [entry, unmatched] of relayouted) {
            if (!entry.held && unmatched.size > 0) gaining.add(entry);
        }
        for (const entry of gaining) this._migrate(entry, before, after.owning, relayouted.get(entry));

        // 3. Commit: drop the removed tiles
        this.entries = current;

        for (const entry of ownershipChanged) this._markNonOwned(entry, after.owning);
    }

    _indexBuckets(tile: Tile): Map<string, BucketSymbolIndex> {
        const buckets = new Map<string, BucketSymbolIndex>();
        for (const id in tile.buckets) {
            const bucket = tile.buckets[id];
            if (!(bucket instanceof SymbolBucket) || bucket.layerIds[0] !== id) continue;
            buckets.set(id, new BucketSymbolIndex(bucket, tile.tileID.canonical));
        }
        return buckets;
    }

    // A relayout replaces a tile's buckets: index the new ones and let them continue the state of
    // the old ones. Returns null if no bucket was added or replaced. Otherwise returns, by layer id, one flag per
    // symbol of each changed bucket that has new symbols: 1 if its old version doesn't have the
    // symbol, 0 if the symbol continues the old version's state.
    _updateBuckets(entry: TileRelationEntry): Map<string, Uint8Array> | null {
        const tile = entry.tile;
        const canonical = tile.tileID.canonical;
        const previous = entry.buckets;
        let changed = false;
        const unmatched = new Map<string, Uint8Array>();
        const next = new Map<string, BucketSymbolIndex>();
        for (const id in tile.buckets) {
            const bucket = tile.buckets[id];
            if (!(bucket instanceof SymbolBucket) || bucket.layerIds[0] !== id) continue;
            const old = previous.get(id);
            if (old && old.bucket === bucket) {
                next.set(id, old);
                continue;
            }
            changed = true;
            next.set(id, new BucketSymbolIndex(bucket, canonical));
            const mask = new Uint8Array(bucket.symbolInstances.length);
            const matched = new Set<number>();
            for (let i = 0; i < mask.length; i++) {
                const match = old ? old.findMatch(bucket, i, canonical, matched) : -1;
                if (match < 0) mask[i] = 1;
                else bucket.takePlacementStateFrom(old.bucket, match, i);
            }
            if (mask.includes(1)) unmatched.set(id, mask);
        }
        if (changed || next.size !== previous.size) entry.buckets = next;
        return changed ? unmatched : null;
    }

    // Lets the symbol `i` of `bucket`, laid out in `tileID`, continue the placement state of the same
    // symbol in `source`, unless that one is already in `matched`, the symbols taken so far by source
    // bucket. Returns whether it took any state: a copy that is hidden and not fading has none.
    _takeState(source: TileRelationEntry, layerId: string, bucket: SymbolBucket, i: number, tileID: OverscaledTileID, matched: Map<BucketSymbolIndex, Set<number>>): boolean {
        const index = source.buckets.get(layerId);
        if (!index) return false;
        let taken = matched.get(index);
        if (!taken) {
            taken = new Set();
            matched.set(index, taken);
        }
        const match = index.findMatch(bucket, i, tileID.canonical, taken);
        if (match < 0) return false;
        return bucket.takePlacementStateFrom(index.bucket, match, i);
    }

    // Marks the symbols of `entry` that a rendered descendant owns (see SymbolBucket#nonOwnedSymbols)
    _markNonOwned(entry: TileRelationEntry, lookup: TileLookup) {
        const tileID = entry.tile.tileID;
        for (const {bucket} of entry.buckets.values()) {
            bucket.ensurePlacementState();
            const mask = bucket.nonOwnedSymbols;
            for (let i = 0; i < mask.length; i++) {
                const {tileAnchorX, tileAnchorY} = bucket.symbolInstances.get(i);
                mask[i] = finestCovering(lookup, tileID, tileAnchorX, tileAnchorY) !== entry ? 1 : 0;
            }
        }
    }

    // Lets the symbols `entry` now owns continue the placement state of the same symbols in the
    // tiles that covered their anchor before, taking the first copy that is visible or fading: the
    // previous owner (an old ancestor or a removed or now held descendant), then the coarser tiles
    // that rendered there, whose copies placement may still be fading out, then the held tiles,
    // finest first. For the `unmatched` symbols of relaid out buckets, which their previous version
    // doesn't have, `entry` itself is skipped. A symbol a rendered descendant owns is left
    // alone: the descendant shows it, placement keeps this copy hidden, and it continues the
    // descendant's state only once the descendant stops rendering. Seeding it as visible would draw
    // the label twice while placement fades this copy out.
    _migrate(entry: TileRelationEntry, before: {owning: TileLookup, held: TileLookup}, after: TileLookup, unmatched?: Map<string, Uint8Array>) {
        const tileID = entry.tile.tileID;
        for (const [layerId, target] of entry.buckets) {
            const bucket = target.bucket;
            const newSymbols = unmatched ? unmatched.get(layerId) : undefined;
            const matched = new Map<BucketSymbolIndex, Set<number>>();
            for (let i = 0; i < bucket.symbolInstances.length; i++) {
                const {tileAnchorX, tileAnchorY} = bucket.symbolInstances.get(i);
                if (finestCovering(after, tileID, tileAnchorX, tileAnchorY) !== entry) continue;
                // Owned it before too: only a symbol new in the relayout has state elsewhere, in
                // an ancestor's copy or a held tile's
                const isNew = newSymbols && newSymbols[i] === 1;
                if (!isNew && finestCovering(before.owning, tileID, tileAnchorX, tileAnchorY) === entry) continue;
                // A copy in a tile that still renders is hidden at once rather than left for
                // placement to fade out while this one is already shown
                let taken = false;
                for (const level of before.owning.zooms) {
                    const owner = before.owning.byKey.get(keyAt(tileID, tileAnchorX, tileAnchorY, level));
                    if (owner && owner !== entry && this._takeState(owner, layerId, bucket, i, tileID, matched)) {
                        taken = true;
                        break;
                    }
                }
                if (taken) continue;
                // No rendered tile has a live copy, e.g. the area was left to a held tile only: take
                // over the held copy instead of fading in beside it while it fades out
                for (const level of before.held.zooms) {
                    const held = before.held.byKey.get(keyAt(tileID, tileAnchorX, tileAnchorY, level));
                    if (held && held !== entry && this._takeState(held, layerId, bucket, i, tileID, matched)) break;
                }
            }
        }
    }
}
