// @flow

import { test } from 'mapbox-gl-js-test';

import throttle from '../../../src/util/throttle';

test('throttle', (t) => {

    t.test('does not execute unthrottled function unless throttled function is invoked', (t) => {
        let executionCount = 0;
        throttle(() => { executionCount++; }, 0);
        t.equal(executionCount, 0);
        t.end();
    });

    t.test('executes unthrottled function once per tick when period is 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 0);
        throttledFunction();
        throttledFunction();
        t.equal(executionCount, 1);
        setTimeout(() => {
            throttledFunction();
            throttledFunction();
            t.equal(executionCount, 2);
            t.end();
        }, 0);
    });

    t.test('executes unthrottled function immediately once when period is > 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        t.equal(executionCount, 1);
        t.end();
    });

    t.test('queues exactly one execution of unthrottled function when period is > 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        setTimeout(() => {
            t.equal(executionCount, 2);
            t.end();
        }, 10);
    });

    t.end();
});
