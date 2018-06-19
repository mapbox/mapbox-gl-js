
# Tests

## Running Tests

First you must configure your development environment per [`../CONTRIBUTING.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/CONTRIBUTING.md)

There are two test suites associated with Mapbox GL JS

 - `yarn test` runs quick unit tests
 - `yarn run test-suite` runs slower integration tests

 To run individual tests:

 - Unit tests: `yarn test-unit path/to/file.test.js` where the path begins within the `/test/unit/` directory
 - Render tests: `yarn test-render render-test-name` (e.g. `yarn test-render background-color/default`)

## Writing Unit Tests

 - **You must not share variables between test cases.** All test fixtures must be wrapped in `create` functions. This ensures each test is run in an isolated environment.
 - **You should not mock any internal domain objects.** Internal domain objects include `Style`, `Map`, `Transform`, and `Dispatcher`. If this is difficult because of some interface, refactor that interface. This ensures that tests accurately exercise the code paths used in production.
 - **You should test one return value or side effect per test case.** Feel free to pull shared logic into a function. This ensures that tests are easy to understand and modify.
 - **You should only test the return values and global side effects of methods.** You should not not test internal behavior, such as that another method is called with particular arguments. This ensures that method implementations may change without causing test failures.
 - **You must not make network requests in test cases.** This rule holds in cases when result isn't used or is expected to fail. You may use `window.useFakeXMLHttpRequest` and `window.server` per the [Sinon API](http://sinonjs.org/docs/#server) to simulate network requests. This ensures that tests are reliable, able to be run in an isolated environment, and performant.
 - **You should use clear [input space partitioning](http://crystal.uta.edu/~ylei/cse4321/data/isp.pdf) schemes.** Look for edge cases! This ensures that tests suites are comprehensive and easy to understand.

## Spies, Stubs, and Mocks

The test object is augmented with methods from Sinon.js for [spies](http://sinonjs.org/docs/#spies), [stubs](http://sinonjs.org/docs/#stubs), and [mocks](http://sinonjs.org/docs/#mocks). For example, to use Sinon's spy API, call `t.spy(...)` within a test.

The test framework is set up such that spies, stubs, and mocks on global objects are restored at the end of each test.
