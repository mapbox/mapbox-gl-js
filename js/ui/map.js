'use strict';

var Dispatcher = require('../util/dispatcher.js'),
    util = require('../util/util.js'),
    Evented = require('../lib/evented.js'),

    Style = require('../style/style.js'),
    AnimationLoop = require('../style/animationloop.js'),
    GLPainter = require('../render/painter.js'),

    Transform = require('./transform.js'),
    Hash = require('./hash.js'),
    Handlers = require('./handlers.js'),
    Source = require('./source.js'),
    Easings = require('./easings.js'),
    LatLng = require('../geometry/latlng.js'),
    Point = require('../geometry/point.js');

// allow redefining Map here (jshint thinks it's global)
// jshint -W079

var Map = module.exports = function(options) {

    this.options = Object.create(this.options);
    util.extend(this.options, options);

    this.tileSize = 256;
    this.tiles = [];
    this.animationLoop = new AnimationLoop();
    this.transform = new Transform(this.tileSize, this.options.minZoom, this.options.maxZoom);
    this.hash = this.options.hash && new Hash(this);

    this._onStyleChange = this._onStyleChange.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);
    this.render = this.render.bind(this);

    this._setupContainer();
    this._setupPainter();
    this._setupContextHandler();

    this.handlers = this.options.interactive && new Handlers(this);
    this.dispatcher = new Dispatcher(this.options.numWorkers, this);

     // don't set position from options if set through hash
    if (!this.hash || !this.hash.onhash()) {
        this.setPosition(this.options.center, this.options.zoom, this.options.angle);
    }

    this.sources = {};
    var sources = this.options.sources;

    for (var id in sources) {
        sources[id].id = id;
        this.addSource(id, new Source(sources[id]));
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
        maxZoom: 18,
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
        this.container = this.options.container;

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

        this._styleDirty = this._styleDirty || updateStyle;
        this._tilesDirty = true;

        this._rerender();

        return this;
    },

    // Call when a (re-)render of the map is required, e.g. when the user panned or
    // zoomed or when new data is available.
    render: function() {
        this.dirty = false;

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

        var sources = this.sources;
        var painter = this.painter;
        var style = this.style;

        renderGroups(this.style.layerGroups, undefined);

        if (this.style.computed.background && this.style.computed.background.color) {
            this.painter.drawBackground(this.style.computed.background.color);
        }

        if (this._repaint || !this.animationLoop.stopped()) {
            this._styleDirty = true;
            this._rerender();
        }

        return this;

        function renderGroups(groups, name) {

            var i, len, group, source, k;

            // Render all dependencies (composited layers) to textures
            for (i = 0, len = groups.length; i < len; i++) {
                group = groups[i];

                for (k in group.dependencies) {
                    renderGroups(group.dependencies[k], k);
                }
            }

            // attach render destination. if no name, main canvas.
            painter.bindRenderTexture(name);

            // Render the groups
            for (i = 0, len = groups.length; i < len; i++) {
                group = groups[i];
                source = sources[group.source];
                if (source) {
                    painter.clearStencil();
                    source.render(group);
                } else if (group.composited) {
                    painter.draw(undefined, style, group, {});
                }
            }
        }
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
