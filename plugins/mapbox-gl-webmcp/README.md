# @mapbox/mapbox-gl-webmcp

Lets a browser agent operate your Mapbox GL JS map for its user. The plugin registers map tools with the browser's WebMCP API on the page, so you run no MCP server, gateway or WebSocket bridge.

> **Experimental.** WebMCP and this package are experimental, and the API may change before 1.0.

## Getting started

Install the package. It needs the latest `mapbox-gl`.

```bash
npm install @mapbox/mapbox-gl-webmcp@experimental
```

Add the control to your map and pass `mapboxgl` and `tools` for all tools, or an object with only the tools you want.

```ts
import mapboxgl from 'mapbox-gl';
import {tools} from '@mapbox/mapbox-gl-webmcp/tools';
import {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard'
});

map.addControl(new MapboxWebMCP({mapboxgl, tools}));
```

Turn on WebMCP in the browser. For example, in Chrome, turn on `chrome://flags/#enable-webmcp-testing` and relaunch the browser.

For your production site to work in Chrome, [register for the WebMCP origin trial](https://developer.chrome.com/origintrials/#/trials/active) and add the token to your pages:

```html
<meta http-equiv="origin-trial" content="YOUR_TOKEN">
```

## Load from the CDN

Without a bundler, load the GL JS ESM build and the plugin from the Mapbox CDN with an import map:

```html
<link href="https://api.mapbox.com/mapbox-gl-js/v3.35.0/mapbox-gl.css" rel="stylesheet">
<div id="map" style="position: absolute; inset: 0;"></div>
<script type="importmap">
    {
        "imports": {
            "mapbox-gl": "https://api.mapbox.com/mapbox-gl-js/v3.35.0/esm/mapbox-gl.js",
            "@mapbox/mapbox-gl-webmcp": "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-webmcp/v0.1.0-alpha.1/mapbox-gl-webmcp.js",
            "@mapbox/mapbox-gl-webmcp/tools": "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-webmcp/v0.1.0-alpha.1/tools.js"
        }
    }
</script>
<script type="module">
    import * as mapboxgl from 'mapbox-gl';
    import {tools} from '@mapbox/mapbox-gl-webmcp/tools';
    import {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';

    const map = new mapboxgl.Map({
        accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN',
        container: 'map',
        style: 'mapbox://styles/mapbox/standard'
    });

    map.addControl(new MapboxWebMCP({mapboxgl, tools}));
</script>
```

## Pick and rename tools

Pass only the tools you want. Rename a tool by giving it another key:

```ts
import mapboxgl from 'mapbox-gl';
import {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';
import {camera, marker} from '@mapbox/mapbox-gl-webmcp/tools';

map.addControl(new MapboxWebMCP({mapboxgl, tools: {camera, markers: marker}}));
```

## Custom tools

```ts
import mapboxgl from 'mapbox-gl';
import {tools} from '@mapbox/mapbox-gl-webmcp/tools';
import {MapboxWebMCP} from '@mapbox/mapbox-gl-webmcp';

map.addControl(new MapboxWebMCP({mapboxgl, tools: {
    ...tools,
    center_on: {
        description: 'Center the map on a LngLat.',
        inputSchema: {type: 'object', properties: {lng: {type: 'number'}, lat: {type: 'number'}}, required: ['lng', 'lat'], additionalProperties: false},
        async execute({lng, lat}, map) {
            map.setCenter([lng, lat]);
            return {lng, lat};
        }
    }
}}));
```

`execute` gets the checked input, typed from the schema, the map and the `mapboxgl` you passed.

## Development

```bash
npm run build
npm test
```
