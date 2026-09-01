import assert from '../style-spec/util/assert';
import {CollisionGrid} from './collision_grid';
import {comparePriority} from './global_placement_priority';
import {SymbolVariantVisibility} from './types';

import type {GeometryElement} from './geometry';
import type {GlobalPlacementPriority} from './global_placement_priority';
import type {PlacementRules} from './placement_rules';
import type {SymbolSource} from './symbol_source';
import type {SymbolId, SymbolVariantId} from './types';

/**
 * Collision grid padding (in pixels) around the viewport. Allows symbols in the
 * viewport to collide with symbols in the padded buffer, improving placement
 * stability during viewport movement.
 *
 * Larger values improve stability at viewport boundaries but increase memory usage
 * and placement computation time with diminishing returns.
 */
const GRID_PADDING = 100;
const GRID_CELL_SIZE = 32;

const INVISIBLE_VARIANTS_COLLISION_PADDING = 1;
const VISIBLE_VARIANTS_COLLISION_PADDING = 0;

/**
 * Combines `styleLayerId` and `symbolIdOrigin` into a single safe-integer map key.
 * Unlike `symbolId` (which may be up to Number.MAX_SAFE_INTEGER) both
 * inputs here are small and bounded, so we can create a key without hashing
 */
function layerOriginKey(id: SymbolId): number {
    assert(id.styleLayerId >= 0 && id.styleLayerId < Number.MAX_SAFE_INTEGER / 2);
    return id.styleLayerId * 2 + id.symbolIdOrigin;
}

function symbolVariantIdEquals(a: SymbolVariantId, b: SymbolVariantId): boolean {
    return a.variantIdx === b.variantIdx &&
        a.symbolId.styleLayerId === b.symbolId.styleLayerId &&
        a.symbolId.symbolIdOrigin === b.symbolId.symbolIdOrigin &&
        a.symbolId.symbolId === b.symbolId.symbolId;
}

function symbolIdEquals(a: SymbolId, b: SymbolId): boolean {
    return a.styleLayerId === b.styleLayerId &&
        a.symbolIdOrigin === b.symbolIdOrigin &&
        a.symbolId === b.symbolId;
}

// layerOriginKey(symbolId) -> symbolId.symbolId -> Set<variantIdx>
type VariantIdSet = Map<number, Map<number, Set<number>>>;

function hasVariantId(set: VariantIdSet, id: SymbolVariantId): boolean {
    const bySymbolId = set.get(layerOriginKey(id.symbolId));
    if (!bySymbolId) return false;
    const byVariantIdx = bySymbolId.get(id.symbolId.symbolId);
    return byVariantIdx !== undefined && byVariantIdx.has(id.variantIdx);
}

function addVariantId(set: VariantIdSet, id: SymbolVariantId) {
    const key = layerOriginKey(id.symbolId);
    let bySymbolId = set.get(key);
    if (!bySymbolId) {
        bySymbolId = new Map();
        set.set(key, bySymbolId);
    }
    let byVariantIdx = bySymbolId.get(id.symbolId.symbolId);
    if (!byVariantIdx) {
        byVariantIdx = new Set();
        bySymbolId.set(id.symbolId.symbolId, byVariantIdx);
    }
    byVariantIdx.add(id.variantIdx);
}

type SymbolInfo = {
    priority: GlobalPlacementPriority;
    source: SymbolSource;
    variantId: SymbolVariantId;
    // Streamed in via addGeometry() between startSymbolVariantProcessing() and
    // finishVariantProcessing().
    geometry: Array<GeometryElement>;
    placementRules: PlacementRules;
};

/**
 * Decides symbol visibility purely from a `GlobalPlacementPriority` instead of ayer z-order.
 *
 * Must call `finishPlacementRun()` explicitly before the next `startPlacement` call,
 * `finishSourceProcessing()` before the next `startSymbolSourceProcessing` call, and
 * `finishVariantProcessing()` before the next `startSymbolVariantProcessing` call.
 *
 * Example:
 * ```
 * const placement = new GlobalPlacement();
 * placement.startPlacement(timestamp, screenWidth, screenHeight);
 * for (const layer of layerRenderItems) layer.placeSymbols(placement);
 * placement.finishPlacementRun();
 * ```
 * Later, within a bucket:
 * ```
 * placement.startSymbolSourceProcessing(source);
 * for (const symbolVariant of symbolVariants) {
 *     placement.startSymbolVariantProcessing(...);
 *     for (const geometryElement of symbolVariant.geometry) placement.addGeometry(geometryElement);
 *     placement.finishVariantProcessing();
 * }
 * placement.finishSourceProcessing();
 * ```
 */
export class GlobalPlacement {
    _runStarted: boolean;
    _grid: CollisionGrid<SymbolVariantId> | null;
    _timestamp: number;
    _symbols: Array<SymbolInfo>;
    _ignoredSymbolVariantIds: VariantIdSet;
    // If set, this variant's onlyIfPlaced must be one of these to be eligible for placement.
    // Only ids actually referenced by an onlyIfPlaced rule are tracked here.
    _onlyIfPlacedReferencedIds: VariantIdSet;
    _placedVariantIds: VariantIdSet;
    // layerOriginKey(symbolId) -> Set<symbolId.symbolId>
    _placedSymbolIds: Map<number, Set<number>>;
    _processingSource: SymbolSource | null;
    // The variant currently streaming geometry in is always the last entry of _symbols.
    _variantProcessingStarted: boolean;

    constructor() {
        this._runStarted = false;
        this._grid = null;
        this._timestamp = 0;
        this._symbols = [];
        this._ignoredSymbolVariantIds = new Map();
        this._onlyIfPlacedReferencedIds = new Map();
        this._placedVariantIds = new Map();
        this._placedSymbolIds = new Map();
        this._processingSource = null;
        this._variantProcessingStarted = false;
    }

    startPlacement(timestamp: number, screenWidth: number, screenHeight: number) {
        if (this._runStarted) throw new Error('Attempt to start a placement run before finishing the previous one');
        this._runStarted = true;

        if (this._grid) {
            this._grid.clearAndResize(screenWidth, screenHeight);
        } else {
            this._grid = new CollisionGrid<SymbolVariantId>(screenWidth, screenHeight, GRID_PADDING, GRID_CELL_SIZE);
        }
        this._timestamp = timestamp;
        this._symbols = [];
        this._ignoredSymbolVariantIds.clear();
        this._onlyIfPlacedReferencedIds.clear();
        this._placedVariantIds.clear();
        this._placedSymbolIds.clear();
    }

    _hasPlacedSymbol(id: SymbolId): boolean {
        const bySymbolId = this._placedSymbolIds.get(layerOriginKey(id));
        return bySymbolId !== undefined && bySymbolId.has(id.symbolId);
    }

    _addPlacedSymbol(id: SymbolId) {
        const key = layerOriginKey(id);
        let bySymbolId = this._placedSymbolIds.get(key);
        if (!bySymbolId) {
            bySymbolId = new Set();
            this._placedSymbolIds.set(key, bySymbolId);
        }
        bySymbolId.add(id.symbolId);
    }

    startSymbolSourceProcessing(source: SymbolSource) {
        if (!this._runStarted) throw new Error('Attempt to start symbol source processing outside of a placement run');
        if (this._processingSource) throw new Error('Attempt to start a placement symbol source processing before finishing the previous one');

        this._processingSource = source;
    }

    startSymbolVariantProcessing(variantId: SymbolVariantId, priority: GlobalPlacementPriority, placementRules: PlacementRules) {
        const source = this._processingSource;
        if (!source) throw new Error('Attempt to start a symbol variant processing outside of symbol source processing');
        if (this._variantProcessingStarted) throw new Error('Attempt to begin a symbol variant processing before finishing the previous one');

        this._symbols.push({priority, source, variantId, geometry: [], placementRules});

        const rules = placementRules.collisionRules;
        if (rules) {
            if (rules.symbolVariantToIgnoreCollisionWith) addVariantId(this._ignoredSymbolVariantIds, rules.symbolVariantToIgnoreCollisionWith);
            if (rules.onlyIfPlaced) {
                assert(!symbolIdEquals(rules.onlyIfPlaced.symbolId, variantId.symbolId));
                addVariantId(this._onlyIfPlacedReferencedIds, rules.onlyIfPlaced);
            }
        }

        this._variantProcessingStarted = true;
    }

    // Adds one geometry element to the variant started by startSymbolVariantProcessing(). Geometry
    // is expressed in logical (device-independent) screen pixels, the same space as startPlacement's
    // screenWidth/screenHeight.
    addGeometry(geometryElement: GeometryElement) {
        if (!this._variantProcessingStarted) throw new Error('Attempt to add geometry outside of symbol variant processing');
        this._symbols.at(-1)!.geometry.push(geometryElement);
    }

    finishVariantProcessing() {
        if (!this._variantProcessingStarted) throw new Error('Attempt to finish a symbol variant processing that was not started');
        this._variantProcessingStarted = false;

        const symbol = this._symbols.at(-1)!;
        if (symbol.geometry.length === 0) {
            // A begun variant can receive no geometry (every element culled, or dynamically generated
            // geometry that turns out empty). It cannot be placed, so a currently-visible variant has to
            // be hidden here: finishPlacementRun never sees a dropped symbol and would otherwise leave it
            // visible forever without any collision box in the grid.
            if (symbol.priority.symbolVariantVisibility === SymbolVariantVisibility.VARIANT_VISIBLE) {
                symbol.source.hideSymbolVariant(symbol.variantId, this._timestamp);
            }
            this._symbols.pop();
        }
    }

    finishSourceProcessing() {
        this._processingSource = null;
    }

    finishPlacementRun() {
        if (!this._runStarted) throw new Error('Attempt to finish a placement run that was not started');
        this._runStarted = false;

        const grid = this._grid!;
        const timestamp = this._timestamp;

        this._symbols.sort((a, b) => comparePriority(b.priority, a.priority));

        for (const symbol of this._symbols) {
            const wasVisible = symbol.priority.symbolVariantVisibility === SymbolVariantVisibility.VARIANT_VISIBLE;

            let visible = true;
            if (this._hasPlacedSymbol(symbol.variantId.symbolId)) {
                visible = false;
            } else if (symbol.placementRules.collisionRules) {
                const onlyIfPlaced = symbol.placementRules.collisionRules.onlyIfPlaced;
                if (onlyIfPlaced && !hasVariantId(this._placedVariantIds, onlyIfPlaced)) {
                    visible = false;
                } else {
                    const ignoreVariantId = symbol.placementRules.collisionRules.symbolVariantToIgnoreCollisionWith;
                    const intersectionResult = grid.intersects(
                        symbol.geometry,
                        wasVisible ? VISIBLE_VARIANTS_COLLISION_PADDING : INVISIBLE_VARIANTS_COLLISION_PADDING,
                        (data) => ignoreVariantId !== undefined && symbolVariantIdEquals(data, ignoreVariantId)
                    );
                    if (intersectionResult !== 'does-not-intersect') visible = false;
                }
            }

            if (visible && symbol.placementRules.insertIntoCollisionGrid) {
                const data = hasVariantId(this._ignoredSymbolVariantIds, symbol.variantId) ? symbol.variantId : undefined;
                if (!grid.insert(symbol.geometry, data)) visible = false;
            }

            if (visible) {
                this._addPlacedSymbol(symbol.variantId.symbolId);
                if (hasVariantId(this._onlyIfPlacedReferencedIds, symbol.variantId)) addVariantId(this._placedVariantIds, symbol.variantId);
            }

            if (wasVisible !== visible) {
                if (visible) symbol.source.showSymbolVariant(symbol.variantId, timestamp);
                else symbol.source.hideSymbolVariant(symbol.variantId, timestamp);
            }
        }
    }
}
