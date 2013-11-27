'use strict';

var Geometry = require('../geometry/geometry.js');
var util = require('../util/util.js');
var rbush = require('../lib/rbush.js');
var Protobuf = require('../format/protobuf.js');
var VectorTile = require('../format/vectortile.js');
var VectorTileFeature = require('../format/vectortilefeature.js');
var rotationRange = require('../text/rotationrange.js');
var Placement = require('../text/placement.js');
var Collision = require('../text/collision.js');

if (typeof console === 'undefined') {
    var console = require('./console.js');
}


var actor = require('./worker.js');

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

module.exports = WorkerTile;
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

// Stores the style information.
WorkerTile.buckets = {};

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
        for (var key in mapping) {
            // Filter features based on the filter function if it exists.
            if (!mapping[key].fn || mapping[key].fn(feature)) {

                // Only load features that have the same geometry type as the bucket.
                if (mapping[key].type === VectorTileFeature.mapping[feature._type]) {
                    if (!(key in buckets)) buckets[key] = [];
                    buckets[key].push(feature);
                }
            }
        }
    }

    return buckets;
}

WorkerTile.prototype.parseBucket = function(bucket_name, features, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Remember starting indices of the geometry buffers.
    var bucket = {
        buffer: geometry.bufferIndex,
        vertexIndex: geometry.vertex.index,
        fillIndex: geometry.fill.index,
        glyphVertexIndex: geometry.glyph.index
    };

    if (info.text === true) {
        this.parseTextBucket(bucket_name, features, bucket, info, faces, layer, done);
    } else if (info.type == "point" && info.marker) {
        this.parseMarkerBucket(bucket_name, features, bucket, info, faces, layer, done);
    } else {
        this.parseShapeBucket(bucket_name, features, bucket, info, faces, layer, done);
    }

    function done() {
        bucket.bufferEnd = geometry.bufferIndex;
        bucket.vertexIndexEnd = geometry.vertex.index;
        bucket.fillIndexEnd = geometry.fill.index;
        bucket.glyphVertexIndexEnd = geometry.glyph.index;
        callback(bucket);
    }
};

WorkerTile.prototype.parseTextBucket = function(bucket_name, features, bucket, info, faces, layer, callback) {
    // TODO: currently hardcoded to use the first font stack.
    // Get the list of shaped labels for this font stack.
    var stack = Object.keys(layer.shaping)[0];
    var shapingDB = layer.shaping[stack];
    if (!shapingDB) return callback();

    //console.time('placement');

    for (var i = 0; i < features.length; i++) {
        var feature = features[i];

        var text = feature[info.text_field];
        if (!text) continue;

        var shaping = shapingDB[text];
        var lines = feature.loadGeometry();

        this.placement.addFeature(lines, info, faces, shaping);

    }

    //console.timeEnd('placement');
    callback();
};

WorkerTile.prototype.parseMarkerBucket = function(bucket_name, features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;
    var spacing = info.spacing || 100;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addMarkers(lines[j], spacing);
        }

        var bbox = feature.bbox();
        bbox.bucket = bucket_name;
        bbox.feature = feature;
        this.tree.insert(bbox);
    }

    callback();
};

WorkerTile.prototype.parseShapeBucket = function(bucket_name, features, bucket, info, faces, layer, callback) {
    var geometry = this.geometry;

    // Add all the features to the geometry
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var lines = feature.loadGeometry();
        for (var j = 0; j < lines.length; j++) {
            geometry.addLine(lines[j], info.join, info.cap, info.miterLimit, info.roundLimit);
        }

        var bbox = feature.bbox();
        bbox.bucket = bucket_name;
        bbox.feature = feature;
        this.tree.insert(bbox);
    }

    callback();
};

WorkerTile.prototype.stats = function() {
    var tile = this.data;
    var omit = ['osm_id', 'name', 'name_en', 'name_de', 'name_es', 'name_fr', 'maki', 'website', 'address', 'reflen', 'len', 'area'];

    var stats = { fill: {}, line: {}, point: {} };
    for (var layer_name in tile.layers) {
        var layer = tile.layers[layer_name];
        var tags = {};
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            var type = VectorTileFeature.mapping[feature._type];
            if (!(type in tags)) tags[type] = stats[type][layer_name] = { '(all)': 0 };
            tags[type]['(all)']++;
            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_' && omit.indexOf(key) < 0) {
                    if (!(key in tags[type])) tags[type][key] = {};
                    var val = feature[key];
                    if (tags[type][key][val]) tags[type][key][val]++;
                    else tags[type][key][val] = 1;
                }
            }
        }
    }

    return stats;
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
    var buckets = WorkerTile.buckets;
    var layers = {};

    this.geometry = new Geometry();
    this.collision = new Collision();
    this.placement = new Placement(this.geometry, this.zoom, this.collision);
    this.tree = rbush(9, ['.x1', '.y1', '.x2', '.y2']);

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


        // Find all layers that we need to pull information from.
        var source_layers = {};
        for (var bucket in buckets) {
            if (!source_layers[buckets[bucket].layer]) source_layers[buckets[bucket].layer] = {};
            source_layers[buckets[bucket].layer][bucket] = buckets[bucket];
        }

        util.async_each(Object.keys(source_layers), function(layer_name, callback) {
            var layer = tile.layers[layer_name];
            if (!layer) return callback();

            var featuresets = sortFeaturesIntoBuckets(layer, source_layers[layer_name]);

            // Build an index of font faces used in this layer.
            var face_index = [];
            for (var i = 0; i < layer.faces.length; i++) {
                face_index[i] = tile.faces[layer.faces[i]];
            }

            // All features are sorted into buckets now. Add them to the geometry
            // object and remember the position/length
            util.async_each(Object.keys(featuresets), function(key, callback) {
                var features = featuresets[key];
                var info = buckets[key];
                if (!info) {
                    alert("missing bucket information for bucket " + key);
                    return callback();
                }

                self.parseBucket(key, features, info, face_index, layer, function(bucket) {
                    layers[key] = bucket;
                    callback();
                });
            }, callback);
        }, function parseTileComplete() {
            // Collect all buffers to mark them as transferable object.
            var buffers = self.geometry.bufferList();

            callback(null, {
                geometry: self.geometry,
                layers: layers,
                stats: self.stats()
            }, buffers);
        });
    });
};

var geometryTypeToName = [null, 'point', 'line', 'fill'];


// Finds features in this tile at a particular position.
WorkerTile.prototype.query = function(args, callback) {
    var tile = this.data;

    var radius = 0;
    if ('radius' in args.params) {
        radius = args.params.radius;
    }

    radius *= 4096 / args.scale;

    // console.warn(args.scale);
    // var radius = 0;
    var x = args.x;
    var y =  args.y;

    var matching = this.tree.search([ x - radius, y - radius, x + radius, y + radius ]);

    if (args.params.buckets) {
        this.queryBuckets(matching, x, y, radius, args.params, callback);
    } else {
        this.queryFeatures(matching, x, y, radius, args.params, callback);
    }
};

WorkerTile.prototype.queryFeatures = function(matching, x, y, radius, params, callback) {
    var result = [];
    for (var i = 0; i < matching.length; i++) {
        var feature = matching[i].feature;

        if (params.bucket && matching[i].bucket !== params.bucket) continue;
        if (params.type && geometryTypeToName[feature._type] !== params.type) continue;

        if (feature.contains({ x: x, y: y }, radius)) {
            var props = {
                _bucket: matching[i].bucket,
                _type: geometryTypeToName[feature._type]
            };

            if (params.geometry) {
                props._geometry = feature.loadGeometry();
            }

            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_') {
                    props[key] = feature[key];
                }
            }
            result.push(props);
        }
    }

    callback(null, result);
};

// Lists all buckets that at the position.
WorkerTile.prototype.queryBuckets = function(matching, x, y, radius, params, callback) {
    var buckets = [];
    for (var i = 0; i < matching.length; i++) {
        if (buckets.indexOf(matching[i].bucket) >= 0) continue;

        var feature = matching[i].feature;
        if (feature.contains({ x: x, y: y }, radius)) {
            buckets.push(matching[i].bucket);
        }
    }

    callback(null, buckets);
};
