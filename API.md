# Mapbox GL JS API Documentation

## mapboxgl.Map

### Constructor

**new mapboxgl.Map**_(options)_

Create a map instance given an options object with the following properties:


Option | Value | Description
------ | ------ | ------
`container` | string | HTML element to initialize the map in (or element id as string)
`minZoom` | number | Minimum zoom of the map, 0 by default
`maxZoom` | number | Maximum zoom of the map, 20 by default
`sources` | object | options of data sources to add to the map
`style` | object | Map style and data source definition, described in the [style reference](https://mapbox.com/mapbox-gl-style-spec)
`hash` | boolean | If `true`, the map will track and update the page URL according to map position (default: `false`)
`interactive` | boolean | If `false`, no mouse, touch, or keyboard listeners are attached to the map, so it will not respond to input (default: `true`)

Options that define the initial position of the map (if `hash` is set to `true`, the position will be set according to the URL and options will be used by default):

Option | Value | Description
------ | ------ | ------
`center` | array | Latitude and longitude (passed as `[lat, lng]`)
`zoom` | number | Map zoom level
`bearing` | number | Map rotation bearing in degrees counter-clockwise from north

_Example:_
``` js
var map = new mapboxgl.Map({
    container: 'map',
    center: [37.772537, -122.420679],
    zoom: 13,
    style: style_object,
    hash: true
});
```

### Methods

#### Setting map state

Method | Description
------ | ------
`setPosition(latlng, zoom, bearing)` | Set map position (center, zoom, bearing)
`setBearing(bearing, offset?)` | Sets map rotation angle in degrees, optional given `offset` (origin of rotation relative to center)
`zoomTo(zoom, animOptions?)` | Zoom to a certain zoom level with easing (duration in ms, 500 by default)
`scaleTo(scale, animOptions?)` | Zoom by a certain scale with easing
`panTo(latlng, animOptions?)` | Pan to a certain location with easing
`panBy(offset, animOptions?)` | Pan by a certain number of pixels (offset is [x, y])
`flyTo(latlng, zoom?, bearing?, flyOptions?)` | Flying animation to a specified location/zoom/bearing with automatic curve
`fitBounds(bounds, fitBoundsOptions?)` | Zoom to contain certain geographical bounds (`[[minLat, minLng], [maxLat, maxLng]]`)
`rotateTo(bearing, animOptions?)` | Rotate bearing by a certain number of degrees with easing
`resetNorth(animOptions?)` | Sets map bearing to 0 (north) with easing
`stop()` | Stop current animation
`resize()` | Detect the map container's new width and height and resize the map to fit
`setStyle(style)` | Replaces the map's style object

#### Map method options

Method | Description
------ | ------
animOptions | An object with `duration` (Number in ms), `easing` (function), `offset` (point, origin of movement relative to map center) and `animate` (when set to false, no animation happens) options
flyOptions | An object with `speed` (`1.2` by default, how fast animation occurs), `curve` (`1.42` by default, defines how much zooming out occurs during animation), and `easing` (function) options
fitBoundsOptions | The same as flyOptions with the additional `padding` (number, defines how much padding there is around the given bounds on each side in pixels) and `maxZoom` (number) options

#### Getting map state

Method | Description
------ | ------
getBounds() | Get the map's geographical bounds (as `LatLngBounds` object)
getCenter() | Get the current view geographical point (as `LatLng` object)
getZoom() | Get the current zoom
getBearing() | Get the current bearing in degrees
project(latlng) | Get pixel coordinates (relative to map container) given a geographical location
unproject(point) | Get geographical coordinates given pixel coordinates
featuresAt(point, params, callback) | Get all features at a point ([x, y]) where params is `{radius, bucket, type, geometry}` (all optional, radius is 0 by default)

_Example:_
``` js
// get all features at a point within a certain radius
map.featuresAt([100, 100], {
    radius: 30,          // radius in pixels to search in
    bucket: 'bucketname' // optional - if set, only features from that bucket will be matched
}, callback);
```

#### Working with sources

Method | Description
------ | ------
`addSource(id, source)` | Adds a data source to the map, specifying associated string id
`removeSource(id)` | Removes a data source from the map given the id that was used when adding

### Events

Event | Description
----- | -----
`move` | Fired during pan/rotation and after zoom
`pan(offset)` | Fired during panning
`panend(inertia)`| Fired after panning
`zoom(scale)` | Fired during zoom
`rotate(start, prev, current)` | Fired when map angle changes
`click(point)` | Fired on map click
`hover(point)` | Fired when the mouse moves over the map
`resize` | Fired when the map changes size
`source.add(source)` | Fired when a data source is added
`source.remove(source)` | Fired when a data source is removed


## mapboxgl.Source

Represents a tiled source.

### Constructor

**new mapboxgl.Source**_(options)_ 

Create data source instance given an options object with the following properties:

Option | Description
------ | ------
`type` | Either `'raster'` or `'vector'`
`zooms` | An array of zoom level numbers to use (e.g. `[0, 1, 2, 4, 5]`)
`urls` | An array of url templates to use (e.g. `'http://example.com/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'`)
`id` | Optional id to assign to the source

### Methods

Method | Description
------ | ------
`update()` | Update tiles according to the viewport and render
`render()` | Render every existing tile
`stats()` | Return an object with tile statistics
`featuresAt(point, params, callback)` | Get all features at a point where params is {radius, bucket, type, geometry} (all optional, radius is 0 by default)

### Events

Event | Description
------ | ------
`tile.add(tile)` | Fired when a tile is added to the map
`tile.load(tile)` | Fired when a tile is loaded
`tile.remove(tile)` | Fired when a tile is removed from the map


## mapboxgl.GeoJSONSource

Extends `mapboxgl.Source`, renders GeoJSON data.

### Constructor

**new mapboxgl.GeoJSONSource**_(options)_

Create GeoJSON data source instance given GeoJSON object and a map instance. Options are `data` for GeoJSON data nd `glyphs` for optional glyphs url.

_Example:_
``` js
var sourceObj = new mapboxgl.GeoJSONSource({data: geojson});

map.addSource('some id', sourceObj); // addmap.removeSource('some id');  // remove
```

## mapboxgl.Evented

A class inherited by most other classes (`Map`, `Source` etc.) to get event capabilities. 

### Methods

Method | Description
------ | ------
`fire(type, data?)` | Fire event of a given string type with the given data object
`on(type, listener)` | Subscribe to a specified event with a listener function;
the latter gets the data object that was passed to `fire` and additionally `target` and `type` properties.
`off(type?, listener?)` | Remove a listener; remove all listeners of a type if listener is not specified;
remove all listeners if no arguments specified.
`listens(type)` | Returns true if the object listens to an event of a particular type

## mapboxgl.LatLng

A representation of a latitude and longitude point, in degrees.

### Constructor

**new mapboxgl.LatLng**_(latitude, longitude)_

Create a latitude, longitude object from a given latitude and longitude pair in degrees.

## mapboxgl.LatLngBounds

A representation of rectangular box on the earth, defined by its southwest
and northeast points in latitude and longitude

### Constructor

**new mapboxgl.LatLng**_([southwest, northeast])_ 

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

## Support

**mapboxgl.util.supported()**

Tests whether the basic JavaScript and DOM features required for Mapbox GL are present. Returns true if Mapbox GL should be expected to work, and false if not.

## Get JSON

**mapboxgl.util.getJSON**_(url, callback)_

Get JSON file from url.
