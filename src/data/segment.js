// @flow

import type VertexArrayObject from '../render/vertex_array_object';
import type {StructArray} from '../util/struct_array';

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

    prepareSegment(numVertices: number, layoutVertexArray: StructArray, indexArray: StructArray): Segment {
        let segment: Segment = this.segments[this.segments.length - 1];
        if (!segment || segment.vertexLength + numVertices > module.exports.MAX_VERTEX_ARRAY_LENGTH) {
            segment = ({
                vertexOffset: layoutVertexArray.length,
                primitiveOffset: indexArray.length,
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
