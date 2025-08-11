import {version} from '../../package.json';
import {asyncAll, deepEqual, extend, bindAll, warnOnce, uniqueId, isSafariWithAntialiasingBug} from '../util/util';
import browser from '../util/browser';
import * as DOM from '../util/dom';
import {getImage, ResourceType} from '../util/ajax';
import {
    RequestManager,
    mapSessionAPI,
    mapLoadEvent,
    getMapSessionAPI,
    postPerformanceEvent,
    postMapLoadEvent,
    postStyleLoadEvent,
    AUTH_ERR_MSG,
    storeAuthState,
    removeAuthState
} from '../util/mapbox';
import Style from '../style/style';
import IndoorManager from '../style/indoor_manager';
import EvaluationParameters from '../style/evaluation_parameters';
import Painter from '../render/painter';
import Transform from '../geo/transform';
import Hash from './hash';
import HandlerManager from './handler_manager';
import Camera from './camera';
import LngLat, {LngLatBounds} from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import AttributionControl from './control/attribution_control';
import LogoControl from './control/logo_control';
import IndoorControl from './control/indoor_control';
import {supported} from '@mapbox/mapbox-gl-supported';
import {RGBAImage} from '../util/image';
import {Event, ErrorEvent} from '../util/evented';
import {MapMouseEvent} from './events';
import TaskQueue from '../util/task_queue';
import webpSupported from '../util/webp_supported';
import {PerformanceUtils, PerformanceMarkers} from '../util/performance';
import {LivePerformanceMarkers, LivePerformanceUtils} from '../util/live_performance';
import EasedVariable from '../util/eased_variable';
import {GLOBE_ZOOM_THRESHOLD_MAX} from '../geo/projection/globe_constants';
import {setCacheLimits} from '../util/tile_request_cache';
import {Debug} from '../util/debug';
import config from '../util/config';
import {isFQID} from '../util/fqid';
import defaultLocale from './default_locale';
import {TrackedParameters} from '../tracked-parameters/tracked_parameters';
import {TrackedParametersMock} from '../tracked-parameters/tracked_parameters_base';
import {InteractionSet} from './interactions';
import {ImageId} from '../style-spec/expression/types/image_id';

import type Marker from '../ui/marker';
import type Popup from '../ui/popup';
import type SourceCache from '../source/source_cache';
import type {MapEventType, MapEventOf} from './events';
import type {PointLike} from '../types/point-like';
import type {FeatureState} from '../style-spec/expression/index';
import type {RequestParameters, AJAXError} from '../util/ajax';
import type {RequestTransformFunction} from '../util/mapbox';
import type {LngLatLike, LngLatBoundsLike} from '../geo/lng_lat';
import type {CustomLayerInterface} from '../style/style_layer/custom_style_layer';
import type {StyleImageInterface, StyleImageMetadata} from '../style/style_image';
import type {StyleOptions, StyleSetterOptions, AnyLayer, FeatureSelector, SourceSelector, QueryRenderedFeaturesParams, QueryRenderedFeaturesetParams} from '../style/style';
import type ScrollZoomHandler from './handler/scroll_zoom';
import type {ScrollZoomHandlerOptions} from './handler/scroll_zoom';
import type BoxZoomHandler from './handler/box_zoom';
import type {TouchPitchHandler, TouchPitchHandlerOptions} from './handler/touch_zoom_rotate';
import type DragRotateHandler from './handler/shim/drag_rotate';
import type DragPanHandler from './handler/shim/drag_pan';
import type {DragPanOptions} from './handler/shim/drag_pan';
import type KeyboardHandler from './handler/keyboard';
import type DoubleClickZoomHandler from './handler/shim/dblclick_zoom';
import type TouchZoomRotateHandler from './handler/shim/touch_zoom_rotate';
import type {TouchZoomRotateHandlerOptions} from './handler/shim/touch_zoom_rotate';
import type {TaskID} from '../util/task_queue';
import type {Cancelable} from '../types/cancelable';
import type {
    LayerSpecification,
    LayoutSpecification,
    PaintSpecification,
    FilterSpecification,
    StyleSpecification,
    LightSpecification,
    FlatLightSpecification,
    LightsSpecification,
    TerrainSpecification,
    FogSpecification,
    SnowSpecification,
    RainSpecification,
    SourceSpecification,
    ProjectionSpecification,
    CameraSpecification,
    ImportSpecification,
    ConfigSpecification,
    SchemaSpecification,
    ColorThemeSpecification,
} from '../style-spec/types';
import type {Source, SourceClass} from '../source/source';
import type {EasingOptions} from './camera';
import type {ContextOptions} from '../gl/context';
import type {GeoJSONFeature, FeaturesetDescriptor, TargetFeature, TargetDescriptor} from '../util/vectortile_to_geojson';
import type {ITrackedParameters} from '../tracked-parameters/tracked_parameters_base';
import type {Callback} from '../types/callback';
import type {Interaction} from './interactions';
import type {SpriteFormat} from '../render/image_manager';
import type {PitchRotateKey} from './handler_manager';
import type {CanvasSourceOptions} from '../source/canvas_source';
import type {CustomSourceInterface} from '../source/custom_source';
import type {RasterQueryParameters, RasterQueryResult} from '../source/raster_array_tile_source';

export type ControlPosition = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

export interface IControl {
    readonly onAdd: (map: Map) => HTMLElement;
    readonly onRemove: (map: Map) => void;
    readonly getDefaultPosition?: () => ControlPosition;
    readonly _setLanguage?: (language?: string | string[]) => void;
}

// Public API type for the Map#setStyle options
// as opposite to the internal StyleOptions type
export type SetStyleOptions = {
    diff?: boolean;
    config?: {
        [key: string]: ConfigSpecification;
    };
    localFontFamily: StyleOptions['localFontFamily'];
    localIdeographFontFamily: StyleOptions['localIdeographFontFamily'];
};

type Listener<T extends MapEventType> = (event: MapEventOf<T>) => void;

type DelegatedListener = {
    targets: string[] | TargetDescriptor;
    listener: Listener<MapEventType>;
    delegates: {[T in MapEventType]?: Listener<T>};
};

export const AVERAGE_ELEVATION_SAMPLING_INTERVAL = 500; // ms
export const AVERAGE_ELEVATION_EASE_TIME = 300; // ms
export const AVERAGE_ELEVATION_EASE_THRESHOLD = 1; // meters
export const AVERAGE_ELEVATION_CHANGE_THRESHOLD = 1e-4; // meters

// Check if the given TargetDescriptor targets are equal.
function areTargetsEqual(a: string[] | TargetDescriptor, b: string[] | TargetDescriptor) {
    if (Array.isArray(a) && Array.isArray(b)) {
        const aSet = new Set(a);
        const bSet = new Set(b);
        return aSet.size === bSet.size && a.every(id => bSet.has(id));
    } else {
        return deepEqual(a, b);
    }
}

export type MapOptions = {
    style?: StyleSpecification | string;
    config?: {
        [key: string]: ConfigSpecification;
    };
    hash?: boolean | string;
    interactive?: boolean;
    container: HTMLElement | string;
    bearingSnap?: number;
    clickTolerance?: number;
    pitchWithRotate?: boolean;
    attributionControl?: boolean;
    customAttribution?: string | Array<string>;
    logoPosition?: ControlPosition;
    failIfMajorPerformanceCaveat?: boolean;
    preserveDrawingBuffer?: boolean;
    antialias?: boolean;
    refreshExpiredTiles?: boolean;
    bounds?: LngLatBoundsLike;
    maxBounds?: LngLatBoundsLike;
    fitBoundsOptions?: EasingOptions;
    scrollZoom?: boolean | ScrollZoomHandlerOptions;
    minZoom?: number;
    maxZoom?: number;
    minPitch?: number;
    maxPitch?: number;
    boxZoom?: boolean;
    dragRotate?: boolean;
    dragPan?: boolean | DragPanOptions;
    keyboard?: boolean;
    doubleClickZoom?: boolean;
    touchZoomRotate?: boolean | TouchZoomRotateHandlerOptions;
    touchPitch?: boolean | TouchPitchHandlerOptions;
    cooperativeGestures?: boolean;
    trackResize?: boolean;
    center?: LngLatLike;
    zoom?: number;
    bearing?: number;
    pitch?: number;
    projection?: ProjectionSpecification | string;
    renderWorldCopies?: boolean;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    transformRequest?: RequestTransformFunction;
    accessToken?: string;
    testMode?: boolean;
    locale?: Partial<typeof defaultLocale>;
    language?: string;
    worldview?: string;
    crossSourceCollisions?: boolean;
    collectResourceTiming?: boolean;
    respectPrefersReducedMotion?: boolean;
    contextCreateOptions?: ContextOptions;
    devtools?: boolean;
    precompilePrograms?: boolean;
    repaint?: boolean;
    fadeDuration?: number;
    localFontFamily?: string;
    localIdeographFontFamily?: string;
    performanceMetricsCollection?: boolean;
    tessellationStep?: number;
    scaleFactor?: number;
    spriteFormat?: SpriteFormat;
    pitchRotateKey?: PitchRotateKey;
};

const defaultMinZoom = -2;
const defaultMaxZoom = 22;

// the default values, but also the valid range
const defaultMinPitch = 0;
const defaultMaxPitch = 85;

const defaultOptions = {
    center: [0, 0],
    zoom: 0,
    bearing: 0,
    pitch: 0,

    minZoom: defaultMinZoom,
    maxZoom: defaultMaxZoom,

    minPitch: defaultMinPitch,
    maxPitch: defaultMaxPitch,

    interactive: true,
    scrollZoom: true,
    boxZoom: true,
    dragRotate: true,
    dragPan: true,
    keyboard: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
    touchPitch: true,
    cooperativeGestures: false,
    performanceMetricsCollection: true,

    bearingSnap: 7,
    clickTolerance: 3,
    pitchWithRotate: true,

    hash: false,
    attributionControl: true,

    antialias: false,
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
    trackResize: true,
    renderWorldCopies: true,
    refreshExpiredTiles: true,
    minTileCacheSize: null,
    maxTileCacheSize: null,
    localIdeographFontFamily: 'sans-serif',
    localFontFamily: null,
    transformRequest: null,
    accessToken: null,
    fadeDuration: 300,
    respectPrefersReducedMotion: true,
    crossSourceCollisions: true,
    collectResourceTiming: false,
    testMode: false,
    precompilePrograms: true,
    scaleFactor: 1.0,
    spriteFormat: 'auto',
} satisfies Omit<MapOptions, 'container'>;

/**
 * The `Map` object represents the map on your page. It exposes methods
 * and properties that enable you to programmatically change the map,
 * and fires events as users interact with it.
 *
 * You create a `Map` by specifying a `container` and other options.
 * Then Mapbox GL JS initializes the map on the page and returns your `Map`
 * object.
 *
 * @extends Evented
 * @param {Object} options
 * @param {HTMLElement|string} options.container The HTML element in which Mapbox GL JS will render the map, or the element's string `id`. The specified element must have no children.
 * @param {number} [options.minZoom=0] The minimum zoom level of the map (0-24).
 * @param {number} [options.maxZoom=22] The maximum zoom level of the map (0-24).
 * @param {number} [options.minPitch=0] The minimum pitch of the map (0-85).
 * @param {number} [options.maxPitch=85] The maximum pitch of the map (0-85).
 * @param {Object | string} [options.style='mapbox://styles/mapbox/standard'] The map's Mapbox style. This must be an a JSON object conforming to
 * the schema described in the [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL
 * to such JSON. Can accept a null value to allow adding a style manually.
 *
 * To load a style from the Mapbox API, you can use a URL of the form `mapbox://styles/:owner/:style`,
 * where `:owner` is your Mapbox account name and `:style` is the style ID. You can also use a
 * [Mapbox-owned style](https://docs.mapbox.com/api/maps/styles/#mapbox-styles):
 *
 * * `mapbox://styles/mapbox/standard`
 * * `mapbox://styles/mapbox/streets-v12`
 * * `mapbox://styles/mapbox/outdoors-v12`
 * * `mapbox://styles/mapbox/light-v11`
 * * `mapbox://styles/mapbox/dark-v11`
 * * `mapbox://styles/mapbox/satellite-v9`
 * * `mapbox://styles/mapbox/satellite-streets-v12`
 * * `mapbox://styles/mapbox/navigation-day-v1`
 * * `mapbox://styles/mapbox/navigation-night-v1`.
 *
 * Tilesets hosted with Mapbox can be style-optimized if you append `?optimize=true` to the end of your style URL, like `mapbox://styles/mapbox/streets-v11?optimize=true`.
 * Learn more about style-optimized vector tiles in our [API documentation](https://www.mapbox.com/api-documentation/maps/#retrieve-tiles).
 *
 * @param {Object} [options.config=null] The initial configuration options for the style fragments. Each key in the object is a fragment ID (e.g., `basemap`) and each value is a configuration object.
 * @example
 * const map = new mapboxgl.Map({
 *     container: 'map',
 *     center: [-122.420679, 37.772537],
 *     zoom: 13,
 *     style: 'mapbox://styles/mapbox/standard',
 *     config: {
 *         // Initial configuration for the Mapbox Standard style set above. By default, its ID is `basemap`.
 *         basemap: {
 *             // Here, we're setting the light preset to `night`.
 *             lightPreset: 'night'
 *         }
 *     }
 * });
 * @param {(boolean|string)} [options.hash=false] If `true`, the map's [position](https://docs.mapbox.com/help/glossary/camera) (zoom, center latitude, center longitude, bearing, and pitch) will be synced with the hash fragment of the page's URL.
 * For example, `http://path/to/my/page.html#2.59/39.26/53.07/-24.1/60`.
 * An additional string may optionally be provided to indicate a parameter-styled hash,
 * for example http://path/to/my/page.html#map=2.59/39.26/53.07/-24.1/60&foo=bar, where `foo`
 * is a custom parameter and `bar` is an arbitrary hash distinct from the map hash.
 * @param {boolean} [options.interactive=true] If `false`, no mouse, touch, or keyboard listeners will be attached to the map, so it will not respond to interaction.
 * @param {number} [options.bearingSnap=7] The threshold, measured in degrees, that determines when the map's
 * bearing will snap to north. For example, with a `bearingSnap` of 7, if the user rotates
 * the map within 7 degrees of north, the map will automatically snap to exact north.
 * @param {boolean} [options.pitchWithRotate=true] If `false`, the map's pitch (tilt) control with "drag to rotate" interaction will be disabled.
 * @param {number} [options.clickTolerance=3] The max number of pixels a user can shift the mouse pointer during a click for it to be considered a valid click (as opposed to a mouse drag).
 * @param {boolean} [options.attributionControl=true] If `true`, an {@link AttributionControl} will be added to the map.
 * @param {string | Array<string>} [options.customAttribution=null] String or strings to show in an {@link AttributionControl}. Only applicable if `options.attributionControl` is `true`.
 * @param {string} [options.logoPosition='bottom-left'] A string representing the position of the Mapbox wordmark on the map. Valid options are `top-left`,`top-right`, `bottom-left`, `bottom-right`.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the performance of Mapbox GL JS would be dramatically worse than expected (a software renderer would be used).
 * @param {boolean} [options.preserveDrawingBuffer=false] If `true`, the map's canvas can be exported to a PNG using `map.getCanvas().toDataURL()`. This is `false` by default as a performance optimization.
 * @param {boolean} [options.antialias=false] If `true`, the gl context will be created with [MSAA antialiasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing). This is `false` by default as a performance optimization.
 * @param {boolean} [options.refreshExpiredTiles=true] If `false`, the map won't attempt to re-request tiles once they expire per their HTTP `cacheControl`/`expires` headers.
 * @param {LngLatBoundsLike} [options.maxBounds=null] If set, the map will be constrained to the given bounds.
 * @param {boolean | Object} [options.scrollZoom=true] If `true`, the "scroll to zoom" interaction is enabled. An `Object` value is passed as options to {@link ScrollZoomHandler#enable}.
 * @param {boolean} [options.boxZoom=true] If `true`, the "box zoom" interaction is enabled (see {@link BoxZoomHandler}).
 * @param {boolean} [options.dragRotate=true] If `true`, the "drag to rotate" interaction is enabled (see {@link DragRotateHandler}).
 * @param {boolean | Object} [options.dragPan=true] If `true`, the "drag to pan" interaction is enabled. An `Object` value is passed as options to {@link DragPanHandler#enable}.
 * @param {boolean} [options.keyboard=true] If `true`, keyboard shortcuts are enabled (see {@link KeyboardHandler}).
 * @param {boolean} [options.doubleClickZoom=true] If `true`, the "double click to zoom" interaction is enabled (see {@link DoubleClickZoomHandler}).
 * @param {boolean | Object} [options.touchZoomRotate=true] If `true`, the "pinch to rotate and zoom" interaction is enabled. An `Object` value is passed as options to {@link TouchZoomRotateHandler#enable}.
 * @param {boolean | Object} [options.touchPitch=true] If `true`, the "drag to pitch" interaction is enabled. An `Object` value is passed as options to {@link TouchPitchHandler}.
 * @param {'Control' | 'Alt' | 'Shift' | 'Meta'} [options.pitchRotateKey='Control'] Allows overriding the keyboard modifier key used for pitch/rotate interactions from `Control` to another modifier key.
 * @param {boolean} [options.cooperativeGestures] If `true`, scroll zoom will require pressing the ctrl or ⌘ key while scrolling to zoom map, and touch pan will require using two fingers while panning to move the map. Touch pitch will require three fingers to activate if enabled.
 * @param {boolean} [options.trackResize=true] If `true`, the map will automatically resize when the browser window resizes.
 * @param {boolean} [options.performanceMetricsCollection=true] If `true`, mapbox-gl will collect and send performance metrics.
 * @param {LngLatLike} [options.center=[0, 0]] The initial geographical [centerpoint](https://docs.mapbox.com/help/glossary/camera#center) of the map. If `center` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]` Note: Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.
 * @param {number} [options.zoom=0] The initial [zoom](https://docs.mapbox.com/help/glossary/camera#zoom) level of the map. If `zoom` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.bearing=0] The initial [bearing](https://docs.mapbox.com/help/glossary/camera#bearing) (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.pitch=0] The initial [pitch](https://docs.mapbox.com/help/glossary/camera#pitch) (tilt) of the map, measured in degrees away from the plane of the screen (0-85). If `pitch` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {LngLatBoundsLike} [options.bounds=null] The initial bounds of the map. If `bounds` is specified, it overrides `center` and `zoom` constructor options.
 * @param {Object} [options.fitBoundsOptions=null] A {@link Map#fitBounds} options object to use _only_ when fitting the initial `bounds` provided above.
 * @param {'auto' | string | string[]} [options.language=null] A string with a BCP 47 language tag, or an array of such strings representing the desired languages used for the map's labels and UI components. Languages can only be set on Mapbox vector tile sources.
 * By default, GL JS will not set a language so that the language of Mapbox tiles will be determined by the vector tile source's TileJSON.
 * Valid language strings must be a [BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag#List_of_subtags). Unsupported BCP-47 codes will not include any translations. Invalid codes will result in an recoverable error.
 * If a label has no translation for the selected language, it will display in the label's local language.
 * If option is set to `auto`, GL JS will select a user's preferred language as determined by the browser's [`window.navigator.language`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) property.
 * If the `locale` property is not set separately, this language will also be used to localize the UI for supported languages.
 * @param {string} [options.worldview=null] Sets the map's worldview. A worldview determines the way that certain disputed boundaries
 * are rendered. By default, GL JS will not set a worldview so that the worldview of Mapbox tiles will be determined by the vector tile source's TileJSON.
 * Valid worldview strings must be an [ISO alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1#Current_codes). Unsupported
 * ISO alpha-2 codes will fall back to the TileJSON's default worldview. Invalid codes will result in a recoverable error.
 * @param {boolean} [options.renderWorldCopies=true] If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`:
 * - When the map is zoomed out far enough that a single representation of the world does not fill the map's entire
 * container, there will be blank space beyond 180 and -180 degrees longitude.
 * - Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the
 * map and the other on the left edge of the map) at every zoom level.
 * @param {number} [options.minTileCacheSize=null] The minimum number of tiles stored in the tile cache for a given source. Larger viewports use more tiles and need larger caches. Larger viewports are more likely to be found on devices with more memory and on pages where the map is more important. If omitted, the cache will be dynamically sized based on the current viewport.
 * @param {number} [options.maxTileCacheSize=null] The maximum number of tiles stored in the tile cache for a given source. If omitted, the cache will be dynamically sized based on the current viewport.
 * @param {string} [options.localIdeographFontFamily='sans-serif'] Defines a CSS font-family for locally overriding generation of glyphs in the 'CJK Unified Ideographs', 'Hiragana', 'Katakana', 'Hangul Syllables' and 'CJK Symbols and Punctuation' ranges.
 * In these ranges, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold).
 * Set to `false`, to enable font settings from the map's style for these glyph ranges. Note that [Mapbox Studio](https://studio.mapbox.com/) sets this value to `false` by default.
 * The purpose of this option is to avoid bandwidth-intensive glyph server requests. For an example of this option in use, see [Use locally generated ideographs](https://www.mapbox.com/mapbox-gl-js/example/local-ideographs).
 * @param {string} [options.localFontFamily=null] Defines a CSS
 * font-family for locally overriding generation of all glyphs. Font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold).
 * If set, this option overrides the setting in localIdeographFontFamily.
 * @param {RequestTransformFunction} [options.transformRequest=null] A callback run before the Map makes a request for an external URL. The callback can be used to modify the url, set headers, or set the credentials property for cross-origin requests.
 * Expected to return a {@link RequestParameters} object with a `url` property and optionally `headers` and `credentials` properties.
 * @param {boolean} [options.collectResourceTiming=false] If `true`, Resource Timing API information will be collected for requests made by GeoJSON and Vector Tile web workers (this information is normally inaccessible from the main Javascript thread). Information will be returned in a `resourceTiming` property of relevant `data` events.
 * @param {number} [options.fadeDuration=300] Controls the duration of the fade-in/fade-out animation for label collisions, in milliseconds. This setting affects all symbol layers. This setting does not affect the duration of runtime styling transitions or raster tile cross-fading.
 * @param {boolean} [options.respectPrefersReducedMotion=true] If set to `true`, the map will respect the user's `prefers-reduced-motion` browser setting and apply a reduced motion mode, minimizing animations and transitions. When set to `false`, the map will always ignore the `prefers-reduced-motion` settings, regardless of the user's preference, making all animations essential.
 * @param {boolean} [options.crossSourceCollisions=true] If `true`, symbols from multiple sources can collide with each other during collision detection. If `false`, collision detection is run separately for the symbols in each source.
 * @param {string} [options.accessToken=null] If specified, map will use this [token](https://docs.mapbox.com/help/glossary/access-token/) instead of the one defined in `mapboxgl.accessToken`.
 * @param {Object} [options.locale=null] A patch to apply to the default localization table for UI strings such as control tooltips. The `locale` object maps namespaced UI string IDs to translated strings in the target language;
 * see [`src/ui/default_locale.js`](https://github.com/mapbox/mapbox-gl-js/blob/main/src/ui/default_locale.js) for an example with all supported string IDs. The object may specify all UI strings (thereby adding support for a new translation) or only a subset of strings (thereby patching the default translation table).
 * @param {boolean} [options.testMode=false] Silences errors and warnings generated due to an invalid accessToken, useful when using the library to write unit tests.
 * @param {'raster' | 'icon_set' | 'auto'} [options.spriteFormat='auto'] The format of the image sprite to use. If set to `'auto'`, vector iconset will be used for all mapbox-hosted sprites and raster sprite for all custom URLs.
 * @param {ProjectionSpecification} [options.projection='mercator'] The [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) the map should be rendered in.
 * Supported projections are:
 * * [Albers](https://en.wikipedia.org/wiki/Albers_projection) equal-area conic projection as `albers`
 * * [Equal Earth](https://en.wikipedia.org/wiki/Equal_Earth_projection) equal-area pseudocylindrical projection as `equalEarth`
 * * [Equirectangular](https://en.wikipedia.org/wiki/Equirectangular_projection) (Plate Carrée/WGS84) as `equirectangular`
 * * 3d Globe as `globe`
 * * [Lambert Conformal Conic](https://en.wikipedia.org/wiki/Lambert_conformal_conic_projection) as `lambertConformalConic`
 * * [Mercator](https://en.wikipedia.org/wiki/Mercator_projection) cylindrical map projection as `mercator`
 * * [Natural Earth](https://en.wikipedia.org/wiki/Natural_Earth_projection) pseudocylindrical map projection as `naturalEarth`
 * * [Winkel Tripel](https://en.wikipedia.org/wiki/Winkel_tripel_projection) azimuthal map projection as `winkelTripel`
 * Conic projections such as Albers and Lambert have configurable `center` and `parallels` properties that allow developers to define the region in which the projection has minimal distortion; see the example for how to configure these properties.
 * @example
 * const map = new mapboxgl.Map({
 *     container: 'map', // container ID
 *     center: [-122.420679, 37.772537], // starting position [lng, lat]
 *     zoom: 13, // starting zoom
 *     style: 'mapbox://styles/mapbox/streets-v11', // style URL or style object
 *     hash: true, // sync `center`, `zoom`, `pitch`, and `bearing` with URL
 *     // Use `transformRequest` to modify requests that begin with `http://myHost`.
 *     transformRequest: (url, resourceType) => {
 *         if (resourceType === 'Source' && url.startsWith('http://myHost')) {
 *             return {
 *                 url: url.replace('http', 'https'),
 *                 headers: {'my-custom-header': true},
 *                 credentials: 'include'  // Include cookies for cross-origin requests
 *             };
 *         }
 *     }
 * });
 * @see [Example: Display a map on a webpage](https://docs.mapbox.com/mapbox-gl-js/example/simple-map/)
 * @see [Example: Display a map with a custom style](https://docs.mapbox.com/mapbox-gl-js/example/custom-style-id/)
 * @see [Example: Check if Mapbox GL JS is supported](https://docs.mapbox.com/mapbox-gl-js/example/check-for-support/)
 */
export class Map extends Camera {
    style: Style;
    indoor: IndoorManager;
    painter: Painter;

    _container: HTMLElement;
    _missingCSSCanary: HTMLElement;
    _canvasContainer: HTMLElement;
    _controlContainer: HTMLElement;
    _controlPositions: {
        [p in ControlPosition]?: HTMLElement;
    };
    _interactive?: boolean;
    _showTileBoundaries?: boolean;
    _showParseStatus?: boolean;

    _showTerrainWireframe?: boolean;
    _showLayers2DWireframe?: boolean;
    _showLayers3DWireframe?: boolean;

    _showQueryGeometry?: boolean;
    _showCollisionBoxes?: boolean;
    _showPadding?: boolean;
    _showTileAABBs?: boolean;
    _showOverdrawInspector: boolean;
    _repaint?: boolean;
    _vertices?: boolean;
    _canvas: HTMLCanvasElement;
    _minTileCacheSize?: number;
    _maxTileCacheSize?: number;
    _frame?: Cancelable;
    _renderNextFrame?: boolean;
    _styleDirty?: boolean;
    _sourcesDirty?: boolean;
    _placementDirty?: boolean;
    _scaleFactorChanged?: boolean;
    _loaded: boolean;
    _fullyLoaded: boolean; // accounts for placement finishing as well
    _trackResize: boolean;
    _preserveDrawingBuffer: boolean;
    _failIfMajorPerformanceCaveat: boolean;
    _antialias: boolean;
    _refreshExpiredTiles: boolean;
    _hash: Hash;
    _delegatedListeners: {[type: string]: DelegatedListener[]};
    _fullscreenchangeEvent: 'fullscreenchange' | 'webkitfullscreenchange';
    _isInitialLoad: boolean;
    _shouldCheckAccess: boolean;
    _fadeDuration: number;
    _crossSourceCollisions: boolean;
    _collectResourceTiming: boolean;
    _renderTaskQueue: TaskQueue;
    _domRenderTaskQueue: TaskQueue;
    _controls: Array<IControl>;
    _markers: Array<Marker>;
    _popups: Array<Popup>;
    _logoControl: IControl;
    _indoorControl: IControl;
    _mapId: number;
    _localIdeographFontFamily: string;
    _localFontFamily?: string;
    _requestManager: RequestManager;
    _locale: Partial<typeof defaultLocale>;
    _removed: boolean;
    _speedIndexTiming: boolean;
    _clickTolerance: number;
    _cooperativeGestures: boolean;
    _silenceAuthErrors: boolean;
    _averageElevationLastSampledAt: number;
    _averageElevationExaggeration: number;
    _averageElevation: EasedVariable;
    _containerWidth: number;
    _containerHeight: number;
    _language?: string | string[];
    _worldview?: string;
    _interactionRange: [number, number];
    _visibilityHidden: number;
    _performanceMetricsCollection: boolean;
    _tessellationStep?: number;
    _precompilePrograms: boolean;
    _interactions: InteractionSet;
    _scaleFactor: number;

    // `_useExplicitProjection` indicates that a projection is set by a call to map.setProjection()
    _useExplicitProjection: boolean;

    /** @section Interaction handlers */

    /**
     * The map's {@link ScrollZoomHandler}, which implements zooming in and out with a scroll wheel or trackpad.
     * Find more details and examples using `scrollZoom` in the {@link ScrollZoomHandler} section.
     */
    scrollZoom: ScrollZoomHandler;

    /**
     * The map's {@link BoxZoomHandler}, which implements zooming using a drag gesture with the Shift key pressed.
     * Find more details and examples using `boxZoom` in the {@link BoxZoomHandler} section.
     */
    boxZoom: BoxZoomHandler;

    /**
     * The map's {@link DragRotateHandler}, which implements rotating the map while dragging with the right
     * mouse button or with the Control key pressed. Find more details and examples using `dragRotate`
     * in the {@link DragRotateHandler} section.
     */
    dragRotate: DragRotateHandler;

    /**
     * The map's {@link DragPanHandler}, which implements dragging the map with a mouse or touch gesture.
     * Find more details and examples using `dragPan` in the {@link DragPanHandler} section.
     */
    dragPan: DragPanHandler;

    /**
     * The map's {@link KeyboardHandler}, which allows the user to zoom, rotate, and pan the map using keyboard
     * shortcuts. Find more details and examples using `keyboard` in the {@link KeyboardHandler} section.
     */
    keyboard: KeyboardHandler;

    /**
     * The map's {@link DoubleClickZoomHandler}, which allows the user to zoom by double clicking.
     * Find more details and examples using `doubleClickZoom` in the {@link DoubleClickZoomHandler} section.
     */
    doubleClickZoom: DoubleClickZoomHandler;

    /**
     * The map's {@link TouchZoomRotateHandler}, which allows the user to zoom or rotate the map with touch gestures.
     * Find more details and examples using `touchZoomRotate` in the {@link TouchZoomRotateHandler} section.
     */
    touchZoomRotate: TouchZoomRotateHandler;

    /**
     * The map's {@link TouchPitchHandler}, which allows the user to pitch the map with touch gestures.
     * Find more details and examples using `touchPitch` in the {@link TouchPitchHandler} section.
     */
    touchPitch: TouchPitchHandler;

    _contextCreateOptions: ContextOptions;
    _tp: ITrackedParameters;

    // Current frame id, iterated on each render
    _frameId: number;

    _spriteFormat: SpriteFormat;

    constructor(options: MapOptions) {
        LivePerformanceUtils.mark(LivePerformanceMarkers.create);

        const initialOptions = options;

        options = extend({}, defaultOptions, options);

        if (options.minZoom != null && options.maxZoom != null && options.minZoom > options.maxZoom) {
            throw new Error(`maxZoom must be greater than or equal to minZoom`);
        }

        if (options.minPitch != null && options.maxPitch != null && options.minPitch > options.maxPitch) {
            throw new Error(`maxPitch must be greater than or equal to minPitch`);
        }

        if (options.minPitch != null && options.minPitch < defaultMinPitch) {
            throw new Error(`minPitch must be greater than or equal to ${defaultMinPitch}`);
        }

        if (options.maxPitch != null && options.maxPitch > defaultMaxPitch) {
            throw new Error(`maxPitch must be less than or equal to ${defaultMaxPitch}`);
        }

        // disable antialias with OS/iOS 15.4 and 15.5 due to rendering bug
        if (options.antialias && isSafariWithAntialiasingBug(window)) {
            options.antialias = false;
            warnOnce('Antialiasing is disabled for this WebGL context to avoid browser bug: https://github.com/mapbox/mapbox-gl-js/issues/11609');
        }

        const transform = new Transform(options.minZoom, options.maxZoom, options.minPitch, options.maxPitch, options.renderWorldCopies, null, null);
        super(transform, options);

        this._repaint = !!options.repaint;
        this._interactive = options.interactive;
        this._minTileCacheSize = options.minTileCacheSize;
        this._maxTileCacheSize = options.maxTileCacheSize;
        this._failIfMajorPerformanceCaveat = options.failIfMajorPerformanceCaveat;
        this._preserveDrawingBuffer = options.preserveDrawingBuffer;
        this._antialias = options.antialias;
        this._trackResize = options.trackResize;
        this._bearingSnap = options.bearingSnap;
        this._refreshExpiredTiles = options.refreshExpiredTiles;
        this._fadeDuration = options.fadeDuration;
        this._isInitialLoad = true;
        this._crossSourceCollisions = options.crossSourceCollisions;
        this._collectResourceTiming = options.collectResourceTiming;
        this._language = this._parseLanguage(options.language);
        this._worldview = options.worldview;
        this._renderTaskQueue = new TaskQueue();
        this._domRenderTaskQueue = new TaskQueue();
        this._controls = [];
        this._markers = [];
        this._popups = [];
        this._mapId = uniqueId();
        this._locale = extend({}, defaultLocale, options.locale);
        this._clickTolerance = options.clickTolerance;
        this._cooperativeGestures = options.cooperativeGestures;
        this._performanceMetricsCollection = options.performanceMetricsCollection;
        this._tessellationStep = options.tessellationStep;
        this._containerWidth = 0;
        this._containerHeight = 0;
        this._showParseStatus = true;
        this._precompilePrograms = options.precompilePrograms;
        this._scaleFactorChanged = false;

        this._averageElevationLastSampledAt = -Infinity;
        this._averageElevationExaggeration = 0;
        this._averageElevation = new EasedVariable(0);

        this._interactionRange = [+Infinity, -Infinity];
        this._visibilityHidden = 0;

        this._useExplicitProjection = false; // Fallback to stylesheet by default

        this._frameId = 0;

        this._scaleFactor = options.scaleFactor;

        this._requestManager = new RequestManager(options.transformRequest, options.accessToken, options.testMode);
        this._silenceAuthErrors = !!options.testMode;
        if (options.contextCreateOptions) {
            this._contextCreateOptions = Object.assign({}, options.contextCreateOptions);
        } else {
            this._contextCreateOptions = {};
        }

        if (typeof options.container === 'string') {
            const container = document.getElementById(options.container);
            if (container) {
                this._container = container;
            } else {
                throw new Error(`Container '${options.container.toString()}' not found.`);
            }

        } else if (options.container instanceof HTMLElement) {
            this._container = options.container;
        } else {
            throw new Error(`Invalid type: 'container' must be a String or HTMLElement.`);
        }

        if (this._container.childNodes.length > 0) {
            warnOnce(`The map container element should be empty, otherwise the map's interactivity will be negatively impacted. If you want to display a message when WebGL is not supported, use the Mapbox GL Supported plugin instead.`);
        }

        if (options.maxBounds) {
            this.setMaxBounds(options.maxBounds);
        }

        this._spriteFormat = options.spriteFormat;

        bindAll([
            '_onWindowOnline',
            '_onWindowResize',
            '_onVisibilityChange',
            '_onMapScroll',
            '_contextLost',
            '_contextRestored'
        ], this);

        this._setupContainer();

        Debug.run(() => {
            if (options.devtools) {
                this._tp = new TrackedParameters(this);
            }
        });
        if (!this._tp) {
            this._tp = new TrackedParametersMock();
        }

        this._tp.registerParameter(this, ["Debug"], "showOverdrawInspector");
        this._tp.registerParameter(this, ["Debug"], "showTileBoundaries");
        this._tp.registerParameter(this, ["Debug"], "showParseStatus");
        this._tp.registerParameter(this, ["Debug"], "repaint");
        this._tp.registerParameter(this, ["Debug"], "showTileAABBs");
        this._tp.registerParameter(this, ["Debug"], "showPadding");
        this._tp.registerParameter(this, ["Debug"], "showCollisionBoxes", {noSave: true});
        this._tp.registerParameter(this.transform, ["Debug"], "freezeTileCoverage", {noSave: true}, () => {
            this._update();
        });
        this._tp.registerParameter(this, ["Debug", "Wireframe"], "showTerrainWireframe");
        this._tp.registerParameter(this, ["Debug", "Wireframe"], "showLayers2DWireframe");
        this._tp.registerParameter(this, ["Debug", "Wireframe"], "showLayers3DWireframe");
        this._tp.registerParameter(this, ["Scaling"], "_scaleFactor", {min: 0.1, max: 10.0, step: 0.1}, () => {
            this.setScaleFactor(this._scaleFactor);
        });

        this._setupPainter();
        if (this.painter === undefined) {
            throw new Error(`Failed to initialize WebGL.`);
        }

        this.on('move', () => this._update(false));
        this.on('moveend', () => this._update(false));
        this.on('zoom', () => this._update(true));

        this._fullscreenchangeEvent = 'onfullscreenchange' in document ?
            'fullscreenchange' :
            'webkitfullscreenchange';

        window.addEventListener('online', this._onWindowOnline, false);
        window.addEventListener('resize', this._onWindowResize, false);
        window.addEventListener('orientationchange', this._onWindowResize, false);
        window.addEventListener(this._fullscreenchangeEvent, this._onWindowResize, false);
        window.addEventListener('visibilitychange', this._onVisibilityChange, false);

        this.handlers = new HandlerManager(this, options as MapOptions & typeof defaultOptions);

        this._localFontFamily = options.localFontFamily;
        this._localIdeographFontFamily = options.localIdeographFontFamily;

        if (options.style || !options.testMode) {
            const style = options.style || config.DEFAULT_STYLE;
            this.setStyle(style, {
                config: options.config,
                localFontFamily: this._localFontFamily,
                localIdeographFontFamily: this._localIdeographFontFamily
            });
        }

        if (options.projection) {
            this.setProjection(options.projection);
        }

        this.indoor = new IndoorManager(this);

        const hashName = (typeof options.hash === 'string' && options.hash) || undefined;
        if (options.hash) this._hash = (new Hash(hashName)).addTo(this);
        // don't set position from options if set through hash
        if (!this._hash || !this._hash._onHashChange()) {
            // if we set `center`/`zoom` explicitly, mark as modified even if the values match defaults
            if (initialOptions.center != null || initialOptions.zoom != null) {
                this.transform._unmodified = false;
            }

            this.jumpTo({
                center: options.center,
                zoom: options.zoom,
                bearing: options.bearing,
                pitch: options.pitch
            });

            const bounds = options.bounds;
            if (bounds) {
                this.resize();
                this.fitBounds(bounds, extend({}, options.fitBoundsOptions, {duration: 0}));
            }
        }

        this.resize();

        if (options.attributionControl)
            this.addControl(new AttributionControl({customAttribution: options.customAttribution}));

        this._logoControl = new LogoControl();
        this.addControl(this._logoControl, options.logoPosition);

        this.on('style.load', () => {
            if (this.transform.unmodified) {
                this.jumpTo((this.style.stylesheet as unknown));
            }
            this._postStyleLoadEvent();
        });

        this.on('data', (event) => {
            this._update(event.dataType === 'style');
            this.fire(new Event(`${event.dataType}data`, event));
        });

        this.on('dataloading', (event) => {
            this.fire(new Event(`${event.dataType}dataloading`, event));
        });

        this._interactions = new InteractionSet(this);
    }

    /*
    * Returns a unique number for this map instance which is used for the MapLoadEvent
    * to make sure we only fire one event per instantiated map object.
    * @private
    * @returns {number}
    */
    _getMapId(): number {
        return this._mapId;
    }

    /** @section Controls */

    /**
     * Adds an {@link IControl} to the map, calling `control.onAdd(this)`.
     *
     * @param {IControl} control The {@link IControl} to add.
     * @param {string} [position] Position on the map to which the control will be added.
     * Valid values are `'top-left'`, `'top'`, `'top-right'`, `'right'`, `'bottom-right'`,
     * `'bottom'`, `'bottom-left'`, and `'left'`. Defaults to `'top-right'`.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Add zoom and rotation controls to the map.
     * map.addControl(new mapboxgl.NavigationControl());
     * @see [Example: Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
     */
    addControl(control: IControl, position?: ControlPosition): this {
        if (position === undefined) {
            if (control.getDefaultPosition) {
                position = control.getDefaultPosition();
            } else {
                position = 'top-right';
            }
        }
        if (!control || !control.onAdd) {
            return this.fire(new ErrorEvent(new Error(
                'Invalid argument to map.addControl(). Argument must be a control with onAdd and onRemove methods.')));
        }
        const controlElement = control.onAdd(this);
        this._controls.push(control);

        const positionContainer = this._controlPositions[position];
        if (position.indexOf('bottom') !== -1) {
            positionContainer.insertBefore(controlElement, positionContainer.firstChild);
        } else {
            positionContainer.appendChild(controlElement);
        }
        return this;
    }

    /**
     * Removes the control from the map.
     *
     * @param {IControl} control The {@link IControl} to remove.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Define a new navigation control.
     * const navigation = new mapboxgl.NavigationControl();
     * // Add zoom and rotation controls to the map.
     * map.addControl(navigation);
     * // Remove zoom and rotation controls from the map.
     * map.removeControl(navigation);
     */
    removeControl(control: IControl): this {
        if (!control || !control.onRemove) {
            return this.fire(new ErrorEvent(new Error(
                'Invalid argument to map.removeControl(). Argument must be a control with onAdd and onRemove methods.')));
        }
        const ci = this._controls.indexOf(control);
        if (ci > -1) this._controls.splice(ci, 1);
        control.onRemove(this);
        return this;
    }

    /**
     * Checks if a control is on the map.
     *
     * @param {IControl} control The {@link IControl} to check.
     * @returns {boolean} True if map contains control.
     * @example
     * // Define a new navigation control.
     * const navigation = new mapboxgl.NavigationControl();
     * // Add zoom and rotation controls to the map.
     * map.addControl(navigation);
     * // Check that the navigation control exists on the map.
     * const added = map.hasControl(navigation);
     * // added === true
     */
    hasControl(control: IControl): boolean {
        return this._controls.indexOf(control) > -1;
    }

    /**
     * Returns the map's containing HTML element.
     *
     * @returns {HTMLElement} The map's container.
     * @example
     * const container = map.getContainer();
     */
    getContainer(): HTMLElement {
        return this._container;
    }

    /**
     * Returns the HTML element containing the map's `<canvas>` element.
     *
     * If you want to add non-GL overlays to the map, you should append them to this element.
     *
     * This is the element to which event bindings for map interactivity (such as panning and zooming) are
     * attached. It will receive bubbled events from child elements such as the `<canvas>`, but not from
     * map controls.
     *
     * @returns {HTMLElement} The container of the map's `<canvas>`.
     * @example
     * const canvasContainer = map.getCanvasContainer();
     * @see [Example: Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Example: Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     */
    getCanvasContainer(): HTMLElement {
        return this._canvasContainer;
    }

    /**
     * Returns the map's `<canvas>` element.
     *
     * @returns {HTMLCanvasElement} The map's `<canvas>` element.
     * @example
     * const canvas = map.getCanvas();
     * @see [Example: Measure distances](https://www.mapbox.com/mapbox-gl-js/example/measure/)
     * @see [Example: Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Example: Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     */
    getCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    /** @section Map constraints */

    /**
     * Resizes the map according to the dimensions of its
     * `container` element.
     *
     * Checks if the map container size changed and updates the map if it has changed.
     * This method must be called after the map's `container` is resized programmatically
     * or when the map is shown after being initially hidden with CSS.
     *
     * @param {Object | null} eventData Additional properties to be passed to `movestart`, `move`, `resize`, and `moveend`
     * events that get triggered as a result of resize. This can be useful for differentiating the
     * source of an event (for example, user-initiated or programmatically-triggered events).
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Resize the map when the map container is shown
     * // after being initially hidden with CSS.
     * const mapDiv = document.getElementById('map');
     * if (mapDiv.style.visibility === true) map.resize();
     */
    resize(eventData?: object): this {
        this._updateContainerDimensions();

        // do nothing if container remained the same size
        if (this._containerWidth === this.transform.width && this._containerHeight === this.transform.height) return this;

        this._resizeCanvas(this._containerWidth, this._containerHeight);

        this.transform.resize(this._containerWidth, this._containerHeight);
        this.painter.resize(Math.ceil(this._containerWidth), Math.ceil(this._containerHeight));

        const fireMoving = !this._moving;
        if (fireMoving) {
            this.fire(new Event('movestart', eventData))
                .fire(new Event('move', eventData));
        }

        this.fire(new Event('resize', eventData));

        if (fireMoving) this.fire(new Event('moveend', eventData));

        return this;
    }

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * If a padding is set on the map, the bounds returned are for the inset.
     * With globe projection, the smallest bounds encompassing the visible region
     * may not precisely represent the visible region due to the earth's curvature.
     *
     * @returns {LngLatBounds} The geographical bounds of the map as {@link LngLatBounds}.
     * @example
     * const bounds = map.getBounds();
     */
    getBounds(): LngLatBounds | null {
        return this.transform.getBounds();
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     *
     * @returns {Map} The map object.
     *
     * @example
     * const maxBounds = map.getMaxBounds();
     */
    getMaxBounds(): LngLatBounds | null {
        return this.transform.getMaxBounds() || null;
    }

    /**
     * Sets or clears the map's geographical bounds.
     *
     * Pan and zoom operations are constrained within these bounds.
     * If a pan or zoom is performed that would
     * display regions outside these bounds, the map will
     * instead display a position and zoom level
     * as close as possible to the operation's request while still
     * remaining within the bounds.
     *
     * For `mercator` projection, the viewport will be constrained to the bounds.
     * For other projections such as `globe`, only the map center will be constrained.
     *
     * @param {LngLatBoundsLike | null | undefined} bounds The maximum bounds to set. If `null` or `undefined` is provided, the function removes the map's maximum bounds.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Define bounds that conform to the `LngLatBoundsLike` object.
     * const bounds = [
     *     [-74.04728, 40.68392], // [west, south]
     *     [-73.91058, 40.87764]  // [east, north]
     * ];
     * // Set the map's max bounds.
     * map.setMaxBounds(bounds);
     */
    setMaxBounds(bounds: LngLatBoundsLike): this {
        this.transform.setMaxBounds(LngLatBounds.convert(bounds));
        return this._update();
    }

    /**
     * Sets or clears the map's minimum zoom level.
     * If the map's current zoom level is lower than the new minimum,
     * the map will zoom to the new minimum.
     *
     * It is not always possible to zoom out and reach the set `minZoom`.
     * Other factors such as map height may restrict zooming. For example,
     * if the map is 512px tall it will not be possible to zoom below zoom 0
     * no matter what the `minZoom` is set to.
     *
     * @param {number | null | undefined} minZoom The minimum zoom level to set (-2 - 24).
     * If `null` or `undefined` is provided, the function removes the current minimum zoom and it will be reset to -2.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setMinZoom(12.25);
     */
    setMinZoom(minZoom?: number | null): this {

        minZoom = minZoom === null || minZoom === undefined ? defaultMinZoom : minZoom;

        if (minZoom >= defaultMinZoom && minZoom <= this.transform.maxZoom) {
            this.transform.minZoom = minZoom;
            this._update();

            if (this.getZoom() < minZoom) {
                this.setZoom(minZoom);
            } else {
                this.fire(new Event('zoomstart'))
                    .fire(new Event('zoom'))
                    .fire(new Event('zoomend'));
            }

            return this;

        } else throw new Error(`minZoom must be between ${defaultMinZoom} and the current maxZoom, inclusive`);
    }

    /**
     * Returns the map's minimum allowable zoom level.
     *
     * @returns {number} Returns `minZoom`.
     * @example
     * const minZoom = map.getMinZoom();
     */
    getMinZoom(): number { return this.transform.minZoom; }

    /**
     * Sets or clears the map's maximum zoom level.
     * If the map's current zoom level is higher than the new maximum,
     * the map will zoom to the new maximum.
     *
     * @param {number | null | undefined} maxZoom The maximum zoom level to set.
     * If `null` or `undefined` is provided, the function removes the current maximum zoom (sets it to 22).
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setMaxZoom(18.75);
     */
    setMaxZoom(maxZoom?: number | null): this {

        maxZoom = maxZoom === null || maxZoom === undefined ? defaultMaxZoom : maxZoom;

        if (maxZoom >= this.transform.minZoom) {
            this.transform.maxZoom = maxZoom;
            this._update();

            if (this.getZoom() > maxZoom) {
                this.setZoom(maxZoom);
            } else {
                this.fire(new Event('zoomstart'))
                    .fire(new Event('zoom'))
                    .fire(new Event('zoomend'));
            }

            return this;

        } else throw new Error(`maxZoom must be greater than the current minZoom`);
    }

    /**
     * Returns the map's maximum allowable zoom level.
     *
     * @returns {number} Returns `maxZoom`.
     * @example
     * const maxZoom = map.getMaxZoom();
     */
    getMaxZoom(): number { return this.transform.maxZoom; }

    /**
     * Sets or clears the map's minimum pitch.
     * If the map's current pitch is lower than the new minimum,
     * the map will pitch to the new minimum.
     *
     * @param {number | null | undefined} minPitch The minimum pitch to set (0-85). If `null` or `undefined` is provided, the function removes the current minimum pitch and resets it to 0.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setMinPitch(5);
     */
    setMinPitch(minPitch?: number | null): this {

        minPitch = minPitch === null || minPitch === undefined ? defaultMinPitch : minPitch;

        if (minPitch < defaultMinPitch) {
            throw new Error(`minPitch must be greater than or equal to ${defaultMinPitch}`);
        }

        if (minPitch >= defaultMinPitch && minPitch <= this.transform.maxPitch) {
            this.transform.minPitch = minPitch;
            this._update();

            if (this.getPitch() < minPitch) {
                this.setPitch(minPitch);
            } else {
                this.fire(new Event('pitchstart'))
                    .fire(new Event('pitch'))
                    .fire(new Event('pitchend'));
            }

            return this;

        } else throw new Error(`minPitch must be between ${defaultMinPitch} and the current maxPitch, inclusive`);
    }

    /**
     * Returns the map's minimum allowable pitch.
     *
     * @returns {number} Returns `minPitch`.
     * @example
     * const minPitch = map.getMinPitch();
     */
    getMinPitch(): number { return this.transform.minPitch; }

    /**
     * Sets or clears the map's maximum pitch.
     * If the map's current pitch is higher than the new maximum,
     * the map will pitch to the new maximum.
     *
     * @param {number | null | undefined} maxPitch The maximum pitch to set.
     * If `null` or `undefined` is provided, the function removes the current maximum pitch (sets it to 85).
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setMaxPitch(70);
     */
    setMaxPitch(maxPitch?: number | null): this {

        maxPitch = maxPitch === null || maxPitch === undefined ? defaultMaxPitch : maxPitch;

        if (maxPitch > defaultMaxPitch) {
            throw new Error(`maxPitch must be less than or equal to ${defaultMaxPitch}`);
        }

        if (maxPitch >= this.transform.minPitch) {
            this.transform.maxPitch = maxPitch;
            this._update();

            if (this.getPitch() > maxPitch) {
                this.setPitch(maxPitch);
            } else {
                this.fire(new Event('pitchstart'))
                    .fire(new Event('pitch'))
                    .fire(new Event('pitchend'));
            }

            return this;

        } else throw new Error(`maxPitch must be greater than or equal to minPitch`);
    }

    /**
     * Returns the map's maximum allowable pitch.
     *
     * @returns {number} Returns `maxPitch`.
     * @example
     * const maxPitch = map.getMaxPitch();
     */
    getMaxPitch(): number { return this.transform.maxPitch; }

    /**
     * Returns the map's current scale factor.
     *
     * @returns {number} Returns the map's scale factor.
     * @private
     *
     * @example
     * const scaleFactor = map.getScaleFactor();
     */
    getScaleFactor(): number {
        return this._scaleFactor;
    }

    /**
     * Sets the map's scale factor.
     *
     * @param {number} scaleFactor The scale factor to set.
     * @returns {Map} Returns itself to allow for method chaining.
     * @private
     *
     * @example
     *
     * map.setScaleFactor(2);
     */
    setScaleFactor(scaleFactor: number): this {
        this._scaleFactor = scaleFactor;
        this.painter.scaleFactor = scaleFactor;
        this._tp.refreshUI();

        this._scaleFactorChanged = true;

        this.style._updateFilteredLayers((layer) => layer.type === 'symbol');
        this._update(true);
        return this;
    }

    /**
     * Returns the state of `renderWorldCopies`. If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`:
     * - When the map is zoomed out far enough that a single representation of the world does not fill the map's entire
     * container, there will be blank space beyond 180 and -180 degrees longitude.
     * - Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the
     * map and the other on the left edge of the map) at every zoom level.
     *
     * @returns {boolean} Returns `renderWorldCopies` boolean.
     * @example
     * const worldCopiesRendered = map.getRenderWorldCopies();
     * @see [Example: Render world copies](https://docs.mapbox.com/mapbox-gl-js/example/render-world-copies/)
     */
    getRenderWorldCopies(): boolean { return this.transform.renderWorldCopies; }

    /**
     * Sets the state of `renderWorldCopies`.
     *
     * @param {boolean} renderWorldCopies If `true`, multiple copies of the world will be rendered side by side beyond -180 and 180 degrees longitude. If set to `false`:
     * - When the map is zoomed out far enough that a single representation of the world does not fill the map's entire
     * container, there will be blank space beyond 180 and -180 degrees longitude.
     * - Features that cross 180 and -180 degrees longitude will be cut in two (with one portion on the right edge of the
     * map and the other on the left edge of the map) at every zoom level.
     *
     * `undefined` is treated as `true`, `null` is treated as `false`.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setRenderWorldCopies(true);
     * @see [Example: Render world copies](https://docs.mapbox.com/mapbox-gl-js/example/render-world-copies/)
     */
    setRenderWorldCopies(renderWorldCopies?: boolean | null): this {
        this.transform.renderWorldCopies = renderWorldCopies;
        if (!this.transform.renderWorldCopies) {
            this._forceMarkerAndPopupUpdate(true);
        }
        return this._update();
    }

    /**
     * Returns the map's language, which is used for translating map labels and UI components.
     *
     * @private
     * @returns {undefined | string | string[]} Returns the map's language code.
     * @example
     * const language = map.getLanguage();
     */
    getLanguage(): string | null | undefined | string[] {
        return this._language;
    }

    _parseLanguage(language?: 'auto' | (string & NonNullable<unknown>) | string[]): string | null | undefined | string[] {
        if (language === 'auto') return navigator.language;
        if (Array.isArray(language)) return language.length === 0 ?
            undefined :
            language.map(l => (l === 'auto' ? navigator.language : l));

        return language;
    }

    /**
     * Sets the map's language, which is used for translating map labels and UI components.
     *
     * @private
     * @param {'auto' | string | string[]} [language] A string representing the desired language used for the map's labels and UI components. Languages can only be set on Mapbox vector tile sources.
     *  Valid language strings must be a [BCP-47 language code](https://en.wikipedia.org/wiki/IETF_language_tag#List_of_subtags). Unsupported BCP-47 codes will not include any translations. Invalid codes will result in an recoverable error.
     *  If a label has no translation for the selected language, it will display in the label's local language.
     *  If param is set to `auto`, GL JS will select a user's preferred language as determined by the browser's [`window.navigator.language`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) property.
     *  If the `locale` property is not set separately, this language will also be used to localize the UI for supported languages.
     *  If param is set to `undefined` or `null`, it will remove the current map language and reset the language used for translating map labels and UI components.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setLanguage('es');
     *
     * @example
     * map.setLanguage(['en-GB', 'en-US']);
     *
     * @example
     * map.setLanguage('auto');
     *
     * @example
     * map.setLanguage();
     */
    setLanguage(language?: 'auto' | (string & NonNullable<unknown>) | string[]): this {
        const newLanguage = this._parseLanguage(language);
        if (!this.style || newLanguage === this._language) return this;
        this._language = newLanguage;

        this.style.reloadSources();

        for (const control of this._controls) {
            if (control._setLanguage) {
                control._setLanguage(this._language);
            }
        }

        return this;
    }

    /**
     * Returns the code for the map's worldview.
     *
     * @private
     * @returns {string} Returns the map's worldview code.
     * @example
     * const worldview = map.getWorldview();
     */
    getWorldview(): string | null | undefined {
        return this._worldview;
    }

    /**
     * Sets the map's worldview.
     *
     * @private
     * @param {string} [worldview] A string representing the desired worldview.
     *  A worldview determines the way that certain disputed boundaries are rendered.
     *  Valid worldview strings must be an [ISO alpha-2 country code](https://en.wikipedia.org/wiki/ISO_3166-1#Current_codes).
     *  Unsupported ISO alpha-2 codes will fall back to the TileJSON's default worldview. Invalid codes will result in a recoverable error.
     *  If param is set to `undefined` or `null`, it will cause the map to fall back to the TileJSON's default worldview.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setWorldview('JP');
     *
     * @example
     * map.setWorldview();
     */
    setWorldview(worldview?: string | null): this {
        if (!this.style || worldview === this._worldview) return this;

        this._worldview = worldview;
        this._styleDirty = true;
        this.style.reloadSources();

        return this;
    }

    /** @section Point conversion */

    /**
     * Returns a [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) object that defines the current map projection.
     *
     * @returns {ProjectionSpecification} The [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) defining the current map projection.
     * @example
     * const projection = map.getProjection();
     */
    getProjection(): ProjectionSpecification {
        if (this.transform.mercatorFromTransition) {
            return {name: "globe", center: [0, 0]};
        }
        return this.transform.getProjection();
    }

    /**
     * Returns true if map [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) has been set to globe AND the map is at a low enough zoom level that globe view is enabled.
     * @private
     * @returns {boolean} Returns `globe-is-active` boolean.
     * @example
     * if (map._showingGlobe()) {
     *     // do globe things here
     * }
     */
    _showingGlobe(): boolean { return this.transform.projection.name === 'globe'; }

    /**
     * Sets the map's projection. If called with `null` or `undefined`, the map will reset to Mercator.
     *
     * @param {ProjectionSpecification | string | null | undefined} projection The projection that the map should be rendered in.
     * This can be a [projection](https://docs.mapbox.com/mapbox-gl-js/style-spec/projection/) object or a string of the projection's name.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setProjection('albers');
     * map.setProjection({
     *     name: 'albers',
     *     center: [35, 55],
     *     parallels: [20, 60]
     * });
     * @see [Example: Display a web map using an alternate projection](https://docs.mapbox.com/mapbox-gl-js/example/map-projection/)
     * @see [Example: Use different map projections for web maps](https://docs.mapbox.com/mapbox-gl-js/example/projections/)
     */
    setProjection(projection?: ProjectionSpecification | null | string): this {
        this._lazyInitEmptyStyle();

        if (!projection) {
            projection = null;
        } else if (typeof projection === 'string') {
            projection = {name: projection} as ProjectionSpecification;
        }

        this._useExplicitProjection = !!projection;
        return this._prioritizeAndUpdateProjection(projection as ProjectionSpecification, this.style.projection);
    }

    _updateProjectionTransition() {
        // The projection isn't globe, we can skip updating the transition
        if (this.getProjection().name !== 'globe') {
            return;
        }

        const tr = this.transform;
        const projection = tr.projection.name;
        let projectionHasChanged;

        if (projection === 'globe' && tr.zoom >= GLOBE_ZOOM_THRESHOLD_MAX) {
            tr.setMercatorFromTransition();
            projectionHasChanged = true;
        } else if (projection === 'mercator' && tr.zoom < GLOBE_ZOOM_THRESHOLD_MAX) {
            tr.setProjection({name: 'globe'});
            projectionHasChanged = true;
        }

        if (projectionHasChanged) {
            this.style.applyProjectionUpdate();
            this.style._forceSymbolLayerUpdate();
            this._update(true);
        }
    }

    _prioritizeAndUpdateProjection(
        explicitProjection?: ProjectionSpecification | null,
        styleProjection?: ProjectionSpecification | null,
    ): this {
        // Given a stylesheet and eventual runtime projection, in order of priority, we select:
        //  1. the explicit projection
        //  2. the stylesheet projection
        //  3. mercator (fallback)
        const prioritizedProjection = explicitProjection || styleProjection || {name: "mercator"};

        return this._updateProjection(prioritizedProjection);
    }

    _updateProjection(projection: ProjectionSpecification): this {
        let projectionHasChanged;

        if (projection.name === 'globe' && this.transform.zoom >= GLOBE_ZOOM_THRESHOLD_MAX) {
            projectionHasChanged = this.transform.setMercatorFromTransition();
        } else {
            projectionHasChanged = this.transform.setProjection(projection);
        }

        this.style.applyProjectionUpdate();

        if (projectionHasChanged) {
            this.painter.clearBackgroundTiles();
            this.style.clearSources();

            this._update(true);
            this._forceMarkerAndPopupUpdate(true);
        }

        return this;
    }

    /**
     * Returns a {@link Point} representing pixel coordinates, relative to the map's `container`,
     * that correspond to the specified geographical location.
     *
     * When the map is pitched and `lnglat` is completely behind the camera, there are no pixel
     * coordinates corresponding to that location. In that case,
     * the `x` and `y` components of the returned {@link Point} are set to Number.MAX_VALUE.
     *
     * @param {LngLatLike} lnglat The geographical location to project.
     * @param {number} altitude (optional) altitude above the map plane in meters.
     * @returns {Point} The {@link Point} corresponding to `lnglat`, relative to the map's `container`.
     * @example
     * const coordinate = [-122.420679, 37.772537];
     * const point = map.project(coordinate);
     */
    project(lnglat: LngLatLike, altitude?: number): Point {
        return this.transform.locationPoint3D(LngLat.convert(lnglat), altitude);
    }

    /**
     * Returns a {@link LngLat} representing geographical coordinates that correspond
     * to the specified pixel coordinates. If horizon is visible, and specified pixel is
     * above horizon, returns a {@link LngLat} corresponding to point on horizon, nearest
     * to the point.
     *
     * @param {PointLike} point The pixel coordinates to unproject.
     * @param {number} altitude (optional) altitude above the map plane in meters.
     * @returns {LngLat} The {@link LngLat} corresponding to `point`.
     * @example
     * map.on('click', (e) => {
     *     // When the map is clicked, get the geographic coordinate.
     *     const coordinate = map.unproject(e.point);
     * });
     */
    unproject(point: PointLike, altitude?: number): LngLat {
        return this.transform.pointLocation3D(Point.convert(point), altitude);
    }

    /** @section Movement state */

    /**
     * Returns true if the map is panning, zooming, rotating, or pitching due to a camera animation or user gesture.
     *
     * @returns {boolean} True if the map is moving.
     * @example
     * const isMoving = map.isMoving();
     */
    isMoving(): boolean {
        return this._moving || (this.handlers && this.handlers.isMoving()) || false;
    }

    /**
     * Returns true if the map is zooming due to a camera animation or user gesture.
     *
     * @returns {boolean} True if the map is zooming.
     * @example
     * const isZooming = map.isZooming();
     */
    isZooming(): boolean {
        return this._zooming || (this.handlers && this.handlers.isZooming()) || false;
    }

    /**
     * Returns true if the map is rotating due to a camera animation or user gesture.
     *
     * @returns {boolean} True if the map is rotating.
     * @example
     * map.isRotating();
     */
    isRotating(): boolean {
        return this._rotating || (this.handlers && this.handlers.isRotating()) || false;
    }

    _isDragging(): boolean {
        return (this.handlers && this.handlers._isDragging()) || false;
    }

    _createDelegatedListener<T extends MapEventType>(type: T, targets: string[] | TargetDescriptor, listener: Listener<T>): DelegatedListener {
        const queryRenderedFeatures = (point: PointLike | [PointLike, PointLike]) => {
            let features: Array<GeoJSONFeature | TargetFeature> = [];

            if (Array.isArray(targets)) {
                const filteredLayers = targets.filter(layerId => this.getLayer(layerId));
                features = filteredLayers.length ? this.queryRenderedFeatures(point, {layers: filteredLayers}) : [];
            } else {
                features = this.queryRenderedFeatures(point, {target: targets});
            }

            return features;
        };

        if (type === 'mouseenter' || type === 'mouseover') {
            let mousein = false;

            const mousemove = (e: MapMouseEvent) => {
                const features = queryRenderedFeatures(e.point);

                if (!features.length) {
                    mousein = false;
                } else if (!mousein) {
                    mousein = true;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent, {features}));
                }
            };

            const mouseout = () => {
                mousein = false;
            };

            return {listener, targets, delegates: {mousemove, mouseout}};
        } else if (type === 'mouseleave' || type === 'mouseout') {
            let mousein = false;

            const mousemove = (e: MapMouseEvent) => {
                const features = queryRenderedFeatures(e.point);

                if (features.length) {
                    mousein = true;
                } else if (mousein) {
                    mousein = false;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                }
            };

            const mouseout = (e: MapMouseEvent) => {
                if (mousein) {
                    mousein = false;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                }
            };

            return {listener, targets, delegates: {mousemove, mouseout}};
        } else {
            const delegate = (e: MapMouseEvent) => {
                const features = queryRenderedFeatures(e.point);

                if (features.length) {
                    // Here we need to mutate the original event, so that preventDefault works as expected.
                    e.features = features;
                    listener.call(this, e);
                    delete e.features;
                }
            };

            return {listener, targets, delegates: {[type]: delegate}};
        }
    }

    /** @section Working with events */

    /**
     * Adds a listener for events of a specified type,
     * optionally limited to features in a specified style layer.
     *
     * @param {string} type The event type to listen for. Events compatible with the optional `layerId` parameter are triggered
     * when the cursor enters a visible portion of the specified layer from outside that layer or outside the map canvas.
     *
     * | Event                                                     | Compatible with `layerId` |
     * |-----------------------------------------------------------|---------------------------|
     * | [`mousedown`](#map.event:mousedown)                       | yes                       |
     * | [`mouseup`](#map.event:mouseup)                           | yes                       |
     * | [`mouseover`](#map.event:mouseover)                       | yes                       |
     * | [`mouseout`](#map.event:mouseout)                         | yes                       |
     * | [`mousemove`](#map.event:mousemove)                       | yes                       |
     * | [`mouseenter`](#map.event:mouseenter)                     | yes (required)            |
     * | [`mouseleave`](#map.event:mouseleave)                     | yes (required)            |
     * | [`preclick`](#map.event:preclick)                         |                           |
     * | [`click`](#map.event:click)                               | yes                       |
     * | [`dblclick`](#map.event:dblclick)                         | yes                       |
     * | [`contextmenu`](#map.event:contextmenu)                   | yes                       |
     * | [`touchstart`](#map.event:touchstart)                     | yes                       |
     * | [`touchend`](#map.event:touchend)                         | yes                       |
     * | [`touchcancel`](#map.event:touchcancel)                   | yes                       |
     * | [`wheel`](#map.event:wheel)                               |                           |
     * | [`resize`](#map.event:resize)                             |                           |
     * | [`remove`](#map.event:remove)                             |                           |
     * | [`touchmove`](#map.event:touchmove)                       |                           |
     * | [`movestart`](#map.event:movestart)                       |                           |
     * | [`move`](#map.event:move)                                 |                           |
     * | [`moveend`](#map.event:moveend)                           |                           |
     * | [`dragstart`](#map.event:dragstart)                       |                           |
     * | [`drag`](#map.event:drag)                                 |                           |
     * | [`dragend`](#map.event:dragend)                           |                           |
     * | [`zoomstart`](#map.event:zoomstart)                       |                           |
     * | [`zoom`](#map.event:zoom)                                 |                           |
     * | [`zoomend`](#map.event:zoomend)                           |                           |
     * | [`rotatestart`](#map.event:rotatestart)                   |                           |
     * | [`rotate`](#map.event:rotate)                             |                           |
     * | [`rotateend`](#map.event:rotateend)                       |                           |
     * | [`pitchstart`](#map.event:pitchstart)                     |                           |
     * | [`pitch`](#map.event:pitch)                               |                           |
     * | [`pitchend`](#map.event:pitchend)                         |                           |
     * | [`boxzoomstart`](#map.event:boxzoomstart)                 |                           |
     * | [`boxzoomend`](#map.event:boxzoomend)                     |                           |
     * | [`boxzoomcancel`](#map.event:boxzoomcancel)               |                           |
     * | [`webglcontextlost`](#map.event:webglcontextlost)         |                           |
     * | [`webglcontextrestored`](#map.event:webglcontextrestored) |                           |
     * | [`load`](#map.event:load)                                 |                           |
     * | [`render`](#map.event:render)                             |                           |
     * | [`idle`](#map.event:idle)                                 |                           |
     * | [`error`](#map.event:error)                               |                           |
     * | [`data`](#map.event:data)                                 |                           |
     * | [`styledata`](#map.event:styledata)                       |                           |
     * | [`sourcedata`](#map.event:sourcedata)                     |                           |
     * | [`dataloading`](#map.event:dataloading)                   |                           |
     * | [`styledataloading`](#map.event:styledataloading)         |                           |
     * | [`sourcedataloading`](#map.event:sourcedataloading)       |                           |
     * | [`styleimagemissing`](#map.event:styleimagemissing)       |                           |
     * | [`style.load`](#map.event:style.load)                     |                           |
     *
     * @param {string | Array<string>} layerIds (optional) The ID(s) of a style layer(s). If you provide a `layerId`,
     * the listener will be triggered only if its location is within a visible feature in these layers,
     * and the event will have a `features` property containing an array of the matching features.
     * If you do not provide `layerIds`, the listener will be triggered by a corresponding event
     * happening anywhere on the map, and the event will not have a `features` property.
     * Note that many event types are not compatible with the optional `layerIds` parameter.
     * @param {Function} listener The function to be called when the event is fired.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Set an event listener that will fire
     * // when the map has finished loading.
     * map.on('load', () => {
     *     // Add a new layer.
     *     map.addLayer({
     *         id: 'points-of-interest',
     *         source: {
     *             type: 'vector',
     *             url: 'mapbox://mapbox.mapbox-streets-v8'
     *         },
     *         'source-layer': 'poi_label',
     *         type: 'circle',
     *         paint: {
     *             // Mapbox Style Specification paint properties
     *         },
     *         layout: {
     *             // Mapbox Style Specification layout properties
     *         }
     *     });
     * });
     * @example
     * // Set an event listener that will fire
     * // when a feature on the countries layer of the map is clicked.
     * map.on('click', 'countries', (e) => {
     *     new mapboxgl.Popup()
     *         .setLngLat(e.lngLat)
     *         .setHTML(`Country name: ${e.features[0].properties.name}`)
     *         .addTo(map);
     * });
     * @example
     * // Set an event listener that will fire
     * // when a feature on the countries or background layers of the map is clicked.
     * map.on('click', ['countries', 'background'], (e) => {
     *     new mapboxgl.Popup()
     *         .setLngLat(e.lngLat)
     *         .setHTML(`Country name: ${e.features[0].properties.name}`)
     *         .addTo(map);
     * });
     * @see [Example: Add 3D terrain to a map](https://docs.mapbox.com/mapbox-gl-js/example/add-terrain/)
     * @see [Example: Center the map on a clicked symbol](https://docs.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     * @see [Example: Create a draggable marker](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Example: Create a hover effect](https://docs.mapbox.com/mapbox-gl-js/example/hover-styles/)
     * @see [Example: Display popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     */
    override on<T extends MapEventType | (string & {})>(type: T, listener: Listener<Extract<T, MapEventType>>): this;
    override on<T extends MapEventType | (string & {})>(type: T, targets: string | string[] | TargetDescriptor, listener: Listener<Extract<T, MapEventType>>): this;
    override on<T extends MapEventType |(string & {})>(type: T, targets: string | string[] | TargetDescriptor | Listener<Extract<T, MapEventType>>, listener?: Listener<Extract<T, MapEventType>>): this {
        if (typeof targets === 'function' || listener === undefined) {
            return super.on(type as MapEventType, targets as Listener<MapEventType>);
        }

        if (typeof targets === 'string') targets = [targets];
        if (!this._areTargetsValid(targets)) {
            return this;
        }

        const delegatedListener = this._createDelegatedListener(type as MapEventType, targets, listener);

        this._delegatedListeners = this._delegatedListeners || {};
        this._delegatedListeners[type] = this._delegatedListeners[type] || [];
        this._delegatedListeners[type].push(delegatedListener);

        for (const event in delegatedListener.delegates) {
            this.on(event as T, delegatedListener.delegates[event]);
        }

        return this;
    }

    /**
     * Adds a listener that will be called only once to a specified event type,
     * optionally limited to events occurring on features in a specified style layer.
     *
     * @param {string} type The event type to listen for; one of `'mousedown'`, `'mouseup'`, `'preclick'`, `'click'`, `'dblclick'`,
     * `'mousemove'`, `'mouseenter'`, `'mouseleave'`, `'mouseover'`, `'mouseout'`, `'contextmenu'`, `'touchstart'`,
     * `'touchend'`, or `'touchcancel'`. `mouseenter` and `mouseover` events are triggered when the cursor enters
     * a visible portion of the specified layer from outside that layer or outside the map canvas. `mouseleave`
     * and `mouseout` events are triggered when the cursor leaves a visible portion of the specified layer, or leaves
     * the map canvas.
     * @param {string | Array<string>} layerIds (optional) The ID(s) of a style layer(s). If you provide `layerIds`,
     * the listener will be triggered only if its location is within a visible feature in these layers,
     * and the event will have a `features` property containing an array of the matching features.
     * If you do not provide `layerIds`, the listener will be triggered by a corresponding event
     * happening anywhere on the map, and the event will not have a `features` property.
     * Note that many event types are not compatible with the optional `layerIds` parameter.
     * @param {Function} listener The function to be called when the event is fired.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Log the coordinates of a user's first map touch.
     * map.once('touchstart', (e) => {
     *     console.log(`The first map touch was at: ${e.lnglat}`);
     * });
     * @example
     * // Log the coordinates of a user's first map touch
     * // on a specific layer.
     * map.once('touchstart', 'my-point-layer', (e) => {
     *     console.log(`The first map touch on the point layer was at: ${e.lnglat}`);
     * });
     * @example
     * // Log the coordinates of a user's first map touch
     * // on specific layers.
     * map.once('touchstart', ['my-point-layer', 'my-point-layer-2'], (e) => {
     *     console.log(`The first map touch on the point layer was at: ${e.lnglat}`);
     * });
     * @see [Example: Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Example: Animate the camera around a point with 3D terrain](https://docs.mapbox.com/mapbox-gl-js/example/free-camera-point/)
     * @see [Example: Play map locations as a slideshow](https://docs.mapbox.com/mapbox-gl-js/example/playback-locations/)
     */
    override once<T extends MapEventType | (string & {})>(type: T): Promise<MapEventOf<Extract<T, MapEventType>>>;
    override once<T extends MapEventType | (string & {})>(type: T, listener: Listener<Extract<T, MapEventType>>): this;
    override once<T extends MapEventType | (string & {})>(type: T, targets: string | string[] | TargetDescriptor): Promise<MapEventOf<Extract<T, MapEventType>>>;
    override once<T extends MapEventType | (string & {})>(type: T, targets: string | string[] | TargetDescriptor, listener: Listener<Extract<T, MapEventType>>): this;
    override once<T extends MapEventType |(string & {})>(type: T, targets?: string | string[] | TargetDescriptor | Listener<Extract<T, MapEventType>>, listener?: Listener<Extract<T, MapEventType>>): this | Promise<MapEventOf<Extract<T, MapEventType>>> {
        if (typeof targets === 'function' || listener === undefined) {
            return super.once(type as MapEventType, targets as Listener<MapEventType>);
        }

        if (typeof targets === 'string') targets = [targets];
        if (!this._areTargetsValid(targets)) {
            return this;
        }

        const delegatedListener = this._createDelegatedListener(type as MapEventType, targets, listener);

        for (const event in delegatedListener.delegates) {
            this.once(event as T, delegatedListener.delegates[event]);
        }

        return this;
    }

    /**
     * Removes an event listener previously added with {@link Map#on},
     * optionally limited to layer-specific events.
     *
     * @param {string} type The event type previously used to install the listener.
     * @param {string | Array<string>} layerIds (optional) The layer ID(s) previously used to install the listener.
     * @param {Function} listener The function previously installed as a listener.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Create a function to print coordinates while a mouse is moving.
     * function onMove(e) {
     *     console.log(`The mouse is moving: ${e.lngLat}`);
     * }
     * // Create a function to unbind the `mousemove` event.
     * function onUp(e) {
     *     console.log(`The final coordinates are: ${e.lngLat}`);
     *     map.off('mousemove', onMove);
     * }
     * // When a click occurs, bind both functions to mouse events.
     * map.on('mousedown', (e) => {
     *     map.on('mousemove', onMove);
     *     map.once('mouseup', onUp);
     * });
     * @see [Example: Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    override off<T extends MapEventType | (string & {})>(type: T, listener: Listener<Extract<T, MapEventType>>): this;
    override off<T extends MapEventType | (string & {})>(type: T, targets: string | string[] | TargetDescriptor, listener: Listener<Extract<T, MapEventType>>): this;
    override off<T extends MapEventType |(string & {})>(type: T, targets: string | string[] | TargetDescriptor | Listener<Extract<T, MapEventType>>, listener?: Listener<Extract<T, MapEventType>>): this {
        if (typeof targets === 'function' || listener === undefined) {
            return super.off(type as MapEventType, targets as Listener<MapEventType>);
        }

        if (typeof targets === 'string') targets = [targets];
        if (!this._areTargetsValid(targets)) {
            return this;
        }

        const removeDelegatedListeners = (listeners: Array<DelegatedListener>) => {
            for (let i = 0; i < listeners.length; i++) {
                const delegatedListener = listeners[i];
                if (delegatedListener.listener === listener && areTargetsEqual(delegatedListener.targets, targets)) {
                    for (const event in delegatedListener.delegates) {
                        this.off(event as T, delegatedListener.delegates[event]);
                    }
                    listeners.splice(i, 1);
                    return this;
                }
            }
        };

        const delegatedListeners = this._delegatedListeners ? this._delegatedListeners[type] : undefined;
        if (delegatedListeners) {
            removeDelegatedListeners(delegatedListeners);
        }

        return this;
    }

    /** @section Querying features */

    /**
     * Returns an array of [GeoJSON](http://geojson.org/)
     * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2)
     * representing visible features that satisfy the query parameters.
     *
     * @param {PointLike|Array<PointLike>} [geometry] - The geometry of the query region in pixels:
     * either a single point or bottom left and top right points describing a bounding box, where the origin is at the top left.
     * Omitting this parameter (by calling {@link Map#queryRenderedFeatures} with zero arguments,
     * or with only an `options` argument) is equivalent to passing a bounding box encompassing the entire
     * map viewport.
     * Only values within the existing viewport are supported.
     * @param {Object} [options] Options object.
     * @param {Array<string>} [options.layers] An array of [style layer IDs](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-id) for the query to inspect.
     * Only features within these layers will be returned. If `target` and `layers` are both undefined, the query will inspect all layers and featuresets in the root style, as well as all featuresets in the root style imports.
     * @param {TargetDescriptor} [options.target] A query target to inspect. This could be a [style layer ID](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-id) or a {@link FeaturesetDescriptor}.
     * Only features within layers referenced by the query target will be returned. If `target` and `layers` are both undefined, the query will inspect all layers and featuresets in the root style, as well as all featuresets in the root style imports.
     * @param {Array} [options.filter] A [filter](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#filter)
     * to limit query results.
     * @param {boolean} [options.validate=true] Whether to check if the [options.filter] conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [feature objects](https://tools.ietf.org/html/rfc7946#section-3.2).
     *
     * The `properties` value of each returned feature object contains the properties of its source feature. For GeoJSON sources, only
     * string and numeric property values are supported. `null`, `Array`, and `Object` values are not supported.
     *
     * For featuresets in the style imports, each feature includes top-level `target` and an optional `namespace` property as defined in {@link TargetFeature}.
     * The `target` property represents the query target associated with the feature, while the optional `namespace` property
     * is included to prevent feature ID collisions when layers in the query target reference multiple sources.
     *
     * For layers and featuresets in the root style, each feature includes top-level `layer`, `source`, and `sourceLayer` properties. The `layer` property is an object
     * representing the style layer to which the feature belongs. Layout and paint properties in this object contain values
     * which are fully evaluated for the given zoom level and feature.
     *
     * Only features that are currently rendered are included. Some features will **not** be included, like:
     *
     * - Features from layers whose `visibility` property is `"none"`.
     * - Features from layers whose zoom range excludes the current zoom level.
     * - Symbol features that have been hidden due to text or icon collision.
     *
     * Features from all other layers are included, including features that may have no visible
     * contribution to the rendered result; for example, because the layer's opacity or color alpha component is set to 0.
     *
     * The topmost rendered feature appears first in the returned array, and subsequent features are sorted by
     * descending z-order. Features that are rendered multiple times (due to wrapping across the antimeridian at low
     * zoom levels) are returned only once (though subject to the following caveat).
     *
     * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
     * geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple
     * times in query results. For example, suppose there is a highway running through the bounding rectangle of a query.
     * The results of the query will be those parts of the highway that lie within the map tiles covering the bounding
     * rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile
     * will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple
     * tiles due to tile buffering.
     *
     * @example
     * // Find all features at a point
     * const features = map.queryRenderedFeatures(
     *   [20, 35],
     *   {target: {layerId: 'my-layer-name'}}
     * );
     *
     * @example
     * // Find all features within a static bounding box
     * const features = map.queryRenderedFeatures(
     *   [[10, 20], [30, 50]],
     *   {target: {layerId: 'my-layer-name'}}
     * );
     *
     * @example
     * // Find all features within a bounding box around a point
     * const width = 10;
     * const height = 20;
     * const features = map.queryRenderedFeatures([
     *     [point.x - width / 2, point.y - height / 2],
     *     [point.x + width / 2, point.y + height / 2]
     * ], {target: {layerId: 'my-layer-name'}});
     *
     * @example
     * // Query all rendered features from a single layer
     * const features = map.queryRenderedFeatures({target: {layerId: 'my-layer-name'}});
     *
     * // ...or
     * const features = map.queryRenderedFeatures({layers: ['my-layer-name']});
     *
     * // Query all rendered features from a `poi` featureset in the `basemap` style import
     * const features = map.queryRenderedFeatures({target: {featuresetId: 'poi', importId: 'basemap'}});
     *
     * @see [Example: Get features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/)
     * @see [Example: Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     * @see [Example: Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     */
    queryRenderedFeatures(geometry: PointLike | [PointLike, PointLike], options?: QueryRenderedFeaturesParams): GeoJSONFeature[];
    queryRenderedFeatures(geometry: PointLike | [PointLike, PointLike], options?: QueryRenderedFeaturesetParams): TargetFeature[];
    queryRenderedFeatures(options?: QueryRenderedFeaturesParams): GeoJSONFeature[];
    queryRenderedFeatures(options?: QueryRenderedFeaturesetParams): TargetFeature[];
    queryRenderedFeatures(geometry?: PointLike | [PointLike, PointLike] | QueryRenderedFeaturesParams | QueryRenderedFeaturesetParams, options?: QueryRenderedFeaturesParams | QueryRenderedFeaturesetParams): GeoJSONFeature[] | TargetFeature[] {
        // The first parameter can be omitted entirely, making this effectively an overloaded method
        // with two signatures:
        //
        //     queryRenderedFeatures(geometry: PointLike | [PointLike, PointLike], options?: Object)
        //     queryRenderedFeatures(options?: Object)
        //
        // There no way to express that in a way that's compatible with documentation.js.

        if (!this.style) {
            return [];
        }

        // Handle the case where the first parameter is an options object
        if (geometry !== undefined && !(geometry instanceof Point) && !Array.isArray(geometry) && options === undefined) {
            options = geometry;
            geometry = undefined;
        }

        geometry = (geometry || [[0, 0], [this.transform.width, this.transform.height]]) as PointLike;

        // Query for all rendered features and featureset target features
        if (!options) {
            const features = this.style.queryRenderedFeatures(geometry, undefined, this.transform);
            const targetFeatures = this.style.queryRenderedFeatureset(geometry, undefined, this.transform);
            return features.concat(targetFeatures);
        }

        // Query for rendered featureset targets if only featureset is provided
        let featuresetIsValid = true;
        if (options.target) {
            featuresetIsValid = this._isTargetValid(options.target);
            if (featuresetIsValid && !options.layers) {
                return this.style.queryRenderedFeatureset(geometry, options as QueryRenderedFeaturesetParams, this.transform);
            }
        }

        // Query for rendered features if only layers are provided
        let layersAreValid = true;
        if (options.layers && Array.isArray(options.layers)) {
            for (const layerId of options.layers) {
                if (!this._isValidId(layerId)) {
                    layersAreValid = false;
                    break;
                }
            }
            if (layersAreValid && !options.target) {
                return this.style.queryRenderedFeatures(geometry, options as QueryRenderedFeaturesParams, this.transform);
            }
        }

        // Query for rendered features and featureset targets if both layers and featureset are provided
        let features: Array<GeoJSONFeature | TargetFeature> = [];
        if (layersAreValid) {
            features = features.concat(this.style.queryRenderedFeatures(geometry, options as QueryRenderedFeaturesParams, this.transform));
        }

        if (featuresetIsValid) {
            features = features.concat(this.style.queryRenderedFeatureset(geometry, options as QueryRenderedFeaturesetParams, this.transform));
        }

        return features;
    }

    /**
     * Returns an array of [GeoJSON](http://geojson.org/)
     * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2)
     * representing features within the specified vector tile or GeoJSON source that satisfy the query parameters.
     *
     * @param {string} sourceId The ID of the vector tile or GeoJSON source to query.
     * @param {Object} [parameters] Options object.
     * @param {string} [parameters.sourceLayer] The name of the [source layer](https://docs.mapbox.com/help/glossary/source-layer/)
     * to query. *For vector tile sources, this parameter is required.* For GeoJSON sources, it is ignored.
     * @param {Array} [parameters.filter] A [filter](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#filter)
     * to limit query results.
     * @param {boolean} [parameters.validate=true] Whether to check if the [parameters.filter] conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2).
     *
     * In contrast to {@link Map#queryRenderedFeatures}, this function returns all features matching the query parameters,
     * whether or not they are rendered by the current style (in other words, are visible). The domain of the query includes all currently-loaded
     * vector tiles and GeoJSON source tiles: this function does not check tiles outside the currently
     * visible viewport.
     *
     * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
     * geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple
     * times in query results. For example, suppose there is a highway running through the bounding rectangle of a query.
     * The results of the query will be those parts of the highway that lie within the map tiles covering the bounding
     * rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile
     * will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple
     * tiles due to tile buffering.
     *
     * @example
     * // Find all features in one source layer in a vector source
     * const features = map.querySourceFeatures('your-source-id', {
     *     sourceLayer: 'your-source-layer'
     * });
     *
     * @see [Example: Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
     */
    querySourceFeatures(
        sourceId: string,
        parameters?: {
            sourceLayer?: string;
            filter?: FilterSpecification;
            validate?: boolean;
        }
    ): Array<GeoJSONFeature> {
        if (!sourceId || (typeof sourceId === 'string' && !this._isValidId(sourceId))) {
            return [];
        }

        return this.style.querySourceFeatures(sourceId, parameters);
    }

    /**
     * Returns the value of a raster source at a given coordinate.
     * Currently, this API only supports raster array sources.
     *
     * @experimental
     * @param {string} sourceId The ID of the raster source to query.
     * @param {LngLatLike} lnglat The mercator coordinates at which to query the raster.
     * @param {RasterQueryParameters} [parameters] (optional) Parameters of the query.
     * @param {string} [parameters.layerName] (optional) The name of the layer to query raster array source. If not provided, all layers in the source will be queried.
     * @param {string} [parameters.bands] (optional) The IDs of the band to query raster array source.
     * @returns {Promise<RasterQueryResult | null>} Promise which resolves to the result of the raster array query, containing the value at the specified point. If not specified all bands of the raster array source layers will be queried.
     *
     * @example
     * const value = await map.queryRasterValue('my-raster-source', {lng: -122.4194, lat: 37.7749}, {bands: ['1000']});
     * console.log(value['Layer']) // {1000: [0.34]}
     */
    queryRasterValue(sourceId: string, lnglat: LngLatLike, parameters: RasterQueryParameters): Promise<RasterQueryResult | null> {
        if (!this._isValidId(sourceId)) {
            return Promise.resolve(null);
        }

        return this.style.queryRasterValue(sourceId, lnglat, parameters);
    }

    /**
     * Determines if the given point is located on a visible map surface.
     *
     * @param {PointLike} point - The point to be checked, specified as an array of two numbers representing the x and y coordinates, or as a {@link https://docs.mapbox.com/mapbox-gl-js/api/geography/#point|Point} object.
     * @returns {boolean} Returns `true` if the point is on the visible map surface, otherwise returns `false`.
     * @example
     * const pointOnSurface = map.isPointOnSurface([100, 200]);
     */
    isPointOnSurface(point: PointLike): boolean {
        const {name} = this.transform.projection;
        if (name !== 'globe' && name !== 'mercator') {
            warnOnce(`${name} projection does not support isPointOnSurface, this API may behave unexpectedly.`);
        }

        return this.transform.isPointOnSurface(Point.convert(point));
    }

    /**
     * Add an interaction — a named gesture handler of a given type.
     * *This API is experimental and subject to change in future versions*.
     *
     * @experimental
     * @param {string} id The ID of the interaction.
     * @param {Object} interaction The interaction object with the following properties.
     * @param {string} interaction.type The type of gesture to handle (e.g. 'click').
     * @param {Object} [interaction.filter] Filter expression to narrow down the interaction to a subset of features under the pointer.
     * @param {TargetDescriptor} [interaction.target] The interaction target, which can be either a reference to a layer or a reference to a featureset in a style import.
     * Use `{layerId: string}` to reference features in the root style layer, or `{featuresetId: string, importId?: string}` to reference features in an imported style.
     * @param {Function} interaction.handler A handler function that will be invoked on the gesture and receive a `{feature, interaction}` object as a parameter.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * map.addInteraction('poi-click', {
     *   type: 'click',
     *   target: {featuresetId: 'poi', importId: 'basemap'},
     *   handler(e) {
     *     console.log(e.feature);
     *   }
     * });
     *
     * @example
     * map.addInteraction('building-mouseenter', {
     *   type: 'mouseenter',
     *   target: {featuresetId: 'buildings', importId: 'basemap'},
     *   handler: (e) => {
     *     map.setFeatureState(e.feature, {highlight: true});
     *   }
     * });
     *
     * @example
     * map.addInteraction('building-mouseleave', {
     *   type: 'mouseleave',
     *   target: {featuresetId: 'buildings', importId: 'basemap'},
     *   handler: (e) => {
     *     map.setFeatureState(e.feature, {highlight: true});
     *     // Propagate the event so that the handler is called for each feature.
     *     return false;
     *   }
     * });
     */
    addInteraction(id: string, interaction: Interaction) {
        this._interactions.add(id, interaction);
        return this;
    }

    /**
     * Remove an interaction previously added with `addInteraction`.
     * *This API is experimental and subject to change in future versions*.
     *
     * @experimental
     * @param {string} id The id of the interaction to remove.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * map.removeInteraction('poi-click');
     */
    removeInteraction(id: string) {
        this._interactions.remove(id);
        return this;
    }

    /**
     * Gets the state of `cooperativeGestures`.
     *
     * @returns {boolean} Returns the `cooperativeGestures` boolean.
     * @example
     * const cooperativeGesturesEnabled = map.getCooperativeGestures();
     */
    getCooperativeGestures(): boolean {
        return this._cooperativeGestures;
    }

    /**
     * Sets the state of `cooperativeGestures`.
     *
     * @param {boolean} enabled If `true`, scroll zoom will require pressing the ctrl or ⌘ key while scrolling to zoom map, and touch pan will require using two fingers while panning to move the map.
     * Touch pitch will require three fingers to activate if enabled.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * map.setCooperativeGestures(true);
     */
    setCooperativeGestures(enabled: boolean) {
        this._cooperativeGestures = enabled;
        return this;
    }

    /** @section Working with styles */

    /**
     * Updates the map's Mapbox style object with a new value.
     *
     * If a style is already set when this is used and the `diff` option is set to `true`, the map renderer will attempt to compare the given style
     * against the map's current state and perform only the changes necessary to make the map style match the desired state. Changes in sprites
     * (images used for icons and patterns) and glyphs (fonts for label text) **cannot** be diffed. If the sprites or fonts used in the current
     * style and the given style are different in any way, the map renderer will force a full update, removing the current style and building
     * the given one from scratch.
     *
     * @param {Object | string| null} style A JSON object conforming to the schema described in the
     * [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to such JSON.
     * @param {Object} [options] Options object.
     * @param {boolean} [options.diff=true] If false, force a 'full' update, removing the current style
     * and building the given one instead of attempting a diff-based update.
     * @param {string} [options.localIdeographFontFamily='sans-serif'] Defines a CSS
     * font-family for locally overriding generation of glyphs in the 'CJK Unified Ideographs', 'Hiragana', 'Katakana' and 'Hangul Syllables' ranges.
     * In these ranges, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold).
     * Set to `false`, to enable font settings from the map's style for these glyph ranges.
     * Forces a full update.
     * @param {Object} [options.config=null] The initial configuration options for the style fragments.
     * Each key in the object is a fragment ID (e.g., `basemap`) and each value is a configuration object.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * map.setStyle("mapbox://styles/mapbox/streets-v11");
     *
     * @see [Example: Change a map's style](https://www.mapbox.com/mapbox-gl-js/example/setstyle/)
     *
     * @example
     * map.setStyle("mapbox://styles/mapbox/standard", {
     *     "config": {
     *         "basemap": {
     *             "lightPreset": "night"
     *         }
     *     }
     * });
     */
    setStyle(style: StyleSpecification | string | null, options?: SetStyleOptions): this {
        options = extend({}, {localIdeographFontFamily: this._localIdeographFontFamily, localFontFamily: this._localFontFamily}, options);

        const diffNeeded =
            options.diff !== false &&
            options.localFontFamily === this._localFontFamily &&
            options.localIdeographFontFamily === this._localIdeographFontFamily &&
            !options.config; // Rebuild the style from scratch if config is set

        if (this.style && style && diffNeeded) {
            this.style._diffStyle(
                style,
                (e: Error | {error: string} | string | null, isUpdateNeeded) => {
                    if (e) {
                        const message = typeof e === 'string' ? e :
                            e instanceof Error ?
                                e.message :
                                e.error;

                        warnOnce(`Unable to perform style diff: ${message}. Rebuilding the style from scratch.`);
                        this._updateStyle(style, options);
                    } else if (isUpdateNeeded) {
                        this._update(true);
                    }
                },
                () => this._postStyleLoadEvent());
            return this;
        } else {
            this._localIdeographFontFamily = options.localIdeographFontFamily;
            this._localFontFamily = options.localFontFamily;
            return this._updateStyle(style, options);
        }
    }

    _getUIString(key: keyof typeof defaultLocale): string {
        const str = this._locale[key];
        if (str == null) {
            throw new Error(`Missing UI string '${key}'`);
        }

        return str;
    }

    _updateStyle(style?: StyleSpecification | string, options?: SetStyleOptions): this {
        if (this.style) {
            this.style.setEventedParent(null);
            this.style._remove();
            this.style = undefined; // we lazy-init it so it's never undefined when accessed
        }

        if (style) {
            // Move SetStyleOptions's `config` property to
            // StyleOptions's `initialConfig` for internal use
            const styleOptions: StyleOptions = extend({}, options);
            if (options && options.config) {
                styleOptions.initialConfig = options.config;
                delete styleOptions.config;
            }

            this.style = new Style(this, styleOptions).load(style);
            this.style.setEventedParent(this, {style: this.style});
        }

        this._updateTerrain();
        return this;
    }

    _lazyInitEmptyStyle() {
        if (!this.style) {
            this.style = new Style(this, {});
            this.style.setEventedParent(this, {style: this.style});
            this.style.loadEmpty();
        }
    }

    /**
     * Returns the map's Mapbox [style](https://docs.mapbox.com/help/glossary/style/) object, a JSON object which can be used to recreate the map's style.
     *
     * For the Mapbox Standard style or any "fragment" style (which is a style with `fragment: true`
     * or a `schema` property defined), this method returns an empty style with no layers or sources.
     * The original style is wrapped into an import with the ID `basemap` as a fragment style and is not intended
     * to be used directly. This design ensures that user logic is not tied to style internals, allowing Mapbox
     * to roll out style updates seamlessly and consistently.
     *
     * @returns {StyleSpecification | void} The map's style JSON object.
     *
     * @example
     * map.on('load', () => {
     *     const styleJson = map.getStyle();
     * });
     */
    getStyle(): StyleSpecification {
        if (this.style) {
            return this.style.serialize();
        }
    }

    /**
     * Returns a Boolean indicating whether the map's style is fully loaded.
     *
     * @returns {boolean} A Boolean indicating whether the style is fully loaded.
     *
     * @example
     * const styleLoadStatus = map.isStyleLoaded();
     */
    isStyleLoaded(): boolean {
        if (!this.style) {
            warnOnce('There is no style added to the map.');
            return false;
        }
        return this.style.loaded();
    }

    _isValidId(id?: string): boolean {
        if (id == null) {
            this.fire(new ErrorEvent(new Error(`IDs can't be empty.`)));
            return false;
        }

        // Disallow using fully qualified IDs in the public APIs
        if (isFQID(id)) {
            this.fire(new ErrorEvent(new Error(`IDs can't contain special symbols: "${id}".`)));
            return false;
        }

        return true;
    }

    /**
     * Checks if the given target is a valid featureset descriptor.
     * @private
     */
    _isTargetValid(target: TargetDescriptor): boolean {
        if ('featuresetId' in target) {
            if ('importId' in target) return this._isValidId(target.importId);
            return this._isValidId(target.featuresetId);
        }

        if ('layerId' in target) {
            return this._isValidId(target.layerId);
        }

        return false;
    }

    /**
     * Checks if the given targets are either list of valid layerIds or a valid featureset descriptor.
     * @private
     */
    _areTargetsValid(targets: string[] | TargetDescriptor): boolean {
        if (Array.isArray(targets)) {
            for (const layerId of targets) {
                if (!this._isValidId(layerId)) {
                    return false;
                }
            }

            return true;
        }

        return this._isTargetValid(targets);
    }

    /** @section Sources */

    /**
     * Adds a source to the map's style.
     *
     * @param {string} id The ID of the source to add. Must not conflict with existing sources.
     * @param {Object} source The source object, conforming to the
     * Mapbox Style Specification's [source definition](https://docs.mapbox.com/style-spec/reference/sources/) or
     * {@link CanvasSourceOptions}.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.addSource('my-data', {
     *     type: 'vector',
     *     url: 'mapbox://myusername.tilesetid'
     * });
     * @example
     * map.addSource('my-data', {
     *     "type": "geojson",
     *     "data": {
     *         "type": "Feature",
     *         "geometry": {
     *             "type": "Point",
     *             "coordinates": [-77.0323, 38.9131]
     *         },
     *         "properties": {
     *             "title": "Mapbox DC",
     *             "marker-symbol": "monument"
     *         }
     *     }
     * });
     * @see Example: Vector source: [Show and hide layers](https://docs.mapbox.com/mapbox-gl-js/example/toggle-layers/)
     * @see Example: GeoJSON source: [Add live realtime data](https://docs.mapbox.com/mapbox-gl-js/example/live-geojson/)
     * @see Example: Raster DEM source: [Add hillshading](https://docs.mapbox.com/mapbox-gl-js/example/hillshade/)
     */
    addSource(id: string, source: SourceSpecification | CustomSourceInterface<unknown>): this {
        if (!this._isValidId(id)) {
            return this;
        }

        this._lazyInitEmptyStyle();
        this.style.addSource(id, source);
        return this._update(true);
    }

    /**
     * Returns a Boolean indicating whether the source is loaded. Returns `true` if the source with
     * the given ID in the map's style has no outstanding network requests, otherwise `false`.
     *
     * @param {string} id The ID of the source to be checked.
     * @returns {boolean} A Boolean indicating whether the source is loaded.
     * @example
     * const sourceLoaded = map.isSourceLoaded('bathymetry-data');
     */
    isSourceLoaded(id: string): boolean {
        if (!this._isValidId(id)) {
            return false;
        }

        return !!this.style && this.style._isSourceCacheLoaded(id);
    }

    /**
     * Returns a Boolean indicating whether all tiles in the viewport from all sources on
     * the style are loaded.
     *
     * @returns {boolean} A Boolean indicating whether all tiles are loaded.
     * @example
     * const tilesLoaded = map.areTilesLoaded();
     */
    areTilesLoaded(): boolean {
        return this.style.areTilesLoaded();
    }

    /**
     * Adds a [custom source type](#Custom Sources), making it available for use with
     * {@link Map#addSource}.
     * @private
     * @param {string} name The name of the source type; source definition objects use this name in the `{type: ...}` field.
     * @param {Function} SourceType A {@link Source} constructor.
     * @param {Function} callback Called when the source type is ready or with an error argument if there is an error.
     */
    addSourceType(name: string, SourceType: SourceClass, callback: Callback<void>) {
        this._lazyInitEmptyStyle();
        this.style.addSourceType(name, SourceType, callback);
    }

    /**
     * Removes a source from the map's style.
     *
     * @param {string} id The ID of the source to remove.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.removeSource('bathymetry-data');
     */
    removeSource(id: string): this {
        if (!this._isValidId(id)) {
            return this;
        }

        this.style.removeSource(id);
        this._updateTerrain();
        return this._update(true);
    }

    /**
     * Returns the source with the specified ID in the map's style.
     *
     * This method is often used to update a source using the instance members for the relevant
     * source type as defined in [Sources](#sources).
     * For example, setting the `data` for a GeoJSON source or updating the `url` and `coordinates`
     * of an image source.
     *
     * @param {string} id The ID of the source to get.
     * @returns {?Object} The style source with the specified ID or `undefined` if the ID
     * corresponds to no existing sources.
     * The shape of the object varies by source type.
     * A list of options for each source type is available on the Mapbox Style Specification's
     * [Sources](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) page.
     * @example
     * const sourceObject = map.getSource('points');
     * @see [Example: Create a draggable point](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Example: Animate a point](https://docs.mapbox.com/mapbox-gl-js/example/animate-point-along-line/)
     * @see [Example: Add live realtime data](https://docs.mapbox.com/mapbox-gl-js/example/live-geojson/)
     */
    getSource<T extends Source>(id: string): T | undefined {
        if (!this._isValidId(id)) {
            return null;
        }

        return this.style.getOwnSource(id);
    }

    /** @section Images */

    /**
     * Add an image to the style. This image can be displayed on the map like any other icon in the style's
     * [sprite](https://docs.mapbox.com/mapbox-gl-js/style-spec/sprite/) using the image's ID with
     * [`icon-image`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layout-symbol-icon-image),
     * [`background-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-background-background-pattern),
     * [`fill-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-fill-fill-pattern),
     * or [`line-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-line-line-pattern).
     * A {@link Map.event:error} event will be fired if there is not enough space in the sprite to add this image.
     *
     * @param {string} id The ID of the image.
     * @param {HTMLImageElement | ImageBitmap | ImageData | {width: number, height: number, data: (Uint8Array | Uint8ClampedArray)} | StyleImageInterface} image The image as an `HTMLImageElement`, `ImageData`, `ImageBitmap` or object with `width`, `height`, and `data`
     * properties with the same format as `ImageData`.
     * @param {Object | null} options Options object.
     * @param {number} options.pixelRatio The ratio of pixels in the image to physical pixels on the screen.
     * @param {boolean} options.sdf Whether the image should be interpreted as an SDF image.
     * @param {[number, number, number, number]} options.content `[x1, y1, x2, y2]`  If `icon-text-fit` is used in a layer with this image, this option defines the part of the image that can be covered by the content in `text-field`.
     * @param {Array<[number, number]>} options.stretchX `[[x1, x2], ...]` If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched horizontally.
     * @param {Array<[number, number]>} options.stretchY `[[y1, y2], ...]` If `icon-text-fit` is used in a layer with this image, this option defines the part(s) of the image that can be stretched vertically.
     *
     * @example
     * // If the style's sprite does not already contain an image with ID 'cat',
     * // add the image 'cat-icon.png' to the style's sprite with the ID 'cat'.
     * map.loadImage('https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Cat_silhouette.svg/400px-Cat_silhouette.svg.png', (error, image) => {
     *     if (error) throw error;
     *     if (!map.hasImage('cat')) map.addImage('cat', image);
     * });
     *
     * // Add a stretchable image that can be used with `icon-text-fit`
     * // In this example, the image is 600px wide by 400px high.
     * map.loadImage('https://upload.wikimedia.org/wikipedia/commons/8/89/Black_and_White_Boxed_%28bordered%29.png', (error, image) => {
     *     if (error) throw error;
     *     if (!map.hasImage('border-image')) {
     *         map.addImage('border-image', image, {
     *             content: [16, 16, 300, 384], // place text over left half of image, avoiding the 16px border
     *             stretchX: [[16, 584]], // stretch everything horizontally except the 16px border
     *             stretchY: [[16, 384]], // stretch everything vertically except the 16px border
     *         });
     *     }
     * });
     *
     *
     * @see Example: Use `HTMLImageElement`: [Add an icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image/)
     * @see Example: Use `ImageData`: [Add a generated icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image-generated/)
     */
    addImage(
        id: string,
        image: HTMLImageElement | ImageBitmap | ImageData | StyleImageInterface | {width: number; height: number; data: Uint8Array | Uint8ClampedArray},
        {pixelRatio = 1, sdf = false, stretchX, stretchY, content}: Partial<StyleImageMetadata> = {}
    ) {
        this._lazyInitEmptyStyle();
        const version = 0;

        const imageId = ImageId.from(id);
        if (image instanceof HTMLImageElement || (ImageBitmap && image instanceof ImageBitmap)) {
            const {width, height, data} = browser.getImageData(image);
            this.style.addImage(imageId, {data: new RGBAImage({width, height}, data), pixelRatio, stretchX, stretchY, content, sdf, version, usvg: false});
        } else if (image.width === undefined || image.height === undefined) {
            this.fire(new ErrorEvent(new Error(
                'Invalid arguments to map.addImage(). The second argument must be an `HTMLImageElement`, `ImageData`, `ImageBitmap`, ' +
                'or object with `width`, `height`, and `data` properties with the same format as `ImageData`')));
        } else {
            const {width, height} = image;
            const userImage = (image as StyleImageInterface);
            const data = userImage.data;

            this.style.addImage(imageId, {
                data: new RGBAImage({width, height}, new Uint8Array(data)),
                pixelRatio,
                stretchX,
                stretchY,
                content,
                sdf,
                usvg: false,
                version,
                userImage
            });

            if (userImage.onAdd) {
                userImage.onAdd(this, id);
            }
        }
    }

    /**
     * Update an existing image in a style. This image can be displayed on the map like any other icon in the style's
     * [sprite](https://docs.mapbox.com/help/glossary/sprite/) using the image's ID with
     * [`icon-image`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layout-symbol-icon-image),
     * [`background-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-background-background-pattern),
     * [`fill-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-fill-fill-pattern),
     * or [`line-pattern`](https://docs.mapbox.com/mapbox-gl-js/style-spec/#paint-line-line-pattern).
     *
     * @param {string} id The ID of the image.
     * @param {HTMLImageElement | ImageBitmap | ImageData | StyleImageInterface} image The image as an `HTMLImageElement`, [`ImageData`](https://developer.mozilla.org/en-US/docs/Web/API/ImageData), [`ImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap) or object with `width`, `height`, and `data`
     * properties with the same format as `ImageData`.
     *
     * @example
     * // Load an image from an external URL.
     * map.loadImage('http://placekitten.com/50/50', (error, image) => {
     *     if (error) throw error;
     *     // If an image with the ID 'cat' already exists in the style's sprite,
     *     // replace that image with a new image, 'other-cat-icon.png'.
     *     if (map.hasImage('cat')) map.updateImage('cat', image);
     * });
     */
    updateImage(
        id: string,
        image: HTMLImageElement | ImageBitmap | ImageData | {width: number; height: number; data: Uint8Array | Uint8ClampedArray} | StyleImageInterface
    ) {
        this._lazyInitEmptyStyle();

        const imageId = ImageId.from(id);
        const existingImage = this.style.getImage(imageId);
        if (!existingImage) {
            this.fire(new ErrorEvent(new Error(
                'The map has no image with that id. If you are adding a new image use `map.addImage(...)` instead.')));
            return;
        }
        const imageData = (image instanceof HTMLImageElement || (ImageBitmap && image instanceof ImageBitmap)) ? browser.getImageData(image) : image as ImageData;
        const {width, height, data} = imageData;

        if (width === undefined || height === undefined) {
            this.fire(new ErrorEvent(new Error(
                'Invalid arguments to map.updateImage(). The second argument must be an `HTMLImageElement`, `ImageData`, `ImageBitmap`, ' +
                'or object with `width`, `height`, and `data` properties with the same format as `ImageData`')));
            return;
        }

        const existingImageWidth = existingImage.usvg ? existingImage.icon.usvg_tree.width : existingImage.data.width;
        const existingImageHeight = existingImage.usvg ? existingImage.icon.usvg_tree.height : existingImage.data.height;

        if (width !== existingImageWidth || height !== existingImageHeight) {
            this.fire(new ErrorEvent(new Error(
                `The width and height of the updated image (${width}, ${height})
                must be that same as the previous version of the image
                (${existingImage.data.width}, ${existingImage.data.height})`)));
            return;
        }

        const copy = !(image instanceof HTMLImageElement || (ImageBitmap && image instanceof ImageBitmap));

        let performSymbolLayout = false;

        if (existingImage.usvg) {
            existingImage.data = new RGBAImage({width, height}, new Uint8Array(data));
            existingImage.usvg = false;
            existingImage.icon = undefined;
            performSymbolLayout = true;
        } else {
            existingImage.data.replace(data, copy);
        }

        this.style.updateImage(imageId, existingImage, performSymbolLayout);
    }

    /**
     * Check whether or not an image with a specific ID exists in the style. This checks both images
     * in the style's original [sprite](https://docs.mapbox.com/help/glossary/sprite/) and any images
     * that have been added at runtime using {@link Map#addImage}.
     *
     * @param {string} id The ID of the image.
     *
     * @returns {boolean} A Boolean indicating whether the image exists.
     * @example
     * // Check if an image with the ID 'cat' exists in
     * // the style's sprite.
     * const catIconExists = map.hasImage('cat');
     */
    hasImage(id: string): boolean {
        if (!id) {
            this.fire(new ErrorEvent(new Error('Missing required image id')));
            return false;
        }

        if (!this.style) return false;

        return !!this.style.getImage(ImageId.from(id));
    }

    /**
     * Remove an image from a style. This can be an image from the style's original
     * [sprite](https://docs.mapbox.com/help/glossary/sprite/) or any images
     * that have been added at runtime using {@link Map#addImage}.
     *
     * @param {string} id The ID of the image.
     *
     * @example
     * // If an image with the ID 'cat' exists in
     * // the style's sprite, remove it.
     * if (map.hasImage('cat')) map.removeImage('cat');
     */
    removeImage(id: string) {
        this.style.removeImage(ImageId.from(id));
    }

    /**
     * Load an image from an external URL to be used with {@link Map#addImage}. External
     * domains must support [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).
     *
     * @param {string} url The URL of the image file. Image file must be in png, webp, or jpg format.
     * @param {Function} callback Expecting `callback(error, data)`. Called when the image has loaded or with an error argument if there is an error.
     *
     * @example
     * // Load an image from an external URL.
     * map.loadImage('http://placekitten.com/50/50', (error, image) => {
     *     if (error) throw error;
     *     // Add the loaded image to the style's sprite with the ID 'kitten'.
     *     map.addImage('kitten', image);
     * });
     *
     * @see [Example: Add an icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image/)
     */
    loadImage(url: string, callback: Callback<ImageBitmap | HTMLImageElement | ImageData>) {
        getImage(this._requestManager.transformRequest(url, ResourceType.Image), (err, img) => {
            callback(err, img instanceof HTMLImageElement ? browser.getImageData(img) : img);
        });
    }

    /**
     * Returns an Array of strings containing the IDs of all images currently available in the map.
     * This includes both images from the style's original [sprite](https://docs.mapbox.com/help/glossary/sprite/)
     * and any images that have been added at runtime using {@link Map#addImage}.
     *
     * @returns {Array<string>} An Array of strings containing the names of all sprites/images currently available in the map.
     *
     * @example
     * const allImages = map.listImages();
     */
    listImages(): Array<string> {
        return this.style.listImages().map((image) => image.name);
    }

    /** @section Models
     * @private
     */

    /**
     * Add a model to the style. This model can be displayed on the map like any other model in the style
     * using the model ID in conjunction with a 2D vector layer. This API can also be used for updating
     * a model. If the model for a given `modelId` was already added, it gets replaced by the new model.
     *
     * @param {string} id The ID of the model.
     * @param {string} url Pointing to the model to load.
     *
     * @example
     * // If the style does not already contain a model with ID 'tree',
     * // load a tree model and then use a geojson to show it.
     * map.addModel('tree', 'http://path/to/my/tree.glb');
     * map.addLayer({
     *     "id": "tree-layer",
     *     "type": "model",
     *     "source": "trees",
     *     "source-layer": "trees",
     *     "layout": {
     *         "model-id": "tree"
     *     }
     *});
     *
     * @private
     */
    addModel(id: string, url: string) {
        this._lazyInitEmptyStyle();
        this.style.addModel(id, url);
    }

    /**
     * Check whether or not a model with a specific ID exists in the style. This checks both models
     * in the style and any models that have been added at runtime using {@link Map#addModel}.
     *
     * @param {string} id The ID of the model.
     *
     * @returns {boolean} A Boolean indicating whether the model exists.
     * @example
     * // Check if a model with the ID 'tree' exists in
     * // the style.
     * const treeModelExists = map.hasModel('tree');
     *
     * @private
     */
    hasModel(id: string): boolean {
        if (!id) {
            this.fire(new ErrorEvent(new Error('Missing required model id')));
            return false;
        }
        return this.style.hasModel(id);
    }

    /**
     * Remove an model from a style. This can be a model from the style original
     *  or any models that have been added at runtime using {@link Map#addModel}.
     *
     * @param {string} id The ID of the model.
     *
     * @example
     * // If an model with the ID 'tree' exists in
     * // the style, remove it.
     * if (map.hasModel('tree')) map.removeModel('tree');
     *
     * @private
     */
    removeModel(id: string) {
        this.style.removeModel(id);
    }

    /**
    * Returns an Array of strings containing the IDs of all models currently available in the map.
    * This includes both models from the style and any models that have been added at runtime using {@link Map#addModel}.
    *
    * @returns {Array<string>} An Array of strings containing the names of all model IDs currently available in the map.
    *
    * @example
    * const allModels = map.listModels();
    *
    * @private
    */
    listModels(): Array<string> {
        return this.style.listModels();
    }

    /** @section Layers */

    /**
     * Adds a [Mapbox style layer](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layers)
     * to the map's style.
     *
     * A layer defines how data from a specified source will be styled. Read more about layer types
     * and available paint and layout properties in the [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layers).
     *
     * @param {Object | CustomLayerInterface} layer The layer to add, conforming to either the Mapbox Style Specification's [layer definition](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layers) or, less commonly, the {@link CustomLayerInterface} specification.
     * The Mapbox Style Specification's layer definition is appropriate for most layers.
     *
     * @param {string} layer.id A unique identifier that you define.
     * @param {string} layer.type The type of layer (for example `fill` or `symbol`).
     * A list of layer types is available in the [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#type).
     *
     * This can also be `custom`. For more information, see {@link CustomLayerInterface}.
     * @param {string | Object} [layer.source] The data source for the layer.
     * Reference a source that has _already been defined_ using the source's unique id.
     * Reference a _new source_ using a source object (as defined in the [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/)) directly.
     * This is **required** for all `layer.type` options _except_ for `custom` and `background`.
     * @param {string} [layer.sourceLayer] (optional) The name of the [source layer](https://docs.mapbox.com/help/glossary/source-layer/) within the specified `layer.source` to use for this style layer.
     * This is only applicable for vector tile sources and is **required** when `layer.source` is of the type `vector`.
     * @param {string} [layer.slot] (optional) The identifier of a [`slot`](https://docs.mapbox.com/style-spec/reference/slots/) layer that will be used to position this style layer.
     * A `slot` layer serves as a predefined position in the layer order for inserting associated layers.
     * *Note*: During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance.
     * This process might lead to a rearrangement of layers. Layers draped over globe and terrain,
     * such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first.
     * These layers are rendered underneath symbols, regardless of whether they are placed
     * in the middle or top slots or without a designated slot.
     * @param {Array} [layer.filter] (optional) An expression specifying conditions on source features.
     * Only features that match the filter are displayed.
     * The Mapbox Style Specification includes more information on the limitations of the [`filter`](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#filter) parameter
     * and a complete list of available [expressions](https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/).
     * If no filter is provided, all features in the source (or source layer for vector tilesets) will be displayed.
     * @param {Object} [layer.paint] (optional) Paint properties for the layer.
     * Available paint properties vary by `layer.type`.
     * A full list of paint properties for each layer type is available in the [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/).
     * If no paint properties are specified, default values will be used.
     * @param {Object} [layer.layout] (optional) Layout properties for the layer.
     * Available layout properties vary by `layer.type`.
     * A full list of layout properties for each layer type is available in the [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/).
     * If no layout properties are specified, default values will be used.
     * @param {number} [layer.maxzoom] (optional) The maximum zoom level for the layer.
     * At zoom levels equal to or greater than the maxzoom, the layer will be hidden.
     * The value can be any number between `0` and `24` (inclusive).
     * If no maxzoom is provided, the layer will be visible at all zoom levels for which there are tiles available.
     * @param {number} [layer.minzoom] (optional) The minimum zoom level for the layer.
     * At zoom levels less than the minzoom, the layer will be hidden.
     * The value can be any number between `0` and `24` (inclusive).
     * If no minzoom is provided, the layer will be visible at all zoom levels for which there are tiles available.
     * @param {Object} [layer.metadata] (optional) Arbitrary properties useful to track with the layer, but do not influence rendering.
     * @param {string} [layer.renderingMode] This is only applicable for layers with the type `custom`.
     * See {@link CustomLayerInterface} for more information.
     * @param {string} [beforeId] The ID of an existing layer to insert the new layer before,
     * resulting in the new layer appearing visually beneath the existing layer.
     * If this argument is not specified, the layer will be appended to the end of the layers array
     * and appear visually above all other layers.
     * *Note*: Layers can only be rearranged within the same `slot`. The new layer must share the
     * same `slot` as the existing layer to be positioned underneath it. If the
     * layers are in different slots, the `beforeId` parameter will be ignored and
     * the new layer will be appended to the end of the layers array.
     * During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance.
     * This process might lead to a rearrangement of layers. Layers draped over globe and terrain,
     * such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first.
     * These layers are rendered underneath symbols, regardless of whether they are placed
     * in the middle or top slots or without a designated slot.
     *
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Add a circle layer with a vector source
     * map.addLayer({
     *     id: 'points-of-interest',
     *     source: {
     *         type: 'vector',
     *         url: 'mapbox://mapbox.mapbox-streets-v8'
     *     },
     *     'source-layer': 'poi_label',
     *     type: 'circle',
     *     paint: {
     *     // Mapbox Style Specification paint properties
     *     },
     *     layout: {
     *     // Mapbox Style Specification layout properties
     *     }
     * });
     *
     * @example
     * // Define a source before using it to create a new layer
     * map.addSource('state-data', {
     *     type: 'geojson',
     *     data: 'path/to/data.geojson'
     * });
     *
     * map.addLayer({
     *     id: 'states',
     *     // References the GeoJSON source defined above
     *     // and does not require a `source-layer`
     *     source: 'state-data',
     *     type: 'symbol',
     *     layout: {
     *         // Set the label content to the
     *         // feature's `name` property
     *         'text-field': ['get', 'name']
     *     }
     * });
     *
     * @example
     * // Add a new symbol layer to a slot
     * map.addLayer({
     *     id: 'states',
     *     // References a source that's already been defined
     *     source: 'state-data',
     *     type: 'symbol',
     *     // Add the layer to the existing `top` slot
     *     slot: 'top',
     *     layout: {
     *         // Set the label content to the
     *         // feature's `name` property
     *         'text-field': ['get', 'name']
     *     }
     * });
     *
     * @example
     * // Add a new symbol layer before an existing layer
     * map.addLayer({
     *     id: 'states',
     *     // References a source that's already been defined
     *     source: 'state-data',
     *     type: 'symbol',
     *     layout: {
     *         // Set the label content to the
     *         // feature's `name` property
     *         'text-field': ['get', 'name']
     *     }
     * // Add the layer before the existing `cities` layer
     * }, 'cities');
     *
     * @see [Example: Select features around a clicked point](https://docs.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures-around-point/) (fill layer)
     * @see [Example: Add a new layer below labels](https://docs.mapbox.com/mapbox-gl-js/example/geojson-layer-in-stack/)
     * @see [Example: Create and style clusters](https://docs.mapbox.com/mapbox-gl-js/example/cluster/) (circle layer)
     * @see [Example: Add a vector tile source](https://docs.mapbox.com/mapbox-gl-js/example/vector-source/) (line layer)
     * @see [Example: Add a WMS layer](https://docs.mapbox.com/mapbox-gl-js/example/wms/) (raster layer)
     */
    addLayer(layer: AnyLayer, beforeId?: string): this {
        if (!this._isValidId(layer.id)) {
            return this;
        }

        this._lazyInitEmptyStyle();
        this.style.addLayer(layer, beforeId);
        return this._update(true);
    }

    /**
     * Returns current slot of the layer.
     *
     * @param {string} layerId Identifier of the layer to retrieve its current slot.
     * @returns {string | null} The slot identifier or `null` if layer doesn't have it.
     *
     * @example
     * map.getSlot('roads');
     */
    getSlot(layerId: string): string | null | undefined {
        const layer = this.getLayer(layerId);

        if (!layer) {
            return null;
        }

        return layer.slot || null;
    }

    /**
     * Sets or removes [a slot](https://docs.mapbox.com/style-spec/reference/slots/) of style layer.
     *
     * @param {string} layerId Identifier of style layer.
     * @param {string} slot Identifier of slot. If `null` or `undefined` is provided, the method removes slot.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Sets new slot for style layer
     * map.setSlot("heatmap", "top");
     */
    setSlot(layerId: string, slot?: string | null): this {
        this.style.setSlot(layerId, slot);
        this.style.mergeLayers();
        return this._update(true);
    }

    /**
     * Adds new [import](https://docs.mapbox.com/style-spec/reference/imports/) to current style.
     *
     * @param {ImportSpecification} importSpecification Specification of import.
     * @param {string} beforeId (optional) Identifier of an existing import to insert the new import before.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Add streets style to empty map
     * new Map({style: {version: 8, sources: {}, layers: []}})
     *     .addImport({id: 'basemap', url: 'mapbox://styles/mapbox/streets-v12'});
     *
     * @example
     * // Add new style before already added
     * const map = new Map({
     *     imports: [
     *         {
     *             id: 'basemap',
     *             url: 'mapbox://styles/mapbox/standard'
     *         }
     *     ],
     *     style: {
     *         version: 8,
     *         sources: {},
     *         layers: []
     *     }
     * });
     *
     * map.addImport({
     *     id: 'lakes',
     *     url: 'https://styles/mapbox/streets-v12'
     * }, 'basemap');
     */
    addImport(importSpecification: ImportSpecification, beforeId?: string | null): this {
        this.style.addImport(importSpecification, beforeId)
            .catch((e) => this.fire(new ErrorEvent(new Error('Failed to add import', e))));

        return this;
    }

    /**
     * Updates already added to style import.
     *
     * @param {string} importId Identifier of import to update.
     * @param {ImportSpecification | string} importSpecification Import specification or URL of style.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Update import with new data
     * map.updateImport('basemap', {
     *     data: {
     *         version: 8,
     *         sources: {},
     *         layers: [
     *             {
     *                 id: 'background',
     *                 type: 'background',
     *                 paint: {
     *                     'background-color': '#eee'
     *                 }
     *             }
     *         ]
     *     }
     * });
     *
     * @example
     * // Change URL of imported style
     * map.updateImport('basemap', 'mapbox://styles/mapbox/other-standard');
     */
    updateImport(importId: string, importSpecification: ImportSpecification | string): this {
        if (typeof importSpecification !== 'string' && importSpecification.id !== importId) {
            this.removeImport(importId);
            return this.addImport(importSpecification);
        }

        this.style.updateImport(importId, importSpecification);
        return this._update(true);
    }

    /**
     * Removes added to style import.
     *
     * @param {string} importId Identifier of import to remove.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Removes imported style
     * map.removeImport('basemap');
     */
    removeImport(importId: string): this {
        this.style.removeImport(importId);
        return this;
    }

    /**
     * Moves import to position before another import, specified with `beforeId`. Order of imported styles corresponds to order of their layers.
     *
     * @param {string} importId Identifier of import to move.
     * @param {string} beforeId The identifier of an existing import to move the new import before.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * const map = new Map({
     *     style: {
     *         imports: [
     *             {
     *                 id: 'basemap',
     *                 url: 'mapbox://styles/mapbox/standard'
     *             },
     *             {
     *                 id: 'streets-v12',
     *                 url: 'mapbox://styles/mapbox/streets-v12'
     *             }
     *         ]
     *     }
     * });
     * // Place `streets-v12` import before `basemap`
     * map.moveImport('streets-v12', 'basemap');
     */
    moveImport(importId: string, beforeId: string): this {
        this.style.moveImport(importId, beforeId);
        return this._update(true);
    }

    /**
     * Moves a layer to a different z-position.
     *
     * @param {string} id The ID of the layer to move.
     * @param {string} [beforeId] The ID of an existing layer to insert the new layer before.
     * When viewing the map, the `id` layer will appear beneath the `beforeId` layer.
     * If `beforeId` is omitted, the layer will be appended to the end of the layers array
     * and appear above all other layers on the map.
     * *Note*: Layers can only be rearranged within the same `slot`. The new layer must share the
     * same `slot` as the existing layer to be positioned underneath it. If the
     * layers are in different slots, the `beforeId` parameter will be ignored and
     * the new layer will be appended to the end of the layers array.
     * During 3D globe and terrain rendering, GL JS aims to batch multiple layers together for optimal performance.
     * This process might lead to a rearrangement of layers. Layers draped over globe and terrain,
     * such as `fill`, `line`, `background`, `hillshade`, and `raster`, are rendered first.
     * These layers are rendered underneath symbols, regardless of whether they are placed
     * in the middle or top slots or without a designated slot.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Move a layer with ID 'polygon' before the layer with ID 'country-label'. The `polygon` layer will appear beneath the `country-label` layer on the map.
     * map.moveLayer('polygon', 'country-label');
     */
    moveLayer(id: string, beforeId?: string): this {
        if (!this._isValidId(id)) {
            return this;
        }

        this.style.moveLayer(id, beforeId);
        return this._update(true);
    }

    /**
     * Removes the layer with the given ID from the map's style.
     *
     * If no such layer exists, an `error` event is fired.
     *
     * @param {string} id ID of the layer to remove.
     * @returns {Map} Returns itself to allow for method chaining.
     * @fires Map.event:error
     *
     * @example
     * // If a layer with ID 'state-data' exists, remove it.
     * if (map.getLayer('state-data')) map.removeLayer('state-data');
     */
    removeLayer(id: string): this {
        if (!this._isValidId(id)) {
            return this;
        }

        this.style.removeLayer(id);
        return this._update(true);
    }

    /**
     * Returns the layer with the specified ID in the map's style.
     *
     * @param {string} id The ID of the layer to get.
     * @returns {?Object} The layer with the specified ID, or `undefined`
     * if the ID corresponds to no existing layers.
     *
     * @example
     * const stateDataLayer = map.getLayer('state-data');
     *
     * @see [Example: Filter symbols by toggling a list](https://www.mapbox.com/mapbox-gl-js/example/filter-markers/)
     * @see [Example: Filter symbols by text input](https://www.mapbox.com/mapbox-gl-js/example/filter-markers-by-input/)
     */
    getLayer<T extends LayerSpecification | CustomLayerInterface>(id: string): T | undefined {
        if (!this._isValidId(id)) {
            return null;
        }

        const layer = this.style.getOwnLayer(id);
        if (!layer) return;

        if (layer.type === 'custom') return layer.implementation as T;

        return layer.serialize() as T;
    }

    /**
     * Returns the IDs of all slots in the map's style.
     *
     * @returns {Array<string>} The IDs of all slots in the map's style.
     *
     * @example
     * const slots = map.getSlots();
     */
    getSlots(): Array<string> {
        return this.style.getSlots();
    }

    /**
     * Sets the zoom extent for the specified style layer. The zoom extent includes the
     * [minimum zoom level](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-minzoom)
     * and [maximum zoom level](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-maxzoom))
     * at which the layer will be rendered.
     *
     * Note: For style layers using vector sources, style layers cannot be rendered at zoom levels lower than the
     * minimum zoom level of the _source layer_ because the data does not exist at those zoom levels. If the minimum
     * zoom level of the source layer is higher than the minimum zoom level defined in the style layer, the style
     * layer will not be rendered at all zoom levels in the zoom range.
     *
     * @param {string} layerId The ID of the layer to which the zoom extent will be applied.
     * @param {number} minzoom The minimum zoom to set (0-24).
     * @param {number} maxzoom The maximum zoom to set (0-24).
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * map.setLayerZoomRange('my-layer', 2, 5);
     */
    setLayerZoomRange(layerId: string, minzoom: number, maxzoom: number): this {
        if (!this._isValidId(layerId)) {
            return this;
        }

        this.style.setLayerZoomRange(layerId, minzoom, maxzoom);
        return this._update(true);
    }

    /**
     * Sets the filter for the specified style layer.
     *
     * Filters control which features a style layer renders from its source.
     * Any feature for which the filter expression evaluates to `true` will be
     * rendered on the map. Those that are false will be hidden.
     *
     * Use `setFilter` to show a subset of your source data.
     *
     * To clear the filter, pass `null` or `undefined` as the second parameter.
     *
     * @param {string} layerId The ID of the layer to which the filter will be applied.
     * @param {Array | null | undefined} filter The filter, conforming to the Mapbox Style Specification's
     * [filter definition](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#filter).  If `null` or `undefined` is provided, the function removes any existing filter from the layer.
     * @param {Object} [options] Options object.
     * @param {boolean} [options.validate=true] Whether to check if the filter conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // display only features with the 'name' property 'USA'
     * map.setFilter('my-layer', ['==', ['get', 'name'], 'USA']);
     * @example
     * // display only features with five or more 'available-spots'
     * map.setFilter('bike-docks', ['>=', ['get', 'available-spots'], 5]);
     * @example
     * // remove the filter for the 'bike-docks' style layer
     * map.setFilter('bike-docks', null);
     *
     * @see [Example: Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     * @see [Example: Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
     * @see [Example: Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
     * @see [Tutorial: Show changes over time](https://docs.mapbox.com/help/tutorials/show-changes-over-time/)
     */
    setFilter(
        layerId: string,
        filter?: FilterSpecification | null,
        options: StyleSetterOptions = {},
    ): this {
        if (!this._isValidId(layerId)) {
            return this;
        }

        this.style.setFilter(layerId, filter, options);
        return this._update(true);
    }

    /**
     * Returns the filter applied to the specified style layer.
     *
     * @param {string} layerId The ID of the style layer whose filter to get.
     * @returns {Array} The layer's filter.
     * @example
     * const filter = map.getFilter('myLayer');
     */
    getFilter(layerId: string): FilterSpecification | null | undefined {
        if (!this._isValidId(layerId)) {
            return null;
        }

        return this.style.getFilter(layerId);
    }

    /**
     * Sets the value of a paint property in the specified style layer.
     *
     * @param {string} layerId The ID of the layer to set the paint property in.
     * @param {string} name The name of the paint property to set.
     * @param {*} value The value of the paint property to set.
     * Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @param {Object} [options] Options object.
     * @param {boolean} [options.validate=true] Whether to check if `value` conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setPaintProperty('my-layer', 'fill-color', '#faafee');
     * @see [Example: Change a layer's color with buttons](https://www.mapbox.com/mapbox-gl-js/example/color-switcher/)
     * @see [Example: Adjust a layer's opacity](https://www.mapbox.com/mapbox-gl-js/example/adjust-layer-opacity/)
     * @see [Example: Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    setPaintProperty<T extends keyof PaintSpecification>(
        layerId: string,
        name: T,
        value: PaintSpecification[T],
        options: StyleSetterOptions = {},
    ): this {
        if (!this._isValidId(layerId)) {
            return this;
        }

        this.style.setPaintProperty(layerId, name, value, options);
        return this._update(true);
    }

    /**
     * Returns the value of a paint property in the specified style layer.
     *
     * @param {string} layerId The ID of the layer to get the paint property from.
     * @param {string} name The name of a paint property to get.
     * @returns {*} The value of the specified paint property.
     * @example
     * const paintProperty = map.getPaintProperty('mySymbolLayer', 'icon-color');
     */
    getPaintProperty<T extends keyof PaintSpecification>(layerId: string, name: T): PaintSpecification[T] | undefined {
        if (!this._isValidId(layerId)) {
            return null;
        }

        return this.style.getPaintProperty(layerId, name);
    }

    /**
     * Sets the value of a layout property in the specified style layer.
     *
     * @param {string} layerId The ID of the layer to set the layout property in.
     * @param {string} name The name of the layout property to set.
     * @param {*} value The value of the layout property. Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @param {Object} [options] Options object.
     * @param {boolean} [options.validate=true] Whether to check if `value` conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setLayoutProperty('my-layer', 'visibility', 'none');
     * @see [Example: Show and hide layers](https://docs.mapbox.com/mapbox-gl-js/example/toggle-layers/)
     */
    setLayoutProperty<T extends keyof LayoutSpecification>(
        layerId: string,
        name: T,
        value: LayoutSpecification[T],
        options: StyleSetterOptions = {},
    ): this {
        if (!this._isValidId(layerId)) {
            return this;
        }

        this.style.setLayoutProperty(layerId, name, value, options);
        return this._update(true);
    }

    /**
     * Returns the value of a layout property in the specified style layer.
     *
     * @param {string} layerId The ID of the layer to get the layout property from.
     * @param {string} name The name of the layout property to get.
     * @returns {*} The value of the specified layout property.
     * @example
     * const layoutProperty = map.getLayoutProperty('mySymbolLayer', 'icon-anchor');
     */
    getLayoutProperty<T extends keyof LayoutSpecification>(layerId: string, name: T): LayoutSpecification[T] | undefined {
        if (!this._isValidId(layerId)) {
            return null;
        }

        return this.style.getLayoutProperty(layerId, name);
    }

    /** @section Style properties */

    /**
     * Returns the glyphs URL of the current style.
     *
     * @returns {string} Returns a glyph URL template.
     * @example
     * map.getGlyphsUrl();
     */
    getGlyphsUrl(): string | undefined {
        return this.style.getGlyphsUrl();
    }

    /**
     * Sets a URL template for loading signed-distance-field glyph sets in PBF format. The URL must include `{fontstack}` and `{range}` tokens.
     *
     * @param {string} url A URL template for loading SDF glyph sets in PBF format.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setGlyphsUrl('mapbox://fonts/mapbox/{fontstack}/{range}.pbf');
     */
    setGlyphsUrl(url: string): this {
        this.style.setGlyphsUrl(url);
        return this._update(true);
    }

    /**
     * Returns the imported style schema.
     *
     * @param {string} importId The name of the imported style (e.g. `basemap`).
     * @returns {*} Returns the imported style schema.
     * @private
     *
     * @example
     * map.getSchema('basemap');
     */
    getSchema(importId: string): SchemaSpecification | null | undefined {
        return this.style.getSchema(importId);
    }

    /**
     * Sets the imported style schema value.
     *
     * @param {string} importId The name of the imported style (e.g. `basemap`).
     * @param {SchemaSpecification} schema The imported style schema.
     * @returns {Map} Returns itself to allow for method chaining.
     * @private
     *
     * @example
     * map.setSchema('basemap', {lightPreset: {type: 'string', default: 'night', values: ['day', 'night']}});
     */
    setSchema(importId: string, schema: SchemaSpecification): this {
        this.style.setSchema(importId, schema);
        return this._update(true);
    }

    /**
     * Returns the imported style configuration.
     *
     * @param {string} importId The name of the imported style (e.g. `basemap`).
     * @returns {*} Returns the imported style configuration.
     * @example
     * map.getConfig('basemap');
     */
    getConfig(importId: string): ConfigSpecification | null | undefined {
        return this.style.getConfig(importId);
    }

    /**
     * Sets the imported style configuration value.
     *
     * @param {string} importId The name of the imported style (e.g. `basemap`).
     * @param {ConfigSpecification} config The imported style configuration value.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setConfig('basemap', {lightPreset: 'night', showPointOfInterestLabels: false});
     */
    setConfig(importId: string, config: ConfigSpecification): this {
        this.style.setConfig(importId, config);
        return this._update(true);
    }

    /**
     * Returns the value of a configuration property in the imported style.
     *
     * @param {string} importId The name of the imported style (e.g. `basemap`).
     * @param {string} configName The name of the configuration property from the style.
     * @returns {*} Returns the value of the configuration property.
     * @example
     * map.getConfigProperty('basemap', 'showLabels');
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConfigProperty(importId: string, configName: string): any {
        return this.style.getConfigProperty(importId, configName);
    }

    /**
     * Sets the value of a configuration property in the currently set style.
     *
     * @param {string} importId The name of the imported style to set the config for (e.g. `basemap`).
     * @param {string} configName The name of the configuration property from the style.
     * @param {*} value The value of the configuration property. Must be of a type appropriate for the property, as defined by the style configuration schema.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setConfigProperty('basemap', 'showLabels', false);
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setConfigProperty(importId: string, configName: string, value: any): this {
        this.style.setConfigProperty(importId, configName, value);
        return this._update(true);
    }

    /**
     * Returns a list of featureset descriptors for querying, interaction, and state management on the map.
     * Each featureset descriptor can reference either individual layer or subset of layers within the map's style.
     *
     * @private
     * @experimental
     * @returns {FeaturesetDescriptor[]} The list of featuresets.
     * @example
     * const featuresetDescriptors = map.getFeaturesetDescriptors('basemap');
     */
    getFeaturesetDescriptors(importId?: string): Array<FeaturesetDescriptor> {
        return this.style.getFeaturesetDescriptors(importId);
    }

    /**
     * Adds a set of Mapbox style light to the map's style.
     *
     * _Note: This light is not to confuse with our legacy light API used through {@link Map#setLight} and {@link Map#getLight}_.
     *
     * @param {Array<LightsSpecification>} lights An array of lights to add, conforming to the Mapbox Style Specification's light definition.
     * @returns {Map} Returns itself to allow for method chaining.
     *
     * @example
     * // Add a directional light
     * map.setLights([{
     *     "id": "sun_light",
     *     "type": "directional",
     *     "properties": {
     *         "color": "rgba(255.0, 0.0, 0.0, 1.0)",
     *         "intensity": 0.4,
     *         "direction": [200.0, 40.0],
     *         "cast-shadows": true,
     *         "shadow-intensity": 0.2
     *     }
     * }]);
     */
    setLights(lights?: Array<LightsSpecification> | null): this {
        this._lazyInitEmptyStyle();
        if (lights && lights.length === 1 && lights[0].type === "flat") {
            const flatLight: FlatLightSpecification = lights[0];
            if (!flatLight.properties) {
                this.style.setFlatLight({}, "flat");
            } else {
                this.style.setFlatLight(flatLight.properties, flatLight.id, {});
            }
        } else {
            this.style.setLights(lights);
            if (this.painter.terrain) {
                this.painter.terrain.invalidateRenderCache = true;
            }
        }
        return this._update(true);
    }

    /**
     * Returns the lights added to the map.
     *
     * @returns {Array<LightSpecification>} Lights added to the map.
     * @example
     * const lights = map.getLights();
     */
    getLights(): Array<LightsSpecification> | null | undefined {
        const lights = this.style.getLights() || [];
        if (lights.length === 0) {
            lights.push({
                "id": this.style.light.id,
                "type": "flat",
                "properties": this.style.getFlatLight()
            });
        }
        return lights;
    }

    /**
     * Sets the any combination of light values.
     *
     * _Note: that this API is part of the legacy light API, prefer using {@link Map#setLights}.
     *
     * @param {LightSpecification} light Light properties to set. Must conform to the [Light Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#light).
     * @param {Object} [options] Options object.
     * @param {boolean} [options.validate=true] Whether to check if the filter conforms to the Mapbox GL Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setLight({
     *     "anchor": "viewport",
     *     "color": "blue",
     *     "intensity": 0.5
     * });
     */

    setLight(light: LightSpecification, options: StyleSetterOptions = {}): this {
        console.log("The `map.setLight` function is deprecated, prefer using `map.setLights` with `flat` light type instead.");
        return this.setLights([{
            "id": "flat",
            "type": "flat",
            "properties": light
        }]);
    }

    /**
     * Returns the value of the light object.
     *
     * @returns {LightSpecification} Light properties of the style.
     * @example
     * const light = map.getLight();
     */
    getLight(): LightSpecification {
        console.log("The `map.getLight` function is deprecated, prefer using `map.getLights` instead.");
        return this.style.getFlatLight();
    }

    /**
     * Sets the terrain property of the style.
     *
     * @param {TerrainSpecification} terrain Terrain properties to set. Must conform to the [Terrain Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/terrain/).
     * If `null` or `undefined` is provided, function removes terrain.
     * Exaggeration could be updated for the existing terrain without explicitly specifying the `source`.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.addSource('mapbox-dem', {
     *     'type': 'raster-dem',
     *     'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
     *     'tileSize': 512,
     *     'maxzoom': 14
     * });
     * // add the DEM source as a terrain layer with exaggerated height
     * map.setTerrain({'source': 'mapbox-dem', 'exaggeration': 1.5});
     * // update the exaggeration for the existing terrain
     * map.setTerrain({'exaggeration': 2});
     */
    setTerrain(terrain?: TerrainSpecification | null): this {
        this._lazyInitEmptyStyle();
        if (!terrain && this.transform.projection.requiresDraping) {
            this.style.setTerrainForDraping();
        } else {
            this.style.setTerrain(terrain);
        }
        this._averageElevationLastSampledAt = -Infinity;
        return this._update(true);
    }

    /**
     * Returns the terrain specification or `null` if terrain isn't set on the map.
     *
     * @returns {TerrainSpecification | null} Terrain specification properties of the style.
     * @example
     * const terrain = map.getTerrain();
     */
    getTerrain(): TerrainSpecification | null | undefined {
        return this.style ? this.style.getTerrain() : null;
    }

    /**
     * Sets the fog property of the style.
     *
     * @param {FogSpecification} fog The fog properties to set. Must conform to the [Fog Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/fog/).
     * If `null` or `undefined` is provided, this function call removes the fog from the map.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setFog({
     *     "range": [0.8, 8],
     *     "color": "#dc9f9f",
     *     "horizon-blend": 0.5,
     *     "high-color": "#245bde",
     *     "space-color": "#000000",
     *     "star-intensity": 0.15
     * });
     * @see [Example: Add fog to a map](https://docs.mapbox.com/mapbox-gl-js/example/add-fog/)
     */
    setFog(fog?: FogSpecification | null): this {
        this._lazyInitEmptyStyle();
        this.style.setFog(fog);
        return this._update(true);
    }

    /**
     * Returns the fog specification or `null` if fog is not set on the map.
     *
     * @returns {FogSpecification} Fog specification properties of the style.
     * @example
     * const fog = map.getFog();
     */
    getFog(): FogSpecification | null | undefined {
        return this.style ? this.style.getFog() : null;
    }

    /**
     * Sets the snow property of the style.
     * *This API is experimental, not production ready and subject to change in future versions*.
     *
     * @experimental
     * @param {SnowSpecification} snow The snow properties to set.
     * If `null` or `undefined` is provided, this function call removes the snow from the map.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     *   map.setSnow({
     *       density: 1,
     *       intensity: 0.3
     *   });
     */
    setSnow(snow?: SnowSpecification | null): this {
        this._lazyInitEmptyStyle();
        this.style.setSnow(snow);
        return this._update(true);
    }

    /**
     * Returns the snow specification or `null` if snow is not set on the map.
     * *This API is experimental, not production ready and subject to change in future versions*.
     *
     * @experimental
     * @returns {SnowSpecification} Snow specification properties of the style.
     * @example
     * const snow = map.getSnow();
     */
    getSnow(): SnowSpecification | null | undefined {
        return this.style ? this.style.getSnow() : null;
    }

    /**
     * Sets the rain property of the style.
     * *This API is experimental, not production ready and subject to change in future versions*.
     *
     * @experimental
     * @param {RainSpecification} rain The rain properties to set.
     * If `null` or `undefined` is provided, this function call removes the rain from the map.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     *   map.setRain({
     *       density: 1,
     *       intensity: 0.3,
     *       "distortion-strength": 0.3
     *   });
     */
    setRain(rain?: RainSpecification | null): this {
        this._lazyInitEmptyStyle();
        this.style.setRain(rain);
        return this._update(true);
    }

    /**
     * Returns the rain specification or `null` if rain is not set on the map.
     * *This API is experimental, not production ready and subject to change in future versions*.
     *
     * @experimental
     * @returns {RainSpecification} Rain specification properties of the style.
     * @example
     * const rain = map.getRain();
     */
    getRain(): RainSpecification | null | undefined {
        return this.style ? this.style.getRain() : null;
    }

    /**
     * Sets the color-theme property of the style.
     *
     * @param {ColorThemeSpecification} colorTheme The color-theme properties to set.
     * If `null` or `undefined` is provided, this function call removes the color-theme from the map.
     * Note: Calling this function triggers a full reload of tiles.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setColorTheme({
     *     "data": "iVBORw0KGgoAA..."
     * });
     */
    setColorTheme(colorTheme?: ColorThemeSpecification): this {
        this._lazyInitEmptyStyle();
        this.style.setColorTheme(colorTheme);
        return this._update(true);
    }

    /**
     * Sets the color-theme property of an import, which overrides the color-theme property of the imported style data.
     *
     * @param {string} importId Identifier of import to update.
     * @param {ColorThemeSpecification} colorTheme The color-theme properties to set.
     * If `null` or `undefined` is provided, this function call removes the color-theme override.
     * Note: Calling this function triggers a full reload of tiles.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setImportColorTheme("someImportId", {
     *     "data": "iVBORw0KGgoAA..."
     * });
     */
    setImportColorTheme(importId: string, colorTheme?: ColorThemeSpecification): this {
        this._lazyInitEmptyStyle();
        this.style.setImportColorTheme(importId, colorTheme);
        return this._update(true);
    }

    /**
     * Sets the camera property of the style.
     *
     * @param {CameraSpecification} camera The camera properties to set. Must conform to the Camera Style Specification.
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setCamera({
     *     "camera-projection": "perspective",
     * });
     */
    setCamera(camera: CameraSpecification): this {
        this.style.setCamera(camera);
        return this._triggerCameraUpdate(camera);
    }

    _triggerCameraUpdate(camera: CameraSpecification): this {
        return this._update(this.transform.setOrthographicProjectionAtLowPitch(camera['camera-projection'] === 'orthographic'));
    }

    /**
     * Returns the camera options specification.
     *
     * @returns {CameraSpecification} Camera specification properties of the style.
     * @example
     * const camera = map.getCamera();
     */
    getCamera(): CameraSpecification {
        return this.style.camera;
    }

    /**
     * Returns the fog opacity for a given location.
     *
     * An opacity of 0 means that there is no fog contribution for the given location
     * while a fog opacity of 1.0 means the location is fully obscured by the fog effect.
     *
     * If there is no fog set on the map, this function will return 0.
     *
     * @param {LngLatLike} lnglat The geographical location to evaluate the fog on.
     * @returns {number} A value between 0 and 1 representing the fog opacity, where 1 means fully within, and 0 means not affected by the fog effect.
     * @private
     */
    _queryFogOpacity(lnglat: LngLatLike): number {
        if (!this.style || !this.style.fog) return 0.0;
        return this.style.fog.getOpacityAtLatLng(LngLat.convert(lnglat), this.transform);
    }

    /** @section Feature state */

    /**
     * Sets the `state` of a feature.
     * A feature's `state` is a set of user-defined key-value pairs that are assigned to a feature at runtime.
     * When using this method, the `state` object is merged with any existing key-value pairs in the feature's state.
     * Features are identified by their `id` attribute, which can be any number or string.
     *
     * This method can only be used with sources that have a `id` attribute. The `id` attribute can be defined in three ways:
     * - For vector or GeoJSON sources, including an `id` attribute in the original data file.
     * - For vector or GeoJSON sources, using the [`promoteId`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector-promoteId) option at the time the source is defined.
     * - For GeoJSON sources, using the [`generateId`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson-generateId) option to auto-assign an `id` based on the feature's index in the source data. If you change feature data using `map.getSource('some id').setData(...)`, you may need to re-apply state taking into account updated `id` values.
     *
     * _Note: You can use the [`feature-state` expression](https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#feature-state) to access the values in a feature's state object for the purposes of styling_.
     *
     * @param {Object} feature Feature identifier. Feature objects returned from
     * {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
     * @param {number | string} feature.id Unique id of the feature. Can be an integer or a string, but supports string values only when the [`promoteId`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector-promoteId) option has been applied to the source or the string can be cast to an integer.
     * @param {string} feature.source The id of the vector or GeoJSON source for the feature.
     * @param {string} [feature.sourceLayer] (optional) *For vector tile sources, `sourceLayer` is required*.
     * @param {Object} state A set of key-value pairs. The values should be valid JSON types.
     * @returns {Map} The map object.
     * @example
     * // When the mouse moves over the `my-layer` layer, update
     * // the feature state for the feature under the mouse
     * map.on('mousemove', 'my-layer', (e) => {
     *     if (e.features.length > 0) {
     *         map.setFeatureState({
     *             source: 'my-source',
     *             sourceLayer: 'my-source-layer',
     *             id: e.features[0].id,
     *         }, {
     *             hover: true
     *         });
     *     }
     * });
     *
     * @see [Example: Create a hover effect](https://docs.mapbox.com/mapbox-gl-js/example/hover-styles/)
     * @see [Tutorial: Create interactive hover effects with Mapbox GL JS](https://docs.mapbox.com/help/tutorials/create-interactive-hover-effects-with-mapbox-gl-js/)
     */
    setFeatureState(feature: FeatureSelector | GeoJSONFeature | TargetFeature, state: FeatureState): this {
        if (feature.source && !this._isValidId(feature.source)) {
            return this;
        }

        this.style.setFeatureState(feature, state);
        return this._update();
    }

    // eslint-disable-next-line jsdoc/require-returns
    /**
     * Removes the `state` of a feature, setting it back to the default behavior.
     * If only a `feature.source` is specified, it will remove the state for all features from that source.
     * If `feature.id` is also specified, it will remove all keys for that feature's state.
     * If `key` is also specified, it removes only that key from that feature's state.
     * Features are identified by their `feature.id` attribute, which can be any number or string.
     *
     * @param {Object} feature Identifier of where to remove state. It can be a source, a feature, or a specific key of feature.
     * Feature objects returned from {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
     * @param {number | string} [feature.id] (optional) Unique id of the feature. Can be an integer or a string, but supports string values only when the [`promoteId`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector-promoteId) option has been applied to the source or the string can be cast to an integer.
     * @param {string} feature.source The id of the vector or GeoJSON source for the feature.
     * @param {string} [feature.sourceLayer] (optional) For vector tile sources, `sourceLayer` is required.
     * @param {string} [key] (optional) The key in the feature state to reset.
     *
     * @example
     * // Reset the entire state object for all features
     * // in the `my-source` source
     * map.removeFeatureState({
     *     source: 'my-source'
     * });
     *
     * @example
     * // When the mouse leaves the `my-layer` layer,
     * // reset the entire state object for the
     * // feature under the mouse
     * map.on('mouseleave', 'my-layer', (e) => {
     *     map.removeFeatureState({
     *         source: 'my-source',
     *         sourceLayer: 'my-source-layer',
     *         id: e.features[0].id
     *     });
     * });
     *
     * @example
     * // When the mouse leaves the `my-layer` layer,
     * // reset only the `hover` key-value pair in the
     * // state for the feature under the mouse
     * map.on('mouseleave', 'my-layer', (e) => {
     *     map.removeFeatureState({
     *         source: 'my-source',
     *         sourceLayer: 'my-source-layer',
     *         id: e.features[0].id
     *     }, 'hover');
     * });
     */
    removeFeatureState(feature: FeatureSelector | SourceSelector | GeoJSONFeature | TargetFeature, key?: string): this {
        if (feature.source && !this._isValidId(feature.source)) {
            return this;
        }

        this.style.removeFeatureState(feature, key);
        return this._update();
    }

    /**
     * Gets the `state` of a feature.
     * A feature's `state` is a set of user-defined key-value pairs that are assigned to a feature at runtime.
     * Features are identified by their `id` attribute, which can be any number or string.
     *
     * _Note: To access the values in a feature's state object for the purposes of styling the feature, use the [`feature-state` expression](https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#feature-state)_.
     *
     * @param {Object} feature Feature identifier. Feature objects returned from
     * {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
     * @param {number | string} feature.id Unique id of the feature. Can be an integer or a string, but supports string values only when the [`promoteId`](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector-promoteId) option has been applied to the source or the string can be cast to an integer.
     * @param {string} feature.source The id of the vector or GeoJSON source for the feature.
     * @param {string} [feature.sourceLayer] (optional) *For vector tile sources, `sourceLayer` is required*.
     *
     * @returns {Object} The state of the feature: a set of key-value pairs that was assigned to the feature at runtime.
     *
     * @example
     * // When the mouse moves over the `my-layer` layer,
     * // get the feature state for the feature under the mouse
     * map.on('mousemove', 'my-layer', (e) => {
     *     if (e.features.length > 0) {
     *         map.getFeatureState({
     *             source: 'my-source',
     *             sourceLayer: 'my-source-layer',
     *             id: e.features[0].id
     *         });
     *     }
     * });
     */
    getFeatureState(feature: FeatureSelector | GeoJSONFeature | TargetFeature): FeatureState | null | undefined {
        if (feature.source && !this._isValidId(feature.source)) {
            return null;
        }

        return this.style.getFeatureState(feature);
    }

    /**
     * *This API is experimental and subject to change in future versions*.
     *
     * @experimental
     * @param {string} floorId The id of the floor to select.
     * @example
     * map._selectIndoorFloor('floor-1');
     */
    _selectIndoorFloor(floorId: string) {
        this.indoor.selectFloor(floorId);
    }

    _addIndoorControl() {
        if (!this._indoorControl) {
            this._indoorControl = new IndoorControl();
        }

        this.addControl(this._indoorControl, 'right');
    }

    _removeIndoorControl() {
        if (!this._indoorControl) {
            return;
        }
        this.removeControl(this._indoorControl);
    }

    _updateContainerDimensions() {
        if (!this._container) return;

        const width = this._container.getBoundingClientRect().width || 400;
        const height = this._container.getBoundingClientRect().height || 300;

        let transformValues;
        let transformScaleWidth;
        let transformScaleHeight;
        let el: Element | null | undefined = this._container;
        while (el && (!transformScaleWidth || !transformScaleHeight)) {
            const transformMatrix = window.getComputedStyle(el).transform;
            if (transformMatrix && transformMatrix !== 'none') {
                transformValues = transformMatrix.match(/matrix.*\((.+)\)/)[1].split(', ');
                if (transformValues[0] && transformValues[0] !== '0' && transformValues[0] !== '1') transformScaleWidth = transformValues[0];
                if (transformValues[3] && transformValues[3] !== '0' && transformValues[3] !== '1') transformScaleHeight = transformValues[3];
            }
            el = el.parentElement;
        }

        this._containerWidth = transformScaleWidth ? Math.abs(width / transformScaleWidth) : width;
        this._containerHeight = transformScaleHeight ? Math.abs(height / transformScaleHeight) : height;
    }

    _detectMissingCSS(): void {
        const computedColor = window.getComputedStyle(this._missingCSSCanary).getPropertyValue('background-color');
        if (computedColor !== 'rgb(250, 128, 114)') {
            warnOnce('This page appears to be missing CSS declarations for ' +
                'Mapbox GL JS, which may cause the map to display incorrectly. ' +
                'Please ensure your page includes mapbox-gl.css, as described ' +
                'in https://www.mapbox.com/mapbox-gl-js/api/.');
        }
    }

    _setupContainer() {
        const container = this._container;
        container.classList.add('mapboxgl-map');

        const missingCSSCanary = this._missingCSSCanary = DOM.create('div', 'mapboxgl-canary', container);
        missingCSSCanary.style.visibility = 'hidden';
        this._detectMissingCSS();

        const canvasContainer = this._canvasContainer = DOM.create('div', 'mapboxgl-canvas-container', container);
        this._canvas = DOM.create('canvas', 'mapboxgl-canvas', canvasContainer);

        if (this._interactive) {
            canvasContainer.classList.add('mapboxgl-interactive');
            this._canvas.setAttribute('tabindex', '0');
        }

        this._canvas.addEventListener('webglcontextlost', this._contextLost, false);
        this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false);
        this._canvas.setAttribute('aria-label', this._getUIString('Map.Title'));
        this._canvas.setAttribute('role', 'region');

        this._updateContainerDimensions();
        this._resizeCanvas(this._containerWidth, this._containerHeight);

        const controlContainer = this._controlContainer = DOM.create('div', 'mapboxgl-control-container', container);
        const positions = this._controlPositions = {};
        ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'].forEach((positionName) => {
            positions[positionName] = DOM.create('div', `mapboxgl-ctrl-${positionName}`, controlContainer);
        });

        this._container.addEventListener('scroll', this._onMapScroll, false);
    }

    _resizeCanvas(width: number, height: number) {
        const pixelRatio = browser.devicePixelRatio || 1;

        // Request the required canvas size (rounded up) taking the pixelratio into account.
        this._canvas.width = pixelRatio * Math.ceil(width);
        this._canvas.height = pixelRatio * Math.ceil(height);

        // Maintain the same canvas size, potentially downscaling it for HiDPI displays
        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    }

    _addMarker(marker: Marker) {
        this._markers.push(marker);
    }

    _removeMarker(marker: Marker) {
        const index = this._markers.indexOf(marker);
        if (index !== -1) {
            this._markers.splice(index, 1);
        }
    }

    _addPopup(popup: Popup) {
        this._popups.push(popup);
    }

    _removePopup(popup: Popup) {
        const index = this._popups.indexOf(popup);
        if (index !== -1) {
            this._popups.splice(index, 1);
        }
    }

    _setupPainter() {
        const attributes = extend({}, supported.webGLContextAttributes, {
            failIfMajorPerformanceCaveat: this._failIfMajorPerformanceCaveat,
            preserveDrawingBuffer: this._preserveDrawingBuffer,
            antialias: this._antialias || false
        });

        const gl = this._canvas.getContext('webgl2', attributes);

        if (!gl) {
            this.fire(new ErrorEvent(new Error('Failed to initialize WebGL')));
            return;
        }

        storeAuthState(gl, true);

        this.painter = new Painter(gl, this._contextCreateOptions, this.transform, this._scaleFactor, this._tp, this._worldview);
        this.on('data', (event) => {
            if (event.dataType === 'source') {
                this.painter.setTileLoadedFlag(true);
            }
        });

        webpSupported.testSupport(gl);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _contextLost(event: any) {
        event.preventDefault();
        if (this._frame) {
            this._frame.cancel();
            this._frame = null;
        }
        this.fire(new Event('webglcontextlost', {originalEvent: event}));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _contextRestored(event: any) {
        this._setupPainter();
        this.painter.resize(Math.ceil(this._containerWidth), Math.ceil(this._containerHeight));
        this._updateTerrain();
        if (this.style) {
            this.style.clearLayers();
            this.style.imageManager.destroyAtlasTextures();
            this.style.reloadModels();
            this.style.clearSources();
        }
        this._update();
        this.fire(new Event('webglcontextrestored', {originalEvent: event}));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _onMapScroll(event: any): boolean | null | undefined {
        if (event.target !== this._container) return;

        // Revert any scroll which would move the canvas outside of the view
        this._container.scrollTop = 0;
        this._container.scrollLeft = 0;
        return false;
    }

    /** @section Lifecycle */

    /**
     * Returns a Boolean indicating whether the map is in idle state:
     * - No camera transitions are in progress.
     * - All currently requested tiles have loaded.
     * - All fade/transition animations have completed.
     *
     * Returns `false` if there are any camera or animation transitions in progress,
     * if the style is not yet fully loaded, or if there has been a change to the sources or style that has not yet fully loaded.
     *
     * If the map.repaint is set to `true`, the map will never be idle.
     *
     * @returns {boolean} A Boolean indicating whether the map is idle.
     * @example
     * const isIdle = map.idle();
     */
    idle(): boolean {
        return !this.isMoving() && this.loaded();
    }

    /**
     * Returns a Boolean indicating whether the map is fully loaded.
     *
     * Returns `false` if the style is not yet fully loaded,
     * or if there has been a change to the sources or style that
     * has not yet fully loaded.
     *
     * @returns {boolean} A Boolean indicating whether the map is fully loaded.
     * @example
     * const isLoaded = map.loaded();
     */
    loaded(): boolean {
        return !this._styleDirty && !this._sourcesDirty && !!this.style && this.style.loaded();
    }

    /**
     * Returns a Boolean indicating whether the map is finished rendering, meaning all animations are finished.
     *
     * @returns {boolean} A Boolean indicating whether map finished rendering.
     * @example
     * const frameReady = map.frameReady();
     */
    frameReady(): boolean {
        return this.loaded() && !this._placementDirty;
    }

    /**
     * Update this map's style and sources, and re-render the map.
     *
     * @param {boolean} updateStyle mark the map's style for reprocessing as
     * well as its sources
     * @returns {Map} this
     * @private
     */
    _update(updateStyle?: boolean): this {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;
        this.triggerRepaint();

        return this;
    }

    /**
     * Request that the given callback be executed during the next render
     * frame.  Schedule a render frame if one is not already scheduled.
     * @returns An id that can be used to cancel the callback
     * @private
     */
    override _requestRenderFrame(callback: () => void): TaskID {
        this._update();
        return this._renderTaskQueue.add(callback);
    }

    override _cancelRenderFrame(id: TaskID) {
        this._renderTaskQueue.remove(id);
    }

    /**
     * Request that the given callback be executed during the next render frame if the map is not
     * idle. Otherwise it is executed immediately, to avoid triggering a new render.
     * @private
     */
    _requestDomTask(callback: () => void) {
        // This condition means that the map is idle: the callback needs to be called right now as
        // there won't be a triggered render to run the queue.
        if (!this.loaded() || (this.loaded() && !this.isMoving())) {
            callback();
        } else {
            this._domRenderTaskQueue.add(callback);
        }
    }

    /**
     * Call when a (re-)render of the map is required:
     * - The style has changed (`setPaintProperty()`, etc.)
     * - Source data has changed (for example, tiles have finished loading)
     * - The map has is moving (or just finished moving)
     * - A transition is in progress
     *
     * @param {number} paintStartTimeStamp  The time when the animation frame began executing.
     *
     * @returns {Map} this
     * @private
     */
    _render(paintStartTimeStamp: number) {
        const m = PerformanceUtils.beginMeasure('render');
        this.fire(new Event('renderstart'));

        ++this._frameId;

        let gpuTimer: WebGLQuery;
        const extTimerQuery = this.painter.context.extTimerQuery;
        const frameStartTime = browser.now();
        const gl = this.painter.context.gl;
        if (this.listens('gpu-timing-frame')) {
            gpuTimer = gl.createQuery();
            gl.beginQuery(extTimerQuery.TIME_ELAPSED_EXT, gpuTimer);
        }

        // A custom layer may have used the context asynchronously. Mark the state as dirty.
        this.painter.context.setDirty();
        this.painter.setBaseState();

        if (this.isMoving() || this.isRotating() || this.isZooming()) {
            this._interactionRange[0] = Math.min(this._interactionRange[0], performance.now());
            this._interactionRange[1] = Math.max(this._interactionRange[1], performance.now());
        }

        this._renderTaskQueue.run(paintStartTimeStamp);
        this._domRenderTaskQueue.run(paintStartTimeStamp);
        // A task queue callback may have fired a user event which may have removed the map
        if (this._removed) return;

        this._updateProjectionTransition();

        const fadeDuration = this._isInitialLoad ? 0 : this._fadeDuration;

        // If the style has changed, the map is being zoomed, or a transition or fade is in progress:
        //  - Apply style changes (in a batch)
        //  - Recalculate paint properties.
        if (this.style && this._styleDirty) {
            this._styleDirty = false;

            const zoom = this.transform.zoom;
            const pitch = this.transform.pitch;
            const now = browser.now();

            const parameters = new EvaluationParameters(zoom, {
                now,
                fadeDuration,
                pitch,
                transition: this.style.transition,
                worldview: this._worldview
            });

            this.style.update(parameters);
        }

        if (this.style && this.style.hasFogTransition()) {
            this.style._markersNeedUpdate = true;
            this._sourcesDirty = true;
        }

        // If we are in _render for any reason other than an in-progress paint
        // transition, update source caches to check for and load any tiles we
        // need for the current transform
        let averageElevationChanged = false;
        if (this.style && this._sourcesDirty) {
            this._sourcesDirty = false;
            this.painter._updateFog(this.style);
            this._updateTerrain(); // Terrain DEM source updates here and skips update in Style#updateSources.
            averageElevationChanged = this._updateAverageElevation(frameStartTime);
            this.style.updateSources(this.transform);
            this.style.updateImageProviders();
            // Update positions of markers and popups on enabling/disabling terrain
            if (!this.isMoving()) {
                this._forceMarkerAndPopupUpdate();
            }
        } else {
            averageElevationChanged = this._updateAverageElevation(frameStartTime);
        }

        const updatePlacementResult = this.style && this.style._updatePlacement(this.painter, this.painter.transform, this.showCollisionBoxes, fadeDuration, this._crossSourceCollisions, this.painter.replacementSource, this._scaleFactorChanged);
        if (this._scaleFactorChanged) {
            this._scaleFactorChanged = false;
        }
        if (updatePlacementResult) {
            this._placementDirty = updatePlacementResult.needsRerender;
        }

        // Actually draw
        if (this.style) {
            this.painter.render(this.style, {
                showTileBoundaries: this.showTileBoundaries,
                showParseStatus: this.showParseStatus,
                wireframe: {
                    terrain: this.showTerrainWireframe,
                    layers2D: this.showLayers2DWireframe,
                    layers3D: this.showLayers3DWireframe
                },
                showOverdrawInspector: this._showOverdrawInspector,
                showQueryGeometry: !!this._showQueryGeometry,
                showTileAABBs: this.showTileAABBs,
                rotating: this.isRotating(),
                zooming: this.isZooming(),
                moving: this.isMoving(),
                fadeDuration,
                isInitialLoad: this._isInitialLoad,
                showPadding: this.showPadding,
                gpuTiming: !!this.listens('gpu-timing-layer'),
                gpuTimingDeferredRender: !!this.listens('gpu-timing-deferred-render'),
                speedIndexTiming: this.speedIndexTiming,
            });
        }

        this.fire(new Event('render'));

        if (this.loaded() && !this._loaded) {
            this._loaded = true;
            LivePerformanceUtils.mark(LivePerformanceMarkers.load);
            this.fire(new Event('load'));
        }

        if (this.style && (this.style.hasTransitions())) {
            this._styleDirty = true;
        }

        // Whenever precipitation effects are present -> force constant redraw
        if (this.style && (this.style.snow || this.style.rain)) {
            this._styleDirty = true;
        }

        // Background patterns are rasterized in a worker thread, while
        // it's still in progress we need to keep rendering
        if (this.style && this.style.imageManager.hasPatternsInFlight()) {
            this._styleDirty = true;
        }

        if (this.style && (!this.style.modelManager.isLoaded())) {
            this._styleDirty = true;
        }

        if (this.style && !this._placementDirty) {
            // Since no fade operations are in progress, we can release
            // all tiles held for fading. If we didn't do this, the tiles
            // would just sit in the SourceCaches until the next render
            this.style._releaseSymbolFadeTiles();
        }

        if (gpuTimer) {
            const renderCPUTime = browser.now() - frameStartTime;
            gl.endQuery(extTimerQuery.TIME_ELAPSED_EXT);
            setTimeout(() => {
                const renderGPUTime = gl.getQueryParameter(gpuTimer, gl.QUERY_RESULT) / (1000 * 1000);
                gl.deleteQuery(gpuTimer);
                this.fire(new Event('gpu-timing-frame', {
                    cpuTime: renderCPUTime,
                    gpuTime: renderGPUTime
                }));
                PerformanceUtils.mark(PerformanceMarkers.frameGPU, {
                    startTime: frameStartTime,
                    detail: {
                        gpuTime: renderGPUTime
                    }
                });
            }, 50); // Wait 50ms to give time for all GPU calls to finish before querying
        }

        PerformanceUtils.endMeasure(m);

        if (this.listens('gpu-timing-layer')) {
            // Resetting the Painter's per-layer timing queries here allows us to isolate
            // the queries to individual frames.
            const frameLayerQueries = this.painter.collectGpuTimers();

            setTimeout(() => {
                const renderedLayerTimes = this.painter.queryGpuTimers(frameLayerQueries);

                this.fire(new Event('gpu-timing-layer', {
                    layerTimes: renderedLayerTimes
                }));
            }, 50); // Wait 50ms to give time for all GPU calls to finish before querying
        }

        if (this.listens('gpu-timing-deferred-render')) {
            const deferredRenderQueries = this.painter.collectDeferredRenderGpuQueries();

            setTimeout(() => {
                const gpuTime = this.painter.queryGpuTimeDeferredRender(deferredRenderQueries);
                this.fire(new Event('gpu-timing-deferred-render', {gpuTime}));
            }, 50); // Wait 50ms to give time for all GPU calls to finish before querying
        }

        // Schedule another render frame if it's needed.
        //
        // Even though `_styleDirty` and `_sourcesDirty` are reset in this
        // method, synchronous events fired during Style#update or
        // Style#updateSources could have caused them to be set again.
        const somethingDirty = this._sourcesDirty || this._styleDirty || this._placementDirty || averageElevationChanged;

        if (somethingDirty || this._repaint) {
            this.triggerRepaint();
        } else {
            const willIdle = this.idle();
            if (willIdle) {
                // Before idling, we perform one last sample so that if the average elevation
                // does not exactly match the terrain, we skip idle and ease it to its final state.
                averageElevationChanged = this._updateAverageElevation(frameStartTime, true);
            }

            if (averageElevationChanged) {
                this.triggerRepaint();
            } else {
                this._triggerFrame(false);
                if (willIdle) {
                    this.fire(new Event('idle'));
                    this._isInitialLoad = false;
                    // check the options to see if need to calculate the speed index
                    if (this.speedIndexTiming) {
                        const speedIndexNumber = this._calculateSpeedIndex();
                        this.fire(new Event('speedindexcompleted', {speedIndex: speedIndexNumber}));
                        this.speedIndexTiming = false;
                    }
                }
            }
        }

        if (this._loaded && !this._fullyLoaded && !somethingDirty) {
            this._fullyLoaded = true;
            LivePerformanceUtils.mark(LivePerformanceMarkers.fullLoad);
            // Following lines are billing and metrics related code. Do not change. See LICENSE.txt
            if (this._performanceMetricsCollection) {
                postPerformanceEvent(this._requestManager._customAccessToken, {
                    width: this.painter.width,
                    height: this.painter.height,
                    interactionRange: this._interactionRange,
                    visibilityHidden: this._visibilityHidden,
                    terrainEnabled: !!this.painter.style.getTerrain(),
                    fogEnabled: !!this.painter.style.getFog(),
                    projection: this.getProjection().name,
                    zoom: this.transform.zoom,
                    renderer: this.painter.context.renderer,
                    vendor: this.painter.context.vendor
                });
            }
            this._authenticate();
        }
    }

    _forceMarkerAndPopupUpdate(shouldWrap?: boolean) {
        for (const marker of this._markers) {
            // Wrap marker location when toggling to a projection without world copies
            if (shouldWrap && !this.getRenderWorldCopies()) {
                marker._lngLat = marker._lngLat.wrap();
            }
            marker._update();
        }
        for (const popup of this._popups) {
            // Wrap popup location when toggling to a projection without world copies and track pointer set to false
            if (shouldWrap && !this.getRenderWorldCopies() && !popup._trackPointer) {
                popup._lngLat = popup._lngLat.wrap();
            }
            popup._update();
        }
    }

    /**
     * Update the average visible elevation by sampling terrain
     *
     * @returns {boolean} true if elevation has changed from the last sampling
     * @private
     */
    _updateAverageElevation(timeStamp: number, ignoreTimeout: boolean = false): boolean {
        const applyUpdate = (value: number) => {
            this.transform.averageElevation = value;
            this._update(false);
            return true;
        };

        if (!this.painter.averageElevationNeedsEasing()) {
            if (this.transform.averageElevation !== 0) return applyUpdate(0);
            return false;
        }

        const exaggerationChanged = this.transform.elevation && this.transform.elevation.exaggeration() !== this._averageElevationExaggeration;
        const timeoutElapsed = ignoreTimeout || timeStamp - this._averageElevationLastSampledAt > AVERAGE_ELEVATION_SAMPLING_INTERVAL;

        if (exaggerationChanged || (timeoutElapsed && !this._averageElevation.isEasing(timeStamp))) {
            const currentElevation = this.transform.averageElevation;
            let newElevation = this.transform.sampleAverageElevation();

            if (this.transform.elevation != null) {
                this._averageElevationExaggeration = this.transform.elevation.exaggeration();
            }

            // New elevation is NaN if no terrain tiles were available
            if (isNaN(newElevation)) {
                newElevation = 0;
            } else {
                // Don't activate the timeout if no data was available
                this._averageElevationLastSampledAt = timeStamp;
            }
            const elevationChange = Math.abs(currentElevation - newElevation);

            if (elevationChange > AVERAGE_ELEVATION_EASE_THRESHOLD) {
                if (this._isInitialLoad || exaggerationChanged) {
                    this._averageElevation.jumpTo(newElevation);
                    return applyUpdate(newElevation);
                } else {
                    this._averageElevation.easeTo(newElevation, timeStamp, AVERAGE_ELEVATION_EASE_TIME);
                }
            } else if (elevationChange > AVERAGE_ELEVATION_CHANGE_THRESHOLD) {
                this._averageElevation.jumpTo(newElevation);
                return applyUpdate(newElevation);
            }
        }

        if (this._averageElevation.isEasing(timeStamp)) {
            return applyUpdate(this._averageElevation.getValue(timeStamp));
        }

        return false;
    }

    /***** START WARNING - REMOVAL OR MODIFICATION OF THE
    * FOLLOWING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******
    * The following code is used to access Mapbox's APIs. Removal or modification
    * of this code can result in higher fees and/or
    * termination of your account with Mapbox.
    *
    * Under the Mapbox Terms of Service, you may not use this code to access Mapbox
    * Mapping APIs other than through Mapbox SDKs.
    *
    * The Mapping APIs documentation is available at https://docs.mapbox.com/api/maps/#maps
    * and the Mapbox Terms of Service are available at https://www.mapbox.com/tos/
    ******************************************************************************/

    _authenticate() {
        getMapSessionAPI(this._getMapId(), this._requestManager._skuToken, this._requestManager._customAccessToken, (err: AJAXError) => {
            if (err) {
                // throwing an error here will cause the callback to be called again unnecessarily
                if (err.message === AUTH_ERR_MSG || err.status === 401) {
                    const gl = this.painter.context.gl;
                    storeAuthState(gl, false);
                    if (this._logoControl instanceof LogoControl) {
                        this._logoControl._updateLogo();
                    }
                    if (gl) gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

                    if (!this._silenceAuthErrors) {
                        this.fire(new ErrorEvent(new Error('A valid Mapbox access token is required to use Mapbox GL JS. To create an account or a new access token, visit https://account.mapbox.com/')));
                    }
                }
            }
        });

        postMapLoadEvent(this._getMapId(), this._requestManager._skuToken, this._requestManager._customAccessToken, () => {});
    }

    /***** END WARNING - REMOVAL OR MODIFICATION OF THE
    PRECEDING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******/

    _postStyleLoadEvent() {
        if (!this.style.globalId) {
            return;
        }

        postStyleLoadEvent(this._requestManager._customAccessToken, {
            map: this,
            style: this.style.globalId,
            importedStyles: this.style.getImportGlobalIds()
        });
    }

    _updateTerrain() {
        // Recalculate if enabled/disabled and calculate elevation cover. As camera is using elevation tiles before
        // render (and deferred update after zoom recalculation), this needs to be called when removing terrain source.
        const adaptCameraAltitude = this._isDragging();
        this.painter.updateTerrain(this.style, adaptCameraAltitude);
    }

    _calculateSpeedIndex(): number {
        const finalFrame = this.painter.canvasCopy();
        const canvasCopyInstances = this.painter.getCanvasCopiesAndTimestamps();
        canvasCopyInstances.timeStamps.push(performance.now());

        const gl = this.painter.context.gl;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        function read(texture?: WebGLTexture | null) {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
        }

        return this._canvasPixelComparison(read(finalFrame), canvasCopyInstances.canvasCopies.map(read), canvasCopyInstances.timeStamps);
    }

    _canvasPixelComparison(finalFrame: Uint8Array, allFrames: Uint8Array[], timeStamps: number[]): number {
        let finalScore = timeStamps[1] - timeStamps[0];
        const numPixels = finalFrame.length / 4;

        for (let i = 0; i < allFrames.length; i++) {
            const frame = allFrames[i];
            let cnt = 0;
            for (let j = 0; j < frame.length; j += 4) {
                if (frame[j] === finalFrame[j] &&
                    frame[j + 1] === finalFrame[j + 1] &&
                    frame[j + 2] === finalFrame[j + 2] &&
                    frame[j + 3] === finalFrame[j + 3]) {
                    cnt = cnt + 1;
                }
            }
            //calculate the % visual completeness
            const interval = timeStamps[i + 2] - timeStamps[i + 1];
            const visualCompletness = cnt / numPixels;
            finalScore +=  interval * (1 - visualCompletness);
        }
        return finalScore;
    }

    /**
     * Clean up and release all internal resources associated with this map.
     *
     * This includes DOM elements, event bindings, web workers, and WebGL resources.
     *
     * Use this method when you are done using the map and wish to ensure that it no
     * longer consumes browser resources. Afterwards, you must not call any other
     * methods on the map.
     *
     * @example
     * map.remove();
     */
    remove() {
        if (this._hash) this._hash.remove();

        for (const control of this._controls) control.onRemove(this);
        this._controls = [];

        if (this._frame) {
            this._frame.cancel();
            this._frame = null;
        }
        this._renderTaskQueue.clear();
        this._domRenderTaskQueue.clear();
        if (this.style) {
            this.style.destroy();
        }
        this.indoor.destroy();
        this.painter.destroy();
        if (this.handlers) this.handlers.destroy();
        this.handlers = undefined;
        this.setStyle(null);

        window.removeEventListener('resize', this._onWindowResize, false);
        window.removeEventListener('orientationchange', this._onWindowResize, false);
        window.removeEventListener(this._fullscreenchangeEvent, this._onWindowResize, false);
        window.removeEventListener('online', this._onWindowOnline, false);
        window.removeEventListener('visibilitychange', this._onVisibilityChange, false);

        const extension = this.painter.context.gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();

        this._canvas.removeEventListener('webglcontextlost', this._contextLost, false);
        this._canvas.removeEventListener('webglcontextrestored', this._contextRestored, false);

        this._canvasContainer.remove();
        this._controlContainer.remove();
        this._missingCSSCanary.remove();

        this._canvas = undefined;
        this._canvasContainer = undefined;
        this._controlContainer = undefined;
        this._missingCSSCanary = undefined;

        this._container.classList.remove('mapboxgl-map');
        this._container.removeEventListener('scroll', this._onMapScroll, false);

        PerformanceUtils.clearMetrics();
        removeAuthState(this.painter.context.gl);

        mapSessionAPI.remove();
        mapLoadEvent.remove();

        this._removed = true;
        this.fire(new Event('remove'));
    }

    /**
     * Trigger the rendering of a single frame. Use this method with custom layers to
     * repaint the map when the layer's properties or properties associated with the
     * layer's source change. Calling this multiple times before the
     * next frame is rendered will still result in only a single frame being rendered.
     *
     * @example
     * map.triggerRepaint();
     * @see [Example: Add a 3D model](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/)
     * @see [Example: Add an animated icon to the map](https://docs.mapbox.com/mapbox-gl-js/example/add-image-animated/)
     */
    triggerRepaint() {
        this._triggerFrame(true);
    }

    _triggerFrame(render: boolean) {
        this._renderNextFrame = this._renderNextFrame || render;
        if (this.style && !this._frame) {
            this._frame = browser.frame((paintStartTimeStamp: number) => {
                const isRenderFrame = !!this._renderNextFrame;
                PerformanceUtils.frame(paintStartTimeStamp, isRenderFrame);
                this._frame = null;
                this._renderNextFrame = null;
                if (isRenderFrame) {
                    this._render(paintStartTimeStamp);
                }
            });
        }
    }

    /**
     * Preloads all tiles that will be requested for one or a series of transformations
     *
     * @private
     * @returns {Object} Returns `this` | Promise.
     */
    override _preloadTiles(transform: Transform | Array<Transform>): this {
        const sourceCaches: Array<SourceCache> = this.style ? this.style.getSourceCaches() : [];
        asyncAll(sourceCaches, (sourceCache, done) => sourceCache._preloadTiles(transform, done), () => {
            this.triggerRepaint();
        });

        return this;
    }

    _onWindowOnline() {
        this._update();
    }

    _onWindowResize(event: UIEvent) {
        if (this._trackResize) {
            this.resize({originalEvent: event})._update();
        }
    }

    _onVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this._visibilityHidden++;
        }
    }

    /** @section Debug features */

    /**
     * Gets and sets a Boolean indicating whether the map will render an outline
     * around each tile. These tile boundaries are useful for debugging.
     *
     * @name showTileBoundaries
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.showTileBoundaries = true;
     */
    get showTileBoundaries(): boolean { return !!this._showTileBoundaries; }
    set showTileBoundaries(value: boolean) {
        if (this._showTileBoundaries === value) return;
        this._showTileBoundaries = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render the tile ID
     * and the status of the tile in their corner when `showTileBoundaries` is on.
     *
     * The uncompressed file size of the first vector source is drawn in the top left
     * corner of each tile, next to the tile ID.
     *
     * @name showParseStatus
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.showParseStatus = true;
     */
    get showParseStatus(): boolean { return !!this._showParseStatus; }
    set showParseStatus(value: boolean) {
        if (this._showParseStatus === value) return;
        this._showParseStatus = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render a wireframe
     * on top of the displayed terrain. Useful for debugging.
     *
     * The wireframe is always red and is drawn only when terrain is active.
     *
     * @name showTerrainWireframe
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.showTerrainWireframe = true;
     */
    get showTerrainWireframe(): boolean { return !!this._showTerrainWireframe; }
    set showTerrainWireframe(value: boolean) {
        if (this._showTerrainWireframe === value) return;
        this._showTerrainWireframe = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render a wireframe
     * on top of 2D layers. Useful for debugging.
     *
     * The wireframe is always red and is drawn only for 2D layers.
     *
     * @name showLayers2DWireframe
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.showLayers2DWireframe = true;
     */
    get showLayers2DWireframe(): boolean { return !!this._showLayers2DWireframe; }
    set showLayers2DWireframe(value: boolean) {
        if (this._showLayers2DWireframe === value) return;
        this._showLayers2DWireframe = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render a wireframe
     * on top of 3D layers. Useful for debugging.
     *
     * The wireframe is always red and is drawn only for 3D layers.
     *
     * @name showLayers3DWireframe
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.showLayers3DWireframe = true;
     */
    get showLayers3DWireframe(): boolean { return !!this._showLayers3DWireframe; }
    set showLayers3DWireframe(value: boolean) {
        if (this._showLayers3DWireframe === value) return;
        this._showLayers3DWireframe = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the speedindex metric calculation is on or off
     *
     * @private
     * @name speedIndexTiming
     * @type {boolean}
     * @instance
     * @memberof Map
     * @example
     * map.speedIndexTiming = true;
     */
    get speedIndexTiming(): boolean { return !!this._speedIndexTiming; }
    set speedIndexTiming(value: boolean) {
        if (this._speedIndexTiming === value) return;
        this._speedIndexTiming = value;
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will visualize
     * the padding offsets.
     *
     * @name showPadding
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get showPadding(): boolean { return !!this._showPadding; }
    set showPadding(value: boolean) {
        if (this._showPadding === value) return;
        this._showPadding = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render boxes
     * around all symbols in the data source, revealing which symbols
     * were rendered or which were hidden due to collisions.
     * This information is useful for debugging.
     *
     * @name showCollisionBoxes
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get showCollisionBoxes(): boolean { return !!this._showCollisionBoxes; }
    set showCollisionBoxes(value: boolean) {
        if (this._showCollisionBoxes === value) return;
        this._showCollisionBoxes = value;
        this._tp.refreshUI();
        if (value) {
            // When we turn collision boxes on we have to generate them for existing tiles
            // When we turn them off, there's no cost to leaving existing boxes in place
            this.style._generateCollisionBoxes();
        } else {
            // Otherwise, call an update to remove collision boxes
            this._update();
        }
    }

    /**
     * Gets and sets a Boolean indicating whether the map should color-code
     * each fragment to show how many times it has been shaded.
     * White fragments have been shaded 8 or more times.
     * Black fragments have been shaded 0 times.
     * This information is useful for debugging.
     *
     * @name showOverdraw
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get showOverdrawInspector(): boolean { return !!this._showOverdrawInspector; }
    set showOverdrawInspector(value: boolean) {
        if (this._showOverdrawInspector === value) return;
        this._showOverdrawInspector = value;
        this._tp.refreshUI();
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will
     * continuously repaint. This information is useful for analyzing performance.
     * The map will never be idle when this option is set to `true`.
     *
     * @name repaint
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get repaint(): boolean { return !!this._repaint; }
    set repaint(value: boolean) {
        if (this._repaint !== value) {
            this._repaint = value;
            this._tp.refreshUI();
            this.triggerRepaint();
        }
    }
    // show vertices
    get vertices(): boolean { return !!this._vertices; }
    set vertices(value: boolean) { this._vertices = value; this._update(); }

    /**
    * Display tile AABBs for debugging
    *
    * @private
    * @type {boolean}
    */
    get showTileAABBs(): boolean { return !!this._showTileAABBs; }
    set showTileAABBs(value: boolean) {
        if (this._showTileAABBs === value) return;
        this._showTileAABBs = value;
        this._tp.refreshUI();
        if (!value) { Debug.clearAabbs(); return; }
        this._update();
    }

    // for cache browser tests
    _setCacheLimits(limit: number, checkThreshold: number) {
        setCacheLimits(limit, checkThreshold);
    }

    /**
     * The version of Mapbox GL JS in use as specified in package.json, CHANGELOG.md, and the GitHub release.
     *
     * @name version
     * @instance
     * @memberof Map
     * @var {string} version
     */

    get version(): string { return version; }
}

/**
 * Interface for interactive controls added to the map. This is a
 * specification for implementers to model: it is not
 * an exported method or class.
 *
 * Controls must implement `onAdd` and `onRemove`, and must own an
 * element, which is often a `div` element. To use Mapbox GL JS's
 * default control styling, add the `mapboxgl-ctrl` class to your control's
 * node.
 *
 * @interface IControl
 * @example
 * // Control implemented as ES6 class
 * class HelloWorldControl {
 *     onAdd(map) {
 *         this._map = map;
 *         this._container = document.createElement('div');
 *         this._container.className = 'mapboxgl-ctrl';
 *         this._container.textContent = 'Hello, world';
 *         return this._container;
 *     }
 *
 *     onRemove() {
 *         this._container.parentNode.removeChild(this._container);
 *         this._map = undefined;
 *     }
 * }
 *
 * @example
 * // Control implemented as ES5 prototypical class
 * function HelloWorldControl() { }
 *
 * HelloWorldControl.prototype.onAdd = function(map) {
 *     this._map = map;
 *     this._container = document.createElement('div');
 *     this._container.className = 'mapboxgl-ctrl';
 *     this._container.textContent = 'Hello, world';
 *     return this._container;
 * };
 *
 * HelloWorldControl.prototype.onRemove = function () {
 *     this._container.parentNode.removeChild(this._container);
 *     this._map = undefined;
 * };
 */

/**
 * Register a control on the map and give it a chance to register event listeners
 * and resources. This method is called by {@link Map#addControl}
 * internally.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name onAdd
 * @param {Map} map The Map this control will be added to.
 * @returns {HTMLElement} The control's container element. This should
 * be created by the control and returned by onAdd without being attached
 * to the DOM: the map will insert the control's element into the DOM
 * as necessary.
 */

/**
 * Unregister a control on the map and give it a chance to detach event listeners
 * and resources. This method is called by {@link Map#removeControl}
 * internally.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name onRemove
 * @param {Map} map The Map this control will be removed from.
 * @returns {undefined} There is no required return value for this method.
 */

/**
 * Optionally provide a default position for this control. If this method
 * is implemented and {@link Map#addControl} is called without the `position`
 * parameter, the value returned by getDefaultPosition will be used as the
 * control's position.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name getDefaultPosition
 * @returns {string} A control position, one of the values valid in addControl.
 */

/**
 * A [`Point` geometry](https://github.com/mapbox/point-geometry) object, which has
 * `x` and `y` screen coordinates in pixels, or other units.
 *
 * @typedef {Point} Point
 * @example
 * const point = new mapboxgl.Point(400, 525);
 */

/**
 * A {@link Point} or an array of two numbers representing `x` and `y` screen coordinates in pixels, or other units.
 *
 * @typedef {(Point | Array<number>)} PointLike
 * @example
 * const p1 = new mapboxgl.Point(400, 525); // a PointLike which is a Point
 * const p2 = [400, 525]; // a PointLike which is an array of two numbers
 */
