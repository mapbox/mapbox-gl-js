
// function Box(box) {
//     for (var key in box) this[key] = box[key];

//     this.horizontal = (this.right - this.left) / this.width;
//     this.vertical = (this.top - this.bottom) / this.height;
// }


// function Layer(layer) {
//     this.name = layer.name;
//     this.geometry = new Geometry(layer.vertices, layer.types);
// }


function Tile(url, callback) {
    var tile = this;
    tile.loaded = false;

    loadBuffer(url, function(err, data) {
        if (!err) {
            tile.load(data);
        }
        callback(err);
    });
}

Tile.prototype.load = function(buffer) {
    this.data = new VectorTile(new Protobuf(buffer));
    this.loaded = true;
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

Tile.prototype.addToMap = function(map) {
    // Transfer the geometries to the map's painter.
    var geometry = this.geometry = new Geometry();

    var layers = this.layers = {};

    var tile = this.data;
    map.style.mapping.forEach(function(mapping) {
        var layer = tile.layers[mapping.layer];
        if (layer) {
            var buckets = {}; for (var key in mapping.sort) buckets[key] = [];

            for (var i = 0; i < layer.length; i++) {
                var feature = layer.feature(i);
                for (var key in mapping.sort) {
                    if (mapping.sort[key] === true ||
                        mapping.sort[key].indexOf(feature[mapping.field]) >= 0) {
                        buckets[key].push(feature);
                        break;
                    }
                }
            }

            // All features are sorted into buckets now. Add them to the geometry
            // object and remember the position/length
            for (var key in buckets) {
                var layer = layers[key] = {
                    line: geometry.lineOffset(),
                    fill: geometry.fillOffset()
                };

                // Add all the features to the geometry
                var bucket = buckets[key];
                for (var i = 0; i < bucket.length; i++) {
                    bucket[i].drawNative(geometry);
                }

                layer.lineEnd = geometry.lineOffset();
                layer.fillEnd = geometry.fillOffset();
            }
        }
    });


    // add labels to map.
    for (var name in this.data.layers) {
        if (name.indexOf("_label") < 0) continue;
        var layer = this.data.layers[name];

        for (var i = 0; i < layer.length; i++) {
            // console.warn(layer.feature(i));
            // get the centroid of the feature
        }
    }

};

Tile.prototype.removeFromMap = function() {
    // noop
};
