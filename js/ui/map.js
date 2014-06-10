'use strict';

var Dispatcher = require('../util/dispatcher.js'),
    util = require('../util/util.js'),
    Evented = require('../util/evented.js'),

    Style = require('../style/style.js'),
    AnimationLoop = require('../style/animationloop.js'),
    GLPainter = require('../render/painter.js'),

    Transform = require('./transform.js'),
    Hash = require('./hash.js'),
    Handlers = require('./handlers.js'),
    Source = require('./source.js'),
    VideoSource = require('./videosource.js'),
    Easings = require('./easings.js'),
    LatLng = require('../geometry/latlng.js'),
    LatLngBounds = require('../geometry/latlngbounds.js'),
    Point = require('../geometry/point.js');

// allow redefining Map here (jshint thinks it's global)
// jshint -W079

var Map = module.exports = function(options) {

    this.options = Object.create(this.options);
    options = util.extend(this.options, options);

    this.tileSize = 256;
    this.tiles = [];
    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(this.tileSize, options.minZoom, options.maxZoom);
    this.hash = options.hash && new Hash(this);

    this._onStyleChange = this._onStyleChange.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);
    this.render = this.render.bind(this);

    this._setupContainer();
    this._setupPainter();
    this._setupContextHandler();

    this.handlers = options.interactive && new Handlers(this);
    this.dispatcher = new Dispatcher(options.numWorkers, this);

     // don't set position from options if set through hash
    if (!this.hash || !this.hash.onhash()) {
        this.setPosition(options.center, options.zoom, options.angle);
    }

    this.sources = {};
    var sources = options.sources;

    this.stacks = {};

    for (var id in sources) {
        sources[id].id = id;
        var source = sources[id].type === 'video' ?
            new VideoSource(sources[id]) :
            new Source(sources[id]);
        this.addSource(id, source);
    }

    this.resize();

    this.setStyle(options.style);
};

util.extend(Map.prototype, Evented);
util.extend(Map.prototype, Easings);
util.extend(Map.prototype, {

    options: {
        center: [0, 0],
        zoom: 0,
        angle: 0,

        minZoom: 0,
        maxZoom: 20,
        numWorkers: 7,

        adjustZoom: true,
        minAdjustZoom: 6,
        maxAdjustZoom: 9,

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

    // Set the map's zoom, center, and rotation
    setPosition: function(latlng, zoom, angle) {
        this.transform.center = LatLng.convert(latlng);
        this.transform.zoom = +zoom;
        this.transform.angle = +angle;

        return this.update(true);
    },

    // Detect the map's new width and height and resize it.
    resize: function() {
        this.pixelRatio = window.devicePixelRatio || 1;

        var width = 0, height = 0;
        if (this.container) {
            width = this.container.offsetWidth || 400;
            height = this.container.offsetHeight || 300;
        }

        // Request the required canvas size taking the pixelratio into account.
        this.canvas.width = this.pixelRatio * width;
        this.canvas.height = this.pixelRatio * height;

        // Maintain the same canvas size, potentially downscaling it for HiDPI displays
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.transform.width = width;
        this.transform.height = height;

        if (this.style && this.style.sprite) {
            this.style.sprite.resize(this.painter.gl);
        }

        this.painter.resize(width, height);
        return this;
    },

    // Set the map's rotation given an offset from center to rotate around and an angle in radians.
    setAngle: function(angle, offset) {
        // Confine the angle to within [-π,π]
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        offset = Point.convert(offset);

        if (offset) this.transform.panBy(offset);
        this.transform.angle = angle;
        if (offset) this.transform.panBy(offset.mult(-1));

        this.update();

        return this
            .fire('rotation')
            .fire('move');
    },

    getBounds: function() {
        return new LatLngBounds(
            this.transform.pointLocation(new Point(0, 0)),
            this.transform.pointLocation(this.transform.size));
    },

    getCenter: function() { return this.transform.center; },
    getZoom: function() { return this.transform.zoom; },
    getAngle: function() { return this.transform.angle; },

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
            this.style.off('change:buckets', this._updateBuckets);
        }

        if (style instanceof Style) {
            this.style = style;
        } else {
            this.style = new Style(style, this.animationLoop);
        }

        this.style.on('change', this._onStyleChange);
        this.style.on('change:buckets', this._updateBuckets);

        this._updateBuckets();
        return this.update(true);
    },

    addTile: function(tile) {
        if (this.tiles.indexOf(tile) < 0) {
            this.tiles.push(tile);
        }
    },

    removeTile: function(tile) {
        var pos = this.tiles.indexOf(tile);
        if (pos >= 0) {
            this.tiles.splice(pos, 1);
        }
    },

    findTile: function(id) {
        for (var i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i].id === id) {
                return this.tiles[i];
            }
        }
    },


    // map setup code

    _setupContainer: function() {
        var id = this.options.container;
        this.container = typeof id === 'string' ? document.getElementById(id) : id;

        // Setup WebGL canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.container.appendChild(this.canvas);
    },

    _setupPainter: function() {
        //this.canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(this.canvas);
        //this.canvas.loseContextInNCalls(1000);
        var gl = this.canvas.getContext("experimental-webgl", {
            antialias: false,
            alpha: true,
            stencil: true,
            depth: false
        });

        if (!gl) {
            alert('Failed to initialize WebGL');
            return;
        }

        this.painter = new GLPainter(gl, this.transform);
    },

    _setupContextHandler: function() {
        var map = this;
        this.canvas.addEventListener('webglcontextlost', function(event) {
            event.preventDefault();
            if (map._frameId) {
                (window.cancelRequestAnimationFrame ||
                    window.mozCancelRequestAnimationFrame ||
                    window.webkitCancelRequestAnimationFrame ||
                    window.msCancelRequestAnimationFrame)(map._frameId);
            }
        }, false);
        this.canvas.addEventListener('webglcontextrestored', function() {
            for (var id in map.tiles) {
                if (map.tiles[id].geometry) {
                    map.tiles[id].geometry.unbind();
                }
            }
            map._setupPainter();

            map.resize();
            map.update();
        }, false);
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
        callback(null, this.style.sprite && this.style.sprite.data);
    },

    'add glyphs': function(params, callback) {
        var tile = this.findTile(params.id);
        if (!tile && params.id != -1) {
            callback('tile does not exist anymore');
            return;
        }

        var glyphAtlas = this.painter.glyphAtlas;
        var rects = glyphAtlas.getRects();
        for (var name in params.stacks) {
            var fontstack = params.stacks[name];
            if (!rects[name]) {
                rects[name] = {};
            }

            for (var id in fontstack.glyphs) {
                // TODO: use real value for the buffer
                rects[name][id] = glyphAtlas.addGlyph(params.id, name, fontstack.glyphs[id], 3);
            }
        }
        callback(null, rects);
    },

    'add glyph range': function(params, callback) {
        for (var name in params.stacks) {
            if (!this.stacks[name]) this.stacks[name] = {};

            var fontstack = params.stacks[name];
            this.stacks[name][fontstack.range] = fontstack.glyphs;

            // Notify workers that glyph range has been loaded.
            callback(null, fontstack.glyphs);
        }
    },


    // Rendering

    update: function(updateStyle) {

        if (!this.style) return;

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

        var bgColor = this.style.computed.background && this.style.computed.background['fill-color'];
        if (bgColor) {
            this.painter.drawBackground(bgColor);
        }

        this._frameId = null;

        if (this._repaint || !this.animationLoop.stopped()) {
            this._styleDirty = true;
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
            }
        }
    },

    _rerender: function() {
        if (!this._frameId) {
            this._frameId = util.frame(this.render);
        }
    },

    _onStyleChange: function () {
        this.update(true);
    },

    getZoomAdjustment: function () {
        if (!this.options.adjustZoom) return 0;

        // adjust zoom value based on latitude to compensate for Mercator projection distortion;
        // start increasing adjustment from 0% at minAdjustZoom to 100% at maxAdjustZoom

        var scale = this.transform.scaleZoom(1 / Math.cos(this.transform.center.lat * Math.PI / 180)),
            part = Math.min(Math.max(this.transform.zoom - this.options.minAdjustZoom, 0) /
                    (this.options.maxAdjustZoom - this.options.minAdjustZoom), 1);
        return scale * part;
    },

    _updateStyle: function() {
        if (!this.style) return;
        this.style.recalculate(this.transform.zoom + this.getZoomAdjustment());
    },

    _updateBuckets: function() {
        // Transfer a stripped down version of the style to the workers. They only
        // need the bucket information to know what features to extract from the tile.
        this.dispatcher.broadcast('set buckets', this.style.stylesheet);

        // clears all tiles to recalculate geometries (for changes to linecaps, linejoins, ...)
        for (var t in this.tiles) {
            this.tiles[t]._load();
        }

        this.update();
    },

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
