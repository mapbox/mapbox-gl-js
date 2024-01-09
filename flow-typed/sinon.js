// @flow strict
declare module "sinon" {
    declare type SpyCall = {
        args: Array<mixed>
    };
    declare type Spy = {
        (): any,
        calledOnce: number,
        getCall(i: number): SpyCall
    };
    declare type Stub = {
        returns(fn: mixed): Spy,
        callsFake(fn: mixed): Spy
    };
    declare class FakeServer {
        xhr: XMLHttpRequest
    }
    declare type Sandbox = {
        xhr: {supportsCORS: boolean},
        fakeServer: {create: () => FakeServer},

        createSandbox(options: mixed): Sandbox,
        stub(obj?: mixed, prop?: string): Stub,
        spy(obj?: mixed, prop?: string): Spy,
        restore(): void;
    };

    declare module.exports: Sandbox;
}
