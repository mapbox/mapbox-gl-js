# Migrate to Mapbox GL JS v3

Mapbox GL JS v3 enables the **Mapbox Standard Style**, a new realistic **3D lighting** system, building and terrain **shadows** and many other visual enhancements, and an ergonomic API for using a new kind of rich, evolving, configurable map styles and seamless integration with custom data.

## Update Dependencies

Mapbox GL JS v3 is supported in most modern browsers. Mapbox GL JS v3 is backwards-compatible and existing layers and APIs will continue to work as expected. To use the new Mapbox GL JS v3 beta in your project, you need to import it using the Mapbox GL JS CDN or install the `mapbox-gl` npm package.

### Mapbox CDN

Include the JavaScript and CSS files in the <head> of your HTML file. The CSS file is required to display the map and make elements like Popups and Markers work.

```html
<script src='https://api.mapbox.com/mapbox-gl-js/v3.0.0-beta.1/mapbox-gl.js'></script>
<link href='https://api.mapbox.com/mapbox-gl-js/v3.0.0-beta.1/mapbox-gl.css' rel='stylesheet' />
```

Include the following code in the `<body>` of your HTML file.

```html
<div id='map' style='width: 400px; height: 300px;'></div>
<script>
// TO MAKE THE MAP APPEAR YOU MUST
// ADD YOUR ACCESS TOKEN FROM
// https://account.mapbox.com
mapboxgl.accessToken = '<your access token here>';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9, // starting zoom
});
</script>
```

### Module bundler

Install the npm package.

```shell
npm install --save mapbox-gl@3.0.0-beta.1
```

Include the CSS file in the `<head>` of your HTML file. The CSS file is required to display the map and make elements like Popups and Markers work.

```html
<link href='https://api.mapbox.com/mapbox-gl-js/v3.0.0-beta.1/mapbox-gl.css' rel='stylesheet' />
```

If you're using a CSS loader like [webpack css-loader](https://webpack.js.org/loaders/css-loader/), you can import the CSS directly in your JavaScript.

```js
import 'mapbox-gl/dist/mapbox-gl.css';
```

Include the following code in your JavaScript file.

```js
import mapboxgl from 'mapbox-gl'; // or "const mapboxgl = require('mapbox-gl');"

// TO MAKE THE MAP APPEAR YOU MUST
// ADD YOUR ACCESS TOKEN FROM
// https://account.mapbox.com
mapboxgl.accessToken = '<your access token here>';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    center: [-74.5, 40], // starting position [lng, lat]
    zoom: 9, // starting zoom
});
```

To use Mapbox GL JS, you need to have a Mapbox [access token](https://docs.mapbox.com/help/how-mapbox-works/access-tokens/). This access token associates your map with a Mapbox account. For more information on creating and using access tokens, see our [token management documentation](https://docs.mapbox.com/accounts/guides/tokens/).

## Explore New Features

### The Mapbox Standard style

We're excited to announce the launch of Mapbox Standard, our latest Mapbox style, now accessible to all customers in a beta version. The new Mapbox Standard core style enables a highly performant and elegant 3D mapping experience with powerful dynamic lighting capabilities, and an expertly crafted symbolic aesthetic.

With Mapbox Standard, we are also introducing a new paradigm for how to interact with map styles. When you use this style in your application we will continuously update your basemap with the latest features with no additional work required from you. This ensures that your users will always have the latest features of our maps. You can get more information about the available presets and configuration options of the Standard style in the style documentation.

* The Mapbox Standard Style is now enabled by default when no `style` option is provided to the `Map` constructor. Or, you can still explicitly set the style by passing the URL to the `style` option of the `Map` constructor.

* The Mapbox Standard style features 4 light presets: "Day", "Dusk", "Dawn", and "Night". The style light preset can be changed from the default, "Day", to another preset with a single line of code:

```js
map.on('style.load', () => {
    map.setConfigProperty('basemap', 'lightPreset', 'dusk');
});
```

Changing the light preset will alter the colors and shadows on your map to reflect the time of day. For more information, refer to the [Lighting API](#lighting-api) section.

Similarly, you can set other configuration properties on the Standard style such as showing POIs, place labels, or specific fonts:

```js
map.on('style.load', () => {
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
});
```

The Standard style offers 6 configuration properties for developers to change when they import it into their own style:

Property | Type | Description
--- | --- | ---
`showPlaceLabels` | `Bool` | Shows and hides place label layers.
`showRoadLabels` | `Bool` | Shows and hides all road labels, including road shields.
`showPointOfInterestLabels` | `Bool` | Shows or hides all POI icons and text.
`showTransitLabels` | `Bool` | Shows or hides all transit icons and text.
`lightPreset` | `String` | Switches between 4 time-of-day states: `dusk`, `dawn`, `day`, and `night`.
`font` | `Array` | Defines font family for the style from predefined options.

### Custom data layers

Mapbox Standard is making adding your own data layers easier for you through the concept of `slot`s. `Slot`s are pre-specified locations in the style where your layer will be added to (such as on top of existing land layers, but below all labels). To do this, we've added a new `slot` property to each `Layer`. This property allows you to identify which `slot` in the Mapbox Standard your new layer should be placed in. To add custom layers in the appropriate location in the Standard style layer stack, we added 3 carefully designed slots that you can leverage to place your layer. These slots will remain stable, so you can be sure that your own map won't break even as the basemap evolves automatically. 

Slot | Description
--- | ---
`bottom` | Above polygons (land, landuse, water, etc.)
`middle` | Above lines (roads, etc.) and behind 3D buildings
`top` | Above all existing layers in the style

Set the preferred `slot` on the `Layer` object before adding it to your map and your layer will be appropriately placed in the Standard style's layer stack.

```js
map.addLayer({
    id: 'points-of-interest',
    slot: 'middle',
    source: {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
    },
    'source-layer': 'poi_label',
    type: 'circle'
});
```

**Important**: For the new Standard style, you can only add layers to these three slots (`bottom`, `middle`, `top`) within the Standard style basemap.

Like with the classic Mapbox styles, you can still use the layer position in `map.addLayer(layer, beforeId)` method when importing the Standard Style. But, this method is only applicable to custom layers you have added yourself. If you add two layers to the same slot with a specified layer position the latter will define order of the layers in that slot.

Standard is aware of the map lighting configuration using the `measure-light` expression, which returns you an aggregated value of your light settings. This returns a value which ranges from 0 (darkest) to 1 (brightest). In darker lights, you make the individual layers light up by using the new `*-emissive-stength` expressions, which allow you to add emissive light to different layer types and for example keep texts legible in all light settings. If your custom layers seem too dark, try adjusting the emissive strength of these layers. 

### Customizing Standard

The underlying design paradigm to the Standard style is different from what you know from the classic core styles. Mapbox manages the basemap experience and surfaces key global styling configurations - in return, you get a cohesive visual experience and an evergreen map, always featuring the latest data, styling and rendering features compatible with your SDK. The configuration options make interactions with the basemap simpler than before. During the beta phase, we are piloting these configurations - we welcome feedback on the beta configurations. If you have feedback or questions about the Standard beta style reach out to: [hey-map-design@mapbox.com](mailto:hey-map-design@mapbox.com).

You can customize the overall color of your Standard experience easily by adjusting the 3D light settings. Individual basemap layers and/or color values can’t be adjusted, but all the flexibility offered by the style specification can be applied to custom layers while keeping interaction with the basemap simple through `slot`s.

Our existing, classic Mapbox styles (such as [Mapbox Streets](https://www.mapbox.com/maps/streets), [Mapbox Light](https://www.mapbox.com/maps/light), and [Mapbox Satellite Streets](https://www.mapbox.com/maps/satellite)) and any custom styles you have built in Mapbox Studio will still work like they do in v2, so no changes are required.

### Lighting API

The new Standard style and its dynamic lighting is powered by the new Style and Lighting APIs that you can experiment with. The following experimental APIs can be used to control the look and feel of the map.

In GL JS v3 we've introduced new experimental lighting APIs to give you control of lighting and shadows in your map when using 3D objects: `AmbientLight` and `DirectionalLight`. We've also added new APIs on `FillExtrusionLayer` and `LineLayer` to support this 3D lighting styling. Together, these properties can illuminate 3D objects to provide a more realistic and immersive map experience for your users. Set these properties at runtime to follow the time of day, a particular mood, or other lighting goals in your map.

### Style API and expressions improvements

We have introduced a new set of expressions to enhance your styling capabilities:

* Introduced `hsl`, `hsla` color expression: These expressions allow you to define colors using hue, saturation, lightness format.
* Introduced `random` expression: Generate random values using this expression. Use this expression to generate random values, which can be particularly helpful for introducing randomness into your map data.
* Introduced `measureLight` expression lights configuration property: Create dynamic styles based on lighting conditions.
* Introduced `config` expression: Retrieves the configuration value for the given option.
* Introduced `raster-value` expression: Returns the raster value of a pixel computed via `raster-color-mix`.
* Introduced `distance` expression: Returns the shortest distance in meters between the evaluated feature and the input geometry.

Mapbox GL JS v3 also introduces a new set of style properties:

* `background`:
  * `background-emissive-strength`
* `circle`:
  * `circle-emissive-strength`
* `fill`:
  * `fill-emissive-strength`
* `fill-extrusion`:
  * `fill-extrusion-ambient-occlusion-ground-attenuation`
  * `fill-extrusion-ambient-occlusion-ground-radius`
  * `fill-extrusion-ambient-occlusion-intensity`
  * `fill-extrusion-ambient-occlusion-radius`
  * `fill-extrusion-ambient-occlusion-wall-radius`
  * `fill-extrusion-edge-radius`
  * `fill-extrusion-flood-light-color`
  * `fill-extrusion-flood-light-ground-attenuation`
  * `fill-extrusion-flood-light-ground-radius`
  * `fill-extrusion-flood-light-intensity`
  * `fill-extrusion-flood-light-wall-radius`
  * `fill-extrusion-rounded-roof`
  * `fill-extrusion-vertical-scale`
* `icon`:
  * `icon-emissive-strength`
  * `icon-image-cross-fade`
* `line`:
  * `line-emissive-strength`
* `raster`:
  * `raster-color-mix`
  * `raster-color-range`
  * `raster-color`
* `text`:
  * `text-emissive-strength`

## Known issues

To report new issues with Mapbox GL JS v3, create a [bug report](https://github.com/mapbox/mapbox-gl-js/issues/new?template=Bug_report.md) on GitHub.
