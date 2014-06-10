'use strict';
var reference = require('../reference/latest-style-raw.json'),
    parseCSSColor = require('csscolorparser').parseCSSColor,
    contains = require('lodash.contains');

// interpolate transitionable properties.
// bucket properties cannot be transitioned
for (var i in reference.style) {
    if (reference.style[i].transition) {
        reference.style['transition-' + i] = { type: 'transition' };
    }
}

module.exports.validate = {};

module.exports.validate.style = function(property, value, line, constants) {
    return validateProperty(property, value, line, 'style', constants);
};

function validateProperty(property, value, line, scheme, constants) {
    if (typeof reference[scheme][property] === 'undefined') {
        return [{
            message: scheme + ' property unrecognized: ' + property,
            line: line
        }];
    }
    var ref = reference[scheme][property];
    var err = checkType(property, value, ref, line, scheme, constants);
    if (err) return err;
    else return [];
}

module.exports.validate.bucket = function(property, value, line) {
    return validateProperty(property, value, line, 'bucket', {});
};

function checkType(property, value, ref, line, scheme, constants) {
    if (ref.function && typeof value === 'object') {
        if (typeof value.fn !== 'string' || !contains(Object.keys(reference.style_fn), value.fn)) {
            return [{
                message: 'incorrect property value for ' + property + ', ' + value.fn + ' is not a function type',
                line: line
            }];
        }
        if (value.fn === 'stops') {
            if (!stopsValid(value.stops)) {
                return [{
                    message: 'incorrect property value for ' + property + ', stops must be an array of arrays',
                    line: line
                }];
            }
        }
    } else if (ref.type === 'transition') {
        for (var i in value) {
            if (!reference.transition[i]) {
                return [{
                    message: 'unknown transition property: ' + i,
                    line: line
                }];
            }
            if (typeof value[i] !== reference.transition[i].type) {
                return [{
                    message: 'incorrect type of value for transition property: ' + i,
                    line: line
                }];
            }
        }
    } else if (constants && typeof value === 'string' && typeof constants[value] !== 'undefined') {
        return checkType(property, constants[value], ref, line, scheme);
    } else if (ref.type === 'boolean' ||
        ref.type === 'number' ||
        ref.type === 'string') {
        if (typeof value !== ref.type) {
            return [{
                message: 'incorrect property value: ' + property + ': ' + ref.type + ' expected, ' +
                    (typeof value) + ' found',
                line: line
            }];
        }
    } else if (Array.isArray(ref.type)) {
        if (!contains(ref.type, value)) {
            return [{
                message: 'incorrect property value ' + property + ' : one of [' + ref.type.join(', ') + '] expected, ' +
                    value + ' found',
                line: line
            }];
        }
    } else if (ref.type === 'color') {
        if (Array.isArray(value)) {
            if (value.length > 4 || value.length < 3) {
                return [{
                    message: 'incorrect property value: color arrays must be 3-4 elements long',
                    line: line
                }];
            }
        } else if (parseCSSColor(value) === null) {
            return [{
                message: 'incorrect property value: ' + value + ' is not a color',
                line: line
            }];
        }
    }
}

function stopsValid(_) {
    if (Array.isArray(_) && everyIs(_, 'object')) {
        for (var i = 0; i < _.length; i++) {
            if (typeof _[i] !== 'object' ||
                _[i].length !== 2) return false;
        }
        return true;
    } else {
        return false;
    }
}

function everyIs(_, type) {
    // make a single exception because typeof null === 'object'
    return _.every(function(x) {
        return (x !== null) && (typeof x === type);
    });
}
