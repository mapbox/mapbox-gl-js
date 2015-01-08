[![Build Status](https://travis-ci.org/mapbox/mapbox-gl-js.svg)](https://travis-ci.org/mapbox/mapbox-gl-js)

A WebGL JavaScript interactive maps library that can render [Mapbox Vector Tiles](https://www.mapbox.com/blog/vector-tiles/).

## Setup

To install dependencies and build the source files:

```bash
$ npm install
```

To serve the debug page:

```bash
$ npm start &
$ open http://localhost:3000/debug/?access_token=$MapboxAccessToken
```

This assumes you have the `MapboxAccessToken` environment variable set to a Mapbox API token from https://www.mapbox.com/account/apps/.
It will watch the source files and automatically rebuild the browserify bundle whenever a change is detected.

Tests are written in `tape`. Most tests run within nodejs, but a few require a browser environment.

* `npm test`: local tests run in nodejs - excludes browser tests
* `npm run cov`: generate test coverage report - excludes browser tests
* `npm run test-browser`: run all tests locally in a browser

## [API Documentation](https://www.mapbox.com/mapbox-gl-js/)

`npm run docs`: generate API docs

## [Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/)

## Sprite Generation

`./bin/build-sprite.js [outname] [inputdirs]`: generate an image sprite by running this script on one or more directories of PNG images.

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
