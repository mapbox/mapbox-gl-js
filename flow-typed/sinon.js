// @flow strict
declare module "sinon" {
    declare class FakeServer {
        xhr: XMLHttpRequest
    }
    declare module.exports: {
        xhr: {supportsCORS: boolean},
        fakeServer: {create: () => FakeServer}
    };
}
