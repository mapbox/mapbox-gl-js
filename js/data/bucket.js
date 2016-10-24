'use strict';

const ArrayGroup = require('./array_group');
const BufferGroup = require('./buffer_group');
const util = require('../util/util');

const FAKE_ZOOM_HISTORY = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };

/**
 * The `Bucket` class is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract class. A subclass exists for each style layer type.
 * Create a bucket via the `StyleLayer#createBucket` method.
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
    constructor (options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        if (options.arrays) {
            this.bufferGroups = util.mapObject(options.arrays, (arrayGroup, programName) => {
                return new BufferGroup(this.programInterfaces[programName], options.layers, options.zoom, arrayGroup);
            });
        }
    }

    populate(features, options) {
        this.createArrays();
        this.recalculateStyleLayers();

        for (const feature of features) {
            if (this.layers[0].filter(feature)) {
                this.addFeature(feature);
                options.featureIndex.insert(feature, this.index);
            }
        }
    }

    createArrays() {
        this.arrays = util.mapObject(this.programInterfaces, (programInterface) => {
            return new ArrayGroup(programInterface, this.layers, this.zoom);
        });
    }

    destroy() {
        for (const programName in this.bufferGroups) {
            this.bufferGroups[programName].destroy();
        }
    }

    isEmpty() {
        for (const programName in this.arrays) {
            if (!this.arrays[programName].isEmpty()) {
                return false;
            }
        }
        return true;
    }

    serialize(transferables) {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            arrays: util.mapObject(this.arrays, (a) => a.serialize(transferables))
        };
    }

    recalculateStyleLayers() {
        for (const layer of this.layers) {
            layer.recalculate(this.zoom, FAKE_ZOOM_HISTORY);
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

        output[layers[0].id] = layers[0].createBucket(util.extend({layers}, serialized));
    }
    return output;
};
