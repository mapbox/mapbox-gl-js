# Architecture of Mapbox GL JS

## Map and its subsystems

## Main render 'loop'

Triggered by:
 - Style changes
 - Source data
 - Map movement (Camera)
 - Transitions ('animation loop')

## Main thread / worker split

## How (vector tile) rendering works

### Parsing the vector tile and preparing buffers

Vector tiles are fetched and parsed on WebWorker threads.  "Parsing" a vector
tile involves:
 - Deserializing source layers, feature properties, and feature geometries from the PBF.  This is handled by the `vector-tile` library.
 - Transforming that data into _render-ready_ data that can be used by WebGL shaders to draw the map.  This is the responsibility of `WorkerTile`, the `Bucket` classes, and `ProgramConfiguration`.
 - Indexing feature geometries into a `FeatureIndex`, used for spatial queries (e.g. `queryRenderedFeatures`).

`WorkerTile#parse()` takes a (deserialized) vector tile, fetches additional
resources if they're needed (fonts, images), and then creates a `Bucket` for
each group of style layers that share the same underlying feature and 'layout'
information (see `group_by_layout.js`).

 - [Bucket]()

### Rendering with WebGL

 - [ProgramConfiguration]()


## SourceCache

## Transform

## Controls

