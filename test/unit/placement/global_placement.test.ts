import {describe, test, expect, vi} from '../../util/vitest';
import {GlobalPlacement} from '../../../src/placement/global_placement';
import {defaultPlacementRules, defaultPartPlacementRules} from '../../../src/placement/placement_rules';
import {VariantPlacementResult} from '../../../src/placement/placement_debug';
import {SymbolIdOrigin, SymbolPlacementType, SymbolVariantVisibility} from '../../../src/placement/types';
import {OverscaledTileID} from '../../../src/source/tile_id';

import type {Geometry} from '../../../src/placement/geometry';
import type {GlobalPlacementPriority} from '../../../src/placement/global_placement_priority';
import type {PartPlacementRules, PlacementRules} from '../../../src/placement/placement_rules';
import type {SymbolVariantId, SymbolVariantVisibilityValue} from '../../../src/placement/types';

type NotifyFn = (variantId: SymbolVariantId, placementRunTimestamp: number) => void;

type FakeSource = {
    showSymbolVariant: ReturnType<typeof vi.fn<NotifyFn>>;
    hideSymbolVariant: ReturnType<typeof vi.fn<NotifyFn>>;
};

function createFakeSource(): FakeSource {
    return {showSymbolVariant: vi.fn<NotifyFn>(), hideSymbolVariant: vi.fn<NotifyFn>()};
}

function createVariantId(id: number, variantIdx = 0): SymbolVariantId {
    return {symbolId: {styleLayerId: 0, symbolIdOrigin: SymbolIdOrigin.GENERATED, symbolId: id}, variantIdx};
}

function createPriority(
    subgroupOrder: number,
    placementPriority: number,
    symbolVariantVisibility: SymbolVariantVisibilityValue,
    layerOrder: number,
    symbolDisplayOrder: number
): GlobalPlacementPriority {
    return {
        placementSubgroupOrder: subgroupOrder,
        symbolPlacementPriority: placementPriority,
        symbolVariantVisibility,
        symbolPlacementType: SymbolPlacementType.FIXED,
        styleLayerOrder: layerOrder,
        symbolDisplayOrder,
    };
}

function box(left: number, top: number, right: number, bottom: number): Geometry {
    return [{kind: 'box', left, top, right, bottom}];
}

const testTileID = new OverscaledTileID(0, 0, 0, 0, 0);

// Adds a variant made of a single part holding the whole geometry.
function addSymbolVariant(
    placement: GlobalPlacement,
    variantId: SymbolVariantId,
    priority: GlobalPlacementPriority,
    geometry: Geometry,
    partPlacementRules: PartPlacementRules,
    placementRules: PlacementRules = defaultPlacementRules(),
    tileID: OverscaledTileID = testTileID,
    featureId?: string | number
) {
    placement.startSymbolVariantProcessing(variantId, priority, placementRules, tileID, featureId);
    placement.addSymbolVariantPart(geometry, partPlacementRules);
    placement.finishVariantProcessing();
}

// Adds a variant made of two parts.
function addTwoPartSymbolVariant(
    placement: GlobalPlacement,
    variantId: SymbolVariantId,
    priority: GlobalPlacementPriority,
    firstGeometry: Geometry,
    firstPartRules: PartPlacementRules,
    secondGeometry: Geometry,
    secondPartRules: PartPlacementRules,
    placementRules: PlacementRules = defaultPlacementRules(),
    tileID: OverscaledTileID = testTileID,
    featureId?: string | number
) {
    placement.startSymbolVariantProcessing(variantId, priority, placementRules, tileID, featureId);
    placement.addSymbolVariantPart(firstGeometry, firstPartRules);
    placement.addSymbolVariantPart(secondGeometry, secondPartRules);
    placement.finishVariantProcessing();
}

const screenWidth = 100;
const screenHeight = 100;
const INVISIBLE_VARIANTS_COLLISION_PADDING = 1;
const VISIBLE_VARIANTS_COLLISION_PADDING = 0;

describe('InteractiveGlobalPlacement', () => {
    test('should work without sources', () => {
        const placement = new GlobalPlacement();
        placement.startPlacement(0, screenWidth, screenHeight);
        placement.finishPlacementRun();
    });

    test('should work without symbols', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should notify if symbol variant became visible', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(123, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(10, 10, 20, 20), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 123);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should notify if symbol variant became invisible', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(123, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 15, 15), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(10, 10, 20, 20), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.hideSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 123);
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not place a variant if another variant of the same symbol has already been placed', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(0, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(20, 20, 30, 30), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0, 0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not place a variant if another variant of the same symbol is still placed', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(0, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(20, 20, 30, 30), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place a variant if a more important variant of the same symbol cannot be placed', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(2, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(9, 9, 12, 12), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(12, 12, 14, 14), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1, 1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should ignore collisions when collisionRules is absent (*-allow-overlap)', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        const rulesWithoutCollisions: PartPlacementRules = {collisionRules: undefined, insertIntoCollisionGrid: true};
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(5, 5, 15, 15), rulesWithoutCollisions);
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not put a symbol into the collision grid when insertIntoCollisionGrid is false (*-ignore-placement)', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), {collisionRules: {}, insertIntoCollisionGrid: false});
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(5, 5, 15, 15), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should ignore collision with the specified variant id', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            {collisionRules: {symbolVariantToIgnoreCollisionWith: createVariantId(0)}, insertIntoCollisionGrid: true}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not ignore collisions with objects ignored by someone else', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(20, 20, 30, 30), defaultPartPlacementRules());
        addSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0),
            box(29, 29, 39, 39),
            {collisionRules: {symbolVariantToIgnoreCollisionWith: createVariantId(0)}, insertIntoCollisionGrid: true}
        );
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(11, 11, 21, 21), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // Variant 1 is allowed to ignore its own collision with variant 0, but that
        // doesn't let variant 2 ignore colliding with variant 0 too.
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should extend geometry for invisible variants before checking collisions', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(10.5, 10.5, 15, 15), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(10.5, 10.5, 15, 15), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // Neither box1 nor box2 is far enough from box0 to survive the 1px hysteresis
        // padding applied to variants that weren't already fully visible.
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not extend geometry for visible variants before checking collisions', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(10, 10, 15, 15), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // box1 only touches box0 (no padding applied since it was already visible), so
        // no collision -- both stay visible with no notifications.
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place symbol variants with the same priority in insertion order', () => {
        const placement = new GlobalPlacement();
        const source1 = createFakeSource();
        const source2 = createFakeSource();
        const showCalls: Array<[string, number]> = [];
        source1.showSymbolVariant.mockImplementation((id: SymbolVariantId) => showCalls.push(['source1', id.symbolId.symbolId]));
        source2.showSymbolVariant.mockImplementation((id: SymbolVariantId) => showCalls.push(['source2', id.symbolId.symbolId]));

        const boxes = [
            box(0, 0, 8, 8), box(5, 5, 13, 13), box(10, 10, 18, 18), box(15, 15, 23, 23),
            box(20, 20, 28, 28), box(25, 25, 33, 33), box(30, 30, 38, 38), box(35, 35, 43, 43),
        ];
        const samePriority = createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source1);
        for (let id = 0; id <= 3; id++) addSymbolVariant(placement, createVariantId(id), samePriority, boxes[id], defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.startSymbolSourceProcessing(source2);
        for (let id = 4; id <= 7; id++) addSymbolVariant(placement, createVariantId(id), samePriority, boxes[id], defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(showCalls).toEqual([['source1', 0], ['source1', 2], ['source2', 4], ['source2', 6]]);
        expect(source1.hideSymbolVariant).not.toHaveBeenCalled();
        expect(source2.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place symbols based on priority regardless of insertion order', () => {
        const placement = new GlobalPlacement();
        const source1 = createFakeSource();
        const source2 = createFakeSource();
        const showCalls: Array<[string, number]> = [];
        source1.showSymbolVariant.mockImplementation((id: SymbolVariantId) => showCalls.push(['source1', id.symbolId.symbolId]));
        source2.showSymbolVariant.mockImplementation((id: SymbolVariantId) => showCalls.push(['source2', id.symbolId.symbolId]));

        const boxes = [
            box(0, 0, 8, 8), box(5, 5, 13, 13), box(10, 10, 18, 18), box(15, 15, 23, 23),
            box(20, 20, 28, 28), box(25, 25, 33, 33), box(30, 30, 38, 38), box(35, 35, 43, 43),
        ];
        // id0 gets the highest priority (subgroupOrder 7), id7 the lowest (0).
        const priorityForId = (id: number) => createPriority(7 - id, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0);

        placement.startPlacement(0, screenWidth, screenHeight);
        // source1 gets ids 7..4 (lowest priority), added in decreasing id order.
        placement.startSymbolSourceProcessing(source1);
        for (const id of [7, 6, 5, 4]) addSymbolVariant(placement, createVariantId(id), priorityForId(id), boxes[id], defaultPartPlacementRules());
        placement.finishSourceProcessing();
        // source2 gets ids 3..0 (highest priority), added in decreasing id order.
        placement.startSymbolSourceProcessing(source2);
        for (const id of [3, 2, 1, 0]) addSymbolVariant(placement, createVariantId(id), priorityForId(id), boxes[id], defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(showCalls).toEqual([['source2', 0], ['source2', 2], ['source1', 4], ['source1', 6]]);
        expect(source1.hideSymbolVariant).not.toHaveBeenCalled();
        expect(source2.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should clear placement state between runs', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const geometry = box(0, 0, 10, 10);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), geometry, defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), geometry, defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // If the grid/placed-ids from run1 leaked into run2, variant 1 would collide
        // with variant 0's old (now-cleared) placement and never be shown.
        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should throw on nested run creation attempt', () => {
        const placement = new GlobalPlacement();
        placement.startPlacement(0, screenWidth, screenHeight);

        expect(() => placement.startPlacement(0, screenWidth, screenHeight)).toThrow();
    });

    test('should throw on nested source processing creation attempt', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const source2 = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);

        expect(() => placement.startSymbolSourceProcessing(source2)).toThrow();
    });

    test('should throw on nested variant processing creation attempt', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules(), testTileID);

        expect(() => placement.startSymbolVariantProcessing(createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules(), testTileID)).toThrow();
    });

    test('should throw on a part without geometry', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules(), testTileID);

        expect(() => placement.addSymbolVariantPart([], defaultPartPlacementRules())).toThrow();
    });

    test('should drop a variant that receives no part', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules(), testTileID);
        // No addSymbolVariantPart() calls: the variant is culled/degenerate.
        placement.finishVariantProcessing();
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should hide an already-visible variant that receives no part this run', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), defaultPlacementRules(), testTileID);
        // No addSymbolVariantPart() calls: e.g. dynamically generated geometry turned out empty this run.
        placement.finishVariantProcessing();
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.hideSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not let a variant dropped for having no part collide with or block later variants', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules(), testTileID);
        // No part added for variant 0: it must be dropped rather than occupy space in the grid.
        placement.finishVariantProcessing();
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place a variant that is only eligible if the referenced variant was placed', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Higher priority (sorts first), plain rules: this is the variant that onlyIfPlaced below refers to.
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // Lower priority, only eligible for placement once variant (0, 0) has actually been placed.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(20, 20, 30, 30),
            defaultPartPlacementRules(),
            {onlyIfPlaced: createVariantId(0, 0)}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0, 0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1, 0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not place a variant if onlyIfPlaced references a different variantIdx of a placed symbol', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Higher priority (sorts first), plain rules: symbolId 0 gets placed, but via variantIdx 0.
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // References variantIdx 1 of symbol 0, which is never placed (only variantIdx 0 is), so this
        // variant must remain ineligible even though symbolId 0 itself was placed.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(20, 20, 30, 30),
            defaultPartPlacementRules(),
            {onlyIfPlaced: createVariantId(0, 1)}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // Variant (0, 0) was already visible, so no transition/notification for it either.
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not ignore collision with the referenced variant when only onlyIfPlaced is set', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Higher priority (sorts first), plain rules: this is the variant that onlyIfPlaced below refers to.
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // Overlaps box0. onlyIfPlaced is satisfied (variant (0, 0) is placed), but onlyIfPlaced alone
        // does not grant collision immunity, so this variant must still be hidden due to the overlap.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            defaultPartPlacementRules(),
            {onlyIfPlaced: createVariantId(0, 0)}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place a variant when both onlyIfPlaced and symbolVariantToIgnoreCollisionWith are set for the same id', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Higher priority (sorts first), plain rules: this is the variant that the rules below refer to.
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // Overlaps box0, but ignores collision with it, and only needs it to have been placed: both
        // mechanisms must cooperate for this variant to become eligible despite the overlap.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            {collisionRules: {symbolVariantToIgnoreCollisionWith: createVariantId(0, 0)}, insertIntoCollisionGrid: true},
            {onlyIfPlaced: createVariantId(0, 0)}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0, 0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1, 0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should check onlyIfPlaced for variants that allow overlap', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(2, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // Allows overlap and still depends on a placed variant: the dependency is a rule of the
        // variant, not of the collision check.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            {collisionRules: undefined, insertIntoCollisionGrid: true},
            {onlyIfPlaced: createVariantId(0, 0)}
        );
        // The same, but the referenced variant is never added, so this one stays ineligible.
        addSymbolVariant(placement,
            createVariantId(2, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            {collisionRules: undefined, insertIntoCollisionGrid: true},
            {onlyIfPlaced: createVariantId(3, 0)}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0, 0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1, 0), 0);
        expect(source.showSymbolVariant).toHaveBeenCalledTimes(2);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should hide every part of a variant when one of them collides', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const freeBox = box(40, 40, 50, 50);
        const collidingBox = box(5, 5, 15, 15);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // Overlaps variant 0's box: a variant is placed as a whole, so the colliding part hides the
        // free one too.
        addTwoPartSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            freeBox, defaultPartPlacementRules(),
            collidingBox, defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not check collisions between parts of one variant', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Parts are checked before any of them is inserted into the grid, so overlapping parts of
        // one variant do not hide it.
        addTwoPartSymbolVariant(placement,
            createVariantId(0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(0, 0, 10, 10), defaultPartPlacementRules(),
            box(5, 5, 15, 15), defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not check collisions for parts without collision rules', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const collidingBox = box(5, 5, 15, 15);
        const freeBox = box(40, 40, 50, 50);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // The only part overlapping box0 allows overlap, so nothing is left to hide this variant.
        addTwoPartSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            collidingBox, {collisionRules: undefined, insertIntoCollisionGrid: true},
            freeBox, defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should check collisions for parts with collision rules', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const collidingBox = box(5, 5, 15, 15);
        // Overlaps nothing, so the variant carrying it can only be hidden by its other part.
        const freeBox = box(40, 40, 50, 50);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        // The part that allows overlap is the free one, so the overlapping part is still checked
        // and hides the whole variant.
        addTwoPartSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            freeBox, {collisionRules: undefined, insertIntoCollisionGrid: true},
            collidingBox, defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should put into the collision grid only parts that ask for it', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const ignoredBox = box(0, 0, 10, 10);
        const insertedBox = box(40, 40, 50, 50);
        const boxOverIgnoredOne = box(5, 5, 15, 15);
        const boxOverInsertedOne = box(45, 45, 55, 55);

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addTwoPartSymbolVariant(placement,
            createVariantId(0),
            createPriority(2, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            ignoredBox, {collisionRules: {}, insertIntoCollisionGrid: false},
            insertedBox, defaultPartPlacementRules()
        );
        addSymbolVariant(placement, createVariantId(1), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), boxOverIgnoredOne, defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), boxOverInsertedOne, defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1), 0);
        expect(source.showSymbolVariant).toHaveBeenCalledTimes(2);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('objects outside of grid should be invisible', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(-200, -200, -150, -150), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(250, 250, 300, 300), defaultPartPlacementRules());
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(-200, 10, -150, 20), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // All three are entirely outside the padded working area
        // variant 2 was previously visible, so it must be hidden
        // 0 and 1 were already invisible, so no notification for them.
        expect(source.hideSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(2), 0);
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
    });

    test('should place a variant when at least one of its parts lies inside the grid', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        // Geometry out of bounds collides with nothing, so a variant that is out of bounds only
        // partially is placed by whatever geometry is left within bounds.
        addTwoPartSymbolVariant(placement,
            createVariantId(0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(0, 0, 10, 10), defaultPartPlacementRules(),
            box(-300, -300, -290, -290), defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should hide a variant only when all of its parts lie outside the grid', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addTwoPartSymbolVariant(placement,
            createVariantId(0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(-300, -300, -290, -290), defaultPartPlacementRules(),
            box(-400, -400, -390, -390), defaultPartPlacementRules()
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not collect debug data by default', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(placement.debugSymbols()).toEqual([]);
    });

    test('should collect debug data for every symbol variant, padding invisible geometry and naming the blocker', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();
        const placementRules = defaultPlacementRules();
        const partPlacementRules = defaultPartPlacementRules();
        const featureId = 'feature-42';

        // Two elements, so that a variant's whole geometry is covered and not just a single element.
        const multiElementGeometry: Geometry = [
            {kind: 'box', left: 0, top: 0, right: 10, bottom: 10},
            {kind: 'box', left: 20, top: 20, right: 30, bottom: 30}
        ];

        placement.startPlacement(0, screenWidth, screenHeight, true);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), multiElementGeometry, partPlacementRules, placementRules, testTileID, featureId);
        // Overlaps the first element above and therefore loses the collision.
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(5, 5, 15, 15), partPlacementRules, placementRules);
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(placement.debugSymbols()).toEqual([
            {geometry: multiElementGeometry, collisionPadding: VISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(0), tileID: testTileID, featureId, placementRules, partPlacementRules: [partPlacementRules], status: VariantPlacementResult.PLACED, blockedBy: undefined},
            // Not placed, blockedBy names variant 0's collision box that it actually hit.
            {geometry: box(5, 5, 15, 15), collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(1), tileID: testTileID, featureId: undefined, placementRules, partPlacementRules: [partPlacementRules],  status: VariantPlacementResult.COLLIDED, blockedBy: createVariantId(0)},
        ]);
    });

    test('should report why a symbol variant was not placed', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        const placedBox = box(0, 0, 10, 10);
        // Overlaps placedBox, so a variant carrying it is rejected by the collision check as well as
        // by whatever check comes before it. Used to pin down which reason gets reported.
        const collidingBox = box(5, 5, 15, 15);
        // Touches nothing, so only the reason under test can hide a variant carrying it.
        const freeBox = box(40, 40, 50, 50);
        // Far outside of the padded working area.
        const outOfBoundsBox = box(300, 300, 400, 400);

        // Descending subgroup order, so the variants are evaluated in the order they are added here.
        const addVariant = (variantId: SymbolVariantId, subgroupOrder: number, geometry: Geometry, placementRules: PlacementRules = defaultPlacementRules()) => {
            addSymbolVariant(placement, variantId, createPriority(subgroupOrder, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), geometry, defaultPartPlacementRules(), placementRules);
        };

        placement.startPlacement(0, screenWidth, screenHeight, true);
        placement.startSymbolSourceProcessing(source);
        addVariant(createVariantId(0, 0), 6, placedBox);
        // Two more variants of the symbol placed above, the second one also colliding: losing to
        // another variant of the same symbol is decided before any collision check runs.
        addVariant(createVariantId(0, 1), 5, freeBox);
        addVariant(createVariantId(0, 2), 4, collidingBox);
        // Depend on a variant that is never added, so they can never become eligible. Symbol 1 is
        // itself never placed, so the second one isolates the dependency from OTHER_VARIANT_PLACED
        // while still colliding.
        const dependentRules = (): PlacementRules => ({onlyIfPlaced: createVariantId(2)});
        addVariant(createVariantId(1, 0), 3, freeBox, dependentRules());
        addVariant(createVariantId(1, 1), 2, collidingBox, dependentRules());

        addVariant(createVariantId(3), 1, collidingBox);
        addVariant(createVariantId(4), 0, outOfBoundsBox);
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // Only COLLIDED and OTHER_VARIANT_PLACED name a blockedBy.
        const partPlacementRules = [defaultPartPlacementRules()];

        expect(placement.debugSymbols()).toEqual([
            {geometry: placedBox, collisionPadding: VISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(0, 0), tileID: testTileID, featureId: undefined, placementRules: defaultPlacementRules(), partPlacementRules, status: VariantPlacementResult.PLACED, blockedBy: undefined},
            {geometry: freeBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(0, 1), tileID: testTileID, featureId: undefined, placementRules: defaultPlacementRules(), partPlacementRules, status: VariantPlacementResult.OTHER_VARIANT_PLACED, blockedBy: createVariantId(0, 0)},
            {geometry: collidingBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(0, 2), tileID: testTileID, featureId: undefined, placementRules: defaultPlacementRules(), partPlacementRules, status: VariantPlacementResult.OTHER_VARIANT_PLACED, blockedBy: createVariantId(0, 0)},
            {geometry: freeBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(1, 0), tileID: testTileID, featureId: undefined, placementRules: dependentRules(), partPlacementRules, status: VariantPlacementResult.DEPENDENCY_NOT_PLACED, blockedBy: undefined},
            {geometry: collidingBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(1, 1), tileID: testTileID, featureId: undefined, placementRules: dependentRules(), partPlacementRules, status: VariantPlacementResult.DEPENDENCY_NOT_PLACED, blockedBy: undefined},
            {geometry: collidingBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(3), tileID: testTileID, featureId: undefined, placementRules: defaultPlacementRules(), partPlacementRules, status: VariantPlacementResult.COLLIDED, blockedBy: createVariantId(0, 0)},
            {geometry: outOfBoundsBox, collisionPadding: INVISIBLE_VARIANTS_COLLISION_PADDING, variantId: createVariantId(4), tileID: testTileID, featureId: undefined, placementRules: defaultPlacementRules(), partPlacementRules, status: VariantPlacementResult.OUT_OF_BOUNDS, blockedBy: undefined},
        ]);
    });

    test('should drop debug data of the previous run', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight, true);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();
        expect(placement.debugSymbols()).toHaveLength(1);

        placement.startPlacement(1, screenWidth, screenHeight, true);
        placement.finishPlacementRun();

        expect(placement.debugSymbols()).toEqual([]);
    });

    test('should stop collecting debug data when disabled', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        const runOnce = (timestamp: number, collectDebugData: boolean) => {
            placement.startPlacement(timestamp, screenWidth, screenHeight, collectDebugData);
            placement.startSymbolSourceProcessing(source);
            addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPartPlacementRules());
            placement.finishSourceProcessing();
            placement.finishPlacementRun();
        };

        runOnce(0, true);
        expect(placement.debugSymbols()).toHaveLength(1);

        runOnce(1, false);

        expect(placement.debugSymbols()).toEqual([]);
    });
});
