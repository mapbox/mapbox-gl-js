import Point from '@mapbox/point-geometry';
import PathInterpolator from './path_interpolator';
import * as intersectionTests from '../util/intersection_tests';
import Grid from './grid_index';
import {mat4, vec2, vec4} from 'gl-matrix';
import ONE_EM from '../symbol/one_em';
import {FOG_SYMBOL_CLIPPING_THRESHOLD, getFogOpacityAtTileCoord} from '../style/fog_helpers';
import assert from 'assert';
import * as symbolProjection from '../symbol/projection';
import {degToRad, wrap} from '../util/util';
import {clipLines} from '../util/line_clipping';
import EXTENT from '../style-spec/data/extent';
import {number as mix} from '../style-spec/util/interpolate';
import {globeToMercatorTransition} from '../geo/projection/globe_util';

import type {OverscaledTileID} from '../source/tile_id';
import type {vec3} from 'gl-matrix';
import type Transform from '../geo/transform';
import type Projection from '../geo/projection/projection';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {GlyphOffsetArray, SymbolLineVertexArray, PlacedSymbol} from '../data/array_types';
import type {FogState} from '../style/fog_helpers';
import type {CollisionGroup} from '../symbol/placement';

export type PlacedCollisionBox = {
    box: Array<number>;
    offscreen: boolean;
    occluded: boolean;
};
type PlacedCollisionCircles = {
    circles: Array<number>;
    offscreen: boolean;
    collisionDetected: boolean;
    occluded: boolean;
};
type ScreenAnchorPoint = {
    occluded: boolean;
    perspectiveRatio: number;
    point: Point;
    signedDistanceFromCamera: number;
};

// When a symbol crosses the edge that causes it to be included in
// collision detection, it will cause changes in the symbols around
// it. This constant specifies how many pixels to pad the edge of
// the viewport for collision detection so that the bulk of the changes
// occur offscreen. Making this constant greater increases label
// stability, but it's expensive.
const viewportPadding = 100;

/**
 * A collision index used to prevent symbols from overlapping. It keep tracks of
 * where previous symbols have been placed and is used to check if a new
 * symbol overlaps with any previously added symbols.
 *
 * There are two steps to insertion: first placeCollisionBox/Circles checks if
 * there's room for a symbol, then insertCollisionBox/Circles actually puts the
 * symbol in the index. The two step process allows paired symbols to be inserted
 * together even if they overlap.
 *
 * @private
 */
class CollisionIndex {
    grid: Grid;
    ignoredGrid: Grid;
    transform: Transform;
    pitchfactor: number;
    screenRightBoundary: number;
    screenBottomBoundary: number;
    gridRightBoundary: number;
    gridBottomBoundary: number;
    fogState: FogState | null | undefined;

    constructor(
        transform: Transform,
        fogState?: FogState | null,
        grid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25),
        ignoredGrid: Grid = new Grid(transform.width + 2 * viewportPadding, transform.height + 2 * viewportPadding, 25)
    ) {
        this.transform = transform;

        this.grid = grid;
        this.ignoredGrid = ignoredGrid;
        this.pitchfactor = Math.cos(transform._pitch) * transform.cameraToCenterDistance;

        this.screenRightBoundary = transform.width + viewportPadding;
        this.screenBottomBoundary = transform.height + viewportPadding;
        this.gridRightBoundary = transform.width + 2 * viewportPadding;
        this.gridBottomBoundary = transform.height + 2 * viewportPadding;
        this.fogState = fogState;
    }

    placeCollisionBox(
        bucket: SymbolBucket,
        scale: number,
        collisionBox: SingleCollisionBox,
        mercatorCenter: [number, number],
        invMatrix: mat4,
        projectedPosOnLabelSpace: boolean,
        shift: Point,
        allowOverlap: boolean,
        textPixelRatio: number,
        posMatrix: mat4,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collisionGroupPredicate?: any,
    ): PlacedCollisionBox {
        assert(!this.transform.elevation || collisionBox.elevation !== undefined);

        let projectedAnchorX = collisionBox.projectedAnchorX;
        let projectedAnchorY = collisionBox.projectedAnchorY;
        let projectedAnchorZ = collisionBox.projectedAnchorZ;
        const anchorX = collisionBox.tileAnchorX;
        const anchorY = collisionBox.tileAnchorY;

        // Apply elevation vector to the anchor point
        const elevation = collisionBox.elevation;
        const tileID = collisionBox.tileID;
        const projection = bucket.getProjection();
        if (elevation && tileID) {
            const [ux, uy, uz] = projection.upVector(tileID.canonical, collisionBox.tileAnchorX, collisionBox.tileAnchorY);
            const upScale = projection.upVectorScale(tileID.canonical, this.transform.center.lat, this.transform.worldSize).metersToTile;

            projectedAnchorX += ux * elevation * upScale;
            projectedAnchorY += uy * elevation * upScale;
            projectedAnchorZ += uz * elevation * upScale;
        }

        const bucketIsGlobeProjection = bucket.projection.name === 'globe';
        const globeToMercator = bucket.projection.name === 'globe' ? globeToMercatorTransition(this.transform.zoom) : 0.0;
        const isGlobeToMercatorTransition = globeToMercator < 1;

        if (tileID && bucketIsGlobeProjection && isGlobeToMercatorTransition && !projectedPosOnLabelSpace) {
            const tilesCount = 1 << tileID.canonical.z;
            const mercator = vec2.fromValues(anchorX, anchorY);
            vec2.scale(mercator, mercator, 1 / EXTENT);
            vec2.add(mercator, mercator, vec2.fromValues(tileID.canonical.x, tileID.canonical.y));
            vec2.scale(mercator, mercator, 1 / tilesCount);
            vec2.sub(mercator, mercator, vec2.fromValues(mercatorCenter[0], mercatorCenter[1]));
            mercator[0] = wrap(mercator[0], -0.5, 0.5);

            vec2.scale(mercator, mercator, EXTENT);

            const mercatorPosition = vec4.fromValues(mercator[0], mercator[1], EXTENT / (2.0 * Math.PI), 1.0);
            vec4.transformMat4(mercatorPosition, mercatorPosition, invMatrix);

            projectedAnchorX = mix(projectedAnchorX, mercatorPosition[0], globeToMercator);
            projectedAnchorY = mix(projectedAnchorY, mercatorPosition[1], globeToMercator);
            projectedAnchorZ = mix(projectedAnchorZ, mercatorPosition[2], globeToMercator);
        }

        const checkOcclusion = projection.name === 'globe' || !!elevation || this.transform.pitch > 0;
        const projectedPoint = this.projectAndGetPerspectiveRatio(posMatrix, projectedAnchorX, projectedAnchorY, projectedAnchorZ, collisionBox.tileID, checkOcclusion, projection);

        const tileToViewport = textPixelRatio * projectedPoint.perspectiveRatio;
        const tlX = (collisionBox.x1 * scale + shift.x - collisionBox.padding) * tileToViewport + projectedPoint.point.x;
        const tlY = (collisionBox.y1 * scale + shift.y - collisionBox.padding) * tileToViewport + projectedPoint.point.y;
        const brX = (collisionBox.x2 * scale + shift.x + collisionBox.padding) * tileToViewport + projectedPoint.point.x;
        const brY = (collisionBox.y2 * scale + shift.y + collisionBox.padding) * tileToViewport + projectedPoint.point.y;
        // Clip at 10 times the distance of the map center or, said otherwise, when the label
        // would be drawn at 10% the size of the features around it without scaling. Refer:
        // https://github.com/mapbox/mapbox-gl-native/wiki/Text-Rendering#perspective-scaling
        // 0.55 === projection.getPerspectiveRatio(camera_to_center, camera_to_center * 10)
        const minPerspectiveRatio = 0.55;
        const isClipped = projectedPoint.perspectiveRatio <= minPerspectiveRatio || projectedPoint.occluded;

        if (!this.isInsideGrid(tlX, tlY, brX, brY) ||
            (!allowOverlap && this.grid.hitTest(tlX, tlY, brX, brY, collisionGroupPredicate)) ||
            isClipped) {
            return {
                box: [],
                offscreen: false,
                occluded: projectedPoint.occluded
            };
        }

        return {
            box: [tlX, tlY, brX, brY],
            offscreen: this.isOffscreen(tlX, tlY, brX, brY),
            occluded: false
        };
    }

    placeCollisionCircles(
        bucket: SymbolBucket,
        allowOverlap: boolean,
        symbol: PlacedSymbol,
        lineVertexArray: SymbolLineVertexArray,
        glyphOffsetArray: GlyphOffsetArray,
        fontSize: number,
        posMatrix: Float32Array,
        labelPlaneMatrix: Float32Array,
        labelToScreenMatrix: mat4 | null | undefined,
        showCollisionCircles: boolean,
        pitchWithMap: boolean,
        collisionGroupPredicate: CollisionGroup['predicate'],
        circlePixelDiameter: number,
        textPixelPadding: number,
        tileID: OverscaledTileID,
    ): PlacedCollisionCircles {
        const placedCollisionCircles = [];
        const elevation = this.transform.elevation;
        const projection = bucket.getProjection();
        const getElevation = elevation ? elevation.getAtTileOffsetFunc(tileID, this.transform.center.lat, this.transform.worldSize, projection) : null;

        const tileUnitAnchorPoint = new Point(symbol.tileAnchorX, symbol.tileAnchorY);
        let {x: anchorX, y: anchorY, z: anchorZ} = projection.projectTilePoint(tileUnitAnchorPoint.x, tileUnitAnchorPoint.y, tileID.canonical);
        if (getElevation) {
            const [dx, dy, dz] = getElevation(tileUnitAnchorPoint);
            anchorX += dx;
            anchorY += dy;
            anchorZ += dz;
        }
        const isGlobe = projection.name === 'globe';
        const checkOcclusion = isGlobe || !!elevation || this.transform.pitch > 0;
        const screenAnchorPoint = this.projectAndGetPerspectiveRatio(posMatrix, anchorX, anchorY, anchorZ, tileID, checkOcclusion, projection);
        const {perspectiveRatio} = screenAnchorPoint;
        const labelPlaneFontScale = (pitchWithMap ? fontSize / perspectiveRatio : fontSize * perspectiveRatio) / ONE_EM;
        const labelPlaneAnchorPoint = symbolProjection.project(anchorX, anchorY, anchorZ, labelPlaneMatrix);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectionCache: Record<string, any> = {};
        const lineOffsetX = symbol.lineOffsetX * labelPlaneFontScale;
        const lineOffsetY = symbol.lineOffsetY * labelPlaneFontScale;

        const layout = bucket.layers[0].layout;
        const textMaxAngle = degToRad(layout.get('text-max-angle'));
        const maxAngleCos = Math.cos(textMaxAngle);

        const firstAndLastGlyph = screenAnchorPoint.signedDistanceFromCamera > 0 ? symbolProjection.placeFirstAndLastGlyph(
            labelPlaneFontScale,
            glyphOffsetArray,
            lineOffsetX,
            lineOffsetY,
            /*flip*/ false,
            // @ts-expect-error - TS2345 - Argument of type 'vec4' is not assignable to parameter of type 'vec3'.
            labelPlaneAnchorPoint,
            tileUnitAnchorPoint,
            symbol,
            lineVertexArray,
            labelPlaneMatrix,
            projectionCache,
            elevation && !pitchWithMap ? getElevation : null, // pitchWithMap: no need to sample elevation as it has no effect when projecting using scale/rotate to tile space labelPlaneMatrix.
            pitchWithMap && !!elevation,
            projection,
            tileID,
            pitchWithMap,
            maxAngleCos
        ) : null;

        let collisionDetected = false;
        let inGrid = false;
        let entirelyOffscreen = true;

        if (firstAndLastGlyph && !screenAnchorPoint.occluded) {
            const radius = circlePixelDiameter * 0.5 * perspectiveRatio + textPixelPadding;
            const screenPlaneMin = new Point(-viewportPadding, -viewportPadding);
            const screenPlaneMax = new Point(this.screenRightBoundary, this.screenBottomBoundary);
            const interpolator = new PathInterpolator();

            // Construct a projected path from projected line vertices. Anchor points are ignored and removed
            const {first, last} = firstAndLastGlyph;
            const firstLen = first.path.length;

            let projectedPath: vec3[] = [];
            for (let i = firstLen - 1; i >= 1; i--) {
                projectedPath.push(first.path[i]);
            }
            for (let i = 1; i < last.path.length; i++) {
                projectedPath.push(last.path[i]);
            }
            assert(projectedPath.length >= 2);

            // Tolerate a slightly longer distance than one diameter between two adjacent circles
            const circleDist = radius * 2.5;

            // The path might need to be converted into screen space if a pitched map is used as the label space
            if (labelToScreenMatrix) {
                assert(pitchWithMap);
                // @ts-expect-error - TS2322 - Type 'vec4[]' is not assignable to type 'vec3[]'.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                projectedPath = projectedPath.map(([x, y, z]: [any, any, any], index) => {
                    if (getElevation && !isGlobe) {
                        z = getElevation(index < firstLen - 1 ? first.tilePath[firstLen - 1 - index] : last.tilePath[index - firstLen + 2])[2];
                    }
                    return symbolProjection.project(x, y, z, labelToScreenMatrix);
                });

                // Do not try to place collision circles if even of the points is behind the camera.
                // This is a plausible scenario with big camera pitch angles
                if (projectedPath.some(point => point[3] <= 0)) {
                    projectedPath = [];
                }
            }

            let segments = [];

            if (projectedPath.length > 0) {
                // Quickly check if the path is fully inside or outside of the padded collision region.
                // For overlapping paths we'll only create collision circles for the visible segments
                let minx = Infinity;
                let maxx = -Infinity;
                let miny = Infinity;
                let maxy = -Infinity;

                for (const p of projectedPath) {
                    minx = Math.min(minx, p[0]);
                    miny = Math.min(miny, p[1]);
                    maxx = Math.max(maxx, p[0]);
                    maxy = Math.max(maxy, p[1]);
                }

                // Path visible
                if (maxx >= screenPlaneMin.x && minx <= screenPlaneMax.x &&
                    maxy >= screenPlaneMin.y && miny <= screenPlaneMax.y) {

                    segments = [projectedPath.map(p => new Point(p[0], p[1]))];

                    if (minx < screenPlaneMin.x || maxx > screenPlaneMax.x ||
                        miny < screenPlaneMin.y || maxy > screenPlaneMax.y) {
                        // Path partially visible, clip
                        segments = clipLines(segments, screenPlaneMin.x, screenPlaneMin.y, screenPlaneMax.x, screenPlaneMax.y);
                    }
                }
            }

            for (const seg of segments) {
                // interpolate positions for collision circles. Add a small padding to both ends of the segment
                assert(seg.length > 0);
                interpolator.reset(seg, radius * 0.25);

                let numCircles = 0;

                if (interpolator.length <= 0.5 * radius) {
                    numCircles = 1;
                } else {
                    numCircles = Math.ceil(interpolator.paddedLength / circleDist) + 1;
                }

                for (let i = 0; i < numCircles; i++) {
                    const t = i / Math.max(numCircles - 1, 1);
                    const circlePosition = interpolator.lerp(t);

                    // add viewport padding to the position and perform initial collision check
                    const centerX = circlePosition.x + viewportPadding;
                    const centerY = circlePosition.y + viewportPadding;

                    placedCollisionCircles.push(centerX, centerY, radius, 0);

                    const x1 = centerX - radius;
                    const y1 = centerY - radius;
                    const x2 = centerX + radius;
                    const y2 = centerY + radius;

                    entirelyOffscreen = entirelyOffscreen && this.isOffscreen(x1, y1, x2, y2);
                    inGrid = inGrid || this.isInsideGrid(x1, y1, x2, y2);

                    if (!allowOverlap) {
                        if (this.grid.hitTestCircle(centerX, centerY, radius, collisionGroupPredicate)) {
                            // Don't early exit if we're showing the debug circles because we still want to calculate
                            // which circles are in use
                            collisionDetected = true;
                            if (!showCollisionCircles) {
                                return {
                                    circles: [],
                                    offscreen: false,
                                    collisionDetected,
                                    occluded: false
                                };
                            }
                        }
                    }
                }
            }
        }

        return {
            circles: ((!showCollisionCircles && collisionDetected) || !inGrid) ? [] : placedCollisionCircles,
            offscreen: entirelyOffscreen,
            collisionDetected,
            occluded: screenAnchorPoint.occluded
        };
    }

    /**
     * Because the geometries in the CollisionIndex are an approximation of the shape of
     * symbols on the map, we use the CollisionIndex to look up the symbol part of
     * `queryRenderedFeatures`.
     *
     * @private
     */
    queryRenderedSymbols(viewportQueryGeometry: Array<Point>): {
        [id: number]: Array<number>;
    } {
        if (viewportQueryGeometry.length === 0 || (this.grid.keysLength() === 0 && this.ignoredGrid.keysLength() === 0)) {
            return {};
        }

        const query = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const point of viewportQueryGeometry) {
            const gridPoint = new Point(point.x + viewportPadding, point.y + viewportPadding);
            minX = Math.min(minX, gridPoint.x);
            minY = Math.min(minY, gridPoint.y);
            maxX = Math.max(maxX, gridPoint.x);
            maxY = Math.max(maxY, gridPoint.y);
            query.push(gridPoint);
        }

        const features = this.grid.query(minX, minY, maxX, maxY)
            .concat(this.ignoredGrid.query(minX, minY, maxX, maxY));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seenFeatures: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {};

        for (const feature of features) {
            const featureKey = feature.key;
            // Skip already seen features.
            if (seenFeatures[featureKey.bucketInstanceId] === undefined) {
                seenFeatures[featureKey.bucketInstanceId] = {};
            }
            if (seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex]) {
                continue;
            }

            // Check if query intersects with the feature box
            // "Collision Circles" for line labels are treated as boxes here
            // Since there's no actual collision taking place, the circle vs. square
            // distinction doesn't matter as much, and box geometry is easier
            // to work with.
            const bbox = [
                new Point(feature.x1, feature.y1),
                new Point(feature.x2, feature.y1),
                new Point(feature.x2, feature.y2),
                new Point(feature.x1, feature.y2)
            ];
            if (!intersectionTests.polygonIntersectsPolygon(query, bbox)) {
                continue;
            }

            seenFeatures[featureKey.bucketInstanceId][featureKey.featureIndex] = true;
            if (result[featureKey.bucketInstanceId] === undefined) {
                result[featureKey.bucketInstanceId] = [];
            }
            result[featureKey.bucketInstanceId].push(featureKey.featureIndex);
        }

        return result;
    }

    insertCollisionBox(collisionBox: Array<number>, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = {bucketInstanceId, featureIndex, collisionGroupID};
        grid.insert(key, collisionBox[0], collisionBox[1], collisionBox[2], collisionBox[3]);
    }

    insertCollisionCircles(collisionCircles: Array<number>, ignorePlacement: boolean, bucketInstanceId: number, featureIndex: number, collisionGroupID: number) {
        const grid = ignorePlacement ? this.ignoredGrid : this.grid;

        const key = {bucketInstanceId, featureIndex, collisionGroupID};
        for (let k = 0; k < collisionCircles.length; k += 4) {
            grid.insertCircle(key, collisionCircles[k], collisionCircles[k + 1], collisionCircles[k + 2]);
        }
    }

    projectAndGetPerspectiveRatio(
        posMatrix: mat4,
        x: number,
        y: number,
        z: number,
        tileID: OverscaledTileID | null | undefined,
        checkOcclusion: boolean,
        bucketProjection: Projection,
    ): ScreenAnchorPoint {
        const p = [x, y, z, 1];
        let behindFog = false;
        if (z || this.transform.pitch > 0) {
            vec4.transformMat4(p as [number, number, number, number], p as [number, number, number, number], posMatrix);
            // Do not perform symbol occlusion on globe due to fog fixed range
            const isGlobe = bucketProjection.name === 'globe';
            if (this.fogState && tileID && !isGlobe) {
                const fogOpacity = getFogOpacityAtTileCoord(this.fogState, x, y, z, tileID.toUnwrapped(), this.transform);
                behindFog = fogOpacity > FOG_SYMBOL_CLIPPING_THRESHOLD;
            }
        } else {
            // @ts-expect-error - TS2345 - Argument of type 'number[]' is not assignable to parameter of type 'vec4'.
            symbolProjection.xyTransformMat4(p, p, posMatrix);
        }
        const w = p[3];
        const a = new Point(
            (((p[0] / w + 1) / 2) * this.transform.width) + viewportPadding,
            (((-p[1] / w + 1) / 2) * this.transform.height) + viewportPadding
        );
        return {
            point: a,
            // See perspective ratio comment in symbol_sdf.vertex
            // We're doing collision detection in viewport space so we need
            // to scale down boxes in the distance
            perspectiveRatio: Math.min(0.5 + 0.5 * (this.transform.getCameraToCenterDistance(bucketProjection) / w), 1.5),
            signedDistanceFromCamera: w,
            occluded: (checkOcclusion && p[2] > w) || behindFog // Occluded by the far plane
        };
    }

    isOffscreen(x1: number, y1: number, x2: number, y2: number): boolean {
        return x2 < viewportPadding || x1 >= this.screenRightBoundary || y2 < viewportPadding || y1 > this.screenBottomBoundary;
    }

    isInsideGrid(x1: number, y1: number, x2: number, y2: number): boolean {
        return x2 >= 0 && x1 < this.gridRightBoundary && y2 >= 0 && y1 < this.gridBottomBoundary;
    }

    /*
    * Returns a matrix for transforming collision shapes to viewport coordinate space.
    * Use this function to render e.g. collision circles on the screen.
    *   example transformation: clipPos = glCoordMatrix * viewportMatrix * circle_pos
    */
    getViewportMatrix(): mat4 {
        const m = mat4.identity([] as unknown as mat4);
        mat4.translate(m, m, [-viewportPadding, -viewportPadding, 0.0]);
        return m;
    }
}

export default CollisionIndex;
