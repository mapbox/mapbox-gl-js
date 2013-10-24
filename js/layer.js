function Layer(config, map) {
    this.map = map;
    this.painter = map.painter;
    this.style = map.style;

    this.tiles = {};

    this.Tile = config.type === 'raster' ? RasterTile : Tile;
    this.type = config.type;

    this.cache = new MRUCache(8);

    this.zooms = config.zooms || [0];
    this.urls = config.urls || [];
    this.minTileZoom = _.first(this.zooms);
    this.maxTileZoom = _.last(this.zooms);
    this.id = config.id;

    this.loadNewTiles = true;
    this.enabled = config.enabled === undefined ? true : config.enabled;
}

Layer.prototype.update = function() {
    if (!this.enabled) return;
    this._updateTiles();
};

Layer.prototype.render = function() {
    // Iteratively paint every tile.
    if (!this.enabled) return;
    var order = Object.keys(this.tiles);
    order.sort(this._z_order);
    for (var i = 0; i < order.length; i++) {
        var id = order[i];
        var tile = this.tiles[id];
        if (tile.loaded) {
            this._renderTile(tile, id);
        }
    }
};

Layer.prototype._coveringZoomLevel = function(zoom) {
    for (var i = this.zooms.length - 1; i >= 0; i--) {
        if (this.zooms[i] <= zoom) {
            var z = this.zooms[i];
            if (this.type === 'raster') {
                z += (window.devicePixelRatio > 1) ? 2 : 1;
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

Layer.prototype._getPanTile = function(zoom) {
    var panTileZoom = this._coveringZoomLevel(Math.max(this.minTileZoom, zoom - 4)), // allow 10x overzooming
        coord = Coordinate.ifloor(Coordinate.zoomTo(
            this.map.transform.locationCoordinate(this.map.transform), panTileZoom));
    return Tile.toID(coord.zoom, coord.column, coord.row);
};

Layer.prototype._getCoveringTiles = function() {
    var z = this._coveringZoomLevel(this.map.transform.zoom);

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
    this._scanTriangle(points[0], points[1], points[2], 0, tiles, scanLine);
    this._scanTriangle(points[2], points[3], points[0], 0, tiles, scanLine);

    var uniques = _.uniq(t);

    var first = true;
    uniques.sort(fromCenter);

    return uniques;

    function fromCenter(a, b) {
        var at = Tile.fromID(a),
            bt = Tile.fromID(b),
            ad = Math.abs(at.x - tileCenter.column) +
                Math.abs(at.y - tileCenter.row),
            bd = Math.abs(bt.x - tileCenter.column) +
                Math.abs(bt.y - tileCenter.row);

        return ad - bd;
    }

    function scanLine(x0, x1, y) {
        if (y >= 0 && y <= tiles) {
            for (var x = x0; x < x1; x++) {
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
        vertices: this.map.vertices,
        fonts: this.map.fonts
    });
};

// Removes tiles that are outside the viewport and adds new tiles that are inside
// the viewport.
Layer.prototype._updateTiles = function() {
    if (!this.map.loadNewTiles) {
        return;
    }

    var map = this,
        zoom = this.map.transform.zoom,
        required = this._getCoveringTiles(),
        panTile = this._getPanTile(zoom),
        missing = [],
        i,
        id;


    // Determine the overzooming/underzooming amounts.
    var maxCoveringZoom = this._childZoomLevel(zoom);
    var minCoveringZoom = Math.max(this.minTileZoom, zoom - 10);

    // Add every tile, and add parent/child tiles if they are not yet loaded.
    for (i = 0; i < required.length; i++) {
        id = required[i];
        var tile = this._addTile(id);

        if (!tile.loaded) {
            // We need either parent or child tiles that are available immediately
            missing.push(id);
        }
    }

    findTile: for (i = 0; i < missing.length; i++) {
        id = missing[i];
        var missingZoom = Tile.zoom(id);
        var z = missingZoom;

        // Climb up to find larger tiles that cover the missing tile.
        while (z > minCoveringZoom) {
            z = this._parentZoomLevel(z);
            var parent = Tile.parentWithZoom(id, z);

            // Potentially add items from the MRU cache.
            if (this.cache.has(parent)) {
                this._addTile(parent);
            }
            else if (this.tiles[parent] && this.tiles[parent].loaded) {
                // Retain the existing parent tile
                if (required.indexOf(parent) < 0) {
                    required.push(parent);
                }
                continue findTile;
            }
        }

        // Go down for max 1 zoom levels to find child tiles.
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
            for (var child in this.tiles) {
                child = +child;
                parentID = Tile.parentWithZoom(child, missingZoom);
                if (parentID == id && this.tiles[child].loaded) {
                    // Retain the existing child tile
                    if (required.indexOf(child) < 0) {
                        required.push(child);
                    }
                }
            }
        }

        // TODO: panTile causes severe flickering
        // if (required.indexOf(panTile) < 0) {
        //     this._addTile(panTile);
        //     required.push(panTile);
        // }
    }


    var existing = Object.keys(this.tiles).map(parseFloat),
        remove = _.difference(existing, required);


    for (i = 0; i < remove.length; i++) {
        id = remove[i];
        map._removeTile(id);
    }
};

Layer.prototype._loadTile = function(id) {
    var map = this.map,
        pos = Tile.fromID(id),
        tile;

    if (pos.w === 0) {
        // console.time('loading ' + pos.z + '/' + pos.x + '/' + pos.y);
        tile = this.tiles[id] = new this.Tile(map, Tile.url(id, this.urls), pos.z, tileComplete);
    } else {
        var wrapped = Tile.toID(pos.z, pos.x, pos.y, 0);
        tile = this.tiles[id] = this.tiles[wrapped] || this._addTile(wrapped);
        tile.uses++;
    }

    function tileComplete(err) {
        // console.timeEnd('loading ' + pos.z + '/' + pos.x + '/' + pos.y);
        if (err) {
            console.warn('failed to load tile %d/%d/%d: %s', pos.z, pos.x, pos.y, err.stack || err);
        } else {
            map.update();
        }
    }

    return tile;
};

// Adds a vector tile to the map. It will trigger a rerender of the map and will
// be part in all future renders of the map. The map object will handle copying
// the tile data to the GPU if it is required to paint the current viewport.
Layer.prototype._addTile = function(id) {
    var tile;
    if (this.tiles[id]) {
        tile = this.tiles[id];
    // } else if (this.cache.has(id)) {
    //     this.tiles[id] = this.cache.get(id);
    //     return this.tiles[id];
    } else {
        tile = this._loadTile(id);
    }

    this.map.addTile(tile);
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
                // this.cache.add(id, tile);
            } else {
                tile.abort();
            }

            this.map.removeTile(tile);
            tile.remove();
        }

        delete this.tiles[id];
    }
};

// Taken from polymaps src/Layer.js
// https://github.com/simplegeo/polymaps/blob/master/src/Layer.js#L333-L383

// scan-line conversion
Layer.prototype._scanTriangle = function(a, b, c, ymin, ymax, scanLine) {
    var ab = this._edge(a, b),
        bc = this._edge(b, c),
        ca = this._edge(c, a);

    var t;

    // sort edges by y-length
    if (ab.dy > bc.dy) { t = ab; ab = bc; bc = t; }
    if (ab.dy > ca.dy) { t = ab; ab = ca; ca = t; }
    if (bc.dy > ca.dy) { t = bc; bc = ca; ca = t; }

    // scan span! scan span!
    if (ab.dy) this._scanSpans(ca, ab, ymin, ymax, scanLine);
    if (bc.dy) this._scanSpans(ca, bc, ymin, ymax, scanLine);
};

// scan-line conversion
Layer.prototype._edge = function(a, b) {
    if (a.row > b.row) { var t = a; a = b; b = t; }
    return {
        x0: a.column,
        y0: a.row,
        x1: b.column,
        y1: b.row,
        dx: b.column - a.column,
        dy: b.row - a.row
    };
};

// scan-line conversion
Layer.prototype._scanSpans = function(e0, e1, ymin, ymax, scanLine) {
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
};

Layer.prototype._z_order = function(a, b) {
    return (a % 32) - (b % 32);
};
