import assert from 'assert';
import config, {getDracoUrl, getMeshoptUrl, getBuildingGenUrl} from './util/config';
import WorkerPool from './util/worker_pool';
import {clearTileCache} from './util/tile_request_cache';
import browser from './util/browser';

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
export type {CustomSourceInterface} from './source/custom_source';
export type {CanvasSourceSpecification} from './source/canvas_source';
export type {TileProvider, TileDataResponse} from './source/tile_provider';
export type {TileJSON} from './types/tilejson';

export type {Anchor} from './ui/anchor';
export type {PopupOptions} from './ui/popup';
export type {MarkerOptions} from './ui/marker';
export type {ScaleControlOptions} from './ui/control/scale_control';
export type {GeolocateControlOptions} from './ui/control/geolocate_control';
export type {NavigationControlOptions} from './ui/control/navigation_control';
export type {FullscreenControlOptions} from './ui/control/fullscreen_control';
export type {AttributionControlOptions} from './ui/control/attribution_control';
export type {MapOptions, IControl, ControlPosition} from './ui/map';
export type {FontstackCompositing} from './style/glyph_loader';
export type {AnimationOptions, CameraOptions, EasingOptions} from './ui/camera';

// Named value exports — classes, functions, constants
export {version} from '../package.json';
export {supported} from '@mapbox/mapbox-gl-supported';
export {Map} from './ui/map';
export {default as NavigationControl} from './ui/control/navigation_control';
export {default as GeolocateControl} from './ui/control/geolocate_control';
export {default as AttributionControl} from './ui/control/attribution_control';
export {default as ScaleControl} from './ui/control/scale_control';
export {default as FullscreenControl} from './ui/control/fullscreen_control';
export {default as IndoorControl} from './ui/control/indoor_control';
export {default as Popup} from './ui/popup';
export {default as Marker} from './ui/marker';
export {default as Style} from './style/style';
export {default as LngLat, LngLatBounds} from './geo/lng_lat';
export {default as Point} from '@mapbox/point-geometry';
export {default as MercatorCoordinate} from './geo/mercator_coordinate';
export {Evented} from './util/evented';
export {FreeCameraOptions} from './ui/free_camera';
export {setRTLTextPlugin, getRTLTextPluginStatus} from './source/rtl_text_plugin';
export {addTileProvider} from './source/tile_provider';
export {prewarm, clearPrewarmedResources} from './util/worker_pool_factory';

/**
 * The internal configuration object. Exposed for advanced use cases where direct
 * access to underlying config values is needed.
 */
export {default as config} from './util/config';

/**
 * Clears browser storage used by this library. Using this method flushes the Mapbox tile
 * cache that is managed by this library. Tiles may still be cached by the browser
 * in some cases.
 *
 * @function clearStorage
 * @param {Function} callback Called with an error argument if there is an error.
 * @example
 * clearStorage();
 */
export function clearStorage(callback?: (err?: Error | null) => void) {
    clearTileCache(callback);
}

/**
 * Sets the time used by Mapbox GL JS internally for all animations.
 * Useful for generating videos from Mapbox GL JS.
 *
 * @function setNow
 * @param {number} now
 */
export const setNow: typeof browser.setNow = (now) => browser.setNow(now);

/**
 * Restores the internal animation timing to follow regular computer time (`performance.now()`).
 *
 * @function restoreNow
 */
export const restoreNow: typeof browser.restoreNow = () => browser.restoreNow();

// Global setters — replace property assignments on the mapboxgl namespace object.
// Instead of `mapboxgl.accessToken = '...'`, use `setAccessToken('...')`.

/**
 * Sets the map's [access token](https://www.mapbox.com/help/define-access-token/).
 *
 * @function setAccessToken
 * @param {string} token The access token to set.
 * @example
 * import { setAccessToken } from 'mapbox-gl/esm';
 * setAccessToken(myAccessToken);
 */
export function setAccessToken(token: string) {
    config.ACCESS_TOKEN = token;
}

/**
 * Sets the map's default API URL for requesting tiles, styles, sprites, and glyphs.
 *
 * @function setBaseApiUrl
 * @param {string} url The base API URL to set. Defaults to `'https://api.mapbox.com'`.
 * @example
 * import { setBaseApiUrl } from 'mapbox-gl/esm';
 * setBaseApiUrl('https://api.mapbox.com');
 */
export function setBaseApiUrl(url: string) {
    config.API_URL = url;
}

/**
 * Sets the number of web workers instantiated on a page with Mapbox GL JS maps.
 * By default, it is set to 2. Make sure to call this before creating any map instances
 * for it to have effect.
 *
 * @function setWorkerCount
 * @param {number} count Number of workers to use.
 * @example
 * import { setWorkerCount } from 'mapbox-gl/esm';
 * setWorkerCount(4);
 */
export function setWorkerCount(count: number) {
    WorkerPool.workerCount = count;
}

/**
 * Sets the maximum number of images (raster tiles, sprites, icons) to load in parallel.
 * 16 by default. There is no maximum value, but the number of images affects performance
 * in raster-heavy maps.
 *
 * @function setMaxParallelImageRequests
 * @param {number} numRequests Maximum number of parallel image requests.
 * @example
 * import { setMaxParallelImageRequests } from 'mapbox-gl/esm';
 * setMaxParallelImageRequests(10);
 */
export function setMaxParallelImageRequests(numRequests: number) {
    config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests;
}

/**
 * Sets the URL for loading the Draco decoding library (draco_decoder_gltf.wasm).
 * This needs to be set before any call to `new Map(...)` takes place.
 *
 * @function setDracoUrl
 * @param {string} url A URL hosting the Draco WASM decoder.
 * @example
 * import { setDracoUrl } from 'mapbox-gl/esm';
 * setDracoUrl('https://www.gstatic.com/draco/versioned/decoders/1.5.6/draco_decoder_gltf.wasm');
 */
export function setDracoUrl(url: string) {
    config.DRACO_URL = browser.resolveURL(url);
}

/**
 * Sets the URL for the Meshopt decoder WASM module.
 * By default, this is loaded from the Mapbox API CDN relative to `baseApiUrl`.
 * The SIMD-optimized variant is automatically selected when supported.
 *
 * @function setMeshoptUrl
 * @param {string} url A URL hosting the Meshopt WASM module.
 * @example
 * import { setMeshoptUrl } from 'mapbox-gl/esm';
 * setMeshoptUrl('https://example.com/meshopt.wasm');
 */
export function setMeshoptUrl(url: string) {
    const resolved = browser.resolveURL(url);
    config.MESHOPT_URL = resolved;
    config.MESHOPT_SIMD_URL = resolved;
}

/**
 * Sets the URL for the building generation WASM module (building_gen.wasm).
 * By default, this is loaded from the Mapbox API CDN relative to `baseApiUrl`.
 *
 * @function setBuildingGenUrl
 * @param {string} url A URL hosting the building generation WASM module.
 * @example
 * import { setBuildingGenUrl } from 'mapbox-gl/esm';
 * setBuildingGenUrl('https://example.com/building_gen.wasm');
 */
export function setBuildingGenUrl(url: string) {
    config.BUILDING_GEN_URL = browser.resolveURL(url);
}

// Getter helpers — read-only access to currently configured global values.

/**
 * Returns the currently configured Draco decoder URL.
 *
 * @function getDracoUrl
 * @returns {string}
 */
export {getDracoUrl};

/**
 * Returns the currently configured Meshopt decoder URL.
 *
 * @function getMeshoptUrl
 * @returns {string}
 */
export {getMeshoptUrl};

/**
 * Returns the currently configured building generation WASM URL.
 *
 * @function getBuildingGenUrl
 * @returns {string}
 */
export {getBuildingGenUrl};

// canary assert: used to confirm that asserts have been removed from production build
assert(true, 'canary assert');
