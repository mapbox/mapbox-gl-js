'use strict';

var Dispatcher = require('../util/dispatcher.js'),
    Canvas = require('../util/canvas.js'),
    util = require('../util/util.js'),
    browser = require('../util/browser.js'),
    ajax = require('../util/ajax.js'),
    Evented = require('../util/evented.js'),

    Style = require('../style/style.js'),
    AnimationLoop = require('../style/animationloop.js'),
    GLPainter = require('../render/painter.js'),

    Transform = require('../geo/transform.js'),
    Hash = require('./hash.js'),
    Handlers = require('./handlers.js'),
    Source = require('../source/source.js'),
    Easings = require('./easings.js'),
    LatLng = require('../geo/latlng.js'),
    LatLngBounds = require('../geo/latlngbounds.js'),
    Point = require('point-geometry'),
    GlyphSource = require('../symbol/glyphsource.js');

// allow redefining Map here (jshint thinks it's global)
// jshint -W079

var Map = module.exports = function(options) {

    this.options = Object.create(this.options);
    options = util.extend(this.options, options);

    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(options.minZoom, options.maxZoom);
    this.hash = options.hash && new Hash(this);

    this._onStyleChange = this._onStyleChange.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);
    this.render = this.render.bind(this);

    this._setupContainer();
    this._setupPainter();

    this.handlers = options.interactive && new Handlers(this);
    this.dispatcher = new Dispatcher(options.numWorkers, this);

     // don't set position from options if set through hash
    if (!this.hash || !this.hash.onhash()) {
        this.setPosition(options.center, options.zoom, options.bearing);
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
        hash: false
    },

    addSource: function(id, source) {
        this.sources[id] = source;
        source.id = id;
        if (source.onAdd) {
            source.onAdd(this);
        }
        return this.fire('source.add', {source: source});
    },

    removeSource: function(id) {
        var source = this.sources[id];
        if (source.onRemove) {
            source.onRemove(this);
        }
        delete this.sources[id];
        return this.fire('source.remove', {source: source});
    },

    // Set the map's center, zoom, and bearing
    setPosition: function(latlng, zoom, bearing) {

        var tr = this.transform,
            zoomChanged = tr.zoom !== +zoom,
            bearingChanged = tr.bearing !== +bearing;

        tr.center = LatLng.convert(latlng);
        tr.zoom = +zoom;
        tr.bearing = +bearing;

        return this
            .fire('movestart')
            ._move(zoomChanged, bearingChanged)
            .fire('moveend');
    },

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

    // Set the map's rotation given an offset from center to rotate around and an angle in degrees.
    setBearing: function(bearing, offset) {
        this.transform.rotate(bearing, Point.convert(offset));
        return this
            .fire('movestart')
            ._move(false, true)
            .fire('moveend');
    },

    getBounds: function() {
        return new LatLngBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));
    },

    getCenter: function() { return this.transform.center; },
    getZoom: function() { return this.transform.zoom; },
    getBearing: function() { return this.transform.bearing; },

    project: function(latlng) {
        return this.transform.locationPoint(latlng);
    },
    unproject: function(point) {
        return this.transform.pointLocation(point);
    },

    featuresAt: function(point, params, callback) {
        var features = [];
        var error = null;
        var map = this;

        point = Point.convert(point);

        util.asyncEach(Object.keys(this.sources), function(id, callback) {
            var source = map.sources[id];
            source.featuresAt(point, params, function(err, result) {
                if (result) features = features.concat(result);
                if (err) error = err;
                callback();
            });
        }, function() {
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
        this._updateGlyphs();

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
        this.container = typeof id === 'string' ? document.getElementById(id) : id;
        this.canvas = new Canvas(this, this.container);
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
        // @TODO have a listener queue if sprite data is not set.
        var sprite = this.style.sprite;
        callback(null, sprite && { sprite: sprite.data, retina: sprite.retina });
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

    _renderGroups: function(groups, name) {

        var i, len, group, source, k;

        // Render all dependencies (composited layers) to textures
        for (i = 0, len = groups.length; i < len; i++) {
            group = groups[i];

            for (k in group.dependencies) {
                this._renderGroups(group.dependencies[k], k);
            }
        }

        // attach render destination. if no name, main canvas.
        this.painter.bindRenderTexture(name);

        // Render the groups
        for (i = 0, len = groups.length; i < len; i++) {
            group = groups[i];
            source = this.sources[group.source];

            if (source) {
                this.painter.clearStencil();
                source.render(group);

            } else if (group.composited) {
                this.painter.draw(undefined, this.style, group, {});
            } else if (group.source === undefined) {
                this.painter.draw(undefined, this.style, group, { background: true });
            }
        }
    },

    _rerender: function() {
        if (!this._frameId) {
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

    _updateGlyphs: function() {
        this.dispatcher.broadcast('set glyphs', this.style.stylesheet.glyphs);
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
    set debug(value) { this._debug = value; this._rerender(); },

    // continuous repaint
    _repaint: false,
    get repaint() { return this._repaint; },
    set repaint(value) { this._repaint = value; this._rerender(); },

    // polygon antialiasing
    _antialiasing: true,
    get antialiasing() { return this._antialiasing; },
    set antialiasing(value) { this._antialiasing = value; this._rerender(); },

    // show vertices
    _vertices: false,
    get vertices() { return this._vertices; },
    set vertices(value) { this._vertices = value; this._rerender(); },

    // show vertices
    _loadNewTiles: true,
    get loadNewTiles() { return this._loadNewTiles; },
    set loadNewTiles(value) { this._loadNewTiles = value; this.update(); }
});
