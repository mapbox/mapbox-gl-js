'use strict';

const ArrayGroup = require('./array_group');
const BufferGroup = require('./buffer_group');
const util = require('../util/util');

/**
 * The `Bucket` class is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract class. A subclass exists for each style layer type.
 * Create a bucket via the `StyleLayer#createBucket` method.
 *
 * The concrete bucket types, using layout options from the style layer,
 * transform feature geometries into vertex and element data for use by the
 * vertex shader.  They also (via `ProgramConfiguration`) use feature
 * properties and the zoom level to populate the attributes needed for
 * data-driven styling.
 *
 * Buckets are designed to be built on a worker thread and then serialized and
 * transferred back to the main thread for rendering.  On the worker side, a
 * bucket's vertex, element, and attribute data is stored in `bucket.arrays:
 * ArrayGroup`.  When a bucket's data is serialized and sent back to the main
 * thread, is gets deserialized (using `new Bucket(serializedBucketData)`, with
 * the array data now stored in `bucket.buffers: BufferGroup`.  BufferGroups
 * hold the same data as ArrayGroups, but are tuned for consumption by WebGL.
 *
 * @private
 */
class Bucket {
    /**
     * @param options
     * @param {number} options.zoom Zoom level of the buffers being built. May be
     *     a fractional zoom level.
     * @param options.layer A Mapbox style layer object
     * @param {Object.<string, Buffer>} options.buffers The set of `Buffer`s being
     *     built for this tile. This object facilitates sharing of `Buffer`s be
           between `Bucket`s.
     */
    constructor (options, programInterface) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        if (options.arrays) {
            this.buffers = new BufferGroup(programInterface, options.layers, options.zoom, options.arrays);
        } else {
            this.arrays = new ArrayGroup(programInterface, options.layers, options.zoom);
        }
    }

    populate(features, options) {
        for (const feature of features) {
            if (this.layers[0].filter(feature)) {
                this.addFeature(feature);
                options.featureIndex.insert(feature, this.index);
            }
        }
    }

    getPaintPropertyStatistics() {
        return util.mapObject(this.arrays.layerData, data => data.paintPropertyStatistics);
    }

    isEmpty() {
        return this.arrays.isEmpty();
    }

    serialize(transferables) {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            arrays: this.arrays.serialize(transferables)
        };
    }

    /**
     * Release the WebGL resources associated with the buffers. Note that because
     * buckets are shared between layers having the same layout properties, they
     * must be destroyed in groups (all buckets for a tile, or all symbol buckets).
     *
     * @private
     */
    destroy() {
        if (this.buffers) {
            this.buffers.destroy();
            this.buffers = null;
        }
    }
}

module.exports = Bucket;

Bucket.deserialize = function(input, style) {
    // Guard against the case where the map's style has been set to null while
    // this bucket has been parsing.
    if (!style) return;

    const output = {};

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
};
