const Bucket = require('../bucket');
const createVertexArrayType = require('../vertex_array_type');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const DEMPyramid = require('../../geo/dem_pyramid');
const EXTENT = require('../extent');

// not sure if we need this.... :thinkingface:
const terrainInterface = {
    layoutVertexArrayType: createVertexArrayType([
        {name: 'a_pos',         components: 2, type: 'Int16'},
        {name: 'a_texture_pos', components: 2, type: 'Uint16'}
    ]),
    paintAttributes: [
        {property: 'terrain-shadow-color',          type: 'Uint8'},
        {property: 'terrain-highlight-color',       type: 'Uint8'},
        {property: 'terrain-accent-color',          type: 'Uint8'},
        {property: 'terrain-illumination-direction',type: 'Uint8'},
        {property: 'terrain-illumination-alignment',type: 'Uint8'},
        {property: 'terrain-exaggeration',          type: 'Uint8'}
    ],
    elementArrayType: createElementArrayType()
}


class TerrainBucket extends Bucket {
    constructor(options) {
        super(options, terrainInterface);
        this.terrainPrepared = false;
        this.terrainTile;
    }

    populate(features, options) {
        let pbf = features[0]._pbf;
        pbf.pos = -1;

        this.terrainTile = features[0];
        this.terrainTile.pyramid = this.getDEMPyramid();
    }

    getDEMPyramid(){
        if (this.terrainTile) {
            if (this.terrainTile.extent != 256) {
                Util.warnOnce("DEM extent must be 256");
                return this.terrainTile.pyramid;
            }
        }

    }
}
module.exports = TerrainBucket;
