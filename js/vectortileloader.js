importScripts('/gl/js/lib/underscore.js',
              '/gl/js/protobuf.js',
              '/gl/js/util.js',
              '/gl/js/vectortile/vectortilefeature.js',
              '/gl/js/vectortile/vectortilelayer.js',
              '/gl/js/vectortile/vectortile.js',
              '/gl/js/fillbuffer.js',
              '/gl/js/vertexbuffer.js',
              '/gl/js/linegeometry.js');


var mappings = {};

self.actor.on('set mapping', function(data) {
    mappings = data;
});

function VectorTileLayerLoader(buffer, end) {
    this._buffer = buffer;

    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    this._keys = [];
    this._values = [];
    this._features = [];

    if (typeof end === 'undefined') {
        end = buffer.length;
    }

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 15) {
            this.version = buffer.readVarint();
        } else if (tag == 1) {
            this.name = buffer.readString();
        } else if (tag == 5) {
            this.extent = buffer.readVarint();
        } else if (tag == 2) {
            this.length++;
            this._features.push(buffer.pos);
            buffer.skip(val);
        } else if (tag == 3) {
            this._keys.push(buffer.readString());
        } else if (tag == 4) {
            this._values.push(VectorTileLayerLoader.readFeatureValue(buffer));
        } else if (tag == 6) {
            this.vertex_count = buffer.readVarint();
        } else {
            console.warn('skipping', tag);
            buffer.skip(val);
        }
    }
}

VectorTileLayerLoader.readFeatureValue = function(buffer) {
    var value = null;

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            value = buffer.readString();
        } else if (tag == 2) {
            throw new Error('read float');
        } else if (tag == 3) {
            value = buffer.readDouble();
        } else if (tag == 4) {
            value = buffer.readVarint();
        } else if (tag == 5) {
            throw new Error('read uint');
        } else if (tag == 6) {
            value = buffer.readSVarint();
        } else if (tag == 7) {
            value = Boolean(buffer.readVarint());
        } else {
            buffer.skip(val);
        }
    }

    return value;
};

function VectorTileLoader(buffer, end) {
    this._buffer = buffer;
    this.layers = {};

    if (typeof end === 'undefined') {
        end = buffer.length;
    }

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 3) {
            var layer_bytes = buffer.readVarint();
            var layer_end = buffer.pos + layer_bytes;
            var layer = new VectorTileLayerLoader(buffer, layer_end);
            if (layer.length) {
                this.layers[layer.name] = layer;
            }
            buffer.pos = layer_end;
        } else {
            buffer.skip(val);
        }
    }
}

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
            try {
                var tile = new VectorTileLoader(new Protobuf(buffer));
                mgr.parseTile(tile, respond);
            } catch (e) {
                respond(e);
            }
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
            callback(null, new Uint8Array(xhr.response));
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
LoaderManager.prototype.parseTile = function(data, respond) { try {
    var layers = {};
    var lineGeometry = new LineGeometry();
    var tile = new VectorTile(data);

    mappings.forEach(function(mapping) {
        var layer = tile.layers[mapping.layer];
        if (layer) {
            var buckets = {}; for (var key in mapping.sort) buckets[key] = [];

            for (var i = 0; i < layer.length; i++) {
                var feature = layer.feature(i);
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
                    buffer: lineGeometry.bufferIndex,
                    vertexIndex: lineGeometry.vertex.index,
                    fillIndex: lineGeometry.fill.index,
                    labels: []
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
                            lineGeometry.addMarkers(lines[j], mapping.spacing || 100);
                        } else {
                            lineGeometry.addLine(lines[j], mapping.linejoin, mapping.linecap,
                                    mapping.miterLimit, mapping.roundLimit);
                        }

                        if (mapping.label) {
                            layer.labels.push({ text: bucket[i][mapping.label], vertices: lines[j] });
                        }
                    }
                }

                layer.bufferEnd = lineGeometry.bufferIndex;
                layer.vertexIndexEnd = lineGeometry.vertex.index;
                layer.fillIndexEnd = lineGeometry.fill.index;
            }
        }
    });

    respond(null, {
        lineGeometry: lineGeometry,
        layers: layers
    }, [ data._buffer.buf.buffer ]);

    } catch(e) {
        // Forward the stack error to the main thread.
        console.warn(e.stack);
    }
};

var manager = new LoaderManager();

self.actor.on('load tile', function(url, respond) {
    manager.load(url, respond);
});

self.actor.on('abort tile', function(url, respond) {
    manager.abort(url);
});
