import type {Geometry} from './geometry';
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

export type PlacementDebugSymbol = {
    geometry: Geometry;
    variantId: SymbolVariantId;
    status: VariantPlacementResultValue;
};
