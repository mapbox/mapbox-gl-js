## 2.9.1

### Bug fixes 🐞

* Fix missing lines on some Windows devices. ([#12017](https://github.com/mapbox/mapbox-gl-js/pull/12017))

## 2.9.0

### Features ✨

* Add `globe` projection. This new projection displays the map as a 3d globe and can be enabled by either passing `projection: globe` to the map constructor or by calling `map.setProjection('globe')`. All layers are supported by globe except for Custom Layers and Sky.
* Extend atmospheric `fog` with three new style specification properties: `high-color`, `space-color` and `star-intensity` to allow the design of atmosphere around the globe and night skies. ([#11590](https://github.com/mapbox/mapbox-gl-js/pull/11590))
* Add a new line layer paint property in the style specification: `line-trim-offset` that can be used to create a custom fade out with improved update performance over `line-gradient`. ([#11570](https://github.com/mapbox/mapbox-gl-js/pull/11570))
* Add an option for providing a geolocation adapter to `GeolocateControl`. ([#10400](https://github.com/mapbox/mapbox-gl-js/pull/10400)) (h/t [behnammodi](https://github.com/behnammodi))
* Add `Map.Title` property to locale options to localise the map `aria-label`. ([#11549](https://github.com/mapbox/mapbox-gl-js/pull/11549)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Allow duplicated coordinates in tile request URLs. ([#11441](https://github.com/mapbox/mapbox-gl-js/pull/11441)) (h/t [ozero](https://github.com/ozero))

### Bug fixes 🐞

* Fix an issue which causes line layers to occasionally flicker. ([#11848](https://github.com/mapbox/mapbox-gl-js/pull/11848))
* Fix markers in fog sometimes becoming more visible when behind terrain. ([#11658](https://github.com/mapbox/mapbox-gl-js/pull/11658))
* Fix an issue where setting terrain exageration to 0 could prevent the zoom to be resolved. ([#11830](https://github.com/mapbox/mapbox-gl-js/pull/11830))
* Copy stylesheet to allow toggling different styles using setStyle without overwriting some of the properties. ([#11942](https://github.com/mapbox/mapbox-gl-js/pull/11942))

## 2.8.2

### Bug fixes 🐞

* Fix an issue where the special bundle for CSP-restricted environments was not compatible with further minification in some bundling setups. ([#11790](https://github.com/mapbox/mapbox-gl-js/pull/11790))

## 2.8.1

### Bug fixes 🐞

* Fix the special bundle for CSP-restricted environments that broke in the 2.8.0 release. ([#11739](https://github.com/mapbox/mapbox-gl-js/pull/11739))

## 2.8.0

### Performance improvements 🏁

* Improve memory usage by freeing memory more eagerly after loading tiles. ([#11434](https://github.com/mapbox/mapbox-gl-js/pull/11434))
* Improve memory usage by reducing repeated line labels on overscaled tiles. ([#11414](https://github.com/mapbox/mapbox-gl-js/pull/11414))
* Improve performance when placing many symbols on terrain. ([#11466](https://github.com/mapbox/mapbox-gl-js/pull/11466))

### Bug fixes 🐞

* Fix `map.fitBounds()`, `map.fitScreenCoordinates()`, and `map.cameraForBounds()` incorrectly matching bounds with non-zero bearing. ([#11568](https://github.com/mapbox/mapbox-gl-js/pull/11568)) (h/t [TannerPerrien](https://github.com/TannerPerrien))
* Improve control button appearance by applying `border-radius` more consistently. ([#11423](https://github.com/mapbox/mapbox-gl-js/pull/11423)) (h/t [nagix](https://github.com/nagix))
* Fix `ScaleControl` displaying incorrect units with some projections.([#11657](https://github.com/mapbox/mapbox-gl-js/pull/11657))
* Fix performance regression when animating image sources. ([#11564](https://github.com/mapbox/mapbox-gl-js/pull/11564))
* Fix `MapDataEvent.isSourceLoaded()` to check if specific source has loaded. ([#11393](https://github.com/mapbox/mapbox-gl-js/pull/11393))
* Fix map not wrapping after moving the map with no inertia. ([#11448](https://github.com/mapbox/mapbox-gl-js/pull/11448))
* Fix popup not removing event listeners when `closeOnClick:true`. ([#11540](https://github.com/mapbox/mapbox-gl-js/pull/11540))
* Fix camera occasionally intersecting terrain when DEM data loads while zooming. ([#11461](https://github.com/mapbox/mapbox-gl-js/pull/11461), [#11578](https://github.com/mapbox/mapbox-gl-js/pull/11578))
* Increase clarity of line layers with the terrain on high DPI devices. ([#11531](https://github.com/mapbox/mapbox-gl-js/pull/11531))
* Fix canvas size if more than one parent container has a transform CSS property. ([#11493](https://github.com/mapbox/mapbox-gl-js/pull/11493))
* Fix error on calling `map.removeImage()` on animated image. ([#11580](https://github.com/mapbox/mapbox-gl-js/pull/11580))
* Fix occasional issue with `fill-extrusion` layers not rendering on tile borders when used with terrain. ([#11530](https://github.com/mapbox/mapbox-gl-js/pull/11530))

### Workflow 🛠️

* Upgrade Flow from `v0.108.0` to `v0.142.0` and enable type-first mode, greatly improving performance of type-checking. ([#11426](https://github.com/mapbox/mapbox-gl-js/issues/11426))

## 2.7.1

### 🐞 Bug fixes

* Work around a [Safari rendering bug](https://bugs.webkit.org/show_bug.cgi?id=237918#c3) by disabling WebGL context antialiasing for Safari 15.4 and 15.5. ([#11615](https://github.com/mapbox/mapbox-gl-js/pull/11615))
* Fix disabling cooperative gesture handling when map is fullscreen in Safari. ([#11619](https://github.com/mapbox/mapbox-gl-js/pull/11619))

## 2.7.0

### Features ✨ and improvements 🏁

* Enable preloading tiles for camera animation. ([#11328](https://github.com/mapbox/mapbox-gl-js/pull/11328))
* Improve quality of transparent line layers by removing overlapping geometry artifacts. ([#11082](https://github.com/mapbox/mapbox-gl-js/pull/11082))
* Add perspective correction for non-rectangular image, canvas and video sources. ([#11292](https://github.com/mapbox/mapbox-gl-js/pull/11292))
* Improve performance of default markers. ([#11321](https://github.com/mapbox/mapbox-gl-js/pull/11321))
* Add marker methods `setSnapToPixel` and `getSnapToPixel` to indicate rounding a marker to pixel. ([#11167](https://github.com/mapbox/mapbox-gl-js/pull/11167)) (h/t [malekeym](https://github.com/malekeym))
* Add a default `aria-label` for interactive markers for improved user accessibility. ([#11349](https://github.com/mapbox/mapbox-gl-js/pull/11349))
* Add support for sparse tile sets to DEM data sources, when served tiles don't go up to the full `maxzoom`. ([#11276](https://github.com/mapbox/mapbox-gl-js/pull/11276))
* Allow users to set order of custom attribution. ([#11196](https://github.com/mapbox/mapbox-gl-js/pull/11196))
* Add function call chaining to function `map.setProjection` ([#11279](https://github.com/mapbox/mapbox-gl-js/pull/11279)) (h/t [lpizzinidev](https://github.com/lpizzinidev))

### 🐞 Bug fixes

* Fix canvas size to evaluate to expected value when applying the CSS transform property. ([#11310](https://github.com/mapbox/mapbox-gl-js/pull/11310))
* Fix `getBounds` sometimes returning invalid `LngLat` when zooming on a map with terrain. ([#11339](https://github.com/mapbox/mapbox-gl-js/pull/11339)) (h/t [@ted-piotrowski](https://github.com/ted-piotrowski))
* Fix rendering of denormalized strings with diacritics. ([#11269](https://github.com/mapbox/mapbox-gl-js/pull/11269))
* Remove redundant title attribute from `Improve this Map` attribution element. ([#11360](https://github.com/mapbox/mapbox-gl-js/pull/11360))
* Fix a rare terrain flickering issue when using terrain with multiple vector data sources. ([#11346](https://github.com/mapbox/mapbox-gl-js/pull/11346))

## 2.6.1

### 🐞 Bug fixes
* Remove Object spread syntax to ensure older build systems continue to work as expected. ([#11295](https://github.com/mapbox/mapbox-gl-js/pull/11295))

## 2.6.0

### ✨ Features and improvements

* Add support for a variety of new map projections beyond the standard Web Mercator. Alternate projections can be used together with all existing styles and sources. The projections eliminate distortion as you zoom to make them useful at every scale. Supported projections include `albers`, `equalEarth`, `equirectangular`, `lambertConformalConic`, `naturalEarth` and `winkelTripel`. Change the projection by setting it in the map constructor: `new Map({ projection: 'winkelTripel', ... })`. ([#11124](https://github.com/mapbox/mapbox-gl-js/pull/11124))
    * Limitations: Non-mercator projections do not yet support terrain, fog, free camera or CustomLayerInterface.
* Add a new `"cooperativeGestures": true` map option that prevents the map from capturing page scrolling and panning. When enabled, scroll zooming requires `ctrl` or `⌘` to be pressed and touch panning requires two fingers ([#11029](https://github.com/mapbox/mapbox-gl-js/pull/11029), [#11116](https://github.com/mapbox/mapbox-gl-js/pull/11116))
* Add support for dynamic filtering of symbols based on pitch and distance to map center. `["pitch"]` and `["distance-from-camera"]` expressions can now be used within the `filter` of a symbol layer. ([#10795](https://github.com/mapbox/mapbox-gl-js/pull/10795))
* Improve user accessibility: conveying only `aria-label` in controls, replace `aria-pressed`with `aria-expanded` in the attribution control, interactive markers with popups express an `aria-expanded` state, and interactive markers have the role "button". ([#11064](https://github.com/mapbox/mapbox-gl-js/pull/11064))
* Add support for conditionally styling most paint properties according to the presence or absence of specific images. ([#11049](https://github.com/mapbox/mapbox-gl-js/pull/11049))
* Add support for attaching events to multiple layers with `map.on()`, allowing users to retrieve features under the mouse or touch event based on the order in which they are rendered.  ([#11114](https://github.com/mapbox/mapbox-gl-js/pull/11114))(h/t [@omerbn](https://github.com/omerbn))

### 🐞 Bug fixes

* Fix `map.setFeatureState(...)` not updating rendering when terrain is enabled. ([#11209](https://github.com/mapbox/mapbox-gl-js/pull/11209))
* Fix marker positioning before initial map load ([#11025](https://github.com/mapbox/mapbox-gl-js/pull/11025))
* Fix slow tile loading performance on maps with CJK glyphs on certain Chrome/GPU combinations. ([#11047](https://github.com/mapbox/mapbox-gl-js/pull/11047))
* Update NavigationControl when `min` and `max` zoom are changed ([#11018](https://github.com/mapbox/mapbox-gl-js/pull/11018))
* Prevent video sources from entering fullscreen on iOS Safari ([#11067](https://github.com/mapbox/mapbox-gl-js/pull/11067))
* Fix a rare triangulation issue that could cause an infinite loop ([#11110](https://github.com/mapbox/mapbox-gl-js/pull/11110))
* Fix `null` feature values returned as `"null"` by `queryRenderedFeatures(...)` ([#11110](https://github.com/mapbox/mapbox-gl-js/pull/11110))
* Fix rendering issue with power of two square images and `'raster-resampling': 'nearest'` ([#11162](https://github.com/mapbox/mapbox-gl-js/pull/11162))

## 2.5.1

### 🐞 Bug fixes

* Fix an iOS 15 issue where the iOS Safari tab bar interrupts touch interactions. ([#11084](https://github.com/mapbox/mapbox-gl-js/pull/11084))

## 2.5.0

### Features ✨ and improvements 🏁

* Added `queryRenderedFeatures` support to heatmap layers. ([#10996](https://github.com/mapbox/mapbox-gl-js/pull/10996))
* Added support for using `line-gradient` and `line-dasharray` paint properties together on line layers. ([#10894](https://github.com/mapbox/mapbox-gl-js/pull/10894))
* Added `preclick` event allowing popups to close and open in a new location on one click. ([#10926](https://github.com/mapbox/mapbox-gl-js/pull/10926))
* Improved collision detection for labels along lines, slightly improving label density. ([#10918](https://github.com/mapbox/mapbox-gl-js/pull/10918))
* Improved Popup `addClassName`, `removeClassName` and `toggleClassName` methods to work on popup instances that are not added to the map.  ([#10889](https://github.com/mapbox/mapbox-gl-js/pull/10889))
  * ⚠️ Note: Direct modifications to the popup container CSS class no longer persist. These methods should be used instead.

### 🐞 Bug fixes

* Fixed `maxBounds` property not working across the 180th meridian. ([#10903](https://github.com/mapbox/mapbox-gl-js/pull/10903))
* Fixed `map.getBounds()` returning too-large bounds under some conditions. ([#10909](https://github.com/mapbox/mapbox-gl-js/pull/10909))
* Fixed markers not updating position when toggling terrain. ([#10985](https://github.com/mapbox/mapbox-gl-js/pull/10985))
* Fixed gap on edge of map on retina displays. ([#10936](https://github.com/mapbox/mapbox-gl-js/pull/10936))
* Fixed SDF images rendering inside text. ([#10989](https://github.com/mapbox/mapbox-gl-js/pull/10989))
* Fixed an issue with slow tile loading performance on maps with CJK glyphs on certain Chrome/GPU combinations. ([#11047](https://github.com/mapbox/mapbox-gl-js/pull/11047))

## 2.4.0

### ✨ Features and improvements

* Add `showUserHeading` option to `GeolocateControl` that draws a triangle in front of the dot to denote both the user's location, and the direction they're facing.([#10817](https://github.com/mapbox/mapbox-gl-js/pull/10817)) (h/t to [@tsuz](https://github.com/tsuz))
* Add support for `text-writing-mode` property when using `symbol-placement: line` text labels. ([#10647](https://github.com/mapbox/mapbox-gl-js/pull/10647))
  * Note: This change will bring the following changes for CJK text blocks:
    * 1. For vertical CJK text, all the characters including Latin and Numbers will be vertically placed now. Previously, Latin and Numbers were horizontally placed.
    * 2. For horizontal CJK text, there may be a slight horizontal shift due to the anchor shift.
* Improve character alignment in labels with mixed CJK and Latin characters by adding support for `descender` and `ascender` font metrics.([#8781](https://github.com/mapbox/mapbox-gl-js/pull/10652))
* Improve terrain performance by reducing number of framebuffer switches during draping.([#10701](https://github.com/mapbox/mapbox-gl-js/pull/10701))
* Improve behavior of vertically aligned line labels with horizontal text by adding stickiness to their flip state, preventing them from flickering. ([#10622](https://github.com/mapbox/mapbox-gl-js/pull/10622))

### 🐞 Bug fixes

* Fix a potential rendering artifact when using custom `fill-extrusion` dataset with terrain. ([#10812](https://github.com/mapbox/mapbox-gl-js/pull/10812))
* Fix anchor calculation for `line-center` line labels when the anchor is very near to line segment endpoints. ([#10776](https://github.com/mapbox/mapbox-gl-js/pull/10776))
* Fix `ImageSource` breaking in Firefox/Safari if it's not immediately visible.([#10698](https://github.com/mapbox/mapbox-gl-js/pull/10698))
* Fix gradient skybox rendering issue on some ARM Mali GPU's.([#10703](https://github.com/mapbox/mapbox-gl-js/pull/10703))

## 2.3.1

### 🐞 Bug fixes

* Fix fog flickering when the map option `optimizeForTerrain` is set to false ([#10763](https://github.com/mapbox/mapbox-gl-js/pull/10767))
* Fix collision boxes which were not correctly updated for symbols with `text-variable-anchor` ([#10709](https://github.com/mapbox/mapbox-gl-js/pull/10709))

## 2.3.0

### ✨ Features and improvements
* Add configurable fog as a root style specification ([#10564](https://github.com/mapbox/mapbox-gl-js/pull/10564))
* Add support for data-driven expressions in `line-dasharray` and `line-cap` properties. ([#10591](https://github.com/mapbox/mapbox-gl-js/pull/10591))
* Add support for data-driven `text-line-height` ([#10612](https://github.com/mapbox/mapbox-gl-js/pull/10612))
* Add client-side elevation querying with `map.queryTerrainElevation(lngLat)` when terrain is active ([#10602](https://github.com/mapbox/mapbox-gl-js/pull/10602))
* Reduce GPU memory footprint when terrain is active by sharing a single depth stencil renderbuffer for all draping ([#10611](https://github.com/mapbox/mapbox-gl-js/pull/10611))
* Optimize tile cover by preventing unnecessary tile loads when terrain is active ([#10467](https://github.com/mapbox/mapbox-gl-js/pull/10467))
* Batch render DOM elements to avoid reflow ([#10530](https://github.com/mapbox/mapbox-gl-js/pull/10530), [#10567](https://github.com/mapbox/mapbox-gl-js/pull/10567)) (h/t [zarov](https://github.com/zarov))

### 🐞 Bug fixes
* Fix style property transitions not invalidating the terrain render cache ([#10485](https://github.com/mapbox/mapbox-gl-js/pull/10485))
* Fix raster tile expiry data not being retained. ([#10494](https://github.com/mapbox/mapbox-gl-js/pull/10494)) (h/t [andycalder](https://github.com/andycalder))
* Fix undefined type error when removing `line-gradient` paint property ([#10557](https://github.com/mapbox/mapbox-gl-js/pull/10557))
* Fix unclustered points in a clustered GeoJSON source incorrectly snapping to a grid at high zoom levels. ([#10523](https://github.com/mapbox/mapbox-gl-js/pull/10523))
* Fix `map.loadImage` followed with a delay by `map.addImage` failing in Safari and Firefox. ([#10524](https://github.com/mapbox/mapbox-gl-js/pull/10524))
* Allow conditional display of formatted images in text ([#10553](https://github.com/mapbox/mapbox-gl-js/pull/10553))
* Fix fill-extrusion elevation underflow below sea level ([#10570](https://github.com/mapbox/mapbox-gl-js/pull/10570))
* Fix dashed lines with square line caps. ([#9561](https://github.com/mapbox/mapbox-gl-js/pull/9561))
* Fix markers sometimes throwing an error after being removed from a 3D map. ([#10478](https://github.com/mapbox/mapbox-gl-js/pull/10478)) (h/t [andycalder](https://github.com/andycalder))
* Set `type=button` on attribution button to prevent accidental form submit when map is nested in `<form>` ([#10531](https://github.com/mapbox/mapbox-gl-js/pull/10531))
* Fix nine documentation typos ([#10546](https://github.com/mapbox/mapbox-gl-js/pull/10546), [#10548](https://github.com/mapbox/mapbox-gl-js/pull/10548) [#10551](https://github.com/mapbox/mapbox-gl-js/pull/10551) [#10646](https://github.com/mapbox/mapbox-gl-js/pull/10646)) (h/t [coliff](https://github.com/coliff))

## 2.2.0

### Features and improvements
* Add `testMode` Map option that silences errors and warnings generated due to an invalid accessToken. It maybe useful when using the library to write unit tests. ([#10445](https://github.com/mapbox/mapbox-gl-js/pull/10445))
* Improve `geojsonSource.setData(...)` performance in Safari ([#10417](https://github.com/mapbox/mapbox-gl-js/pull/10417))
* Add `map.getTerrain()` method ([#10413](https://github.com/mapbox/mapbox-gl-js/pull/10413))
* Add `showTerrainWireframe` map debug option for displaying terrain wireframe ([#10406](https://github.com/mapbox/mapbox-gl-js/pull/10406))
* Document the default limit and offset of `geojsonSource.getClusterLeaves(...)` ([#10403](https://github.com/mapbox/mapbox-gl-js/pull/10403)) (h/t [henk23](https://github.com/henk23))
* (Development) Update dev environment to native ES modules to support Node 14+ ([#10367](https://github.com/mapbox/mapbox-gl-js/pull/10367))

### Bug fixes
* Fix `map.getBounds()` to return the inset bounds when map padding is set ([#10386](https://github.com/mapbox/mapbox-gl-js/pull/10386))
* Support flat roofs for fill-extrusions when using custom data sources with terrain ([#10347](https://github.com/mapbox/mapbox-gl-js/pull/10347))
* Fix flickering accuracy circle in `GeolocateControl`. ([#10334](https://github.com/mapbox/mapbox-gl-js/pull/10334)) (h/t [anderswi](https://github.com/anderswi))
* Show Mapbox logo if no style is provided for the map ([#10361](https://github.com/mapbox/mapbox-gl-js/pull/10361))
* Switch to using alphabetic baseline for locally-rendered glyphs to avoid misalignment on fonts with large ascenders/descenders. ([#10390](https://github.com/mapbox/mapbox-gl-js/pull/10390))
* Fix incorrect diffing of styles when using raster DEM tile sources ([#10418](https://github.com/mapbox/mapbox-gl-js/pull/10418))
* Fix `queryRenderedFeatures(...)` for fill-extrusions partly behind the camera ([#10428](https://github.com/mapbox/mapbox-gl-js/pull/10428))
* Fix artifacts caused by negative terrain elevation ([#10432](https://github.com/mapbox/mapbox-gl-js/pull/10432))
* Reset WebGL culling state before drawing custom layers ([#10412](https://github.com/mapbox/mapbox-gl-js/pull/10412))
* Fix DOM event coordinates for scaled containers ([#10096](https://github.com/mapbox/mapbox-gl-js/pull/10096)) (h/t [kawsndriy](https://github.com/kawsndriy))
* Fix `collectResourceTiming` errors ([#10321](https://github.com/mapbox/mapbox-gl-js/pull/10321))

## 2.1.1

### 🐞 Bug fixes

- Fixed a font glyphs performance regression on Firefox. ([10363](https://github.com/mapbox/mapbox-gl-js/pull/10363))

## 2.1.0

### ✨ Features and improvements

- Added `localFontFamily` map option that enables local generation of all font glyphs. ([#10298](https://github.com/mapbox/mapbox-gl-js/pull/10298))
- Introduced high resolution local glyph generation for improved rendering quality of glyphs generated using `localIdeographFontFamily` or `localFontFamily` options. ([#10298](https://github.com/mapbox/mapbox-gl-js/pull/10298))
- Added `optimizeForTerrain` map option allowing to use terrain in _layer draw-order_ or _performance_ priority mode. This fixes terrain not always preserving layer draw-order during animations by making the behavior explicit. ([#10258](https://github.com/mapbox/mapbox-gl-js/pull/10258))
- Improved performance by slightly shifting the horizon down, reducing the number of tiles loaded for highly-pitched maps. ([#10304](https://github.com/mapbox/mapbox-gl-js/pull/10304))
- Improved `evented.once(eventName)` to return a promise if no listener function is provided, which allows using `async/await` with map events for a simpler and more readable code. ([#10203](https://github.com/mapbox/mapbox-gl-js/pull/10203))

### 🐞 Bug fixes

- Fixed querying of `fill-extrusion`s when terrain is enabled. ([#10293](https://github.com/mapbox/mapbox-gl-js/pull/10293))
- Fixed a bug where close points were sometimes not clustered on higher zoom levels given a small clustering radius. Fixed `clusterMaxZoom` so that it is not capped by the source `maxzoom`. ([#10300](https://github.com/mapbox/mapbox-gl-js/pull/10300))
- Fixed blurry map-aligned labels on highly pitched maps with terrain. ([#10296](https://github.com/mapbox/mapbox-gl-js/pull/10296))
- Fixed a race condition when evaluating image expressions by ensuring sprite has loaded before parsing tiles. ([#10294](https://github.com/mapbox/mapbox-gl-js/pull/10294))
- Fixed a bug with fullscreen `fill-extrusion` querying at low pitch. ([#10315](https://github.com/mapbox/mapbox-gl-js/pull/10315))
- Fixed a regression with the usage of patterns with data-driven styling. ([#10284](https://github.com/mapbox/mapbox-gl-js/pull/10284))
- Ensure `evented.listens` returns `false` when no listener is available. ([#10281](https://github.com/mapbox/mapbox-gl-js/pull/10281))


## 2.0.1

### ✨ Features and improvements

- Added support for using third-party worker-loader plugins in build systems such as Webpack and Rollup (`mapboxgl.workerClass`). ([#10219](https://github.com/mapbox/mapbox-gl-js/pull/10219))
- Added `mapboxgl.setNow` and `mapboxgl.restoreNow` methods which allow setting custom animation timing for 60 fps, jank-free video recording. ([#10172](https://github.com/mapbox/mapbox-gl-js/pull/10172))
- Removed outdated CSS hacks that no longer apply. ([#10202](https://github.com/mapbox/mapbox-gl-js/pull/10202))

### 🐞 Bug fixes

- Fixed a bug where `ImageSource` and dynamically loaded icons didn't work in some cases in Firefox and Safari. ([#10230](https://github.com/mapbox/mapbox-gl-js/pull/10230))
- Fixed a bug where `map.unproject` and `map.panBy` acted unpredictably in certain cases. ([#10224](https://github.com/mapbox/mapbox-gl-js/pull/10224))
- Fixed a bug where the sky layer didn't take map padding into account. ([#10201](https://github.com/mapbox/mapbox-gl-js/pull/10201))
- Fixed a bug where `map.setStyle` couldn't be used to enable terrain. ([#10177](https://github.com/mapbox/mapbox-gl-js/pull/10177))
- Fixed a bug where mouse events didn't properly fire during zoom scrolling. ([#10171](https://github.com/mapbox/mapbox-gl-js/pull/10171))

## 2.0.0

### ⚠️ Breaking changes

- **mapbox-gl-js is no longer under the 3-Clause BSD license. By upgrading to this release, you are agreeing to [Mapbox terms of service](https://www.mapbox.com/legal/tos/).** Refer to LICENSE.txt for the new licensing terms and details. For questions, contact our team at [https://support.mapbox.com](https://support.mapbox.com).
- Beginning with v2.0.0, a billable map load occurs whenever a Map object is initialized. Before updating an existing implementation from v1.x.x to v2.x.x, please review the [pricing documentation](https://docs.mapbox.com/accounts/guides/pricing/#mapbox-gl-js-v100-and-higher) to estimate expected costs.
- Deprecate Internet Explorer 11, no longer supported from this release. ([#8283](https://github.com/mapbox/mapbox-gl-js/issues/8283), [#6391](https://github.com/mapbox/mapbox-gl-js/issues/6391))
- Support for unlocked pitch up to 85°. The  default `maxPitch` is increased from 60° to 85° which can result in viewing above the horizon line. By default, this area will be drawn transparent but a new sky layer can be added to the map in order to fill this space. The legacy behavior can be achieved by simply adding `maxPitch: 60` to the map options when instantiating your map.

### ✨ Features and improvements

- Add 3D terrain feature. All layer types and markers can now be extruded using the new `terrain` root level style-spec property or with the function `map.setTerrain()`. ([#1489](https://github.com/mapbox/mapbox-gl-js/issues/1489))
- Add support for unlocked pitch up to 85° (previously 60°). ([#3731](https://github.com/mapbox/mapbox-gl-js/issues/3731))
- Add a new sky layer acting as an infinite background above the horizon line. This layer can be used from the style-spec and has two types: `atmospheric` and `gradient`.
- Add a free form camera API, allowing for more complex camera manipulation in 3D, accessible using `map.getFreeCameraOptions()` and `map.setFreeCameraOptions()`.
- Improve performance by adopting a two-phase tile loading strategy, prioritizing rendering of non-symbol layers first.
- Improve performance by avoiding parsing vector tiles that were already aborted.
- Improve performance by adopting a preemptive shader compilation strategy. ([#9384](https://github.com/mapbox/mapbox-gl-js/issues/9384))
- Improve performance by disabling fade-in animation for symbols and raster tiles on initial map load.
- Improve performance by defaulting to 2 workers on all platforms. ([#3153](https://github.com/mapbox/mapbox-gl-js/issues/3153))
- Improve performance by loading tiles on the main thread at initial map load.
- Improve performance by using better worker task scheduling.

### 🐞 Bug fixes

- Avoid reloading `raster` and `raster-dem` tiles when the RTLTextPlugin loads.
- Add runtime evaluation of label collision boxes for more accurate symbol placement at fractional zoom levels and tilted views.
- Fix tile cache size for terrain DEM sources.
- Prevent holding on to DEM memory on the worker.
- Reduce memory used by `fill-extrusion`s.

### 🛠️ Workflow

- Run render tests in browser.

## 1.13.2

### 🐞 Bug fixes

* Backports a fix for an iOS 15 issue where the iOS Safari tab bar interrupts touch interactions. ([#11084](https://github.com/mapbox/mapbox-gl-js/pull/11084))

## 1.13.0

### ✨ Features and improvements

- Improve accessibility by fixing issues reported by WCAG 2.1. [#9991](https://github.com/mapbox/mapbox-gl-js/pull/9991)
- Improve accessibility when opening a popup by immediately focusing on the content. [#9774](https://github.com/mapbox/mapbox-gl-js/pull/9774) (h/t @watofundefined)
- Improve rendering performance of symbols with `symbol-sort-key`. [#9751](https://github.com/mapbox/mapbox-gl-js/pull/9751) (h/t @osvodef)
- Add `Marker` `clickTolerance` option. [#9640](https://github.com/mapbox/mapbox-gl-js/pull/9640) (h/t @ChristopherChudzicki)
- Add `Map` `hasControl` method. [#10035](https://github.com/mapbox/mapbox-gl-js/pull/10035)
- Add `Popup` `setOffset` method. [#9946](https://github.com/mapbox/mapbox-gl-js/pull/9946) (h/t @jutaz)
- Add `KeyboardHandler` `disableRotation` and `enableRotation` methods. [#10072](https://github.com/mapbox/mapbox-gl-js/pull/10072) (h/t @jmbott)

### 🐞 Bug fixes

- Fix a bug where `queryRenderedFeatures` didn't properly expose the paint values if they were data-driven. [#10074](https://github.com/mapbox/mapbox-gl-js/pull/10074) (h/t @osvodef)
- Fix a bug where attribution didn't update when layer visibility changed during zooming. [#9943](https://github.com/mapbox/mapbox-gl-js/pull/9943)
- Fix a bug where hash control conflicted with external history manipulation (e.g. in single-page apps). [#9960](https://github.com/mapbox/mapbox-gl-js/pull/9960) (h/t @raegen)
- Fix a bug where `fitBounds` had an unexpected result with non-zero bearing and uneven padding. [#9821](https://github.com/mapbox/mapbox-gl-js/pull/9821) (h/t @allison-strandberg)
- Fix HTTP support when running GL JS against [Mapbox Atlas](https://www.mapbox.com/atlas). [#10090](https://github.com/mapbox/mapbox-gl-js/pull/10090)
- Fix a bug where the `within` expression didn't work in `querySourceFeatures`. [#9933](https://github.com/mapbox/mapbox-gl-js/pull/9933)
- Fix a bug where `Popup` content HTML element was removed on `setDOMContent`. [#10036](https://github.com/mapbox/mapbox-gl-js/pull/10036)
- Fix a compatibility bug when `icon-image` is used as a legacy categorical function. [#10060](https://github.com/mapbox/mapbox-gl-js/pull/10060)
- Reduce rapid memory growth in Safari by ensuring `Image` dataURI's are released. [#10118](https://github.com/mapbox/mapbox-gl-js/pull/10118)

### ⚠️ Note on IE11

We intend to remove support for Internet Explorer 11 in a future release of GL JS later this year.

## 1.12.0

### ✨ Features and improvements

* Add methods for changing a vector tile source dynamically (e.g. `setTiles`, `setUrl`). [#8048](https://github.com/mapbox/mapbox-gl-js/pull/8048) (h/t [@stepankuzmin](https://github.com/stepankuzmin))
* Add a `filter` option for GeoJSON sources to filter out features prior to processing (e.g. before clustering). [#9864](https://github.com/mapbox/mapbox-gl-js/pull/9864)
* Vastly increase precision of `line-gradient` for long lines. [#9694](https://github.com/mapbox/mapbox-gl-js/pull/9694)
* Improve `raster-dem` sources to properly support the `maxzoom` option and overzooming. [#9789](https://github.com/mapbox/mapbox-gl-js/pull/9789) (h/t [@brendan-ward](@brendanhttps://github.com/ward))

### 🐞 Bug fixes

* Fix a bug where bearing snap interfered with `easeTo` and `flyTo` animations, freezing the map. [#9884](https://github.com/mapbox/mapbox-gl-js/pull/9884) (h/t [@andycalder](https://github.com/andycalder))
* Fix a bug where a fallback image was not used if it was added via `addImage`. [#9911](https://github.com/mapbox/mapbox-gl-js/pull/9911) (h/t [@francois2metz](https://github.com/francois2metz))
* Fix a bug where `promoteId` option failed for fill extrusions with defined feature ids. [#9863](https://github.com/mapbox/mapbox-gl-js/pull/9863)

### 🛠️ Workflow

* Renamed the default development branch from `master` to `main`.

## 1.11.1

### 🐞 Bug fixes
* Fix a bug that caused  `map.loaded()` to incorrectly return `false` after a click event. ([#9825](https://github.com/mapbox/mapbox-gl-js/pull/9825))

## 1.11.0

### ✨ Features and improvements
* Add an option to scale the default `Marker` icon.([#9414](https://github.com/mapbox/mapbox-gl-js/pull/9414)) (h/t [adrianababakanian](https://github.com/adrianababakanian))
* Improving the shader compilation speed by manually getting the run-time attributes and uniforms.([#9497](https://github.com/mapbox/mapbox-gl-js/pull/9497))
* Added `clusterMinPoints` option for clustered GeoJSON sources that defines the minimum number of points to form a cluster.([#9748](https://github.com/mapbox/mapbox-gl-js/pull/9748))

### 🐞 Bug fixes
* Fix a bug where map got stuck in a DragRotate interaction if it's mouseup occurred outside of the browser window or iframe.([#9512](https://github.com/mapbox/mapbox-gl-js/pull/9512))
* Fix potential visual regression for `*-pattern` properties on AMD graphics card vendor.([#9681](https://github.com/mapbox/mapbox-gl-js/pull/9681))
* Fix zooming with a double tap on iOS Safari 13.([#9757](https://github.com/mapbox/mapbox-gl-js/pull/9757))
* Removed a misleading `geometry exceeds allowed extent` warning when using Mapbox Streets vector tiles.([#9753](https://github.com/mapbox/mapbox-gl-js/pull/9753))
* Fix reference error when requiring the browser bundle in Node. ([#9749](https://github.com/mapbox/mapbox-gl-js/pull/9749))

## 1.10.2

### 🐞 Bug fixes
* Fix zooming with a double tap in iOS Safari 13.([#9757](https://github.com/mapbox/mapbox-gl-js/pull/9757))

## 1.10.1

### 🐞 Bug fixes
* Fix markers interrupting touch gestures ([#9675](https://github.com/mapbox/mapbox-gl-js/issues/9675), fixed by [#9683](https://github.com/mapbox/mapbox-gl-js/pull/9683))
* Fix bug where `map.isMoving()` returned true while map was not moving ([#9647](https://github.com/mapbox/mapbox-gl-js/issues/9647), fixed by [#9679](https://github.com/mapbox/mapbox-gl-js/pull/9679))
* Fix regression that prevented `touchmove` events from firing during gestures ([#9676](https://github.com/mapbox/mapbox-gl-js/issues/9676), fixed by [#9685](https://github.com/mapbox/mapbox-gl-js/pull/9685))
* Fix `image` expression evaluation which was broken under certain conditions ([#9630](https://github.com/mapbox/mapbox-gl-js/issues/9630), fixed by [#9685](https://github.com/mapbox/mapbox-gl-js/pull/9668))
* Fix nested `within` expressions in filters not evaluating correctly  ([#9605](https://github.com/mapbox/mapbox-gl-js/issues/9605), fixed by [#9611](https://github.com/mapbox/mapbox-gl-js/pull/9611))
* Fix potential `undefined` paint variable in `StyleLayer` ([#9688](https://github.com/mapbox/mapbox-gl-js/pull/9688)) (h/t [mannnick24](https://github.com/mannnick24))

## 1.10.0

### ✨ Features
* Add `mapboxgl.prewarm()` and `mapboxgl.clearPrewarmedResources()` methods to allow developers to optimize load times for their maps ([#9391](https://github.com/mapbox/mapbox-gl-js/pull/9391))
* Add `index-of` and `slice` expressions to search arrays and strings for the first occurrence of a specified value and return a section of the original array or string ([#9450](https://github.com/mapbox/mapbox-gl-js/pull/9450)) (h/t [lbutler](https://github.com/lbutler))
* Correctly set RTL text plugin status if the plugin URL could not be loaded. This allows developers to add retry logic on network errors when loading the plugin ([#9489](https://github.com/mapbox/mapbox-gl-js/pull/9489))

### 🍏 Gestures
This release significantly refactors and improves gesture handling on desktop and mobile. Three new touch gestures have been added: `two-finger swipe` to adjust pitch, `two-finger double tap` to zoom out, and `tap then drag` to adjust zoom with one finger ([#9365](https://github.com/mapbox/mapbox-gl-js/pull/9365)). In addition, this release brings the following changes and bug fixes:

- It's now possible to interact with multiple maps on the same page at the same time ([#9365](https://github.com/mapbox/mapbox-gl-js/pull/9365))
- Fix map jump when releasing one finger after pinch zoom ([#9136](https://github.com/mapbox/mapbox-gl-js/issues/9136))
- Stop mousedown and touchstart from interrupting `easeTo` animations when interaction handlers are disabled ([#8725](https://github.com/mapbox/mapbox-gl-js/issues/8725))
- Stop mouse wheel from interrupting animations when `map.scrollZoom` is disabled ([#9230](https://github.com/mapbox/mapbox-gl-js/issues/9230))
- A camera change can no longer be prevented by disabling the interaction handler within the camera change event. Selectively prevent camera changes by listening to the `mousedown` or `touchstart` map event and calling [.preventDefault()](https://docs.mapbox.com/mapbox-gl-js/api/#mapmouseevent#preventdefault) ([#9365](https://github.com/mapbox/mapbox-gl-js/pull/9365))
- Undocumented properties on the camera change events fired by the doubleClickZoom handler have been removed ([#9365](https://github.com/mapbox/mapbox-gl-js/pull/9365))

### 🐞 Improvements and bug fixes
* Line labels now have improved collision detection, with greater precision in placement, reduced memory footprint, better placement under pitched camera orientations ([#9219](https://github.com/mapbox/mapbox-gl-js/pull/9219))
* Fix `GlyphManager` continually re-requesting missing glyph ranges ([#8027](https://github.com/mapbox/mapbox-gl-js/issues/8027), fixed by [#9375](https://github.com/mapbox/mapbox-gl-js/pull/9375)) (h/t [oterral](https://github.com/oterral))
* Avoid throwing errors when calling certain popup methods before the popup element is created ([#9433](https://github.com/mapbox/mapbox-gl-js/pull/9433))
* Fix a bug where fill-extrusion features with colinear points were not returned by `map.queryRenderedFeatures(...)` ([#9454](https://github.com/mapbox/mapbox-gl-js/pull/9454))
* Fix a bug where using feature state on a large input could cause a stack overflow error ([#9463](https://github.com/mapbox/mapbox-gl-js/pull/9463))
* Fix exception when using `background-pattern` with data driven expressions ([#9518](https://github.com/mapbox/mapbox-gl-js/issues/9518), fixed by [#9520](https://github.com/mapbox/mapbox-gl-js/pull/9520))
* Fix a bug where UI popups were potentially leaking event listeners ([#9498](https://github.com/mapbox/mapbox-gl-js/pull/9498)) (h/t [mbell697](https://github.com/mbell697))
* Fix a bug where the `within` expression would return inconsistent values for points on tile boundaries ([#9411](https://github.com/mapbox/mapbox-gl-js/issues/9411), [#9428](https://github.com/mapbox/mapbox-gl-js/pull/9428))
* Fix a bug where the `within` expression would incorrectly evaluate geometries that cross the antimeridian ([#9440](https://github.com/mapbox/mapbox-gl-js/pull/9440))
* Fix possible undefined exception on paint variable of style layer ([#9437](https://github.com/mapbox/mapbox-gl-js/pull/9437)) (h/t [mannnick24](https://github.com/mannnick24))
* Upgrade minimist to ^1.2.5 to get fix for security issue [CVE-2020-7598](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2020-7598) upstream ([#9425](https://github.com/mapbox/mapbox-gl-js/issues/9431), fixed by [#9425](https://github.com/mapbox/mapbox-gl-js/pull/9425)) (h/t [watson](https://github.com/watson))

## 1.9.1

### 🐞 Bug fixes
* Fix a bug [#9477](https://github.com/mapbox/mapbox-gl-js/issues/9477) in `Map#fitBounds(..)` wherein the `padding` passed to options would get applied twice.
* Fix rendering bug [#9479](https://github.com/mapbox/mapbox-gl-js/issues/9479) caused when data-driven `*-pattern` properties reference images added with `Map#addImage(..)`.
* Fix a bug [#9468](https://github.com/mapbox/mapbox-gl-js/issues/9468) in which an exception would get thrown when updating symbol layer paint property using `setPaintProperty`.

## 1.9.0
With this release, we're adding [a new changelog policy](./CONTRIBUTING.md#changelog-conventions) to our contribution guidelines.

This release also fixes several long-standing bugs and unintentional rendering behavior with `line-pattern`. The fixes come with a visual change to how patterns added with `line-pattern` scale. Previously, patterns that became larger than the line would be clipped, sometimes distorting the pattern, particularly on mobile and retina devices. Now the pattern will be scaled to fit under all circumstances. [#9266](https://github.com/mapbox/mapbox-gl-js/pull/9266) showcases examples of the visual differences. For more information and to provide feedback on this change, see [#9394](https://github.com/mapbox/mapbox-gl-js/pull/9394).

### ✨ Features
* Add `within` expression for testing whether an evaluated feature lies within a given GeoJSON object ([#9352](https://github.com/mapbox/mapbox-gl-js/pull/9352)).
    - We are aware of an edge case in which points with wrapped coordinates (e.g. longitude -185) are not evaluated properly. See ([#9442](https://github.com/mapbox/mapbox-gl-js/issues/9442)) for more information.
    - An example of the `within` expression:<br>
`"icon-opacity": ["case", ["==", ["within", "some-polygon"], true], 1,
["==", ["within", "some-polygon"], false], 0]`
* Map API functions such as `easeTo` and `flyTo` now support `padding: PaddingOptions` which lets developers shift a map's center of perspective when building floating sidebars ([#8638](https://github.com/mapbox/mapbox-gl-js/pull/8638))

### 🍏 Improvements
* Results from `queryRenderedFeatures` now have evaluated property values rather than raw expressions ([#9198](https://github.com/mapbox/mapbox-gl-js/pull/9198))
* Improve scaling of patterns used in `line-pattern` on all device resolutions and pixel ratios ([#9266](https://github.com/mapbox/mapbox-gl-js/pull/9266))
* Slightly improve GPU memory footprint ([#9377](https://github.com/mapbox/mapbox-gl-js/pull/9377))
* `LngLatBounds.extend` is more flexible because it now accepts objects with `lat` and `lon` properties as well as arrays of coordinates ([#9293](https://github.com/mapbox/mapbox-gl-js/pull/9293))
* Reduce bundle size and improve visual quality of `showTileBoundaries` debug text ([#9267](https://github.com/mapbox/mapbox-gl-js/pull/9267))

### 🐞 Bug fixes
* Correctly adjust patterns added with `addImage(id, image, pixelRatio)` by the asset pixel ratio, not the device pixel ratio ([#9372](https://github.com/mapbox/mapbox-gl-js/pull/9372))
* Allow needle argument to `in` expression to be false ([#9295](https://github.com/mapbox/mapbox-gl-js/pull/9295))
* Fix exception thrown when trying to set `feature-state` for a layer that has been removed, fixes [#8634](https://github.com/mapbox/mapbox-gl-js/issues/8634) ([#9305](https://github.com/mapbox/mapbox-gl-js/pull/9305))
* Fix a bug where maps were not displaying inside elements with `dir=rtl` ([#9332](https://github.com/mapbox/mapbox-gl-js/pull/9332))
* Fix a rendering error for very old versions of Chrome (ca. 2016) where text would appear much bigger than intended ([#9349](https://github.com/mapbox/mapbox-gl-js/pull/9349))
* Prevent exception resulting from `line-dash-array` of empty length ([#9385](https://github.com/mapbox/mapbox-gl-js/pull/9385))
* Fix a bug where `icon-image` expression that evaluates to an empty string (`''`) produced a warning ([#9380](https://github.com/mapbox/mapbox-gl-js/pull/9380))
* Fix a bug where certain `popup` methods threw errors when accessing the container element before it was created, fixes [#9429](https://github.com/mapbox/mapbox-gl-js/issues/9429)([#9433](https://github.com/mapbox/mapbox-gl-js/pull/9433))

## 1.8.1

* Fixed a bug where all labels showed up on a diagonal line on Windows when using an integrated Intel GPU from the Haswell generation ([#9327](https://github.com/mapbox/mapbox-gl-js/issues/9327), fixed by reverting [#9229](https://github.com/mapbox/mapbox-gl-js/pull/9229))

## 1.8.0

### ✨ Features and improvements
* Reduce size of line atlas by removing unused channels ([#9232](https://github.com/mapbox/mapbox-gl-js/pull/9232))
* Prevent empty buffers from being created for debug data when unused ([#9237](https://github.com/mapbox/mapbox-gl-js/pull/9237))
* Add space between distance and unit in scale control ([#9276](https://github.com/mapbox/mapbox-gl-js/pull/9276)) (h/t [gely](https://api.github.com/users/gely)) and ([#9284](https://github.com/mapbox/mapbox-gl-js/pull/9284)) (h/t [pakastin](https://api.github.com/users/pakastin))
* Add a `showAccuracyCircle` option to GeolocateControl that shows the accuracy of the user's location as a transparent circle. Mapbox GL JS will show this circle by default. ([#9253](https://github.com/mapbox/mapbox-gl-js/pull/9253)) (h/t [Meekohi](https://api.github.com/users/Meekohi))
* Implemented a new tile coverage algorithm to enable level-of-detail support in a future release ([#8975](https://github.com/mapbox/mapbox-gl-js/pull/8975))

### 🐞 Bug fixes
* `line-dasharray` is now ignored correctly when `line-pattern` is set ([#9189](https://github.com/mapbox/mapbox-gl-js/pull/9189))
* Fix line distances breaking gradient across tile boundaries ([#9220](https://github.com/mapbox/mapbox-gl-js/pull/9220))
* Fix a bug where lines with duplicate endpoints could disappear at zoom 18+ ([#9218](https://github.com/mapbox/mapbox-gl-js/pull/9218))
* Fix a bug where Ctrl-click to drag rotate the map was disabled if the Alt, Cmd or Windows key is also pressed ([#9203](https://github.com/mapbox/mapbox-gl-js/pull/9203))
* Pass errors to `getClusterExpansionZoom`, `getClusterChildren`, and `getClusterLeaves` callbacks ([#9251](https://github.com/mapbox/mapbox-gl-js/pull/9251))
* Fix a rendering performance regression ([#9261](https://github.com/mapbox/mapbox-gl-js/pull/9261))
* Fix visual artifact for `line-dasharray` ([#9246](https://github.com/mapbox/mapbox-gl-js/pull/9246))
* Fixed a bug in the GeolocateControl which resulted in an error when `trackUserLocation` was `false` and the control was removed before the Geolocation API had returned a location ([#9291](https://github.com/mapbox/mapbox-gl-js/pull/9291))
* Fix `promoteId` for line layers ([#9210](https://github.com/mapbox/mapbox-gl-js/pull/9210))
* Improve accuracy of distance calculations ([#9202](https://github.com/mapbox/mapbox-gl-js/pull/9202)) (h/t [Meekohi](https://api.github.com/users/Meekohi))


## 1.7.0

### ✨ Features
* Add `promoteId` option to use a feature property as ID for feature state ([#8987](https://github.com/mapbox/mapbox-gl-js/pull/8987))
* Add a new constructor option to `mapboxgl.Popup`, `closeOnMove`, that closes the popup when the map's position changes ([#9163](https://github.com/mapbox/mapbox-gl-js/pull/9163))
* Allow creating a map without a style (an empty one will be created automatically) ( h/t @stepankuzmin ) ([#8924](https://github.com/mapbox/mapbox-gl-js/pull/8924))
* `map.once()` now allows specifying a layer id as a third parameter making it consistent with `map.on()` ([#8875](https://github.com/mapbox/mapbox-gl-js/pull/8875))

### 🍏 Improvements
* Improve performance of raster layers on large screens ([#9050](https://github.com/mapbox/mapbox-gl-js/pull/9050))
* Improve performance for hillshade and raster layers by implementing a progressive enhancement that utilizes `ImageBitmap` and `OffscreenCanvas` ([#8845](https://github.com/mapbox/mapbox-gl-js/pull/8845))
* Improve performance for raster tile rendering by using the stencil buffer ([#9012](https://github.com/mapbox/mapbox-gl-js/pull/9012))
* Update `symbol-avoid-edges` documentation to acknowledge the existence of global collision detection ([#9157](https://github.com/mapbox/mapbox-gl-js/pull/9157))
* Remove reference to `in` function which has been replaced by the `in` expression ([#9102](https://github.com/mapbox/mapbox-gl-js/pull/9102))

### 🐞 Bug Fixes
* Change the type of tile id key to string to prevent hash collisions ([#8979](https://github.com/mapbox/mapbox-gl-js/pull/8979))
* Prevent changing bearing via URL hash when rotation is disabled ([#9156](https://github.com/mapbox/mapbox-gl-js/pull/9156))
* Fix URL hash with no bearing causing map to fail to load ([#9170](https://github.com/mapbox/mapbox-gl-js/pull/9170))
* Fix bug in `GeolocateControl` where multiple instances of the control on one page may result in the user location not being updated ([#9092](https://github.com/mapbox/mapbox-gl-js/pull/9092))
* Fix query `fill-extrusions` made from polygons with coincident points and polygons with less than four points ([#9138](https://github.com/mapbox/mapbox-gl-js/pull/9138))
* Fix bug where `symbol-sort-key` was not used for collisions that crossed tile boundaries ([#9054](https://github.com/mapbox/mapbox-gl-js/pull/9054))
* Fix bug in `DragRotateHandler._onMouseUp` getting stuck in drag/rotate ([#9137](https://github.com/mapbox/mapbox-gl-js/pull/9137))
* Fix "Click on Compass" on some mobile devices (add `clickTolerance` to `DragRotateHandler`) ([#9015](https://github.com/mapbox/mapbox-gl-js/pull/9015)) (h/t [Yanonix](https://github.com/Yanonix))

## 1.6.1

### 🐞 Bug Fixes
* Fix style validation error messages not being displayed ([#9073](https://github.com/mapbox/mapbox-gl-js/pull/9073))
* Fix deferred loading of rtl-text-plugin not working for labels created from GeoJSON sources ([#9091](https://github.com/mapbox/mapbox-gl-js/pull/9091))
* Fix RTL text not being rendered with the rtl-text-plugin on pages that don't allow `script-src: blob:` in their CSP.([#9122](https://github.com/mapbox/mapbox-gl-js/pull/9122))

## 1.6.0

### ✨ Features
* Add ability to insert images into text labels using an `image` expression within a `format` expression: `"text-field": ["format", "Some text", ["image", "my-image"], "some more text"]` ([#8904](https://github.com/mapbox/mapbox-gl-js/pull/8904))
* Add support for stretchable images (aka nine-part or nine-patch images). Stretchable images can be used with `icon-text-fit` to draw resized images with unstretched corners and borders. ([#8997](https://github.com/mapbox/mapbox-gl-js/pull/8997))
* Add `in` expression. It can check if a value is in an array (`["in", value, array]`) or a substring is in a string (`["in", substring, string]`) ([#8876](https://github.com/mapbox/mapbox-gl-js/pull/8876))
* Add `minPitch` and `maxPitch` map options ([#8834](https://github.com/mapbox/mapbox-gl-js/pull/8834))
* Add `rotation`, `rotationAlignment` and `pitchAlignment` options to markers ([#8836](https://github.com/mapbox/mapbox-gl-js/pull/8836)) (h/t [dburnsii](https://github.com/dburnsii))
* Add methods to Popup to manipulate container class names ([#8759](https://github.com/mapbox/mapbox-gl-js/pull/8759)) (h/t [Ashot-KR](https://github.com/Ashot-KR))
* Add configurable inertia settings for panning (h/t @aMoniker) ([#8887](https://github.com/mapbox/mapbox-gl-js/pull/8887))
* Add ability to localize UI controls ([#8095](https://github.com/mapbox/mapbox-gl-js/pull/8095)) (h/t [dmytro-gokun](https://github.com/dmytro-gokun))
* Add LatLngBounds.contains() method ([#7512](https://github.com/mapbox/mapbox-gl-js/issues/7512), fixed by [#8200](https://github.com/mapbox/mapbox-gl-js/pull/8200))
* Add option to load rtl-text-plugin lazily ([#8865](https://github.com/mapbox/mapbox-gl-js/pull/8865))
* Add `essential` parameter to AnimationOptions that can override `prefers-reduced-motion: reduce` ([#8743](https://github.com/mapbox/mapbox-gl-js/issues/8743), fixed by [#8883](https://github.com/mapbox/mapbox-gl-js/pull/8883))

### 🍏 Improvements
* Allow rendering full world smaller than 512px. To restore the previous limit call `map.setMinZoom(0)` ([#9028](https://github.com/mapbox/mapbox-gl-js/pull/9028))
* Add an es modules build for mapbox-gl-style-spec in dist/ ([#8247](https://github.com/mapbox/mapbox-gl-js/pull/8247)) (h/t [ahocevar](https://github.com/ahocevar))
* Add 'image/webp,*/*' accept header to fetch/ajax image requests when webp supported ([#8262](https://github.com/mapbox/mapbox-gl-js/pull/8262))
* Improve documentation for setStyle, getStyle, and isStyleLoaded ([#8807](https://github.com/mapbox/mapbox-gl-js/pull/8807))

### 🐞 Bug Fixes
* Fix map rendering after addImage and removeImage are used to change a used image ([#9016](https://github.com/mapbox/mapbox-gl-js/pull/9016))
* Fix visibility of controls in High Contrast mode in IE ([#8874](https://github.com/mapbox/mapbox-gl-js/pull/8874))
* Fix customizable url hash string in IE 11 ([#8990](https://github.com/mapbox/mapbox-gl-js/pull/8990)) (h/t [pakastin](https://github.com/pakastin))
* Allow expression stops up to zoom 24 instead of 22 ([#8908](https://github.com/mapbox/mapbox-gl-js/pull/8908)) (h/t [nicholas-l](https://github.com/nicholas-l))
* Fix alignment of lines in really overscaled tiles ([#9024](https://github.com/mapbox/mapbox-gl-js/pull/9024))
* Fix `Failed to execute 'shaderSource' on 'WebGLRenderingContext'` errors ([#9017](https://github.com/mapbox/mapbox-gl-js/pull/9017))
* Make expression validation fail on NaN ([#8615](https://github.com/mapbox/mapbox-gl-js/pull/8615))
* Fix setLayerZoomRange bug that caused tiles to be re-requested ([#7865](https://github.com/mapbox/mapbox-gl-js/issues/7865), fixed by [#8854](https://github.com/mapbox/mapbox-gl-js/pull/8854))
* Fix `map.showTileBoundaries` rendering ([#7314](https://github.com/mapbox/mapbox-gl-js/pull/7314))
* Fix using `generateId` in conjunction with `cluster` in a GeoJSONSource ([#8223](https://github.com/mapbox/mapbox-gl-js/issues/8223), fixed by [#8945](https://github.com/mapbox/mapbox-gl-js/pull/8945))
* Fix opening popup on a marker from keyboard ([#6835](https://github.com/mapbox/mapbox-gl-js/pull/6835))
* Fix error thrown when request aborted ([#7614](https://github.com/mapbox/mapbox-gl-js/issues/7614), fixed by [#9021](https://github.com/mapbox/mapbox-gl-js/pull/9021))
* Fix attribution control when repeatedly removing and adding it ([#9052](https://github.com/mapbox/mapbox-gl-js/pull/9052))

## 1.5.1
This patch introduces two workarounds that address longstanding issues related to unbounded memory growth in Safari, including [#8771](https://github.com/mapbox/mapbox-gl-js/issues/8771) and [#4695](https://github.com/mapbox/mapbox-gl-js/issues/4695). We’ve identified two memory leaks in Safari: one in the [CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) API, addressed by [#8956](https://github.com/mapbox/mapbox-gl-js/pull/8956), and one in transferring data between web workers through [Transferables](https://developer.mozilla.org/en-US/docs/Web/API/Transferable), addressed by [#9003](https://github.com/mapbox/mapbox-gl-js/pull/9003).

### 🍏 Improvements
* Implement workaround for memory leak in Safari when using the `CacheStorage` API. ( [#8856](https://github.com/mapbox/mapbox-gl-js/pull/8956))
* Implement workaround for memory leak in Safari when using `Transferable` objects to transfer `ArrayBuffers` to WebWorkers. If GL-JS detetcts that it is running in Safari, the use of `Transferables` to transfer data to WebWorkers is disabled. ( [#9003](https://github.com/mapbox/mapbox-gl-js/pull/9003))
* Improve animation performance when using `map.setData`. ([#8913](https://github.com/mapbox/mapbox-gl-js/pull/8913)) (h/t [msbarry](https://github.com/msbarry))

## 1.5.0

### ✨ Features
* Add disabled icon to GeolocateControl if user denies geolocation permission. [#8871](https://github.com/mapbox/mapbox-gl-js/pull/8871))
* Add `outofmaxbounds` event to GeolocateControl, which is emitted when the user is outside of `map.maxBounds` ([#8756](https://github.com/mapbox/mapbox-gl-js/pull/8756)) (h/t [MoradiDavijani](https://github.com/MoradiDavijani))
* Add `mapboxgl.getRTLTextPluginStatus()` to query the current status of the `rtl-text-plugin` to make it easier to allow clearing the plugin when necessary. (ref. [#7869](https://github.com/mapbox/mapbox-gl-js/issues/7869)) ([#8864](https://github.com/mapbox/mapbox-gl-js/pull/8864))
* Allow `hash` Map option to be set as a string, which sets the map hash in the url to a custom query parameter. ([#8603](https://github.com/mapbox/mapbox-gl-js/pull/8603)) (h/t [SebCorbin](https://github.com/SebCorbin))

### 🍏 Improvements
* Fade symbols faster when zooming out quickly, reducing overlap. ([#8628](https://github.com/mapbox/mapbox-gl-js/pull/8628))
* Reduce memory usage for vector tiles that contain long strings in feature properties. ( [#8863](https://github.com/mapbox/mapbox-gl-js/pull/8863))

### 🐞 Bug Fixes
* Fix `text-variable-anchor` not trying multiple placements during collision with icons when `icon-text-fit` is enabled. ([#8803](https://github.com/mapbox/mapbox-gl-js/pull/8803))
* Fix `icon-text-fit` not properly respecting vertical labels. ([#8835](https://github.com/mapbox/mapbox-gl-js/pull/8835))
* Fix opacity interpolation for composition expressions. ([#8818](https://github.com/mapbox/mapbox-gl-js/pull/8818))
* Fix rotate and pitch events being fired at the same time. ([#8872](https://github.com/mapbox/mapbox-gl-js/pull/8872))
* Fix memory leaks that occured during tile loading and map removal.([#8813](https://github.com/mapbox/mapbox-gl-js/pull/8813) and [#8850](https://github.com/mapbox/mapbox-gl-js/pull/8850))
* Fix web-worker transfer of `ArrayBuffers` in environments where `instanceof ArrayBuffer` fails.(e.g `cypress`) ([#8868](https://github.com/mapbox/mapbox-gl-js/pull/8868))

## 1.4.1

### 🐞 Bug Fixes
* Fix the way that `coalesce` handles the `image` operator so available images are rendered properly ([#8839](https://github.com/mapbox/mapbox-gl-js/pull/8839))
* Do not emit the `styleimagemissing` event for an empty string value ([#8840](https://github.com/mapbox/mapbox-gl-js/pull/8840))
* Fix serialization of `ResolvedImage` type so `*-pattern` properties work properly ([#8833](https://github.com/mapbox/mapbox-gl-js/pull/8833))

## 1.4.0

### ✨ Features
* Add `image` expression operator to determine image availability ([#8684](https://github.com/mapbox/mapbox-gl-js/pull/8684))
* Enable `text-offset` with variable label placement ([#8642](https://github.com/mapbox/mapbox-gl-js/pull/8642))

### 🍏 Improvements
* Faster loading and better look of raster terrain ([#8694](https://github.com/mapbox/mapbox-gl-js/pull/8694))
* Improved code documentation around resizing and {get/set}RenderedWorldCopies and more ([#8748](https://github.com/mapbox/mapbox-gl-js/pull/8748), [#8754](https://github.com/mapbox/mapbox-gl-js/pull/8754))
* Improve single vs. multi-touch zoom & pan interaction (#7196) ([#8100](https://github.com/mapbox/mapbox-gl-js/pull/8100))

### 🐞 Bug fixes
* Fix rendering of `collisionBox` when `text-translate` or `icon-translate` is enabled  ([#8659](https://github.com/mapbox/mapbox-gl-js/pull/8659))
* Fix `TypeError` when reloading a source and immediately removing the map ([#8711](https://github.com/mapbox/mapbox-gl-js/pull/8711))
* Adding tooltip to the geolocation control button ([#8735](https://github.com/mapbox/mapbox-gl-js/pull/8735)) (h/t [BAByrne](https://github.com/BAByrne))
* Add `originalEvent` property to NavigationControl events ([#8693](https://github.com/mapbox/mapbox-gl-js/pull/8693)) (h/t [stepankuzmin](https://github.com/stepankuzmin))
* Don't cancel follow mode in the GeolocateControl when resizing the map or rotating the screen ([#8736](https://github.com/mapbox/mapbox-gl-js/pull/8736))
* Fix error when calling `Popup#trackPointer` before setting its content or location ([#8757](https://github.com/mapbox/mapbox-gl-js/pull/8757)) (h/t [zxwandrew](https://github.com/zxwandrew))
* Respect newline characters when text-max-width is set to zero ([#8706](https://github.com/mapbox/mapbox-gl-js/pull/8706))
* Update earcut to v2.2.0 to fix polygon tesselation errors ([#8772](https://github.com/mapbox/mapbox-gl-js/pull/8772))
* Fix icon-fit with variable label placement ([#8755](https://github.com/mapbox/mapbox-gl-js/pull/8755))
* Icons stretched with `icon-text-fit` are now sized correctly ([#8741](https://github.com/mapbox/mapbox-gl-js/pull/8741))
* Collision detection for icons with `icon-text-fit` now works correctly ([#8741](https://github.com/mapbox/mapbox-gl-js/pull/8741))

## 1.3.2

- Fix a SecurityError in Firefox >= 69 when accessing the cache [#8780](https://github.com/mapbox/mapbox-gl-js/pull/8780)

## 1.3.1

### 🐞 Bug Fixes

- Fix a race condition that produced an error when a map was removed while reloading a source. [#8711](https://github.com/mapbox/mapbox-gl-js/pull/8711)
- Fix a race condition were `render` event was sometimes not fired after `load` event in IE11. [#8708](https://github.com/mapbox/mapbox-gl-js/pull/8708)

## 1.3.0

### 🍏 Features

- Introduce `text-writing-mode` symbol layer property to allow placing point labels vertically. [#8399](https://github.com/mapbox/mapbox-gl-js/pull/8399)
- Extend variable text placement to work when `text/icon-allow-overlap` is set to `true`. [#8620](https://github.com/mapbox/mapbox-gl-js/pull/8620)
- Allow `text-color` to be used in formatted expressions to be able to draw different parts of a label in different colors. [#8068](https://github.com/mapbox/mapbox-gl-js/pull/8068)

### ✨ Improvements

- Improve tile loading logic to cancel requests more aggressively, improving performance when zooming or panning quickly. [#8633](https://github.com/mapbox/mapbox-gl-js/pull/8633)
- Display outline on control buttons when focused (e.g. with a tab key) for better accessibility. [#8520](https://github.com/mapbox/mapbox-gl-js/pull/8520)
- Improve the shape of line round joins. [#8275](https://github.com/mapbox/mapbox-gl-js/pull/8275)
- Improve performance of processing line layers. [#8303](https://github.com/mapbox/mapbox-gl-js/pull/8303)
- Improve legibility of info displayed with `map.showTileBoundaries =  true`. [#8380](https://github.com/mapbox/mapbox-gl-js/pull/8380) (h/t [@andrewharvey](https://github.com/andrewharvey))
- Add `MercatorCoordinate.meterInMercatorCoordinateUnits` method to make it easier to convert from meter units to coordinate values used in custom layers. [#8524](https://github.com/mapbox/mapbox-gl-js/pull/8524) (h/t [@andrewharvey](https://github.com/andrewharvey))
- Improve conversion of legacy filters with duplicate values. [#8542](https://github.com/mapbox/mapbox-gl-js/pull/8542)
- Move out documentation & examples website source to a separate `mapbox-gl-js-docs` repo. [#8582](https://github.com/mapbox/mapbox-gl-js/pull/8582)

### 🐞 Bug Fixes

- Fix a bug where local CJK fonts would switch to server-generated ones in overzoomed tiles. [#8657](https://github.com/mapbox/mapbox-gl-js/pull/8657)
- Fix precision issues in [deck.gl](https://deck.gl)-powered custom layers. [#8502](https://github.com/mapbox/mapbox-gl-js/pull/8502)
- Fix a bug where fill and line layers wouldn't render correctly over fill extrusions when coming from the same source. [#8661](https://github.com/mapbox/mapbox-gl-js/pull/8661)
- Fix map loading for documents loaded from Blob URLs. [#8612](https://github.com/mapbox/mapbox-gl-js/pull/8612)
- Fix classification of relative file:// URLs when in documents loaded from a file URL. [#8612](https://github.com/mapbox/mapbox-gl-js/pull/8612)
- Remove `esm` from package `dependencies` (so that it's not installed on `npm install mapbox-gl`). [#8586](https://github.com/mapbox/mapbox-gl-js/pull/8586) (h/t [@DatGreekChick](https://github.com/DatGreekChick))

## 1.2.1

### 🐞 Bug fixes

* Fix bug in `NavigationControl` compass button that prevented it from rotating with the map ([#8605](https://github.com/mapbox/mapbox-gl-js/pull/8605))

## 1.2.0

### Features and improvements
* Add `*-sort-key` layout property for circle, fill, and line layers, to dictate which features appear above others within a single layer([#8467](https://github.com/mapbox/mapbox-gl-js/pull/8467))
* Add ability to instantiate maps with specific access tokens ([#8364](https://github.com/mapbox/mapbox-gl-js/pull/8364))
* Accommodate `prefers-reduced-motion` settings in browser ([#8494](https://github.com/mapbox/mapbox-gl-js/pull/8494))
* Add Map `visualizePitch` option that tilts the compass as the map pitches ([#8208](https://github.com/mapbox/mapbox-gl-js/issues/8208), fixed by [#8296](https://github.com/mapbox/mapbox-gl-js/pull/8296)) (h/t [pakastin](https://github.com/pakastin))
* Make source options take precedence over TileJSON ([#8232](https://github.com/mapbox/mapbox-gl-js/pull/8232)) (h/t [jingsam](https://github.com/jingsam))
* Make requirements for text offset properties more precise ([#8418](https://github.com/mapbox/mapbox-gl-js/pull/8418))
* Expose `convertFilter` API in the style specification ([#8493](https://github.com/mapbox/mapbox-gl-js/pull/8493)

### Bug fixes
* Fix changes to `text-variable-anchor`, such that previous anchor positions would take precedence only if they are present in the updated array (considered a bug fix, but is technically a breaking change from previous behavior) ([#8473](https://github.com/mapbox/mapbox-gl-js/pull/8473))
* Fix rendering of opaque pass layers over heatmap and fill-extrusion layers ([#8440](https://github.com/mapbox/mapbox-gl-js/pull/8440))
* Fix rendering of extraneous vertical line in vector tiles ([#8477](https://github.com/mapbox/mapbox-gl-js/issues/8477), fixed by [#8479](https://github.com/mapbox/mapbox-gl-js/pull/8479))
* Turn off 'move' event listeners when removing a marker ([#8465](https://github.com/mapbox/mapbox-gl-js/pull/8465))
* Fix class toggling on navigation control for IE ([#8495](https://github.com/mapbox/mapbox-gl-js/pull/8495)) (h/t [cs09g](https://github.com/cs09g))
* Fix background rotation hovering on geolocate control ([#8367](https://github.com/mapbox/mapbox-gl-js/pull/8367)) (h/t [GuillaumeGomez](https://github.com/GuillaumeGomez))
* Fix error in click events on markers where `startPos` is not defined ([#8462](https://github.com/mapbox/mapbox-gl-js/pull/8462)) (h/t [@msbarry](https://github.com/msbarry))
* Fix malformed urls when using custom `baseAPIURL` of a certain form ([#8466](https://github.com/mapbox/mapbox-gl-js/pull/8466))

## 1.1.1

### 🐞 Bug fixes

* Fix unbounded memory growth caused by failure to cancel requests to the cache ([#8472](https://github.com/mapbox/mapbox-gl-js/pull/8472))
* Fix unbounded memory growth caused by failure to cancel requests in IE ([#8481](https://github.com/mapbox/mapbox-gl-js/issues/8481))
* Fix performance of getting tiles from the cache ([#8489](https://github.com/mapbox/mapbox-gl-js/pull/8449))

## 1.1.0

### ✨ Minor features and improvements
* Improve line rendering performance by using a more compact line attributes layout ([#8306](https://github.com/mapbox/mapbox-gl-js/pull/8306))
* Improve data-driven symbol layers rendering performance ([#8295](https://github.com/mapbox/mapbox-gl-js/pull/8295))
* Add the ability to disable validation during `queryRenderedFeatures` and `querySourceFeatures` calls, as a performance optimization ([#8211](https://github.com/mapbox/mapbox-gl-js/pull/8211)) (h/t [gorshkov-leonid](https://github.com/gorshkov-leonid))
* Improve `setFilter` performance by caching keys in `groupByLayout` routine ([#8122](https://github.com/mapbox/mapbox-gl-js/pull/8122)) (h/t [vallendm](https://github.com/vallendm))
* Improve rendering of symbol layers with `symbol-z-order: viewport-y`, when icons are allowed to overlap but not text  ([#8180](https://github.com/mapbox/mapbox-gl-js/pull/8180))
* Prefer breaking lines at a zero width space to allow better break point suggestions for Japanese labels ([#8255](https://github.com/mapbox/mapbox-gl-js/pull/8255))
* Add a `WebGLRenderingContext` argument to `onRemove` function of `CustomLayerInterface`, to allow direct cleanup of related context ([#8156](https://github.com/mapbox/mapbox-gl-js/pull/8156)) (h/t [ogiermaitre](https://github.com/ogiermaitre))
* Allow zoom speed customization by adding `setZoomRate` and `setWheelZoomRate` methods to `ScrollZoomHandler` ([#7863](https://github.com/mapbox/mapbox-gl-js/pull/7863)) (h/t [sf31](https://github.com/sf31))
* Add `trackPointer` method to `Popup` API that continuously repositions the popup to the mouse cursor when the cursor is within the map ([#7786](https://github.com/mapbox/mapbox-gl-js/pull/7786))
* Add `getElement` method to `Popup` to retrieve the popup's HTML element ([#8123](https://github.com/mapbox/mapbox-gl-js/pull/8123)) (h/t [bravecow](https://github.com/bravecow))
* Add `fill-pattern` example to the documentation ([#8022](https://github.com/mapbox/mapbox-gl-js/pull/8022)) (h/t [flawyte](https://github.com/flawyte))
* Update script detection for Unicode 12.1 ([#8158](https://github.com/mapbox/mapbox-gl-js/pull/8158))
* Add `nofollow` to Mapbox logo & "Improve this map" links ([#8106](https://github.com/mapbox/mapbox-gl-js/pull/8106)) (h/t [viniciuskneves](https://github.com/viniciuskneves))
* Include source name in invalid GeoJSON error ([#8113](https://github.com/mapbox/mapbox-gl-js/pull/8113)) (h/t [Zirak](https://github.com/Zirak))

### 🐞 Bug fixes
* Fix `updateImage` not working as expected in Chrome ([#8199](https://github.com/mapbox/mapbox-gl-js/pull/8199))
* Fix issues with double-tap zoom on touch devices ([#8086](https://github.com/mapbox/mapbox-gl-js/pull/8086))
* Fix duplication of `movestart` events when zooming ([#8259](https://github.com/mapbox/mapbox-gl-js/pull/8259)) (h/t [bambielli-flex](https://github.com/bambielli-flex))
* Fix validation of ``"format"`` expression failing when options are provided ([#8339](https://github.com/mapbox/mapbox-gl-js/pull/8339))
* Fix `setPaintProperty` not working on `line-pattern` property ([#8289](https://github.com/mapbox/mapbox-gl-js/pull/8289))
* Fix the GL context being left in unpredictable states when using custom layers ([#8132](https://github.com/mapbox/mapbox-gl-js/pull/8132))
* Fix unnecessary updates to attribution control string ([#8082](https://github.com/mapbox/mapbox-gl-js/pull/8082)) (h/t [poletani](https://github.com/poletani))
* Fix bugs in `findStopLessThanOrEqualTo` algorithm ([#8134](https://github.com/mapbox/mapbox-gl-js/pull/8134)) (h/t [Mike96Angelo](https://github.com/Mike96Angelo))
* Fix map not displaying properly when inside an element with `text-align: center` ([#8227](https://github.com/mapbox/mapbox-gl-js/pull/8227)) (h/t [mc100s](https://github.com/mc100s))
* Clarify in documentation that `Popup#maxWidth` accepts all `max-width` CSS values ([#8312](https://github.com/mapbox/mapbox-gl-js/pull/8312)) (h/t [viniciuskneves](https://github.com/viniciuskneves))
* Fix location dot shadow not displaying ([#8119](https://github.com/mapbox/mapbox-gl-js/pull/8119)) (h/t [bravecow](https://github.com/bravecow))
* Fix docs dev dependencies being mistakenly installed as package dependencies ([#8121](https://github.com/mapbox/mapbox-gl-js/pull/8121)) (h/t [bravecow](https://github.com/bravecow))
* Various typo fixes ([#8230](https://github.com/mapbox/mapbox-gl-js/pull/8230), h/t [erictheise](https://github.com/erictheise)) ([#8236](https://github.com/mapbox/mapbox-gl-js/pull/8236), h/t [fredj](https://github.com/fredj))
* Fix geolocate button CSS ([#8367](https://github.com/mapbox/mapbox-gl-js/pull/8367), h/t [GuillaumeGomez](https://github.com/GuillaumeGomez))
* Fix caching for Mapbox tiles ([#8389](https://github.com/mapbox/mapbox-gl-js/pull/8389))

## 1.0.0

### ⚠️ Breaking changes

This release replaces the existing “map views” pricing model in favor of a “map load” model. Learn more in [a recent blog post about these changes](https://blog.mapbox.com/new-pricing-46b7c26166e7).

**By upgrading to this release, you are opting in to the new map loads pricing.**

**Why is this change being made?**

This change allows us to implement a more standardized and predictable method of billing GL JS map usage. You’ll be charged whenever your website or web application loads, not by when users pan and zoom around the map, incentivizing developers to create highly interactive map experiences. The new pricing structure also creates a significantly larger free tier to help developers get started building their applications with Mapbox tools while pay-as-you-go pricing and automatic volume discounts help your application scale with Mapbox. Session billing also aligns invoices with metrics web developers already track and makes it easier to compare usage with other mapping providers.

**What is changing?**
- Add SKU token to Mapbox API requests [#8276](https://github.com/mapbox/mapbox-gl-js/pull/8276)

When (and only when) loading tiles from a Mapbox API with a Mapbox access token set (`mapboxgl.accessToken`), a query parameter named `sku` will be added to all requests for vector, raster and raster-dem tiles. Every map instance uses a unique `sku` value, which is refreshed every 12 hours. The token itself is comprised of a token version (always “1”), a sku ID (always “01”) and a random 10-digit base-62 number. The purpose of the token is to allow for metering of map sessions on the server-side. A session lasts from a new map instantiation until the map is destroyed or 12 hours passes, whichever comes first.

For further information on the pricing changes, you can read our [blog post](https://blog.mapbox.com/new-pricing-46b7c26166e7) and check out our new [pricing page](https://www.mapbox.com/pricing), which has a price calculator. As always, you can also contact our team at [https://support.mapbox.com](https://support.mapbox.com).

## 0.54.1

### Bug fixes

- Fix unbounded memory growth caused by failure to cancel requests in IE ([#8481](https://github.com/mapbox/mapbox-gl-js/issues/8481))

## 0.54.0

### Breaking changes

- Turned `localIdeographFontFamily` map option on by default. This may change how CJK labels are rendered, but dramatically improves performance of CJK maps (because the browser no longer needs to download heavy amounts of font data from the server). Add `localIdeographFontFamily: false` to turn this off. [#8008](https://github.com/mapbox/mapbox-gl-js/pull/8008)
- Added `Popup` `maxWidth` option, set to `"240px"` by default. [#7906](https://github.com/mapbox/mapbox-gl-js/pull/7906)

### Major features

- Added support for updating and animating style images. [#7999](https://github.com/mapbox/mapbox-gl-js/pull/7999)
- Added support for generating style images dynamically (e.g. for drawing icons based on feature properties). [#7987](https://github.com/mapbox/mapbox-gl-js/pull/7987)
- Added antialiasing support for custom layers. [#7821](https://github.com/mapbox/mapbox-gl-js/pull/7821)
- Added a new `mapbox-gl-csp.js` bundle for strict CSP environments where `worker-src: blob` is disallowed. [#8044](https://github.com/mapbox/mapbox-gl-js/pull/8044)

### Minor features and improvements

- Improved performance of fill extrusions. [#7821](https://github.com/mapbox/mapbox-gl-js/pull/7821)
- Improved performance of symbol layers. [#7967](https://github.com/mapbox/mapbox-gl-js/pull/7967)
- Slightly improved rendering performance in general. [#7969](https://github.com/mapbox/mapbox-gl-js/pull/7969)
- Slightly improved performance of HTML markers. [#8018](https://github.com/mapbox/mapbox-gl-js/pull/8018)
- Improved diffing of styles with `"visibility": "visible"`. [#8005](https://github.com/mapbox/mapbox-gl-js/pull/8005)
- Improved zoom buttons to grey out when reaching min/max zoom. [#8023](https://github.com/mapbox/mapbox-gl-js/pull/8023)
- Added a title to fullscreen control button. [#8012](https://github.com/mapbox/mapbox-gl-js/pull/8012)
- Added `rel="noopener"` attributes to links that lead to external websites (such as Mapbox logo and OpenStreetMap edit link) for improved security. [#7914](https://github.com/mapbox/mapbox-gl-js/pull/7914)
- Added tile size info when `map.showTileBoundaries` is turned on. [#7963](https://github.com/mapbox/mapbox-gl-js/pull/7963)
- Significantly improved load times of the benchmark suite. [#8066](https://github.com/mapbox/mapbox-gl-js/pull/8066)
- Improved behavior of `canvasSource.pause` to be more reliable and able to render a single frame. [#8130](https://github.com/mapbox/mapbox-gl-js/pull/8130)

### Bug fixes

- Fixed a bug in Mac Safari 12+ where controls would disappear until you interact with the map. [8193](https://github.com/mapbox/mapbox-gl-js/pull/8193)
- Fixed a memory leak when calling `source.setData(url)` many times. [#8035](https://github.com/mapbox/mapbox-gl-js/pull/8035)
- Fixed a bug where marker lost focus when dragging. [#7799](https://github.com/mapbox/mapbox-gl-js/pull/7799)
- Fixed a bug where `map.getCenter()` returned a reference to an internal `LngLat` object instead of cloning it, leading to potential mutability bugs. [#7922](https://github.com/mapbox/mapbox-gl-js/pull/7922)
- Fixed a bug where default HTML marker positioning was slightly off. [#8074](https://github.com/mapbox/mapbox-gl-js/pull/8074)
- Fixed a bug where adding a fill extrusion layer for non-polygon layers would lead to visual artifacts. [#7685](https://github.com/mapbox/mapbox-gl-js/pull/7685)
- Fixed intermittent Flow failures on CI. [#8061](https://github.com/mapbox/mapbox-gl-js/pull/8061)
- Fixed a bug where calling `Map#removeFeatureState` does not remove the state from some tile zooms [#8087](https://github.com/mapbox/mapbox-gl-js/pull/8087)
- Fixed a bug where `removeFeatureState` didn't work on features with `id` equal to `0`. [#8150](https://github.com/mapbox/mapbox-gl-js/pull/8150) (h/t [jutaz](https://github.com/jutaz))

## 0.53.1

### Bug fixes
* Turn off telemetry for Mapbox Atlas ([#7945](https://github.com/mapbox/mapbox-gl-js/pull/7945))
* Fix order of 3D features in query results (fix #7883) ([#7953](https://github.com/mapbox/mapbox-gl-js/pull/7953))
* Fix RemovePaintState benchmarks ([#7930](https://github.com/mapbox/mapbox-gl-js/pull/7930))

## 0.53.0

### Features and improvements
* Enable `fill-extrusion` querying with ray picking ([#7499](https://github.com/mapbox/mapbox-gl-js/pull/7499))
* Add `clusterProperties` option for aggregated cluster properties ([#2412](https://github.com/mapbox/mapbox-gl-js/issues/2412), fixed by [#7584](https://github.com/mapbox/mapbox-gl-js/pull/7584))
* Allow initial map bounds to be adjusted with `fitBounds` options. ([#7681](https://github.com/mapbox/mapbox-gl-js/pull/7681)) (h/t [elyobo](https://github.com/elyobo))
* Remove popups on `Map#remove` ([#7749](https://github.com/mapbox/mapbox-gl-js/pull/7749)) (h/t [andycalder](https://github.com/andycalder))
* Add `Map#removeFeatureState` ([#7761](https://github.com/mapbox/mapbox-gl-js/pull/7761))
* Add `number-format` expression ([#7626](https://github.com/mapbox/mapbox-gl-js/pull/7626))
* Add `symbol-sort-key` style property ([#7678](https://github.com/mapbox/mapbox-gl-js/pull/7678))

### Bug fixes
* Upgrades Earcut to fix a rare bug in rendering polygons that contain a coincident chain of holes ([#7806](https://github.com/mapbox/mapbox-gl-js/issues/7806), fixed by [#7878](https://github.com/mapbox/mapbox-gl-js/pull/7878))
* Allow `file://` protocol in XHR requests for Cordova/Ionic/etc ([#7818](https://github.com/mapbox/mapbox-gl-js/pull/7818))
* Correctly handle WebP images in Edge 18 ([#7687](https://github.com/mapbox/mapbox-gl-js/pull/7687))
* Fix bug which mistakenly requested WebP images in browsers that do not support WebP (#7817) ([#7819](https://github.com/mapbox/mapbox-gl-js/pull/7819))
* Fix images not being aborted when dequeued ([#7655](https://github.com/mapbox/mapbox-gl-js/pull/7655))
* Fix DEM layer memory leak ([#7690](https://github.com/mapbox/mapbox-gl-js/issues/7690), fixed by [#7691](https://github.com/mapbox/mapbox-gl-js/pull/7691))
* Set correct color state before rendering custom layer ([#7711](https://github.com/mapbox/mapbox-gl-js/pull/7711))
* Set `LngLat.toBounds()` default radius to 0 ([#7722](https://github.com/mapbox/mapbox-gl-js/issues/7722), fixed by [#7723](https://github.com/mapbox/mapbox-gl-js/pull/7723)) (h/t [cherniavskii](https://github.com/cherniavskii))
* Fix race condition in `feature-state` dependent layers ([#7523](https://github.com/mapbox/mapbox-gl-js/issues/7523), fixed by [#7790](https://github.com/mapbox/mapbox-gl-js/pull/7790))
* Prevent `map.repaint` from mistakenly enabling continuous repaints ([#7667](https://github.com/mapbox/mapbox-gl-js/pull/7667))
* Prevent map shaking while zooming in on raster tiles ([#7426](https://github.com/mapbox/mapbox-gl-js/pull/7426))
* Fix query point translation for multi-point geometry ([#6833](https://github.com/mapbox/mapbox-gl-js/issues/6833), fixed by [#7581](https://github.com/mapbox/mapbox-gl-js/pull/7581))

## 0.52.0

### Breaking changes
* Canonicalize tile urls to `mapbox://` urls so they can be transformed with `config.API_URL` ([#7594](https://github.com/mapbox/mapbox-gl-js/pull/7594))

### Features and improvements
* Add getter and setter for `config.API_URL` ([#7594](https://github.com/mapbox/mapbox-gl-js/pull/7594))
* Allow user to define element other than map container for full screen control ([#7548](https://github.com/mapbox/mapbox-gl-js/pull/7548))
* Add validation option to style setters ([#7604](https://github.com/mapbox/mapbox-gl-js/pull/7604))
* Add 'idle' event: fires when no further rendering is expected without further interaction. ([#7625](https://github.com/mapbox/mapbox-gl-js/pull/7625))

### Bug fixes
* Fire error when map.getLayoutProperty references missing layer ([#7537](https://github.com/mapbox/mapbox-gl-js/issues/7537), fixed by [#7539](https://github.com/mapbox/mapbox-gl-js/pull/7539))
* Fix shaky sprites when zooming with scrolling ([#7558](https://github.com/mapbox/mapbox-gl-js/pull/7558))
* Fix layout problems in attribution control ([#7608](https://github.com/mapbox/mapbox-gl-js/pull/7608)) (h/t [lucaswoj](https://github.com/lucaswoj))
* Fixes resetting map's pitch to 0 if initial bounds is set ([#7617](https://github.com/mapbox/mapbox-gl-js/pull/7617)) (h/t [stepankuzmin](https://github.com/stepankuzmin))
* Fix occasional failure to load images after multiple image request abortions [#7641](https://github.com/mapbox/mapbox-gl-js/pull/7641)
* Update repo url to correct one ([#7486](https://github.com/mapbox/mapbox-gl-js/pull/7486)) (h/t [nicholas-l](https://github.com/nicholas-l))
* Fix bug where symbols where sometimes not rendered immediately ([#7610](https://github.com/mapbox/mapbox-gl-js/pull/7610))
* Fix bug where cameraForBounds returns incorrect CameraOptions with asymmetrical padding/offset ([#7517](https://github.com/mapbox/mapbox-gl-js/issues/7517), fixed by [#7518](https://github.com/mapbox/mapbox-gl-js/pull/7518)) (h/t [mike-marcacci](https://github.com/mike-marcacci))
* Use diff+patch approach to map.setStyle when the parameter is a URL ([#4025](https://github.com/mapbox/mapbox-gl-js/issues/4025), fixed by [#7562](https://github.com/mapbox/mapbox-gl-js/pull/7562))
* Begin touch zoom immediately when rotation disabled ([#7582](https://github.com/mapbox/mapbox-gl-js/pull/7582)) (h/t [msbarry](https://github.com/msbarry))
* Fix symbol rendering under opaque fill layers ([#7612](https://github.com/mapbox/mapbox-gl-js/pull/7612))
* Fix shaking by aligning raster sources to pixel grid only when map is idle ([7426](https://github.com/mapbox/mapbox-gl-js/pull/7426))
* Fix raster layers in Edge 18 by disabling it's incomplete WebP support ([7687](https://github.com/mapbox/mapbox-gl-js/pull/7687))
* Fix memory leak in hillshade layer ([7691](https://github.com/mapbox/mapbox-gl-js/pull/7691))
* Fix disappearing custom layers ([7711](https://github.com/mapbox/mapbox-gl-js/pull/7711))

## 0.51.0
November 7, 2018

### ✨ Features and improvements
* Add initial bounds as map constructor option ([#5518](https://github.com/mapbox/mapbox-gl-js/pull/5518)) (h/t [stepankuzmin](https://github.com/stepankuzmin))
* Improve performance on machines with > 8 cores ([#7407](https://github.com/mapbox/mapbox-gl-js/issues/7407), fixed by [#7430](https://github.com/mapbox/mapbox-gl-js/pull/7430))
* Add `MercatorCoordinate` type ([#7488](https://github.com/mapbox/mapbox-gl-js/pull/7488))
* Allow browser-native `contextmenu` to be enabled ([#2301](https://github.com/mapbox/mapbox-gl-js/issues/2301), fixed by [#7369](https://github.com/mapbox/mapbox-gl-js/pull/7369))
* Add an unminified production build to the NPM package ([#7403](https://github.com/mapbox/mapbox-gl-js/pull/7403))
* Add support for `LngLat` conversion from `{lat, lon}` ([#7507](https://github.com/mapbox/mapbox-gl-js/pull/7507)) (h/t [bfrengley](https://github.com/bfrengley))
* Add tooltips for navigation controls ([#7373](https://github.com/mapbox/mapbox-gl-js/pull/7373))
* Show attribution only for used sources ([#7384](https://github.com/mapbox/mapbox-gl-js/pull/7384))
* Add telemetry event to log map loads ([#7431](https://github.com/mapbox/mapbox-gl-js/pull/7431))
* **Tighten style validation**
    * Disallow expressions as stop values ([#7396](https://github.com/mapbox/mapbox-gl-js/pull/7396))
    * Disallow `feature-state` expressions in filters ([#7366](https://github.com/mapbox/mapbox-gl-js/pull/7366))

### 🐛 Bug fixes
* Fix for GeoJSON geometries not working when coincident with tile boundaries([#7436](https://github.com/mapbox/mapbox-gl-js/issues/7436), fixed by [#7448](https://github.com/mapbox/mapbox-gl-js/pull/7448))
* Fix depth buffer-related rendering issues on some Android devices. ([#7471](https://github.com/mapbox/mapbox-gl-js/pull/7471))
* Fix positioning of compact attribution strings ([#7444](https://github.com/mapbox/mapbox-gl-js/pull/7444), [#7445](https://github.com/mapbox/mapbox-gl-js/pull/7445), and [#7391](https://github.com/mapbox/mapbox-gl-js/pull/7391))
* Fix an issue with removing markers in mouse event callbacks ([#7442](https://github.com/mapbox/mapbox-gl-js/pull/7442)) (h/t [vbud](https://github.com/vbud))
* Remove controls before destroying a map ([#7479](https://github.com/mapbox/mapbox-gl-js/pull/7479))
* Fix display of Scale control values < 1 ([#7469](https://github.com/mapbox/mapbox-gl-js/pull/7469)) (h/t [MichaelHedman](https://github.com/MichaelHedman))
* Fix an error when using location `hash` within iframes in IE11 ([#7411](https://github.com/mapbox/mapbox-gl-js/pull/7411))
* Fix depth mode usage in custom layers ([#7432](https://github.com/mapbox/mapbox-gl-js/pull/7432)) (h/t [markusjohnsson](https://github.com/markusjohnsson))
* Fix an issue with shaky sprite images during scroll zooms ([#7558](https://github.com/mapbox/mapbox-gl-js/pull/7558))


## 0.50.0
October 10, 2018

### ✨ Features and improvements
* 🎉 Add Custom Layers that can be rendered into with user-provided WebGL code ([#7039](https://github.com/mapbox/mapbox-gl-js/pull/7039))
* Add WebGL face culling for increased performance ([#7178](https://github.com/mapbox/mapbox-gl-js/pull/7178))
* Improve speed of expression evaluation ([#7334](https://github.com/mapbox/mapbox-gl-js/pull/7334))
* Automatically coerce to string for `concat` expression and `text-field` property ([#6190](https://github.com/mapbox/mapbox-gl-js/issues/6190), fixed by [#7280](https://github.com/mapbox/mapbox-gl-js/pull/7280))
* Add `fill-extrusion-vertical-gradient` property for controlling shading of fill extrusions ([#5768](https://github.com/mapbox/mapbox-gl-js/issues/5768), fixed by [#6841](https://github.com/mapbox/mapbox-gl-js/pull/6841))
* Add update functionality for images provided via `ImageSource` ([#4050](https://github.com/mapbox/mapbox-gl-js/issues/4050), fixed by [#7342](https://github.com/mapbox/mapbox-gl-js/pull/7342)) (h/t [dcervelli](https://github.com/dcervelli))



### 🐛 Bug fixes
* **Expressions**
	* Fix expressions that use `log2` and `log10` in IE11 ([#7318](https://github.com/mapbox/mapbox-gl-js/issues/7318), fixed by [#7320](https://github.com/mapbox/mapbox-gl-js/pull/7320))
	* Fix `let` expression stripping expected type during parsing ([#7300](https://github.com/mapbox/mapbox-gl-js/issues/7300), fixed by [#7301](https://github.com/mapbox/mapbox-gl-js/pull/7301))
	* Fix superfluous wrapping of literals in `literal` expression ([#7336](https://github.com/mapbox/mapbox-gl-js/issues/7336), fixed by [#7337](https://github.com/mapbox/mapbox-gl-js/pull/7337))
	* Allow calling `to-color` on values that are already of type `Color` ([#7260](https://github.com/mapbox/mapbox-gl-js/pull/7260))
	* Fix `to-array` for empty arrays (([#7261](https://github.com/mapbox/mapbox-gl-js/pull/7261)))
	* Fix identity functions for `text-field` when using formatted text ([#7351](https://github.com/mapbox/mapbox-gl-js/pull/7351))
	* Fix coercion of `null` to `0` in `to-number` expression ([#7083](https://github.com/mapbox/mapbox-gl-js/issues/7083), fixed by [#7274](https://github.com/mapbox/mapbox-gl-js/pull/7274))
* **Canvas source**
	* Fix missing repeats of `CanvasSource` when it crosses the antimeridian ([#7273](https://github.com/mapbox/mapbox-gl-js/pull/7273))
	* Fix `CanvasSource` not respecting alpha values set on `canvas` element ([#7302](https://github.com/mapbox/mapbox-gl-js/issues/7302), fixed by [#7309](https://github.com/mapbox/mapbox-gl-js/pull/7309))
* **Rendering**
	* Fix rendering of fill extrusions with really high heights ([#7292](https://github.com/mapbox/mapbox-gl-js/pull/7292))
	* Fix an error where the map state wouldn't return to `loaded` after certain runtime styling changes when there were errored tiles in the viewport ([#7355](https://github.com/mapbox/mapbox-gl-js/pull/7355))
	* Fix errors when rendering symbol layers without symbols ([#7241](https://github.com/mapbox/mapbox-gl-js/issues/7241), fixed by [#7253](https://github.com/mapbox/mapbox-gl-js/pull/7253))
	* Don't fade in symbols with `*-allow-overlap: true` when panning into the viewport ([#7172](https://github.com/mapbox/mapbox-gl-js/issues/7172), fixed by[#7244](https://github.com/mapbox/mapbox-gl-js/pull/7244))
* **Library**
	* Fix disambiguation for `mouseover` event ([#7295](https://github.com/mapbox/mapbox-gl-js/issues/7295), fixed by [#7299](https://github.com/mapbox/mapbox-gl-js/pull/7299))
	* Fix silent failure of `getImage` if an SVG is requested ([#7312](https://github.com/mapbox/mapbox-gl-js/issues/7312), fixed by [#7313](https://github.com/mapbox/mapbox-gl-js/pull/7313))
	* Fix empty control group box shadow ([#7303](https://github.com/mapbox/mapbox-gl-js/issues/7303), fixed by [#7304](https://github.com/mapbox/mapbox-gl-js/pull/7304)) (h/t [Duder-onomy](https://github.com/Duder-onomy))
	* Fixed an issue where a wrong timestamp was sent for Mapbox turnstile events ([#7381](https://github.com/mapbox/mapbox-gl-js/pull/7381))
	* Fixed a bug that lead to attribution not showing up correctly in Internet Explorer ([#3945](https://github.com/mapbox/mapbox-gl-js/issues/3945), fixed by [#7391](https://github.com/mapbox/mapbox-gl-js/pull/7391))


## 0.49.0
September 6, 2018

### ⚠️ Breaking changes
* Use `client{Height/Width}` instead of `offset{Height/Width}` for map canvas sizing ([#6848](https://github.com/mapbox/mapbox-gl-js/issues/6848), fixed by [#7128](https://github.com/mapbox/mapbox-gl-js/pull/7128))

### 🐛 Bug fixes
* Fix [Top Issues list](https://mapbox.github.io/top-issues/#!mapbox/mapbox-gl-js) for mapbox-gl-js ([#7108](https://github.com/mapbox/mapbox-gl-js/issues/7108), fixed by [#7112](https://github.com/mapbox/mapbox-gl-js/pull/7112))
* Fix bug in which symbols with `icon-allow-overlap: true, text-allow-overlap: true, text-optional: false` would show icons when they shouldn't ([#7041](https://github.com/mapbox/mapbox-gl-js/pull/7041))
* Fix bug where the map would not stop at the exact zoom level requested by Map#FlyTo (#7222) ([#7223](https://github.com/mapbox/mapbox-gl-js/pull/7223)) (h/t [benoitbzl](https://github.com/benoitbzl))
* Keep map centered on the center point of a multi-touch gesture when zooming (#6722) ([#7191](https://github.com/mapbox/mapbox-gl-js/pull/7191)) (h/t [pakastin](https://github.com/pakastin))
* Update the style-spec's old `gl-style-migrate` script to include conversion of legacy functions and filters to their expression equivalents ([#6927](https://github.com/mapbox/mapbox-gl-js/issues/6927), fixed by [#7095](https://github.com/mapbox/mapbox-gl-js/pull/7095))
* Fix `icon-size` for small data-driven values ([#7125](https://github.com/mapbox/mapbox-gl-js/pull/7125))
* Fix bug in the way AJAX requests load local files on iOS web view ([#6610](https://github.com/mapbox/mapbox-gl-js/pull/6610)) (h/t [oscarfonts](https://github.com/oscarfonts))
* Fix bug in which canvas sources would not render in world wrapped tiles at the edge of the viewport ([#7271]https://github.com/mapbox/mapbox-gl-js/issues/7271), fixed by [#7273](https://github.com/mapbox/mapbox-gl-js/pull/7273))

### ✨ Features and improvements
* Performance updates:
  * Improve time to first render by updating how feature ID maps are transferred to the main thread ([#7110](https://github.com/mapbox/mapbox-gl-js/issues/7110), fixed by [#7132](https://github.com/mapbox/mapbox-gl-js/pull/7132))
  * Reduce size of JSON transmitted from worker thread to main thread ([#7124](https://github.com/mapbox/mapbox-gl-js/pull/7124))
  * Improve image/glyph atlas packing algorithm ([#7171](https://github.com/mapbox/mapbox-gl-js/pull/7171))
  * Use murmur hash on symbol instance keys to reduce worker transfer costs ([#7127](https://github.com/mapbox/mapbox-gl-js/pull/7127))
* Add GL state management for uniforms ([#6018](https://github.com/mapbox/mapbox-gl-js/pull/6018))
* Add `symbol-z-order` symbol layout property to style spec ([#7219](https://github.com/mapbox/mapbox-gl-js/pull/7219))
* Implement data-driven styling support for `*-pattern properties` ([#6289](https://github.com/mapbox/mapbox-gl-js/pull/6289))
* Add `Map#fitScreenCoordinates` which fits viewport to two points, similar to `Map#fitBounds` but uses screen coordinates and supports non-zero map bearings ([#6894](https://github.com/mapbox/mapbox-gl-js/pull/6894))
* Re-implement LAB/HSL color space interpolation for expressions ([#5326](https://github.com/mapbox/mapbox-gl-js/issues/5326), fixed by [#7123](https://github.com/mapbox/mapbox-gl-js/pull/7123))
* Enable benchmark testing for Mapbox styles ([#7047](https://github.com/mapbox/mapbox-gl-js/pull/7047))
* Allow `Map#setFeatureState` and `Map#getFeatureState` to accept numeric IDs ([#7106](https://github.com/mapbox/mapbox-gl-js/pull/7106)) (h/t [bfrengley](https://github.com/bfrengley))

## 0.48.0
August 16, 2018

### ⚠️ Breaking changes
* Treat tiles that error with status 404 as empty renderable tiles to prevent rendering duplicate features in some sparse tilesets ([#6803](https://github.com/mapbox/mapbox-gl-js/pull/6803))

### 🐛 Bug fixes
* Fix issue where `text-max-angle` property was being calculated incorrectly internally, causing potential rendering errors when `"symbol-placement": line`
* Require `feature.id` when using `Map#setFeatureState` ([#6974](https://github.com/mapbox/mapbox-gl-js/pull/6974))
* Fix issue with removing the `GeolocateControl` when user location is being used ([#6977](https://github.com/mapbox/mapbox-gl-js/pull/6977)) (h/t [sergei-zelinsky](https://github.com/sergei-zelinsky))
* Fix memory leak caused by a failure to remove all controls added to the map ([#7042](https://github.com/mapbox/mapbox-gl-js/pull/7042))
* Fix bug where the build would fail when using mapbox-gl webpack 2 and UglifyJSPlugin ([#4359](https://github.com/mapbox/mapbox-gl-js/issues/4359), fixed by [#6956](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/6956))
* Fix bug where fitBounds called with coordinates outside the bounds of Web Mercator resulted in uncaught error ([#6906](https://github.com/mapbox/mapbox-gl-js/issues/6906), fixed by [#6918](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/6918))
* Fix bug wherein `Map#querySourceFeatures` was returning bad results on zooms > maxZoom ([#7061](https://github.com/mapbox/mapbox-gl-js/pull/7061))
* Relax typing for equality and order expressions ([#6459](https://github.com/mapbox/mapbox-gl-js/issues/6459), fixed by [#6961](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/6961))
* Fix bug where `queryPadding` for all layers in a source was set by the first layer, causing incorrect querying on other layers and, in some cases, incorrect firing of events associated with individual layers ([#6909](https://github.com/mapbox/mapbox-gl-js/pull/6909))

### ✨ Features and improvements

* Performance Improvements:
  * Stop unnecessary serialization of symbol source features. ([#7013](https://github.com/mapbox/mapbox-gl-js/pull/7013))
  * Optimize calculation for getting visible tile coordinates ([#6998](https://github.com/mapbox/mapbox-gl-js/pull/6998))
  * Improve performance of creating `{Glyph/Image}Atlas`es ([#7091](https://github.com/mapbox/mapbox-gl-js/pull/7091))
  * Optimize and simplify tile retention logic ([#6995](https://github.com/mapbox/mapbox-gl-js/pull/6995))
* Add a user turnstile event for users accessing Mapbox APIs ([#6980](https://github.com/mapbox/mapbox-gl-js/pull/6980))
* Add support for autogenerating feature ids for GeoJSON sources so they can be used more easily with the `Map#setFeatureState` API ([#7043](https://www.github.com/mapbox/mapbox-gl-js/pull/7043))) ([#7091](https://github.com/mapbox/mapbox-gl-js/pull/7091))
* Add ability to style symbol layers labels with multiple fonts and text sizes via `"format"` expression ([#6994](https://www.github.com/mapbox/mapbox-gl-js/pull/6994))
* Add customAttribution option to AttributionControl ([#7033](https://github.com/mapbox/mapbox-gl-js/pull/7033)) (h/t [mklopets](https://github.com/mklopets))
* Publish Flow type definitions alongside compiled bundle ([#7079](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/7079))
* Introduce symbol cross fading when crossing integer zoom levels to prevent labels from disappearing before newly loaded tiles' labels can be rendered ([#6951](https://github.com/mapbox/mapbox-gl-js/pull/6951))
* Improvements in label collision detection ([#6925](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/6925)))

## 0.47.0

### ✨ Features and improvements
* Add configurable drag pan threshold ([#6809](https://github.com/mapbox/mapbox-gl-js/pull/6809)) (h/t [msbarry](https://github.com/msbarry))
* Add `raster-resampling` raster paint property ([#6411](https://github.com/mapbox/mapbox-gl-js/pull/6411)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Add `symbol-placement: line-center` ([#6821](https://github.com/mapbox/mapbox-gl-js/pull/6821))
* Add methods for inspecting GeoJSON clusters ([#3318](https://github.com/mapbox/mapbox-gl-js/issues/3318), fixed by [#6829](https://github.com/mapbox/mapbox-gl-js/pull/6829))
* Add warning to geolocate control when unsupported ([#6923](https://github.com/mapbox/mapbox-gl-js/pull/6923)) (h/t [aendrew](https://github.com/aendrew))
* Upgrade geojson-vt to 3.1.4 ([#6942](https://github.com/mapbox/mapbox-gl-js/pull/6942))
* Include link to license in compiled bundle ([#6975](https://github.com/mapbox/mapbox-gl-js/pull/6975))

### 🐛 Bug fixes
* Use updateData instead of re-creating buffers for repopulated paint arrays ([#6853](https://github.com/mapbox/mapbox-gl-js/pull/6853))
* Fix ScrollZoom handler setting tr.zoom = NaN ([#6924](https://github.com/mapbox/mapbox-gl-js/pull/6924))
  - Failed to invert matrix error ([#6486](https://github.com/mapbox/mapbox-gl-js/issues/6486), fixed by [#6924](https://github.com/mapbox/mapbox-gl-js/pull/6924))
  - Fixing matrix errors ([#6782](https://github.com/mapbox/mapbox-gl-js/issues/6782), fixed by [#6924](https://github.com/mapbox/mapbox-gl-js/pull/6924))
* Fix heatmap tile clipping when layers are ordered above it ([#6806](https://github.com/mapbox/mapbox-gl-js/issues/6806), fixed by [#6807](https://github.com/mapbox/mapbox-gl-js/pull/6807))
* Fix video source in safari (macOS and iOS) ([#6443](https://github.com/mapbox/mapbox-gl-js/issues/6443), fixed by [#6811](https://github.com/mapbox/mapbox-gl-js/pull/6811))
* Do not reload errored tiles ([#6813](https://github.com/mapbox/mapbox-gl-js/pull/6813))
* Fix send / remove timing bug in Dispatcher ([#6756](https://github.com/mapbox/mapbox-gl-js/pull/6756), fixed by [#6826](https://github.com/mapbox/mapbox-gl-js/pull/6826))
* Fix flyTo not zooming to exact given zoom ([#6828](https://github.com/mapbox/mapbox-gl-js/pull/6828))
* Don't stop animation on map resize ([#6636](https://github.com/mapbox/mapbox-gl-js/pull/6636))
* Fix map.getBounds() with rotated map ([#6875](https://github.com/mapbox/mapbox-gl-js/pull/6875)) (h/t [zoltan-mihalyi](https://github.com/zoltan-mihalyi))
* Support collators in feature filter expressions. ([#6929](https://github.com/mapbox/mapbox-gl-js/pull/6929))
* Fix Webpack production mode compatibility ([#6981](https://github.com/mapbox/mapbox-gl-js/pull/6981))

## 0.46.0

### ⚠️ Breaking changes

* Align implicit type casting behavior of `match` expressions with with `case/==` ([#6684](https://github.com/mapbox/mapbox-gl-js/pull/6684))

### ✨ Features and improvements

* :tada: Add `Map#setFeatureState` and `feature-state` expression to support interactive styling ([#6263](https://github.com/mapbox/mapbox-gl-js/pull/6263))
* Create draggable `Marker` with `setDraggable` ([#6687](https://github.com/mapbox/mapbox-gl-js/pull/6687))
* Add `Map#listImages` for listing all currently active sprites/images ([#6381](https://github.com/mapbox/mapbox-gl-js/issues/6381))
* Add "crossSourceCollisions" option to disable cross-source collision detection ([#6566](https://github.com/mapbox/mapbox-gl-js/pull/6566))
* Handle `text/icon-rotate` for symbols with `symbol-placement: point` ([#6075](https://github.com/mapbox/mapbox-gl-js/issues/6075))
* Automatically compact Mapbox wordmark on narrow maps. ([#4282](https://github.com/mapbox/mapbox-gl-js/issues/4282)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Only show compacted AttributionControl on interactive displays ([#6506](https://github.com/mapbox/mapbox-gl-js/pull/6506)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Use postcss to inline svg files into css, reduce size of mapbox-gl.css ([#6513](https://github.com/mapbox/mapbox-gl-js/pull/6513)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Add support for GeoJSON attribution ([#6364](https://github.com/mapbox/mapbox-gl-js/pull/6364)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Add instructions for running individual unit and render tests ([#6686](https://github.com/mapbox/mapbox-gl-js/pull/6686))
* Make Map constructor fail if WebGL init fails. ([#6744](https://github.com/mapbox/mapbox-gl-js/pull/6744)) (h/t [uforic](https://github.com/uforic))
* Add browser fallback code for `collectResourceTiming: true` in web workers ([#6721](https://github.com/mapbox/mapbox-gl-js/pull/6721))
* Remove ignored usage of gl.lineWidth ([#5541](https://github.com/mapbox/mapbox-gl-js/pull/5541))
* Split new bounds calculation out of fitBounds into new method ([#6683](https://github.com/mapbox/mapbox-gl-js/pull/6683))
* Allow integration tests to be organized in an arbitrarily deep directory structure ([#3920](https://github.com/mapbox/mapbox-gl-js/issues/3920))
* Make "Missing Mapbox GL JS CSS" a console warning ([#5786](https://github.com/mapbox/mapbox-gl-js/issues/5786))
* Add rel="noopener" to Mapbox attribution link. ([#6729](https://github.com/mapbox/mapbox-gl-js/pull/6729)) (h/t [gorbypark](https://github.com/gorbypark))
* Update to deep equality check in example code ([#6599](https://github.com/mapbox/mapbox-gl-js/pull/6599)) (h/t [jonsadka](https://github.com/jonsadka))
* Upgrades!
  - Upgrade ESM dependency to ^3.0.39 ([#6750](https://github.com/mapbox/mapbox-gl-js/pull/6750))
  - Ditch gl-matrix fork in favor of the original package ([#6751](https://github.com/mapbox/mapbox-gl-js/pull/6751))
  - Update to latest sinon ([#6771](https://github.com/mapbox/mapbox-gl-js/pull/6771))
  - Upgrade to Flow 0.69 ([#6594](https://github.com/mapbox/mapbox-gl-js/pull/6594))
  - Update to mapbox-gl-supported 1.4.0 ([#6773](https://github.com/mapbox/mapbox-gl-js/pull/6773))

### 🐛 Bug fixes

* `collectResourceTiming: true` generates error on iOS9 Safari, IE 11 ([#6690](https://github.com/mapbox/mapbox-gl-js/issues/6690))
* Fix PopupOptions flow type declarations ([#6670](https://github.com/mapbox/mapbox-gl-js/pull/6670)) (h/t [TimPetricola](https://github.com/TimPetricola))
* Add className option to Popup constructor ([#6502](https://github.com/mapbox/mapbox-gl-js/pull/6502)) (h/t [Ashot-KR](https://github.com/Ashot-KR))
* GeoJSON MultiLineStrings with `lineMetrics=true` only rendered first line ([#6649](https://github.com/mapbox/mapbox-gl-js/issues/6649))
* Provide target property for mouseenter/over/leave/out events ([#6623](https://github.com/mapbox/mapbox-gl-js/issues/6623))
* Don't break on sources whose name contains "." ([#6660](https://github.com/mapbox/mapbox-gl-js/issues/6660))
* Rotate and pitch with navigationControl broke in v0.45  ([#6650](https://github.com/mapbox/mapbox-gl-js/issues/6650))
* Zero-width lines remained visible ([#6769](https://github.com/mapbox/mapbox-gl-js/pull/6769))
* Heatmaps inappropriately clipped at tile boundaries ([#6806](https://github.com/mapbox/mapbox-gl-js/issues/6806))
* Use named exports for style-spec entrypoint module ([#6601](https://github.com/mapbox/mapbox-gl-js/issues/6601)
* Don't fire click event if default is prevented on mousedown for a drag event ([#6697](https://github.com/mapbox/mapbox-gl-js/pull/6697), fixes [#6642](https://github.com/mapbox/mapbox-gl-js/issues/6642))
* Double clicking to zoom in breaks map dragging/panning in Edge ([#6740](https://github.com/mapbox/mapbox-gl-js/issues/6740)) (h/t [GUI](https://github.com/GUI))
* \*-transition properties cannot be set with setPaintProperty() ([#6706](https://github.com/mapbox/mapbox-gl-js/issues/6706))
* Marker with `a` element does not open the url when clicked ([#6730](https://github.com/mapbox/mapbox-gl-js/issues/6730))
* `setRTLTextPlugin` fails with relative URLs ([#6719](https://github.com/mapbox/mapbox-gl-js/issues/6719))
* Collision detection incorrect for symbol layers that share the same layout properties ([#6548](https://github.com/mapbox/mapbox-gl-js/pull/6548))
* Fix a possible crash when calling queryRenderedFeatures after querySourceFeatures
 ([#6559](https://github.com/mapbox/mapbox-gl-js/pull/6559))
* Fix a collision detection issue that could cause labels to temporarily be placed too densely during rapid panning ([#5654](https://github.com/mapbox/mapbox-gl-js/issues/5654))

## 0.45.0

### ⚠️ Breaking changes

* `Evented#fire` and `Evented#listens` are now marked as private. Though `Evented` is still exported, and `fire` and `listens` are still functional, we encourage you to seek alternatives; a future version may remove their API accessibility or change its behavior. If you are writing a class that needs event emitting functionality, consider using [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) or similar libraries instead.
* The `"to-string"` expression operator now converts `null` to an empty string rather than to `"null"`. [#6534](https://github.com/mapbox/mapbox-gl-js/pull/6534)

### ✨ Features and improvements

* :rainbow: Add `line-gradient` property [#6303](https://github.com/mapbox/mapbox-gl-js/pull/6303)
* Add `abs`, `round`, `floor`, and `ceil` expression operators [#6496](https://github.com/mapbox/mapbox-gl-js/pull/6496)
* Add `collator` expression for controlling case and diacritic sensitivity in string comparisons [#6270](https://github.com/mapbox/mapbox-gl-js/pull/6270)
  - Rename `caseSensitive` and `diacriticSensitive` expressions to `case-sensitive` and `diacritic-sensitive` for consistency [#6598](https://github.com/mapbox/mapbox-gl-js/pull/6598)
  - Prevent `collator` expressions for evaluating as constant to account for potential environment-specific differences in expression evaluation [#6596](https://github.com/mapbox/mapbox-gl-js/pull/6596)
* Add CSS linting to test suite (h/t @jasonbarry) [#6071](https://github.com/mapbox/mapbox-gl-js/pull/6071)
* Add support for configurable maxzoom in `raster-dem` tilesets [#6103](https://github.com/mapbox/mapbox-gl-js/pull/6103)
* Add `Map#isZooming` and `Map#isRotating` methods [#6128](https://github.com/mapbox/mapbox-gl-js/pull/6128), [#6183](https://github.com/mapbox/mapbox-gl-js/pull/6183)
* Add support for Mapzen Terrarium tiles in `raster-dem` sources [#6110](https://github.com/mapbox/mapbox-gl-js/pull/6110)
* Add `preventDefault` method on `mousedown`, `touchstart`, and `dblclick` events [#6218](https://github.com/mapbox/mapbox-gl-js/pull/6218)
* Add `originalEvent` property on `zoomend` and `moveend` for user-initiated scroll events (h/t @stepankuzmin) [#6175](https://github.com/mapbox/mapbox-gl-js/pull/6175)
* Accept arguments of type `value` in [`"length"` expressions](https://www.mapbox.com/mapbox-gl-js/style-spec/#expressions-length) [#6244](https://github.com/mapbox/mapbox-gl-js/pull/6244)
* Introduce `MapWheelEvent`[#6237](https://github.com/mapbox/mapbox-gl-js/pull/6237)
* Add setter for `ScaleControl` units (h/t @ryanhamley) [#6138](https://github.com/mapbox/mapbox-gl-js/pull/6138), [#6274](https://github.com/mapbox/mapbox-gl-js/pull/6274)
* Add `open` event for `Popup` [#6311](https://github.com/mapbox/mapbox-gl-js/pull/6311)
* Explicit `"object"` type assertions are no longer required when using expressions [#6235](https://github.com/mapbox/mapbox-gl-js/pull/6235)
* Add `anchor` option to `Marker` [#6350](https://github.com/mapbox/mapbox-gl-js/pull/6350)
* `HTMLElement` is now passed to `Marker` as part of the `options` object, but the old function signature is still supported for backwards compatibility [#6356](https://github.com/mapbox/mapbox-gl-js/pull/6356)
* Add support for custom colors when using the default `Marker` SVG element (h/t @andrewharvey) [#6416](https://github.com/mapbox/mapbox-gl-js/pull/6416)
* Allow `CanvasSource` initialization from `HTMLElement` [#6424](https://github.com/mapbox/mapbox-gl-js/pull/6424)
* Add `is-supported-script` expression [6260](https://github.com/mapbox/mapbox-gl-js/pull/6260)

### 🐛 Bug fixes

* Align `raster-dem` tiles to pixel grid to eliminate blurry rendering on some devices [#6059](https://github.com/mapbox/mapbox-gl-js/pull/6059)
* Fix label collision circle debug drawing on overzoomed tiles [#6073](https://github.com/mapbox/mapbox-gl-js/pull/6073)
* Improve error reporting for some failed requests [#6126](https://github.com/mapbox/mapbox-gl-js/pull/6126), [#6032](https://github.com/mapbox/mapbox-gl-js/pull/6032)
* Fix several `Map#queryRenderedFeatures` bugs:
  - account for `{text, icon}-offset` when querying[#6135](https://github.com/mapbox/mapbox-gl-js/pull/6135)
  - correctly query features that extend across tile boundaries [#5756](https://github.com/mapbox/mapbox-gl-js/pull/6283)
  - fix querying of `circle` layer features with `-pitch-scaling: 'viewport'` or `-pitch-alignment: 'map'` [#6036](https://github.com/mapbox/mapbox-gl-js/pull/6036)
  - eliminate flicker effects when using query results to set a hover effect by switching from tile-based to viewport-based symbol querying [#6497](https://github.com/mapbox/mapbox-gl-js/pull/6497)
* Preserve browser history state when updating the `Map` hash [#6140](https://github.com/mapbox/mapbox-gl-js/pull/6140)
* Fix undefined behavior when `Map#addLayer` is invoked with an `id` of a preexisting layer [#6147](https://github.com/mapbox/mapbox-gl-js/pull/6147)
* Fix bug where `icon-image` would not be rendered if `text-field` is an empty string [#6164](https://github.com/mapbox/mapbox-gl-js/pull/6164)
* Ensure all camera methods fire `rotatestart` and `rotateend` events [#6187](https://github.com/mapbox/mapbox-gl-js/pull/6187)
* Always hide duplicate labels [#6166](https://github.com/mapbox/mapbox-gl-js/pull/6166)
* Fix `DragHandler` bugs where a left-button mouse click would end a right-button drag rotate and a drag gesture would not end if the control key is down on `mouseup` [#6193](https://github.com/mapbox/mapbox-gl-js/pull/6193)
* Add support for calling `{DragPanHandler, DragRotateHandler}#disable` while a gesture is in progress [#6232](https://github.com/mapbox/mapbox-gl-js/pull/6232)
* Fix `GeolocateControl` user location dot sizing when `Map`'s `<div>` inherits `box-sizing: border-box;` (h/t @andrewharvey) [#6227](https://github.com/mapbox/mapbox-gl-js/pull/6232)
* Fix bug causing an off-by-one error in `array` expression error messages (h/t @drewbo) [#6269](https://github.com/mapbox/mapbox-gl-js/pull/6269)
* Improve error message when an invalid access token triggers a 401 error [#6283](https://github.com/mapbox/mapbox-gl-js/pull/6283)
* Fix bug where lines with `line-width` larger than the sprite height of the `line-pattern` property would render other sprite images [#6246](https://github.com/mapbox/mapbox-gl-js/pull/6246)
* Fix broken touch events for `DragPanHandler` on mobile using Edge (note that zoom/rotate/pitch handlers still do not support Edge touch events [#1928](https://github.com/mapbox/mapbox-gl-js/pull/1928)) [#6325](https://github.com/mapbox/mapbox-gl-js/pull/6325)
* Fix race condition in `VectorTileWorkerSource#reloadTile` causing a rendering timeout [#6308](https://github.com/mapbox/mapbox-gl-js/issues/6308)
* Fix bug causing redundant `gl.stencilFunc` calls due to incorrect state checking (h/t @yangdonglai) [#6330](https://github.com/mapbox/mapbox-gl-js/pull/6330)
* Fix bug where `mousedown` or `touchstart` would cancel camera animations in non-interactive maps [#6338](https://github.com/mapbox/mapbox-gl-js/pull/6338)
* Fix bug causing a full-screen flicker when the map is pitched and a symbol layer uses non-zero `text-translate` [#6365](https://github.com/mapbox/mapbox-gl-js/issues/6365)
* Fix bug in `to-rgba` expression causing division by zero [6388](https://github.com/mapbox/mapbox-gl-js/pull/6388)
* Fix bug in cross-fading for `*-pattern` properties with non-integer zoom stops [#6430](https://github.com/mapbox/mapbox-gl-js/pull/6430)
* Fix bug where calling `Map#remove` on a map with constructor option `hash: true` throws an error (h/t @allthesignals) [#6490](https://github.com/mapbox/mapbox-gl-js/pull/6497)
* Fix bug causing flickering when panning across the anti-meridian [#6438](https://github.com/mapbox/mapbox-gl-js/pull/6438)
* Fix error when using tiles of non-power-of-two size [#6444](https://github.com/mapbox/mapbox-gl-js/pull/6444)
* Fix bug causing `Map#moveLayer(layerId, beforeId)` to remove the layer when `layerId === beforeId` [#6542](https://github.com/mapbox/mapbox-gl-js/pull/6542)
- Fix Rollup build for style-spec module [6575](https://github.com/mapbox/mapbox-gl-js/pull/6575)
- Fix bug causing `Map#querySourceFeatures` to throw an `Uncaught TypeError`(https://github.com/mapbox/mapbox-gl-js/pull/6555)
- Fix issue where label collision detection was inaccurate for some symbol layers that shared layout properties with another layer [#6558](https://github.com/mapbox/mapbox-gl-js/pull/6558)
- Restore `target` property for `mouse{enter,over,leave,out}` events [#6623](https://github.com/mapbox/mapbox-gl-js/pull/6623)

## 0.44.2

### 🐛 Bug fixes

* Workaround a breaking change in Safari causing page to scroll/zoom in response to user actions intended to pan/zoom the map [#6095](https://github.com/mapbox/mapbox-gl-js/issues/6095). (N.B., not to be confused with the workaround from April 2017 dealing with the same breaking change in Chrome [#4259](https://github.com/mapbox/mapbox-gl-js/issues/6095). See also https://github.com/WICG/interventions/issues/18, https://bugs.webkit.org/show_bug.cgi?id=182521, https://bugs.chromium.org/p/chromium/issues/detail?id=639227 .)

## 0.44.1

### 🐛 Bug fixes

* Fix bug causing features from symbol layers to be omitted from `map.queryRenderedFeatures()` [#6074](https://github.com/mapbox/mapbox-gl-js/issues/6074)
* Fix error triggered by simultaneous scroll-zooming and drag-panning. [#6106](https://github.com/mapbox/mapbox-gl-js/issues/6106)
* Fix bug wherein drag-panning failed to resume after a brief pause [#6063](https://github.com/mapbox/mapbox-gl-js/issues/6063)

## 0.44.0

### ✨ Features and improvements

* The CSP policy of a page using mapbox-gl-js no longer needs to include `script-src 'unsafe-eval'` [#559](https://github.com/mapbox/mapbox-gl-js/issues/559)
* Add `LngLatBounds#isEmpty()` method [#5917](https://github.com/mapbox/mapbox-gl-js/pull/5917)
* Updated to flow 0.62.0 [#5923](https://github.com/mapbox/mapbox-gl-js/issues/5923)
* Make compass and zoom controls optional ([#5348](https://github.com/mapbox/mapbox-gl-js/pull/5348)) (h/t @matijs)
* Add `collectResourceTiming` option to the enable collection of [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/Resource_Timing_API/Using_the_Resource_Timing_API) data for requests that are made from Web Workers. ([#5948](https://github.com/mapbox/mapbox-gl-js/issues/5948))
* Improve user location dot appearance across browsers ([#5498](https://github.com/mapbox/mapbox-gl-js/pull/5498)) (h/t @jasonbarry)

### 🐛 Bug fixes

* Fix error triggered by `==` and `!=` expressions [#5947](https://github.com/mapbox/mapbox-gl-js/issues/5947)
* Image sources honor `renderWorldCopies` [#5932](https://github.com/mapbox/mapbox-gl-js/pull/5932)
* Fix transitions to default fill-outline-color  [#5953](https://github.com/mapbox/mapbox-gl-js/issues/5953)
* Fix transitions for light properties [#5982](https://github.com/mapbox/mapbox-gl-js/issues/5982)
* Fix minor symbol collisions on pitched maps [#5913](https://github.com/mapbox/mapbox-gl-js/pull/5913)
* Fix memory leaks after `Map#remove()` [#5943](https://github.com/mapbox/mapbox-gl-js/pull/5943), [#5951](https://github.com/mapbox/mapbox-gl-js/pull/5951)
* Fix bug wherein `GeoJSONSource#setData()` caused labels to fade out and back in ([#6002](https://github.com/mapbox/mapbox-gl-js/issues/6002))
* Fix bug that could cause incorrect collisions for labels placed very near to each other at low zoom levels ([#5993](https://github.com/mapbox/mapbox-gl-js/issues/5993))
* Fix bug causing `move` events to be fired out of sync with actual map movements ([#6005](https://github.com/mapbox/mapbox-gl-js/pull/6005))
* Fix bug wherein `Map` did not fire `mouseover` events ([#6000](https://github.com/mapbox/mapbox-gl-js/pull/6000)] (h/t @jay-manday)
* Fix bug causing blurry rendering of raster tiles ([#4552](https://github.com/mapbox/mapbox-gl-js/issues/4552))
* Fix potential memory leak caused by removing layers ([#5995](https://github.com/mapbox/mapbox-gl-js/issues/5995))
* Fix bug causing attribution icon to appear incorrectly in compact maps not using Mapbox data ([#6042](https://github.com/mapbox/mapbox-gl-js/pull/6042))
* Fix positioning of default marker element ([#6012](https://github.com/mapbox/mapbox-gl-js/pull/6012)) (h/t @andrewharvey)

## 0.43.0 (December 21, 2017)

### ⚠️ Breaking changes

* It is now an error to attempt to remove a source that is in use [#5562](https://github.com/mapbox/mapbox-gl-js/pull/5562)
* It is now an error if the layer specified by the `before` parameter to `moveLayer` does not exist [#5679](https://github.com/mapbox/mapbox-gl-js/pull/5679)
* `"colorSpace": "hcl"` now uses shortest-path interpolation for hue [#5811](https://github.com/mapbox/mapbox-gl-js/issues/5811)

### ✨ Features and improvements

* Introduce client-side hillshading with `raster-dem` source type and `hillshade` layer type [#5286](https://github.com/mapbox/mapbox-gl-js/pull/5286)
* GeoJSON sources take 2x less memory and generate tiles 20%–100% faster [#5799](https://github.com/mapbox/mapbox-gl-js/pull/5799)
* Enable data-driven values for text-font [#5698](https://github.com/mapbox/mapbox-gl-js/pull/5698)
* Enable data-driven values for heatmap-radius [#5898](https://github.com/mapbox/mapbox-gl-js/pull/5898)
* Add getter and setter for offset on marker [#5759](https://github.com/mapbox/mapbox-gl-js/pull/5759)
* Add `Map#hasImage` [#5775](https://github.com/mapbox/mapbox-gl-js/pull/5775)
* Improve typing for `==` and `!=` expressions [#5840](https://github.com/mapbox/mapbox-gl-js/pull/5840)
* Made `coalesce` expressions more useful [#5755](https://github.com/mapbox/mapbox-gl-js/issues/5755)
* Enable implicit type assertions for array types [#5738](https://github.com/mapbox/mapbox-gl-js/pull/5738)
* Improve hash control precision [#5767](https://github.com/mapbox/mapbox-gl-js/pull/5767)
* `supported()` now returns false on old IE 11 versions that don't support Web Worker blob URLs [#5801](https://github.com/mapbox/mapbox-gl-js/pull/5801)
* Remove flow globals TileJSON and Transferable [#5668](https://github.com/mapbox/mapbox-gl-js/pull/5668)
* Improve performance of image, video, and canvas sources [#5845](https://github.com/mapbox/mapbox-gl-js/pull/5845)

### 🐛 Bug fixes

* Fix popups and markers lag during pan animation [#4670](https://github.com/mapbox/mapbox-gl-js/issues/4670)
* Fix fading of symbol layers caused by setData [#5716](https://github.com/mapbox/mapbox-gl-js/issues/5716)
* Fix behavior of `to-rgba` and `rgba` expressions [#5778](https://github.com/mapbox/mapbox-gl-js/pull/5778), [#5866](https://github.com/mapbox/mapbox-gl-js/pull/5866)
* Fix cross-fading of `*-pattern` and `line-dasharray` [#5791](https://github.com/mapbox/mapbox-gl-js/pull/5791)
* Fix `colorSpace` function property [#5843](https://github.com/mapbox/mapbox-gl-js/pull/5843)
* Fix style diffing when changing GeoJSON source properties [#5731](https://github.com/mapbox/mapbox-gl-js/issues/5731)
* Fix missing labels when zooming out from overzoomed tile [#5827](https://github.com/mapbox/mapbox-gl-js/issues/5827)
* Fix missing labels when zooming out and quickly using setData [#5837](https://github.com/mapbox/mapbox-gl-js/issues/5837)
* Handle NaN as input to step and interpolate expressions [#5757](https://github.com/mapbox/mapbox-gl-js/pull/5757)
* Clone property values on input and output [#5806](https://github.com/mapbox/mapbox-gl-js/pull/5806)
* Bump geojson-rewind dependency [#5769](https://github.com/mapbox/mapbox-gl-js/pull/5769)
* Allow setting Marker's popup before LngLat [#5893](https://github.com/mapbox/mapbox-gl-js/pull/5893)

## 0.42.2 (November 21, 2017)

### 🐛 Bug fixes

- Add box-sizing to the "mapboxgl-ctrl-scale"-class [#5715](https://github.com/mapbox/mapbox-gl-js/pull/5715)
- Fix rendering in Safari [#5712](https://github.com/mapbox/mapbox-gl-js/issues/5712)
- Fix "Cannot read property 'hasTransition' of undefined" error [#5714](https://github.com/mapbox/mapbox-gl-js/issues/5714)
- Fix misplaced raster tiles [#5713](https://github.com/mapbox/mapbox-gl-js/issues/5713)
- Fix raster tile fading [#5722](https://github.com/mapbox/mapbox-gl-js/issues/5722)
- Ensure that an unset filter is undefined rather than null [#5727](https://github.com/mapbox/mapbox-gl-js/pull/5727)
- Restore pitch-with-rotate to nav control [#5725](https://github.com/mapbox/mapbox-gl-js/pull/5725)
- Validate container option in map constructor [#5695](https://github.com/mapbox/mapbox-gl-js/pull/5695)
- Fix queryRenderedFeatures behavior for features displayed in multiple layers [#5172](https://github.com/mapbox/mapbox-gl-js/issues/5172)

## 0.42.1 (November 17, 2017)

### 🐛 Bug fixes

- Workaround for map flashing bug on Chrome 62+ with Intel Iris Graphics 6100 cards [#5704](https://github.com/mapbox/mapbox-gl-js/pull/5704)
- Rerender map when `map.showCollisionBoxes` is set to `false` [#5673](https://github.com/mapbox/mapbox-gl-js/pull/5673)
- Fix transitions from property default values [#5682](https://github.com/mapbox/mapbox-gl-js/pull/5682)
- Fix runtime updating of `heatmap-color` [#5682](https://github.com/mapbox/mapbox-gl-js/pull/5682)
- Fix mobile Safari `history.replaceState` error [#5613](https://github.com/mapbox/mapbox-gl-js/pull/5613)

### ✨ Features and improvements

- Provide default element for Marker class [#5661](https://github.com/mapbox/mapbox-gl-js/pull/5661)

## 0.42.0 (November 10, 2017)

### ⚠️ Breaking changes

- Require that `heatmap-color` use expressions instead of stop functions [#5624](https://github.com/mapbox/mapbox-gl-js/issues/5624)
- Remove support for validating and migrating v6 styles
- Remove support for validating v7 styles [#5604](https://github.com/mapbox/mapbox-gl-js/pull/5604)
- Remove support for including `{tokens}` in expressions for `text-field` and `icon-image` [#5599](https://github.com/mapbox/mapbox-gl-js/issues/5599)
- Split `curve` expression into `step` and `interpolate` expressions [#5542](https://github.com/mapbox/mapbox-gl-js/pull/5542)
- Disallow interpolation in expressions for `line-dasharray` [#5519](https://github.com/mapbox/mapbox-gl-js/pull/5519)

### ✨ Features and improvements

- Improve label collision detection [#5150](https://github.com/mapbox/mapbox-gl-js/pull/5150)
  - Labels from different sources will now collide with each other
  - Collisions caused by rotation and pitch are now smoothly transitioned with a fade
  - Improved algorithm for fewer erroneous collisions, denser label placement, and greater label stability during rotation
- Add `sqrt` expression [#5493](https://github.com/mapbox/mapbox-gl-js/pull/5493)

### 🐛 Bug fixes and error reporting improvements

- Fix viewport calculations for `fitBounds` when both zooming and padding change [#4846](https://github.com/mapbox/mapbox-gl-js/issues/4846)
- Fix WebGL "range out of bounds for buffer" error caused by sorted symbol layers [#5620](https://github.com/mapbox/mapbox-gl-js/issues/5620)
- Fix symbol fading across tile reloads [#5491](https://github.com/mapbox/mapbox-gl-js/issues/5491)
- Change tile rendering order to better match GL Native [#5601](https://github.com/mapbox/mapbox-gl-js/pull/5601)
- Ensure no errors are triggered when calling `queryRenderedFeatures` on a heatmap layer [#5594](https://github.com/mapbox/mapbox-gl-js/pull/5594)
- Fix bug causing `queryRenderedSymbols` to return results from different sources [#5554](https://github.com/mapbox/mapbox-gl-js/issues/5554)
- Fix CJK rendering issues [#5544](https://github.com/mapbox/mapbox-gl-js/issues/5544), [#5546](https://github.com/mapbox/mapbox-gl-js/issues/5546)
- Account for `circle-stroke-width` in `queryRenderedFeatures` [#5514](https://github.com/mapbox/mapbox-gl-js/pull/5514)
- Fix rendering of fill layers atop raster layers [#5513](https://github.com/mapbox/mapbox-gl-js/pull/5513)
- Fix rendering of circle layers with a `circle-stroke-opacity` of 0 [#5496](https://github.com/mapbox/mapbox-gl-js/issues/5496)
- Fix memory leak caused by actor callbacks [#5443](https://github.com/mapbox/mapbox-gl-js/issues/5443)
- Fix source cache size for raster sources with tile sizes other than 512px [#4313](https://github.com/mapbox/mapbox-gl-js/issues/4313)
- Validate that zoom expressions only appear at the top level of an expression [#5609](https://github.com/mapbox/mapbox-gl-js/issues/5609)
- Validate that step and interpolate expressions don't have any duplicate stops [#5605](https://github.com/mapbox/mapbox-gl-js/issues/5605)
- Fix rendering for `icon-text-fit` with a data-driven `text-size` [#5632](https://github.com/mapbox/mapbox-gl-js/pull/5632)
- Improve validation to catch uses of deprecated function syntax [#5667](https://github.com/mapbox/mapbox-gl-js/pull/5667)
- Permit altitude coordinates in `position` field in GeoJSON [#5608](https://github.com/mapbox/mapbox-gl-js/pull/5608)

## 0.41.0 (October 11, 2017)

### :warning: Breaking changes
- Removed support for paint classes [#3643](https://github.com/mapbox/mapbox-gl-js/pull/3643). Instead, use runtime styling APIs or `Map#setStyle`.
- Reverted the `canvas` source `contextType` option added in 0.40.0 [#5449](https://github.com/mapbox/mapbox-gl-js/pull/5449)

### :bug: Bug fixes
- Clip raster tiles to avoid tile overlap [#5105](https://github.com/mapbox/mapbox-gl-js/pull/5105)
- Guard for offset edgecase in flyTo [#5331](https://github.com/mapbox/mapbox-gl-js/pull/5331)
- Ensure the map is updated after the sprite loads [#5367](https://github.com/mapbox/mapbox-gl-js/pull/5367)
- Limit animation duration on flyTo with maxDuration option [#5349](https://github.com/mapbox/mapbox-gl-js/pull/5349)
- Make double-tapping on make zoom in by a factor of 2 on iOS [#5274](https://github.com/mapbox/mapbox-gl-js/pull/5274)
- Fix rendering error with translucent raster tiles [#5380](https://github.com/mapbox/mapbox-gl-js/pull/5380)
- Error if invalid 'before' argument is passed to Map#addLayer [#5401](https://github.com/mapbox/mapbox-gl-js/pull/5401)
- Revert CanvasSource intermediary image buffer fix [#5449](https://github.com/mapbox/mapbox-gl-js/pull/5449)

### :sparkles: Features and improvements
- Use setData operation when diffing geojson sources [#5332](https://github.com/mapbox/mapbox-gl-js/pull/5332)
- Return early from draw calls on layers where opacity=0 [#5429](https://github.com/mapbox/mapbox-gl-js/pull/5429)
- A [heatmap](https://www.mapbox.com/mapbox-gl-js/example/heatmap-layer/) layer type is now available. This layer type allows you to visualize and explore massive datasets of points, reflecting the shape and density of data well while also looking beautiful. See [the blog post](https://blog.mapbox.com/sneak-peek-at-heatmaps-in-mapbox-gl-73b41d4b16ae) for further details.
  ![](https://cdn-images-1.medium.com/max/1600/1*Dme5MAgdA3pYdTRHUQzvLw.png)
- The value of a style property or filter can now be an [expression](http://www.mapbox.com/mapbox-gl-js/style-spec/#expressions). Expressions are a way of doing data-driven and zoom-driven styling that provides more flexibility and control, and unifies property and filter syntax.

  Previously, data-driven and zoom-driven styling relied on stop functions: you specify a feature property and a set of input-output pairs that essentially define a “scale” for how the style should be calculated based on the feature property. For example, the following would set circle colors on a green-to-red scale based on the value of `feature.properties.population`:

  ```
  "circle-color": {
    "property": "population",
    "stops": [
      [0, "green"],
      [1000000, "red"]
    ]
  }
  ```

  This approach is powerful, but we’ve seen a number of use cases that stop functions don't satisfy. Expressions provide the flexibility to address use cases like these:

  **Multiple feature properties**
  Using more than one feature property to calculate a given style property. E.g., styling land polygon colors based on both `feature.properties.land_use_category` and `feature.properties.elevation`.

  **Arithmetic**
  For some use cases it’s necessary to do some arithmetic on the input data. One example is sizing circles to represent quantitative data. Since a circle’s visual size on the screen is really its area (and A=πr^2), the right way to scale `circle-radius` is `square_root(feature.properties.input_data_value)`. Another example is unit conversions: feature data may include properties that are in some particular unit. Displaying such data in units appropriate to, say, a user’s preference or location, requires being able to do simple arithmetic (multiplication, division) on whatever value is in the data.

  **Conditional logic**
  This is a big one: basic if-then logic, for example to decide exactly what text to display for a label based on which properties are available in the feature or even the length of the name. A key example of this is properly supporting bilingual labels, where we have to decide whether to show local + English, local-only, or English-only, based on the data that’s available for each feature.

  **String manipulation**
  More dynamic control over label text with things like uppercase/lowercase/title case transforms, localized number formatting, etc. Without this functionality, crafting and iterating on label content entails a large data-prep burden.

  **Filters**
  Style layer filters had similar limitations. Moreover, they use a different syntax, even though their job is very similar to that of data-driven styling functions: filters say, “here’s how to look at a feature and decide whether to draw it,” and data-driven style functions say, “here’s how to look at a feature and decide how to size/color/place it.” Expressions provide a unified syntax for defining parts of a style that need to be calculated dynamically from feature data.

  For information on the syntax and behavior of expressions, please see [the documentation](http://www.mapbox.com/mapbox-gl-js/style-spec/#expressions).

### :wrench: Development workflow improvements
- Made the performance benchmarking runner more informative and statistically robust

## 0.40.1 (September 18, 2017)

### :bug: Bug fixes
- Fix bug causing flicker when zooming in on overzoomed tiles [#5295](https://github.com/mapbox/mapbox-gl-js/pull/5295)
- Remove erroneous call to Tile#redoPlacement for zoom-only or low pitch camera changes [#5284](https://github.com/mapbox/mapbox-gl-js/pull/5284)
- Fix bug where `CanvasSource` coordinates were flipped and improve performance for non-animated `CanvasSource`s [#5303](https://github.com/mapbox/mapbox-gl-js/pull/5303)
- Fix bug causing map not to render on some cases on Internet Explorer 11 [#5321](https://github.com/mapbox/mapbox-gl-js/pull/5321)
- Remove upper limit on `fill-extrusion-height` property [#5320](https://github.com/mapbox/mapbox-gl-js/pull/5320)

## 0.40.0 (September 13, 2017)

### :warning: Breaking changes
- `Map#addImage` now requires the image as an `HTMLImageElement`, `ImageData`, or object with `width`, `height`, and
  `data` properties with the same format as `ImageData`. It no longer accepts a raw `ArrayBufferView` in the second
  argument and `width` and `height` options in the third argument.
- `canvas` sources now require a `contextType` option specifying the drawing context associated with the source canvas. [#5155](https://github.com/mapbox/mapbox-gl-js/pull/5155)


### :sparkles: Features and improvements
- Correct rendering for multiple `fill-extrusion` layers on the same map [#5101](https://github.com/mapbox/mapbox-gl-js/pull/5101)
- Add an `icon-anchor` property to symbol layers [#5183](https://github.com/mapbox/mapbox-gl-js/pull/5183)
- Add a per-map `transformRequest` option, allowing users to provide a callback that transforms resource request URLs [#5021](https://github.com/mapbox/mapbox-gl-js/pull/5021)
- Add data-driven styling support for
  - `text-max-width` [#5067](https://github.com/mapbox/mapbox-gl-js/pull/5067)
  - `text-letter-spacing` [#5071](https://github.com/mapbox/mapbox-gl-js/pull/5071)
  - `line-join` [#5020](https://github.com/mapbox/mapbox-gl-js/pull/5020)
- Add support for SDF icons in `Map#addImage()` [#5181](https://github.com/mapbox/mapbox-gl-js/pull/5181)
- Added nautical miles unit to ScaleControl [#5238](https://github.com/mapbox/mapbox-gl-js/pull/5238) (h/t @fmairesse)
- Eliminate the map-wide limit on the number of glyphs and sprites that may be used in a style [#141](https://github.com/mapbox/mapbox-gl-js/issues/141). (Fixed by [#5190](https://github.com/mapbox/mapbox-gl-js/pull/5190), see also [mapbox-gl-native#9213](https://github.com/mapbox/mapbox-gl-native/pull/9213)
- Numerous performance optimizations (including [#5108](https://github.com/mapbox/mapbox-gl-js/pull/5108) h/t @pirxpilot)


### :bug: Bug fixes
- Add missing documentation for mouseenter, mouseover, mouseleave events [#4772](https://github.com/mapbox/mapbox-gl-js/issues/4772)
- Add missing documentation for `Marker#getElement()` method [#5242](https://github.com/mapbox/mapbox-gl-js/pull/5242)
- Fix bug wherein removing canvas source with animate=true leaves map in render loop [#5097](https://github.com/mapbox/mapbox-gl-js/issues/5097)
- Fix fullscreen detection on Firefox [#5272](https://github.com/mapbox/mapbox-gl-js/pull/5272)
- Fix z-fighting on overlapping fills within the same layer [#3320](https://github.com/mapbox/mapbox-gl-js/issues/3320)
- Fix handling of fractional values for `layer.minzoom` [#2929](https://github.com/mapbox/mapbox-gl-js/issues/2929)
- Clarify coordinate ordering in documentation for `center` option [#5042](https://github.com/mapbox/mapbox-gl-js/pull/5042) (h/t @karthikb351)
- Fix output of stop functions where two stops have the same input value [#5020](https://github.com/mapbox/mapbox-gl-js/pull/5020) (h/t @edpop )
- Fix bug wherein using `Map#addLayer()`  with an inline source would mutate its input [#4040](https://github.com/mapbox/mapbox-gl-js/issues/4040)
- Fix invalid css keyframes selector [#5075](https://github.com/mapbox/mapbox-gl-js/pull/5075) (h/t @aar0nr)
- Fix GPU-specific bug wherein canvas sources caused an error [#4262](https://github.com/mapbox/mapbox-gl-js/issues/4262)
- Fix a race condition in symbol layer handling that caused sporadic uncaught errors [#5185](https://github.com/mapbox/mapbox-gl-js/pull/5185)
- Fix bug causing line labels to render incorrectly on overzoomed tiles [#5120](https://github.com/mapbox/mapbox-gl-js/pull/5120)
- Fix bug wherein `NavigationControl` triggered mouse events unexpectedly [#5148](https://github.com/mapbox/mapbox-gl-js/issues/5148)
- Fix bug wherein clicking on the `NavigationControl` compass caused an error in IE 11 [#4784](https://github.com/mapbox/mapbox-gl-js/issues/4784)
- Remove dependency on GPL-3-licensed `fast-stable-stringify` module [#5152](https://github.com/mapbox/mapbox-gl-js/issues/5152)
- Fix bug wherein layer-specific an event listener produced an error after its target layer was removed from the map [#5145](https://github.com/mapbox/mapbox-gl-js/issues/5145)
- Fix `Marker#togglePopup()` failing to return the marker instance [#5116](https://github.com/mapbox/mapbox-gl-js/issues/5116)
- Fix bug wherein a marker's position failed to adapt to the marker element's size changing [#5133](https://github.com/mapbox/mapbox-gl-js/issues/5133)
- Fix rendering bug affecting Broadcom GPUs [#5073](https://github.com/mapbox/mapbox-gl-js/pull/5073)

### :wrench: Development workflow improvements
- Add (and now require) Flow type annotations throughout the majority of the codebase.
- Migrate to CircleCI 2.0 [#4939](https://github.com/mapbox/mapbox-gl-js/pull/4939)


## 0.39.1 (July 24, 2017)

### :bug: Bug fixes
- Fix packaging issue in 0.39.0 [#5025](https://github.com/mapbox/mapbox-gl-js/issues/5025)
- Correctly evaluate enum-based identity functions [#5023](https://github.com/mapbox/mapbox-gl-js/issues/5023)

## 0.39.0 (July 21, 2017)

### :warning: Breaking changes

- `GeolocateControl` breaking changes #4479
  * The option `watchPosition` has been replaced with `trackUserLocation`
  * The camera operation has changed from `jumpTo` (not animated) to `fitBounds` (animated). An effect of this is the map pitch is no longer reset, although the bearing is still reset to 0.
  * The accuracy of the geolocation provided by the device is used to set the view (previously it was fixed at zoom level 17). The `maxZoom` can be controlled via the new `fitBoundsOptions` option (defaults to 15).
- Anchor `Marker`s at their center by default #5019 @andrewharvey
- Increase `significantRotateThreshold` for the `TouchZoomRotateHandler` #4971, @dagjomar

### :sparkles: Features and improvements
- Improve performance of updating GeoJSON sources #4069, @ezheidtmann
- Improve rendering speed of extrusion layers #4818
- Improve line label legibility in pitched views #4781
- Improve line label legibility on curved lines #4853
- Add user location tracking capability to `GeolocateControl` #4479, @andrewharvey
  * New option `showUserLocation` to draw a "dot" as a `Marker` on the map at the user's location
  * An active lock and background state are introduced with `trackUserLocation`. When in active lock the camera will update to follow the user location, however if the camera is changed by the API or UI then the control will enter the background state where it won't update the camera to follow the user location.
  * New option `fitBoundsOptions` to control the camera operation
  * New `trackuserlocationstart` and `trackuserlocationend` events
  * New `LngLat.toBounds` method to extend a point location by a given radius to a `LngLatBounds` object
- Include main CSS file in `package.json` #4809, @tomscholz
- Add property function (data-driven styling) support for `line-width` #4773
- Add property function (data-driven styling) support for `text-anchor` #4997
- Add property function (data-driven styling) support for `text-justify` #5000
- Add `maxTileCacheSize` option #4778, @jczaplew
- Add new `icon-pitch-alignment` and `circle-pitch-alignment` properties #4869 #4871
- Add `Map#getMaxBounds` method #4890, @andrewharvey @lamuertepeluda
- Add option (`localIdeographFontFamily`) to use TinySDF to avoid loading expensive CJK glyphs #4895
- If `config.API_URL` includes a path prepend it to the request URL #4995
- Bump `supercluster` version to expose `cluster_id` property on clustered sources #5002

### :bug: Bug fixes
- Do not display `FullscreenControl` on unsupported devices #4838, @stepankuzmin
- Fix yarn build on Windows machines #4887
- Prevent potential memory leaks by dispatching `loadData` to the same worker every time #4877
- Fix bug preventing the rtlTextPlugin from loading before the initial style `load` #4870
- Fix bug causing runtime-stying to not take effect in some situations #4893
- Prevent requests of vertical glyphs for labels that can't be verticalized #4720
- Fix character detection for Zanabazar Square #4940
- Fix `LogoControl` logic to update correctly, and hide the `<div>` instead of removing it from the DOM when it is not needed #4842
- Fix `GeoJSONSource#serialize` to include all options
- Fix error handling in `GlyphSource#getSimpleGlyphs`#4992
- Fix bug causing `setStyle` to reload raster tiles #4852
- Fix bug causing symbol layers not to render on devices with non-integer device pixel ratios #4989
- Fix bug where `Map#queryRenderedFeatures` would error when returning no results #4993
- Fix bug where `Map#areTilesLoaded` would always be false on `sourcedata` events for reloading tiles #4987
- Fix bug causing categorical property functions to error on non-ascending order stops #4996

### :hammer_and_wrench: Development workflow changes
- Use flow to type much of the code base #4629 #4903 #4909 #4910 #4911 #4913 #4915 #4918 #4932 #4933 #4948 #4949 #4955 #4966 #4967 #4973 :muscle: @jfirebaugh @vicapow
- Use style specification to generate flow type #4958
- Explicitly list which files to publish in `package.json` #4819  @tomscholz
- Move render test ignores to a separate file #4977
- Add code of conduct #5015 :sparkling_heart:

## 0.38.0 (June 9, 2017)

#### New features :sparkles:

- Attenuate label size scaling with distance, improving readability of pitched maps [#4547](https://github.com/mapbox/mapbox-gl-js/pull/4547)

#### Bug fixes :beetle:

- Skip rendering for patterned layers when pattern is missing [#4687](https://github.com/mapbox/mapbox-gl-js/pull/4687)
- Fix bug with map failing to rerender after `webglcontextlost` event [#4725](https://github.com/mapbox/mapbox-gl-js/pull/4725) @cdawi
- Clamp zoom level in `flyTo` to within the map's specified min- and maxzoom to prevent undefined behavior [#4726](https://github.com/mapbox/mapbox-gl-js/pull/4726) @ IvanSanchez
- Fix wordmark rendering in IE [#4741](https://github.com/mapbox/mapbox-gl-js/pull/4741)
- Fix slight pixelwise symbol rendering bugs caused by incorrect sprite calculations [#4737](https://github.com/mapbox/mapbox-gl-js/pull/4737)
- Prevent exceptions thrown by certain `flyTo` calls [#4761](https://github.com/mapbox/mapbox-gl-js/pull/4761)
- Fix "Improve this map" link [#4685](https://github.com/mapbox/mapbox-gl-js/pull/4685)
- Tweak `queryRenderedSymbols` logic to better account for pitch scaling [#4792](https://github.com/mapbox/mapbox-gl-js/pull/4792)
- Fix for symbol layers sometimes failing to render, most frequently in Safari [#4795](https://github.com/mapbox/mapbox-gl-js/pull/4795)
- Apply `text-keep-upright` after `text-offset` to keep labels upright when intended [#4779](https://github.com/mapbox/mapbox-gl-js/pull/4779) **[Potentially breaking :warning: but considered a bugfix]**
- Prevent exceptions thrown by empty GeoJSON tiles [4803](https://github.com/mapbox/mapbox-gl-js/pull/4803)

#### Accessibility improvements :sound:

- Add `aria-label` to popup close button [#4799](https://github.com/mapbox/mapbox-gl-js/pull/4799) @andrewharvey

#### Development workflow + testing improvements :wrench:

- Fix equality assertion bug in tests [#4731](https://github.com/mapbox/mapbox-gl-js/pull/4731) @IvanSanchez
- Benchmark results page improvements [#4746](https://github.com/mapbox/mapbox-gl-js/pull/4746)
- Require node version >=6.4.0, enabling the use of more ES6 features [#4752](https://github.com/mapbox/mapbox-gl-js/pull/4752)
- Document missing `pitchWithRotate` option [#4800](https://github.com/mapbox/mapbox-gl-js/pull/4800) @simast
- Move Github-specific Markdown files into subdirectory [#4806](https://github.com/mapbox/mapbox-gl-js/pull/4806) @tomscholz

## 0.37.0 (May 2nd, 2017)

#### :warning: Breaking changes

- Removed `LngLat#wrapToBestWorld`

#### New features :rocket:

- Improve popup/marker positioning #4577
- Add `Map#isStyleLoaded` and `Map#areTilesLoaded` events #4321
- Support offline sprites using `file:` protocol #4649 @oscarfonts

#### Bug fixes :bug:

- Fix fullscreen control in Firefox #4666
- Fix rendering artifacts that caused tile boundaries to be visible in some cases #4636
- Fix default calculation for categorical zoom-and-property functions #4657
- Fix scaling of images on retina screens #4645
- Rendering error when a transparent image is added via `Map#addImage` #4644
- Fix an issue with rendering lines with duplicate points #4634
- Fix error when switching from data-driven styles to a constant paint value #4611
- Add check to make sure invalid bounds on tilejson don't error out #4641

#### Development workflow improvements :computer:

- Add flowtype interfaces and definitions @vicapow
- Add stylelinting to ensure `mapboxgl-` prefix on all classes #4584 @asantos3026

## 0.36.0 (April 19, 2017)

#### New features :sparkles:

- Replace LogoControl logo with the new Mapbox logo #4598

#### Bug fixes :bug:

- Fix bug with the BoxZoomHandler that made it glitchy if it is enabled after the DragPanHandler #4528
- Fix undefined behavior in `fill_outline` shaders #4600
- Fix `Camera#easeTo` interpolation on pitched maps #4540
- Choose property function interpolation method by the `property`'s type #4614

#### Development workflow improvements :nerd_face:

- Fix crash on missing `style.json` in integration tests
- `gl-style-composite` is now executable in line with the other tools @andrewharvey #4595
- `gl-style-composite` utility now throws an error if a name conflict would occur between layers @andrewharvey #4595

## 0.35.1 (April 12, 2017)

#### Bug fixes :bug:

- Add `.json` extension to style-spec `require` statements for webpack compatibility #4563 @orangemug
- Fix documentation type for `Map#fitBounde` #4569 @andrewharvey
- Fix bug causing {Image,Video,Canvas}Source to throw exception if latitude is outside of +/-85.05113 #4574
- Fix bug causing overzoomed raster tiles to disappear from map #4567
- Fix bug causing queryRenderedFeatures to crash on polygon features that have an `id` field. #4581

## 0.35.0 (April 7, 2017)

#### New features :rocket:
- Use anisotropic filtering to improve rendering of raster tiles on pitched maps #1064
- Add `pitchstart` and `pitchend` events #2449
- Add an optional `layers` parameter to `Map#on` #1002
- Add data-driven styling support for `text-offset` #4495
- Add data-driven styling support for `text-rotate` #3516
- Add data-driven styling support for `icon-image` #4304
- Add data-driven styling support for `{text,icon}-size` #4455

#### Bug fixes :bug:
- Suppress error messages in JS console due to missing tiles #1800
- Fix bug wherein `GeoJSONSource#setData()` could cause unnecessary DOM updates #4447
- Fix bug wherein `Map#flyTo` did not respect the `renderWorldCopies` setting #4449
- Fix regression in browserify support # 4453
- Fix bug causing poor touch event behavior on mobile devices #4259
- Fix bug wherein duplicate stops in property functions could cause an infinite loop #4498
- Respect image height/width in `addImage` api #4531
- Fix bug preventing correct behavior of `shift+zoom` #3334
- Fix bug preventing image source from rendering when coordinate area is too large #4550
- Show image source on horizontally wrapped worlds #4555
- Fix bug in the handling of `refreshedExpiredTiles` option #4549
- Support the TileJSON `bounds` property #1775

#### Development workflow improvements :computer:
- Upgrade flow to 0.42.0 (#4500)


## 0.34.0 (March 17, 2017)

#### New features :rocket:
- Add `Map#addImage` and `Map#removeImage` API to allow adding icon images at runtime #4404
- Simplify non-browserify bundler usage by making the distribution build the main entrypoint #4423

#### Bug fixes :bug:
- Fix issue where coincident start/end points of LineStrings were incorrectly rendered as joined #4413
- Fix bug causing `queryRenderedFeatures` to fail in cases where both multiple sources and data-driven paint properties were present #4417
- Fix bug where tile request errors caused `map.loaded()` to incorrectly return `false` #4425

#### Testing improvements :white_check_mark:
- Improve test coverage across several core modules #4432 #4431 #4422 #4244 :bowing_man:

## 0.33.1 (March 10, 2017)

#### Bug fixes :bug:
- Prevent Mapbox logo from being added to the map more than once #4386
- Add `type='button'` to `FullscreenControl` to prevent button from acting as a form submit #4397
- Fix issue where map would continue to rotate if `Ctrl` key is released before the click during a `DragRotate` event #4389
- Remove double `options.easing` description from the `Map#fitBounds` documentation #4402


## 0.33.0 (March 8, 2017)

#### :warning: Breaking changes
- Automatically add Mapbox wordmark when required by Mapbox TOS #3933
- Increase default `maxZoom` from 20 to 22 #4333
- Deprecate `tiledata` and `tiledataloading` events in favor of `sourcedata` and `sourcedataloading`. #4347
- `mapboxgl.util` is no longer exported #1408
- `"type": "categorical"` is now required for all categorical functions. Previously, some forms of "implicitly" categorical functions worked, and others did not. #3717

#### :white_check_mark: New features
- Add property functions support for most symbol paint properties #4074, #4186, #4226
- Add ability to specify default property value for undefined or invalid property values used in property functions. #4175
- Improve `Map#fitBounds` to accept different values for top, bottom, left, and right `padding` #3890
- Add a `FullscreenControl` for displaying a fullscreen map #3977

#### :beetle: Bug fixes
- Fix validation error on categorical zoom-and-property functions #4220
- Fix bug causing expired resources to be re-requested causing an infinite loop #4255
- Fix problem where `MapDataEvent#isSourceLoaded` always returned false #4254
- Resolve an issue where tiles in the source cache were prematurely deleted, resulting in tiles flickering when zooming in and out and  #4311
- Make sure `MapEventData` is passed through on calls `Map#flyTo` #4342
- Fix incorrect returned values for `Map#isMoving` #4350
- Fix categorical functions not allowing boolean stop domain values #4195
- Fix piecewise-constant functions to allow non-integer zoom levels. #4196
- Fix issues with `$id` in filters #4236 #4237
- Fix a race condition with polygon centroid algorithm causing tiles not to load in some cases. #4273
- Throw a meaningful error when giving non-array `layers` parameter to `queryRenderedFeatures` #4331
- Throw a meaningful error when supplying invalid `minZoom` and `maxZoom` values #4324
- Fix a memory leak when using the RTL Text plugin #4248

#### Dev workflow changes
- Merged the [Mapbox GL style specification](https://github.com/mapbox/mapbox-gl-style-spec) repo to this one (now under `src/style-spec` and `test/unit/style-spec`).

## 0.32.1 (Jan 26, 2017)

#### Bug Fixes

 - Fix bug causing [`mapbox-gl-rtl-text` plugin](https://github.com/mapbox/mapbox-gl-rtl-text) to not work #4055

## 0.32.0 (Jan 26, 2017)

#### Deprecation Notices

- [Style classes](https://www.mapbox.com/mapbox-gl-style-spec/#layer-paint.*) are deprecated and will be removed in an upcoming release of Mapbox GL JS.

#### New Features

 - Add `Map#isSourceLoaded` method #4033
 - Automatically reload tiles based on their `Expires` and `Cache-Control` HTTP headers #3944
 - Add `around=center` option to `scrollZoom` and `touchZoomRotate` interaction handlers #3876
 - Add support for [`mapbox-gl-rtl-text` plugin](https://github.com/mapbox/mapbox-gl-rtl-text) to support right-to-left scripts #3758
 - Add `canvas` source type #3765
 - Add `Map#isMoving` method #2792

#### Bug Fixes

 - Fix bug causing garbled text on zoom #3962
 - Fix bug causing crash in Firefox and Mobile Safari when rendering a large map #4037
 - Fix bug causing raster tiles to flicker during zoom #2467
 - Fix bug causing exception when unsetting and resetting fill-outline-color #3657
 - Fix memory leak when removing raster sources #3951
 - Fix bug causing exception when when zooming in / out on empty GeoJSON tile #3985
 - Fix line join artifacts at very sharp angles #4008

## 0.31.0 (Jan 10 2017)

#### New Features

- Add `renderWorldCopies` option to the `Map` constructor to give users control over whether multiple worlds are rendered in a map #3885

#### Bug Fixes

- Fix performance regression triggered when `Map` pitch or bearing is changed #3938
- Fix null pointer exception caused by trying to clear an `undefined` source #3903

#### Miscellaneous

- Incorporate integration tests formerly at [`mapbox-gl-test-suite`](https://github.com/mapbox/mapbox-gl-test-suite) into this repository #3834

## 0.30.0 (Jan 5 2017)

#### New Features

 - Fire an error when map canvas is larger than allowed by `gl.MAX_RENDERBUFFER_SIZE` #2893
 - Improve error messages when referencing a nonexistent layer id #2597
 - Fire an error when layer uses a `geojson` source and specifies a `source-layer` #3896
 - Add inline source declaration syntax #3857
 - Improve line breaking behavior #3887

#### Performance Improvements

 - Improve `Map#setStyle` performance in some cases #3853

#### Bug Fixes

 - Fix unexpected popup positioning when some offsets are unspecified #3367
 - Fix incorrect interpolation in functions #3838
 - Fix incorrect opacity when multiple backgrounds are rendered #3819
 - Fix exception thrown when instantiating geolocation control in Safari #3844
 - Fix exception thrown when setting `showTileBoundaries` with no sources #3849
 - Fix incorrect rendering of transparent parts of raster layers in some cases #3723
 - Fix non-terminating render loop when zooming in in some cases #3399

## 0.29.0 (December 20 2016)

#### New Features

 - Add support for property functions for many style properties on line layers #3033
 - Make `Map#setStyle` smoothly transition to the new style #3621
 - Add `styledata`, `sourcedata`, `styledataloading`, and `sourcedataloading` events
 - Add `isSourceLoaded` and `source` properties to `MapDataEvent` #3590
 - Remove "max zoom" cap of 20 #3683
 - Add `circle-stroke-*` style properties #3672
 - Add a more helpful error message when the specified `container` element doesn't exist #3719
 - Add `watchPosition` option to `GeolocateControl` #3739
 - Add `positionOptions` option to `GeolocateControl` #3739
 - Add `aria-label` to map canvas #3782
 - Adjust multipoint symbol rendering behavior #3763
 - Add support for property functions for `icon-offset` #3791
 - Improved antialiasing on pitched lines #3790
 - Allow attribution control to collapse to an ⓘ button on smaller screens #3783
 - Improve line breaking algorithm #3743

#### Performance Improvements

 - Fix memory leak when calling `Map#removeSource` #3602
 - Reduce bundle size by adding custom build of `gl-matrix` #3734
 - Improve performance of projection code #3721
 - Improve performance of style function evaluation #3816

#### Bug fixes

 - Fix exception thrown when using `line-color` property functions #3639
 - Fix exception thrown when removing a layer and then adding another layer with the same id but different type #3655
 - Fix exception thrown when passing a single point to `Map#fitBounds` #3655
 - Fix exception thrown occasionally during rapid map mutations #3681
 - Fix rendering defects on pitch=0 on some systems #3740
 - Fix unnecessary CPU usage when displaying a raster layer #3764
 - Fix bug causing sprite after `Map#setStyle` #3829
 - Fix bug preventing `Map` from emitting a `contextmenu` event on Windows browsers #3822

## 0.28.0 (November 17 2016)

#### New features and improvements

- Performance improvements for `Map#addLayer` and `Map#removeLayer` #3584
- Add method for changing layer order at runtime - `Map#moveLayer` #3584
- Update vertical punctuation logic to Unicode 9.0 standard #3608

#### Bug fixes

- Fix data-driven `fill-opacity` rendering when using a `fill-pattern` #3598
- Fix line rendering artifacts #3627
- Fix incorrect rendering of opaque fills on top of transparent fills #2628
- Prevent `AssertionErrors` from pitching raster layers by only calling `Worker#redoPlacement` on vector and GeoJSON sources #3624
- Restore IE11 compatability #3635
- Fix symbol placement for cached tiles #3637


## 0.27.0 (November 11 2016)

#### ⚠️ Breaking changes ⚠️

- Replace `fill-extrude-height` and `fill-extrude-base` properties of `fill` render type with a separate `fill-extrusion` type (with corresponding `fill-extrusion-height` and `fill-extrusion-base` properties), solving problems with render parity and runtime switching between flat and extruded fills. https://github.com/mapbox/mapbox-gl-style-spec/issues/554
- Change the units for extrusion height properties (`fill-extrusion-height`, `fill-extrusion-base`) from "magic numbers" to meters. #3509
- Remove `mapboxgl.Control` class and change the way custom controls should be implemented. #3497
- Remove `mapboxgl.util` functions: `inherit`, `extendAll`, `debounce`, `coalesce`, `startsWith`, `supportsGeolocation`. #3441 #3571
- **`mapboxgl.util` is deprecated** and will be removed in the next release. #1408

#### New features and improvements

- Tons of **performance improvements** that combined make rendering **up to 3 times faster**, especially for complex styles. #3485 #3489 #3490 #3491 #3498 #3499 #3501 #3510 #3514 #3515 #3486 #3527 #3574 ⚡️⚡️⚡️
- 🈯 Added **vertical text writing mode** for languages that support it. #3438
- 🈯 Improved **line breaking of Chinese and Japanese text** in point-placed labels. #3420
- Reduce the default number of worker threads (`mapboxgl.workerCount`) for better performance. #3565
- Automatically use `categorical` style function type when input values are strings. #3384
- Improve control buttons accessibility. #3492
- Remove geolocation button if geolocation is disabled (e.g. the page is not served through `https`). #3571
- Added `Map#getMaxZoom` and `Map#getMinZoom` methods #3592

#### Bugfixes

- Fix several line dash rendering bugs. #3451
- Fix intermittent map flicker when using image sources. #3522
- Fix incorrect rendering of semitransparent `background` layers. #3521
- Fix broken `raster-fade-duration` property. #3532
- Fix handling of extrusion heights with negative values (by clamping to `0`). #3463
- Fix GeoJSON sources not placing labels/icons correctly after map rotation. #3366
- Fix icon/label placement not respecting order for layers with numeric names. #3404
- Fix `queryRenderedFeatures` working incorrectly on colliding labels. #3459
- Fix a bug where changing extrusion properties at runtime sometimes threw an error. #3487 #3468
- Fix a bug where `map.loaded()` always returned `true` when using raster tile sources. #3302
- Fix a bug where moving the map out of bounds sometimes threw `failed to invert matrix` error. #3518
- Fixed `queryRenderedFeatures` throwing an error if no parameters provided. #3542
- Fixed a bug where using multiple `\n` in a text field resulted in an error. #3570

#### Misc

- 🐞 Fix `npm install mapbox-gl` pulling in all `devDependencies`, leading to an extremely slow install. #3377
- Switch the codebase to ES6. #3388 #3408 #3415 #3421
- A lot of internal refactoring to make the codebase simpler and more maintainable.
- Various documentation fixes. #3440

## 0.26.0 (October 13 2016)

#### New Features & Improvements

 * Add `fill-extrude-height` and `fill-extrude-base` style properties (3d buildings) :cityscape: #3223
 * Add customizable `colorSpace` interpolation to functions #3245
 * Add `identity` function type #3274
 * Add depth testing for symbols with `'pitch-alignment': 'map'` #3243
 * Add `dataloading` events for styles and sources #3306
 * Add `Control` suffix to all controls :warning: BREAKING CHANGE :warning: #3355
 * Calculate style layer `ref`s automatically and get rid of user-specified `ref`s :warning: BREAKING CHANGE :warning: #3486

#### Performance Improvements

 * Ensure removing style or source releases all tile resources #3359

#### Bugfixes

 * Fix bug causing an error when `Marker#setLngLat` is called #3294
 * Fix bug causing incorrect coordinates in `touchend` on Android Chrome #3319
 * Fix bug causing incorrect popup positioning at top of screen #3333
 * Restore `tile` property to `data` events fired when a tile is removed #3328
 * Fix bug causing "Improve this map" link to not preload map location #3356

## 0.25.1 (September 30 2016)

#### Bugfixes

  * Fix bug causing attribution to not be shown #3278
  * Fix bug causing exceptions when symbol text has a trailing newline #3281

## 0.25.0 (September 29 2016)

#### Breaking Changes

  * `Evented#off` now require two arguments; omitting the second argument in order to unbind all listeners for an event
     type is no longer supported, as it could cause unintended unbinding of internal listeners.

#### New Features & Improvements

  * Consolidate undocumented data lifecycle events into `data` and `dataloading` events (#3255)
  * Add `auto` value for style spec properties (#3203)

#### Bugfixes

  * Fix bug causing "Map#queryRenderedFeatures" to return no features after map rotation or filter change (#3233)
  * Change webpack build process (#3235) :warning: BREAKING CHANGE :warning:
  * Improved error messages for `LngLat#convert` (#3232)
  * Fix bug where the `tiles` field is omitted from the `RasterTileSource#serialize` method (#3259)
  * Comply with HTML spec by replacing the `div` within the `Navigation` control `<button>` with a `span` element (#3268)
  * Fix bug causing `Marker` instances to be translated to non-whole pixel coordinates that caused blurriness (#3270)

#### Performance Improvements

  * Avoid unnecessary style validation (#3224)
  * Share a single blob URL between all workers (#3239)

## 0.24.0 (September 19 2016)

#### New Features & Improvements

 * Allow querystrings in `mapbox://` URLs #3113
 * Allow "drag rotate" interaction to control pitch #3105
 * Improve performance by decreasing `Worker` script `Blob` size #3158
 * Improve vector tile performance #3067
 * Decrease size of distributed library by removing `package.json` #3174
 * Add support for new lines in `text-field` #3179
 * Make keyboard navigation smoother #3190
 * Make mouse wheel zooming smoother #3189
 * Add better error message when calling `Map#queryRenderedFeatures` on nonexistent layer #3196
 * Add support for imperial units on `Scale` control #3160
 * Add map's pitch to URL hash #3218

#### Bugfixes

 * Fix exception thrown when using box zoom handler #3078
 * Ensure style filters cannot be mutated by reference #3093
 * Fix exceptions thrown when opening marker-bound popup by click #3104
 * Fix bug causing fills with transparent colors and patterns to not render #3107
 * Fix order of latitudes in `Map#getBounds` #3081
 * Fix incorrect evaluation of zoom-and-property functions #2827 #3155
 * Fix incorrect evaluation of property functions #2828 #3155
 * Fix bug causing garbled text rendering when multiple maps are rendered on the page #3086
 * Fix rendering defects caused by `Map#setFilter` and map rotation on iOS 10 #3207
 * Fix bug causing image and video sources to disappear when zooming in #3010


## 0.23.0 (August 25 2016)

#### New Features & Improvements

* Add support for `line-color` property functions #2938
* Add `Scale` control #2940 #3042
* Improve polygon label placement by rendering labels at the pole of inaccessability #3038
* Add `Popup` `offset` option #1962
* Add `Marker#bindPopup` method #3056

#### Performance Improvements

* Improve performance of pages with multiple maps using a shared `WebWorker` pool #2952

#### Bugfixes

* Make `LatLngBounds` obey its documented argument order (`southwest`, `northeast`), allowing bounds across the dateline #2414 :warning: **BREAKING CHANGE** :warning:
* Fix bug causing `fill-opacity` property functions to not render as expected #3061

## 0.22.1 (August 18 2016)

#### New Features & Improvements

 * Reduce library size by using minified version of style specification #2998
 * Add a warning when rendering artifacts occur due to too many symbols or glyphs being rendered in a tile #2966

#### Bugfixes

 * Fix bug causing exception to be thrown by `Map#querySourceFeatures` #3022
 * Fix bug causing `Map#loaded` to return true while there are outstanding tile updates #2847

## 0.22.0 (August 11 2016)

#### Breaking Changes

 * The `GeoJSONSource`, `VideoSource`, `ImageSource` constructors are now private. Please use `map.addSource({...})` to create sources and `map.getSource(...).setData(...)` to update GeoJSON sources. #2667
 * `Map#onError` has been removed. You may catch errors by listening for the `error` event. If no listeners are bound to `error`, error messages will be printed to the console. #2852

#### New Features & Improvements

 * Increase max glyph atlas size to accomodate alphabets with large numbers of characters #2930
 * Add support for filtering features on GeoJSON / vector tile `$id` #2888
 * Update geolocate icon #2973
 * Add a `close` event to `Popup`s #2953
 * Add a `offset` option to `Marker` #2885
 * Print `error` events without any listeners to the console #2852
 * Refactored `Source` interface to prepare for custom source types #2667

#### Bugfixes

 * Fix opacity property-functions for fill layers #2971
 * Fix `DataCloneError` in Firefox and IE11 #2559
 * Fix bug preventing camera animations from being triggered in `moveend` listeners #2944
 * Fix bug preventing `fill-outline-color` from being unset #2964
 * Fix webpack support #2887
 * Prevent buttons in controls from acting like form submit buttons #2935
 * Fix bug preventing map interactions near two controls in the same corner #2932
 * Fix crash resulting for large style batch queue #2926

## 0.21.0 (July 13 2016)

#### Breaking Changes

 * GeoJSON polygon inner rings are now rewound for compliance with the [v2 vector tile](https://github.com/mapbox/vector-tile-spec/blob/master/2.1/README.md#4344-polygon-geometry-type). This may affect some uses of `line-offset`, reversing the direction of the offset. #2889

#### New Features & Improvements

 * Add `text-pitch-alignment` style property #2668
 * Allow query parameters on `mapbox://` URLs #2702
 * Add `icon-text-fit` and `icon-text-fit-padding` style properties #2720
 * Enable property functions for `icon-rotate` #2738
 * Enable property functions for `fill-opacity` #2733
 * Fire `Map#mouseout` events #2777
 * Allow query parameters on all sprite URLs #2772
 * Increase sprite atlas size to 1024px square, allowing more and larger sprites #2802
 * Add `Marker` class #2725 #2810
 * Add `{quadkey}` URL parameter #2805
 * Add `circle-pitch-scale` style property #2821

#### Bugfixes

 * Fix rendering of layers with large numbers of features #2794
 * Fix exceptions thrown during drag-rotate interactions #2840
 * Fix error when adding and removing a layer within the same update cycle #2845
 * Fix false "Geometry exceeds allowed extent" warnings #2568
 * Fix `Map#loaded` returning true while there are outstanding tile updates #2847
 * Fix style validation error thrown while removing a filter #2847
 * Fix event data object not being passed for double click events #2814
 * Fix multipolygons disappearing from map at certain zoom levels #2704
 * Fix exceptions caused by `queryRenderedFeatures` in Safari and Firefox #2822
 * Fix `mapboxgl#supported()` returning `true` in old versions of IE11 mapbox/mapbox-gl-supported#1

## 0.20.1 (June 21 2016)

#### Bugfixes

* Fixed exception thrown when changing `*-translate` properties via `setPaintProperty` (#2762)

## 0.20.0 (June 10 2016)

#### New Features & Improvements

 * Add limited WMS support #2612
 * Add `workerCount` constructor option #2666
 * Improve performance of `locationPoint` and `pointLocation` #2690
 * Remove "Not using VertexArrayObject extension" warning messages #2707
 * Add `version` property to mapboxgl #2660
 * Support property functions in `circle-opacity` and `circle-blur` #2693

#### Bugfixes

* Fix exception thrown by "drag rotate" handler #2680
* Return an empty array instead of an empty object from `queryRenderedFeatures` #2694
* Fix bug causing map to not render in IE

## 0.19.1 (June 2 2016)

#### Bugfixes

* Fix rendering of polygons with more than 35k vertices #2657

## 0.19.0 (May 31 2016)

#### New Features & Improvements

* Allow use of special characters in property field names #2547
* Improve rendering speeds on fill layers #1606
* Add data driven styling support for `fill-color` and `fill-outline-color` #2629
* Add `has` and `!has` filter operators mapbox/feature-filter#15
* Improve keyboard handlers with held-down keys #2530
* Support 'tms' tile scheme #2565
* Add `trackResize` option to `Map` #2591

#### Bugfixes

* Scale circles when map is displayed at a pitch #2541
* Fix background pattern rendering bug #2557
* Fix bug that prevented removal of a `fill-pattern` from a fill layer #2534
* Fix `line-pattern` and `fill-pattern`rendering #2596
* Fix some platform specific rendering bugs #2553
* Return empty object from `queryRenderedFeatures` before the map is loaded #2621
* Fix "there is no texture bound to the unit 1" warnings #2509
* Allow transitioned values to be unset #2561

## 0.18.0 (April 13 2016)

#### New Features & Improvements

* Implement zoom-and-property functions for `circle-color` and `circle-size` #2454
* Dedupe attributions that are substrings of others #2453
* Misc performance improvements #2483 #2488

#### Bugfixes

* Fix errors when unsetting and resetting a style property #2464
* Fix errors when updating paint properties while using classes #2496
* Fix errors caused by race condition in unserializeBuckets #2497
* Fix overzoomed tiles in wrapped worlds #2482
* Fix errors caused by mutating a filter object after calling `Map#setFilter` #2495

## 0.17.0 (April 13 2016)

#### Breaking Changes

* Remove `map.batch` in favor of automatically batching style mutations (i.e. calls to `Map#setLayoutProperty`, `Map#setPaintProperty`, `Map#setFilter`, `Map#setClasses`, etc.) and applying them once per frame, significantly improving performance when updating the style frequently #2355 #2380
* Remove `util.throttle` #2345

#### New Features & Improvements

* Improve performance of all style mutation methods by only recalculating affected properties #2339
* Improve fading of labels and icons #2376
* Improve rendering performance by reducing work done on the main thread #2394
* Validate filters passed to `Map#queryRenderedFeatures` and `Map#querySourceFeatures` #2349
* Display a warning if a vector tile's geometry extent is larger than supported  #2383
* Implement property functions (i.e. data-driven styling) for `circle-color` and `circle-size` #1932
* Add `Popup#setDOMContent` method #2436

#### Bugfixes

* Fix a performance regression caused by using 1 `WebWorker` instead of `# cpus - 1` `WebWorker`s, slowing down tile loading times #2408
* Fix a bug in which `Map#queryRenderedFeatures` would sometimes return features that had been removed #2353
* Fix `clusterMaxZoom` option on `GeoJSONSource` not working as expected #2374
* Fix anti-aliased rendering for pattern fills #2372
* Fix exception caused by calling `Map#queryRenderedFeatures` or `Map#querySourceFeatures` with no arguments
* Fix exception caused by calling `Map#setLayoutProperty` for `text-field` or `icon-image` #2407

## 0.16.0 (March 24 2016)

#### Breaking Changes

* Replace `Map#featuresAt` and `Map#featuresIn` with `Map#queryRenderedFeatures` and `map.querySourceFeatures` (#2224)
    * Replace `featuresAt` and `featuresIn` with `queryRenderedFeatures`
    * Make `queryRenderedFeatures` synchronous, remove the callback and use the return value.
    * Rename `layer` parameter to `layers` and make it an array of layer names.
    * Remove the `radius` parameter. `radius` was used with `featuresAt` to account for style properties like `line-width` and `circle-radius`. `queryRenderedFeatures` accounts for these style properties. If you need to query a larger area, use a bounding box query instead of a point query.
    * Remove the `includeGeometry` parameter because `queryRenderedFeatures` always includes geometries.
* `Map#debug` is renamed to `Map#showTileBoundaries` (#2284)
* `Map#collisionDebug` is renamed to `Map#showCollisionBoxes` (#2284)

#### New Features & Improvements

* Improve overall rendering performance. (#2221)
* Improve performance of `GeoJSONSource#setData`. (#2222)
* Add `Map#setMaxBounds` method (#2234)
* Add `isActive` and `isEnabled` methods to interaction handlers (#2238)
* Add `Map#setZoomBounds` method (#2243)
* Add touch events (#2195)
* Add `map.queryRenderedFeatures` to query the styled and rendered representations of features (#2224)
* Add `map.querySourceFeatures` to get features directly from vector tiles, independent of the style (#2224)
* Add `mapboxgl.Geolocate` control (#1939)
* Make background patterns render seamlessly across tile boundaries (#2305)

#### Bugfixes

* Fix calls to `setFilter`, `setLayoutProperty`, and `setLayerZoomRange` on ref children (#2228)
* Fix `undefined` bucket errors after `setFilter` calls (#2244)
* Fix bugs causing hidden symbols to be rendered (#2246, #2276)
* Fix raster flickering (#2236)
* Fix `queryRenderedFeatures` precision at high zoom levels (#2292)
* Fix holes in GeoJSON data caused by unexpected winding order (#2285)
* Fix bug causing deleted features to be returned by `queryRenderedFeatures` (#2306)
* Fix bug causing unexpected fill patterns to be rendered (#2307)
* Fix popup location with preceding sibling elements (#2311)
* Fix polygon anti-aliasing (#2319)
* Fix slivers between non-adjacent polygons (#2319)
* Fix keyboard shortcuts causing page to scroll (#2312)

## 0.15.0 (March 1 2016)

#### New Features & Improvements

* Add `ImageSource#setCoordinates` and `VideoSource#setCoordinates` (#2184)

#### Bugfixes

* Fix flickering on raster layers (#2211)
* Fix browser hang when zooming quickly on raster layers (#2211)

## 0.14.3 (Feb 25 2016)

#### New Features & Improvements

* Improve responsiveness of zooming out by using cached parent tiles (#2168)
* Improve contextual clues on style API validation (#2170)
* Improve performance of methods including `setData` (#2174)

#### Bugfixes

* Fix incorrectly sized line dashes (#2099)
* Fix bug in which `in` feature filter drops features (#2166)
* Fix bug preventing `Map#load` from firing when tile "Not Found" errors occured (#2176)
* Fix rendering artifacts on mobile GPUs (#2117)

## 0.14.2 (Feb 19 2016)

#### Bugfixes

* Look for loaded parent tiles in cache
* Set tile cache size based on viewport size (#2137)
* Fix tile render order for layer-by-layer
* Remove source update throttling (#2139)
* Make panning while zooming more linear (#2070)
* Round points created during bucket creation (#2067)
* Correct bounds for a rotated or tilted map (#1842)
* Fix overscaled featuresAt (#2103)
* Allow using `tileSize: 512` as a switch to trade retina support for 512px raster tiles
* Fix the serialization of paint classes (#2107)
* Fixed bug where unsetting style properties could mutate the value of other style properties (#2105)
* Less slanted dashed lines near sharp corners (#967)
* Fire map#load if no initial style is set (#2042)

## 0.14.1 (Feb 10 2016)

#### Bugfixes

* Fix incorrectly rotated symbols along lines near tile boundries (#2062)
* Fix broken rendering when a fill layer follows certain symbol layers (#2092)

## 0.14.0 (Feb 8 2016)

#### Breaking Changes

* Switch `GeoJSONSource` clustering options from being measured in extent-units to pixels (#2026)

#### New Features & Improvements

* Improved error message for invalid colors (#2006)
* Added support for tiles with variable extents (#2010)
* Improved `filter` performance and maximum size (#2024)
* Changed circle rendering such that all geometry nodes are drawn, not just the geometry's outer ring (#2027)
* Added `Map#getStyle` method (#1982)

#### Bugfixes

* Fixed bug causing WebGL contexts to be "used up" by calling `mapboxgl.supported()` (#2018)
* Fixed non-deterministic symbol z-order sorting (#2023)
* Fixed garbled labels while zooming (#2012)
* Fixed icon jumping when touching trackpad with two fingers (#1990)
* Fixed overzoomed collision debug labels (#2033)
* Fixed dashes sliding along their line during zooming (#2039)
* Fixed overscaled `minzoom` setting for GeoJSON sources (#1651)
* Fixed overly-strict function validation for duplicate stops (#2075)
* Fixed crash due to `performance.now` not being present on some browsers (#2056)
* Fixed the unsetting of paint properties (#2037)
* Fixed bug causing multiple interaction handler event listeners to be attached (#2069)
* Fixed bug causing only a single debug box to be drawn (#2034)

## 0.13.1 (Jan 27 2016)

#### Bugfixes

* Fixed broken npm package due to outdated bundled modules

## 0.13.0 (Jan 27 2016)

#### Bugfixes

* Fixed easeTo pan, zoom, and rotate when initial rotation != 0 (#1950)
* Fixed rendering of tiles with an extent != 4096 (#1952)
* Fixed missing icon collision boxes (#1978)
* Fixed null `Tile#buffers` errors (#1987)

#### New Features & Improvements

* Added `symbol-avoid-edges` style property (#1951)
* Improved `symbol-max-angle` check algorithm (#1959)
* Added marker clustering! (#1931)
* Added zoomstart, zoom, and zoomend events (#1958)
* Disabled drag on mousedown when using boxzoom (#1907)

## 0.12.4 (Jan 19 2016)

#### Bugfixes

* Fix elementGroups null value errors (#1933)
* Fix some glyph atlas overflow cases (#1923)

## 0.12.3 (Jan 14 2016)

#### API Improvements
* Support inline attribution options in map options (#1865)
* Improve flyTo options (#1854, #1429)

#### Bugfixes
* Fix flickering with overscaled tiles (#1921)
* Remove Node.remove calls for IE browser compatibility (#1900)
* Match patterns at tile boundaries (#1908)
* Fix Tile#positionAt, fix query tests (#1899)
* Fix flickering on streets (#1875)
* Fix text-max-angle property (#1870)
* Fix overscaled line patterns (#1856)
* Fix patterns and icons for mismatched pixelRatios (#1851)
* Fix missing labels when text size 0 at max zoom (#1809)
* Use linear interp when pixel ratios don't match (#1601)
* Fix blank areas, flickering in raster layers (#1876, #675)
* Fix labels slipping/cropping at tile bounds (#757)

#### UX Improvements
* Improve touch handler perceived performance (#1844)

## 0.12.2 (Dec 22 2015)

#### API Improvements

* Support LngLat.convert([w, s, e, n]) (#1812)
* Invalid GeoJSON is now handled better

#### Bugfixes

* Fixed `Popup#addTo` when the popup is already open (#1811)
* Fixed warping when rotating / zooming really fast
* `Map#flyTo` now flies across the antimeridan if shorter (#1853)

## 0.12.1 (Dec 8 2015)

#### Breaking changes

* Reversed the direction of `line-offset` (#1808)
* Renamed `Pinch` interaction handler to `TouchZoomRotate` (#1777)
* Made `Map#update` and `Map#render` private methods (#1798)
* Made `Map#remove` remove created DOM elements (#1789)

#### API Improvements

* Added an method to disable touch rotation (#1777)
* Added a `position` option for `Attribution` (#1689)

#### Bugfixes

* Ensure tile loading errors are properly reported (#1799)
* Ensure re-adding a previously removed pop-up works (#1477)

#### UX Improvements

* Don't round zoom level during double-click interaction (#1640)

## 0.12.0 (Dec 2 2015)

#### API Improvements

* Added `line-offset` style property (#1778)

## 0.11.5 (Dec 1 2015)

#### Bugfixes

* Fixed unstable symbol layer render order when adding / removing layers (#1558)
* Fire map loaded event even if raster tiles have errors
* Fix panning animation during easeTo with zoom change
* Fix pitching animation during flyTo
* Fix pitching animation during easeTo
* Prevent rotation from firing `mouseend` events (#1104)

#### API Improvements

* Fire `mousedown` and `mouseup` events (#1411)
* Fire `movestart` and `moveend` when panning (#1658)
* Added drag events (#1442)
* Request webp images for mapbox:// raster tiles in chrome (#1725)

#### UX Improvements

* Added inertia to map rotation (#620)

## 0.11.4 (Nov 16 2015)

#### Bugfixes

* Fix alpha blending of alpha layers (#1684)

## 0.11.3 (Nov 10 2015)

#### Bugfixes

* Fix GeoJSON rendering and performance (#1685)

#### UX Improvements

* Use SVG assets for UI controls (#1657)
* Zoom out with shift + dblclick (#1666)

## 0.11.2 (Oct 29 2015)

* Misc performance improvements

#### Bugfixes

* Fix sprites on systems with non-integer `devicePixelRatio`s (#1029 #1475 #1476)
* Fix layer minZoom being ignored if not less than source maxZoom
* Fix symbol placement at the start of a line (#1461)
* Fix `raster-opacity` on non-tile sources (#1270)
* Ignore boxzoom on shift-click (#1655)

#### UX Improvements

* Enable line breaks on common punctuation (#1115)

#### API Improvements

* Add toString and toArray methods to LngLat, LngLatBounds (#1571)
* Add `Transform#resize` method
* Add `Map#getLayer` method (#1183)
* Add `Transform#unmodified` property (#1452)
* Propagate WebGL context events (#1612)

## 0.11.1 (Sep 30 2015)

#### Bugfixes

* Add statistics and checkboxes to debug page
* Fix `Map#featuresAt` for non-4096 vector sources (#1529)
* Don't fire `mousemove` on drag-pan
* Fix maxBounds constrains (#1539)
* Fix maxBounds infinite loop (#1538)
* Fix memory leak in worker
* Assert valid `TileCoord`, fix wrap calculation in `TileCoord#cover` (#1483)
* Abort raster tile load if not in viewport (#1490)

#### API Improvements

* Add `Map` event listeners for `mouseup`, `contextmenu` (right click) (#1532)


## 0.11.0 (Sep 11 2015)

#### API Improvements

* Add `Map#featuresIn`: a bounding-box feature query
* Emit stylesheet validation errors (#1436)

#### UX Improvements

* Handle v8 style `center`, `zoom`, `bearing`, `pitch` (#1452)
* Improve circle type styling (#1446)
* Improve dashed and patterned line antialiasing

#### Bugfixes

* Load images in a way that respects Cache-Control headers
* Filter for rtree matches to those crossing bbox
* Log errors by default (#1463)
* Fixed modification of `text-size` via `setLayoutProperty` (#1451)
* Throw on lat > 90 || < -90. (#1443)
* Fix circle clipping bug (#1457)


## 0.10.0 (Aug 21 2015)

#### Breaking changes

* Switched to [longitude, latitude] coordinate order, matching GeoJSON. We anticipate that mapbox-gl-js will be widely used
  with GeoJSON, and in the long term having a coordinate order that is consistent with GeoJSON will lead to less confusion
  and impedance mismatch than will a [latitude, longitude] order.

  The following APIs were renamed:

    * `LatLng` was renamed to `LngLat`
    * `LatLngBounds` was renamed to `LngLatBounds`
    * `Popup#setLatLng` was renamed to `Popup#setLngLat`
    * `Popup#getLatLng` was renamed to `Popup#getLngLat`
    * The `latLng` property of Map events was renamed `lngLat`

  The following APIs now expect array coordinates in [longitude, latitude] order:

    * `LngLat.convert`
    * `LngLatBounds.convert`
    * `Popup#setLngLat`
    * The `center` and `maxBounds` options of the `Map` constructor
    * The arguments to `Map#setCenter`, `Map#fitBounds`, `Map#panTo`, and `Map#project`
    * The `center` option of `Map#jumpTo`, `Map#easeTo`, and `Map#flyTo`
    * The `around` option of `Map#zoomTo`, `Map#rotateTo`, and `Map#easeTo`
    * The `coordinates` properties of video and image sources

* Updated to mapbox-gl-style-spec v8.0.0 ([Changelog](https://github.com/mapbox/mapbox-gl-style-spec/blob/v8.0.0/CHANGELOG.md)). Styles are
  now expected to be version 8. You can use the [gl-style-migrate](https://github.com/mapbox/mapbox-gl-style-lint#migrations)
  utility to update existing styles.

* The format for `mapbox://` style and glyphs URLs has changed. For style URLs, you should now use the format
  `mapbox://styles/:username/:style`. The `:style` portion of the URL no longer contains a username. For font URLs, you
  should now use the format `mapbox://fonts/:username/{fontstack}/{range}.pbf`.
* Mapbox default styles are now hosted via the Styles API rather than www.mapbox.com. You can make use of the Styles API
  with a `mapbox://` style URL pointing to a v8 style, e.g. `mapbox://styles/mapbox/streets-v8`.
* The v8 satellite style (`mapbox://styles/mapbox/satellite-v8`) is now a plain satellite style, and not longer supports labels
  or contour lines via classes. For a labeled satellite style, use `mapbox://styles/mapbox/satellite-hybrid`.

* Removed `mbgl.config.HTTP_URL` and `mbgl.config.FORCE_HTTPS`; https is always used when connecting to the Mapbox API.
* Renamed `mbgl.config.HTTPS_URL` to `mbgl.config.API_URL`.

#### Bugfixes

* Don't draw halo when halo-width is 0 (#1381)
* Reverted shader changes that degraded performance on IE

#### API Improvements

* You can now unset layout and paint properties via the `setLayoutProperty` and `setPaintProperty` APIs
  by passing `undefined` as a property value.
* The `layer` option of `featuresAt` now supports an array of layers.

## 0.9.0 (Jul 29 2015)

* `glyphs` URL now normalizes without the `/v4/` prefix for `mapbox://` urls. Legacy behavior for `mapbox://fontstacks` is still maintained (#1385)
* Expose `geojson-vt` options for GeoJSON sources (#1271)
* bearing snaps to "North" within a tolerance of 7 degrees (#1059)
* Now you can directly mutate the minzoom and maxzoom layer properties with `map.setLayerZoomRange(layerId, minzoom, maxzoom)`
* Exposed `mapboxgl.Control`, a base class used by all UI controls
* Refactored handlers to be individually included in Map options, or enable/disable them individually at runtime, e.g. `map.scrollZoom.disable()`.
* New feature: Batch operations can now be done at once, improving performance for calling multiple style functions: (#1352)

  ```js
  style.batch(function(s) {
      s.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
      s.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
      s.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });
      s.setPaintProperty('first', 'text-color', 'black');
      s.setPaintProperty('first', 'text-halo-color', 'white');
  });
  ```
* Improved documentation
* `featuresAt` performance improvements by exposing `includeGeometry` option
* Better label placement along lines (#1283)
* Improvements to round linejoins on semi-transparent lines (mapbox/mapbox-gl-native#1771)
* Round zoom levels for raster tile loading (2a2aec)
* Source#reload cannot be called if source is not loaded (#1198)
* Events bubble to the canvas container for custom overlays (#1301)
* Move handlers are now bound on mousedown and touchstart events
* map.featuresAt() now works across the dateline

## 0.8.1 (Jun 16 2015)

* No code changes; released only to correct a build issue in 0.8.0.

## 0.8.0 (Jun 15 2015)

#### Breaking changes

* `map.setView(latlng, zoom, bearing)` has been removed. Use
  [`map.jumpTo(options)`](https://www.mapbox.com/mapbox-gl-js/api/#map/jumpto) instead:

  ```js
  map.setView([40, -74.50], 9) // 0.7.0 or earlier
  map.jumpTo({center: [40, -74.50], zoom: 9}); // now
  ```
* [`map.easeTo`](https://www.mapbox.com/mapbox-gl-js/api/#map/easeto) and
  [`map.flyTo`](https://www.mapbox.com/mapbox-gl-js/api/#map/flyto) now accept a single
  options object rather than positional parameters:

  ```js
  map.easeTo([40, -74.50], 9, null, {duration: 400}); // 0.7.0 or earlier
  map.easeTo({center: [40, -74.50], zoom: 9, duration: 400}); // now
  ```
* `mapboxgl.Source` is no longer exported. Use `map.addSource()` instead. See the
  [GeoJSON line](https://www.mapbox.com/mapbox-gl-js/example/geojson-line/) or
  [GeoJSON markers](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
  examples.
* `mapboxgl.util.supported()` moved to [`mapboxgl.supported()`](https://www.mapbox.com/mapbox-gl-js/api/#mapboxgl/supported).

#### UX improvements

* Add perspective rendering (#1049)
* Better and faster labelling (#1079)
* Add touch interactions support on mobile devices (#949)
* Viewport-relative popup arrows (#1065)
* Normalize mousewheel zooming speed (#1060)
* Add proper handling of GeoJSON features that cross the date line (#1275)
* Sort overlapping symbols in the y direction (#470)
* Control buttons are now on a 30 pixel grid (#1143)
* Improve GeoJSON processing performance

#### API Improvements

* Switch to JSDoc for documentation
* Bundling with browserify is now supported
* Validate incoming map styles (#1054)
* Add `Map` `setPitch` `getPitch`
* Add `Map` `dblclick` event. (#1168)
* Add `Map` `getSource` (660a8c1)
* Add `Map` `setFilter` and `getFilter` (#985)
* Add `Map` `failIfMajorPerformanceCaveat` option (#1082)
* Add `Map` `preserveDrawingBuffer` option (#1232)
* Add `VideoSource` `getVideo()` (#1162)
* Support vector tiles with extents other than 4096 (#1227)
* Use a DOM hierarchy that supports evented overlays (#1217)
* Pass `latLng` to the event object (#1068)

#### UX Bugfixes

* Fix rendering glitch on iOS 8 (#750)
* Fix line triangulation errors (#1120, #992)
* Support unicode range 65280-65535 (#1108)
* Fix cracks between fill patterns (#972)
* Fix angle of icons aligned with lines (37a498a)
* Fix dashed line bug for overscaled tiles (#1132)
* Fix icon artifacts caused by sprite neighbors (#1195)

#### API Bugfixes

* Don't fire spurious `moveend` events on mouseup (#1107)
* Fix a race condition in `featuresAt` (#1220)
* Fix for brittle fontstack name convention (#1070)
* Fix broken `Popup` `setHTML` (#1272)
* Fix an issue with cross-origin image requests (#1269)


## 0.7.0 (Mar 3 2015)

#### Breaking

* Rename `Map` `hover` event to `mousemove`.
* Change `featuresAt` to return GeoJSON objects, including geometry (#1010)
* Remove `Map` `canvas` and `container` properties, add `getCanvas` and `getContainer` methods instead

#### UX Improvements

* Improve line label density
* Add boxzoom interaction (#1038)
* Add keyboard interaction (#1034)
* Faster `GeoJSONSource` `setData` without flickering (#973)

#### API Improvements

* Add Popup component (#325)
* Add layer API (#1022)
* Add filter API (#985)
* More efficient filter API (#1018)
* Accept plain old JS object for `addSource` (#1021)
* Reparse overscaled tiles

#### Bugfixes

* Fix `featuresAt` for LineStrings (#1006)
* Fix `tileSize` argument to `GeoJSON` worker (#987)
* Remove extraneous files from the npm package (#1024)
* Hide "improve map" link in print (#988)


## 0.6.0 (Feb 9 2015)

#### Bugfixes

* Add wrapped padding to sprite for repeating images (#972)
* Clear color buffers before rendering (#966)
* Make line-opacity work with line-image (#970)
* event.toElement fallback for Firefox (#932)
* skip duplicate vertices at ends of lines (#776)
* allow characters outside \w to be used in token
* Clear old tiles when new GeoJSON is loaded (#905)

#### Improvements

* Added `map.setPaintProperty()`, `map.getPaintProperty()`, `map.setLayoutProperty()`, and `map.getLayoutProperty()`.
* Switch to ESLint and more strict code rules (#957)
* Grab 2x raster tiles if retina (#754)
* Support for mapbox:// style URLs (#875)

#### Breaking

* Updated to mapbox-gl-style-spec v7.0.0 ([Changelog](https://github.com/mapbox/mapbox-gl-style-spec/blob/a2b0b561ce16015a1ef400dc870326b1b5255091/CHANGELOG.md)). Styles are
  now expected to be version 7. You can use the [gl-style-migrate](https://github.com/mapbox/mapbox-gl-style-lint#migrations)
  utility to update existing styles.
* HTTP_URL and HTTPS_URL config options must no longer include a `/v4` path prefix.
* `addClass`, `removeClass`, `setClasses`, `hasClass`, and `getClasses` are now methods
  on Map.
* `Style#cascade` is now private, pending a public style mutation API (#755).
* The format for `featuresAt` results changed. Instead of result-per-geometry-cross-layer,
  each result has a `layers` array with all layers that contain the feature. This avoids
  duplication of geometry and properties in the result set.


## 0.5.2 (Jan 07 2015)

#### Bugfixes

* Remove tiles for unused sources (#863)
* Fix fill pattern alignment

#### Improvements

* Add GeoJSONSource maxzoom option (#760)
* Return ref layers in featuresAt (#847)
* Return any extra layer keys provided in the stylesheet in featuresAt
* Faster protobuf parsing

## 0.5.1 (Dec 19 2014)

#### Bugfixes

* Fix race conditions with style loading/rendering
* Fix race conditions with setStyle
* Fix map.remove()
* Fix featuresAt properties

## 0.5.0 (Dec 17 2014)

#### Bugfixes

* Fix multiple calls to setStyle

#### Improvements

* `featuresAt` now returns additional information
* Complete style/source/tile event suite:
  style.load, style.error, style.change,
  source.add, source.remove, source.load, source.error, source.change,
  tile.add, tile.remove, tile.load, tile.error
* Vastly improved performance and correctness for GeoJSON sources
* Map#setStyle accepts a style URL
* Support {prefix} in tile URL templates
* Provide a source map with minified source

#### Breaking

* Results format for `featuresAt` changed

## 0.4.2 (Nov 14 2014)

#### Bugfixes

- Ensure only one easing is active at a time (#807)
- Don't require style to perform easings (#817)
- Fix raster tiles sometimes not showing up (#761)

#### Improvements

- Internet Explorer 11 support (experimental)

## 0.4.1 (Nov 10 2014)

#### Bugfixes

- Interpolate to the closest bearing when doing rotation animations (#818)

## 0.4.0 (Nov 4 2014)

#### Breaking

- Updated to mapbox-gl-style-spec v6.0.0 ([Changelog](https://github.com/mapbox/mapbox-gl-style-spec/blob/v6.0.0/CHANGELOG.md)). Styles are
  now expected to be version 6. You can use the [gl-style-migrate](https://github.com/mapbox/mapbox-gl-style-lint#migrations)
  utility to update existing styles.

## 0.3.2 (Oct 23 2014)

#### Bugfixes

- Fix worker initialization with deferred or async scripts

#### Improvements

- Added map.remove()
- CDN assets are now served with gzip compression

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
- Fixed drawing beveled line joins without overlap.

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
- Fixed inertia race condition where error was sometimes thrown after erratic panning/zooming.


## 0.2.0 (Aug 6 2014)

- First public release.
