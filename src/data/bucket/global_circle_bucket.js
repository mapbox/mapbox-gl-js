// @flow

import { CircleLayoutArray } from '../array_types';

import { members as layoutAttributes } from './circle_attributes';
import SegmentVector from '../segment';
import { ProgramConfigurationSet } from '../program_configuration';
import { TriangleIndexArray } from '../index_array_type';
import CircleBucket from './circle_bucket';

import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import GlobalVertexBuffer from '../../gl/global_vertex_buffer';

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
    layoutVertexBuffer: GlobalVertexBuffer;

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

    update() {
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

        this._tileLayoutVertexArrays[key] = {
            array: bucket.layoutVertexArray,
            uploaded: false
        };
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
        if (!this.layoutVertexBuffer) {
            // After initial creation, size management will be handled by the buffer itself
            let combinedLength = 0;
            for (const key in this._tileLayoutVertexArrays) {
                combinedLength += this._tileLayoutVertexArrays[key].array.length;
            }
            this.layoutVertexBuffer = new GlobalVertexBuffer(context, combinedLength, 8 /*TODO: read from attributes */, layoutAttributes);
            this.layoutVertexBuffer.key = this.zoom;
        }

        for (const key in this._tileLayoutVertexArrays) {
            if (!this._usedTileBuckets[key]) {
                this.uploaded = false;
                this.layoutVertexBuffer.removeSection(this._tileLayoutVertexArrays[key].index);
                delete this._tileLayoutVertexArrays[key];
                delete this._tileProgramConfigurations[key];
            }
        }
        for (const key in this._tileBuckets) {
            if (this._usedTileBuckets[key]) {
                const tileBucket = this._tileBuckets[key];
                if (!this._tileLayoutVertexArrays[key]) {
                    this.uploaded = false;
                    this._tileLayoutVertexArrays[key]= {
                        array: tileBucket.layoutVertexArray,
                        uploaded: false
                    };
                    this._tileLayoutVertexArrays[key].uploaded = false;
                }
                if (!this._tileProgramConfigurations[key]) {
                    this.uploaded = false;
                    this._tileProgramConfigurations[key] = tileBucket.programConfigurations;
                }
            }
        }
        if (!this.uploaded) {
            this.generateArrays();
            this.indexBuffer = context.createIndexBuffer(this.indexArray, true);
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

    generateArrays() {
        // TODO: Resetting all state, Copying and reuploading everything is the least efficient way to do this!
        if (this.programConfigurations) {
            this.programConfigurations.destroy();
        }
        if (this.segments) {
            this.segments.destroy();
        }
        if (this.indexBuffer) {
            this.indexBuffer.destroy();
        }

        this.segments = new SegmentVector();
        this.layoutVertexArray = new CircleLayoutArray();
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

        for (const key in this._tileLayoutVertexArrays) {
            const tileLayoutVertexArray = this._tileLayoutVertexArrays[key];
            if (!tileLayoutVertexArray.uploaded) {
                const newIndex =
                    this.layoutVertexBuffer.addSection(tileLayoutVertexArray.array, tileLayoutVertexArray.index);
                tileLayoutVertexArray.index = newIndex
                tileLayoutVertexArray.uploaded = true;
            }
        }

        // TODO:
        // (1) for each non-uploaded array, upload to global buffer
        // (2) in global buffer, keep track of segment size, automatically break
        //     indexing on going over segment limit
        // (3) At vertex upload time, iterate through array collecting
        //      - sort key (just crude y for now)
        //      - offset in array
        //      - index to global buffer section
        // (4) To create index buffers
        //      - sort
        //      - for each entry, lookup buffer index, then get segment index from offset

        // What to do if we go over the segment limit? Sorting doesn't work, but we can't
        // even fall back to data order.
        const indexPositions = this.layoutVertexBuffer.buildIndexPositions(this.segments);

        if (this.segments.segments.length === 1) {
            // Sorting only works if all circles fit inside a single segment.
            indexPositions.sort((a, b) => {
                return a.y - b.y;
            });
        }
        this.indexArray = new TriangleIndexArray();
        this.indexArray.reserve(indexPositions.length * 2);
        for (const indexPosition of indexPositions) {
            const index = indexPosition.index;
            this.indexArray.emplaceBack(index, index + 1, index + 2);
            this.indexArray.emplaceBack(index, index + 3, index + 2);
        }
    }
}

export default GlobalCircleBucket;
