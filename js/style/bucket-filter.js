'use strict';

module.exports = function (bucket, excludes) {
    if (!('filter' in bucket)) return;

    // prevent a false warning (JSHint bug)
    // jshint -W088

    var key, value,
        filters = [];

    function valueFilter(value) {
        return 'f[' + JSON.stringify(key) + '] === ' + JSON.stringify(value);
    }

    for (key in bucket.filter) {
        if (excludes && excludes.indexOf(key) !== -1) continue;

        value = bucket.filter[key];

        filters.push(Array.isArray(value) ?
            value.map(valueFilter).join(' || ') : // for array values, match any item
            filters.push(valueFilter(value)));
    }

    if (!filters.length) return;

    // jshint evil: true
    return new Function('f', 'return ' + filters.join(' && ') + ';');
};
