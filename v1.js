
var v0 = require('./test/styles/v0.js');

module.exports = function (v0) {
    var v1 = {};

    v1.version = '1';

    v1.buckets = [];

    var sources = {};

    for (var id in v0.buckets) {
        var bucket = v0.buckets[id];
        bucket.id = id;
        sources[bucket.source] = sources[bucket.source] || [];
        sources[bucket.source].push(bucket);
    }

    for (var source in sources) {
        var buckets = [];
        var sourceBucket = {id: source, filter: 'source == ' + source, layers: buckets};

        for (var i = 0; i < sources[source].length; i++) {
            var v0bucket = sources[source][i],
                bucket = {id: v0bucket.id};

            var filters = [];
            if (v0bucket.layer) {
                filters.push('layer == ' + v0bucket.layer);
            }
            if (v0bucket.value) {
                filters.push((Array.isArray(v0bucket.value) ? v0bucket.value : [v0bucket.value]).map(function (value) {
                    return v0bucket.field + ' == ' + value;
                }).join(' || '));
            }
            if (filters.length) {
                bucket.filter = filters.join(' && ');
            }

            buckets.push(bucket);
        }
        v1.buckets.push(sourceBucket);
    }

    // v1.styles = v0.classes;

    console.log(JSON.stringify(v1));

    return v1;
};

module.exports(v0);
