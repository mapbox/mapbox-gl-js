'use strict';

var validateConstants = require('./validate_constants');
var jsonlint = require('jsonlint-lines-primitives');
var referenceLookup = require('../../reference');
var validate = require('./validate');
var ParsingError = require('../parsing_error');

module.exports = function(style, reference) {
    if (style instanceof String || typeof style === 'string') {
        return validateStyleString(style, reference);

    } else if (style instanceof Buffer) {
        return validateStyleString(style.toString(), reference);

    } else {
        return validateStyleObject(style, reference);
    }
};

function validateStyleString(styleString, reference) {
    var style;

    try {
        style = jsonlint.parse(styleString.toString());
    } catch (e) {
        return [ new ParsingError(e) ];
    }

    return validateStyleObject(style, reference);
}

function validateStyleObject(style, reference) {
    reference = reference || referenceLookup['v' + style.version] || require('../../reference/latest');

    var errors = [];

    var context = {
        reference: reference,
        constants: style.constants || {},
        layers: {},
        style: style
    };

    errors = errors.concat(validate('', style, reference.$root, context));

    if (reference.$version > 7 && style.constants) {
        errors = errors.concat(validateConstants('constants', style.constants, null, context));
    }

    return errors
        .filter(function(error) {
            return error !== undefined;
        })
        .sort(function (a, b) {
            return a.line - b.line;
        });
}
