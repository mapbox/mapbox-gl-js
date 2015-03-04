# Mapbox GL JS API Documentation

## new mapboxgl.Map(options)

``` js
var map = new mapboxgl.Map({
    container: 'map',
    center: [37.772537, -122.420679],
    zoom: 13,
    style: style_object,
    hash: true
});
```

Create a map instance given an options object with the following properties:

Option | Value | Description
------ | ------ | ------
`container` | string | HTML element to initialize the map in (or element id as string)
`minZoom` | number | Minimum zoom of the map, 0 by default
`maxZoom` | number | Maximum zoom of the map, 20 by default
`style` | object | Map style and data source definition (either a JSON object or a JSON URL), described in the [style reference](https://mapbox.com/mapbox-gl-style-spec)
`hash` | boolean | If `true`, the map will track and update the page URL according to map position (default: `false`)
`interactive` | boolean | If `false`, no mouse, touch, or keyboard listeners are attached to the map, so it will not respond to input (default: `true`)
`classes` | array | Style class names with which to initialize the map

Options that define the initial position of the map (if `hash` is set to `true`, the position will be set according to the URL and options will be used by default):

Option | Value | Description
------ | ------ | ------
`center` | array | Latitude and longitude (passed as `[lat, lng]`)
`zoom` | number | Map zoom level
`bearing` | number | Map rotation bearing in degrees counter-clockwise from north

### Setting map state

The following methods set the state of the map without performing any animation.

Method | Description
------ | ------
`setView(center, zoom, bearing)` | Set map position (center, zoom, bearing)
`setCenter(latlng)` | Center the map view on a location
`setZoom(zoom)` | Set the zoom level of the map
`setBearing(bearing)` | Sets map rotation angle in degrees
`setStyle(style)` | Replaces the map's style object

The following methods set the state of the map with smooth animation.

Method | Description
------ | ------
`panTo(latlng, animOptions?)` | Pan to a certain location with easing
`panBy(offset, animOptions?)` | Pan by a certain number of pixels (offset is [x, y])
`zoomTo(zoom, animOptions?)` | Zoom to a certain zoom level with easing
`zoomIn(animOptions?)` | Zoom in by 1 level
`zoomOut(animOptions?)` | Zoom out by 1 level
`easeTo(latlng, zoom?, bearing?, animOptions?)` | Easing animation to a specified location/zoom/bearing
`flyTo(latlng, zoom?, bearing?, flyOptions?)` | Flying animation to a specified location/zoom/bearing with automatic curve
`fitBounds(bounds, fitBoundsOptions?)` | Zoom to contain certain geographical bounds (`[[minLat, minLng], [maxLat, maxLng]]`)
`rotateTo(bearing, animOptions?)` | Rotate bearing by a certain number of degrees with easing
`resetNorth(animOptions?)` | Sets map bearing to 0 (north) with easing
`stop()` | Stop current animation
`resize()` | Detect the map container's new width and height and resize the map to fit

### Map method options

Object | Description
------ | ------
`animOptions` | An object with `duration` (Number in ms), `easing` (function), `offset` (point, origin of movement relative to map center) and `animate` (when set to false, no animation happens) options
`flyOptions` | An object with `speed` (`1.2` by default, how fast animation occurs), `curve` (`1.42` by default, defines how much zooming out occurs during animation), and `easing` (function) options
`fitBoundsOptions` | The same as flyOptions with the additional `padding` (number, defines how much padding there is around the given bounds on each side in pixels) and `maxZoom` (number) options

### Getting map state

Method | Description
------ | ------
`getBounds()` | Get the map's geographical bounds (as `LatLngBounds` object)
`getCenter()` | Get the current view geographical point (as `LatLng` object)
`getZoom()` | Get the current zoom
`getBearing()` | Get the current bearing in degrees
`project(latlng)` | Get pixel coordinates (relative to map container) given a geographical location
`unproject(point)` | Get geographical coordinates given pixel coordinates
`featuresAt(point, params, callback)` | Get all features at a point ([x, y]) where params is `{radius, layer, type, geometry}` (all optional, radius is 0 by default)

_Example:_
``` js
// get all features at a point within a certain radius
map.featuresAt([100, 100], {
    radius: 30,          // radius in pixels to search in
    layer: 'layer' // optional - if set, only features from that layer will be matched
}, callback);
```

### Map lifecycle

Method | Description
------ | ------
`remove()` | Destroys the map's underlying resources, including web workers.

### Working with sources

Method | Description
------ | ------
`addSource(id, source)` | Adds a data source to the map, specifying associated string id
`removeSource(id)` | Removes a data source from the map given the id that was used when adding

### Working with controls

Method | Description
------ | ------
`addControl(control)` | Adds a control to the map

### Working with style classes

Method | Description
------ | ------
`addClass(className)` | Adds a style class to the map
`removeClass(className)` | Removes a style class from the map
`hasClass(className)` | Returns boolean indicating whether a style class is active
`setClasses([className])` | Sets active style classes to a specified array
`getClasses()` | Returns an array of active style classes

### Events

Event | Description
----- | -----
`render` | Fired whenever a frame is rendered to the WebGL context
`load` | Fired on the first complete render, when all dependencies have been loaded
`move` | Fired during any movement of the map (panning, zooming, rotation, etc.)
`movestart` | Fired on start of any movement of the map
`moveend` | Fired after movement of the map, when it becomes idle
`zoom` | Fired when the map zoom changes
`rotate` | Fired when the map bearing changes
`click(point)` | Fired on map click
`mousemove(point)` | Fired when the mouse moves over the map
`resize` | Fired when the map changes size
`source.add(source)` | Fired when a data source is added
`source.remove(source)` | Fired when a data source is removed


## new mapboxgl.Source(options)

``` js
var sourceObj = new mapboxgl.Source({
    type: 'vector',
    url: 'mapbox://mapbox.mapbox-streets-v5'
});
map.addSource('some id', sourceObj); // add
map.removeSource('some id');  // remove
```

Create a tiled data source instance given an options object with the following properties:

Option | Description
------ | ------
`type` | Either `'raster'` or `'vector'`
`url` | A tile source URL. This should either be `mapbox://{mapid}` or a full `http[s]` url that points to a TileJSON endpoint.
`tiles` | An array of tile sources. If `url` is not specified, `tiles` can be used instead to specify tile sources, as in the TileJSON spec. Other TileJSON keys such as `minzoom` and `maxzoom` can be specified in a source object if `tiles` is used.
`id` | Optional id to assign to the source
`tileSize` | Optional tile size (width and height in pixels, assuming tiles are square). Defaults to 512; only configurable for raster sources.
`cacheSize` | Optional max number of tiles to cache at any given time

### Methods

Method | Description
------ | ------
`update()` | Update tiles according to the viewport and render
`render()` | Render every existing tile
`stats()` | Return an object with tile statistics
`featuresAt(point, params, callback)` | Get all features at a point where params is `{radius, layer, type, geometry}` (all optional, radius is 0 by default)

### Events

Event | Description
------ | ------
`tile.add(tile)` | Fired when a tile is added to the map
`tile.load(tile)` | Fired when a tile is loaded
`tile.remove(tile)` | Fired when a tile is removed from the map


## new mapboxgl.GeoJSONSource(options)

``` js
var sourceObj = new mapboxgl.GeoJSONSource({
    data: {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    -76.53063297271729,
                    39.18174077994108
                ]
            }
        }]
    }
});
map.addSource('some id', sourceObj); // add
map.removeSource('some id');  // remove
```

Create a GeoJSON data source instance given an options object with the following properties:

Option | Description
------ | ------
`data` | A GeoJSON data object or an URL to it. The latter is preferable in case of large GeoJSON files.
`maxzoom` | Maximum zoom to preserve detail at. `14` by default.

### Methods

Method | Description
------ | ------
`setData(data)` | Update source geojson data and rerender map

## new mapboxgl.VideoSource(options)

``` js
var sourceObj = new mapboxgl.VideoSource({
    url: [
        'https://www.mapbox.com/videos/baltimore-smoke.mp4',
        'https://www.mapbox.com/videos/baltimore-smoke.webm'
    ],
    coordinates: [
        [39.18579907229748, -76.54335737228394],
        [39.1838364847587, -76.52803659439087],
        [39.17683392507606, -76.5295386314392],
        [39.17876344106642, -76.54520273208618]
    ]
});
map.addSource('some id', sourceObj); // add
map.removeSource('some id');  // remove
```

Create a Video data source instance given an options object with the following properties:

Option | Description
------ | ------
`url` | A string or array of URL(s) to video files
`coordinates` | lat,lng coordinates in order clockwise starting at the top left: tl, tr, br, bl

## new mapboxgl.Navigation(options)

Creates a navigation control with zoom buttons and a compass.

```js
map.addControl(new mapboxgl.Navigation({position: 'topleft'})); // position is optional
```

Option | Description
------ | ------
`position` | A string indicating the control's position on the map. Options are `topright`, `topleft`, `bottomright`, `bottomleft` (defaults to `topright`)

## mapboxgl.Evented

A class inherited by most other classes (`Map`, `Source` etc.) to get event capabilities.

### Methods

Method | Description
------ | ------
`fire(type, data?)` | Fire event of a given string type with the given data object
`on(type, listener)` | Subscribe to a specified event with a listener function the latter gets the data object that was passed to `fire` and additionally `target` and `type` properties.
`off(type?, listener?)` | Remove a listener; remove all listeners of a type if listener is not specified remove all listeners if no arguments specified.
`listens(type)` | Returns true if the object listens to an event of a particular type

## new mapboxgl.LatLng(latitude, longitude)

``` js
var latlng = new mapboxgl.LatLng(37.76, -122.44);
```

A representation of a latitude and longitude point, in degrees.
Create a latitude, longitude object from a given latitude and longitude pair in degrees.

## new mapboxgl.LatLngBounds([southwest, northeast])

``` js
var latlng = new mapboxgl.LatLng([[37.70,-122.51],[37.83,-122.35]]);
```

A representation of rectangular box on the earth, defined by its southwest
and northeast points in latitude and longitude
Creates a bounding box from the given pair of points. `southwest` and `northeast` can be ommitted to create a null bounding box.

### Methods

Method | Description
------ | ------
`extend(latlng)` | Enlarge the bounds to include a given point
`getCenter()` | Get the point equidistant from this box's corners, as a `LatLng` object
`getSouthWest()` | Get the southwest corner as a `LatLng` object
`getSouthEast()` | Get the southeast corner as a `LatLng` object
`getNorthWest()` | Get the northwest corner as a `LatLng` object
`getNorthEast()` | Get the northeast corner as a `LatLng` object
`getNorth()` | Get the north edge's latitude as a number
`getSouth()` | Get the south edge's latitude as a number
`getWest()` | Get the south edge's longitude as a number
`getEast()` | Get the south edge's longitude as a number

## mapboxgl.util.supported()

``` js
if (!mapboxgl.util.supported()) {
    console.log('Your browser does not support Mapbox GL');
}
```

Tests whether the basic JavaScript and DOM features required for Mapbox GL are present. Returns true if Mapbox GL should be expected to work, and false if not.

## mapboxgl.util.getJSON(url, callback)

``` js
mapboxgl.util.getJSON('https://www.mapbox.com/mapbox-gl-styles/styles/outdoors-v3.json', function (err, style) {
    if (err) throw err;
    map.setStyle(style);
});
```

Get JSON data from a url.
