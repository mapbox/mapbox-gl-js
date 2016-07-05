'use strict';

var Canvas = require('../util/canvas');
var util = require('../util/util');
var browser = require('../util/browser');
var window = require('../util/browser').window;
var Evented = require('../util/evented');
var DOM = require('../util/dom');

var Style = require('../style/style');
var AnimationLoop = require('../style/animation_loop');
var Painter = require('../render/painter');

var Transform = require('../geo/transform');
var Hash = require('./hash');

var bindHandlers = require('./bind_handlers');

var Camera = require('./camera');
var LngLat = require('../geo/lng_lat');
var LngLatBounds = require('../geo/lng_lat_bounds');
var Point = require('point-geometry');
var Attribution = require('./control/attribution');

var defaultMinZoom = 0;
var defaultMaxZoom = 20;
var defaultOptions = {
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
    workerCount: Math.max(browser.hardwareConcurrency - 1, 1)
};

/**
 * Creates a map instance. This is usually the beginning of your map:
 * you tell Mapbox GL JS where to put the map by specifying a `container`
 * option, and the map's style with `style` and other attributes of the map,
 * and in return Mapbox GL JS initializes the map on your page and returns
 * a map variable that lets you programmatically call methods on the map.
 * @class Map
 * @param {Object} options
 * @param {string|Element} options.container HTML element to initialize the map in (or element id as string)
 * @param {number} [options.minZoom=0] Minimum zoom of the map
 * @param {number} [options.maxZoom=20] Maximum zoom of the map
 * @param {Object|string} [options.style] Map style. This must be an an object conforming to the schema described in
 * the [style reference](https://mapbox.com/mapbox-gl-style-spec/), or a URL to a JSON style. To load a style from the
 * Mapbox API, you can use a URL of the form `mapbox://styles/:owner/:style`, where `:owner` is your Mapbox account
 * name and `:style` is the style ID. Or you can use one of [the predefined Mapbox styles](https://www.mapbox.com/maps/).
 * The Style URLs of the predefined Mapbox styles are:
 *  * `mapbox://styles/mapbox/streets-v9`
 *  * `mapbox://styles/mapbox/outdoors-v9`
 *  * `mapbox://styles/mapbox/light-v9`
 *  * `mapbox://styles/mapbox/dark-v9`
 *  * `mapbox://styles/mapbox/satellite-v9`
 *  * `mapbox://styles/mapbox/satellite-streets-v9`
 * @param {boolean} [options.hash=false] If `true`, the map will track and update the page URL according to map position
 * @param {boolean} [options.interactive=true] If `false`, no mouse, touch, or keyboard listeners are attached to the map, so it will not respond to input
 * @param {number} [options.bearingSnap=7] Snap to north threshold in degrees.
 * @param {Array} [options.classes] Style class names with which to initialize the map
 * @param {boolean} [options.attributionControl=true] If `true`, an attribution control will be added to the map.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the implementation determines that the performance of the created WebGL context would be dramatically lower than expected.
 * @param {boolean} [options.preserveDrawingBuffer=false] If `true`, The maps canvas can be exported to a PNG using `map.getCanvas().toDataURL();`. This is false by default as a performance optimization. Firefox will not print the map unless this is true.
 * @param {LngLatBounds|Array<Array<number>>} [options.maxBounds] If set, the map is constrained to the given bounds.
 * @param {boolean} [options.scrollZoom=true] If `true`, enable the "scroll to zoom" interaction (see `ScrollZoomHandler`)
 * @param {boolean} [options.boxZoom=true] If `true`, enable the "box zoom" interaction (see `BoxZoomHandler`)
 * @param {boolean} [options.dragRotate=true] If `true`, enable the "drag to rotate" interaction (see `DragRotateHandler`).
 * @param {boolean} [options.dragPan=true] If `true`, enable the "drag to pan" interaction (see `DragPanHandler`).
 * @param {boolean} [options.keyboard=true] If `true`, enable keyboard shortcuts (see `KeyboardHandler`).
 * @param {boolean} [options.doubleClickZoom=true] If `true`, enable the "double click to zoom" interaction (see `DoubleClickZoomHandler`).
 * @param {boolean} [options.touchZoomRotate=true] If `true`, enable the "pinch to rotate and zoom" interaction (see `TouchZoomRotateHandler`).
 * @param {boolean} [options.trackResize=true]  If `true`, automatically resize the map when the browser window resizes.
 * @param {LngLat} [options.center] The geographic coordinate on which the map's initial viewport is centered.
 * @param {number} [options.zoom] The zoom level of the map's initial viewport.
 * @param {number} [options.bearing] The bearing (rotation) of the map's initial viewport measured in degrees counter-clockwise from north.
 * @param {number} [options.pitch] The pitch of the map's initial viewport measured in degrees.
 * @param {number} [options.workerCount=navigator.hardwareConcurrency - 1] The number of WebWorkers the map should use to process vector tile data.
 * @example
 * var map = new mapboxgl.Map({
 *   container: 'map',
 *   center: [-122.420679, 37.772537],
 *   zoom: 13,
 *   style: style_object,
 *   hash: true
 * });
 */
var Map = module.exports = function(options) {

    options = util.extend({}, defaultOptions, options);

    if (options.workerCount < 1) {
        throw new Error('workerCount must an integer greater than or equal to 1.');
    }

    this._interactive = options.interactive;
    this._failIfMajorPerformanceCaveat = options.failIfMajorPerformanceCaveat;
    this._preserveDrawingBuffer = options.preserveDrawingBuffer;
    this._trackResize = options.trackResize;
    this._workerCount = options.workerCount;

    if (typeof options.container === 'string') {
        this._container = document.getElementById(options.container);
    } else {
        this._container = options.container;
    }

    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(options.minZoom, options.maxZoom);

    if (options.maxBounds) {
        this.setMaxBounds(options.maxBounds);
    }

    util.bindAll([
        '_forwardStyleEvent',
        '_forwardSourceEvent',
        '_forwardLayerEvent',
        '_forwardTileEvent',
        '_onStyleLoad',
        '_onStyleChange',
        '_onSourceAdd',
        '_onSourceRemove',
        '_onSourceUpdate',
        '_onWindowOnline',
        '_onWindowResize',
        'onError',
        '_update',
        '_render'
    ], this);

    this._setupContainer();
    this._setupPainter();

    this.on('move', this._update.bind(this, false));
    this.on('zoom', this._update.bind(this, true));
    this.on('moveend', function() {
        this.animationLoop.set(300); // text fading
        this._rerender();
    }.bind(this));

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

    this.stacks = {};
    this._classes = [];

    this.resize();

    if (options.classes) this.setClasses(options.classes);
    if (options.style) this.setStyle(options.style);
    if (options.attributionControl) this.addControl(new Attribution(options.attributionControl));

    this.on('error', this.onError);
    this.on('style.error', this.onError);
    this.on('source.error', this.onError);
    this.on('tile.error', this.onError);
    this.on('layer.error', this.onError);
};

util.extend(Map.prototype, Evented);
util.extend(Map.prototype, Camera.prototype);
util.extend(Map.prototype, /** @lends Map.prototype */{

    /**
     * Adds a control to the map, calling `control.addTo(this)`.
     *
     * @param {Control} control
     * @returns {Map} `this`
     */
    addControl: function(control) {
        control.addTo(this);
        return this;
    },

    /**
     * Adds a style class to a map.
     *
     * @param {string} klass name of style class
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    addClass: function(klass, options) {
        if (this._classes.indexOf(klass) >= 0 || klass === '') return this;
        this._classes.push(klass);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    },

    /**
     * Removes a style class from a map.
     *
     * @param {string} klass name of style class
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    removeClass: function(klass, options) {
        var i = this._classes.indexOf(klass);
        if (i < 0 || klass === '') return this;
        this._classes.splice(i, 1);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    },

    /**
     * Helper method to add more than one class.
     *
     * @param {Array<string>} klasses An array of class names
     * @param {StyleOptions} [options]
     * @fires change
     * @returns {Map} `this`
     */
    setClasses: function(klasses, options) {
        var uniqueClasses = {};
        for (var i = 0; i < klasses.length; i++) {
            if (klasses[i] !== '') uniqueClasses[klasses[i]] = true;
        }
        this._classes = Object.keys(uniqueClasses);
        this._classOptions = options;

        if (this.style) this.style.updateClasses();
        return this._update(true);
    },

    /**
     * Check whether a style class is active.
     *
     * @param {string} klass Name of style class
     * @returns {boolean}
     */
    hasClass: function(klass) {
        return this._classes.indexOf(klass) >= 0;
    },

    /**
     * Return an array of the current active style classes.
     *
     * @returns {boolean}
     */
    getClasses: function() {
        return this._classes;
    },

    /**
     * Detect the map's new width and height and resize it. Given
     * the `container` of the map specified in the Map constructor,
     * this reads the new width from the DOM: so this method is often
     * called after the map's container is resized by another script
     * or the map is shown after being initially hidden with CSS.
     *
     * @returns {Map} `this`
     */
    resize: function() {
        var width = 0, height = 0;

        if (this._container) {
            width = this._container.offsetWidth || 400;
            height = this._container.offsetHeight || 300;
        }

        this._canvas.resize(width, height);
        this.transform.resize(width, height);
        this.painter.resize(width, height);

        return this
            .fire('movestart')
            .fire('move')
            .fire('resize')
            .fire('moveend');
    },

    /**
     * Get the map's geographical bounds.
     *
     * @returns {LngLatBounds}
     */
    getBounds: function() {
        var bounds = new LngLatBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));

        if (this.transform.angle || this.transform.pitch) {
            bounds.extend(this.transform.pointLocation(new Point(this.transform.size.x, 0)));
            bounds.extend(this.transform.pointLocation(new Point(0, this.transform.size.y)));
        }

        return bounds;
    },

    /**
     * Set constraint on the map's geographical bounds. Pan or zoom operations that would result in
     * displaying regions that fall outside of the bounds instead result in displaying the map at the
     * closest point and/or zoom level of the requested operation that is within the max bounds.
     *
     * @param {LngLatBounds | Array<Array<number>> | null | undefined} lnglatbounds Desired max bounds of the map. If null or undefined, function removes any bounds constraints on the map.
     * @returns {Map} `this`
     */
    setMaxBounds: function (lnglatbounds) {
        if (lnglatbounds) {
            var b = LngLatBounds.convert(lnglatbounds);
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

    },
    /**
     * Set the map's minimum zoom level, and zooms map to that level if it is
     * currently below it. If no parameter provided, unsets the current
     * minimum zoom (sets it to 0)
     *
     * @param {number} minZoom Minimum zoom level. Must be between 0 and 20.
     * @returns {Map} `this
     */
    setMinZoom: function(minZoom) {

        minZoom = minZoom === null || minZoom === undefined ? defaultMinZoom : minZoom;

        if (minZoom >= defaultMinZoom && minZoom <= this.transform.maxZoom) {
            this.transform.minZoom = minZoom;
            this._update();

            if (this.getZoom() < minZoom) this.setZoom(minZoom);

            return this;

        } else throw new Error('minZoom must be between ' + defaultMinZoom + ' and the current maxZoom, inclusive');
    },

    /**
     * Set the map's maximum zoom level, and zooms map to that level if it is
     * currently above it. If no parameter provided, unsets the current
     * maximum zoom (sets it to 20)
     * @param {number} maxZoom Maximum zoom level. Must be between 0 and 20.
     * @returns {Map} `this`
     */
    setMaxZoom: function(maxZoom) {

        maxZoom = maxZoom === null || maxZoom === undefined ? defaultMaxZoom : maxZoom;

        if (maxZoom >= this.transform.minZoom && maxZoom <= defaultMaxZoom) {
            this.transform.maxZoom = maxZoom;
            this._update();

            if (this.getZoom() > maxZoom) this.setZoom(maxZoom);

            return this;

        } else throw new Error('maxZoom must be between the current minZoom and ' + defaultMaxZoom + ', inclusive');
    },
    /**
     * Get pixel coordinates relative to the map container, given a geographical
     * location.
     *
     * @param {LngLat} lnglat
     * @returns {Object} `x` and `y` coordinates
     */
    project: function(lnglat) {
        return this.transform.locationPoint(LngLat.convert(lnglat));
    },

    /**
     * Get geographical coordinates, given pixel coordinates.
     *
     * @param {Array<number>} point [x, y] pixel coordinates
     * @returns {LngLat}
     */
    unproject: function(point) {
        return this.transform.pointLocation(Point.convert(point));
    },

    /**
     * Query rendered features at a point or within a rectangle.
     *
     * @param {Point|Array<number>|Array<Point>|Array<Array<number>>} [pointOrBox] - The geometry of a query region:
     * either [x, y] pixel coordinates of a point, or [[x1, y1], [x2, y2]] pixel coordinates of opposite corners of
     * a bounding rectangle. Omitting this parameter (i.e. calling `queryRenderedFeatures` with zero arguments,
     * or with a single `params` argument), is equivalent to passing a bounding rectangle encompassing the entire
     * viewport.
     * @param {Object} [params]
     * @param {Array<string>} [params.layers] Only query features from layers with these layer IDs.
     * @param {Array} [params.filter] A [filter](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter).
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects) satisfying the query parameters.
     *
     * The `properties` value of each feature contains the properties of the source feature. For GeoJSON sources, only
     * string and numeric values are supported; null, Array, and Object values are not supported.
     *
     * Each feature includes a top-level `layer` property whose value is an object representing the style layer to
     * which the feature belongs. Layout and paint properties in this object contain values which are fully evaluated
     * for the given zoom level and feature.
     *
     * Only visible features are returned. The topmost rendered feature appears first in the returned array, and
     * subsequent features are sorted by descending z-order. Features which are rendered multiple times due to wrapping
     * across the antimeridian at low zoom levels are returned only once, subject to the caveat that follows.
     *
     * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
     * geometries are clipped at tile boundaries and features may appear duplicated across tiles. For example, suppose
     * there is a highway running through the bounding rectangle of a query. The results of the query will be those
     * parts of the highway that lie within the map tiles covering the bounding rectangle, even if the highway extends
     * into other tiles, and the portion of the highway within each map tile will be returned as a separate feature.
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
     */
    queryRenderedFeatures: function(pointOrBox, params) {
        if (!(pointOrBox instanceof Point || Array.isArray(pointOrBox))) {
            params = pointOrBox;
            pointOrBox = undefined;
        }
        var queryGeometry = this._makeQueryGeometry(pointOrBox);
        return this.style.queryRenderedFeatures(queryGeometry, params, this.transform.zoom, this.transform.angle);
    },

    _makeQueryGeometry: function(pointOrBox) {
        if (pointOrBox === undefined) {
            // bounds was omitted: use full viewport
            pointOrBox = [
                Point.convert([0, 0]),
                Point.convert([this.transform.width, this.transform.height])
            ];
        }

        var queryGeometry;
        var isPoint = pointOrBox instanceof Point || typeof pointOrBox[0] === 'number';

        if (isPoint) {
            var point = Point.convert(pointOrBox);
            queryGeometry = [point];
        } else {
            var box = [Point.convert(pointOrBox[0]), Point.convert(pointOrBox[1])];
            queryGeometry = [
                box[0],
                new Point(box[1].x, box[0].y),
                box[1],
                new Point(box[0].x, box[1].y),
                box[0]
            ];
        }

        queryGeometry = queryGeometry.map(function(p) {
            return this.transform.pointCoordinate(p);
        }.bind(this));

        return queryGeometry;
    },

    /**
     * Query data from vector tile or GeoJSON sources.
     *
     * @param {string} sourceID source ID
     * @param {Object} params
     * @param {string} [params.sourceLayer] The name of the vector tile layer to get features from. For vector tile
     * sources, this parameter is required. For GeoJSON sources, it is ignored.
     * @param {Array} [params.filter] A [filter](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter).
     *
     * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
     * [Feature objects](http://geojson.org/geojson-spec.html#feature-objects) satisfying the query parameters.
     *
     * In contrast to `queryRenderedFeatures`, `querySourceFeatures` returns all features matching the query parameters,
     * whether they are rendered by the current style or not. The domain of the query consists of all currently-loaded
     * vector tile or GeoJSON source tiles; `querySourceFeatures` does not load additional tiles beyond the currently
     * visible viewport.
     *
     * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
     * geometries are clipped at tile boundaries and features may appear duplicated across tiles. For example, suppose
     * there is a highway running through the bounding rectangle of a query. The results of the query will be those
     * parts of the highway that lie within the map tiles covering the bounding rectangle, even if the highway extends
     * into other tiles, and the portion of the highway within each map tile will be returned as a separate feature.
     */
    querySourceFeatures: function(sourceID, params) {
        return this.style.querySourceFeatures(sourceID, params);
    },

    /**
     * Replaces the map's style object with a new value. Unlike the `style`
     * option in the Map constructor, this method only accepts an object
     * of a new style, not a URL string.
     *
     * @param {Object} style A style object formatted as JSON
     * @returns {Map} `this`
     */
    setStyle: function(style) {
        if (this.style) {
            this.style
                .off('load', this._onStyleLoad)
                .off('error', this._forwardStyleEvent)
                .off('change', this._onStyleChange)
                .off('source.add', this._onSourceAdd)
                .off('source.remove', this._onSourceRemove)
                .off('source.load', this._onSourceUpdate)
                .off('source.error', this._forwardSourceEvent)
                .off('source.change', this._onSourceUpdate)
                .off('layer.add', this._forwardLayerEvent)
                .off('layer.remove', this._forwardLayerEvent)
                .off('layer.error', this._forwardLayerEvent)
                .off('tile.add', this._forwardTileEvent)
                .off('tile.remove', this._forwardTileEvent)
                .off('tile.load', this._update)
                .off('tile.error', this._forwardTileEvent)
                .off('tile.stats', this._forwardTileEvent)
                ._remove();

            this.off('rotate', this.style._redoPlacement);
            this.off('pitch', this.style._redoPlacement);
        }

        if (!style) {
            this.style = null;
            return this;
        } else if (style instanceof Style) {
            this.style = style;
        } else {
            this.style = new Style(style, this.animationLoop, this._workerCount);
        }

        this.style
            .on('load', this._onStyleLoad)
            .on('error', this._forwardStyleEvent)
            .on('change', this._onStyleChange)
            .on('source.add', this._onSourceAdd)
            .on('source.remove', this._onSourceRemove)
            .on('source.load', this._onSourceUpdate)
            .on('source.error', this._forwardSourceEvent)
            .on('source.change', this._onSourceUpdate)
            .on('layer.add', this._forwardLayerEvent)
            .on('layer.remove', this._forwardLayerEvent)
            .on('layer.error', this._forwardLayerEvent)
            .on('tile.add', this._forwardTileEvent)
            .on('tile.remove', this._forwardTileEvent)
            .on('tile.load', this._update)
            .on('tile.error', this._forwardTileEvent)
            .on('tile.stats', this._forwardTileEvent);

        this.on('rotate', this.style._redoPlacement);
        this.on('pitch', this.style._redoPlacement);

        return this;
    },

    /**
     * Get a style object that can be used to recreate the map's style.
     *
     * @returns {Object} style
     */
    getStyle: function() {
        if (this.style) {
            return this.style.serialize();
        }
    },

    /**
     * Add a source to the map style.
     *
     * @param {string} id ID of the source. Must not be used by any existing source.
     * @param {Object} source source specification, following the
     * [Mapbox GL Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/#sources)
     * @fires source.add
     * @returns {Map} `this`
     */
    addSource: function(id, source) {
        this.style.addSource(id, source);
        this._update(true);
        return this;
    },

    /**
     * Remove an existing source from the map style.
     *
     * @param {string} id ID of the source to remove
     * @fires source.remove
     * @returns {Map} `this`
     */
    removeSource: function(id) {
        this.style.removeSource(id);
        this._update(true);
        return this;
    },

    /**
     * Return the style source object with the given `id`.
     *
     * @param {string} id source ID
     * @returns {Object}
     */
    getSource: function(id) {
        return this.style.getSource(id);
    },

    /**
     * Add a [Mapbox GL style layer](https://www.mapbox.com/mapbox-gl-style-spec/#layers)
     * to the map. A layer references a source from which it pulls data and specifies
     * styling for that data.
     *
     * If a value for `before` is provided, the layer will be inserted before the layer
     * with the specified ID. If `before` is omitted, the layer will be inserted above
     * every existing layer.
     *
     * @param {StyleLayer|Object} layer
     * @param {string=} before  ID of an existing layer to insert before
     * @fires layer.add
     * @returns {Map} `this`
     */
    addLayer: function(layer, before) {
        this.style.addLayer(layer, before);
        this._update(true);
        return this;
    },

    /**
     * Remove the layer with the given `id` from the map. Any layers which refer to the
     * specified layer via a `ref` property are also removed.
     *
     * @param {string} id layer id
     * @throws {Error} if no layer with the given `id` exists
     * @fires layer.remove
     * @returns {Map} `this`
     */
    removeLayer: function(id) {
        this.style.removeLayer(id);
        this._update(true);
        return this;
    },

    /**
     * Return the style layer object with the given `id`.
     *
     * @param {string} id layer id
     * @returns {?Object} a layer, if one with the given `id` exists
     */
    getLayer: function(id) {
        return this.style.getLayer(id);
    },

    /**
     * Set the filter for a given style layer.
     *
     * @param {string} layer ID of a layer
     * @param {Array} filter filter specification, as defined in the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#types-filter)
     * @returns {Map} `this`
     * @example
     * map.setFilter('my-layer', ['==', 'name', 'USA']);
     */
    setFilter: function(layer, filter) {
        this.style.setFilter(layer, filter);
        this._update(true);
        return this;
    },

    /**
     * Set the zoom extent for a given style layer.
     *
     * @param {string} layerId ID of a layer
     * @param {number} minzoom minimum zoom extent
     * @param {number} maxzoom maximum zoom extent
     * @returns {Map} `this`
     * @example
     * map.setLayerZoomRange('my-layer', 2, 5);
     */
    setLayerZoomRange: function(layerId, minzoom, maxzoom) {
        this.style.setLayerZoomRange(layerId, minzoom, maxzoom);
        this._update(true);
        return this;
    },

    /**
     * Get the filter for a given style layer.
     *
     * @param {string} layer ID of a layer
     * @returns {Array} filter specification, as defined in the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#filter)
     */
    getFilter: function(layer) {
        return this.style.getFilter(layer);
    },

    /**
     * Set the value of a paint property in a given style layer.
     *
     * @param {string} layer ID of a layer
     * @param {string} name name of a paint property
     * @param {*} value value for the paint propery; must have the type appropriate for the property as defined in the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/)
     * @param {string=} klass optional class specifier for the property
     * @returns {Map} `this`
     * @example
     * map.setPaintProperty('my-layer', 'fill-color', '#faafee');
     */
    setPaintProperty: function(layer, name, value, klass) {
        this.style.setPaintProperty(layer, name, value, klass);
        this._update(true);
        return this;
    },

    /**
     * Get the value of a paint property in a given style layer.
     *
     * @param {string} layer ID of a layer
     * @param {string} name name of a paint property
     * @param {string=} klass optional class specifier for the property
     * @returns {*} value for the paint propery
     */
    getPaintProperty: function(layer, name, klass) {
        return this.style.getPaintProperty(layer, name, klass);
    },

    /**
     * Set the value of a layout property in a given style layer.
     *
     * @param {string} layer ID of a layer
     * @param {string} name name of a layout property
     * @param {*} value value for the layout propery; must have the type appropriate for the property as defined in the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/)
     * @returns {Map} `this`
     * @example
     * map.setLayoutProperty('my-layer', 'visibility', 'none');
     */
    setLayoutProperty: function(layer, name, value) {
        this.style.setLayoutProperty(layer, name, value);
        this._update(true);
        return this;
    },

    /**
     * Get the value of a layout property in a given style layer.
     *
     * @param {string} layer ID of a layer
     * @param {string} name name of a layout property
     * @param {string=} klass optional class specifier for the property
     * @returns {*} value for the layout propery
     */
    getLayoutProperty: function(layer, name) {
        return this.style.getLayoutProperty(layer, name);
    },

    /**
     * Get the Map's container as an HTML element
     * @returns {HTMLElement} container
     */
    getContainer: function() {
        return this._container;
    },

    /**
     * Get the container for the map `canvas` element.
     *
     * If you want to add non-GL overlays to the map, you should append them to this element. This
     * is the element to which event bindings for map interactivity such as panning and zooming are
     * attached. It will receive bubbled events for child elements such as the `canvas`, but not for
     * map controls.
     *
     * @returns {HTMLElement} container
     */
    getCanvasContainer: function() {
        return this._canvasContainer;
    },

    /**
     * Get the Map's canvas as an HTML canvas
     * @returns {HTMLElement} canvas
     */
    getCanvas: function() {
        return this._canvas.getElement();
    },

    _setupContainer: function() {
        var container = this._container;
        container.classList.add('mapboxgl-map');

        var canvasContainer = this._canvasContainer = DOM.create('div', 'mapboxgl-canvas-container', container);
        if (this._interactive) {
            canvasContainer.classList.add('mapboxgl-interactive');
        }
        this._canvas = new Canvas(this, canvasContainer);

        var controlContainer = this._controlContainer = DOM.create('div', 'mapboxgl-control-container', container);
        var corners = this._controlCorners = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(function (pos) {
            corners[pos] = DOM.create('div', 'mapboxgl-ctrl-' + pos, controlContainer);
        });
    },

    _setupPainter: function() {
        var gl = this._canvas.getWebGLContext({
            failIfMajorPerformanceCaveat: this._failIfMajorPerformanceCaveat,
            preserveDrawingBuffer: this._preserveDrawingBuffer
        });

        if (!gl) {
            this.fire('error', { error: new Error('Failed to initialize WebGL') });
            return;
        }

        this.painter = new Painter(gl, this.transform);
    },

    /**
     * WebGL Context Lost event.
     *
     * @event webglcontextlost
     * @memberof Map
     * @instance
     * @type {Object}
     * @property {Event} originalEvent the original DOM event
     */
    _contextLost: function(event) {
        event.preventDefault();
        if (this._frameId) {
            browser.cancelFrame(this._frameId);
        }
        this.fire('webglcontextlost', {originalEvent: event});
    },

    /**
     * WebGL Context Restored event.
     *
     * @event webglcontextrestored
     * @memberof Map
     * @instance
     * @type {Object}
     */
    _contextRestored: function(event) {
        this._setupPainter();
        this.resize();
        this._update();
        this.fire('webglcontextrestored', {originalEvent: event});
    },

    /**
     * Is this map fully loaded? If the style isn't loaded
     * or it has a change to the sources or style that isn't
     * propagated to its style, return false.
     *
     * @returns {boolean} whether the map is loaded
     */
    loaded: function() {
        if (this._styleDirty || this._sourcesDirty)
            return false;
        if (!this.style || !this.style.loaded())
            return false;
        return true;
    },

    /**
     * Update this map's style and sources, and re-render the map.
     *
     * @param {boolean} updateStyle mark the map's style for reprocessing as
     * well as its sources
     * @returns {Map} this
     * @private
     */
    _update: function(updateStyle) {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;

        this._rerender();

        return this;
    },

    /**
     * Call when a (re-)render of the map is required, e.g. when the
     * user panned or zoomed,f or new data is available.
     * @returns {Map} this
     * @private
     */
    _render: function() {
        try {
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
                debug: this.showTileBoundaries,
                showOverdrawInspector: this._showOverdrawInspector,
                vertices: this.vertices,
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

            if (this._sourcesDirty || this._repaint || !this.animationLoop.stopped()) {
                this._rerender();
            }

        } catch (error) {
            this.fire('error', {error: error});
        }

        return this;
    },

    /**
     * Destroys the map's underlying resources, including web workers and DOM elements. Afterwards,
     * you must not call any further methods on this Map instance.
     *
     * @returns {undefined}
     */
    remove: function() {
        if (this._hash) this._hash.remove();
        browser.cancelFrame(this._frameId);
        this.setStyle(null);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onWindowResize, false);
        }
        removeNode(this._canvasContainer);
        removeNode(this._controlContainer);
        this._container.classList.remove('mapboxgl-map');
    },

    /**
     * A default error handler for `style.error`, `source.error`, `layer.error`,
     * and `tile.error` events.
     * It logs the error via `console.error`.
     *
     * @example
     * // Disable the default error handler
     * map.off('error', map.onError);
     * map.off('style.error', map.onError);
     * map.off('source.error', map.onError);
     * map.off('tile.error', map.onError);
     * map.off('layer.error', map.onError);
     */
    onError: function(e) {
        console.error(e.error);
    },

    _rerender: function() {
        if (this.style && !this._frameId) {
            this._frameId = browser.frame(this._render);
        }
    },

    _forwardStyleEvent: function(e) {
        this.fire('style.' + e.type, util.extend({style: e.target}, e));
    },

    _forwardSourceEvent: function(e) {
        this.fire(e.type, util.extend({style: e.target}, e));
    },

    _forwardLayerEvent: function(e) {
        this.fire(e.type, util.extend({style: e.target}, e));
    },

    _forwardTileEvent: function(e) {
        this.fire(e.type, util.extend({style: e.target}, e));
    },

    _onStyleLoad: function(e) {
        if (this.transform.unmodified) {
            this.jumpTo(this.style.stylesheet);
        }
        this.style.update(this._classes, {transition: false});
        this._forwardStyleEvent(e);
    },

    _onStyleChange: function(e) {
        this._update(true);
        this._forwardStyleEvent(e);
    },

    _onSourceAdd: function(e) {
        var source = e.source;
        if (source.onAdd)
            source.onAdd(this);
        this._forwardSourceEvent(e);
    },

    _onSourceRemove: function(e) {
        var source = e.source;
        if (source.onRemove)
            source.onRemove(this);
        this._forwardSourceEvent(e);
    },

    _onSourceUpdate: function(e) {
        this._update();
        this._forwardSourceEvent(e);
    },

    _onWindowOnline: function() {
        this._update();
    },

    _onWindowResize: function() {
        if (this._trackResize) {
            this.stop().resize()._update();
        }
    }
});

util.extendAll(Map.prototype, /** @lends Map.prototype */{

    /**
     * Draw an outline around each rendered tile for debugging.
     *
     * @name showTileBoundaries
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    _showTileBoundaries: false,
    get showTileBoundaries() { return this._showTileBoundaries; },
    set showTileBoundaries(value) {
        if (this._showTileBoundaries === value) return;
        this._showTileBoundaries = value;
        this._update();
    },

    /**
     * Draw boxes around all symbols in the data source, showing which were
     * rendered and which were hidden due to collisions with other symbols for
     * style debugging.
     *
     * @name showCollisionBoxes
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    _showCollisionBoxes: false,
    get showCollisionBoxes() { return this._showCollisionBoxes; },
    set showCollisionBoxes(value) {
        if (this._showCollisionBoxes === value) return;
        this._showCollisionBoxes = value;
        this.style._redoPlacement();
    },

    /*
     * Show how many times each fragment has been shaded. White fragments have
     * been shaded 8 or more times. Black fragments have been shaded 0 times.
     *
     * @name showOverdraw
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    _showOverdrawInspector: false,
    get showOverdrawInspector() { return this._showOverdrawInspector; },
    set showOverdrawInspector(value) {
        if (this._showOverdrawInspector === value) return;
        this._showOverdrawInspector = value;
        this._update();
    },

    /**
     * Enable continuous repaint to analyze performance.
     *
     * @name repaint
     * @type {boolean}
     * @instance
     * @memberof Map
     */
    _repaint: false,
    get repaint() { return this._repaint; },
    set repaint(value) { this._repaint = value; this._update(); },

    // show vertices
    _vertices: false,
    get vertices() { return this._vertices; },
    set vertices(value) { this._vertices = value; this._update(); }
});

function removeNode(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}

/**
 * Options common to {@link Map#addClass}, {@link Map#removeClass},
 * and {@link Map#setClasses}, controlling
 * whether or not to smoothly transition property changes triggered by the class change.
 *
 * @typedef {Object} StyleOptions
 * @property {boolean} transition
 */

 /**
  * This event is fired whenever the map is drawn to the screen because of
  *
  *  - a change in map position, zoom, pitch, or bearing
  *  - a change to the map style
  *  - a change to a GeoJSON source
  *  - a vector tile, GeoJSON file, glyph, or sprite being loaded
  *
  * @event render
  * @memberof Map
  * @instance
  */


  /**
   * When an event fires as a result of a
   * user interaction, the event will be called with an EventData
   * object containing the original DOM event along with coordinates of
   * the event target.
   *
   * @typedef {Object} EventData
   * @property {Event} originalEvent The original DOM event
   * @property {Point} point The pixel location of the event
   * @property {LngLat} lngLat The geographic location of the event
   * @example
   * map.on('click', function(data) {
   *   var e = data && data.originalEvent;
   *   console.log('got click ' + (e ? 'button = ' + e.button : ''));
   * });
   */

  /**
   * Mouse out event.
   *
   * @event mouseout
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [mouseout event](https://developer.mozilla.org/en-US/docs/Web/Events/mouseout)
   */

  /**
   * Mouse down event.
   *
   * @event mousedown
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [mousedown event](https://developer.mozilla.org/en-US/docs/Web/Events/mousedown)
   */

  /**
   * Mouse up event.
   *
   * @event mouseup
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [mouseup event](https://developer.mozilla.org/en-US/docs/Web/Events/mouseup)
   */

  /**
   * Mouse move event.
   *
   * @event mousemove
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [mousemouse event](https://developer.mozilla.org/en-US/docs/Web/Events/mousemove)
   */

  /**
   * Touch start event.
   *
   * @event touchstart
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [touchstart event](https://developer.mozilla.org/en-US/docs/Web/Events/touchstart).
   */

  /**
   * Touch end event.
   *
   * @event touchend
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [touchcancel event](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel).
   */

  /**
   * Touch move event.
   *
   * @event touchmove
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [touchmove event](https://developer.mozilla.org/en-US/docs/Web/Events/touchmove).
   */

  /**
   * Touch cancel event.
   *
   * @event touchcancel
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [touchcancel event](https://developer.mozilla.org/en-US/docs/Web/Events/touchcancel).
   */

  /**
   * Click event.
   *
   * @event click
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data: a [click event](https://developer.mozilla.org/en-US/docs/Web/Events/click)
   */

  /**
   * Double click event.
   *
   * @event dblclick
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data
   */

  /**
   * Context menu event.
   *
   * @event contextmenu
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data, if available
   */

  /**
   * Load event. This event is emitted immediately after all necessary resources have been downloaded
   * and the first visually complete rendering has occurred.
   *
   * @event load
   * @memberof Map
   * @instance
   * @type {Object}
   */

  /**
   * Move start event. This event is emitted just before the map begins a transition from one
   * view to another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
   *
   * @event movestart
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data, if fired interactively
   */

  /**
   * Move event. This event is emitted repeatedly during animated transitions from one view to
   * another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
   *
   * @event move
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data, if fired interactively
   */

  /**
   * Move end event. This event is emitted just after the map completes a transition from one
   * view to another, either as a result of user interaction or the use of methods such as `Map#jumpTo`.
   *
   * @event moveend
   * @memberof Map
   * @instance
   * @property {EventData} data Original event data, if fired interactively
   */
