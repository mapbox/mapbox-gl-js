[![Build Status](https://circleci.com/gh/mapbox/mapbox-gl-js.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-js) [![Coverage Status](https://coveralls.io/repos/github/mapbox/mapbox-gl-js/badge.svg?branch=master)](https://coveralls.io/github/mapbox/mapbox-gl-js?branch=master)

# Mapbox GL JS

Mapbox GL JS is a Javascript & WebGL library that renders interactive maps from [vector tiles](https://www.mapbox.com/blog/vector-tiles/) and [Mapbox styles](https://www.mapbox.com/mapbox-gl-style-spec).

It is part of the [Mapbox GL ecosystem](https://github.com/mapbox/mapbox-gl) which includes [Mapbox GL Native](https://github.com/mapbox/mapbox-gl-native), a suite of compatible SDKs for native desktop and mobile applications.

- [API Documentation](https://www.mapbox.com/mapbox-gl-js/api)
- [API Examples](https://www.mapbox.com/mapbox-gl-js/examples/)
- [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec)
- [Gallery](https://www.mapbox.com/gallery/)
- [Roadmap](https://www.mapbox.com/mapbox-gl-js/roadmap/)
- [Top Github Issues](https://mapbox.github.io/top-issues/#!mapbox/mapbox-gl-js)

[<img width="981" alt="Mapbox GL JS gallery" src="https://cloud.githubusercontent.com/assets/281306/14547142/a3c98294-025f-11e6-92f4-d6b0f50c8e89.png">](https://www.mapbox.com/gallery/)

## Using Mapbox vector tiles and styles

To use the [vector tiles](https://www.mapbox.com/maps/) and styles hosted on http://mapbox.com, you must [create an account](https://www.mapbox.com/studio/signup/) and then [obtain an access token](https://www.mapbox.com/studio/account/tokens/). You may learn more about access tokens [here](https://www.mapbox.com/help/define-access-token/).

## Using Mapbox GL JS with a `<script>` tag

```html
<!DOCTYPE html>
<html>
<head>
    <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.31.0/mapbox-gl.js'></script>
    <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.31.0/mapbox-gl.css' rel='stylesheet' />
</head>

<body>
    <div id='map' style='width: 400px; height: 300px;' />

    <script>
        mapboxgl.accessToken = '<your access token here>';
        var map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v9'
        });
    </script>
</body>
</html>
```

## Using Mapbox GL JS with [Browserify](http://browserify.org/)

Install the [`mapbox-gl` npm package](https://www.npmjs.com/package/mapbox-gl)

```bash
npm install --save mapbox-gl
```

Instantiate `mapboxgl.Map`

```js
var mapboxgl = require('mapbox-gl');
mapboxgl.accessToken = '<your access token here>';
var map = new mapboxgl.Map({
    container: '<your HTML element id>',
    style: 'mapbox://styles/mapbox/streets-v9'
});
```

## Using Mapbox GL JS with other module systems

Since our build system depends on Browserify, to use Mapbox GL with any other module bundlers like [Webpack](https://webpack.github.io/), [SystemJS](https://github.com/systemjs/systemjs), you have to require the distribution build instead of the package entry point:

```js
var mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');
```

If you're using the ES6 module system (e.g. with [Rollup](https://github.com/rollup/rollup) as a bundler), you can import `mapboxgl` like so:

```js
import mapboxgl from 'mapbox-gl/dist/mapbox-gl.js';
```

## Third Party Projects

These projects are written and maintained by the GL JS community. Feel free to open a PR add your own projects to this list. We :heart: third party projects!

 - [Typescript Definitions on DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/mapbox-gl)
 - [wtMapbox: Webtoolkit Integration](https://github.com/yvanvds/wtMapbox)
 - [deck.gl: Advanced WebGL visualization layers](https://github.com/uber/deck.gl)
 - [echartslayer: echarts extension for mapboxgl](https://github.com/lzxue/echartLayer)


## Using Mapbox GL JS with [CSP](https://developer.mozilla.org/en-US/docs/Web/Security/CSP)

You may use a Content Security Policy to restrict the resources your page has
access to, as a way of guarding against Cross-Site Scripting and other types of
attacks. If you do, Mapbox GL JS requires the following directives:

```
child-src blob: ;
img-src data: blob: ;
script-src 'unsafe-eval' ;
```

Requesting styles from Mapbox or other services will require additional
directives. For Mapbox, you can use this `connect-src` setting:

```
connect-src https://*.tiles.mapbox.com https://api.mapbox.com
```

## Contributing to Mapbox GL JS

See [CONTRIBUTING.md](https://github.com/mapbox/mapbox-gl-js/blob/master/CONTRIBUTING.md).
