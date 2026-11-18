# Glossary

The plugin uses the terms of the public GL JS API. Each term links to the page that defines it.

## Camera

### Camera

The view of the map, set by a center, a zoom, a bearing and a pitch. See [Map](https://docs.mapbox.com/mapbox-gl-js/api/map/).

### Bearing

The rotation of the map in degrees clockwise from north.

### Pitch

The angle of the camera in degrees away from straight down.
_Avoid_: tilt

### LngLat

A longitude and latitude in degrees, in that order. See [Geography and geometry](https://docs.mapbox.com/mapbox-gl-js/api/geography/).
_Avoid_: point

## Style

### Style

The document that defines how the map looks: its sources, layers, imports, terrain and projection. See the [Style Specification](https://docs.mapbox.com/style-spec/reference/).
_Avoid_: settings, look

### Import

A style that another style includes by an import id. The root style is the style that the map loads. See [Imports](https://docs.mapbox.com/style-spec/reference/imports/).

### Configuration property

A named value that a style exposes for change, such as a light preset. Its schema gives its type, default and allowed values.
_Avoid_: config option, option, setting

### Projection

The way the map draws the globe on a flat screen, such as `globe` or `mercator`. See [Projection](https://docs.mapbox.com/style-spec/reference/projection/).

### Terrain

The 3D relief of the map, made from a raster-dem source and an exaggeration. See [Terrain](https://docs.mapbox.com/style-spec/reference/terrain/).

### Raster-dem source

A source of elevation tiles that terrain reads. See [Sources](https://docs.mapbox.com/style-spec/reference/sources/).
_Avoid_: DEM source

## Features

### Source

The data of the map, named by a source id. See [Sources](https://docs.mapbox.com/mapbox-gl-js/api/sources/).

### Layer

A style layer that draws the features of one source, named by a layer id. See [Layers](https://docs.mapbox.com/style-spec/reference/layers/).

### Featureset

A named group of layers that a style offers for interaction, also when another style imports it. See [Featuresets](https://docs.mapbox.com/style-spec/reference/featuresets/).
_Avoid_: layer, when it means a featureset

### Target

A layer or a featureset that a query reads. A target is `{layerId}` or `{featuresetId, importId}`, and the root style has no `importId`.

### Feature

A GeoJSON feature that a query returns, with an id, a geometry and properties. GL JS can split or duplicate a feature across tile boundaries, so a query can return it more than once.
_Avoid_: piece

### Rendered features

The features that the map shows on the screen, as `queryRenderedFeatures` returns them.
_Avoid_: screen

### Source features

The features in the loaded tiles of a source, also off screen, as `querySourceFeatures` returns them.
_Avoid_: loaded tiles

### Filter

An expression that a feature must match. A layer has a filter, and a query can take one. See [Expressions](https://docs.mapbox.com/style-spec/reference/expressions/).
_Avoid_: where

### Feature state

Key-value data on a feature at run time, which a style reads with the `feature-state` expression.
_Avoid_: state, when it means something other than feature state

### Label

Text or an icon that a symbol layer draws. GL JS places labels so that they do not overlap, and hides the labels that would. See [Symbol](https://docs.mapbox.com/style-spec/reference/layers/#symbol).

## Markers

### Marker

An element at a LngLat on the map. See [Markers and controls](https://docs.mapbox.com/mapbox-gl-js/api/markers/).
_Avoid_: pin, drop

### Popup

A box of text or HTML at a LngLat, which a marker can open on click.
_Avoid_: label
