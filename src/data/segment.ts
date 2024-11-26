import {warnOnce} from '../util/util';
import {register} from '../util/web_worker_transfer';

import type VertexArrayObject from '../render/vertex_array_object';
import type {StructArray} from '../util/struct_array';

export type Segment = {
    sortKey: number | undefined;
    vertexOffset: number;
    primitiveOffset: number;
    vertexLength: number;
    primitiveLength: number;
    vaos: {
        [_: string]: VertexArrayObject;
    };
};

class SegmentVector {
    static MAX_VERTEX_ARRAY_LENGTH: number;
    segments: Array<Segment>;

    constructor(segments: Array<Segment> = []) {
        this.segments = segments;
    }

    _prepareSegment(
        numVertices: number,
        vertexArrayLength: number,
        indexArrayLength: number,
        sortKey?: number,
    ): Segment {
        let segment: Segment = this.segments[this.segments.length - 1];
        if (numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) warnOnce(`Max vertices per segment is ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH}: bucket requested ${numVertices}`);
        if (!segment || segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH || segment.sortKey !== sortKey) {
            segment = ({
                vertexOffset: vertexArrayLength,
                primitiveOffset: indexArrayLength,
                vertexLength: 0,
                primitiveLength: 0
            } as any);
            if (sortKey !== undefined) segment.sortKey = sortKey;
            this.segments.push(segment);
        }
        return segment;
    }

    prepareSegment(
        numVertices: number,
        layoutVertexArray: StructArray,
        indexArray: StructArray,
        sortKey?: number,
    ): Segment {
        return this._prepareSegment(numVertices, layoutVertexArray.length, indexArray.length, sortKey);
    }

    get(): Array<Segment> {
        return this.segments;
    }

    destroy() {
        for (const segment of this.segments) {
            for (const k in segment.vaos) {
                segment.vaos[k].destroy();
            }
        }
    }

    static simpleSegment(
        vertexOffset: number,
        primitiveOffset: number,
        vertexLength: number,
        primitiveLength: number,
    ): SegmentVector {
        return new SegmentVector([{
            vertexOffset,
            primitiveOffset,
            vertexLength,
            primitiveLength,
            vaos: {},
            sortKey: 0
        }]);
    }
}

/*
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 * @private
 * @readonly
 */
SegmentVector.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;

register(SegmentVector, 'SegmentVector');
export default SegmentVector;
