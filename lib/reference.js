var reference = require('../reference/latest-style-raw.json'),
    parseCSSColor = require('csscolorparser').parseCSSColor,
    contains = require('lodash.contains');

module.exports.validate = {};

module.exports.validate.style = function(property, value) {
    if (typeof reference.style[property] === 'undefined') {
        return [{
            message: 'style property unrecognized: ' + property,
            line: property.__line
        }];
    }
    var ref = reference.style[property];
    var err = checkType(value, ref);
    if (err) return err;
    else return [];
};

function checkType(value, ref) {
    if (ref.type === 'boolean' ||
        ref.type === 'number' ||
        ref.type === 'string') {
        if (typeof value !== ref.type) {
            return [{
                message: 'incorrect property value: ' + ref.type + ' expected, ' +
                    (typeof value) + ' found',
                line: value.__line
            }];
        }
    }
    if (Array.isArray(ref.type)) {
        if (!contains(ref.type, value)) {
            return [{
                message: 'incorrect property value: one of [' + ref.type.join(', ') + '] expected, ' +
                    value + ' found',
                line: value.__line
            }];
        }
    }
    if (ref.type === 'color') {
        if (parseCSSColor(value) === null) {
            return [{
                message: 'incorrect property value: ' + value + ' is not a color',
                line: value.__line
            }];
        }
    }
}
