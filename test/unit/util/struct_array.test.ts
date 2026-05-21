// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {StructArrayLayout3i6, FeatureIndexArray} from '../../../src/data/array_types';

describe('StructArray', () => {
    class TestArray extends StructArrayLayout3i6 {}

    test('array constructs itself, but does not allocate anything yet', () => {
        const array = new TestArray();
        expect(array.length).toEqual(0);
        expect(array.arrayBuffer).toBeFalsy();
    });

    test('emplaceBack', () => {
        const array = new TestArray();

        expect(0).toEqual(array.emplaceBack(1, 7, 3));
        expect(1).toEqual(array.emplaceBack(4, 2, 5));

        expect(array.arrayBuffer).toBeTruthy();

        expect(array.length).toEqual(2);

        expect(Array.from(array.int16.slice(0, 6))).toEqual([1, 7, 3, 4, 2, 5]);
    });

    test('emplaceBack gracefully accepts extra arguments', () => {
        // emplaceBack is typically used in fairly hot code paths, where
        // conditionally varying the number of arguments can be expensive.
        const array = new TestArray();
        expect((array/*: any*/).emplaceBack(3, 1, 4, 1, 5, 9)).toEqual(0);
        expect(array.length).toEqual(1);
        expect(Array.from(array.int16.slice(0, 3))).toEqual([3, 1, 4]);
    });

    test('reserve', () => {
        const array = new TestArray();

        array.reserve(100);
        const initialCapacity = array.capacity;

        for (let i = 0; i < 100; i++) {
            array.emplaceBack(1, 1, 1);
            expect(array.capacity).toEqual(initialCapacity);
        }
    });

    test('automatically resizes', () => {
        const array = new TestArray();
        const initialCapacity = array.capacity;

        while (initialCapacity > array.length) {
            array.emplaceBack(1, 1, 1);
        }

        expect(array.capacity).toEqual(initialCapacity);

        array.emplaceBack(1, 1, 1);
        expect(array.capacity > initialCapacity).toBeTruthy();
    });

    test('trims', () => {
        const array = new TestArray();

        array.emplaceBack(1, 1, 1);
        const capacityInitial = array.capacity;
        expect(array.capacity).toEqual(capacityInitial);

        array._trim();
        expect(array.capacity).toEqual(1);
        expect(array.arrayBuffer.byteLength).toEqual(array.bytesPerElement);
    });

    test('reserve is a no-op when n <= capacity', () => {
        // Regression: a refactor once made reserve(n) reallocate on every call
        // because the guard compared the bumped capacity against itself, not n.
        const array = new TestArray();
        array.reserve(100);
        const buffer = array.arrayBuffer;
        const capacity = array.capacity;

        array.reserve(50);
        expect(array.arrayBuffer).toBe(buffer);
        expect(array.capacity).toEqual(capacity);

        array.reserve(capacity);
        expect(array.arrayBuffer).toBe(buffer);
        expect(array.capacity).toEqual(capacity);
    });

    test('reserveExact allocates exactly n slots — no default floor, no growth multiplier', () => {
        const array = new TestArray();
        array.reserveExact(5);
        expect(array.capacity).toEqual(5);
        expect(array.length).toEqual(0);
        expect(array.arrayBuffer.byteLength).toEqual(5 * array.bytesPerElement);
    });

    test('reserveExact(0) still initializes views so subsequent serialize/emplaceBack are safe', () => {
        // Regression: reserveExact(0) used to leave arrayBuffer and views undefined.
        // A later .uint8.set(...) or transfer would then crash.
        const array = new TestArray();
        array.reserveExact(0);
        expect(array.capacity).toEqual(0);
        expect(array.arrayBuffer).toBeTruthy();
        expect(array.int16).toBeTruthy();
        expect(array.arrayBuffer.byteLength).toEqual(0);
    });

    test('reserveExact does not shrink an already-larger array', () => {
        const array = new TestArray();
        array.reserve(100);
        const capacity = array.capacity;
        array.reserveExact(10);
        expect(array.capacity).toEqual(capacity);
    });

    test('resizeExact sets capacity and length exactly', () => {
        const array = new TestArray();
        array.resizeExact(7);
        expect(array.capacity).toEqual(7);
        expect(array.length).toEqual(7);
        expect(array.arrayBuffer.byteLength).toEqual(7 * array.bytesPerElement);
    });

    test('reserveExact + N emplaceBacks leaves length === capacity so _trim is a no-op', () => {
        const array = new TestArray();
        array.reserveExact(3);
        array.emplaceBack(1, 2, 3);
        array.emplaceBack(4, 5, 6);
        array.emplaceBack(7, 8, 9);
        expect(array.capacity).toEqual(3);
        expect(array.length).toEqual(3);
        const buffer = array.arrayBuffer;
        array._trim();
        expect(array.arrayBuffer).toBe(buffer);
    });

    test('emplaceBack past reserveExact capacity still grows correctly', () => {
        const array = new TestArray();
        array.reserveExact(2);
        array.emplaceBack(1, 2, 3);
        array.emplaceBack(4, 5, 6);
        array.emplaceBack(7, 8, 9);
        expect(array.length).toEqual(3);
        expect(array.capacity >= 3).toBeTruthy();
        expect(Array.from(array.int16.slice(0, 9))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
});

describe('FeatureIndexArray', () => {
    class TestArray extends FeatureIndexArray {}

    test('array constructs itself, but does not allocate anything yet', () => {
        const array = new TestArray();
        expect(array.length).toEqual(0);
        expect(array.arrayBuffer).toBeFalsy();
    });

    test('emplace and retrieve', () => {
        const array = new TestArray();
        expect(0).toEqual(array.emplaceBack(1, 7, 3, 6));
        expect(1).toEqual(array.emplaceBack(4, 2, 5, 9));
        expect(array.arrayBuffer).toBeTruthy();

        expect(array.length).toEqual(2);

        const elem0 = array.get(0);
        expect(elem0).toBeTruthy();

        expect(elem0.featureIndex).toEqual(1);
        expect(elem0.sourceLayerIndex).toEqual(7);
        expect(elem0.bucketIndex).toEqual(3);
        expect(elem0.layoutVertexArrayOffset).toEqual(6);

        const elem1 = array.get(1);
        expect(elem1).toBeTruthy();

        expect(elem1.featureIndex).toEqual(4);
        expect(elem1.sourceLayerIndex).toEqual(2);
        expect(elem1.bucketIndex).toEqual(5);
        expect(elem1.layoutVertexArrayOffset).toEqual(9);
    });
});
