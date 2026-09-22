import type Point from '@mapbox/point-geometry';

// Origin of a symbol's identity: whether it was reused from a source feature ID or
// generated because the feature had no stable ID of its own.
export const SymbolIdOrigin = {
    REUSED_FROM_SOURCE_FEATURE: 0,
    GENERATED: 1,
} as const;

export type SymbolIdOriginValue = typeof SymbolIdOrigin[keyof typeof SymbolIdOrigin];

/**
 * Unique ID of a symbol within an origin (see SymbolIdOrigin).
 *
 * Used to determine if a different variant of a symbol or the same symbol from a different
 * tile (including tiles from different zoom levels) was placed.
 *
 * Generated as follows:
 * - Feature has an ID and a source layer doesn't have repeated IDs for different features
 *   - Feature has a multipoint geometry
 *       We generate a unique ID for each point.
 *   - Symbols are repeated along/within a feature geometry
 *     - Features have additional metrics
 *         We generate a unique ID for each repetition.
 *     - Otherwise
 *         IDs are generated only if symbols have alternatives, as such symbols are never placed
 *         behind tile borders. Symbols are not stable across zoom levels.
 *   - Feature ID is a number
 *       We use it directly.
 *   - Otherwise
 *       We generate a unique ID.
 * - Otherwise
 *   - Symbol positions are fixed, i.e. a feature has a point or multipoint geometry,
 *     or anchor position is calculated stably from a feature geometry, like for symbols
 *     placed at line middle points
 *       We generate a unique ID.
 *       We will try to find matching features in parent/child tiles based on geometry and other
 *       parameters, but we can't guarantee the result. If we fail, symbols will not preserve visibility
 *       when switching between tiles from different zoom levels, and they may be displayed twice
 *       if both parent and child tiles are displayed at the same time.
 *   - Otherwise
 *       IDs are generated only if symbols have alternatives, as such symbols are never placed
 *       behind tile borders.
 *       Symbols do not preserve visibility when switching between tiles from different zoom levels,
 *       and they may be displayed twice if both parent and child tiles are displayed at the same time.
 */
export type SymbolId = {
    styleLayerId: number;
    symbolIdOrigin: SymbolIdOriginValue;
    symbolId: number;
};

// Stub: no symbol has a stable id yet. Should return `id.symbolIdOrigin === SymbolIdOrigin.REUSED_FROM_SOURCE_FEATURE`
// once addToPlacement can actually produce that origin (see the doc comment above).
export function hasStableId(id: SymbolId): boolean {
    return false;
}

/**
 * A rectangle in a tile's own [0, EXTENT) local space, e.g. the area of a parent tile covered by a
 * loaded child tile.
 */
export type TileCoverageRect = {
    min: Point;
    max: Point;
};

/**
 * Identity of a specific variant (alternative, or optional icon/text part) of a symbol.
 */
export type SymbolVariantId = {
    symbolId: SymbolId;
    variantIdx: number;
};

/**
 * Symbols repeated along line/polygon geometry are placed after symbols with a fixed
 * position that share the same priority and prior visibility
 */
export const SymbolPlacementType = {
    REPEATED: 0,
    FIXED: 1,
} as const;

export type SymbolPlacementTypeValue = typeof SymbolPlacementType[keyof typeof SymbolPlacementType];

// Ordered low-to-high: a variant that was already fully visible outranks one whose
// symbol was visible but this variant wasn't, which outranks one that wasn't visible
// at all. See `comparePriority` in global_placement_priority.ts.
export const SymbolVariantVisibility = {
    SYMBOL_INVISIBLE: 0,
    SYMBOL_VISIBLE_VARIANT_INVISIBLE: 1,
    VARIANT_VISIBLE: 2,
} as const;

export type SymbolVariantVisibilityValue = typeof SymbolVariantVisibility[keyof typeof SymbolVariantVisibility];
