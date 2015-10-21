'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var BufferBuilder = require('../data/buffer_builder');

module.exports = WorkerTile;

function WorkerTile(params) {
    this.coord = params.coord;
    this.uid = params.uid;
    this.zoom = params.zoom;
    this.tileSize = params.tileSize;
    this.source = params.source;
    this.overscaling = params.overscaling;
    this.angle = params.angle;
    this.pitch = params.pitch;
    this.collisionDebug = params.collisionDebug;
}

WorkerTile.prototype.parse = function(data, layers, actor, callback) {

    this.status = 'parsing';

    this.featureTree = new FeatureTree(this.coord, this.overscaling);

    var tile = this,
        buffers = {},
        collisionTile = new CollisionTile(this.angle, this.pitch),
        buildersById = {},
        buildersBySourceLayer = {},
        i, layer, sourceLayerId;

    // Map non-ref layers to builders.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source ||
                layer.ref ||
                layer.minzoom && this.zoom < layer.minzoom ||
                layer.maxzoom && this.zoom >= layer.maxzoom ||
                layer.layout.visibility === 'none')
            continue;

        var builder = BufferBuilder.create({
            buffers: buffers,
            layer: layer,
            zoom: this.zoom,
            overscaling: this.overscaling,
            collisionDebug: this.collisionDebug
        });

        buildersById[layer.id] = builder;

        if (data.layers) { // vectortile
            sourceLayerId = layer['source-layer'];
            buildersBySourceLayer[sourceLayerId] = buildersBySourceLayer[sourceLayerId] || {};
            buildersBySourceLayer[sourceLayerId][layer.id] = builder;
        }
    }

    // Index ref layers.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];
        if (layer.source === this.source && layer.ref && buildersById[layer.ref]) {
            buildersById[layer.ref].layers.push(layer.id);
        }
    }

    var extent = 4096;

    // read each layer, and sort its features into builders
    if (data.layers) { // vectortile
        for (sourceLayerId in buildersBySourceLayer) {
            layer = data.layers[sourceLayerId];
            if (!layer) continue;
            if (layer.extent) extent = layer.extent;
            sortLayerIntoBuilders(layer, buildersBySourceLayer[sourceLayerId]);
        }
    } else { // geojson
        sortLayerIntoBuilders(data, buildersById);
    }

    function sortLayerIntoBuilders(layer, builders) {
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            for (var id in builders) {
                if (builders[id].filter(feature))
                    builders[id].features.push(feature);
            }
        }
    }

    var builders = [],
        symbolBuilders = this.symbolBuilders = [],
        otherBuilders = [];

    for (var id in buildersById) {
        builder = buildersById[id];
        if (builder.features.length === 0) continue;

        builders.push(builder);

        if (builder.type.name === 'symbol')
            symbolBuilders.push(builder);
        else
            otherBuilders.push(builder);
    }

    var icons = {},
        stacks = {};

    if (symbolBuilders.length > 0) {

        // Get dependencies for symbol builders
        for (i = symbolBuilders.length - 1; i >= 0; i--) {
            symbolBuilders[i].updateIcons(icons);
            symbolBuilders[i].updateFont(stacks);
        }

        for (var fontName in stacks) {
            stacks[fontName] = Object.keys(stacks[fontName]).map(Number);
        }
        icons = Object.keys(icons);

        var deps = 0;

        actor.send('get glyphs', {uid: this.uid, stacks: stacks}, function(err, newStacks) {
            stacks = newStacks;
            gotDependency(err);
        });

        if (icons.length) {
            actor.send('get icons', {icons: icons}, function(err, newIcons) {
                icons = newIcons;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }
    }

    // immediately parse non-symbol builders (they have no dependencies)
    for (i = otherBuilders.length - 1; i >= 0; i--) {
        build(this, otherBuilders[i]);
    }

    if (symbolBuilders.length === 0)
        return done();

    function gotDependency(err) {
        if (err) return callback(err);
        deps++;
        if (deps === 2) {
            // all symbol builder dependencies fetched; parse them in proper order
            for (var i = symbolBuilders.length - 1; i >= 0; i--) {
                build(tile, symbolBuilders[i]);
            }
            done();
        }
    }

    function build(tile, builder) {
        var now = Date.now();
        builder.addFeatures(collisionTile, stacks, icons);
        var time = Date.now() - now;

        if (builder.interactive) {
            for (var i = 0; i < builder.features.length; i++) {
                var feature = builder.features[i];
                tile.featureTree.insert(feature.bbox(), builder.layers, feature);
            }
        }

        builder.features = null;

        if (typeof self !== 'undefined') {
            self.bufferStats = self.bufferStats || {_total: 0};
            self.bufferStats._total += time;
            self.bufferStats[builder.id] = (self.bufferStats[builder.id] || 0) + time;
        }
    }

    function done() {
        tile.status = 'done';

        if (tile.redoPlacementAfterDone) {
            var result = tile.redoPlacement(tile.angle, tile.pitch).result;
            buffers.glyphVertex = result.buffers.glyphVertex;
            buffers.iconVertex = result.buffers.iconVertex;
            buffers.collisionBoxVertex = result.buffers.collisionBoxVertex;
            tile.redoPlacementAfterDone = false;
        }

        callback(null, {
            elementGroups: getElementGroups(builders),
            buffers: buffers,
            extent: extent,
            bufferStats: typeof self !== 'undefined' ? self.bufferStats : null
        }, getTransferables(buffers));
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, collisionDebug) {

    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var buffers = {},
        collisionTile = new CollisionTile(angle, pitch);

    for (var i = this.symbolBuilders.length - 1; i >= 0; i--) {
        this.symbolBuilders[i].placeFeatures(collisionTile, buffers, collisionDebug);
    }

    return {
        result: {
            elementGroups: getElementGroups(this.symbolBuilders),
            buffers: buffers
        },
        transferables: getTransferables(buffers)
    };
};

function getElementGroups(builders) {
    var elementGroups = {};

    for (var i = 0; i < builders.length; i++) {
        elementGroups[builders[i].id] = builders[i].elementGroups;
    }
    return elementGroups;
}

function getTransferables(buffers) {
    var transferables = [];

    for (var k in buffers) {
        transferables.push(buffers[k].arrayBuffer);

        // The Buffer::push method is generated with "new Function(...)" and not transferrable.
        buffers[k].push = null;
    }
    return transferables;
}
