'use strict';

var Dispatcher = require('../util/dispatcher.js');
var util = require('../util/util.js');
var evented = require('../lib/evented.js');

var Style = require('../style/style.js');
var AnimationLoop = require('../style/animationloop.js');
var GLPainter = require('../render/painter.js');

var Transform = require('./transform.js');
var Hash = require('./hash.js');
var Handlers = require('./handlers.js');
var Layer = require('./layer.js');

module.exports = Map;
function Map(config) {
    this.tileSize = 512;

    this.uuid = 1;
    this.tiles = [];

    this.animationLoop = new AnimationLoop();

    this._rerender = this._rerender.bind(this);
    this._updateBuckets = this._updateBuckets.bind(this);

    this.transform = new Transform(this.tileSize);

    this._setupContainer(config.container);
    if (config.hash) {
        this.hash = new Hash(this);
    }
    this._setupPosition(config);

    this.transform.minZoom = config.minZoom || 0;
    this.transform.maxZoom = config.maxZoom || 18;

    this.render = this.render.bind(this);

    this._setupPainter();
    this._setupContextHandler();

    this.handlers = new Handlers(this);
    this.dispatcher = new Dispatcher(4, this);

    this.dirty = false;

    this.layers = [];

    var map = this;
    for (var i = 0; config.layers && i < config.layers.length; i++) {
        var layer = new Layer(config.layers[i], map);
        map.fire('layer.add', [layer]);
        map.layers.push(layer);
    }

    this.resize();

    if (this.hash) {
        this.hash.onhash();
    }

    this.setStyle(config.style);
}

Map.prototype = {
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

    // show satellite
    _satellite: true,
    get satellite() { return this.getLayer('satellite').enabled; },
    set satellite(value) { this.setLayerStatus('satellite', value); this.update(); },

    // show streets
    _streets: true,
    get streets() { return this.getLayer('streets').enabled; },
    set streets(value) { this.setLayerStatus('streets', value); this.update(); },

    // show vertices
    _loadNewTiles: true,
    get loadNewTiles() { return this._loadNewTiles; },
    set loadNewTiles(value) { this._loadNewTiles = value; this.update(); }
};

evented(Map);

/*
 * Public API -----------------------------------------------------------------
 */

Map.prototype.getUUID = function() {
    return this.uuid++;
};


// Zooms to a certain zoom level with easing.
Map.prototype.zoomTo = function(zoom, duration, center) {
    if (this.cancelTransform) {
        this.cancelTransform();
    }

    if (typeof duration === 'undefined' || duration == 'default') {
        duration = 500;
    }

    if (typeof center === 'undefined') {
        var rect = map.container.getBoundingClientRect();
        center = { x: rect.width / 2, y: rect.height / 2 };
    }

    var map = this;
    var from = this.transform.scale,
          to = Math.pow(2, zoom);
    this.cancelTransform = util.timed(function(t) {
        var scale = util.interp(from, to, util.ease(t));
        map.transform.zoomAroundTo(scale, center);
        map.fire('zoom', [{ scale: scale }]);
        map.style.addClass(':zooming');
        map._updateStyle();
        map.update();
        if (t === 1) map.fire('move');
        if (t === 1) map.style.removeClass(':zooming');
    }, duration);
};

Map.prototype.scaleTo = function(scale, duration, center) {
    this.zoomTo(Math.log(scale) / Math.LN2, duration, center);
};

/*
 * Set the map's zoom, center, and rotation by setting these
 * attributes upstream on the transform.
 *
 * @param {number} zoom
 * @param {number} lat latitude
 * @param {number} lon longitude
 * @param {number} angle
 * @returns {this}
 */
Map.prototype.setPosition = function(zoom, lat, lon, angle) {
    this.transform.angle = +angle;
    this.transform.zoom = zoom - 1;
    this.transform.lat = lat;
    this.transform.lon = lon;
    this.fire('rotation');
    return this;
};

/*
 * Find a layer in the map
 *
 * @param {String} id the layer's id
 * @returns {Layer} or null
 */
Map.prototype.getLayer = function(id) {
    return this.layers.filter(function(l) {
        return l.id === id;
    })[0];
};

/*
 * Enable or disable a layer
 *
 * @param {String} id the layer's id
 * @returns {this}
 */
Map.prototype.setLayerStatus = function(id, enabled) {
    this.getLayer(id).enabled = !!enabled;
    return this;
};

/*
 * Detect the map's new width and height and resize it.
 */
Map.prototype.resize = function() {
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

    this.transform.width = width;
    this.transform.height = height;

    if (this.style && this.style.sprite) {
        this.style.sprite.resize(this.painter.gl);
    }

    this.painter.resize(width, height);
};

Map.prototype.resetNorth = function() {
    var map = this;
    var center = [ map.transform.width / 2, map.transform.height / 2 ];
    var start = map.transform.angle;
    map.rotating = true;
    util.timed(function(t) {
        map.setAngle(center, util.interp(start, 0, util.ease(t)));
        if (t === 1) {
            map.rotating = false;
        }
    }, 1000);
    map.setAngle(center, 0);
};

/*
 * Set the map's rotation given a center to rotate around and an angle
 * in radians.
 *
 * @param {object} center
 * @param {number} angle
 */
Map.prototype.setAngle = function(center, angle) {
    // Confine the angle to within [-π,π]
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;

    this.transform.angle = angle;

    this._updateStyle();
    this.fire('rotation');
    this.fire('move');
    this.update();
};

/*
 * Initial map configuration --------------------------------------------------
 */

Map.prototype._setupPosition = function(pos) {
    if (this.hash && this.hash.parseHash()) return;
    this.setPosition(pos.zoom, pos.lat, pos.lon, pos.rotation);
};

Map.prototype._setupContainer = function(container) {
    var map = this;
    this.container = container;

    // Setup WebGL canvas
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    if (container) {
        container.appendChild(canvas);
    }
    this.canvas = canvas;
};

Map.prototype._setupPainter = function() {
    //this.canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(this.canvas);
    //this.canvas.loseContextInNCalls(1000);
    var gl = this.canvas.getContext("experimental-webgl", {
        antialias: false,
        alpha: false,
        stencil: true
    });

    if (!gl) {
        alert('Failed to initialize WebGL');
        return;
    }

    this.painter = new GLPainter(gl);
};

Map.prototype._setupContextHandler = function() {
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
};

Map.prototype.addTile = function(tile) {
    if (this.tiles.indexOf(tile) < 0) {
        this.tiles.push(tile);
    }
};

Map.prototype.removeTile = function(tile) {
    var pos = this.tiles.indexOf(tile);
    if (pos >= 0) {
        this.tiles.splice(pos, 1);
    }
};

Map.prototype.findTile = function(id) {
    for (var i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i].id === id) {
            return this.tiles[i];
        }
    }
};

Map.prototype.featuresAt = function(x, y, params, callback) {
    var features = [];
    var error = null;
    util.async_each(this.layers, function(layer, callback) {
        layer.featuresAt(x, y, params, function(err, result) {
            if (result) features = features.concat(result);
            if (err) error = err;
            callback();
        });
    }, function() {
        callback(error, features);
    });
};

/*
 * Callbacks from web workers --------------------------------------------------
 */

Map.prototype['debug message'] = function(data) {
    console.log.apply(console, data);
};

Map.prototype['alert message'] = function(data) {
    alert.apply(window, data);
};

Map.prototype['add glyphs'] = function(params, callback) {
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
};

/*
 * Rendering -------------------------------------------------------------------
 */


Map.prototype._rerender = function() {
    if (!this.dirty) {
        this.dirty = true;
        this.requestId = util.frame(this.render);
    }
};

Map.prototype.setStyle = function(style) {

    var map = this;

    if (this.style) {
        this.style.off('change', this._rerender);
        this.style.off('buckets', this._updateBuckets);
    }

    this.style = new Style(style, this.animationLoop);

    this.style.on('change', function() {
        map._updateStyle();
        map._rerender();
    });

    this.style.on('buckets', this._updateBuckets);

    this.style.on('change:sprite', function() {
        if (!map.spriteCSS) {
            map.spriteCSS = document.createElement('style');
            map.spriteCSS.type = 'text/css';
            document.head.appendChild(map.spriteCSS);
        }
        map.spriteCSS.innerHTML = map.style.sprite.cssRules();
    });

    this._updateBuckets();
    this._updateStyle();
    map.update();
};

Map.prototype._updateStyle = function() {
    if (this.style) {
        this.style.recalculate(this.transform.z);
    }
};

Map.prototype._updateBuckets = function() {
    // Transfer a stripped down version of the style to the workers. They only
    // need the bucket information to know what features to extract from the tile.
    this.dispatcher.broadcast('set buckets', this.style.stylesheet.buckets);

    // clears all tiles to recalculate geometries (for changes to linecaps, linejoins, ...)
    for (var t in this.tiles) {
        this.tiles[t]._load();
    }

    this.update();
};

Map.prototype.update = function() {
    this.layers.forEach(function(layer) {
        layer.update();
    });
    this._rerender();
};

// Call when a (re-)render of the map is required, e.g. when the user panned or
// zoomed or when new data is available.
Map.prototype.render = function() {
    this.dirty = false;

    if (this.style.computed.background && this.style.computed.background.color) {
        this.painter.clear(this.style.computed.background.color.gl());
    }

    this.layers.forEach(function(layer) {
        layer.render();
    });


    if (this._repaint || !this.animationLoop.stopped()) {
        this._updateStyle();
        this._rerender();
    }
};
