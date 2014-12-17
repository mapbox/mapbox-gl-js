'use strict';

var Dispatcher = require('../util/dispatcher');
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
var GlyphSource = require('../symbol/glyph_source');
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
        '_onStyleLoad',
        '_onStyleChange',
        '_onSourceAdd',
        '_onSourceRemove',
        '_onSourceChange',
        'update',
        'render'
    ], this);

    this._setupContainer();
    this._setupPainter();

    this.handlers = options.interactive && new Handlers(this);
    this.dispatcher = new Dispatcher(Math.max(options.numWorkers, 1), this);

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
        numWorkers: browser.hardwareConcurrency - 1,

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

        if (this.style && this.style.sprite) {
            this.style.sprite.resize(this.painter.gl);
        }

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
                .off('load', this._onStyleLoad)
                .off('error', this._forwardStyleEvent)
                .off('change', this._onStyleChange)
                .off('source.add', this._onSourceAdd)
                .off('source.remove', this._onSourceRemove)
                .off('source.load', this._forwardSourceEvent)
                .off('source.error', this._forwardSourceEvent)
                .off('source.change', this._onSourceChange)
                .off('tile.add', this._forwardTileEvent)
                .off('tile.remove', this._forwardTileEvent)
                .off('tile.load', this.update)
                .off('tile.error', this._forwardTileEvent);
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
            .on('load', this._onStyleLoad)
            .on('error', this._forwardStyleEvent)
            .on('change', this._onStyleChange)
            .on('source.add', this._onSourceAdd)
            .on('source.remove', this._onSourceRemove)
            .on('source.load', this._forwardSourceEvent)
            .on('source.error', this._forwardSourceEvent)
            .on('source.change', this._onSourceChange)
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

    // Callbacks from web workers

    'get sprite json': function(params, callback) {
        var sprite = this.style.sprite;
        if (sprite.loaded()) {
            callback(null, { sprite: sprite.data, retina: sprite.retina });
        } else {
            sprite.on('load', function() {
                callback(null, { sprite: sprite.data, retina: sprite.retina });
            });
        }
    },

    'get glyphs': function(params, callback) {
        this.glyphSource.getRects(params.fontstack, params.codepoints, params.id, callback);
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
            this.style._updateSources();
        }

        this._renderGroups(this.style.layerGroups);
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
        this.dispatcher.remove();
        this.painter.gl.destroy();
        browser.cancelFrame(this._frameId);
        clearTimeout(this._sourcesDirtyTimeout);
        this.setStyle(null);
        return this;
    },

    _renderGroups(groups) {
        this.painter.prepareBuffers();

        var i, len, group, source;

        // Render the groups
        for (i = 0, len = groups.length; i < len; i++) {
            group = groups[i];
            source = this.style.sources[group.source];

            if (source) {
                this.painter.clearStencil();
                source.render(group, this.painter);

            } else if (group.source === undefined) {
                this.painter.draw(undefined, this.style, group, { background: true });
            }
        }
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

    _onStyleLoad(e) {
        this.glyphSource = new GlyphSource(this.style.stylesheet.glyphs, this.painter.glyphAtlas);
        this.dispatcher.broadcast('set buckets', this.style.orderedBuckets);
        this._forwardStyleEvent(e);
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

    _onSourceChange(e) {
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

    // polygon antialiasing
    _antialiasing: true,
    get antialiasing() { return this._antialiasing; },
    set antialiasing(value) { this._antialiasing = value; this.update(); },

    // show vertices
    _vertices: false,
    get vertices() { return this._vertices; },
    set vertices(value) { this._vertices = value; this.update(); },

    // show vertices
    _loadNewTiles: true,
    get loadNewTiles() { return this._loadNewTiles; },
    set loadNewTiles(value) { this._loadNewTiles = value; this.update(); }
});
