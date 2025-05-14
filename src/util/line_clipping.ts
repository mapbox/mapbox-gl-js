import assert from 'assert';
import Point from '@mapbox/point-geometry';
import {number as interpolate} from '../style-spec/util/interpolate';
import {segmentSegmentIntersection} from './intersection_tests';

import type {EdgeIterator, Range} from '../../3d-style/elevation/elevation_feature';

export interface LineInfo {
    progress: Range;     // normalized range in the parent line
    parentIndex: number; // index of the parent line this is clipped from
    prevPoint: Point;
    nextPoint: Point;
}

export class Point3D extends Point {
    z: number;

    constructor(x: number, y: number, z: number) {
        super(x, y);
        this.z = z;
    }
}

export class Point4D extends Point3D {
    w: number; // used for line progress and interpolated on clipping

    constructor(x: number, y: number, z: number, w: number) {
        super(x, y, z);
        this.w = w;
    }
}

function clipFirst(a: Point, b: Point, axis: string, clip: number): void {
    const axis1 = axis === 'x' ? 'y' : 'x';
    const ratio = (clip - a[axis]) / (b[axis] - a[axis]);
    a[axis1] = Math.round(a[axis1] + (b[axis1] - a[axis1]) * ratio);
    a[axis] = clip;
    if (a.hasOwnProperty('z')) {
        a['z'] = interpolate(a['z'], b['z'], ratio);
    }
    if (a.hasOwnProperty('w')) {
        a['w'] = interpolate(a['w'], b['w'], ratio);
    }
}

export function clipLine(p0: Point, p1: Point, boundsMin: number, boundsMax: number): void {
    const clipAxis1 = boundsMin;
    const clipAxis2 = boundsMax;

    for (const axis of ["x", "y"]) {
        let a = p0;
        let b = p1;
        if (a[axis] >= b[axis]) {
            a = p1;
            b = p0;
        }

        if (a[axis] < clipAxis1 && b[axis] > clipAxis1) {
            clipFirst(a, b, axis, clipAxis1);
        }
        if (a[axis] < clipAxis2 && b[axis] > clipAxis2) {
            clipFirst(b, a, axis, clipAxis2);
        }
    }
}

export function clipLines(lines: Point[][], x1: number, y1: number, x2: number, y2: number, linesInfo?: LineInfo[]): Point[][] {
    const clippedLines: Point[][] = [];

    for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        let clippedLine: Point[];

        const startOffset = clippedLines.length;
        let lineTotalLength = 0.0;

        for (let i = 0; i < line.length - 1; i++) {
            let p0 = line[i];
            let p1 = line[i + 1];

            let segLen = 0.0;
            const lenSoFar = lineTotalLength;
            let pStart: Point;
            let pEnd: Point;

            if (linesInfo) {
                segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
                lineTotalLength += segLen;
                pStart = p0;
                pEnd = p1;
            }

            if (p0.x < x1 && p1.x < x1) {
                continue;
            } else if (p0.x < x1) {
                p0 = new Point(x1, p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)))._round();
            } else if (p1.x < x1) {
                p1 = new Point(x1, p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)))._round();
            }

            if (p0.y < y1 && p1.y < y1) {
                continue;
            } else if (p0.y < y1) {
                p0 = new Point(p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y1)._round();
            } else if (p1.y < y1) {
                p1 = new Point(p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y1)._round();
            }

            if (p0.x >= x2 && p1.x >= x2) {
                continue;
            } else if (p0.x >= x2) {
                p0 = new Point(x2, p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)))._round();
            } else if (p1.x >= x2) {
                p1 = new Point(x2, p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)))._round();
            }

            if (p0.y >= y2 && p1.y >= y2) {
                continue;
            } else if (p0.y >= y2) {
                p0 = new Point(p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y2)._round();
            } else if (p1.y >= y2) {
                p1 = new Point(p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y2)._round();
            }

            if (!clippedLine || !p0.equals(clippedLine[clippedLine.length - 1])) {
                clippedLine = [p0];
                clippedLines.push(clippedLine);

                if (linesInfo) {
                    linesInfo.push({
                        progress: {min: lenSoFar + computeT(pStart, pEnd, p0) * segLen, max: 1.0},
                        parentIndex: l,
                        prevPoint: pStart,
                        nextPoint: pEnd
                    });
                }
            }

            clippedLine.push(p1);

            if (linesInfo) {
                linesInfo[linesInfo.length - 1].progress.max = lenSoFar + computeT(pStart, pEnd, p1) * segLen;
                linesInfo[linesInfo.length - 1].nextPoint = pEnd;
            }
        }

        // Normalize progress values to range [0, 1]
        if (linesInfo) {
            if (lineTotalLength > 0.0) {
                for (let i = startOffset; i < clippedLines.length; i++) {
                    linesInfo[i].progress.min /= lineTotalLength;
                    linesInfo[i].progress.max /= lineTotalLength;
                }
            }
        }
    }

    assert(!linesInfo || clippedLines.length === linesInfo.length);

    return clippedLines;
}

export function lineSubdivision(subjectLine: Point[], edgeIterator: EdgeIterator, separateSegments: boolean, linesOut: Point[][], progressOut?: Range[]) {
    interface IntersectionPoint {
        t: number;
        distance: number;
        point: Point;
    }

    if (subjectLine.length < 2) {
        linesOut.push(subjectLine);

        if (progressOut) {
            progressOut.push({min: 0, max: 1});
        }

        return;
    }

    const intersections: IntersectionPoint[] = [];

    while (edgeIterator.valid()) {
        const [c, d] = edgeIterator.get();

        for (let i = 0; i < subjectLine.length - 1; i++) {
            const a = subjectLine[i];
            const b = subjectLine[i + 1];

            const intersection = segmentSegmentIntersection(a, b, c, d);
            if (intersection) {
                const [t] = intersection;
                const point = new Point(interpolate(a.x, b.x, t), interpolate(a.y, b.y, t));
                intersections.push({t: i + t, distance: 0.0, point});
            }
        }

        edgeIterator.next();
    }

    if (intersections.length === 0) {
        linesOut.push(subjectLine);

        if (progressOut) {
            progressOut.push({min: 0, max: 1});
        }

        return;
    }

    intersections.sort((a, b) => a.t - b.t);

    // Compute point distances for progress tracking
    const pointDistances: number[] = [];

    if (progressOut) {
        pointDistances.push(0);
        for (let i = 1; i < subjectLine.length; i++) {
            const a = subjectLine[i - 1];
            const b = subjectLine[i];

            pointDistances.push(pointDistances[i - 1] + Math.hypot(a.x - b.x, a.y - b.y));
        }
    }

    let subjIdx = 0;
    let intrIdx = 0;

    let output: Point[] = [];
    linesOut.push(output);

    if (progressOut) {
        progressOut.push({min: 0, max: 1});
    }

    // Merge points from two sorted lists
    while (subjIdx !== subjectLine.length) {
        if (intrIdx === intersections.length) {
            // No more intersection points. Copy remaining subject points
            while (subjIdx !== subjectLine.length) {
                if (output.length === 0 || !output[output.length - 1].equals(subjectLine[subjIdx])) {
                    output.push(subjectLine[subjIdx]);
                }
                subjIdx++;
            }
            break;
        }

        if (intersections[intrIdx].t <= subjIdx) {
            // Copy intersection point
            if (output.length === 0 || !output[output.length - 1].equals(intersections[intrIdx].point)) {
                output.push(intersections[intrIdx].point);
            }

            const pointIdx = Math.trunc(intersections[intrIdx].t);

            if (separateSegments && output.length > 1 && pointIdx < subjectLine.length - 1) {
                output = [intersections[intrIdx].point];
                linesOut.push(output);

                if (progressOut) {
                    const fract = intersections[intrIdx].t - pointIdx;
                    const distanceAtT = interpolate(pointDistances[pointIdx], pointDistances[pointIdx + 1], fract);
                    const normT = distanceAtT / pointDistances[pointDistances.length - 1];

                    progressOut[progressOut.length - 1].max = normT;
                    progressOut.push({min: normT, max: 1.0});
                }
            }

            intrIdx++;
        } else {
            // Copy subject point
            if (output.length === 0 || !output[output.length - 1].equals(subjectLine[subjIdx])) {
                output.push(subjectLine[subjIdx]);
            }
            subjIdx++;
        }
    }

    // Last point is always expected to be from the subject line
    assert(intrIdx === intersections.length);
}

function computeT(a: Point, b: Point, p: Point) {
    if (a.x !== b.x) {
        return (p.x - a.x) / (b.x - a.x);
    } else if (a.y !== b.y) {
        return (p.y - a.y) / (b.y - a.y);
    }
    return 0.0;
}
