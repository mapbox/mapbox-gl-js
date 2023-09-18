// @flow

import IndexBuffer from '../gl/index_buffer.js';
import Context from '../gl/context.js';
import {LineIndexArray} from '../data/index_array_type.js';

class CacheEntry {
    buf: IndexBuffer;
    lastUsedFrameIdx: number;
}

const TimeoutFrames = 30;

export class WireframeDebugCache {
    _storage: Map<number, CacheEntry>;

    constructor() {
        this._storage = new Map();
    }

    getLinesFromTrianglesBuffer(frameIdx: number, indexBuffer: IndexBuffer, context: Context): ?IndexBuffer {
        {
            const entry = this._storage.get(indexBuffer.id);
            if (entry) {
                entry.lastUsedFrameIdx = frameIdx;
                return entry.buf;
            }
        }

        const gl = context.gl;

        const bufSize = gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
        const bufTmp = new ArrayBuffer(bufSize);
        const intView = new Int16Array(bufTmp);
        gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Int16Array(bufTmp));

        const lineIndexArray = new LineIndexArray();

        for (let i = 0; i < bufSize / 2; i += 3) {
            const i0 = intView[i];
            const i1 = intView[i + 1];
            const i2 = intView[i + 2];

            lineIndexArray.emplaceBack(i0, i1);
            lineIndexArray.emplaceBack(i1, i2);
            lineIndexArray.emplaceBack(i2, i0);
        }

        // Save and restore current VAO since it is reset on IndexBuffer creation
        const previousBoundVAO = context.bindVertexArrayOES.current;

        const newEntry = new CacheEntry();
        newEntry.buf = new IndexBuffer(context, lineIndexArray);
        newEntry.lastUsedFrameIdx = frameIdx;
        this._storage.set(indexBuffer.id, newEntry);

        context.bindVertexArrayOES.set(previousBoundVAO);

        return newEntry.buf;
    }

    update(frameIdx: number) {
        for (const [key, obj] of this._storage) {

            if (frameIdx - obj.lastUsedFrameIdx > TimeoutFrames) {
                // Delete object from cache
                obj.buf.destroy();
                this._storage.delete(key);
            }
        }
    }

    destroy() {
        for (const [key, obj] of this._storage) {
            obj.buf.destroy();
            this._storage.delete(key);
        }
    }
}
