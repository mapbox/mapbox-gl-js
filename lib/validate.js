'use strict';
var jsonlint = require('jsonlint-lines');
var isEqual = require('lodash.isequal');
var reference = require('./reference');

module.exports = validate;

function validate(str) {
    var style, errors = [];
    try {
        style = jsonlint.parse(str.toString());
    } catch(e) {
        var match = e.message.match(/line (\d+)/),
            lineNumber = 0;
        if (match) lineNumber = parseInt(match[1], 10);
        return [{
            line: lineNumber - 1,
            message: e.message,
            error: e
        }];
    }

    requiredEqual(style, 'version', '1', errors);

    if (typeof style.sprite !== 'undefined' &&
        typeof style.sprite !== 'string') {
        errors.push({
            message: 'sprite property of style must be a string',
            line: style.__line__
        });
    }

    if (!requiredProperty(style, 'buckets', 'object', errors)) {
        for (var bucket in style.buckets) {
            requiredProperty(style.buckets[bucket], 'filter', 'object', errors);
            var bucketErr = reference.validate.bucket(style.buckets[bucket]);
            if (bucketErr) {
                errors = errors.concat(bucketErr);
            }
        }
    }

    if (!requiredProperty(style, 'layers', 'array', errors)) {
        style.layers.forEach(validateLayer);
    }

    if (!requiredProperty(style, 'styles', 'object', errors)) {
        for (var s in style.styles) {
            for (var b in style.styles[s]) {
                for (var rule in style.styles[s][b]) {
                    var styleErr = reference.validate.style(rule,
                        style.styles[s][b][rule],
                        style.styles[s][b].__line__,
                        style.constants);
                    if (styleErr) {
                        errors = errors.concat(styleErr);
                    }
                }
            }
        }
    }

    function validateLayer(layer) {
        if (typeof layer.id !== 'string') {
            errors.push({
                messages: 'layer "id" property must be a string',
                line: layer.__line__
            });
        }
        if (Array.isArray(layer.layers)) {
            layer.layers.forEach(validateLayer);
        } else if (layer.bucket && typeof layer.bucket !== 'string') {
            errors.push({
                messages: 'layer "bucket" property must be a string',
                line: layer.__line__
            });
        }
    }

    return errors;
}

function requiredProperty(_, name, type, errors) {
    if (typeof _[name] == 'undefined') {
        return errors.push({
            message: '"' + name + '" property required',
            line: _.__line__
        });
    } else if (type === 'array') {
        if (!Array.isArray(_[name])) {
            return errors.push({
                message: '"' + name +
                    '" property should be an array, but is an ' +
                    (typeof _[name]) + ' instead',
                line: _.__line__
            });
        }
    } else if (type && typeof _[name] !== type) {
        return errors.push({
            message: '"' + name +
                '" property should be ' + (type) +
                ', but is an ' + (typeof _[name]) + ' instead',
            line: _.__line__
        });
    }
}

function requiredEqual(_, name, val, errors) {
    if (!isEqual(_[name], val)) {
        return errors.push({
            message: '"' + name + '" property must equal <' +
                String(val) + '>, <' + String(_[name]) + '> found',
            line: _.__line__
        });
    }
}
