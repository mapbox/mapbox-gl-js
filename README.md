[![Build Status](https://circleci.com/gh/mapbox/mapbox-gl-js.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-js) [![Coverage Status](https://coveralls.io/repos/github/mapbox/mapbox-gl-js/badge.svg?branch=master)](https://coveralls.io/github/mapbox/mapbox-gl-js?branch=master)

A WebGL JavaScript interactive maps library that can render [Mapbox Vector Tiles](https://www.mapbox.com/blog/vector-tiles/).

## Using mapbox-gl-js

Include the source via HTML tags:

```html
<script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.16.0/mapbox-gl.js'></script>
<link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.16.0/mapbox-gl.css' rel='stylesheet' />
```

For more information, see the [API documentation](https://www.mapbox.com/mapbox-gl-js/api/) and [examples](https://www.mapbox.com/mapbox-gl-js/examples/).

Alternatively, you can `npm install mapbox-gl` and use it as a bundled dependency with browserify.

## [Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/)

## Developing mapbox-gl-js

### Preparing your Development Environment

#### OSX

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/)
```bash
brew install node
```

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
npm install
```

#### Linux

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/), [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git nodejs libglew-dev
```

Clone the repository
```bash
git clone git@github.com:mapbox/mapbox-gl-js.git
```

Install node module dependencies
```bash
cd mapbox-gl-js &&
npm install
```

### Serving the Debug Page

Start the debug server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} npm start
```

Open the debug page at [http://localhost:9966](http://localhost:9966)

### Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `mapbox-gl.js` and `mapbox-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
npm run production
```

Once that command finishes, you will have a standalone build at `dist/mapbox-gl.js` and `dist/mapbox-gl.css`

### Running Tests

There are two test suites associated with Mapbox GL JS

 - `npm test` runs quick unit tests
 - `npm run test-suite` runs slower rendering tests from the [mapbox-gl-test-suite](https://github.com/mapbox/mapbox-gl-test-suite) repository

### Running Benchmarks

See [`bench/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/bench/README.md).

### Writing Documentation

See [`docs/README.md`](https://github.com/mapbox/mapbox-gl-js/blob/master/docs/README.md).

### Recommended Reading

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
