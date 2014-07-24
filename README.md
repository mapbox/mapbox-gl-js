[![Build Status](https://magnum.travis-ci.com/mapbox/mapbox-gl-js.svg?token=6EjGQXFuGMFRr7mgpjEj&branch=dev-pages)](https://magnum.travis-ci.com/mapbox/mapbox-gl-js)

A WebGL JavaScript interactive maps library that can render Mapbox vector tiles.

## Setup

Install dependencies:

```bash
$ npm install
```

Then build mapbox-gl by running:

```bash
$ npm run build           # build dist/mapbox-gl-dev.js
$ npm run production      # build dist/mapbox-gl.js
```

To rebuild `dist/mapbox-gl-dev.js` continuously while developing, run:

```bash
$ npm run watch
```

To serve the debug page:

```bash
$ npm start &
$ open http://localhost:3000/debug/?access_token=$MapboxAccessToken
```

This assumes you have the `MapboxAccessToken` environment variable set to a Mapbox API token from https://www.mapbox.com/account/apps/.

Tests are written in `tape` and can run on [Sauce Labs](https://saucelabs.com/) via [zuul](https://github.com/defunctzombie/zuul).

* `npm test`: local tests run in nodejs - excludes browser tests
* `npm run cov`: generate test coverage report - excludes browser tests
* `npm run test-remote`: run all tests on Sauce Labs. requires [Sauce Labs credentials](https://docs.saucelabs.com/tutorials/node-js/#setting-up-a-project)
  in your environment.
* `npm run test-browser`: run all tests locally in a browser.

`master` is auto-published to `https://mapbox.s3.amazonaws.com/mapbox-gl-js/master/mapbox-gl.js` to be used in external projects.

## [API Documentation](https://www.mapbox.com/mapbox-gl-js/)
## [Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/)

## Recommended Reading

#### Learning WebGL

- Greggman's WebGL articles
    - [WebGL Fundamentals](http://greggman.github.io/webgl-fundamentals/webgl/lessons/webgl-fundamentals.html)
    - [WebGL How It Works](http://greggman.github.io/webgl-fundamentals/webgl/lessons/webgl-how-it-works.html)
    - [all of them](http://greggman.github.io/webgl-fundamentals/)
- [WebGL reference card](http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

#### GL performance

- [Graphics Pipeline Performance](http://http.developer.nvidia.com/GPUGems/gpugems_ch28.html)
- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)

#### GL text rendering

- [glyphy](https://code.google.com/p/glyphy/)
- [freetype-gl](https://code.google.com/p/freetype-gl/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
- [map labelling](http://i11www.iti.uni-karlsruhe.de/~awolff/map-labeling/bibliography/maplab_date.html)

#### Misc GL

- [aacourse](http://iryoku.com/aacourse/)
- [Feature Detection](http://www.browserleaks.com/webgl)

## Includes

- [gl-matrix](https://github.com/toji/gl-matrix)
- [UnitBezier port from WebKit](js/lib/unitbezier.js)
- [assert port from Node](js/util/assert.js)
