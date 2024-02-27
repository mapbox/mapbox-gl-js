import {describe, test, expect} from "../../util/vitest.js";

import throttle from '../../../src/util/throttle.js';

describe('throttle', () => {
    test('does not execute unthrottled function unless throttled function is invoked', () => {
        let executionCount = 0;
        throttle(() => { executionCount++; }, 0);
        expect(executionCount).toEqual(0);
    });

    test('executes unthrottled function once per tick when period is 0', () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 0);
        throttledFunction();
        throttledFunction();
        expect(executionCount).toEqual(1);
        setTimeout(() => {
            throttledFunction();
            throttledFunction();
            expect(executionCount).toEqual(2);
        }, 0);
    });

    test('executes unthrottled function immediately once when period is > 0', () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        expect(executionCount).toEqual(1);
    }
    );

    test('queues exactly one execution of unthrottled function when period is > 0', () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        setTimeout(() => {
            expect(executionCount).toEqual(2);
        }, 10);
    }
    );
});
