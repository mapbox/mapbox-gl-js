
// function Box(box) {
//     for (var key in box) this[key] = box[key];

//     this.horizontal = (this.right - this.left) / this.width;
//     this.vertical = (this.top - this.bottom) / this.height;
// }


// function Layer(layer) {
//     this.name = layer.name;
//     this.geometry = new Geometry(layer.vertices, layer.types);
// }

function Tile(map, url, callback) {
    var tile = this;
    this.map = map;
    tile.loaded = false;
    map.dispatcher.send('load tile', url, function(err, data) {
        if (!err) {
            tile.load(data);
        } else {
            console.warn('failed to load', url);
        }
        callback(err);
    });
}

Tile.prototype.load = function(data) {
    this.data = data;
};

Tile.toID = function(z, x, y) {
    return (((1 << z) * y + x) * 32) + z;
};

Tile.asString = function(id) {
    pos = Tile.fromID(id);
    return pos.z + "/" + pos.x + "/" + pos.y;
}

Tile.fromID = function(id) {
    var z = id % 32, dim = 1 << z;
    var xy = ((id - z) / 32);
    var x = xy % dim, y = ((xy - x) / dim);
    return { z: z, x: x, y: y };
};

Tile.zoom = function(id) {
    return id % 32;
};

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

// Tile.childrenWithZoom = function(id, zoom) {
//     var pos = Tile.fromID(id);
//     var diff = zoom - pos.z;
//     var dim = 1 << diff;
//     pos.z += diff;
//     pos.x *= dim;
//     pos.y *= dim;

//     console.warn(dim);

//     var children = [];
//     for (var x = 0; x < dim; x++) {
//         for (var y = 0; y < dim; y++) {
//             children.push(Tile.toID(pos.z, pos.x + x, pos.y + y));
//         }
//     }
//     return children;
// };

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

Tile.prototype.addToMap = function(map, callback) {
    var tile = this;
    this.map.dispatcher.send('parse geometry', this.data, function(err, data) {
        tile.geometry = new Geometry(data.vertices, data.lineElements, data.fillElements);
        tile.layers = data.layers;
        tile.loaded = true;
        callback();
    }, null, [ this.data._buffer.buf.buffer ]);
};

Tile.prototype.removeFromMap = function() {
    // noop
};
