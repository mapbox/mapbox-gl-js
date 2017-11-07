// @flow

const util = require('../util/util');

import type CollisionBoxArray from '../symbol/collision_box';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type FeatureIndex from './feature_index';

export type BucketParameters = {
    index: number,
    layers: Array<StyleLayer>,
    zoom: number,
    pixelRatio: number,
    overscaling: number,
    collisionBoxArray: CollisionBoxArray
}

export type PopulateParameters = {
    featureIndex: FeatureIndex,
    iconDependencies: {},
    glyphDependencies: {}
}

export type SerializedBucket = {
    zoom: number,
    layerIds: Array<string>
}

export type IndexedFeature = {
    feature: VectorTileFeature,
    index: number,
    sourceLayerIndex: number,
}

/**
 * The `Bucket` interface is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract interface. An implementation exists for each style layer type.
 * Create a bucket via the `StyleLayer#createBucket` method.
 *
 * The concrete bucket types, using layout options from the style layer,
 * transform feature geometries into vertex and index data for use by the
 * vertex shader.  They also (via `ProgramConfiguration`) use feature
 * properties and the zoom level to populate the attributes needed for
 * data-driven styling.
 *
 * Buckets are designed to be built on a worker thread and then serialized and
 * transferred back to the main thread for rendering.  On the worker side, a
 * bucket's vertex, index, and attribute data is stored in `bucket.arrays:
 * ArrayGroup`.  When a bucket's data is serialized and sent back to the main
 * thread, is gets deserialized (using `new Bucket(serializedBucketData)`, with
 * the array data now stored in `bucket.buffers: BufferGroup`.  BufferGroups
 * hold the same data as ArrayGroups, but are tuned for consumption by WebGL.
 *
 * @private
 */
export interface Bucket {
    populate(features: Array<IndexedFeature>, options: PopulateParameters): void;
    isEmpty(): boolean;
    serialize(transferables?: Array<Transferable>): SerializedBucket;

    upload(gl: WebGLRenderingContext): void;
    uploaded: boolean;

    /**
     * Release the WebGL resources associated with the buffers. Note that because
     * buckets are shared between layers having the same layout properties, they
     * must be destroyed in groups (all buckets for a tile, or all symbol buckets).
     *
     * @private
     */
    destroy(): void;
}

module.exports = {
    deserialize(input: Array<SerializedBucket>, style: Style): {[string]: Bucket} {
        const output = {};

        // Guard against the case where the map's style has been set to null while
        // this bucket has been parsing.
        if (!style) return output;

        for (const serialized of input) {
            const layers = serialized.layerIds
                .map((id) => style.getLayer(id))
                .filter(Boolean);

            if (layers.length === 0) {
                continue;
            }

            const bucket = layers[0].createBucket(util.extend({layers}, serialized));
            for (const layer of layers) {
                output[layer.id] = bucket;
            }
        }

        return output;
    }
};
