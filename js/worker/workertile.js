'use strict';

var FeatureTree = require('../geometry/featuretree.js');
var Protobuf = require('pbf');
var VectorTile = require('../format/vectortile.js');
var VectorTileFeature = require('../format/vectortilefeature.js');
var Placement = require('../text/placement.js');
var queue = require('queue-async');
var getArrayBuffer = require('../util/util.js').getArrayBuffer;
// if (typeof self.console === 'undefined') {
//     self.console = require('./console.js');
// }

var LineVertexBuffer = require('../geometry/linevertexbuffer.js');
var LineElementBuffer = require('../geometry/lineelementbuffer.js');
var FillVertexBuffer = require('../geometry/fillvertexbuffer.js');
var FillElementBuffer = require('../geometry/fillelementsbuffer.js');
var GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js');
var PointVertexBuffer = require('../geometry/pointvertexbuffer.js');

var createBucket = require('../geometry/createbucket.js');

module.exports = WorkerTile;
function WorkerTile(url, id, zoom, tileSize, glyphs, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;
    this.tileSize = tileSize;
    this.glyphs = glyphs;

    this.buffers = {
        glyphVertex: new GlyphVertexBuffer(),
        pointVertex: new PointVertexBuffer(),
        fillVertex: new FillVertexBuffer(),
        fillElement: new FillElementBuffer(),
        lineVertex: new LineVertexBuffer(),
        lineElement: new LineElementBuffer()
    };

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

function sortTileIntoBuckets(tile, data, bucketInfo) {

    var sourceLayers = {},
        buckets = {},
        layerName;

    // For each source layer, find a list of buckets that use data from it
    for (var bucketName in bucketInfo) {
        var info = bucketInfo[bucketName];
        var bucket = createBucket(info, tile.placement, undefined, tile.buffers);
        if (!bucket) continue;
        bucket.features = [];
        buckets[bucketName] = bucket;

        layerName = bucketInfo[bucketName].filter.layer;
        if (!sourceLayers[layerName]) sourceLayers[layerName] = {};
        sourceLayers[layerName][bucketName] = info;
    }

    // read each layer, and sort its feature's into buckets
    for (layerName in sourceLayers) {
        var layer = data.layers[layerName];
        if (!layer) continue;
        sortLayerIntoBuckets(layer, sourceLayers[layerName], buckets);
    }

    return buckets;
}

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
function sortLayerIntoBuckets(layer, mapping, buckets) {

    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        for (var key in mapping) {
            // Filter features based on the filter function if it exists.
            if (!mapping[key].compare || mapping[key].compare(feature)) {

                // Only load features that have the same geometry type as the bucket.
                var type = VectorTileFeature.mapping[feature._type];
                if (type === mapping[key].filter.feature_type || mapping[key][type]) {
                    buckets[key].features.push(feature);
                }
            }
        }
    }
}

WorkerTile.prototype.parseBucket = function(tile, bucket_name, bucket, layerDone, callback) {

    if (bucket.getDependencies) {
        bucket.getDependencies(tile, parse);
    } else {
        parse();
    }

    function parse(err) {
        if (err) return layerDone(err);

        bucket.addFeatures();

        if (!bucket.text) {
            for (var i = 0; i < bucket.features.length; i++) {
                var feature = bucket.features[i];
                tile.featureTree.insert(feature.bbox(), bucket_name, feature);
            }
        }

        layerDone(err, bucket, callback);
    }
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
    var bucketInfo = WorkerTile.buckets;
    var layers = {};

    this.placement = new Placement(this.zoom, this.tileSize);
    this.featureTree = new FeatureTree(getGeometry, getType);

    var buckets = sortTileIntoBuckets(this, tile, bucketInfo);

    var q = queue(1);

    for (var key in buckets) {
        q.defer(self.parseBucket, this, key, buckets[key], layerDone(key));
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
        var buffers = [];

        for (var type in self.buffers) {
            buffers.push(self.buffers[type].array);
        }

        // Convert buckets to a transferable format
        var elementGroups = {};
        for (var b in layers) elementGroups[b] = layers[b].elementGroups;

        callback(null, {
            elementGroups: elementGroups,
            buffers: self.buffers
        }, buffers);

        // we don't need anything except featureTree at this point, so we mark it for GC
        self.buffers = null;
        self.placement = null;
    });
};
