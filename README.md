[![Build Status](https://magnum.travis-ci.com/mapbox/llmr.svg?token=6EjGQXFuGMFRr7mgpjEj&branch=master)](https://magnum.travis-ci.com/mapbox/llmr)

# Low-Level Map Renderer (WebGL)

A WebGL JavaScript interactive maps library that can render Mapbox vector tiles.

## Setup

Install dependencies:

```bash
$ npm install
```

Then build llmr by running:

```bash
$ npm run build           # build dist/llmr-dev.js
$ npm run production      # build dist/llmr.js
```

To rebuild `dist/llmr-dev.js` continuously while developing, run:

```bash
$ npm run watch
```

To run the debug page with a map, use any static server, for example:

```bash
$ npm install -g serve
$ serve
```

And open http://localhost:3000/debug/

Run tests with `npm test`. Generate test coverage report with `npm run cov`.

`master` is auto-published to `https://mapbox.s3.amazonaws.com/llmr/master/llmr.js` to be used in external projects.

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
