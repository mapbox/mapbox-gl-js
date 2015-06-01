'use strict';

var debugBuffers = {},
    tileExtentBuffers = {};

/**
 * Lazy-create Int16Array objects for any buffer size
 * @param {number} extent buffer extent: by default 4096.
 * @returns {Int16Array} extent buffer
 */
module.exports.getDebugBuffer = function getDebugBuffer(extent) {
    if (!debugBuffers[extent]) {
        debugBuffers[extent] = new Int16Array([
            0, 0, extent - 1, 0, extent - 1, extent - 1, 0, extent - 1, 0, 0]);
    }
    return debugBuffers[extent];
};

/**
 * Lazy-create Int16Array objects for any buffer size
 * @param {number} extent buffer extent: by default 4096.
 * @returns {Int16Array} extent buffer
 */
module.exports.getTileExtentBuffer = function getTileExtentBuffer(extent) {
    if (!tileExtentBuffers[extent]) {
        tileExtentBuffers[extent] = new Int16Array([
            // tile coord x, tile coord y, texture coord x, texture coord y
            0, 0, 0, 0,
            extent, 0, 32767, 0,
            0, extent, 0, 32767,
            extent, extent,  32767, 32767
        ]);
    }
    return tileExtentBuffers[extent];
};
