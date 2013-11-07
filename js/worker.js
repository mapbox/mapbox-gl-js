'use strict';

var Actor = require('./actor.js');
var Geometry = require('./geometry.js');
var util = require('./util.js');
var Protobuf = require('./protobuf.js');
var VectorTile = require('./vectortile.js');
var rbush = require('./lib/rbush.js');
var rotationRange = require('./rotationrange.js');
var Placement = require('./placement.js');
var Collision = require('./collision.js');

var actor = new Actor(self, self);

// Debug
// if (typeof console === 'undefined') {
    var console = {};
    console.log = console.warn = function() {
        postMessage({ type: 'debug message', data: [].slice.call(arguments) });
    };
    console._startTimes = {};
    console.time = function(n) {
        console._startTimes[n] = (new Date()).getTime();
    };
    console.timeEnd = function(n) {
        console.log(n + ':', (new Date()).getTime() - console._startTimes[n] + 'ms');
    };
// }

if (typeof alert === 'undefined') {
    var alert = function() {
        postMessage({ type: 'alert message', data: [].slice.call(arguments) });
    };
}


// Stores the style information.
var style = {};

/*
 * Updates the style to use for this map.
 *
 * @param {Style} data
 */
self['set style'] = function(data) {
    style = data;
};

/*
 * Load and parse a tile at `url`, and call `callback` with
 * (err, response)
 *
 * @param {string} url
 * @param {function} callback
 */
self['load tile'] = function(params, callback) {
    new WorkerTile(params.url, params.id, params.zoom, callback);
};

/*
 * Abort the request keyed under `url`
 *
 * @param {string} url
 */
self['abort tile'] = function(id) {
    WorkerTile.cancel(id);
};

self['remove tile'] = function(id) {
    if (WorkerTile.loaded[id]) {
        delete WorkerTile.loaded[id];
    }
};

self['list layers'] = function(id, callback) {
    if (WorkerTile.loaded[id]) {
        callback(null, Object.keys(WorkerTile.loaded[id].data.layers));
    } else {
        callback(null, []);
    }
};

/*
 * Request a resources as an arraybuffer
 *
 * @param {string} url
 * @param {function} callback
 */
function loadBuffer(url, callback) {
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
}


function WorkerTile(url, id, zoom, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;

    WorkerTile.loading[id] = loadBuffer(url, function(err, data) {
        delete WorkerTile.loading[id];
        if (err) {
            callback(err);
        } else {
            WorkerTile.loaded[id] = tile;
            tile.data = new VectorTile(new Protobuf(new Uint8Array(data)));
            tile.parse(tile.data, callback);
        }
    });
}

WorkerTile.cancel = function(id) {
    if (WorkerTile.loading[id]) {
        WorkerTile.loading[id].abort();
        delete WorkerTile.loading[id];
    }
};

// Stores tiles that are currently loading.
WorkerTile.loading = {};

// Stores tiles that are currently loaded.
WorkerTile.loaded = {};

/*
 * Sorts features in a layer into different buckets, according to the maping
 *
 * Layers in vector tiles contain many different features, and feature types,
 * e.g. the landuse layer has parks, industrial buildings, forests, playgrounds
 * etc. However, when styling, we need to separate these features so that we can
 * render them separately with different styles.
 *
 * @param {VectorTileLayer} layer
 * @param {Mapping} mapping
 */
function sortFeaturesIntoBuckets(layer, mapping) {
    var buckets = {};
    var key, feature;
    for (var i = 0; i < layer.length; i++) {
        feature = layer.feature(i);
        for (key in mapping.sort) {
            if (mapping.sort[key] === true ||
                mapping.sort[key].indexOf(feature[mapping.field]) >= 0) {
                if (!(key in buckets)) buckets[key] = [];
                buckets[key].push(feature);
                break;
            }
        }
    }

    return buckets;
}

WorkerTile.prototype.parseBucket = function(features, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Remember starting indices of the geometry buffers.
    var bucket = {
        info: info,
        buffer: geometry.bufferIndex,
        vertexIndex: geometry.vertex.index,
        fillIndex: geometry.fill.index
    };

    if (info.type == "text") {
        this.parseTextBucket(features, bucket, info, faces, layer, done);
    } else if (info.type == "point" && info.marker) {
        this.parseMarkerBucket(features, bucket, info, faces, layer, done);
    } else {
        this.parseShapeBucket(features, bucket, info, faces, layer, done);
    }

    function done() {
        bucket.bufferEnd = geometry.bufferIndex;
        bucket.vertexIndexEnd = geometry.vertex.index;
        bucket.fillIndexEnd = geometry.fill.index;
        callback(bucket);
    }
};

WorkerTile.prototype.parseTextBucket = function(features, bucket, info, faces, layer, callback) {
    this.placement.parseTextBucket(features, bucket, info, faces, layer, callback);
};

WorkerTile.prototype.parseMarkerBucket = function(features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;
    var spacing = info.spacing || 100;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addMarkers(lines[j], spacing);
        }
    }

    callback();
};

WorkerTile.prototype.parseShapeBucket = function(features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addLine(lines[j], info.join, info.cap, info.miterLimit, info.roundLimit);
        }
    }

    callback();
};

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(tile, callback) {
    var self = this;
    var layers = {};

    // label placement
    this.tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);

    this.geometry = new Geometry();
    this.collision = new Collision();
    this.placement = new Placement(this.geometry, this.zoom, this.collision);

    var mappings = style.mapping;

    actor.send('add glyphs', {
        id: self.id,
        faces: tile.faces
    }, function(err, rects) {
        if (err) {
            // Stop processing this tile altogether if we failed to add the glyphs.
            return;
        }

        // Merge the rectangles of the glyph positions into the face object
        for (var name in rects) {
            tile.faces[name].rects = rects[name];
        }

        util.async_each(mappings, function(mapping, callback) {
            var layer = tile.layers[mapping.layer];
            if (!layer) return callback();

            var buckets = sortFeaturesIntoBuckets(layer, mapping);

            // Build an index of font faces used in this layer.
            var face_index = [];
            for (var i = 0; i < layer.faces.length; i++) {
                face_index[i] = tile.faces[layer.faces[i]];
            }

            // All features are sorted into buckets now. Add them to the geometry
            // object and remember the position/length
            util.async_each(Object.keys(buckets), function(key, callback) {
                var features = buckets[key];
                var info = style.buckets[key];
                if (!info) {
                    alert("missing bucket information for bucket " + key);
                    return callback();
                }

                self.parseBucket(features, info, face_index, layer, function(bucket) {
                    layers[key] = bucket;
                    callback();
                });
            }, callback);
        }, function parseTileComplete() {
            // Collect all buffers to mark them as transferable object.
            var buffers = self.geometry.bufferList();

            callback(null, {
                geometry: self.geometry,
                layers: layers
            }, buffers);
        });
    });
};
