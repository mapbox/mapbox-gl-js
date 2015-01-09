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

var Map = module.exports = function(options) {

    options = this.options = util.inherit(this.options, options);

    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(options.minZoom, options.maxZoom);
    this.hash = options.hash && new Hash(this);

    if (options.maxBounds) {
        var b = LatLngBounds.convert(options.maxBounds);
        this.transform.latRange = [b.getSouth(), b.getNorth()];
        this.transform.lngRange = [b.getWest(), b.getEast()];
    }

    util.bindAll([
        '_forwardStyleEvent',
        '_forwardSourceEvent',
        '_forwardTileEvent',
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

     // don't set position from options if set through hash
    if (!this.hash || !this.hash.onhash()) {
        this.setView(options.center, options.zoom, options.bearing);
    }

    this.sources = {};
    this.stacks = {};

    this.resize();

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

        minZoom: 0,
        maxZoom: 20,

        interactive: true,
        hash: false,

        attributionControl: true
    },

    addSource(id, source) {
        this.style.addSource(id, source);
        return this;
    },

    removeSource(id) {
        this.style.removeSource(id);
        return this;
    },

    addControl(control) {
        control.addTo(this);
        return this;
    },

    // Set the map's center, zoom, and bearing
    setView(center, zoom, bearing) {
        this.stop();

        var tr = this.transform,
            zoomChanged = tr.zoom !== +zoom,
            bearingChanged = tr.bearing !== +bearing;

        tr.center = LatLng.convert(center);
        tr.zoom = +zoom;
        tr.bearing = +bearing;

        return this
            .fire('movestart')
            ._move(zoomChanged, bearingChanged)
            .fire('moveend');
    },

    setCenter(center) {
        this.setView(center, this.getZoom(), this.getBearing());
    },

    setZoom(zoom) {
        this.setView(this.getCenter(), zoom, this.getBearing());
    },

    setBearing(bearing) {
        this.setView(this.getCenter(), this.getZoom(), bearing);
    },

    getCenter() { return this.transform.center; },
    getZoom() { return this.transform.zoom; },
    getBearing() { return this.transform.bearing; },

    // Detect the map's new width and height and resize it.
    resize() {
        var width = 0, height = 0;

        if (this.container) {
            width = this.container.offsetWidth || 400;
            height = this.container.offsetHeight || 300;
        }

        this.canvas.resize(width, height);

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

    getBounds() {
        return new LatLngBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));
    },

    project(latlng) {
        return this.transform.locationPoint(LatLng.convert(latlng));
    },
    unproject(point) {
        return this.transform.pointLocation(Point.convert(point));
    },

    featuresAt(point, params, callback) {
        this.style.featuresAt(point, params, callback);
        return this;
    },

    setStyle(style) {
        if (this.style) {
            this.style
                .off('load', this._forwardStyleEvent)
                .off('error', this._forwardStyleEvent)
                .off('change', this._onStyleChange)
                .off('source.add', this._onSourceAdd)
                .off('source.remove', this._onSourceRemove)
                .off('source.load', this._onSourceUpdate)
                .off('source.error', this._forwardSourceEvent)
                .off('source.change', this._onSourceUpdate)
                .off('tile.add', this._forwardTileEvent)
                .off('tile.remove', this._forwardTileEvent)
                .off('tile.load', this.update)
                .off('tile.error', this._forwardTileEvent)
                ._remove();
        }

        if (!style) {
            this.style = null;
            return;
        } else if (style instanceof Style) {
            this.style = style;
        } else {
            this.style = new Style(style, this.animationLoop);
        }

        this.style
            .on('load', this._forwardStyleEvent)
            .on('error', this._forwardStyleEvent)
            .on('change', this._onStyleChange)
            .on('source.add', this._onSourceAdd)
            .on('source.remove', this._onSourceRemove)
            .on('source.load', this._onSourceUpdate)
            .on('source.error', this._forwardSourceEvent)
            .on('source.change', this._onSourceUpdate)
            .on('tile.add', this._forwardTileEvent)
            .on('tile.remove', this._forwardTileEvent)
            .on('tile.load', this.update)
            .on('tile.error', this._forwardTileEvent);

        return this;
    },

    _move (zoom, rotate) {

        this.update(zoom).fire('move');

        if (zoom) this.fire('zoom');
        if (rotate) this.fire('rotate');

        return this;
    },

    // map setup code

    _setupContainer() {
        var id = this.options.container;
        var container = this.container = typeof id === 'string' ? document.getElementById(id) : id;
        if (container) container.classList.add('mapboxgl-map');
        this.canvas = new Canvas(this, container);
    },

    _setupPainter() {
        var gl = this.canvas.getWebGLContext();

        if (!gl) {
            console.error('Failed to initialize WebGL');
            return;
        }

        this.painter = new GLPainter(gl, this.transform);
    },

    _contextLost(event) {
        event.preventDefault();
        if (this._frameId) {
            browser.cancelFrame(this._frameId);
        }
    },

    _contextRestored() {
        this._setupPainter();
        this.resize();
        this.update();
    },

    // Rendering

    loaded() {
        if (this._styleDirty || this._sourcesDirty)
            return false;
        if (this.style && !this.style.loaded())
            return false;
        return true;
    },

    update(updateStyle) {
        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;

        this._rerender();

        return this;
    },

    // Call when a (re-)render of the map is required, e.g. when the user panned or zoomed,f or new data is available.
    render() {
        if (this.style && this._styleDirty) {
            this._styleDirty = false;
            this.style.recalculate(this.transform.zoom);
        }

        if (this.style && this._sourcesDirty && !this._sourcesDirtyTimeout) {
            this._sourcesDirty = false;
            this._sourcesDirtyTimeout = setTimeout(() => {
                this._sourcesDirtyTimeout = null;
            }, 50);
            this.style._updateSources(this.transform);
        }

        this.painter.render(this.style, {
            debug: this.debug,
            vertices: this.vertices,
            rotating: this.rotating,
            zooming: this.zooming
        });

        this.fire('render');

        this._frameId = null;

        if (!this.animationLoop.stopped()) {
            this._styleDirty = true;
        }

        if (this._sourcesDirty || this._repaint || !this.animationLoop.stopped()) {
            this._rerender();
        }

        return this;
    },

    remove() {
        browser.cancelFrame(this._frameId);
        clearTimeout(this._sourcesDirtyTimeout);
        this.setStyle(null);
        return this;
    },

    _rerender() {
        if (this.style && !this._frameId) {
            this._frameId = browser.frame(this.render);
        }
    },

    _forwardStyleEvent(e) {
        this.fire('style.' + e.type, util.extend({style: e.target}, e));
    },

    _forwardSourceEvent(e) {
        this.fire(e.type, util.extend({style: e.target}, e));
    },

    _forwardTileEvent(e) {
        this.fire(e.type, util.extend({style: e.target}, e));
    },

    _onStyleChange(e) {
        this.update(true);
        this._forwardStyleEvent(e);
    },

    _onSourceAdd(e) {
        var source = e.source;
        if (source.onAdd)
            source.onAdd(this);
        this._forwardSourceEvent(e);
    },

    _onSourceRemove(e) {
        var source = e.source;
        if (source.onRemove)
            source.onRemove(this);
        this._forwardSourceEvent(e);
    },

    _onSourceUpdate(e) {
        this.update();
        this._forwardSourceEvent(e);
    }
});

util.extendAll(Map.prototype, {

    // debug code
    _debug: false,
    get debug() { return this._debug; },
    set debug(value) { this._debug = value; this.update(); },

    // continuous repaint
    _repaint: false,
    get repaint() { return this._repaint; },
    set repaint(value) { this._repaint = value; this.update(); },

    // show vertices
    _vertices: false,
    get vertices() { return this._vertices; },
    set vertices(value) { this._vertices = value; this.update(); }
});
