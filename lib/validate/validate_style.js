'use strict';

var validateConstants = require('./validate_constants');
var jsonlint = require('jsonlint-lines-primitives');
var styleSpecLookup = require('../../reference'); // TODO remove this
var validate = require('./validate');
var ParsingError = require('../parsing_error');

module.exports = function(style, styleSpec) {
    if (style instanceof String || typeof style === 'string') {
        return validateStyleString(style, styleSpec);

    } else if (style instanceof Buffer) {
        return validateStyleString(style.toString(), styleSpec);

    } else {
        return validateStyleObject(style, styleSpec);
    }
};

function validateStyleString(styleString, styleSpec) {
    var style;

    try {
        style = jsonlint.parse(styleString.toString());
    } catch (e) {
        return [ new ParsingError(e) ];
    }

    return validateStyleObject(style, styleSpec);
}

function validateStyleObject(style, styleSpec) {
    styleSpec = styleSpec || styleSpecLookup['v' + style.version] || require('../../reference/latest.min');

    var errors = [];

    errors = errors.concat(validate({
        key: '',
        value: style,
        valueSpec: styleSpec.$root,
        styleSpec: styleSpec,
        style: style
    }));

    if (styleSpec.$version > 7 && style.constants) {
        errors = errors.concat(validateConstants({
            key: 'constants',
            value: style.constants,
            style: style,
            styleSpec: styleSpec
        }));
    }

    return errors
        .filter(function(error) {
            return error !== undefined;
        })
        .sort(function (a, b) {
            return a.line - b.line;
        });
}
