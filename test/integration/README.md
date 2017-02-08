Verify correctness and consistency of [mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js) and
[mapbox-gl-native](https://github.com/mapbox/mapbox-gl-native) rendering.

## Organization

Tests are contained in a directory tree, generally organized by [style specification](https://github.com/mapbox/mapbox-gl-style-spec)
property: `background-color`, `line-width`, etc., with a second level of directories below that for individual tests.

Within a leaf directory is a `style.json` file, which contains the minimal style needed for the given test case. The style can specify the map size, center, bearing, and pitch, and additional test metadata. The expected output for a given test case is in `expected.png`, e.g. [`tests/background-color/constant/expected.png`](https://github.com/mapbox/mapbox-gl-js/blob/master/test/integration/render-tests/background-color/constant/expected.png).

Supporting files -- glyphs, sprites, and tiles -- live in their own respective subdirectories at the top level. The test
harness sets up the environment such that requests for these resources are directed to the correct location.

The contents of vector tile fixtures can be read using the [`vt2geojson`](https://github.com/mapbox/vt2geojson) tool

## Running tests

Run `npm run test-suite` in mapbox-gl-js or mapbox-gl-native. To view the results graphically, run:

```
open ./test/integration/render-tests/index.html
```
or
```
open ./test/integration/query-tests/index.html
```

When run via Travis, the test artifacts are uploaded to S3 as a permanent record of results. Near the
end of the Travis output is a link to the result, for example:

http://mapbox.s3.amazonaws.com/mapbox-gl-native/tests/5952.10/index.html

## Writing new tests

Expected results are always generated with the **js** implementation. This is merely for consistency and does not
imply that in the event of a rendering discrepancy, the js implementation is always correct.

```
UPDATE=1 npm run test-suite
[review and commit changes]
```

### Reading Vector Tile Fixtures

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
