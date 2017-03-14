# Architecture of Mapbox GL JS

## `Map` and its subsystems

## Main thread / worker split

## How (vector tile) rendering works

### Parsing and layout

Vector tiles are fetched and parsed on WebWorker threads.  "Parsing" a vector tile involves:
 - Deserializing source layers, feature properties, and feature geometries from the PBF.  This is handled by the [`vector-tile-js`](https://github.com/mapbox/vector-tile-js) library.
 - Transforming that data into _render-ready_ data that can be used by WebGL shaders to draw the map.  We refer to this process as "layout," and it carried out by `WorkerTile`, the `Bucket` classes, and `ProgramConfiguration`.
 - Indexing feature geometries into a `FeatureIndex`, used for spatial queries (e.g. `queryRenderedFeatures`).

`WorkerTile#parse()` takes a (deserialized) vector tile, fetches additional resources if they're needed (fonts, images), and then creates a `Bucket` for each 'family' of style layers that share the same underlying features and 'layout' properties (see `group_by_layout.js`).

[Bucket](https://github.com/mapbox/mapbox-gl-js/blob/master/src/data/bucket.js) is the single point of knowledge about turning vector tiles into WebGL buffers. Each bucket holds the vertex and element array data needed to render its group of style layers (see [ArrayGroup](https://github.com/mapbox/mapbox-gl-js/blob/master/src/data/bucket.js)).  The particular bucket types each know how to populate that data for their layer types.

### Rendering with WebGL

Once bucket data has been transferred to the main thread, it looks like this:

```
Tile
  |
  +- buckets[layer-id]: Bucket
  |    |
  |    + ArrayGroup {
  |        globalProperties: { zoom }
  |        layoutVertexArray,
  |        elementArray,
  |        elementArray2,
  |        layerData: {
  |          [style layer id]: {
  |            programConfiguration,
  |            paintVertexArray,
  |            paintPropertyStatistics
  |          }
  |          ...
  |        }
  |    }
  |
  +- buckets[...]: Bucket
        ...
```
_Note that a particular bucket may appear multiple times in `tile.buckets`--once for each layer in a given layout 'family'._

 - Rendering happens style-layer by style-layer, in `Painter#renderPass()`, which delegates to the layer-specific `drawXxxx()` methods in `src/render/draw_*.js`.
 - The `drawXxxx()` methods, in turn, render a layer tile by tile, by:
   - Obtaining a property configured shader program from the `Painter`
   - Setting _uniform_ values based on the style layer's properties
   - Binding layout buffer data (via `BufferGroup`) and calling `gl.drawElements()`

Compiling and caching GL shader programs is managed by the `Painter` and `ProgramConfiguration` classes.  In particular, an instance of `ProgramConfiguration` handles, for a given (tile, style layer) pair:
 - Expanding a `#pragma mapbox` statement in our shader source into either a _uniform_ or _attribute_, _varying_, and _local_ variable declaration, depending on whether or not the relevant style property is data-driven.
 - Creating and populating a _paint_ vertex array for data-driven properties, corresponding to the `attributes` declared in the shader. (This happens at layout time, on the worker side.)


## SourceCache

## Transform

## Controls

