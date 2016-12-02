const Bucket = require('../bucket');
const createVertexArrayType = require('../vertex_array_type');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');

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
    }

    addFeature(feature) {
        console.log(feature);
    }

}
module.exports = TerrainBucket;
