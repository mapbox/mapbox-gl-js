import {
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    getMetersPerPixelAtLatitude,
} from '../../src/geo/mercator_coordinate';
import {getProjectionInterpolationT} from '../../src/geo/projection/adjustments';
import {mat4, vec3, quat} from 'gl-matrix';
import {degToRad} from '../../src/util/util';
import {
    interpolateVec3,
    globeToMercatorTransition,
    globeECEFUnitsToPixelScale,
} from '../../src/geo/projection/globe_util';
import {latLngToECEF} from '../../src/geo/lng_lat';
import {GLOBE_RADIUS} from '../../src/geo/projection/globe_constants';
import {number as interpolate} from '../../src/style-spec/util/interpolate';
import assert from 'assert';
import {Aabb} from '../../src/util/primitives';
import {polygonIntersectsPolygon} from '../../src/util/intersection_tests';
import Point from '@mapbox/point-geometry';

import type Transform from '../../src/geo/transform';

export function rotationScaleYZFlipMatrix(out: mat4, rotation: vec3, scale: vec3) {
    mat4.identity(out);
    mat4.rotateZ(out, out, degToRad(rotation[2]));
    mat4.rotateX(out, out, degToRad(rotation[0]));
    mat4.rotateY(out, out, degToRad(rotation[1]));

    mat4.scale(out, out, scale);

    // gltf spec uses right handed coordinate space where +y is up. Coordinate space transformation matrix
    // has to be created for the initial transform to our left handed coordinate space
    const coordSpaceTransform = [
        1, 0, 0, 0,
        0, 0, 1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
    ];

    mat4.multiply(out, out, coordSpaceTransform as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]);
}

type BoxFace = {
    corners: [number, number, number, number];
    dotProductWithUp: number;
};

// corners are in world coordinates.
export function getBoxBottomFace(corners: Array<vec3>, meterToMercator: number): [number, number, number, number] {
    const zUp =  [0, 0, 1];
    const boxFaces: BoxFace[] = [{corners: [0, 1, 3, 2], dotProductWithUp: 0},
        {corners: [1, 5, 2, 6], dotProductWithUp: 0},
        {corners: [0, 4, 1, 5], dotProductWithUp: 0},
        {corners: [2, 6, 3, 7], dotProductWithUp: 0},
        {corners: [4, 7, 5, 6], dotProductWithUp: 0},
        {corners: [0, 3, 4, 7], dotProductWithUp: 0}];
    for (const face of boxFaces) {
        const p0 = corners[face.corners[0]];
        const p1 = corners[face.corners[1]];
        const p2 = corners[face.corners[2]];
        const a = [p1[0] - p0[0], p1[1] - p0[1], meterToMercator * (p1[2] - p0[2])];
        const b = [p2[0] - p0[0], p2[1] - p0[1], meterToMercator * (p2[2] - p0[2])];
        const normal = vec3.cross(a as [number, number, number], a as [number, number, number], b as [number, number, number]);
        vec3.normalize(normal, normal);
        face.dotProductWithUp = vec3.dot(normal, zUp as [number, number, number]);
    }

    boxFaces.sort((a, b) => {
        return a.dotProductWithUp - b.dotProductWithUp;
    });
    return boxFaces[0].corners;
}

export function rotationFor3Points(
    out: quat,
    p0: vec3,
    p1: vec3,
    p2: vec3,
    h0: number,
    h1: number,
    h2: number,
    meterToMercator: number,
): quat {
    const p0p1: vec3 = [p1[0] - p0[0], p1[1] - p0[1], 0.0];
    const p0p2: vec3 = [p2[0] - p0[0], p2[1] - p0[1], 0.0];
    // If model scale is zero, all bounding box points are identical and no rotation can be calculated
    if (vec3.length(p0p1) < 1e-12 || vec3.length(p0p2) < 1e-12) {
        return quat.identity(out);
    }
    const from = vec3.cross([] as unknown as vec3, p0p1, p0p2);
    vec3.normalize(from, from);
    vec3.subtract(p0p2, p2, p0);
    p0p1[2] = (h1 - h0) * meterToMercator;
    p0p2[2] = (h2 - h0) * meterToMercator;
    const to = p0p1;
    vec3.cross(to, p0p1, p0p2);
    vec3.normalize(to, to);
    return quat.rotationTo(out, from, to) as quat;
}

export function coordinateFrameAtEcef(ecef: vec3): mat4 {
    const zAxis: vec3 = [ecef[0], ecef[1], ecef[2]];
    let yAxis: vec3 = [0.0, 1.0, 0.0];
    const xAxis: vec3 = vec3.cross([] as unknown as vec3, yAxis, zAxis);
    vec3.cross(yAxis, zAxis, xAxis);
    if (vec3.squaredLength(yAxis) === 0.0) {
        // Coordinate space is ambiguous if the model is placed directly at north or south pole
        yAxis = [0.0, 1.0, 0.0];
        vec3.cross(xAxis, zAxis, yAxis);
        assert(vec3.squaredLength(xAxis) > 0.0);
    }
    vec3.normalize(xAxis, xAxis);
    vec3.normalize(yAxis, yAxis);
    vec3.normalize(zAxis, zAxis);
    return [xAxis[0], xAxis[1], xAxis[2], 0.0,
        yAxis[0], yAxis[1], yAxis[2], 0.0,
        zAxis[0], zAxis[1], zAxis[2], 0.0,
        ecef[0], ecef[1], ecef[2], 1.0];
}

export function convertModelMatrix(matrix: mat4, transform: Transform, scaleWithViewport: boolean): mat4 {
    // The provided transformation matrix is expected to define model position and orientation in pixel units
    // with the exception of z-axis being in meters. Converting this into globe-aware matrix requires following steps:
    //  1. Take the (pixel) position from the last column of the matrix and convert it to lat&lng and then to
    //     ecef-presentation.
    //  2. Scale the model from (px, px, m) units to ecef-units and apply pixels-per-meter correction. Also
    //     remove translation component from the matrix as it represents position in Mercator coordinates.
    //  3. Compute coordinate frame at the desired lat&lng position by aligning coordinate axes x,y & z with
    //     the tangent plane at the said location.
    //  4. Prepend the original matrix with the new coordinate frame matrix and apply translation in ecef-units.
    //     After this operation the matrix presents correct position in ecef-space
    //  5. Multiply the matrix with globe matrix for getting the final pixel space position
    const worldSize = transform.worldSize;
    const position = [matrix[12], matrix[13], matrix[14]];
    const lat = latFromMercatorY(position[1] / worldSize);
    const lng = lngFromMercatorX(position[0] / worldSize);
    // Construct a matrix for scaling the original one to ecef space and removing the translation in mercator space
    const mercToEcef = mat4.identity([] as unknown as mat4);
    const sourcePixelsPerMeter = mercatorZfromAltitude(1, lat) * worldSize;
    const pixelsPerMeterConversion = mercatorZfromAltitude(1, 0) * worldSize * getMetersPerPixelAtLatitude(lat, transform.zoom);
    const pixelsToEcef = 1.0 / globeECEFUnitsToPixelScale(worldSize);
    let scale = pixelsPerMeterConversion * pixelsToEcef;
    if (scaleWithViewport) {
        // Keep the size relative to viewport
        const t = getProjectionInterpolationT(transform.projection, transform.zoom, transform.width, transform.height, 1024);
        const projectionScaler = transform.projection.pixelSpaceConversion(transform.center.lat, worldSize, t);
        scale = pixelsToEcef * projectionScaler;
    }
    // Construct coordinate space matrix at the provided location in ecef space.
    const ecefCoord = latLngToECEF(lat, lng);
    // add altitude
    vec3.add(ecefCoord, ecefCoord, vec3.scale([] as unknown as vec3, vec3.normalize([] as unknown as vec3, ecefCoord), sourcePixelsPerMeter * scale * position[2]));
    const ecefFrame = coordinateFrameAtEcef(ecefCoord);
    mat4.scale(mercToEcef, mercToEcef, [scale, scale, scale * sourcePixelsPerMeter]);
    mat4.translate(mercToEcef, mercToEcef, [-position[0], -position[1], -position[2]]);
    const result = mat4.multiply([] as unknown as mat4, transform.globeMatrix, ecefFrame);
    mat4.multiply(result, result, mercToEcef);
    mat4.multiply(result, result, matrix);
    return result;
}

// Computes a matrix for representing the provided transformation matrix (in mercator projection) in globe
export function mercatorToGlobeMatrix(matrix: mat4, transform: Transform): mat4 {
    const worldSize = transform.worldSize;

    const pixelsPerMeterConversion = mercatorZfromAltitude(1, 0) * worldSize * getMetersPerPixelAtLatitude(transform.center.lat, transform.zoom);
    const pixelsToEcef = pixelsPerMeterConversion / globeECEFUnitsToPixelScale(worldSize);
    const pixelsPerMeter = mercatorZfromAltitude(1, transform.center.lat) * worldSize;

    const m = mat4.identity([] as unknown as mat4);
    mat4.rotateY(m, m, degToRad(transform.center.lng));
    mat4.rotateX(m, m, degToRad(transform.center.lat));

    mat4.translate(m, m, [0, 0, GLOBE_RADIUS]);
    mat4.scale(m, m, [pixelsToEcef, pixelsToEcef, pixelsToEcef * pixelsPerMeter]);

    mat4.translate(m, m, [transform.point.x - 0.5 * worldSize, transform.point.y - 0.5 * worldSize, 0.0]);
    mat4.multiply(m, m, matrix);
    return mat4.multiply(m, transform.globeMatrix, m);
}

function affineMatrixLerp(a: mat4, b: mat4, t: number): mat4 {
    // Interpolate each of the coordinate axes separately while also preserving their length
    const lerpAxis = (ax: vec3, bx: vec3, t: number) => {
        const axLen  = vec3.length(ax);
        const bxLen = vec3.length(bx);
        const c = interpolateVec3(ax, bx, t);
        return vec3.scale(c, c, 1.0 / vec3.length(c) * interpolate(axLen, bxLen, t));
    };

    const xAxis = lerpAxis([a[0], a[1], a[2]], [b[0], b[1], b[2]], t);
    const yAxis = lerpAxis([a[4], a[5], a[6]], [b[4], b[5], b[6]], t);
    const zAxis = lerpAxis([a[8], a[9], a[10]], [b[8], b[9], b[10]], t);
    const pos = interpolateVec3([a[12], a[13], a[14]], [b[12], b[13], b[14]], t);

    return [
        xAxis[0], xAxis[1], xAxis[2], 0,
        yAxis[0], yAxis[1], yAxis[2], 0,
        zAxis[0], zAxis[1], zAxis[2], 0,
        pos[0], pos[1], pos[2], 1
    ];
}

export function convertModelMatrixForGlobe(matrix: mat4, transform: Transform, scaleWithViewport: boolean = false): mat4 {
    const t = globeToMercatorTransition(transform.zoom);
    const modelMatrix = convertModelMatrix(matrix, transform, scaleWithViewport);
    if (t > 0.0) {
        const mercatorMatrix = mercatorToGlobeMatrix(matrix, transform);
        return affineMatrixLerp(modelMatrix, mercatorMatrix, t);
    }
    return modelMatrix;
}

// In case of intersection, returns depth of the closest corner. Otherwise, returns undefined.
export function queryGeometryIntersectsProjectedAabb(
    queryGeometry: Point[],
    transform: Transform,
    worldViewProjection: mat4,
    aabb: Aabb,
): number | null | undefined {
    // Collision checks are performed in screen space. Corners are in ndc space.
    const corners = Aabb.projectAabbCorners(aabb, worldViewProjection);
    // convert to screen points
    let minDepth = Number.MAX_VALUE;
    let closestCornerIndex = -1;
    for (let c = 0; c < corners.length; ++c) {
        const corner = corners[c];
        corner[0] = (0.5 * corner[0] + 0.5) * transform.width;
        corner[1] = (0.5 - 0.5 * corner[1]) * transform.height;
        if (corner[2] < minDepth) {
            closestCornerIndex = c;
            minDepth = corner[2]; // This is a rough aabb intersection check for now and no need to interpolate over aabb sides.
        }
    }
    const p = (i: number): Point => new Point(corners[i][0], corners[i][1]);

    let convexPolygon;
    switch (closestCornerIndex) {
    case 0:
    case 6:
        convexPolygon = [p(1), p(5), p(4), p(7), p(3), p(2), p(1)];
        break;
    case 1:
    case 7:
        convexPolygon = [p(0), p(4), p(5), p(6), p(2), p(3), p(0)];
        break;
    case 3:
    case 5:
        convexPolygon = [p(1), p(0), p(4), p(7), p(6), p(2), p(1)];
        break;
    default:
        convexPolygon = [p(1), p(5), p(6), p(7), p(3), p(0), p(1)];
        break;
    }

    if (polygonIntersectsPolygon(queryGeometry, convexPolygon)) {
        return minDepth;
    }
}
