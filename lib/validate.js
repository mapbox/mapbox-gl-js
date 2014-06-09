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

    if (!requiredProperty(style, 'buckets', 'object', errors)) {
        for (var bucket in style.buckets) {
            requiredProperty(style.buckets[bucket], 'filter', 'object', errors);
        }
    }

    if (!requiredProperty(style, 'styles', 'object', errors)) {
        for (var s in style.styles) {
            for (var b in style.styles[s]) {
                for (var rule in style.styles[s][b]) {
                    var styleErr = reference.validate.style(rule, style.styles[s][b][rule], style.constants);
                    if (styleErr) {
                        errors = errors.concat(styleErr);
                    }
                }
            }
        }
    }

    return errors;
}

function everyIs(_, type) {
    // make a single exception because typeof null === 'object'
    return _.every(function(x) { return (x !== null) && (typeof x === type); });
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
