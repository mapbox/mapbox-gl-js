// @flow

const util = require('../util/util');
const browser = require('../util/browser');
const window = require('../util/window');
const {HTMLImageElement} = require('../util/window');
const DOM = require('../util/dom');
const ajax = require('../util/ajax');

const Style = require('../style/style');
const AnimationLoop = require('../style/animation_loop');
const Painter = require('../render/painter');

const Transform = require('../geo/transform');
const Hash = require('./hash');

const bindHandlers = require('./bind_handlers');

const Camera = require('./camera');
const LngLat = require('../geo/lng_lat');
const LngLatBounds = require('../geo/lng_lat_bounds');
const Point = require('@mapbox/point-geometry');
const AttributionControl = require('./control/attribution_control');
const LogoControl = require('./control/logo_control');
const isSupported = require('mapbox-gl-supported');

require('./events'); // Pull in for documentation.js

import type {LngLatLike} from '../geo/lng_lat';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import type {RequestParameters} from '../util/ajax';
import type {StyleOptions} from '../style/style';
import type {MapEvent, MapDataEvent} from './events';
import type {RGBAImage} from '../util/image';

import type ScrollZoomHandler from './handler/scroll_zoom';
import type BoxZoomHandler from './handler/box_zoom';
import type DragRotateHandler from './handler/drag_rotate';
import type DragPanHandler from './handler/drag_pan';
import type KeyboardHandler from './handler/keyboard';
import type DoubleClickZoomHandler from './handler/dblclick_zoom';
import type TouchZoomRotateHandler from './handler/touch_zoom_rotate';

type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/* eslint-disable no-use-before-define */
type IControl = {
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;

    +getDefaultPosition?: () => ControlPosition;
}
/* eslint-enable no-use-before-define */

type ResourceTypeEnum = $Keys<typeof ajax.ResourceType>;
export type RequestTransformFunction = (url: string, resourceType?: ResourceTypeEnum) => RequestParameters;

type MapOptions = {
    hash?: boolean,
    interactive?: boolean,
    container: HTMLElement | string,
    bearingSnap?: number,
    classes?: Array<string>,
    attributionControl?: boolean,
    logoPosition?: ControlPosition,
    failIfMajorPerformanceCaveat?: boolean,
    preserveDrawingBuffer?: boolean,
    refreshExpiredTiles?: boolean,
    maxBounds?: LngLatBoundsLike,
    scrollZoom?: boolean,
    minZoom?: ?number,
    maxZoom?: ?number,
    boxZoom?: boolean,
    dragRotate?: boolean,
    dragPan?: boolean,
    keyboard?: boolean,
    doubleClickZoom?: boolean,
    touchZoomRotate?: boolean,
    trackResize?: boolean,
    center?: LngLatLike,
    zoom?: number,
    bearing?: number,
    pitch?: number,
    renderWorldCopies?: boolean,
    maxTileCacheSize?: number,
    transformRequest?: RequestTransformFunction
};

const defaultMinZoom = 0;
const defaultMaxZoom = 22;
const defaultOptions = {
    center: [0, 0],
    zoom: 0,
    bearing: 0,
    pitch: 0,

    minZoom: defaultMinZoom,
    maxZoom: defaultMaxZoom,

    interactive: true,

    scrollZoom: true,
    boxZoom: true,
    dragRotate: true,
    dragPan: true,
    keyboard: true,
    doubleClickZoom: true,
    touchZoomRotate: true,

    bearingSnap: 7,

    hash: false,

    attributionControl: true,

    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,

    trackResize: true,

    renderWorldCopies: true,

    refreshExpiredTiles: true,

    maxTileCacheSize: null,

    transformRequest: null
};

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
 * @param {number} [options.minZoom=0] The minimum zoom level of the map (0-22).
 * @param {number} [options.maxZoom=22] The maximum zoom level of the map (0-22).
 * @param {Object|string} [options.style] The map's Mapbox style. This must be an a JSON object conforming to
 * the schema described in the [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to
 * such JSON.
 *
 * To load a style from the Mapbox API, you can use a URL of the form `mapbox://styles/:owner/:style`,
 * where `:owner` is your Mapbox account name and `:style` is the style ID. Or you can use one of the following
 * [the predefined Mapbox styles](https://www.mapbox.com/maps/):
 *
 *  * `mapbox://styles/mapbox/streets-v9`
 *  * `mapbox://styles/mapbox/outdoors-v9`
 *  * `mapbox://styles/mapbox/light-v9`
 *  * `mapbox://styles/mapbox/dark-v9`
 *  * `mapbox://styles/mapbox/satellite-v9`
 *  * `mapbox://styles/mapbox/satellite-streets-v9`
 *
 * Tilesets hosted with Mapbox can be style-optimized if you append `?optimize=true` to the end of your style URL, like `mapbox://styles/mapbox/streets-v9?optimize=true`.
 * Learn more about style-optimized vector tiles in our [API documentation](https://www.mapbox.com/api-documentation/#retrieve-tiles).
 *
 * @param {boolean} [options.hash=false] If `true`, the map's position (zoom, center latitude, center longitude, bearing, and pitch) will be synced with the hash fragment of the page's URL.
 *   For example, `http://path/to/my/page.html#2.59/39.26/53.07/-24.1/60`.
 * @param {boolean} [options.interactive=true] If `false`, no mouse, touch, or keyboard listeners will be attached to the map, so it will not respond to interaction.
 * @param {number} [options.bearingSnap=7] The threshold, measured in degrees, that determines when the map's
 *   bearing (rotation) will snap to north. For example, with a `bearingSnap` of 7, if the user rotates
 *   the map within 7 degrees of north, the map will automatically snap to exact north.
 * @param {boolean} [options.pitchWithRotate=true] If `false`, the map's pitch (tilt) control with "drag to rotate" interaction will be disabled.
 * @param {boolean} [options.attributionControl=true] If `true`, an {@link AttributionControl} will be added to the map.
 * @param {string} [options.logoPosition='bottom-left'] A string representing the position of the Mapbox wordmark on the map. Valid options are `top-left`,`top-right`, `bottom-left`, `bottom-right`.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the performance of Mapbox
 *   GL JS would be dramatically worse than expected (i.e. a software renderer would be used).
 * @param {boolean} [options.preserveDrawingBuffer=false] If `true`, the map's canvas can be exported to a PNG using `map.getCanvas().toDataURL()`. This is `false` by default as a performance optimization.
 * @param {boolean} [options.refreshExpiredTiles=true] If `false`, the map won't attempt to re-request tiles once they expire per their HTTP `cacheControl`/`expires` headers.
 * @param {LngLatBoundsLike} [options.maxBounds] If set, the map will be constrained to the given bounds.
 * @param {boolean|Object} [options.scrollZoom=true] If `true`, the "scroll to zoom" interaction is enabled. An `Object` value is passed as options to {@link ScrollZoomHandler#enable}.
 * @param {boolean} [options.boxZoom=true] If `true`, the "box zoom" interaction is enabled (see {@link BoxZoomHandler}).
 * @param {boolean} [options.dragRotate=true] If `true`, the "drag to rotate" interaction is enabled (see {@link DragRotateHandler}).
 * @param {boolean} [options.dragPan=true] If `true`, the "drag to pan" interaction is enabled (see {@link DragPanHandler}).
 * @param {boolean} [options.keyboard=true] If `true`, keyboard shortcuts are enabled (see {@link KeyboardHandler}).
 * @param {boolean} [options.doubleClickZoom=true] If `true`, the "double click to zoom" interaction is enabled (see {@link DoubleClickZoomHandler}).
 * @param {boolean|Object} [options.touchZoomRotate=true] If `true`, the "pinch to rotate and zoom" interaction is enabled. An `Object` value is passed as options to {@link TouchZoomRotateHandler#enable}.
 * @param {boolean} [options.trackResize=true]  If `true`, the map will automatically resize when the browser window resizes.
 * @param {LngLatLike} [options.center=[0, 0]] The inital geographical centerpoint of the map. If `center` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]` Note: Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.
 * @param {number} [options.zoom=0] The initial zoom level of the map. If `zoom` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.bearing=0] The initial bearing (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.pitch=0] The initial pitch (tilt) of the map, measured in degrees away from the plane of the screen (0-60). If `pitch` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {boolean} [options.renderWorldCopies=true]  If `true`, multiple copies of the world will be rendered, when zoomed out.
 * @param {number} [options.maxTileCacheSize=null]  The maxiumum number of tiles stored in the tile cache for a given source. If omitted, the cache will be dynamically sized based on the current viewport.
 * @param {string} [options.localIdeographFontFamily=null] If specified, defines a CSS font-family
 *   for locally overriding generation of glyphs in the 'CJK Unified Ideographs' and 'Hangul Syllables' ranges.
 *   In these ranges, font settings from the map's style will be ignored, except for font-weight keywords (light/regular/medium/bold).
 *   The purpose of this option is to avoid bandwidth-intensive glyph server requests. (see [Use locally generated ideographs](https://www.mapbox.com/mapbox-gl-js/example/local-ideographs))
 * @param {RequestTransformFunction} [options.transformRequest=null] A callback run before the Map makes a request for an external URL. The callback can be used to modify the url, set headers, or set the credentials property for cross-origin requests.
 *   Expected to return an object with a `url` property and optionally `headers` and `credentials` properties.
 * @example
 * var map = new mapboxgl.Map({
 *   container: 'map',
 *   center: [-122.420679, 37.772537],
 *   zoom: 13,
 *   style: style_object,
 *   hash: true,
 *   transformRequest: (url, resourceType)=> {
 *     if(resourceType == 'Source' && url.startsWith('http://myHost') {
 *       return {
 *        url: url.replace('http', 'https'),
 *        headers: { 'my-custom-header': true},
 *        credentials: 'include'  // Include cookies for cross-origin requests
 *      }
 *     }
 *   }
 * });
 * @see [Display a map](https://www.mapbox.com/mapbox-gl-js/examples/)
 */
class Map extends Camera {
    style: Style;
    painter: Painter;
    animationLoop: AnimationLoop;

    _classes: Array<string>;
    _container: HTMLElement;
    _missingCSSContainer: HTMLElement;
    _canvasContainer: HTMLElement;
    _controlContainer: HTMLElement;
    _controlPositions: {[string]: HTMLElement};
    _classOptions: ?{transition?: boolean};
    _interactive: ?boolean;
    _showTileBoundaries: ?boolean;
    _showCollisionBoxes: ?boolean;
    _showOverdrawInspector: boolean;
    _repaint: ?boolean;
    _vertices: ?boolean;
    _canvas: HTMLCanvasElement;
    _transformRequest: RequestTransformFunction;
    _maxTileCacheSize: number;
    _frameId: any;
    _styleDirty: ?boolean;
    _sourcesDirty: ?boolean;
    _loaded: boolean;
    _trackResize: boolean;
    _preserveDrawingBuffer: boolean;
    _failIfMajorPerformanceCaveat: boolean;
    _refreshExpiredTiles: boolean;
    _hash: Hash;
    _delegatedListeners: any;

    scrollZoom: ScrollZoomHandler;
    boxZoom: BoxZoomHandler;
    dragRotate: DragRotateHandler;
    dragPan: DragPanHandler;
    keyboard: KeyboardHandler;
    doubleClickZoom: DoubleClickZoomHandler;
    touchZoomRotate: TouchZoomRotateHandler;

    constructor(options: MapOptions) {
        options = util.extend({}, defaultOptions, options);

        if (options.minZoom != null && options.maxZoom != null && options.minZoom > options.maxZoom) {
            throw new Error(`maxZoom must be greater than minZoom`);
        }

        const transform = new Transform(options.minZoom, options.maxZoom, options.renderWorldCopies);
        super(transform, options);

        this._interactive = options.interactive;
        this._maxTileCacheSize = options.maxTileCacheSize;
        this._failIfMajorPerformanceCaveat = options.failIfMajorPerformanceCaveat;
        this._preserveDrawingBuffer = options.preserveDrawingBuffer;
        this._trackResize = options.trackResize;
        this._bearingSnap = options.bearingSnap;
        this._refreshExpiredTiles = options.refreshExpiredTiles;

        const transformRequestFn = options.transformRequest;
        this._transformRequest = transformRequestFn ?  (url, type) => transformRequestFn(url, type) || ({ url }) : (url) => ({ url });

        if (typeof options.container === 'string') {
            const container = window.document.getElementById(options.container);
            if (!container) {
                throw new Error(`Container '${options.container}' not found.`);
            } else {
                this._container = container;
            }
        } else {
            this._container = options.container;
        }

        this.animationLoop = new AnimationLoop();

        if (options.maxBounds) {
            this.setMaxBounds(options.maxBounds);
        }

        util.bindAll([
            '_onWindowOnline',
            '_onWindowResize',
            '_contextLost',
            '_contextRestored',
            '_update',
            '_render',
            '_onData',
            '_onDataLoading'
        ], this);

        this._setupContainer();
        this._setupPainter();

        this.on('move', this._update.bind(this, false));
        this.on('zoom', this._update.bind(this, true));
        this.on('moveend', () => {
            this.animationLoop.set(300); // text fading
            this._rerender();
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this._onWindowOnline, false);
            window.addEventListener('resize', this._onWindowResize, false);
        }

        bindHandlers(this, options);

        this._hash = options.hash && (new Hash()).addTo(this);
        // don't set position from options if set through hash
        if (!this._hash || !this._hash._onHashChange()) {
            this.jumpTo({
                center: options.center,
                zoom: options.zoom,
                bearing: options.bearing,
                pitch: options.pitch
            });
        }

        this.resize();

        if (options.style) this.setStyle(options.style, { localIdeographFontFamily: options.localIdeographFontFamily });

        if (options.attributionControl) this.addControl(new AttributionControl());
        this.addControl(new LogoControl(), options.logoPosition);

        this.on('style.load', function() {
            if (this.transform.unmodified) {
                this.jumpTo(this.style.stylesheet);
            }
            this.style.update({transition: false});
        });

        this.on('data', this._onData);
        this.on('dataloading', this._onDataLoading);
    }

    /**
     * Adds a {@link IControl} to the map, calling `control.onAdd(this)`.
     *
     * @param {IControl} control The {@link IControl} to add.
     * @param {string} [position] position on the map to which the control will be added.
     * Valid values are `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. Defaults to `'top-right'`.
     * @returns {Map} `this`
     * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
     */
    addControl(control: IControl, position?: ControlPosition) {
        if (position === undefined && control.getDefaultPosition) {
            position = control.getDefaultPosition();
        }
        if (position === undefined) {
            position = 'top-right';
        }
        const controlElement = control.onAdd(this);
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
     * @returns {Map} `this`
     */
    removeControl(control: IControl) {
        control.onRemove(this);
        return this;
    }

    /**
     * Resizes the map according to the dimensions of its
     * `container` element.
     *
     * This method must be called after the map's `container` is resized by another script,
     * or when the map is shown after being initially hidden with CSS.
     *
     * @returns {Map} `this`
     */
    resize() {
        const dimensions = this._containerDimensions();
        const width = dimensions[0];
        const height = dimensions[1];

        this._resizeCanvas(width, height);
        this.transform.resize(width, height);
        this.painter.resize(width, height);

        return this
            .fire('movestart')
            .fire('move')
            .fire('resize')
            .fire('moveend');
    }

    /**
     * Returns the map's geographical bounds.
     *
     * @returns {LngLatBounds} The map's geographical bounds.
     */
    getBounds() {
        const bounds = new LngLatBounds(
            this.transform.pointLocation(new Point(0, this.transform.height)),
            this.transform.pointLocation(new Point(this.transform.width, 0)));

        if (this.transform.angle || this.transform.pitch) {
            bounds.extend(this.transform.pointLocation(new Point(this.transform.size.x, 0)));
            bounds.extend(this.transform.pointLocation(new Point(0, this.transform.size.y)));
        }

        return bounds;
    }

    /**
     * Gets the map's geographical bounds.
     *
     * Returns the LngLatBounds by which pan and zoom operations on the map are constrained.
     *
     * @returns {LngLatBounds | null} The maximum bounds the map is constrained to, or `null` if none set.
     */
    getMaxBounds () {
        if (this.transform.latRange && this.transform.latRange.length === 2 &&
            this.transform.lngRange && this.transform.lngRange.length === 2) {
            return new LngLatBounds([this.transform.lngRange[0], this.transform.latRange[0]],
                [this.transform.lngRange[1], this.transform.latRange[1]]);
        } else {
            return null;
        }
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
     * @param {LngLatBoundsLike | null | undefined} lnglatbounds The maximum bounds to set. If `null` or `undefined` is provided, the function removes the map's maximum bounds.
     * @returns {Map} `this`
     */
    setMaxBounds(lnglatbounds: LngLatBoundsLike) {
        if (lnglatbounds) {
            const b = LngLatBounds.convert(lnglatbounds);
            this.transform.lngRange = [b.getWest(), b.getEast()];
            this.transform.latRange = [b.getSouth(), b.getNorth()];
            this.transform._constrain();
            this._update();
        } else if (lnglatbounds === null || lnglatbounds === undefined) {
            this.transform.lngRange = null;
            this.transform.latRange = null;
            this._update();
        }
        return this;

    }

    /**
     * Sets or clears the map's minimum zoom level.
     * If the map's current zoom level is lower than the new minimum,
     * the map will zoom to the new minimum.
     *
     * @param {number | null | undefined} minZoom The minimum zoom level to set (0-20).
     *   If `null` or `undefined` is provided, the function removes the current minimum zoom (i.e. sets it to 0).
     * @returns {Map} `this`
     */
    setMinZoom(minZoom?: ?number) {

        minZoom = minZoom === null || minZoom === undefined ? defaultMinZoom : minZoom;

        if (minZoom >= defaultMinZoom && minZoom <= this.transform.maxZoom) {
            this.transform.minZoom = minZoom;
            this._update();

            if (this.getZoom() < minZoom) this.setZoom(minZoom);

            return this;

        } else throw new Error(`minZoom must be between ${defaultMinZoom} and the current maxZoom, inclusive`);
    }

    /**
     * Returns the map's minimum allowable zoom level.
     *
     * @returns {number} minZoom
     */
    getMinZoom() { return this.transform.minZoom; }

    /**
     * Sets or clears the map's maximum zoom level.
     * If the map's current zoom level is higher than the new maximum,
     * the map will zoom to the new maximum.
     *
     * @param {number | null | undefined} maxZoom The maximum zoom level to set.
     *   If `null` or `undefined` is provided, the function removes the current maximum zoom (sets it to 20).
     * @returns {Map} `this`
     */
    setMaxZoom(maxZoom?: ?number) {

        maxZoom = maxZoom === null || maxZoom === undefined ? defaultMaxZoom : maxZoom;

        if (maxZoom >= this.transform.minZoom) {
            this.transform.maxZoom = maxZoom;
            this._update();

            if (this.getZoom() > maxZoom) this.setZoom(maxZoom);

            return this;

        } else throw new Error(`maxZoom must be greater than the current minZoom`);
    }

    /**
     * Returns the map's maximum allowable zoom level.
     *
     * @returns {number} maxZoom
     */
    getMaxZoom() { return this.transform.maxZoom; }

    /**
     * Returns a {@link Point} representing pixel coordinates, relative to the map's `container`,
     * that correspond to the specified geographical location.
     *
     * @param {LngLatLike} lnglat The geographical location to project.
     * @returns {Point} The {@link Point} corresponding to `lnglat`, relative to the map's `container`.
     */
    project(lnglat: LngLatLike) {
        return this.transform.locationPoint(LngLat.convert(lnglat));
    }

    /**
     * Returns a {@link LngLat} representing geographical coordinates that correspond
     * to the specified pixel coordinates.
     *
     * @param {PointLike} point The pixel coordinates to unproject.
     * @returns {LngLat} The {@link LngLat} corresponding to `point`.
     * @see [Show polygon information on click](https://www.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/)
     */
    unproject(point: PointLike) {
        return this.transform.pointLocation(Point.convert(point));
    }

    /**
     * Adds a listener for events of a specified type.
     *
     * @method
     * @name on
     * @memberof Map
     * @instance
     * @param {string} type The event type to add a listen for.
     * @param {Function} listener The function to be called when the event is fired.
     *   The listener function is called with the data object passed to `fire`,
     *   extended with `target` and `type` properties.
     * @returns {Map} `this`
     */

    /**
     * Adds a listener for events of a specified type occurring on features in a specified style layer.
     *
     * @param {string} type The event type to listen for; one of `'mousedown'`, `'mouseup'`, `'click'`, `'dblclick'`,
     * `'mousemove'`, `'mouseenter'`, `'mouseleave'`, `'mouseover'`, `'mouseout'`, `'contextmenu'`, `'touchstart'`,
     * `'touchend'`, or `'touchcancel'`. `mouseenter` and `mouseover` events are triggered when the cursor enters
     * a visible portion of the specified layer from outside that layer or outside the map canvas. `mouseleave`
     * and `mouseout` events are triggered when the cursor leaves a visible portion of the specified layer, or leaves
     * the map canvas.
     * @param {string} layer The ID of a style layer. Only events whose location is within a visible
     * feature in this layer will trigger the listener. The event will have a `features` property containing
     * an array of the matching features.
     * @param {Function} listener The function to be called when the event is fired.
     * @returns {Map} `this`
     */
    on(type: MapEvent, layer: any, listener: any) {
        if (listener === undefined) {
            return super.on(type, layer);
        }

        const delegatedListener = (() => {
            if (type === 'mouseenter' || type === 'mouseover') {
                let mousein = false;
                const mousemove = (e) => {
                    const features = this.getLayer(layer) ? this.queryRenderedFeatures(e.point, {layers: [layer]}) : [];
                    if (!features.length) {
                        mousein = false;
                    } else if (!mousein) {
                        mousein = true;
                        listener.call(this, util.extend({features}, e, {type}));
                    }
                };
                const mouseout = () => {
                    mousein = false;
                };
                return {layer, listener, delegates: {mousemove, mouseout}};
            } else if (type === 'mouseleave' || type === 'mouseout') {
                let mousein = false;
                const mousemove = (e) => {
                    const features = this.getLayer(layer) ? this.queryRenderedFeatures(e.point, {layers: [layer]}) : [];
                    if (features.length) {
                        mousein = true;
                    } else if (mousein) {
                        mousein = false;
                        listener.call(this, util.extend({}, e, {type}));
                    }
                };
                const mouseout = (e) => {
                    if (mousein) {
                        mousein = false;
                        listener.call(this, util.extend({}, e, {type}));
                    }
                };
                return {layer, listener, delegates: {mousemove, mouseout}};
            } else {
                const delegate = (e) => {
                    const features = this.getLayer(layer) ? this.queryRenderedFeatures(e.point, {layers: [layer]}) : [];
                    if (features.length) {
                        listener.call(this, util.extend({features}, e));
                    }
                };
                return {layer, listener, delegates: {[type]: delegate}};
            }
        })();

        this._delegatedListeners = this._delegatedListeners || {};
        this._delegatedListeners[type] = this._delegatedListeners[type] || [];
        this._delegatedListeners[type].push(delegatedListener);

        for (const event in delegatedListener.delegates) {
            this.on((event: any), delegatedListener.delegates[event]);
        }

        return this;
    }

    /**
     * Removes an event listener previously added with `Map#on`.
     *
     * @method
     * @name off
     * @memberof Map
     * @instance
     * @param {string} type The event type previously used to install the listener.
     * @param {Function} listener The function previously installed as a listener.
     * @returns {Map} `this`
     */

    /**
     * Removes an event listener for layer-specific events previously added with `Map#on`.
     *
     * @param {string} type The event type previously used to install the listener.
     * @param {string} layer The layer ID previously used to install the listener.
     * @param {Function} listener The function previously installed as a listener.
     * @returns {Map} `this`
     */
    off(type: MapEvent, layer: any, listener: any) {
        if (listener === undefined) {
            return super.off(type, layer);
        }

        if (this._delegatedListeners && this._delegatedListeners[type]) {
            const listeners = this._delegatedListeners[type];
            for (let i = 0; i < listeners.length; i++) {
                const delegatedListener = listeners[i];
                if (delegatedListener.layer === layer && delegatedListener.listener === listener) {
                    for (const event in delegatedListener.delegates) {
                        this.off((event: any), delegatedListener.delegates[event]);
                    }
                    listeners.splice(i, 1);
                    return this;
                }
            }
        }

        return this;
    }

    /**
     * Returns an array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects)
     * representing visible features that satisfy the query parameters.
     *
     * @param {PointLike|Array<PointLike>} [geometry] - The geometry of the query region:
     * either a single point or southwest and northeast points describing a bounding box.
     * Omitting this parameter (i.e. calling {@link Map#queryRenderedFeatures} with zero arguments,
     * or with only a `parameters` argument) is equivalent to passing a bounding box encompassing the entire
     * map viewport.
     * @param {Object} [parameters]
     * @param {Array<string>} [parameters.layers] An array of style layer IDs for the query to inspect.
     *   Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.
     * @param {Array} [parameters.filter] A [filter](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter)
     *   to limit query results.
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [feature objects](http://geojson.org/geojson-spec.html#feature-objects).
     *
     * The `properties` value of each returned feature object contains the properties of its source feature. For GeoJSON sources, only
     * string and numeric property values are supported (i.e. `null`, `Array`, and `Object` values are not supported).
     *
     * Each feature includes a top-level `layer` property whose value is an object representing the style layer to
     * which the feature belongs. Layout and paint properties in this object contain values which are fully evaluated
     * for the given zoom level and feature.
     *
     * Features from layers whose `visibility` property is `"none"`, or from layers whose zoom range excludes the
     * current zoom level are not included. Symbol features that have been hidden due to text or icon collision are
     * not included. Features from all other layers are included, including features that may have no visible
     * contribution to the rendered result; for example, because the layer's opacity or color alpha component is set to
     * 0.
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
     * var features = map.queryRenderedFeatures(
     *   [20, 35],
     *   { layers: ['my-layer-name'] }
     * );
     *
     * @example
     * // Find all features within a static bounding box
     * var features = map.queryRenderedFeatures(
     *   [[10, 20], [30, 50]],
     *   { layers: ['my-layer-name'] }
     * );
     *
     * @example
     * // Find all features within a bounding box around a point
     * var width = 10;
     * var height = 20;
     * var features = map.queryRenderedFeatures([
     *   [point.x - width / 2, point.y - height / 2],
     *   [point.x + width / 2, point.y + height / 2]
     * ], { layers: ['my-layer-name'] });
     *
     * @example
     * // Query all rendered features from a single layer
     * var features = map.queryRenderedFeatures({ layers: ['my-layer-name'] });
     * @see [Get features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/)
     * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     */
    queryRenderedFeatures(...args: [PointLike | [PointLike, PointLike], Object] | [PointLike | [PointLike, PointLike]] | [Object]) {
        let params = {};
        let geometry;

        if (args.length === 2) {
            geometry = arguments[0];
            params = arguments[1];
        } else if (args.length === 1 && isPointLike(args[0])) {
            geometry = args[0];
        } else if (args.length === 1) {
            params = args[0];
        }

        if (!this.style) {
            return [];
        }

        return this.style.queryRenderedFeatures(
            this._makeQueryGeometry(geometry),
            params,
            this.transform.zoom,
            this.transform.angle
        );

        function isPointLike(input) {
            return input instanceof Point || Array.isArray(input);
        }
    }

    _makeQueryGeometry(pointOrBox?: PointLike | [PointLike, PointLike]) {
        if (pointOrBox === undefined) {
            // bounds was omitted: use full viewport
            pointOrBox = [
                Point.convert([0, 0]),
                Point.convert([this.transform.width, this.transform.height])
            ];
        }

        let queryGeometry;

        if (pointOrBox instanceof Point || typeof pointOrBox[0] === 'number') {
            const point = Point.convert(pointOrBox);
            queryGeometry = [point];
        } else {
            const box = [Point.convert(pointOrBox[0]), Point.convert(pointOrBox[1])];
            queryGeometry = [
                box[0],
                new Point(box[1].x, box[0].y),
                box[1],
                new Point(box[0].x, box[1].y),
                box[0]
            ];
        }

        queryGeometry = queryGeometry.map((p) => {
            return this.transform.pointCoordinate(p);
        });

        return queryGeometry;
    }

    /**
     * Returns an array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects)
     * representing features within the specified vector tile or GeoJSON source that satisfy the query parameters.
     *
     * @param {string} sourceID The ID of the vector tile or GeoJSON source to query.
     * @param {Object} [parameters]
     * @param {string} [parameters.sourceLayer] The name of the vector tile layer to query. *For vector tile
     *   sources, this parameter is required.* For GeoJSON sources, it is ignored.
     * @param {Array} [parameters.filter] A [filter](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter)
     *   to limit query results.
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects).
     *
     * In contrast to {@link Map#queryRenderedFeatures}, this function
     * returns all features matching the query parameters,
     * whether or not they are rendered by the current style (i.e. visible). The domain of the query includes all currently-loaded
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
     * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     * @see [Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
     */
    querySourceFeatures(sourceID: string, parameters: ?{sourceLayer: ?string, filter: ?Array<any>}) {
        return this.style.querySourceFeatures(sourceID, parameters);
    }

    /**
     * Updates the map's Mapbox style object with a new value.  If the given
     * value is style JSON object, compares it against the the map's current
     * state and perform only the changes necessary to make the map style match
     * the desired state.
     *
     * @param style A JSON object conforming to the schema described in the
     *   [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to such JSON.
     * @param {Object} [options]
     * @param {boolean} [options.diff=true] If false, force a 'full' update, removing the current style
     *   and adding building the given one instead of attempting a diff-based update.
     * @param {string} [options.localIdeographFontFamily=null] If non-null, defines a css font-family
     *   for locally overriding generation of glyphs in the 'CJK Unified Ideographs' and 'Hangul Syllables'
     *   ranges. Forces a full update.
     * @returns {Map} `this`
     * @see [Change a map's style](https://www.mapbox.com/mapbox-gl-js/example/setstyle/)
     */
    setStyle(style: StyleSpecification | string | null, options?: {diff?: boolean} & StyleOptions) {
        const shouldTryDiff = (!options || (options.diff !== false && !options.localIdeographFontFamily)) && this.style;
        if (shouldTryDiff && style && typeof style === 'object') {
            try {
                if (this.style.setState(style)) {
                    this._update(true);
                }
                return this;
            } catch (e) {
                util.warnOnce(`Unable to perform style diff: ${e.message || e.error || e}.  Rebuilding the style from scratch.`);
            }
        }

        if (this.style) {
            this.style.setEventedParent(null);
            this.style._remove();
            this.off('rotate', this.style._redoPlacement);
            this.off('pitch', this.style._redoPlacement);
            this.off('move', this.style._redoPlacement);
        }

        if (!style) {
            delete this.style;
            return this;
        } else {
            this.style = new Style(this, options || {});
        }

        this.style.setEventedParent(this, {style: this.style});

        if (typeof style === 'string') {
            this.style.loadURL(style);
        } else {
            this.style.loadJSON(style);
        }

        this.on('rotate', this.style._redoPlacement);
        this.on('pitch', this.style._redoPlacement);
        this.on('move', this.style._redoPlacement);

        return this;
    }

    /**
     * Returns the map's Mapbox style object, which can be used to recreate the map's style.
     *
     * @returns {Object} The map's style object.
     */
    getStyle() {
        if (this.style) {
            return this.style.serialize();
        }
    }

    /**
     * Returns a Boolean indicating whether the map's style is fully loaded.
     *
     * @returns {boolean} A Boolean indicating whether the style is fully loaded.
     */
    isStyleLoaded() {
        if (!this.style) return util.warnOnce('There is no style added to the map.');
        return this.style.loaded();
    }

    /**
     * Adds a source to the map's style.
     *
     * @param {string} id The ID of the source to add. Must not conflict with existing sources.
     * @param {Object} source The source object, conforming to the
     * Mapbox Style Specification's [source definition](https://www.mapbox.com/mapbox-gl-style-spec/#sources).
     * @param {string} source.type The source type, which must be either one of the core Mapbox GL source types defined in the style specification or a custom type that has been added to the map with {@link Map#addSourceType}.
     * @fires source.add
     * @returns {Map} `this`
     * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
     * @see [Style circles using data-driven styling](https://www.mapbox.com/mapbox-gl-js/example/data-driven-circle-colors/)
     * @see [Set a point after Geocoder result](https://www.mapbox.com/mapbox-gl-js/example/point-from-geocoder-result/)
     */
    addSource(id: string, source: SourceSpecification) {
        this.style.addSource(id, source);
        this._update(true);
        return this;
    }

    /**
     * Returns a Boolean indicating whether the source is loaded.
     *
     * @param {string} id The ID of the source to be checked.
     * @returns {boolean} A Boolean indicating whether the source is loaded.
     */
    isSourceLoaded(id: string) {
        const source = this.style && this.style.sourceCaches[id];
        if (source === undefined) {
            this.fire('error', {
                error: new Error(`There is no source with ID '${id}'`)
            });
            return;
        }
        return source.loaded();
    }

    /**
     * Returns a Boolean indicating whether all tiles in the viewport from all sources on
     * the style are loaded.
     *
     * @returns {boolean} A Boolean indicating whether all tiles are loaded.
     */

    areTilesLoaded() {
        const sources = this.style && this.style.sourceCaches;
        for (const id in sources) {
            const source = sources[id];
            const tiles = source._tiles;
            for (const t in tiles) {
                const tile = tiles[t];
                if (!(tile.state === 'loaded' || tile.state === 'errored')) return false;
            }
        }
        return true;
    }

    /**
     * Adds a [custom source type](#Custom Sources), making it available for use with
     * {@link Map#addSource}.
     * @private
     * @param {string} name The name of the source type; source definition objects use this name in the `{type: ...}` field.
     * @param {Function} SourceType A {@link Source} constructor.
     * @param {Function} callback Called when the source type is ready or with an error argument if there is an error.
     */
    addSourceType(name: string, SourceType: any, callback: Function) {
        return this.style.addSourceType(name, SourceType, callback);
    }

    /**
     * Removes a source from the map's style.
     *
     * @param {string} id The ID of the source to remove.
     * @returns {Map} `this`
     */
    removeSource(id: string) {
        this.style.removeSource(id);
        this._update(true);
        return this;
    }

    /**
     * Returns the source with the specified ID in the map's style.
     *
     * @param {string} id The ID of the source to get.
     * @returns {?Object} The style source with the specified ID, or `undefined`
     *   if the ID corresponds to no existing sources.
     * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Animate a point](https://www.mapbox.com/mapbox-gl-js/example/animate-point-along-line/)
     * @see [Add live realtime data](https://www.mapbox.com/mapbox-gl-js/example/live-geojson/)
     */
    getSource(id: string) {
        return this.style.getSource(id);
    }

    /**
     * Add an image to the style. This image can be used in `icon-image`,
     * `background-pattern`, `fill-pattern`, and `line-pattern`. An
     * {@link Map#error} event will be fired if there is not enough space in the
     * sprite to add this image.
     *
     * @see [Add an icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image/)
     * @see [Add a generated icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image-generated/)
     * @param id The ID of the image.
     * @param data The image as an `HTMLImageElement`, `ImageData`, or object with `width`, `height`, and `data`
     * properties with the same format as `ImageData`.
     * @param options
     * @param options.pixelRatio The ratio of pixels in the image to physical pixels on the screen
     * @param options.sdf Whether the image should be interpreted as an SDF image
     */
    addImage(id: string, data: HTMLImageElement | ImageData | {width: number, height: number, data: Uint8Array | Uint8ClampedArray},
             {pixelRatio = 1, sdf = false}: {pixelRatio?: number, sdf?: boolean} = {}) {
        if (data instanceof HTMLImageElement) {
            data = browser.getImageData(data);
        } else if (data.width === undefined || data.height === undefined) {
            return this.fire('error', {error: new Error(
                'Invalid arguments to map.addImage(). The second argument must be an `HTMLImageElement`, `ImageData`, ' +
                'or object with `width`, `height`, and `data` properties with the same format as `ImageData`')});
        }
        this.style.addImage(id, { data: ((data: any): RGBAImage), pixelRatio, sdf });
    }

    /**
     * Remove an image from the style (such as one used by `icon-image` or `background-pattern`).
     *
     * @param id The ID of the image.
     */
    removeImage(id: string) {
        this.style.removeImage(id);
    }

    /**
     * Load an image from an external URL for use with `Map#addImage`. External
     * domains must support [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).
     *
     * @param {string} url The URL of the image file. Image file must be in png, webp, or jpg format.
     * @param {Function} callback Expecting `callback(error, data)`. Called when the image has loaded or with an error argument if there is an error.
     * @see [Add an icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image/)
     */
    loadImage(url: string, callback: Function) {
        ajax.getImage(this._transformRequest(url, ajax.ResourceType.Image), callback);
    }

    /**
     * Adds a [Mapbox style layer](https://www.mapbox.com/mapbox-gl-style-spec/#layers)
     * to the map's style.
     *
     * A layer defines styling for data from a specified source.
     *
     * @param {Object} layer The style layer to add, conforming to the Mapbox Style Specification's
     *   [layer definition](https://www.mapbox.com/mapbox-gl-style-spec/#layers).
     * @param {string} [before] The ID of an existing layer to insert the new layer before.
     *   If this argument is omitted, the layer will be appended to the end of the layers array.
     * @returns {Map} `this`
     * @see [Create and style clusters](https://www.mapbox.com/mapbox-gl-js/example/cluster/)
     * @see [Add a vector tile source](https://www.mapbox.com/mapbox-gl-js/example/vector-source/)
     * @see [Add a WMS source](https://www.mapbox.com/mapbox-gl-js/example/wms/)
     */
    addLayer(layer: LayerSpecification, before?: string) {
        this.style.addLayer(layer, before);
        this._update(true);
        return this;
    }

    /**
     * Moves a layer to a different z-position.
     *
     * @param {string} id The ID of the layer to move.
     * @param {string} [beforeId] The ID of an existing layer to insert the new layer before.
     *   If this argument is omitted, the layer will be appended to the end of the layers array.
     * @returns {Map} `this`
     */
    moveLayer(id: string, beforeId?: string) {
        this.style.moveLayer(id, beforeId);
        this._update(true);
        return this;
    }

    /**
     * Removes the layer with the given id from the map's style.
     *
     * If no such layer exists, an `error` event is fired.
     *
     * @param {string} id id of the layer to remove
     * @fires error
     */
    removeLayer(id: string) {
        this.style.removeLayer(id);
        this._update(true);
        return this;
    }

    /**
     * Returns the layer with the specified ID in the map's style.
     *
     * @param {string} id The ID of the layer to get.
     * @returns {?Object} The layer with the specified ID, or `undefined`
     *   if the ID corresponds to no existing layers.
     * @see [Filter symbols by toggling a list](https://www.mapbox.com/mapbox-gl-js/example/filter-markers/)
     * @see [Filter symbols by text input](https://www.mapbox.com/mapbox-gl-js/example/filter-markers-by-input/)
     */
    getLayer(id: string) {
        return this.style.getLayer(id);
    }

    /**
     * Sets the filter for the specified style layer.
     *
     * @param {string} layer The ID of the layer to which the filter will be applied.
     * @param {Array | null | undefined} filter The filter, conforming to the Mapbox Style Specification's
     *   [filter definition](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter).  If `null` or `undefined` is provided, the function removes any existing filter from the layer.
     * @returns {Map} `this`
     * @example
     * map.setFilter('my-layer', ['==', 'name', 'USA']);
     * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     * @see [Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
     * @see [Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
     */
    setFilter(layer: string, filter: FilterSpecification) {
        this.style.setFilter(layer, filter);
        this._update(true);
        return this;
    }

    /**
     * Sets the zoom extent for the specified style layer.
     *
     * @param {string} layerId The ID of the layer to which the zoom extent will be applied.
     * @param {number} minzoom The minimum zoom to set (0-20).
     * @param {number} maxzoom The maximum zoom to set (0-20).
     * @returns {Map} `this`
     * @example
     * map.setLayerZoomRange('my-layer', 2, 5);
     */
    setLayerZoomRange(layerId: string, minzoom: number, maxzoom: number) {
        this.style.setLayerZoomRange(layerId, minzoom, maxzoom);
        this._update(true);
        return this;
    }

    /**
     * Returns the filter applied to the specified style layer.
     *
     * @param {string} layer The ID of the style layer whose filter to get.
     * @returns {Array} The layer's filter.
     */
    getFilter(layer: string) {
        return this.style.getFilter(layer);
    }

    /**
     * Sets the value of a paint property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to set the paint property in.
     * @param {string} name The name of the paint property to set.
     * @param {*} value The value of the paint propery to set.
     *   Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @returns {Map} `this`
     * @example
     * map.setPaintProperty('my-layer', 'fill-color', '#faafee');
     * @see [Change a layer's color with buttons](https://www.mapbox.com/mapbox-gl-js/example/color-switcher/)
     * @see [Adjust a layer's opacity](https://www.mapbox.com/mapbox-gl-js/example/adjust-layer-opacity/)
     * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    setPaintProperty(layer: string, name: string, value: any) {
        this.style.setPaintProperty(layer, name, value);
        this._update(true);
        return this;
    }

    /**
     * Returns the value of a paint property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to get the paint property from.
     * @param {string} name The name of a paint property to get.
     * @returns {*} The value of the specified paint property.
     */
    getPaintProperty(layer: string, name: string) {
        return this.style.getPaintProperty(layer, name);
    }

    /**
     * Sets the value of a layout property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to set the layout property in.
     * @param {string} name The name of the layout property to set.
     * @param {*} value The value of the layout propery. Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @returns {Map} `this`
     * @example
     * map.setLayoutProperty('my-layer', 'visibility', 'none');
     */
    setLayoutProperty(layer: string, name: string, value: any) {
        this.style.setLayoutProperty(layer, name, value);
        this._update(true);
        return this;
    }

    /**
     * Returns the value of a layout property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to get the layout property from.
     * @param {string} name The name of the layout property to get.
     * @returns {*} The value of the specified layout property.
     */
    getLayoutProperty(layer: string, name: string) {
        return this.style.getLayoutProperty(layer, name);
    }

    /**
     * Sets the any combination of light values.
     *
     * @param light Light properties to set. Must conform to the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @returns {Map} `this`
     */
    setLight(light: LightSpecification) {
        this.style.setLight(light);
        this._update(true);
        return this;
    }

    /**
     * Returns the value of the light object.
     *
     * @returns {Object} light Light properties of the style.
     */
    getLight() {
        return this.style.getLight();
    }

    /**
     * Returns the map's containing HTML element.
     *
     * @returns {HTMLElement} The map's container.
     */
    getContainer() {
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
     * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
     */
    getCanvasContainer() {
        return this._canvasContainer;
    }

    /**
     * Returns the map's `<canvas>` element.
     *
     * @returns {HTMLCanvasElement} The map's `<canvas>` element.
     * @see [Measure distances](https://www.mapbox.com/mapbox-gl-js/example/measure/)
     * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
     */
    getCanvas() {
        return this._canvas;
    }

    _containerDimensions() {
        let width = 0;
        let height = 0;

        if (this._container) {
            width = this._container.offsetWidth || 400;
            height = this._container.offsetHeight || 300;
        }

        return [width, height];
    }

    _setupContainer() {
        const container = this._container;
        container.classList.add('mapboxgl-map');

        const missingCSSContainer = this._missingCSSContainer = DOM.create('div', 'mapboxgl-missing-css', container);
        missingCSSContainer.innerHTML = 'Missing Mapbox GL JS CSS';

        const canvasContainer = this._canvasContainer = DOM.create('div', 'mapboxgl-canvas-container', container);
        if (this._interactive) {
            canvasContainer.classList.add('mapboxgl-interactive');
        }

        this._canvas = DOM.create('canvas', 'mapboxgl-canvas', canvasContainer);
        this._canvas.style.position = 'absolute';
        this._canvas.addEventListener('webglcontextlost', this._contextLost, false);
        this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false);
        this._canvas.setAttribute('tabindex', '0');
        this._canvas.setAttribute('aria-label', 'Map');

        const dimensions = this._containerDimensions();
        this._resizeCanvas(dimensions[0], dimensions[1]);

        const controlContainer = this._controlContainer = DOM.create('div', 'mapboxgl-control-container', container);
        const positions = this._controlPositions = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((positionName) => {
            positions[positionName] = DOM.create('div', `mapboxgl-ctrl-${positionName}`, controlContainer);
        });
    }

    _resizeCanvas(width: number, height: number) {
        const pixelRatio = window.devicePixelRatio || 1;

        // Request the required canvas size taking the pixelratio into account.
        this._canvas.width = pixelRatio * width;
        this._canvas.height = pixelRatio * height;

        // Maintain the same canvas size, potentially downscaling it for HiDPI displays
        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    }

    _setupPainter() {
        const attributes = util.extend({
            failIfMajorPerformanceCaveat: this._failIfMajorPerformanceCaveat,
            preserveDrawingBuffer: this._preserveDrawingBuffer
        }, isSupported.webGLContextAttributes);

        const gl = this._canvas.getContext('webgl', attributes) ||
            this._canvas.getContext('experimental-webgl', attributes);

        if (!gl) {
            this.fire('error', { error: new Error('Failed to initialize WebGL') });
            return;
        }

        this.painter = new Painter(gl, this.transform);
    }

    _contextLost(event: Event) {
        event.preventDefault();
        if (this._frameId) {
            browser.cancelFrame(this._frameId);
            this._frameId = null;
        }
        this.fire('webglcontextlost', {originalEvent: event});
    }

    _contextRestored(event: Event) {
        this._setupPainter();
        this.resize();
        this._update();
        this.fire('webglcontextrestored', {originalEvent: event});
    }

    /**
     * Returns a Boolean indicating whether the map is fully loaded.
     *
     * Returns `false` if the style is not yet fully loaded,
     * or if there has been a change to the sources or style that
     * has not yet fully loaded.
     *
     * @returns {boolean} A Boolean indicating whether the map is fully loaded.
     */
    loaded() {
        if (this._styleDirty || this._sourcesDirty)
            return false;
        if (!this.style || !this.style.loaded())
            return false;
        return true;
    }

    /**
     * Update this map's style and sources, and re-render the map.
     *
     * @param {boolean} updateStyle mark the map's style for reprocessing as
     * well as its sources
     * @returns {Map} this
     * @private
     */
    _update(updateStyle?: boolean) {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;

        this._rerender();

        return this;
    }

    /**
     * Call when a (re-)render of the map is required:
     * - The style has changed (`setPaintProperty()`, etc.)
     * - Source data has changed (e.g. tiles have finished loading)
     * - The map has is moving (or just finished moving)
     * - A transition is in progress
     *
     * @returns {Map} this
     * @private
     */
    _render() {
        // If the style has changed, the map is being zoomed, or a transition
        // is in progress:
        //  - Apply style changes (in a batch)
        //  - Recalculate zoom-dependent paint properties.
        if (this.style && this._styleDirty) {
            this._styleDirty = false;
            this.style.update();
            this.style._recalculate(this.transform.zoom);
        }

        // If we are in _render for any reason other than an in-progress paint
        // transition, update source caches to check for and load any tiles we
        // need for the current transform
        if (this.style && this._sourcesDirty) {
            this._sourcesDirty = false;
            this.style._updateSources(this.transform);
        }

        // Actually draw
        this.painter.render(this.style, {
            showTileBoundaries: this.showTileBoundaries,
            showOverdrawInspector: this._showOverdrawInspector,
            rotating: this.rotating,
            zooming: this.zooming
        });

        this.fire('render');

        if (this.loaded() && !this._loaded) {
            this._loaded = true;
            this.fire('load');
        }

        this._frameId = null;

        // Flag an ongoing transition
        if (!this.animationLoop.stopped()) {
            this._styleDirty = true;
        }

        // Schedule another render frame if it's needed.
        //
        // Even though `_styleDirty` and `_sourcesDirty` are reset in this
        // method, synchronous events fired during Style#update or
        // Style#_updateSources could have caused them to be set again.
        if (this._sourcesDirty || this._repaint || this._styleDirty) {
            this._rerender();
        }

        return this;
    }

    /**
     * Clean up and release all internal resources associated with this map.
     *
     * This includes DOM elements, event bindings, web workers, and WebGL resources.
     *
     * Use this method when you are done using the map and wish to ensure that it no
     * longer consumes browser resources. Afterwards, you must not call any other
     * methods on the map.
     */
    remove() {
        if (this._hash) this._hash.remove();
        browser.cancelFrame(this._frameId);
        this._frameId = null;
        this.setStyle(null);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onWindowResize, false);
            window.removeEventListener('online', this._onWindowOnline, false);
        }
        const extension = this.painter.gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
        removeNode(this._canvasContainer);
        removeNode(this._controlContainer);
        removeNode(this._missingCSSContainer);
        this._container.classList.remove('mapboxgl-map');
        this.fire('remove');
    }

    _rerender() {
        if (this.style && !this._frameId) {
            this._frameId = browser.frame(this._render);
        }
    }

    _onWindowOnline() {
        this._update();
    }

    _onWindowResize() {
        if (this._trackResize) {
            this.stop().resize()._update();
        }
    }

    /**
     * Gets and sets a Boolean indicating whether the map will render an outline
     * around each tile. These tile boundaries are useful for debugging.
     *
     * @name showTileBoundaries
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get showTileBoundaries(): boolean { return !!this._showTileBoundaries; }
    set showTileBoundaries(value: boolean) {
        if (this._showTileBoundaries === value) return;
        this._showTileBoundaries = value;
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
        this.style._redoPlacement();
    }

    /*
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
        this._update();
    }

    /**
     * Gets and sets a Boolean indicating whether the map will
     * continuously repaint. This information is useful for analyzing performance.
     *
     * @name repaint
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    get repaint(): boolean { return !!this._repaint; }
    set repaint(value: boolean) { this._repaint = value; this._update(); }

    // show vertices
    get vertices(): boolean { return !!this._vertices; }
    set vertices(value: boolean) { this._vertices = value; this._update(); }

    _onData(event: MapDataEvent) {
        this._update(event.dataType === 'style');
        this.fire(`${event.dataType}data`, event);
    }

    _onDataLoading(event: MapDataEvent) {
        this.fire(`${event.dataType}dataloading`, event);
    }
}

module.exports = Map;

function removeNode(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}

/**
 * Interface for interactive controls added to the map. This is an
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
 *      this._container.parentNode.removeChild(this._container);
 *      this._map = undefined;
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
 * @param {Map} map the Map this control will be added to
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
 * @param {Map} map the Map this control will be removed from
 * @returns {undefined} there is no required return value for this method
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
 * @returns {string} a control position, one of the values valid in addControl.
 */

/**
 * A [`Point` geometry](https://github.com/mapbox/point-geometry) object, which has
 * `x` and `y` properties representing screen coordinates in pixels.
 *
 * @typedef {Object} Point
 */

/**
 * A {@link Point} or an array of two numbers representing `x` and `y` screen coordinates in pixels.
 *
 * @typedef {(Point | Array<number>)} PointLike
 */
