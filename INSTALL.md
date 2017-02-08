# Getting started with Mapbox on the web

### Using Mapbox vector tiles and styles

To use the [vector tiles](https://www.mapbox.com/maps/) and styles hosted on [mapbox.com](http://mapbox.com), you must [create an account](https://www.mapbox.com/studio/signup/) and then [obtain an access token](https://www.mapbox.com/studio/account/tokens/). You may learn more about access tokens [here](https://www.mapbox.com/help/define-access-token/).

### Using Mapbox with a `<script>` tag

```html
<!DOCTYPE html>
<html>
<head>
    <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.32.1/mapbox-gl.js'></script>
    <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.32.1/mapbox-gl.css' rel='stylesheet' />
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

### Using Mapbox with [Browserify](http://browserify.org/)

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

Add the CSS file at `node_modules/mapbox-gl/dist/mapbox-gl.css` or `https://api.tiles.mapbox.com/mapbox-gl-js/v0.32.1/mapbox-gl.css`.

### Using Mapbox with other module systems

Since our build system depends on Browserify, to use Mapbox GL with any other module bundlers like [Webpack](https://webpack.github.io/), [SystemJS](https://github.com/systemjs/systemjs), you have to require the distribution build instead of the package entry point:

```js
var mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');
```

If you're using the ES6 module system (e.g. with [Rollup](https://github.com/rollup/rollup) as a bundler), you can import `mapboxgl` like so:

```js
import mapboxgl from 'mapbox-gl/dist/mapbox-gl.js';
```

Add the CSS file at `node_modules/mapbox-gl/dist/mapbox-gl.css` or `https://api.tiles.mapbox.com/mapbox-gl-js/v0.32.1/mapbox-gl.css`.

### Using Mapbox with [CSP](https://developer.mozilla.org/en-US/docs/Web/Security/CSP)

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
