import {PerformanceUtils} from './util/performance';
import assert from 'assert';
import {supported} from '@mapbox/mapbox-gl-supported';
import {version} from '../package.json';
import {Map} from './ui/map';
import NavigationControl from './ui/control/navigation_control';
import GeolocateControl from './ui/control/geolocate_control';
import AttributionControl from './ui/control/attribution_control';
import ScaleControl from './ui/control/scale_control';
import FullscreenControl from './ui/control/fullscreen_control';
import Popup from './ui/popup';
import Marker from './ui/marker';
import Style from './style/style';
import LngLat, {LngLatBounds} from './geo/lng_lat';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from './geo/mercator_coordinate';
import {Evented} from './util/evented';
import config from './util/config';
import {Debug} from './util/debug';
import {isSafari} from './util/util';
import {setRTLTextPlugin, getRTLTextPluginStatus} from './source/rtl_text_plugin';
import WorkerPool from './util/worker_pool';
import WorkerClass from './util/worker_class';
import {prewarm, clearPrewarmedResources} from './util/worker_pool_factory';
import {clearTileCache} from './util/tile_request_cache';
import {WorkerPerformanceUtils} from './util/worker_performance_utils';
import {FreeCameraOptions} from './ui/free_camera';
import {getDracoUrl, setDracoUrl, setMeshoptUrl, getMeshoptUrl} from '../3d-style/util/loaders';
import browser from './util/browser';

import type {Class} from './types/class';

// Explicit type re-exports
export type * from './ui/events';
export type * from './style-spec/types';
export type * from './source/source_types';
export type * from './types/deprecated-aliases';

export type {PointLike} from './types/point-like';
export type {PluginStatus} from './source/rtl_text_plugin';

export type {Event, ErrorEvent} from './util/evented';
export type {GeoJSONFeature, TargetFeature} from './util/vectortile_to_geojson';
export type {InteractionEvent} from './ui/interactions';
export type {PaddingOptions} from './geo/edge_insets';
export type {RequestParameters} from './util/ajax';
export type {RequestTransformFunction, ResourceType} from './util/mapbox';
export type {LngLatLike, LngLatBoundsLike} from './geo/lng_lat';

export type {FeatureSelector} from './style/style';
export type {StyleImageInterface} from './style/style_image';
export type {CustomLayerInterface} from './style/style_layer/custom_style_layer';

export type {Anchor} from './ui/anchor';
export type {PopupOptions} from './ui/popup';
export type {MarkerOptions} from './ui/marker';
export type {ScaleControlOptions} from './ui/control/scale_control';
export type {GeolocateControlOptions} from './ui/control/geolocate_control';
export type {NavigationControlOptions} from './ui/control/navigation_control';
export type {FullscreenControlOptions} from './ui/control/fullscreen_control';
export type {AttributionControlOptions} from './ui/control/attribution_control';
export type {MapOptions, IControl, ControlPosition} from './ui/map';
export type {AnimationOptions, CameraOptions, EasingOptions} from './ui/camera';

export type {
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    ScaleControl,
    FullscreenControl,
    Popup,
    Marker,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
};

const exported = {
    version,
    supported,
    setRTLTextPlugin,
    getRTLTextPluginStatus,
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    ScaleControl,
    FullscreenControl,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
    FreeCameraOptions,
    Evented,
    config,
    /**
     * Initializes resources like WebWorkers that can be shared across maps to lower load
     * times in some situations. [`mapboxgl.workerUrl`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#workerurl)
     * and [`mapboxgl.workerCount`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#workercount), if being
     * used, must be set before `prewarm()` is called to have an effect.
     *
     * By default, the lifecycle of these resources is managed automatically, and they are
     * lazily initialized when a `Map` is first created. Invoking `prewarm()` creates these
     * resources ahead of time and ensures they are not cleared when the last `Map`
     * is removed from the page. This allows them to be re-used by new `Map` instances that
     * are created later. They can be manually cleared by calling
     * [`mapboxgl.clearPrewarmedResources()`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#clearprewarmedresources).
     * This is only necessary if your web page remains active but stops using maps altogether.
     * `prewarm()` is idempotent and has guards against being executed multiple times,
     * and any resources allocated by `prewarm()` are created synchronously.
     *
     * This is primarily useful when using Mapbox GL JS maps in a single page app,
     * in which a user navigates between various views, resulting in
     * constant creation and destruction of `Map` instances.
     *
     * @function prewarm
     * @example
     * mapboxgl.prewarm();
     */
    prewarm,
    /**
     * Clears up resources that have previously been created by [`mapboxgl.prewarm()`](https://docs.mapbox.com/mapbox-gl-js/api/properties/#prewarm).
     * Note that this is typically not necessary. You should only call this function
     * if you expect the user of your app to not return to a Map view at any point
     * in your application.
     *
     * @function clearPrewarmedResources
     * @example
     * mapboxgl.clearPrewarmedResources();
     */
    clearPrewarmedResources,

    /**
     * Gets and sets the map's [access token](https://www.mapbox.com/help/define-access-token/).
     *
     * @var {string} accessToken
     * @returns {string} The currently set access token.
     * @example
     * mapboxgl.accessToken = myAccessToken;
     * @see [Example: Display a map](https://www.mapbox.com/mapbox-gl-js/example/simple-map/)
     */
    get accessToken(): string | null | undefined {
        return config.ACCESS_TOKEN;
    },

    set accessToken(token: string) {
        config.ACCESS_TOKEN = token;
    },

    /**
     * Gets and sets the map's default API URL for requesting tiles, styles, sprites, and glyphs.
     *
     * @var {string} baseApiUrl
     * @returns {string} The current base API URL.
     * @example
     * mapboxgl.baseApiUrl = 'https://api.mapbox.com';
     */
    get baseApiUrl(): string | null | undefined {
        return config.API_URL;
    },

    set baseApiUrl(url: string) {
        config.API_URL = url;
    },

    /**
     * Gets and sets the number of web workers instantiated on a page with Mapbox GL JS maps.
     * By default, it is set to 2.
     * Make sure to set this property before creating any map instances for it to have effect.
     *
     * @var {string} workerCount
     * @returns {number} Number of workers currently configured.
     * @example
     * mapboxgl.workerCount = 4;
     */
    get workerCount(): number {
        return WorkerPool.workerCount;
    },

    set workerCount(count: number) {
        WorkerPool.workerCount = count;
    },

    /**
     * Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel.
     * 16 by default. There is no maximum value, but the number of images affects performance in raster-heavy maps.
     *
     * @var {string} maxParallelImageRequests
     * @returns {number} Number of parallel requests currently configured.
     * @example
     * mapboxgl.maxParallelImageRequests = 10;
     */
    get maxParallelImageRequests(): number {
        return config.MAX_PARALLEL_IMAGE_REQUESTS;
    },

    set maxParallelImageRequests(numRequests: number) {
        config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests;
    },

    /**
     * Clears browser storage used by this library. Using this method flushes the Mapbox tile
     * cache that is managed by this library. Tiles may still be cached by the browser
     * in some cases.
     *
     * This API is supported on browsers where the [`Cache` API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
     * is supported and enabled. This includes all major browsers when pages are served over
     * `https://`, except Internet Explorer and Edge Mobile.
     *
     * When called in unsupported browsers or environments (private or incognito mode), the
     * callback will be called with an error argument.
     *
     * @function clearStorage
     * @param {Function} callback Called with an error argument if there is an error.
     * @example
     * mapboxgl.clearStorage();
     */
    clearStorage(callback?: (err?: Error | null) => void) {
        clearTileCache(callback);
    },
    /**
     * Provides an interface for loading mapbox-gl's WebWorker bundle from a self-hosted URL.
     * This needs to be set only once, and before any call to `new mapboxgl.Map(..)` takes place.
     * This is useful if your site needs to operate in a strict CSP (Content Security Policy) environment
     * wherein you are not allowed to load JavaScript code from a [`Blob` URL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL), which is default behavior.
     *
     * See our documentation on [CSP Directives](https://docs.mapbox.com/mapbox-gl-js/guides/browsers/#csp-directives) for more details.
     *
     * @var {string} workerUrl
     * @returns {string} A URL hosting a JavaScript bundle for mapbox-gl's WebWorker.
     * @example
     * <script src='https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp.js'></script>
     * <script>
     * mapboxgl.workerUrl = "https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl-csp-worker.js";
     * ...
     * </script>
     */
    get workerUrl(): string {
        return WorkerClass.workerUrl;
    },

    set workerUrl(url: string) {
        WorkerClass.workerUrl = url;
    },

    /**
     * Provides an interface for external module bundlers such as Webpack or Rollup to package
     * mapbox-gl's WebWorker into a separate class and integrate it with the library.
     *
     * Takes precedence over `mapboxgl.workerUrl`.
     *
     * @var {Object} workerClass
     * @returns {Object | null} A class that implements the `Worker` interface.
     * @example
     * import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
     * import MapboxGLWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker';
     *
     * mapboxgl.workerClass = MapboxGLWorker;
     */
    get workerClass(): Class<Worker> {
        return WorkerClass.workerClass;
    },

    set workerClass(klass: Class<Worker>) {
        WorkerClass.workerClass = klass;
    },

    get workerParams(): WorkerOptions {
        return WorkerClass.workerParams;
    },

    set workerParams(params: WorkerOptions) {
        WorkerClass.workerParams = params;
    },

    /**
     * Provides an interface for loading Draco decoding library (draco_decoder_gltf.wasm v1.5.6) from a self-hosted URL.
     * This needs to be set only once, and before any call to `new mapboxgl.Map(..)` takes place.
     * This is useful if your site needs to operate in a strict CSP (Content Security Policy) environment
     * wherein you are not allowed to load JavaScript code from a [`Blob` URL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL), which is default behavior.
     *
     * See our documentation on [CSP Directives](https://docs.mapbox.com/mapbox-gl-js/guides/browsers/#csp-directives) for more details.
     *
     * @var {string} dracoUrl
     * @returns {string} A URL hosting Google Draco decoding library (`draco_wasm_wrapper_gltf.js` and `draco_decoder_gltf.wasm`).
     * @example
     * <script src='https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js'></script>
     * <script>
     * mapboxgl.dracoUrl = "https://www.gstatic.com/draco/versioned/decoders/1.5.6/draco_decoder_gltf.wasm";
     * ...
     * </script>
     */
    get dracoUrl(): string {
        return getDracoUrl();
    },

    set dracoUrl(url: string) {
        setDracoUrl(url);
    },

    get meshoptUrl(): string {
        return getMeshoptUrl();
    },

    set meshoptUrl(url: string) {
        setMeshoptUrl(url);
    },

    /**
     * Sets the time used by Mapbox GL JS internally for all animations. Useful for generating videos from Mapbox GL JS.
     *
     * @var {number} time
     */
    setNow: browser.setNow,

    /**
     * Restores the internal animation timing to follow regular computer time (`performance.now()`).
     */
    restoreNow: browser.restoreNow
};

//This gets automatically stripped out in production builds.
Debug.extend(exported, {isSafari, getPerformanceMetrics: PerformanceUtils.getPerformanceMetrics, getPerformanceMetricsAsync: WorkerPerformanceUtils.getPerformanceMetricsAsync});

/**
 * Gets the version of Mapbox GL JS in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 * @example
 * console.log(`Mapbox GL JS v${mapboxgl.version}`);
 */

/**
 * Test whether the browser [supports Mapbox GL JS](https://www.mapbox.com/help/mapbox-browser-support/#mapbox-gl-js).
 *
 * @function supported
 * @param {Object} [options]
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`,
 * the function will return `false` if the performance of Mapbox GL JS would
 * be dramatically worse than expected (for example, a software WebGL renderer
 * would be used).
 * @return {boolean}
 * @example
 * // Show an alert if the browser does not support Mapbox GL
 * if (!mapboxgl.supported()) {
 *     alert('Your browser does not support Mapbox GL');
 * }
 * @see [Example: Check for browser support](https://www.mapbox.com/mapbox-gl-js/example/check-for-support/)
 */

/**
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left. Mapbox Studio loads this plugin by default.
 *
 * @function setRTLTextPlugin
 * @param {string} pluginURL URL pointing to the Mapbox RTL text plugin source.
 * @param {Function} callback Called with an error argument if there is an error, or no arguments if the plugin loads successfully.
 * @param {boolean} lazy If set to `true`, MapboxGL will defer loading the plugin until right-to-left text is encountered, and
 * right-to-left text will be rendered only after the plugin finishes loading.
 * @example
 * mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.0/mapbox-gl-rtl-text.js');
 * @see [Example: Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)
 */

/**
  * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
  * The status can be `unavailable` (not requested or removed), `loading`, `loaded`, or `error`.
  * If the status is `loaded` and the plugin is requested again, an error will be thrown.
  *
  * @function getRTLTextPluginStatus
  * @example
  * const pluginStatus = mapboxgl.getRTLTextPluginStatus();
  */

export default exported;

// canary assert: used to confirm that asserts have been removed from production build
assert(true, 'canary assert');
