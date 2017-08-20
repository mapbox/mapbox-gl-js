// @flow

const VertexArrayObject = require('../render/vertex_array_object');

import type {StructArray} from '../util/struct_array';
import type StyleLayer from '../style/style_layer';

export type Segment = {
    vertexOffset: number,
    primitiveOffset: number,
    vertexLength: number,
    primitiveLength: number,
    vaos: {[string]: VertexArrayObject}
}

class SegmentVector {
    segments: Array<Segment>;

    constructor(segments?: Array<Segment> = []) {
        this.segments = segments;
    }

    prepareSegment(numVertices: number, layoutVertexArray: StructArray, elementArray: StructArray): Segment {
        let segment: Segment = this.segments[this.segments.length - 1];
        if (!segment || segment.vertexLength + numVertices > module.exports.MAX_VERTEX_ARRAY_LENGTH) {
            segment = ({
                vertexOffset: layoutVertexArray.length,
                primitiveOffset: elementArray.length,
                vertexLength: 0,
                primitiveLength: 0
            }: any);
            this.segments.push(segment);
        }
        return segment;
    }

    get() {
        return this.segments;
    }

    createVAOs(layers: Array<StyleLayer>) {
        for (const segment of this.segments) {
            segment.vaos = {};
            for (const layer of layers) {
                segment.vaos[layer.id] = new VertexArrayObject();
            }
        }
    }

    destroy() {
        for (const segment of this.segments) {
            for (const k in segment.vaos) {
                segment.vaos[k].destroy();
            }
        }
    }
}

module.exports = {
    SegmentVector,

    /**
     * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
     * addressing of vertex buffers.
     * @private
     * @readonly
     */
    MAX_VERTEX_ARRAY_LENGTH: Math.pow(2, 16) - 1
};
