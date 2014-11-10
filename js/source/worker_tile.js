'use strict';

var FeatureTree = require('../data/feature_tree');
var vt = require('vector-tile');
var Collision = require('../symbol/collision');

var BufferSet = require('../data/buffer/buffer_set');
var createBucket = require('../data/create_bucket');

module.exports = WorkerTile;

function WorkerTile(id, zoom, maxZoom, tileSize, source, depth) {
    this.id = id;
    this.zoom = zoom;
    this.maxZoom = maxZoom;
    this.tileSize = tileSize;
    this.source = source;
    this.depth = depth;
    this.buffers = new BufferSet();
}

/*
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(data, bucketInfo, actor, callback) {
    var tile = this;

    this.data = data;
    this.callback = callback;

    var tileExtent = 4096;
    this.collision = new Collision(this.zoom, tileExtent, this.tileSize, this.depth);
    this.featureTree = new FeatureTree(getGeometry, getType);

    var buckets = this.buckets = sortTileIntoBuckets(this, data, bucketInfo);

    var key, bucket;
    var prevPlacementBucket;

    var remaining = bucketInfo.length;

    /*
     *  The async parsing here is a bit tricky.
     *  Some buckets depend on resources that may need to be loaded async (glyphs).
     *  Some buckets need to be parsed in order (to get placement priorities right).
     *
     *  Dependencies calls are initiated first to get those rolling.
     *  Buckets that don't need to be parsed in order, aren't to save time.
     */

    for (var i = 0; i < bucketInfo.length; i++) {
        bucket = buckets[bucketInfo[i].id];

        if (bucketInfo[i].source !== this.source || !bucket) {
            remaining--;
            continue; // raster bucket, etc
        }

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
            if (bucket.type !== 'raster') bucket.addFeatures();
            var time = Date.now() - now;
            if (bucket.interactive) {
                for (var i = 0; i < bucket.features.length; i++) {
                    var feature = bucket.features[i];
                    tile.featureTree.insert(feature.bbox(), bucket.name, feature);
                }
            }
            if (typeof self !== 'undefined') {
                self.bucketStats = self.bucketStats || {_total: 0};
                self.bucketStats._total += time;
                self.bucketStats[bucket.name] = (self.bucketStats[bucket.name] || 0) + time;
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
    this.buckets = null;
};

function sortTileIntoBuckets(tile, data, bucketInfo) {

    var sourceLayers = {},
        buckets = {},
        layerName;

    // For each source layer, find a list of buckets that use data from it
    for (var i = 0; i < bucketInfo.length; i++) {
        var info = bucketInfo[i];
        var bucketName = info.id;

        var minZoom = info.minzoom;
        var maxZoom = info.maxzoom;

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
