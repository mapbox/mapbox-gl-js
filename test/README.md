
# Tests

## Running Tests

First you must configure your development environment per [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

There are two test suites associated with Mapbox GL JS

 - `npm test` runs quick unit tests
 - `npm run test-suite` runs slower integration tests

To run unit tests you need install required Playwright browsers before with the command:
```
npx playwright install chromium
```

To run individual tests:
 - Unit tests: `npm run test-unit path/to/file.test.js`
   - e.g. `npm run test-unit test/unit/ui/handler/scroll_zoom.test.js`
 - Render tests: `npm run test-render tests=render-test-name` where the render test name can be any substring in the `test/integration/render-tests/` subdirectories
   - e.g. `npm run test-render tests=background-color/default` or `npm run test-render tests=line`

See [`test/integration/README.md#running-specific-tests`](./integration/README.md#running-specific-tests).

## Integration Tests

See [`test/integration/README.md`](./integration/README.md).

## Writing Unit Tests

 - **You must not share variables between test cases.** All test fixtures must be wrapped in `create` functions. This ensures each test is run in an isolated environment.
 - **You should not mock any internal domain objects.** Internal domain objects include `Style`, `Map`, `Transform`, and `Dispatcher`. If this is difficult because of some interface, refactor that interface. This ensures that tests accurately exercise the code paths used in production.
 - **You should test one return value or side effect per test case.** Feel free to pull shared logic into a function. This ensures that tests are easy to understand and modify.
 - **You should only test the return values and global side effects of methods.** You should not not test internal behavior, such as that another method is called with particular arguments. This ensures that method implementations may change without causing test failures.
 - **You must not make network requests in test cases.** This rule holds in cases when result isn't used or is expected to fail. You may use `getNetworkWorker` from `test/util/network.js` module, which uses [`mswj`](https://mswjs.io/docs/api/setup-worker/) to simulate network requests. This ensures that tests are reliable, able to be run in an isolated environment, and performant. In your test suite you can setup network worker in the following way:
```js
let networkWorker;

beforeAll(async () => {
    networkWorker = await getNetworkWorker(window);
});

afterEach(() => {
    // Clear runtime mocks, which were added by `.use`
    networkWorker.resetHandlers();
});

afterAll(() => {
    networkWorker.stop();
});

test('should tests something', () => {
    networkWorker.use(
        http.get('/notfound.png', async () => {
            return new HttpResponse(null, {status: 404});
        }),
        http.get('/style.json', async () => {
            return HttpResponse.json({});
        })
    );

    // Network mocks are ready: act and assert
});
 ```
 - **You should use clear [input space partitioning](http://crystal.uta.edu/~ylei/cse4321/data/isp.pdf) schemes.** Look for edge cases! This ensures that tests suites are comprehensive and easy to understand.

If you want to debug your unit tests you can open UI for that with the following command:
```
npm run test-unit -- --no-browser.headless
```

## Spies, Stubs, and Mocks

The test object is augmented with methods from Sinon.js for [spies](http://sinonjs.org/docs/#spies), [stubs](http://sinonjs.org/docs/#stubs), and [mocks](http://sinonjs.org/docs/#mocks). For example, to use Sinon's spy API, call `t.spy(...)` within a test.

The test framework is set up such that spies, stubs, and mocks on global objects are restored at the end of each test.
