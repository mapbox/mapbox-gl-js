/* @flow */

import tap from 'tape';
import sinon from 'sinon';

type CreateTest = (typeof sinon) & {
    (name: string, body: (test: CreateTest) => void): void,

    test: CreateTest,

    ok(value: mixed, msg?: string): void,
    assert(value: mixed, msg?: string): void,
    true(value: mixed, msg?: string): void,
    notOk(value: mixed, msg?: string): void,
    false(value: mixed, msg?: string): void,
    equal(actual: mixed, expected: mixed, msg?: string): void,
    notEqual(actual: mixed, expected: mixed, msg?: string): void,
    deepEqual(actual: mixed, expected: mixed, msg?: string): void,
    fail(msg?: string): void,
    ifError(err: mixed, msg?: string): void,
    throws(fn: Function, expected?: RegExp | Function, msg?: string): void,
    doesNotThrow(fn: Function, expected?: RegExp | Function, msg?: string): void,
    plan(n: number): void,
    end(): void,
    tearDown(() => void): void,
};



function wrapTests(t) {
    t.on('test', wrapTest);
}

function wrapTest(childTest) {
    childTest.once('prerun', function() {
        wrapTests(childTest);
        beforeEach(childTest);
    });

    childTest.once('end', function() {
        afterEach(childTest);
    });
}


tap._test = tap.test;
tap.test = function(name, cb) {
    const a = tap._test(name, cb);
    wrapTest(a);
    return a;
}
/*
function wrapTest(t) {
    t._test = t.test;
    t.test = function wrappedTest(name_, cb_) {
        this.on('end', function() {
            console.log("END event", name_);
        });
        const cb = function(childT) {
            wrapTest(childT);
            console.log("beforeEach", name_);
            beforeEach.call(childT);
            childT.once('end', function(e) {
                console.log("END", name_, e);
                console.log("afterEach", name_);
                afterEach.call(childT);
            });
            console.log("START", name_);
            cb_(childT);
        };

        const harness = t._test(name_, cb);
        return harness;
    }
}
*/

//wrapTest(tap);

export const test = (tap.test: CreateTest);
export const only = (tap.only: CreateTest);

const consoleError = console.error;
const consoleWarn = console.warn;

//tap.beforeEach(
function beforeEach(t) {
    t.sandbox = sinon.createSandbox({
        injectInto: t,
        properties: ['spy', 'stub', 'mock']
    });

    // $FlowFixMe the assignment is intentional
    console.error = (e) => t.fail(`console.error called -- please adjust your test (maybe stub console.error?) ${e}`);
    // $FlowFixMe the assignment is intentional
    console.warn = () => t.fail(`console.warn called -- please adjust your test (maybe stub console.warn?)`);

    //done();
}

function afterEach(t) {
    // $FlowFixMe the assignment is intentional
    console.error = consoleError;
    // $FlowFixMe the assignment is intentional
    console.warn = consoleWarn;

    t.sandbox.restore();

    //done();
}

export function testWithSetupTeardown(t, setup, teardown) {
    return function(name, fn) {
        t.test("setup", setup);
        t.test(name, fn);
        t.test("teardown", teardown);
    }
}
