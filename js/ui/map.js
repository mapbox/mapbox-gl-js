'use strict';

var Canvas = require('../util/canvas');
var util = require('../util/util');
var browser = require('../util/browser');
var Evented = require('../util/evented');

var Style = require('../style/style');
var AnimationLoop = require('../style/animation_loop');
var GLPainter = require('../render/painter');

var Transform = require('../geo/transform');
var Hash = require('./hash');
var Handlers = require('./handlers');
var Easings = require('./easings');
var LatLng = require('../geo/lat_lng');
var LatLngBounds = require('../geo/lat_lng_bounds');
var Point = require('point-geometry');
var Attribution = require('./control/attribution');

/**
 * Creates a map instance.
 * @class mapboxgl.Map
 * @param {Object} options
 * @param {String} options.container HTML element to initialize the map in (or element id as string)
 * @param {Number} [options.minZoom=0] Minimum zoom of the map
 * @param {Number} [options.maxZoom=20] Maximum zoom of the map
 * @param {Object} options.style Map style and data source definition (either a JSON object or a JSON URL), described in the [style reference](https://mapbox.com/mapbox-gl-style-spec/)
 * @param {Boolean} [options.hash=false] If `true`, the map will track and update the page URL according to map position
 * @param {Boolean} [options.interactive=true] If `false`, no mouse, touch, or keyboard listeners are attached to the map, so it will not respond to input
 * @param {Array} options.classes Style class names with which to initialize the map
 * @example
 * var map = new mapboxgl.Map({
 *   container: 'map',
 *   center: [37.772537, -122.420679],
 *   zoom: 13,
 *   style: style_object,
 *   hash: true
 * });
 */
var Map = module.exports = function(options) {

    options = this.options = util.inherit(this.options, options);

    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(options.minZoom, options.maxZoom);

    if (options.maxBounds) {
        var b = LatLngBounds.convert(options.maxBounds);
        this.transform.latRange = [b.getSouth(), b.getNorth()];
        this.transform.lngRange = [b.getWest(), b.getEast()];
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
        'update',
        'render'
    ], this);

    this._setupContainer();
    this._setupPainter();

    this.handlers = options.interactive && new Handlers(this);

    this._hash = options.hash && (new Hash()).addTo(this);
    // don't set position from options if set through hash
    if (!this._hash || !this._hash._onHashChange()) {
        this.setView(options.center, options.zoom, options.bearing, options.pitch);
    }

    this.sources = {};
    this.stacks = {};
    this._classes = {};

    this.resize();

    if (options.classes) this.setClasses(options.classes);
    if (options.style) this.setStyle(options.style);
    if (options.attributionControl) this.addControl(new Attribution());
};

util.extend(Map.prototype, Evented);
util.extend(Map.prototype, Easings);
util.extend(Map.prototype, {

    options: {
        center: [0, 0],
        zoom: 0,
        bearing: 0,
        pitch: 0,

        minZoom: 0,
        maxZoom: 20,

        interactive: true,
        hash: false,

        attributionControl: true
    },

    addControl: function(control) {
        control.addTo(this);
        return this;
    },

    /**
     * Sets a map position
     *
     * @param {Array} center Latitude and longitude (passed as `[lat, lng]`)
     * @param {Number} zoom Map zoom level
     * @param {Number} bearing Map rotation bearing in degrees counter-clockwise from north
     * @param {Number} pitch The angle at which the camera is looking at the ground
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setView: function(center, zoom, bearing, pitch) {
        this.stop();

        var tr = this.transform,
            zoomChanged = tr.zoom !== +zoom,
            bearingChanged = tr.bearing !== +bearing,
            pitchChanged = tr.pitch !== +pitch;

        tr.center = LatLng.convert(center);
        tr.zoom = +zoom;
        tr.bearing = +bearing;
        tr.pitch = +pitch;

        return this
            .fire('movestart')
            ._move(zoomChanged, bearingChanged, pitchChanged)
            .fire('moveend');
    },

    /**
     * Sets a map location
     *
     * @param {Array} center Latitude and longitude (passed as `[lat, lng]`)
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setCenter: function(center) {
        this.setView(center, this.getZoom(), this.getBearing(), this.getPitch());
    },

    /**
     * Sets a map zoom
     *
     * @param {Number} zoom Map zoom level
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setZoom: function(zoom) {
        this.setView(this.getCenter(), zoom, this.getBearing(), this.getPitch());
    },

    /**
     * Sets a map rotation
     *
     * @param {Number} bearing Map rotation bearing in degrees counter-clockwise from north
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setBearing: function(bearing) {
        this.setView(this.getCenter(), this.getZoom(), bearing, this.getPitch());
    },

    /**
     * Sets a map angle
     *
     * @param {Number} pitch The angle at which the camera is looking at the ground
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch: function(pitch) {
        this.setView(this.getCenter(), this.getZoom(), this.getBearing(), pitch);
    },

    /**
     * Get the current view geographical point (as `LatLng` object)
     * @returns {Array} `[lat, lng]`
     */
    getCenter: function() { return this.transform.center; },

    /**
     * Get the current zoom
     * @returns {Number}
     */
    getZoom: function() { return this.transform.zoom; },

    /**
     * Get the current bearing in degrees
     * @returns {Number}
     */
    getBearing: function() { return this.transform.bearing; },

    /**
     * Get the current angle in degrees
     * @returns {Number}
     */
    getPitch: function() { return this.transform.pitch; },

    /**
     * @typedef {Object} [styleOptions]
     * @param {Boolean} [styleOptions.transition=true]
     */

    /**
     * Adds a style class to a map
     *
     * @param {String} class name of style class
     * @param {styleOptions}
     * @fires change
     * @returns {Map} `this`
     */
    addClass: function(klass, options) {
        if (this._classes[klass]) return;
        this._classes[klass] = true;
        if (this.style) this.style._cascade(this._classes, options);
    },

    /**
     * Removes a style class from a map
     *
     * @param {String} class name of style class
     * @param {styleOptions}
     * @fires change
     * @returns {Map} `this`
     */
    removeClass: function(klass, options) {
        if (!this._classes[klass]) return;
        delete this._classes[klass];
        if (this.style) this.style._cascade(this._classes, options);
    },

    /**
     * Helper method to add more than one class
     *
     * @param {Array} classes An array of class names
     * @param {styleOptions}
     * @fires change
     * @returns {Map} `this`
     */
    setClasses: function(klasses, options) {
        this._classes = {};
        for (var i = 0; i < klasses.length; i++) {
            this._classes[klasses[i]] = true;
        }
        if (this.style) this.style._cascade(this._classes, options);
    },

    /**
     * Check whether a style class is active
     *
     * @param {String} class Name of style class
     * @returns {Boolean}
     */
    hasClass: function(klass) {
        return !!this._classes[klass];
    },

    /**
     * Return an array of the current active style classes
     *
     * @returns {Boolean}
     */
    getClasses: function() {
        return Object.keys(this._classes);
    },

    /**
     * Detect the map's new width and height and resize it.
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

        this.transform.width = width;
        this.transform.height = height;
        this.transform._constrain();

        this.painter.resize(width, height);

        return this
            .fire('movestart')
            ._move()
            .fire('resize')
            .fire('moveend');
    },

    /**
     * Get the map's geographical bounds
     *
     * @returns {Object} `LatLngBounds`
     */
    getBounds: function() {
        return new LatLngBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));
    },

    /**
     * Get pixel coordinates (relative to map container) given a geographical location
     *
     * @param {Array} [lat, lng]
     * @returns {Object} `x` and `y` coordinates
     */
    project: function(latlng) {
        return this.transform.locationPoint(LatLng.convert(latlng));
    },

    /**
     * Get geographical coordinates given pixel coordinates
     *
     * @param {Array} [x, y] pixel coordinates
     * @returns {Object} `lat` and `long` coordinates
     */
    unproject: function(point) {
        return this.transform.pointLocation(Point.convert(point));
    },

    /**
     * Get all features at a point ([x, y])
     *
     * @param {Array} [x, y] pixel coordinates
     * @param {Object} params
     * @param {Number} [params.radius=0] Optional. Radius in pixels to search in
     * @param {String} params.layer Optional. Only return features from a given layer
     * @param {String} params.type Optional. Either `raster` or `vector`
     * @param {featuresAtCallback} callback function that returns the response
     *
     * @callback featuresAtCallback
     * @param {Object|null} err Error _If any_
     * @param {Array} features Displays a JSON array of features given the passed parameters of `featuresAt`
     *
     * @returns {Map} `this`
     */
    featuresAt: function(point, params, callback) {
        this.style.featuresAt(point, params, callback);
        return this;
    },

    /**
     * Replaces the map's style object
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
                .off('tile.add', this._forwardTileEvent)
                .off('tile.remove', this._forwardTileEvent)
                .off('tile.load', this.update)
                .off('tile.error', this._forwardTileEvent)
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
            this.style = new Style(style, this.animationLoop);
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
            .on('tile.add', this._forwardTileEvent)
            .on('tile.remove', this._forwardTileEvent)
            .on('tile.load', this.update)
            .on('tile.error', this._forwardTileEvent);

        this.on('rotate', this.style._redoPlacement);
        this.on('pitch', this.style._redoPlacement);

        return this;
    },

    /**
     * Add a source to the map style.
     *
     * @param id {string} ID of the source. Must not be used by any existing source.
     * @param source {Object} source specification, following the
     * [Mapbox GL Style Reference](https://www.mapbox.com/mapbox-gl-style-spec/#sources)
     * @fires source.add
     * @returns {Map} `this`
     */
    addSource: function(id, source) {
        this.style.addSource(id, source);
        return this;
    },

    /**
     * Remove an existing source from the map style.
     *
     * @param id {string} ID of the source to remove
     * @fires source.remove
     * @returns {Map} `this`
     */
    removeSource: function(id) {
        this.style.removeSource(id);
        return this;
    },

    /**
     * Return the style source object with the given `id`.
     *
     * @param id {string} source ID
     * @returns {Object}
     */
    getSource: function(id) {
        return this.style.getSource(id);
    },

    /**
     * Add a layer to the map style. The layer will be inserted before the layer with
     * ID `before`, or appended if `before` is omitted.
     * @param layer {Layer}
     * @param before {string=} ID of an existing layer to insert before
     * @fires layer.add
     * @returns {Map} `this`
     */
    addLayer: function(layer, before) {
        this.style.addLayer(layer, before);
        this.style._cascade(this._classes);
        return this;
    },

    /**
     * Remove the layer with the given `id` from the map. Any layers which refer to the
     * specified layer via a `ref` property are also removed.
     *
     * @param id {string}
     * @fires layer.remove
     * @returns {Map} `this`
     */
    removeLayer: function(id) {
        this.style.removeLayer(id);
        this.style._cascade(this._classes);
        return this;
    },

    setFilter: function(layer, filter) {
        this.style.setFilter(layer, filter);
        return this;
    },

    getFilter: function(layer) {
        return this.style.getFilter(layer);
    },

    setPaintProperty: function(layer, name, value, klass) {
        this.style.setPaintProperty(layer, name, value, klass);
        this.style._cascade(this._classes);
        this.update(true);
        return this;
    },

    getPaintProperty: function(layer, name, klass) {
        return this.style.getPaintProperty(layer, name, klass);
    },

    setLayoutProperty: function(layer, name, value) {
        this.style.setLayoutProperty(layer, name, value);
        return this;
    },

    getLayoutProperty: function(layer, name) {
        return this.style.getLayoutProperty(layer, name);
    },

    getContainer: function() {
        return this._container;
    },

    getCanvas: function() {
        return this._canvas.getElement();
    },

    _move: function(zoom, rotate, pitch) {

        this.update(zoom).fire('move');

        if (zoom) this.fire('zoom');
        if (rotate) this.fire('rotate');
        if (pitch) this.fire('pitch');

        return this;
    },

    // map setup code
    _setupContainer: function() {
        var id = this.options.container;
        var container = this._container = typeof id === 'string' ? document.getElementById(id) : id;
        if (container) container.classList.add('mapboxgl-map');
        this._canvas = new Canvas(this, container);
    },

    _setupPainter: function() {
        var gl = this._canvas.getWebGLContext();

        if (!gl) {
            console.error('Failed to initialize WebGL');
            return;
        }

        this.painter = new GLPainter(gl, this.transform);
    },

    _contextLost: function(event) {
        event.preventDefault();
        if (this._frameId) {
            browser.cancelFrame(this._frameId);
        }
    },

    _contextRestored: function() {
        this._setupPainter();
        this.resize();
        this.update();
    },

    // Rendering
    loaded: function() {
        if (this._styleDirty || this._sourcesDirty)
            return false;
        if (this.style && !this.style.loaded())
            return false;
        return true;
    },

    update: function(updateStyle) {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;

        this._rerender();

        return this;
    },

    // Call when a (re-)render of the map is required, e.g. when the user panned or zoomed,f or new data is available.
    render: function() {
        if (this.style && this._styleDirty) {
            this._styleDirty = false;
            this.style._recalculate(this.transform.zoom);
        }

        if (this.style && this._sourcesDirty && !this._sourcesDirtyTimeout) {
            this._sourcesDirty = false;
            this._sourcesDirtyTimeout = setTimeout(function() {
                this._sourcesDirtyTimeout = null;
            }.bind(this), 50);
            this.style._updateSources(this.transform);
        }

        this.painter.render(this.style, {
            debug: this.debug,
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

        return this;
    },

    remove: function() {
        if (this._hash) this._hash.remove();
        browser.cancelFrame(this._frameId);
        clearTimeout(this._sourcesDirtyTimeout);
        this.setStyle(null);
        return this;
    },

    _rerender: function() {
        if (this.style && !this._frameId) {
            this._frameId = browser.frame(this.render);
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
        this.style._cascade(this._classes, {transition: false});
        this._forwardStyleEvent(e);
    },

    _onStyleChange: function(e) {
        this.update(true);
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
        this.update();
        this._forwardSourceEvent(e);
    }
});

util.extendAll(Map.prototype, {

    // debug code
    _debug: false,
    get debug() { return this._debug; },
    set debug(value) { this._debug = value; this.update(); },

    // show collision boxes
    _collisionDebug: false,
    get collisionDebug() { return this._collisionDebug; },
    set collisionDebug(value) {
        this._collisionDebug = value;
        for (var i in this.style.sources) {
            this.style.sources[i].reload();
        }
        this.update();
    },

    // continuous repaint
    _repaint: false,
    get repaint() { return this._repaint; },
    set repaint(value) { this._repaint = value; this.update(); },

    // show vertices
    _vertices: false,
    get vertices() { return this._vertices; },
    set vertices(value) { this._vertices = value; this.update(); }
});
