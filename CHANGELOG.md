### master

#### Breaking changes

- llmr now uses a completely **new style format**.
To migrate old styles, use the [gl-style script](https://github.com/mapbox/gl-style)
- Replaced `Source` `urls` option with string `url` option; added `{s}` to URL template to pick subdomains
(`'abc'` by default, can be passed as `subdomains` option either as string or an array).
- Changed `map.fitBounds` to accept `bounds[, options]` as arguments, where `bounds` is `[[minLat, minLng], [maxLat, maxLng]]`,
and `options` has `padding`, `offset`, `speed` and `curve` properties.
- Changed `map.panBy` to accept `offset[, options]` as arguments, where `options` has `duration` and `easing` properties.
- Changed `map.panTo` to accept `latlng[, options]` as arguments, where `options` has `duration`, `easing` and `offset` properties.
- Changed `map.zoomTo` to accept `zoom[, options]` as arguments, where `options` has `duration`, `easing`,  `offset` and `center` properties.
- Changed `map.scaleTo` to accept `scale[, options]` as arguments, where `options` has `duration`, `easing`, `offset` and `center` properties.
- Changed `map.rotateTo` to accept `angle[, options]` as arguments, where `options` has `duration`, `easing` and `easing` properties.
- Changed `map.resetNorth` to accept optional `options` as argument, which has `duration` and `easing` properties.
- Changed `map.zoomPanTo` to accept `latlng[, zoom, options]` as arguments,
where `options` has `speed`, `curve` and `offset` properties.
- Changed linejoins to be specified with `"join": "round"` on the bucket instead of `"linejoin": "round"` in the style.

#### Other changes

- Added `Source` `minZoom`, `maxZoom` and `skipZooms` options. If you don't specify `zooms` explicitly,
they'll be calculated using the options above.
- Zoom value used in styles now gets adjusted based on latitude. Disabled by `adjustZoom: false` in map options.
Adjustment starts at 0% at zoom 6 and reaches 100% at zoom 9, configured by `minAdjustZoom` and `maxAdjustZoom` options.
- Improved `Map` `container` option to also be accepted as string (which is an element id) in addition to DOM element.
- Added `LatLngBounds` geometry type.
- Added `Map` `numWorkers` option (7 by default).
- Renamed `Source` `cache` option to `cacheSize`.
- Added default `Map` `center` and `zoom` (`[0, 0], 0`).
- Changed default `Map` `maxZoom` to `20`.
- Removed `Map` `getUUID` method, added `util` `uniqueId()` instead.
- Added `base` option to `exponential` style function that defines the base of the exponent function (1.75 by default).

### 0.0.10

- `zoomTo` and `scaleTo` now accept origin point as array.
- Added `Map` `interactive` option that disables interactions when set to false.

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
- Changed `Transform` API: `z` renamed to `zoom`, `zoom` to `tileZoom`, `lonX` to `lngX`, `xLon` to `xLng`;
`zoomAroundTo` now accepts `zoom` instead of `scale`; `x` and `y` return the center point instead of top/left;
`lat`/`lng` is now `center` (LatLng); removed unused properties
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
