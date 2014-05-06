'use strict';

module.exports = function (bucket, excludes) {
    if (!('filter' in bucket)) return;

    // prevent a false warning (JSHint bug)
    // jshint -W088

    var key, value,
        filters = [];

    function keyValue(v) {
        return {key: key, value: v};
    }

    for (key in bucket.filter) {
        if (excludes && excludes.indexOf(key) !== -1) continue;

        value = bucket.filter[key];

        if (Array.isArray(value)) {
            filters.push.apply(filters, value.map(keyValue));
        } else {
            filters.push({key: key, value: value});
        }
    }

    if (!filters.length) return;

    // jshint evil: true
    return new Function('f', 'return ' + filters.map(function(f) {
        return 'f[' + JSON.stringify(f.key) + '] == ' + JSON.stringify(f.value);
    }).join(' || ') + ';');
};
