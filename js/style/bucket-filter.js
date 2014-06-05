'use strict';

var operators = {
    '===': function(key, value) { return key + ' === ' + value; }
}

module.exports = function (bucket, excludes) {
    if (!('filter' in bucket)) return;

    function valueFilter(key, value, operator) {
        return operator('f[' + JSON.stringify(key) + ']', JSON.stringify(value));
    }

    function fieldFilter(key, value) {
        var operator = operators['==='];

        if (Array.isArray(value)) {
            return value.map(function (v) {
                return valueFilter(key, v, operator);
            }).join(' || ');
        } else {
            return valueFilter(key, value, operator);
        }
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
