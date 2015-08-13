## 8.0.0

Introduction of Mapbox GL style specification v8. To migrate a v7 style to v8,
use the gl-style-migrate script as described in the README.

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
