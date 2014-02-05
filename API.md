# API

## Reference

*A work in progress.*

### llmr.Map

#### Constructor

**new llmr.Map(options)** - creates a map instance given the following options:

- **container** - HTML element to initialize the map in
- **hash** - boolean, will set up the map to track and update page url according to map position
- **lat** and **lon** - geographic center of the map
- **zoom** - map zoom level
- **rotation** - map rotation angle in radians
- **minZoom** - minimum zoom of the map, 0 by default
- **maxZoom** - maximum zoom of the map, 18 by default
- **datasources** - configs of datasources to add to the map
- **style** - map style, described in [the styling guide](STYLING.md)

#### Methods

- **setPosition**_(zoom, lat, lon, angle)_ - set map position (zoom, center, rotation)
- **zoomTo**_(zoom, duration, easing)_ - zoom to a certain zoom level with easing
- **scaleTo**_(scale, duration, easing)_ - zoom by a certain scale with easing
- **resize**_()_ - detect the map's new width and height and resize it.
- **setAngle**_(center, angle)_ - sets map rotation angle in radians (doesn't care for center)
- **resetNorth**_()_ - animates the map back to north rotation
- **featuresAt**_(x, y, params, callback)_ - returns all features at a point, where params is _{radius, bucket, type, geometry}_ (all optional, radius is 0 by default)

#### Events

- **move** - fired during pan/rotation and after zoom
- **pan** - fired during panning
- **panend** - fired after panning
- **zoom**_({scale})_ - fired during zoom
- **rotation** — fired when map angle changes
- **click**_(x, y)_ - fired on map click
- **hover**_(x, y)_ - fired when the mouse moves over the map
- **resize** - fired when the map changes size
- **datasource.add** *(datasource)* - fired when a data source is added
- **datasource.remove** *(datasource)* - fired when a data source is removed

### llmr.Datasource

#### Events

- **tile.add** - fired when a tile is added to the map
- **tile.load** - fired when a tile is loaded
- **tile.remove** - fired when a tile is removed from the map


## Code snippets

A set of llmr API snippets for quick reference.

#### Creating a map

```js
var map = new llmr.Map({
    container: document.getElementById('map'),
    datasources: {
        'streets': {
            type: 'vector', // either 'vector' or 'raster'
            urls: ['/gl/tiles/plain/{z}-{x}-{y}.vector.pbf'],
            zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            enabled: true
        },
        ...
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
var ds = new llmr.GeoJSONDatasource(geojson, map);

map.addDatasource('some id', ds); // add
map.removeDatasource('some id');  // remove
```

#### Interaction

```js
// get all features at a point within a certain radius
map.featuresAt(x, y, {
    radius: 30,          // radius in pixels to search in
    bucket: 'bucketname' // optional; if set, only features from that bucket will be matched
}, callback);
```
