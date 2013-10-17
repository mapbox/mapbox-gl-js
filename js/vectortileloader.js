importScripts('/gl/js/lib/underscore.js',
              '/gl/js/protobuf.js',
              '/gl/js/util.js',
              '/gl/js/vectortile.js',
              '/gl/js/fillbuffer.js',
              '/gl/js/vertexbuffer.js',
              '/gl/js/geometry.js');


var mappings = {};

self.actor.on('mapping', function(data) {
    mappings = data;
});

/*
 * Construct a new LoaderManager object
 */
function LoaderManager() {
    this.loading = {};
}

/*
 * Load and parse a tile at `url`, and call `respond` with
 * (err, response)
 *
 * @param {string} url
 * @param {function} respond
 */
LoaderManager.prototype.load = function(url, respond) {
    var mgr = this;
    this.loading[url] = this.loadBuffer(url, function(err, buffer) {
        delete mgr.loading[url];
        if (err) {
            respond(err);
        }
        else {
            mgr.parseTile(buffer, respond);
        }
    });
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
LoaderManager.prototype.abort = function(url) {
    if (this.loading[url]) {
        this.loading[url].abort();
        delete this.loading[url];
    }
};

/*
 * Request a resources as an arraybuffer
 *
 * @param {string} url
 * @param {function} callback
 */
LoaderManager.prototype.loadBuffer = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, xhr.response);
        } else {
            callback(xhr.statusText);
        }
    };
    xhr.send();
    return xhr;
};

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
LoaderManager.prototype.parseTile = function(data, respond) {
    var tile = new VectorTile(new Protobuf(new Uint8Array(data)));
    var layers = {};
    var geometry = new Geometry();

    mappings.forEach(function(mapping) {
        var original_layer = tile.layers[mapping.layer];
        if (original_layer) {
            var buckets = {}; for (var key in mapping.sort) buckets[key] = [];

            for (var i = 0; i < original_layer.length; i++) {
                var feature = original_layer.feature(i);
                for (key in mapping.sort) {
                    if (mapping.sort[key] === true ||
                        mapping.sort[key].indexOf(feature[mapping.field]) >= 0) {
                        buckets[key].push(feature);
                        break;
                    }
                }
            }

            // All features are sorted into buckets now. Add them to the geometry
            // object and remember the position/length
            for (key in buckets) {
                layer = layers[key] = {
                    buffer: geometry.bufferIndex,
                    vertexIndex: geometry.vertex.index,
                    fillIndex: geometry.fill.index
                };
                if (mapping.label) {
                    layer.labels = [];
                }

                // Add all the features to the geometry
                var bucket = buckets[key];
                for (i = 0; i < bucket.length; i++) {
                    var lines = bucket[i].loadGeometry();

                    for (var j = 0; j < lines.length; j++) {
                        // TODO: respect join and cap styles
                        if (mapping.markers) {
                            geometry.addMarkers(lines[j], mapping.spacing || 100);
                        } else {
                            geometry.addLine(lines[j], mapping.linejoin, mapping.linecap,
                                    mapping.miterLimit, mapping.roundLimit);
                        }


                        if (mapping.label) {
                            layer.labels.push({ text: bucket[i][mapping.label], vertices: lines[j] });
                        }
                    }
                }

                layer.bufferEnd = geometry.bufferIndex;
                layer.vertexIndexEnd = geometry.vertex.index;
                layer.fillIndexEnd = geometry.fill.index;
                layer.shaping = original_layer.shaping;
                layer.faces = original_layer._faces;
            }
        }
    });

    // Collect all buffers to mark them as transferable object.
    var buffers = [ data ];
    for (var i = 0; i < geometry.buffers.length; i++) {
        buffers.push(geometry.buffers[i].fill.array, geometry.buffers[i].vertex.array);
    }

    respond(null, {
        geometry: geometry,
        layers: layers,
        faces: tile.faces
    }, buffers);
};

var manager = new LoaderManager();

self.actor.on('load tile', function(url, respond) {
    manager.load(url, respond);
});

self.actor.on('abort tile', function(url, respond) {
    manager.abort(url);
});
