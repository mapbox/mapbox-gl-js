### master

- `zoomTo` and `scaleTo` now accept origin point as array.
- Added `Map` `interactive` option that disables interactions when set to false.
- **breaking**: round linejoins are now specified with `"join": "round"` on the bucket,
  and they no longer need `"linejoin": "round"` in the style.

### 0.0.9

- Fixed bugs related to road compositing and geojson sources.

### 0.0.8

- Added `LatLng` class to encapsulate latitude, longitude coords.
  API methods will accept either `[lat, lng]` or `new llmr.LatLng(lat, lng)`.
- Changed `Map` constructor options to accept `center` (LatLng) and `angle` instead of `lat`, `lon`, `rotation`;
  Made `angle` optional (0 by default).
- Changed `Map` `setPosition` signature to `(latlng, zoom, angle)`.
- Changed `Map` `panTo` and `zoomPanTo` to accept `latlng` instead of `lat, lng`.
- Made all `Map` `zoomPanTo` arguments except `latlng` optional.
- Changed `Transform` API: `z` renamed to `zoom`, `zoom` to `tileZoom`, `lonX` to `lngX`, `xLon` to `xLng`; `zoomAroundTo` now accepts `zoom` instead of `scale`;
  `x` and `y` return the center point instead of top/left; `lat`/`lng` is now `center` (LatLng); removed unused properties
- Added `tileSize` option for tile sources.
- `zoom` values now match standard 256px tile maps. Each zoom level's value increases by 1.
  **Breaking**: update all zoom level dependent styles by adding 1 to each zoom level.
- Added `Point` class to encapsulate x, y coords.
  API methods will accept either `[x, y]` or `new llmr.Point(x, y)`.
- Changed `Map` `panBy` and `Map`/`Source` `featuresAt` to accept `point` instead of `x, y`.
- Changed `Map` `fitBounds` and `zoomPanTo` to accept `offset` (Point) instead of `offsetX, offsetY`.
- **breaking**: raster buckets now need to specify `type: 'raster'` in the stylesheet.
- Added `blur` style option for lines that specifies a blur radius
- Added `strokeWidth` style option for text that specifies a halo radius
- Added `alwaysVisible` option in text buckets that disables collision checks when set to true.

### 0.0.7

- Started keeping a changelog.
