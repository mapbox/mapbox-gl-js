import SegmentVector from '../../src/data/segment';
import {register} from '../../src/util/web_worker_transfer';

import type {Segment} from '../../src/data/segment';
import type {TriangleIndexArray} from '../../src/data/index_array_type';

/// Per-feature triangle range with optional FRC level, used during bucket creation.
export interface FeatureTriSegment {
    start: number; // start index in the triangle index array (element index, not byte)
    end: number;   // end index
    segIdx: number;
    frc: number | null;
}

/// FRC segment data carried by the FRC bucket extensions (fill / line).
/// Per-level segment vectors are pre-wrapped at bucket build time so the render-time
/// path is a Map.get lookup with no allocation. Registered for cross-thread transfer;
/// the deserialize gate (`anyBucketRequiresHD`) ensures HD is loaded on main before
/// any tile carrying an FRC extension lands.
export class FrcSegmentData {
    frcCoverage: Set<number>;
    featureTriSegments: Array<FeatureTriSegment>;
    frcPerLevel: Map<number, SegmentVector>;
    frcNonRoadSegments: SegmentVector;

    constructor() {
        this.frcCoverage = new Set();
        this.featureTriSegments = [];
        this.frcPerLevel = new Map();
        this.frcNonRoadSegments = new SegmentVector();
    }

    empty(): boolean { return this.frcCoverage.size === 0; }
}

register(FrcSegmentData, 'FrcSegmentData');

/// Sort triangles by FRC and build per-level segments.
/// Called by the FRC bucket extensions at the end of `populate()` / `addFeatures()`.
export function buildFrcLevelSegments(
    data: FrcSegmentData,
    triangles: TriangleIndexArray,
    segments: SegmentVector,
) {
    if (data.frcCoverage.size === 0 || data.featureTriSegments.length === 0) {
        return;
    }

    const segArray = segments.get();
    const triArray = triangles.uint16;
    const sortedTriangles: number[] = [];

    data.featureTriSegments.sort((a, b) => {
        if (a.segIdx !== b.segIdx) return a.segIdx - b.segIdx;
        if (a.frc === null && b.frc === null) return 0;
        if (a.frc === null) return -1;
        if (b.frc === null) return 1;
        return b.frc - a.frc; // descending FRC
    });

    const frcSegments = new Map<number | null, Array<Segment>>();

    let currentSegmentIdx = 0;
    let currentFrc = data.featureTriSegments[0].frc;
    let sortedSegment: Segment = {
        vertexOffset: segArray[currentSegmentIdx].vertexOffset,
        primitiveOffset: 0,
        vertexLength: segArray[currentSegmentIdx].vertexLength,
        primitiveLength: 0,
        vaos: {},
        sortKey: undefined,
    };

    const closeCurrentSegment = () => {
        if (sortedSegment.primitiveLength > 0) {
            if (!frcSegments.has(currentFrc)) {
                frcSegments.set(currentFrc, []);
            }
            frcSegments.get(currentFrc).push({...sortedSegment});
        }
    };

    for (const triSegment of data.featureTriSegments) {
        if (triSegment.segIdx !== currentSegmentIdx) {
            closeCurrentSegment();
            currentSegmentIdx = triSegment.segIdx;
            currentFrc = triSegment.frc;
            sortedSegment = {
                vertexOffset: segArray[currentSegmentIdx].vertexOffset,
                primitiveOffset: sortedTriangles.length / 3,
                vertexLength: segArray[currentSegmentIdx].vertexLength,
                primitiveLength: 0,
                vaos: {},
                sortKey: undefined,
            };
        }

        if (triSegment.frc !== currentFrc) {
            closeCurrentSegment();
            currentFrc = triSegment.frc;
            sortedSegment = {
                ...sortedSegment,
                primitiveOffset: sortedTriangles.length / 3,
                primitiveLength: 0,
            };
        }

        for (let i = triSegment.start; i < triSegment.end; i++) {
            sortedTriangles.push(triArray[i]);
        }
        sortedSegment.primitiveLength += (triSegment.end - triSegment.start) / 3;
    }
    closeCurrentSegment();

    for (let i = 0; i < sortedTriangles.length; i++) {
        triArray[i] = sortedTriangles[i];
    }

    for (const [key, segs] of frcSegments) {
        if (key !== null) {
            data.frcPerLevel.set(key, new SegmentVector(segs));
        } else {
            data.frcNonRoadSegments = new SegmentVector(segs);
        }
    }

    data.featureTriSegments = [];
}
