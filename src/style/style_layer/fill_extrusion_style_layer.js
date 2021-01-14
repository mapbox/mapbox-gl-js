// @flow

import StyleLayer from '../style_layer';

import FillExtrusionBucket from '../../data/bucket/fill_extrusion_bucket';
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

        const projectedQueryGeometry = queryGeometry.queryGeometry.screenGeometry;

        const centroid = [0, 0];
        const terrainVisible = elevationHelper && transform.elevation;
        let exaggeration = 1;
        if (terrainVisible){
            const centroidVertexArray = queryGeometry.tile.getBucket(this).centroidVertexArray;

            // See FillExtrusionBucket#encodeCentroid(), centroid is inserted at vertexOffset + 1
            const centroidOffset = layoutVertexArrayOffset + 1;
            if (centroidOffset < centroidVertexArray.length) {
                const centroidVertexObject = centroidVertexArray.get(centroidOffset);
                centroid[0] = centroidVertexObject.a_centroid_pos0;
                centroid[1] = centroidVertexObject.a_centroid_pos1;
            }

            exaggeration = transform.elevation.exaggeration();
        }

        // Early exit if fill extrusion is still hidden while waiting for backfill
        const isHidden = centroid[0] === 0 && centroid[1] === 1;
        if (isHidden) return false;

        const demSampler = terrainVisible ? elevationHelper : null;
        const projected = projectExtrusion(geometry, base, height, translation, pixelPosMatrix, demSampler, centroid, exaggeration, transform.center.lat);
        const projectedBase = projected[0];
        const projectedTop = projected[1];
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
    if (demSampler){
        return projectExtrusion3D(geometry, zBase, zTop, translation, m, demSampler, centroid, exaggeration, lat);
    } else {
        return projectExtrusion2D(geometry, zBase, zTop, translation, m);
    }
}

function projectExtrusion3D(geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: DEMSampler, centroid: vec2, exaggeration: number, lat: number) {
    const projectedBase = [];
    const projectedTop = [];

    for (const r of geometry) {
        const ringBase = [];
        const ringTop = [];
        for (const p of r) {
            const x = p.x + translation.x;
            const y = p.y + translation.y;
            const heightOffset = getTerrainHeightOffset(x, y, zBase, zTop, demSampler, centroid, exaggeration, lat);

            const base = toPoint(vec3.transformMat4([], [x, y, heightOffset.base], m));
            const top = toPoint(vec3.transformMat4([], [x, y, heightOffset.top], m));

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
    const ele = exaggeration * demSampler.getElevationAt(x, y , true);
    const flatRoof = centroid[0] !== 0;
    const centroidElevation = flatRoof ? centroid[1] === 0 ? exaggeration * elevationFromUint16(centroid[0]) : exaggeration * flatElevation(demSampler, centroid, lat) : ele;
    return {
        base: ele + (zBase === 0) ? -5 : zBase,
        top: flatRoof ? Math.max(centroidElevation + zTop, ele + zBase + 2) : ele + zTop
    }
}

function elevationFromUint16(n: number): number {
    return n / 7.3;
}

function flatElevation(demSampler: DEMSampler, centroid: vec2, lat: number): number {
    const pos = [Math.floor(centroid[0] / 8), Math.floor(centroid[1] / 8)];
    const span = [10 * (centroid[0] - pos[0] * 8), 10 * (centroid[1] - pos[1] * 8)];

    // Get height at centroid
    const z = demSampler.getElevationAt(pos[0], pos[1], true);
    const meterToDEM = demSampler.getMeterToDEM(lat);
    const w = [
        Math.floor(0.5 * (span[0] * meterToDEM - 1)),
        Math.floor(0.5 * (span[1] * meterToDEM - 1))
    ];
    const posPx = demSampler.tileCoordToPixel(pos[0], pos[1]);

    const offset = [2 * w[0] + 1, 2 * w[1] + 1];
    const corners = fourSample(demSampler, [posPx.x - w[0], posPx.y - w[1]], offset);
    const diff = [
        corners[0] - corners[1],
        corners[2] - corners[3],
        corners[0] - corners[2],
        corners[1] - corners[3]
    ];
    const diffSum = [diff[0] + diff[1], diff[2] + diff[3]];
    const slope =[
        Math.min(0.25, meterToDEM * 0.5 * diffSum[0] / offset[0]),
        Math.min(0.25, meterToDEM * 0.5 * diffSum[1] / offset[1])
    ];

    return z + Math.max(slope[0] * span[0], slope[1] * span[1]);
}

function fourSample(demSampler: DEMSampler, pos: vec2, offset: vec2): vec4 {
    return [
        demSampler.getElevationAtPixel(pos[0], pos[1]),
        demSampler.getElevationAtPixel(pos[0] + offset[0], pos[1]),
        demSampler.getElevationAtPixel(pos[0], pos[1] + offset[1]),
        demSampler.getElevationAtPixel(pos[0] + offset[0], pos[1] + offset[1])
    ];
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

export default FillExtrusionStyleLayer;
