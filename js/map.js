function Map(config) {
    this.tileSize = 512;

    this.uuid = 1;
    this.tiles = [];

    this.transform = new Transform(this.tileSize);

    this._setupContainer(config.container);
    this.hash = new Hash(this);
    this._setupPosition(config);

    this.transform.minZoom = config.minZoom || 0;
    this.transform.maxZoom = config.maxZoom || 18;
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);
    this.render = this.render.bind(this);

    this._setupStyle(config.style);
    this._setupPainter();
    this._setupContextHandler();
    this._setupEvents();
    this._setupDispatcher();

    this.dirty = false;
    this._updateStyle();

    this.layers = [];
    for (var i = 0; config.layers && i < config.layers.length; i++) {
        this.layers.push(new Layer(config.layers[i], this));
    }

    this.resize();

    this.hash.onhash();
    this.update();
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

Map.prototype.getUUID = function() {
    return this.uuid++;
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

    var width = this.container.offsetWidth,
        height = this.container.offsetHeight;

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

    this.style.image_sprite.resize(this.painter.gl);
    this.painter.resize(width, height);
};

Map.prototype.resetNorth = function() {
    var map = this;
    var center = [ map.transform.width / 2, map.transform.height / 2 ];
    var start = map.transform.angle;
    timed(function(t) {
        map.setAngle(center, interp(start, 0, easeCubicInOut(t)));
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
    // need the layer => bucket mapping, as well as the bucket descriptions.
    this.dispatcher.broadcast('set style', {
        mapping: this.style.mapping,
        buckets: this.style.buckets
    });

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
    if (this.hash.parseHash()) return;
    this.setPosition(pos.zoom, pos.lat, pos.lon, pos.rotation);
};

Map.prototype._setupContainer = function(container) {
    var map = this;
    this.container = container;

    // Setup WebGL canvas
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    container.appendChild(canvas);
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
    var cancel = function() {};
    this.interaction = new Interaction(this.container)
        .on('resize', function() {
            cancel();
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            cancel();
            map.transform.panBy(x, y);
            bean.fire(map, 'move');
            map.update();
        })
        .on('panend', function(x, y) {
            cancel();
            cancel = timed(function(t) {
                map.transform.panBy(x * (1 - t), y * (1 - t));
                map._updateStyle();
                map.update();
            }, 500);
        })
        .on('zoom', function(delta, x, y) {
            cancel();
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;
            if (delta === Infinity || delta === -Infinity) {
                var from = map.transform.scale,
                    to = map.transform.scale * scale;
                cancel = timed(function(t) {
                    map.transform.zoomAroundTo(interp(from, to, Math.sqrt(t)), { x: x, y: y });
                    map._updateStyle();
                    map.update();
                    if (t === 1) bean.fire(map, 'move');
                }, 200);
            } else {
                map.transform.zoomAround(scale, { x: x, y: y });
                map._updateStyle();
                bean.fire(map, 'move');
                map.update();
            }
        })
        .on('rotate', function(beginning, start, end) {
            cancel();
            var center = { x: window.innerWidth / 2, y: window.innerHeight / 2 }, // Center of rotation
                beginningToCenter = vectorSub(beginning, center),
                beginningToCenterDist = vectorMag(beginningToCenter);

            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (beginningToCenterDist < 200) {
                center = vectorAdd(beginning, rotate(Math.atan2(beginningToCenter.y, beginningToCenter.x), { x: -200, y: 0 }));
            }

            bean.fire(map, 'move');
            map.setAngle(center, map.transform.angle + angleBetween(vectorSub(start, center), vectorSub(end, center)));
        });
};

Map.prototype._setupDispatcher = function() {
    this.dispatcher = new Dispatcher(4, this);
    this.dispatcher.broadcast('set style', {
        mapping: this.style.mapping,
        buckets: this.style.buckets
    });
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
        this.requestId = frame(this.render);
    }
};

Map.prototype._setupStyle = function(style) {
    this.style = style;
    this.style.layers = parse_style(this.style.layers, this.style.constants);

    var map = this;
    function rerender() { map._rerender(); }
    this.style.image_sprite = new ImageSprite(this.style, rerender);
};

Map.prototype._updateStyle = function() {
    this.style.zoomed_layers = zoom_style(this.style.layers, this.style.constants, this.transform.z);
    this.style.background_color = parse_color(this.style.background, this.style.constants);
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
    this.painter.clear(this.style.background_color);

    this.layers.forEach(function(layer) {
        layer.render();
    });

    this.dirty = false;

    if (this._repaint) {
        this._rerender();
    }
};
