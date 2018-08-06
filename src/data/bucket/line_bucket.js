// @flow

import { LineLayoutArray } from '../array_types';

import { members as layoutAttributes } from './line_attributes';
import SegmentVector from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import loadGeometry from '../load_geometry';
import EXTENT from '../extent';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
import { register } from '../../util/web_worker_transfer';
import EvaluationParameters from '../../style/evaluation_parameters';
import Point from '@mapbox/point-geometry';

import type {
    Bucket,
    BucketParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type {Segment} from '../segment';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';

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

// The number of bits that is used to store the line distance in the buffer.
const LINE_DISTANCE_BUFFER_BITS = 15;

// We don't have enough bits for the line distance as we'd like to have, so
// use this value to scale the line distance (in tile units) down to a smaller
// value. This lets us store longer distances while sacrificing precision.
const LINE_DISTANCE_SCALE = 1 / 2;

// The maximum line distance, in tile units, that fits in the buffer.
const MAX_LINE_DISTANCE = Math.pow(2, LINE_DISTANCE_BUFFER_BITS - 1) / LINE_DISTANCE_SCALE;

function addLineVertex(layoutVertexBuffer,
                       point: Point,
                       extrudeX: number,
                       extrudeY: number,
                       round: boolean,
                       up: boolean,
                       dir: number,
                       linesofar: number) {
    layoutVertexBuffer.emplaceBack(
        // a_pos_normal
        point.x,
        point.y,
        round ? 1 : 0,
        up ? 1 : -1,
        // a_data
        // add 128 to store a byte in an unsigned byte
        Math.round(EXTRUDE_SCALE * extrudeX) + 128,
        Math.round(EXTRUDE_SCALE * extrudeY) + 128,
        // Encode the -1/0/1 direction value into the first two bits of .z of a_data.
        // Combine it with the lower 6 bits of `linesofar` (shifted by 2 bites to make
        // room for the direction value). The upper 8 bits of `linesofar` are placed in
        // the `w` component. `linesofar` is scaled down by `LINE_DISTANCE_SCALE` so that
        // we can store longer distances while sacrificing precision.
        ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | (((linesofar * LINE_DISTANCE_SCALE) & 0x3F) << 2),
        (linesofar * LINE_DISTANCE_SCALE) >> 6);
}


/**
 * @private
 */
class LineBucket implements Bucket {
    distance: number;
    tileDistance: number;
    clipStart: number;
    clipEnd: number;
    e1: number;
    e2: number;
    e3: number;

    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<LineStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<any>;

    layoutVertexArray: LineLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<LineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<LineStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;

        this.layoutVertexArray = new LineLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
        this.segments = new SegmentVector();
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        for (const {feature, index, sourceLayerIndex} of features) {
            if (this.layers[0]._featureFilter(new EvaluationParameters(this.zoom), feature)) {
                const geometry = loadGeometry(feature);
                this.addFeature(feature, geometry, index);
                options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
            }
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers);
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
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

    addFeature(feature: VectorTileFeature, geometry: Array<Array<Point>>, index: number) {
        const layout = this.layers[0].layout;
        const join = layout.get('line-join').evaluate(feature, {});
        const cap = layout.get('line-cap');
        const miterLimit = layout.get('line-miter-limit');
        const roundLimit = layout.get('line-round-limit');

        for (const line of geometry) {
            this.addLine(line, feature, join, cap, miterLimit, roundLimit, index);
        }
    }

    addLine(vertices: Array<Point>, feature: VectorTileFeature, join: string, cap: string, miterLimit: number, roundLimit: number, index: number) {
        const isPolygon = vectorTileFeatureTypes[feature.type] === 'Polygon';

        // If the line has duplicate vertices at the ends, adjust start/length to remove them.
        let len = vertices.length;
        while (len >= 2 && vertices[len - 1].x === vertices[len - 2].x && vertices[len - 1].y === vertices[len - 2].y) {
            len--;
        }
        let first = 0;
        while (first < len - 1 && vertices[first].x === vertices[first + 1].x && vertices[first].y === vertices[first + 1].y) {
            first++;
        }

        // Ignore invalid geometry.
        if (len < (isPolygon ? 3 : 2)) return;

        this.distance = 0;
        this.tileDistance = 0;

        if (feature.properties &&
            feature.properties['mapbox_clip_start'] !== undefined &&
            feature.properties['mapbox_clip_end'] !== undefined) {

            this.clipStart = +feature.properties['mapbox_clip_start'];
            this.clipEnd = +feature.properties['mapbox_clip_end'];

            // Calculate the total distance, in tile units, of this tiled line feature
            for (let i = first; i < len - 1; i++) {
                const dx = vertices[i + 1].x - vertices[i].x;
                const dy = vertices[i + 1].y - vertices[i].y;
                this.tileDistance += Math.sqrt(dx * dx + dy * dy);
            }
        }

        if (join === 'bevel') miterLimit = 1.05;

        const sharpCornerOffset = SHARP_CORNER_OFFSET * (EXTENT / (512 * this.overscaling));

        // we could be more precise, but it would only save a negligible amount of space
        const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);

        const beginCap = cap;
        const endCap = isPolygon ? 'butt' : cap;

        let startOfLine = true;
        let currentVertex;
        let prevVertex = ((undefined: any): Point);
        let nextVertex = ((undefined: any): Point);
        let prevNormalX = 0;
        let prevNormalY = 0;
        let nextNormalX = 0;
        let nextNormalY = 0;
        let offsetA;
        let offsetB;

        // the last three vertices added
        this.e1 = this.e2 = this.e3 = -1;

        if (isPolygon) {
            currentVertex = vertices[len - 2];
            const dx = vertices[first].x - currentVertex.x;
            const dy = vertices[first].y - currentVertex.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            nextNormalX = -dy / d;
            nextNormalY = dx / d;
        }

        for (let i = first; i < len; i++) {

            nextVertex = isPolygon && i === len - 1 ?
                vertices[first + 1] : // if the line is closed, we treat the last vertex like the first
                vertices[i + 1]; // just the next vertex

            // if two consecutive vertices exist, skip the current one
            if (nextVertex && vertices[i].x === nextVertex.x && vertices[i].y === nextVertex.y) continue;

            prevNormalX = nextNormalX;
            prevNormalY = nextNormalY;
            if (currentVertex) prevVertex = currentVertex;
            currentVertex = vertices[i];

            // Calculate the normal towards the next vertex in this line. In case
            // there is no next vertex, pretend that the line is continuing straight,
            // meaning that we are just using the previous normal.
            if (nextVertex) {
                const dx = nextVertex.x - currentVertex.x;
                const dy = nextVertex.y - currentVertex.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                nextNormalX = -dy / d;
                nextNormalY = dx / d;
            } else {
                nextNormalX = prevNormalX;
                nextNormalY = prevNormalY;
            }

            // If we still don't have a previous normal, this is the beginning of a
            // non-closed line, so we're doing a straight "join".
            if (prevNormalX === 0 && prevNormalY === 0) {
                prevNormalX = nextNormalX;
                prevNormalY = nextNormalY;
            }

            // Determine the normal of the join extrusion. It is the angle bisector
            // of the segments between the previous line and the next line.
            // In the case of 180° angles, the prev and next normals cancel each other out:
            // prevNormal + nextNormal = (0, 0), its magnitude is 0, so the unit vector would be
            // undefined. In that case, we're keeping the joinNormal at (0, 0), so that the cosHalfAngle
            // below will also become 0 and miterLength will become Infinity.
            let joinNormalX = prevNormalX + nextNormalX;
            let joinNormalY = prevNormalY + nextNormalY;
            if (joinNormalX !== 0 || joinNormalY !== 0) {
                const d = Math.sqrt(joinNormalX * joinNormalX + joinNormalY * joinNormalY);
                joinNormalX /= d;
                joinNormalY /= d;
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

            // Calculate the length of the miter (the ratio of the miter to the width).
            // Find the cosine of the angle between the next and join normals
            // using dot product. The inverse of that is the miter length.
            const cosHalfAngle = joinNormalX * nextNormalX + joinNormalY * nextNormalY;
            const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;

            const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;

            if (isSharpCorner && i > first) {
                const dx0 = currentVertex.x - prevVertex.x;
                const dy0 = currentVertex.y - prevVertex.y;
                const prevSegmentLength = Math.sqrt(dx0 * dx0 + dy0 * dy0);
                if (prevSegmentLength > 2 * sharpCornerOffset) {
                    const newPrevVertex = new Point(
                        currentVertex.x - Math.round(dx0 * sharpCornerOffset / prevSegmentLength),
                        currentVertex.y - Math.round(dy0 * sharpCornerOffset / prevSegmentLength)
                    );
                    const dx1 = newPrevVertex.x - prevVertex.x;
                    const dy1 = newPrevVertex.y - prevVertex.y;
                    this.distance += Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    this.addCurrentVertex(newPrevVertex, prevNormalX, prevNormalY, segment);
                    prevVertex = newPrevVertex;
                }
            }

            // The join if a middle vertex, otherwise the cap.
            const middleVertex = prevVertex && nextVertex;
            let currentJoin = middleVertex ? join : nextVertex ? beginCap : endCap;

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
            if (prevVertex) this.distance += currentVertex.dist(prevVertex);

            if (currentJoin === 'miter') {
                joinNormalX *= miterLength;
                joinNormalY *= miterLength;
                this.addCurrentVertex(currentVertex, joinNormalX, joinNormalY, segment);

            } else if (currentJoin === 'flipbevel') {
                // miter is too big, flip the direction to make a beveled join

                if (miterLength > 100) {
                    // Almost parallel lines
                    joinNormalX = -nextNormalX;
                    joinNormalY = -nextNormalY;

                } else {
                    const direction = prevNormalX * nextNormalY - prevNormalY * nextNormalX > 0 ? -1 : 1;
                    const dx0 = prevNormalX + nextNormalX;
                    const dy0 = prevNormalY + nextNormalY;
                    const dx1 = prevNormalX - nextNormalX;
                    const dy1 = prevNormalY - nextNormalY;
                    const mag0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
                    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    const bevelLength = miterLength * mag0 / mag1;

                    const x = joinNormalX * bevelLength * direction;
                    joinNormalX = -joinNormalY * bevelLength * direction;
                    joinNormalY = x;
                }
                this.addCurrentVertex(currentVertex, joinNormalX, joinNormalY, segment);
                this.addCurrentVertex(currentVertex, -joinNormalX, -joinNormalY, segment);

            } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
                const lineTurnsLeft = (prevNormalX * nextNormalY - prevNormalY * nextNormalX) > 0;
                const offset = -Math.sqrt(miterLength * miterLength - 1);
                if (lineTurnsLeft) {
                    offsetB = 0;
                    offsetA = offset;
                } else {
                    offsetA = 0;
                    offsetB = offset;
                }

                // Close previous segment with a bevel
                if (!startOfLine) {
                    this.addCurrentVertex(currentVertex, prevNormalX, prevNormalY, segment, offsetA, offsetB);
                }

                if (currentJoin === 'fakeround') {
                    // The join angle is sharp enough that a round join would be visible.
                    // Bevel joins fill the gap between segments with a single pie slice triangle.
                    // Create a round join by adding multiple pie slices. The join isn't actually round, but
                    // it looks like it is at the sizes we render lines at.

                    // Add more triangles for sharper angles.
                    // This math is just a good enough approximation. It isn't "correct".
                    const n = Math.floor((0.5 - (cosHalfAngle - 0.5)) * 8);

                    for (let m = 0; m < n; m++) {
                        const c = (m + 1) / (n + 1);
                        const x = nextNormalX * c + prevNormalX;
                        const y = nextNormalY * c + prevNormalY;
                        const d = Math.sqrt(x * x + y * y);
                        this.addPieSliceVertex(currentVertex, x / d, y / d, lineTurnsLeft, segment);
                    }

                    this.addPieSliceVertex(currentVertex, joinNormalX, joinNormalY, lineTurnsLeft, segment);

                    for (let m = n - 1; m >= 0; m--) {
                        const c = (m + 1) / (n + 1);
                        const x = prevNormalX * c + nextNormalX;
                        const y = prevNormalY * c + nextNormalY;
                        const d = Math.sqrt(x * x + y * y);
                        this.addPieSliceVertex(currentVertex, x / d, y / d, lineTurnsLeft, segment);
                    }
                }

                // Start next segment
                if (nextVertex) {
                    this.addCurrentVertex(currentVertex, nextNormalX, nextNormalY, segment, -offsetA, -offsetB);
                }

            } else if (currentJoin === 'butt') {
                if (!startOfLine) {
                    // Close previous segment with a butt
                    this.addCurrentVertex(currentVertex, prevNormalX, prevNormalY, segment);
                }

                // Start next segment with a butt
                if (nextVertex) {
                    this.addCurrentVertex(currentVertex, nextNormalX, nextNormalY, segment);
                }

            } else if (currentJoin === 'square') {

                if (!startOfLine) {
                    // Close previous segment with a square cap
                    this.addCurrentVertex(currentVertex, prevNormalX, prevNormalY, segment, 1, 1);

                    // The segment is done. Unset vertices to disconnect segments.
                    this.e1 = this.e2 = -1;
                }

                // Start next segment
                if (nextVertex) {
                    this.addCurrentVertex(currentVertex, nextNormalX, nextNormalY, segment, -1, -1);
                }

            } else if (currentJoin === 'round') {

                if (!startOfLine) {
                    // Close previous segment with butt
                    this.addCurrentVertex(currentVertex, prevNormalX, prevNormalY, segment);

                    // Add round cap or linejoin at end of segment
                    this.addCurrentVertex(currentVertex, prevNormalX, prevNormalY, segment, 1, 1, true);

                    // The segment is done. Unset vertices to disconnect segments.
                    this.e1 = this.e2 = -1;
                }


                // Start next segment with a butt
                if (nextVertex) {
                    // Add round cap before first segment
                    this.addCurrentVertex(currentVertex, nextNormalX, nextNormalY, segment, -1, -1, true);

                    this.addCurrentVertex(currentVertex, nextNormalX, nextNormalY, segment);
                }
            }

            if (isSharpCorner && i < len - 1) {
                const dx = nextVertex.x - currentVertex.x;
                const dy = nextVertex.y - currentVertex.y;
                const nextSegmentLength = Math.sqrt(dx * dx + dy * dy);
                if (nextSegmentLength > 2 * sharpCornerOffset) {
                    const newCurrentVertex = new Point(
                        currentVertex.x + Math.round(dx * sharpCornerOffset / nextSegmentLength),
                        currentVertex.y + Math.round(dy * sharpCornerOffset / nextSegmentLength)
                    );
                    const dx1 = newCurrentVertex.x - currentVertex.x;
                    const dy1 = newCurrentVertex.y - currentVertex.y;
                    this.distance += Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    this.addCurrentVertex(newCurrentVertex, nextNormalX, nextNormalY, segment);
                    currentVertex = newCurrentVertex;
                }
            }

            startOfLine = false;
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index);
    }

    /**
     * Add two vertices to the buffers.
     *
     * @param currentVertex the line vertex to add buffer vertices for
     * @param normalX x component of the vertex normal
     * @param normalY y component of the vertex normal
     * @param segment the segment object to add the vertex to
     * @param endLeft extrude to shift the left vertex along the line
     * @param endRight extrude to shift the left vertex along the line
     * @param round whether this is a round cap
     * @private
     */
    addCurrentVertex(currentVertex: Point,
                     normalX: number,
                     normalY: number,
                     segment: Segment,
                     endLeft: number = 0,
                     endRight: number = 0,
                     round: boolean = false) {
        const layoutVertexArray = this.layoutVertexArray;
        const indexArray = this.indexArray;

        const distance = this.tileDistance ?
            scaleDistance(this.distance, this.tileDistance, this.clipStart, this.clipEnd) :
            this.distance;

        let extrudeX = normalX;
        let extrudeY = normalY;
        if (endLeft) {
            extrudeX -= -normalY * endLeft;
            extrudeY -= normalX * endLeft;
        }
        addLineVertex(layoutVertexArray, currentVertex, extrudeX, extrudeY, round, false, endLeft, distance);
        this.e3 = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            indexArray.emplaceBack(this.e1, this.e2, this.e3);
            segment.primitiveLength++;
        }
        this.e1 = this.e2;
        this.e2 = this.e3;

        extrudeX = -normalX;
        extrudeY = -normalY;
        if (endRight) {
            extrudeX -= -normalY * endRight;
            extrudeY -= normalX * endRight;
        }
        addLineVertex(layoutVertexArray, currentVertex, extrudeX, extrudeY, round, true, -endRight, distance);
        this.e3 = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            indexArray.emplaceBack(this.e1, this.e2, this.e3);
            segment.primitiveLength++;
        }
        this.e1 = this.e2;
        this.e2 = this.e3;

        // There is a maximum "distance along the line" that we can store in the buffers.
        // When we get close to the distance, reset it to zero and add the vertex again with
        // a distance of zero. The max distance is determined by the number of bits we allocate
        // to `linesofar`.
        if (distance > MAX_LINE_DISTANCE / 2 && !this.tileDistance) {
            this.distance = 0;
            this.addCurrentVertex(currentVertex, normalX, normalY, segment, endLeft, endRight, round);
        }
    }

    /**
     * Add a single new vertex and a triangle using two previous vertices.
     * This adds a pie slice triangle near a join to simulate round joins
     *
     * @param currentVertex the line vertex to add buffer vertices for
     * @param extrudeX the x component of the offset of the new vertex from the currentVertex
     * @param extrudeY the y component of the offset of the new vertex from the currentVertex
     * @param lineTurnsLeft whether the line is turning left or right at this angle
     * @param segment the segment object to add the vertex to
     * @private
     */
    addPieSliceVertex(currentVertex: Point,
                      extrudeX: number,
                      extrudeY: number,
                      lineTurnsLeft: boolean,
                      segment: Segment) {

        if (lineTurnsLeft) {
            extrudeX *= -1;
            extrudeY *= -1;
        }
        const layoutVertexArray = this.layoutVertexArray;
        const indexArray = this.indexArray;

        const distance = this.tileDistance ?
            scaleDistance(this.distance, this.tileDistance, this.clipStart, this.clipEnd) :
            this.distance;

        addLineVertex(layoutVertexArray, currentVertex, extrudeX, extrudeY, false, lineTurnsLeft, 0, distance);
        this.e3 = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            indexArray.emplaceBack(this.e1, this.e2, this.e3);
            segment.primitiveLength++;
        }

        if (lineTurnsLeft) {
            this.e2 = this.e3;
        } else {
            this.e1 = this.e3;
        }
    }
}

/**
 * Knowing the ratio of the full linestring covered by this tiled feature, as well
 * as the total distance (in tile units) of this tiled feature, and the distance
 * (in tile units) of the current vertex, we can determine the relative distance
 * of this vertex along the full linestring feature and scale it to [0, 2^15)
 *
 * @param {number} distance the distance from the beginning of the tiled line to this vertex
 * @param {number} tileDistance the total distance, in tile units, of this tiled line feature
 * @param {number} clipStart the ratio (0-1) along a full original linestring feature of the start of this tiled line feature
 * @param {number} clipEnd the ratio (0-1) along a full original linestring feature of the end of this tiled line feature
 * @private
 */
function scaleDistance(distance: number, tileDistance: number, clipStart: number, clipEnd: number) {
    return ((distance / tileDistance) * (clipEnd - clipStart) + clipStart) * (MAX_LINE_DISTANCE - 1);
}

register('LineBucket', LineBucket, {omit: ['layers']});

export default LineBucket;
