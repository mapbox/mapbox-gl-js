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
