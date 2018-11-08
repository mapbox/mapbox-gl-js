// @flow

import { CircleLayoutArray } from '../array_types';

import { members as layoutAttributes } from './circle_attributes';
import SegmentVector from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import EXTENT from '../extent';
import CircleBucket from './circle_bucket';

import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';

/**
 * See CircleBucket for per-tile implementation
 * GlobalCircleBucket is different from other buckets in that it is dynamically
 * generated on the foreground out of a set of individual CircleBuckets
 *
 * @private
 */
class GlobalCircleBucket {
    layerIds: Array<string>;
    layers: Array<CircleStyleLayer>;
    stateDependentLayers: Array<CircleStyleLayer>;

    layoutVertexArray: CircleLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<CircleStyleLayer>;

    segments: SegmentVector;
    uploaded: boolean

    zoom: number;

    _tileBuckets: {[string]: CircleBucket};
    _tileLayoutVertexArrays: {[string]: CircleLayoutArray};
    _tileProgramConfigurations: {[string]: ProgramConfigurationSet<CircleStyleLayer>};
    _usedTileBuckets: {[string]: boolean};

    constructor(options: any) {
        this.layerIds = options.layerIds;
        this.layers = options.layers;
        this.zoom = options.zoom;

        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);

        this._tileBuckets = {};
        this._tileLayoutVertexArrays = {};
        this._tileProgramConfigurations = {};
        this._usedTileBuckets = {};
    }

    update(states: ?FeatureStates, vtLayer: ?VectorTileLayer) {
        // TODO: Actually hook up all the plumbing to update in place
        // For now, count on the per-tile buckets re-generating, and just copy everything over
        // again.
        this.uploaded = false;
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    addTileBucket(bucket: CircleBucket) {
        const key = bucket.tileID.toString();
        // TODO: This breaks in the case runtime styling changes cause
        // buckets within a single layer to have divergent properties
        this.layers = bucket.layers;
        this.layerIds = bucket.layerIds;
        this.stateDependentLayers = bucket.stateDependentLayers;

        this.uploaded = false;

        this._tileLayoutVertexArrays[key] = bucket.layoutVertexArray;
        this._tileProgramConfigurations[key] = bucket.programConfigurations;

        this._tileBuckets[key] = bucket;
    }

    // The set of loaded buckets in the source cache can change indpendently
    // of which tiles are actually renderable. For the purposes of the global
    // circle bucket, we care about which tiles are actually rendering.
    // The approach here is to hold onto the source tile buckets and dynamically
    // include or exclude them from the global bucket based on what's being rendered
    // This allows us to sidestep tracking the wrap value for the buckets that
    // have been added (which gets pretty complicated because of the "wrap jump"
    // behavior). On the other hand, we can't throw away data when a tile bucket is
    // removed from the source cache because we don't have a way to track if
    // the same bucket is "used" by another wrap value.
    // TODO: The only way tile buckets actually get removed from memory is if
    // the entire global bucket for their zoom level is garbage collected.
    markUsed(bucket: CircleBucket) {
        const key = bucket.tileID.toString();
        this._usedTileBuckets[key] = true;
    }

    upload(context: Context) {
        for (const key in this._tileLayoutVertexArrays) {
            if (!this._usedTileBuckets[key]) {
                this.uploaded = false;
                delete this._tileLayoutVertexArrays[key];
                delete this._tileProgramConfigurations[key];
            }
        }
        for (const key in this._tileBuckets) {
            if (this._usedTileBuckets[key]) {
                const tileBucket = this._tileBuckets[key];
                if (!this._tileLayoutVertexArrays[key]) {
                    this.uploaded = false;
                    this._tileLayoutVertexArrays[key] = tileBucket.layoutVertexArray;
                }
                if (!this._tileProgramConfigurations[key]) {
                    this.uploaded = false;
                    this._tileProgramConfigurations[key] = tileBucket.programConfigurations;
                }
            }
        }
        if (!this.uploaded) {
            this.generateArrays();
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
        this._usedTileBuckets = {};
    }

    tileCount() {
        return Object.keys(this._tileLayoutVertexArrays).length;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    copyLayoutVertex(tileLayoutVertexArray: CircleLayoutArray, i: number) {
        this.layoutVertexArray.emplaceBack(
            tileLayoutVertexArray.uint16[i],
            tileLayoutVertexArray.uint16[i + 1],
            tileLayoutVertexArray.uint16[i + 2],
            tileLayoutVertexArray.uint16[i + 3]
        );
    }

    generateArrays() {
        // TODO: Resetting all state, Copying and reuploading everything is the least efficient way to do this!
        if (this.programConfigurations) {
            this.programConfigurations.destroy();
        }
        if (this.segments) {
            this.segments.destroy();
        }
        if (this.layoutVertexBuffer) {
            this.layoutVertexBuffer.destroy();
        }
        if (this.indexBuffer) {
            this.indexBuffer.destroy();
        }

        this.segments = new SegmentVector();
        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, this.layers, this.zoom);

        for (const layerId of this.layerIds) {
            const circles = this.programConfigurations.programConfigurations[layerId];
            for (const property in circles.binders) {
                const binder = (circles.binders[property]: any);
                if (!binder.paintVertexArray) continue;
                for (const key in this._tileProgramConfigurations) {
                    binder.paintVertexArray._trim();
                    const tileProgramConfiguration = this._tileProgramConfigurations[key];
                    const tileBinder = (tileProgramConfiguration.programConfigurations[layerId].binders[property]: any);
                    binder.maxValue = Math.max(binder.maxValue, tileBinder.maxValue);
                    const tilePaintVertexArray = tileBinder.paintVertexArray;
                    const baseIndex = binder.paintVertexArray.length;
                    const baseIndexUint8 = binder.paintVertexArray.uint8.length;
                    binder.paintVertexArray.resize(baseIndex + tilePaintVertexArray.length);
                    binder.paintVertexArray._trim();
                    for (let i = 0; i < tilePaintVertexArray.uint8.length; i++) {
                        binder.paintVertexArray.uint8[baseIndexUint8 + i] = tilePaintVertexArray.uint8[i];
                    }
                }
            }
        }
        this.programConfigurations.needsUpload = true;

        let combinedLength = 0;
        for (const key in this._tileLayoutVertexArrays) {
            combinedLength += this._tileLayoutVertexArrays[key].length;
        }
        this.layoutVertexArray.reserve(combinedLength);

        const indexPositions = [];
        for (const key in this._tileLayoutVertexArrays) {
            const tileLayoutVertexArray = this._tileLayoutVertexArrays[key];
            for (let i = 0; i < tileLayoutVertexArray.length * 4; i += 16) {
                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                const index = segment.vertexLength;

                this.copyLayoutVertex(tileLayoutVertexArray, i);
                this.copyLayoutVertex(tileLayoutVertexArray, i + 4);
                this.copyLayoutVertex(tileLayoutVertexArray, i + 8);
                this.copyLayoutVertex(tileLayoutVertexArray, i + 12);

                // TODO: this is a poor-man's low precision, no rotation y-sort
                const y = tileLayoutVertexArray.uint16[i + 1];

                indexPositions.push({ y, index });

                segment.vertexLength += 4;
                segment.primitiveLength += 2; // Is it OK that we add these later?
            }
        }
        if (indexPositions.length * 4 < SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            // Sorting only works if all circles fit inside a single segment.
            indexPositions.sort((a, b) => {
                return a.y - b.y;
            });
        }
        for (const indexPosition of indexPositions) {
            const index = indexPosition.index;
            this.indexArray.emplaceBack(index, index + 1, index + 2);
            this.indexArray.emplaceBack(index, index + 3, index + 2);
        }
        this.indexArray._trim();
        this.layoutVertexArray._trim();
    }
}

export default GlobalCircleBucket;
