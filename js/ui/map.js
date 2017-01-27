'use strict';

const util = require('../util/util');
const browser = require('../util/browser');
const window = require('../util/window');
const DOM = require('../util/dom');

const Style = require('../style/style');
const AnimationLoop = require('../style/animation_loop');
const Painter = require('../render/painter');

const Transform = require('../geo/transform');
const Hash = require('./hash');

const bindHandlers = require('./bind_handlers');

const Camera = require('./camera');
const LngLat = require('../geo/lng_lat');
const LngLatBounds = require('../geo/lng_lat_bounds');
const Point = require('point-geometry');
const AttributionControl = require('./control/attribution_control');
const isSupported = require('mapbox-gl-supported');

const defaultMinZoom = 0;
const defaultMaxZoom = 20;
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

    renderWorldCopies: true
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
 * @param {HTMLElement|string} options.container The HTML element in which Mapbox GL JS will render the map, or the element's string `id`.
 * @param {number} [options.minZoom=0] The minimum zoom level of the map (1-20).
 * @param {number} [options.maxZoom=20] The maximum zoom level of the map (1-20).
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
 * @param {Array<string>} [options.classes] Mapbox style class names with which to initialize the map.
 *   Keep in mind that these classes are used for controlling a style layer's paint properties, so are *not* reflected
 *   in an HTML element's `class` attribute. To learn more about Mapbox style classes, read about
 *   [Layers](https://www.mapbox.com/mapbox-gl-style-spec/#layers) in the style specification.
 * @param {boolean} [options.attributionControl=true] If `true`, an [AttributionControl](#AttributionControl) will be added to the map.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the performance of Mapbox
 *   GL JS would be dramatically worse than expected (i.e. a software renderer would be used).
 * @param {boolean} [options.preserveDrawingBuffer=false] If `true`, the map's canvas can be exported to a PNG using `map.getCanvas().toDataURL()`. This is `false` by default as a performance optimization.
 * @param {LngLatBoundsLike} [options.maxBounds] If set, the map will be constrained to the given bounds.
 * @param {boolean|Object} [options.scrollZoom=true] If `true`, the "scroll to zoom" interaction is enabled. An `Object` value is passed as options to [`ScrollZoomHandler#enable`](#ScrollZoomHandler#enable).
 * @param {boolean} [options.boxZoom=true] If `true`, the "box zoom" interaction is enabled (see [`BoxZoomHandler`](#BoxZoomHandler)).
 * @param {boolean} [options.dragRotate=true] If `true`, the "drag to rotate" interaction is enabled (see [`DragRotateHandler`](#DragRotateHandler)).
 * @param {boolean} [options.dragPan=true] If `true`, the "drag to pan" interaction is enabled (see [`DragPanHandler`](#DragPanHandler)).
 * @param {boolean} [options.keyboard=true] If `true`, keyboard shortcuts are enabled (see [`KeyboardHandler`](#KeyboardHandler)).
 * @param {boolean} [options.doubleClickZoom=true] If `true`, the "double click to zoom" interaction is enabled (see [`DoubleClickZoomHandler`](#DoubleClickZoomHandler)).
 * @param {boolean|Object} [options.touchZoomRotate=true] If `true`, the "pinch to rotate and zoom" interaction is enabled. An `Object` value is passed as options to [`TouchZoomRotateHandler#enable`](#TouchZoomRotateHandler#enable).
 * @param {boolean} [options.trackResize=true]  If `true`, the map will automatically resize when the browser window resizes.
 * @param {LngLatLike} [options.center=[0, 0]] The inital geographical centerpoint of the map. If `center` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]`.
 * @param {number} [options.zoom=0] The initial zoom level of the map. If `zoom` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.bearing=0] The initial bearing (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.pitch=0] The initial pitch (tilt) of the map, measured in degrees away from the plane of the screen (0-60). If `pitch` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {boolean} [options.renderWorldCopies=true]  If `true`, multiple copies of the world will be rendered, when zoomed out.
 * @example
 * var map = new mapboxgl.Map({
 *   container: 'map',
 *   center: [-122.420679, 37.772537],
 *   zoom: 13,
 *   style: style_object,
 *   hash: true
 * });
 * @see [Display a map](https://www.mapbox.com/mapbox-gl-js/examples/)
 */
class Map extends Camera {

    constructor(options) {
        options = util.extend({}, defaultOptions, options);

        const transform = new Transform(options.minZoom, options.maxZoom, options.renderWorldCopies);
        super(transform, options);

        this._interactive = options.interactive;
        this._failIfMajorPerformanceCaveat = options.failIfMajorPerformanceCaveat;
        this._preserveDrawingBuffer = options.preserveDrawingBuffer;
        this._trackResize = options.trackResize;
        this._bearingSnap = options.bearingSnap;

        if (typeof options.container === 'string') {
            this._container = window.document.getElementById(options.container);
            if (!this._container) throw new Error(`Container '${options.container}' not found.`);
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

        this._classes = [];

        this.resize();

        if (options.classes) this.setClasses(options.classes);
        if (options.style) this.setStyle(options.style);

        if (options.attributionControl) this.addControl(new AttributionControl());

        this.on('style.load', function() {
            if (this.transform.unmodified) {
                this.jumpTo(this.style.stylesheet);
            }
            this.style.update(this._classes, {transition: false});
        });

        this.on('data', this._onData);
        this.on('dataloading', this._onDataLoading);
    }

    /**
     * Adds a [`IControl`](#IControl) to the map, calling `control.onAdd(this)`.
     *
     * @param {IControl} control The [`IControl`](#IControl) to add.
     * @param {string} [position] position on the map to which the control will be added.
     * Valid values are `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. Defaults to `'top-right'`.
     * @returns {Map} `this`
     * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
     */
    addControl(control, position) {
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
     * @param {IControl} control The [`IControl`](#IControl) to remove.
     * @returns {Map} `this`
     */
    removeControl(control) {
        control.onRemove(this);
        return this;
    }

    /**
     * Adds a Mapbox style class to the map.
     *
     * Keep in mind that these classes are used for controlling a style layer's paint properties, so are *not* reflected
     * in an HTML element's `class` attribute. To learn more about Mapbox style classes, read about
     * [Layers](https://www.mapbox.com/mapbox-gl-style-spec/#layers) in the style specification.
     *
     * **Note:** Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.
     *
     * @param {string} klass The style class to add.
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    addClass(klass, options) {
        util.warnOnce('Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.');
        if (this._classes.indexOf(klass) >= 0 || klass === '') return this;
        this._classes.push(klass);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    }

    /**
     * Removes a Mapbox style class from the map.
     *
     * **Note:** Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.
     *
     * @param {string} klass The style class to remove.
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    removeClass(klass, options) {
        util.warnOnce('Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.');
        const i = this._classes.indexOf(klass);
        if (i < 0 || klass === '') return this;
        this._classes.splice(i, 1);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    }

    /**
     * Replaces the map's existing Mapbox style classes with a new array of classes.
     *
     * **Note:** Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.
     *
     * @param {Array<string>} klasses The style classes to set.
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    setClasses(klasses, options) {
        util.warnOnce('Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.');
        const uniqueClasses = {};
        for (let i = 0; i < klasses.length; i++) {
            if (klasses[i] !== '') uniqueClasses[klasses[i]] = true;
        }
        this._classes = Object.keys(uniqueClasses);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    }

    /**
     * Returns a Boolean indicating whether the map has the
     * specified Mapbox style class.
     *
     * **Note:** Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.
     *
     * @param {string} klass The style class to test.
     * @returns {boolean} `true` if the map has the specified style class.
     */
    hasClass(klass) {
        util.warnOnce('Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.');
        return this._classes.indexOf(klass) >= 0;
    }

    /**
     * Returns the map's Mapbox style classes.
     *
     * **Note:** Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.
     *
     * @returns {Array<string>} The map's style classes.
     */
    getClasses() {
        util.warnOnce('Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.');
        return this._classes;
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

        const gl = this.painter.gl;
        const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) / 2;
        if (this._canvas.width > maxSize || this._canvas.height > maxSize) {
            util.warnOnce(
                `Map is larger than maximum size supported by this system ` +
                `(${maxSize}px by ${maxSize}px).`
            );
        }

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
    setMaxBounds (lnglatbounds) {
        if (lnglatbounds) {
            const b = LngLatBounds.convert(lnglatbounds);
            this.transform.lngRange = [b.getWest(), b.getEast()];
            this.transform.latRange = [b.getSouth(), b.getNorth()];
            this.transform._constrain();
            this._update();
        } else if (lnglatbounds === null || lnglatbounds === undefined) {
            this.transform.lngRange = [];
            this.transform.latRange = [];
            this._update();
        }
        return this;

    }
    /**
     * Sets or clears the map's minimum zoom level.
     * If the map's current zoom level is lower than the new minimum,
     * the map will zoom to the new minimum.
     *
     * @param {?number} minZoom The minimum zoom level to set (0-20).
     *   If `null` or `undefined` is provided, the function removes the current minimum zoom (i.e. sets it to 0).
     * @returns {Map} `this`
     */
    setMinZoom(minZoom) {

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
     * @param {?number} maxZoom The maximum zoom level to set.
     *   If `null` or `undefined` is provided, the function removes the current maximum zoom (sets it to 20).
     * @returns {Map} `this`
     */
    setMaxZoom(maxZoom) {

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
     * Returns a [`Point`](#Point) representing pixel coordinates, relative to the map's `container`,
     * that correspond to the specified geographical location.
     *
     * @param {LngLatLike} lnglat The geographical location to project.
     * @returns {Point} The [`Point`](#Point) corresponding to `lnglat`, relative to the map's `container`.
     */
    project(lnglat) {
        return this.transform.locationPoint(LngLat.convert(lnglat));
    }

    /**
     * Returns a [`LngLat`](#LngLat) representing geographical coordinates that correspond
     * to the specified pixel coordinates.
     *
     * @param {PointLike} point The pixel coordinates to unproject.
     * @returns {LngLat} The [`LngLat`](#LngLat) corresponding to `point`.
     * @see [Show polygon information on click](https://www.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/)
     */
    unproject(point) {
        return this.transform.pointLocation(Point.convert(point));
    }

    /**
     * Returns an array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects)
     * representing visible features that satisfy the query parameters.
     *
     * @param {PointLike|Array<PointLike>} [geometry] - The geometry of the query region:
     * either a single point or southwest and northeast points describing a bounding box.
     * Omitting this parameter (i.e. calling [`Map#queryRenderedFeatures`](#Map#queryRenderedFeatures) with zero arguments,
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
    queryRenderedFeatures() {
        let params = {};
        let geometry;

        if (arguments.length === 2) {
            geometry = arguments[0];
            params = arguments[1];
        } else if (arguments.length === 1 && isPointLike(arguments[0])) {
            geometry = arguments[0];
        } else if (arguments.length === 1) {
            params = arguments[0];
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

    _makeQueryGeometry(pointOrBox) {
        if (pointOrBox === undefined) {
            // bounds was omitted: use full viewport
            pointOrBox = [
                Point.convert([0, 0]),
                Point.convert([this.transform.width, this.transform.height])
            ];
        }

        let queryGeometry;
        const isPoint = pointOrBox instanceof Point || typeof pointOrBox[0] === 'number';

        if (isPoint) {
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
     * In contrast to [`Map#queryRenderedFeatures`](#Map#queryRenderedFeatures), this function
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
    querySourceFeatures(sourceID, parameters) {
        return this.style.querySourceFeatures(sourceID, parameters);
    }

    /**
     * Updates the map's Mapbox style object with a new value.  If the given
     * value is style JSON object, compares it against the the map's current
     * state and perform only the changes necessary to make the map style match
     * the desired state.
     *
     * @param {Object|string} style A JSON object conforming to the schema described in the
     *   [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to such JSON.
     * @param {Object} [options]
     * @param {boolean} [options.diff=true] If false, force a 'full' update, removing the current style
     *   and adding building the given one instead of attempting a diff-based update.
     * @returns {Map} `this`
     * @see [Change a map's style](https://www.mapbox.com/mapbox-gl-js/example/setstyle/)
     */
    setStyle(style, options) {
        const shouldTryDiff = (!options || options.diff !== false) && this.style && style &&
            !(style instanceof Style) && typeof style !== 'string';
        if (shouldTryDiff) {
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
        }

        if (!style) {
            this.style = null;
            return this;
        } else if (style instanceof Style) {
            this.style = style;
        } else {
            this.style = new Style(style, this);
        }

        this.style.setEventedParent(this, {style: this.style});

        this.on('rotate', this.style._redoPlacement);
        this.on('pitch', this.style._redoPlacement);

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
    addSource(id, source) {
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
    isSourceLoaded(id) {
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
     * Adds a [custom source type](#Custom Sources), making it available for use with
     * {@link Map#addSource}.
     * @private
     * @param {string} name The name of the source type; source definition objects use this name in the `{type: ...}` field.
     * @param {Function} SourceType A {@link Source} constructor.
     * @param {Function} callback Called when the source type is ready or with an error argument if there is an error.
     */
    addSourceType(name, SourceType, callback) {
        return this.style.addSourceType(name, SourceType, callback);
    }

    /**
     * Removes a source from the map's style.
     *
     * @param {string} id The ID of the source to remove.
     * @returns {Map} `this`
     */
    removeSource(id) {
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
    getSource(id) {
        return this.style.getSource(id);
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
    addLayer(layer, before) {
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
    moveLayer(id, beforeId) {
        this.style.moveLayer(id, beforeId);
        this._update(true);
        return this;
    }

    /**
     * Removes a layer from the map's style.
     *
     * @param {string} id The ID of the layer to remove.
     * @throws {Error} if no layer with the specified `id` exists.
     * @returns {Map} `this`
     */
    removeLayer(id) {
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
    getLayer(id) {
        return this.style.getLayer(id);
    }

    /**
     * Sets the filter for the specified style layer.
     *
     * @param {string} layer The ID of the layer to which the filter will be applied.
     * @param {Array} filter The filter, conforming to the Mapbox Style Specification's
     *   [filter definition](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter).
     * @returns {Map} `this`
     * @example
     * map.setFilter('my-layer', ['==', 'name', 'USA']);
     * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
     * @see [Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
     * @see [Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
     */
    setFilter(layer, filter) {
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
    setLayerZoomRange(layerId, minzoom, maxzoom) {
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
    getFilter(layer) {
        return this.style.getFilter(layer);
    }

    /**
     * Sets the value of a paint property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to set the paint property in.
     * @param {string} name The name of the paint property to set.
     * @param {*} value The value of the paint propery to set.
     *   Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @param {string=} klass A style class specifier for the paint property.
     * @returns {Map} `this`
     * @example
     * map.setPaintProperty('my-layer', 'fill-color', '#faafee');
     * @see [Change a layer's color with buttons](https://www.mapbox.com/mapbox-gl-js/example/color-switcher/)
     * @see [Adjust a layer's opacity](https://www.mapbox.com/mapbox-gl-js/example/adjust-layer-opacity/)
     * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
     */
    setPaintProperty(layer, name, value, klass) {
        this.style.setPaintProperty(layer, name, value, klass);
        this._update(true);
        return this;
    }

    /**
     * Returns the value of a paint property in the specified style layer.
     *
     * @param {string} layer The ID of the layer to get the paint property from.
     * @param {string} name The name of a paint property to get.
     * @param {string=} klass A class specifier for the paint property.
     * @returns {*} The value of the specified paint property.
     */
    getPaintProperty(layer, name, klass) {
        return this.style.getPaintProperty(layer, name, klass);
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
    setLayoutProperty(layer, name, value) {
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
    getLayoutProperty(layer, name) {
        return this.style.getLayoutProperty(layer, name);
    }

    /**
     * Sets the any combination of light values.
     *
     * @param {Object} options Light properties to set. Must conform to the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
     * @returns {Map} `this`
     */
    setLight(lightOptions) {
        this.style.setLight(lightOptions);
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

        const canvasContainer = this._canvasContainer = DOM.create('div', 'mapboxgl-canvas-container', container);
        if (this._interactive) {
            canvasContainer.classList.add('mapboxgl-interactive');
        }

        this._canvas = DOM.create('canvas', 'mapboxgl-canvas', canvasContainer);
        this._canvas.style.position = 'absolute';
        this._canvas.addEventListener('webglcontextlost', this._contextLost, false);
        this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false);
        this._canvas.setAttribute('tabindex', 0);
        this._canvas.setAttribute('aria-label', 'Map');

        const dimensions = this._containerDimensions();
        this._resizeCanvas(dimensions[0], dimensions[1]);

        const controlContainer = this._controlContainer = DOM.create('div', 'mapboxgl-control-container', container);
        const positions = this._controlPositions = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((positionName) => {
            positions[positionName] = DOM.create('div', `mapboxgl-ctrl-${positionName}`, controlContainer);
        });
    }

    _resizeCanvas(width, height) {
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

    /**
     * Fired when the WebGL context is lost.
     *
     * @event webglcontextlost
     * @memberof Map
     * @instance
     * @type {Object}
     * @property {WebGLContextEvent} originalEvent The original DOM event.
     */
    _contextLost(event) {
        event.preventDefault();
        if (this._frameId) {
            browser.cancelFrame(this._frameId);
        }
        this.fire('webglcontextlost', {originalEvent: event});
    }

    /**
     * Fired when the WebGL context is restored.
     *
     * @event webglcontextrestored
     * @memberof Map
     * @instance
     * @type {Object}
     * @property {WebGLContextEvent} originalEvent The original DOM event.
     */
    _contextRestored(event) {
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
    _update(updateStyle) {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;

        this._rerender();

        return this;
    }

    /**
     * Call when a (re-)render of the map is required, e.g. when the
     * user panned or zoomed,f or new data is available.
     * @returns {Map} this
     * @private
     */
    _render() {
        if (this.style && this._styleDirty) {
            this._styleDirty = false;
            this.style.update(this._classes, this._classOptions);
            this._classOptions = null;
            this.style._recalculate(this.transform.zoom);
        }

        if (this.style && this._sourcesDirty) {
            this._sourcesDirty = false;
            this.style._updateSources(this.transform);
        }

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

        if (!this.animationLoop.stopped()) {
            this._styleDirty = true;
        }

        if (this._sourcesDirty || this._repaint || this._styleDirty) {
            this._rerender();
        }

        return this;
    }

    /**
     * Destroys the map's underlying resources, including web workers and DOM elements.
     *
     * After calling this method, you must not call any other methods on the map.
     */
    remove() {
        if (this._hash) this._hash.remove();
        browser.cancelFrame(this._frameId);
        this.setStyle(null);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onWindowResize, false);
        }
        const extension = this.painter.gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
        removeNode(this._canvasContainer);
        removeNode(this._controlContainer);
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
    get showTileBoundaries() { return !!this._showTileBoundaries; }
    set showTileBoundaries(value) {
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
    get showCollisionBoxes() { return !!this._showCollisionBoxes; }
    set showCollisionBoxes(value) {
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
    get showOverdrawInspector() { return !!this._showOverdrawInspector; }
    set showOverdrawInspector(value) {
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
    get repaint() { return !!this._repaint; }
    set repaint(value) { this._repaint = value; this._update(); }

    // show vertices
    get vertices() { return !!this._vertices; }
    set vertices(value) { this._vertices = value; this._update(); }

    _onData(event) {
        this._update(event.dataType === 'style');
        this.fire(`${event.dataType}data`, event);
    }

    _onDataLoading(event) {
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
 * HelloWorldControl.prototype.onRemove() {
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
 * A [`LngLat`](#LngLat) object or an array of two numbers representing longitude and latitude.
 *
 * @typedef {(LngLat | Array<number>)} LngLatLike
 * @example
 * var v1 = new mapboxgl.LngLat(-122.420679, 37.772537);
 * var v2 = [-122.420679, 37.772537];
 */

/**
 * A [`LngLatBounds`](#LngLatBounds) object or an array of [`LngLatLike`](#LngLatLike) objects.
 *
 * @typedef {(LngLatBounds | Array<LngLatLike>)} LngLatBoundsLike
 * @example
 * var v1 = new mapboxgl.LngLatBounds(
 *   new mapboxgl.LngLat(-73.9876, 40.7661),
 *   new mapboxgl.LngLat(-73.9397, 40.8002)
 * );
 * var v2 = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002])
 * var v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 */

/**
 * A [`Point` geometry](https://github.com/mapbox/point-geometry) object, which has
 * `x` and `y` properties representing screen coordinates in pixels.
 *
 * @typedef {Object} Point
 */

/**
 * A [`Point`](#Point) or an array of two numbers representing `x` and `y` screen coordinates in pixels.
 *
 * @typedef {(Point | Array<number>)} PointLike
 */

/**
 * Options common to {@link Map#addClass}, {@link Map#removeClass},
 * and {@link Map#setClasses}, controlling
 * whether or not to smoothly transition property changes triggered by a class change.
 *
 * @typedef {Object} StyleOptions
 * @property {boolean} transition If `true`, property changes will smootly transition.
 */

/**
 * Fired whenever the map is drawn to the screen, as the result of
 *
 * - a change to the map's position, zoom, pitch, or bearing
 * - a change to the map's style
 * - a change to a GeoJSON source
 * - the loading of a vector tile, GeoJSON file, glyph, or sprite
 *
 * @event render
 * @memberof Map
 * @instance
 */

/**
 * Fired when a point device (usually a mouse) leaves the map's canvas.
 *
 * @event mouseout
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 * @see [Highlight features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/hover-styles/)
 */

/**
 * Fired when a pointing device (usually a mouse) is pressed within the map.
 *
 * @event mousedown
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
 * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
 */

/**
 * Fired when a pointing device (usually a mouse) is released within the map.
 *
 * @event mouseup
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
 * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
 */

/**
 * Fired when a pointing device (usually a mouse) is moved within the map.
 *
 * @event mousemove
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 * @see [Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
 * @see [Highlight features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/hover-styles/)
 * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
 */

/**
 * Fired when a touch point is placed on the map.
 *
 * @event touchstart
 * @memberof Map
 * @instance
 * @property {MapTouchEvent} data
 */

/**
 * Fired when a touch point is removed from the map.
 *
 * @event touchend
 * @memberof Map
 * @instance
 * @property {MapTouchEvent} data
 */

/**
 * Fired when a touch point is moved within the map.
 *
 * @event touchmove
 * @memberof Map
 * @instance
 * @property {MapTouchEvent} data
 */

/**
 * Fired when a touch point has been disrupted.
 *
 * @event touchcancel
 * @memberof Map
 * @instance
 * @property {MapTouchEvent} data
 */

/**
 * Fired when a pointing device (usually a mouse) is pressed and released at the same point on the map.
 *
 * @event click
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 * @see [Measure distances](https://www.mapbox.com/mapbox-gl-js/example/measure/)
 * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
 */

/**
 * Fired when a pointing device (usually a mouse) is clicked twice at the same point on the map.
 *
 * @event dblclick
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 */

/**
 * Fired when the right button of the mouse is clicked or the context menu key is pressed within the map.
 *
 * @event contextmenu
 * @memberof Map
 * @instance
 * @property {MapMouseEvent} data
 */

/**
 * Fired immediately after all necessary resources have been downloaded
 * and the first visually complete rendering of the map has occurred.
 *
 * @event load
 * @memberof Map
 * @instance
 * @type {Object}
 * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
 * @see [Add live realtime data](https://www.mapbox.com/mapbox-gl-js/example/live-geojson/)
 * @see [Animate a point](https://www.mapbox.com/mapbox-gl-js/example/animate-point-along-line/)
 */

/**
 * Fired just before the map begins a transition from one
 * view to another, as the result of either user interaction or methods such as [Map#jumpTo](#Map#jumpTo).
 *
 * @event movestart
 * @memberof Map
 * @instance
 * @property {{originalEvent: DragEvent}} data
 */

/**
 * Fired repeatedly during an animated transition from one view to
 * another, as the result of either user interaction or methods such as [Map#flyTo](#Map#flyTo).
 *
 * @event move
 * @memberof Map
 * @instance
 * @property {MapMouseEvent | MapTouchEvent} data
 */

/**
 * Fired just after the map completes a transition from one
 * view to another, as the result of either user interaction or methods such as [Map#jumpTo](#Map#jumpTo).
 *
 * @event moveend
 * @memberof Map
 * @instance
 * @property {{originalEvent: DragEvent}} data
 * @see [Play map locations as a slideshow](https://www.mapbox.com/mapbox-gl-js/example/playback-locations/)
 * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
 */

 /**
  * Fired when an error occurs. This is GL JS's primary error reporting
  * mechanism. We use an event instead of `throw` to better accommodate
  * asyncronous operations. If no listeners are bound to the `error` event, the
  * error will be printed to the console.
  *
  * @event error
  * @memberof Map
  * @instance
  * @property {{error: {message: string}}} data
  */

/**
 * Fired when any map data loads or changes. See [`MapDataEvent`](#MapDataEvent)
 * for more information.
 *
 * @event data
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

/**
 * Fired when the map's style loads or changes. See
 * [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event styledata
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

/**
 * Fired when one of the map's sources loads or changes. This event is not fired
 * if a tile belonging to a source loads or changes (that is handled by
 * `tiledata`). See [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event sourcedata
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

 /**
  * Fired when one of the map's sources' tiles loads or changes. See
  * [`MapDataEvent`](#MapDataEvent) for more information.
  *
  * @event tiledata
  * @memberof Map
  * @instance
  * @property {MapDataEvent} data
  */

/**
 * Fired when any map data (style, source, tile, etc) begins loading or
 * changing asyncronously. All `dataloading` events are followed by a `data`
 * or `error` event. See [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event dataloading
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

/**
 * Fired when the map's style begins loading or changing asyncronously.
 * All `styledataloading` events are followed by a `styledata`
 * or `error` event. See [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event styledataloading
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

/**
 * Fired when one of the map's sources begins loading or changing asyncronously.
 * This event is not fired if a tile belonging to a source begins loading or
 * changing (that is handled by `tiledataloading`). All `sourcedataloading`
 * events are followed by a `sourcedata` or `error` event. See
 * [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event sourcedataloading
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

/**
 * Fired when one of the map's sources' tiles begins loading or changing
 * asyncronously. All `tiledataloading` events are followed by a `tiledata`
 * or `error` event. See [`MapDataEvent`](#MapDataEvent) for more information.
 *
 * @event tiledataloading
 * @memberof Map
 * @instance
 * @property {MapDataEvent} data
 */

 /**
  * A `MapDataEvent` object is emitted with the [`Map#data`](#Map.event:data)
  * and [`Map#dataloading`](#Map.event:dataloading) events. Possible values for
  * `dataType`s are:
  *
  * - `'source'`: The non-tile data associated with any source
  * - `'style'`: The [style](https://www.mapbox.com/mapbox-gl-style-spec/) used by the map
  * - `'tile'`: A vector or raster tile
  *
  * @typedef {Object} MapDataEvent
  * @property {string} type The event type.
  * @property {string} dataType The type of data that has changed. One of `'source'`, `'style'`.
  * @property {boolean} [isSourceLoaded] True if the event has a `dataType` of `source` and the source has no outstanding network requests.
  * @property {Object} [source] The [style spec representation of the source](https://www.mapbox.com/mapbox-gl-style-spec/#sources) if the event has a `dataType` of `source`.
  * @property {Coordinate} [coord] The coordinate of the tile if the event has a `dataType` of `tile`.
  */

 /**
 * Fired immediately after the map has been removed with [`Map#remove`](#Map#remove).
 *
 * @event remove
 * @memberof Map
 * @instance
 */

  /**
 * Fired immediately after the map has been resized.
 *
 * @event resize
 * @memberof Map
 * @instance
 */
