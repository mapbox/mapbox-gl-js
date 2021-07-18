### NPM Install Bundled Package
npm install --save mapbox-gl

<link href='https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl.css' rel='stylesheet' />
import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl'; // or "const mapboxgl = require('mapbox-gl');"

mapboxgl.accessToken = 'pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v11', // style URL
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9 // starting zoom
});
Reading this documentation
This documentation is divided into several sections:

Map. The Map object is the map on your page. It lets you access methods and properties for interacting with the map's style and layers, respond to events, and manipulate the user's perspective with the camera.
Properties and options. This section describes Mapbox GL JS's global properties and options that you might want to access while initializing your map or accessing information about its status.
Markers and controls. This section describes the user interface elements that you can add to your map. The items in this section exist outside of the map's canvas element.
Geography and geometry. This section includes general utilities and types that relate to working with and manipulating geographic information or geometries.
User interaction handlers. The items in this section relate to the ways in which the map responds to user input.
Sources. This section describes the source types Mapbox GL JS can handle besides the ones described in the Mapbox Style Specification.
Events and event types. This section describes the different types of events that Mapbox GL JS can raise.
Each section describes classes or objects as well as their properties, parameters, instance members, and associated events. Many sections also include inline code examples and related resources.
New in v2
3D elevated terrain in GL JS v2
Mapbox GL JS v2 enables 3D mapping with elevated terrain, customizable skies and atmospheric lighting, a new camera, and performance enhancements.

3D terrain: Mapbox GL JS v2 adds elevated terrain rendering. Existing layer types and APIs will continue to work with the new 3D terrain. The new Mapbox Raster Data API service provides raster terrain tiles for use with the new 3D terrain.
Sky layer: To allow for highly pitched 3D maps, Mapbox GL JS v2 adds a sky layer that enables a customizable sky filling the space above the map horizon. The sky layer can have a custom color gradient or simulate real-world atmospheric scattering of light.
Fog: Mapbox GL JS v2 adds fog, a subtle rendering effect that improves the visuals of maps. Fog can fit a specific mood, and fading with distance provides an important visual cue to help perceive depth. Developers can also use fog to optimize their maps, as this effect can greatly reduce the number of tiles loaded in the distance.
FreeCamera API: Mapbox GL JS v2 provides a new low-level camera API known as the FreeCamera API. The FreeCamera allows you to move and animate the camera location and camera target independently of each other.
Improved performance: Compared to v1, Mapbox GL JS v2 improves load time by up to 50% and renders more tile content during camera animations. In benchmark tests, the median map load time improved by 30%. v2 also optimizes resource loading and task scheduling to leave more CPU resources available for your application.
Migrating to v2
Mapbox GL JS v2 is backwards-compatible and existing layers and APIs will continue to work as expected, but there are some things to be aware of before upgrading to v2.

Mapbox GL JS v2 ends support for Internet Explorer 11. If you need to support Internet Explorer, consider using the Mapbox Static Images API for non-interactive maps or using the Mapbox Static Tiles API with another library (for example, Mapbox.js or Leaflet) for interactive maps.
The default maxPitch is increased from 60° to 85°. This change will make it possible to view above the horizon when the map is fully pitched. By default, this area will be transparent to any pixels behind the map on a website or in an application. A sky layer can be added to the map to fill this space with a realistic, customizable sky.
A valid Mapbox access token is required to instantiate a Map object. Assign a token using mapboxgl.accessToken or in the Map constructor options. To create an account or a new access token, visit https://account.mapbox.com.
The action that triggers a map load has changed. In v1, a map load would occur whenever a Map instance is created and the map requested Mapbox-hosted tile resources. In v2, a map load occurs whenever a Map instance is created regardless of whether the map requests any Mapbox-hosted tile resources. Before updating an existing implementation of GL JS to v2, review the pricing documentation.
Known issues:
High pitch: Two-finger rotate gestures may break for touch points above the horizon.
Terrain + High pitch: The GeolocateControl is not rendered correctly on highly pitched views with terrain.
Terrain: *-translate properties for symbol, circle, and fill-extrusion layers do not account for terrain height.
Terrain: Tile level-of-detail may cause terrain height to flicker when switching zoom levels.
Terrain: Paint properties update in steps at integer zoom levels.
Terrain: The height map for over-zoomed tiles is not being retained.
To report new issues with Mapbox GL JS v2, create a bug report on GitHub.
Transpiling v2
Mapbox GL JS v2 is distributed as an ES6 compatible JavaScript bundle and is compatible with all major modern browsers.

The JavaScript bundle is incompatible with some Babel transforms because of the way it shares code between the main thread and Web Worker. We do this to reduce the bundle size and improve rendering performance. If you are using v2 with a module bundler such as Webpack or Rollup along with a transpiler such as Babel, there are three ways to make it compatible:

Use browserslist to target transpilation to a set of compatible transforms
Explicitly disable transpiling of the Mapbox GL JS bundle
Load and transpile Web Worker code separately at the cost of increasing bundle size and reducing performance.
Targeting transpilation to ES6 with browserslist
If you're using @babel/preset-env in conjunction with browserslist to set target browser environments, consider using the following browserslist queries to select a set of compatible transforms.
>0.2%, not dead, not ie 11, not chrome < 51, not safari < 10
OR

defaults, not ie 11
This can be specified in your project's package.json or in a .browserslistrc file. See @babel/preset-env docs for more details.

Excluding GL-JS explicitly from transpilation
If other parts of your application need ES5 transpilation, then consider excluding GL JS explicitly from transpilation. If you are using Webpack, you can use the ! prefix in the import statement to exclude mapbox-gl from being transformed by existing loaders. See Webpack loaders inline usage docs for more details.
import mapboxgl from '!mapbox-gl';
OR

You can also configure this centrally in webpack.config.js by adding the ignore option to Babel.

use: {
  loader: 'babel-loader',
  options: {
    presets: ['my-custom-babel-preset'],
    ..,
    ..,
    ignore: [ './node_modules/mapbox-gl/dist/mapbox-gl.js' ]
  }
}
Loading and transpiling the Web Worker separately
If your application requires ES5 compatibility, then your module bundler needs to be configured to load and transpile Mapbox GL JS's Web Worker separately. This comes at the cost of significantly increasing the bundle size and negatively impacting rendering performance and you should only do this if you have a strong need for supporting legacy browsers. Mapbox GL JS can be configured with bundler specific worker-loader plugins. See webpack-worker-loader and rollup-plugin-worker-loader.

If you are using Webpack, you can configure worker-loader to be used inline when importing mapbox-gl:
import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
import MapboxWorker from 'worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker'; // Load worker code separately with worker-loader

mapboxgl.workerClass = MapboxWorker; // Wire up loaded worker to be used instead of the default
let map = new mapboxgl.Map({
    container: 'map', // container ID
     style: 'mapbox://styles/mapbox/streets-v11', // style URL
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9 // starting zoom
});
OR

You can also configure worker-loader centrally in webpack.config.js :
module.exports = {
  module: {
    rules: [
      {
        test: /\bmapbox-gl-csp-worker.js\b/i,
        use: { loader: "worker-loader" },
      },
    ],
  },
};
and then integrate the Webpack loaded worker with Mapbox GL JS:

import mapboxgl from 'mapbox-gl/dist/mapbox-gl';
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker';

mapboxgl.workerClass = MapboxWorker;
let map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/mapbox/streets-v11', // style URL
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9 // starting zoom
});
Writing Automated Tests
Run automated browser tests without an access token by setting the testMode Map option. The resulting Map instance does not produce visual output, but still loads locally hosted fixtures for styles and tiles and maintains full JavaScript API compatibility. This means that automated tests can exercise and assert state via the public API. This includes but is not limited to:

Listen for interaction events like click, mouseover etc on Layers.
Extract feature data with map.queryRenderedFeatures().
Update view state center, pitch, bearing, map.easeTo(), map.flyTo() etc.
Interact with Marker and Popup instances.
Example initialization of a Map in testMode:

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 1,
    fadeDuration: 0,
    center: [0, 0],
    testMode: true,
    // Load inline style
    style: {
        version: 8,
        sources: {
            land: {
                type: 'geojson',
                data: `${location.origin}/test/browser/fixtures/land.json` // Load local geojson fixture
            }
        },
        layers: [
            {
                id: 'land',
                type: 'fill',
                source: 'land',
                paint: {
                    'fill-color': '#f0e9e1'
                }
            }
        ]
    }
});
For a more detailed demo of using testMode with Selenium, explore our sample browser tests.

CSP Directives
As a mitigation for Cross-Site Scripting and other types of web security vulnerabilities, you may use a Content Security Policy (CSP) to specify security policies for your website. If you do, Mapbox GL JS requires the following CSP directives:

worker-src blob: ;
child-src blob: ;
img-src data: blob: ;
Requesting styles from Mapbox or other services will require additional directives. For Mapbox, you can use this connect-src directive:

connect-src https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com
For strict CSP environments without worker-src blob: ; child-src blob: enabled, there's a separate Mapbox GL JS bundle (mapbox-gl-csp.js and mapbox-gl-csp-worker.js) which requires setting the path to the worker manually:

<script src='https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp.js'></script>
<script>
mapboxgl.workerUrl = "https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp-worker.js";
...
</script>
Copy
If you use the sandbox directive, and your access token is restricted to certain URLs, the allow-same-origin value is required. This allows requests to have a Referer header that is not null. See the section on Referrer Policies for further information.

Referrer Policies
If you use a URL-restricted access token, you have to make sure that the browser sends the correct referrer header. This is the default setting. But if you use the Referrer-Policy header on your website, pick a value that still sends a Referer header, like no-referrer-when-downgrade, origin, origin-when-cross-origin, or strict-origin. Specifically, same-origin and no-referrer will never send a referrer header, and thus Mapbox API calls won't work.

If you limit the referrer to the origin, make sure that the URL you restrict your access token to doesn't contain path information, because the Origin header doesn't contain a path by definition.

Pricing
Billed by Map Loads for Web
See rates and discounts per map load in the pricing page's Sessions & user prices section
Pricing for Mapbox GL JS v1.0.0 and higher is measured by Map Loads for Web. For information on how older versions of Mapbox GL JS are priced, see our pricing documentation for Mapbox GL JS <v1.0.0.

Mapbox GL JS v1.x.x compared to v2.x.x
The action that triggers a map load changed in Mapbox GL JS v2.0.0:

Mapbox GL JS v2.x.x: A map load occurs whenever a Mapbox GL JS Map object is initialized on a webpage.
Mapbox GL JS v1.x.x: A map load occurs whenever a Mapbox GL JS Map object is initialized on a webpage and you request a Mapbox-hosted map tile.
Before updating an existing implementation from v1.x.x to v2.x.x, review this pricing documentation to estimate expected costs.

Web maps using Mapbox GL JS v1.0.0 and higher are billed by Map Loads for Web. Beginning with Mapbox GL JS v2.0.0, a map load occurs whenever a Mapbox GL JS Map object is initialized. Measuring usage by map loads means that users interacting with your web map can toggle layers from non-composited sources on and off, zoom and pan around the map, and toggle between styles without affecting your usage. You can also add non-composited vector or raster sources to your map at runtime without incurring additional charges. The maximum session length for a map load is 12 hours. If a user has the same map open after 12 hours, Mapbox will count that as a new map load session.

For an overview of how to manage your costs for common interactive, non-interactive, and hybrid web map implementations, see the Manage your web map costs troubleshooting guide.
