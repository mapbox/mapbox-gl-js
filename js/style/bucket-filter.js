'use strict';

function infix(op) {
    return function(key, value) {
        return key + ' ' + op + ' ' + value;
    };
}

var infixOperators = {
    '==': infix('==='),
    '>': infix('>'),
    '<': infix('<'),
    '<=': infix('<='),
    '>=': infix('>='),
    '!=': infix('!==')
};

function or(items)  { return '(' + items.join(' || ') + ')'; }
function and(items) { return '(' + items.join(' && ') + ')'; }

module.exports = function (bucket, excludes) {
    if (!('filter' in bucket)) return;

    function valueFilter(key, value, operator) {
        return operator('f[' + JSON.stringify(key) + ']', JSON.stringify(value));
    }

    function fieldFilter(key, value, operator) {
        var operatorFn = infixOperators[operator || '=='];
        if (!operatorFn) throw new Error('Unknown operator: ' + operator);

        if (Array.isArray(value)) {
            return or(value.map(function (v) {
                return valueFilter(key, v, operatorFn);
            }));

        } else if (typeof value === 'object') {
            var filters = [];
            for (var op in value) {
                filters.push(fieldFilter(key, value[op], op));
            }
            return and(filters);

        } else {
            return valueFilter(key, value, operatorFn);
        }
    }

    function fieldsFilter(obj) {
        var filters = [];

        for (var key in obj) {
            if (!excludes || excludes.indexOf(key) === -1) {
                filters.push(fieldFilter(key, obj[key]));
            }
        }

        return filters.length ? and(filters) : null;
    }

    var filter = fieldsFilter(bucket.filter);
    if (!filter) return;

    // jshint evil: true
    return new Function('f', 'return ' + filter + ';');
};
