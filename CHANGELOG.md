## dev

An in-progress version being developed in the `mb-pages` branch.

## 0.3.1 (Oct 06 2014)

#### Bugfixes

- Fixed iteration over arrays with for/in
- Made browserify deps non-dev (#752)

## 0.3.0 (Sep 23 2014)

#### Breaking

- Updated to mapbox-gl-style-spec v0.0.5 ([Changelog](https://github.com/mapbox/mapbox-gl-style-spec/blob/v0.0.5/CHANGELOG.md)). Styles are
  now expected to be version 5. You can use the [gl-style-migrate](https://github.com/mapbox/mapbox-gl-style-lint#migrations)
  utility to update existing styles.
- Removed support for composite layers for performance reasons. [#523](https://github.com/mapbox/mapbox-gl-js/issues/523#issuecomment-51731405)
- `raster-hue-rotate` units are now degrees.

### Improvements

- Added LatLng#wrap
- Added support for Mapbox fontstack API.
- Added support for remote, non-Mapbox TileJSON sources and inline TileJSON sources (#535, #698).
- Added support for `symbol-avoid-edges` property to allow labels to be placed across tile edges.
- Fixed mkdir issue on Windows (#674).
- Fixed drawing bevelled line joins without overlap.

#### Bugfixes

- Fixed performance when underzooming a layer's minzoom.
- Fixed `raster-opacity` for regular raster layers.
- Fixed various corner cases of easing functions.
- Do not modify original stylesheet (#728).
- Inherit video source from source (#699).
- Fixed interactivity for geojson layers.
- Stop dblclick on navigation so the map does not pan (#715).

## 0.2.2 (Aug 12 2014)

#### Breaking

- `map.setBearing()` no longer supports a second argument. Use `map.rotateTo` with an `offset` option and duration 0
if you need to rotate around a point other than the map center.

#### Improvements

- Improved `GeoJSONSource` to also accept URL as `data` option, eliminating a huge performance bottleneck in case of large GeoJSON files.
[#669](https://github.com/mapbox/mapbox-gl-js/issues/669) [#671](https://github.com/mapbox/mapbox-gl-js/issues/671)
- Switched to a different fill outlines rendering approach. [#668](https://github.com/mapbox/mapbox-gl-js/issues/668)
- Made the minified build 12% smaller gzipped (66 KB now).
- Added `around` option to `Map` `zoomTo`/`rotateTo`.
- Made the permalink hash more compact.
- Bevel linejoins no longer overlap and look much better when drawn with transparency.

#### Bugfixes

- Fixed the **broken minified build**. [#679](https://github.com/mapbox/mapbox-gl-js/issues/679)
- Fixed **blurry icons** rendering. [#666](https://github.com/mapbox/mapbox-gl-js/issues/666)
- Fixed `util.supports` WebGL detection producing false positives in some cases. [#677](https://github.com/mapbox/mapbox-gl-js/issues/677)
- Fixed invalid font configuration completely blocking tile rendering.  [#662](https://github.com/mapbox/mapbox-gl-js/issues/662)
- Fixed `Map` `project`/`unproject` to properly accept array-form values.
- Fixed sprite loading race condition. [#593](https://github.com/mapbox/mapbox-gl-js/issues/593)
- Fixed `GeoJSONSource` `setData` not updating the map until zoomed or panned. [#676](https://github.com/mapbox/mapbox-gl-js/issues/676)

## 0.2.1 (Aug 8 2014)

#### Breaking

- Changed `Navigation` control signature: now it doesn't need `map` in constructor
and gets added with `map.addControl(nav)` or `nav.addTo(map)`.
- Updated CSS classes to have consistent naming prefixed with `mapboxgl-`.

#### Improvements

- Added attribution control (present by default, disable by passing `attributionControl: false` in options).
- Added rotation by dragging the compass control.
- Added grabbing cursors for the map by default.
- Added `util.inherit` and `util.debounce` functions.
- Changed the default debug page style to OSM Bright.
- Token replacements now support dashes.
- Improved navigation control design.

#### Bugfixes

- Fixed compass control to rotate its icon with the map.
- Fixed navigation control cursors.
- Fixed inertia going to the wrong direction in a rotated map.
- Fixed inertia race condition where error was sometimes throwed after erratic panning/zooming.


## 0.2.0 (Aug 6 2014)

- First public release.
