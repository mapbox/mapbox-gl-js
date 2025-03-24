import {
    LineLayoutArray,
    LineExtLayoutArray,
    LinePatternLayoutArray,
    LineZOffsetExtArray,
} from '../array_types';
import {members as layoutAttributes, lineZOffsetAttributes} from './line_attributes';
import {members as layoutAttributesExt} from './line_attributes_ext';
import {members as layoutAttributesPattern} from './line_attributes_pattern';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import EXTENT from '../../style-spec/data/extent';
import {VectorTileFeature} from '@mapbox/vector-tile';
const vectorTileFeatureTypes = VectorTileFeature.types;
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import loadGeometry from '../load_geometry';
import toEvaluationFeature from '../evaluation_feature';
import EvaluationParameters from '../../style/evaluation_parameters';
import assert from 'assert';
import {Point4D, clipLine} from '../../util/polygon_clipping';
import {warnOnce} from '../../util/util';
import {tileToMeter} from '../../geo/mercator_coordinate';
// Import LineAtlas as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../../render/line_atlas';
import {number as interpolate} from '../../style-spec/util/interpolate';

import type {ProjectionSpecification} from '../../style-spec/types';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type {Segment} from '../segment';
import type {RGBAImage, SpritePositions} from '../../util/image';
import type Context from '../../gl/context';
import type Texture from '../../render/texture';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';
import type LineAtlas from '../../render/line_atlas';
import type {TileTransform} from '../../geo/projection/tile_transform';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../../3d-style/util/conflation';
import type {PossiblyEvaluatedValue} from '../../style/properties';
import type Point from "@mapbox/point-geometry";
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type {ImageId} from '../../style-spec/expression/types/image_id';

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
const EXTRUDE_SCALE = 63;

/*
 * Sharp corners cause dashed lines to tilt because the distance along the line
 * is the same at both the inner and outer corners. To improve the appearance of
 * dashed lines we add extra points near sharp corners so that a smaller part
 * of the line is tilted.
 *
 * COS_HALF_SHARP_CORNER controls how sharp a corner has to be for us to add an
 * extra vertex. The default is 75 degrees.
 */
const COS_HALF_SHARP_CORNER = Math.cos(75 / 2 * (Math.PI / 180));

/*
 * Straight corners are used to reduce vertex count for line-join: none lines.
 * If corner angle is less than COS_STRAIGHT_CORNER, we use a miter joint,
 * instead of creating a new line segment. The default is 5 degrees.
 */
const COS_STRAIGHT_CORNER = Math.cos(5 * (Math.PI / 180));

// Angle per triangle for approximating round line joins.
const DEG_PER_TRIANGLE = 20;

type LineClips = {
    start: number;
    end: number;
};

type GradientTexture = {
    texture: Texture;
    gradient: RGBAImage | null | undefined;
    version: number;
};

type LineProgressFeatures = {
    zOffset: number;
    variableWidth: number;
};

/**
 * @private
 */
class LineBucket implements Bucket {
    distance: number;
    prevDistance: number;
    totalDistance: number;
    totalFeatureLength: number;
    maxLineLength: number;
    scaledDistance: number;
    lineSoFar: number;
    lineClips: LineClips | null | undefined;
    zOffsetValue: PossiblyEvaluatedValue<number>;
    variableWidthValue: PossiblyEvaluatedValue<number>;
    lineFeature: BucketFeature;

    e1: number;
    e2: number;

    patternJoinNone: boolean;
    segmentStart: number;
    segmentStartf32: number;
    segmentPoints: Array<number>;

    index: number;
    zoom: number;
    overscaling: number;
    pixelRatio: number;
    layers: Array<LineStyleLayer>;
    layerIds: Array<string>;
    gradients: {
        [key: string]: GradientTexture;
    };
    stateDependentLayers: Array<any>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;
    lineClipsArray: Array<LineClips>;

    layoutVertexArray: LineLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    layoutVertexArray2: LineExtLayoutArray;
    layoutVertexBuffer2: VertexBuffer;
    patternVertexArray: LinePatternLayoutArray;
    patternVertexBuffer: VertexBuffer;

    zOffsetVertexArray: LineZOffsetExtArray;
    zOffsetVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    hasZOffset: boolean;
    tileToMeter: number;
    hasCrossSlope: boolean;
    programConfigurations: ProgramConfigurationSet<LineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    projection: ProjectionSpecification;
    currentVertex: Point4D | null | undefined;
    currentVertexIsOutside: boolean;
    tessellationStep: number;

    evaluationGlobals = {'zoom': 0, 'lineProgress': undefined};

    constructor(options: BucketParameters<LineStyleLayer>) {
        this.zoom = options.zoom;
        this.evaluationGlobals.zoom = this.zoom;
        this.overscaling = options.overscaling;
        this.pixelRatio = options.pixelRatio;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.projection = options.projection;
        this.hasPattern = false;
        this.hasZOffset = false;
        this.hasCrossSlope = false;
        this.patternFeatures = [];
        this.lineClipsArray = [];
        this.gradients = {};
        this.layers.forEach(layer => {
            // @ts-expect-error - TS2739 - Type '{}' is missing the following properties from type 'GradientTexture': texture, gradient, version
            this.gradients[layer.id] = {};
        });

        this.layoutVertexArray = new LineLayoutArray();
        this.layoutVertexArray2 = new LineExtLayoutArray();
        this.patternVertexArray = new LinePatternLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, {zoom: options.zoom, lut: options.lut});
        this.segments = new SegmentVector();
        this.maxLineLength = 0;
        this.zOffsetVertexArray = new LineZOffsetExtArray();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        // A vector tile is usually rendered over 128x128 terrain grid. Half of that frequency (step is EXTENT / 64)
        // should be enough since line elevation over terrain samples neighboring points.
        // options.tessellationStep override is used for testing only.
        this.tessellationStep = options.tessellationStep ? options.tessellationStep : (EXTENT / 64);
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        this.hasPattern = hasPattern('line', this.layers, this.pixelRatio, options);
        const lineSortKey = this.layers[0].layout.get('line-sort-key');

        this.tileToMeter = tileToMeter(canonical);

        const zOffset = this.layers[0].layout.get('line-z-offset');
        const zOffsetZero = zOffset.isConstant() && !zOffset.constantOr(0);
        const elevationReference = this.layers[0].layout.get('line-elevation-reference');
        const seaOrGroundReference = elevationReference === 'sea' || elevationReference === 'ground';
        // The bucket has z-offset if elevationReference is 'sea' or 'ground'
        // or when elevationReference is 'none' and z-offset property is non-zero.
        // We need to explicitly compare elevationReference agains 'none', because the property
        // can also have hd-road specific values which are unrelated to normal z-offset.
        this.hasZOffset = seaOrGroundReference || (!zOffsetZero && elevationReference === 'none');
        if (this.hasZOffset && elevationReference === 'none') {
            warnOnce(`line-elevation-reference: ground is used for the layer ${this.layerIds[0]} because non-zero line-z-offset value was found.`);
        }

        const crossSlope = this.layers[0].layout.get('line-cross-slope');
        this.hasCrossSlope = this.hasZOffset && crossSlope !== undefined;

        const bucketFeatures = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const sortKey = lineSortKey ?
                lineSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform),
                patterns: {},
                sortKey
            };

            bucketFeatures.push(bucketFeature);
        }

        if (lineSortKey) {
            bucketFeatures.sort((a, b) => {
                // a.sortKey is always a number when in use
                return (a.sortKey as number) - (b.sortKey as number);
            });
        }

        const {lineAtlas, featureIndex} = options;
        const hasFeatureDashes = this.addConstantDashes(lineAtlas);

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            if (hasFeatureDashes) {
                this.addFeatureDashes(bucketFeature, lineAtlas);
            }

            if (this.hasPattern) {
                const patternBucketFeature = addPatternDependencies('line', this.layers, bucketFeature, this.zoom, this.pixelRatio, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternBucketFeature);

            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, lineAtlas.positions, options.availableImages, options.brightness);
            }

            const feature = features[index].feature;
            featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    addConstantDashes(lineAtlas: LineAtlas): boolean {
        let hasFeatureDashes = false;

        for (const layer of this.layers) {

            const dashPropertyValue = layer.paint.get('line-dasharray').value;

            const capPropertyValue = layer.layout.get('line-cap').value;

            if (dashPropertyValue.kind !== 'constant' || capPropertyValue.kind !== 'constant') {
                hasFeatureDashes = true;

            } else {
                const constCap = capPropertyValue.value;
                const constDash = dashPropertyValue.value;
                if (!constDash) continue;
                lineAtlas.addDash(constDash, constCap);
            }
        }

        return hasFeatureDashes;
    }

    addFeatureDashes(feature: BucketFeature, lineAtlas: LineAtlas) {

        const zoom = this.zoom;

        for (const layer of this.layers) {

            const dashPropertyValue = layer.paint.get('line-dasharray').value;

            const capPropertyValue = layer.layout.get('line-cap').value;

            if (dashPropertyValue.kind === 'constant' && capPropertyValue.kind === 'constant') continue;

            let dashArray, cap;

            if (dashPropertyValue.kind === 'constant') {
                dashArray = dashPropertyValue.value;
                if (!dashArray) continue;

            } else {
                dashArray = dashPropertyValue.evaluate({zoom}, feature);
            }

            if (capPropertyValue.kind === 'constant') {
                cap = capPropertyValue.value;

            } else {
                cap = capPropertyValue.evaluate({zoom}, feature);
            }

            lineAtlas.addDash(dashArray, cap);

            // save positions for paint array
            feature.patterns[layer.id] = lineAtlas.getKey(dashArray, cap);
        }

    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: Array<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[], _: TileTransform, brightness?: number | null) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, availableImages, brightness);
        }
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            if (this.layoutVertexArray2.length !== 0) {
                this.layoutVertexBuffer2 = context.createVertexBuffer(this.layoutVertexArray2, layoutAttributesExt);
            }
            if (this.patternVertexArray.length !== 0) {
                this.patternVertexBuffer = context.createVertexBuffer(this.patternVertexArray, layoutAttributesPattern);
            }

            if (!this.zOffsetVertexBuffer && this.zOffsetVertexArray.length > 0) {
                this.zOffsetVertexBuffer = context.createVertexBuffer(this.zOffsetVertexArray, lineZOffsetAttributes.members, true);
            }

            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        if (this.zOffsetVertexBuffer) {
            this.zOffsetVertexBuffer.destroy();
        }
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    lineFeatureClips(feature: BucketFeature): LineClips | null | undefined {
        if (!!feature.properties && feature.properties.hasOwnProperty('mapbox_clip_start') && feature.properties.hasOwnProperty('mapbox_clip_end')) {
            const start = +feature.properties['mapbox_clip_start'];
            const end = +feature.properties['mapbox_clip_end'];
            return {start, end};
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[], brightness?: number | null) {
        const layout = this.layers[0].layout;

        const join = layout.get('line-join').evaluate(feature, {});

        const cap = layout.get('line-cap').evaluate(feature, {});
        const miterLimit = layout.get('line-miter-limit');
        const roundLimit = layout.get('line-round-limit');
        this.lineClips = this.lineFeatureClips(feature);
        this.lineFeature = feature;
        this.zOffsetValue = layout.get('line-z-offset').value;

        const paint = this.layers[0].paint;
        const lineWidth = paint.get('line-width').value;
        if (lineWidth.kind !== 'constant' && lineWidth.isLineProgressConstant === false) {
            this.variableWidthValue = lineWidth;
        }

        for (const line of geometry) {
            this.addLine(line, feature, canonical, join, cap, miterLimit, roundLimit);
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical, brightness);
    }

    addLine(vertices: Array<Point>, feature: BucketFeature, canonical: CanonicalTileID, join: string, cap: string, miterLimit: number, roundLimit: number) {
        this.distance = 0;
        this.prevDistance = 0;
        this.scaledDistance = 0;
        this.totalDistance = 0;
        this.totalFeatureLength = 0;
        this.lineSoFar = 0;
        this.currentVertex = undefined;

        const joinNone = join === 'none';
        this.patternJoinNone = this.hasPattern && joinNone;
        this.segmentStart = 0;
        this.segmentStartf32 = 0;
        this.segmentPoints = [];

        if (this.lineClips) {
            this.lineClipsArray.push(this.lineClips);
            // Calculate the total distance, in tile units, of this tiled line feature
            for (let i = 0; i < vertices.length - 1; i++) {
                this.totalDistance += vertices[i].dist(vertices[i + 1]);
            }
            const featureShare = this.lineClips.end - this.lineClips.start;
            this.totalFeatureLength = this.totalDistance / featureShare;
            this.updateScaledDistance();
            this.maxLineLength = Math.max(this.maxLineLength, this.totalDistance);
        }

        const isPolygon = vectorTileFeatureTypes[feature.type] === 'Polygon';

        // If the line has duplicate vertices at the ends, adjust start/length to remove them.
        let len = vertices.length;
        while (len >= 2 && vertices[len - 1].equals(vertices[len - 2])) {
            len--;
        }
        let first = 0;
        while (first < len - 1 && vertices[first].equals(vertices[first + 1])) {
            first++;
        }

        // Ignore invalid geometry.
        if (len < (isPolygon ? 3 : 2)) return;

        if (join === 'bevel') miterLimit = 1.05;

        // we could be more precise, but it would only save a negligible amount of space
        const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);

        let currentVertex;
        let prevVertex = (undefined as Point);
        let nextVertex = (undefined as Point);
        let prevNormal = (undefined as Point);
        let nextNormal = (undefined as Point);

        // the last two vertices added
        this.e1 = this.e2 = -1;

        if (isPolygon) {
            currentVertex = vertices[len - 2];
            nextNormal = vertices[first].sub(currentVertex)._unit()._perp();
        }

        let lineProgressFeatures: LineProgressFeatures | null;
        for (let i = first; i < len; i++) {
            nextVertex = i === len - 1 ?
                (isPolygon ? vertices[first + 1] : (undefined as any)) : // if it's a polygon, treat the last vertex like the first
                vertices[i + 1]; // just the next vertex

            // if two consecutive vertices exist, skip the current one
            if (nextVertex && vertices[i].equals(nextVertex)) continue;

            if (nextNormal) prevNormal = nextNormal;
            if (currentVertex) prevVertex = currentVertex;

            currentVertex = vertices[i];
            lineProgressFeatures = this.evaluateLineProgressFeatures(prevVertex ? prevVertex.dist(currentVertex) : 0);

            // Calculate the normal towards the next vertex in this line. In case
            // there is no next vertex, pretend that the line is continuing straight,
            // meaning that we are just using the previous normal.
            nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;

            // If we still don't have a previous normal, this is the beginning of a
            // non-closed line, so we're doing a straight "join".
            prevNormal = prevNormal || nextNormal;

            // The join if a middle vertex, otherwise the cap.
            const middleVertex = prevVertex && nextVertex;
            let currentJoin = middleVertex ? join : (isPolygon || joinNone) ? 'butt' : cap;

            // calculate cosines of the angle (and its half) using dot product
            const cosAngle = prevNormal.x * nextNormal.x + prevNormal.y * nextNormal.y;

            if (joinNone) {
                const endLineSegment = function (bucket: LineBucket) {
                    if (bucket.patternJoinNone) {
                        const pointCount = bucket.segmentPoints.length / 2;
                        const segmentLength = bucket.lineSoFar - bucket.segmentStart;
                        for (let idx = 0; idx < pointCount; ++idx) {
                            const pos = bucket.segmentPoints[idx * 2];
                            const offsetSign = bucket.segmentPoints[idx * 2 + 1];
                            // Integer part contains position in tile units
                            // Fractional part has offset sign 0.25 = -1, 0.5 = 0, 0.75 = 1
                            const posAndOffset = Math.round(pos) + 0.5 + offsetSign * 0.25;
                            bucket.patternVertexArray.emplaceBack(posAndOffset, segmentLength, bucket.segmentStart);
                            bucket.patternVertexArray.emplaceBack(posAndOffset, segmentLength, bucket.segmentStart);
                        }

                        // Reset line segment
                        bucket.segmentPoints.length = 0;
                        assert(bucket.zOffsetVertexArray.length === bucket.patternVertexArray.length || !bucket.hasZOffset);
                    }

                    bucket.e1 = bucket.e2 = -1;
                };

                if (middleVertex && cosAngle < COS_STRAIGHT_CORNER) { // Not straight corner, create separate line segment
                    this.updateDistance(prevVertex, currentVertex);
                    this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, lineProgressFeatures);
                    endLineSegment(this);

                    // Start new segment
                    this.addCurrentVertex(currentVertex, nextNormal, -1, -1, segment, lineProgressFeatures);

                    continue; // Don't apply other geometry generation logic
                } else if (prevVertex) {
                    if (!nextVertex) { // End line string
                        this.updateDistance(prevVertex, currentVertex);
                        this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, lineProgressFeatures);
                        endLineSegment(this);

                        continue; // Don't apply other geometry generation logic
                    } else {
                        currentJoin = 'miter';
                    }
                }
            }

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
            /*  joinNormal     prevNormal
             *             ↖      ↑
             *                .________. prevVertex
             *                |
             * nextNormal  ←  |  currentVertex
             *                |
             *     nextVertex !
             *
             */

            const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;

            // Calculate the length of the miter (the ratio of the miter to the width)
            // as the inverse of cosine of the angle between next and join normals
            const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;

            // approximate angle from cosine
            const approxAngle = 2 * Math.sqrt(2 - 2 * cosHalfAngle);

            const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;
            const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;
            // Fixed offset from the corners to straighted up edges (require for pattern, gradient and trim-offset)
            const SHARP_CORNER_OFFSET = 15;
            const sharpCornerOffset = this.overscaling <= 16 ? SHARP_CORNER_OFFSET * EXTENT / (512 * this.overscaling) : 0;

            if (middleVertex && currentJoin === 'round') {
                if (miterLength < roundLimit) {
                    currentJoin = 'miter';
                } else if (miterLength <= 2) {
                    const boundsMin = -10;
                    const boundsMax = EXTENT + 10;
                    const outside = pointOutsideBounds(currentVertex, boundsMin, boundsMax);
                    // Disable 'fakeround' for line-z-offset when either outside tile bounds or when using line-cross-slope.
                    // In these cases, using 'fakeround' either causes some rendering artifacts or doesn't look good.
                    currentJoin = (this.hasZOffset && (outside || this.hasCrossSlope)) ? 'miter' : 'fakeround';
                }
            }

            if (currentJoin === 'miter' && miterLength > miterLimit) {
                currentJoin = 'bevel';
            }

            if (currentJoin === 'bevel') {
                // The maximum extrude length is 128 / 63 = 2 times the width of the line
                // so if miterLength >= 2 we need to draw a different type of bevel here.
                if (miterLength > 2) currentJoin = 'flipbevel';

                // If the miterLength is really small and the line bevel wouldn't be visible,
                // just draw a miter join to save a triangle.
                if (miterLength < miterLimit) currentJoin = 'miter';
            }

            const sharpMiter = currentJoin === 'miter' && isSharpCorner;

            // Calculate how far along the line the currentVertex is
            if (prevVertex && !sharpMiter) this.updateDistance(prevVertex, currentVertex);

            if (currentJoin === 'miter') {
                if (isSharpCorner) {
                    const prevSegmentLength = currentVertex.dist(prevVertex);
                    if (prevSegmentLength > 2 * sharpCornerOffset) {
                        const newPrevVertex = currentVertex.sub(currentVertex.sub(prevVertex)._mult(sharpCornerOffset / prevSegmentLength)._round());
                        this.updateDistance(prevVertex, newPrevVertex);
                        this.addCurrentVertex(newPrevVertex, prevNormal, 0, 0, segment, lineProgressFeatures);
                        prevVertex = newPrevVertex;
                    }
                    this.updateDistance(prevVertex, currentVertex);
                    joinNormal._mult(miterLength);
                    this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment, lineProgressFeatures);
                    const nextSegmentLength = currentVertex.dist(nextVertex);
                    if (nextSegmentLength > 2 * sharpCornerOffset) {
                        const newCurrentVertex = currentVertex.add(nextVertex.sub(currentVertex)._mult(sharpCornerOffset / nextSegmentLength)._round());
                        this.updateDistance(currentVertex, newCurrentVertex);
                        this.addCurrentVertex(newCurrentVertex, nextNormal, 0, 0, segment, lineProgressFeatures);
                        currentVertex = newCurrentVertex;
                    }
                } else {
                    joinNormal._mult(miterLength);
                    this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment, lineProgressFeatures);
                }
            } else if (currentJoin === 'flipbevel') {
                // miter is too big, flip the direction to make a beveled join
                if (miterLength > 100) {
                    // Almost parallel lines
                    joinNormal = nextNormal.mult(-1);

                } else {
                    const bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                    joinNormal._perp()._mult(bevelLength * (lineTurnsLeft ? -1 : 1));
                }
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment, lineProgressFeatures);
                this.addCurrentVertex(currentVertex, joinNormal.mult(-1), 0, 0, segment, lineProgressFeatures);

            } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
                if (lineProgressFeatures != null && prevVertex) {
                    // Close previous segment with butt
                    this.addCurrentVertex(currentVertex, prevNormal, -1, -1, segment, lineProgressFeatures);
                }

                const dist = currentVertex.dist(prevVertex);
                const skipStraightEdges = dist <= 2 * sharpCornerOffset && currentJoin !== 'bevel';
                const join = joinNormal.mult(lineTurnsLeft ? 1.0 : -1.0);
                join._mult(miterLength);
                const next = nextNormal.mult(lineTurnsLeft ? -1.0 : 1.0);
                const prev = prevNormal.mult(lineTurnsLeft ? -1.0 : 1.0);
                const lpf = this.evaluateLineProgressFeatures(this.distance);

                if (lineProgressFeatures == null) {
                    // This vertex is placed at the inner side of the corner
                    this.addHalfVertex(currentVertex, join.x, join.y, false, !lineTurnsLeft, 0, segment, lpf);
                    if (!skipStraightEdges) {
                        // This vertex is responsible to straighten up the line before the corner
                        this.addHalfVertex(currentVertex, join.x + prev.x * 2.0, join.y + prev.y * 2.0, false, lineTurnsLeft, 0, segment, lpf);
                    }
                }

                if (currentJoin === 'fakeround') {
                    // The join angle is sharp enough that a round join would be visible.
                    // Bevel joins fill the gap between segments with a single pie slice triangle.
                    // Create a round join by adding multiple pie slices. The join isn't actually round, but
                    // it looks like it is at the sizes we render lines at.

                    // pick the number of triangles for approximating round join by based on the angle between normals
                    const n = Math.round((approxAngle * 180 / Math.PI) / DEG_PER_TRIANGLE);

                    this.addHalfVertex(currentVertex, prev.x, prev.y, false, lineTurnsLeft, 0, segment, lpf);
                    for (let m = 0; m < n; m++) {
                        let t = m / n;
                        if (t !== 0.5) {
                            // approximate spherical interpolation https://observablehq.com/@mourner/approximating-geometric-slerp
                            const t2 = t - 0.5;
                            const A = 1.0904 + cosAngle * (-3.2452 + cosAngle * (3.55645 - cosAngle * 1.43519));
                            const B = 0.848013 + cosAngle * (-1.06021 + cosAngle * 0.215638);
                            t = t + t * t2 * (t - 1) * (A * t2 * t2 + B);
                        }
                        const extrude = next.sub(prev)._mult(t)._add(prev)._unit();
                        this.addHalfVertex(currentVertex, extrude.x, extrude.y, false, lineTurnsLeft, 0, segment, lpf);
                    }
                    // These vertices are placed on the outer side of the line
                    this.addHalfVertex(currentVertex, next.x, next.y, false, lineTurnsLeft, 0, segment, lpf);
                }

                if (!skipStraightEdges && lineProgressFeatures == null) {
                    // This vertex is responsible to straighten up the line after the corner
                    this.addHalfVertex(currentVertex, join.x + next.x * 2.0, join.y + next.y * 2.0, false, lineTurnsLeft, 0, segment, lpf);
                }

                if (lineProgressFeatures != null && nextVertex) {
                    // Start next segment with a butt
                    this.addCurrentVertex(currentVertex, nextNormal, 1, 1, segment, lineProgressFeatures);
                }
            } else if (currentJoin === 'butt') {
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment, lineProgressFeatures); // butt cap

            } else if (currentJoin === 'square') {
                if (!prevVertex) {
                    this.addCurrentVertex(currentVertex, joinNormal, -1, -1, segment, lineProgressFeatures);
                }

                // make the cap it's own quad to avoid the cap affecting the line distance
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment, lineProgressFeatures);

                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, joinNormal, 1, 1, segment, lineProgressFeatures);
                }

            } else if (currentJoin === 'round') {

                if (prevVertex) {
                    // Close previous segment with butt
                    this.addCurrentVertex(currentVertex, prevNormal, 0, 0, segment, lineProgressFeatures);

                    // Add round cap or linejoin at end of segment
                    this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, lineProgressFeatures, true);
                }
                if (nextVertex) {
                    // Add round cap before first segment
                    this.addCurrentVertex(currentVertex, nextNormal, -1, -1, segment, lineProgressFeatures, true);

                    // Start next segment with a butt
                    this.addCurrentVertex(currentVertex, nextNormal, 0, 0, segment, lineProgressFeatures);
                }
            }
        }
    }

    addVerticesTo(from: Point4D, to: Point4D, leftX: number, leftY: number, rightX: number, rightY: number, endLeft: number, endRight: number, segment: Segment, round: boolean) {
        // one vector tile is usually rendered over 64x64 terrain grid. This should be enough for higher res grid, too.
        const STEP = this.tessellationStep;
        const steps = ((to.w - from.w) / STEP) | 0;
        let stepsDistance = 0;
        const scaledDistance = this.scaledDistance;

        if (steps > 1) {
            this.lineSoFar = from.w;
            const stepX = (to.x - from.x) / steps;
            const stepY = (to.y - from.y) / steps;
            const stepZ = (to.z - from.z) / steps;
            const stepW = (to.w - from.w) / steps;
            for (let i = 1; i < steps; ++i) {
                from.x += stepX;
                from.y += stepY;
                from.z += stepZ;
                this.lineSoFar += stepW;
                stepsDistance += stepW;
                const lpf = this.evaluateLineProgressFeatures(this.prevDistance + stepsDistance);
                this.scaledDistance = (this.prevDistance + stepsDistance) / this.totalDistance;
                this.addHalfVertex(from, leftX, leftY, round, false, endLeft, segment, lpf);
                this.addHalfVertex(from, rightX, rightY, round, true, -endRight, segment, lpf);
            }
        }
        this.lineSoFar = to.w;
        this.scaledDistance = scaledDistance;
        const lpf = this.evaluateLineProgressFeatures(this.distance);
        this.addHalfVertex(to, leftX, leftY, round, false, endLeft, segment, lpf);
        this.addHalfVertex(to, rightX, rightY, round, true, -endRight, segment, lpf);
    }

    evaluateLineProgressFeatures(distance: number): LineProgressFeatures | null {
        assert(distance >= 0);
        if (!this.variableWidthValue && !this.hasZOffset) {
            return null;
        }
        this.evaluationGlobals.lineProgress = 0;
        if (this.lineClips) {
            this.evaluationGlobals.lineProgress = Math.min(1.0, (this.totalFeatureLength * this.lineClips.start + distance) / this.totalFeatureLength);
        } else {
            warnOnce(`line-progress evaluation for ${this.layerIds[0]} requires enabling 'lineMetrics' for the source.`);
        }
        let variableWidth = 0.0;
        if (this.variableWidthValue && this.variableWidthValue.kind !== 'constant') {
            variableWidth = this.variableWidthValue.evaluate(this.evaluationGlobals, this.lineFeature) || 0.0;
        }
        if (!this.hasZOffset) {
            return {zOffset: 0.0, variableWidth};
        }
        if (this.zOffsetValue.kind === 'constant') {
            return {zOffset: this.zOffsetValue.value, variableWidth};
        }
        const zOffset = this.zOffsetValue.evaluate(this.evaluationGlobals, this.lineFeature) || 0.0;
        return {zOffset, variableWidth};
    }

    /**
     * Add two vertices to the buffers.
     *
     * @param p the line vertex to add buffer vertices for
     * @param normal vertex normal
     * @param endLeft extrude to shift the left vertex along the line
     * @param endRight extrude to shift the left vertex along the line
     * @param segment the segment object to add the vertex to
     * @param round whether this is a round cap
     * @private
     */
    addCurrentVertex(p: Point, normal: Point, endLeft: number, endRight: number, segment: Segment, lineProgressFeatures?: LineProgressFeatures | null, round: boolean = false) {
        // left and right extrude vectors, perpendicularly shifted by endLeft/endRight
        const leftX = normal.x + normal.y * endLeft;
        const leftY = normal.y - normal.x * endLeft;
        const rightX = -normal.x + normal.y * endRight;
        const rightY = -normal.y - normal.x * endRight;

        if (lineProgressFeatures != null) {
            const dropOutOfBounds = this.hasZOffset;
            const boundsMin = -10;
            const boundsMax = EXTENT + 10;
            const zOffset = lineProgressFeatures.zOffset;
            const vertex = new Point4D(p.x, p.y, zOffset, this.lineSoFar);
            // tesellated chunks outside tile borders are not added.
            const outside = dropOutOfBounds ? pointOutsideBounds(p, boundsMin, boundsMax) : false;
            const lineSoFar = this.lineSoFar;
            const distance = this.distance;

            if (!this.currentVertex) {
                if (!outside) { // add the first point
                    this.addHalfVertex(p, leftX, leftY, round, false, endLeft, segment, lineProgressFeatures);
                    this.addHalfVertex(p, rightX, rightY, round, true, -endRight, segment, lineProgressFeatures);
                }
            } else if (outside) {
                const prevOutside = this.currentVertexIsOutside;
                const prev = this.currentVertex;
                const next = new Point4D(p.x, p.y, zOffset, this.lineSoFar);
                clipLine(prev, next, boundsMin, boundsMax);

                if (!pointOutsideBounds(next, boundsMin, boundsMax)) { // otherwise, segment outside bounds
                    if (prevOutside) {
                        // add half vertex to start the segment
                        this.e1 = this.e2 = -1;
                        // Previously calculated distance is not correct after clipLine()
                        this.distance -= prev.dist(vertex);
                        this.lineSoFar = prev.w;
                        const lpf = this.evaluateLineProgressFeatures(prev.w - this.totalFeatureLength * (this.lineClips ? this.lineClips.start : 0));
                        this.addHalfVertex(prev, leftX, leftY, round, false, endLeft, segment, lpf);
                        this.addHalfVertex(prev, rightX, rightY, round, true, -endRight, segment, lpf);
                        this.prevDistance = this.distance;
                    }
                    this.distance = this.prevDistance + prev.dist(next);
                    this.scaledDistance = this.distance / this.totalDistance;
                    this.addVerticesTo(prev, next, leftX, leftY, rightX, rightY, endLeft, endRight, segment, round);
                    this.distance = distance;
                    this.scaledDistance = this.distance / this.totalDistance;
                }
            } else {
                // inside
                const prevOutside = this.currentVertexIsOutside;
                const prev = this.currentVertex;
                if (prevOutside) {
                    clipLine(prev, vertex, boundsMin, boundsMax);
                    assert(vertex.x === p.x && vertex.y === p.y);
                    // add half vertex to start the segment
                    this.e1 = this.e2 = -1;
                    // Previously calculated distance is not correct after clipLine()
                    this.distance -= prev.dist(vertex);
                    this.scaledDistance = this.distance / this.totalDistance;
                    this.lineSoFar = prev.w;
                    const lpf = this.evaluateLineProgressFeatures(prev.w - this.totalFeatureLength * (this.lineClips ? this.lineClips.start : 0));
                    this.addHalfVertex(prev, leftX, leftY, round, false, endLeft, segment, lpf);
                    this.addHalfVertex(prev, rightX, rightY, round, true, -endRight, segment, lpf);
                    this.prevDistance = this.distance;
                    this.distance = distance;
                    this.scaledDistance = this.distance / this.totalDistance;
                }
                this.addVerticesTo(prev, vertex, leftX, leftY, rightX, rightY, endLeft, endRight, segment, round);
            }
            this.currentVertex = vertex;
            this.currentVertexIsOutside = outside;
            this.lineSoFar = lineSoFar;
        } else {
            this.addHalfVertex(p, leftX, leftY, round, false, endLeft, segment, lineProgressFeatures);
            this.addHalfVertex(p, rightX, rightY, round, true, -endRight, segment, lineProgressFeatures);
        }
    }

    addHalfVertex({
        x,
        y,
    }: Point, extrudeX: number, extrudeY: number, round: boolean, up: boolean, dir: number, segment: Segment, lineProgressFeatures?: LineProgressFeatures | null) {
        if (this.patternJoinNone) {
            if (this.segmentPoints.length === 0) {
                this.segmentStart = this.lineSoFar;
                this.segmentStartf32 = Math.fround(this.lineSoFar);
            }

            if (!up) { // Only add one segment point for each line point
                // Real vertex data is inserted after each line segment is finished
                this.segmentPoints.push(this.lineSoFar - this.segmentStart, dir);
            }
        }

        this.layoutVertexArray.emplaceBack(
            // a_pos_normal
            // Encode round/up the least significant bits
            (x << 1) + (round ? 1 : 0),
            (y << 1) + (up ? 1 : 0),
            // a_data
            // add 128 to store a byte in an unsigned byte
            Math.round(EXTRUDE_SCALE * extrudeX) + 128,
            Math.round(EXTRUDE_SCALE * extrudeY) + 128,
            ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1),
            0, // unused
            // a_linesofar
            this.lineSoFar - this.segmentStartf32);

        // Constructs a second vertex buffer with higher precision line progress
        if (this.lineClips) {
            const lineProgress = interpolate(this.lineClips.start, this.lineClips.end, this.scaledDistance);
            this.layoutVertexArray2.emplaceBack(this.scaledDistance, this.lineClipsArray.length, lineProgress);
        }

        const e = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            this.indexArray.emplaceBack(this.e1, this.e2, e);
            segment.primitiveLength++;
        }
        if (up) {
            this.e2 = e;
        } else {
            this.e1 = e;
        }
        if (lineProgressFeatures != null) {
            this.zOffsetVertexArray.emplaceBack(
                lineProgressFeatures.zOffset,
                lineProgressFeatures.variableWidth,
                lineProgressFeatures.variableWidth
            );
        }
        assert(this.zOffsetVertexArray.length === this.layoutVertexArray.length || !this.hasZOffset);
    }

    updateScaledDistance() {
        // Knowing the ratio of the full linestring covered by this tiled feature, as well
        // as the total distance (in tile units) of this tiled feature, and the distance
        // (in tile units) of the current vertex, we can determine the relative distance
        // of this vertex along the full linestring feature.
        if (this.lineClips) {
            this.scaledDistance = this.distance / this.totalDistance;
            this.lineSoFar = this.totalFeatureLength * this.lineClips.start + this.distance;
        } else {
            this.lineSoFar = this.distance;
        }
    }

    updateDistance(prev: Point, next: Point) {
        this.prevDistance = this.distance;
        this.distance += prev.dist(next);
        this.updateScaledDistance();
    }
}

function pointOutsideBounds(p: Point, min: number, max: number) {
    return (p.x < min || p.x > max || p.y < min || p.y > max);
}

register(LineBucket, 'LineBucket', {omit: ['layers', 'patternFeatures', 'currentVertex', 'currentVertexIsOutside']});

export default LineBucket;
