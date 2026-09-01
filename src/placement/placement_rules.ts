import type {SymbolVariantId} from './types';

// More complex collision rules to be added later
// https://docs.google.com/document/d/1FlJVwpQ8K7kq4qRTlZPktEawGgIiX3iV6cGshO8gsqo/edit?tab=t.50jxdmq297xl#heading=h.xslrpreq4esf
export type CollisionRules = {
    // May contain the id of either a mandatory part or an optional text part
    symbolVariantToIgnoreCollisionWith?: SymbolVariantId;
    // If set, this variant is only eligible for placement if the referenced SymbolVariantId
    // was placed in the same placement run.
    // A reference to a variant from a different run does not make this variant eligible.
    onlyIfPlaced?: SymbolVariantId;
};

export type PlacementRules = {
    // Undefined if `*-allow-overlap` is true.
    // If present, we check collisions with previously placed symbol variants.
    collisionRules?: CollisionRules;
    // Inverted `*-ignore-placement` value.
    // If false, all later placed symbol variants will ignore this symbol variant
    // even if it's visible.
    insertIntoCollisionGrid: boolean;
};

export function defaultPlacementRules(): PlacementRules {
    return {collisionRules: {}, insertIntoCollisionGrid: true};
}
