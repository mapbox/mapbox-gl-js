# Low-Level Map Renderer (WebGL)

A WebGL JavaScript interactive maps library that can render Mapbox vector tiles.


## Setup

Set up the build system:

```bash
npm install grunt-cli -g   # install grunt runner
npm install                # install dependencies
```

Then you can build packaged `dist/llmr.js` by running `grunt`.

To run the debug page with a map, run a simple HTTP server in the root directory and then open `/debug` on localhost.
For example, like this:

```bash
npm install serve -g
serve
```

While developing, you can keep `grunt watch` running in the background to automatically update
the bundled files and check for errors with JSHint. The files contain source maps to ease debugging.

Run tests with `npm test`.


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
