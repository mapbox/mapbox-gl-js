// @flow

import {CircleLayoutArray} from '../array_types.js';

import {members as layoutAttributes} from './circle_attributes.js';
import SegmentVector from '../segment.js';
import {ProgramConfigurationSet} from '../program_configuration.js';
import {TriangleIndexArray} from '../index_array_type.js';
import loadGeometry from '../load_geometry.js';
import toEvaluationFeature from '../evaluation_feature.js';
import EXTENT from '../extent.js';
import {register} from '../../util/web_worker_transfer.js';
import EvaluationParameters from '../../style/evaluation_parameters.js';

import type {CanonicalTileID} from '../../source/tile_id.js';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket.js';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer.js';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer.js';
import type Context from '../../gl/context.js';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state.js';
import type {ImagePosition} from '../../render/image_atlas.js';
import type {TileTransform} from '../../geo/projection/tile_transform.js';

// This should be moved to a separate file
class ParticleSystem {
    emitters: Array<Emitter>;
    lastUpdate: any;
    zoomLevel: number;

    constructor() {
        this.emitters = [];
        this.lastUpdate = new Date().getTime();
        this.update();
        this.zoomLevel = 0;
        console.count("new system");
    }
    
    update() {
        let now = new Date().getTime();
        let sinceLastUpdateMillis = now - this.lastUpdate;
        if (sinceLastUpdateMillis < 10) {
            return;
        }
        this.lastUpdate = new Date().getTime();
        for (const emitter of this.emitters) {
            emitter.update();
        }
        //setTimeout(() => { this.update() }, 100);
    }

    addEmitter(feature: any, location: Point, zoom: number) {
        /*
        for (const emitter of this.emitters) {
            if (emitter.feature.geometry.x == feature.geometry.x && emitter.feature.geometry.y == feature.geometry.y) {
                emitter.location = location;
                emitter.zoom = zoom;
                console.log(feature.geometry);
                return;
            }
        }
        */
        this.emitters.push(new Emitter(feature, location, zoom));
    }

}

register('ParticleSystem', ParticleSystem);
class Emitter {
    particles: Array<Particle>;
    location: Point;
    feature: any;
    elevation: number;
    zoom: number;
    maxParticleCount: number;
    featureId: number;

    constructor(feature: any, location: Point, zoom: number, featureId: number) {
        this.feature = feature;
        this.particles = [];
        this.location = location;
        this.elevation = 1.0;
        this.zoom = zoom;
        this.maxParticleCount = 50;
        this.featureId = featureId;
    }
    
    update() {
        if (this.particles.length < this.maxParticleCount) {
            this.particles.push(new Particle());
        }
        for (const particle of this.particles) {
            particle.update();
        }
        this.particles = this.particles.filter(item => item.isAlive);
    }

}

register('Emitter', Emitter);
class Particle {
    isAlive: boolean;
    locationOffset: any;
    elevation: number;
    direction: any;
    velocity: number;
    opacity: number;
    scale: number;
    timeToLive: number;
    birthTime: number;
    color: any;

    constructor() {
        this.isAlive = true;
        // Distribute position in a circle
        const r = Math.sqrt(Math.random()) * 100.0;
        const theta = Math.random() * 2 * Math.PI;
        this.locationOffset = {
            x: r * Math.cos(theta),
            y: r * Math.sin(theta)
        };

        //var dir = Math.random();
        var dir = 0.5;
        this.direction = {x: dir, y: 1.0 - dir, z: 0.0 };

        let minVelocity = 1.0;
        let maxVelocity = 5.0;
        this.velocity = Math.random() * (maxVelocity - minVelocity) + minVelocity;
        this.velocity = 0;

        this.opacity = 1.0;
        this.scale = Math.random() * 1.0 + 0.5;
        this.timeToLive = -1; //Math.random() * 2000 + 5000;
        this.birthTime = new Date().getTime();
        
        const colorA = {r: 1.0, g: 1.0, b: 0.0};
        const colorB = {r: 0.2, g: 0.2, b: 1.0};
        const lerp = (a, b, t) => a * (1 - t) + b * t;
        const randomColorProg = Math.pow(Math.random(), 2.0);
        this.color = {
            r: lerp(colorA.r, colorB.r, randomColorProg),
            g: lerp(colorA.g, colorB.g, randomColorProg),
            b: lerp(colorA.b, colorB.b, randomColorProg)
        };

        //console.count("New particle");
    }
    
    update() {
        let now = new Date().getTime();
        let timeSinceBith = now - this.birthTime;
        let lifePosition = this.timeToLive > 0 ? timeSinceBith / this.timeToLive : 0.5;
        if (lifePosition >= 1.0) {
            this.isAlive = false;
        }

        if (lifePosition < 0.2) {
            this.opacity = (lifePosition / 0.2);
        } else if (lifePosition > 0.8) {
            this.opacity = (1.0 - lifePosition) / 0.2;
        } else {
            this.opacity = 1.0;
        }
        this.locationOffset.x += this.direction.x * this.velocity;
        this.locationOffset.y += this.direction.y * this.velocity;
    }

}

register('Particle', Particle);

function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
    layoutVertexArray.emplaceBack(
        (x * 2) + ((extrudeX + 1) / 2),
        (y * 2) + ((extrudeY + 1) / 2));
}

let globalSystem = new ParticleSystem();

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
class CircleBucket<Layer: CircleStyleLayer | HeatmapStyleLayer> implements Bucket {
    system: ParticleSystem;
    index: number;
    zoom: number;
    overscaling: number;
    layerIds: Array<string>;
    layers: Array<Layer>;
    stateDependentLayers: Array<Layer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: CircleLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<Layer>) {
        this.system = globalSystem;
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const styleLayer = this.layers[0];
        const bucketFeatures = [];
        let circleSortKey = null;

        // Heatmap layers are handled in this bucket and have no evaluated properties, so we check our access
        if (styleLayer.type === 'circle') {
            circleSortKey = ((styleLayer: any): CircleStyleLayer).layout.get('circle-sort-key');
        }

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const sortKey = circleSortKey ?
                circleSortKey.evaluate(evaluationFeature, {}, canonical) :
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

        if (circleSortKey) {
            bucketFeatures.sort((a, b) => {
                // a.sortKey is always a number when in use
                return ((a.sortKey: any): number) - ((b.sortKey: any): number);
            });
        }

        if (this.system.zoomLevel != canonical.z) {
            this.system.emitters = [];
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;
            const feature = features[index].feature;
            this.system.addEmitter(feature._feature, geometry[0][0], canonical.z);
            this.addFeature(bucketFeature, geometry, index, options.availableImages, canonical);
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: Array<string>, imagePositions: {[_: string]: ImagePosition}) {
        this.system.update();
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, availableImages, imagePositions);
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

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, availableImages: Array<string>, canonical: CanonicalTileID) {
        if (this.segments.segments.length > 0) {
            return;
        }
        const x = 0;
        const y = 0;

        // this geometry will be of the Point type, and we'll derive
        // two triangles from it.
        //
        // ┌─────────┐
        // │ 3     2 │
        // │         │
        // │ 0     1 │
        // └─────────┘

        const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray, feature.sortKey);
        const index2 = segment.vertexLength;

        addCircleVertex(this.layoutVertexArray, x, y, -1, -1);
        addCircleVertex(this.layoutVertexArray, x, y, 1, -1);
        addCircleVertex(this.layoutVertexArray, x, y, 1, 1);
        addCircleVertex(this.layoutVertexArray, x, y, -1, 1);

        this.indexArray.emplaceBack(index2, index2 + 1, index2 + 2);
        this.indexArray.emplaceBack(index2, index2 + 3, index2 + 2);

        segment.vertexLength += 4;
        segment.primitiveLength += 2;

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {}, availableImages, canonical);
    }
}

register('CircleBucket', CircleBucket, {omit: ['layers']});

export default CircleBucket;
