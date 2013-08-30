importScripts('/js/underscore.js', '/js/protobuf.js', '/js/vectortile.js');


function GeometryParser() {
    this.vertices = new Int16Array(10000);
    this.vertices.pos = 0;
    this.vertices.idx = 0;

    this.lineElements = new Uint16Array(10000);
    this.lineElements.pos = 0;

    this.fillElements = new Uint16Array(10000);
    this.fillElements.pos = 0;

    // Add the culled mvp vertex
    this.vertices[this.vertices.pos++] = 32767;
    this.vertices[this.vertices.pos++] = 32767;
    this.vertices.idx++;
}

GeometryParser.prototype.lineOffset = function() {
    return this.lineElements.pos;
};

GeometryParser.prototype.fillOffset = function() {
    return this.fillElements.pos;
};

var mappings = {};

self.actor.on('set mapping', function(data) {
    mappings = data;
});

self.actor.on('parse geometry', function(data, respond) {
    var layers = {}, geometry = new GeometryParser();
    var tile = new VectorTile(data);
    mappings.forEach(function(mapping) {
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

    /*
    // add labels to map.
    for (var name in this.data.layers) {
        if (name.indexOf("_label") < 0) continue;
        var layer = this.data.layers[name];

        for (var i = 0; i < layer.length; i++) {
            // console.warn(layer.feature(i));
            // get the centroid of the feature
        }
    }
    */
    respond(null, {
        vertices: geometry.vertices,
        lineElements: geometry.lineElements,
        fillElements: geometry.fillElements,
        layers: layers
    }, [ data._buffer.buf.buffer ]);
});