'use strict';

var Dispatcher = require('../util/dispatcher');
var Canvas = require('../util/canvas');
var util = require('../util/util');
var browser = require('../util/browser');
var ajax = require('../util/ajax');
var Evented = require('../util/evented');

var Style = require('../style/style');
var AnimationLoop = require('../style/animation_loop');
var GLPainter = require('../render/painter');

var Transform = require('../geo/transform');
var Hash = require('./hash');
var Handlers = require('./handlers');
var Source = require('../source/source');
var Easings = require('./easings');
var LatLng = require('../geo/lat_lng');
var LatLngBounds = require('../geo/lat_lng_bounds');
var Point = require('point-geometry');
var GlyphSource = require('../symbol/glyph_source');
var Attribution = require('./control/attribution');

// allow redefining Map here (jshint thinks it's global)
// jshint -W079

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

    this._onStyleChange = this._onStyleChange.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);
    this.render = this.render.bind(this);

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

    if (typeof options.style === 'object') {
        this.setStyle(options.style);

    } else if (typeof options.style === 'string') {
        ajax.getJSON(options.style, function (err, data) {
            if (err) throw err;
            this.setStyle(data);
        }.bind(this));
    }

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

    addSource: function(id, source) {
        if (this.sources[id] !== undefined) {
          throw new Error('There is already a source with this ID in the map');
        }
        this.sources[id] = source;
        source.id = id;
        if (source.onAdd) {
            source.onAdd(this);
        }
        if (source.enabled) source.fire('source.add', {source: source});
        return this;
    },

    removeSource: function(id) {
        var source = this.sources[id];
        if (source.onRemove) {
            source.onRemove(this);
        }
        delete this.sources[id];
        return this.fire('source.remove', {source: source});
    },

    addControl: function(control) {
        control.addTo(this);
        return this;
    },

    // Set the map's center, zoom, and bearing
    setView: function(center, zoom, bearing) {
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

    setCenter: function(center) {
        this.setView(center, this.getZoom(), this.getBearing());
    },

    setZoom: function(zoom) {
        this.setView(this.getCenter(), zoom, this.getBearing());
    },

    setBearing: function(bearing) {
        this.setView(this.getCenter(), this.getZoom(), bearing);
    },

    getCenter: function() { return this.transform.center; },
    getZoom: function() { return this.transform.zoom; },
    getBearing: function() { return this.transform.bearing; },

    // Detect the map's new width and height and resize it.
    resize: function() {
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

    getBounds: function() {
        return new LatLngBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));
    },

    project: function(latlng) {
        return this.transform.locationPoint(LatLng.convert(latlng));
    },
    unproject: function(point) {
        return this.transform.pointLocation(Point.convert(point));
    },

    featuresAt: function(point, params, callback) {
        var features = [];
        var error = null;

        point = Point.convert(point);

        util.asyncEach(Object.keys(this.sources), function(id, callback) {
            var source = this.sources[id];
            source.featuresAt(point, params, function(err, result) {
                if (result) features = features.concat(result);
                if (err) error = err;
                callback();
            });
        }.bind(this), function() {
            callback(error, features);
        });
        return this;
    },

    setStyle: function(style) {
        if (this.style) {
            this.style.off('change', this._onStyleChange);
        }

        if (style instanceof Style) {
            this.style = style;
        } else {
            this.style = new Style(style, this.animationLoop);
        }

        var sources = this.style.stylesheet.sources;
        for (var id in sources) {
            this.addSource(id, Source.create(sources[id]));
        }

        this.glyphSource = new GlyphSource(this.style.stylesheet.glyphs, this.painter.glyphAtlas);

        this.style.on('change', this._onStyleChange);

        this._styleDirty = true;
        this._tilesDirty = true;

        this._updateBuckets();

        this.fire('style.change');

        return this;
    },

    _move: function (zoom, rotate) {

        this.update(zoom).fire('move');

        if (zoom) this.fire('zoom');
        if (rotate) this.fire('rotate');

        return this;
    },

    // map setup code

    _setupContainer: function() {
        var id = this.options.container;
        var container = this.container = typeof id === 'string' ? document.getElementById(id) : id;
        if (container) container.classList.add('mapboxgl-map');
        this.canvas = new Canvas(this, container);
    },

    _setupPainter: function() {
        var gl = this.canvas.getWebGLContext();

        if (!gl) {
            alert('Failed to initialize WebGL');
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

    // Callbacks from web workers

    'debug message': function(data) {
        console.log.apply(console, data);
    },

    'alert message': function(data) {
        alert.apply(window, data);
    },

    'get sprite json': function(params, callback) {
        var sprite = this.style.sprite;
        if (sprite.loaded()) {
            callback(null, { sprite: sprite.data, retina: sprite.retina });
        } else {
            sprite.on('loaded', function() {
                callback(null, { sprite: sprite.data, retina: sprite.retina });
            });
        }
    },

    'get glyphs': function(params, callback) {
        this.glyphSource.getRects(params.fontstack, params.codepoints, params.id, callback);
    },

    // Rendering

    update: function(updateStyle) {

        if (!this.style) return this;

        this._styleDirty = this._styleDirty || updateStyle;
        this._tilesDirty = true;

        this._rerender();

        return this;
    },

    // Call when a (re-)render of the map is required, e.g. when the user panned or zoomed,f or new data is available.
    render: function() {
        if (this._styleDirty) {
            this._styleDirty = false;
            this._updateStyle();
        }

        if (this._tilesDirty) {
            for (var id in this.sources) {
                this.sources[id].update();
            }
            this._tilesDirty = false;
        }

        this._renderGroups(this.style.layerGroups);
        this.fire('render');

        this._frameId = null;

        if (!this.animationLoop.stopped()) {
            this._styleDirty = true;
        }

        if (this._repaint || !this.animationLoop.stopped()) {
            this._rerender();
        }

        return this;
    },

    remove: function() {
        this.dispatcher.remove();
        return this;
    },

    _renderGroups: function(groups) {
        this.painter.prepareBuffers();

        var i, len, group, source;

        // Render the groups
        for (i = 0, len = groups.length; i < len; i++) {
            group = groups[i];
            source = this.sources[group.source];

            if (source) {
                this.painter.clearStencil();
                source.render(group);

            } else if (group.source === undefined) {
                this.painter.draw(undefined, this.style, group, { background: true });
            }
        }
    },

    _rerender: function() {
        if (this.style && !this._frameId) {
            this._frameId = browser.frame(this.render);
        }
    },

    _onStyleChange: function () {
        this.update(true);
    },

    _updateStyle: function() {
        if (!this.style) return;
        this.style.recalculate(this.transform.zoom);
    },

    _updateBuckets: function() {
        // Transfer a stripped down version of the style to the workers. They only
        // need the bucket information to know what features to extract from the tile.
        this.dispatcher.broadcast('set buckets', this.style.orderedBuckets);

        // clears all tiles to recalculate geometries (for changes to linecaps, linejoins, ...)
        for (var s in this.sources) {
            this.sources[s].load();
        }

        this.update();
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
