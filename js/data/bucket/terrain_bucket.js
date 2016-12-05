const Bucket = require('../bucket');
const createVertexArrayType = require('../vertex_array_type');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const {DEMPyramid, Level} = require('../../geo/dem_pyramid');
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
        this.terrainTile = features[0];
        this.pyramid = this.getDEMPyramid();
    }

    getDEMPyramid(){
        let pyramid = new DEMPyramid();
        if (this.terrainTile) {
            if (this.terrainTile.extent != 256) {
                Util.warnOnce("DEM extent must be 256");
                return this.terrainTile.pyramid;
            }
        }

        let pbf= this.terrainTile._pbf;
        pbf.pos = this.terrainTile._geometry;
        // decode first level:
        pyramid.levels.push(new Level(256, 256, 128));

        let level = pyramid.levels[0];
        for (let y = 0; y < level.height; y++) {
            for (let x = 0; x < level.width; x++) {
                const value = pbf.readSVarint();
                const value_left = x ? level.getPixelValue(x - 1, y) : 0;
                const value_up = y ? level.getPixelValue(x, y - 1) : 0;
                const value_up_left = x && y ? level.getPixelValue(x - 1, y - 1) : 0;
                level.setPixelValue(x, y, value + value_left + value_up - value_up_left);
            }
        }
    }
}
module.exports = TerrainBucket;
