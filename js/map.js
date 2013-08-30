// TODO: Handle canvas size change.

function Map(config) {
    this.tileSize = 512;

    this.tiles = {};
    this.transform = new Transform(this.tileSize);

    this.setupContainer(config.container);
    this.setupPosition(config);

    // TODO: Rework MRU cache handling (flickering!)
    this.cache = new MRUCache(0);

    this.urls = config.urls || [];

    this.zooms = config.zooms || [0];
    this.minZoom = config.minZoom || 0;
    this.maxZoom = config.maxZoom || 18;
    this.minScale = Math.pow(2, this.minZoom);
    this.maxScale = Math.pow(2, this.maxZoom);
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);
    this.render = this.render.bind(this);

    this.setupStyle(config.style);
    this.setupPainter();
    this.setupContextHandler();
    this.setupEvents();
    this.setupDispatcher();

    this.dirty = false;
    this.updateStyle();

    this.resize();
    this.update();
}

Map.prototype.url = function(id) {
    var pos = Tile.fromID(id);
    return this.urls[(Math.random() * this.urls.length) | 0]
        .replace('{z}', pos.z.toFixed(0))
        .replace('{x}', pos.x.toFixed(0))
        .replace('{y}', pos.y.toFixed(0));
};

// // Returns the WGS84 extent of the current viewport.
// Map.prototype.getExtent = function() {
//     var x = this.transform.x, y = this.transform.y, scale = this.transform.scale;
//     var bl = this.getPixelPosition(x, y, scale);
//     var tr = this.getPixelPosition(x - this.transform.width, y - this.transform.height, scale);
//     // Order is -180, -85, 180, 85
//     return [bl.lon, bl.lat, tr.lon, tr.lat];
// };

Map.prototype.coveringZoomLevel = function() {
    var zoom = this.transform.zoom;
    for (var i = this.zooms.length - 1; i >= 0; i--) {
        if (this.zooms[i] <= zoom) {
            return this.zooms[i];
        }
    }
    return 0;
};

Map.prototype.parentZoomLevel = function(zoom) {
    for (var i = this.zooms.length - 1; i >= 0; i--) {
        if (this.zooms[i] < zoom) {
            return this.zooms[i];
        }
    }
    return null;
};

Map.prototype.childZoomLevel = function(zoom) {
    for (var i = 0; i < this.zooms.length; i++) {
        if (this.zooms[i] > zoom) {
            return this.zooms[i];
        }
    }
    return null;
};

Map.prototype.getCoveringTiles = function() {
    var z = this.coveringZoomLevel(), map = this;
    var tileSize = window.tileSize = this.transform.size * Math.pow(2, this.transform.z) / (1 << z),
        tiles = 1 << z;

    // Find the coordinates of a point in the browser's coordinate system in the map's
    // coordinate system (1 unit = 1 tile)
    var browserToMapCoord = function(point) {
        var p = vectorSub(point, [map.transform.x, map.transform.y]);
        // Find the distance and angle of the point from the map's origin.
        var dist = vectorMag(p), angle = Math.atan2(p[1], p[0]);
        // Reproject it (using that angle and distance) into the map's coordinate system.
        return { column: Math.cos(angle - map.transform.rotation) * dist / tileSize, row: Math.sin(angle - map.transform.rotation) * dist / tileSize };
    }

    // 
    var points = [
        // top left
        browserToMapCoord([0,0]),
        // top right
        browserToMapCoord([this.transform.width, 0]),
        // bottom right
        browserToMapCoord([this.transform.width, this.transform.height]),
        // bottom left
        browserToMapCoord([0, this.transform.height])
    ], t = [];

    function scanLine(x0, x1, y) {
        if (y >= 0 && y < tiles) {
            for (var x = Math.max(x0, 0); x < Math.min(x1, tiles); x++) {
                t.push(Tile.toID(z, x, y));
            }
        }
    }

    // Divide the screen up in two triangles and scan each of them:
    // +---/
    // | / |
    // /---+
    scanTriangle(points[0], points[1], points[2], 0, tiles, scanLine);
    scanTriangle(points[2], points[3], points[0], 0, tiles, scanLine);

    // Scanning returns duplicate tiles.
    t = _.uniq(t);

    return t;
}

// Taken from polymaps src/Layer.js
// https://github.com/simplegeo/polymaps/blob/master/src/Layer.js#L333-L383

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
    if ((e0.x0 == e1.x0 && e0.y0 == e1.y0)
        ? (e0.x0 + e1.dy / e0.dy * e0.dx < e1.x1)
        : (e0.x1 - e1.dy / e0.dy * e0.dx < e1.x0)) {
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

// scan-line conversion
function scanTriangle(a, b, c, ymin, ymax, scanLine) {
    var ab = edge(a, b),
        bc = edge(b, c),
        ca = edge(c, a);

    // sort edges by y-length
    if (ab.dy > bc.dy) { var t = ab; ab = bc; bc = t; }
    if (ab.dy > ca.dy) { var t = ab; ab = ca; ca = t; }
    if (bc.dy > ca.dy) { var t = bc; bc = ca; ca = t; }

    // scan span! scan span!
    if (ab.dy) scanSpans(ca, ab, ymin, ymax, scanLine);
    if (bc.dy) scanSpans(ca, bc, ymin, ymax, scanLine);
}

function z_order(a, b) {
    return (a % 32) - (b % 32);
}

// Call when a (re-)render of the map is required, e.g. when the user panned or
// zoomed or when new data is available.
Map.prototype.render = function() {
    this.painter.clear();

    // Iteratively paint every tile.
    var order = Object.keys(this.tiles);
    order.sort(z_order);
    for (var i = 0; i < order.length; i++) {
        var id = order[i];
        var tile = this.tiles[id];
        if (tile.loaded) {
            this.renderTile(tile, id);
        }
    }


    this.dirty = false;
    // this.rerender();
};


// 
Map.prototype.renderTile = function(tile, id, style) {
    var pos = Tile.fromID(id);
    var z = pos.z, x = pos.x, y = pos.y;

    // console.time('drawTile');
    this.painter.viewport(z, x, y, this.transform, this.transform.size, this.pixelRatio);
    this.painter.draw(tile, this.style.zoomed_layers, {
        z: z, x: x, y: y,
        debug: this.debug
    });
    // console.timeEnd('drawTile');
};


// Removes tiles that are outside the viewport and adds new tiles that are inside
// the viewport.
Map.prototype.updateTiles = function() {
    var map = this;

    var zoom = this.transform.zoom;
    // TODO: Increase maxcoveringzoom. To do this, we have to clip the gl viewport
    // to the actual visible canvas and shift the projection matrix
    var maxCoveringZoom = Math.min(this.maxTileZoom, zoom + 3);
    var minCoveringZoom = Math.max(this.minTileZoom, zoom - 3);

    var required = this.getCoveringTiles();

    var missing = [];

    // Add every tile, and add parent/child tiles if they are not yet loaded.
    for (var i = 0; i < required.length; i++) {
        var id = required[i];
        var tile = this.addTile(id);

        if (!tile.loaded) {
            // We need either parent or child tiles that are available immediately
            missing.push(id);
        }
    }

    // console.warn('missing', missing.map(Tile.asString));

    for (var i = 0; i < missing.length; i++) {
        var id = missing[i];
        var missingZoom = Tile.zoom(id);
        var z = missingZoom;

        // Climb up all the way to zero
        while (z > minCoveringZoom) {
            z = this.parentZoomLevel(z);
            var parent = Tile.parentWithZoom(id, z);

            // Potentially add items from the MRU cache.
            if (this.cache.has(parent)) {
                this.addTile(parent);
            }

            if (this.tiles[parent] && this.tiles[parent].loaded) {
                // Retain the existing parent tile
                if (required.indexOf(parent) < 0) {
                    required.push(parent);
                }
                break;
            }
        }

        // Go down for max 4 zoom levels to find child tiles.
        z = missingZoom;
        while (z < maxCoveringZoom) {
            z = this.childZoomLevel(z);

            // Go through the MRU cache and try to find existing tiles that are
            // children of this tile.
            var keys = this.cache.keys();
            for (var j = 0; j < keys.length; j++) {
                var childID = keys[j];
                var parentID = Tile.parentWithZoom(childID, missingZoom);
                if (parentID == id) {
                    this.addTile(childID);
                }
            }

            // Go through all existing tiles and retain those that are children
            // of the current missing tile.
            for (var childID in this.tiles) {
                childID = +childID;
                var parentID = Tile.parentWithZoom(childID, missingZoom);
                if (parentID == id && this.tiles[childID].loaded) {
                    // Retain the existing child tile
                    if (required.indexOf(childID) < 0) {
                        required.push(childID);
                    }
                }
            }
        }
    }

    // TODO: only retain tiles thare are close enough to the current zoom levle

    var existing = Object.keys(this.tiles).map(parseFloat);

    var remove = _.difference(existing, required);
    _.each(remove, function(id) {
        map.removeTile(id);
    });
};


// Adds a vector tile to the map. It will trigger a rerender of the map and will
// be part in all future renders of the map. The map object will handle copying
// the tile data to the GPU if it is required to paint the current viewport.
Map.prototype.addTile = function(id, callback) {
    if (this.tiles[id]) return this.tiles[id];
    var map = this;

    var tile = this.tiles[id] = new Tile(this, this.url(id), function(err) {
        if (err) {
            console.warn(err.stack);
        } else {
            map.update();
        }
    });

    return tile;
};


Map.prototype.removeTile = function(id) {
    var tile = this.tiles[id];
    if (tile) {
        tile.removeFromMap(this);

        // Only add it to the MRU cache if it's already available.
        // Otherwise, there's no point in retaining it.
        if (tile.loaded) {
            this.cache.add(id, tile);
        } else {
            tile.abort();
        }

        delete this.tiles[id];
    }
};

Map.prototype.setPosition = function(zoom, lat, lon, rotation) {
    this.transform.rotation = +rotation;
    this.transform.zoom = zoom - 1;
    this.transform.lat = lat;
    this.transform.lon = lon;
};

Map.prototype.parseHash = function() {
    var match = location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (match) {
        this.setPosition(match[1], match[2], match[3], match[4]);
        return true;
    }
};

Map.prototype.setupPosition = function(pos) {
    if (!this.parseHash()) {
        this.setPosition(pos.zoom, pos.lat, pos.lon, pos.rotation);
    }

    var map = this;
    window.addEventListener("hashchange", function(ev) {
        if (location.hash !== map.lastHash) {
            map.parseHash();
            map.updateStyle();
            map.update();
        }
    }, false);
};

// x/y are pixel coordinates relative to the current zoom.
Map.prototype.translate = function(x, y) {
    this.transform.x += x;
    this.transform.y += y;
    this.updateHash();
};

// Map.prototype.click = function(x, y) {
//     y = this.transform.height - y - 1;

//     var posX = x - this.transform.x;
//     var posY = y - this.transform.y;
// };

Map.prototype.zoom = function(scale, x, y) {
    var posX = x - this.transform.x;
    var posY = y - this.transform.y;

    var oldScale = this.transform.scale;
    this.transform.scale = Math.min(this.maxScale, Math.max(0.5, this.transform.scale * scale));

    if (this.transform.scale !== oldScale) {
        scale = this.transform.scale / oldScale;
        this.transform.x -= posX * scale - posX;
        this.transform.y -= posY * scale - posY;

        // Only enable zooming mode when using a mode that is more granular than
        // the coarse scroll wheel intervals.
        // Wait 6 frames (== 100ms) until we disable zoom mode again
        // this.animating = 15;
        //zooming = (scale != oldScale && !wheel) ? 6 : 0;
        this.updateStyle();
        this.updateHash();
    }
};

Map.prototype.resize = function() {
    this.pixelRatio = window.devicePixelRatio || 1;

    var width = this.container.offsetWidth;
    var height = this.container.offsetHeight;

    // Request the required canvas size taking the pixelratio into account.
    this.canvas.width = this.pixelRatio * width;
    this.canvas.height = this.pixelRatio * height;

    // Maintain the same canvas size, potentially downscaling it for HiDPI displays
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // Move the x/y transform so that the center of the map stays the same when
    // resizing the viewport.
    if (this.transform.width !== null && this.transform.height !== null) {
        this.transform.x += (width - this.transform.width) / 2;
        this.transform.y += (height - this.transform.height) / 2;
    }

    this.transform.width = width;
    this.transform.height = height;

    this.painter.resize(width, height);
};

Map.prototype.setupContainer = function(container) {
    var map = this;
    this.container = container;

    // Setup WebGL canvas
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    container.appendChild(canvas);
    this.canvas = canvas;

    // Setup debug controls
    var debugContainer = document.createElement('div');
    debugContainer.id = 'debug-overlay';
    debugContainer.innerHTML = '<div><label><input type="checkbox" id="debug" checked> Debug</label></div>' +
                               '<div><input type="button" value="Reset North" id="north"></div>';
    container.appendChild(debugContainer);

    debugContainer.addEventListener("click", function(ev) { ev.stopPropagation();  }, false);
    debugContainer.addEventListener("dblclick", function(ev) { ev.stopPropagation(); }, false);

    document.getElementById('debug').onclick = function() { map.debug = this.checked; map.rerender(); };
    this.debug = document.getElementById('debug').checked;

    document.getElementById('north').onclick = function() {
        // TODO: easing
        var center = [ map.transform.width / 2, map.transform.height / 2 ];
        map.setRotation(center, 0);
    };
};

Map.prototype.setRotation = function(center, angle) {
    var angle = this.transform.rotation - angle;
    this.transform.rotation -= angle;

    // Confine the rotation to within [-π,π]
    while (this.transform.rotation > Math.PI) {
        this.transform.rotation -= Math.PI * 2;
    }
    while (this.transform.rotation < -Math.PI) {
        this.transform.rotation += Math.PI * 2;
    }

    // Find the new top-right corner by finding the vector from the center of rotation to the top right
    // corner (vector from top-right of screen to center of rotation – vector from top-right of screen
    // to top-right of map = vector from top-right of map to center), rotating it by the angle, and
    // finding the ending vector from top-right of screen to top-right of map (by subtracting it from
    // the vector from top-right of screen to center).
    var newC = vectorSub(center, rotate(-angle, vectorSub(center, [this.transform.x, this.transform.y])));
    this.transform.x = newC[0];
    this.transform.y = newC[1];

    this.updateStyle();
    this.updateHash();
    this.update();
};

Map.prototype.setupPainter = function() {
    //this.canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(this.canvas);
    //this.canvas.loseContextInNCalls(1000);
    var gl = this.canvas.getContext("experimental-webgl", { antialias: false, alpha: false, stencil: false });
    if (!gl) {
        alert('Failed to initialize WebGL');
        return;
    }

    this.painter = new GLPainter(gl);
};

Map.prototype.setupContextHandler = function() {
    var map = this;
    this.canvas.addEventListener("webglcontextlost", function(event) {
        event.preventDefault();
        if (map.requestId) {
            (window.cancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.webkitCancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame)(map.requestId);
        }
    }, false);
    this.canvas.addEventListener("webglcontextrestored", function() {
        for (id in map.tiles) {
            if (map.tiles[id].geometry) {
                map.tiles[id].geometry.unbind();
            }
        }
        map.setupPainter();

        map.dirty = false;
        map.resize();
        map.update();
    }, false);
}

// Adds pan/zoom handlers and triggers the necessary events
Map.prototype.setupEvents = function() {
    var map = this;
    this.interaction = new Interaction(this.container)
        .on('resize', function() {
            map.resize();
            map.update();
        })
        .on('pan', function(x, y) {
            map.translate(x, y);
            map.update();
        })
        .on('zoom', function(delta, x, y) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;
            map.zoom(scale, x, y);
            map.update();
        })
        .on('rotate', function(beginning, start, end) { // [x, y] arrays
            var center = [ window.innerWidth / 2, window.innerHeight / 2 ], // Center of rotation
                beginningToCenter = vectorSub(beginning, center),
                beginningToCenterDist = vectorMag(beginningToCenter);
            // If the first click was too close to the center, move the center of rotation by 200 pixels
            // in the direction of the click.
            if (beginningToCenterDist < 200) {
                center = vectorAdd(beginning, rotate(Math.atan2(beginningToCenter[1], beginningToCenter[0]), [-200, 0]));
            }
            var relativeStart = vectorSub(start, center),
                relativeEnd = vectorSub(end, center),
                startMagnitude = vectorMag(relativeStart),
                endMagnitude = vectorMag(relativeEnd);

            // Find the angle of the two vectors. In this particular instance, I solve the formula for the
            // cross product a x b = |a||b|sin(θ) for θ.
            var angle = -Math.asin((relativeStart[0] * relativeEnd[1] - relativeStart[1] * relativeEnd[0]) / (startMagnitude * endMagnitude));

            map.setRotation(center, map.transform.rotation - angle);
        });
        // .on('click', function(x, y) {
        //     map.click(x, y);
        // });
};

Map.prototype.setupDispatcher = function() {
    this.dispatcher = new Dispatcher(4);
    this.dispatcher.send('set mapping', this.style.mapping, null, 'all');
};

Map.prototype.rerender = function() {
    if (!this.dirty) {
        this.dirty = true;
        this.requestId = (window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame)(this.render);
    }
};

Map.prototype.setupStyle = function(style) {
    this.style = style;
    this.style.layers = parse_style(this.style.layers, this.style.constants);
};

Map.prototype.updateStyle = function() {
    this.style.zoomed_layers = zoom_style(this.style.layers, this.style.constants, this.transform.zoom);
};

Map.prototype.updateHash = function() {
    if (this.updateHashTimeout) {
        clearTimeout(this.updateHashTimeout);
    }

    var map = this;
    this.updateHashTimeout = setTimeout(function() {
        var hash = '#' + (map.transform.z + 1).toFixed(2) +
            '/' + map.transform.lat.toFixed(6) +
            '/' + map.transform.lon.toFixed(6) +
            '/' + map.transform.rotation.toFixed(6);
        map.lastHash = hash;
        location.replace(hash);
        this.updateHashTimeout = null;
    }, 100);
};

Map.prototype.update = function() {
    this.updateTiles();
    this.rerender();
    this.previousScale = this.transform.scale;
};
