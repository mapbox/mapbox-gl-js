### dev

An in-progress version being developed in the `mb-pages` branch.

#### Breaking

- Changed `Navigation` control signature: now it doesn't need `map` in constructor and gets added with `map.addControl(nav)` or `nav.addTo(map)`.
- Updated CSS classes to have consistent naming prefixed with `mapboxgl-`.

#### Improvements

- Added attribution control (present by default, disable by passing `attributionControl: false` in options).
- Added rotation by dragging the compass control.
- Added grabbing cursors for the map by default.
- Added `util.inherit` function.
- Changed the default debug page style to OSM Bright.

#### Bugfixes

- Fixed compass control to rotate its icon with the map.
- Fixed navigation control cursors.
- Fixed inertia going to the wrong direction in a rotated map.
- Fixed inertia race condition where error was sometimes throwed after erratic panning/zooming.

### 0.2.0

- First public release.
