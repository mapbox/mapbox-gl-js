## master

## 8.6.0

v8.0.0 styles are fully compatible with v8.6.0.

* Added support for zoom and feature driven functions.

## 8.4.2

v8.0.0 styles are fully compatible with v8.4.2.

* Refactored style validator to expose more granular validation methods

## 8.4.1

v8.0.0 styles are fully compatible with v8.4.1.

* Revert ramp validation checks that broke some styles.

## 8.4.0

v8.0.0 styles are fully compatible with v8.4.0.

* Added `cluster`, `clusterRadius`, `clusterMaxZoom` GeoJSON source properties.

## 8.3.0

v8.0.0 styles are fully compatible with v8.3.0.

* Added `line-offset` style property

## 8.2.1

v8.0.0 styles are fully compatible with v8.2.1.

* Enforce that all layers that use a vector source specify a "source-layer"

## 8.2.0

v8.0.0 styles are fully compatible with v8.2.0.

* Add inline `example` property.
* Enforce that all style properties must have documentation in `doc` property.
* Create minified style specs with `doc` and `example` properties removed.
* `validate` now validates against minified style spec.
* `format` now accepts `space` option to use with `JSON.stringify`.
* Remove `gl-style-spritify`. Mapbox GL sprites are now created automatically by
  the Mapbox style APIs, or for hand-crafted styles, by [spritezero-cli](https://github.com/mapbox/spritezero-cli).

## 8.1.0

v8.0.0 styles are fully compatible with v8.1.0.

* [BREAKING] Simplified layout/paint layer property types to more closely align
  with v7 types.
* Fixed migration script compatibility with newer versions of Node.js and io.js
* Removed `constants` from schema, they were deprecated in v8
* Added style diff utility to generate semantic deltas between two stylesheets
* Added `visibility` property to `circle` layer type
* Added `pitch` property to stylesheet

## 8.0.0

Introduction of Mapbox GL style specification v8. To migrate a v7 style to v8,
use the `gl-style-migrate` script as described in the README.

* [BREAKING] The value of the `text-font` property is now an array of
  strings, rather than a single comma separated string.
* [BREAKING] Renamed `symbol-min-distance` to `symbol-spacing`.
* [BREAKING] Renamed `background-image` to `background-pattern`.
* [BREAKING] Renamed `line-image` to `line-pattern`.
* [BREAKING] Renamed `fill-image` to `fill-pattern`.
* [BREAKING] Renamed the `url` property of the video source type to `urls`.
* [BREAKING] Coordinates in video sources are now specified in [lon, lat] order.
* [BREAKING] Removed `text-max-size` and `icon-max-size` properties; these
  are now calculated automatically.
* [BREAKING] `text-size` and `icon-size` are now layout properties instead of paint properties.
* [BREAKING] Constants are no longer supported. If you are editing styles by
  hand and want to use constants, you can use a preprocessing step with a tool
  like [ScreeSS](https://github.com/screee/screess).
* [BREAKING] The format for `mapbox://` glyphs URLs has changed; you should
  now use `mapbox://fonts/mapbox/{fontstack}/{range}.pbf`.
* [BREAKING] Reversed the priority of layers for calculating label placement:
  labels for layers that appear later in the style now have priority over earlier
  layers.
* Added a new `image` source type.
* Added a new `circle` layer type.
* Default map center location can now be set in the style.
* Added `mapbox://` sprite URLs `mapbox://sprite/{user | "mapbox"}/{id}`

## 7.5.0

* Added gl-style-composite script, for auto-compositing sources in a style.

## 7.4.1

* Use JSON.stringify for formatting instead of js-beautify

## 7.0.0

Introduction of Mapbox GL style specification v7.

* [BREAKING] Improve dashed lines (#234)
* [BREAKING] Remove prerendered layers (#232)
* Explicit visibility property (#212)
* Functions for all properties (#237)

## 6.0.0 (Style spec v6)

Introduction of Mapbox GL style specification v6.

* [BREAKING] New filter syntax (#178)
* [BREAKING] Line gap property (#131)
* [BREAKING] Remove dashes from min/max-zoom (#175)
* [BREAKING] New layout/paint terminology (#166)
* [BREAKING] Single text positioning property (#197)
* Added requirements (#200)
* Added minimum, maximum, and period values (#198)

## 0.0.5 (in progress)

* [BREAKING] Switch to suffix for transition properties (`transition-*` -> `*-transition`).
* Added support for remote, non-Mapbox TileJSON sources.
* [BREAKING] Source `minZoom` and `maxZoom` renamed to `minzoom` and `maxzoom to match TileJSON.
* Added support for `mapbox://` glyph URLs.
* [BREAKING] Renamed `raster-fade` to `raster-fade-duration`.
* Added background-opacity property.
* Added "tokens" property to string values that can autocomplete fields from layers
* Added "units" property to describe value types

## 0.0.4 (Aug 8 2014)

* Initial public release
