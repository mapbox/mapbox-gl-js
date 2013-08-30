/*
 * Tiles are generally represented as packed integer ids constructed by
 * `Tile.toID(x, y, z)`
 */

/*
 * Dispatch a tile load request
 */
function Tile(map, url, callback) {
    var tile = this;
    tile.loaded = false;
    tile.url = url;
    tile.map = map;
    tile.worker = map.dispatcher.send('load tile', url, function(err, data) {
        if (!err && data) {
            tile.geometry = new Geometry(data.vertices, data.lineElements, data.fillElements);
            tile.layers = data.layers;
            tile.loaded = true;
        } else {
            console.warn('failed to load', url);
        }
        callback(err);
    });
};


Tile.toID = function(z, x, y) {
    return (((1 << z) * y + x) * 32) + z;
};

Tile.asString = function(id) {
    pos = Tile.fromID(id);
    return pos.z + "/" + pos.x + "/" + pos.y;
};

/*
 * Parse a packed integer id into an object with x, y, and z properties
 */
Tile.fromID = function(id) {
    var z = id % 32, dim = 1 << z;
    var xy = ((id - z) / 32);
    var x = xy % dim, y = ((xy - x) / dim);
    return { z: z, x: x, y: y };
};

/*
 * Given a packed integer id, return its zoom level
 */
Tile.zoom = function(id) {
    return id % 32;
};

/*
 * Given a packed integer id, return the id of its parent tile
 */
Tile.parent = function(id) {
    var pos = Tile.fromID(id);
    if (pos.z === 0) return id;
    else return Tile.toID(pos.z - 1, Math.floor(pos.x / 2), Math.floor(pos.y / 2));
};

Tile.parentWithZoom = function(id, zoom) {
    var pos = Tile.fromID(id);
    while (pos.z > zoom) {
        pos.z--;
        pos.x = Math.floor(pos.x / 2);
        pos.y = Math.floor(pos.y / 2);
    }
    return Tile.toID(pos.z, pos.x, pos.y);
};

/*
 * Given a packed integer id, return an array of integer ids representing
 * its four children.
 */
Tile.children = function(id) {
    var pos = Tile.fromID(id);
    pos.z += 1;
    pos.x *= 2;
    pos.y *= 2;
    return [
        Tile.toID(pos.z, pos.x, pos.y),
        Tile.toID(pos.z, pos.x + 1, pos.y),
        Tile.toID(pos.z, pos.x, pos.y + 1),
        Tile.toID(pos.z, pos.x + 1, pos.y + 1)
    ];
};

Tile.prototype.removeFromMap = function() {
    // noop
};

Tile.prototype.abort = function() {
    this.map.dispatcher.send('abort tile', this.url, function() {}, this.worker);
}
