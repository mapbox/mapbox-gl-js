import {register} from '../../src/util/web_worker_transfer';

const LEAF = 0xFFFF;

// Overlap test of node i's box (stored at i * 3 in the min/max arrays) against a query box
function nodeOverlap(
    nodeMin: Float32Array, nodeMax: Float32Array, i: number,
    min: [number, number, number], max: [number, number, number]
): boolean {
    const o = i * 3;
    return nodeMin[o] <= max[0] && nodeMax[o] >= min[0] &&
           nodeMin[o + 1] <= max[1] && nodeMax[o + 1] >= min[1] &&
           nodeMin[o + 2] <= max[2] && nodeMax[o + 2] >= min[2];
}

// Triangle-AABB intersection test using SAT (Separating Axis Theorem)
// Based on "Fast 3D Triangle-Box Overlap Testing" by Tomas Akenine-Möller
function triangleAABBIntersect(
    v0x: number, v0y: number, v0z: number,
    v1x: number, v1y: number, v1z: number,
    v2x: number, v2y: number, v2z: number,
    aabbMin: [number, number, number],
    aabbMax: [number, number, number]
): boolean {
    // Move triangle so AABB is centered at origin
    const cx = (aabbMin[0] + aabbMax[0]) * 0.5;
    const cy = (aabbMin[1] + aabbMax[1]) * 0.5;
    const cz = (aabbMin[2] + aabbMax[2]) * 0.5;
    const hx = (aabbMax[0] - aabbMin[0]) * 0.5;
    const hy = (aabbMax[1] - aabbMin[1]) * 0.5;
    const hz = (aabbMax[2] - aabbMin[2]) * 0.5;

    const tv0x = v0x - cx, tv0y = v0y - cy, tv0z = v0z - cz;
    const tv1x = v1x - cx, tv1y = v1y - cy, tv1z = v1z - cz;
    const tv2x = v2x - cx, tv2y = v2y - cy, tv2z = v2z - cz;

    const e0x = tv1x - tv0x, e0y = tv1y - tv0y, e0z = tv1z - tv0z;
    const e1x = tv2x - tv1x, e1y = tv2y - tv1y, e1z = tv2z - tv1z;
    const e2x = tv0x - tv2x, e2y = tv0y - tv2y, e2z = tv0z - tv2z;

    let p0: number, p1: number, p2: number, pmin: number, pmax: number, rad: number;

    // 9 cross-product axes
    p0 = tv0z * e0y - tv0y * e0z; p1 = tv1z * e0y - tv1y * e0z; p2 = tv2z * e0y - tv2y * e0z;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e0z) * hy + Math.abs(e0y) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0z * e1y - tv0y * e1z; p1 = tv1z * e1y - tv1y * e1z; p2 = tv2z * e1y - tv2y * e1z;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e1z) * hy + Math.abs(e1y) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0z * e2y - tv0y * e2z; p1 = tv1z * e2y - tv1y * e2z; p2 = tv2z * e2y - tv2y * e2z;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e2z) * hy + Math.abs(e2y) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0x * e0z - tv0z * e0x; p1 = tv1x * e0z - tv1z * e0x; p2 = tv2x * e0z - tv2z * e0x;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e0z) * hx + Math.abs(e0x) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0x * e1z - tv0z * e1x; p1 = tv1x * e1z - tv1z * e1x; p2 = tv2x * e1z - tv2z * e1x;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e1z) * hx + Math.abs(e1x) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0x * e2z - tv0z * e2x; p1 = tv1x * e2z - tv1z * e2x; p2 = tv2x * e2z - tv2z * e2x;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e2z) * hx + Math.abs(e2x) * hz;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0y * e0x - tv0x * e0y; p1 = tv1y * e0x - tv1x * e0y; p2 = tv2y * e0x - tv2x * e0y;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e0y) * hx + Math.abs(e0x) * hy;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0y * e1x - tv0x * e1y; p1 = tv1y * e1x - tv1x * e1y; p2 = tv2y * e1x - tv2x * e1y;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e1y) * hx + Math.abs(e1x) * hy;
    if (pmin > rad || pmax < -rad) return false;

    p0 = tv0y * e2x - tv0x * e2y; p1 = tv1y * e2x - tv1x * e2y; p2 = tv2y * e2x - tv2x * e2y;
    pmin = Math.min(p0, p1, p2); pmax = Math.max(p0, p1, p2);
    rad = Math.abs(e2y) * hx + Math.abs(e2x) * hy;
    if (pmin > rad || pmax < -rad) return false;

    // AABB face normals
    pmin = Math.min(tv0x, tv1x, tv2x); pmax = Math.max(tv0x, tv1x, tv2x);
    if (pmin > hx || pmax < -hx) return false;

    pmin = Math.min(tv0y, tv1y, tv2y); pmax = Math.max(tv0y, tv1y, tv2y);
    if (pmin > hy || pmax < -hy) return false;

    pmin = Math.min(tv0z, tv1z, tv2z); pmax = Math.max(tv0z, tv1z, tv2z);
    if (pmin > hz || pmax < -hz) return false;

    // Triangle plane
    const nx = e0y * e1z - e0z * e1y;
    const ny = e0z * e1x - e0x * e1z;
    const nz = e0x * e1y - e0y * e1x;
    const d = -(nx * tv0x + ny * tv0y + nz * tv0z);
    rad = hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
    if (Math.abs(d) > rad) return false;

    return true;
}

// Reused across findHighestPoint calls; calls are synchronous so a single shared array is safe.
const findHighestPointStack: number[] = [];

export class ModelBVH {
    // per node: box min/max as x,y,z, and [backChild (LEAF for leaves), indexCount, indexOffset]
    _nodeMin!: Float32Array;
    _nodeMax!: Float32Array;
    _nodeData!: Uint32Array;
    _indices!: Uint16Array | Uint32Array;
    _vertices!: Float32Array; // packed x,y,z per vertex

    serializeFromGltf(binData: Uint8Array, posMinData: Float32Array, posMaxData: Float32Array, idxData: Uint32Array): void {
        if (binData.length < 7) return;

        let binOffset = 0;
        if (binData[binOffset++] !== 0x6D || // 'm'
            binData[binOffset++] !== 0x62 || // 'b'
            binData[binOffset++] !== 0x78 || // 'x'
            binData[binOffset++] !== 0x62 || // 'b'
            binData[binOffset++] !== 0x76 || // 'v'
            binData[binOffset++] !== 0x68) { // 'h'
            return;
        }

        const version = binData[binOffset++];
        if (version !== 43) return;

        const dataView = new DataView(binData.buffer, binData.byteOffset);

        const nodeCount = dataView.getUint16(binOffset, true);
        binOffset += 2;
        if (nodeCount === 0) return;

        // copies, so the BVH doesn't retain the whole glTF buffer
        this._nodeMin = posMinData.slice(0, nodeCount * 3);
        this._nodeMax = posMaxData.slice(0, nodeCount * 3);
        const nodeData = this._nodeData = new Uint32Array(nodeCount * 3);

        for (let i = 0; i < nodeCount; i++) {
            const backChild = dataView.getUint16(binOffset, true);
            binOffset += 2;
            nodeData[i * 3] = backChild;

            if (backChild === LEAF) {
                nodeData[i * 3 + 1] = dataView.getUint16(binOffset, true);
                binOffset += 2;
                nodeData[i * 3 + 2] = dataView.getUint32(binOffset, true);
                binOffset += 4;
            }
        }

        const numIndices = dataView.getUint32(binOffset, true);
        let maxIndex = 0;
        for (let i = 0; i < numIndices; i++) if (idxData[i] > maxIndex) maxIndex = idxData[i];
        this._indices = maxIndex < 65536 ? new Uint16Array(idxData.subarray(0, numIndices)) : idxData.slice(0, numIndices);
    }

    setVertices(data: Float32Array): void {
        this._vertices = data;
    }

    findHighestPoint(aabbMin: [number, number, number], aabbMax: [number, number, number]): number | null {
        const nodeData = this._nodeData;
        if (!nodeData) return null;
        const nodeMin = this._nodeMin;
        const nodeMax = this._nodeMax;
        if (!nodeOverlap(nodeMin, nodeMax, 0, aabbMin, aabbMax)) return null;

        const indices = this._indices;
        const vertices = this._vertices;
        const stack = findHighestPointStack;
        stack.length = 0;
        stack.push(0);
        let highest = -Infinity;

        while (stack.length > 0) {
            const nodeIdx = stack.pop();

            if (nodeMax[nodeIdx * 3 + 2] <= highest) continue;

            const backIdx = nodeData[nodeIdx * 3];

            if (backIdx === LEAF) {
                // Leaf: test all triangles
                const indexCount = nodeData[nodeIdx * 3 + 1];
                const indexOffset = nodeData[nodeIdx * 3 + 2];
                for (let tri = 0; tri < indexCount; tri += 3) {
                    const i0 = indices[indexOffset + tri] * 3;
                    const i1 = indices[indexOffset + tri + 1] * 3;
                    const i2 = indices[indexOffset + tri + 2] * 3;
                    if (triangleAABBIntersect(
                        vertices[i0], vertices[i0 + 1], vertices[i0 + 2],
                        vertices[i1], vertices[i1 + 1], vertices[i1 + 2],
                        vertices[i2], vertices[i2 + 1], vertices[i2 + 2],
                        aabbMin, aabbMax)) {
                        highest = Math.max(highest, vertices[i0 + 2], vertices[i1 + 2], vertices[i2 + 2]);
                    }
                }
                continue;
            }

            const frontIdx = nodeIdx + 1;
            const frontOverlap = nodeOverlap(nodeMin, nodeMax, frontIdx, aabbMin, aabbMax);
            const backOverlap = nodeOverlap(nodeMin, nodeMax, backIdx, aabbMin, aabbMax);

            if (frontOverlap && backOverlap) {
                // Push lower max Z first so higher max Z is popped (processed) first
                if (nodeMax[frontIdx * 3 + 2] < nodeMax[backIdx * 3 + 2]) {
                    stack.push(frontIdx);
                    stack.push(backIdx);
                } else {
                    stack.push(backIdx);
                    stack.push(frontIdx);
                }
            } else if (frontOverlap) {
                stack.push(frontIdx);
            } else if (backOverlap) {
                stack.push(backIdx);
            }
        }

        return highest >= 0 ? highest : null;
    }
}

register(ModelBVH, 'ModelBVH');
