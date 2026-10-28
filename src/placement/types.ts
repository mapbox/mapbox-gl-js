/**
 * Identity of a specific variant of a symbol: distinguishes alternatives of the same symbol,
 * either different text-variable-anchor values or upcoming alternatives.
 * https://docs.google.com/document/d/1FlJVwpQ8K7kq4qRTlZPktEawGgIiX3iV6cGshO8gsqo/edit?tab=t.50jxdmq297xl#heading=h.v0ilikc309b9
 *
 * Parts of a symbol are not variants: mandatory parts are the parts of one variant
 * (GlobalPlacement#addSymbolVariantPart), while an optional text/icon part (for layers with
 * *-optional: true) is a separate symbol tied to the mandatory one by PlacementRules.onlyIfPlaced.
 */
export type SymbolVariantId = {
    // Unique among the symbols fed to placement, generated from the symbol's bucket instance and
    // its index in the bucket
    symbolId: number;
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
