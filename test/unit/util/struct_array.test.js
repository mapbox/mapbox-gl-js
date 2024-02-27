import {describe, test, expect} from "../../util/vitest.js";
import {StructArrayLayout3i6, FeatureIndexArray} from '../../../src/data/array_types.js';

describe('StructArray', () => {
    class TestArray extends StructArrayLayout3i6 {}

    test('array constructs itself', () => {
        const array = new TestArray();
        expect(array.length).toEqual(0);
        expect(array.arrayBuffer).toBeTruthy();
    });

    test('emplaceBack', () => {
        const array = new TestArray();

        expect(0).toEqual(array.emplaceBack(1, 7, 3));
        expect(1).toEqual(array.emplaceBack(4, 2, 5));

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
        const capacityInitial = array.capacity;

        array.emplaceBack(1, 1, 1);
        expect(array.capacity).toEqual(capacityInitial);

        array._trim();
        expect(array.capacity).toEqual(1);
        expect(array.arrayBuffer.byteLength).toEqual(array.bytesPerElement);
    });
});

describe('FeatureIndexArray', () => {
    class TestArray extends FeatureIndexArray {}

    test('array constructs itself', () => {
        const array = new TestArray();
        expect(array.length).toEqual(0);
        expect(array.arrayBuffer).toBeTruthy();
    });

    test('emplace and retrieve', () => {
        const array = new TestArray();
        expect(0).toEqual(array.emplaceBack(1, 7, 3, 6));
        expect(1).toEqual(array.emplaceBack(4, 2, 5, 9));

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
