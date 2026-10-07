import type {SymbolVariantId} from './types';

// More complex collision rules to be added later
// https://docs.google.com/document/d/1FlJVwpQ8K7kq4qRTlZPktEawGgIiX3iV6cGshO8gsqo/edit?tab=t.50jxdmq297xl#heading=h.xslrpreq4esf
export type CollisionRules = {
    // May contain the id of either a mandatory part or an optional text part.
    // Covers every part of the referenced variant: parts have no ids of their own.
    symbolVariantToIgnoreCollisionWith?: SymbolVariantId;
};

// Rules applied to a symbol variant as a whole.
// Rules that depend on a variant part's geometry live in PartPlacementRules.
export type PlacementRules = {
    // If set, this variant is only eligible for placement if the referenced SymbolVariantId
    // was placed in the same placement run.
    // A reference to a variant from a different run does not make this variant eligible.
    //
    // The referenced variant has to be placed before this one, so it must either have a higher
    // GlobalPlacementPriority, or an equal one and be passed to the run earlier.
    onlyIfPlaced?: SymbolVariantId;
};

// Rules applied to a single part of a symbol variant.
// A variant is placed as a whole, so a part that fails its rules hides every part of the variant.
export type PartPlacementRules = {
    // Undefined if `*-allow-overlap` is true.
    // If present, we check collisions with previously placed symbol variants.
    collisionRules?: CollisionRules;
    // Inverted `*-ignore-placement` value.
    // If false, all later placed symbol variants will ignore this part
    // even if it's visible.
    insertIntoCollisionGrid: boolean;
};

export function defaultPlacementRules(): PlacementRules {
    return {};
}

export function defaultPartPlacementRules(): PartPlacementRules {
    return {collisionRules: {}, insertIntoCollisionGrid: true};
}
