
var v0 = require('./test/styles/v0.js'),
    beautify = require('js-beautify').js_beautify;

function append(dest, src) {
    for (var i in src) {
        if (!(i in dest)) {
            dest[i] = src[i];
        }
    }
    return dest;
}

function jsonValue(value) {
    return typeof value === 'string' ? '\'' + value + '\'' : value;
}

module.exports = function (v0) {

    var v1 = {};

    v1.version = '1';


    // parse buckets

    var bucketIndex = {
        background: {id: 'background'}
    };

    for (var id in v0.buckets) {
        var v0bucket = v0.buckets[id];
        var bucket = {id: id};

        var filters = [];

        if (v0bucket.source) {
            filters.push('source == ' + jsonValue(v0bucket.source));
        }

        if (v0bucket.layer) {
            filters.push('layer == ' + jsonValue(v0bucket.layer));
        }
        if (v0bucket.value) {
            var valueFilters = (Array.isArray(v0bucket.value) ? v0bucket.value : [v0bucket.value]).map(function (value) {
                return v0bucket.field + ' == ' + jsonValue(value);
            });
            if (valueFilters.length > 1) {
                filters.push('(' + valueFilters.join(' || ') + ')');
            }else {
                filters.push(valueFilters.join(' || '));
            }
        }
        if (filters.length) {
            bucket.filter = filters.join(' && ');
        }

        bucketIndex[id] = bucket;
    }


    // parse structure

    function parseStructure(structure) {
        var buckets = [];

        for (var i = 0; i < structure.length; i++) {

            var id = structure[i].name,
                bucketId = structure[i].bucket,
                bucket = {id: id};

            if (structure[i].layers) {
                bucket.layers = parseStructure(structure[i].layers);
            } else {
                append(bucket, bucketIndex[bucketId]);
            }

            buckets.push(bucket);
        }

        return buckets;
    }

    v1.buckets = parseStructure(v0.structure);


    // v1.styles = v0.classes;

    console.log(beautify(JSON.stringify(v1)));

    return v1;
};

module.exports(v0);
