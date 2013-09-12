/*
 * Tiles are generally represented as packed integer ids constructed by
 * `Tile.toID(x, y, z)`
 */

/*
 * Dispatch a tile load request
 */


function Tile(map, url, callback) {
    this.loaded = false;
    this.url = url;
    this.map = map;
    this.worker = map.dispatcher.send('load tile', url, this.onTileLoad, null, null, this);
    this.callback = callback;
    this.labelTexture = new LabelTexture(this.map.labelManager);
}

Tile.prototype.onTileLoad = function(err, data) {

    if (!err && data && this.map) {

        this.lineGeometry = data.lineGeometry;
        this.layers = data.layers;

        this.drawText();

        this.loaded = true;
    } else {
        console.warn('failed to load', this.url);
    }
    this.callback(err);
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
 * Given an id and a list of urls, choose a url template and return a tile
 * URL
 */
Tile.url = function(id, urls) {
    var pos = Tile.fromID(id);
    return urls[((pos.x + pos.y) % urls.length) | 0]
        .replace('{h}', (pos.x % 16).toString(16) + (pos.y % 16).toString(16))
        .replace('{z}', pos.z.toFixed(0))
        .replace('{x}', pos.x.toFixed(0))
        .replace('{y}', pos.y.toFixed(0));
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
    delete this.map;
};

Tile.prototype.abort = function() {
    this.map.dispatcher.send('abort tile', this.url, function() {}, this.worker);
};

Tile.prototype.drawText = function() {
    // TODO: Render only fonts that haven't been rendered.
    this.labelTexture.reset();
    var tile = this;

    this.map.style.zoomed_layers.forEach(applyStyle);
    function applyStyle(info) {
        var layer = tile.layers ? tile.layers[info.data] : {};
        if (info.type != 'text' || !layer || !layer.labels || !tile.map.fonts[info.font]) {
            return;
        }
        for (var i = 0; i < layer.labels.length; i++) {
            var label = layer.labels[i];
            if (label) {
                // No idea why we have to multiply by 2...
                tile.labelTexture.drawText(info.font, info.fontSize, label.text, 2 * label.x, 2 * label.y);
            }
        }
        // tile.labelTexture.drawText(info.font, info.fontSize, [ 'R', ['o', Math.PI/9], ['t', Math.PI/9], ['a', Math.PI/9], ['t', Math.PI/9], ['i', Math.PI/9], ['o', Math.PI/9], ['n', Math.PI/9] ], 2000, 2000);
    }
};

