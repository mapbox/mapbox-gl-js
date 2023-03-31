// @flow

import {LineLayoutArray, LineExtLayoutArray} from '../array_types.js';

import {members as layoutAttributes} from './line_attributes.js';
import {members as layoutAttributesExt} from './line_attributes_ext.js';
import SegmentVector from '../segment.js';
import {ProgramConfigurationSet} from '../program_configuration.js';
import {TriangleIndexArray} from '../index_array_type.js';
import EXTENT from '../extent.js';
import {VectorTileFeature} from '@mapbox/vector-tile';
const vectorTileFeatureTypes = VectorTileFeature.types;
import {register} from '../../util/web_worker_transfer.js';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features.js';
import loadGeometry from '../load_geometry.js';
import toEvaluationFeature from '../evaluation_feature.js';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {CanonicalTileID} from '../../source/tile_id.js';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket.js';
import type LineStyleLayer from '../../style/style_layer/line_style_layer.js';
import type Point from '@mapbox/point-geometry';
import type {Segment} from '../segment.js';
import type {RGBAImage, SpritePositions} from '../../util/image.js';
import type Context from '../../gl/context.js';
import type Texture from '../../render/texture.js';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type {FeatureStates} from '../../source/source_state.js';
import type LineAtlas from '../../render/line_atlas.js';
import type {TileTransform} from '../../geo/projection/tile_transform.js';
import type {IVectorTileLayer} from '@mapbox/vector-tile';

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
 *
 * The newly created vertices are placed SHARP_CORNER_OFFSET pixels from the corner.
 */
const COS_HALF_SHARP_CORNER = Math.cos(75 / 2 * (Math.PI / 180));
const SHARP_CORNER_OFFSET = 15;

// Angle per triangle for approximating round line joins.
const DEG_PER_TRIANGLE = 20;

type LineClips = {
    start: number;
    end: number;
}

type GradientTexture = {
    texture: Texture;
    gradient: ?RGBAImage;
    version: number;
}

/**
 * @private
 */
class LineBucket implements Bucket {
    distance: number;
    totalDistance: number;
    maxLineLength: number;
    scaledDistance: number;
    lineSoFar: number;
    lineClips: ?LineClips;

    e1: number;
    e2: number;

    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<LineStyleLayer>;
    layerIds: Array<string>;
    gradients: {[string]: GradientTexture};
    stateDependentLayers: Array<any>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;
    lineClipsArray: Array<LineClips>;

    layoutVertexArray: LineLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    layoutVertexArray2: LineExtLayoutArray;
    layoutVertexBuffer2: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<LineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    projection: ProjectionSpecification;

    constructor(options: BucketParameters<LineStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.projection = options.projection;
        this.hasPattern = false;
        this.patternFeatures = [];
        this.lineClipsArray = [];
        this.gradients = {};
        this.layers.forEach(layer => {
            this.gradients[layer.id] = {};
        });

        this.layoutVertexArray = new LineLayoutArray();
        this.layoutVertexArray2 = new LineExtLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.maxLineLength = 0;

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        this.hasPattern = hasPattern('line', this.layers, options);
        const lineSortKey = this.layers[0].layout.get('line-sort-key');
        const bucketFeatures = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            // $FlowFixMe[method-unbinding]
            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

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
                return ((a.sortKey: any): number) - ((b.sortKey: any): number);
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
                const patternBucketFeature = addPatternDependencies('line', this.layers, bucketFeature, this.zoom, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternBucketFeature);

            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, lineAtlas.positions, options.availableImages);
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

    update(states: FeatureStates, vtLayer: IVectorTileLayer, availableImages: Array<string>, imagePositions: SpritePositions) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, availableImages, imagePositions);
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: Array<string>, _: TileTransform) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, availableImages);
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
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    lineFeatureClips(feature: BucketFeature): ?LineClips {
        if (!!feature.properties && feature.properties.hasOwnProperty('mapbox_clip_start') && feature.properties.hasOwnProperty('mapbox_clip_end')) {
            const start = +feature.properties['mapbox_clip_start'];
            const end = +feature.properties['mapbox_clip_end'];
            return {start, end};
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: Array<string>) {
        const layout = this.layers[0].layout;
        const join = layout.get('line-join').evaluate(feature, {});
        const cap = layout.get('line-cap').evaluate(feature, {});
        const miterLimit = layout.get('line-miter-limit');
        const roundLimit = layout.get('line-round-limit');
        this.lineClips = this.lineFeatureClips(feature);

        for (const line of geometry) {
            this.addLine(line, feature, join, cap, miterLimit, roundLimit);
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical);
    }

    addLine(vertices: Array<Point>, feature: BucketFeature, join: string, cap: string, miterLimit: number, roundLimit: number) {
        this.distance = 0;
        this.scaledDistance = 0;
        this.totalDistance = 0;
        this.lineSoFar = 0;

        if (this.lineClips) {
            this.lineClipsArray.push(this.lineClips);
            // Calculate the total distance, in tile units, of this tiled line feature
            for (let i = 0; i < vertices.length - 1; i++) {
                this.totalDistance += vertices[i].dist(vertices[i + 1]);
            }
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

        const sharpCornerOffset = this.overscaling <= 16 ?
            SHARP_CORNER_OFFSET * EXTENT / (512 * this.overscaling) :
            0;

        // we could be more precise, but it would only save a negligible amount of space
        const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);

        let currentVertex;
        let prevVertex = ((undefined: any): Point);
        let nextVertex = ((undefined: any): Point);
        let prevNormal = ((undefined: any): Point);
        let nextNormal = ((undefined: any): Point);

        // the last two vertices added
        this.e1 = this.e2 = -1;

        if (isPolygon) {
            currentVertex = vertices[len - 2];
            nextNormal = vertices[first].sub(currentVertex)._unit()._perp();
        }

        for (let i = first; i < len; i++) {

            nextVertex = i === len - 1 ?
                (isPolygon ? vertices[first + 1] : (undefined: any)) : // if it's a polygon, treat the last vertex like the first
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
            /*  joinNormal     prevNormal
             *             ↖      ↑
             *                .________. prevVertex
             *                |
             * nextNormal  ←  |  currentVertex
             *                |
             *     nextVertex !
             *
             */

            // calculate cosines of the angle (and its half) using dot product
            const cosAngle = prevNormal.x * nextNormal.x + prevNormal.y * nextNormal.y;
            const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;

            // Calculate the length of the miter (the ratio of the miter to the width)
            // as the inverse of cosine of the angle between next and join normals
            const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;

            // approximate angle from cosine
            const approxAngle = 2 * Math.sqrt(2 - 2 * cosHalfAngle);

            const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;
            const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;

            if (isSharpCorner && i > first) {
                const prevSegmentLength = currentVertex.dist(prevVertex);
                if (prevSegmentLength > 2 * sharpCornerOffset) {
                    const newPrevVertex = currentVertex.sub(currentVertex.sub(prevVertex)._mult(sharpCornerOffset / prevSegmentLength)._round());
                    this.updateDistance(prevVertex, newPrevVertex);
                    this.addCurrentVertex(newPrevVertex, prevNormal, 0, 0, segment);
                    prevVertex = newPrevVertex;
                }
            }

            // The join if a middle vertex, otherwise the cap.
            const middleVertex = prevVertex && nextVertex;
            let currentJoin = middleVertex ? join : isPolygon ? 'butt' : cap;

            if (middleVertex && currentJoin === 'round') {
                if (miterLength < roundLimit) {
                    currentJoin = 'miter';
                } else if (miterLength <= 2) {
                    currentJoin = 'fakeround';
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

            // Calculate how far along the line the currentVertex is
            if (prevVertex) this.updateDistance(prevVertex, currentVertex);

            if (currentJoin === 'miter') {

                joinNormal._mult(miterLength);
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);

            } else if (currentJoin === 'flipbevel') {
                // miter is too big, flip the direction to make a beveled join

                if (miterLength > 100) {
                    // Almost parallel lines
                    joinNormal = nextNormal.mult(-1);

                } else {
                    const bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                    joinNormal._perp()._mult(bevelLength * (lineTurnsLeft ? -1 : 1));
                }
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);
                this.addCurrentVertex(currentVertex, joinNormal.mult(-1), 0, 0, segment);

            } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
                const offset = -Math.sqrt(miterLength * miterLength - 1);
                const offsetA = lineTurnsLeft ? offset : 0;
                const offsetB = lineTurnsLeft ? 0 : offset;

                // Close previous segment with a bevel
                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, prevNormal, offsetA, offsetB, segment);
                }

                if (currentJoin === 'fakeround') {
                    // The join angle is sharp enough that a round join would be visible.
                    // Bevel joins fill the gap between segments with a single pie slice triangle.
                    // Create a round join by adding multiple pie slices. The join isn't actually round, but
                    // it looks like it is at the sizes we render lines at.

                    // pick the number of triangles for approximating round join by based on the angle between normals
                    const n = Math.round((approxAngle * 180 / Math.PI) / DEG_PER_TRIANGLE);

                    for (let m = 1; m < n; m++) {
                        let t = m / n;
                        if (t !== 0.5) {
                            // approximate spherical interpolation https://observablehq.com/@mourner/approximating-geometric-slerp
                            const t2 = t - 0.5;
                            const A = 1.0904 + cosAngle * (-3.2452 + cosAngle * (3.55645 - cosAngle * 1.43519));
                            const B = 0.848013 + cosAngle * (-1.06021 + cosAngle * 0.215638);
                            t = t + t * t2 * (t - 1) * (A * t2 * t2 + B);
                        }
                        const extrude = nextNormal.sub(prevNormal)._mult(t)._add(prevNormal)._unit()._mult(lineTurnsLeft ? -1 : 1);
                        this.addHalfVertex(currentVertex, extrude.x, extrude.y, false, lineTurnsLeft, 0, segment);
                    }
                }

                if (nextVertex) {
                    // Start next segment
                    this.addCurrentVertex(currentVertex, nextNormal, -offsetA, -offsetB, segment);
                }

            } else if (currentJoin === 'butt') {
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment); // butt cap

            } else if (currentJoin === 'square') {
                const offset = prevVertex ? 1 : -1; // closing or starting square cap

                if (!prevVertex) {
                    this.addCurrentVertex(currentVertex, joinNormal, offset, offset, segment);
                }

                // make the cap it's own quad to avoid the cap affecting the line distance
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);

                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, joinNormal, offset, offset, segment);
                }

            } else if (currentJoin === 'round') {

                if (prevVertex) {
                    // Close previous segment with butt
                    this.addCurrentVertex(currentVertex, prevNormal, 0, 0, segment);

                    // Add round cap or linejoin at end of segment
                    this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, true);
                }
                if (nextVertex) {
                    // Add round cap before first segment
                    this.addCurrentVertex(currentVertex, nextNormal, -1, -1, segment, true);

                    // Start next segment with a butt
                    this.addCurrentVertex(currentVertex, nextNormal, 0, 0, segment);
                }
            }

            if (isSharpCorner && i < len - 1) {
                const nextSegmentLength = currentVertex.dist(nextVertex);
                if (nextSegmentLength > 2 * sharpCornerOffset) {
                    const newCurrentVertex = currentVertex.add(nextVertex.sub(currentVertex)._mult(sharpCornerOffset / nextSegmentLength)._round());
                    this.updateDistance(currentVertex, newCurrentVertex);
                    this.addCurrentVertex(newCurrentVertex, nextNormal, 0, 0, segment);
                    currentVertex = newCurrentVertex;
                }
            }
        }
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
    addCurrentVertex(p: Point, normal: Point, endLeft: number, endRight: number, segment: Segment, round: boolean = false) {
        // left and right extrude vectors, perpendicularly shifted by endLeft/endRight
        const leftX = normal.x + normal.y * endLeft;
        const leftY = normal.y - normal.x * endLeft;
        const rightX = -normal.x + normal.y * endRight;
        const rightY = -normal.y - normal.x * endRight;

        this.addHalfVertex(p, leftX, leftY, round, false, endLeft, segment);
        this.addHalfVertex(p, rightX, rightY, round, true, -endRight, segment);
    }

    addHalfVertex({x, y}: Point, extrudeX: number, extrudeY: number, round: boolean, up: boolean, dir: number, segment: Segment) {
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
            this.lineSoFar);

        // Constructs a second vertex buffer with higher precision line progress
        if (this.lineClips) {
            this.layoutVertexArray2.emplaceBack(this.scaledDistance, this.lineClipsArray.length, this.lineClips.start, this.lineClips.end);
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
    }

    updateScaledDistance() {
        // Knowing the ratio of the full linestring covered by this tiled feature, as well
        // as the total distance (in tile units) of this tiled feature, and the distance
        // (in tile units) of the current vertex, we can determine the relative distance
        // of this vertex along the full linestring feature.
        if (this.lineClips) {
            const featureShare = this.lineClips.end - this.lineClips.start;
            const totalFeatureLength = this.totalDistance / featureShare;
            this.scaledDistance = this.distance / this.totalDistance;
            this.lineSoFar = totalFeatureLength * this.lineClips.start + this.distance;
        } else {
            this.lineSoFar = this.distance;
        }
    }

    updateDistance(prev: Point, next: Point) {
        this.distance += prev.dist(next);
        this.updateScaledDistance();
    }
}

register(LineBucket, 'LineBucket', {omit: ['layers', 'patternFeatures']});

export default LineBucket;
