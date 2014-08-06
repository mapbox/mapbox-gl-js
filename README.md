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

To serve the debug page:

```bash
$ npm start &
$ open http://localhost:3000/debug/?access_token=$MapboxAccessToken
```

This assumes you have the `MapboxAccessToken` environment variable set to a Mapbox API token from https://www.mapbox.com/account/apps/.
It will watch the source files and automatically rebuild the browserify bundle whenever a change is detected.

Tests are written in `tape` and can run on [Sauce Labs](https://saucelabs.com/) via [zuul](https://github.com/defunctzombie/zuul).

* `npm test`: local tests run in nodejs - excludes browser tests
* `npm run cov`: generate test coverage report - excludes browser tests
* `npm run test-remote`: run all tests on Sauce Labs. requires [Sauce Labs credentials](https://docs.saucelabs.com/tutorials/node-js/#setting-up-a-project)
  in your environment.
* `npm run test-browser`: run all tests locally in a browser.

`master` is auto-published to `https://mapbox.s3.amazonaws.com/mapbox-gl-js/master/mapbox-gl.js` to be used in external projects.

## [API Documentation](https://www.mapbox.com/mapbox-gl-js/)

`npm run docs`: generate API docs

## [Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/)

## Sprite Generation

`npm run build-sprite [outname] [inputdirs]`: generate an image sprite by running this script on one or more directories of PNG images.

## Recommended Reading

#### Learning WebGL

- Greggman's WebGL articles
    - [WebGL Fundamentals](http://greggman.github.io/webgl-fundamentals/webgl/lessons/webgl-fundamentals.html)
    - [WebGL How It Works](http://greggman.github.io/webgl-fundamentals/webgl/lessons/webgl-how-it-works.html)
    - [all of them](http://greggman.github.io/webgl-fundamentals/)
- [WebGL reference card](http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

#### GL performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)
- [Graphics Pipeline Performance](http://http.developer.nvidia.com/GPUGems/gpugems_ch28.html)

#### Misc

- [drawing antialiased lines](https://www.mapbox.com/blog/drawing-antialiased-lines/)
- [drawing text with signed distance fields](https://www.mapbox.com/blog/text-signed-distance-fields/)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
