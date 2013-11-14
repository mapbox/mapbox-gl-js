'use strict';

var Transform = require('./transform.js');
var Hash = require('./hash.js');
var Style = require('./parse_style.js');
var ImageSprite = require('./imagesprite.js');
var GLPainter = require('./painter.js');
var Interaction = require('./interaction.js');
var Dispatcher = require('./dispatcher.js');
var Layer = require('./layer.js');
var util = require('./util.js');
var bean = require('./lib/bean.js');

module.exports = Map;
function Map(config) {
    this.tileSize = 512;

    this.uuid = 1;
    this.tiles = [];

    this.transform = new Transform(this.tileSize);

    this._setupContainer(config.container);
    if (config.hash) {
        this.hash = new Hash(this);
    }
    this._setupPosition(config);

    this.transform.minZoom = config.minZoom || 0;
    this.transform.maxZoom = config.maxZoom || 18;

    this.render = this.render.bind(this);

    this._setupStyle(config.style);
    this._setupPainter();
    this._setupContextHandler();
    this._setupEvents();
    this._setupDispatcher();

    this.dirty = false;
    this._updateStyle();

    this.layers = [];

    var map = this;
    setTimeout(function() {
        for (var i = 0; config.layers && i < config.layers.length; i++) {
            var layer = new Layer(config.layers[i], map);
            bean.fire(map, 'layer.add', layer);
            map.layers.push(layer);
        }
        map.update();
    });

    this.resize();

    if (this.hash) {
        this.hash.onhash();
    }
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

/*
 * Public API -----------------------------------------------------------------
 */

Map.prototype.on = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this);
    bean.on.apply(bean, args);
    return this;
};

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
        var scale = util.interp(from, to, util.easeCubicInOut(t));
        map.transform.zoomAroundTo(scale, center);
        bean.fire(map, 'zoom', { scale: scale });
        map._updateStyle();
        map.update();
        if (t === 1) bean.fire(map, 'move');
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

    if (this.style.sprite) {
        this.style.sprite.resize(this.painter.gl);
    }

    this.painter.resize(width, height);
};

Map.prototype.resetNorth = function() {
    var map = this;
    var center = [ map.transform.width / 2, map.transform.height / 2 ];
    var start = map.transform.angle;
    util.timed(function(t) {
        map.setAngle(center, util.interp(start, 0, util.easeCubicInOut(t)));
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
    bean.fire(this, 'move');
    this.update();
};

Map.prototype.switchStyle = function(style) {
    this._setupStyle(style);
    this._updateStyle(style);

    // Transfer a stripped down version of the style to the workers. They only
    // need the bucket information to know what features to extract from the tile.
    this.dispatcher.broadcast('set buckets', JSON.stringify(this.style.buckets));

    // clears all tiles to recalculate geometries (for changes to linecaps, linejoins, ...)
    for (var t in this.tiles) {
        this.tiles[t]._load();
    }
    // this.cache.reset();
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

// Adds pan/zoom handlers and triggers the necessary events
Map.prototype._setupEvents = function() {
    var map = this;
    var rotateEnd, zoomEnd;

    this.interaction = new Interaction(this.container)
        .on('resize', function() {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.transform.panBy(x, y);
            bean.fire(map, 'move');
            map.update();
        })
        .on('panend', function(x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            map.cancelTransform = util.timed(function(t) {
                map.transform.panBy(Math.round(x * (1 - t)), Math.round(y * (1 - t)));
                map._updateStyle();
                map.update();
            }, 500);
        })
        .on('zoom', function(delta, x, y) {
            if (map.cancelTransform) { map.cancelTransform(); }
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;
            if (delta === Infinity || delta === -Infinity) {
                map.scaleTo(map.transform.scale * scale, 200, { x: x, y: y });
            } else {
                map.scaleTo(map.transform.scale * scale, 0, { x: x, y: y });
            }

            map.zooming = true;
            window.clearTimeout(zoomEnd);
            zoomEnd = window.setTimeout(function() {
                map.zooming = false;
                map._rerender();
            }, 200);
        })
        .on('rotate', function(beginning, start, end) {
            var rect = map.container.getBoundingClientRect();
            var center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, // Center of rotation
                beginningToCenter = util.vectorSub(beginning, center),
                beginningToCenterDist = util.vectorMag(beginningToCenter);

            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (beginningToCenterDist < 200) {
                center = util.vectorAdd(beginning, util.rotate(Math.atan2(beginningToCenter.y, beginningToCenter.x), { x: -200, y: 0 }));
            }

            bean.fire(map, 'move');
            map.setAngle(center, map.transform.angle + util.angleBetween(util.vectorSub(start, center), util.vectorSub(end, center)));

            map.rotating = true;
            window.clearTimeout(rotateEnd);
            rotateEnd = window.setTimeout(function() {
                map.rotating = false;
                map._rerender();
            }, 200);
        });
};

Map.prototype._setupDispatcher = function() {
    this.dispatcher = new Dispatcher(4, this);
    this.dispatcher.broadcast('set buckets', JSON.stringify(this.style.buckets));
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
}

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

Map.prototype._setupStyle = function(style) {
    if (!style.buckets) style.buckets = {};
    if (!style.constants) style.constants = {};

    // util.deepFreeze(style.buckets);
    // util.deepFreeze(style.constants);

    this.style = {
        // These are frozen == constant values
        buckets: style.buckets,
        constants: style.constants
    };

    // These are new == mutable values
    this.style.layers = style.layers;
    this.style.parsed = Style.parse(this.style.layers || [], this.style.constants);
    this.style.background = Style.parseColor(style.background || '#FFFFFF', this.style.constants);

    if (style.sprite) {
        this.style.sprite = new ImageSprite(style.sprite, rerender);
    }

    var map = this;
    function rerender() { map._rerender(); }
};

Map.prototype.setLayerStyles = function(layers) {
    this.style.parsed = Style.parse(layers || [], this.style.constants);
    this._updateStyle();
    this._rerender();
};

Map.prototype.setBackgroundColor = function(color) {
    this.style.background = Style.parseColor(color || '#FFFFFF', this.style.constants);
    this._updateStyle();
    this._rerender();
};

Map.prototype.setBuckets = function(buckets) {
    this.style.buckets = buckets;
    this._updateBuckets();
};

Map.prototype._updateStyle = function() {
    this.style.zoomed = Style.parseZoom(this.style.parsed, this.style.constants, this.transform.z);
};

Map.prototype._updateBuckets = function() {
    // Transfer a stripped down version of the style to the workers. They only
    // need the bucket information to know what features to extract from the tile.
    this.dispatcher.broadcast('set buckets', JSON.stringify(this.style.buckets));

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

    this.painter.clear(this.style.background);

    this.layers.forEach(function(layer) {
        layer.render();
    });


    if (this._repaint) {
        this._rerender();
    }
};
