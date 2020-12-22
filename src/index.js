// @flow

import assert from 'assert';
import {supported} from '@mapbox/mapbox-gl-supported';

import {version} from '../package.json';
import Map from './ui/map';
import NavigationControl from './ui/control/navigation_control';
import GeolocateControl from './ui/control/geolocate_control';
import AttributionControl from './ui/control/attribution_control';
import ScaleControl from './ui/control/scale_control';
import FullscreenControl from './ui/control/fullscreen_control';
import Popup from './ui/popup';
import Marker from './ui/marker';
import Style from './style/style';
import LngLat from './geo/lng_lat';
import LngLatBounds from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate from './geo/mercator_coordinate';
import {Evented} from './util/evented';
import config from './util/config';
import {Debug} from './util/debug';
import {isSafari} from './util/util';
import {setRTLTextPlugin, getRTLTextPluginStatus} from './source/rtl_text_plugin';
import WorkerPool from './util/worker_pool';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool';
import {clearTileCache} from './util/tile_request_cache';
import {WorkerPerformanceUtils} from './util/worker_performance_utils';
import {PerformanceUtils} from './util/performance';
import {FreeCameraOptions} from './ui/free_camera';
import browser from './util/browser';

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
     * times in some situations. `mapboxgl.workerUrl` and `mapboxgl.workerCount`, if being
     * used, must be set before `prewarm()` is called to have an effect.
     *
     * By default, the lifecycle of these resources is managed automatically, and they are
     * lazily initialized when a Map is first created. By invoking `prewarm()`, these
     * resources will be created ahead of time, and will not be cleared when the last Map
     * is removed from the page. This allows them to be re-used by new Map instances that
     * are created later. They can be manually cleared by calling
     * `mapboxgl.clearPrewarmedResources()`. This is only necessary if your web page remains
     * active but stops using maps altogether.
     *
     * This is primarily useful when using GL-JS maps in a single page app, wherein a user
     * would navigate between various views that can cause Map instances to constantly be
     * created and destroyed.
     *
     * @function prewarm
     * @example
     * mapboxgl.prewarm()
     */
    prewarm,
    /**
     * Clears up resources that have previously been created by `mapboxgl.prewarm()`.
     * Note that this is typically not necessary. You should only call this function
     * if you expect the user of your app to not return to a Map view at any point
     * in your application.
     *
     * @function clearPrewarmedResources
     * @example
     * mapboxgl.clearPrewarmedResources()
     */
    clearPrewarmedResources,

    /**
     * Gets and sets the map's [access token](https://www.mapbox.com/help/define-access-token/).
     *
     * @var {string} accessToken
     * @returns {string} The currently set access token.
     * @example
     * mapboxgl.accessToken = myAccessToken;
     * @see [Display a map](https://www.mapbox.com/mapbox-gl-js/examples/)
     */
    get accessToken(): ?string {
        return config.ACCESS_TOKEN;
    },

    set accessToken(token: string) {
        config.ACCESS_TOKEN = token;
    },

    /**
     * Gets and sets the map's default API URL for requesting tiles, styles, sprites, and glyphs
     *
     * @var {string} baseApiUrl
     * @returns {string} The current base API URL.
     * @example
     * mapboxgl.baseApiUrl = 'https://api.mapbox.com';
     */
    get baseApiUrl(): ?string {
        return config.API_URL;
    },

    set baseApiUrl(url: string) {
        config.API_URL = url;
    },

    /**
     * Gets and sets the number of web workers instantiated on a page with GL JS maps.
     * By default, it is set to half the number of CPU cores (capped at 6).
     * Make sure to set this property before creating any map instances for it to have effect.
     *
     * @var {string} workerCount
     * @returns {number} Number of workers currently configured.
     * @example
     * mapboxgl.workerCount = 2;
     */
    get workerCount(): number {
        return WorkerPool.workerCount;
    },

    set workerCount(count: number) {
        WorkerPool.workerCount = count;
    },

    /**
     * Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
     * which affects performance in raster-heavy maps. 16 by default.
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
    clearStorage(callback?: (err: ?Error) => void) {
        clearTileCache(callback);
    },

    workerUrl: '',

    /**
     * Provides an interface for external module bundlers such as Webpack or Rollup to package
     * mapbox-gl's WebWorker into a separate class and integrate it with the library.
     *
     * Takes precedence over `mapboxgl.workerUrl`.
     *
     * @var {Object} workerClass
     * @returns {Object|null} a Class object, an instance of which exposes the `Worker` interface.
     * @example
     * import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp.js'
     * import MapboxGLWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker.js'
     *
     * mapboxgl.workerClass = MapboxGLWorker;
     */
    workerClass: null,

    /**
     * Sets the time used by GL JS internally for all animations. Useful for generating videos from GL JS.
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
 * The version of Mapbox GL JS in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 */

/**
 * Test whether the browser [supports Mapbox GL JS](https://www.mapbox.com/help/mapbox-browser-support/#mapbox-gl-js).
 *
 * @function supported
 * @param {Object} [options]
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`,
 *   the function will return `false` if the performance of Mapbox GL JS would
 *   be dramatically worse than expected (e.g. a software WebGL renderer would be used).
 * @return {boolean}
 * @example
 * // Show an alert if the browser does not support Mapbox GL
 * if (!mapboxgl.supported()) {
 *   alert('Your browser does not support Mapbox GL');
 * }
 * @see [Check for browser support](https://www.mapbox.com/mapbox-gl-js/example/check-for-support/)
 */

/**
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left. Mapbox Studio loads this plugin by default.
 *
 * @function setRTLTextPlugin
 * @param {string} pluginURL URL pointing to the Mapbox RTL text plugin source.
 * @param {Function} callback Called with an error argument if there is an error.
 * @param {boolean} lazy If set to `true`, mapboxgl will defer loading the plugin until rtl text is encountered,
 *    rtl text will then be rendered only after the plugin finishes loading.
 * @example
 * mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.0/mapbox-gl-rtl-text.js');
 * @see [Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)
 */

/**
  * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
  * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
  * If the status is `loaded` and the plugin is requested again, an error will be thrown.
  *
  * @function getRTLTextPluginStatus
  * @example
  * const pluginStatus = mapboxgl.getRTLTextPluginStatus();
  */

export default exported;

// canary assert: used to confirm that asserts have been removed from production build
assert(true, 'canary assert');
