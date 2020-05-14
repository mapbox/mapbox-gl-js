// @flow

import {FillExtrusionLayoutArray, FillExtrusionCentroidArray} from '../array_types';

import {members as layoutAttributes, centroidAttributes} from './fill_extrusion_attributes';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import EXTENT from '../extent';
import earcut from 'earcut';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
import classifyRings from '../../util/classify_rings';
import assert from 'assert';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import loadGeometry from '../load_geometry';
import EvaluationParameters from '../../style/evaluation_parameters';
import Point from '@mapbox/point-geometry';

import type {CanonicalTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';

import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import {number as interpolate} from '../../style-spec/util/interpolate';

const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, nxRatio, nySign, normalUp, top, e) {
    vertexArray.emplaceBack(
        // a_pos_normal_ed:
        // Encode top and side/up normal using the least significant bits
        (x << 1) + top,
        (y << 1) + normalUp,
        // dxdy is signed, encode quadrant info using the least significant bit
        (Math.floor(nxRatio * FACTOR) << 1) + nySign,
        // edgedistance (used for wrapping patterns around extrusion sides)
        Math.round(e)
    );
}

class ClampedCentroid {
    acc: [number, number];
    clamp: [?number, ?number];
    minIntersection: [number, number];
    maxIntersection: [number, number];

    init(x: number, y: number) {
        this.acc = [x, y];
        this.clamp = [undefined, undefined];
        if (x < 0) {
            this.clamp[0] = 0;
        } else if (x > EXTENT) {
            this.clamp[0] = EXTENT;
        }
        if (y < 0) {
            this.clamp[1] = 0;
        } else if (y > EXTENT) {
            this.clamp[1] = EXTENT;
        }
        this.minIntersection = [2 * EXTENT, 2 * EXTENT];
        this.maxIntersection = [-2 * EXTENT, -2 * EXTENT];
    }

    _appendComponent(i: 0 | 1, p: Point, prev: Point) {
        const a = i === 0 ? 'x' : 'y';
        const b = i === 0 ? 'y' : 'x';
        const v = p[a];
        const w = p[b];
        if (this.clamp[i] === undefined) {
            this.acc[i] += v;
            if (v < 0) {
                this.clamp[i] = 0;
            } else if (v > EXTENT) {
                this.clamp[i] = EXTENT;
            }
        }
        let intersection;
        const prevv = prev[a];
        if (this.clamp[i] !== undefined && (prevv < 0) !== (v < 0)) {
            intersection = interpolate(prev[b], w, (0 - prevv) / (v - prevv));
        } else if (this.clamp[i] !== undefined && (prevv > EXTENT) !== (v > EXTENT)) {
            intersection = interpolate(prev[b], w, (EXTENT - prevv) / (v - prevv));
        }
        if (intersection) {
            const j: 0 | 1 = i === 0 ? 1 : 0;
            this.minIntersection[j] = Math.min(intersection, this.minIntersection[j]);
            this.maxIntersection[j] = Math.max(intersection, this.maxIntersection[j]);
        }
    }

    append(p: Point, prev: Point) {
        this._appendComponent(0, p, prev);
        this._appendComponent(1, p, prev);
    }

    _value(i: number, count: number): number {
        if (this.clamp[i] != null) { return this.clamp[i]; }
        const v = Math.floor(this.acc[i] / count);
        const j = 1 - i;
        if (this.clamp[j] !== undefined) {
            assert(this.minIntersection[i] < 2 * EXTENT);
            assert(this.maxIntersection[i] > -2 * EXTENT);
            return (this.minIntersection[i] + this.maxIntersection[i]) / 2;
        }
        return v;
    }

    x(count: number): number {
        return this._value(0, count);
    }

    y(count: number): number {
        return this._value(1, count);
    }
}

class FillExtrusionBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillExtrusionStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    centroidVertexArray: FillExtrusionCentroidArray;
    centroidVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    constructor(options: BucketParameters<FillExtrusionStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new FillExtrusionCentroidArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);

    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.features = [];
        this.hasPattern = hasPattern('fill-extrusion', this.layers, options);

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = {type: feature.type,
                id,
                properties: feature.properties,
                geometry: needGeometry ? loadGeometry(feature) : []};

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const patternFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };

            if (typeof feature.id !== 'undefined') {
                patternFeature.id = feature.id;
            }

            if (this.hasPattern) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, patternFeature, this.zoom, options));
            } else {
                this.addFeature(patternFeature, patternFeature.geometry, index, canonical, {});
            }

            options.featureIndex.insert(feature, patternFeature.geometry, index, sourceLayerIndex, this.index, true);
        }
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
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
            this.centroidVertexBuffer = context.createVertexBuffer(this.centroidVertexArray, centroidAttributes.members);
            assert(this.centroidVertexArray.length === this.layoutVertexArray.length);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.centroidVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        const appendRepeatedCentroids = (count, x, y, x1, y1) => {
            for (let i = 0; i < count; i++) {
                this.centroidVertexArray.emplaceBack(x, y);
                if (x1 != null && y1 != null) this.centroidVertexArray.emplaceBack(x1, y1);
            }
        };
        const flatRoof = feature.properties && feature.properties.hasOwnProperty('type') && feature.properties.hasOwnProperty('height') &&
            vectorTileFeatureTypes[feature.type] === 'Polygon';
        const centroid = new ClampedCentroid();

        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);

            const ringInfo = {};
            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                if (ring.length === 0) {
                    continue;
                }

                if (isEntirelyOutside(ring)) {
                    ringInfo[i] = null;
                    continue;
                }
                numVertices += ring.length;

                let edgeDistance = 0;
                if (flatRoof) centroid.init(ring[0].x, ring[0].y);
                let ringEdges = 0;

                for (let p = 0; p < ring.length; p++) {
                    const p1 = ring[p];

                    if (p >= 1) {
                        const p2 = ring[p - 1];
                        if (flatRoof) centroid.append(p1, p2);

                        if (!isBoundaryEdge(p1, p2)) {
                            if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                                segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                            }

                            const d = p1.sub(p2)._perp();
                            // Given that nz === 0, encode nx / (abs(nx) + abs(ny)) and signs.
                            // This information is sufficient to reconstruct normal vector in vertex shader.
                            const nxRatio = d.x / (Math.abs(d.x) + Math.abs(d.y));
                            const nySign = d.y > 0 ? 1 : 0;
                            const dist = p2.dist(p1);
                            if (edgeDistance + dist > 32768) edgeDistance = 0;

                            addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 1, edgeDistance);

                            edgeDistance += dist;

                            addVertex(this.layoutVertexArray, p2.x, p2.y, nxRatio, nySign, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p2.x, p2.y, nxRatio, nySign, 0, 1, edgeDistance);

                            const bottomRight = segment.vertexLength;

                            // ┌──────┐
                            // │ 0  1 │ Counter-clockwise winding order.
                            // │      │ Triangle 1: 0 => 2 => 1
                            // │ 2  3 │ Triangle 2: 1 => 2 => 3
                            // └──────┘
                            this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
                            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                            segment.vertexLength += 4;
                            segment.primitiveLength += 2;
                            ringEdges++;
                        }
                    }
                }
                if (ringEdges > 0) {
                    // Out of bounds -32768 means "no centroid" sampling, used when there is no flat roof and also for base
                    // level elevation sampling. On lower level (base), don't sample centroid but the vertex elevation.
                    const x = flatRoof ? centroid.x(ring.length) : -32768;
                    const y = flatRoof ? centroid.y(ring.length) : -32768;
                    appendRepeatedCentroids(ringEdges * 2, -32768, -32768, x, y);
                    if (flatRoof) ringInfo[i] = {x, y};
                }
            }

            if (segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            }

            //Only triangulate and draw the area of the feature if it is a polygon
            //Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
            if (vectorTileFeatureTypes[feature.type] !== 'Polygon')
                continue;

            const flattened = [];
            const holeIndices = [];
            const triangleIndex = segment.vertexLength;

            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                if (ring.length === 0) {
                    continue;
                }

                if (ringInfo.hasOwnProperty(i) && ringInfo[i] === null)
                    continue; // isEntirelyOutside

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                for (let i = 0; i < ring.length; i++) {
                    const p = ring[i];

                    addVertex(this.layoutVertexArray, p.x, p.y, 0, 0, 1, 1, 0);

                    flattened.push(p.x);
                    flattened.push(p.y);
                }

                const x = ringInfo.hasOwnProperty(i) ? ringInfo[i].x : -32768;
                const y = ringInfo.hasOwnProperty(i) ? ringInfo[i].y : -32768;
                appendRepeatedCentroids(ring.length, x, y);
            }

            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let j = 0; j < indices.length; j += 3) {
                // Counter-clockwise winding order.
                this.indexArray.emplaceBack(
                    triangleIndex + indices[j],
                    triangleIndex + indices[j + 2],
                    triangleIndex + indices[j + 1]);
            }

            segment.primitiveLength += indices.length / 3;
            segment.vertexLength += numVertices;
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
    }
}

register('FillExtrusionBucket', FillExtrusionBucket, {omit: ['layers', 'features']});

export default FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}

function isEntirelyOutside(ring) {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}
