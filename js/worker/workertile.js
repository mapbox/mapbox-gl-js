'use strict';

var FeatureTree = require('../geometry/featuretree.js');
var Protobuf = require('pbf');
var vt = require('vector-tile');
var Collision = require('../text/collision.js');
var getArrayBuffer = require('../util/ajax.js').getArrayBuffer;

var BufferSet = require('../geometry/bufferset.js');
var createBucket = require('../geometry/createbucket.js');

module.exports = WorkerTile;
function WorkerTile(url, data, id, zoom, maxZoom, tileSize, source, actor, callback) {
    var tile = this;
    this.id = id;
    this.zoom = zoom;
    this.maxZoom = maxZoom;
    this.tileSize = tileSize;
    this.source = source;
    this.buffers = new BufferSet();

    if (url) {
        if (WorkerTile.loading[source] === undefined) WorkerTile.loading[source] = {};
        WorkerTile.loading[source][id] = getArrayBuffer(url, function(err, data) {
            delete WorkerTile.loading[source][id];
            if (err) {
                callback(err);
            } else {
                if (WorkerTile.loaded[source] === undefined) WorkerTile.loaded[source] = {};
                WorkerTile.loaded[source][id] = tile;
                tile.data = new vt.VectorTile(new Protobuf(new Uint8Array(data)));
                tile.parse(tile.data, actor, callback);
            }
        });
    } else {
        tile.parse(data, actor, callback);
    }
}

WorkerTile.cancel = function(id, sourceID) {
    var source = WorkerTile.loading[sourceID];
    if (source && source[id]) {
        source[id].abort();
        delete source[id];
    }
};

// Stores tiles that are currently loading.
WorkerTile.loading = {};

// Stores tiles that are currently loaded.
WorkerTile.loaded = {};

// Stores the style information.
WorkerTile.buckets = [];

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(data, actor, callback) {
    var tile = this;
    var bucketInfo = WorkerTile.buckets;
    this.callback = callback;

    var tileExtent = 4096;
    this.collision = new Collision(this.zoom, tileExtent, this.tileSize);
    this.featureTree = new FeatureTree(getGeometry, getType);

    var buckets = this.buckets = sortTileIntoBuckets(this, data, bucketInfo);

    var key, bucket;
    var prevPlacementBucket;

    var remaining = WorkerTile.buckets.length;

    /*
     *  The async parsing here is a bit tricky.
     *  Some buckets depend on resources that may need to be loaded async (glyphs).
     *  Some buckets need to be parsed in order (to get placement priorities right).
     *
     *  Dependencies calls are initiated first to get those rolling.
     *  Buckets that don't need to be parsed in order, aren't to save time.
     */

    var orderedBuckets = WorkerTile.buckets;
    for (var i = 0; i < orderedBuckets.length; i++) {
        bucket = buckets[orderedBuckets[i].id];
        if (!bucket) {
            remaining--;
            continue; // raster bucket, etc
        }

        var filter = bucket.info.filter;
        if (filter && filter.source !== this.source) continue;

        // Link buckets that need to be parsed in order
        if (bucket.collision) {
            if (prevPlacementBucket) {
                prevPlacementBucket.next = bucket;
            } else {
                bucket.previousPlaced = true;
            }
            prevPlacementBucket = bucket;
        }

        if (bucket.getDependencies) {
            bucket.getDependencies(this, actor, dependenciesDone(bucket));
        }

    }

    // parse buckets where order doesn't matter and no dependencies
    for (key in buckets) {
        bucket = buckets[key];
        if (!bucket.getDependencies && !bucket.collision) {
            parseBucket(tile, bucket);
        }
    }

    function dependenciesDone(bucket) {
        return function(err) {
            bucket.dependenciesLoaded = true;
            parseBucket(tile, bucket, err);
        };
    }

    function parseBucket(tile, bucket, skip) {
        if (bucket.getDependencies && !bucket.dependenciesLoaded) return;
        if (bucket.collision && !bucket.previousPlaced) return;

        if (!skip) {
            var now = Date.now();
            bucket.addFeatures();
            var time = Date.now() - now;
            if (typeof self !== 'undefined') {
                self.bucketStats = self.bucketStats || {_total: 0};
                self.bucketStats._total += time;
                self.bucketStats[bucket.name] = (self.bucketStats[bucket.name] || 0) + time;
            }

            if (!bucket.info.text) {
                for (var i = 0; i < bucket.features.length; i++) {
                    var feature = bucket.features[i];
                    tile.featureTree.insert(feature.bbox(), bucket.name, feature);
                }
            }
        }

        remaining--;
        if (!remaining) return tile.done();

        // try parsing the next bucket, if it is ready
        if (bucket.next) {
            bucket.next.previousPlaced = true;
            parseBucket(tile, bucket.next);
        }
    }
};

WorkerTile.prototype.done = function() {
    // Collect all buffers to mark them as transferable object.
    var buffers = [];

    for (var type in this.buffers) {
        buffers.push(this.buffers[type].array);
    }

    // Convert buckets to a transferable format
    var buckets = this.buckets;
    var elementGroups = {};
    for (var b in buckets) elementGroups[b] = buckets[b].elementGroups;

    this.callback(null, {
        elementGroups: elementGroups,
        buffers: this.buffers
    }, buffers);

    // we don't need anything except featureTree at this point, so we mark it for GC
    this.buffers = null;
    this.collision = null;
};

function sortTileIntoBuckets(tile, data, bucketInfo) {

    var sourceLayers = {},
        buckets = {},
        layerName;

    // For each source layer, find a list of buckets that use data from it
    for (var i = 0; i < bucketInfo.length; i++) {
        var info = bucketInfo[i];
        var bucketName = info.id;

        var minZoom = info['min-zoom'];
        var maxZoom = info['max-zoom'];

        if (info.source !== tile.source) continue;
        if (minZoom && tile.zoom < minZoom && minZoom < tile.maxZoom) continue;
        if (maxZoom && tile.zoom >= maxZoom) continue;

        var bucket = createBucket(info, tile.buffers, tile.collision);
        if (!bucket) continue;
        bucket.features = [];
        bucket.name = bucketName;
        buckets[bucketName] = bucket;

        if (data.layers) {
            // vectortile
            layerName = info['source-layer'];
            if (!sourceLayers[layerName]) sourceLayers[layerName] = {};
            sourceLayers[layerName][bucketName] = info;
        } else {
            // geojson tile
            sourceLayers[bucketName] = info;
        }
    }

    // read each layer, and sort its feature's into buckets
    if (data.layers) {
        // vectortile
        for (layerName in sourceLayers) {
            var layer = data.layers[layerName];
            if (!layer) continue;
            sortLayerIntoBuckets(layer, sourceLayers[layerName], buckets);
        }
    } else {
        // geojson
        sortLayerIntoBuckets(data, sourceLayers, buckets);
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
            if (mapping[key].compare(feature)) {
                buckets[key].features.push(feature);
            }
        }
    }
}

function getGeometry(feature) {
    return feature.loadGeometry();
}

function getType(feature) {
    return vt.VectorTileFeature.types[feature.type];
}

