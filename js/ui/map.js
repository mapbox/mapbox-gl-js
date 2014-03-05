'use strict';

var Dispatcher = require('../util/dispatcher.js'),
    util = require('../util/util.js'),
    evented = require('../lib/evented.js'),

    Style = require('../style/style.js'),
    AnimationLoop = require('../style/animationloop.js'),
    GLPainter = require('../render/painter.js'),

    Transform = require('./transform.js'),
    Hash = require('./hash.js'),
    Handlers = require('./handlers.js'),
    Source = require('./source.js'),
    Easings = require('./easings.js');


// jshint -W079
var Map = module.exports = function(config) {
    this.tileSize = 512;

    this.uuid = 1;
    this.tiles = [];

    this.animationLoop = new AnimationLoop();

    this._onStyleChange = this._onStyleChange.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);
    this.render = this.render.bind(this);

    this.transform = new Transform(this.tileSize);

    this._setupContainer(config.container);
    if (config.hash) {
        this.hash = new Hash(this);
    }
    this._setupPosition(config);

    this.transform.minZoom = config.minZoom || 0;
    this.transform.maxZoom = config.maxZoom || 18;

    this._setupPainter();
    this._setupContextHandler();

    this.handlers = new Handlers(this);
    this.dispatcher = new Dispatcher(7, this);

    this.dirty = false;

    this.sources = {};

    if (config.sources) {
        for (var id in config.sources) {
            config.sources[id].id = id;
            this.addSource(id, new Source(config.sources[id]));
        }
    }

    this.resize();

    if (this.hash) {
        this.hash.onhash();
    }

    this.setStyle(config.style);
};

evented(Map);

util.extend(Map.prototype, Easings);
util.extend(Map.prototype, {

    getUUID: function() {
        return this.uuid++;
    },

    addSource: function(id, source) {
        this.sources[id] = source;
        source.id = id;
        if (source.onAdd) {
            source.onAdd(this);
        }
        return this.fire('source.add', [source]);
    },

    removeSource: function(id) {
        var source = this.sources[id];
        if (source.onRemove) {
            source.onRemove(this);
        }
        delete this.sources[id];
        return this.fire('source.remove', [source]);
    },

    // Set the map's zoom, center, and rotation
    setPosition: function(zoom, lat, lon, angle) {
        this.transform.angle = +angle;
        this.transform.zoom = zoom - 1;
        this.transform.lat = +lat;
        this.transform.lon = +lon;
        return this;
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

        // Move the x/y transform so that the center of the map stays the same when
        // resizing the viewport.
        // if (this.transform.width !== null && this.transform.height !== null) {
        //     this.transform.x += (width - this.transform.width) / 2;
        //     this.transform.y += (height - this.transform.height) / 2;
        // }

        this.transform.setSize(width, height);

        if (this.style && this.style.sprite) {
            this.style.sprite.resize(this.painter.gl);
        }

        this.painter.resize(width, height);
        return this;
    },

    // Set the map's rotation given a center to rotate around and an angle in radians.
    setAngle: function(angle) {
        // Confine the angle to within [-π,π]
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        this.transform.angle = angle;
        this.update();

        return this
            .fire('rotation')
            .fire('move');
    },

    featuresAt: function(x, y, params, callback) {
        var features = [];
        var error = null;
        var map = this;

        util.asyncEach(Object.keys(this.sources), function(id, callback) {
            var source = map.sources[id];
            source.featuresAt(x, y, params, function(err, result) {
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

    _setupPosition: function(pos) {
        if (this.hash && this.hash.parseHash()) return;
        this.setPosition(pos.zoom, pos.lat, pos.lon, pos.rotation);
    },

    _setupContainer: function(container) {
        this.container = container;

        // Setup WebGL canvas
        var canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        if (container) {
            container.appendChild(canvas);
        }
        this.canvas = canvas;
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

        this.painter = new GLPainter(gl);
    },

    _setupContextHandler: function() {
        var map = this;
        this.canvas.addEventListener('webglcontextlost', function(event) {
            event.preventDefault();
            if (map.requestId) {
                (window.cancelRequestAnimationFrame ||
                    window.mozCancelRequestAnimationFrame ||
                    window.webkitCancelRequestAnimationFrame ||
                    window.msCancelRequestAnimationFrame)(map.requestId);
            }
        }, false);
        this.canvas.addEventListener('webglcontextrestored', function() {
            for (var id in map.tiles) {
                if (map.tiles[id].geometry) {
                    map.tiles[id].geometry.unbind();
                }
            }
            map._setupPainter();

            map.dirty = false;
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

    'add glyphs': function(params, callback) {
        var tile = this.findTile(params.id);
        if (!tile) {
            callback('tile does not exist anymore');
            return;
        }

        var glyphAtlas = this.painter.glyphAtlas;
        var rects = {};
        for (var name in params.faces) {
            var face = params.faces[name];
            rects[name] = {};

            for (var id in face.glyphs) {
                // TODO: use real value for the buffer
                rects[name][id] = glyphAtlas.addGlyph(params.id, name, face.glyphs[id], 3);
            }
        }
        callback(null, rects);
    },


    // Rendering

    update: function(updateStyle) {

        if (!this.style) return;

        for (var id in this.sources) {
            this.sources[id].update();
        }

        this._styleDirty = this._styleDirty || updateStyle;

        this._rerender();

        return this;
    },

    // Call when a (re-)render of the map is required, e.g. when the user panned or
    // zoomed or when new data is available.
    render: function() {
        this.dirty = false;
        this.painter.clear();

        if (this._styleDirty) {
            this._styleDirty = false;
            this._updateStyle();
        }

        var groups = this.style.layerGroups;

        for (var i = 0, len = groups.length; i < len; i++) {
            var ds = this.sources[groups[i].source];
            if (ds) {
                this.painter.clearStencil();
                ds.render(groups[i]);
            }
        }

        if (this.style.computed.background && this.style.computed.background.color) {
            this.painter.drawBackground(this.style.computed.background.color, true);
        }

        if (this._repaint || !this.animationLoop.stopped()) {
            this._styleDirty = true;
            this._rerender();
        }

        return this;
    },

    _rerender: function() {
        if (!this.dirty) {
            this.dirty = true;
            this.requestId = util.frame(this.render);
        }
    },

    _onStyleChange: function () {
        this.update(true);
    },

    _updateStyle: function() {
        if (this.style) {
            this.style.recalculate(this.transform.z);
        }
    },

    _updateBuckets: function() {
        // Transfer a stripped down version of the style to the workers. They only
        // need the bucket information to know what features to extract from the tile.
        this.dispatcher.broadcast('set buckets', this.style.stylesheet.buckets);

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
