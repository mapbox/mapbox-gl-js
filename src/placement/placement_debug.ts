import type {Geometry} from './geometry';
import type {PlacementRules} from './placement_rules';
import type {SymbolVariantId} from './types';

export const VariantPlacementResult = {
    /** Visible: successfully placed. */
    PLACED: 0,
    /** Hidden: collides with an already placed symbol of higher priority. */
    COLLIDED: 1,
    /**
     * Hidden: another variant of the same symbol, or the same symbol from another tile,
     * won the placement, so this one cannot be shown.
     */
    OTHER_VARIANT_PLACED: 2,
    /** Hidden: the variant this one is tied to via `CollisionRules.onlyIfPlaced` was not placed. */
    DEPENDENCY_NOT_PLACED: 3,
    /** Hidden: the variant's geometry lies outside the placement bounds. */
    OUT_OF_BOUNDS: 4,
} as const;

export type VariantPlacementResultValue = typeof VariantPlacementResult[keyof typeof VariantPlacementResult];

// Since ../source/tile_id is not part of the strict-typechecked list but this one is, if we
// import OverscaledTileID, which is what we actually need, we get a bunch of errors.
// eslint-disable-next-line no-warning-comments
// TODO: Remove and replace with OverscaledTileID once the strict-typechecked list
// includes '../source/tile_id'.
export type TileIdentity = {
    overscaledZ: number;
    wrap: number;
    canonical: {z: number; x: number; y: number};
};

export type PlacementDebugSymbol = {
    // For a visible (PLACED) variant, this is its unpadded collision geometry. For any other
    // variant, it's padded by the same collision geometry used for the actual hit test
    geometry: Geometry;
    variantId: SymbolVariantId;
    tileID: TileIdentity;
    // The real source feature id, if one could be resolved; absent for generated/synthetic ids.
    featureId?: string | number;
    // Snapshot of the collision settings this variant was placed under.
    placementRules: PlacementRules;
    status: VariantPlacementResultValue;
    // The other variant that caused this one to be hidden. Only meaningful (and only ever set)
    // for COLLIDED (the variant it geometrically hit) and OTHER_VARIANT_PLACED (the sibling
    // variant of the same symbol that won). The other statuses are already fully explained by
    // `status` plus `placementRules.collisionRules.onlyIfPlaced`.
    blockedBy?: SymbolVariantId;
};
