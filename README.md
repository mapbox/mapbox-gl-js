[![Build Status](https://circleci.com/gh/mapbox/mapbox-gl-js.svg?style=svg)](https://circleci.com/gh/mapbox/mapbox-gl-js) [![Coverage Status](https://coveralls.io/repos/github/mapbox/mapbox-gl-js/badge.svg?branch=master)](https://coveralls.io/github/mapbox/mapbox-gl-js?branch=master)

# Mapbox GL JS

Mapbox GL JS is a Javascript & WebGL library that renders interactive maps from [vector tiles](https://www.mapbox.com/blog/vector-tiles/) and the [Mapbox GL Style Specification]([Style Specification](https://www.mapbox.com/mapbox-gl-style-spec)).

It is part of the [Mapbox GL ecosystem](https://github.com/mapbox/mapbox-gl) which includes [Mapbox GL Native](https://www.mapbox.com/mapbox-gl-native), a suite of compatible SDKs for native desktop and mobile applications.

- [API Documentation](https://www.mapbox.com/mapbox-gl-js/api)
- [API Examples](https://www.mapbox.com/mapbox-gl-js/examples/)
- [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec)
- [Gallery](https://www.mapbox.com/gallery/)
- [Typescript Interface Definition](https://github.com/Smartrak/mapbox-gl-js-typescript)

[<img width="981" alt="Mapbox GL JS gallery" src="https://cloud.githubusercontent.com/assets/281306/14547142/a3c98294-025f-11e6-92f4-d6b0f50c8e89.png">](https://www.mapbox.com/gallery/)

## Using Mapbox GL JS with a `<script>` tag

To use the [vector tiles](https://www.mapbox.com/maps/) and styles hosted on http://mapbox.com, you must [create an account](https://www.mapbox.com/studio/signup/) and then [obtain an access token](https://www.mapbox.com/studio/account/tokens/). You may learn more about access tokens [here](https://www.mapbox.com/help/define-access-token/).

```html
<!DOCTYPE html>
<html>
<head>
    <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.20.1/mapbox-gl.js'></script>
    <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.20.1/mapbox-gl.css' rel='stylesheet' />
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

To use the [vector tiles](https://www.mapbox.com/maps/) and styles hosted on http://mapbox.com, you must [create an account](https://www.mapbox.com/studio/signup/) and then [obtain an access token](https://www.mapbox.com/studio/account/tokens/). You may learn more about access tokens [here](https://www.mapbox.com/help/define-access-token/).

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

## Using Mapbox GL JS with [Webpack](https://webpack.github.io/)

To use the [vector tiles](https://www.mapbox.com/maps/) and styles hosted on http://mapbox.com, you must [create an account](https://www.mapbox.com/studio/signup/) and then [obtain an access token](https://www.mapbox.com/studio/account/tokens/). You may learn more about access tokens [here](https://www.mapbox.com/help/define-access-token/).

Install the [`mapbox-gl` npm package](https://www.npmjs.com/package/mapbox-gl)
and the required loaders.

```bash
npm install --save mapbox-gl
npm install --save transform-loader
npm install --save json-loader
npm install --save webworkify-webpack
```

Add the [required additional options from webpack.config.example.js](webpack.config.example.js)
to your webpack configuration.

Instantiate `mapboxgl.Map`

```js
var mapboxgl = require('mapbox-gl');
mapboxgl.accessToken = '<your access token here>';
var map = new mapboxgl.Map({
    container: '<your HTML element id>',
    style: 'mapbox://styles/mapbox/streets-v9'
});
```

### Using import

If you're using the ES6 module system, you can import `mapboxgl` like so:

```js
import mapboxgl from 'mapbox-gl';
```

## Contributing to Mapbox GL JS

See [CONTRIBUTING.md](https://github.com/mapbox/mapbox-gl-js/blob/master/CONTRIBUTING.md).
