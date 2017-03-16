'use strict';

const StyleLayer = require('../style_layer');
const TerrainBucket = require('../../data/bucket/terrain_bucket');

class TerrainStyleLayer extends StyleLayer {
    createBucket(options) {
        return new TerrainBucket(options);
    }
}

module.exports = TerrainStyleLayer;
