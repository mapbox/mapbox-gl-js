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

    var bucket = createBucket(info, tile.placement, undefined, tile.buffers);

    bucket.features = features;

    if (bucket.getDependencies) {
        bucket.getDependencies(tile, parse);
    } else {
        parse();
    }

    function parse(err) {
        if (err) return layerDone(err);

        bucket.addFeatures();

        if (!bucket.text) {
            for (var i = 0; i < features.length; i++) {
                var feature = features[i];
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
    var buckets = WorkerTile.buckets;
    var layers = {};

    this.placement = new Placement(this.zoom, this.tileSize);
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
