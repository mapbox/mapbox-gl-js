These integration tests verify the correctness and consistency of [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) and
[mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native) rendering.

## Organization

Tests are contained in a directory tree, generally organized by [style specification](https://github.com/mapbox/mapbox-gl-style-spec)
property: `background-color`, `line-width`, etc., with a second level of directories below that for individual tests. For example, the test for specifying a literal `circle-radius` value lives in [`test/integration/render-tests/circle-radius/literal/`](./render-tests/circle-radius/literal).

Within a leaf directory is a `style.json` file (e.g. [`circle-radius/literal/style.json`](./render-tests/circle-radius/literal/style.json)), which contains the minimal style needed for the given test case. The style can specify the map size, center, bearing, and pitch, and additional test metadata (e.g. output image dimensions).

The expected output for a given test case is in `expected.png`, e.g. [`circle-radius/literal/expected.png`](./render-tests/circle-radius/literal/expected.png).

Supporting files -- glyphs, sprites, and tiles -- live in their own respective subdirectories at the top level. The test
harness sets up the environment such that requests for these resources are directed to the correct location.

The contents of vector tile fixtures can be read using the [`vt2geojson`](https://github.com/mapbox/vt2geojson) tool (see below).

## Running tests

To run the entire integration test suite (both render or query tests), from within the `mapbox-gl-js` directory run the command:
```
npm run test-suite
```

To run only the render/query tests:

```
npm run test-render
```
or
```
npm run test-query
```

To run only the expression tests:

```
npm run test-expressions
```

### Running specific tests

To run a subset of tests or an individual test, you can pass a specific subdirectory to the `test-render` script. For example, to run all the tests for a given property, e.g. `circle-radius`:
```
$ npm run test-render -- -t "circle-radius"
...
* circle-radius/antimeridian
* circle-radius/default
* circle-radius/function
* circle-radius/literal
* circle-radius/property-function
* circle-radius/zoom-and-property-function
...
```

Or to run a single test:
```
$ npm run test-render -- -t "circle-radius/literal"
...
* circle-radius/literal
...
```

### Viewing test results

During a test run, the test harness will use Mapbox GL JS to create an `actual.png` image from the given `style.json`, and will then use [pixelmatch](https://github.com/mapbox/pixelmatch) to compare that image to `expected.png`, generating a `diff.png` highlighting the mismatched pixels (if any) in red.

After the test(s) have run, you can view the render test results in

```
open ./test/integration/render-tests/vitest/render-tests.html
```

or for query tests in:

```
open ./test/integration/query-tests/query-tests.html
```

## Running tests in the development environment

Render and query tests can be run in a development environment. The runner will watch for changes to the test files and re-run the tests automatically.
```
npm run watch-query
```
or
```
npm run watch-render
```

## Writing new tests

To add a new render test:
1. Create a new directory `test/integration/render-tests/<property-name>/<new-test-name>`

2. Create a new `style.json` file within that directory, specifying the map to load. Feel free to copy & modify one of the existing `style.json` files from the `render-tests` subdirectories. In this file, you can add additional information to describe the test and expected outcomes using the [`description`](https://github.com/mapbox/mapbox-gl-js/blob/main/test/integration/render-tests/collator/default/style.json?short_path=254409f#L7) metadata field.

3. Generate an `expected.png` image from the given style by running the new test with the `UPDATE` flag enabled:
   ```
   $ UPDATE=1 npm run test-render -t render-tests/<property-name>/<new-test-name>
   ```
   The test will appear to fail, but you'll now see a new `expected.png` in the test directory.

4. Manually inspect `expected.png` to verify it looks as expected, and optionally run the test again without the update flag (`npm run test-render <property-name>/<new-test-name>`) to watch it pass (enjoy that dopamine kick!)

5. Commit the new `style.json` and `expected.png` :rocket:

## Tests on GitHub Actions

Every pushed commit triggers test runs on the GitHub Actions. These catch regressions and prevent platform-specific bugs.

Render tests often fail due to minor antialiasing differences between platforms. In these cases, you can add an `allowed` property under `test` in the test's `style.json` to tell the test runner the degree of difference that is acceptable. This is the fraction of pixels that can differ between `expected.png` and `actual.png`, ignoring some antialiasing, that will still allow the test to pass.

How much adjusting `allowed` is acceptable depends on the test, but values >= .01 are usually much too high. Especially with larger test images, values should generally be negligible, since a too-high value will fail to catch regressions and significant rendering differences suggest a bug

Larger `allowed` values are acceptable for testing debug features that will not be directly used by customers.

## Ignores

If a test fails on a run with too large a difference to adjust the "allowed," it can be added to the corresponding [ignore file](../ignore) for the browser or operating system.

Ignores include tests under `"todo"` and `"skip"`. `"todo"` tests show up in test results but do not trigger a failing run. Most tests failing on one platform should be marked as "ignore." This allows us to notice if the tests start passing.

Tests under `"skip"` will not run at all. Tests should be skipped if they trigger crashes or if they are flaky (to prevent falsely concluding that the test is a non-issue).

Ignored tests should link to an issue explaining the reason for ignoring the test.

## Reading Vector Tile Fixtures

Install `vt2geojson`, a command line utility which turns vector tiles into geojson, and `harp`, a simple file server.

```
npm install -g vt2geojson harp
```

Start a static file server
```
harp server .
```

Read the contents of an entire vector tile

```
vt2geojson -z 14 -y 8803 -x 5374 http://localhost:9000/tiles/14-8803-5374.mvt
```

Read the contents of a particular layer in a vector tile

```
vt2geojson --layer poi_label -z 14 -y 8803 -x 5374 http://localhost:9000/tiles/14-8803-5374.mvt
```
