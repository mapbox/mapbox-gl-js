// TODO: Handle canvas size change.




function Map(config) {
    this.tiles = {};
    this.transform = new Transform(512);

    this.setupContainer(config.container);
    this.setupPosition(config);

    // TODO: Rework MRU cache handling (flickering!)
    this.cache = new MRUCache(0);

    this.urls = config.urls || [];

    this.zooms = config.zooms || [0];
    this.minZoom = config.minZoom || -1;
    this.maxZoom = config.maxZoom || 18;
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);
    this.render = this.render.bind(this);

    this.setupStyle(config.style);
    this.setupPainter();
    this.setupEvents();

    this.dirty = false;
    this.updateStyle();
    this.updateTiles();
    this.rerender();


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

Map.prototype.getPixelExtent = function() {
    // Convert the pixel values to the next higher zoom level's tiles.
    var zoom = this.coveringZoomLevel();
    var factor = Math.pow(2, zoom) / this.transform.scale;
    return {
        left: -this.transform.x * factor,
        top: -(this.transform.y - this.transform.height) * factor,
        right: -(this.transform.x - this.transform.width) * factor,
        bottom: -this.transform.y * factor
    };
};

// Generates a list of tiles required to cover the current viewport.
Map.prototype.getCoveringTiles = function() {
    var extent = this.getPixelExtent();
    var z = this.coveringZoomLevel();
    var dim = 1 << z;

    var bounds = {
        minX: clamp(Math.floor(extent.left / this.transform.size), 0, dim - 1),
        minY: clamp(Math.floor(extent.bottom / this.transform.size), 0, dim - 1),
        maxX: clamp(Math.floor((extent.right) / this.transform.size), 0, dim - 1),
        maxY: clamp(Math.floor((extent.top) / this.transform.size), 0, dim - 1)
    };

    var tiles = [];
    for (var x = bounds.minX; x <= bounds.maxX; x++) {
        for (var y = bounds.minY; y <= bounds.maxY; y++) {
            tiles.push(Tile.toID(z, x, dim - y - 1));
        }
    }

    return tiles;
};


function z_order(a, b) {
    return (a % 32) - (b % 32);
}

// Call when a (re-)render of the map is required, e.g. when the user panned or
// zoomed or when new data is available.
Map.prototype.render = function() {
    this.dirty = false;

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
};



Map.prototype.renderTile = function(tile, id, style) {
    var pos = Tile.fromID(id);
    var z = pos.z, x = pos.x, y = pos.y;

    this.painter.viewport(z, x, y, this.transform, this.transform.size, this.pixelRatio);
    this.painter.draw(tile, this.style.zoomed_layers);
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
Map.prototype.addTile = function(id) {
    if (this.tiles[id]) return this.tiles[id];
    var map = this;

    var tile = this.cache.get(id);
    if (tile) {
        console.warn('adding from mru', Tile.asString(id));
        tile.addToMap(map);
    } else {
        tile = this.tiles[id] = new Tile(this.url(id), function(err) {
            if (err) {
                console.warn(err.stack);
            } else {
                tile.addToMap(map);
                map.updateTiles();
                map.rerender();
            }
        });
    }

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
            // TODO: cancel tile loading
        }

        delete this.tiles[id];
    }
};

Map.prototype.setPosition = function(zoom, lat, lon) {
    this.transform.zoom = zoom - 1;
    this.transform.lat = lat;
    this.transform.lon = lon;
};

Map.prototype.parseHash = function() {
    var match = location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (match) {
        this.setPosition(match[1], match[2], match[3]);
        return true;
    }
};

Map.prototype.setupPosition = function(pos) {
    if (!this.parseHash()) {
        this.setPosition(pos.zoom, pos.lat, pos.lon);
    }

    var map = this;
    window.addEventListener("hashchange", function(ev) {
        if (location.hash !== map.lastHash) {
            map.parseHash();
            map.updateStyle();
            map.updateTiles();
            map.rerender();
        }
    }, false);
};

// x/y are pixel coordinates relative to the current zoom.
Map.prototype.translate = function(x, y) {
    this.transform.x += x;
    this.transform.y -= y;
    this.updateHash();
};

// Map.prototype.click = function(x, y) {
//     y = this.transform.height - y - 1;

//     var posX = x - this.transform.x;
//     var posY = y - this.transform.y;
// };

Map.prototype.zoom = function(scale, anchorX, anchorY) {
    anchorY = this.transform.height - anchorY - 1;

    var posX = anchorX - this.transform.x;
    var posY = anchorY - this.transform.y;

    var oldScale = this.transform.scale;

    var real = this.transform.scale * scale;
    var min = Math.max(0.5, Math.max(1 << this.minZoom, real));
    this.transform.scale = Math.min(1 << this.maxZoom, min);

    scale = this.transform.scale / oldScale;
    this.transform.x -= posX * scale - posX;
    this.transform.y -= posY * scale - posY;

    this.updateStyle();
    this.updateHash();
};

Map.prototype.setupContainer = function(container) {
    this.pixelRatio = 1;
    // Scales the canvas for high-resolution displays.
    if ('devicePixelRatio' in window && devicePixelRatio > 1) {
        this.pixelRatio = devicePixelRatio;
    }

    // Setup size
    var rect = container.getBoundingClientRect();
    this.transform.width = rect.width;
    this.transform.height = rect.height;

    // Setup WebGL canvas
    var canvas = document.createElement('canvas');
    canvas.width = rect.width * this.pixelRatio;
    canvas.height = rect.height * this.pixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    canvas.style.position = 'absolute';
    container.appendChild(canvas);
    this.canvas = canvas;

    // Setup SVG overlay
    // TODO

    this.container = container;
}

Map.prototype.setupPainter = function() {
    var gl = this.canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
        alert('Failed to initialize WebGL');
        return;
    }

    this.painter = new GLPainter(gl);
};

// Adds pan/zoom handlers and triggers the necessary events
Map.prototype.setupEvents = function() {
    var map = this;
    this.interaction = new Interaction(this.container)
        .on('pan', function(x, y) {
            map.translate(x, y);
            map.updateTiles();
            map.rerender();
        })
        .on('zoom', function(delta, x, y) {
            // Scale by sigmoid of scroll wheel delta.
            var scale = 2 / (1 + Math.exp(-Math.abs(delta / 100) / 4));
            if (delta < 0 && scale !== 0) scale = 1 / scale;
            map.zoom(scale, x, y);
            map.updateTiles();
            map.rerender();
        });
        // .on('click', function(x, y) {
        //     map.click(x, y);
        // });
};

Map.prototype.rerender = function() {
    if (!this.dirty) {
        this.dirty = true;
        (window.requestAnimationFrame ||
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
            '/' + map.transform.lon.toFixed(6);
        map.lastHash = hash;
        location.replace(hash);
        this.updateHashTimeout = null;
    }, 100);
};
