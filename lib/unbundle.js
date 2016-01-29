'use strict';

/**
 * Turn jsonlint-lines-primitives objects into primitive objects
 * @param value a potentially-bundled value
 * @returns an unbundled value
 */
module.exports = function unbundle(value) {
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        return value.valueOf();
    } else {
        return value;
    }
};
