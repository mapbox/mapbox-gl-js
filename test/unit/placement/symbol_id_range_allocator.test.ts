import {describe, test, expect} from '../../util/vitest';
import {SymbolIdRangeAllocator} from '../../../src/placement/symbol_id_range_allocator';

describe('SymbolIdRangeAllocator', () => {
    test('hands out contiguous ranges for the same layer', () => {
        const allocator = new SymbolIdRangeAllocator();

        expect(allocator.allocateRange(1, 3)).toEqual(0);
        expect(allocator.allocateRange(1, 2)).toEqual(3);
    });

    test('keeps independent counters per layer', () => {
        const allocator = new SymbolIdRangeAllocator();

        expect(allocator.allocateRange(1, 5)).toEqual(0);
        expect(allocator.allocateRange(2, 5)).toEqual(0);
        expect(allocator.allocateRange(1, 1)).toEqual(5);
    });

    test('restarts a layer\'s counter from zero after it is released', () => {
        const allocator = new SymbolIdRangeAllocator();

        allocator.allocateRange(1, 10);
        allocator.releaseLayer(1);

        expect(allocator.allocateRange(1, 3)).toEqual(0);
    });

    test('releasing a layer that never allocated a range is a no-op', () => {
        const allocator = new SymbolIdRangeAllocator();

        expect(() => allocator.releaseLayer(42)).not.toThrow();
    });
});
