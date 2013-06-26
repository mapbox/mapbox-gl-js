// TODO: Handle canvas size change.

function Map(canvas, config) {
    this.tiles = {};
    this.canvas = canvas;

    this.cache = new MRUCache(32);

    this.urls = config.urls || [];

    this.zooms = config.zooms || [0];
    this.minZoom = config.minZoom || 0;
    this.maxZoom = config.maxZoom || 19;
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);
    // this.zoom = config.zoom || 0;
    // this.lat = config.lat || 0;
    // this.lon = config.lon || 0;

    this.render = this.render.bind(this);

    this.setupCanvas();
    this.setupTransform();
    this.setupPainter();
    this.setupEvents();

    this.dirty = false;
    this.updateTiles();
    // this.rerender();
}

Map.prototype.url = function(id) {
    var pos = Tile.fromID(id);
    return this.urls[(Math.random() * this.urls.length) | 0]
        .replace('{z}', pos.z.toFixed(0))
        .replace('{x}', pos.x.toFixed(0))
        .replace('{y}', pos.y.toFixed(0));
};

// function Coordinate(lon, lat) {
//     this.lon = lon;
//     this.lat = lat;
// }

// Map.prototype.getPixelPosition = function(x, y, scale) {
//     var size = scale * 256;
//     var zc = size / 2;
//     var Cc = size / (2 * Math.PI);
//     var Bc = size / 360;

//     var g = Math.exp((y + zc) / Cc);
//     var lon = (-x - zc) / Bc;
//     var lat = -360 / Math.PI * Math.atan(g) + 90;
//     return new Coordinate(lon, lat);
// };

// // Returns the WGS84 extent of the current viewport.
// Map.prototype.getExtent = function() {
//     var x = this.transform.x, y = this.transform.y, scale = this.transform.scale;
//     var bl = this.getPixelPosition(x, y, scale);
//     var tr = this.getPixelPosition(x - this.width, y - this.height, scale);
//     // Order is -180, -85, 180, 85
//     return [bl.lon, bl.lat, tr.lon, tr.lat];
// };

// Returns the zoom level supplied by this map for a given scale.
Map.prototype.coveringZoomLevelWithScale = function(scale) {
    var zoom = Math.floor(Math.log(scale) / Math.log(2));
    return this.coveringZoomLevel(zoom);
};

Map.prototype.coveringZoomLevel = function(zoom) {
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

Map.prototype.getPixelExtent = function(transform) {
    // Convert the pixel values to the next higher zoom level's tiles.
    var zoom = this.coveringZoomLevelWithScale(transform.scale);
    var factor = (1 << zoom) / transform.scale;
    return {
        left: -transform.x * factor,
        top: -(transform.y - this.height) * factor,
        right: -(transform.x - this.width) * factor,
        bottom: -transform.y * factor
    };
};

// Generates a list of tiles required to cover the current viewport.
Map.prototype.getCoveringTiles = function(scale) {
    var size = 256;
    var extent = this.getPixelExtent(this.transform);
    var z = this.coveringZoomLevelWithScale(scale);
    var dim = 1 << z;

    var bounds = {
        minX: clamp(Math.floor(extent.left / size), 0, dim - 1),
        minY: clamp(Math.floor(extent.bottom / size), 0, dim - 1),
        maxX: clamp(Math.floor((extent.right) / size), 0, dim - 1),
        maxY: clamp(Math.floor((extent.top) / size), 0, dim - 1)
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
    // if (DEBUG) console.time('Map#render');

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

    //     // TODO: Add subpixel positioning (slightly offset ortho projection to accomodate)
    //     // TODO: Draw parent tile where no child tiles exist
    //     // TODO: Check whether offsetting a tile by the current zoom level's map width
    //     //       is still within the viewport. If it is, draw it again at that position.

    // if (DEBUG) console.timeEnd('Map#render');
};

Map.prototype.renderTile = function(tile, id) {
    var pos = Tile.fromID(id);
    var z = pos.z, x = pos.x, y = pos.y;

    // console.warn(tile);

    // Find out what position we should paint this at.

    // var zoom = Math.floor(Math.log(this.transform.scale) / Math.log(2));
    // var zoom = z;

    // Get pixel offset of top left corner of viewport
    // var left = 256 * this.transform.scale * this.transform.x - this.width / 2;
    // var top = 256 * this.transform.scale * this.transform.y - this.height / 2;
    // var size = this.transform.scale * 256 / (1 << zoom);

    // Get pixel offset of the tile to render in global canvas.
    // var viewX = x * size - left;
    // var viewY = ((1 << z) - 1 - y) * size - top;

    // var viewX = this.transform.x + size * x;
    // var viewY = this.transform.y + size * y;

    // console.warn(viewX, viewY, size);
    this.painter.viewport(z, x, y, this.transform, this.pixelRatio);

    this.painter.draw(tile, z);

//     // Go through the stylesheet, for each layer, render all loaded tiles.
//     for (var i = 0; i < style.length; i++) {
//         if (style[i].source in tile.layers) {
//             var layer = tile.layers[style[i].source];
//             this.painter.draw(layer);
//         } else {
//             console.warn('Tile ' + id + ' is missing layer ' + style[i].source);
//         }
//     }
};



// Removes tiles that are outside the viewport and adds new tiles that are inside
// the viewport.
Map.prototype.updateTiles = function() {
    var map = this;
    // if (DEBUG) console.warn('Map#updateTiles');

    var zoom = Math.log(this.transform.scale) / Math.log(2);
    var maxCoveringZoom = Math.min(this.maxTileZoom, zoom + 3);
    var minCoveringZoom = Math.max(this.minTileZoom, zoom - 3);


    var required = this.getCoveringTiles(this.transform.scale);

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
    // console.warn('add', Tile.asString(id));
    // if (DEBUG) console.time('Map#addTile', Tile.asString(id));
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

    // if (DEBUG) console.timeEnd('Map#addTile', Tile.asString(id));
};


Map.prototype.removeTile = function(id) {
    // console.warn('remove', Tile.asString(id));
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

Map.prototype.setupTransform = function() {
    if (DEBUG) console.time('Map#setupTransform');

    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    // this.transform = {
    //     x: (this.width - 512) / 2,
    //     y: (this.height - 512) / 2,
    //     scale: 2
    // };
    this.transform = {
        x: 0,
        y: 0,
        scale: 1
    };

    if (DEBUG) console.timeEnd('Map#setupTransform');
};

// x/y are pixel coordinates relative to the current zoom.
Map.prototype.translate = function(x, y) {
    this.transform.x += x;
    this.transform.y -= y;
};

// Map.prototype.click = function(x, y) {
//     y = this.height - y - 1;

//     var posX = x - this.transform.x;
//     var posY = y - this.transform.y;
// };

Map.prototype.zoom = function(scale, anchorX, anchorY) {
    anchorY = this.height - anchorY - 1;

    var posX = anchorX - this.transform.x;
    var posY = anchorY - this.transform.y;

    var oldScale = this.transform.scale;
    this.transform.scale = Math.min(1 << this.maxZoom, Math.max(1 << this.minZoom, this.transform.scale * scale));

    scale = this.transform.scale / oldScale;
    this.transform.x -= posX * scale - posX;
    this.transform.y -= posY * scale - posY;
};

Map.prototype.setupCanvas = function() {
    if (DEBUG) console.time('Map#setupCanvas');

    // Scales the canvas for high-resolution displays.
    this.pixelRatio = 1;
    if ('devicePixelRatio' in window && devicePixelRatio > 1 && !this.canvas.scaled) {
        this.pixelRatio = devicePixelRatio;
        this.canvas.style.width = this.canvas.offsetWidth + 'px';
        this.canvas.width = this.canvas.offsetWidth * this.pixelRatio;
        this.canvas.style.height = this.canvas.offsetHeight + 'px';
        this.canvas.height = this.canvas.offsetHeight * this.pixelRatio;
        this.canvas.scaled = true;
    }

    if (DEBUG) console.timeEnd('Map#setupCanvas');
};

Map.prototype.setupPainter = function() {
    if (DEBUG) console.time('Map#setupPainter');

    var gl = this.canvas.getContext("webgl", { antialias: true });
    if (!gl) {
        alert('Failed to initialize WebGL');
        return;
    }

    this.painter = new GLPainter(gl);
    if (DEBUG) console.timeEnd('Map#setupPainter');
};

// Adds pan/zoom handlers and triggers the necessary events
Map.prototype.setupEvents = function() {
    var map = this;
    this.interaction = new Interaction(this.canvas)
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
    // console.warn('setupEvents');
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

// // Builds a stylesheet/function and sets the appropriate colors for the current
// // zoom level.
// Map.prototype.buildStylesheet = function() {

// };