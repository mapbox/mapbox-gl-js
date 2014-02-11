# API

## Reference

*A work in progress.*

### llmr.Map

#### Constructor

**new llmr.Map**_(options)_ - creates a map instance given an options object with the following properties:

- **container** - HTML element to initialize the map in
- **minZoom** - minimum zoom of the map, 0 by default
- **maxZoom** - maximum zoom of the map, 18 by default
- **sources** - configs of data sources to add to the map
- **style** - map style, described in [the styling guide](STYLING.md)
- **hash** - if true, the map will track and update the page URL according to map position

Options that define the initial position of the map unless `hash` is set to true
(in that case it will be set according to the URL):

- **lat** - latitude
- **lon** - longitude
- **zoom** - map zoom level
- **rotation** - map rotation angle in radians

#### Methods

- **setPosition**_(zoom, lat, lon, angle)_ - set map position (zoom, center, rotation)
- **zoomTo**_(zoom, duration)_ - zoom to a certain zoom level with easing
- **scaleTo**_(scale, duration)_ - zoom by a certain scale with easing
- **panTo**_(lat, lon, duration)_ - zoom to a certain zoom level with easing
- **stop**_() - stop current animation
- **resize**_()_ - detect the map's new width and height and resize it
- **setAngle**_(center, angle)_ - sets map rotation angle in radians (doesn't care for center)
- **resetNorth**_()_ - animates the map back to north rotation
- **featuresAt**_(x, y, params, callback)_ - returns all features at a point,
where params is _{radius, bucket, type, geometry}_ (all optional, radius is 0 by default)
- **addSource**_(id, source)_ - adds a data source to the map, specifying associated string id
- **removeSource**_(id)_ - removes a data source from the map given the id that was used when adding
- **setStyle**_(style) - changes the map style

#### Events

- **move** - fired during pan/rotation and after zoom
- **pan** - fired during panning
- **panend** - fired after panning
- **zoom**_({scale})_ - fired during zoom
- **rotation** — fired when map angle changes
- **click**_(x, y)_ - fired on map click
- **hover**_(x, y)_ - fired when the mouse moves over the map
- **resize** - fired when the map changes size
- **source.add** *(source)* - fired when a data source is added
- **source.remove** *(source)* - fired when a data source is removed

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
- **featuresAt**_(x, y, params, callback)_ - returns all features at a point,
where params is _{radius, bucket, type, geometry}_ (all optional, radius is 0 by default)

#### Events

- **tile.add** - fired when a tile is added to the map
- **tile.load** - fired when a tile is loaded
- **tile.remove** - fired when a tile is removed from the map

### llmr.GeoJSONSource

Extends `llmr.Source`, renders GeoJSON data.

#### Constructor

**new llmr.GeoJSONSource**_(geojson, map)_ - create GeoJSON data source instance given GeoJSON object and a map instance


## Code snippets

A set of llmr API snippets for quick reference.

#### Creating a map

```js
var map = new llmr.Map({
    container: document.getElementById('map'),
    sources: {
        'streets': {
            type: 'vector', // either 'vector' or 'raster'
            urls: ['/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        }
    },
    maxZoom: 20,
    zoom: 13,
    lat: 37.772537,
    lon: -122.420679,
    rotation: 0,
    style: style_json,
    hash: true
});
```

#### Adding/removing a data source

```js
var ds = new llmr.GeoJSONSource(geojson, map);

map.addSource('some id', ds); // add
map.removeSource('some id');  // remove
```

#### Interaction

```js
// get all features at a point within a certain radius
map.featuresAt(x, y, {
    radius: 30,          // radius in pixels to search in
    bucket: 'bucketname' // optional; if set, only features from that bucket will be matched
}, callback);
```
