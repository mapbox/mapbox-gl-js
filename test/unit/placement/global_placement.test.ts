import {describe, test, expect, vi} from '../../util/vitest';
import {GlobalPlacement} from '../../../src/placement/global_placement';
import {defaultPlacementRules} from '../../../src/placement/placement_rules';
import {SymbolIdOrigin, SymbolPlacementType, SymbolVariantVisibility} from '../../../src/placement/types';

import type {Geometry} from '../../../src/placement/geometry';
import type {GlobalPlacementPriority} from '../../../src/placement/global_placement_priority';
import type {PlacementRules} from '../../../src/placement/placement_rules';
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

function addSymbolVariant(placement: GlobalPlacement, variantId: SymbolVariantId, priority: GlobalPlacementPriority, geometry: Geometry, placementRules: PlacementRules) {
    placement.startSymbolVariantProcessing(variantId, priority, placementRules);
    for (const geometryElement of geometry) placement.addGeometry(geometryElement);
    placement.finishVariantProcessing();
}

const screenWidth = 100;
const screenHeight = 100;

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
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(10, 10, 20, 20), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 15, 15), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(10, 10, 20, 20), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(0, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(20, 20, 30, 30), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(0, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(20, 20, 30, 30), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(2, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(9, 9, 12, 12), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1, 1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(12, 12, 14, 14), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        const rulesWithoutCollisions: PlacementRules = {collisionRules: undefined, insertIntoCollisionGrid: true};
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
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(5, 5, 15, 15), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(20, 20, 30, 30), defaultPlacementRules());
        addSymbolVariant(placement,
            createVariantId(1),
            createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0),
            box(29, 29, 39, 39),
            {collisionRules: {symbolVariantToIgnoreCollisionWith: createVariantId(0)}, insertIntoCollisionGrid: true}
        );
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(11, 11, 21, 21), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(10.5, 10.5, 15, 15), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(10.5, 10.5, 15, 15), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(10, 10, 15, 15), defaultPlacementRules());
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
        for (let id = 0; id <= 3; id++) addSymbolVariant(placement, createVariantId(id), samePriority, boxes[id], defaultPlacementRules());
        placement.finishSourceProcessing();
        placement.startSymbolSourceProcessing(source2);
        for (let id = 4; id <= 7; id++) addSymbolVariant(placement, createVariantId(id), samePriority, boxes[id], defaultPlacementRules());
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
        for (const id of [7, 6, 5, 4]) addSymbolVariant(placement, createVariantId(id), priorityForId(id), boxes[id], defaultPlacementRules());
        placement.finishSourceProcessing();
        // source2 gets ids 3..0 (highest priority), added in decreasing id order.
        placement.startSymbolSourceProcessing(source2);
        for (const id of [3, 2, 1, 0]) addSymbolVariant(placement, createVariantId(id), priorityForId(id), boxes[id], defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), geometry, defaultPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), geometry, defaultPlacementRules());
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
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules());

        expect(() => placement.startSymbolVariantProcessing(createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules())).toThrow();
    });

    test('should drop a variant that receives no geometry', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules());
        // No addGeometry() calls: the variant is culled/degenerate.
        placement.finishVariantProcessing();
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).not.toHaveBeenCalled();
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('should hide an already-visible variant that receives no geometry this run', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), defaultPlacementRules());
        // No addGeometry() calls: e.g. dynamically generated geometry turned out empty this run.
        placement.finishVariantProcessing();
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.hideSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(0), 0);
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
    });

    test('should not let a variant dropped for empty geometry collide with or block later variants', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        placement.startSymbolVariantProcessing(createVariantId(0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), defaultPlacementRules());
        // No geometry added for variant 0: it must be dropped rather than occupy space in the grid.
        placement.finishVariantProcessing();
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        // Lower priority, only eligible for placement once variant (0, 0) has actually been placed.
        addSymbolVariant(placement, createVariantId(1, 0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(20, 20, 30, 30), {collisionRules: {onlyIfPlaced: createVariantId(0, 0)}, insertIntoCollisionGrid: true});
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        // References variantIdx 1 of symbol 0, which is never placed (only variantIdx 0 is), so this
        // variant must remain ineligible even though symbolId 0 itself was placed.
        addSymbolVariant(placement, createVariantId(1, 0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(20, 20, 30, 30), {collisionRules: {onlyIfPlaced: createVariantId(0, 1)}, insertIntoCollisionGrid: true});
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        // Overlaps box0. onlyIfPlaced is satisfied (variant (0, 0) is placed), but onlyIfPlaced alone
        // does not grant collision immunity, so this variant must still be hidden due to the overlap.
        addSymbolVariant(placement, createVariantId(1, 0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(5, 5, 15, 15), {collisionRules: {onlyIfPlaced: createVariantId(0, 0)}, insertIntoCollisionGrid: true});
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
        addSymbolVariant(placement, createVariantId(0, 0), createPriority(1, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(0, 0, 10, 10), defaultPlacementRules());
        // Overlaps box0, but ignores collision with it, and only needs it to have been placed: both
        // mechanisms must cooperate for this variant to become eligible despite the overlap.
        addSymbolVariant(placement,
            createVariantId(1, 0),
            createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0),
            box(5, 5, 15, 15),
            {collisionRules: {symbolVariantToIgnoreCollisionWith: createVariantId(0, 0), onlyIfPlaced: createVariantId(0, 0)}, insertIntoCollisionGrid: true}
        );
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(1, createVariantId(0, 0), 0);
        expect(source.showSymbolVariant).toHaveBeenNthCalledWith(2, createVariantId(1, 0), 0);
        expect(source.hideSymbolVariant).not.toHaveBeenCalled();
    });

    test('objects outside of grid should be invisible', () => {
        const placement = new GlobalPlacement();
        const source = createFakeSource();

        placement.startPlacement(0, screenWidth, screenHeight);
        placement.startSymbolSourceProcessing(source);
        addSymbolVariant(placement, createVariantId(0), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_INVISIBLE, 0, 0), box(-200, -200, -150, -150), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(1), createPriority(0, 0, SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE, 0, 0), box(250, 250, 300, 300), defaultPlacementRules());
        addSymbolVariant(placement, createVariantId(2), createPriority(0, 0, SymbolVariantVisibility.VARIANT_VISIBLE, 0, 0), box(-200, 10, -150, 20), defaultPlacementRules());
        placement.finishSourceProcessing();
        placement.finishPlacementRun();

        // All three are entirely outside the padded working area
        // variant 2 was previously visible, so it must be hidden
        // 0 and 1 were already invisible, so no notification for them.
        expect(source.hideSymbolVariant).toHaveBeenCalledExactlyOnceWith(createVariantId(2), 0);
        expect(source.showSymbolVariant).not.toHaveBeenCalled();
    });
});
