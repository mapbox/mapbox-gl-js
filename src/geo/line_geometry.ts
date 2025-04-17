import Point from '@mapbox/point-geometry';
import EXTENT from '../style-spec/data/extent';
import {edgeIntersectsBox} from '../../src/util/intersection_tests';

export type WallGeometry = {
    geometry: Array<Point>;
    joinNormals: Array<Point>;
    indices: Array<number>;
};

function isClockWise(vertices: Array<Point>) {
    let signedArea = 0;
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
        const x1 = vertices[i].x;
        const y1 = vertices[i].y;
        const x2 = vertices[(i + 1) % n].x;
        const y2 = vertices[(i + 1) % n].y;

        signedArea += (x2 - x1) * (y2 + y1);
    }

    return signedArea >= 0;
}

// Note: This function mostly matches the geometry processing code of the line bucket.
export function createLineWallGeometry(vertices: Array<Point>): WallGeometry {
    const isPolygon = vertices[0].x === vertices[vertices.length - 1].x && vertices[0].y === vertices[vertices.length - 1].y;
    const isCW = isClockWise(vertices);
    if (!isCW) {
        vertices = vertices.reverse();
    }
    const wallGeometry: WallGeometry = {
        geometry: [],
        joinNormals: [],
        indices: []
    };
    const innerWall = [];
    const outerWall = [];
    const joinNormals = [];

    // If the line has duplicate vertices at the ends, adjust start/length to remove them.
    let len = vertices.length;
    while (len >= 2 && vertices[len - 1].equals(vertices[len - 2])) {
        len--;
    }
    if (len < (isPolygon ? 3 : 2)) return wallGeometry;
    let first = 0;
    while (first < len - 1 && vertices[first].equals(vertices[first + 1])) {
        first++;
    }

    let currentVertex;
    let prevVertex = (undefined as Point);
    let nextVertex = (undefined as Point);
    let prevNormal = (undefined as Point);
    let nextNormal = (undefined as Point);

    if (isPolygon) {
        currentVertex = vertices[len - 2];
        nextNormal = vertices[first].sub(currentVertex)._unit()._perp();
    }

    for (let i = first; i < len; i++) {

        nextVertex = i === len - 1 ?
            (isPolygon ? vertices[first + 1] : undefined) : // if it's a polygon, treat the last vertex like the first
            vertices[i + 1]; // just the next vertex

        // if two consecutive vertices exist, skip the current one
        if (nextVertex && vertices[i].equals(nextVertex)) continue;

        if (nextNormal) prevNormal = nextNormal;
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just using the previous normal.
        nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        prevNormal = prevNormal || nextNormal;

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        // In the case of 180° angles, the prev and next normals cancel each other out:
        // prevNormal + nextNormal = (0, 0), its magnitude is 0, so the unit vector would be
        // undefined. In that case, we're keeping the joinNormal at (0, 0), so that the cosHalfAngle
        // below will also become 0 and miterLength will become Infinity.
        let joinNormal = prevNormal.add(nextNormal);
        if (joinNormal.x !== 0 || joinNormal.y !== 0) {
            joinNormal._unit();
        }

        const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;

        // Calculate the length of the miter (the ratio of the miter to the width)
        // as the inverse of cosine of the angle between next and join normals
        const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;

        const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;

        // Note: Currently only mitter join is supported for walls,
        // we can consider adding different join modes in later releases.
        let currentJoin = 'miter';
        const miterLimit = 2.0;

        if (currentJoin === 'miter' && miterLength > miterLimit) {
            currentJoin = 'bevel';
        }

        if (currentJoin === 'bevel') {
            // Note: In contrast to line_bucket, only >100 miter length is handled
            if (miterLength > 100) currentJoin = 'flipbevel';

            // If the miterLength is really small and the line bevel wouldn't be visible,
            // just draw a miter join to save a triangle.
            if (miterLength < miterLimit) currentJoin = 'miter';
        }

        const addWallJoin = (vert, normal, outerOffset, innerOffset) => {
            const innerPoint = new Point(vert.x, vert.y);
            const outerPoint = new Point(vert.x, vert.y);
            innerPoint.x += normal.x * innerOffset;
            innerPoint.y += normal.y * innerOffset;
            outerPoint.x -= normal.x * Math.max(outerOffset, 1.0);
            outerPoint.y -= normal.y * Math.max(outerOffset, 1.0);

            joinNormals.push(normal);
            innerWall.push(innerPoint);
            outerWall.push(outerPoint);
        };

        if (currentJoin === 'miter') {
            joinNormal._mult(miterLength);
            addWallJoin(currentVertex, joinNormal, 0, 0);
        } else if (currentJoin === 'flipbevel') {
            // miter is too big, flip the direction to make a beveled join
            // Almost parallel lines
            joinNormal = nextNormal.mult(-1);
            addWallJoin(currentVertex, joinNormal, 0, 0);
            addWallJoin(currentVertex, joinNormal.mult(-1), 0, 0);
        } else { // bevel join
            const offset = -Math.sqrt(miterLength * miterLength - 1);
            const offsetA = lineTurnsLeft ? offset : 0;
            const offsetB = lineTurnsLeft ? 0 : offset;

            // Close previous segment with a bevel
            if (prevVertex) {
                addWallJoin(currentVertex, prevNormal, offsetA, offsetB);
            }

            if (nextVertex) {
                addWallJoin(currentVertex, nextNormal, offsetA, offsetB);
            }
        }

    }

    wallGeometry.geometry = [...innerWall, ...outerWall.reverse(), innerWall[0]];
    wallGeometry.joinNormals = [...joinNormals, ...joinNormals.reverse(), joinNormals[joinNormals.length - 1]];

    // Build index buffer
    const numPoints = wallGeometry.geometry.length - 1;
    // Line points are in pairs on the inner and outer side, so we can build quads from them
    for (let i = 0; i < numPoints / 2; i++) {
        if (i + 1 < numPoints / 2) {
            let indexA = i;
            let indexB = i + 1;
            let indexC = numPoints - 1 - i;
            let indexD = numPoints - 2 - i;

            // Shift it by the first element to match order in bucket
            indexA = indexA === 0 ? numPoints - 1 : indexA - 1;
            indexB = indexB === 0 ? numPoints - 1 : indexB - 1;
            indexC = indexC === 0 ? numPoints - 1 : indexC - 1;
            indexD = indexD === 0 ? numPoints - 1 : indexD - 1;

            wallGeometry.indices.push(indexC);
            wallGeometry.indices.push(indexB);
            wallGeometry.indices.push(indexA);

            wallGeometry.indices.push(indexC);
            wallGeometry.indices.push(indexD);
            wallGeometry.indices.push(indexB);
        }
    }

    return wallGeometry;
}

const tileCorners = [
    new Point(0, 0),
    new Point(EXTENT, 0),
    new Point(EXTENT, EXTENT),
    new Point(0, EXTENT)];

// Removes connection lines outside of the tile bounds if they don't intersect with the original tile
export function dropBufferConnectionLines(polygon: Array<Point>, isPolygon: boolean): Array<Point[]> {
    const lineSegments: Array<Point[]> = [];
    let lineSegment: Point[] = [];
    if (!isPolygon || polygon.length < 2) {
        return [polygon];
    } else if (polygon.length === 2) {
        if (edgeIntersectsBox(polygon[0], polygon[1], tileCorners)) {
            return [polygon];
        }
        return [];
    } else {
        for (let i = 0; i < polygon.length + 2; i++) {
            const p0 = i === 0 ? polygon[polygon.length - 1] : polygon[(i - 1) % polygon.length];
            const p1 = polygon[i % polygon.length];
            const p2 = polygon[(i + 1) % polygon.length];
            const intersectsPrev = edgeIntersectsBox(p0, p1, tileCorners);
            const intersectsNext = edgeIntersectsBox(p1, p2, tileCorners);
            const addPoint = intersectsPrev || intersectsNext;

            if (addPoint) {
                lineSegment.push(p1);
            }
            if (!addPoint || !intersectsNext) {
                // Close segment and start new
                if (lineSegment.length > 0) {
                    if (lineSegment.length > 1) {
                        lineSegments.push(lineSegment);
                    }
                    lineSegment = [];
                }
            }
        }
    }
    if (lineSegment.length > 1) {
        lineSegments.push(lineSegment);
    }
    return lineSegments;
}
