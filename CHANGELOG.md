
### master

- Added `LatLng` class to encapsulate latitude, longitude coords.
  API methods will accept either `[lat, lng]` or `new llmr.LatLng(lat, lng)`.
- Changed `Map` constructor options to accept `center` (LatLng) and `angle` instead of `lat`, `lon`, `angle`;
  Made `angle` optional (0 by default).
- Changed `Map` `setPosition` signature to `(latlng, zoom, angle)`.
- Changed `Map` `panTo` and `zoomPanTo` to accept `latlng` instead of `lat, lng`.
- Made all `Map` `zoomPanTo` arguments except `latlng` optional.

### 0.0.7

- Started keeping a changelog.
