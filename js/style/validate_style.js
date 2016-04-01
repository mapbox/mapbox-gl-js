'use strict';

module.exports = require('mapbox-gl-style-spec/lib/validate_style.min');

module.exports.emitErrors = function throwErrors(emitter, errors) {
    if (errors && errors.length) {
        for (var i = 0; i < errors.length; i++) {
            emitter.fire('error', { error: new Error(errors[i].message) });
        }
        return true;
    } else {
        return false;
    }
};

module.exports.throwErrors = function throwErrors(emitter, errors) {
    if (errors) {
        for (var i = 0; i < errors.length; i++) {
            throw new Error(errors[i].message);
        }
    }
};
