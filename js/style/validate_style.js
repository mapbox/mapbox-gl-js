'use strict';

module.exports = require('../style-spec/validate_style.min');

module.exports.emitErrors = function (emitter, errors) {
    if (errors && errors.length) {
        for (let i = 0; i < errors.length; i++) {
            emitter.fire('error', { error: new Error(errors[i].message) });
        }
        return true;
    } else {
        return false;
    }
};
