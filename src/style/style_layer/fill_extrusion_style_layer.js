// @flow

import StyleLayer from '../style_layer';
import FillExtrusionBucket, {ELEVATION_SCALE} from '../../data/bucket/fill_extrusion_bucket';
import {polygonIntersectsPolygon, polygonIntersectsMultiPolygon} from '../../util/intersection_tests';
import {translateDistance, tilespaceTranslate} from '../query_utils';
import properties from './fill_extrusion_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';
import Point from '@mapbox/point-geometry';
import ProgramConfiguration from '../../data/program_configuration';
import {vec2, vec3} from 'gl-matrix';

import type {FeatureState} from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type {PaintProps} from './fill_extrusion_style_layer_properties';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';
import type {TilespaceQueryGeometry} from '../query_geometry';
import type {DEMSampler} from '../../terrain/elevation';
import type {vec4} from 'gl-matrix';

class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>) {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    is3D(): boolean {
        return true;
    }

    getProgramIds(): string[] {
        const patternProperty = this.paint.get('fill-extrusion-pattern');
        const image = patternProperty.constantOr((1: any));
        return [image ? 'fillExtrusionPattern' : 'fillExtrusion'];
    }

    getProgramConfiguration(zoom: number): ProgramConfiguration {
        return new ProgramConfiguration(this, zoom);
    }

    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelPosMatrix: Float32Array,
                           elevationHelper: ?DEMSampler,
                           layoutVertexArrayOffset: number): boolean | number {

        const translation = tilespaceTranslate(this.paint.get('fill-extrusion-translate'),
                                this.paint.get('fill-extrusion-translate-anchor'),
                                transform.angle,
                                queryGeometry.pixelToTileUnitsFactor);
        const height = this.paint.get('fill-extrusion-height').evaluate(feature, featureState);
        const base = this.paint.get('fill-extrusion-base').evaluate(feature, featureState);

        const centroid = [0, 0];
        const terrainVisible = elevationHelper && transform.elevation;
        const exaggeration = transform.elevation ? transform.elevation.exaggeration() : 1;
        if (terrainVisible) {
            const centroidVertexArray = queryGeometry.tile.getBucket(this).centroidVertexArray;

            // See FillExtrusionBucket#encodeCentroid(), centroid is inserted at vertexOffset + 1
            const centroidOffset = layoutVertexArrayOffset + 1;
            if (centroidOffset < centroidVertexArray.length) {
                const centroidVertexObject = centroidVertexArray.get(centroidOffset);
                centroid[0] = centroidVertexObject.a_centroid_pos0;
                centroid[1] = centroidVertexObject.a_centroid_pos1;
            }
        }

        // Early exit if fill extrusion is still hidden while waiting for backfill
        const isHidden = centroid[0] === 0 && centroid[1] === 1;
        if (isHidden) return false;

        const demSampler = terrainVisible ? elevationHelper : null;
        const projected = projectExtrusion(geometry, base, height, translation, pixelPosMatrix, demSampler, centroid, exaggeration, transform.center.lat);
        const projectedBase = projected[0];
        const projectedTop = projected[1];

        const screenQuery = queryGeometry.queryGeometry;
        const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;
        return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
    }
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

export function getIntersectionDistance(projectedQueryGeometry: Array<Point>, projectedFace: Array<Point>) {

    if (projectedQueryGeometry.length === 1) {
        // For point queries calculate the z at which the point intersects the face
        // using barycentric coordinates.

        // Find the barycentric coordinates of the projected point within the first
        // triangle of the face, using only the xy plane. It doesn't matter if the
        // point is outside the first triangle because all the triangles in the face
        // are in the same plane.
        //
        // Check whether points are coincident and use other points if they are.
        let i = 0;
        const a = projectedFace[i++];
        let b;
        while (!b || a.equals(b)) {
            b = projectedFace[i++];
            if (!b) return Infinity;
        }

        // Loop until point `c` is not colinear with points `a` and `b`.
        for (; i < projectedFace.length; i++) {
            const c = projectedFace[i];

            const p = projectedQueryGeometry[0];

            const ab = b.sub(a);
            const ac = c.sub(a);
            const ap = p.sub(a);

            const dotABAB = dot(ab, ab);
            const dotABAC = dot(ab, ac);
            const dotACAC = dot(ac, ac);
            const dotAPAB = dot(ap, ab);
            const dotAPAC = dot(ap, ac);
            const denom = dotABAB * dotACAC - dotABAC * dotABAC;

            const v = (dotACAC * dotAPAB - dotABAC * dotAPAC) / denom;
            const w = (dotABAB * dotAPAC - dotABAC * dotAPAB) / denom;
            const u = 1 - v - w;

            // Use the barycentric weighting along with the original triangle z coordinates to get the point of intersection.
            const distance = a.z * u + b.z * v + c.z * w;

            if (isFinite(distance)) return distance;
        }

        return Infinity;

    } else {
        // The counts as closest is less clear when the query is a box. This
        // returns the distance to the nearest point on the face, whether it is
        // within the query or not. It could be more correct to return the
        // distance to the closest point within the query box but this would be
        // more complicated and expensive to calculate with little benefit.
        let closestDistance = Infinity;
        for (const p of projectedFace) {
            closestDistance = Math.min(closestDistance, p.z);
        }
        return closestDistance;
    }
}

function checkIntersection(projectedBase: Array<Point>, projectedTop: Array<Point>, projectedQueryGeometry: Array<Point>) {
    let closestDistance = Infinity;

    if (polygonIntersectsMultiPolygon(projectedQueryGeometry, projectedTop)) {
        closestDistance = getIntersectionDistance(projectedQueryGeometry, projectedTop[0]);
    }

    for (let r = 0; r < projectedTop.length; r++) {
        const ringTop = projectedTop[r];
        const ringBase = projectedBase[r];
        for (let p = 0; p < ringTop.length - 1; p++) {
            const topA = ringTop[p];
            const topB = ringTop[p + 1];
            const baseA = ringBase[p];
            const baseB = ringBase[p + 1];
            const face = [topA, topB, baseB, baseA, topA];
            if (polygonIntersectsPolygon(projectedQueryGeometry, face)) {
                closestDistance = Math.min(closestDistance, getIntersectionDistance(projectedQueryGeometry, face));
            }
        }
    }

    return closestDistance === Infinity ? false : closestDistance;
}

function projectExtrusion(geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: ?DEMSampler, centroid: vec2, exaggeration: number, lat: number) {
    if (demSampler) {
        return projectExtrusion3D(geometry, zBase, zTop, translation, m, demSampler, centroid, exaggeration, lat);
    } else {
        return projectExtrusion2D(geometry, zBase, zTop, translation, m);
    }
}

/*
 * Project the geometry using matrix `m`. This is essentially doing
 * `vec4.transformMat4([], [p.x, p.y, z, 1], m)` but the multiplication
 * is inlined so that parts of the projection that are the same across
 * different points can only be done once. This produced a measurable
 * performance improvement.
 */
function projectExtrusion2D(geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array) {
    const projectedBase = [];
    const projectedTop = [];

    const baseXZ = m[8] * zBase;
    const baseYZ = m[9] * zBase;
    const baseZZ = m[10] * zBase;
    const baseWZ = m[11] * zBase;
    const topXZ = m[8] * zTop;
    const topYZ = m[9] * zTop;
    const topZZ = m[10] * zTop;
    const topWZ = m[11] * zTop;

    for (const r of geometry) {
        const ringBase = [];
        const ringTop = [];
        for (const p of r) {
            const x = p.x + translation.x;
            const y = p.y + translation.y;

            const sX = m[0] * x + m[4] * y + m[12];
            const sY = m[1] * x + m[5] * y + m[13];
            const sZ = m[2] * x + m[6] * y + m[14];
            const sW = m[3] * x + m[7] * y + m[15];

            const baseX = sX + baseXZ;
            const baseY = sY + baseYZ;
            const baseZ = sZ + baseZZ;
            const baseW = sW + baseWZ;

            const topX = sX + topXZ;
            const topY = sY + topYZ;
            const topZ = sZ + topZZ;
            const topW = sW + topWZ;

            const b = new Point(baseX / baseW, baseY / baseW);
            b.z = baseZ / baseW;
            ringBase.push(b);

            const t = new Point(topX / topW, topY / topW);
            t.z = topZ / topW;
            ringTop.push(t);
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }
    return [projectedBase, projectedTop];
}

/**
 * Projects a fill extrusion vertices to screen while accounting for terrain.
 * This and its dependent functions are ported directly from `fill_extrusion.vertex.glsl`
 * with a few co-ordinate space differences.
 *
 * - Matrix `m` projects to screen-pixel space instead of to gl-coordinates (NDC)
 * - Texture querying is performed in texture pixel coordinates instead of  normalized uv coordinates.
 * - Height offset calculation for fill-extrusion-base is offset with -1 instead of -5 to prevent underground picking.
 */
function projectExtrusion3D(geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: DEMSampler, centroid: vec2, exaggeration: number, lat: number) {
    const projectedBase = [];
    const projectedTop = [];
    const v = [0, 0, 0];

    for (const r of geometry) {
        const ringBase = [];
        const ringTop = [];
        for (const p of r) {
            const x = p.x + translation.x;
            const y = p.y + translation.y;
            const heightOffset = getTerrainHeightOffset(x, y, zBase, zTop, demSampler, centroid, exaggeration, lat);

            v[0] = x;
            v[1] = y;
            v[2] = heightOffset.base;
            const base = toPoint(vec3.transformMat4(v, v, m));

            v[0] = x;
            v[1] = y;
            v[2] = heightOffset.top;
            const top = toPoint(vec3.transformMat4(v, v, m));

            ringBase.push(base);
            ringTop.push(top);
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }
    return [projectedBase, projectedTop];
}

function toPoint(v: vec3): Point {
    const p = new Point(v[0], v[1]);
    p.z = v[2];
    return p;
}

function getTerrainHeightOffset(x: number, y: number, zBase: number, zTop: number, demSampler: DEMSampler, centroid: vec2, exaggeration: number, lat: number): { base: number, top: number} {
    const ele = exaggeration * demSampler.getElevationAt(x, y, true, true);
    const flatRoof = centroid[0] !== 0;
    const centroidElevation = flatRoof ? centroid[1] === 0 ? exaggeration * elevationFromUint16(centroid[0]) : exaggeration * flatElevation(demSampler, centroid, lat) : ele;
    return {
        base: ele + (zBase === 0) ? -1 : zBase, // Use -1 instead of -5 in shader to prevent picking underground
        top: flatRoof ? Math.max(centroidElevation + zTop, ele + zBase + 2) : ele + zTop
    };
}

// Elevation is encoded into unit16 in fill_extrusion_bucket.js FillExtrusionBucket#encodeCentroid
function elevationFromUint16(n: number): number {
    return n / ELEVATION_SCALE;
}

// Equivalent GPU side function is in _prelude_terrain.vertex.glsl
function flatElevation(demSampler: DEMSampler, centroid: vec2, lat: number): number {
    // Span and pos are packed two 16 bit uint16 values in fill_extrusion_bucket.js FillExtrusionBucket#encodeCentroid
    // pos is encoded by << by 3 bits thus dividing by 8 performs equivalent of right shifting it back.
    const posX = Math.floor(centroid[0] / 8);
    const posY = Math.floor(centroid[1] / 8);

    // Span is stored in the lower three bits in multiples of 10
    const spanX = 10 * (centroid[0] - posX * 8);
    const spanY = 10 * (centroid[1] - posY * 8);

    // Get height at centroid
    const z = demSampler.getElevationAt(posX, posY, true, true);
    const meterToDEM = demSampler.getMeterToDEM(lat);

    const wX = Math.floor(0.5 * (spanX * meterToDEM - 1));
    const wY = Math.floor(0.5 * (spanY * meterToDEM - 1));

    const posPx = demSampler.tileCoordToPixel(posX, posY);

    const offsetX = 2 * wX + 1;
    const offsetY = 2 * wY + 1;
    const corners = fourSample(demSampler, posPx.x - wX, posPx.y - wY, offsetX, offsetY);

    const diffX = Math.abs(corners[0] - corners[1]);
    const diffY = Math.abs(corners[2] - corners[3]);
    const diffZ = Math.abs(corners[0] - corners[2]);
    const diffW = Math.abs(corners[1] - corners[3]);

    const diffSumX = diffX + diffY;
    const diffSumY = diffZ + diffW;

    const slopeX = Math.min(0.25, meterToDEM * 0.5 * diffSumX / offsetX);
    const slopeY = Math.min(0.25, meterToDEM * 0.5 * diffSumY / offsetY);

    return z + Math.max(slopeX * spanX, slopeY * spanY);
}

function fourSample(demSampler: DEMSampler, posX: number, posY: number, offsetX: number, offsetY: number): vec4 {
    return [
        demSampler.getElevationAtPixel(posX, posY, true),
        demSampler.getElevationAtPixel(posX + offsetY, posY, true),
        demSampler.getElevationAtPixel(posX, posY + offsetY, true),
        demSampler.getElevationAtPixel(posX + offsetX, posY + offsetY, true)
    ];
}

export default FillExtrusionStyleLayer;
