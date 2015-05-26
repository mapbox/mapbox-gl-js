[![Build Status](https://circleci.com/gh/mapbox/mapbox-gl-js.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-js)

A WebGL JavaScript interactive maps library that can render [Mapbox Vector Tiles](https://www.mapbox.com/blog/vector-tiles/).

## Using mapbox-gl-js

Include the source via HTML tags:

```html
<script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.7.0/mapbox-gl.js'></script>
<link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.7.0/mapbox-gl.css' rel='stylesheet' />
```

For more information, see the [API documentation](https://www.mapbox.com/mapbox-gl-js/api/) and [examples](https://www.mapbox.com/mapbox-gl-js/examples/).

Note that `mapbox-gl-js` is [currently unsafe](https://github.com/mapbox/mapbox-gl-js/issues/787) to use as a bundled dependency using browserify. Please include it as a separate source file.

## Developing mapbox-gl-js

On linux, libglew-dev is required in order to run rendering tests:

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

Tests are written in `tape`. Most tests run within nodejs, but a few
require a browser environment.

* `npm test`: local tests run in nodejs - excludes browser tests
* `npm run cov`: generate test coverage report - excludes browser tests
* `npm run test-browser`: run all tests locally in a browser

## [API Documentation](https://www.mapbox.com/mapbox-gl-js/)

`npm run docs`: generate API docs

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
