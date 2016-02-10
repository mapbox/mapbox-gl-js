[![Build Status](https://circleci.com/gh/mapbox/mapbox-gl-js.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-js)

A WebGL JavaScript interactive maps library that can render [Mapbox Vector Tiles](https://www.mapbox.com/blog/vector-tiles/).

## Using mapbox-gl-js

Include the source via HTML tags:

```html
<script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.14.1/mapbox-gl.js'></script>
<link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.14.1/mapbox-gl.css' rel='stylesheet' />
```

For more information, see the [API documentation](https://www.mapbox.com/mapbox-gl-js/api/) and [examples](https://www.mapbox.com/mapbox-gl-js/examples/).

Alternatively, you can `npm install mapbox-gl` and use it as a bundled dependency with browserify.

## Developing mapbox-gl-js

The following tools are required on any platform to develop `mapbox-gl-js`.
Mac users are advised to use Homebrew unless they want to build these packages
manually. APT install steps are relevant to Ubuntu Linux users.

* [git](https://git-scm.com/)
  * OSX: `brew install git`
  * APT: `sudo apt-get install git`
* [node.js](https://nodejs.org/)
* [GNU Make](http://www.gnu.org/software/make/)
* [imagemagick](http://www.imagemagick.org/)
  * OSX: `brew install imagemagick`
  * APT: `sudo apt-get install imagemagick`

On Linux, libglew-dev is required in order to run rendering tests:

```
$ sudo apt-get install libglew-dev
```

To install dependencies and build the source files:

```bash
$ npm install
```

To serve the debug page:

```bash
$ npm start &
$ open "http://localhost:9966/debug/?access_token="`echo $MapboxAccessToken`
```

This assumes you have the `MapboxAccessToken` environment variable set to a
Mapbox API token from https://www.mapbox.com/account/apps/.
This command uses [mattdesl/budo](https://github.com/mattdesl/budo) to watch
source files, rebuild the browserify bundle, and trigger LiveReload updates.

## Running Tests

There are two test suites associated with Mapbox GL JS

 - `npm test` runs quick unit tests
 - `npm run test-suite` runs slower rendering tests from the [mapbox-gl-test-suite](https://github.com/mapbox/mapbox-gl-test-suite) repository

## Running Benchmarks

The FPS benchmarking page compares the performance of your local copy of GL JS against previously released versions. Benchmarking configuration is within `bench/fps/site.js`.

To serve the FPS benchmark page:

```bash
$ npm start &
$ open "http://localhost:9966/bench/fps/?access_token="`echo $MapboxAccessToken`
```

## Writing Documentation

See [docs/README.md](https://github.com/mapbox/mapbox-gl-js/blob/master/docs/README.md).

## [Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/)

## Recommended Reading

#### Learning WebGL

- [Greggman's WebGL articles](http://webglfundamentals.org/)
- [WebGL reference card](http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

#### GL performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)
- [Graphics Pipeline Performance](http://http.developer.nvidia.com/GPUGems/gpugems_ch28.html)

#### Misc

- [drawing antialiased lines](https://www.mapbox.com/blog/drawing-antialiased-lines/)
- [drawing text with signed distance fields](https://www.mapbox.com/blog/text-signed-distance-fields/)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
