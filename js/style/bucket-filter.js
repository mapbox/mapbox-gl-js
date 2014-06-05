'use strict';

var operators = {
    '===': function(key, value) { return key + ' === ' + value; },
    '>': function(key, value) { return key + ' > ' + value; },
    '<': function(key, value) { return key + ' < ' + value; }
}

module.exports = function (bucket, excludes) {
    if (!('filter' in bucket)) return;

    function valueFilter(key, value, operator) {
        return operator('f[' + JSON.stringify(key) + ']', JSON.stringify(value));
    }

    function fieldFilter(key, value, operator) {
        var operatorFn = operators[operator || '==='];

        if (Array.isArray(value)) {

            return value.map(function (v) {
                return valueFilter(key, v, operatorFn);
            }).join(' || ');

        } else if (typeof value === 'object') {
            var filters = [];
            for (var op in value) {
                filters.push(fieldFilter(key, value[op], op));
            }
            return filters.join(' && ');

        } else return valueFilter(key, value, operatorFn);
    }

    var filters = [];

    for (var key in bucket.filter) {
        if (!excludes || excludes.indexOf(key) === -1) {
            filters.push(fieldFilter(key, bucket.filter[key]));
        }
    }

    if (!filters.length) return;

    // jshint evil: true
    return new Function('f', 'return ' + filters.join(' && ') + ';');
};
