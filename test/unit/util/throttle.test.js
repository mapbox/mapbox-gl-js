'use strict';
// @flow

const test = require('mapbox-gl-js-test').test;
const throttle = require('../../../src/util/throttle');

test('throttle', (t) => {

    t.test('does not execute unthrottled function unless throttled function is invoked', (t) => {
        let executionCount = 0;
        let throttledFunction = throttle(() => executionCount++, 0);
        t.equal(executionCount, 0);
        t.end();
    });

    t.test('executes unthrottled function immediately when period is 0', (t) => {
        let executionCount = 0;
        let throttledFunction = throttle(() => executionCount++, 0);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        t.equal(executionCount, 3);
        t.end();
    });

    t.test('executes unthrottled function immediately once when period is > 0', (t) => {
        let executionCount = 0;
        let throttledFunction = throttle(() => executionCount++, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        t.equal(executionCount, 1);
        t.end();
    });

    t.test('queues exactly one execution of unthrottled function when period is > 0', (t) => {
        let executionCount = 0;
        let throttledFunction = throttle(() => executionCount++, 5);
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
