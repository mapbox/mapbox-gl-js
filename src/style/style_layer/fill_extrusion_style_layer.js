// @flow

import StyleLayer from '../style_layer.js';
import FillExtrusionBucket, {ELEVATION_SCALE, ELEVATION_OFFSET, fillExtrusionHeightLift, resampleFillExtrusionPolygonsForGlobe} from '../../data/bucket/fill_extrusion_bucket.js';
import {polygonIntersectsPolygon, polygonIntersectsMultiPolygon} from '../../util/intersection_tests.js';
import {translateDistance, tilespaceTranslate} from '../query_utils.js';
import properties from './fill_extrusion_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import Point from '@mapbox/point-geometry';
import {vec3, vec4} from 'gl-matrix';
import EXTENT from '../../style-spec/data/extent.js';
import {CanonicalTileID} from '../../source/tile_id.js';

import type {FeatureState} from '../../style-spec/expression/index.js';
import type {BucketParameters} from '../../data/bucket.js';
import type {PaintProps, LayoutProps} from './fill_extrusion_style_layer_properties.js';
import type Transform from '../../geo/transform.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../query_geometry.js';
import type {DEMSampler} from '../../terrain/elevation.js';
import type {Vec2, Vec4} from 'gl-matrix';
import type {IVectorTileFeature} from '@mapbox/vector-tile';
import type {ConfigOptions} from '../properties.js';

class Point3D extends Point {
    z: number;

    constructor(x: number, y: number, z: number) {
        super(x, y);
        this.z = z;
    }
}

class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    layout: PossiblyEvaluated<LayoutProps>;

    constructor(layer: LayerSpecification, options?: ?ConfigOptions) {
        super(layer, properties, options);
        this._stats = {numRenderedVerticesInShadowPass : 0, numRenderedVerticesInTransparentPass: 0};
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>): FillExtrusionBucket {
        return new FillExtrusionBucket(parameters);
    }

    // $FlowFixMe[method-unbinding]
    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    is3D(): boolean {
        return true;
    }

    hasShadowPass(): boolean {
        return true;
    }

    cutoffRange(): number {
        return this.paint.get('fill-extrusion-cutoff-fade-range');
    }

    canCastShadows(): boolean {
        return true;
    }

    getProgramIds(): string[] {
        const patternProperty = this.paint.get('fill-extrusion-pattern');
        const image = patternProperty.constantOr((1: any));
        return [image ? 'fillExtrusionPattern' : 'fillExtrusion'];
    }

    // $FlowFixMe[method-unbinding]
    queryIntersectsFeature(queryGeometry: TilespaceQueryGeometry,
                           feature: IVectorTileFeature,
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
        const bucket = queryGeometry.tile.getBucket(this);
        if (terrainVisible && bucket instanceof FillExtrusionBucket) {
            const centroidVertexArray = bucket.centroidVertexArray;

            // See FillExtrusionBucket#encodeCentroid(), centroid is inserted at vertexOffset + 1
            const centroidOffset = layoutVertexArrayOffset + 1;
            if (centroidOffset < centroidVertexArray.length) {
                centroid[0] = centroidVertexArray.geta_centroid_pos0(centroidOffset);
                centroid[1] = centroidVertexArray.geta_centroid_pos1(centroidOffset);
            }
        }

        // Early exit if fill extrusion is still hidden while waiting for backfill
        const isHidden = centroid[0] === 0 && centroid[1] === 1;
        if (isHidden) return false;

        if (transform.projection.name === 'globe') {
            // Fill extrusion geometry has to be resampled so that large planar polygons
            // can be rendered on the curved surface
            const bounds = [new Point(0, 0), new Point(EXTENT, EXTENT)];
            const resampledGeometry = resampleFillExtrusionPolygonsForGlobe([geometry], bounds, queryGeometry.tileID.canonical);
            geometry = resampledGeometry.map(clipped => clipped.polygon).flat();
        }

        const demSampler = terrainVisible ? elevationHelper : null;
        const [projectedBase, projectedTop] = projectExtrusion(transform, geometry, base, height, translation, pixelPosMatrix, demSampler, centroid, exaggeration, transform.center.lat, queryGeometry.tileID.canonical);

        const screenQuery = queryGeometry.queryGeometry;
        const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;
        return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
    }
}

function dot(a: Point, b: Point) {
    return a.x * b.x + a.y * b.y;
}

export function getIntersectionDistance(projectedQueryGeometry: Array<Point>, projectedFace: Array<Point3D>): number {

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

function checkIntersection(projectedBase: Array<Array<Point3D>>, projectedTop: Array<Array<Point3D>>, projectedQueryGeometry: Array<Point>) {
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

function projectExtrusion(tr: Transform, geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: ?DEMSampler, centroid: Vec2, exaggeration: number, lat: number, tileID: CanonicalTileID) {
    if (tr.projection.name === 'globe') {
        return projectExtrusionGlobe(tr, geometry, zBase, zTop, translation, m, demSampler, centroid, exaggeration, lat, tileID);
    } else {
        if (demSampler) {
            return projectExtrusion3D(geometry, zBase, zTop, translation, m, demSampler, centroid, exaggeration, lat);
        } else {
            return projectExtrusion2D(geometry, zBase, zTop, translation, m);
        }
    }
}

function projectExtrusionGlobe(tr: Transform, geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: ?DEMSampler, centroid: Vec2, exaggeration: number, lat: number, tileID: CanonicalTileID) {
    const projectedBase = [];
    const projectedTop = [];
    const elevationScale = tr.projection.upVectorScale(tileID, tr.center.lat, tr.worldSize).metersToTile;
    const basePoint = [0, 0, 0, 1];
    const topPoint = [0, 0, 0, 1];

    const setPoint = (point: Array<number>, x: number, y: number, z: number) => {
        point[0] = x;
        point[1] = y;
        point[2] = z;
        point[3] = 1;
    };

    // Fixed "lift" value is added to height so that 0-height fill extrusions wont clip with globe's surface
    const lift = fillExtrusionHeightLift();

    if (zBase > 0) {
        zBase += lift;
    }
    zTop += lift;

    for (const r of geometry) {
        const ringBase = [];
        const ringTop = [];
        for (const p of r) {
            const x = p.x + translation.x;
            const y = p.y + translation.y;

            // Reproject tile coordinate into ecef and apply elevation to correct direction
            const reproj = tr.projection.projectTilePoint(x, y, tileID);
            const dir = tr.projection.upVector(tileID, p.x, p.y);

            let zBasePoint = zBase;
            let zTopPoint = zTop;

            if (demSampler) {
                const offset = getTerrainHeightOffset(x, y, zBase, zTop, demSampler, centroid, exaggeration, lat);

                zBasePoint += offset.base;
                zTopPoint += offset.top;
            }

            if (zBase !== 0) {
                setPoint(
                    basePoint,
                    reproj.x + dir[0] * elevationScale * zBasePoint,
                    reproj.y + dir[1] * elevationScale * zBasePoint,
                    reproj.z + dir[2] * elevationScale * zBasePoint);
            } else {
                setPoint(basePoint, reproj.x, reproj.y, reproj.z);
            }

            setPoint(
                topPoint,
                reproj.x + dir[0] * elevationScale * zTopPoint,
                reproj.y + dir[1] * elevationScale * zTopPoint,
                reproj.z + dir[2] * elevationScale * zTopPoint);

            vec3.transformMat4(basePoint, basePoint, m);
            vec3.transformMat4(topPoint, topPoint, m);

            ringBase.push(new Point3D(basePoint[0], basePoint[1], basePoint[2]));
            ringTop.push(new Point3D(topPoint[0], topPoint[1], topPoint[2]));
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }

    return [projectedBase, projectedTop];
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
            const baseW = Math.max(sW + baseWZ, 0.00001);

            const topX = sX + topXZ;
            const topY = sY + topYZ;
            const topZ = sZ + topZZ;
            const topW = Math.max(sW + topWZ, 0.00001);

            ringBase.push(new Point3D(baseX / baseW, baseY / baseW, baseZ / baseW));
            ringTop.push(new Point3D(topX / topW, topY / topW, topZ / topW));
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }
    return [projectedBase, projectedTop];
}

/*
 * Projects a fill extrusion vertices to screen while accounting for terrain.
 * This and its dependent functions are ported directly from `fill_extrusion.vertex.glsl`
 * with a few co-ordinate space differences.
 *
 * - Matrix `m` projects to screen-pixel space instead of to gl-coordinates (NDC)
 * - Texture querying is performed in texture pixel coordinates instead of  normalized uv coordinates.
 * - Height offset calculation for fill-extrusion-base is offset with -1 instead of -5 to prevent underground picking.
 */
function projectExtrusion3D(geometry: Array<Array<Point>>, zBase: number, zTop: number, translation: Point, m: Float32Array, demSampler: DEMSampler, centroid: Vec2, exaggeration: number, lat: number) {
    const projectedBase = [];
    const projectedTop = [];
    const v = [0, 0, 0, 1];

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
            v[3] = 1;
            vec4.transformMat4(v, v, m);
            v[3] = Math.max(v[3], 0.00001);
            const base = new Point3D(v[0] / v[3], v[1] / v[3], v[2] / v[3]);

            v[0] = x;
            v[1] = y;
            v[2] = heightOffset.top;
            v[3] = 1;
            vec4.transformMat4(v, v, m);
            v[3] = Math.max(v[3], 0.00001);
            const top = new Point3D(v[0] / v[3], v[1] / v[3], v[2] / v[3]);

            ringBase.push(base);
            ringTop.push(top);
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }
    return [projectedBase, projectedTop];
}

function getTerrainHeightOffset(x: number, y: number, zBase: number, zTop: number, demSampler: DEMSampler, centroid: Vec2, exaggeration: number, lat: number): { base: number, top: number} {
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
    return n / ELEVATION_SCALE - ELEVATION_OFFSET;
}

// Equivalent GPU side function is in _prelude_terrain.vertex.glsl
function flatElevation(demSampler: DEMSampler, centroid: Vec2, lat: number): number {
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

function fourSample(demSampler: DEMSampler, posX: number, posY: number, offsetX: number, offsetY: number): Vec4 {
    return [
        demSampler.getElevationAtPixel(posX, posY, true),
        demSampler.getElevationAtPixel(posX + offsetY, posY, true),
        demSampler.getElevationAtPixel(posX, posY + offsetY, true),
        demSampler.getElevationAtPixel(posX + offsetX, posY + offsetY, true)
    ];
}

export default FillExtrusionStyleLayer;
