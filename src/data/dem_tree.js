// @flow

import DEMData from "./dem_data.js";
import {vec3} from 'gl-matrix';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import {clamp} from '../util/util.js';

type vec3Like = vec3 | [number, number, number];

class MipLevel {
    size: number;
    minimums: Array<number>;
    maximums: Array<number>;
    leaves: Array<number>;

    constructor(size_: number) {
        this.size = size_;
        this.minimums = [];
        this.maximums = [];
        this.leaves = [];
    }

    getElevation(x: number, y: number): { min: number, max: number} {
        const idx = this.toIdx(x, y);
        return {
            min: this.minimums[idx],
            max: this.maximums[idx]
        };
    }

    isLeaf(x: number, y: number): number {
        return this.leaves[this.toIdx(x, y)];
    }

    toIdx(x: number, y: number): number {
        return y * this.size + x;
    }
}

function aabbRayIntersect(min: vec3Like, max: vec3Like, pos: vec3Like, dir: vec3Like): ?number {
    let tMin = 0;
    let tMax = Number.MAX_VALUE;

    const epsilon = 1e-15;

    for (let i = 0; i < 3; i++) {
        if (Math.abs(dir[i]) < epsilon) {
            // Parallel ray
            if (pos[i] < min[i] || pos[i] > max[i])
                return null;
        } else {
            const ood = 1.0 / dir[i];
            let t1 = (min[i] - pos[i]) * ood;
            let t2 = (max[i] - pos[i]) * ood;
            if (t1 > t2) {
                const temp = t1;
                t1 = t2;
                t2 = temp;
            }
            if (t1 > tMin)
                tMin = t1;
            if (t2 < tMax)
                tMax = t2;
            if (tMin > tMax)
                return null;
        }
    }

    return tMin;
}

function triangleRayIntersect(ax, ay, az, bx, by, bz, cx, cy, cz, pos: vec3Like, dir: vec3Like): ?number {
    // Compute barycentric coordinates u and v to find the intersection
    const abX = bx - ax;
    const abY = by - ay;
    const abZ = bz - az;

    const acX = cx - ax;
    const acY = cy - ay;
    const acZ = cz - az;

    // pvec = cross(dir, a), det = dot(ab, pvec)
    const pvecX = dir[1] * acZ - dir[2] * acY;
    const pvecY = dir[2] * acX - dir[0] * acZ;
    const pvecZ = dir[0] * acY - dir[1] * acX;
    const det = abX * pvecX + abY * pvecY + abZ * pvecZ;

    if (Math.abs(det) < 1e-15)
        return null;

    const invDet = 1.0 / det;
    const tvecX = pos[0] - ax;
    const tvecY = pos[1] - ay;
    const tvecZ = pos[2] - az;
    const u = (tvecX * pvecX + tvecY * pvecY + tvecZ * pvecZ) * invDet;

    if (u < 0.0 || u > 1.0)
        return null;

    // qvec = cross(tvec, ab)
    const qvecX = tvecY * abZ - tvecZ * abY;
    const qvecY = tvecZ * abX - tvecX * abZ;
    const qvecZ = tvecX * abY - tvecY * abX;
    const v = (dir[0] * qvecX + dir[1] * qvecY + dir[2] * qvecZ) * invDet;

    if (v < 0.0 || u + v > 1.0)
        return null;

    return (acX * qvecX + acY * qvecY + acZ * qvecZ) * invDet;
}

function frac(v, lo, hi) {
    return (v - lo) / (hi - lo);
}

function decodeBounds(x, y, depth, boundsMinx, boundsMiny, boundsMaxx, boundsMaxy, outMin, outMax) {
    const scale = 1 << depth;
    const rangex = boundsMaxx - boundsMinx;
    const rangey = boundsMaxy - boundsMiny;

    const minX = (x + 0) / scale * rangex + boundsMinx;
    const maxX = (x + 1) / scale * rangex + boundsMinx;
    const minY = (y + 0) / scale * rangey + boundsMiny;
    const maxY = (y + 1) / scale * rangey + boundsMiny;

    outMin[0] = minX;
    outMin[1] = minY;
    outMax[0] = maxX;
    outMax[1] = maxY;
}

// A small padding value is used with bounding boxes to extend the bottom below sea level
const aabbSkirtPadding = 100;

// A sparse min max quad tree for performing accelerated queries against dem elevation data.
// Each tree node stores the minimum and maximum elevation of its children nodes and a flag whether the node is a leaf.
// Node data is stored in non-interleaved arrays where the root is at index 0.
export default class DemMinMaxQuadTree {
    maximums: Array<number>;
    minimums: Array<number>;
    leaves: Array<number>;
    childOffsets: Array<number>;
    nodeCount: number;
    dem: DEMData;
    _siblingOffset: Array<Array<number>>;

    constructor(dem_: DEMData) {
        this.maximums = [];
        this.minimums = [];
        this.leaves = [];
        this.childOffsets = [];
        this.nodeCount = 0;
        this.dem = dem_;

        // Precompute the order of 4 sibling nodes in the memory. Top-left, top-right, bottom-left, bottom-right
        this._siblingOffset = [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1]
        ];

        if (!this.dem)
            return;

        const mips = buildDemMipmap(this.dem);
        const maxLvl = mips.length - 1;

        // Create the root node
        const rootMip = mips[maxLvl];
        const min = rootMip.minimums;
        const max = rootMip.maximums;
        const leaves = rootMip.leaves;
        this._addNode(min[0], max[0], leaves[0]);

        // Construct the rest of the tree recursively
        this._construct(mips, 0, 0, maxLvl, 0);
    }

    // Performs raycast against the tree root only. Min and max coordinates defines the size of the root node
    raycastRoot(minx: number, miny: number, maxx: number, maxy: number, p: vec3Like, d: vec3Like, exaggeration: number = 1): ?number {
        const min = [minx, miny, -aabbSkirtPadding];
        const max = [maxx, maxy, this.maximums[0] * exaggeration];
        return aabbRayIntersect(min, max, p, d);
    }

    raycast(rootMinx: number, rootMiny: number, rootMaxx: number, rootMaxy: number, p: vec3Like, d: vec3Like, exaggeration: number = 1): ?number {
        if (!this.nodeCount)
            return null;

        const t = this.raycastRoot(rootMinx, rootMiny, rootMaxx, rootMaxy, p, d, exaggeration);
        if (t == null)
            return null;

        const tHits = [];
        const sortedHits = [];
        const boundsMin = [];
        const boundsMax = [];

        const stack = [{
            idx: 0,
            t,
            nodex: 0,
            nodey: 0,
            depth: 0
        }];

        // Traverse the tree until something is hit or the ray escapes
        while (stack.length > 0) {
            const {idx, t, nodex, nodey, depth} = stack.pop();

            if (this.leaves[idx]) {
                // Create 2 triangles to approximate the surface plane for more precise tests
                decodeBounds(nodex, nodey, depth, rootMinx, rootMiny, rootMaxx, rootMaxy, boundsMin, boundsMax);

                const scale = 1 << depth;
                const minxUv = (nodex + 0) / scale;
                const maxxUv = (nodex + 1) / scale;
                const minyUv = (nodey + 0) / scale;
                const maxyUv = (nodey + 1) / scale;

                // 4 corner points A, B, C and D defines the (quad) area covered by this node
                const az = sampleElevation(minxUv, minyUv, this.dem) * exaggeration;
                const bz = sampleElevation(maxxUv, minyUv, this.dem) * exaggeration;
                const cz = sampleElevation(maxxUv, maxyUv, this.dem) * exaggeration;
                const dz = sampleElevation(minxUv, maxyUv, this.dem) * exaggeration;

                const t0: any = triangleRayIntersect(
                    boundsMin[0], boundsMin[1], az,     // A
                    boundsMax[0], boundsMin[1], bz,     // B
                    boundsMax[0], boundsMax[1], cz,     // C
                    p, d);

                const t1: any = triangleRayIntersect(
                    boundsMax[0], boundsMax[1], cz,
                    boundsMin[0], boundsMax[1], dz,
                    boundsMin[0], boundsMin[1], az,
                    p, d);

                const tMin = Math.min(
                    t0 !== null ? t0 : Number.MAX_VALUE,
                    t1 !== null ? t1 : Number.MAX_VALUE);

                // The ray might go below the two surface triangles but hit one of the sides.
                // This covers the case of skirt geometry between two dem tiles of different zoom level
                if (tMin === Number.MAX_VALUE) {
                    const hitPos = vec3.scaleAndAdd([], p, d, t);
                    const fracx = frac(hitPos[0], boundsMin[0], boundsMax[0]);
                    const fracy = frac(hitPos[1], boundsMin[1], boundsMax[1]);

                    if (bilinearLerp(az, bz, dz, cz, fracx, fracy) >= hitPos[2])
                        return t;
                } else {
                    return tMin;
                }

                continue;
            }

            // Perform intersection tests agains each of the 4 child nodes and store results from closest to furthest.
            let hitCount = 0;

            for (let i = 0; i < this._siblingOffset.length; i++) {

                const childNodeX = (nodex << 1) + this._siblingOffset[i][0];
                const childNodeY = (nodey << 1) + this._siblingOffset[i][1];

                // Decode node aabb from the morton code
                decodeBounds(childNodeX, childNodeY, depth + 1, rootMinx, rootMiny, rootMaxx, rootMaxy, boundsMin, boundsMax);

                boundsMin[2] = -aabbSkirtPadding;
                boundsMax[2] = this.maximums[this.childOffsets[idx] + i] * exaggeration;

                const result = aabbRayIntersect(boundsMin, boundsMax, p, d);
                if (result != null) {
                    // Build the result list from furthest to closest hit.
                    // The order will be inversed when building the stack
                    const tHit: number = result;
                    tHits[i] = tHit;

                    let added = false;
                    for (let j = 0; j < hitCount && !added; j++) {
                        if (tHit >= tHits[sortedHits[j]]) {
                            sortedHits.splice(j, 0, i);
                            added = true;
                        }
                    }
                    if (!added)
                        sortedHits[hitCount] = i;
                    hitCount++;
                }
            }

            // Continue recursion from closest to furthest
            for (let i = 0; i < hitCount; i++) {
                const hitIdx = sortedHits[i];
                stack.push({
                    idx: this.childOffsets[idx] + hitIdx,
                    t: tHits[hitIdx],
                    nodex: (nodex << 1) + this._siblingOffset[hitIdx][0],
                    nodey: (nodey << 1) + this._siblingOffset[hitIdx][1],
                    depth: depth + 1
                });
            }
        }

        return null;
    }

    _addNode(min: number, max: number, leaf: number) {
        this.minimums.push(min);
        this.maximums.push(max);
        this.leaves.push(leaf);
        this.childOffsets.push(0);
        return this.nodeCount++;
    }

    _construct(mips: Array<MipLevel>, x: number, y: number, lvl: number, parentIdx: number) {
        if (mips[lvl].isLeaf(x, y) === 1) {
            return;
        }

        // Update parent offset
        if (!this.childOffsets[parentIdx])
            this.childOffsets[parentIdx] = this.nodeCount;

        // Construct all 4 children and place them next to each other in memory
        const childLvl = lvl - 1;
        const childMip = mips[childLvl];

        let leafMask = 0;
        let firstNodeIdx;

        for (let i = 0; i < this._siblingOffset.length; i++) {
            const childX = x * 2 + this._siblingOffset[i][0];
            const childY = y * 2 + this._siblingOffset[i][1];

            const elevation = childMip.getElevation(childX, childY);
            const leaf = childMip.isLeaf(childX, childY);
            const nodeIdx = this._addNode(elevation.min, elevation.max, leaf);

            if (leaf)
                leafMask |= 1 << i;
            if (!firstNodeIdx)
                firstNodeIdx = nodeIdx;
        }

        // Continue construction of the tree recursively to non-leaf nodes.
        for (let i = 0; i < this._siblingOffset.length; i++) {
            if (!(leafMask & (1 << i))) {
                this._construct(mips, x * 2 + this._siblingOffset[i][0], y * 2 + this._siblingOffset[i][1], childLvl, firstNodeIdx + i);
            }
        }
    }
}

function bilinearLerp(p00: any, p10: any, p01: any, p11: any, x: number, y: number): any {
    return interpolate(
        interpolate(p00, p01, y),
        interpolate(p10, p11, y),
        x);
}

// Sample elevation in normalized uv-space ([0, 0] is the top left)
// This function does not account for exaggeration
export function sampleElevation(fx: number, fy: number, dem: DEMData): number {
    // Sample position in texels
    const demSize = dem.dim;
    const x = clamp(fx * demSize - 0.5, 0, demSize - 1);
    const y = clamp(fy * demSize - 0.5, 0, demSize - 1);

    // Compute 4 corner points for bilinear interpolation
    const ixMin = Math.floor(x);
    const iyMin = Math.floor(y);
    const ixMax = Math.min(ixMin + 1, demSize - 1);
    const iyMax = Math.min(iyMin + 1, demSize - 1);

    const e00 = dem.get(ixMin, iyMin);
    const e10 = dem.get(ixMax, iyMin);
    const e01 = dem.get(ixMin, iyMax);
    const e11 = dem.get(ixMax, iyMax);

    return bilinearLerp(e00, e10, e01, e11, x - ixMin, y - iyMin);
}

export function buildDemMipmap(dem: DEMData): Array<MipLevel> {
    const demSize = dem.dim;

    const elevationDiffThreshold = 5;
    const texelSizeOfMip0 = 8;
    const levelCount = Math.ceil(Math.log2(demSize / texelSizeOfMip0));
    const mips: Array<MipLevel> = [];

    let blockCount = Math.ceil(Math.pow(2, levelCount));
    const blockSize = 1 / blockCount;

    const blockSamples = (x, y, size, exclusive, outBounds) => {
        const padding = exclusive ? 1 : 0;
        const minx = x * size;
        const maxx = (x + 1) * size - padding;
        const miny = y * size;
        const maxy = (y + 1) * size - padding;

        outBounds[0] = minx;
        outBounds[1] = miny;
        outBounds[2] = maxx;
        outBounds[3] = maxy;
    };

    // The first mip (0) is built by sampling 4 corner points of each 8x8 texel block
    let mip = new MipLevel(blockCount);
    const blockBounds = [];

    for (let idx = 0; idx < blockCount * blockCount; idx++) {
        const y = Math.floor(idx / blockCount);
        const x = idx % blockCount;

        blockSamples(x, y, blockSize, false, blockBounds);

        const e0 = sampleElevation(blockBounds[0], blockBounds[1], dem);    // minx, miny
        const e1 = sampleElevation(blockBounds[2], blockBounds[1], dem);    // maxx, miny
        const e2 = sampleElevation(blockBounds[2], blockBounds[3], dem);    // maxx, maxy
        const e3 = sampleElevation(blockBounds[0], blockBounds[3], dem);    // minx, maxy

        mip.minimums.push(Math.min(e0, e1, e2, e3));
        mip.maximums.push(Math.max(e0, e1, e2, e3));
        mip.leaves.push(1);
    }

    mips.push(mip);

    // Construct the rest of the mip levels from bottom to up
    for (blockCount /= 2; blockCount >= 1; blockCount /= 2) {
        const prevMip = mips[mips.length - 1];

        mip = new MipLevel(blockCount);

        for (let idx = 0; idx < blockCount * blockCount; idx++) {
            const y = Math.floor(idx / blockCount);
            const x = idx % blockCount;

            // Sample elevation of all 4 children mip texels. 4 leaf nodes can be concatenated into a single
            // leaf if the total elevation difference is below the threshold value
            blockSamples(x, y, 2, true, blockBounds);

            const e0 = prevMip.getElevation(blockBounds[0], blockBounds[1]);
            const e1 = prevMip.getElevation(blockBounds[2], blockBounds[1]);
            const e2 = prevMip.getElevation(blockBounds[2], blockBounds[3]);
            const e3 = prevMip.getElevation(blockBounds[0], blockBounds[3]);

            const l0 = prevMip.isLeaf(blockBounds[0], blockBounds[1]);
            const l1 = prevMip.isLeaf(blockBounds[2], blockBounds[1]);
            const l2 = prevMip.isLeaf(blockBounds[2], blockBounds[3]);
            const l3 = prevMip.isLeaf(blockBounds[0], blockBounds[3]);

            const minElevation = Math.min(e0.min, e1.min, e2.min, e3.min);
            const maxElevation = Math.max(e0.max, e1.max, e2.max, e3.max);
            const canConcatenate = l0 && l1 && l2 && l3;

            mip.maximums.push(maxElevation);
            mip.minimums.push(minElevation);

            if (maxElevation - minElevation <= elevationDiffThreshold && canConcatenate) {
                // All samples have uniform elevation. Mark this as a leaf
                mip.leaves.push(1);
            } else {
                mip.leaves.push(0);
            }
        }

        mips.push(mip);
    }

    return mips;
}
