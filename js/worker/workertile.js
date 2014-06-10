'use strict';

var Geometry = require('../geometry/geometry.js');
var Bucket = require('../geometry/bucket.js');
var FeatureTree = require('../geometry/featuretree.js');
var Protobuf = require('pbf');
var VectorTile = require('../format/vectortile.js');
var VectorTileFeature = require('../format/vectortilefeature.js');
var Placement = require('../text/placement.js');
var Loader = require('../text/loader.js');
var Shaping = require('../text/shaping.js');
var queue = require('queue-async');
var getRanges = require('../text/ranges.js');
var resolveTokens = require('../util/token.js');
var getArrayBuffer = require('../util/util.js').getArrayBuffer;
// if (typeof self.console === 'undefined') {
//     self.console = require('./console.js');
// }

var actor = require('./worker.js');

module.exports = WorkerTile;
function WorkerTile(url, id, zoom, tileSize, template, glyphs, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;
    this.tileSize = tileSize;
    this.template = template;
    this.glyphs = glyphs;

    WorkerTile.loading[id] = getArrayBuffer(url, function(err, data) {
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

    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        for (var key in mapping) {
            // Filter features based on the filter function if it exists.
            if (!mapping[key].compare || mapping[key].compare(feature)) {

                // Only load features that have the same geometry type as the bucket.
                var type = VectorTileFeature.mapping[feature._type];
                if (type === mapping[key].filter.feature_type || mapping[key][type]) {
                    if (!(key in buckets)) buckets[key] = [];
                    buckets[key].push(feature);
                }
            }
        }
    }

    return buckets;
}

WorkerTile.prototype.parseBucket = function(tile, bucket_name, features, info, layer, layerDone, callback) {
    var geometry = tile.geometry;

    var bucket = new Bucket(info, geometry, tile.placement);

    if (info.text) {
        tile.parseTextBucket(tile, bucket_name, features, bucket, info, layer, done);
    } else if (info.point) {
        tile.parsePointBucket(tile, bucket_name, features, bucket, info, layer, done);
    } else {
        tile.parseOtherBucket(tile, bucket_name, features, bucket, info, layer, done);
    }

    function done(err) {
        layerDone(err, bucket, callback);
    }
};

WorkerTile.prototype.parseOtherBucket = function(tile, bucket_name, features, bucket, info, layer, callback) {
    bucket.start();
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        bucket.addFeature(feature.loadGeometry());

        tile.featureTree.insert(feature.bbox(), bucket_name, feature);
    }
    bucket.end();
    setTimeout(callback, 0);
};

WorkerTile.prototype.parsePointBucket = function(tile, bucket_name, features, bucket, info, layer, callback) {
    if (info['point-image']) {
        actor.send('get sprite json', {}, addFeatures);
    } else {
        addFeatures();
    }
    function addFeatures(err, sprite) {
        if (err) return callback(err);
        bucket.start();
        for (var i = 0; i < features.length; i++) {
            var feature = features[i];
            var imagePos = false;
            if (info['point-image'] && sprite) {
                imagePos = sprite[resolveTokens(feature, info['point-image'])];
                imagePos = imagePos && {
                    tl: [ imagePos.x, imagePos.y ],
                    br: [ imagePos.x + imagePos.width, imagePos.y + imagePos.height ]
                };
            }

            bucket.addFeature(feature.loadGeometry(), imagePos);
            tile.featureTree.insert(feature.bbox(), bucket_name, feature);
        }
        bucket.end();
        setTimeout(callback, 0);
    }
};

WorkerTile.prototype.parseTextBucket = function(tile, bucket_name, features, bucket, info, layer, callback) {
    var fontstack = info['text-font'];
    var data = getRanges(features, info);
    var ranges = data.ranges;
    var text_features = data.text_features;
    var codepoints = data.codepoints;

    Loader.whenLoaded(tile, fontstack, ranges, function(err) {
        if (err) return callback(err);

        var stacks = {};
        stacks[fontstack] = {};
        stacks[fontstack].glyphs = codepoints.reduce(function(obj, codepoint) {
            obj[codepoint] = Loader.stacks[fontstack].glyphs[codepoint];
            return obj;
        }, {});

        actor.send('add glyphs', {
            id: tile.id,
            stacks: stacks
        }, function(err, rects) {
            if (err) return callback(err);

            // Merge the rectangles of the glyph positions into the face object
            for (var name in rects) {
                if (!stacks[name]) stacks[name] = {};
                stacks[name].rects = rects[name];
            }

            var alignment = 0.5;
            if (bucket.info['text-alignment'] === 'right') alignment = 1;
            else if (bucket.info['text-alignment'] === 'left') alignment = 0;

            var oneEm = 24;
            var lineHeight = (bucket.info['text-line-height'] || 1.2) * oneEm;
            var maxWidth = (bucket.info['text-max-width'] || 15) * oneEm;
            var spacing = (bucket.info['text-letter-spacing'] || 0) * oneEm;

            bucket.start();
            for (var k = 0; k < text_features.length; k++) {
                var text = text_features[k].text;
                var lines = text_features[k].geometry;
                var shaping = Shaping.shape(text, fontstack, stacks, maxWidth, lineHeight, alignment, spacing);
                if (!shaping) continue;
                bucket.addFeature(lines, stacks, shaping);
            }
            bucket.end();

            callback();
        });
    });
};

var geometryTypeToName = [null, 'point', 'line', 'fill'];

function getGeometry(feature) {
    return feature.loadGeometry();
}

function getType(feature) {
    return geometryTypeToName[feature._type];
}

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
    this.placement = new Placement(this.geometry, this.zoom, this.tileSize);
    this.featureTree = new FeatureTree(getGeometry, getType);

    // Find all layers that we need to pull information from.
    var sourceLayers = {},
        layerName;

    for (var bucket in buckets) {
        layerName = buckets[bucket].filter.layer;
        if (!sourceLayers[layerName]) sourceLayers[layerName] = {};
        sourceLayers[layerName][bucket] = buckets[bucket];
    }

    var q = queue(1);

    var layerSets = {}, layer;
    for (layerName in sourceLayers) {
        layer = tile.layers[layerName];
        if (!layer) continue;

        var featuresets = sortFeaturesIntoBuckets(layer, sourceLayers[layerName]);
        layerSets[layerName] = featuresets;
    }

    // All features are sorted into buckets now. Add them to the geometry
    // object and remember the position/length
    for (var key in buckets) {
        var info = buckets[key];
        if (!info) {
            alert("missing bucket information for bucket " + key);
            continue;
        }

        layerName = info.filter.layer;
        var features = layerSets[layerName] && layerSets[layerName][key];
        layer = tile.layers[layerName];

        if (features) {
            q.defer(self.parseBucket, this, key, features, info, layer, layerDone(key));
        }
    }

    function layerDone(key) {
        return function(err, bucket, callback) {
            if (err) return callback(err);
            layers[key] = bucket;
            callback();
        };
    }

    q.awaitAll(function done() {
        // Collect all buffers to mark them as transferable object.
        var buffers = self.geometry.bufferList();

        // Convert buckets to a transferable format
        var bucketJSON = {};
        for (var b in layers) bucketJSON[b] = layers[b].toJSON();

        callback(null, {
            geometry: self.geometry,
            buckets: bucketJSON
        }, buffers);

        // we don't need anything except featureTree at this point, so we mark it for GC
        self.geometry = null;
        self.placement = null;
    });
};
