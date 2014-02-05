# API

## Reference

*A work in progress.*

### llmr.Map

#### Interaction events

- **move** - fired during pan/rotation and after zoom
- **pan** - fired during panning
- **panend** - fired after panning
- **zoom** ({*scale*}) - fired during zoom
- **rotation** — fired when map angle changes
- **click** (*x, y*) - fired on map click
- **hover** (*x, y*) - fired when the mouse moves over the map
- **resize** - fired when the map changes size
- **datasource.add** (*datasource*) - fired when a data source is added
- **datasource.remove** (*datasource*) - fired when a data source is removed

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
