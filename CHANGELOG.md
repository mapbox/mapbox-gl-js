
### master

- Added `LatLng` class to encapsulate latitude, longitude coords.
  API methods will accept either `[lat, lng]` or `new llmr.LatLng(lat, lng)`.
- Changed `Map` constructor options to accept `center` (LatLng) and `angle` instead of `lat`, `lon`, `rotation`;
  Made `angle` optional (0 by default).
- Changed `Map` `setPosition` signature to `(latlng, zoom, angle)`.
- Changed `Map` `panTo` and `zoomPanTo` to accept `latlng` instead of `lat, lng`.
- Made all `Map` `zoomPanTo` arguments except `latlng` optional.
- Changed `Transform` API: `z` renamed to `zoom`, `zoom` to `tileZoom`; `zoomAroundTo` now accepts `zoom` instead of `scale`;
  `x` and `y` return the center point instead of top/left; `lat`/`lng` is now `center` (LatLng)
- Added `tileSize` option for tile sources.
- zoom levels fixed to match standard 256px tile maps. Each zoom level is 1 bigger than before.

### 0.0.7

- Started keeping a changelog.
