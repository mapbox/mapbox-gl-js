function Map(config) {
    this.tileSize = 512;

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
    this._setupFonts();
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

    this.labelManager = new LabelCanvas(this);

    this.update();
    this.hash.onhash();
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

    this.dispatcher.send('set mapping', this.style.mapping, null, 'all');

    // clears all tiles to recalculate geometries (for changes to linecaps, linejoins, ...)
    for (var t in this.tiles) {
        this.tiles[t]._load();
    }
    this.cache.reset();
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
    this.interaction = new Interaction(this.container)
        .on('resize', function() {
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            map.transform.panBy(x, y);
            bean.fire(map, 'move');
            map.update();
        })
        .on('zoom', function(delta, x, y) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;
            map.transform.zoomAround(scale, { x: x, y: y });
            map._updateStyle();
            bean.fire(map, 'move');
            map.update();
        })
        .on('rotate', function(beginning, start, end) {
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
    this.dispatcher = new Dispatcher(4);
    this.dispatcher.send('set mapping', this.style.mapping, null, 'all');
};

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

Map.prototype._setupFonts = function() {
    this.fonts = {};

    var map = this;
    this.style.layers.forEach(function(info) {
        if (info.type != 'text') {
            return;
        }

        var fontUrl = '/gl/ArialUnicode.json?' + (+ new Date()); // TODO: load fonts by actual url.
        var xhr = new XMLHttpRequest();
        xhr.open("GET", fontUrl, true);
        xhr.onload = function(e) {
            if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
                var json = JSON.parse(xhr.response);
                map.fonts[info.font] = json.chars;
                for (var tile in map.tiles) {
                    map.tiles[tile].drawText();
                }
                map._rerender();
            }
        };
        xhr.send();
    });
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

function z_order(a, b) {
    return (a % 32) - (b % 32);
}

// Taken from polymaps src/Layer.js
// https://github.com/simplegeo/polymaps/blob/master/src/Layer.js#L333-L383

// scan-line conversion
function scanTriangle(a, b, c, ymin, ymax, scanLine) {
    var ab = edge(a, b),
        bc = edge(b, c),
        ca = edge(c, a);

    var t;

    // sort edges by y-length
    if (ab.dy > bc.dy) { t = ab; ab = bc; bc = t; }
    if (ab.dy > ca.dy) { t = ab; ab = ca; ca = t; }
    if (bc.dy > ca.dy) { t = bc; bc = ca; ca = t; }

    // scan span! scan span!
    if (ab.dy) scanSpans(ca, ab, ymin, ymax, scanLine);
    if (bc.dy) scanSpans(ca, bc, ymin, ymax, scanLine);
}

// scan-line conversion
function edge(a, b) {
    if (a.row > b.row) { var t = a; a = b; b = t; }
    return {
        x0: a.column,
        y0: a.row,
        x1: b.column,
        y1: b.row,
        dx: b.column - a.column,
        dy: b.row - a.row
    };
}

// scan-line conversion
function scanSpans(e0, e1, ymin, ymax, scanLine) {
    var y0 = Math.max(ymin, Math.floor(e1.y0)),
        y1 = Math.min(ymax, Math.ceil(e1.y1));

    // sort edges by x-coordinate
    if ((e0.x0 == e1.x0 && e0.y0 == e1.y0) ?
        (e0.x0 + e1.dy / e0.dy * e0.dx < e1.x1) :
        (e0.x1 - e1.dy / e0.dy * e0.dx < e1.x0)) {
        var t = e0; e0 = e1; e1 = t;
    }

    // scan lines!
    var m0 = e0.dx / e0.dy,
        m1 = e1.dx / e1.dy,
        d0 = e0.dx > 0, // use y + 1 to compute x0
        d1 = e1.dx < 0; // use y + 1 to compute x1
    for (var y = y0; y < y1; y++) {
        var x0 = m0 * Math.max(0, Math.min(e0.dy, y + d0 - e0.y0)) + e0.x0,
            x1 = m1 * Math.max(0, Math.min(e1.dy, y + d1 - e1.y0)) + e1.x0;
        scanLine(Math.floor(x1), Math.ceil(x0), y);
    }
}
