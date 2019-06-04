// @flow
declare module "mapbox-gl-js-test" {

    declare type SpyCall = {
        args: Array<mixed>
    };

    declare type Spy = {
        (): any,
        calledOnce: number,
        getCall(i: number): SpyCall
    };

    declare type Stub = {
        callsFake(fn: mixed): Spy
    };

    declare type CreateTest = {
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

        stub(obj?: mixed, prop?: string): Stub
    };

    declare module.exports: { test: CreateTest };
}
