function Layer(config, map) {

    this.map = map;
    this.painter = map.painter;
    this.style = map.style;

    this.tiles = {};

    this.Tile = config.type === 'raster' ? RasterTile : Tile;
    this.type = config.type;

    this.cache = new MRUCache(100);

    this.zooms = config.zooms || [0];
    this.urls = config.urls || [];
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);

    this.loadNewTiles = true;
}

Layer.prototype.update = function() {
    this._updateTiles();
};

Layer.prototype.render = function() {
    // Iteratively paint every tile.
    var order = Object.keys(this.tiles);
    order.sort(z_order);
    for (var i = 0; i < order.length; i++) {
        var id = order[i];
        var tile = this.tiles[id];
        if (tile.loaded) {
            this._renderTile(tile, id);
        }
    }
};

Layer.prototype._coveringZoomLevel = function() {
    var zoom = this.map.transform.zoom;
    for (var i = this.zooms.length - 1; i >= 0; i--) {
        if (this.zooms[i] <= zoom) {
            var z = this.zooms[i];
            if (this.type === 'raster') {
                z += 1;
                if (this.zooms[i+1]) {
                    var diff = this.zooms[i+1] - this.zooms[i];
                    z += Math.round((this.map.transform.z % diff) / diff) * diff;
                }
            }
            return z;
        }
    }
    return 0;
};

Layer.prototype._parentZoomLevel = function(zoom) {
    for (var i = this.zooms.length - 1; i >= 0; i--) {
        if (this.zooms[i] < zoom) {
            return this.zooms[i];
        }
    }
    return null;
};

Layer.prototype._childZoomLevel = function(zoom) {
    for (var i = 0; i < this.zooms.length; i++) {
        if (this.zooms[i] > zoom) {
            return this.zooms[i];
        }
    }
    return null;
};

Layer.prototype._getCoveringTiles = function() {
    var z = this._coveringZoomLevel();

    var map = this,
        tileSize = window.tileSize = this.map.transform.size * Math.pow(2, this.map.transform.z) / (1 << z),
        tiles = 1 << z;

    var tileCenter = Coordinate.zoomTo(this.map.transform.locationCoordinate(this.map.transform), z);

    var points = [
        this.map.transform.pointCoordinate(tileCenter, {x:0, y:0}),
        this.map.transform.pointCoordinate(tileCenter, {x:this.map.transform.width, y:0}),
        this.map.transform.pointCoordinate(tileCenter, {x:this.map.transform.width, y:this.map.transform.height}),
        this.map.transform.pointCoordinate(tileCenter, {x:0, y:this.map.transform.height})
    ], t = [];

    points.forEach(function(p) {
        Coordinate.izoomTo(p, z);
    });

    // Divide the screen up in two triangles and scan each of them:
    // +---/
    // | / |
    // /---+
    scanTriangle(points[0], points[1], points[2], 0, tiles, scanLine);
    scanTriangle(points[2], points[3], points[0], 0, tiles, scanLine);

    return _.uniq(t);

    function scanLine(x0, x1, y) {
        if (y >= 0 && y <= tiles) {
            for (var x = x0; x <= x1; x++) {
                t.push(Tile.toID(z, (x + tiles) % tiles, y, Math.floor(x/tiles)));
            }
        }
    }
};

/*
 * Given a tile of data, its id, and a style, render the tile to the canvas
 *
 * @param {Object} tile
 * @param {Number} id
 * @param {Object} style
 */
Layer.prototype._renderTile = function(tile, id, style) {
    var pos = Tile.fromID(id);
    var z = pos.z, x = pos.x, y = pos.y, w = pos.w;
    x += w * (1 << z);

    this.painter.viewport(z, x, y, this.map.transform, this.map.transform.size, this.pixelRatio);

    this.painter[this.type === 'raster' ? 'drawRaster' : 'draw'](tile, this.style, {
        z: z, x: x, y: y,
        debug: this.map.debug,
        antialiasing: this.map.antialiasing,
        vertices: this.map.vertices
    });
    // console.timeEnd('drawTile');
};

// Removes tiles that are outside the viewport and adds new tiles that are inside
// the viewport.
Layer.prototype._updateTiles = function() {
    if (!this.loadNewTiles) {
        return;
    }

    var map = this,
        zoom = this.map.transform.zoom,
        required = this._getCoveringTiles(),
        missing = [],
        i,
        id;

    // Determine the overzooming/underzooming amounts.
    var maxCoveringZoom = Math.min(this.maxTileZoom, zoom + 2), // allow 2x underzooming
        minCoveringZoom = Math.max(this.minTileZoom, zoom - 10); // allow 10x overzooming

    // Add every tile, and add parent/child tiles if they are not yet loaded.
    for (i = 0; i < required.length; i++) {
        id = required[i];
        var tile = this._addTile(id);

        if (!tile.loaded) {
            // We need either parent or child tiles that are available immediately
            missing.push(id);
        }
    }

    for (i = 0; i < missing.length; i++) {
        id = missing[i];
        var missingZoom = Tile.zoom(id);
        var z = missingZoom;

        // Climb up all the way to zero
        while (z > minCoveringZoom) {
            z = this._parentZoomLevel(z);
            var parent = Tile.parentWithZoom(id, z);

            // Potentially add items from the MRU cache.
            if (this.cache.has(parent)) {
                this._addTile(parent);
            }

            if (this.tiles[parent] && this.tiles[parent].loaded) {
                // Retain the existing parent tile
                if (required.indexOf(parent) < 0) {
                    required.push(parent);
                }
                break;
            }
        }

        // Go down for max 5 zoom levels to find child tiles.
        z = missingZoom;
        while (z < maxCoveringZoom) {
            z = this._childZoomLevel(z);

            // Go through the MRU cache and try to find existing tiles that are
            // children of this tile.
            var keys = this.cache.keys();
            var childID, parentID;
            for (var j = 0; j < keys.length; j++) {
                childID = keys[j];
                parentID = Tile.parentWithZoom(childID, missingZoom);
                if (parentID == id) {
                    this._addTile(childID);
                }
            }

            // Go through all existing tiles and retain those that are children
            // of the current missing tile.
            for (childID in this.tiles) {
                childID = +childID;
                parentID = Tile.parentWithZoom(childID, missingZoom);
                if (parentID == id && this.tiles[childID].loaded) {
                    // Retain the existing child tile
                    if (required.indexOf(childID) < 0) {
                        required.push(childID);
                    }
                }
            }
        }
    }

    var existing = Object.keys(this.tiles).map(parseFloat);

    var remove = _.difference(existing, required);
    _.each(remove, function(id) {
        map._removeTile(id);
    });
};


// Adds a vector tile to the map. It will trigger a rerender of the map and will
// be part in all future renders of the map. The map object will handle copying
// the tile data to the GPU if it is required to paint the current viewport.
Layer.prototype._addTile = function(id, callback) {
    if (this.tiles[id]) return this.tiles[id];

    if (this.cache.has(id)) {
        return this.tiles[id] = this.cache.get(id);
    }

    var map = this.map,
        pos = Tile.fromID(id),
        tile;

    if (pos.w === 0) {
        tile = this.tiles[id] = new this.Tile(map, Tile.url(id, this.urls), tileComplete);
    } else {
        var wrapped = Tile.toID(pos.z, pos.x, pos.y, 0);
        tile = this.tiles[id] = this.tiles[wrapped] || this._addTile(wrapped);
        tile.uses++;
    }

    function tileComplete(err) {
        if (err) {
            console.warn(err.stack);
        } else {
            map.update();
        }
    }

    return tile;
};

/*
 * Remove a tile with a given id from the map
 *
 * @param {number} id
 */
Layer.prototype._removeTile = function(id) {
    var tile = this.tiles[id];
    if (tile) {

        tile.uses--;

        if (tile.uses <= 0) {

            // Only add it to the MRU cache if it's already available.
            // Otherwise, there's no point in retaining it.
            if (tile.loaded) {
                this.cache.add(id, tile);
            } else {
                tile.abort();
            }

            tile.removeFromMap(this);
        }

        delete this.tiles[id];
    }
};
