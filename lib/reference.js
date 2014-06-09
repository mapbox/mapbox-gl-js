var reference = require('../reference/latest-style-raw.json'),
    parseCSSColor = require('csscolorparser').parseCSSColor,
    contains = require('lodash.contains');

module.exports.validate = {};

module.exports.validate.style = function(property, value, constants) {
    if (typeof reference.style[property] === 'undefined') {
        return [{
            message: 'style property unrecognized: ' + property,
            line: property.__line
        }];
    }
    var ref = reference.style[property];
    var err = checkType(value, ref, constants);
    if (err) return err;
    else return [];
};

function checkType(value, ref, constants) {
    if (ref.function && typeof value === 'object') {
        if (typeof value.fn !== 'string' || !contains(Object.keys(reference.style_fn), value.fn)) {
            return [{
                message: 'incorrect property value:' + value.fn + ' is not a function type',
                line: value.__line
            }];
        }
    } else if (constants && typeof value === 'string' && typeof constants[value] !== 'undefined') {
        return checkType(constants[value], ref);
    } else if (ref.type === 'boolean' ||
        ref.type === 'number' ||
        ref.type === 'string') {
        if (typeof value !== ref.type) {
            return [{
                message: 'incorrect property value: ' + ref.type + ' expected, ' +
                    (typeof value) + ' found',
                line: value.__line
            }];
        }
    } else if (Array.isArray(ref.type)) {
        if (!contains(ref.type, value)) {
            return [{
                message: 'incorrect property value: one of [' + ref.type.join(', ') + '] expected, ' +
                    value + ' found',
                line: value.__line
            }];
        }
    } else if (ref.type === 'color') {
        if (Array.isArray(value)) {
            if (value.length > 4 || value.length < 3) {
                return [{
                    message: 'incorrect property value: color arrays must be 3-4 elements long',
                    line: value.__line
                }];
            }
        } else if (parseCSSColor(value) === null) {
            return [{
                message: 'incorrect property value: ' + value + ' is not a color',
                line: value.__line
            }];
        }
    }
}
