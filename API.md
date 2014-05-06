# API

## Reference

*A work in progress.*


### llmr.Map

#### Constructor

**new llmr.Map**_(options)_ - creates a map instance given an options object with the following properties:

- **container** - HTML element to initialize the map in (or element id as string)
- **minZoom** - minimum zoom of the map, 0 by default
- **maxZoom** - maximum zoom of the map, 20 by default
- **sources** - options of data sources to add to the map
- **style** - map style, described in [the styling guide](STYLING.md)
- **hash** - if true, the map will track and update the page URL according to map position

Options that define the initial position of the map unless `hash` is set to true
(in that case it will be set according to the URL):

- **center** - latitude/longitude (can be passed as [lat, lng])
- **zoom** - map zoom level
- **angle** - map rotation angle in radians

#### Methods

##### Setting map state

- **setPosition**_(latlng, zoom, angle)_ - set map position (zoom, center, rotation)
- **setAngle**_(angle, offset?)_ - sets map rotation angle in radians, optional given `offset`
(origin of rotation relative to center)
- **zoomTo**_(zoom, animOptions?)_ - zoom to a certain zoom level with easing (duration in ms, 500 by default)
- **scaleTo**_(scale, animOptions?)_ - zoom by a certain scale with easing
- **panTo**_(latlng, animOptions?)_ - pan to a certain location level with easing
- **panBy**_(offset, animOptions?)_ - pan by a certain number of pixels (offset is [x, y])
- **zoomPanTo**_(latlng, zoom?, zoomPanOptions?)_ - zoom-pan optimal path easing to a specified location,
optionally passing animation speed (1.2 by default) and zoomFactor (1.42 by default, bigger value means more pronounced zoom out)
- **fitBounds** (bounds, fitBoundsOptions?) - zoom to contain certain geographical bounds (`[[minLat, minLng], [maxLat, maxLng]]`)
- **rotateTo**_(angle, animOptions?)_ - rotate angle by a certain number of radians with easing
- **resetNorth**_(animOptions?)_ - animates the map back to north rotation
- **stop**_()_ - stop current animation
- **resize**_()_ - detect the map's new width and height and resize it
- **setStyle**_(style) - changes the map style

_AnimOptions_ is an object with `duration` (Number in ms), `easing` (Function),
`offset` (Point, origin of movement relative to map center) and `animate` (when set to false, no animation happens) options.

_ZoomPanOptions_ is an object with `speed` (`1.2` by default, how fast animation occurs),
`curve` (`1.42` by default, defines how much zooming out occurs during animation), `offset` and `animate` options.

_FitBoundsOptions_ is _ZoomPanOptions_ with additional `padding` option (Number, defines how much padding there is
around the given bounds on each side in pixels).

##### Getting map state

- **getBounds**_()_ - return the geographical bounds (as `LatLngBounds` object)
- **getCenter**_()_ - return the current view geographical point (as `LatLng` object)
- **getZoom**_()_ - return the current zoom
- **getAngle**_()_ - return the current view angle in radians
- **project**_(latlng)_ - return pixel coordinates (relative to map container) given a geographical location
- **unproject**_(point)_ - return geographical coordinates given pixel coordinates
- **featuresAt**_(point, params, callback)_ - returns all features at a point (point is [x, y])
where params is _{radius, bucket, type, geometry}_ (all optional, radius is 0 by default)

##### Working with sources

- **addSource**_(id, source)_ - adds a data source to the map, specifying associated string id
- **removeSource**_(id)_ - removes a data source from the map given the id that was used when adding

#### Events

- **move** - fired during pan/rotation and after zoom
- **pan**_({offset})_ - fired during panning
- **panend**_({inertia})_ - fired after panning
- **zoom**_({scale})_ - fired during zoom
- **rotate**_({start, prev, current})_ — fired when map angle changes
- **click**_({point})_ - fired on map click
- **hover**_({point})_ - fired when the mouse moves over the map
- **resize** - fired when the map changes size
- **source.add** *({source})* - fired when a data source is added
- **source.remove** *({source})* - fired when a data source is removed


### llmr.Source

Represents a tiled source.

#### Constructor

**new llmr.Source**_(options)_ - creates data source instance
given an options object with the following properties:

- **type** - either `'raster'` or `'vector'`
- **zooms** - an array of zoom level numbers to use (e.g. `[0, 1, 2, 4, 5...]`)
- **urls** - an array of url templates to use (e.g. `'http://example.com/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'`)
- **id** - optional id to assign to the source, not used anywhere
- **enabled** - if false, won't be loaded / rendered initially

#### Methods

- **update**_()_ - update tiles according to the viewport and render
- **render**_()_ - render every existing tile
- **stats**_()_ - return an object with tile statistics
- **featuresAt**_(point, params, callback)_ - returns all features at a point
where params is _{radius, bucket, type, geometry}_ (all optional, radius is 0 by default)

#### Events

- **tile.add**_({tile})_ - fired when a tile is added to the map
- **tile.load**_({tile})_ - fired when a tile is loaded
- **tile.remove**_({tile})_ - fired when a tile is removed from the map


### llmr.GeoJSONSource

Extends `llmr.Source`, renders GeoJSON data.

#### Constructor

**new llmr.GeoJSONSource**_(geojson)_ - create GeoJSON data source instance given GeoJSON object and a map instance


### llmr.Evented

A class inherited by most other classes (`Map`, `Source` etc.) to get event capabilities. Methods:

- **fire**_(type, data?)_ - fire event of a given string type with the given data object
- **on**_(type, listener)_ - subscribe to a specified event with a listener function;
the latter gets the data object that was passed to `fire` and additionally `target` and `type` properties.
- **off**_(type?, listener?)_ - remove a listener; remove all listeners of a type if listener is not specified;
remove all listeners if no arguments specified.
- **listens**_(type)_ - returns true if the object listens to an event of a particular type


## Code snippets

A set of llmr API snippets for quick reference.

#### Creating a map

```js
var map = new llmr.Map({
    container: 'map',
    sources: {
        'streets': {
            type: 'vector', // either 'vector' or 'raster'
            url: '/gl/tiles/plain/{z}-{x}-{y}.vector.pbf',
            maxZoom: 14
        }
    },
    center: [37.772537, -122.420679],
    zoom: 13,
    style: style_json,
    hash: true
});
```

#### Adding/removing a data source

```js
var ds = new llmr.GeoJSONSource(geojson);

map.addSource('some id', ds); // add
map.removeSource('some id');  // remove
```

#### Interaction

```js
// get all features at a point within a certain radius
map.featuresAt([x, y], {
    radius: 30,          // radius in pixels to search in
    bucket: 'bucketname' // optional; if set, only features from that bucket will be matched
}, callback);
```
