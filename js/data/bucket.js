'use strict';

const ArrayGroup = require('./array_group');
const BufferGroup = require('./buffer_group');
const ProgramConfiguration = require('./program_configuration');
const util = require('../util/util');

const FAKE_ZOOM_HISTORY = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };

/**
 * The `Bucket` class is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract class. A subclass exists for each Mapbox GL
 * style spec layer type. Because `Bucket` is an abstract class,
 * instances should be created via the `Bucket.create` method.
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
        this.layer = options.layer;
        this.childLayers = options.childLayers;

        this.index = options.index;
        this.featureIndex = options.featureIndex;
        this.programConfigurations = util.mapObject(this.programInterfaces, (programInterface) => {
            const result = {};
            for (const layer of options.childLayers) {
                result[layer.id] = ProgramConfiguration.createDynamic(programInterface.paintAttributes || [], layer, options);
            }
            return result;
        });

        if (options.arrays) {
            this.bufferGroups = util.mapObject(options.arrays, (programArrayGroups, programName) => {
                const programInterface = this.programInterfaces[programName];
                const paintVertexArrayTypes = options.paintVertexArrayTypes[programName];
                return programArrayGroups.map((arrayGroup) => {
                    return new BufferGroup(arrayGroup, {
                        layoutVertexArrayType: programInterface.layoutVertexArrayType.serialize(),
                        elementArrayType: programInterface.elementArrayType && programInterface.elementArrayType.serialize(),
                        elementArrayType2: programInterface.elementArrayType2 && programInterface.elementArrayType2.serialize(),
                        paintVertexArrayTypes: paintVertexArrayTypes
                    });
                });
            });
        }
    }

    populate(features) {
        this.createArrays();
        this.recalculateStyleLayers();

        for (const feature of features) {
            if (this.layer.filter(feature)) {
                this.addFeature(feature);
                this.featureIndex.insert(feature, this.index);
            }
        }

        this.trimArrays();
    }

    /**
     * Check if there is enough space available in the current array group for
     * `vertexLength` vertices. If not, append a new array group. Should be called
     * by `populateArrays` and its callees.
     *
     * Array groups are added to this.arrayGroups[programName].
     *
     * @param {string} programName the name of the program associated with the buffer that will receive the vertices
     * @param {number} vertexLength The number of vertices that will be inserted to the buffer.
     * @returns The current array group
     */
    prepareArrayGroup(programName, numVertices) {
        const groups = this.arrayGroups[programName];
        let currentGroup = groups.length && groups[groups.length - 1];

        if (!currentGroup || !currentGroup.hasCapacityFor(numVertices)) {
            currentGroup = new ArrayGroup({
                layoutVertexArrayType: this.programInterfaces[programName].layoutVertexArrayType,
                elementArrayType: this.programInterfaces[programName].elementArrayType,
                elementArrayType2: this.programInterfaces[programName].elementArrayType2,
                paintVertexArrayTypes: this.paintVertexArrayTypes[programName]
            });

            currentGroup.index = groups.length;

            groups.push(currentGroup);
        }

        return currentGroup;
    }

    /**
     * Sets up `this.paintVertexArrayTypes` as { [programName]: { [layerName]: PaintArrayType, ... }, ... }
     *
     * And `this.arrayGroups` as { [programName]: [], ... }; these get populated
     * with array group structure over in `prepareArrayGroup`.
     */
    createArrays() {
        this.arrayGroups = {};
        this.paintVertexArrayTypes = {};

        for (const programName in this.programInterfaces) {
            this.arrayGroups[programName] = [];
            this.paintVertexArrayTypes[programName] = util.mapObject(
                this.programConfigurations[programName], (programConfiguration) => {
                    return programConfiguration.paintVertexArrayType();
                });
        }
    }

    destroy() {
        for (const programName in this.bufferGroups) {
            const programBufferGroups = this.bufferGroups[programName];
            for (let i = 0; i < programBufferGroups.length; i++) {
                programBufferGroups[i].destroy();
            }
        }
    }

    trimArrays() {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                arrayGroups[i].trim();
            }
        }
    }

    isEmpty() {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                if (!arrayGroups[i].isEmpty()) {
                    return false;
                }
            }
        }
        return true;
    }

    getTransferables(transferables) {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                arrayGroups[i].getTransferables(transferables);
            }
        }
    }

    serialize() {
        return {
            layerId: this.layer.id,
            zoom: this.zoom,
            arrays: util.mapObject(this.arrayGroups, (programArrayGroups) => {
                return programArrayGroups.map((arrayGroup) => {
                    return arrayGroup.serialize();
                });
            }),
            paintVertexArrayTypes: util.mapObject(this.paintVertexArrayTypes, (arrayTypes) => {
                return util.mapObject(arrayTypes, (arrayType) => {
                    return arrayType.serialize();
                });
            }),

            childLayerIds: this.childLayers.map((layer) => {
                return layer.id;
            })
        };
    }

    recalculateStyleLayers() {
        for (let i = 0; i < this.childLayers.length; i++) {
            this.childLayers[i].recalculate(this.zoom, FAKE_ZOOM_HISTORY);
        }
    }

    populatePaintArrays(interfaceName, globalProperties, featureProperties, startGroup, startIndex) {
        const groups = this.arrayGroups[interfaceName];
        const programConfiguration = this.programConfigurations[interfaceName];

        for (const layer of this.childLayers) {
            for (let g = startGroup.index; g < groups.length; g++) {
                const group = groups[g];
                const start = g === startGroup.index ? startIndex : 0;
                const length = group.layoutVertexArray.length;

                const paintArray = group.paintVertexArrays[layer.id];
                paintArray.resize(length);

                programConfiguration[layer.id].populatePaintArray(
                    layer,
                    paintArray,
                    start,
                    length,
                    globalProperties,
                    featureProperties);
            }
        }
    }
}

module.exports = Bucket;

const subclasses = {
    fill: require('./bucket/fill_bucket'),
    fillextrusion: require('./bucket/fill_extrusion_bucket'),
    line: require('./bucket/line_bucket'),
    circle: require('./bucket/circle_bucket'),
    symbol: require('./bucket/symbol_bucket')
};

/**
 * Instantiate the appropriate subclass of `Bucket` for `options`.
 * @param options See `Bucket` constructor options
 * @returns {Bucket}
 */
Bucket.create = function(options) {
    let type = options.layer.type;
    if (type === 'fill' && (!options.layer.isPaintValueFeatureConstant('fill-extrude-height') ||
        !options.layer.isPaintValueZoomConstant('fill-extrude-height') ||
        options.layer.getPaintValue('fill-extrude-height', {zoom: options.zoom}) !== 0)) {
        type = 'fillextrusion';
    }
    return new subclasses[type](options);
};
