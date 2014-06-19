'use strict';

var FeatureTree = require('../geometry/featuretree.js');
var Protobuf = require('pbf');
var VectorTile = require('../format/vectortile.js');
var VectorTileFeature = require('../format/vectortilefeature.js');
var Placement = require('../text/placement.js');
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
function WorkerTile(url, data, id, zoom, tileSize, glyphs, source, callback) {
    var tile = this;
    this.url = url;
    this.id = id;
    this.zoom = zoom;
    this.tileSize = tileSize;
    this.glyphs = glyphs;
    this.source = source;

    this.buffers = {
        glyphVertex: new GlyphVertexBuffer(),
        pointVertex: new PointVertexBuffer(),
        fillVertex: new FillVertexBuffer(),
        fillElement: new FillElementBuffer(),
        lineVertex: new LineVertexBuffer(),
        lineElement: new LineElementBuffer()
    };

    if (url) {
        if (WorkerTile.loading[source] === undefined) WorkerTile.loading[source] = {};
        WorkerTile.loading[source][id] = getArrayBuffer(url, function(err, data) {
            delete WorkerTile.loading[source][id];
            if (err) {
                callback(err);
            } else {
                if (WorkerTile.loaded[source] === undefined) WorkerTile.loaded[source] = {};
                WorkerTile.loaded[source][id] = tile;
                tile.data = new VectorTile(new Protobuf(new Uint8Array(data)));
                tile.parse(tile.data, callback);
            }
        });
    } else {
        tile.parse(data, callback);
    }
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
 * Given tile data, parse raw vertices and data, create a vector
 * tile and parse it into ready-to-render vertices.
 *
 * @param {object} data
 * @param {function} respond
 */
WorkerTile.prototype.parse = function(data, callback) {
    var tile = this;
    var bucketInfo = WorkerTile.buckets;
    this.callback = callback;

    this.placement = new Placement(this.zoom, this.tileSize);
    this.featureTree = new FeatureTree(getGeometry, getType);

    var buckets = this.buckets = sortTileIntoBuckets(this, data, bucketInfo);

    var key, bucket;
    var prevPlacementBucket;

    var remaining = Object.keys(buckets).length;

    /*
     *  The async parsing here is a bit tricky.
     *  Some buckets depend on resources that may need to be loaded async (glyphs).
     *  Some buckets need to be parsed in order (to get placement priorities right).
     *
     *  Dependencies calls are initiated first to get those rolling.
     *  Buckets that don't need to be parsed in order, aren't to save time.
     */

    for (key in buckets) {
        bucket = buckets[key];

        var filter = bucket.info.filter;
        if (filter && filter.source !== tile.source) continue;

        // Link buckets that need to be parsed in order
        if (bucket.placement) {
            if (prevPlacementBucket) {
                prevPlacementBucket.next = bucket;
            } else {
                bucket.previousPlaced = true;
            }
        }

        if (bucket.getDependencies) {
            bucket.getDependencies(this, dependenciesDone(bucket));
        }

    }

    // parse buckets where order doesn't matter and no dependencies
    for (key in buckets) {
        bucket = buckets[key];
        if (!bucket.getDependencies && !bucket.placement) {
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
        if (bucket.placement && !bucket.previousPlaced) return;

        if (!skip) {
            bucket.addFeatures();

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
    this.placement = null;
};

function sortTileIntoBuckets(tile, data, bucketInfo) {

    var sourceLayers = {},
        buckets = {},
        layerName;

    // For each source layer, find a list of buckets that use data from it
    for (var bucketName in bucketInfo) {
        var info = bucketInfo[bucketName];
        if (info.source !== tile.source) continue;

        var bucket = createBucket(info.render, tile.placement, undefined, tile.buffers);
        if (!bucket) continue;
        bucket.features = [];
        bucket.name = bucketName;
        buckets[bucketName] = bucket;

        if (data.layers) {
            // vectortile
            layerName = bucketInfo[bucketName]['source-layer'];
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
            // Filter features based on the filter function if it exists.
            if (!mapping[key].compare || mapping[key].compare(feature.properties)) {

                // Only load features that have the same geometry type as the bucket.
                var type = VectorTileFeature.mapping[feature._type];
                var renderType = mapping[key].render && mapping[key].render.type;
                var filterType = mapping[key].filter && mapping[key].filter.$type;
                if (type === filterType || renderType) {
                    buckets[key].features.push(feature);
                }
            }
        }
    }
}

var geometryTypeToName = [null, 'point', 'line', 'fill'];

function getGeometry(feature) {
    return feature.loadGeometry();
}

function getType(feature) {
    return geometryTypeToName[feature._type];
}

