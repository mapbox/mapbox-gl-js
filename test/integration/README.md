# GL-JS Integration Tests

These integration tests verify the correctness and consistency of [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) rendering.

## Organization

Tests are contained in a directory tree, generally organized by [style specification](https://github.com/mapbox/mapbox-gl-style-spec)
property: `background-color`, `line-width`, etc., with a second level of directories below that for individual tests. For example, the test for specifying a literal `circle-radius` value lives in [`test/integration/render-tests/circle-radius/literal/`](./render-tests/circle-radius/literal).

Within a leaf directory is a `style.json` file (e.g. [`circle-radius/literal/style.json`](./render-tests/circle-radius/literal/style.json)), which contains the minimal style needed for the given test case. The style can specify the map size, center, bearing, and pitch, and additional test metadata (e.g. output image dimensions) in a `metadata.test` block.

The expected output for a given test case is in `expected.png`, e.g. [`circle-radius/literal/expected.png`](./render-tests/circle-radius/literal/expected.png). A test may carry additional platform-specific baselines named `expected-<tag-prefix>.png` — see [Reference Images / Expectations](#reference-images--expectations) below.

Supporting files -- glyphs, sprites, and tiles -- live in their own respective subdirectories at the top level. The test
harness sets up the environment such that requests for these resources are directed to the correct location.

The contents of vector tile fixtures can be read using the [`vt2geojson`](https://github.com/mapbox/vt2geojson) tool (see below).

## Running tests

To run the entire integration test suite (both render or query tests), from within the `mapbox-gl-js` directory run the command:

```shell
npm run test-suite
```

To run only the render/query tests:

```shell
npm run test-render
```

or

```shell
npm run test-query
```

To run only the expression tests:

```shell
npm run test-expressions
```

### Running specific tests

To run a subset of tests or an individual test, you can pass a specific subdirectory to the `test-render` script. For example, to run all the tests for a given property, e.g. `circle-radius`:

```shell
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

```shell
$ npm run test-render -- -t "circle-radius/literal"
...
* circle-radius/literal
...
```

### Viewing test results

During a test run, the test harness will use Mapbox GL JS to create an `actual.png` image from the given `style.json`, and will then use [pixelmatch](https://github.com/mapbox/pixelmatch) to compare that image to the resolved expected image, generating a `diff.png` highlighting the mismatched pixels (if any) in red. (`actual.png` and `diff.png` are runner outputs and are not checked in.)

After the tests have run, you can view the render test results in

```shell
open ./test/integration/render-tests/render-tests.html
```

or for query tests in:

```shell
open ./test/integration/query-tests/query-tests.html
```

The HTML report summarizes which tests passed, failed, or were skipped. For each test it states which [platform tag](#platform-tags) the run used, which expected image was matched (`Used expectation:`), what the image threshold was, and the actual image diff — or, for skipped tests, which skip rules matched and why.

By default the report embeds the `actual`/`expected`/`diff` images only for failed tests. To also embed them for passed tests (useful for local debugging):

```shell
EMBED_PASSED_IMAGES=true npm run test-render -- -t <pattern>
```

## Running tests in the development environment

Render and query tests can be run in a development environment. The runner will watch for changes to the test files and re-run the tests automatically.

```shell
npm run watch-query
```

or

```shell
npm run watch-render
```

## Writing new tests

To add a new render test:

1. Create a new directory `test/integration/render-tests/<property-name>/<new-test-name>`

2. Create a new `style.json` file within that directory, specifying the map to load. Feel free to copy & modify one of the existing `style.json` files from the `render-tests` subdirectories. In this file, you can add additional information to describe the test and expected outcomes using the [`description`](https://github.com/mapbox/mapbox-gl-js/blob/main/test/integration/render-tests/collator/default/style.json?short_path=254409f#L7) metadata field.

3. Generate an `expected.png` image from the given style by running the new test with the `UPDATE` flag enabled:

   ```shell
   $ UPDATE=1 npm run test-render -t render-tests/<property-name>/<new-test-name>
   ```

   The test will appear to fail, but you'll now see a new `expected.png` in the test directory.

4. Manually inspect `expected.png` to verify it looks as expected, and optionally run the test again without the update flag (`npm run test-render <property-name>/<new-test-name>`) to watch it pass (enjoy that dopamine kick!)

5. Commit the new `style.json` and `expected.png` :rocket:

### Updating baselines

`UPDATE=1 npm run test-render -- -t <pattern>` accepts a new baseline for existing tests, too. The runner writes back to the **resolved** expectation filename — for example, if `expected-web-linux.png` was the matched baseline for the current run, that file is updated, not `expected.png`. For brand-new tests with no expected image yet, it writes `expected.png`. Always inspect the resulting image diffs before committing.

## Platform Tags

Every test run identifies itself with a **platform tag** — a dash-separated string derived from the OS and browser, printed in the HTML report. Platform tags are used to resolve which expected image applies, and are matched by `skip-test` and `image-threshold` rules to target specific runners.

The web platform tags are:

- `web-macos-chrome`
- `web-macos-safari`
- `web-linux-chrome`
- `web-linux-firefox`
- `web-windows-chrome`

This test suite is also exercised by other Mapbox render-test runners whose platform tags start with `native-`. You may therefore encounter `expected-native*.png` baselines and rules targeting `native-` tags in test directories; the web harness never matches them.

Rules use a `platform-tag-contains` substring match — `"web-macos"` matches Chrome and Safari on macOS, `""` (empty string) matches everything. If a rule uses a substring that doesn't match any known tag, that single test is marked as errored (the rest of the run continues). The HTML report always shows the exact tag for the current run.

## Reference Images / Expectations

Baseline images are resolved with a hierarchical filename strategy. For any test, the runner:

1. Derives the current platform tag (for example `web-linux-chrome`).
2. Constructs candidate filenames: `expected-<full-platform-tag>.png`, then progressively shorter tag prefixes, then `expected.png`.
3. Uses the **first existing file** in that order.
4. Compares the rendered image against that single baseline.

For example, with platform tag `web-macos-chrome`, the candidates are `expected-web-macos-chrome.png`, `expected-web-macos.png`, `expected-web.png`, then `expected.png`.

The HTML report shows `Used expectation:` so you can see exactly which file was matched.

## Image Thresholds

Render tests sometimes need some tolerance for differences between platforms. Thresholds live directly in each test's `style.json` under `metadata.test.image-threshold` (default `0.00015` when no rule matches).

`image-threshold` is an array of rules evaluated in order — the **last** matching rule wins. Each rule is an object with `"platform-tag-contains"` (a substring matched against the platform tag; empty string matches all) and `"threshold"` (a number). Example:

```json
"image-threshold": [
  {"platform-tag-contains": "", "threshold": 0.00015},
  {"platform-tag-contains": "web-macos", "threshold": 0.0002},
  {"platform-tag-contains": "web-macos-safari", "threshold": 0.00035}
]
```

Put the catch-all rule first and more specific rules after it, so the most specific match wins. Don't inflate a threshold more than the observed diff needs; a too-loose threshold fails to catch real regressions.

## Skipping tests

Tests can be skipped on a per-platform basis directly in `style.json` under `metadata.test.skip-test`. For expression tests (which have no `style.json`), the same block goes in the test's `test.json`.

`skip-test` is an array of rules — if **any** rule matches the current platform tag, the test is skipped. Each rule has `"platform-tag-contains"` (a substring; `""` matches all) and `"reason"` (a string). All matching rules and their reasons are recorded and shown in the HTML report.

```json
"skip-test": [
  {"platform-tag-contains": "web-linux-firefox", "reason": "flaky, see https://github.com/mapbox/mapbox-gl-js/issues/12345"}
]
```

The HTML report includes a section listing every skipped test with its matching rules and reasons, making it easy to audit what's being ignored and why.

## Common Issues

- **"I added `expected-macos.png`, but it never gets picked."** Only hierarchical prefixes of the full platform tag are considered. For `web-macos-chrome`, valid progressive names are `expected-web-macos-chrome.png`, `expected-web-macos.png`, `expected-web.png`, then `expected.png`.
- **"I overwrote `expected.png`, but CI still fails on one platform."** A more specific `expected-<tag-prefix>.png` may shadow it. Check the report's `Used expectation:` to see what was actually matched.
- **"A platform-specific baseline should apply more broadly."** Move or copy from a very specific filename (for example `expected-web-macos-safari.png`) to a less specific prefix (for example `expected-web-macos.png` or `expected-web.png`) depending on intended scope.

## Reading Vector Tile Fixtures

Install `vt2geojson`, a command line utility which turns vector tiles into geojson, and `harp`, a simple file server.

```shell
npm install -g vt2geojson harp
```

Start a static file server

```shell
harp server .
```

Read the contents of an entire vector tile

```shell
vt2geojson -z 14 -y 8803 -x 5374 http://localhost:9000/tiles/14-8803-5374.mvt
```

Read the contents of a particular layer in a vector tile

```shell
vt2geojson --layer poi_label -z 14 -y 8803 -x 5374 http://localhost:9000/tiles/14-8803-5374.mvt
```
